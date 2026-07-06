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
 * markup 40% → Preço R$6,02 (= 4,30 × 1,40), Lucro R$1,72 (= 4,30 × 0,40)
 * — issue 041 trocou margem-sobre-preço por markup-sobre-custo. Valores
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
  it('7. editar % de lucro 40 → Preço 6,02 e Lucro 1,72 (seed com Isca=1, 2026-07-06); campo em foco não é sobrescrito', () => {
    const { root } = mount();
    const marginInput = root.querySelector('input[aria-label="Margem %"]') as HTMLInputElement;
    const priceInput = root.querySelector('input[aria-label="Preço de venda"]') as HTMLInputElement;
    const profitInput = root.querySelector('input[aria-label="Lucro unitário"]') as HTMLInputElement;

    marginInput.value = '40';
    marginInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(priceInput.value).toBe('6,02'); // markup 40%: 4,30 × 1,40 (issue 041)
    expect(profitInput.value).toBe('1,72'); // 4,30 × 0,40
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

  it('9. editar % de lucro 150 → aceito (sem teto, markup); negativo bloqueia e reverte (issue 041)', () => {
    const { root } = mount();
    const marginInput = root.querySelector('input[aria-label="Margem %"]') as HTMLInputElement;
    expect(marginInput.value).toBe('40,00');

    // 150% de lucro é válido agora (markup não tem teto de 99,9%).
    marginInput.value = '150';
    marginInput.dispatchEvent(new Event('input', { bubbles: true }));
    marginInput.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(marginInput.getAttribute('aria-invalid')).not.toBe('true');
    expect(marginInput.value).toBe('150,00'); // aceito e formatado

    // Negativo continua bloqueado (único limite restante: p ≥ 0).
    marginInput.value = '-10';
    marginInput.dispatchEvent(new Event('input', { bubbles: true }));
    marginInput.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(marginInput.getAttribute('aria-invalid')).toBe('true');
    expect(marginInput.value).toBe('150,00'); // reverte ao último válido
  });
});
