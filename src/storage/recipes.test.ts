/**
 * recipes.test.ts — Testes (TDD) do store de receitas em localStorage.
 * Casos 1–10 do Plano Técnico da issue 011 (spec §2.F, §10).
 *
 * Backend: createMemoryStorage() (sem browser; Vitest permanece `node`).
 * Dependências de I/O/tempo injetadas (clock/newId) para determinismo.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './local';
import { createRecipeStore } from './recipes';
import type { Recipe } from '../core/types';

// Semente parcial realista (não precisa ser a golden §12 completa; o store
// só serializa/desserializa estado, não recalcula). Cobre modos + pricing.
function seed(): Partial<Recipe> {
  return {
    name: 'Pão Rústico',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'per-unit',
    flourTotalWeight: 1000,
    flourPerUnit: 500,
    ingredients: [
      {
        id: 'ing-1',
        name: 'Farinha de Trigo',
        category: 'flour',
        weight: 1000,
        percentage: 100,
        packageCost: { pricePaid: 25, packageSize: 5, packageUnit: 'kg' },
      },
    ],
    sourdough: {
      percentageOfTotalFlour: 20,
      parts: { isca: 1, flour: 7, water: 7 },
      flours: [],
      waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' },
    },
    pricing: {
      quantity: 10,
      salePrice: 12,
      profitMargin: 50,
      profitPerUnit: 6,
      priceInputMode: 'sale-price',
    },
  };
}

// Clock determinístico: cada leitura avança 1 dia, garantindo updatedAt > createdAt.
function makeClock(startISO: string) {
  let t = new Date(startISO).getTime();
  return () => {
    const d = new Date(t);
    t += 24 * 60 * 60 * 1000;
    return d;
  };
}

// Gerador de id determinístico.
function makeIds() {
  let n = 0;
  return () => `id-${++n}`;
}

function makeStore(storage = createMemoryStorage()) {
  return createRecipeStore({
    storage,
    now: makeClock('2026-07-05T00:00:00.000Z'),
    newId: makeIds(),
  });
}

describe('recipes store', () => {
  it('1. create → list tem 1; get deep-equal; datas são Date', () => {
    const store = makeStore();
    const r = store.create(seed());
    expect(store.list()).toHaveLength(1);
    const got = store.get(r.id);
    expect(got).toEqual(r);
    expect(got!.createdAt).toBeInstanceOf(Date);
    expect(got!.updatedAt).toBeInstanceOf(Date);
    expect(got!.name).toBe('Pão Rústico');
  });

  it('2. round-trip de datas: novo store no mesmo backend revive Date', () => {
    const backend = createMemoryStorage();
    const store = makeStore(backend);
    const r = store.create(seed());
    const store2 = makeStore(backend);
    const got = store2.get(r.id)!;
    expect(got.createdAt).toBeInstanceOf(Date);
    expect(got.updatedAt).toBeInstanceOf(Date);
    expect(got.createdAt.getTime()).toBe(r.createdAt.getTime());
    expect(got.updatedAt.getTime()).toBe(r.updatedAt.getTime());
  });

  it("3. pricing.priceInputMode='margin' sobrevive save→load", () => {
    const backend = createMemoryStorage();
    const store = makeStore(backend);
    const s = seed();
    s.pricing = { ...s.pricing!, priceInputMode: 'margin' };
    const r = store.create(s);
    const got = makeStore(backend).get(r.id)!;
    expect(got.pricing.priceInputMode).toBe('margin');
  });

  it('4. duplicate → id novo, nome "Cópia de X", resto deep-equal, datas novas', () => {
    const store = makeStore();
    const orig = store.create(seed());
    const copy = store.duplicate(orig.id)!;
    expect(copy.id).not.toBe(orig.id);
    expect(copy.name).toBe('Cópia de Pão Rústico');
    expect(copy.ingredients).toEqual(orig.ingredients);
    expect(copy.sourdough).toEqual(orig.sourdough);
    expect(copy.pricing).toEqual(orig.pricing);
    expect(copy.calculationMode).toBe(orig.calculationMode);
    expect(copy.batchPlanningMode).toBe(orig.batchPlanningMode);
    expect(copy.flourPerUnit).toBe(orig.flourPerUnit);
    expect(copy.createdAt.getTime()).toBeGreaterThan(orig.createdAt.getTime());
    // deep clone: mutar cópia não afeta original
    copy.ingredients[0].weight = 999;
    expect(store.get(orig.id)!.ingredients[0].weight).toBe(1000);
    expect(store.list()).toHaveLength(2);
  });

  it('5. update altera campo e updatedAt; createdAt inalterado', () => {
    const store = makeStore();
    const r = store.create(seed());
    const updated = store.update({ ...r, name: 'Novo Nome' });
    expect(updated.name).toBe('Novo Nome');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(r.updatedAt.getTime());
    expect(updated.createdAt.getTime()).toBe(r.createdAt.getTime());
    expect(store.get(r.id)!.name).toBe('Novo Nome');
  });

  it('6. rename muda name e updatedAt; demais campos intactos', () => {
    const store = makeStore();
    const r = store.create(seed());
    const renamed = store.rename(r.id, 'Renomeado')!;
    expect(renamed.name).toBe('Renomeado');
    expect(renamed.updatedAt.getTime()).toBeGreaterThan(r.updatedAt.getTime());
    expect(renamed.ingredients).toEqual(r.ingredients);
    expect(renamed.createdAt.getTime()).toBe(r.createdAt.getTime());
    expect(store.rename('inexistente', 'x')).toBeUndefined();
  });

  it('7. remove → some de list; get → undefined', () => {
    const store = makeStore();
    const r = store.create(seed());
    store.remove(r.id);
    expect(store.list()).toHaveLength(0);
    expect(store.get(r.id)).toBeUndefined();
  });

  it('8. lixo no storage → list()=[] sem throw; get=undefined', () => {
    const backend = createMemoryStorage();
    backend.setItem('mp.recipes.v1', '{oops');
    const store = makeStore(backend);
    expect(() => store.list()).not.toThrow();
    expect(store.list()).toEqual([]);
    expect(store.get('x')).toBeUndefined();
  });

  it('9. chave ausente → list()=[]', () => {
    const store = makeStore();
    expect(store.list()).toEqual([]);
    expect(store.get('x')).toBeUndefined();
  });

  it('10. pureza: create não muta seed; retorno não é a referência guardada', () => {
    const store = makeStore();
    const s = seed();
    const before = JSON.stringify(s);
    const r = store.create(s);
    expect(JSON.stringify(s)).toBe(before); // seed intacto
    expect(s).not.toHaveProperty('id');
    // mutar o retorno não afeta o store
    r.name = 'mutado';
    r.ingredients[0].weight = 1;
    const got = store.get(r.id)!;
    expect(got.name).toBe('Pão Rústico');
    expect(got.ingredients[0].weight).toBe(1000);
    expect(store.duplicate('inexistente')).toBeUndefined();
  });
});
