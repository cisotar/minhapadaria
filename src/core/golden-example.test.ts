/**
 * golden-example.test.ts — Teste dourado permanente (spec §12).
 *
 * O que faz: fixa o gabarito do exemplo validado da Seção 12 como contrato
 * permanente da suíte. Enquanto o recalc engine (issue 008) não existir, este
 * teste FALHA de propósito, sinalizando que o produto ainda não foi implementado.
 *
 * Gabarito da §12 (a substituir por asserts reais contra o engine):
 *   - Custo total ............... R$ 8,86
 *   - Hidratação Nominal ........ 70%
 *   - Hidratação Real ........... 72,7%
 *   - Farinha Real Consumida .... 1100 g
 *   - Soma da Receita ........... 192%
 *   - F_nova_total p/ 2000 g .... 1041,7 g
 */
import { describe, it, expect } from 'vitest';

describe('golden example (spec §12)', () => {
  it('exemplo dourado da spec §12 — engine ainda não implementado', () => {
    // TODO issue 008/020: substituir por asserts reais contra o recalc engine (spec §12).
    // Falha determinística até o engine existir.
    expect(false).toBe(true);
  });
});
