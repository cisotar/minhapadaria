// @vitest-environment jsdom
/**
 * batchPanel.test.ts — Testes jsdom do painel de Ancoragem/Planejamento da
 * Fornada (issue 016, §2.E/§2.E.1).
 *
 * Casos 4–6 do Plano Técnico da issue 016. Mesma montagem de 014/015.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderBatchPanel } from './batchPanel';
import { applyTargetScaling, scaledFlourTotal } from '../core/scaling';
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

afterEach(() => {
  document.body.classList.remove('mode-alt');
  document.body.querySelectorAll('.banner-mode-alt').forEach((n) => n.remove());
});

describe('batchPanel (jsdom)', () => {
  it('4. per-unit: F_unit 250 × N 4 → F_total 1000,0 somente-leitura (§2.E.1)', () => {
    const { root } = mount((r) => {
      r.batchPlanningMode = 'per-unit';
      r.flourPerUnit = 250;
      r.pricing.quantity = 4;
    });
    const ftotalInput = root.querySelector(
      'input[aria-label="Peso de Farinha Total"]',
    ) as HTMLInputElement;
    expect(ftotalInput.value).toBe('1000,0');
    expect(ftotalInput.readOnly).toBe(true);
  });

  it('5. fornada inteira: editar N de 2→3 recalcula custo unitário; F_total inalterado', () => {
    const { root, store } = mount();
    const before = store.getState().summary.costPerUnit;
    const ftotalInput = root.querySelector(
      'input[aria-label="Peso de Farinha Total"]',
    ) as HTMLInputElement;
    expect(ftotalInput.value).toBe('1000,0');

    const qtyInput = root.querySelector(
      'input[aria-label="Quantidade de Produtos"]',
    ) as HTMLInputElement;
    qtyInput.value = '3';
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.getState().summary.costPerUnit).not.toBe(before);
    expect(ftotalInput.value).toBe('1000,0'); // F_total é a âncora em 'total' — não muda com N
  });

  it('7. peso→%: F_total somente-leitura e repinta ao editar peso de farinha (§1.3/§3.A, issue 024)', () => {
    const { root, store } = mount((r) => {
      r.calculationMode = 'weight-to-percentage';
    });
    const ftotalInput = root.querySelector(
      'input[aria-label="Peso de Farinha Total"]',
    ) as HTMLInputElement;
    expect(ftotalInput.readOnly).toBe(true); // §3.A: derivado (Σ pesos das farinhas), nunca editável

    store.update((draft) => {
      draft.ingredients[0].weight = 1234; // flour-1 (Farinha Branca)
    });

    expect(ftotalInput.value).toBe('1234,0'); // patchDynamic repinta o valor derivado
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

  it('9. %→peso + fornada inteira: F_total repinta após Re-escalar (§3.D, achado da verificação final)', () => {
    // Este seed (mount()/goldenSeed) tem soma 196% (100+70+4+2 ingredientes +
    // 20 fermento) → alvo 2000g → F_nova = scaledFlourTotal (scaling.ts, §3.D
    // passo 2). O bug: F_total é campo editável em %→peso+total (não
    // `isDerived` em `patchDynamic`), então `applyTransform` atualiza o estado
    // mas o input nunca repinta, ficando defasado em 1000,0.
    const { root, store } = mount();
    const ftotalInput = root.querySelector(
      'input[aria-label="Peso de Farinha Total"]',
    ) as HTMLInputElement;
    expect(ftotalInput.value).toBe('1000,0');
    expect(ftotalInput.readOnly).toBe(false); // editável em %→peso+total

    const expected = scaledFlourTotal(store.getState().recipe, 2000)!;
    const applied = store.applyTransform((recipe) => applyTargetScaling(recipe, 2000));
    expect(applied).toBe(true);
    expect(store.getState().recipe.flourTotalWeight).toBeCloseTo(expected, 6);

    expect(ftotalInput.value).not.toBe('1000,0'); // campo deve repintar o novo F_total
    expect(ftotalInput.value).toBe(formatWeight(expected));
  });

  it('6. modo peso→% → botão "Por unidade" desabilitado (§2.E.1)', () => {
    const { root, store } = mount();
    const buttons = Array.from(root.querySelectorAll('.period-toggle button')) as HTMLButtonElement[];
    const perUnitBtn = buttons.find((b) => b.textContent === 'Por unidade') as HTMLButtonElement;
    expect(perUnitBtn.disabled).toBe(false);

    store.update((draft) => {
      draft.calculationMode = 'weight-to-percentage';
    });

    const buttonsAfter = Array.from(root.querySelectorAll('.period-toggle button')) as HTMLButtonElement[];
    const perUnitBtnAfter = buttonsAfter.find((b) => b.textContent === 'Por unidade') as HTMLButtonElement;
    expect(perUnitBtnAfter.disabled).toBe(true);
  });
});
