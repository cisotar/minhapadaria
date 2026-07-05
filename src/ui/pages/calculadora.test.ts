// @vitest-environment jsdom
/**
 * calculadora.test.ts — Testes jsdom da integração `?recipe=<id>` (issue 025,
 * achado médio da revisão da issue 017: `pages/calculadora.ts` ~98 sem teste).
 *
 * `initCalculadora(deps)` (extraído nesta issue, mesmo comportamento do script
 * de página de sempre) recebe `recipeStore`/`prefs`/`search` injetáveis —
 * mesmo padrão de `recipesList.test.ts`/`ingredientsTable.test.ts` (backend em
 * memória, zero `window.location`/`localStorage` real em teste). Casos do
 * plano da issue (§2.F):
 *  1. id válido → semente = receita salva (não golden seed) + auto-save
 *     grava (só a ÚLTIMA edição) depois do debounce de ~400ms
 *     (`vi.useFakeTimers()`/`vi.advanceTimersByTime`).
 *  2. id inexistente → banner `.chip-warn` + semente = golden seed, SEM
 *     persistir (nenhum autosave agendado — `recipeStore` intocado).
 *  3. `visibilitychange` (aba escondida) força o flush imediato, sem esperar
 *     o debounce completar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMemoryStorage } from '../../storage/local';
import { createRecipeStore, type RecipeStore } from '../../storage/recipes';
import { createPrefsStore } from '../../storage/prefs';
import { goldenSeed } from '../seed';
import { initCalculadora } from './calculadora';

function makeIds(prefix = 'id') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

function makeClock(startISO: string) {
  let t = new Date(startISO).getTime();
  return () => {
    const d = new Date(t);
    t += 24 * 60 * 60 * 1000;
    return d;
  };
}

function makeStore(): RecipeStore {
  return createRecipeStore({
    storage: createMemoryStorage(),
    now: makeClock('2026-07-05T00:00:00.000Z'),
    newId: makeIds(),
  });
}

function waterPercentage(recipe: ReturnType<RecipeStore['get']>): number {
  return recipe!.ingredients.find((i) => i.name === 'Água')!.percentage as number;
}

beforeEach(() => {
  // Shell mínimo de index.html (spec §2.F): #app é o único ponto de montagem.
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  vi.useRealTimers();
  // Desfaz qualquer `document.hidden` forjado no teste 3 (própria propriedade
  // sombreando o getter do protótipo) — restaura o comportamento nativo do jsdom.
  delete (document as unknown as Record<string, unknown>).hidden;
});

describe('initCalculadora — integração ?recipe=<id> (jsdom, §2.F)', () => {
  it('1. id válido: semente = receita salva + auto-save grava a última edição após o debounce', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    // % de Água distinta do golden seed (70) — evidencia que a semente veio do
    // `recipeStore`, não de um `goldenSeed()` efêmero (a receita não tem nome
    // renderizado na tela, então o campo observável é este).
    const seedRecipe = goldenSeed();
    seedRecipe.ingredients = seedRecipe.ingredients.map((i) =>
      i.name === 'Água' ? { ...i, percentage: 65 } : i,
    );
    const saved = recipeStore.create({ ...seedRecipe, name: 'Pão Salvo' });
    const prefs = createPrefsStore({ storage: createMemoryStorage() });

    initCalculadora({ recipeStore, prefs, search: `?recipe=${saved.id}` });

    expect(document.querySelector('.chip-warn')).toBeNull(); // sem banner de "não encontrada"

    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    expect(pctInput).not.toBeNull();
    expect(pctInput.value).toBe('65,00'); // semente = receita salva, não o golden seed (70)

    pctInput.value = '75,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Antes do debounce completar (~400ms), nada foi gravado ainda.
    vi.advanceTimersByTime(399);
    expect(waterPercentage(recipeStore.get(saved.id))).toBe(65);

    // Debounce completo → grava a última edição.
    vi.advanceTimersByTime(1);
    expect(waterPercentage(recipeStore.get(saved.id))).toBe(75);
  });

  it('1b. auto-save grava só a última edição de uma rajada (debounce reagendado a cada notificação)', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    pctInput.value = '71,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(200); // ainda dentro do debounce
    pctInput.value = '80,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true })); // reagenda o timer
    vi.advanceTimersByTime(399);
    expect(waterPercentage(recipeStore.get(saved.id))).toBe(70); // ainda nada gravado

    vi.advanceTimersByTime(1);
    expect(waterPercentage(recipeStore.get(saved.id))).toBe(80); // só a última edição
  });

  it('2. id inexistente: banner de aviso + golden seed, SEM persistir (nenhum autosave agendado)', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const before = recipeStore.list();

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '?recipe=inexistente' });

    const banner = document.querySelector('.chip-warn');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toBe('Receita não encontrada; abrindo modelo padrão.');

    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    expect(pctInput.value).toBe('70,00'); // golden seed (§12) — não uma receita salva

    pctInput.value = '90,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(5000); // bem além do debounce — nada deveria disparar

    expect(recipeStore.list()).toEqual(before); // nenhuma gravação: nem update, nem create
  });

  it('3. visibilitychange (aba escondida) força o flush imediato, sem esperar o debounce', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    pctInput.value = '65,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Sem avançar o timer: só forjar `document.hidden` + disparar o evento.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(waterPercentage(recipeStore.get(saved.id))).toBe(65); // flush imediato, debounce não completou
  });
});
