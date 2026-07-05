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
