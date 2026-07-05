// @vitest-environment jsdom
/**
 * hydrationPanel.test.ts — Testes jsdom do painel de Hidratação (issue 015).
 *
 * Casos 10–12 do Plano Técnico da issue 015. Mesma justificativa jsdom de 014
 * (architecture.md: "jsdom só se um teste de UI precisar") e mesma montagem
 * (`createMemoryStorage` + `createPrefsStore` + `createAppState(goldenSeed())`).
 *
 * Nota de formatação (desvio consciente vs texto solto do plano): "Farinha Real
 * Consumida" usa `formatWeight` (dono único, format.ts) que NUNCA agrupa milhar
 * (§9: "obrigatório para o gabarito §12 — 1041,7, não 1.041,7"; format.test.ts
 * caso 16). Por isso o golden §12 (1100g) exibe `1100,0 g`, não `1.100,0 g`
 * (grafia solta do texto do plano/mockup estático) — consistente com o dono
 * único de formatação de peso, sem reimplementar arredondamento.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderHydrationPanel } from './hydrationPanel';

function mount() {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const store = createAppState(goldenSeed(), prefs);
  renderHydrationPanel(root, store);
  return { root, store, prefs };
}

describe('hydrationPanel (jsdom)', () => {
  it('10. golden §12 — Nominal 70,00% · Real 72,73% · Farinha Real Consumida 1100,0 g', () => {
    const { root } = mount();
    const nominal = root.querySelector('.metric:nth-child(1) .value') as HTMLElement;
    const real = root.querySelector('.metric:nth-child(2) .value') as HTMLElement;
    const flour = root.querySelector('.metric:nth-child(3) .value') as HTMLElement;

    expect(nominal.textContent).toBe('70,00%');
    expect(real.textContent).toBe('72,73%');
    expect(flour.textContent).toBe('1100,0 g');
  });

  it('11. F_total=0 (sem farinhas) → Nominal "—", Real ainda numérico, sem crash', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const recipe = goldenSeed();
    recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'flour'); // F_total=0
    const store = createAppState(recipe, prefs);
    const root = document.createElement('div');
    expect(() => renderHydrationPanel(root, store)).not.toThrow();

    const nominal = root.querySelector('.metric:nth-child(1) .value') as HTMLElement;
    const real = root.querySelector('.metric:nth-child(2) .value') as HTMLElement;
    expect(nominal.textContent).toBe('—');
    expect(real.textContent).not.toBe('—'); // denominador = FarinhaFerm (>0), ainda numérico
  });

  it('12. alterar % da Água (70→80) repinta "Nominal" para 80,00% via subscribe (§1.6)', () => {
    const { root, store } = mount();
    const nominal = root.querySelector('.metric:nth-child(1) .value') as HTMLElement;
    expect(nominal.textContent).toBe('70,00%');

    store.update((draft) => {
      const water = draft.ingredients.find((i) => i.id === 'water-1');
      if (water) water.percentage = 80;
    });

    expect(nominal.textContent).toBe('80,00%');
  });
});
