// @vitest-environment jsdom
/**
 * batchPanel.test.ts — Testes jsdom do painel de Ancoragem/Planejamento da
 * Fornada, refatorado (2026-07-05): planejamento exclusivamente por unidade.
 *
 * Card tem dois inputs (Quantidade de Produtos, Farinha por Unidade) e o
 * Peso Total de Farinha derivado (F_total = F_unit × N) isolado na última
 * linha (`.metric`). Mesma montagem de 014/015/016.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderBatchPanel } from './batchPanel';
import { renderIngredientsTable } from './ingredientsTable';
import { inheritSourdoughFlourCosts } from './sourdoughTable';
import { applyTargetScaling, scaledFlourTotal } from '../core/scaling';
import { transitionToPercentageMode } from '../core/recalc';
import { formatWeight } from '../core/format';

function mount(mutate?: (r: ReturnType<typeof goldenSeed>) => void) {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const recipe = goldenSeed();
  mutate?.(recipe);
  const store = createAppState(recipe, prefs);
  renderBatchPanel(root, store);
  return { root, store, prefs };
}

function totalValue(root: HTMLElement): string {
  return (root.querySelector('.metric .value') as HTMLElement).textContent ?? '';
}

afterEach(() => {
  document.body.classList.remove('mode-alt');
  document.body.querySelectorAll('.banner-mode-alt').forEach((n) => n.remove());
});

describe('batchPanel (jsdom)', () => {
  it('1. layout: só dois inputs (N, F_unit), sem toggle de planejamento nem campo F_total; total destacado na última linha', () => {
    const { root } = mount();
    expect(root.querySelector('.period-toggle')).toBeNull();
    expect(root.querySelector('input[aria-label="Peso de Farinha Total"]')).toBeNull();
    expect(root.querySelector('input[aria-label="Quantidade de Produtos"]')).not.toBeNull();
    expect(root.querySelector('input[aria-label="Farinha por Unidade"]')).not.toBeNull();

    // Última linha do card: o destaque `.metric` com F_total = 500 × 2.
    const card = root.querySelector('.card') as HTMLElement;
    const lastRow = card.lastElementChild as HTMLElement;
    expect(lastRow.querySelector('.metric .value')).not.toBeNull();
    expect(totalValue(root)).toBe('1.000,0 g');
  });

  it('2. F_unit 250 × N 4 → F_total 1.000,0 g na última linha (§2.E.1)', () => {
    const { root } = mount((r) => {
      r.flourPerUnit = 250;
      r.pricing.quantity = 4;
    });
    expect(totalValue(root)).toBe('1.000,0 g');
  });

  it('3. editar N 2→3 recalcula F_total (500 × 3); receita escala e custo unitário fica constante', () => {
    const { root, store } = mount();
    const costPerUnitBefore = store.getState().summary.costPerUnit!;
    const totalCostBefore = store.getState().summary.totalCost!;
    expect(totalValue(root)).toBe('1.000,0 g');

    const qtyInput = root.querySelector(
      'input[aria-label="Quantidade de Produtos"]',
    ) as HTMLInputElement;
    qtyInput.value = '3';
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(totalValue(root)).toBe('1.500,0 g'); // F_total acompanha N no per-unit
    // A receita inteira escala com N → custo total sobe ×1,5 e o unitário não muda.
    expect(store.getState().summary.totalCost).toBeCloseTo(totalCostBefore * 1.5, 6);
    expect(store.getState().summary.costPerUnit).toBeCloseTo(costPerUnitBefore, 6);
  });

  it('4. editar F_unit repinta F_total imediatamente (§1.6)', () => {
    const { root } = mount();
    const funitInput = root.querySelector(
      'input[aria-label="Farinha por Unidade"]',
    ) as HTMLInputElement;
    expect(funitInput.value).toBe('500,0');

    funitInput.value = '300';
    funitInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(totalValue(root)).toBe('600,0 g'); // 300 × 2
  });

  it('5. receita legada em "total" normaliza para per-unit ao montar (F_unit = F_total / N)', () => {
    const { root, store } = mount((r) => {
      r.batchPlanningMode = 'total';
      delete r.flourPerUnit;
      r.flourTotalWeight = 1000;
      r.pricing.quantity = 2;
    });
    const { recipe } = store.getState();
    expect(recipe.batchPlanningMode).toBe('per-unit');
    expect(recipe.flourPerUnit).toBe(500);
    expect(totalValue(root)).toBe('1.000,0 g'); // peso corrente preservado
  });

  it('6. peso→%: F_unit somente-leitura com o derivado; F_total repinta ao editar peso de farinha (§1.3/§3.A)', () => {
    const { root, store } = mount((r) => {
      r.calculationMode = 'weight-to-percentage';
    });
    const funitInput = root.querySelector(
      'input[aria-label="Farinha por Unidade"]',
    ) as HTMLInputElement;
    expect(funitInput.readOnly).toBe(true); // âncora suspensa em peso→%

    store.update((draft) => {
      draft.ingredients[0].weight = 1234; // flour-1 (Farinha Branca)
    });

    expect(totalValue(root)).toBe('1.234,0 g'); // Σ pesos das farinhas (§3.A)
    expect(funitInput.value).toBe('617,0'); // derivado F_total / N (1234 / 2)
  });

  it('7. volta do modo peso→% renormaliza para per-unit preservando o F_total dos pesos (§1.5)', () => {
    const { root, store } = mount();
    store.update((draft) => {
      draft.calculationMode = 'weight-to-percentage';
    });
    store.update((draft) => {
      draft.ingredients[0].weight = 1234;
    });
    // `recalculate` força 'total' em peso→%; a transição de volta preserva isso
    // e o painel deve renormalizar para per-unit com o F_total dos pesos.
    store.applyTransform(transitionToPercentageMode);

    const { recipe } = store.getState();
    expect(recipe.calculationMode).toBe('percentage-to-weight');
    expect(recipe.batchPlanningMode).toBe('per-unit');
    expect(recipe.flourPerUnit).toBeCloseTo(617, 6); // 1234 / 2
    expect(totalValue(root)).toBe('1.234,0 g');

    const funitInput = root.querySelector(
      'input[aria-label="Farinha por Unidade"]',
    ) as HTMLInputElement;
    expect(funitInput.readOnly).toBe(false); // editável de novo no modo padrão
  });

  it('8. quantidade <1 reverte no blur (§5.C)', () => {
    const { root } = mount();
    const qtyInput = root.querySelector(
      'input[aria-label="Quantidade de Produtos"]',
    ) as HTMLInputElement;
    expect(qtyInput.value).toBe('2'); // golden seed: pricing.quantity = 2

    qtyInput.value = '0';
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    qtyInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(qtyInput.value).toBe('2'); // reverte ao último valor válido
    expect(qtyInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('9. Re-escalar (§3.D) grava F_unit = F_nova / N e repinta F_total e o input', () => {
    const { root, store } = mount();
    expect(totalValue(root)).toBe('1.000,0 g');

    const expected = scaledFlourTotal(store.getState().recipe, 2000)!;
    const applied = store.applyTransform((recipe) => applyTargetScaling(recipe, 2000));
    expect(applied).toBe(true);

    const { recipe } = store.getState();
    expect(recipe.flourPerUnit).toBeCloseTo(expected / 2, 6); // §2.E.1: mantém N
    expect(recipe.flourTotalWeight).toBeCloseTo(expected, 6);
    expect(totalValue(root)).toBe(`${formatWeight(expected)} g`);

    const funitInput = root.querySelector(
      'input[aria-label="Farinha por Unidade"]',
    ) as HTMLInputElement;
    expect(funitInput.value).toBe(formatWeight(expected / 2)); // repinta fora de foco
  });
});

/**
 * Tabela "Farinhas" (refactor 2026-07-05, mockups/calculadora-farinhas.html):
 * múltiplas farinhas principais editadas dentro do card Ancoragem — fonte de
 * verdade continua `recipe.ingredients` com `category:'flour'` (recalc.ts
 * já deriva peso = %/100 × F_total por linha). Consumida (somente-leitura)
 * pelas linhas de farinha da tabela Ingredientes (ingredientsTable.ts).
 */
describe('batchPanel — tabela de Farinhas (jsdom)', () => {
  function flourRow(root: HTMLElement, id: string): HTMLTableRowElement {
    return root.querySelector(`tr[data-flour-id="${id}"]`) as HTMLTableRowElement;
  }

  it('10. thead da tabela de Farinhas: colunas análogas a Ingredientes MENOS "Unidade" (farinha é sempre g)', () => {
    const { root } = mount();
    const tables = Array.from(root.querySelectorAll('table'));
    const flourTable = tables.find((t) => t.querySelector('thead th')?.textContent === 'Farinha') as HTMLTableElement;
    expect(flourTable).toBeTruthy();
    const headers = Array.from(flourTable.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toEqual([
      'Farinha',
      '%',
      'Peso (g)',
      'Preço pago',
      'Peso do produto',
      'Custo/g',
      'Custo',
      '', // coluna de ações (aria-label "Ações")
    ]);
    expect(root.querySelector('.sub-recipe-note')?.textContent).toMatch(/farinha/i);
  });

  it('11. golden seed (1 farinha): % é SEMPRE editável (trava-100% eliminada, decisão do cliente 2026-07-05); remover continua desabilitado (§5.B)', () => {
    const { root } = mount();
    const row = flourRow(root, 'flour-1');
    const pctInput = row.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput.readOnly).toBe(false); // sem trava, mesmo com 1 farinha só
    expect(pctInput.value).toBe('100,00');

    const removeBtn = row.querySelector('button[aria-label="Remover Farinha Branca"]') as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true); // §5.B: mínimo 1 farinha — isso não mudou
  });

  it('12. "+ farinha"/remover: % continua editável nos dois cenários (1 ou 2 farinhas) — sem trava em nenhum caso', () => {
    const { root, store } = mount();
    const addBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ farinha') as HTMLButtonElement;
    addBtn.click();

    expect(store.getState().recipe.ingredients.filter((i) => i.category === 'flour')).toHaveLength(2);
    const row1 = flourRow(root, 'flour-1');
    const pctInput1 = row1.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput1.readOnly).toBe(false);

    const newId = store.getState().recipe.ingredients.find((i) => i.category === 'flour' && i.id !== 'flour-1')!.id;
    const row2 = flourRow(root, newId);
    const removeBtn2 = row2.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement;
    expect(removeBtn2.disabled).toBe(false);

    removeBtn2.click(); // volta a 1 farinha só
    expect(store.getState().recipe.ingredients.filter((i) => i.category === 'flour')).toHaveLength(1);
    const row1After = flourRow(root, 'flour-1');
    const pctInput1After = row1After.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput1After.readOnly).toBe(false); // continua sem trava
  });

  it('13. blur com soma de farinhas ≠ 100% NUNCA reverte — só avisa (soft, decisão do cliente 2026-07-05, §5.A)', () => {
    const { root, store } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 40,
        packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      });
    });
    expect(store.getState().recipe.ingredients.filter((i) => i.category === 'flour')).toHaveLength(2);

    const pctInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;
    expect(pctInput.value).toBe('60,00');

    pctInput.value = '90,00'; // 90 + 40 = 130% — excede 100%
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pctInput.value).toBe('90,00'); // NUNCA reverte — permanece o valor digitado
    expect(pctInput.getAttribute('aria-invalid')).toBeNull(); // aviso, não bloqueio
    expect(pctInput.title).toBe('Excede 100% em 30,00% — reduza.');
    expect(store.getState().recipe.ingredients[0].percentage).toBe(90);
  });

  it('13b. blur com soma < 100% avisa "faltam X%" (soft, §5.A)', () => {
    const { root } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 20,
        packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      });
    });
    const pctInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;

    pctInput.value = '50,00'; // 50 + 20 = 70% — faltam 30%
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pctInput.value).toBe('50,00'); // não reverte
    expect(pctInput.getAttribute('aria-invalid')).toBeNull();
    expect(pctInput.title).toBe('Faltam 30,00% para 100%.');
  });

  it('13c. blur com soma exatamente 100% não deixa nenhum aviso pendente (title limpo)', () => {
    const { root } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 40,
        packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      });
    });
    const pctInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;

    pctInput.value = '90,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true })); // 90+40=130 — avisa

    pctInput.value = '60,00'; // volta pra 60+40=100
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    pctInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(pctInput.value).toBe('60,00');
    expect(pctInput.title).toBe(''); // aviso anterior limpo
    expect(pctInput.getAttribute('aria-invalid')).toBeNull();
  });

  it('14. editar % de uma farinha (2 farinhas, sem trava) atualiza o Peso (g) na mesma tabela instantaneamente (§1.6, %→peso)', () => {
    const { root } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 40,
        packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      });
    });
    const row = flourRow(root, 'flour-1');
    const pctInput = row.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(pctInput.readOnly).toBe(false); // sem trava — 2 farinhas
    const weightCell = row.querySelector('td.readonly') as HTMLElement;
    expect(weightCell.textContent).toBe('600,0'); // 60% de F_total (1000g)

    pctInput.value = '70,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(weightCell.textContent).toBe('700,0'); // repinta imediatamente, sem recriar o input em foco
  });

  it('15. peso→%: Peso da farinha vira editável e a % passa a derivada (readonly, classe `pct`) (§1.3)', () => {
    const { root, store } = mount((r) => {
      r.calculationMode = 'weight-to-percentage';
    });
    const row = flourRow(root, 'flour-1');
    const weightInput = row.querySelector('input[aria-label="Peso de Farinha Branca"]') as HTMLInputElement;
    const pctInput = row.querySelector('input[aria-label="Porcentagem de Farinha Branca"]') as HTMLInputElement;
    expect(weightInput).not.toBeNull();
    expect(pctInput.readOnly).toBe(true);
    expect(pctInput.classList.contains('pct')).toBe(true);

    const pctBefore = pctInput.value;
    weightInput.value = '1234';
    weightInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(pctInput.value).not.toBe(pctBefore); // % derivada repinta imediatamente
    expect(store.getState().recipe.ingredients[0].weight).toBe(1234);
  });

  it('16. tfoot "Total de farinha": Σ% = 100,00, Σpeso = F_total, Σcusto', () => {
    const { root } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 40,
        packageCost: { pricePaid: 12, packageSize: 1, packageUnit: 'kg' },
      });
    });
    const tables = Array.from(root.querySelectorAll('table'));
    const flourTable = tables.find((t) => t.querySelector('thead th')?.textContent === 'Farinha') as HTMLTableElement;
    const footCells = Array.from(flourTable.querySelectorAll('tfoot td'));
    expect(footCells[0].textContent).toBe('Total de farinha');
    expect(footCells[1].textContent).toBe('100,00');
    expect(footCells[2].textContent).toBe('1.000,0'); // F_total (golden seed: F_unit 500 × N 2)
  });

  it('18. chip visível de Σ% (não só tooltip): golden seed (1 farinha, 100%) mostra .chip-ok "✓ 100%"', () => {
    const { root } = mount();
    const tables = Array.from(root.querySelectorAll('table'));
    const flourTable = tables.find((t) => t.querySelector('thead th')?.textContent === 'Farinha') as HTMLTableElement;
    // Chip fica FORA do tfoot (não altera a estrutura/largura das colunas, §layout).
    const chip = flourTable.parentElement?.querySelector('.chip') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.classList.contains('chip-ok')).toBe(true);
    expect(chip.classList.contains('chip-warn')).toBe(false);
    expect(chip.textContent).toBe('✓ 100%');
  });

  it('19. chip repinta para .chip-warn com a MESMA mensagem do title ao editar % para Σ≠100 (nunca recria input em foco)', () => {
    const { root } = mount((r) => {
      r.ingredients[0].percentage = 60;
      r.ingredients.splice(1, 0, {
        id: 'flour-2',
        name: 'Farinha Integral',
        category: 'flour',
        weight: 0,
        percentage: 40,
        packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
      });
    });
    const tables = Array.from(root.querySelectorAll('table'));
    const flourTable = tables.find((t) => t.querySelector('thead th')?.textContent === 'Farinha') as HTMLTableElement;
    const chip = flourTable.parentElement?.querySelector('.chip') as HTMLElement;
    expect(chip.classList.contains('chip-ok')).toBe(true); // 60+40=100

    const pctInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;
    pctInput.value = '90,00'; // 90+40=130 — excede 100%
    pctInput.dispatchEvent(new Event('input', { bubbles: true })); // §1.6: repintura imediata, sem esperar blur

    const chipAfter = flourTable.parentElement?.querySelector('.chip') as HTMLElement;
    expect(chipAfter).toBe(chip); // mesmo elemento — repintado, não recriado
    expect(chipAfter.classList.contains('chip-ok')).toBe(false);
    expect(chipAfter.classList.contains('chip-warn')).toBe(true);
    expect(chipAfter.textContent).toBe('Excede 100% em 30,00% — reduza.'); // mesma msg do title (blur)

    pctInput.value = '50,00'; // 50+40=90 — faltam 10%
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(chip.classList.contains('chip-warn')).toBe(true);
    expect(chip.textContent).toBe('Faltam 10,00% para 100%.');
  });

  it('17. mudança estrutural (add/remove farinha) propaga para a tabela Ingredientes (mesmo store, módulo diferente)', () => {
    const root = document.createElement('div');
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const store = createAppState(goldenSeed(), prefs);
    renderBatchPanel(root, store);
    renderIngredientsTable(root, store);

    expect(root.querySelectorAll('tr[data-ingredient-id^="flour-"], tr[data-flour-id]').length).toBeGreaterThan(0);

    const addBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ farinha') as HTMLButtonElement;
    addBtn.click();

    const newFlour = store.getState().recipe.ingredients.filter((i) => i.category === 'flour');
    expect(newFlour).toHaveLength(2);
    // A tabela Ingredientes (outro módulo) precisa ter re-renderizado com a nova linha de farinha.
    const newFlourId = newFlour.find((f) => f.id !== 'flour-1')!.id;
    expect(root.querySelector(`tr[data-ingredient-id="${newFlourId}"]`)).not.toBeNull();
  });

  /**
   * Contrato-espelho (spec/refactor-farinhas-multiplas.md §3, fase 1) — os 2
   * bugs relatados pelo cliente: AC2 (nome não sincronizava) e AC4/AC6 (ordem/
   * contiguidade quebrada, pois `+ farinha` empurra pro FIM do array cru).
   */
  function mountBoth() {
    const root = document.createElement('div');
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const store = createAppState(goldenSeed(), prefs); // ordem: flour-1, water-1, oil-1, salt-1
    renderBatchPanel(root, store);
    renderIngredientsTable(root, store);
    return { root, store };
  }

  function ingredientsBodyRows(root: HTMLElement): Element[] {
    const table = Array.from(root.querySelectorAll('table')).find((t) =>
      Array.from(t.querySelectorAll('thead th')).some((th) => th.textContent === 'Ingrediente'),
    ) as HTMLTableElement;
    return Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.querySelector('.table-add-cell'));
  }

  it('AC2 — renomear a farinha na tabela Farinhas atualiza o nome na tabela Ingredientes na MESMA interação (store.update síncrono)', () => {
    const { root } = mountBoth();
    const nameInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Nome da farinha"]',
    ) as HTMLInputElement;

    nameInput.value = 'Venturelli';
    nameInput.dispatchEvent(new Event('input', { bubbles: true })); // sem esperar blur — §1.6

    const mirrorRow = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    expect(mirrorRow.querySelector('td')?.textContent).toContain('Venturelli');
    expect(mirrorRow.querySelector('td')?.textContent).toContain('vem da Ancoragem'); // nota preservada
    expect(mirrorRow.querySelector('input')).toBeNull(); // continua somente-leitura (AC7)
  });

  it('AC3 — editar % / preço / peso-do-produto na tabela Farinhas atualiza a linha-espelho em Ingredientes', () => {
    const { root } = mountBoth();
    const row = flourRow(root, 'flour-1');
    const priceInput = row.querySelector('input[aria-label="Preço pago de Farinha Branca"]') as HTMLInputElement;
    const pwValInput = row.querySelector('input[aria-label="Peso do produto de Farinha Branca"]') as HTMLInputElement;

    priceInput.value = '12,00';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwValInput.value = '2';
    pwValInput.dispatchEvent(new Event('input', { bubbles: true }));

    const mirrorRow = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const cells = Array.from(mirrorRow.querySelectorAll('td'));
    expect(cells[3].textContent).toBe('R$ 12,00');
    expect(cells[4].textContent).toBe('2,0 kg');
  });

  it('AC4/AC6 — "+ farinha" (push no FIM do array cru) ainda forma bloco CONTÍGUO no topo de Ingredientes, na mesma ordem da tabela Farinhas', () => {
    const { root, store } = mountBoth();
    const addBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ farinha') as HTMLButtonElement;
    addBtn.click(); // array cru vira [flour-1, water-1, oil-1, salt-1, <nova-farinha>] — NÃO contíguo no array

    const flours = store.getState().recipe.ingredients.filter((i) => i.category === 'flour');
    expect(flours).toHaveLength(2);
    const newFlourId = flours[1].id;

    const rows = ingredientsBodyRows(root);
    // AC6: as N primeiras linhas do tbody são exatamente as farinhas, na mesma
    // ordem da tabela Farinhas, antes de água/gordura/sal/Fermento.
    expect(rows[0].getAttribute('data-ingredient-id')).toBe('flour-1');
    expect(rows[1].getAttribute('data-ingredient-id')).toBe(newFlourId);
    expect(rows[2].getAttribute('data-ingredient-id')).toBe('water-1');
    expect(rows[3].getAttribute('data-ingredient-id')).toBe('oil-1');
    expect(rows[4].getAttribute('data-ingredient-id')).toBe('salt-1');
    expect(rows[5].getAttribute('data-ingredient-id')).toBe('fermento');
    // AC7: linha-espelho sem input editável e sem botão remover.
    expect(rows[1].querySelector('input')).toBeNull();
    expect(rows[1].querySelector('.col-actions button')).toBeNull();
  });

  it('AC5 — remover uma farinha a some das DUAS tabelas', () => {
    const { root, store } = mountBoth();
    const addBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ farinha') as HTMLButtonElement;
    addBtn.click();
    const newFlourId = store.getState().recipe.ingredients.filter((i) => i.category === 'flour')[1].id;
    expect(root.querySelector(`tr[data-flour-id="${newFlourId}"]`)).not.toBeNull();
    expect(root.querySelector(`tr[data-ingredient-id="${newFlourId}"]`)).not.toBeNull();

    const removeBtn = flourRow(root, newFlourId).querySelector('button[aria-label^="Remover"]') as HTMLButtonElement;
    removeBtn.click();

    expect(store.getState().recipe.ingredients.some((i) => i.id === newFlourId)).toBe(false);
    expect(root.querySelector(`tr[data-flour-id="${newFlourId}"]`)).toBeNull();
    expect(root.querySelector(`tr[data-ingredient-id="${newFlourId}"]`)).toBeNull();
  });

  /**
   * Lacunas de cobertura apontadas pelo revisor-spec (fechamento, mesma sessão
   * do contrato-espelho): AC3 tinha só preço/peso-produto asseridos
   * cross-table (faltava o ramo %); AC10 media só "não reverte no blur" num
   * único campo, sem provar que dá pra CHEGAR a Σ=100 por edições sucessivas;
   * AC13 usava `inheritSourdoughFlourCosts` isolado, sem o wiring real de
   * `normalize` do composition root (`calculadora.ts`) nem edição via input.
   */

  it('AC3 (ramo %) — editar a % de uma farinha na tabela Farinhas reflete % e Peso (e Custo) na linha-espelho em Ingredientes no mesmo tick', () => {
    const root = document.createElement('div');
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed(); // flourPerUnit 500 × N 2 = F_total 1000
    recipe.ingredients[0].percentage = 60;
    recipe.ingredients.splice(1, 0, {
      id: 'flour-2',
      name: 'Farinha Integral',
      category: 'flour',
      weight: 0,
      percentage: 40,
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
    });
    const store = createAppState(recipe, prefs);
    renderBatchPanel(root, store);
    renderIngredientsTable(root, store);

    const pctInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;
    pctInput.value = '70,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true })); // §1.6: sem esperar blur

    const mirrorRow = root.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const cells = Array.from(mirrorRow.querySelectorAll('td'));
    expect(cells[1].textContent).toBe('70,00'); // % — antes só preço/peso-produto eram testados cross-table
    expect(cells[2].textContent).toBe('700,0'); // Peso = 70% × F_total (1000g)
    expect(cells[6].textContent).toBe('R$ 5,60'); // Custo = 700g × R$0,008/g (8 ÷ 1000g)
  });

  it('AC10 — partindo de 0%, é possível montar Σ=100 por edições sucessivas SEM nenhuma reversão de blur; chip termina em .chip-ok', () => {
    const root = document.createElement('div');
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.ingredients[0].percentage = 0; // farinha-1 parte de 0%
    recipe.ingredients.splice(1, 0, {
      id: 'flour-2',
      name: 'Farinha Integral',
      category: 'flour',
      weight: 0,
      percentage: 0, // farinha-2 também parte de 0%
      packageCost: { pricePaid: 6, packageSize: 1, packageUnit: 'kg' },
    });
    const store = createAppState(recipe, prefs);
    renderBatchPanel(root, store);

    const tables = Array.from(root.querySelectorAll('table'));
    const flourTable = tables.find((t) => t.querySelector('thead th')?.textContent === 'Farinha') as HTMLTableElement;
    const chip = () => flourTable.parentElement?.querySelector('.chip') as HTMLElement;

    const pct1 = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Porcentagem de Farinha Branca"]',
    ) as HTMLInputElement;
    const pct2 = flourRow(root, 'flour-2').querySelector(
      'input[aria-label="Porcentagem de Farinha Integral"]',
    ) as HTMLInputElement;

    // 1ª edição: 0 → 60 (Σ=60, ainda não bate 100).
    pct1.value = '60,00';
    pct1.dispatchEvent(new Event('input', { bubbles: true }));
    pct1.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(pct1.value).toBe('60,00'); // blur NÃO reverteu
    expect(chip().classList.contains('chip-warn')).toBe(true);

    // 2ª edição: 0 → 30 (Σ=90, ainda não bate 100).
    pct2.value = '30,00';
    pct2.dispatchEvent(new Event('input', { bubbles: true }));
    pct2.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(pct1.value).toBe('60,00'); // a edição da OUTRA farinha não reverteu esta
    expect(pct2.value).toBe('30,00'); // blur NÃO reverteu
    expect(chip().classList.contains('chip-warn')).toBe(true);

    // 3ª edição: 30 → 40 (Σ=100 — fecha exatamente por edições sucessivas).
    pct2.value = '40,00';
    pct2.dispatchEvent(new Event('input', { bubbles: true }));
    pct2.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(pct2.value).toBe('40,00'); // blur NÃO reverteu
    expect(chip().classList.contains('chip-ok')).toBe(true);
    expect(chip().classList.contains('chip-warn')).toBe(false);
    expect(chip().textContent).toBe('✓ 100%');
  });

  it('AC13 — herança de custo farinha principal → farinha do fermento (mesmo flourId) via edição na tabela Farinhas, com o wiring REAL de produção (normalize = inheritSourdoughFlourCosts, como calculadora.ts faz)', () => {
    const root = document.createElement('div');
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    // Mesmo wiring do composition root (calculadora.ts): editedCostIds vazio
    // (nenhuma edição manual na sub-receita do Fermento ainda) + normalize
    // amarrado ao `createAppState` — reuso de `inheritSourdoughFlourCosts`,
    // nenhuma lógica nova.
    const editedCostIds = new Set<string>();
    const store = createAppState(goldenSeed(), prefs, (draft) => inheritSourdoughFlourCosts(draft, editedCostIds));
    renderBatchPanel(root, store);
    renderIngredientsTable(root, store);

    // golden seed: sourdough.flours[0].flourId === 'flour-1' (mesmo id da farinha principal).
    expect(store.getState().recipe.sourdough.flours[0].flourId).toBe('flour-1');
    expect(store.getState().recipe.sourdough.flours[0].packageCost.pricePaid).toBe(8); // herdado no seed

    const priceInput = flourRow(root, 'flour-1').querySelector(
      'input[aria-label="Preço pago de Farinha Branca"]',
    ) as HTMLInputElement;
    priceInput.value = '20,00';
    priceInput.dispatchEvent(new Event('input', { bubbles: true })); // edição PELA tabela Farinhas (batchPanel)

    const sdFlour = store.getState().recipe.sourdough.flours[0];
    expect(sdFlour.packageCost.pricePaid).toBe(20); // herdou o novo preço
    expect(sdFlour.costPerGram).toBeCloseTo(20 / 1000, 6); // recálculo propagado (§3.E)
  });
});
