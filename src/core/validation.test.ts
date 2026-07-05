/**
 * validation.test.ts — Testes da camada de validação (spec §5.A/§5.B/§5.C/§5.D/§14.6/§7.1).
 *
 * Cobre a tradução dos predicados puros do core em {valid, level, message} pt-BR,
 * distinguindo bloqueio (reverte/impede) de aviso (permite/sinaliza), com null=OK.
 * Um caso por regra da Seção 5, incluindo o golden §12 nas bordas felizes e a
 * garantia de que NENHUMA redistribuição/mutação ocorre (§5.A).
 *
 * TDD: estes 15 casos são escritos ANTES da implementação (issue 010).
 */
import { describe, it, expect } from 'vitest';
import type { SourdoughParts } from './types';
import {
  validatePercentageSum,
  validateFlourCount,
  validateProductQuantity,
  validateNonNegative,
  validateSourdoughParts,
  validateSourdoughFlourPart,
  validateSourdoughProportion,
  validateMargin,
  validatePriceVsUnitCost,
  validatePackageSize,
  validateQuantityProduced,
  validateQuantitySold,
  validateBakeDate,
} from './validation';

describe('validation §5 — camada de mensagens sobre predicados puros', () => {
  // 1. §5.A soma de % (principais)
  it('§5.A: soma 60+50 das farinhas principais bloqueia; 60+40 é OK', () => {
    const bad = validatePercentageSum([60, 50], 'principal');
    expect(bad?.level).toBe('block');
    expect(bad?.valid).toBe(false);
    expect(bad?.message).toBe('A soma das porcentagens das farinhas principais deve ser 100%.');
    expect(validatePercentageSum([60, 40], 'principal')).toBeNull();
  });

  // 2. §5.A soma de % (fermento) — mesma regra, outro rótulo
  it('§5.A: soma das farinhas do fermento usa a mesma regra com rótulo próprio', () => {
    expect(validatePercentageSum([100], 'fermento')).toBeNull();
    const bad = validatePercentageSum([100, 1], 'fermento');
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('A soma das porcentagens das farinhas do fermento deve ser 100%.');
  });

  // 3. §5.B mínimo 1 farinha por grupo
  it('§5.B: 0 farinhas bloqueia; 1 farinha é OK', () => {
    const bad = validateFlourCount(0, 'principal');
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('É necessária ao menos 1 farinha no grupo principal.');
    expect(validateFlourCount(1, 'principal')).toBeNull();
    expect(validateFlourCount(0, 'fermento')?.message).toBe(
      'É necessária ao menos 1 farinha no fermento.',
    );
  });

  // 4. §5.C quantidade de produtos ≥ 1
  it('§5.C: quantidade de produtos 0 bloqueia; 1 é OK', () => {
    const bad = validateProductQuantity(0);
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('A quantidade de produtos deve ser no mínimo 1.');
    expect(validateProductQuantity(1)).toBeNull();
  });

  // 5. §5.C custos/Preço Pago ≥ 0 (genérico)
  it('§5.C: valor negativo bloqueia com o rótulo do campo; 0 é OK', () => {
    const bad = validateNonNegative(-0.01, 'Preço Pago');
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('Preço Pago não pode ser negativo.');
    expect(validateNonNegative(0, 'Preço Pago')).toBeNull();
  });

  // 6. §5.C partes do fermento (reusa isValidSourdoughParts)
  it('§5.C: SomaPartes 0 bloqueia; golden 0:1:1 é OK', () => {
    const zero: SourdoughParts = { isca: 0, flour: 0, water: 0 };
    const bad = validateSourdoughParts(zero);
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe(
      'As partes do fermento não podem ser negativas e a soma deve ser maior que zero.',
    );
    expect(validateSourdoughParts({ isca: 0, flour: 1, water: 1 })).toBeNull();
  });

  // 7. §5.C parte de farinha = 0 → aviso (hidratação "—")
  it('§5.C: parte de farinha 0 avisa (hidratação indefinida); >0 é OK', () => {
    const warn = validateSourdoughFlourPart(0);
    expect(warn?.level).toBe('warn');
    expect(warn?.valid).toBe(true);
    expect(warn?.message).toBe('Parte de farinha do fermento é 0: a hidratação fica indefinida (—).');
    expect(validateSourdoughFlourPart(7)).toBeNull();
  });

  // 8. §5.C proporção do fermento: <0 block, =0 warn, >0 ok
  it('§5.C: proporção negativa bloqueia; 0 avisa; 20 é OK', () => {
    const neg = validateSourdoughProportion(-1);
    expect(neg?.level).toBe('block');
    expect(neg?.message).toBe('A proporção do fermento não pode ser negativa.');
    const zero = validateSourdoughProportion(0);
    expect(zero?.level).toBe('warn');
    expect(zero?.message).toBe('Proporção do fermento é 0%: nenhum fermento será usado.');
    expect(validateSourdoughProportion(20)).toBeNull();
  });

  // 9. §5.C margem 0–99,9 (reusa MARGIN_MIN/MARGIN_MAX)
  it('§5.C: margem 100 bloqueia; 99,9 é OK; -1 bloqueia', () => {
    const high = validateMargin(100);
    expect(high?.level).toBe('block');
    expect(high?.message).toBe('A margem deve estar entre 0% e 99,9%.');
    expect(validateMargin(99.9)).toBeNull();
    expect(validateMargin(-1)?.level).toBe('block');
  });

  // 10. §5.C preço ≤ custo unitário → aviso (reusa isLoss)
  it('§5.C: preço 4 ≤ custo 4,43 avisa (prejuízo); 8 é OK', () => {
    const warn = validatePriceVsUnitCost(4, 4.43);
    expect(warn?.level).toBe('warn');
    expect(warn?.valid).toBe(true);
    expect(warn?.message).toBe('O preço de venda não cobre o custo unitário (prejuízo).');
    expect(validatePriceVsUnitCost(8, 4.43)).toBeNull();
  });

  // 11. §5.C peso/volume do produto > 0
  it('§5.C: peso do produto 0 bloqueia; 1000 é OK', () => {
    const bad = validatePackageSize(0);
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('O peso/volume do produto deve ser maior que zero.');
    expect(validatePackageSize(1000)).toBeNull();
  });

  // 12. §14.6 quantidade produzida ≥ 1
  it('§14.6: quantidade produzida 0 bloqueia; 1 é OK', () => {
    const bad = validateQuantityProduced(0);
    expect(bad?.level).toBe('block');
    expect(bad?.message).toBe('A quantidade produzida deve ser no mínimo 1.');
    expect(validateQuantityProduced(1)).toBeNull();
  });

  // 13. §14.6 vendida ≤ produzida; vendida ≥ 0
  it('§14.6: vendida 10 > produzida 8 bloqueia; 8 ≤ 8 é OK; -1 bloqueia', () => {
    const over = validateQuantitySold(10, 8);
    expect(over?.level).toBe('block');
    expect(over?.message).toBe('A quantidade vendida não pode exceder a produzida.');
    expect(validateQuantitySold(8, 8)).toBeNull();
    const neg = validateQuantitySold(-1, 8);
    expect(neg?.level).toBe('block');
    expect(neg?.message).toBe('A quantidade vendida não pode ser negativa.');
  });

  // 14. §14.6 data futura → aviso "fornada planejada"; hoje/ontem → OK
  it('§14.6: data amanhã avisa (planejada); hoje e ontem são OK', () => {
    const today = new Date(2026, 6, 5);
    const tomorrow = new Date(2026, 6, 6);
    const yesterday = new Date(2026, 6, 4);
    const warn = validateBakeDate(tomorrow, today);
    expect(warn?.level).toBe('warn');
    expect(warn?.valid).toBe(true);
    expect(warn?.message).toBe('Data futura: registrada como fornada planejada.');
    expect(validateBakeDate(today, today)).toBeNull();
    expect(validateBakeDate(yesterday, today)).toBeNull();
  });

  // 15. Pureza (§5.A): nunca muta a entrada nem redistribui.
  it('§5.A: validação não muta arrays/objetos de entrada (sem redistribuição)', () => {
    const percentages = [60, 50];
    validatePercentageSum(percentages, 'principal');
    expect(percentages).toEqual([60, 50]);

    const parts: SourdoughParts = { isca: 0, flour: 0, water: 0 };
    validateSourdoughParts(parts);
    expect(parts).toEqual({ isca: 0, flour: 0, water: 0 });
  });
});
