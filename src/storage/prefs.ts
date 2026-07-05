/**
 * prefs.ts — Preferências globais persistidas (spec §2.A.2, §10).
 *
 * O que faz: persiste o toggle "Exibir custos" — preferência GLOBAL e única do
 * app (§2.A.2), não pertencente a nenhuma receita — sob chave versionada.
 * Default oculto (`false`): a UI abre sem expor custos até o usuário optar.
 * JSON corrompido/ausente → default `false`, sem crash. Zero rede, zero secret
 * (§10, §11.1, regra de ouro 3); sem `eval`.
 *
 * Seções implementadas: §2.A.2 (toggle custos), §10 (persistência local).
 */
import { type StorageLike, defaultStorage } from './local';

const STORAGE_KEY = 'mp.prefs.v1';

interface Prefs {
  showCosts: boolean;
}

const DEFAULTS: Prefs = { showCosts: false }; // §2.A.2: custos ocultos por padrão

export interface PrefsStoreOptions {
  storage?: StorageLike;
}

export interface PrefsStore {
  getShowCosts(): boolean;
  setShowCosts(value: boolean): void;
}

export function createPrefsStore(opts: PrefsStoreOptions = {}): PrefsStore {
  const storage = opts.storage ?? defaultStorage();

  function read(): Prefs {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULTS };
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') return { ...DEFAULTS };
      const showCosts = (parsed as Record<string, unknown>).showCosts;
      return { showCosts: typeof showCosts === 'boolean' ? showCosts : DEFAULTS.showCosts };
    } catch {
      // JSON corrompido → default oculto, sem crash (§2.A.2, §10).
      return { ...DEFAULTS };
    }
  }

  function getShowCosts(): boolean {
    return read().showCosts;
  }

  function setShowCosts(value: boolean): void {
    const next: Prefs = { ...read(), showCosts: value };
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { getShowCosts, setShowCosts };
}
