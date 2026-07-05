/**
 * bakers.test.ts — Testes da convenção de padeiro (baker's percentage).
 *
 * Cobre spec §1.1/§1.2 (farinha total = âncora 100%; tudo deriva dela),
 * §2.A.2 (linha do fermento é genérica, sem caso especial), §3.A (fórmulas
 * diretas e inversa; F_total = Σ pesos das farinhas principais) e §5.C
 * (divisão por zero tratada). §9: nenhum arredondamento interno — funções
 * devolvem number cru, precisão total.
 *
 * TDD: estes 20 casos são escritos ANTES da implementação (issue 003).
 */
import { describe, it, expect } from 'vitest';
import type { Ingredient } from './types';
import {
  flourTotal,
  weightFromPercentage,
  percentageFromWeight,
  flourPercentagesSumTo100,
} from './bakers';

// Fábrica mínima de Ingredient para os testes (só os campos usados pelo core).
function ing(
  category: Ingredient['category'],
  weight: number,
  percentage: number,
): Ingredient {
  return {
    id: `${category}-${weight}-${percentage}`,
    name: category,
    category,
    weight,
    percentage,
    packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'g' },
  };
}

describe('flourTotal (spec §3.A — Σ pesos das farinhas principais)', () => {
  it('1. uma farinha 1000g → 1000', () => {
    expect(flourTotal([ing('flour', 1000, 100)])).toBe(1000);
  });
  it('2. duas farinhas 800g + 200g → 1000', () => {
    expect(flourTotal([ing('flour', 800, 80), ing('flour', 200, 20)])).toBe(1000);
  });
  it('3. lista vazia → 0 (borda, sem farinha)', () => {
    expect(flourTotal([])).toBe(0);
  });
  it('4. ignora não-farinhas: farinha 1000 + água 700 + sal 20 → 1000', () => {
    expect(
      flourTotal([
        ing('flour', 1000, 100),
        ing('liquid', 700, 70),
        ing('salt', 20, 2),
      ]),
    ).toBe(1000);
  });
});

describe('weightFromPercentage (spec §1.1/§1.2/§2.A.2 — Peso = F_total × %/100)', () => {
  it('5. (1000, 70) → 700 (água §12)', () => {
    expect(weightFromPercentage(1000, 70)).toBe(700);
  });
  it('6. (1000, 2) → 20 (sal §12)', () => {
    expect(weightFromPercentage(1000, 2)).toBe(20);
  });
  it('7. (1000, 20) → 200 (fermento como linha genérica, §2.A.2)', () => {
    expect(weightFromPercentage(1000, 20)).toBe(200);
  });
  it('8. (1000, 100) → 1000 (farinha única travada, §2.A)', () => {
    expect(weightFromPercentage(1000, 100)).toBe(1000);
  });
  it('9. duas farinhas 80/20 de 1000g → 800 e 200', () => {
    expect(weightFromPercentage(1000, 80)).toBe(800);
    expect(weightFromPercentage(1000, 20)).toBe(200);
  });
  it('10. (0, 70) → 0 (F_total=0, sem divisão por zero)', () => {
    expect(weightFromPercentage(0, 70)).toBe(0);
  });
});

describe('percentageFromWeight (spec §3.A/§5.C — inverso com guarda)', () => {
  it('11. (700, 1000) → 70 (inverso §3.A)', () => {
    expect(percentageFromWeight(700, 1000)).toBe(70);
  });
  it('12. inverso 80/20 (transição §1.5): (800,1000)→80 e (200,1000)→20', () => {
    expect(percentageFromWeight(800, 1000)).toBe(80);
    expect(percentageFromWeight(200, 1000)).toBe(20);
  });
  it('13. (700, 0) → 0 (guarda divisão por zero §5.C, não Infinity/NaN)', () => {
    expect(percentageFromWeight(700, 0)).toBe(0);
  });
  it('14. (0, 0) → 0 (borda dupla)', () => {
    expect(percentageFromWeight(0, 0)).toBe(0);
  });
});

describe('flourPercentagesSumTo100 (spec §1.1/§2.A — predicado puro)', () => {
  it('15. farinha única 100% → true (§2.A)', () => {
    expect(flourPercentagesSumTo100([ing('flour', 1000, 100)])).toBe(true);
  });
  it('16. 80/20 → true', () => {
    expect(
      flourPercentagesSumTo100([ing('flour', 800, 80), ing('flour', 200, 20)]),
    ).toBe(true);
  });
  it('17. 80/30 → false (soma 110 ≠ 100, acusa)', () => {
    expect(
      flourPercentagesSumTo100([ing('flour', 800, 80), ing('flour', 300, 30)]),
    ).toBe(false);
  });
  it('18. 33,33/33,33/33,34 → true (epsilon anti-drift IEEE-754)', () => {
    expect(
      flourPercentagesSumTo100([
        ing('flour', 333.3, 33.33),
        ing('flour', 333.3, 33.33),
        ing('flour', 333.4, 33.34),
      ]),
    ).toBe(true);
  });
});

describe('pureza e precisão total (spec §1.6/§9)', () => {
  it('19. não muta o Ingredient[] de entrada (snapshot igual)', () => {
    const input = [ing('flour', 800, 80), ing('flour', 200, 20)];
    const snapshot = JSON.parse(JSON.stringify(input));
    flourTotal(input);
    flourPercentagesSumTo100(input);
    expect(input).toEqual(snapshot);
  });
  it('20. sem arredondamento interno: (1000, 72.7272727) → 727.272727 cru', () => {
    expect(weightFromPercentage(1000, 72.7272727)).toBe(727.272727);
  });
});
