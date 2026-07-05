// @vitest-environment jsdom
/**
 * hydrationPanel.test.ts — Testes jsdom do painel de Hidratação (issue 015).
 *
 * Casos 10–12 do Plano Técnico da issue 015. Mesma justificativa jsdom de 014
 * (architecture.md: "jsdom só se um teste de UI precisar") e mesma montagem
 * (`createMemoryStorage` + `createPrefsStore` + `createAppState(goldenSeed())`).
 *
 * Nota de formatação: "Farinha Real Consumida" usa `formatWeight` (dono único,
 * format.ts), que agrupa milhar com ponto e decimal com vírgula (§9;
 * format.test.ts caso 16).
 *
 * Ajuste do cliente (§5.1, 2026-07-06): o seed passou a usar Isca=1 (era 0)
 * — denom global do fermento 1+1+1=3 (era 0+1+1=2) — então deixou de
 * reproduzir os números literais da §12 (que tinha Isca 0, Farinha Real
 * Consumida 1100g). Os valores abaixo são os RECALCULADOS pelo engine para
 * o seed atual (`golden-example.test.ts` mantém um fixture próprio com Isca 0
 * para validar as fórmulas da §12 à parte — AC25).
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
  it('10. seed atual (Isca=1) — Nominal 70,00% · Real 71,87% · Farinha Real Consumida 1.066,7 g', () => {
    const { root } = mount();
    const nominal = root.querySelector('.metric:nth-child(1) .value') as HTMLElement;
    const real = root.querySelector('.metric:nth-child(2) .value') as HTMLElement;
    const flour = root.querySelector('.metric:nth-child(3) .value') as HTMLElement;

    expect(nominal.textContent).toBe('70,00%'); // nominal independe do fermento — inalterado
    expect(real.textContent).toBe('71,87%');
    expect(flour.textContent).toBe('1.066,7 g');
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
