// @vitest-environment jsdom
/**
 * sourdoughTable.test.ts — Testes jsdom da sub-receita do Fermento (issue 015;
 * refactor-farinhas-multiplas §5, fase 2, 2026-07-06 — proporção por linha).
 *
 * Mesma justificativa jsdom/montagem de sempre (`createMemoryStorage` +
 * `createPrefsStore` + `createAppState(goldenSeed())`, terceiro parâmetro
 * `normalize` amarrando `inheritSourdoughFlourCosts`).
 *
 * Reescrito para o modelo de PROPORÇÃO POR LINHA (spec §5.1–§5.6, AC15–AC23):
 * `SourdoughParts` = `{isca, water}` (sem `flour`); `SourdoughFlour.proportion`
 * (era `percentage`); denominador GLOBAL = isca + Σ(proporções das farinhas) +
 * água (`sourdoughDenominator`, core). A linha "Farinha" cabeçalho foi REMOVIDA
 * — cada farinha do fermento agora é uma linha DIRETA (`tr[data-sd-row="flour"]`).
 * A antiga linha "Total de fermento" era um campo avulso ACIMA da tabela;
 * agora é a 1ª LINHA dela (`tr[data-sd-row="total-fermento"]`).
 *
 * Nota sobre a fixture 1:7:7 (§2.B.2, mantida do arquivo anterior): o exemplo
 * do texto da spec mostra Isca=21g/Farinha=147g/Água=147g mas rotula o Total
 * como "310g" — 21+147+147=315, não 310 (typo pré-existente na própria spec).
 * Uso W_ferm=315 (único valor que reproduz 21,0/147,0/147,0 exatos), com
 * Isca=1, farinha.proportion=7, Água=7 (denom=15) no novo modelo — mesmos
 * números do modelo antigo (Partes 1:7:7), só a fonte da proporção da farinha
 * mudou de `parts.flour` para `SourdoughFlour.proportion`.
 *
 * Ajuste do cliente (2026-07-06, spec §5.1/AC15/AC24/AC25):
 *  1. Nova ordem das linhas: Total de fermento · Isca · Água · farinhas do
 *     cliente · Total (tfoot) — Água subiu, antes das farinhas.
 *  2. "Total de fermento" agora exibe o custo agregado (Custo/g e Custo, §5.4:
 *     Σ farinhas + água, isca fora) e é renderizada em negrito.
 *  3. Seed (`seed.ts`) passou a usar Isca=1 (era 0) — denom global do
 *     fermento vira 1+1+1=3 (era 0+1+1=2): FarinhaFerm/ÁguaFerm/Isca do
 *     seed agora são W_ferm/3 ≈ 66,7g cada (eram 100,0g/0,0g). Números
 *     recalculados pelo engine, não à mão (AC25) — `golden-example.test.ts`
 *     mantém fixture próprio com Isca 0 para validar as fórmulas da §12.
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
  it('1. layout seed atual (Isca=1) — Isca 66,7 · Farinha 66,7 · Água 66,7 · Total 3/200,0 · Hidratação 100,00%', () => {
    const { root } = mount();

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="flour"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalParts = totalRow.children[1] as HTMLElement;
    const totalWeight = totalRow.children[2] as HTMLElement;
    const hydration = root.querySelector('[data-metric="hydration"]') as HTMLElement;

    expect(iscaWeight.textContent).toBe('66,7');
    expect(farinhaWeight.textContent).toBe('66,7');
    expect(aguaWeight.textContent).toBe('66,7');
    expect(totalParts.textContent).toBe('3'); // Σproporções = isca(1) + farinha(1) + água(1)
    expect(totalWeight.textContent).toBe('200,0');
    expect(hydration.textContent).toBe('100,00%'); // água=farinha em qualquer denom — hidratação inalterada
  });

  it('2. fixture 1:7:7 (§2.B.2) sobre W_ferm=315 (proporção por linha) → pesos 21,0/147,0/147,0, Total 15/315,0', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.flourTotalWeight = 1000;
    recipe.sourdough.percentageOfTotalFlour = 31.5; // W_ferm = 1000 × 31,5% = 315
    recipe.sourdough.parts = { isca: 1, water: 7 };
    recipe.sourdough.flours[0].proportion = 7; // era parts.flour=7 no modelo antigo
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="flour"]')!.children[2] as HTMLElement;
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

  it('3. alterar Proporção (Isca) redistribui pesos mantendo W_ferm (§4/refactor §5.3) — sem recriar input focado', () => {
    const { root } = mount();
    const iscaInput = root.querySelector('input[aria-label="Proporção da Isca"]') as HTMLInputElement;
    expect(iscaInput.value).toBe('1'); // seed atual: Isca=1 (ajuste do cliente, era 0)
    iscaInput.focus();

    iscaInput.value = '2'; // Isca 1 → 2: denom global 1+1+1=3 vira 2+1+1=4
    iscaInput.dispatchEvent(new Event('input', { bubbles: true }));

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="flour"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalWeight = totalRow.children[2] as HTMLElement;

    expect(iscaWeight.textContent).toBe('100,0'); // 200 × 2/4
    expect(farinhaWeight.textContent).toBe('50,0'); // 200 × 1/4
    expect(aguaWeight.textContent).toBe('50,0'); // 200 × 1/4
    expect(totalWeight.textContent).toBe('200,0'); // W_ferm inalterado (§3.B independe das proporções)
    // O input editado continua o MESMO nó — não foi recriado no caminho de repintura (§1.6).
    expect(root.querySelector('input[aria-label="Proporção da Isca"]')).toBe(iscaInput);
  });

  it('4. hidratação derivada "—" com Σ(proporções das farinhas)=0 (refactor §5.5/AC21)', () => {
    const { root } = mount();
    const hydration = root.querySelector('[data-metric="hydration"]') as HTMLElement;
    expect(hydration.textContent).toBe('100,00%');

    const flourPropInput = root.querySelector(
      'input[aria-label="Proporção de Farinha Branca"]',
    ) as HTMLInputElement;
    flourPropInput.value = '0'; // única farinha do fermento → 0 → Σfarinhas = 0
    flourPropInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(hydration.textContent).toBe('—');
  });

  it('5. AC23 — proporções livres das farinhas do fermento: blur com valores que NÃO somam 100 nunca reverte nem bloqueia', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.sourdough.flours[0].proportion = 3;
    recipe.sourdough.flours.push({
      flourId: 'flour-2',
      name: 'Farinha Integral',
      proportion: 5, // Σ = 8 — longe de 100, e não deveria importar (sem regra de soma-100 no fermento)
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      weight: 0,
    });
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const propInput = root.querySelector('input[aria-label="Proporção de Farinha Branca"]') as HTMLInputElement;
    expect(propInput.value).toBe('3');

    propInput.value = '9,00'; // 9 + 5 = 14 — ainda longe de 100; não deve bloquear/reverter
    propInput.dispatchEvent(new Event('input', { bubbles: true }));
    propInput.dispatchEvent(new Event('blur', { bubbles: true }));

    // partsPlain (número livre, §7.1) só troca separador — "9,00" normaliza para "9"
    // (sem casas fixas, ao contrário de %). O importante: NUNCA reverte (AC23).
    expect(propInput.value).toBe('9');
    expect(propInput.getAttribute('aria-invalid')).toBeNull(); // sem bloqueio
  });

  it('6. Isca sem campo de custo em nenhum estado (§2.B.2/AC16), com/sem show-costs; só Proporção editável', () => {
    const { root, store } = mount();
    const iscaRow = root.querySelector('tr[data-sd-row="isca"]') as HTMLTableRowElement;
    const costCell = iscaRow.children[6] as HTMLElement;

    expect(iscaRow.querySelector('input[aria-label="Proporção da Isca"]')).not.toBeNull(); // só Proporção editável
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

  it('8. custo herdado da farinha principal (§4/AC13, não-regressão) — para de herdar após edição manual', () => {
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

  it('9. toggle "Exibir custos" (011) reflete na tabela do fermento via subscribe (§2.A.2)', () => {
    const { root, store } = mount();
    const table = root.querySelector('table') as HTMLTableElement;
    expect(table.classList.contains('show-costs')).toBe(false);

    store.setShowCosts(true);
    expect(table.classList.contains('show-costs')).toBe(true);

    store.setShowCosts(false);
    expect(table.classList.contains('show-costs')).toBe(false);
  });

  it('10. botão remover desabilitado com 1 única farinha do fermento (§5.B/validateFlourCount, AC17)', () => {
    const { root } = mount(); // goldenSeed tem só 1 farinha do fermento (flour-1)
    const removeBtn = root.querySelector(
      'tr[data-sd-row="flour"] button[aria-label="Remover Farinha Branca"]',
    ) as HTMLButtonElement;

    expect(removeBtn.disabled).toBe(true);
    expect(removeBtn.title).toBe('É necessária ao menos 1 farinha no fermento.');
  });

  it('11a. blur com Isca=0, Farinha=0 e Água=0 (denominador global zerado) bloqueia e reverte campo + estado (§5.C/validateSourdoughParts)', () => {
    const { root, store } = mount(); // seed atual: Isca 1, farinha proporção 1, Água 1 — denom=3
    const iscaInput = root.querySelector('input[aria-label="Proporção da Isca"]') as HTMLInputElement;
    const flourPropInput = root.querySelector(
      'input[aria-label="Proporção de Farinha Branca"]',
    ) as HTMLInputElement;
    const aguaInput = root.querySelector('input[aria-label="Proporção da Água do fermento"]') as HTMLInputElement;

    iscaInput.value = '0';
    iscaInput.dispatchEvent(new Event('input', { bubbles: true })); // denom 0+1+1=2 (ainda válido)
    flourPropInput.value = '0';
    flourPropInput.dispatchEvent(new Event('input', { bubbles: true })); // denom 0+0+1=1 (ainda válido)
    aguaInput.value = '0';
    aguaInput.dispatchEvent(new Event('input', { bubbles: true })); // denom 0+0+0=0 — zerado
    aguaInput.dispatchEvent(new Event('blur', { bubbles: true })); // §5.C: bloqueio no blur

    expect(aguaInput.value).toBe('1'); // reverte o campo ao último valor válido (1)
    expect(aguaInput.getAttribute('aria-invalid')).toBe('true');
    expect(store.getState().recipe.sourdough.parts.water).toBe(1); // estado também revertido, não só o campo
  });

  it('11b. blur com Isca negativa (-1) bloqueia e reverte campo + estado (§5.C/validateSourdoughParts)', () => {
    const { root, store } = mount(); // seed atual: Isca 1, farinha proporção 1, Água 1
    const iscaInput = root.querySelector('input[aria-label="Proporção da Isca"]') as HTMLInputElement;
    expect(iscaInput.value).toBe('1'); // ajuste do cliente: default Isca=1 (era 0)

    iscaInput.value = '-1';
    iscaInput.dispatchEvent(new Event('input', { bubbles: true }));
    iscaInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(iscaInput.value).toBe('1'); // reverte ao último valor válido (1, não mais 0)
    expect(iscaInput.getAttribute('aria-invalid')).toBe('true');
    expect(store.getState().recipe.sourdough.parts.isca).toBe(1); // estado também revertido
  });

  /**
   * Critérios de aceite explícitos da fase 2 (spec/refactor-farinhas-multiplas.md
   * §6, AC15–AC20/AC22/AC23) — cobertura dedicada além dos casos 1–11 acima
   * (que já exercitam boa parte, reescritos para o novo modelo).
   */

  it('AC15 — ordem das linhas: Total de fermento (read-only, negrito) · Isca · Água · farinhas do cliente · Total (tfoot)', () => {
    const { root } = mount();
    const rows = Array.from(root.querySelectorAll('tbody tr')).filter((tr) => !tr.querySelector('.table-add-cell'));
    // Água SOBE (antes das farinhas) — ajuste do cliente, 2026-07-06.
    expect(rows.map((tr) => tr.getAttribute('data-sd-row'))).toEqual(['total-fermento', 'isca', 'agua', 'flour']);
    // "Total" (tfoot) vem depois de todo o tbody — é uma seção HTML diferente.
    expect(root.querySelector('tfoot tr td')?.textContent).toBe('Total');

    const totalRow = root.querySelector('tr[data-sd-row="total-fermento"]') as HTMLTableRowElement;
    expect(totalRow.querySelector('strong')).not.toBeNull(); // em negrito (AC15)
  });

  it('AC16 — Isca: só Proporção editável (padrão 1 no domínio da spec; golden usa 0), sem colunas de custo, custo R$0,00', () => {
    const { root } = mount();
    const iscaRow = root.querySelector('tr[data-sd-row="isca"]') as HTMLTableRowElement;
    const cells = Array.from(iscaRow.querySelectorAll('td'));

    expect(iscaRow.querySelectorAll('input')).toHaveLength(1); // só a Proporção
    expect(cells[3].textContent).toBe('—'); // Preço pago não se aplica
    expect(cells[4].textContent).toBe('—'); // Peso do produto não se aplica
    expect(cells[5].textContent).toBe('—'); // Custo/g não se aplica
    expect(cells[6].textContent).toBe('R$ 0,00'); // Custo sempre zero
    expect(iscaRow.querySelector('.col-actions button')).toBeNull(); // não removível
  });

  it('AC17 — "+ farinha do fermento" cria linha com Nome + Proporção + custo editáveis; removível', () => {
    const { root, store } = mount();
    const addBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent === '+ farinha do fermento',
    ) as HTMLButtonElement;
    addBtn.click();

    const flours = store.getState().recipe.sourdough.flours;
    expect(flours).toHaveLength(2);
    const newFlourId = flours[1].flourId;

    const newRow = root.querySelector(`tr[data-flour-id="${newFlourId}"]`) as HTMLTableRowElement;
    expect(newRow).toBeTruthy();
    expect(newRow.querySelector('input[aria-label="Nome da farinha do fermento"]')).not.toBeNull();
    expect(newRow.querySelector('input[aria-label^="Proporção de"]')).not.toBeNull();
    expect(newRow.querySelector('input[aria-label^="Preço pago de"]')).not.toBeNull();
    expect(newRow.querySelector('.pw-combo')).not.toBeNull();
    const removeBtn = newRow.querySelector('.col-actions button') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    expect(removeBtn.disabled).toBe(false); // 2 farinhas — remoção permitida
  });

  it('AC18 — Água: Proporção + custo editáveis; NÃO removível', () => {
    const { root } = mount();
    const aguaRow = root.querySelector('tr[data-sd-row="agua"]') as HTMLTableRowElement;

    expect(aguaRow.querySelector('input[aria-label="Proporção da Água do fermento"]')).not.toBeNull();
    expect(aguaRow.querySelector('input[aria-label="Preço pago da água do fermento"]')).not.toBeNull();
    expect(aguaRow.querySelector('.pw-combo')).not.toBeNull();
    expect(aguaRow.querySelector('.col-actions button')).toBeNull(); // não removível
  });

  it('AC19 — Peso de cada linha = W_ferm × proporção ÷ Σproporções; tfoot Σpeso = W_ferm', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed(); // F_total 1000, sourdough% 20 → W_ferm = 200
    recipe.sourdough.parts = { isca: 2, water: 3 };
    recipe.sourdough.flours[0].proportion = 5; // denom = 2+5+3 = 10
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const iscaWeight = root.querySelector('tr[data-sd-row="isca"]')!.children[2] as HTMLElement;
    const farinhaWeight = root.querySelector('tr[data-sd-row="flour"]')!.children[2] as HTMLElement;
    const aguaWeight = root.querySelector('tr[data-sd-row="agua"]')!.children[2] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalWeight = totalRow.children[2] as HTMLElement;

    expect(iscaWeight.textContent).toBe('40,0'); // 200 × 2/10
    expect(farinhaWeight.textContent).toBe('100,0'); // 200 × 5/10
    expect(aguaWeight.textContent).toBe('60,0'); // 200 × 3/10
    expect(totalWeight.textContent).toBe('200,0'); // Σpeso = W_ferm
  });

  it('AC20 — Custo do fermento = Σcusto das farinhas + custo da água; Isca não conta', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.sourdough.flours[0].proportion = 1;
    recipe.sourdough.flours[0].packageCost = { pricePaid: 8, packageSize: 1, packageUnit: 'kg' }; // R$0,008/g
    recipe.sourdough.waterPackageCost = { pricePaid: 2, packageSize: 1, packageUnit: 'L' }; // R$0,002/g (1L=1000g)
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    // seed atual: W_ferm=200, denom=3 (isca1+farinha1+água1, ajuste do
    // cliente) → farinha≈66,7g, água≈66,7g.
    const flourCostCell = root.querySelector('tr[data-sd-row="flour"]')!.children[6] as HTMLElement;
    const aguaCostCell = root.querySelector('tr[data-sd-row="agua"]')!.children[6] as HTMLElement;
    const totalRow = root.querySelector('tfoot tr')!;
    const totalCostCell = totalRow.children[4] as HTMLElement;

    expect(flourCostCell.textContent).toBe('R$ 0,53'); // 66,67g × R$0,008/g
    expect(aguaCostCell.textContent).toBe('R$ 0,13'); // 66,67g × R$0,002/g
    expect(totalCostCell.textContent).toBe('R$ 0,67'); // Σ — isca (custo 0) não conta
  });

  it('AC24 — "Total de fermento" exibe Custo/g e Custo agregados (Σ farinhas + água, isca fora), repintados ao editar as linhas abaixo', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.sourdough.flours[0].proportion = 1;
    recipe.sourdough.flours[0].packageCost = { pricePaid: 8, packageSize: 1, packageUnit: 'kg' }; // R$0,008/g
    recipe.sourdough.waterPackageCost = { pricePaid: 2, packageSize: 1, packageUnit: 'L' }; // R$0,002/g
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    renderSourdoughTable(root, store, new Set());

    const totalRow = root.querySelector('tr[data-sd-row="total-fermento"]') as HTMLTableRowElement;
    const totalCostGCell = totalRow.children[5] as HTMLElement;
    const totalCostCell = totalRow.children[6] as HTMLElement;

    // Mesmos valores agregados do tfoot (AC20) — Σ farinhas(0,53) + água(0,13) = 0,67; custo/g = 0,67/200 = 0,0033.
    expect(totalCostGCell.textContent).toBe('R$ 0,0033');
    expect(totalCostCell.textContent).toBe('R$ 0,67');
    expect(totalCostGCell.querySelector('strong')).not.toBeNull(); // negrito preservado (AC15)

    // Repintura ao editar uma linha abaixo (preço da água) — mesmo caminho reativo (§1.6).
    const aguaPriceInput = root.querySelector(
      'input[aria-label="Preço pago da água do fermento"]',
    ) as HTMLInputElement;
    aguaPriceInput.value = '4,00'; // dobro do preço da água
    aguaPriceInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(totalCostCell.textContent).not.toBe('R$ 0,67'); // repintou
  });

  it('AC22 — SourdoughParts sem `flour` (fica {isca, water}); SourdoughFlour usa `proportion` (não `percentage`)', () => {
    const { store } = mount();
    const { parts, flours } = store.getState().recipe.sourdough;
    expect('flour' in parts).toBe(false);
    expect(Object.keys(parts).sort()).toEqual(['isca', 'water']);
    expect('proportion' in flours[0]).toBe(true);
    expect('percentage' in flours[0]).toBe(false);
  });

  // Pedido do cliente (2026-07-06): a linha "Total de fermento" mostra na coluna
  // Proporção a SOMA das proporções das linhas abaixo (isca + Σfarinhas + água).
  it('cliente — linha Total de fermento exibe Σ das proporções e repinta ao editar', () => {
    const { root } = mount();
    const totalPropCell = root.querySelector('tr[data-sd-row="total-fermento"]')!.children[1] as HTMLElement;
    expect(totalPropCell.textContent).toBe('3'); // golden: isca1 + farinha1 + água1
    expect(totalPropCell.querySelector('strong')).not.toBeNull(); // negrito preservado

    // Edita a proporção da água para 3 → Σ = 1+1+3 = 5, repinta.
    const aguaProp = root.querySelector('input[aria-label="Proporção da Água do fermento"]') as HTMLInputElement;
    aguaProp.value = '3';
    aguaProp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(totalPropCell.textContent).toBe('5');
  });

  // Pedido do cliente (2026-07-06): `+ farinha do fermento` cria a linha com nome
  // E proporção EM BRANCO para o cliente digitar (proporção 0 no dado → input vazio).
  it('cliente — "+ farinha do fermento" cria linha com nome e proporção em branco', () => {
    const { root } = mount();
    const addBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent === '+ farinha do fermento',
    ) as HTMLButtonElement;
    addBtn.click();

    const flourRows = root.querySelectorAll('tr[data-sd-row="flour"]');
    const novaRow = flourRows[flourRows.length - 1];
    const nameInput = novaRow.querySelector('input[aria-label="Nome da farinha do fermento"]') as HTMLInputElement;
    const propInput = novaRow.querySelector('input[aria-label="Proporção de farinha do fermento"]') as HTMLInputElement;
    expect(nameInput.value).toBe(''); // nome em branco
    expect(propInput.value).toBe(''); // proporção em branco (não "0")
    expect(propInput.placeholder).toBe('0');
  });
});
