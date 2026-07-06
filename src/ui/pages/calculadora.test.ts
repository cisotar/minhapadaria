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
 *  4. gate do botão "Imprimir Custos" pela pref `showCosts` (issue 028/029) —
 *     paridade com o caso 12 de `historyView.test.ts` ("Imprimir Financeiro"):
 *     mount com `showCosts=false` → botão oculto (`.hidden`), "Imprimir
 *     Receita" sempre visível; marcar o checkbox "Exibir custos" (`change`)
 *     → reatividade via `store.subscribe` liga o botão; desmarcar volta a
 *     ocultar.
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
  // Shell real de `receitas.html` (issue 040: `<h1>`/`.subtitle` SEMPRE
  // estáticos — a substituição em runtime da issue 036 foi revertida; o nome
  // da receita, refino de posicionamento, agora é um `<section class="card">`
  // próprio dentro de `#app`, entre a barra de exportação e o card de
  // Ancoragem — NUNCA dentro de `.page-header .inner`) + `#app`, único ponto
  // de montagem dos cards (§2.F). Inócuo aos testes 1-4 pré-existentes
  // (nenhum deles inspeciona o header).
  document.body.innerHTML =
    '<header class="page-header"><div class="inner">' +
    '<h1>🍞 Calculadora de Pão com Fermento Natural</h1>' +
    '<p class="subtitle">Calcule custos, proporções e preços da sua receita.</p>' +
    '</div></header><div id="app"></div>';
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

  it('4. gate do botão "Imprimir Custos" pela pref showCosts (issue 028), reatividade via checkbox "Exibir custos"', () => {
    const findBtn = (label: string) =>
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label) as
        | HTMLButtonElement
        | undefined;

    const prefs = createPrefsStore({ storage: createMemoryStorage() });
    prefs.setShowCosts(false);

    initCalculadora({ recipeStore: makeStore(), prefs, search: '' });

    const printReceita = findBtn('Imprimir Receita');
    const printCustos = findBtn('Imprimir Custos');
    expect(printReceita).toBeDefined();
    expect(printReceita!.classList.contains('hidden')).toBe(false);
    expect(printCustos).toBeDefined();
    expect(printCustos!.classList.contains('hidden')).toBe(true);

    // Liga via checkbox real "Exibir custos" (cadeia de produção completa:
    // checkbox → store.setShowCosts → notify → subscribe → syncCostsBtn).
    const toggleLabel = Array.from(document.querySelectorAll('label.toggle-label')).find((l) =>
      l.textContent?.includes('Exibir custos'),
    ) as HTMLLabelElement;
    const toggleInput = toggleLabel.querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggleInput.checked = true;
    toggleInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(printCustos!.classList.contains('hidden')).toBe(false);

    // Desliga de volta — reatividade nos dois sentidos.
    toggleInput.checked = false;
    toggleInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(printCustos!.classList.contains('hidden')).toBe(true);
  });
});

describe('initCalculadora — nome da receita como campo fixo (issue 040, §2.F)', () => {
  const STATIC_H1 = '🍞 Calculadora de Pão com Fermento Natural';

  function pageH1(): HTMLHeadingElement {
    return document.querySelector('.page-header h1') as HTMLHeadingElement;
  }

  // Refino de posicionamento (issue 040): o campo NÃO mora mais em
  // `.page-header .inner` — vive num `<section class="card">` próprio dentro
  // de `#app`, entre a barra de exportação e o card de Ancoragem.
  function nameInput(): HTMLInputElement {
    return document.getElementById('recipe-name-input') as HTMLInputElement;
  }

  it('1. ?recipe=<id> válido → h1 estático intacto; campo de nome no card dedicado com value = nome da receita', () => {
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    expect(pageH1().textContent).toBe(STATIC_H1);
    expect(nameInput()).not.toBeNull();
    expect(nameInput().value).toBe('Pão Salvo');
  });

  it('1b. campo de nome NÃO está em `.page-header .inner`; o card de nome fica entre a barra de exportação e o card de Ancoragem', () => {
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    // Header 100% estático — nenhum input de nome injetado ali.
    expect(document.querySelector('.page-header .inner input')).toBeNull();

    // Ordem no DOM de `#app`: barra de exportação (`.row--sticky`) → card do
    // nome (contém `#recipe-name-input`) → 1º card renderizado (Ancoragem).
    const app = document.getElementById('app') as HTMLElement;
    const children = Array.from(app.children);
    const exportBarEl = app.querySelector('.row--sticky') as HTMLElement;
    const nameCardEl = nameInput().closest('.card') as HTMLElement;
    expect(nameCardEl).not.toBeNull();
    expect(nameCardEl.tagName).toBe('SECTION');

    const exportBarIndex = children.indexOf(exportBarEl);
    const nameCardIndex = children.indexOf(nameCardEl);
    const firstOtherCardIndex = children.findIndex(
      (el) => el.tagName === 'SECTION' && el.classList.contains('card') && el !== nameCardEl,
    );

    expect(exportBarIndex).toBeGreaterThanOrEqual(0);
    expect(nameCardIndex).toBeGreaterThan(exportBarIndex);
    expect(firstOtherCardIndex).toBeGreaterThan(nameCardIndex);
  });

  it('2. sem ?recipe (golden seed) → h1 estático intacto; campo de nome presente e VAZIO (nunca goldenSeed().name)', () => {
    initCalculadora({ recipeStore: makeStore(), prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '' });

    expect(pageH1().textContent).toBe(STATIC_H1);
    expect(nameInput()).not.toBeNull();
    expect(nameInput().value).toBe('');
    expect(goldenSeed().name).not.toBe(''); // golden seed TEM nome — confirma que não veio dele
  });

  it('3. ?recipe=<id> inexistente → banner de aviso + h1 estático intacto; campo presente e vazio (efêmera)', () => {
    initCalculadora({ recipeStore: makeStore(), prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '?recipe=inexistente' });

    expect(document.querySelector('.chip-warn')).not.toBeNull();
    expect(pageH1().textContent).toBe(STATIC_H1);
    expect(nameInput()).not.toBeNull();
    expect(nameInput().value).toBe('');
  });

  it('4. carregado, Enter "Pão Editado" → store imediato; recipeStore reflete só após o debounce', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });
    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    nameInput().value = 'Pão Editado';
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    vi.advanceTimersByTime(399);
    expect(recipeStore.get(saved.id)!.name).toBe('Pão Salvo'); // ainda não gravou
    vi.advanceTimersByTime(1);
    expect(recipeStore.get(saved.id)!.name).toBe('Pão Editado');
  });

  it('5. carregado, blur "Pão Blur" → após 400ms recipeStore reflete o novo nome', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });
    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    nameInput().value = 'Pão Blur';
    nameInput().dispatchEvent(new Event('blur', { bubbles: true }));

    vi.advanceTimersByTime(400);
    expect(recipeStore.get(saved.id)!.name).toBe('Pão Blur');
  });

  it('6. guarda (carregado): vazio ou igual ao atual ao confirmar → não altera recipe.name', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const saved = recipeStore.create({ ...goldenSeed(), name: 'Pão Salvo' });
    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    nameInput().value = '';
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(recipeStore.get(saved.id)!.name).toBe('Pão Salvo');

    nameInput().value = 'Pão Salvo'; // igual ao atual
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(recipeStore.get(saved.id)!.name).toBe('Pão Salvo');
  });

  it('7. caminho novo (sem ?recipe): confirmar nome não-vazio → create 1×, list +1, replaceUrl chamado; autosave passa a persistir', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const createSpy = vi.spyOn(recipeStore, 'create');
    const replaceUrl = vi.fn();
    const before = recipeStore.list();

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '', replaceUrl });

    nameInput().value = 'Minha Receita';
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(createSpy).toHaveBeenCalledTimes(1);
    const list = recipeStore.list();
    expect(list.length).toBe(before.length + 1);
    const created = list.find((r) => r.name === 'Minha Receita');
    expect(created).toBeDefined();
    expect(replaceUrl).toHaveBeenCalledWith(`receitas.html?recipe=${created!.id}`);

    // Edições seguintes de ingrediente passam a persistir (autosave ligado).
    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    pctInput.value = '90,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(waterPercentage(recipeStore.get(created!.id))).toBe(90);
  });

  it('8. caminho novo com nome vazio → create NÃO chamado; nada criado na lista; replaceUrl não chamado', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const createSpy = vi.spyOn(recipeStore, 'create');
    const replaceUrl = vi.fn();
    const before = recipeStore.list();

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '', replaceUrl });

    nameInput().value = '';
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(createSpy).not.toHaveBeenCalled();
    expect(recipeStore.list()).toEqual(before);
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it('9. junk-prevention: efêmera, editar % Água sem nomear → recipeStore.list() inalterado; replaceUrl não chamado', () => {
    vi.useFakeTimers();
    const recipeStore = makeStore();
    const replaceUrl = vi.fn();
    const before = recipeStore.list();

    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: '', replaceUrl });

    const pctInput = document.querySelector('input[aria-label="Porcentagem de Água"]') as HTMLInputElement;
    pctInput.value = '90,00';
    pctInput.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(5000);

    expect(recipeStore.list()).toEqual(before);
    expect(replaceUrl).not.toHaveBeenCalled();
  });

  it('10. XSS: nome <img src=x onerror> carregado → sem nó <img>; input.value é o texto literal', () => {
    const recipeStore = makeStore();
    const evil = '<img src=x onerror=alert(1)>';
    const saved = recipeStore.create({ ...goldenSeed(), name: evil });
    initCalculadora({ recipeStore, prefs: createPrefsStore({ storage: createMemoryStorage() }), search: `?recipe=${saved.id}` });

    expect(document.querySelector('.page-header img')).toBeNull();
    expect(nameInput().closest('.card')!.querySelector('img')).toBeNull();
    expect(nameInput().value).toBe(evil);
    expect(pageH1().textContent).toBe(STATIC_H1);
  });
});
