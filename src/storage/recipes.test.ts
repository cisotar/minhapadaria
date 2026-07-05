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
      parts: { isca: 1, water: 7 }, // refactor §5.3
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

  // Migração do modelo antigo do fermento (refactor farinhas fase 2): receitas
  // salvas antes do refactor têm `parts {isca,flour,water}` + `flours[].percentage`
  // e carregam sem `proportion` → NaN no denominador global → edição travada e
  // peso/custo "n/a". `migrateSourdough` (readAll) converte preservando os pesos.
  function oldModelRecipe(): unknown {
    return {
      id: 'old-1',
      name: 'Antiga',
      calculationMode: 'percentage-to-weight',
      batchPlanningMode: 'per-unit',
      flourTotalWeight: 1000,
      ingredients: [],
      pricing: { quantity: 1, salePrice: 0, profitMargin: 40, profitPerUnit: 0, priceInputMode: 'margin' },
      sourdough: {
        percentageOfTotalFlour: 20,
        parts: { isca: 1, flour: 2, water: 2 }, // modelo ANTIGO (tem `flour`)
        flours: [
          { flourId: 'f1', name: 'Branca', percentage: 60, packageCost: { pricePaid: 8, packageSize: 1, packageUnit: 'kg' }, weight: 0 },
          { flourId: 'f2', name: 'Integral', percentage: 40, packageCost: { pricePaid: 12, packageSize: 1, packageUnit: 'kg' }, weight: 0 },
        ],
        waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('11. migração: modelo antigo (parts.flour + percentage) → proporção por linha, preservando pesos', () => {
    const backend = createMemoryStorage();
    backend.setItem('mp.recipes.v1', JSON.stringify([oldModelRecipe()]));
    const got = makeStore(backend).get('old-1')!;
    // `parts` perde `flour`, vira {isca, water}
    expect(got.sourdough.parts).toEqual({ isca: 1, water: 2 });
    expect(got.sourdough.parts).not.toHaveProperty('flour');
    // proporção = (%/100) × parte-farinha-antiga(2): 60%→1,2; 40%→0,8 (Σ=2=parte antiga)
    expect(got.sourdough.flours[0].proportion).toBeCloseTo(1.2);
    expect(got.sourdough.flours[1].proportion).toBeCloseTo(0.8);
    // `percentage` removido; nenhuma proporção undefined/NaN
    expect(got.sourdough.flours[0]).not.toHaveProperty('percentage');
    expect(Number.isFinite(got.sourdough.flours[0].proportion)).toBe(true);
    // denominador global finito e > 0 (isca1 + 1,2 + 0,8 + água2 = 5) — sem NaN
    const denom =
      got.sourdough.parts.isca + got.sourdough.flours.reduce((s, f) => s + f.proportion, 0) + got.sourdough.parts.water;
    expect(denom).toBeCloseTo(5);
  });

  it('12. migração é defensiva/idempotente: proporção ausente → 0; modelo novo passa intacto', () => {
    const backend = createMemoryStorage();
    // (a) proporção ausente e sem percentage → 0 (robustez); (b) modelo novo intacto
    const missingProp = { ...(oldModelRecipe() as Record<string, unknown>), id: 'm' } as any;
    delete missingProp.sourdough.parts.flour; // sem parte-farinha antiga
    missingProp.sourdough.parts.isca = 1;
    missingProp.sourdough.parts.water = 1;
    missingProp.sourdough.flours = [{ flourId: 'z', name: '', packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' }, weight: 0 }]; // sem proportion nem percentage
    const already = { ...(oldModelRecipe() as Record<string, unknown>), id: 'n' } as any;
    already.sourdough.parts = { isca: 1, water: 1 };
    already.sourdough.flours = [{ flourId: 'a', name: 'Nova', proportion: 3, packageCost: { pricePaid: 5, packageSize: 1, packageUnit: 'kg' }, weight: 0 }];
    backend.setItem('mp.recipes.v1', JSON.stringify([missingProp, already]));
    const store = makeStore(backend);
    expect(store.get('m')!.sourdough.flours[0].proportion).toBe(0); // ausente → 0
    expect(store.get('n')!.sourdough.flours[0].proportion).toBe(3); // novo intacto
    expect(store.get('n')!.sourdough.parts).toEqual({ isca: 1, water: 1 });
  });
});
