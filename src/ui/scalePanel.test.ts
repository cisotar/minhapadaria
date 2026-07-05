// @vitest-environment jsdom
/**
 * scalePanel.test.ts — Testes jsdom do escalonamento por peso alvo (issue
 * 016, §3.D/§1.6).
 *
 * Casos 10–11 do Plano Técnico da issue 016, com o fixture exato da §12 SEM
 * Azeite (Soma da Receita % = 100 + 70 + 2 + 20 = 192%, golden da spec —
 * `goldenSeed()` de 014 acrescenta a categoria `fat`/Azeite a mais, que
 * mudaria a soma para 196% e o resultado do escalonamento).
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createPrefsStore } from '../storage/prefs';
import { createAppState } from './state';
import { goldenSeed } from './seed';
import { renderScalePanel } from './scalePanel';
import { renderIngredientsTable } from './ingredientsTable';

/** Fixture §12 exata: goldenSeed() sem a categoria `fat` (Azeite, issue 014). */
function goldenSeedNoFat() {
  const recipe = goldenSeed();
  recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'fat');
  return recipe;
}

function mount() {
  const scaleRoot = document.createElement('div');
  const tableRoot = document.createElement('div');
  const prefs = createPrefsStore({ storage: createMemoryStorage() });
  const store = createAppState(goldenSeedNoFat(), prefs);
  renderScalePanel(scaleRoot, store);
  renderIngredientsTable(tableRoot, store);
  return { scaleRoot, tableRoot, store, prefs };
}

describe('scalePanel (jsdom, fixture §12 sem Azeite)', () => {
  it('10. alvo 2000 + clicar "Re-escalar" → Peso da farinha exibe 1.041,7 (golden §12)', () => {
    const { scaleRoot, tableRoot } = mount();
    const targetInput = scaleRoot.querySelector(
      'input[aria-label="Peso alvo para escalonamento"]',
    ) as HTMLInputElement;
    const applyBtn = scaleRoot.querySelector('button') as HTMLButtonElement;

    targetInput.value = '2000';
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    applyBtn.click();

    // Farinha é linha CONSUMIDA (somente-leitura) na tabela Ingredientes desde o
    // refactor de múltiplas farinhas (2026-07-05) — % (1ª célula readonly) e
    // Peso (2ª) são ambos texto plano aqui; a edição migrou para batchPanel.ts.
    const row = tableRoot.querySelector('tr[data-ingredient-id="flour-1"]') as HTMLTableRowElement;
    const weightCell = row.querySelectorAll('td.readonly')[1] as HTMLElement;
    expect(weightCell.textContent).toBe('1.041,7');
  });

  it('11. modo peso→% → botão desabilitado; alvo 0 + clique → nenhuma mudança de estado', () => {
    const { scaleRoot, store } = mount();
    const targetInput = scaleRoot.querySelector(
      'input[aria-label="Peso alvo para escalonamento"]',
    ) as HTMLInputElement;
    const applyBtn = scaleRoot.querySelector('button') as HTMLButtonElement;

    store.update((draft) => {
      draft.calculationMode = 'weight-to-percentage';
    });
    expect(applyBtn.disabled).toBe(true);

    store.update((draft) => {
      draft.calculationMode = 'percentage-to-weight';
    });
    const before = store.getState();
    targetInput.value = '0';
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    applyBtn.click();

    expect(store.getState()).toBe(before); // applyTargetScaling→null (§5.C) — não aplica, não notifica
  });
});
