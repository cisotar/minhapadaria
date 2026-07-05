/**
 * pricing.test.ts — Testes de precificação: 3 modos sincronizados, clamp de
 * margem (0–99,9%), custo unitário, totais e faixas de status (spec §3.E/§4/§5.C/§12,
 * decisão 4).
 *
 * Cobre: CustoUnitário = CustoTotalReceita/Qtd com guarda de ÷0 (§3.E/§5.C),
 * os três modos de entrada (Preço Fixo, Margem%, Lucro Fixo) convergindo para o
 * mesmo trio {salePrice, profitMargin, profitPerUnit} (§3.E), clamp de margem a
 * [0, 99.9] sem Infinity/NaN (§5.C, decisão 4), totais (§3.E — resolução da
 * inconsistência: totalProductionCost = unitCost×Qtd, golden §12 fonte da verdade),
 * faixas de status 30/15 (§4) e flag de prejuízo inclusiva (§5.C).
 * §9: nenhum arredondamento interno — comparação crua (7,3833… NÃO é 7,38).
 *
 * TDD: estes casos são escritos ANTES da implementação (issue 007).
 */
import { describe, it, expect } from 'vitest';
import {
  MARGIN_MIN,
  MARGIN_MAX,
  clampMargin,
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

describe('clampMargin / effectiveQuantity (spec §5.C, decisão 4)', () => {
  it('3a. constantes de domínio: MARGIN_MIN=0, MARGIN_MAX=99.9', () => {
    expect(MARGIN_MIN).toBe(0);
    expect(MARGIN_MAX).toBe(99.9);
  });

  it('3b. clampMargin(40) → 40 (dentro da faixa)', () => {
    expect(clampMargin(40)).toBe(40);
  });

  it('3c. clampMargin(100) → 99.9 (teto, decisão 4)', () => {
    expect(clampMargin(100)).toBe(99.9);
  });

  it('3d. clampMargin(-5) → 0 (piso, §5.C)', () => {
    expect(clampMargin(-5)).toBe(0);
  });

  it('3e. effectiveQuantity: 2→2, 0→1, -3→1 (§5.C: quantidade ≥ 1)', () => {
    expect(effectiveQuantity(2)).toBe(2);
    expect(effectiveQuantity(0)).toBe(1);
    expect(effectiveQuantity(-3)).toBe(1);
  });
});

describe('priceFromMargin (spec §3.E — modo Margem%, decisão 4)', () => {
  it('4. golden §12: priceFromMargin(4.43, 40) → {7.3833, 2.9533, 40}', () => {
    const r = priceFromMargin(4.43, 40);
    expect(r.salePrice).toBeCloseTo(7.3833, 3);
    expect(r.profitPerUnit).toBeCloseTo(2.9533, 3);
    expect(r.profitMargin).toBe(40);
  });

  it('5. margem 100 → clamp 99.9: salePrice≈4430 finito, sem Infinity', () => {
    const r = priceFromMargin(4.43, 100);
    expect(r.salePrice).toBeCloseTo(4430, 3);
    expect(Number.isFinite(r.salePrice)).toBe(true);
    expect(r.profitMargin).toBe(99.9);
  });
});

describe('priceFromSalePrice (spec §3.E — modo Preço Fixo)', () => {
  it('6. priceFromSalePrice(4, 10) → {profitMargin:60, profitPerUnit:6}', () => {
    const r = priceFromSalePrice(4, 10);
    expect(r.salePrice).toBe(10);
    expect(r.profitMargin).toBeCloseTo(60, 9);
    expect(r.profitPerUnit).toBeCloseTo(6, 9);
  });

  it('7. salePrice 0 → guarda ÷0: profitMargin 0 (sem NaN), profitPerUnit -4.43', () => {
    const r = priceFromSalePrice(4.43, 0);
    expect(r.profitMargin).toBe(0);
    expect(Number.isNaN(r.profitMargin)).toBe(false);
    expect(r.profitPerUnit).toBeCloseTo(-4.43, 9);
  });
});

describe('priceFromProfit (spec §3.E — modo Lucro Fixo)', () => {
  it('8. priceFromProfit(4.43, 3) → salePrice 7.43, profitMargin≈40.377', () => {
    const r = priceFromProfit(4.43, 3);
    expect(r.salePrice).toBeCloseTo(7.43, 9);
    expect(r.profitPerUnit).toBe(3);
    expect(r.profitMargin).toBeCloseTo(40.377, 3);
  });
});

describe('Sincronização dos 3 modos (spec §3.E — mesmo trio produz estado idêntico)', () => {
  it('9. unitCost 4.43 alimentado por margin 40 / salePrice 7.3833… / profit 2.9533… → triples iguais', () => {
    const uc = 4.43;
    const byMargin = priceFromMargin(uc, 40);
    const bySalePrice = priceFromSalePrice(uc, byMargin.salePrice);
    const byProfit = priceFromProfit(uc, byMargin.profitPerUnit);

    for (const r of [bySalePrice, byProfit]) {
      expect(r.salePrice).toBeCloseTo(byMargin.salePrice, 6);
      expect(r.profitMargin).toBeCloseTo(byMargin.profitMargin, 6);
      expect(r.profitPerUnit).toBeCloseTo(byMargin.profitPerUnit, 6);
    }
  });
});

describe('pricingTotals (spec §3.E / §12 — trava a resolução da inconsistência)', () => {
  it('10. pricingTotals(4.43, 7.3833…, 2) → {8.86, 14.7666, 5.9066}', () => {
    const r = pricingTotals(4.43, 7.383333333333333, 2);
    expect(r.totalProductionCost).toBeCloseTo(8.86, 4);
    expect(r.totalRevenue).toBeCloseTo(14.7666, 3);
    expect(r.totalProfit).toBeCloseTo(5.9066, 3);
  });

  it('10b. quantity 0 → clamp 1 (sem quebrar totais)', () => {
    const r = pricingTotals(4.43, 7.38, 0);
    expect(r.totalProductionCost).toBeCloseTo(4.43, 9);
    expect(r.totalRevenue).toBeCloseTo(7.38, 9);
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
    expect(r.salePrice).not.toBe(7.38); // §9: format.ts arredonda depois
    expect(r.profitPerUnit).not.toBe(2.95);
  });
});
