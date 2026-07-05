/**
 * sourdough.test.ts — Testes da sub-receita do fermento (spec §2.B/§3.B/§5.C).
 *
 * Cobre: W_ferm como proporção de F_total (§3.B), rateio interno por Partes
 * Isca:Farinha:Água (§2.B.2), hidratação SEMPRE derivada e null quando
 * indefinida (§2.B/§5.C), guardas de SomaPartes>0 e partes≥0 (§5.C),
 * distribuição das farinhas do fermento (§3.B) e predicado soma-100 (§2.B.3).
 * §9: nenhum arredondamento interno — valores crus, precisão total.
 *
 * TDD: estes 12 casos são escritos ANTES da implementação (issue 004).
 */
import { describe, it, expect } from 'vitest';
import type { SourdoughFlour, SourdoughParts } from './types';
import {
  sourdoughTotalWeight,
  partsSum,
  isValidSourdoughParts,
  computeSourdoughWeights,
  distributeSourdoughFlourWeights,
  sourdoughFlourPercentagesSumTo100,
} from './sourdough';

// Fábrica mínima de SourdoughFlour (só os campos usados pelo core aqui).
function sflour(percentage: number): SourdoughFlour {
  return {
    flourId: `f-${percentage}`,
    name: `farinha ${percentage}`,
    percentage,
    packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'g' },
    weight: 0,
  };
}

describe('sourdoughTotalWeight (spec §3.B — W_ferm = F_total × %/100, reuso)', () => {
  it('1. (1000, 20) → 200 (fermento 20% de 1000g, golden §12)', () => {
    expect(sourdoughTotalWeight(1000, 20)).toBe(200);
  });
});

describe('partsSum (spec §2.B.2 — Isca + Farinha + Água)', () => {
  it('2. 0:1:1 → 2 e 1:7:7 → 15', () => {
    expect(partsSum({ isca: 0, flour: 1, water: 1 })).toBe(2);
    expect(partsSum({ isca: 1, flour: 7, water: 7 })).toBe(15);
  });
});

describe('computeSourdoughWeights (spec §3.B — rateio e hidratação derivada)', () => {
  it('3. golden §12: (1000, 20, 0:1:1) → 200 / 0 / 100 / 100 / H=100%', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, flour: 1, water: 1 }),
    ).toEqual({
      totalWeight: 200,
      iscaWeight: 0,
      flourWeight: 100,
      waterWeight: 100,
      hydration: 100,
    });
  });

  it('4. §2.B.2 (1000, 31, 1:7:7) → valores puros e aditividade W_ferm', () => {
    const r = computeSourdoughWeights(1000, 31, { isca: 1, flour: 7, water: 7 });
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.totalWeight).toBe(310);
    expect(r.iscaWeight).toBeCloseTo(310 / 15, 6);
    expect(r.flourWeight).toBeCloseTo((310 * 7) / 15, 6);
    expect(r.waterWeight).toBeCloseTo((310 * 7) / 15, 6);
    expect(r.hydration).toBeCloseTo(100, 9);
    // aditividade §3.B: Isca + FarinhaFerm + ÁguaFerm = W_ferm
    expect(r.iscaWeight + r.flourWeight + r.waterWeight).toBeCloseTo(310, 9);
  });

  it('5. parte_farinha=0 (1:0:1) → flourWeight 0, waterWeight>0, hydration null (§5.C)', () => {
    const r = computeSourdoughWeights(1000, 20, { isca: 1, flour: 0, water: 1 });
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.flourWeight).toBe(0);
    expect(r.waterWeight).toBeGreaterThan(0);
    expect(r.hydration).toBeNull();
  });

  it('6. SomaPartes=0 (0:0:0) → null explícito, sem NaN (§5.C)', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, flour: 0, water: 0 }),
    ).toBeNull();
  });

  it('7. parte negativa (-1:1:1) → null; isValidSourdoughParts false (§5.C)', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: -1, flour: 1, water: 1 }),
    ).toBeNull();
    expect(isValidSourdoughParts({ isca: -1, flour: 1, water: 1 })).toBe(false);
  });
});

describe('isValidSourdoughParts (spec §5.C — SomaPartes>0 e partes≥0)', () => {
  it('8. 0:1:1 → true; 0:0:0 → false', () => {
    expect(isValidSourdoughParts({ isca: 0, flour: 1, water: 1 })).toBe(true);
    expect(isValidSourdoughParts({ isca: 0, flour: 0, water: 0 })).toBe(false);
  });
});

describe('distributeSourdoughFlourWeights (spec §3.B — FarinhaFerm_i = FarinhaFerm × P_i/100)', () => {
  it('9. (100, [50, 50]) → [50, 50]', () => {
    expect(
      distributeSourdoughFlourWeights(100, [sflour(50), sflour(50)]),
    ).toEqual([50, 50]);
  });
  it('10. (0, [50, 50]) → [0, 0] (FarinhaFerm=0, sem NaN)', () => {
    expect(
      distributeSourdoughFlourWeights(0, [sflour(50), sflour(50)]),
    ).toEqual([0, 0]);
  });
});

describe('sourdoughFlourPercentagesSumTo100 (spec §2.B.3 — via percentagesSumTo100)', () => {
  it('11. [100]→true, [50,50]→true, [50,40]→false, drift [33.33,33.33,33.34]→true', () => {
    expect(sourdoughFlourPercentagesSumTo100([sflour(100)])).toBe(true);
    expect(sourdoughFlourPercentagesSumTo100([sflour(50), sflour(50)])).toBe(true);
    expect(sourdoughFlourPercentagesSumTo100([sflour(50), sflour(40)])).toBe(false);
    expect(
      sourdoughFlourPercentagesSumTo100([sflour(33.33), sflour(33.33), sflour(33.34)]),
    ).toBe(true);
  });
});

describe('pureza (spec §1.6)', () => {
  it('12. computeSourdoughWeights não muta o objeto parts de entrada', () => {
    const parts: SourdoughParts = { isca: 1, flour: 7, water: 7 };
    const snapshot = JSON.parse(JSON.stringify(parts));
    computeSourdoughWeights(1000, 31, parts);
    expect(parts).toEqual(snapshot);
  });
});
