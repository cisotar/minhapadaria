/**
 * validation.ts — Camada de validação (spec §5.A/§5.B/§5.C/§5.D/§14.6/§7.1).
 *
 * O que faz: traduz os PREDICADOS PUROS já existentes no core em resultados
 * {valid, level, message} pt-BR (§7.1), distinguindo bloqueio (reverte/impede na
 * UI) de aviso (permite o valor e apenas sinaliza) conforme §5. NÃO refaz
 * aritmética: soma-100, partes válidas, faixa de margem, prejuízo e formatação de
 * data vêm dos donos únicos (bakers/sourdough/pricing/format). Nunca redistribui
 * nem normaliza porcentagens (§5.A): validação só REPORTA — sem mutação, sem
 * retorno de array normalizado.
 *
 * Regras da spec respeitadas:
 *  - 100% lógica pura: sem DOM, sem localStorage, sem I/O (pasta core/).
 *  - Sem throw; sem arredondamento (§9 é só exibição): compara valores crus.
 *  - `today` é injetado em validateBakeDate — nunca `new Date()` interno
 *    (pureza/determinismo).
 *  - Contrato null = OK (o par {block|warn} não comporta "ok"), alinhado ao core.
 *  - Nenhuma dependência externa; nenhum acesso de rede; nenhum secret (§10/§11.1).
 *
 * Seções implementadas: §5.A, §5.B, §5.C, §5.D, §14.6, §7.1.
 */
import type { SourdoughParts } from './types';
// Reuso (regras de ouro #1/#2): donos únicos da aritmética/predicados.
import { percentagesSumTo100 } from './bakers';
import { isValidSourdoughParts } from './sourdough';
import { MARGIN_MIN, MARGIN_MAX, isLoss } from './pricing';
import { formatDate } from './format';

export type ValidationLevel = 'block' | 'warn';
export interface ValidationIssue {
  valid: boolean;
  level: ValidationLevel;
  message: string;
}
export type ValidationResult = ValidationIssue | null; // null = OK (nada a sinalizar)

/** Bloqueio: reverte/impede na UI (§5) ⇒ valid:false. */
function block(message: string): ValidationIssue {
  return { valid: false, level: 'block', message };
}

/** Aviso: permite o valor e apenas sinaliza (§5) ⇒ valid:true. */
function warn(message: string): ValidationIssue {
  return { valid: true, level: 'warn', message };
}

/** Rótulo de grupo de farinhas para as mensagens (§5.A/§5.B). */
type FlourGroup = 'principal' | 'fermento';

// ── §5.A — soma das % das farinhas (blur/Enter); NUNCA redistribui, só reporta ──
/**
 * Genérico sobre number[]: mesma regra para farinhas principais e do fermento
 * (§5.A/§5.B); delega ao dono único do epsilon anti-drift (percentagesSumTo100).
 * Não muta o array de entrada — validação só reporta (nenhuma redistribuição).
 */
export function validatePercentageSum(
  percentages: readonly number[],
  group: FlourGroup,
): ValidationResult {
  if (percentagesSumTo100(percentages)) return null; // §5.A
  const label = group === 'principal' ? 'principais' : 'do fermento';
  return block(`A soma das porcentagens das farinhas ${label} deve ser 100%.`);
}

// ── §5.B — mínimo 1 farinha por grupo ──
export function validateFlourCount(count: number, group: FlourGroup): ValidationResult {
  if (count >= 1) return null; // §5.B
  const label = group === 'principal' ? 'no grupo principal' : 'no fermento';
  return block(`É necessária ao menos 1 farinha ${label}.`);
}

// ── §5.C — validações gerais ──

/** Quantidade de produtos ≥ 1 (§5.C). */
export function validateProductQuantity(quantity: number): ValidationResult {
  if (quantity >= 1) return null; // §5.C
  return block('A quantidade de produtos deve ser no mínimo 1.');
}

/**
 * Não-negativo genérico (§5.C/§14.6): cobre custos de insumo, Preço Pago e
 * Custo/Preço Unitário do histórico — mesma regra ≥ 0, um só código.
 */
export function validateNonNegative(value: number, fieldLabel: string): ValidationResult {
  if (value >= 0) return null; // §5.C
  return block(`${fieldLabel} não pode ser negativo.`);
}

/** Partes do fermento: ≥ 0 e SomaPartes > 0 (§5.C) — reusa isValidSourdoughParts. */
export function validateSourdoughParts(parts: SourdoughParts): ValidationResult {
  if (isValidSourdoughParts(parts)) return null; // §5.C
  return block('As partes do fermento não podem ser negativas e a soma deve ser maior que zero.');
}

/** Parte de farinha do fermento = 0 → aviso: hidratação indefinida ("—") (§5.C). */
export function validateSourdoughFlourPart(flourPart: number): ValidationResult {
  if (flourPart !== 0) return null; // §5.C: >0 (ou <0) não é este aviso
  return warn('Parte de farinha do fermento é 0: a hidratação fica indefinida (—).');
}

/** Proporção do fermento: <0 bloqueia; =0 avisa (sem fermento); >0 OK (§5.C). */
export function validateSourdoughProportion(percentage: number): ValidationResult {
  if (percentage < 0) return block('A proporção do fermento não pode ser negativa.'); // §5.C
  if (percentage === 0) return warn('Proporção do fermento é 0%: nenhum fermento será usado.'); // §5.C
  return null;
}

/** Margem na faixa [0, 99,9] (§5.C) — reusa MARGIN_MIN/MARGIN_MAX (dono único). */
export function validateMargin(margin: number): ValidationResult {
  if (margin >= MARGIN_MIN && margin <= MARGIN_MAX) return null; // §5.C
  return block('A margem deve estar entre 0% e 99,9%.');
}

/** Preço ≤ custo unitário → aviso de prejuízo (§5.C) — reusa isLoss (break-even inclusivo). */
export function validatePriceVsUnitCost(salePrice: number, unitCost: number): ValidationResult {
  if (!isLoss(unitCost, salePrice)) return null; // §5.C: aviso, não bloqueio
  return warn('O preço de venda não cobre o custo unitário (prejuízo).');
}

/** Peso/Volume do produto > 0 (§5.C). */
export function validatePackageSize(packageSize: number): ValidationResult {
  if (packageSize > 0) return null; // §5.C
  return block('O peso/volume do produto deve ser maior que zero.');
}

// ── §5.D / §14.6 — histórico de fornadas ──

/** Quantidade produzida ≥ 1 (§14.6). */
export function validateQuantityProduced(produced: number): ValidationResult {
  if (produced >= 1) return null; // §14.6
  return block('A quantidade produzida deve ser no mínimo 1.');
}

/** Vendida ≥ 0 e vendida ≤ produzida (§5.D/§14.6). */
export function validateQuantitySold(sold: number, produced: number): ValidationResult {
  if (sold < 0) return block('A quantidade vendida não pode ser negativa.'); // §14.6
  if (sold > produced) return block('A quantidade vendida não pode exceder a produzida.'); // §5.D/§14.6
  return null;
}

/**
 * Data da fornada: futura → aviso "fornada planejada" (§14.6). Compara por
 * dia-calendário via string aaaa-mm-dd (formatDate, dono único) — comparação
 * lexicográfica evita fuso/UTC. `today` é injetado (pureza/determinismo).
 */
export function validateBakeDate(date: Date, today: Date): ValidationResult {
  // §7.1/§14.6: comparar strings aaaa-mm-dd (ordenáveis lexicograficamente).
  if (formatDate(date) > formatDate(today)) {
    return warn('Data futura: registrada como fornada planejada.');
  }
  return null;
}
