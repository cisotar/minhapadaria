/**
 * cellHelpers.ts — Helpers de célula compartilhados entre tabelas da UI (issue 015).
 *
 * O que faz: extrai de `ingredientsTable.ts` (issue 014) os três helpers que a
 * sub-receita do fermento (`sourdoughTable.ts`, §2.B) também precisa, evitando
 * duplicação (regra de ouro 2): `applyValidation` (bloqueio reverte + erro
 * nativo/aviso só anota, §5), `moneyPlain` (moeda sem "R$" no campo editável,
 * mockup) e `UNIT_OPTIONS` (opções de unidade da coluna "Peso do produto" por
 * categoria, §2.A.1/§7). Comportamento idêntico ao pré-extração — sem mudança
 * de lógica, só de local.
 *
 * Seções implementadas: §2.A.1, §5, §7, §9 (via format.ts).
 */
import { formatCurrency } from '../core/format';
import type { ValidationResult } from '../core/validation';
import type { Ingredient, PackageCost } from '../core/types';

/**
 * Opções de unidade da coluna "Peso do produto" por categoria (§2.A.1/§7):
 * sólidos em massa (kg/g); líquidos em volume (L/mL); gorduras podem ser
 * compradas por massa OU volume (g/kg/mL/L, como o Azeite do mockup).
 */
export const UNIT_OPTIONS: Record<Ingredient['category'], PackageCost['packageUnit'][]> = {
  flour: ['kg', 'g'],
  salt: ['kg', 'g'],
  extra: ['kg', 'g'],
  liquid: ['L', 'mL'],
  fat: ['g', 'kg', 'mL', 'L'],
};

/** Formata moeda (format.ts, dono único) e remove o prefixo "R$" — campo
 *  editável de Preço Pago mostra só o número (mockups/calculadora.html),
 *  sem reimplementar arredondamento/vírgula. */
export function moneyPlain(n: number): string {
  return formatCurrency(n).replace('R$', '').trim();
}

/**
 * Aplica o resultado de uma validação (010) a um input: bloqueio reverte
 * (callback do chamador) e sinaliza erro nativo; aviso não reverte, só
 * anota a mensagem. `null` limpa qualquer sinalização anterior.
 */
export function applyValidation(el: HTMLInputElement, issue: ValidationResult, revert: () => void): void {
  if (issue && issue.level === 'block') {
    revert();
    el.setCustomValidity(issue.message);
    el.reportValidity();
    el.setAttribute('aria-invalid', 'true');
  } else {
    el.setCustomValidity('');
    el.removeAttribute('aria-invalid');
    if (issue) {
      // aviso (§5.C): permite o valor, só sinaliza (ex.: proporção do fermento 0%).
      el.title = issue.message;
    } else {
      el.title = '';
    }
  }
}
