/**
 * pricing.ts — Precificação: custo unitário, três modos de entrada
 * sincronizados por MARKUP-SOBRE-CUSTO (% de lucro), totais e faixa de status
 * (spec §3.E/§4/§5.C/§12 — semântica sobrescrita pela issue 041).
 *
 * O que faz: dado o Custo Total da Receita (pronto de costs.ts, §3.E) e a
 * quantidade, deriva o Custo Unitário e, a partir de qualquer um dos três pontos
 * de entrada — Preço Fixo, % de Lucro ou Lucro Fixo — reconstrói o trio consistente
 * {salePrice, profitMargin, profitPerUnit} (§3.E). Calcula os totais de produção,
 * receita e lucro (§3.E), classifica a margem em faixas de status (§4) e sinaliza
 * prejuízo quando o preço não cobre o custo (§5.C, aviso não bloqueante).
 *
 * Definição de precificação (issue 041 — sobrescreve §3.E/§12 antigos): o campo de
 * percentual é a TAXA DE LUCRO sobre o CUSTO (markup), não a margem sobre o preço.
 *   preço = custo × (1 + p/100) ; lucro = custo × p/100 ;
 *   profitMargin = custo > 0 ? (lucro/custo) × 100 : 0.
 * Fórmula linear e finita: não explode perto de 100% e aceita p > 100% (o divisor
 * `1 − m/100` da fórmula margem-sobre-preço deixou de existir, então não há mais
 * teto 99,9% nem clamp). Ex. do cliente: custo 100, p 20 → preço 120, lucro 20.
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - SEM arredondamento interno (§9): valores devolvidos crus; format.ts arredonda
 *    só na exibição (não importado aqui).
 *  - Sem mutação; sem throw: entradas inválidas viram guarda de ÷0 (custo 0),
 *    NUNCA NaN/Infinity — o recalc em lote (issue 008) não pode ser interrompido.
 *  - % de lucro com piso 0 (MARGIN_MIN, §5.C); quantidade ≥ 1 (§5.C).
 *  - Não recalcula o Custo Total da Receita: consome o number de costs.ts (§3.E).
 *
 * Seções implementadas: §3.E, §4, §5.C, §12 (precificação recomputada pela issue 041).
 */

/** Piso da % de lucro — §5.C: não pode ser negativa por esta via. */
export const MARGIN_MIN = 0;

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

/** Quantidade efetiva ≥ 1 — rede de segurança contra ÷0 no custo unitário. §5.C. */
export function effectiveQuantity(quantity: number): number {
  return Math.max(1, quantity); // §5.C: quantidade ≥ 1 (UI já bloqueia; core protege)
}

/** Custo Unitário = Custo Total da Receita / Quantidade. §3.E. */
export function unitCost(totalRecipeCost: number, quantity: number): number {
  return totalRecipeCost / effectiveQuantity(quantity); // §3.E (guarda de ÷0 via effectiveQuantity)
}

/**
 * Modo Preço Fixo: dado o preço de venda, deriva lucro e % de lucro. §3.E.
 * % de lucro tem o CUSTO como denominador (markup, issue 041):
 * profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) × 100 : 0 (guarda ÷0, §5.C).
 */
export function priceFromSalePrice(unitCost: number, salePrice: number): PricingBreakdown {
  const profitPerUnit = salePrice - unitCost; // §3.E
  const profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) * 100 : 0; // issue 041: denom CUSTO, guarda ÷0
  return { salePrice, profitMargin, profitPerUnit };
}

/**
 * Modo % de Lucro (markup sobre custo, issue 041): dado o percentual de lucro p,
 * deriva preço e lucro linearmente. preço = custo × (1 + p/100); lucro = custo × p/100.
 * profitMargin devolvido = p (auto-consistente: lucro/custo = p/100). Sem teto/clamp
 * (divisor `1 − m/100` não existe mais) → p livre em [0, +∞). Custo 0 → preço/lucro 0,
 * finito, profitMargin = p (custo não é denominador aqui, §5.C).
 */
export function priceFromMargin(unitCost: number, margin: number): PricingBreakdown {
  const salePrice = unitCost * (1 + margin / 100); // issue 041: markup sobre o custo
  const profitPerUnit = unitCost * (margin / 100); // = salePrice − unitCost
  return { salePrice, profitMargin: margin, profitPerUnit }; // lucro/custo = margin por construção
}

/**
 * Modo Lucro Fixo: dado o lucro por unidade, deriva preço e % de lucro. §3.E.
 * % de lucro tem o CUSTO como denominador (markup, issue 041):
 * profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) × 100 : 0 (guarda ÷0, §5.C).
 */
export function priceFromProfit(unitCost: number, profitPerUnit: number): PricingBreakdown {
  const salePrice = unitCost + profitPerUnit; // §3.E
  const profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) * 100 : 0; // issue 041: denom CUSTO, guarda ÷0
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
