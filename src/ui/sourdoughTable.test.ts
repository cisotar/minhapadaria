// @vitest-environment jsdom
/**
 * sourdoughTable.test.ts — Testes jsdom da sub-receita do Fermento (issue 015).
 *
 * Casos 1–9 do Plano Técnico da issue 015. Mesma justificativa jsdom de 014 e
 * mesma montagem (`createMemoryStorage` + `createPrefsStore` +
 * `createAppState(goldenSeed())`), agora com o terceiro parâmetro `normalize`
 * (state.ts, issue 015) amarrando `inheritSourdoughFlourCosts`.
 *
 * Nota sobre o caso 2 (desvio consciente vs a grafia solta do plano/spec
 * §2.B.2): o exemplo 1:7:7 do texto da spec mostra Isca=21g/Farinha=147g/
 * Água=147g mas rotula o Total como "310g" — 21+147+147=315, não 310 (typo
 * pré-existente na própria spec, herdado ao pé da letra pelo texto do plano).
 * Para um fixture matematicamente consistente (Total = soma exata dos três
 * pesos, sem arredondamento escondendo o erro), uso W_ferm=315 — o único valor
 * que reproduz 21,0/147,0/147,0 exatos com Partes 1:7:7 — em vez de 310.
 *
 * Casos 10/11a/11b (issue 023 — achados médios da revisão da 015): testes
 * faltantes de §5.B (botão remover desabilitado com 1 única farinha do
 * fermento) e §5.C (bloqueio + reversão no blur de Partes — soma zero e parte
 * negativa). Confirmados red→green manualmente durante a implementação
 * (guarda de `validateFlourCount`/`validateSourdoughParts` temporariamente
 * neutralizada reproduziu a falha esperada); nenhuma mudança de produção foi
 * necessária — a lógica já estava correta, só faltava a cobertura.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderSourdoughTable, inheritSourdoughFlourCosts } from './sourdoughTable';

function mount() {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const editedCostIds = new Set<string>();
  const store = createAppState(goldenSeed(), prefs, (d) => inheritSourdoughFlourCosts(d, editedCostIds));
  renderSourdoughTable(root, store, editedCostIds);
  return { root, store, prefs, editedCostIds };
}

describe('sourdoughTable (jsdom)', () => {
  it('1. layout golden §12 — Isca 0,0 · Farinha 100,0 · Água 100,0 · Total 2/200,0 · Hidratação 100,00%', () => {
    const { root } = mount();

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="farinha-header"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalParts = totalRow.children[1] as HTMLElement;
    const totalWeight = totalRow.children[2] as HTMLElement;
    const hydration = root.querySelector('[data-metric="hydration"]') as HTMLElement;

    expect(iscaWeight.textContent).toBe('0,0');
    expect(farinhaWeight.textContent).toBe('100,0');
    expect(aguaWeight.textContent).toBe('100,0');
    expect(totalParts.textContent).toBe('2');
    expect(totalWeight.textContent).toBe('200,0');
    expect(hydration.textContent).toBe('100,00%');
  });

  it('2. fixture 1:7:7 (§2.B.2) sobre W_ferm=315 → pesos 21,0/147,0/147,0, Total 15/315,0', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.flourTotalWeight = 1000;
    recipe.sourdough.percentageOfTotalFlour = 31.5; // W_ferm = 1000 × 31,5% = 315
    recipe.sourdough.parts = { isca: 1, flour: 7, water: 7 };
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="farinha-header"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalParts = totalRow.children[1] as HTMLElement;
    const totalWeight = totalRow.children[2] as HTMLElement;

    expect(iscaWeight.textContent).toBe('21,0');
    expect(farinhaWeight.textContent).toBe('147,0');
    expect(aguaWeight.textContent).toBe('147,0');
    expect(totalParts.textContent).toBe('15');
    expect(totalWeight.textContent).toBe('315,0');
  });

  it('3. alterar Parte redistribui pesos mantendo W_ferm (§4) — sem recriar input focado', () => {
    const { root } = mount();
    const iscaInput = root.querySelector('input[aria-label="Proporção da Isca"]') as HTMLInputElement;
    expect(iscaInput.value).toBe('0');
    iscaInput.focus();

    iscaInput.value = '1'; // Partes 0:1:1 → 1:1:1
    iscaInput.dispatchEvent(new Event('input', { bubbles: true }));

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="farinha-header"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalWeight = totalRow.children[2] as HTMLElement;

    expect(iscaWeight.textContent).toBe('66,7');
    expect(farinhaWeight.textContent).toBe('66,7');
    expect(aguaWeight.textContent).toBe('66,7');
    expect(totalWeight.textContent).toBe('200,0'); // W_ferm inalterado (§3.B independe das Partes)
    // O input editado continua o MESMO nó — não foi recriado no caminho de repintura (§1.6).
    expect(root.querySelector('input[aria-label="Proporção da Isca"]')).toBe(iscaInput);
  });

  it('4. hidratação derivada "—" com parte Farinha=0 (§5.C)', () => {
    const { root } = mount();
    const hydration = root.querySelector('[data-metric="hydration"]') as HTMLElement;
    expect(hydration.textContent).toBe('100,00%');

    const flourPartInput = root.querySelector(
      'input[aria-label="Proporção da Farinha do fermento"]',
    ) as HTMLInputElement;
    flourPartInput.value = '0'; // Partes 0:1:1 → 0:0:1 (Farinha do Fermento = 0)
    flourPartInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(hydration.textContent).toBe('—');
  });

  it('5. blur com soma % das farinhas do fermento ≠ 100 reverte (§2.B.3/§5.A)', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.sourdough.flours[0].percentage = 60;
    recipe.sourdough.flours.push({
      flourId: 'flour-2',
      name: 'Farinha Integral',
      percentage: 40,
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      weight: 0,
    });
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const pctInput = root.querySelector('input[aria-label="Proporção de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput.value).toBe('60,00');

    pctInput.value = '90,00'; // 90 + 40 = 130% — rompe 100%
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pctInput.value).toBe('60,00'); // reverte ao último valor válido, sem redistribuir
  });

  it('6. Isca sem campo de custo em nenhum estado (§2.B.2), com/sem show-costs', () => {
    const { root, store } = mount();
    const iscaRow = root.querySelector('tr[data-sd-row="isca"]') as HTMLTableRowElement;
    const costCell = iscaRow.children[6] as HTMLElement;

    expect(iscaRow.querySelector('.pw-combo')).toBeNull();
    expect(iscaRow.querySelector('input[aria-label^="Preço pago"]')).toBeNull();
    expect(costCell.textContent).toBe('R$ 0,00');

    store.setShowCosts(true);
    expect(iscaRow.querySelector('.pw-combo')).toBeNull();
    expect(iscaRow.querySelector('input[aria-label^="Preço pago"]')).toBeNull();
    expect(costCell.textContent).toBe('R$ 0,00');
  });

  it('7. nome de farinha do fermento com <script> renderiza inerte (regra de ouro 3)', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.sourdough.flours[0].name = '<script>x</script>';
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    expect(root.querySelector('script')).toBeNull();
    const nameInput = root.querySelector('input[aria-label="Nome da farinha do fermento"]') as HTMLInputElement;
    expect(nameInput.value).toBe('<script>x</script>'); // literal, nunca executado
  });

  it('8. custo herdado da farinha principal (§4) — para de herdar após edição manual', () => {
    const { root, store, editedCostIds } = mount();
    const costGCell = root.querySelector('tr[data-sd-row="flour"]')!.children[5] as HTMLElement;
    expect(costGCell.textContent).toBe('R$ 0,0080'); // 8 / 1000g (golden)

    store.update((draft) => {
      draft.ingredients[0].packageCost.pricePaid = 10; // farinha principal muda de preço
    });
    expect(costGCell.textContent).toBe('R$ 0,0100'); // herdado automaticamente (§4)

    const priceInput = root.querySelector('input[aria-label="Preço pago de Farinha Branca"]') as HTMLInputElement;
    priceInput.value = '5,00';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editedCostIds.has('flour-1')).toBe(true);
    expect(costGCell.textContent).toBe('R$ 0,0050'); // editado manualmente

    store.update((draft) => {
      draft.ingredients[0].packageCost.pricePaid = 20; // muda de novo — não deve mais sobrescrever
    });
    expect(costGCell.textContent).toBe('R$ 0,0050');
  });

  it('10. botão remover desabilitado com 1 única farinha do fermento (§5.B/validateFlourCount)', () => {
    const { root } = mount(); // goldenSeed tem só 1 farinha do fermento (flour-1)
    const removeBtn = root.querySelector(
      'tr[data-sd-row="flour"] button[aria-label="Remover Farinha Branca"]',
    ) as HTMLButtonElement;

    expect(removeBtn.disabled).toBe(true);
    expect(removeBtn.title).toBe('É necessária ao menos 1 farinha no fermento.');
  });

  it('11a. blur com Partes 0:0:0 (SomaPartes=0) bloqueia e reverte campo + estado (§5.C/validateSourdoughParts)', () => {
    const { root, store } = mount(); // golden: Partes 0:1:1
    const flourInput = root.querySelector(
      'input[aria-label="Proporção da Farinha do fermento"]',
    ) as HTMLInputElement;
    const aguaInput = root.querySelector('input[aria-label="Proporção da Água do fermento"]') as HTMLInputElement;

    flourInput.value = '0';
    flourInput.dispatchEvent(new Event('input', { bubbles: true })); // Partes 0:0:1 (ainda válido, soma=1)
    aguaInput.value = '0';
    aguaInput.dispatchEvent(new Event('input', { bubbles: true })); // Partes 0:0:0 — soma zerada
    aguaInput.dispatchEvent(new Event('blur', { bubbles: true })); // §5.C: bloqueio no blur

    expect(aguaInput.value).toBe('1'); // reverte o campo ao último valor válido (1)
    expect(aguaInput.getAttribute('aria-invalid')).toBe('true');
    expect(store.getState().recipe.sourdough.parts.water).toBe(1); // estado também revertido, não só o campo
  });

  it('11b. blur com parte negativa (Isca=-1) bloqueia e reverte campo + estado (§5.C/validateSourdoughParts)', () => {
    const { root, store } = mount(); // golden: Partes 0:1:1
    const iscaInput = root.querySelector('input[aria-label="Proporção da Isca"]') as HTMLInputElement;

    iscaInput.value = '-1';
    iscaInput.dispatchEvent(new Event('input', { bubbles: true }));
    iscaInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(iscaInput.value).toBe('0'); // reverte ao último valor válido (0)
    expect(iscaInput.getAttribute('aria-invalid')).toBe('true');
    expect(store.getState().recipe.sourdough.parts.isca).toBe(0); // estado também revertido
  });

  it('9. toggle "Exibir custos" (011) reflete na tabela do fermento via subscribe (§2.A.2)', () => {
    const { root, store } = mount();
    const table = root.querySelector('table') as HTMLTableElement;
    expect(table.classList.contains('show-costs')).toBe(false);

    store.setShowCosts(true);
    expect(table.classList.contains('show-costs')).toBe(true);

    store.setShowCosts(false);
    expect(table.classList.contains('show-costs')).toBe(false);
  });
});
