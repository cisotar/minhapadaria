/**
 * pricing.test.ts — Testes de precificação: 3 modos sincronizados por
 * MARKUP-SOBRE-CUSTO (% de lucro), custo unitário, totais e faixas de status
 * (spec §3.E/§4/§5.C/§12 — semântica sobrescrita pela issue 041).
 *
 * Fonte da verdade NOVA (issue 041): `preço = custo × (1 + p/100)`,
 * `lucro = custo × p/100`, `profitMargin = custo > 0 ? (lucro/custo)×100 : 0`.
 * Não há mais teto 99,9% nem clamp (o divisor `1 − m/100` deixou de existir),
 * então `p` é livre em [0, +∞). Guarda de ÷0 em custo 0 nos modos onde o custo é
 * denominador (Preço Fixo / Lucro Fixo). §9: nenhum arredondamento interno.
 *
 * TDD: casos reescritos ANTES da implementação (issue 041).
 */
import { describe, it, expect } from 'vitest';
import {
  MARGIN_MIN,
  effectiveQuantity,
  unitCost,
  priceFromSalePrice,
  priceFromMargin,
  priceFromProfit,
  pricingTotals,
  marginStatus,
  isLoss,
} from './pricing';

describe('unitCost (spec §3.E — CustoTotalReceita / Quantidade)', () => {
  it('1. golden §12: unitCost(8.86, 2) → 4.43', () => {
    expect(unitCost(8.86, 2)).toBeCloseTo(4.43, 9);
  });

  it('2. quantity 0 → clamp para 1, sem ÷0: unitCost(8.86, 0) → 8.86 (§5.C)', () => {
    expect(unitCost(8.86, 0)).toBeCloseTo(8.86, 9);
  });
});

describe('MARGIN_MIN / effectiveQuantity (spec §5.C)', () => {
  it('3a. constante de domínio: MARGIN_MIN=0 (piso; sem teto após issue 041)', () => {
    expect(MARGIN_MIN).toBe(0);
  });

  it('3e. effectiveQuantity: 2→2, 0→1, -3→1 (§5.C: quantidade ≥ 1)', () => {
    expect(effectiveQuantity(2)).toBe(2);
    expect(effectiveQuantity(0)).toBe(1);
    expect(effectiveQuantity(-3)).toBe(1);
  });
});

describe('priceFromMargin (spec §3.E — modo % de lucro / markup sobre custo, issue 041)', () => {
  it('4a. exemplo do cliente: priceFromMargin(5, 20) → {6, 1, 20}', () => {
    const r = priceFromMargin(5, 20);
    expect(r.salePrice).toBeCloseTo(6, 9);
    expect(r.profitPerUnit).toBeCloseTo(1, 9);
    expect(r.profitMargin).toBe(20);
  });

  it('4b. golden §12 recomputado: priceFromMargin(4.43, 40) → {6.202, 1.772, 40}', () => {
    const r = priceFromMargin(4.43, 40);
    expect(r.salePrice).toBeCloseTo(6.202, 6);
    expect(r.profitPerUnit).toBeCloseTo(1.772, 6);
    expect(r.profitMargin).toBe(40);
  });

  it('5. markup alto sem explodir: priceFromMargin(5, 200) → {15, 10, 200} finito', () => {
    const r = priceFromMargin(5, 200);
    expect(r.salePrice).toBeCloseTo(15, 9);
    expect(r.profitPerUnit).toBeCloseTo(10, 9);
    expect(r.profitMargin).toBe(200);
    expect(Number.isFinite(r.salePrice)).toBe(true);
  });
});

describe('priceFromSalePrice (spec §3.E — modo Preço Fixo, denominador CUSTO)', () => {
  it('6. priceFromSalePrice(5, 6) → {profitPerUnit:1, profitMargin:20}', () => {
    const r = priceFromSalePrice(5, 6);
    expect(r.salePrice).toBe(6);
    expect(r.profitPerUnit).toBeCloseTo(1, 9);
    expect(r.profitMargin).toBeCloseTo(20, 9);
  });

  it('7. custo 0 → guarda ÷0: profitMargin 0 (sem NaN), profitPerUnit 6', () => {
    const r = priceFromSalePrice(0, 6);
    expect(r.profitMargin).toBe(0);
    expect(Number.isNaN(r.profitMargin)).toBe(false);
    expect(r.profitPerUnit).toBeCloseTo(6, 9);
  });
});

describe('priceFromProfit (spec §3.E — modo Lucro Fixo, denominador CUSTO)', () => {
  it('8. priceFromProfit(5, 1) → {salePrice:6, profitMargin:20}', () => {
    const r = priceFromProfit(5, 1);
    expect(r.salePrice).toBeCloseTo(6, 9);
    expect(r.profitPerUnit).toBe(1);
    expect(r.profitMargin).toBeCloseTo(20, 9);
  });

  it('8b. custo 0 → guarda ÷0: profitMargin 0 (sem NaN), salePrice 1', () => {
    const r = priceFromProfit(0, 1);
    expect(r.profitMargin).toBe(0);
    expect(Number.isNaN(r.profitMargin)).toBe(false);
    expect(r.salePrice).toBeCloseTo(1, 9);
  });
});

describe('Sincronização dos 3 modos (spec §3.E — mesmo trio produz estado idêntico)', () => {
  it('9. uc 4.43: margin 40 / salePrice 6.202 / profit 1.772 → triples iguais {6.202, 1.772, 40}', () => {
    const uc = 4.43;
    const byMargin = priceFromMargin(uc, 40);
    const bySalePrice = priceFromSalePrice(uc, byMargin.salePrice);
    const byProfit = priceFromProfit(uc, byMargin.profitPerUnit);

    for (const r of [bySalePrice, byProfit]) {
      expect(r.salePrice).toBeCloseTo(byMargin.salePrice, 6);
      expect(r.profitMargin).toBeCloseTo(byMargin.profitMargin, 6);
      expect(r.profitPerUnit).toBeCloseTo(byMargin.profitPerUnit, 6);
    }
    expect(byMargin.salePrice).toBeCloseTo(6.202, 6);
    expect(byMargin.profitPerUnit).toBeCloseTo(1.772, 6);
    expect(byMargin.profitMargin).toBe(40);
  });
});

describe('Guarda de ÷0 nos três modos (§5.C — custo 0, sem NaN/Infinity)', () => {
  it('9b. priceFromMargin(0, 20) → salePrice 0, profitPerUnit 0, profitMargin 20 (custo não é denominador)', () => {
    const r = priceFromMargin(0, 20);
    expect(r.salePrice).toBeCloseTo(0, 9);
    expect(r.profitPerUnit).toBeCloseTo(0, 9);
    expect(r.profitMargin).toBe(20);
    for (const v of [r.salePrice, r.profitPerUnit, r.profitMargin]) {
      expect(Number.isNaN(v)).toBe(false);
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('pricingTotals (spec §3.E / §12 recomputado — issue 041)', () => {
  it('10. pricingTotals(4.43, 6.202, 2) → {8.86, 12.404, 3.544}', () => {
    const r = pricingTotals(4.43, 6.202, 2);
    expect(r.totalProductionCost).toBeCloseTo(8.86, 6);
    expect(r.totalRevenue).toBeCloseTo(12.404, 6);
    expect(r.totalProfit).toBeCloseTo(3.544, 6);
  });

  it('10b. quantity 0 → clamp 1 (sem quebrar totais)', () => {
    const r = pricingTotals(4.43, 6.202, 0);
    expect(r.totalProductionCost).toBeCloseTo(4.43, 9);
    expect(r.totalRevenue).toBeCloseTo(6.202, 9);
  });
});

describe('marginStatus (spec §4 — >30 green; 15–30 yellow; <15/neg red)', () => {
  it('11. faixas literais: 31→green, 30→yellow, 20→yellow, 15→yellow, 10→red, -5→red', () => {
    expect(marginStatus(31)).toBe('green');
    expect(marginStatus(30)).toBe('yellow');
    expect(marginStatus(20)).toBe('yellow');
    expect(marginStatus(15)).toBe('yellow');
    expect(marginStatus(10)).toBe('red');
    expect(marginStatus(-5)).toBe('red');
  });
});

describe('isLoss (spec §5.C/§4 — salePrice ≤ unitCost, break-even inclusivo)', () => {
  it('12. isLoss(4.43, 4)→true; isLoss(4.43, 8)→false; isLoss(4.43, 4.43)→true', () => {
    expect(isLoss(4.43, 4)).toBe(true);
    expect(isLoss(4.43, 8)).toBe(false);
    expect(isLoss(4.43, 4.43)).toBe(true);
  });
});

describe('Pureza (spec §9 — sem arredondamento interno)', () => {
  it('13. priceFromMargin devolve valores crus, não os arredondados de exibição', () => {
    const r = priceFromMargin(4.43, 40);
    expect(r.salePrice).not.toBe(6.2); // §9: valor cru 6.202, format.ts arredonda depois
    expect(r.profitPerUnit).not.toBe(1.77); // valor cru 1.772
  });
});
