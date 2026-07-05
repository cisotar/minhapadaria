/**
 * recalc.ts — Função central de recálculo em lote (spec §1.2–1.6/§3.E/§9).
 *
 * O que faz: UMA função (`recalculate`) reconstrói TODOS os valores derivados de
 * uma Recipe a partir do estado puro — porcentagens/pesos-base declarados,
 * partes do fermento, custos de embalagem, quantidade e ponto de entrada de
 * preço (§1.6). Orquestra as camadas puras já existentes — bakers (§3.A),
 * sourdough (§3.B), hydration (§2.C/§2.D), costs (§3.E), pricing (§3.E) — SEM
 * duplicar fórmula (regra de ouro #2). A única conta própria do engine é a % de
 * exibição do modo peso→% (§1.3), inline e comentada. Também expõe a transição
 * explícita de modo peso→% → %→peso (§1.5).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem rede, sem `format.ts`
 *    (nada de arredondamento aqui — §9 é exibição-apenas). Pasta core/.
 *  - Nunca lê valor derivado/arredondado como entrada: sempre a fonte de verdade
 *    do modo (% em %→peso; peso em peso→%); §1.6 garante idempotência.
 *  - Não muta a Recipe de entrada (clona; retorna novo `state`).
 *  - Ininterrompível: nenhuma exceção — estados impossíveis (§5.C) fluem como
 *    `null` (custo/preço) sem colapsar para 0/NaN (contrato PROGRESS-005/006).
 *
 * Seções implementadas: §1.2, §1.3, §1.5, §1.6, §3.A/§3.B/§3.E, §2.C/§2.D, §9.
 */
import type { Recipe, RecipeSummary } from './types';
import { flourTotal, weightFromPercentage, percentageFromWeight } from './bakers';
import { computeSourdoughWeights, distributeSourdoughFlourWeights } from './sourdough';
import { nominalHydration, realHydration, realFlourConsumed } from './hydration';
import {
  costPerGram,
  ingredientRecipeCost,
  sourdoughCost,
  sourdoughCostPerGram,
  totalRecipeCost,
} from './costs';
import {
  unitCost,
  priceFromMargin,
  priceFromSalePrice,
  priceFromProfit,
  pricingTotals,
  effectiveQuantity,
  type PricingBreakdown,
  type PricingTotals,
} from './pricing';

export interface RecalcResult {
  /** §1.6: estado puro + derivados somente-leitura preenchidos (idempotente ao re-alimentar). */
  state: Recipe;
  /** §2.C/§2.D/§3.E: painéis de hidratação, farinha real, custo e precificação. */
  summary: RecipeSummary;
}

/**
 * Reconstrói todos os derivados de `recipe` a partir do estado puro (§1.6).
 * Ordem: F_total (âncora) → pesos/% das linhas → fermento por proporção →
 * hidratação → custos → precificação → montagem de `state`+`summary`.
 */
export function recalculate(recipe: Recipe): RecalcResult {
  // Não mutar a entrada (§1.6): trabalhamos sobre um clone; Date preservada.
  const state = structuredClone(recipe);
  const mode = state.calculationMode;

  // 1. F_total (âncora). §1.2 usa flourTotalWeight declarado; §1.3 deriva da
  //    soma dos pesos das farinhas editadas (§3.A).
  //    Fornada por unidade (§2.E.1, issue 009): SÓ em %→peso a âncora pode vir
  //    de flourPerUnit × N — F_total passa a derivado somente-leitura. Em peso→%
  //    o planejamento é sempre 'total' (§2.E.1): normalizamos e ignoramos
  //    flourPerUnit, derivando F_total das farinhas editadas.
  let fTotal: number;
  if (mode === 'percentage-to-weight') {
    if (state.batchPlanningMode === 'per-unit') {
      // §2.E.1: F_total = F_unit × N (N ≥ 1 via effectiveQuantity, guarda ÷0 reusada).
      fTotal = (state.flourPerUnit ?? 0) * effectiveQuantity(state.pricing.quantity); // §2.E.1
    } else {
      fTotal = state.flourTotalWeight;
    }
  } else {
    // §2.E.1: per-unit indisponível em peso→% → força 'total'.
    state.batchPlanningMode = 'total';
    fTotal = flourTotal(state.ingredients); // §1.3/§3.A
  }

  // 2. Fermento — SEMPRE por proporção + Partes nos dois modos (§1.3/§3.B).
  //    Peso do fermento nunca é editado. Partes inválidas → null (§5.C), sem throw.
  const sd = computeSourdoughWeights(
    fTotal,
    state.sourdough.percentageOfTotalFlour,
    state.sourdough.parts,
  );
  const flourFermWeight = sd?.flourWeight ?? 0;
  const wFerm = sd?.totalWeight ?? 0;
  const flourWeights = distributeSourdoughFlourWeights(flourFermWeight, state.sourdough.flours); // §3.B

  // 3. Derivar pesos/% das linhas a partir da fonte de verdade do modo.
  if (mode === 'percentage-to-weight') {
    // §1.2: a % é verdade; o peso é derivado (farinha, líquidos, sal, extras).
    for (const ing of state.ingredients) {
      ing.weight = weightFromPercentage(fTotal, ing.percentage); // §3.A
    }
    // §2.E.1: em per-unit F_total é derivado (F_unit × N); em total já é a
    //         fonte de verdade — escrever fTotal é idempotente nos dois casos.
    state.flourTotalWeight = fTotal;
  } else {
    // §1.3: o peso é verdade; a baker's percentage é suspensa e a % passa a
    // refletir a proporção de cada linha sobre o TOTAL GERAL DA MASSA. O peso do
    // fermento conta como parte do peso final da massa (§3.D nota, ex. §12: 192%),
    // logo entra no denominador. NÃO é bakers.percentageFromWeight (essa é sobre
    // F_total, §3.A) — é a semântica-definidora deste modo, própria do engine.
    const totalMass = state.ingredients.reduce((s, i) => s + i.weight, 0) + wFerm; // §1.3/§3.D
    for (const ing of state.ingredients) {
      ing.percentage = totalMass > 0 ? (ing.weight / totalMass) * 100 : 0; // §1.3 (§5.C: ÷0→0)
    }
    // flourTotalWeight é derivado neste modo (Σ pesos das farinhas, §3.A).
    state.flourTotalWeight = fTotal;
  }

  // 4. Hidratação e Farinha Real Consumida sobre os pesos derivados + fermento.
  const nominal = nominalHydration(state.ingredients); // §2.C (number|null, §5.C)
  const real = realHydration(state.ingredients, sd); // §2.C
  const realFlour = realFlourConsumed(state.ingredients, sd); // §2.D

  // 5. Custos por linha e da receita (§3.E). Isca sempre fora (§2.B.2) — o custo
  //    do fermento entra só via sourdoughCost; ingredients[] não tem pseudolinha.
  for (const ing of state.ingredients) {
    ing.costPerGram = costPerGram(ing.packageCost) ?? undefined; // §2.A.1 (null→"—")
    ing.recipeCost = ingredientRecipeCost(ing.weight, ing.packageCost) ?? undefined; // §2.A.1
  }
  const sc = sourdoughCost(
    flourWeights,
    state.sourdough.flours,
    sd?.waterWeight ?? 0,
    state.sourdough.waterPackageCost,
  ); // §3.E (number|null)
  // Propaga null (não colapsa, §5.C): custo do fermento impossível → total impossível.
  const total = sc === null ? null : totalRecipeCost(state.ingredients, sc); // §3.E

  // 6. Precificação a partir do ponto de entrada sincronizado escolhido (§3.E).
  let costPerUnit: number | null = null;
  let breakdown: PricingBreakdown | null = null;
  let totals: PricingTotals | null = null;
  if (total !== null) {
    const uc = unitCost(total, state.pricing.quantity); // §3.E
    costPerUnit = uc;
    breakdown =
      state.pricing.priceInputMode === 'sale-price'
        ? priceFromSalePrice(uc, state.pricing.salePrice)
        : state.pricing.priceInputMode === 'profit'
          ? priceFromProfit(uc, state.pricing.profitPerUnit)
          : priceFromMargin(uc, state.pricing.profitMargin);
    totals = pricingTotals(uc, breakdown.salePrice, state.pricing.quantity); // §3.E
  }

  // 7. Montar derivados somente-leitura no `state` (sub-receita do fermento).
  state.sourdough.totalWeight = wFerm;
  state.sourdough.iscaWeight = sd?.iscaWeight ?? 0;
  state.sourdough.flourWeight = flourFermWeight;
  state.sourdough.waterWeight = sd?.waterWeight ?? 0;
  state.sourdough.hydration = sd?.hydration ?? undefined; // null (FarinhaFerm=0) → "—"
  state.sourdough.flours.forEach((f, i) => {
    f.weight = flourWeights[i];
    f.costPerGram = costPerGram(f.packageCost) ?? undefined;
  });
  state.sourdough.waterCostPerGram = costPerGram(state.sourdough.waterPackageCost) ?? undefined;
  state.sourdough.totalCost = sc ?? undefined;
  state.sourdough.costPerGram = sc === null ? undefined : sourdoughCostPerGram(sc, wFerm); // §3.E

  // Precificação no estado (fonte de verdade do modo permanece; derivados sincronizados).
  if (breakdown !== null) {
    state.pricing.salePrice = breakdown.salePrice;
    state.pricing.profitMargin = breakdown.profitMargin;
    state.pricing.profitPerUnit = breakdown.profitPerUnit;
  }
  state.pricing.totalCost = totals?.totalProductionCost ?? undefined;
  state.pricing.totalRevenue = totals?.totalRevenue ?? undefined;
  state.pricing.totalProfit = totals?.totalProfit ?? undefined;

  const summary: RecipeSummary = {
    hydration: { nominal, real },
    realFlourConsumed: realFlour,
    totalCost: total,
    costPerUnit,
    totalProductionCost: totals?.totalProductionCost ?? null,
    salePrice: breakdown?.salePrice ?? null,
    totalRevenue: totals?.totalRevenue ?? null,
    profitPerUnit: breakdown?.profitPerUnit ?? null,
    totalProfit: totals?.totalProfit ?? null,
    profitMargin: breakdown?.profitMargin ?? null,
  };

  return { state, summary };
}

/**
 * Transição peso→% → %→peso (§1.5). Os pesos editados tornam-se a nova fonte de
 * verdade: (1) F_total = Σ pesos das farinhas principais (§3.A); (2) cada linha
 * recebe % = peso / F_total × 100 — baker's (§3.A), pois o destino é o modo
 * padrão; (3) modo passa a 'percentage-to-weight'. Proporção/Partes do fermento
 * inalteradas (sempre por proporção, §1.3). Nada descartado, sem confirmação.
 * Devolve uma Recipe pura (não recalcula derivados) — o chamador roda
 * `recalculate` em seguida.
 */
export function transitionToPercentageMode(recipe: Recipe): Recipe {
  const next = structuredClone(recipe);
  const fTotal = flourTotal(next.ingredients); // §1.5.1 / §3.A
  for (const ing of next.ingredients) {
    ing.percentage = percentageFromWeight(ing.weight, fTotal); // §1.5.2 / §3.A (denominador F_total)
  }
  next.flourTotalWeight = fTotal;
  next.calculationMode = 'percentage-to-weight';
  return next;
}
