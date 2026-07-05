/**
 * sourdough.test.ts — Testes da sub-receita do fermento (spec §2.B/§3.B/§5.C +
 * refactor-farinhas-multiplas §5).
 *
 * Cobre: W_ferm como proporção de F_total (§3.B), rateio interno pelo DENOMINADOR
 * GLOBAL Isca + Σproporções-farinhas + Água (refactor §5.3), hidratação SEMPRE
 * derivada = ÁguaFerm ÷ Σ(FarinhaFerm) e null quando indefinida (refactor §5.5),
 * guardas de Σproporções>0 e proporções≥0 (refactor §5.6), distribuição das
 * farinhas do fermento por proporção-share (refactor §5.3).
 * §9: nenhum arredondamento interno — valores crus, precisão total.
 *
 * TDD (refactor fase 2): reescritos ANTES da implementação do novo modelo.
 * AC19 (peso por proporção), AC21 (hidratação), AC22 (modelo novo, golden
 * preservado), AC23 (sem regra somar-100).
 */
import { describe, it, expect } from 'vitest';
import type { SourdoughFlour, SourdoughParts } from './types';
import {
  sourdoughTotalWeight,
  sourdoughFlourProportionSum,
  sourdoughDenominator,
  isValidSourdoughParts,
  computeSourdoughWeights,
  distributeSourdoughFlourWeights,
} from './sourdough';

// Fábrica mínima de SourdoughFlour (só os campos usados pelo core aqui).
function sflour(proportion: number): SourdoughFlour {
  return {
    flourId: `f-${proportion}`,
    name: `farinha ${proportion}`,
    proportion,
    packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'g' },
    weight: 0,
  };
}

describe('sourdoughTotalWeight (spec §3.B — W_ferm = F_total × %/100, reuso)', () => {
  it('1. (1000, 20) → 200 (fermento 20% de 1000g, golden §12)', () => {
    expect(sourdoughTotalWeight(1000, 20)).toBe(200);
  });
});

describe('sourdoughFlourProportionSum (refactor §5.3 — Σ proporções das farinhas)', () => {
  it('2. [1] → 1; [3,1] → 4; [] → 0', () => {
    expect(sourdoughFlourProportionSum([sflour(1)])).toBe(1);
    expect(sourdoughFlourProportionSum([sflour(3), sflour(1)])).toBe(4);
    expect(sourdoughFlourProportionSum([])).toBe(0);
  });
});

describe('sourdoughDenominator (refactor §5.3 — Isca + Σproporções + Água)', () => {
  it('3. isca 0, água 1, farinha 1 → 2; isca 1, água 5, farinhas 3+1 → 10', () => {
    expect(sourdoughDenominator({ isca: 0, water: 1 }, [sflour(1)])).toBe(2);
    expect(
      sourdoughDenominator({ isca: 1, water: 5 }, [sflour(3), sflour(1)]),
    ).toBe(10);
  });
});

describe('computeSourdoughWeights (refactor §5.3/§5.5 — denominador global e hidratação)', () => {
  it('4. golden §12: (1000, 20, isca0/água1, farinha 1) → 200 / 0 / 100 / 100 / H=100% (AC22)', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, water: 1 }, [sflour(1)]),
    ).toEqual({
      totalWeight: 200,
      iscaWeight: 0,
      flourWeight: 100,
      waterWeight: 100,
      hydration: 100,
    });
  });

  it('5. múltiplas farinhas (AC19): isca1/farinhaA3/farinhaB1/água5 → denom 10, pesos por proporção', () => {
    // W_ferm = 20% × 1000 = 200; denom = 1+3+1+5 = 10.
    const r = computeSourdoughWeights(1000, 20, { isca: 1, water: 5 }, [
      sflour(3),
      sflour(1),
    ]);
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.totalWeight).toBe(200);
    expect(r.iscaWeight).toBeCloseTo(200 * 1 / 10, 9); // 20
    expect(r.waterWeight).toBeCloseTo(200 * 5 / 10, 9); // 100
    expect(r.flourWeight).toBeCloseTo(200 * 4 / 10, 9); // FarinhaFerm total = 80
    // hidratação = ÁguaFerm ÷ ΣFarinhaFerm × 100 = 100 / 80 × 100 = 125 (AC21)
    expect(r.hydration).toBeCloseTo(125, 9);
    // aditividade: Isca + FarinhaFerm + ÁguaFerm = W_ferm
    expect(r.iscaWeight + r.flourWeight + r.waterWeight).toBeCloseTo(200, 9);
  });

  it('6. Σproporções-farinhas=0 mas água>0 → flourWeight 0, hydration null (AC21/§5.5)', () => {
    const r = computeSourdoughWeights(1000, 20, { isca: 0, water: 1 }, [sflour(0)]);
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.flourWeight).toBe(0);
    expect(r.waterWeight).toBeGreaterThan(0);
    expect(r.hydration).toBeNull();
  });

  it('7. isca=0 e água=0 permitidos se Σproporções-farinhas>0 (§5.6)', () => {
    const r = computeSourdoughWeights(1000, 20, { isca: 0, water: 0 }, [sflour(1)]);
    expect(r).not.toBeNull();
    if (r === null) return;
    expect(r.totalWeight).toBe(200);
    expect(r.iscaWeight).toBe(0);
    expect(r.waterWeight).toBe(0);
    expect(r.flourWeight).toBe(200); // toda a massa é farinha
    expect(r.hydration).toBe(0); // água 0 ÷ farinha 200 = 0
  });

  it('8. denominador global 0 (0:0 + sem farinhas) → null explícito, sem NaN (§5.6)', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, water: 0 }, []),
    ).toBeNull();
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, water: 0 }, [sflour(0)]),
    ).toBeNull();
  });

  it('9. proporção negativa → null; isValidSourdoughParts false (§5.6)', () => {
    expect(
      computeSourdoughWeights(1000, 20, { isca: 0, water: 1 }, [sflour(-1)]),
    ).toBeNull();
    expect(
      computeSourdoughWeights(1000, 20, { isca: -1, water: 1 }, [sflour(1)]),
    ).toBeNull();
    expect(
      isValidSourdoughParts({ isca: -1, water: 1 }, [sflour(1)]),
    ).toBe(false);
  });
});

describe('isValidSourdoughParts (refactor §5.6 — denom global>0 e proporções≥0)', () => {
  it('10. isca0/água1 + farinha 1 → true; tudo 0 → false', () => {
    expect(isValidSourdoughParts({ isca: 0, water: 1 }, [sflour(1)])).toBe(true);
    expect(isValidSourdoughParts({ isca: 0, water: 0 }, [])).toBe(false);
    expect(isValidSourdoughParts({ isca: 0, water: 0 }, [sflour(0)])).toBe(false);
  });
});

describe('distributeSourdoughFlourWeights (refactor §5.3 — FarinhaFerm_i por proporção-share)', () => {
  it('11. (80, [3, 1]) → [60, 20]', () => {
    expect(
      distributeSourdoughFlourWeights(80, [sflour(3), sflour(1)]),
    ).toEqual([60, 20]);
  });
  it('12. (100, [1, 1]) → [50, 50]', () => {
    expect(
      distributeSourdoughFlourWeights(100, [sflour(1), sflour(1)]),
    ).toEqual([50, 50]);
  });
  it('13. (0, [3, 1]) → [0, 0] (FarinhaFerm=0, sem NaN)', () => {
    expect(
      distributeSourdoughFlourWeights(0, [sflour(3), sflour(1)]),
    ).toEqual([0, 0]);
  });
  it('14. Σproporções=0 → [0, 0] (sem ÷0/NaN)', () => {
    expect(
      distributeSourdoughFlourWeights(80, [sflour(0), sflour(0)]),
    ).toEqual([0, 0]);
  });
});

describe('pureza (spec §1.6)', () => {
  it('15. computeSourdoughWeights não muta parts nem flours de entrada', () => {
    const parts: SourdoughParts = { isca: 1, water: 7 };
    const flours = [sflour(7)];
    const partsSnap = JSON.parse(JSON.stringify(parts));
    const floursSnap = JSON.parse(JSON.stringify(flours));
    computeSourdoughWeights(1000, 31, parts, flours);
    expect(parts).toEqual(partsSnap);
    expect(flours).toEqual(floursSnap);
  });
});
