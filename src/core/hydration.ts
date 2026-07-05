/**
 * hydration.ts — Hidratação nominal/real e Farinha Real Consumida, núcleo puro
 * (spec §2.C/§2.D/§12, decisão 15).
 *
 * O que faz: painéis informativos do padeiro. A hidratação NOMINAL considera só
 * os líquidos declarados sobre a farinha-âncora F_total (§2.C). A hidratação
 * REAL soma a Água e a Farinha do fermento (sub-receita) para refletir a massa
 * de fato (§2.C). A Farinha Real Consumida é F_total + Farinha do Fermento (§2.D).
 * A gordura (category 'fat') NÃO hidrata — fica fora das duas contas (§2.C,
 * decisão 15) — mas entra em peso/custo em outras issues (§2.A).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - Valor canônico sempre em gramas (§7); SEM arredondamento interno (§9):
 *    o real 72,7272…% é devolvido cru (format.ts NÃO é importado aqui).
 *  - Sem mutação da entrada (recalc parte do estado puro, §1.6).
 *  - Divisão por zero tratada sem NaN/Infinity (§5.C): denominador 0 → null.
 *
 * Seções implementadas: §2.C, §2.D, §12, decisão 15.
 */
import type { Ingredient } from './types';
import type { SourdoughWeights } from './sourdough';
// Reuso (regra de ouro #1/#2): F_total é dono único da soma das farinhas
// principais (bakers.ts, §3.A) — não reimplementar aqui. A Água/Farinha do
// fermento vêm prontas de computeSourdoughWeights (sourdough.ts, issue 004);
// este módulo apenas consome, não recalcula rateio.
import { flourTotal } from './bakers';

/**
 * ΣLíquidos = Σ pesos das linhas category 'liquid'. §2.C, decisão 15.
 * 'fat' (e 'salt'/'extra') ficam de fora — não hidratam.
 */
export function declaredLiquidsWeight(ingredients: readonly Ingredient[]): number {
  return ingredients
    .filter((i) => i.category === 'liquid') // §2.C: só líquidos declarados
    .reduce((sum, i) => sum + i.weight, 0);
}

/**
 * Hidratação Nominal = ΣLíquidos / F_total × 100. §2.C.
 * F_total=0 → null (§5.C): estado explícito, sem NaN/Infinity.
 */
export function nominalHydration(ingredients: readonly Ingredient[]): number | null {
  const fTotal = flourTotal(ingredients); // §3.A (reuso bakers.ts)
  if (fTotal === 0) return null; // §5.C
  return (declaredLiquidsWeight(ingredients) / fTotal) * 100; // §2.C
}

/**
 * Hidratação Real = (ΣLíquidos + ÁguaFerm) / (F_total + FarinhaFerm) × 100. §2.C.
 * sourdough=null (sem fermento ou Partes inválidas, §5.C) → ÁguaFerm=FarinhaFerm=0,
 * logo Real = Nominal. Denominador 0 → null (§5.C), sem NaN.
 */
export function realHydration(
  ingredients: readonly Ingredient[],
  sourdough: SourdoughWeights | null,
): number | null {
  const fTotal = flourTotal(ingredients); // §3.A (reuso bakers.ts)
  const flourFerm = sourdough?.flourWeight ?? 0; // Farinha do Fermento (§2.B)
  const waterFerm = sourdough?.waterWeight ?? 0; // Água do Fermento (§2.B)
  const denominator = fTotal + flourFerm; // §2.C: Farinha Real Consumida como base
  if (denominator === 0) return null; // §5.C
  return ((declaredLiquidsWeight(ingredients) + waterFerm) / denominator) * 100; // §2.C
}

/**
 * Farinha Real Consumida = F_total + FarinhaFerm. §2.D.
 * sourdough=null → só F_total (que pode ser 0, sem NaN).
 */
export function realFlourConsumed(
  ingredients: readonly Ingredient[],
  sourdough: SourdoughWeights | null,
): number {
  return flourTotal(ingredients) + (sourdough?.flourWeight ?? 0); // §2.D
}
