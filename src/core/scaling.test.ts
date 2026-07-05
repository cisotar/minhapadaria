/**
 * scaling.test.ts — Testes do escalonamento por peso alvo + fornada por unidade
 * (spec §1.6/§2.E.1/§3.D/§12, decisões 3 e 16). TDD: escritos ANTES da
 * implementação (RED → GREEN).
 *
 * Cobre:
 *  1. recipeSumPercent(golden) = 192 (fermento ENTRA — decisão 3; ≠ 172).
 *  2. recipeSumPercent com fermento 0 = 172.
 *  3. scaledFlourTotal(golden, 2000) = 1041,6667 (§3.D passo 2).
 *  4. applyTargetScaling + recalculate: pesos escalonados batem o alvo (§3.D passo 3).
 *  5. Per-unit sem escalonamento: F_total derivado = flourPerUnit × N (§2.E.1).
 *  6. Per-unit + escalonamento: ajusta flourPerUnit mantendo N (§2.E.1).
 *  7–8. Guards de alvo/soma inválidos → null (§5.C, contrato null≠0).
 *  9. applyTargetScaling em peso→% → null (§3.D só %→peso).
 * 10. Pureza: applyTargetScaling não muta a entrada (§1.6).
 *
 * §9: sem arredondamento no core — comparações cruas com toBeCloseTo(_, 9).
 */
import { describe, it, expect } from 'vitest';
import { recipeSumPercent, scaledFlourTotal, applyTargetScaling } from './scaling';
import { recalculate } from './recalc';
import type { Recipe, PackageCost } from './types';

function pkg(pricePaid: number, packageSize: number, packageUnit: PackageCost['packageUnit']): PackageCost {
  return { pricePaid, packageSize, packageUnit };
}

const FREE_WATER: PackageCost = pkg(0, 1, 'L'); // torneira R$0,00/L

/** Recipe do exemplo validado §12, modo %→peso, estado puro (mesmo padrão de recalc.test). */
function goldenRecipe(): Recipe {
  return {
    id: 'r1',
    name: 'Pão §12',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'total',
    flourTotalWeight: 1000,
    ingredients: [
      { id: 'f1', name: 'Farinha Branca', category: 'flour', weight: 0, percentage: 100, packageCost: pkg(8, 1, 'kg') },
      { id: 'a1', name: 'Água', category: 'liquid', weight: 0, percentage: 70, packageCost: FREE_WATER },
      { id: 's1', name: 'Sal', category: 'salt', weight: 0, percentage: 2, packageCost: pkg(3, 1, 'kg') },
    ],
    sourdough: {
      percentageOfTotalFlour: 20,
      parts: { isca: 0, flour: 1, water: 1 },
      flours: [
        { flourId: 'sf1', name: 'Farinha Branca', percentage: 100, weight: 0, packageCost: pkg(8, 1, 'kg') },
      ],
      waterPackageCost: FREE_WATER,
    },
    pricing: {
      quantity: 2,
      salePrice: 0,
      profitMargin: 40,
      profitPerUnit: 0,
      priceInputMode: 'margin',
    },
    createdAt: new Date('2026-07-05T00:00:00Z'),
    updatedAt: new Date('2026-07-05T00:00:00Z'),
  };
}

/** Golden em modo fornada por unidade: flourPerUnit 250 × N 4 = F_total 1000 (§2.E.1). */
function perUnitRecipe(): Recipe {
  const r = goldenRecipe();
  r.batchPlanningMode = 'per-unit';
  r.flourPerUnit = 250;
  r.flourTotalWeight = 0; // derivado em per-unit (não é fonte de verdade)
  r.pricing.quantity = 4; // N
  return r;
}

describe('recipeSumPercent (§3.D passo 1, decisão 3)', () => {
  it('1. inclui o fermento na soma: golden = 192 (não 172)', () => {
    expect(recipeSumPercent(goldenRecipe())).toBeCloseTo(192, 9);
    expect(recipeSumPercent(goldenRecipe())).not.toBeCloseTo(172, 9);
  });

  it('2. fermento 0% → soma = Σ ingredientes = 172', () => {
    const r = goldenRecipe();
    r.sourdough.percentageOfTotalFlour = 0;
    expect(recipeSumPercent(r)).toBeCloseTo(172, 9);
  });
});

describe('scaledFlourTotal (§3.D passo 2)', () => {
  it('3. F_nova = alvo / (soma/100): 2000 / 1,92 ≈ 1041,6667', () => {
    expect(scaledFlourTotal(goldenRecipe(), 2000)).toBeCloseTo(1041.6666667, 6);
  });

  it('7. alvo ≤ 0 → null (guarda §5.C, contrato null≠0)', () => {
    expect(scaledFlourTotal(goldenRecipe(), 0)).toBeNull();
    expect(scaledFlourTotal(goldenRecipe(), -5)).toBeNull();
  });

  it('8. soma = 0 (sem ingredientes e fermento 0) → null', () => {
    const r = goldenRecipe();
    r.ingredients = [];
    r.sourdough.percentageOfTotalFlour = 0;
    expect(recipeSumPercent(r)).toBeCloseTo(0, 9);
    expect(scaledFlourTotal(r, 2000)).toBeNull();
  });
});

describe('applyTargetScaling (§3.D ação explícita, §1.6)', () => {
  it('4. escala F_total e, via recalculate, os pesos batem o alvo 2000g', () => {
    const scaled = applyTargetScaling(goldenRecipe(), 2000);
    expect(scaled).not.toBeNull();
    expect(scaled!.flourTotalWeight).toBeCloseTo(1041.6666667, 6);
    const { state } = recalculate(scaled!);
    const farinha = state.ingredients.find((i) => i.id === 'f1')!;
    const agua = state.ingredients.find((i) => i.id === 'a1')!;
    const sal = state.ingredients.find((i) => i.id === 's1')!;
    expect(farinha.weight).toBeCloseTo(1041.6666667, 6);
    expect(agua.weight).toBeCloseTo(729.1666667, 6);
    expect(sal.weight).toBeCloseTo(20.8333333, 6);
    expect(state.sourdough.totalWeight).toBeCloseTo(208.3333333, 6);
  });

  it('6. per-unit: escalona flourPerUnit mantendo N; F_total derivado bate o alvo', () => {
    const scaled = applyTargetScaling(perUnitRecipe(), 2000);
    expect(scaled).not.toBeNull();
    expect(scaled!.pricing.quantity).toBe(4); // N inalterado (§2.E.1)
    expect(scaled!.flourPerUnit).toBeCloseTo(260.4166667, 6); // 1041,6667 / 4
    const { state } = recalculate(scaled!);
    expect(state.flourTotalWeight).toBeCloseTo(1041.6666667, 6);
  });

  it('9. peso→% → null (escalonamento por alvo só em %→peso, §3.D)', () => {
    const r = goldenRecipe();
    r.calculationMode = 'weight-to-percentage';
    expect(applyTargetScaling(r, 2000)).toBeNull();
  });

  it('9b. alvo/soma inválidos propagam null (sem throw)', () => {
    expect(applyTargetScaling(goldenRecipe(), 0)).toBeNull();
    const zero = goldenRecipe();
    zero.ingredients = [];
    zero.sourdough.percentageOfTotalFlour = 0;
    expect(applyTargetScaling(zero, 2000)).toBeNull();
  });

  it('10. não muta a Recipe de entrada (clona, §1.6)', () => {
    const input = goldenRecipe();
    const snapshot = structuredClone(input);
    applyTargetScaling(input, 2000);
    expect(input).toStrictEqual(snapshot);
  });
});

describe('fornada por unidade — recalculate deriva F_total (§2.E.1)', () => {
  it('5. per-unit sem escalonamento: F_total = flourPerUnit × N; pesos idênticos ao golden', () => {
    const { state, summary } = recalculate(perUnitRecipe());
    expect(state.flourTotalWeight).toBeCloseTo(1000, 9); // 250 × 4 (derivado)
    const farinha = state.ingredients.find((i) => i.id === 'f1')!;
    const agua = state.ingredients.find((i) => i.id === 'a1')!;
    const sal = state.ingredients.find((i) => i.id === 's1')!;
    expect(farinha.weight).toBeCloseTo(1000, 9);
    expect(agua.weight).toBeCloseTo(700, 9);
    expect(sal.weight).toBeCloseTo(20, 9);
    expect(summary.hydration.nominal).toBeCloseTo(70, 9);
    expect(summary.hydration.real).toBeCloseTo(72.7272727, 6);
  });
});
