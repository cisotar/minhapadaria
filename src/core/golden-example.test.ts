/**
 * golden-example.test.ts — Teste dourado permanente (spec §12), ponta a ponta
 * via o engine central `recalculate` (issue 008).
 *
 * O que faz: fixa o gabarito do exemplo validado da Seção 12 como contrato
 * permanente da suíte, exercido por UMA chamada de `recalculate` sobre o estado
 * puro (§1.6) — sem realimentar valores derivados/arredondados (§9).
 *
 * Gabarito §12:
 *   - F_total 1000 · Fermento 200 (Isca 0 / FarinhaFerm 100 / ÁguaFerm 100) ·
 *     H_ferm 100% · Farinha Real Consumida 1100 · Custo total R$ 8,86 ·
 *     Hidratação Nominal 70% · Hidratação Real ≈ 72,7273%.
 *   - Precificação recomputada para markup-sobre-custo (% de lucro, issue 041):
 *     2 unidades, 40% de lucro sobre o MESMO custo unitário 4,43.
 *     preço = 4,43 × 1,40 = 6,202 · lucro = 4,43 × 0,40 = 1,772 · profitMargin 40 ·
 *     custo total produção = 4,43 × 2 = 8,86 · receita = 6,202 × 2 = 12,404 ·
 *     lucro total = 12,404 − 8,86 = 3,544 (= 1,772 × 2). Substitui os números do
 *     §12 antigo (margem-sobre-preço: 7,3833 / 2,9533 / 14,7666 / 5,9066).
 */
import { describe, it, expect } from 'vitest';
import { recalculate } from './recalc';
import type { Recipe, PackageCost } from './types';

function pkg(pricePaid: number, packageSize: number, packageUnit: PackageCost['packageUnit']): PackageCost {
  return { pricePaid, packageSize, packageUnit };
}
const FREE_WATER: PackageCost = pkg(0, 1, 'kg');

function goldenRecipe(): Recipe {
  return {
    id: 'golden',
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
      // refactor §5.3: proporção por linha. Isca 0, farinha 1, água 1 → denom 2,
      // preserva o golden §12 (FarinhaFerm 100 / ÁguaFerm 100 / H 100%).
      percentageOfTotalFlour: 20,
      parts: { isca: 0, water: 1 },
      flours: [
        { flourId: 'sf1', name: 'Farinha Branca', proportion: 1, weight: 0, packageCost: pkg(8, 1, 'kg') },
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

describe('golden example (spec §12) — ponta a ponta via recalculate', () => {
  const { state, summary } = recalculate(goldenRecipe());

  it('pesos e fermento: F_total 1000, W_ferm 200, Isca 0, FarinhaFerm/ÁguaFerm 100/100, H_ferm 100%', () => {
    expect(state.flourTotalWeight).toBeCloseTo(1000, 9);
    expect(state.sourdough.totalWeight).toBeCloseTo(200, 9);
    expect(state.sourdough.iscaWeight).toBeCloseTo(0, 9);
    expect(state.sourdough.flourWeight).toBeCloseTo(100, 9);
    expect(state.sourdough.waterWeight).toBeCloseTo(100, 9);
    expect(state.sourdough.hydration).toBeCloseTo(100, 9);
  });

  it('hidratação e farinha real: nominal 70%, real ≈72,7273%, Farinha Real Consumida 1100', () => {
    expect(summary.hydration.nominal).toBeCloseTo(70, 10);
    expect(summary.hydration.real).toBeCloseTo(72.72727, 4);
    expect(summary.realFlourConsumed).toBeCloseTo(1100, 9);
  });

  it('custo total da receita = R$ 8,86 (exato via soma compensada)', () => {
    expect(summary.totalCost).toBeCloseTo(8.86, 2);
  });

  it('precificação (2 un, 40% de lucro/markup): unit 4,43 · preço 4,43×1,40=6,202 · lucro 4,43×0,40=1,772', () => {
    expect(summary.costPerUnit).toBeCloseTo(4.43, 9);
    expect(summary.salePrice).toBeCloseTo(6.202, 6);
    expect(summary.profitPerUnit).toBeCloseTo(1.772, 6);
    expect(summary.profitMargin).toBeCloseTo(40, 9);
  });

  it('totais: custo produção 4,43×2=8,86 · receita 6,202×2=12,404 · lucro 12,404−8,86=3,544', () => {
    expect(summary.totalProductionCost).toBeCloseTo(8.86, 6);
    expect(summary.totalRevenue).toBeCloseTo(12.404, 6);
    expect(summary.totalProfit).toBeCloseTo(3.544, 6);
  });
});
