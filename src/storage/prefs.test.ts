/**
 * prefs.test.ts — Testes (TDD) do store de preferências globais.
 * Casos 11–13 do Plano Técnico da issue 011 (spec §2.A.2).
 * Toggle "Exibir custos" é global/único (não por receita); default oculto.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './local';
import { createPrefsStore } from './prefs';

describe('prefs store', () => {
  it('11. default getShowCosts() === false (oculto §2.A.2)', () => {
    const store = createPrefsStore({ storage: createMemoryStorage() });
    expect(store.getShowCosts()).toBe(false);
  });

  it('12. setShowCosts(true) persiste em novo store no mesmo backend', () => {
    const backend = createMemoryStorage();
    createPrefsStore({ storage: backend }).setShowCosts(true);
    expect(createPrefsStore({ storage: backend }).getShowCosts()).toBe(true);
  });

  it('13. prefs corrompido → getShowCosts() === false sem throw', () => {
    const backend = createMemoryStorage();
    backend.setItem('mp.prefs.v1', '{oops');
    const store = createPrefsStore({ storage: backend });
    expect(() => store.getShowCosts()).not.toThrow();
    expect(store.getShowCosts()).toBe(false);
  });
});
