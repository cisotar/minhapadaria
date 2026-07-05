/**
 * sourdough.ts — Sub-receita do fermento natural, núcleo puro (spec §2.B/§3.B/§5.C).
 *
 * O que faz: resolve os PESOS do fermento e sua hidratação DERIVADA. O peso
 * total (W_ferm) é uma proporção da farinha-âncora F_total (§3.B); a repartição
 * interna segue as Partes livres Isca:Farinha:Água (§2.B.2, ex. 1:7:7); a
 * hidratação nunca é entrada — é sempre calculada de ÁguaFerm/FarinhaFerm
 * (§2.B/§5.C). As farinhas do fermento são rateadas por P_i (§3.B), com ΣP_i=100
 * (§2.B.3). A Isca não recebe tratamento de custo aqui (custo zero é §3.E, outra
 * issue) — este módulo só entrega pesos e hidratação.
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - Valor canônico sempre em gramas (§7); SEM arredondamento interno (§9):
 *    retorna number cru (o mockup arredonda 21/147/147; o core devolve o exato).
 *  - Sem mutação da entrada (recalc parte do estado puro, §1.6).
 *  - Divisão por zero / estado inválido tratados sem NaN/Infinity (§5.C):
 *    SomaPartes>0 e partes≥0 obrigatórios; FarinhaFerm=0 → hidratação null.
 *
 * Seções implementadas: §2.B, §2.B.2, §2.B.3, §3.B, §5.C.
 */
import type { SourdoughFlour, SourdoughParts } from './types';
// Reuso (regra de ouro #1/#2): W_ferm é a mesma fórmula genérica de linha
// (§3.A/§2.A.2 = F_total × %/100), e o predicado soma-100 é dono único do
// epsilon anti-drift IEEE-754 — nada duplicado.
import { weightFromPercentage, percentagesSumTo100 } from './bakers';

/**
 * W_ferm = F_total × (proporção% / 100). §3.B.
 * A linha do fermento é genérica (§2.A.2): reusa weightFromPercentage (§3.A).
 */
export function sourdoughTotalWeight(flourTotal: number, sourdoughPercentage: number): number {
  return weightFromPercentage(flourTotal, sourdoughPercentage); // §3.B
}

/**
 * SomaPartes = parte_isca + parte_farinha + parte_água. §2.B.2.
 * As Partes são números livres (não normalizadas para 100 — §5.A).
 */
export function partsSum(parts: SourdoughParts): number {
  return parts.isca + parts.flour + parts.water; // §2.B.2
}

/**
 * Validação §5.C: todas as partes ≥ 0 E SomaPartes > 0 (bloqueia divisão por
 * zero no rateio). Predicado puro para o bloqueio de UI (§5.C).
 */
export function isValidSourdoughParts(parts: SourdoughParts): boolean {
  if (parts.isca < 0 || parts.flour < 0 || parts.water < 0) return false; // §5.C partes ≥ 0
  return partsSum(parts) > 0; // §5.C SomaPartes > 0 (evita ÷0)
}

// Shape alinhado a Sourdough (§6): pesos crus + hidratação derivada.
export interface SourdoughWeights {
  totalWeight: number;
  iscaWeight: number;
  flourWeight: number;
  waterWeight: number;
  hydration: number | null; // §2.B/§5.C: derivada; null quando FarinhaFerm=0
}

/**
 * Pesos do fermento a partir do estado puro (§3.B). Retorna null quando as
 * Partes são inválidas (§5.C) — estado explícito, sem NaN/Infinity, seguro para
 * o recalc em lote (issue 008) que não pode ser interrompido por throw.
 */
export function computeSourdoughWeights(
  flourTotal: number,
  sourdoughPercentage: number,
  parts: SourdoughParts,
): SourdoughWeights | null {
  if (!isValidSourdoughParts(parts)) return null; // §5.C: bloqueio explícito

  const totalWeight = sourdoughTotalWeight(flourTotal, sourdoughPercentage); // W_ferm §3.B
  const soma = partsSum(parts); // > 0 garantido por isValidSourdoughParts (§5.C)

  // Rateio na ordem da fórmula §3.B: (W_ferm × parte) / SomaPartes.
  const iscaWeight = (totalWeight * parts.isca) / soma; // §3.B
  const flourWeight = (totalWeight * parts.flour) / soma; // §3.B
  const waterWeight = (totalWeight * parts.water) / soma; // §3.B

  // H_ferm% = ÁguaFerm / FarinhaFerm × 100 — SEMPRE derivada (§2.B/§5.C).
  // FarinhaFerm=0 (parte_farinha=0) → indefinida: null (UI exibe "—", §5.C).
  const hydration = flourWeight === 0 ? null : (waterWeight / flourWeight) * 100;

  return { totalWeight, iscaWeight, flourWeight, waterWeight, hydration };
}

/**
 * Rateia a FarinhaFerm entre as farinhas do fermento: FarinhaFerm_i =
 * FarinhaFerm × P_i / 100. §3.B. FarinhaFerm=0 → todos 0 (sem NaN).
 * Não muta a entrada (§1.6).
 */
export function distributeSourdoughFlourWeights(
  sourdoughFlourWeight: number,
  flours: readonly SourdoughFlour[],
): number[] {
  return flours.map((f) => weightFromPercentage(sourdoughFlourWeight, f.percentage)); // §3.B
}

/**
 * Predicado §2.B.3: as % das farinhas do fermento somam 100. Reusa o dono único
 * do epsilon (percentagesSumTo100, bakers.ts) — sem duplicar a tolerância.
 */
export function sourdoughFlourPercentagesSumTo100(flours: readonly SourdoughFlour[]): boolean {
  return percentagesSumTo100(flours.map((f) => f.percentage)); // §2.B.3
}
