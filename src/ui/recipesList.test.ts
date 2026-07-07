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
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('5. clique "+ Nova receita" (issue 035) → NÃO cria direto, abre o modal (caso 12 do bloco "modal nova receita" abaixo cobre o fluxo completo)', () => {
    const storage = createMemoryStorage();
    const recipeStore = makeStore(storage);
    const { root } = mount({ storage, recipeStore });
    document.body.appendChild(root); // modal se anexa a document.body — precisa estar no documento

    const before = recipeStore.list().length;
    const newBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Nova receita')!;
    newBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(recipeStore.list()).toHaveLength(before); // nada criado ainda
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
    document.body.removeChild(root);
  });

  // Issue 035 (refactor "Nova Receita" item 1): "+ Nova receita" abre
  // `openPromptModal` (modal.ts) pedindo o nome ANTES de criar — casos 12–17
  // do Plano Técnico. O componente genérico já é testado à parte em
  // `modal.test.ts`; aqui só o wiring de negócio (recipeStore.create/navigate).
  describe('modal nova receita (issue 035)', () => {
    function mountAttached(deps: MountDeps = {}) {
      const mounted = mount(deps);
      document.body.appendChild(mounted.root); // modal se anexa a document.body
      return mounted;
    }

    function clickNewBtn(root: HTMLElement): void {
      const newBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Nova receita')!;
      newBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function dialogInput(): HTMLInputElement {
      return document.querySelector('[role="dialog"] input') as HTMLInputElement;
    }

    function dialogBtn(text: string): HTMLButtonElement {
      return Array.from(document.querySelectorAll('[role="dialog"] button')).find(
        (b) => b.textContent === text,
      ) as HTMLButtonElement;
    }

    afterEach(() => {
      // limpeza defensiva — o modal se anexa a document.body por conta
      // própria; um teste que deixa o modal aberto (caso 14) não pode vazar
      // para o próximo (mesmo jsdom reusado por arquivo de teste).
      document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
      document.body.innerHTML = '';
    });

    it('12. clique "+ Nova receita" → recipeStore.create NÃO chamado ainda; modal aberto', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const createSpy = vi.spyOn(recipeStore, 'create');
      const { root } = mountAttached({ storage, recipeStore });

      clickNewBtn(root);

      expect(createSpy).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('13. confirmar com nome → create chamado com o nome digitado; navigate para receitas.html?recipe=<id>; modal fecha', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const navigate = vi.fn();
      const { root } = mountAttached({ storage, recipeStore, navigate });

      const before = recipeStore.list().map((r) => r.id);
      clickNewBtn(root);
      dialogInput().value = 'Pão de Forma';
      dialogBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const after = recipeStore.list();
      expect(after).toHaveLength(before.length + 1);
      const created = after.find((r) => !before.includes(r.id))!;
      expect(created.name).toBe('Pão de Forma');
      expect(navigate).toHaveBeenCalledWith(`receitas.html?recipe=${created.id}`);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('14. confirmar vazio → create/navigate NÃO chamados; modal aberto com erro', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const navigate = vi.fn();
      const createSpy = vi.spyOn(recipeStore, 'create');
      const { root } = mountAttached({ storage, recipeStore, navigate });

      clickNewBtn(root);
      dialogInput().value = '';
      dialogBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(createSpy).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      expect(document.querySelector('.form-status--error')).not.toBeNull();
    });

    it('15a. cancelar via botão → create/navigate NÃO chamados; modal fecha', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const navigate = vi.fn();
      const createSpy = vi.spyOn(recipeStore, 'create');
      const { root } = mountAttached({ storage, recipeStore, navigate });

      clickNewBtn(root);
      dialogBtn('Cancelar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(createSpy).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('15b. Esc → create/navigate NÃO chamados; modal fecha', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const navigate = vi.fn();
      const createSpy = vi.spyOn(recipeStore, 'create');
      const { root } = mountAttached({ storage, recipeStore, navigate });

      clickNewBtn(root);
      document
        .querySelector('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

      expect(createSpy).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('15c. clique no backdrop → create/navigate NÃO chamados; modal fecha', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const navigate = vi.fn();
      const createSpy = vi.spyOn(recipeStore, 'create');
      const { root } = mountAttached({ storage, recipeStore, navigate });

      clickNewBtn(root);
      const overlay = document.querySelector('.modal-overlay') as HTMLElement;
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(createSpy).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('16. XSS: nome malicioso → create recebe literal; sem <img> no DOM do modal', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const evil = '<img src=x onerror="x">';
      const { root } = mountAttached({ storage, recipeStore, navigate: vi.fn() });

      clickNewBtn(root);
      dialogInput().value = evil;
      expect(document.querySelector('.modal img')).toBeNull();
      dialogBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const created = recipeStore.list().find((r) => r.name === evil);
      expect(created).not.toBeUndefined();
      expect(document.querySelector('.modal img')).toBeNull();
    });

    it('17. "Nova receita em branco" continua sem abrir modal (regressão)', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const { root } = mountAttached({ storage, recipeStore, navigate: vi.fn() });

      const blankBtn = Array.from(root.querySelectorAll('button')).find(
        (b) => b.textContent === 'Nova receita em branco',
      )!;
      blankBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
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

  describe('reordenar por arrastar (issue 050)', () => {
    /** Fabrica um `DOMRect` mínimo para mockar `getBoundingClientRect` (jsdom
     *  não faz layout real — geometria é sempre zero por padrão). `left`/
     *  `width` permitem modelar cards LADO A LADO (grid de N colunas), não só
     *  uma pilha vertical — essencial pra cobrir o eixo horizontal do DnD. */
    function rect(top: number, height: number, left = 0, width = 100): DOMRect {
      return {
        top,
        height,
        bottom: top + height,
        left,
        right: left + width,
        width,
        x: left,
        y: top,
        toJSON: () => ({}),
      } as DOMRect;
    }

    /** Modela um grid de UMA linha com 3 cards lado a lado (o layout real
     *  `repeat(3, 1fr)`): A|B|C em x=[0,100), [100,200), [200,300), todos no
     *  mesmo topo. Centros horizontais: A=50, B=150, C=250. */
    function stubRow(cards: HTMLElement[]): void {
      cards.forEach((card, i) => {
        card.getBoundingClientRect = () => rect(100, 50, i * 100, 100);
      });
    }

    it('17. alça (`.recipe-drag-handle`) existe em todo card sem busca; some com busca ativa', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Baguete Tradicional' });
      const { root } = mount({ storage, recipeStore });

      expect(root.querySelectorAll('.recipe-drag-handle')).toHaveLength(2);
      const handle = root.querySelector('.recipe-drag-handle') as HTMLButtonElement;
      expect(handle.getAttribute('aria-label')).toContain('Reordenar receita');

      const searchInput = root.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput.value = 'Baguete';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Busca ativa (lista parcial): reordenar é ambíguo — alça não é renderizada.
      expect(root.querySelectorAll('.recipe-drag-handle')).toHaveLength(0);
    });

    it('18. mousedown na alça liga `card.draggable`; mouseup sem drag efetivo desliga de volta', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      const { root } = mount({ storage, recipeStore });

      const card = root.querySelector('.recipe-card') as HTMLElement;
      const handle = root.querySelector('.recipe-drag-handle') as HTMLElement;
      expect(card.draggable).toBe(false);

      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(card.draggable).toBe(true);

      handle.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(card.draggable).toBe(false);
    });

    it('19. dragstart→dragover→dragend: reorder chamado com a nova ordem; grid re-renderizado consistente com o store', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      expect(cardsBefore.map((c) => c.dataset.id)).toEqual([r1.id, r2.id, r3.id]);

      const dragged = cardsBefore[0]; // Pão A
      const handle = dragged.querySelector('.recipe-drag-handle') as HTMLElement;
      const target = cardsBefore[2]; // Pão C — arrasta A para depois de C
      stubRow(cardsBefore); // A|B|C lado a lado (centros x = 50, 150, 250)

      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      dragged.dispatchEvent(new Event('dragstart', { bubbles: true }));
      expect(dragged.classList.contains('dragging')).toBe(true);

      // Ponteiro na METADE DIREITA de C (clientX 260 > centro 250) → depois
      // de C, na mesma linha → A vai para o FIM. (Antes o eixo horizontal era
      // ignorado e esse movimento pra direita não acontecia — o bug relatado.)
      const dragoverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 260, clientY: 125 });
      target.dispatchEvent(dragoverEvent);
      expect(dragoverEvent.defaultPrevented).toBe(true); // preventDefault habilita o drop

      dragged.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(reorderSpy).toHaveBeenCalledWith([r2.id, r3.id, r1.id]);
      expect(dragged.draggable).toBe(false); // reset ao final do gesto

      const cardsAfter = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      expect(cardsAfter.map((c) => c.dataset.id)).toEqual([r2.id, r3.id, r1.id]);
      expect(recipeStore.list().map((r) => r.id)).toEqual([r2.id, r3.id, r1.id]); // store é a fonte da verdade
    });

    it('20. dragover na metade ESQUERDA do alvo → insere ANTES dele', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      const dragged = cardsBefore[2]; // Pão C
      const handle = dragged.querySelector('.recipe-drag-handle') as HTMLElement;
      const target = cardsBefore[0]; // Pão A — arrasta C para antes de A
      stubRow(cardsBefore); // A|B|C lado a lado (centros x = 50, 150, 250)

      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      dragged.dispatchEvent(new Event('dragstart', { bubbles: true }));

      // Ponteiro na METADE ESQUERDA de A (clientX 40 < centro 50) → insere
      // ANTES de "Pão A".
      target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 40, clientY: 125 }));
      dragged.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(reorderSpy).toHaveBeenCalledWith([r3.id, r1.id, r2.id]);
      const cardsAfter = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      expect(cardsAfter.map((c) => c.dataset.id)).toEqual([r3.id, r1.id, r2.id]);
    });

    it('21. busca ativa: sem alça, `dragstart` não faz nada (card não é `draggable`, `reorder` não chamado)', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico' });
      recipeStore.create({ ...goldenSeedNoFat(), name: 'Baguete Tradicional' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const searchInput = root.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput.value = 'Baguete';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const card = root.querySelector('.recipe-card') as HTMLElement;
      expect(card.draggable).toBe(false);
      card.dispatchEvent(new Event('dragstart', { bubbles: true }));
      card.dispatchEvent(new Event('dragend', { bubbles: true }));
      expect(reorderSpy).not.toHaveBeenCalled();
    });

    it('22. swap imediato ao cruzar o meio horizontal de um vizinho DIRETO (revisão UX): não precisa ultrapassar o bloco inteiro', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      const dragged = cardsBefore[0]; // Pão A
      const handle = dragged.querySelector('.recipe-drag-handle') as HTMLElement;
      const target = cardsBefore[1]; // Pão B — vizinho DIRETO de A
      stubRow(cardsBefore); // A|B|C lado a lado (centros x = 50, 150, 250)

      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      dragged.dispatchEvent(new Event('dragstart', { bubbles: true }));

      // Só 10px além do centro de B (160 > 150) — bem longe de "ultrapassar o
      // bloco inteiro" (que iria até 200) — já basta pra trocar A↔B de lugar.
      target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 160, clientY: 125 }));
      dragged.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(reorderSpy).toHaveBeenCalledWith([r2.id, r1.id, r3.id]);
      const cardsAfter = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      expect(cardsAfter.map((c) => c.dataset.id)).toEqual([r2.id, r1.id, r3.id]);
    });

    it('23. thrash guard: `dragover` repetido na MESMA posição não desfaz/duplica o swap', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      const dragged = cardsBefore[0]; // Pão A
      const handle = dragged.querySelector('.recipe-drag-handle') as HTMLElement;
      const target = cardsBefore[1]; // Pão B
      stubRow(cardsBefore); // A|B|C lado a lado (centros x = 50, 150, 250)

      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      dragged.dispatchEvent(new Event('dragstart', { bubbles: true }));

      // Mesma posição (à direita do centro de B) disparada 3x seguidas —
      // simula o `dragover` nativo repetindo enquanto o ponteiro fica parado.
      for (let i = 0; i < 3; i += 1) {
        target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 160, clientY: 125 }));
      }
      dragged.dispatchEvent(new Event('dragend', { bubbles: true }));

      // Um único resultado consistente — sem "voltar" nem duplicar o swap.
      expect(reorderSpy).toHaveBeenCalledTimes(1);
      expect(reorderSpy).toHaveBeenCalledWith([r2.id, r1.id, r3.id]);
    });

    it('24. `prefers-reduced-motion: reduce` pula a animação FLIP mas a reordenação continua idêntica', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      // jsdom não implementa `matchMedia` por padrão — stub simulando
      // `prefers-reduced-motion: reduce` ativo, restaurado ao fim do teste.
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);

      try {
        const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
        const dragged = cardsBefore[0]; // Pão A
        const handle = dragged.querySelector('.recipe-drag-handle') as HTMLElement;
        const target = cardsBefore[1]; // Pão B
        stubRow(cardsBefore); // A|B|C lado a lado (centros x = 50, 150, 250)

        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dragged.dispatchEvent(new Event('dragstart', { bubbles: true }));
        expect(() => {
          target.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 160, clientY: 125 }));
        }).not.toThrow();
        dragged.dispatchEvent(new Event('dragend', { bubbles: true }));

        expect(reorderSpy).toHaveBeenCalledWith([r2.id, r1.id, r3.id]);
        const cardsAfter = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
        expect(cardsAfter.map((c) => c.dataset.id)).toEqual([r2.id, r1.id, r3.id]);
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });

    it('25. grid de 2 linhas: arrastar um card da linha de cima para a linha de baixo (ordem de leitura 2D)', () => {
      const storage = createMemoryStorage();
      const recipeStore = makeStore(storage);
      const r1 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão A' });
      const r2 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão B' });
      const r3 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão C' });
      const r4 = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão D' });
      const { root } = mount({ storage, recipeStore });
      const reorderSpy = vi.spyOn(recipeStore, 'reorder');

      const cardsBefore = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      // Grid 2×2: linha 0 = A|B (topo 0), linha 1 = C|D (topo 100).
      //   A: x[0,100) y[0,50)     C: x[0,100) y[100,150)
      //   B: x[100,200) y[0,50)   D: x[100,200) y[100,150)
      const [a, b, c, d] = cardsBefore;
      a.getBoundingClientRect = () => rect(0, 50, 0, 100);
      b.getBoundingClientRect = () => rect(0, 50, 100, 100);
      c.getBoundingClientRect = () => rect(100, 50, 0, 100);
      d.getBoundingClientRect = () => rect(100, 50, 100, 100);

      const handle = a.querySelector('.recipe-drag-handle') as HTMLElement;
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      a.dispatchEvent(new Event('dragstart', { bubbles: true }));

      // Ponteiro na linha de baixo, metade direita de C (clientX 60 > centro
      // 50, dentro da faixa vertical de C/D) → A entra antes de D.
      d.dispatchEvent(new MouseEvent('dragover', { bubbles: true, cancelable: true, clientX: 60, clientY: 125 }));
      a.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(reorderSpy).toHaveBeenCalledWith([r2.id, r3.id, r1.id, r4.id]);
      const cardsAfter = Array.from(root.querySelectorAll('.recipe-card')) as HTMLElement[];
      expect(cardsAfter.map((el) => el.dataset.id)).toEqual([r2.id, r3.id, r1.id, r4.id]);
    });
  });
});
