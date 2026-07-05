/**
 * sourdough.ts — Sub-receita do fermento natural, núcleo puro (spec §2.B/§3.B/§5.C
 * + refactor-farinhas-multiplas §5).
 *
 * O que faz: resolve os PESOS do fermento e sua hidratação DERIVADA. O peso
 * total (W_ferm) é uma proporção da farinha-âncora F_total (§3.B). A repartição
 * interna segue o MODELO NOVO de PROPORÇÃO POR LINHA (refactor §5.3): cada linha
 * (Isca, cada Farinha, Água) tem proporção própria; o denominador é GLOBAL =
 * Isca + Σ(proporções das farinhas) + Água. O peso de cada linha =
 * W_ferm × (proporção ÷ Σproporções). A hidratação nunca é entrada — é sempre
 * ÁguaFerm ÷ Σ(FarinhaFerm) (refactor §5.5). A Isca não recebe tratamento de
 * custo aqui (custo zero é §3.E/§2.B.2, outra camada) — este módulo só entrega
 * pesos e hidratação.
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - Valor canônico sempre em gramas (§7); SEM arredondamento interno (§9):
 *    retorna number cru (o mockup arredonda; o core devolve o exato).
 *  - Sem mutação da entrada (recalc parte do estado puro, §1.6).
 *  - Divisão por zero / estado inválido tratados sem NaN/Infinity (§5.C):
 *    denominador global > 0 e proporções ≥ 0 obrigatórios; Σ(FarinhaFerm)=0 →
 *    hidratação null.
 *  - Sem regra "somar 100" no fermento — proporções são livres (refactor §5.6/AC23).
 *
 * Seções implementadas: §2.B, §3.B, §5.C; refactor §5.3, §5.5, §5.6.
 */
import type { SourdoughFlour, SourdoughParts } from './types';
// Reuso (regra de ouro #1/#2): W_ferm é a mesma fórmula genérica de linha
// (§3.A/§2.A.2 = F_total × %/100) — nada duplicado.
import { weightFromPercentage } from './bakers';

/**
 * W_ferm = F_total × (proporção% / 100). §3.B (inalterado pelo refactor).
 * A linha do fermento é genérica (§2.A.2): reusa weightFromPercentage (§3.A).
 */
export function sourdoughTotalWeight(flourTotal: number, sourdoughPercentage: number): number {
  return weightFromPercentage(flourTotal, sourdoughPercentage); // §3.B
}

/**
 * Σ das proporções das farinhas do fermento. refactor §5.3.
 * Base da hidratação (Σ FarinhaFerm) e do rateio entre farinhas.
 */
export function sourdoughFlourProportionSum(flours: readonly SourdoughFlour[]): number {
  return flours.reduce((sum, f) => sum + f.proportion, 0); // refactor §5.3
}

/**
 * Denominador GLOBAL = Isca + Σ(proporções das farinhas) + Água. refactor §5.3.
 * Substitui a antiga SomaPartes fixa {isca+flour+water}: as proporções das
 * farinhas entram no MESMO denominador que isca/água. É também o Σ proporções do
 * `tfoot` da tabela Fermento (refactor §5.1).
 */
export function sourdoughDenominator(
  parts: SourdoughParts,
  flours: readonly SourdoughFlour[],
): number {
  return parts.isca + sourdoughFlourProportionSum(flours) + parts.water; // refactor §5.3
}

/**
 * Validação (refactor §5.6): Isca/Água ≥ 0, cada proporção de farinha ≥ 0 E
 * denominador global > 0 (bloqueia divisão por zero no rateio). Predicado puro
 * para o bloqueio de UI. NÃO exige soma-100 (proporções livres, AC23).
 */
export function isValidSourdoughParts(
  parts: SourdoughParts,
  flours: readonly SourdoughFlour[],
): boolean {
  if (parts.isca < 0 || parts.water < 0) return false; // refactor §5.6: isca/água ≥ 0
  if (flours.some((f) => f.proportion < 0)) return false; // refactor §5.6: proporções ≥ 0
  return sourdoughDenominator(parts, flours) > 0; // refactor §5.6: Σ todas > 0 (evita ÷0)
}

// Shape alinhado a Sourdough (§6): pesos crus + hidratação derivada.
// `flourWeight` = FarinhaFerm total = Σ dos pesos das farinhas do fermento.
export interface SourdoughWeights {
  totalWeight: number;
  iscaWeight: number;
  flourWeight: number;
  waterWeight: number;
  hydration: number | null; // refactor §5.5: derivada; null quando Σ FarinhaFerm=0
}

/**
 * Pesos do fermento a partir do estado puro (refactor §5.3). Retorna null quando
 * as proporções são inválidas (refactor §5.6) — estado explícito, sem
 * NaN/Infinity, seguro para o recalc em lote (issue 008) que não pode ser
 * interrompido por throw (§1.6).
 */
export function computeSourdoughWeights(
  flourTotal: number,
  sourdoughPercentage: number,
  parts: SourdoughParts,
  flours: readonly SourdoughFlour[],
): SourdoughWeights | null {
  if (!isValidSourdoughParts(parts, flours)) return null; // refactor §5.6: bloqueio explícito

  const totalWeight = sourdoughTotalWeight(flourTotal, sourdoughPercentage); // W_ferm §3.B
  const denom = sourdoughDenominator(parts, flours); // > 0 garantido (refactor §5.6)
  const flourProp = sourdoughFlourProportionSum(flours); // Σ proporções das farinhas

  // Rateio pelo denominador GLOBAL (refactor §5.3): peso_linha = W_ferm × prop ÷ denom.
  const iscaWeight = (totalWeight * parts.isca) / denom; // refactor §5.3
  const waterWeight = (totalWeight * parts.water) / denom; // refactor §5.3
  // FarinhaFerm total = W_ferm × Σproporções-farinhas ÷ denom (= Σ dos pesos por farinha).
  const flourWeight = (totalWeight * flourProp) / denom; // refactor §5.3

  // Hidratação = ÁguaFerm ÷ Σ(FarinhaFerm) × 100 — SEMPRE derivada (refactor §5.5).
  // Σ FarinhaFerm = 0 → indefinida: null (UI exibe "—", §5.C/§5.5).
  const hydration = flourWeight === 0 ? null : (waterWeight / flourWeight) * 100;

  return { totalWeight, iscaWeight, flourWeight, waterWeight, hydration };
}

/**
 * Rateia a FarinhaFerm total entre as farinhas do fermento por proporção-share:
 * FarinhaFerm_i = FarinhaFerm × (prop_i ÷ Σproporções). refactor §5.3.
 * Equivale a W_ferm × prop_i ÷ denom (o denom global cancela). Σproporções=0 ou
 * FarinhaFerm=0 → todos 0 (sem NaN). Não muta a entrada (§1.6).
 */
export function distributeSourdoughFlourWeights(
  sourdoughFlourWeight: number,
  flours: readonly SourdoughFlour[],
): number[] {
  const sumProp = sourdoughFlourProportionSum(flours); // Σ proporções
  if (sumProp <= 0) return flours.map(() => 0); // §5.C: evita ÷0/NaN
  return flours.map((f) => (sourdoughFlourWeight * f.proportion) / sumProp); // refactor §5.3
}
