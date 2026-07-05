/**
 * bakers.ts — Convenção de padeiro (baker's percentage), núcleo puro.
 *
 * O que faz: implementa as fórmulas da farinha-âncora (spec §1.1/§1.2/§3.A).
 * A farinha total (F_total) é a âncora 100%; todo peso deriva dela por
 * percentual, e o inverso recupera o percentual a partir do peso (transição
 * de modo, §1.5). A linha do fermento é tratada como qualquer outra linha
 * (§2.A.2) — sem caso especial.
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - Valor canônico sempre em gramas (§7); funções operam sobre Ingredient[].
 *  - SEM arredondamento interno (§9): retorna number cru, precisão total.
 *    format.ts (camada de exibição) NÃO é importado aqui, de propósito.
 *  - Sem mutação do array de entrada (recalc parte do estado puro, §1.6).
 *  - Divisão por zero tratada (§5.C).
 *
 * Seções implementadas: §1.1, §1.2, §1.5, §2.A.2, §3.A, §5.C.
 */
import type { Ingredient } from './types';

/**
 * Predicado genérico: uma lista de percentuais soma exatamente 100%.
 * Dono único da tolerância anti-drift IEEE-754 (SUM_EPSILON) — reusado pelo
 * predicado de farinhas principais (§1.1/§2.A) e pelas farinhas do fermento
 * (§2.B.3, sourdough.ts). NÃO é arredondamento de valor (§9): 80+20 é exato;
 * 33,33+33,33+33,34 pode driftar e precisa da tolerância.
 */
export function percentagesSumTo100(percentages: readonly number[]): boolean {
  const SUM_EPSILON = 1e-9;
  const sum = percentages.reduce((acc, p) => acc + p, 0);
  return Math.abs(sum - 100) < SUM_EPSILON;
}

/**
 * F_total = Σ pesos das farinhas principais (category 'flour'). §1.1, §3.A, §1.5.
 * As farinhas do fermento são sub-receita (§2.B) e não têm category 'flour' na
 * lista principal, logo não entram nesta soma (correto por §3.A).
 */
export function flourTotal(ingredients: readonly Ingredient[]): number {
  return ingredients
    .filter((i) => i.category === 'flour')
    .reduce((sum, i) => sum + i.weight, 0);
}

/**
 * Peso derivado de percentual: Peso_X = F_total × %_X / 100. §1.1, §1.2, §3.A.
 * Genérica para farinha, não-farinha e a linha do fermento (§2.A.2).
 * F_total=0 devolve 0 naturalmente (0 × qualquer), sem guarda extra.
 */
export function weightFromPercentage(flourTotal: number, percentage: number): number {
  return (flourTotal * percentage) / 100;
}

/**
 * Inverso: %_X = (Peso_X / F_total) × 100. §3.A (modo peso→%, transição §1.5).
 * Guarda de divisão por zero (§5.C): F_total <= 0 → 0 (evita Infinity/NaN e
 * cobre valor negativo indevido). Retorno number, mantém a assinatura limpa
 * para o recalc em lote da issue 008.
 */
export function percentageFromWeight(weight: number, flourTotal: number): number {
  if (flourTotal <= 0) return 0; // §5.C
  return (weight / flourTotal) * 100;
}

/**
 * Predicado puro: a soma das % das farinhas principais é exatamente 100%.
 * §1.1, §2.A. Apenas reporta — bloqueio/UI-blur é das issues 010/014.
 * Epsilon anti-drift IEEE-754 (SUM_EPSILON), não caixa de arredondamento.
 */
export function flourPercentagesSumTo100(ingredients: readonly Ingredient[]): boolean {
  const flourPercentages = ingredients
    .filter((i) => i.category === 'flour')
    .map((i) => i.percentage);
  return percentagesSumTo100(flourPercentages);
}
