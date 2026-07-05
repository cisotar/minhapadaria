/**
 * hydration.test.ts — Testes de hidratação nominal/real e Farinha Real
 * Consumida (spec §2.C/§2.D/§12, decisão 15).
 *
 * Cobre: soma de líquidos somente category 'liquid' com 'fat' fora (§2.C,
 * decisão 15), hidratação nominal = ΣLíquidos/F_total×100 (§2.C), hidratação
 * real incluindo Água/Farinha do fermento (§2.C), Farinha Real Consumida =
 * F_total + FarinhaFerm (§2.D) e guardas de ÷0 devolvendo null/0 sem NaN (§5.C).
 * §9: nenhum arredondamento interno — comparação crua (o real 72,7272…% NÃO é 72,73).
 *
 * TDD: estes 14 casos são escritos ANTES da implementação (issue 005).
 */
import { describe, it, expect } from 'vitest';
import type { Ingredient } from './types';
import type { SourdoughWeights } from './sourdough';
import {
  declaredLiquidsWeight,
  nominalHydration,
  realHydration,
  realFlourConsumed,
} from './hydration';

// Fábrica mínima de Ingredient para os testes (só os campos usados pelo core).
function ing(category: Ingredient['category'], weight: number): Ingredient {
  return {
    id: `${category}-${weight}`,
    name: category,
    category,
    weight,
    percentage: 0,
    packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'g' },
  };
}

// Fábrica mínima de SourdoughWeights (só flourWeight/waterWeight importam aqui).
function sw(flourWeight: number, waterWeight: number): SourdoughWeights {
  return {
    totalWeight: flourWeight + waterWeight,
    iscaWeight: 0,
    flourWeight,
    waterWeight,
    hydration: flourWeight === 0 ? null : (waterWeight / flourWeight) * 100,
  };
}

describe('declaredLiquidsWeight (spec §2.C — Σ pesos somente category liquid)', () => {
  it('1. [água 700 liquid] → 700', () => {
    expect(declaredLiquidsWeight([ing('liquid', 700)])).toBe(700);
  });

  it('2. [água 700 liquid, azeite 40 fat] → 700 (fat excluído, decisão 15)', () => {
    expect(declaredLiquidsWeight([ing('liquid', 700), ing('fat', 40)])).toBe(700);
  });

  it('3. [leite 300, cerveja 200, água 100 — todos liquid] → 600', () => {
    expect(
      declaredLiquidsWeight([ing('liquid', 300), ing('liquid', 200), ing('liquid', 100)]),
    ).toBe(600);
  });

  it('4. [só farinha/sal, sem liquid] → 0', () => {
    expect(declaredLiquidsWeight([ing('flour', 1000), ing('salt', 20)])).toBe(0);
  });
});

describe('nominalHydration (spec §2.C — ΣLíquidos / F_total × 100)', () => {
  it('5. golden §12: água 700 liquid + farinha 1000 flour → 70', () => {
    expect(nominalHydration([ing('liquid', 700), ing('flour', 1000)])).toBe(70);
  });

  it('6. água 700 liquid + azeite 40 fat + farinha 1000 → 70 (fat fora)', () => {
    expect(
      nominalHydration([ing('liquid', 700), ing('fat', 40), ing('flour', 1000)]),
    ).toBe(70);
  });

  it('7. F_total=0 (sem flour) → null, sem NaN (§5.C)', () => {
    expect(nominalHydration([ing('liquid', 700)])).toBeNull();
  });
});

describe('realHydration (spec §2.C — (ΣLíquidos+ÁguaFerm)/(F_total+FarinhaFerm)×100)', () => {
  it('8. golden §12: liquids 700, farinha 1000, {flour:100,water:100} → 72,7272…% cru', () => {
    const r = realHydration([ing('liquid', 700), ing('flour', 1000)], sw(100, 100));
    expect(r).toBeCloseTo(72.7272, 3);
    expect(r).not.toBe(72.73); // §9: não arredonda internamente
  });

  it('9. sourdough=null (liquids 700, farinha 1000) → 70 (Real=Nominal)', () => {
    expect(realHydration([ing('liquid', 700), ing('flour', 1000)], null)).toBe(70);
  });

  it('10. F_total=0 e sourdough=null → null, sem NaN (§5.C)', () => {
    expect(realHydration([ing('liquid', 700)], null)).toBeNull();
  });

  it('11. F_total=0, {flour:100,water:100}, sem líquidos → 100 (denominador>0, sem NaN)', () => {
    expect(realHydration([], sw(100, 100))).toBeCloseTo(100, 9);
  });
});

describe('realFlourConsumed (spec §2.D — F_total + FarinhaFerm)', () => {
  it('12. golden §12: farinha 1000, {flour:100} → 1100', () => {
    expect(realFlourConsumed([ing('flour', 1000)], sw(100, 100))).toBe(1100);
  });

  it('13. farinha 1000, sourdough=null → 1000', () => {
    expect(realFlourConsumed([ing('flour', 1000)], null)).toBe(1000);
  });

  it('14. F_total=0, sourdough=null → 0', () => {
    expect(realFlourConsumed([], null)).toBe(0);
  });
});
