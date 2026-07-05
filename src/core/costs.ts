/**
 * costs.ts — Cálculo de custos, núcleo puro (spec §2.A.1/§2.B.2/§3.E/§5.C).
 *
 * O que faz: deriva TODO custo a partir da única entrada de custo — Preço Pago
 * + Peso do Produto (§2.A.1). Custo por grama nunca é digitado: é sempre
 * Preço Pago ÷ Peso do Produto (decisão 18/23). Normaliza o PackageCost para
 * gramas (issue 030: só peso — kg→×1000, g→×1; volume eliminado). Compõe o
 * custo do fermento (Σ farinhas + água) com a Isca SEMPRE fora (custo zero,
 * §2.B.2/§3.B) e o custo total da receita (§3.E).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O, sem rede (pasta core/).
 *  - Valor canônico sempre em gramas (§7); SEM arredondamento interno (§9):
 *    retorna number cru, precisão total (format.ts arredonda só na exibição).
 *  - Sem mutação da entrada (recalc parte do estado puro, §1.6).
 *  - Divisão por zero / estado inválido tratados sem NaN/Infinity (§5.C):
 *    Peso do Produto > 0 obrigatório senão null; W_ferm=0 → custo/g 0.
 *    Convenção seguida de sourdough.ts/bakers.ts: null = estado inválido, nunca
 *    throw (recalc em lote da issue 008 não pode ser interrompido).
 *
 * Reuso (regra de ouro #1/#2): consome distributeSourdoughFlourWeights
 * (sourdough.ts, §3.B) via os pesos crus passados em flourWeights — NÃO
 * recalcula peso de farinha do fermento aqui.
 *
 * Seções implementadas: §2.A, §2.A.1, §2.B.2, §3.E, §5.C.
 */
import type { Ingredient, PackageCost, SourdoughFlour } from './types';

/**
 * Soma compensada (Neumaier) — reduz o erro de acumulação IEEE-754 e devolve a
 * soma corretamente arredondada ao double mais próximo, em precisão total.
 * NÃO é arredondamento decimal (§9 continua sendo exibição-apenas): é a mesma
 * soma exata da §3.E, só que sem o drift de ordem (golden §12: 8+0,06+0,8 →
 * 8,86 exato, independente da ordem dos termos). Sem lib nova — aritmética
 * number nativa (regra de ouro: custo é o core, implementação própria).
 * Ref.: Neumaier (1974), variante do algoritmo de Kahan.
 */
function compensatedSum(values: readonly number[]): number {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const t = sum + value;
    compensation += Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum;
    sum = t;
  }
  return sum + compensation;
}

/**
 * Peso do Produto normalizado para gramas. issue 030 (divergência aprovada da
 * spec §2.A: sem volume): kg→×1000, g→×1. Só converte a unidade, não valida.
 */
export function packageSizeInGrams(cost: PackageCost): number {
  switch (cost.packageUnit) {
    case 'kg':
      return cost.packageSize * 1000; // kg → g
    case 'g':
    default:
      return cost.packageSize; // g já é a unidade canônica
  }
}

/**
 * Custo por grama = Preço Pago ÷ Peso do Produto (em gramas). §2.A.1.
 * Guard §5.C: Peso do Produto > 0, senão null (bloqueio "Peso do Produto > 0",
 * sem Infinity). Nunca é digitado — sempre derivado (decisão 18/23).
 */
export function costPerGram(cost: PackageCost): number | null {
  const grams = packageSizeInGrams(cost);
  if (grams <= 0) return null; // §5.C: Peso do Produto > 0 (evita ÷0/Infinity)
  return cost.pricePaid / grams; // §2.A.1
}

/**
 * Custo na receita = peso usado × custo por grama. §2.A.1.
 * Propaga null se o custo por grama for inválido (§5.C).
 */
export function ingredientRecipeCost(weight: number, cost: PackageCost): number | null {
  const cpg = costPerGram(cost);
  if (cpg === null) return null; // §5.C: propaga estado inválido
  return weight * cpg; // §2.A.1
}

/**
 * Custo do fermento = Σ (FarinhaFerm_i × C_farinha_i) + ÁguaFerm × C_água. §3.E.
 * A Isca NUNCA entra (custo zero sempre, §2.B.2/§3.B): por isso a função só
 * recebe os pesos das farinhas e da água — o peso da isca é irrelevante aqui.
 * flourWeights vem de distributeSourdoughFlourWeights (sourdough.ts, §3.B) —
 * reuso, sem recalcular o rateio. Propaga null se qualquer custo for inválido.
 */
export function sourdoughCost(
  flourWeights: number[],
  flours: readonly SourdoughFlour[],
  waterWeight: number,
  waterCost: PackageCost,
): number | null {
  const terms: number[] = [];
  // §3.E: Σ farinhas do fermento (Isca fora — só farinha e água têm custo).
  for (let i = 0; i < flours.length; i++) {
    const cpg = costPerGram(flours[i].packageCost);
    if (cpg === null) return null; // §5.C: propaga inválido
    terms.push(flourWeights[i] * cpg); // §3.E: FarinhaFerm_i × C_farinha_i
  }
  // §3.E: + ÁguaFerm × C_água (água @R$0 contribui 0, sem invalidar).
  const waterCpg = costPerGram(waterCost);
  if (waterCpg === null) return null; // §5.C
  terms.push(waterWeight * waterCpg); // §3.E
  return compensatedSum(terms);
}

/**
 * Custo por grama do fermento = Custo_fermento ÷ W_ferm. §3.E.
 * Guard §5.C: W_ferm > 0, senão 0 (sem NaN quando proporção 0% ou F_total 0).
 */
export function sourdoughCostPerGram(totalCost: number, sourdoughTotalWeight: number): number {
  if (sourdoughTotalWeight <= 0) return 0; // §5.C: evita ÷0/NaN
  return totalCost / sourdoughTotalWeight; // §3.E
}

/**
 * Custo total da receita = Σ Custo_X (ingredientes) + Custo_fermento. §3.E.
 * A linha do fermento NÃO está em ingredients[]: seu custo entra apenas via o
 * parâmetro sourdoughCost (= Custo_fermento), nunca por packageCost próprio
 * digitado (§3.E). Propaga null se algum ingrediente for inválido (§5.C).
 */
export function totalRecipeCost(
  ingredients: readonly Ingredient[],
  sourdoughCost: number,
): number | null {
  // §3.E: CustoTotalReceita = Σ Custo_X + Custo_fermento. Soma compensada para
  // eliminar o drift IEEE-754 do golden §12 (→ 8,86 exato) SEM arredondar no
  // core (§9: arredondamento só na exibição).
  const terms: number[] = [sourdoughCost];
  for (const ingredient of ingredients) {
    const cost = ingredientRecipeCost(ingredient.weight, ingredient.packageCost);
    if (cost === null) return null; // §5.C: propaga inválido
    terms.push(cost); // §3.E: Custo_X
  }
  return compensatedSum(terms);
}
