/**
 * recipes.ts — Store CRUD de receitas em localStorage (spec §2.F, §6, §10).
 *
 * O que faz: persiste `Recipe[]` (estado COMPLETO da receita §2.F: ingredientes,
 * sourdough, modos e precificação) sob uma chave versionada, com list/get/create/
 * update/rename/duplicate/remove. Serializa via JSON (Date→ISO por `toJSON`
 * nativo) e revive SÓ createdAt/updatedAt no load (reviver dirigido por campo —
 * nunca coage strings arbitrárias do usuário a Date).
 *
 * Separação de camadas (§1.6): storage NÃO recalcula derivados — isso é do core
 * `recalculate`. Aqui só serializa/desserializa o estado tal-qual. Zero rede,
 * zero secret (§10, §11.1, regra de ouro 3). Sem `eval`, sem reviver genérico.
 *
 * I/O e tempo são injetados (clock/newId) — nunca `new Date()`/`crypto` no corpo
 * das funções — para determinismo em teste, seguindo a convenção da validation.ts.
 * Docs: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 *
 * Seções implementadas: §2.F (estado completo/duplicação), §6 (modelo Recipe),
 * §10 (persistência local).
 */
import type { Recipe } from '../core/types';
import { type StorageLike, defaultStorage } from './local';

const STORAGE_KEY = 'mp.recipes.v1';

export interface RecipeStoreOptions {
  storage?: StorageLike;
  now?: () => Date;
  newId?: () => string;
}

export interface RecipeStore {
  list(): Recipe[];
  get(id: string): Recipe | undefined;
  create(seed?: Partial<Recipe>): Recipe;
  update(recipe: Recipe): Recipe;
  rename(id: string, name: string): Recipe | undefined;
  duplicate(id: string): Recipe | undefined;
  remove(id: string): void;
  // Substituição total do conjunto (usado pela restauração de backup, issue 012).
  // Preserva id/datas originais das receitas (nunca regenera como create()).
  replaceAll(recipes: Recipe[]): void;
}

// Default válido e mínimo para create(): merge da semente por cima disto.
function defaultRecipe(): Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Nova Receita',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'total',
    flourTotalWeight: 0,
    ingredients: [],
    sourdough: {
      percentageOfTotalFlour: 0,
      parts: { isca: 1, water: 7 }, // refactor §5.3: proporção por linha (farinhas em flours[])
      flours: [],
      waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' },
    },
    pricing: {
      quantity: 1,
      salePrice: 0,
      profitMargin: 0,
      profitPerUnit: 0,
      priceInputMode: 'sale-price',
    },
  };
}

// Clone profundo sem dependência (structuredClone é global no Node 18+/browser).
function clone<T>(value: T): T {
  return structuredClone(value);
}

// §2.F: revive SÓ createdAt/updatedAt para Date (reviver dirigido por campo).
// Nunca aplica reviver genérico do JSON.parse — não coage nome/notas do usuário
// que pareçam ISO. Strings inválidas viram Date(NaN) sem lançar.
function reviveDates(raw: unknown): Recipe | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.createdAt === 'string') r.createdAt = new Date(r.createdAt);
  if (typeof r.updatedAt === 'string') r.updatedAt = new Date(r.updatedAt);
  migrateSourdough(r);
  return r as unknown as Recipe;
}

/**
 * Migração de modelo (refactor farinhas fase 2): receitas salvas no modelo
 * ANTIGO do fermento — `parts {isca, flour, water}` + `flours[].percentage` —
 * carregam sem `proportion`, produzindo NaN no denominador global (isca + Σprop
 * + água) e travando a edição de qualquer proporção ("não podem ser negativas"),
 * além de peso/custo "n/a". Converte para o modelo de proporção por linha
 * PRESERVANDO os pesos: `proporção_i = (percentage_i/100) × parts.flour`;
 * `parts` vira `{isca, water}`. Também coage qualquer `proportion` não-finito a 0
 * (robustez contra JSON corrompido). Idempotente: receitas já no modelo novo
 * passam intactas.
 */
function migrateSourdough(r: Record<string, unknown>): void {
  const sd = r.sourdough as Record<string, unknown> | undefined;
  if (!sd || typeof sd !== 'object') return;
  const parts = sd.parts as Record<string, unknown> | undefined;
  const flours = Array.isArray(sd.flours) ? (sd.flours as Record<string, unknown>[]) : [];
  const hadOldFlourPart = !!parts && typeof parts === 'object' && 'flour' in parts;
  const oldFlourPart = hadOldFlourPart ? Number(parts!.flour) || 0 : 0;

  for (const f of flours) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.proportion !== 'number' || !Number.isFinite(f.proportion)) {
      const pct = typeof f.percentage === 'number' ? f.percentage : 0;
      // Preserva o peso do modelo antigo: prop = (%/100) × parte-farinha.
      f.proportion = hadOldFlourPart ? (pct / 100) * oldFlourPart : 0;
    }
    if ('percentage' in f) delete f.percentage;
  }

  if (parts && typeof parts === 'object') {
    sd.parts = { isca: Number(parts.isca) || 0, water: Number(parts.water) || 0 };
  }
}

export function createRecipeStore(opts: RecipeStoreOptions = {}): RecipeStore {
  const storage = opts.storage ?? defaultStorage();
  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => crypto.randomUUID());

  function readAll(): Recipe[] {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(reviveDates)
        .filter((r): r is Recipe => r !== null);
    } catch {
      // JSON corrompido/ausente → lista vazia, sem crash (§10, borda da issue).
      return [];
    }
  }

  function writeAll(recipes: Recipe[]): void {
    // JSON.stringify serializa Date→ISO via toJSON nativo (sem lib de datas).
    storage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }

  function list(): Recipe[] {
    return readAll();
  }

  function get(id: string): Recipe | undefined {
    return readAll().find((r) => r.id === id);
  }

  function create(seed: Partial<Recipe> = {}): Recipe {
    // Não muta seed: clona a semente antes de mesclar (regra de pureza).
    const timestamp = now();
    const recipe: Recipe = {
      ...defaultRecipe(),
      ...clone(seed),
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const all = readAll();
    all.push(recipe);
    writeAll(all);
    return clone(recipe); // retorno não é a referência guardada
  }

  function update(recipe: Recipe): Recipe {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === recipe.id);
    const next: Recipe = {
      ...clone(recipe),
      // Preserva createdAt original; atualiza updatedAt (§2.F).
      createdAt: idx >= 0 ? all[idx].createdAt : recipe.createdAt,
      updatedAt: now(),
    };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    writeAll(all);
    return clone(next);
  }

  function rename(id: string, name: string): Recipe | undefined {
    const existing = get(id);
    if (!existing) return undefined;
    return update({ ...existing, name });
  }

  function duplicate(id: string): Recipe | undefined {
    const original = get(id);
    if (!original) return undefined;
    // §2.F: cópia integral (deep clone), novo id/nome/datas.
    const copy = clone(original);
    copy.name = `Cópia de ${original.name}`;
    return create(copy); // create gera novo id e datas novas
  }

  function remove(id: string): void {
    writeAll(readAll().filter((r) => r.id !== id));
  }

  // Extensão mínima para a restauração de backup (issue 012): delega ao mesmo
  // writeAll (Date→ISO nativo), preservando id/datas do arquivo importado.
  function replaceAll(recipes: Recipe[]): void {
    writeAll(recipes);
  }

  return { list, get, create, update, rename, duplicate, remove, replaceAll };
}
