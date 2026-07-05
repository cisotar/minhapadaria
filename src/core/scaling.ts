/**
 * scaling.ts — Escalonamento por peso alvo + fornada por unidade, núcleo puro
 * (spec §1.6/§2.E.1/§3.D/§12, decisões 3 e 16).
 *
 * O que faz: implementa a ÚNICA ação não-imediata do app (§1.6) — o
 * escalonamento explícito da receita para um peso de massa alvo (§3.D). NÃO é
 * reação de edição de campo: é uma ação distinta que o caller dispara e cujo
 * resultado (uma Recipe pura, nova âncora) o caller re-alimenta em `recalculate`
 * (que aplica o passo 3 do §3.D via bakers.weightFromPercentage — não duplicado
 * aqui). Suporta as duas âncoras da fornada (§2.E.1): 'total' (grava
 * flourTotalWeight) e 'per-unit' (grava flourPerUnit mantendo N).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem rede, sem arredondamento
 *    (§9 é exibição-apenas). Pasta core/.
 *  - Não muta a Recipe de entrada (clona; §1.6).
 *  - Sem throw: alvo/soma inválidos fluem como `null` (contrato null≠0 das
 *    issues 004–008), nunca 0/NaN. Escalonamento indisponível fora de %→peso.
 *  - Reuso máximo (regra de ouro #1/#2): o passo 3 (Novo Peso_X = F_nova × %/100)
 *    é bakers.weightFromPercentage via recalculate; N segue effectiveQuantity.
 *
 * Seções implementadas: §1.6, §2.E.1, §3.D, §12, decisões 3 e 16.
 */
import type { Recipe } from './types';
import { effectiveQuantity } from './pricing';

/**
 * Soma da Receita % = Σ %ingredientes + Proporção%fermento. §3.D passo 1.
 * O fermento ENTRA na soma (decisão 3): no golden §12 dá 192% (não 172%). NÃO
 * inclui as % internas das farinhas do fermento — essas são sub-receita (§2.B),
 * rateio interno da FarinhaFerm, e não da massa principal.
 */
export function recipeSumPercent(recipe: Recipe): number {
  const ingredientsSum = recipe.ingredients.reduce((s, i) => s + i.percentage, 0); // §3.D passo 1
  return ingredientsSum + recipe.sourdough.percentageOfTotalFlour; // decisão 3: fermento entra
}

/**
 * F_nova = W_alvo / (SomaReceita% / 100). §3.D passo 2.
 * Guardas explícitas (§5.C, contrato null≠0): alvo ≤ 0 → null (peso impossível);
 * soma ≤ 0 → null (sem ingredientes nem fermento, divisão impossível). Nunca
 * arredonda (§9) nem lança — retorna number cru ou null.
 */
export function scaledFlourTotal(recipe: Recipe, targetWeight: number): number | null {
  if (targetWeight <= 0) return null; // §5.C: peso alvo inválido
  const sum = recipeSumPercent(recipe); // §3.D passo 1
  if (sum <= 0) return null; // §5.C: soma impossível → ÷0 evitada
  return targetWeight / (sum / 100); // §3.D passo 2
}

/**
 * Ação explícita de escalonamento por peso alvo (§1.6/§3.D). Retorna uma Recipe
 * pura com a nova âncora, ou `null` quando indisponível/inválida. O caller roda
 * `recalculate` em seguida — que aplica o passo 3 do §3.D (pesos = F_nova × %/100
 * via bakers.weightFromPercentage), sem duplicar fórmula aqui.
 *
 * Restrições (§3.D/§2.E.1):
 *  - Só em calculationMode 'percentage-to-weight' (§3.D "modo %→peso apenas");
 *    peso→% → null.
 *  - alvo/soma inválidos → null (via scaledFlourTotal).
 *  - Âncora 'per-unit' (§2.E.1): grava flourPerUnit = F_nova / N mantendo N
 *    (pricing.quantity, guardado por effectiveQuantity ≥ 1); F_total volta a
 *    derivar em recalculate. Âncora 'total': grava flourTotalWeight = F_nova.
 */
export function applyTargetScaling(recipe: Recipe, targetWeight: number): Recipe | null {
  if (recipe.calculationMode !== 'percentage-to-weight') return null; // §3.D: só %→peso
  const fNova = scaledFlourTotal(recipe, targetWeight); // §3.D passo 2 (null se inválido)
  if (fNova === null) return null; // propaga null (§5.C), sem throw

  const next = structuredClone(recipe); // §1.6: não muta a entrada
  if (next.batchPlanningMode === 'per-unit') {
    // §2.E.1: mantém N; ajusta F_unit. N ≥ 1 via effectiveQuantity (guarda ÷0 reusada).
    next.flourPerUnit = fNova / effectiveQuantity(next.pricing.quantity); // §2.E.1
  } else {
    next.flourTotalWeight = fNova; // §3.D: nova âncora total
  }
  return next;
}
