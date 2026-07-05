/**
 * local.ts — Abstração mínima de armazenamento local (spec §10).
 *
 * O que faz: define `StorageLike` (subconjunto de 3 métodos da Web Storage API)
 * usado por recipes.ts/prefs.ts, um stub em memória para testes/fallback SSR-safe,
 * e o acesso ao `localStorage` real (única amarração ao browser da camada storage).
 *
 * Por que interface própria em vez de happy-dom/jsdom (regra de ouro 1/2/4):
 * o módulo usa só getItem/setItem/removeItem; um stub de poucas linhas cobre os
 * testes sem nova devDependency e mantém a suíte core pura/rápida em `node`.
 * Docs oficiais consultadas:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 * - https://vitest.dev/guide/environment (ambiente `node` é o default)
 *
 * Seções implementadas: §10 (persistência 100% local; zero rede, zero secret).
 */

/** Subconjunto da Web Storage API efetivamente usado pela camada storage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Storage em memória (Map). Usado pelos testes e como fallback quando não há
 * `localStorage` (ex.: ambiente sem window). Nunca acessa rede nem disco.
 */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Retorna o `localStorage` do browser quando disponível; caso contrário um
 * storage em memória (SSR-safe). Única amarração ao browser desta camada.
 */
export function defaultStorage(): StorageLike {
  const g = globalThis as { localStorage?: StorageLike };
  return g.localStorage ?? createMemoryStorage();
}
