// @vitest-environment jsdom
/**
 * modeToggle.test.ts — Testes jsdom do toggle global de modo de cálculo
 * (issue 016, §1.3/§1.5).
 *
 * Mesma justificativa jsdom de 014/015 (architecture.md) e mesma montagem
 * (`createMemoryStorage` + `createPrefsStore` + `createAppState(goldenSeed())`).
 * Casos 1–3 do Plano Técnico da issue 016.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderModeToggle } from './modeToggle';
import { renderIngredientsTable } from './ingredientsTable';

function mount() {
  const root = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const store = createAppState(goldenSeed(), prefs);
  renderModeToggle(root, store);
  return { root, store, prefs };
}

// O banner é inserido em `document.body`, fora de `root` — limpar entre testes
// evita banners/classe `mode-alt` vazando de um teste para o outro.
afterEach(() => {
  document.body.classList.remove('mode-alt');
  document.body.querySelectorAll('.banner-mode-alt').forEach((n) => n.remove());
});

describe('modeToggle (jsdom)', () => {
  it('1. clicar alternar → body.mode-alt + .banner-mode-alt no DOM + calculationMode peso→%', () => {
    const { root, store } = mount();
    const toggleBtn = root.querySelector('button') as HTMLButtonElement;

    expect(document.body.classList.contains('mode-alt')).toBe(false);
    expect(document.querySelector('.banner-mode-alt')).toBeNull();

    toggleBtn.click();

    expect(document.body.classList.contains('mode-alt')).toBe(true);
    expect(document.querySelector('.banner-mode-alt')).not.toBeNull();
    expect(store.getState().recipe.calculationMode).toBe('weight-to-percentage');
  });

  it('2. peso→% ativo → inputs de % da tabela têm classe pct e ancestral .mode-alt', () => {
    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    const store = createAppState(goldenSeed(), prefs);
    const modeRoot = document.createElement('div');
    const tableRoot = document.createElement('div');
    renderModeToggle(modeRoot, store);
    renderIngredientsTable(tableRoot, store);

    const toggleBtn = modeRoot.querySelector('button') as HTMLButtonElement;
    toggleBtn.click();

    const pctInput = tableRoot.querySelector(
      'input[aria-label="Porcentagem de Água"]',
    ) as HTMLInputElement;
    expect(pctInput.classList.contains('pct')).toBe(true);
    expect(document.body.classList.contains('mode-alt')).toBe(true);
    // O destaque §1.3 depende do ancestral `.mode-alt` estar em document.body
    // (banner sticky/classe global) — não do próprio `tableRoot`.
  });

  it('3. clicar "Voltar ao modo padrão" no banner → some o banner, body perde mode-alt, calculationMode volta, flourTotalWeight = Σ pesos das farinhas', () => {
    const { root, store } = mount();
    const toggleBtn = root.querySelector('button') as HTMLButtonElement;
    toggleBtn.click();
    expect(store.getState().recipe.calculationMode).toBe('weight-to-percentage');

    // Edita o peso da farinha diretamente (fonte de verdade em peso→%, §1.3).
    store.update((draft) => {
      const flour = draft.ingredients.find((i) => i.id === 'flour-1');
      if (flour) flour.weight = 1200;
    });

    const backBtn = document.querySelector(
      '.banner-mode-alt button',
    ) as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(document.querySelector('.banner-mode-alt')).toBeNull();
    expect(document.body.classList.contains('mode-alt')).toBe(false);
    expect(store.getState().recipe.calculationMode).toBe('percentage-to-weight');
    expect(store.getState().recipe.flourTotalWeight).toBe(1200); // §1.5: soma dos pesos das farinhas vigentes
  });
});
