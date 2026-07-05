// @vitest-environment jsdom
/**
 * ingredientsTable.test.ts — Testes jsdom da Tabela de Insumos (issue 014).
 *
 * Justificativa da devDependency `jsdom` (architecture.md: "jsdom só se um
 * teste de UI precisar"): validar automaticamente, sem depender só de
 * verificação manual, os dois comportamentos mais críticos e baratos de
 * cobrir — escape XSS (regra de ouro 3) e o wiring de recálculo imediato
 * (§1.6) — mais o toggle de custos (011) e a reversão de validação (§5.A).
 * `// @vitest-environment jsdom` no topo restringe o ambiente pesado a este
 * único arquivo (vite.config.ts mantém `node` como default).
 *
 * Casos do Plano Técnico da issue 014.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderIngredientsTable } from './ingredientsTable';

function mount() {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const store = createAppState(goldenSeed(), prefs);
  renderIngredientsTable(root, store);
  return { root, store, prefs };
}

describe('ingredientsTable (jsdom)', () => {
  it('1. nome <script>x</script> renderiza inerte (escape XSS, regra de ouro 3)', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.ingredients[1].name = '<script>x</script>'; // Água → nome malicioso
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    expect(root.querySelector('script')).toBeNull();
    const row = root.querySelector('tr[data-ingredient-id="water-1"]') as HTMLTableRowElement;
    const nameInput = row.querySelector('input[aria-label="Nome do ingrediente"]') as HTMLInputElement;
    expect(nameInput.value).toBe('<script>x</script>'); // literal, nunca executado
  });

  it('2. input em % da Água (70→80) atualiza o Peso instantaneamente (§1.6)', () => {
    const { root } = mount();
    const pctInput = root.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    const row = pctInput.closest('tr') as HTMLTableRowElement;
    const weightCell = row.querySelector('td.readonly') as HTMLElement;

    expect(weightCell.textContent).toBe('700,0');

    pctInput.value = '80,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(weightCell.textContent).toBe('800,0');
  });

  it('3. toggle "Exibir custos" reflete no <table> e chama prefs.setShowCosts', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const setShowCostsSpy = vi.spyOn(prefs, 'setShowCosts');
    const store = createAppState(goldenSeed(), prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    const checkbox = root.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const table = root.querySelector('table') as HTMLTableElement;
    expect(table.classList.contains('show-costs')).toBe(false); // default oculto (§2.A.2)

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(table.classList.contains('show-costs')).toBe(true);
    expect(setShowCostsSpy).toHaveBeenCalledWith(true);
  });

  it('5. ordem fixa das colunas do <thead> (§2.A.2)', () => {
    const { root } = mount();
    const headers = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toEqual([
      'Ingrediente',
      'Unidade',
      '%',
      'Peso (g)',
      'Preço pago',
      'Peso do produto',
      'Custo/g',
      'Custo',
    ]);
  });

  it('6. alternador g/mL da Água: clicar "mL" não muda o Peso (canônico em g, §2.A)', () => {
    const { root } = mount();
    const row = root.querySelector('tr[data-ingredient-id="water-1"]') as HTMLTableRowElement;
    const weightCell = row.querySelector('td.readonly') as HTMLElement;
    expect(weightCell.textContent).toBe('700,0');

    const mlBtn = row.querySelector('button[aria-label="Usar mililitros para Água"]') as HTMLButtonElement;
    mlBtn.click(); // troca só o rótulo/inputUnit — densidade 1:1 (§2.A), dispara fullRender()

    // fullRender() recria a linha — precisa reobter os nós após o clique.
    const rowAfter = root.querySelector('tr[data-ingredient-id="water-1"]') as HTMLTableRowElement;
    const weightCellAfter = rowAfter.querySelector('td.readonly') as HTMLElement;
    expect(weightCellAfter.textContent).toBe('700,0'); // peso canônico em g inalterado
    const mlBtnAfter = rowAfter.querySelector('button[aria-label="Usar mililitros para Água"]') as HTMLButtonElement;
    expect(mlBtnAfter.classList.contains('active')).toBe(true); // rótulo trocou
  });

  it('7. blur do Peso do Produto = 0 reverte (§5.C, impede ÷0 no Custo/g)', () => {
    const { root } = mount();
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const pwInput = row.querySelector('input[aria-label="Peso do produto de Farinha Branca"]') as HTMLInputElement;
    expect(pwInput.value).toBe('1,0'); // packageSize=1 (na unidade "kg" do seletor, formatWeight sem milhar)

    pwInput.value = '0';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pwInput.value).toBe('1,0'); // reverte ao último valor válido
    expect(pwInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('8. blur do Preço Pago = −1 reverte (§5.C, não-negativo)', () => {
    const { root } = mount();
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const priceInput = row.querySelector('input[aria-label="Preço pago de Farinha Branca"]') as HTMLInputElement;
    expect(priceInput.value).toBe('8,00');

    priceInput.value = '-1';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(priceInput.value).toBe('8,00'); // reverte ao último valor válido
    expect(priceInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('9. mínimo 1 farinha: botão remover desabilitado na última farinha (§5.B)', () => {
    const { root } = mount(); // golden seed tem uma única farinha (Farinha Branca)
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const removeBtn = row.querySelector('button[aria-label="Remover Farinha Branca"]') as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
    expect(removeBtn.title).toMatch(/farinha/i);

    // Outra categoria (não-farinha) permanece removível normalmente.
    const saltRow = root.querySelector('tr[data-ingredient-id="salt-1"]') as HTMLTableRowElement;
    const saltRemoveBtn = saltRow.querySelector('button[aria-label="Remover Sal"]') as HTMLButtonElement;
    expect(saltRemoveBtn.disabled).toBe(false);
  });

  it('4. blur com soma de farinhas ≠ 100% reverte o campo (§5.A)', () => {
    // Cenário com 2 farinhas (60/40) para exercitar a soma — golden seed tem 1 só.
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.ingredients[0].percentage = 60;
    recipe.ingredients[0].name = 'Farinha Branca';
    recipe.ingredients.splice(1, 0, {
      id: 'flour-2',
      name: 'Farinha Integral',
      category: 'flour',
      weight: 0,
      percentage: 40,
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
    });
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    const pctInput = root.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput.value).toBe('60,00');

    pctInput.value = '90,00'; // 90 + 40 = 130% — rompe 100%
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pctInput.value).toBe('60,00'); // reverte ao último valor válido, sem redistribuir
  });
});
