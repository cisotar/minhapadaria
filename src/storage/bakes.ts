/**
 * bakes.ts — Store CRUD de fornadas em localStorage (spec §6, §10, §14.7).
 *
 * O que faz: persiste `BakeEntry[]` (histórico de produção/vendas §14) sob a
 * chave versionada única `BAKES_STORAGE_KEY` (importada de backup.ts — fonte
 * única; passa a alimentar o backup real da issue 012 sem tocar backup.ts).
 * Oferece list/get/listByRecipe/create/update/remove/replaceAll.
 *
 * Camadas (§1.6): storage NÃO recalcula derivados — isso é do core `bakes.ts`.
 * Persiste o estado CRU (snapshots §14.3 tal-qual). Serializa via JSON nativo
 * (Date→ISO por toJSON) e revive SÓ `date` no load (reviver dirigido por campo,
 * nunca genérico — não coage recipeName/notes do usuário a Date).
 *
 * §14.7: `remove` filtra SÓ por id — NUNCA cascade por recipeId. Excluir uma
 * receita não apaga fornadas; elas ficam órfãs mas íntegras/listáveis.
 *
 * Zero rede, zero secret, sem eval (§10, §11.1, regra de ouro 3). I/O e tempo
 * injetados (clock/newId) — molde exato de recipes.ts (regra de ouro 2).
 * Docs: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 */
import type { BakeEntry } from '../core/types';
import { type StorageLike, defaultStorage } from './local';
import { BAKES_STORAGE_KEY } from './backup';

export interface BakeStoreOptions {
  storage?: StorageLike;
  now?: () => Date;
  newId?: () => string;
}

export interface BakeStore {
  list(): BakeEntry[];
  get(id: string): BakeEntry | undefined;
  listByRecipe(recipeId: string): BakeEntry[];
  create(seed?: Partial<BakeEntry>): BakeEntry;
  update(entry: BakeEntry): BakeEntry;
  remove(id: string): void;
  // Substituição total (restauração de backup, issue 012): preserva id/date crus.
  replaceAll(entries: BakeEntry[]): void;
}

// Default mínimo válido para create(): a semente sobrescreve por cima.
function defaultBake(): Omit<BakeEntry, 'id'> {
  return {
    recipeId: '',
    recipeName: '',
    date: new Date(0),
    quantityProduced: 0,
    quantitySold: 0,
    unitCost: 0,
    unitSalePrice: 0,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// §14.3: revive SÓ `date` para Date (reviver dirigido por campo). Precedente do
// codebase: revivers são locais por módulo (recipes.ts/backup.ts); a chave é
// compartilhada, o reviver não. Strings inválidas viram Date(NaN) sem lançar.
function reviveBakeDate(raw: unknown): BakeEntry | null {
  if (raw === null || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.date === 'string') b.date = new Date(b.date);
  return b as unknown as BakeEntry;
}

export function createBakeStore(opts: BakeStoreOptions = {}): BakeStore {
  const storage = opts.storage ?? defaultStorage();
  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => crypto.randomUUID());

  function readAll(): BakeEntry[] {
    const raw = storage.getItem(BAKES_STORAGE_KEY);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(reviveBakeDate).filter((b): b is BakeEntry => b !== null);
    } catch {
      // JSON corrompido/ausente → lista vazia, sem crash (§10, borda da issue).
      return [];
    }
  }

  function writeAll(entries: BakeEntry[]): void {
    // JSON.stringify serializa Date→ISO via toJSON nativo (sem lib de datas).
    storage.setItem(BAKES_STORAGE_KEY, JSON.stringify(entries));
  }

  function list(): BakeEntry[] {
    return readAll();
  }

  function get(id: string): BakeEntry | undefined {
    return readAll().find((b) => b.id === id);
  }

  function listByRecipe(recipeId: string): BakeEntry[] {
    return readAll().filter((b) => b.recipeId === recipeId);
  }

  function create(seed: Partial<BakeEntry> = {}): BakeEntry {
    // Não muta seed: clona antes de mesclar. `now` só como fallback de data
    // (o caller normalmente informa a data da fornada — §14.3).
    const entry: BakeEntry = {
      ...defaultBake(),
      date: now(),
      ...clone(seed),
      id: newId(),
    };
    const all = readAll();
    all.push(entry);
    writeAll(all);
    return clone(entry); // retorno não é a referência guardada
  }

  function update(entry: BakeEntry): BakeEntry {
    const all = readAll();
    const idx = all.findIndex((b) => b.id === entry.id);
    const next = clone(entry);
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    writeAll(all);
    return clone(next);
  }

  // §14.7: remove SÓ por id — jamais cascade por recipeId. Excluir uma receita
  // (outro store) não passa por aqui: as fornadas permanecem.
  function remove(id: string): void {
    writeAll(readAll().filter((b) => b.id !== id));
  }

  function replaceAll(entries: BakeEntry[]): void {
    writeAll(entries);
  }

  return { list, get, listByRecipe, create, update, remove, replaceAll };
}
