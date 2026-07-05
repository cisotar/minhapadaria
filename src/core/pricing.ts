/**
 * pricing.ts — Precificação: custo unitário, três modos de entrada
 * sincronizados, totais e faixa de status da margem (spec §3.E/§4/§5.C/§12,
 * decisão 4).
 *
 * O que faz: dado o Custo Total da Receita (pronto de costs.ts, §3.E) e a
 * quantidade, deriva o Custo Unitário e, a partir de qualquer um dos três pontos
 * de entrada — Preço Fixo, Margem% ou Lucro Fixo — reconstrói o trio consistente
 * {salePrice, profitMargin, profitPerUnit} (§3.E). Calcula os totais de produção,
 * receita e lucro (§3.E), classifica a margem em faixas de status (§4) e sinaliza
 * prejuízo quando o preço não cobre o custo (§5.C, aviso não bloqueante).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - SEM arredondamento interno (§9): valores devolvidos crus; format.ts arredonda
 *    só na exibição (não importado aqui).
 *  - Sem mutação; sem throw: entradas inválidas viram clamp ou guarda de ÷0,
 *    NUNCA NaN/Infinity — o recalc em lote (issue 008) não pode ser interrompido.
 *  - Margem limitada a [0, 99.9] (§5.C, decisão 4); quantidade ≥ 1 (§5.C).
 *  - Não recalcula o Custo Total da Receita: consome o number de costs.ts (§3.E).
 *
 * Seções implementadas: §3.E, §4, §5.C, §12, decisão 4.
 */

/** Piso da margem — §5.C: margem não pode ser negativa por esta via. */
export const MARGIN_MIN = 0;
/** Teto da margem — §5.C, decisão 4: 99,9% evita ÷0 em 1 − margem/100. */
export const MARGIN_MAX = 99.9;

export type MarginStatus = 'green' | 'yellow' | 'red';

export interface PricingBreakdown {
  salePrice: number;
  profitMargin: number;
  profitPerUnit: number;
}

export interface PricingTotals {
  totalProductionCost: number;
  totalRevenue: number;
  totalProfit: number;
}

/** Clamp da margem a [MARGIN_MIN, MARGIN_MAX]. §5.C, decisão 4. */
export function clampMargin(margin: number): number {
  return Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, margin)); // §5.C, decisão 4
}

/** Quantidade efetiva ≥ 1 — rede de segurança contra ÷0 no custo unitário. §5.C. */
export function effectiveQuantity(quantity: number): number {
  return Math.max(1, quantity); // §5.C: quantidade ≥ 1 (UI já bloqueia; core protege)
}

/** Custo Unitário = Custo Total da Receita / Quantidade. §3.E. */
export function unitCost(totalRecipeCost: number, quantity: number): number {
  return totalRecipeCost / effectiveQuantity(quantity); // §3.E (guarda de ÷0 via effectiveQuantity)
}

/**
 * Modo Preço Fixo: dado o preço de venda, deriva lucro e margem. §3.E.
 * salePrice ≤ 0 → profitMargin 0 (guarda ÷0, §5.C), sem NaN.
 */
export function priceFromSalePrice(unitCost: number, salePrice: number): PricingBreakdown {
  const profitPerUnit = salePrice - unitCost; // §3.E
  const profitMargin = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0; // §5.C: guarda ÷0
  return { salePrice, profitMargin, profitPerUnit };
}

/**
 * Modo Margem%: dado o percentual de margem, deriva preço e lucro. §3.E, decisão 4.
 * Preço = CustoUnit / (1 − margem/100); margem sofre clamp a [0, 99.9] (evita ÷0).
 * profitMargin devolvido = margem já saneada (auto-consistente: profit/price = m).
 */
export function priceFromMargin(unitCost: number, margin: number): PricingBreakdown {
  const m = clampMargin(margin); // §5.C, decisão 4: teto 99.9 evita divisor 0
  const salePrice = unitCost / (1 - m / 100); // §3.E: margem sobre o preço
  const profitPerUnit = salePrice - unitCost; // §3.E
  return { salePrice, profitMargin: m, profitPerUnit }; // profit/price = m por construção
}

/**
 * Modo Lucro Fixo: dado o lucro por unidade, deriva preço e margem. §3.E.
 * salePrice ≤ 0 → profitMargin 0 (guarda ÷0, §5.C).
 */
export function priceFromProfit(unitCost: number, profitPerUnit: number): PricingBreakdown {
  const salePrice = unitCost + profitPerUnit; // §3.E
  const profitMargin = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0; // §5.C: guarda ÷0
  return { salePrice, profitMargin, profitPerUnit };
}

/**
 * Totais da produção. §3.E.
 * totalProductionCost = unitCost × Qtd (= "custo por unidade × unidades
 * produzidas"). Resolução de inconsistência (issue/§3.E vs §12): o golden §12 exige
 * CustoTotalProdução = 8,86 (não 17,72), coerente com §14.3 BakeEntry.totalCost;
 * o golden é a fonte da verdade. NÃO usar CustoTotalReceita × Qtd literal.
 */
export function pricingTotals(unitCost: number, salePrice: number, quantity: number): PricingTotals {
  const q = effectiveQuantity(quantity); // §5.C
  const totalProductionCost = unitCost * q; // §3.E (ver nota da inconsistência)
  const totalRevenue = salePrice * q; // §3.E
  const totalProfit = totalRevenue - totalProductionCost; // §3.E
  return { totalProductionCost, totalRevenue, totalProfit };
}

/** Faixa de status da margem: >30 verde; 15–30 amarelo; <15 ou negativa vermelho. §4. */
export function marginStatus(margin: number): MarginStatus {
  if (margin > 30) return 'green'; // §4
  if (margin >= 15) return 'yellow'; // §4: 15 e 30 inclusive → amarelo
  return 'red'; // §4: <15 ou negativa
}

/** Prejuízo quando o preço não cobre o custo unitário (break-even inclusivo). §5.C/§4. */
export function isLoss(unitCost: number, salePrice: number): boolean {
  return salePrice <= unitCost; // §5.C: aviso (não bloqueio); ≤ cobre break-even
}
