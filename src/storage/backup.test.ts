/**
 * backup.test.ts — Testes (TDD) de backup/restauração em arquivo JSON.
 * Casos 1–12 do Plano Técnico da issue 012 (spec §10, §11.2, decisão 11).
 *
 * Backend: createMemoryStorage() (sem browser; Vitest permanece `node`).
 * Clock injetado para determinismo do `exportedAt` (ISO §7.1).
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './local';
import { createRecipeStore } from './recipes';
import {
  exportBackup,
  importBackup,
  collectBackupData,
  applyBackupData,
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  BAKES_STORAGE_KEY,
} from './backup';
import type { Recipe, BakeEntry } from '../core/types';

const FIXED_ISO = '2026-07-05T00:00:00.000Z';
const fixedClock = () => new Date(FIXED_ISO);

// Duas receitas realistas (estado cru; backup não recalcula — §1.6).
function recipeA(): Recipe {
  return {
    id: 'rec-a',
    name: 'Pão Rústico',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'total',
    flourTotalWeight: 1000,
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
      quantity: 2,
      salePrice: 7.38,
      profitMargin: 40,
      profitPerUnit: 2.95,
      priceInputMode: 'sale-price',
    },
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  };
}

function recipeB(): Recipe {
  return {
    id: 'rec-b',
    name: 'Baguete',
    calculationMode: 'weight-to-percentage',
    batchPlanningMode: 'per-unit',
    flourTotalWeight: 500,
    flourPerUnit: 250,
    ingredients: [],
    sourdough: {
      percentageOfTotalFlour: 15,
      parts: { isca: 1, flour: 7, water: 7 },
      flours: [],
      waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' },
    },
    pricing: {
      quantity: 4,
      salePrice: 5,
      profitMargin: 50,
      profitPerUnit: 2.5,
      priceInputMode: 'margin',
    },
    createdAt: new Date('2026-06-20T08:00:00.000Z'),
    updatedAt: new Date('2026-06-21T08:00:00.000Z'),
  };
}

// BakeEntry golden §12: unitCost 4,43; unitSalePrice 7,38; produzida 2.
function bake(): BakeEntry {
  return {
    id: 'bake-1',
    recipeId: 'rec-a',
    recipeName: 'Pão Rústico',
    date: new Date('2026-07-03T00:00:00.000Z'),
    quantityProduced: 2,
    quantitySold: 2,
    unitCost: 4.43,
    unitSalePrice: 7.38,
  };
}

describe('backup', () => {
  it('1. exportBackup vazio → envelope válido com arrays vazios', () => {
    const json = exportBackup({ recipes: [], bakeHistory: [] }, { now: fixedClock });
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe(BACKUP_APP_ID);
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.recipes).toEqual([]);
    expect(parsed.bakeHistory).toEqual([]);
  });

  it('2. exportBackup com clock injetado → exportedAt ISO exato', () => {
    const json = exportBackup({ recipes: [], bakeHistory: [] }, { now: fixedClock });
    const parsed = JSON.parse(json);
    expect(parsed.exportedAt).toBe(FIXED_ISO);
  });

  it('3. exportBackup não muta o data de entrada (pureza)', () => {
    const data = { recipes: [recipeA()], bakeHistory: [bake()] };
    const before = JSON.stringify(data);
    exportBackup(data, { now: fixedClock });
    expect(JSON.stringify(data)).toBe(before);
  });

  it('4. round-trip: export→import deep-equal; datas revividas como Date', () => {
    const data = { recipes: [recipeA(), recipeB()], bakeHistory: [bake()] };
    const restored = importBackup(exportBackup(data, { now: fixedClock }));
    expect(restored).toEqual(data);
    expect(restored.recipes[0].createdAt).toBeInstanceOf(Date);
    expect(restored.recipes[0].updatedAt).toBeInstanceOf(Date);
    expect(restored.bakeHistory[0].date).toBeInstanceOf(Date);
  });

  it('5. importBackup JSON malformado → throw pt-BR', () => {
    expect(() => importBackup('{oops')).toThrow(
      'Arquivo de backup inválido: não é um JSON válido.',
    );
  });

  it('6. importBackup sem envelope (sem app) → throw pt-BR', () => {
    expect(() => importBackup('{}')).toThrow(
      'Arquivo de backup inválido: não parece um backup do Minha Padaria.',
    );
  });

  it('7. importBackup schemaVersion 99 → throw pt-BR de versão', () => {
    const bad = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: 99,
      exportedAt: FIXED_ISO,
      recipes: [],
      bakeHistory: [],
    });
    expect(() => importBackup(bad)).toThrow(
      'Versão de backup não suportada (esperado 1, recebido 99).',
    );
  });

  it('8. importBackup recipes não-array → throw pt-BR de estrutura corrompida', () => {
    const bad = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      exportedAt: FIXED_ISO,
      recipes: 'nope',
      bakeHistory: [],
    });
    expect(() => importBackup(bad)).toThrow(
      'Arquivo de backup inválido: estrutura de dados corrompida.',
    );
  });

  it('9. applyBackupData substitui total: seed A → aplica B → list() === [B]', () => {
    const storage = createMemoryStorage();
    const store = createRecipeStore({ storage });
    store.create(recipeA());
    applyBackupData({ recipes: [recipeB()], bakeHistory: [] }, { recipeStore: store, storage });
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('rec-b');
    expect(list[0].name).toBe('Baguete');
  });

  it('10. collectBackupData reúne recipes + bakeHistory de mp.bakes.v1', () => {
    const storage = createMemoryStorage();
    const store = createRecipeStore({ storage });
    store.create(recipeA());
    storage.setItem(BAKES_STORAGE_KEY, JSON.stringify([bake()]));
    const data = collectBackupData({ recipeStore: store, storage });
    expect(data.recipes).toHaveLength(1);
    expect(data.recipes[0].name).toBe('Pão Rústico');
    expect(data.bakeHistory).toHaveLength(1);
    expect(data.bakeHistory[0].id).toBe('bake-1');
  });

  it('11. estado intacto: import de JSON inválido lança e list() permanece [A]', () => {
    const storage = createMemoryStorage();
    const store = createRecipeStore({ storage });
    store.create(recipeA());
    expect(() => importBackup('{oops')).toThrow();
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Pão Rústico');
  });

  it('12. bakeHistory ausente → collectBackupData devolve [] sem throw', () => {
    const storage = createMemoryStorage();
    const store = createRecipeStore({ storage });
    let data!: ReturnType<typeof collectBackupData>;
    expect(() => {
      data = collectBackupData({ recipeStore: store, storage });
    }).not.toThrow();
    expect(data.bakeHistory).toEqual([]);
  });
});
