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

  it('5. ordem das colunas do <thead> — Unidade após Custo, Ações por último (diretiva de layout)', () => {
    const { root } = mount();
    const headers = Array.from(root.querySelectorAll('thead th')).map((th) => th.textContent);
    // Desvio consciente vs spec §2.A.2/mockup: "Unidade" foi movida para logo
    // depois de "Custo" e a coluna de ações (botão remover) é a última da linha.
    expect(headers).toEqual([
      'Ingrediente',
      '%',
      'Peso (g)',
      'Preço pago',
      'Peso do produto',
      'Custo/g',
      'Custo',
      'Unidade',
      '', // coluna de ações (aria-label "Ações", sem texto visível)
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

  it('7. farinha (linha consumida): Peso do Produto e Preço Pago são texto plano, sem <input> (edição migrou para a Ancoragem)', () => {
    const { root } = mount();
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;

    expect(row.querySelector('input[aria-label="Peso do produto de Farinha Branca"]')).toBeNull();
    expect(row.querySelector('input[aria-label="Preço pago de Farinha Branca"]')).toBeNull();
    expect(row.querySelector('input[aria-label="Nome da farinha"]')).toBeNull();
    expect(row.querySelector('input[aria-label="Porcentagem de Farinha Branca"]')).toBeNull();

    const cells = Array.from(row.querySelectorAll('td'));
    expect(cells[0].textContent).toContain('Farinha Branca');
    expect(cells[0].querySelector('small.note-muted')).not.toBeNull(); // "(↑ vem da Ancoragem)"
    expect(cells[3].textContent).toBe('R$ 8,00'); // Preço pago (packageCost.pricePaid da golden seed)
    expect(cells[4].textContent).toBe('1,0 kg'); // Peso do produto (packageSize + unidade)
  });

  it('8. farinha (linha consumida): editar `packageCost`/`percentage` no store (ex.: via Ancoragem) repinta % / peso / preço / peso-do-produto aqui', () => {
    const { root, store } = mount();
    const row = () => root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const cells = () => Array.from(row().querySelectorAll('td'));

    expect(cells()[1].textContent).toBe('100,00'); // única farinha — 100% (golden seed)

    store.update((draft) => {
      draft.ingredients[0].packageCost.pricePaid = 12;
      draft.ingredients[0].packageCost.packageSize = 2;
    });

    expect(cells()[3].textContent).toBe('R$ 12,00');
    expect(cells()[4].textContent).toBe('2,0 kg');
  });

  it('9. farinha (linha consumida): sem botão remover — a trava de mínimo 1 farinha (§5.B) vive na Ancoragem (batchPanel.ts)', () => {
    const { root } = mount(); // golden seed tem uma única farinha (Farinha Branca)
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const actionsCell = row.querySelector('td.col-actions') as HTMLElement;
    expect(actionsCell.querySelector('button')).toBeNull(); // sem remover aqui — só na Ancoragem

    // Outra categoria (não-farinha) permanece removível normalmente, sem trava.
    const saltRow = root.querySelector('tr[data-ingredient-id="salt-1"]') as HTMLTableRowElement;
    const saltRemoveBtn = saltRow.querySelector('button[aria-label="Remover Sal"]') as HTMLButtonElement;
    expect(saltRemoveBtn.disabled).toBe(false);
  });

  it('10. peso→%: editar Peso da Água atualiza a % derivada instantaneamente (§1.3, issue 024)', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.calculationMode = 'weight-to-percentage';
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    const row = root.querySelector('tr[data-ingredient-id="water-1"]') as HTMLTableRowElement;
    const weightInput = row.querySelector('input[aria-label="Peso de Água"]') as HTMLInputElement;
    const pctInput = row.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    const pctBefore = pctInput.value;

    weightInput.value = '1400';
    weightInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(pctInput.value).not.toBe(pctBefore); // §1.3: peso é a verdade; % passa a ser derivada
    expect(pctInput.readOnly).toBe(true);
  });

  it('4. múltiplas farinhas (2): as duas aparecem como linhas consumidas, somente-leitura, na ordem do array (§5.A vive na Ancoragem)', () => {
    // Cenário com 2 farinhas (60/40) — golden seed tem 1 só. A soma-100% (§5.A)
    // é validada na tabela "Farinhas" do card Ancoragem (batchPanel.ts); aqui
    // a tabela Ingredientes só exibe o que já veio calculado.
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

    expect(root.querySelector('input[aria-label="Porcentagem de Farinha Branca"]')).toBeNull();
    expect(root.querySelector('input[aria-label="Porcentagem de Farinha Integral"]')).toBeNull();

    const row1 = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const row2 = root.querySelector('tr[data-ingredient-id="flour-2"]') as HTMLTableRowElement;
    expect((row1.querySelectorAll('td')[1] as HTMLElement).textContent).toBe('60,00');
    expect((row2.querySelectorAll('td')[1] as HTMLElement).textContent).toBe('40,00');
  });

  it('11. contrato-espelho §3.2 (spec/refactor-farinhas-multiplas.md, AC6): farinhas formam bloco CONTÍGUO no topo mesmo com array NÃO-contíguo (ex.: farinha adicionada no fim, como o botão "+ farinha" faz)', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed(); // [flour-1, water-1, oil-1, salt-1]
    recipe.ingredients.push({
      id: 'flour-2',
      name: 'Farinha Integral',
      category: 'flour',
      weight: 0,
      percentage: 0,
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
    }); // array cru: [flour-1, water-1, oil-1, salt-1, flour-2] — farinhas NÃO adjacentes no array
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    const rows = Array.from(root.querySelectorAll('tbody tr')).filter((tr) => !tr.querySelector('.table-add-cell'));
    // AC6: as 2 primeiras linhas são as farinhas, na ordem do array, antes de água/azeite/sal/Fermento.
    expect(rows.map((tr) => tr.getAttribute('data-ingredient-id'))).toEqual([
      'flour-1',
      'flour-2',
      'water-1',
      'oil-1',
      'salt-1',
      'fermento',
    ]);
  });

  it('12. contrato-espelho §3.4 (spec/refactor-farinhas-multiplas.md, AC2, bug do nome): renomear a farinha no store repinta o NOME aqui, sem fullRender (mesma lista de ids)', () => {
    const { root, store } = mount();
    const row = () => root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    expect(row().querySelector('td')?.textContent).toContain('Farinha Branca');

    store.update((draft) => {
      draft.ingredients[0].name = 'Venturelli';
    });

    expect(row().querySelector('td')?.textContent).toContain('Venturelli');
    expect(row().querySelector('td')?.textContent).toContain('vem da Ancoragem'); // nota preservada
    expect(row().querySelector('script')).toBeNull();
  });

  it('13. escape XSS no nome da farinha (regra de ouro 3): nunca via innerHTML, mesmo repintado pelo patch do nome', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const store = createAppState(goldenSeed(), prefs);
    const root = document.createElement('div');
    renderIngredientsTable(root, store);

    store.update((draft) => {
      draft.ingredients[0].name = '<script>x</script>';
    });

    expect(root.querySelector('script')).toBeNull();
    const row = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    expect(row.querySelector('td')?.textContent).toContain('<script>x</script>'); // literal, nunca executado
  });
});
