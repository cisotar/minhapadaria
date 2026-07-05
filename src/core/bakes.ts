/**
 * bakes.ts — Núcleo puro do histórico de fornadas (spec §14.3/§14.4/§14.5/§14.6/§14.7).
 *
 * O que faz: cálculo por fornada a partir dos SNAPSHOTS crus (§14.3), agregações
 * por dia/semana/mês (§14.4), filtros por receita/intervalo (§14.5), comparação
 * de períodos com variação % (§14.5), melhor/pior período por lucro (§14.5),
 * confirmação de planejada (§14.6) e detecção de fornada órfã (§14.7).
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem rede, sem arredondamento
 *    (§9 é exibição-apenas; aqui o valor é sempre completo). Pasta core/.
 *  - Snapshots NUNCA recalculados da receita atual: os totais derivam de
 *    unitCost/unitSalePrice/quantidades gravados na própria fornada (§14.3).
 *  - `planned: true` fica FORA de TODAS as agregações até confirmação (§14.4/§14.6).
 *  - Contrato null≠0 do codebase (§5.C): denominador ≤ 0 em taxa por fornada → null,
 *    nunca 0/NaN. (Agregado do período usa guarda ÷0→0 por ser soma vazia legítima.)
 *  - Não muta entradas: clona antes de derivar/confirmar.
 *
 * Datas — código próprio sobre `Date` (sem date-fns; dep nova injustificada para
 * ~8 linhas de aritmética trivial). Chaves de agrupamento derivam de `formatDate`
 * (getters LOCAIS), casando com validation.ts/§14.6 e evitando deslocamento de dia
 * por fuso (nunca UTC/toISOString). Semântica do dia-da-semana confirmada na doc
 * oficial: getDay() = 0(domingo)…6(sábado):
 *   https://developer.mozilla.org/en-US/docs/Web/API/Date/getDay
 * Construção por componentes locais new Date(y, mIndex, d) = meia-noite local:
 *   https://developer.mozilla.org/en-US/docs/Web/API/Date/Date
 */
import type { BakeEntry, BakeHistorySummary } from './types';
import { formatDate } from './format';

// --- Por fornada (§14.3) ---

/** §14.3: CustoTotal = unitCost × qtdProduzida. */
export function bakeTotalCost(unitCost: number, quantityProduced: number): number {
  return unitCost * quantityProduced;
}

/** §14.3: Receita = unitSalePrice × qtdVendida. */
export function bakeRevenue(unitSalePrice: number, quantitySold: number): number {
  return unitSalePrice * quantitySold;
}

/** §14.3: Lucro = Receita − CustoTotal. */
export function bakeProfit(revenue: number, totalCost: number): number {
  return revenue - totalCost;
}

/** §14.3: Desperdício = produzida − vendida. */
export function bakeWastage(produced: number, sold: number): number {
  return produced - sold;
}

/**
 * §14.3: Taxa% = desperdício/produzida × 100. Guarda ÷0: produzida ≤ 0 → null
 * (contrato null≠0 do codebase, §5.C) — cálculo impossível jamais vira 0/NaN.
 */
export function bakeWastageRate(produced: number, sold: number): number | null {
  if (produced <= 0) return null;
  return (bakeWastage(produced, sold) / produced) * 100;
}

/**
 * Clona a fornada e preenche os 5 campos derivados (§14.3) a partir dos snapshots
 * crus. Não muta a entrada. wastageRate impossível (produzida ≤ 0) fica undefined
 * (mantém o contrato null≠0: o campo do tipo é number opcional).
 */
export function computeBakeDerived(entry: BakeEntry): BakeEntry {
  const clone = structuredClone(entry);
  const totalCost = bakeTotalCost(entry.unitCost, entry.quantityProduced);
  const totalRevenue = bakeRevenue(entry.unitSalePrice, entry.quantitySold);
  clone.totalCost = totalCost;
  clone.totalRevenue = totalRevenue;
  clone.totalProfit = bakeProfit(totalRevenue, totalCost);
  clone.wastage = bakeWastage(entry.quantityProduced, entry.quantitySold);
  const rate = bakeWastageRate(entry.quantityProduced, entry.quantitySold);
  if (rate !== null) clone.wastageRate = rate;
  return clone;
}

// --- Planejadas (§14.6) ---

/** §14.6: fornada planejada (data futura ainda não confirmada). */
export function isPlanned(entry: BakeEntry): boolean {
  return entry.planned === true;
}

/**
 * §14.6: confirmar planejada = REMOVER a chave `planned` → passa a contar nos
 * totais. Clona e deleta a chave; não muta a entrada.
 */
export function confirmPlanned(entry: BakeEntry): BakeEntry {
  const clone = structuredClone(entry);
  delete clone.planned;
  return clone;
}

// --- Agregações (§14.4) ---

/**
 * §14.4: soma as fornadas do período (produced/sold/cost/revenue/profit).
 * `planned:true` fica FORA de TODOS os campos (filtrado ANTES de somar).
 * wastageRate/averageProfitMargin do período são agregados PONDERADOS (taxa/margem
 * global do período), com guarda ÷0→0 (período sem produção/receita não vira NaN).
 * periodStart/periodEnd são metadados do bucket (rótulo), não filtram a lista.
 */
export function aggregatePeriod(
  entries: BakeEntry[],
  periodStart: Date,
  periodEnd: Date,
): BakeHistorySummary {
  const real = entries.filter((e) => !isPlanned(e)); // §14.4: planned fora
  let totalProduced = 0;
  let totalSold = 0;
  let totalCost = 0;
  let totalRevenue = 0;
  for (const e of real) {
    totalProduced += e.quantityProduced;
    totalSold += e.quantitySold;
    totalCost += bakeTotalCost(e.unitCost, e.quantityProduced);
    totalRevenue += bakeRevenue(e.unitSalePrice, e.quantitySold);
  }
  const totalProfit = bakeProfit(totalRevenue, totalCost);
  const totalWastage = totalProduced - totalSold;
  // Guarda ÷0→0: agregado de período vazio é 0 legítimo (não impossível).
  const wastageRate = totalProduced > 0 ? (totalWastage / totalProduced) * 100 : 0;
  const averageProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return {
    periodStart,
    periodEnd,
    totalProduced,
    totalSold,
    totalCost,
    totalRevenue,
    totalProfit,
    wastageRate,
    averageProfitMargin,
  };
}

// Segunda-feira da semana da data (componentes locais). §14.4: semana
// segunda–domingo. offset = (getDay()+6)%7 → dom=6, seg=0, …, sáb=5.
function mondayOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

// Agrupador genérico dirigido por chave + limites do bucket; delega a
// aggregatePeriod; ordena por periodStart asc (chave lexicográfica aaaa-mm-dd).
function groupBy(
  entries: BakeEntry[],
  keyOf: (date: Date) => string,
  boundsOf: (date: Date) => { start: Date; end: Date },
): BakeHistorySummary[] {
  const buckets = new Map<string, BakeEntry[]>();
  for (const e of entries) {
    const key = keyOf(e.date);
    const list = buckets.get(key);
    if (list) list.push(e);
    else buckets.set(key, [e]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, list]) => {
      const { start, end } = boundsOf(list[0].date);
      return aggregatePeriod(list, start, end);
    });
}

/** §14.4: agregação por dia calendário (chave/limite = a própria data local). */
export function groupByDay(entries: BakeEntry[]): BakeHistorySummary[] {
  return groupBy(
    entries,
    (d) => formatDate(d),
    (d) => {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return { start: day, end: day };
    },
  );
}

/** §14.4: agregação por semana segunda–domingo (chave = segunda via mondayOf). */
export function groupByWeek(entries: BakeEntry[]): BakeHistorySummary[] {
  return groupBy(
    entries,
    (d) => formatDate(mondayOf(d)),
    (d) => {
      const start = mondayOf(d);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end };
    },
  );
}

/** §14.4: agregação por mês calendário (chave = aaaa-mm de formatDate). */
export function groupByMonth(entries: BakeEntry[]): BakeHistorySummary[] {
  return groupBy(
    entries,
    (d) => formatDate(d).slice(0, 7),
    (d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      // Dia 0 do mês seguinte = último dia do mês corrente.
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, end };
    },
  );
}

// --- Filtros (§14.5) ---

/** §14.5: filtra por receita (recipeId). */
export function filterByRecipe(entries: BakeEntry[], recipeId: string): BakeEntry[] {
  return entries.filter((e) => e.recipeId === recipeId);
}

/**
 * §14.5: filtra por intervalo custom, INCLUSIVO nas bordas. Compara por
 * formatDate (chave lexicográfica aaaa-mm-dd, sem fuso — casa com §14.6).
 */
export function filterByDateRange(entries: BakeEntry[], start: Date, end: Date): BakeEntry[] {
  const lo = formatDate(start);
  const hi = formatDate(end);
  return entries.filter((e) => {
    const k = formatDate(e.date);
    return k >= lo && k <= hi;
  });
}

// --- Comparação (§14.5) ---

export interface PeriodComparison {
  producedVariation: number | null;
  soldVariation: number | null;
  costVariation: number | null;
  revenueVariation: number | null;
  profitVariation: number | null;
}

/**
 * §14.5: variação % de atual vs anterior. Guarda divisão por zero: anterior 0 →
 * null ("—" na UI), nunca ±Infinity/NaN.
 */
export function percentVariation(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** §14.5: comparação métrica-a-métrica de dois summaries (atual vs anterior). */
export function comparePeriods(
  current: BakeHistorySummary,
  previous: BakeHistorySummary,
): PeriodComparison {
  return {
    producedVariation: percentVariation(current.totalProduced, previous.totalProduced),
    soldVariation: percentVariation(current.totalSold, previous.totalSold),
    costVariation: percentVariation(current.totalCost, previous.totalCost),
    revenueVariation: percentVariation(current.totalRevenue, previous.totalRevenue),
    profitVariation: percentVariation(current.totalProfit, previous.totalProfit),
  };
}

// --- Melhor/pior (§14.5) ---

/** §14.5: período de maior lucro; vazio → null; empate → primeiro (comparação estrita). */
export function bestPeriod(summaries: BakeHistorySummary[]): BakeHistorySummary | null {
  if (summaries.length === 0) return null;
  return summaries.reduce((best, s) => (s.totalProfit > best.totalProfit ? s : best));
}

/** §14.5: período de menor lucro; vazio → null; empate → primeiro. */
export function worstPeriod(summaries: BakeHistorySummary[]): BakeHistorySummary | null {
  if (summaries.length === 0) return null;
  return summaries.reduce((worst, s) => (s.totalProfit < worst.totalProfit ? s : worst));
}

// --- Órfãs (§14.7) ---

/**
 * §14.7: fornada órfã = sua receita não existe mais (nunca cascade delete; a
 * fornada é preservada). Sinal para a UI marcar "receita não existe mais".
 */
export function isOrphan(entry: BakeEntry, existingRecipeIds: ReadonlySet<string>): boolean {
  return !existingRecipeIds.has(entry.recipeId);
}
