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
