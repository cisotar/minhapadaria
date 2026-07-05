// @vitest-environment jsdom
/**
 * recipesList.test.ts — Testes jsdom da tela Minhas Receitas (issue 017,
 * spec §2.F/§10/§14.7).
 *
 * Casos 1–13 do Plano Técnico da issue 017. Backend: createMemoryStorage()
 * (sem localStorage real); `recipeStore` com `newId`/`now` determinísticos
 * (mesmo padrão de recipes.test.ts/backup.test.ts). Dependências de
 * navegação/diálogo/arquivo (`confirm`/`prompt`/`navigate`/`readFile`/
 * `download`/`onError`) são injetadas — zero `window.confirm` real em teste.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createRecipeStore, type RecipeStore } from '../storage/recipes';
import { BAKES_STORAGE_KEY } from '../storage/backup';
import { goldenSeed } from './seed';
import { renderRecipesList } from './recipesList';
import type { Recipe, BakeEntry } from '../core/types';
import type { StorageLike } from '../storage/local';

/** Fixture §12 exata: goldenSeed() sem a categoria `fat` (Azeite, issue 014) —
 *  mesma técnica de pricingPanel.test.ts (regra de ouro 2: golden §12 sem Azeite). */
function goldenSeedNoFat(): Recipe {
  const recipe = goldenSeed();
  recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'fat');
  return recipe;
}

function makeClock(startISO: string) {
  let t = new Date(startISO).getTime();
  return () => {
    const d = new Date(t);
    t += 24 * 60 * 60 * 1000;
    return d;
  };
}

function makeIds(prefix = 'id') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

function makeStore(storage: StorageLike = createMemoryStorage()): RecipeStore {
  return createRecipeStore({
    storage,
    now: makeClock('2026-07-05T00:00:00.000Z'),
    newId: makeIds(),
  });
}

interface MountDeps {
  storage?: StorageLike;
  recipeStore?: RecipeStore;
  confirm?: (message: string) => boolean;
  navigate?: (url: string) => void;
  readFile?: (file: File) => Promise<string>;
  download?: (json: string) => void;
  onError?: (message: string) => void;
}

function mount(deps: MountDeps = {}) {
  const root = document.createElement('div');
  const storage = deps.storage ?? createMemoryStorage();
  const recipeStore = deps.recipeStore ?? makeStore(storage);
  renderRecipesList(root, {
    recipeStore,
    storage,
    confirm: deps.confirm,
    navigate: deps.navigate,
    readFile: deps.readFile,
    download: deps.download,
    onError: deps.onError,
  });
  return { root, storage, recipeStore };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('recipesList (jsdom)', () => {
  it('1. estado vazio: sem receitas → .empty-state com botão "Criar primeira receita"; sem .recipe-card', () => {
    const { root } = mount();
    expect(root.querySelectorAll('.recipe-card')).toHaveLength(0);
    const empty = root.querySelector('.empty-state');
    expect(empty).not.toBeNull();
    const btn = Array.from(empty!.querySelectorAll('button')).find(
      (b) => b.textContent === 'Criar primeira receita',
    );
    expect(btn).not.toBeUndefined();
  });

  it('2. lista: 2 receitas → 2 .recipe-card; h3 = nomes; subtítulo "2 receitas cadastradas"', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão de Centeio' });
    const { root } = mount({ storage, recipeStore });

    const cards = root.querySelectorAll('.recipe-card');
    expect(cards).toHaveLength(2);
    const names = Array.from(root.querySelectorAll('.recipe-card h3')).map((n) => n.textContent);
    expect(names).toEqual(['Pão Rústico', 'Pão de Centeio']);
    expect(root.textContent).toContain('2 receitas cadastradas');
  });

  it('3. card stats: fixture sem Azeite (seed com Isca=1, 2026-07-06) → Custo unit. R$ 4,30 e chip 40,00% classe chip-ok', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create(goldenSeedNoFat());
    const { root } = mount({ storage, recipeStore });

    const card = root.querySelector('.recipe-card')!;
    // Ajuste do cliente (§5.1, 2026-07-06): seed usa Isca=1 (era 0) — muda o
    // custo do fermento e, por consequência, o custo unitário da receita
    // (era R$4,43 com Isca 0; golden-example.test.ts mantém o fixture §12
    // original à parte, AC25).
    expect(card.querySelector('.stat-value')!.textContent).toBe('R$ 4,30');
    const chip = card.querySelector('.chip') as HTMLElement;
    expect(chip.textContent).toBe('40,00%');
    expect(chip.classList.contains('chip-ok')).toBe(true);
  });

  it('4. XSS: nome <img src=x onerror> → sem nó <img>; h3.textContent === literal', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const evil = '<img src=x onerror="x">';
    recipeStore.create({ ...goldenSeedNoFat(), name: evil });
    const { root } = mount({ storage, recipeStore });

    expect(root.querySelector('img')).toBeNull();
    const h3 = root.querySelector('.recipe-card h3')!;
    expect(h3.textContent).toBe(evil);
  });

  it('5. criar: clique "+ Nova receita" → list().length +1; navigate chamado com receitas.html?recipe=<id>', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const navigate = vi.fn();
    const { root } = mount({ storage, recipeStore, navigate });

    const before = recipeStore.list().map((r) => r.id);
    const newBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Nova receita')!;
    newBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const after = recipeStore.list();
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((r) => !before.includes(r.id))!;
    expect(navigate).toHaveBeenCalledWith(`receitas.html?recipe=${created.id}`);
  });

  it('6. duplicar independente: +1 na lista, nome "Cópia de X"; mutar cópia não afeta original', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const original = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    const { root } = mount({ storage, recipeStore });

    const dupBtn = Array.from(root.querySelectorAll('.recipe-card button')).find(
      (b) => b.textContent === 'Duplicar',
    ) as HTMLButtonElement;
    dupBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const all = recipeStore.list();
    expect(all).toHaveLength(2);
    const copy = all.find((r) => r.id !== original.id)!;
    expect(copy.name).toBe('Cópia de Pão Rústico');

    recipeStore.update({ ...copy, ingredients: copy.ingredients.map((i) => ({ ...i, weight: 999 })) });
    expect(recipeStore.get(original.id)!.ingredients[0].weight).not.toBe(999);
  });

  // Issue 033 (refactor II): renomear vira edição inline no card, sem
  // window.prompt/modal — casos 1-8 do Plano Técnico da issue 033.
  describe('renomear inline (issue 033)', () => {
    function clickRename(root: HTMLElement): void {
      const renameBtn = Array.from(root.querySelectorAll('.recipe-card button')).find(
        (b) => b.textContent === 'Renomear',
      ) as HTMLButtonElement;
      renameBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function getInlineInput(root: HTMLElement): HTMLInputElement {
      return root.querySelector('.recipe-card input') as HTMLInputElement;
    }

    it('1. clique "Renomear" → h3 some, input.cell-input com valor atual e foco', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });
      document.body.appendChild(root); // document.activeElement exige nó no documento

      clickRename(root);

      expect(root.querySelector('.recipe-card h3')).toBeNull();
      const input = getInlineInput(root);
      expect(input).not.toBeNull();
      expect(input.value).toBe('Pão Rústico');
      expect(document.activeElement).toBe(input);

      document.body.removeChild(root);
    });

    it('2. Enter com "Pão Novo" válido → rename chamado, h3 volta com novo nome, sem input', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const original = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });

      clickRename(root);
      const input = getInlineInput(root);
      input.value = 'Pão Novo';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(recipeStore.get(original.id)!.name).toBe('Pão Novo');
      expect(getInlineInput(root)).toBeNull();
      expect(root.querySelector('.recipe-card h3')!.textContent).toBe('Pão Novo');
    });

    it('3. blur com "Pão Novo" válido → mesmo resultado do Enter', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const original = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });

      clickRename(root);
      const input = getInlineInput(root);
      input.value = 'Pão Novo';
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(recipeStore.get(original.id)!.name).toBe('Pão Novo');
      expect(getInlineInput(root)).toBeNull();
      expect(root.querySelector('.recipe-card h3')!.textContent).toBe('Pão Novo');
    });

    it('4. Esc → rename NÃO chamado, h3 restaurado com nome original', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const original = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });
      const renameSpy = vi.spyOn(recipeStore, 'rename');

      clickRename(root);
      const input = getInlineInput(root);
      input.value = 'Xyz';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(renameSpy).not.toHaveBeenCalled();
      expect(recipeStore.get(original.id)!.name).toBe('Pão Rústico');
      expect(getInlineInput(root)).toBeNull();
      expect(root.querySelector('.recipe-card h3')!.textContent).toBe('Pão Rústico');
    });

    it('5. confirmar com nome vazio → rename NÃO chamado, h3 restaurado', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });
      const renameSpy = vi.spyOn(recipeStore, 'rename');

      clickRename(root);
      const input = getInlineInput(root);
      input.value = '';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(renameSpy).not.toHaveBeenCalled();
      expect(root.querySelector('.recipe-card h3')!.textContent).toBe('Pão Rústico');
    });

    it('6. confirmar com valor === nome atual → rename NÃO chamado', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });
      const renameSpy = vi.spyOn(recipeStore, 'rename');

      clickRename(root);
      const input = getInlineInput(root);
      input.value = 'Pão Rústico';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(renameSpy).not.toHaveBeenCalled();
      expect(root.querySelector('.recipe-card h3')!.textContent).toBe('Pão Rústico');
    });

    it('7. window.prompt NÃO é chamado ao clicar "Renomear" nem ao confirmar (issue 033: fim do modal)', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const promptSpy = vi.spyOn(window, 'prompt');
      const { root } = mount({ storage, recipeStore });

      clickRename(root);
      expect(promptSpy).not.toHaveBeenCalled();
      const input = getInlineInput(root);
      input.value = 'Pão Novo';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(promptSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('8. XSS: renomear para <img src=x onerror> → sem nó <img>, h3.textContent literal', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });
      const evil = '<img src=x onerror="x">';

      clickRename(root);
      const input = getInlineInput(root);
      input.value = evil;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      const card = root.querySelector('.recipe-card')!;
      expect(card.querySelector('img')).toBeNull();
      expect(card.querySelector('h3')!.textContent).toBe(evil);
    });
  });

  it('8. excluir confirmado + órfãs: fornada preservada; mensagem do confirm contém "órfã"', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const recipe = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    const bakeEntry: BakeEntry = {
      id: 'bake-1',
      recipeId: recipe.id,
      recipeName: recipe.name,
      date: new Date('2026-07-03T00:00:00.000Z'),
      quantityProduced: 2,
      quantitySold: 2,
      unitCost: 4.43,
      unitSalePrice: 7.38,
    };
    storage.setItem(BAKES_STORAGE_KEY, JSON.stringify([bakeEntry]));
    const bakesBefore = storage.getItem(BAKES_STORAGE_KEY);
    const confirm = vi.fn().mockReturnValue(true);
    const { root } = mount({ storage, recipeStore, confirm });

    const deleteBtn = root.querySelector('.recipe-card .card-delete-btn') as HTMLButtonElement;
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(recipeStore.list()).toHaveLength(0);
    expect(storage.getItem(BAKES_STORAGE_KEY)).toBe(bakesBefore); // §14.7: fornada órfã preservada
    expect(confirm.mock.calls[0][0]).toMatch(/órfã/);
  });

  it('9. excluir cancelado: confirm false → receita permanece', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    const confirm = vi.fn().mockReturnValue(false);
    const { root } = mount({ storage, recipeStore, confirm });

    const deleteBtn = root.querySelector('.recipe-card .card-delete-btn') as HTMLButtonElement;
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(recipeStore.list()).toHaveLength(1);
  });

  it('10. backup export: download recebe JSON com app "minhapadaria" e nome da receita', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    const download = vi.fn();
    const { root } = mount({ storage, recipeStore, download });

    const exportBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent === 'Exportar backup',
    ) as HTMLButtonElement;
    exportBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(download).toHaveBeenCalledTimes(1);
    const json = download.mock.calls[0][0] as string;
    expect(json).toContain('"app":"minhapadaria"');
    expect(json).toContain('Pão Rústico');
  });

  it('11. restaurar round-trip: exporta → limpa → importa → list() volta com mesmos ids', async () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Baguete' });
    const originalIds = recipeStore.list().map((r) => r.id).sort();

    let exportedJson = '';
    const download = vi.fn((json: string) => {
      exportedJson = json;
    });
    const readFile = vi.fn().mockImplementation(() => Promise.resolve(exportedJson));
    const { root } = mount({ storage, recipeStore, download, readFile });

    const exportBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent === 'Exportar backup',
    ) as HTMLButtonElement;
    exportBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(exportedJson).not.toBe('');

    recipeStore.replaceAll([]);
    expect(recipeStore.list()).toHaveLength(0);

    const fileInput = root.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['ignored'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    const restoredIds = recipeStore.list().map((r) => r.id).sort();
    expect(restoredIds).toEqual(originalIds);
  });

  it('12. import inválido não perde dados: status/onError recebe pt-BR; list() intacta', async () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    const onError = vi.fn();
    const readFile = vi.fn().mockResolvedValue('{lixo');
    const { root } = mount({ storage, recipeStore, readFile, onError });

    const fileInput = root.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['ignored'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();

    expect(recipeStore.list()).toHaveLength(1);
    const statusRegion = root.querySelector('[role="status"]');
    const gotMessage = onError.mock.calls[0]?.[0] ?? statusRegion?.textContent ?? '';
    expect(gotMessage).toMatch(/[Aa]rquivo de backup inválido/);
  });

  it('13. busca: 2 receitas, digitar termo de uma → só 1 card visível', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
    recipeStore.create({ ...goldenSeedNoFat(), name: 'Baguete Tradicional' });
    const { root } = mount({ storage, recipeStore });

    const searchInput = root.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'Baguete';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const cards = root.querySelectorAll('.recipe-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('h3')!.textContent).toBe('Baguete Tradicional');
  });

  it('14. "Abrir" (issue 025): href do card === receitas.html?recipe=<encodeURIComponent(id)>', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const created = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão & Cia' }); // "&" força encode
    const { root } = mount({ storage, recipeStore });

    const openLink = root.querySelector('.recipe-card a.btn-primary') as HTMLAnchorElement;
    expect(openLink.textContent).toBe('Abrir');
    expect(openLink.getAttribute('href')).toBe(`receitas.html?recipe=${encodeURIComponent(created.id)}`);
  });

  it('15. "Nova receita em branco" (issue 025, §2.F): recipeStore.create() SEM seed + navigate', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const navigate = vi.fn();
    const { root } = mount({ storage, recipeStore, navigate });

    const before = recipeStore.list().map((r) => r.id);
    const blankBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent === 'Nova receita em branco',
    )!;
    blankBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const after = recipeStore.list();
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((r) => !before.includes(r.id))!;
    // Sem seed: cai no `defaultRecipe()` mínimo do próprio store (recipes.ts) — zero ingredientes/fermento.
    expect(created.ingredients).toHaveLength(0);
    expect(created.sourdough.flours).toHaveLength(0);
    expect(navigate).toHaveBeenCalledWith(`receitas.html?recipe=${created.id}`);
  });

  it('16. subtítulo dinâmico (issue 025 item 3): montado em headerRoot com classe .subtitle', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    recipeStore.create(goldenSeedNoFat());
    const root = document.createElement('div');
    const headerRoot = document.createElement('div');
    renderRecipesList(root, { recipeStore, storage, headerRoot });

    const subtitle = headerRoot.querySelector('.subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toBe('1 receita cadastrada');
    expect(root.querySelector('.subtitle')).toBeNull(); // não duplica dentro de root
  });
});
