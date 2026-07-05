// @vitest-environment jsdom
/**
 * pricingPanel.test.ts — Testes jsdom do painel de Precificação (issue 016,
 * §3.E/§4).
 *
 * Casos 7–9 do Plano Técnico da issue 016, com o fixture exato da §12 SEM
 * Azeite (não inclui a categoria `fat` que o `goldenSeed()` de 014 acrescentou
 * para exercitar g/mL).
 *
 * Ajuste do cliente (§5.1, 2026-07-06): o seed passou a usar Isca=1 (era 0) —
 * denom global do fermento 1+1+1=3 — então os números não são mais os
 * literais da §12 (que usava Isca 0): Custo unitário agora R$4,30 (era 4,43),
 * margem 40% → Preço R$7,16 (era 7,38), Lucro R$2,86 (era 2,95). Valores
 * RECALCULADOS pelo engine para o seed atual (`golden-example.test.ts` mantém
 * fixture próprio com Isca 0 para validar as fórmulas da §12 à parte — AC25).
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderPricingPanel } from './pricingPanel';

/** Fixture §12 exata: goldenSeed() sem a categoria `fat` (Azeite, issue 014). */
function goldenSeedNoFat() {
  const recipe = goldenSeed();
  recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'fat');
  return recipe;
}

function mount(mutate?: (r: ReturnType<typeof goldenSeedNoFat>) => void) {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const recipe = goldenSeedNoFat();
  mutate?.(recipe);
  const store = createAppState(recipe, prefs);
  renderPricingPanel(root, store);
  return { root, store, prefs };
}

describe('pricingPanel (jsdom, fixture §12 sem Azeite)', () => {
  it('7. editar Margem 40 → Preço 7,16 e Lucro 2,86 (seed com Isca=1, 2026-07-06); campo em foco não é sobrescrito', () => {
    const { root } = mount();
    const marginInput = root.querySelector('input[aria-label="Margem %"]') as HTMLInputElement;
    const priceInput = root.querySelector('input[aria-label="Preço de venda"]') as HTMLInputElement;
    const profitInput = root.querySelector('input[aria-label="Lucro unitário"]') as HTMLInputElement;

    marginInput.value = '40';
    marginInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(priceInput.value).toBe('7,16');
    expect(profitInput.value).toBe('2,86');
    expect(marginInput.value).toBe('40'); // campo em edição não é reformatado/sobrescrito
  });

  it('8. chip de margem: 40% → chip-ok; forçar custo > preço → chip-crit + .loss (tokens, sem hex novo)', () => {
    const { root, store } = mount();
    const chip = root.querySelector('.chip') as HTMLElement;
    expect(chip.classList.contains('chip-ok')).toBe(true);
    expect(chip.textContent).toBe('Margem 40,00%');

    store.update((draft) => {
      draft.pricing.priceInputMode = 'sale-price';
      draft.pricing.salePrice = 1; // < custo unitário 4,30 → prejuízo
    });

    expect(chip.classList.contains('chip-crit')).toBe(true);
    expect(chip.textContent).toMatch(/Prejuízo/);
    expect(root.querySelector('.loss')).not.toBeNull();
  });

  it('9. editar Margem 150 → blur bloqueia (aria-invalid) e reverte ao último valor válido', () => {
    const { root } = mount();
    const marginInput = root.querySelector('input[aria-label="Margem %"]') as HTMLInputElement;
    expect(marginInput.value).toBe('40,00');

    marginInput.value = '150';
    marginInput.dispatchEvent(new Event('input', { bubbles: true }));
    marginInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(marginInput.getAttribute('aria-invalid')).toBe('true');
    expect(marginInput.value).toBe('40,00'); // reverte — nunca 150 nem NaN
  });
});
