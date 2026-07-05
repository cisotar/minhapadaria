/**
 * bakes.test.ts — Testes (TDD) do store CRUD de fornadas em localStorage.
 * Casos 16–22 do Plano Técnico da issue 013 (spec §6, §10, §14.7).
 *
 * Backend: createMemoryStorage() (sem browser; Vitest permanece `node`).
 * Clock/newId injetados para determinismo. Molde: recipes.test.ts (regra de ouro 2).
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './local';
import { createBakeStore } from './bakes';
import { createRecipeStore } from './recipes';
import { BAKES_STORAGE_KEY } from './backup';
import type { BakeEntry } from '../core/types';

function seed(overrides: Partial<BakeEntry> = {}): Partial<BakeEntry> {
  return {
    recipeId: 'r1',
    recipeName: 'Pão Rústico',
    date: new Date(2026, 6, 5), // 2026-07-05 (local)
    quantityProduced: 10,
    quantitySold: 8,
    unitCost: 4.43,
    unitSalePrice: 7.38,
    ...overrides,
  };
}

function makeIds() {
  let n = 0;
  return () => `bake-${++n}`;
}

function makeStore(storage = createMemoryStorage()) {
  return createBakeStore({ storage, newId: makeIds() });
}

describe('bakes store', () => {
  it('16. create → list tem 1; get deep-equal; date é Date', () => {
    const store = makeStore();
    const b = store.create(seed());
    expect(store.list()).toHaveLength(1);
    const got = store.get(b.id);
    expect(got).toEqual(b);
    expect(got!.date).toBeInstanceOf(Date);
    expect(got!.recipeName).toBe('Pão Rústico');
  });

  it('17. round-trip: novo store no mesmo backend revive date como Date', () => {
    const backend = createMemoryStorage();
    const b = makeStore(backend).create(seed());
    const got = makeStore(backend).get(b.id)!;
    expect(got.date).toBeInstanceOf(Date);
    expect(got.date.getTime()).toBe(b.date.getTime());
  });

  it('18. update altera campo e persiste; remove some da lista', () => {
    const store = makeStore();
    const b = store.create(seed());
    const updated = store.update({ ...b, quantitySold: 5 });
    expect(updated.quantitySold).toBe(5);
    expect(store.get(b.id)!.quantitySold).toBe(5);
    store.remove(b.id);
    expect(store.list()).toHaveLength(0);
    expect(store.get(b.id)).toBeUndefined();
  });

  it('19. listByRecipe filtra por recipeId', () => {
    const store = makeStore();
    store.create(seed({ recipeId: 'r1' }));
    store.create(seed({ recipeId: 'r2' }));
    store.create(seed({ recipeId: 'r1' }));
    expect(store.listByRecipe('r1')).toHaveLength(2);
    expect(store.listByRecipe('r2')).toHaveLength(1);
    expect(store.listByRecipe('zzz')).toEqual([]);
  });

  it('20. órfã (§14.7): excluir receita NÃO remove a fornada; snapshot intacto', () => {
    const backend = createMemoryStorage();
    const recipeStore = createRecipeStore({ storage: backend, newId: makeIds() });
    const bakeStore = createBakeStore({ storage: backend, newId: makeIds() });
    const recipe = recipeStore.create({ name: 'Pão Rústico' });
    const b = bakeStore.create(seed({ recipeId: recipe.id, recipeName: 'Pão Rústico' }));
    recipeStore.remove(recipe.id); // sem cascade
    const survivors = bakeStore.list();
    expect(survivors).toHaveLength(1);
    expect(survivors[0].id).toBe(b.id);
    expect(survivors[0].recipeName).toBe('Pão Rústico'); // snapshot preservado
    expect(recipeStore.list()).toHaveLength(0);
  });

  it('21. lixo no storage / chave ausente → list()=[] sem throw', () => {
    const backend = createMemoryStorage();
    backend.setItem(BAKES_STORAGE_KEY, '{oops');
    const store = makeStore(backend);
    expect(() => store.list()).not.toThrow();
    expect(store.list()).toEqual([]);
    const fresh = makeStore(); // chave ausente
    expect(fresh.list()).toEqual([]);
    expect(fresh.get('x')).toBeUndefined();
  });

  it('22. pureza: create não muta seed; retorno não é a referência guardada', () => {
    const store = makeStore();
    const s = seed();
    const before = JSON.stringify(s);
    const b = store.create(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(s).not.toHaveProperty('id');
    b.recipeName = 'mutado';
    b.quantityProduced = 1;
    const got = store.get(b.id)!;
    expect(got.recipeName).toBe('Pão Rústico');
    expect(got.quantityProduced).toBe(10);
  });
});
