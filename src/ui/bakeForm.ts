/**
 * bakeForm.ts — Registro rápido de fornada (spec §14.2/§14.6) · issue 018.
 *
 * O que faz: `renderBakeForm(root, deps)` monta o formulário "Registrar
 * fornada" (§14.2): Receita (select das cadastradas via `recipeStore.list()`),
 * Data (padrão hoje, aaaa-mm-dd §7.1), Quantidade Produzida, Quantidade
 * Vendida, Custo Unitário e Preço de Venda Unitário (pré-preenchidos a partir
 * da receita selecionada via `recalculate` — 008 — mas SEMPRE editáveis:
 * snapshots congelados no momento do registro, §14.2) e Observações (texto
 * livre opcional).
 *
 * Validações (§14.6, reuso total — regra de ouro 2, zero fórmula nova):
 *  - `validateQuantityProduced` (≥1, bloqueio).
 *  - `validateQuantitySold` (≤ produzida, bloqueio §5.D).
 *  - `validateNonNegative` (custo/preço ≥0, bloqueio).
 *  - `validateBakeDate` (futura → aviso "planejada", nunca bloqueio) — `today`
 *    injetado via `deps.now` (nunca `new Date()` interno, pureza/teste).
 * Bloqueio reverte o campo ao último valor válido + `aria-invalid`/mensagem
 * nativa (`cellHelpers.applyValidation`, mesmo padrão de `pricingPanel.ts`/
 * `batchPanel.ts`). Aviso de data futura não reverte: apenas exibe o badge
 * `.badge-planned` (design-system.css, já existente — zero classe nova) e,
 * ao registrar, grava `planned:true` na fornada (§14.6) — some das
 * agregações até confirmação (`confirmPlanned`, historyView.ts).
 *
 * Datas — regra crítica (decisão 013.2/format.ts): lê `input.value` (string
 * aaaa-mm-dd) via `parseLocalDate` (NUNCA `new Date(str)`, que trata a string
 * como UTC e desloca o dia em fusos negativos); escreve de volta via
 * `formatDate`. Comparação de "futura" via `validateBakeDate` (lexicográfica
 * aaaa-mm-dd, sem fuso).
 *
 * Segurança (regra de ouro 3): `notes`/nome da receita nunca passam por
 * `innerHTML` — só via `h`/`textContent` (dom.ts); o valor de `notes` é
 * gravado cru na fornada (BakeEntry.notes é string livre) e só vira DOM,
 * escapado, na listagem (`historyView.ts`).
 *
 * Zero lógica de negócio nova: todo cálculo vem de `recalculate` (008) e das
 * predicados de `validation.ts` (010); este módulo só faz wiring de DOM +
 * `bakeStore.create` (013, storage).
 *
 * Seções implementadas: §14.2, §14.6, §7.1.
 */
import { recalculate } from '../core/recalc';
import { parseDecimal, formatDate, parseLocalDate } from '../core/format';
import {
  validateQuantityProduced,
  validateQuantitySold,
  validateNonNegative,
  validateBakeDate,
  type ValidationResult,
} from '../core/validation';
import type { BakeEntry } from '../core/types';
import type { RecipeStore } from '../storage/recipes';
import type { BakeStore } from '../storage/bakes';
import { h, on } from './dom';
import { applyValidation, moneyPlain } from './cellHelpers';

export interface BakeFormDeps {
  recipeStore: RecipeStore;
  bakeStore: BakeStore;
  /** Injetável para teste/pureza (default `() => new Date()`). §14.6: "hoje". */
  now?: () => Date;
  /** Notificado após um registro bem-sucedido (ex.: re-render da listagem). */
  onCreated?: (entry: BakeEntry) => void;
}

/** Liga um campo numérico ao padrão bloqueio-reverte (molde de batchPanel.ts/
 *  pricingPanel.ts, regra de ouro 2): `input`→atualiza livre; `blur`→valida,
 *  bloqueio reverte ao último valor válido. Devolve `commit()` para reuso no
 *  submit (garante consistência mesmo sem blur prévio). */
function bindNumericField(
  input: HTMLInputElement,
  validate: (parsed: number) => ValidationResult,
): () => number | null {
  let lastValid = '';
  function commit(): number | null {
    const parsed = parseDecimal(input.value);
    if (parsed === null) {
      input.value = lastValid;
      return parseDecimal(lastValid.replace(',', '.'));
    }
    const issue = validate(parsed);
    applyValidation(input, issue, () => {
      input.value = lastValid;
    });
    if (issue && issue.level === 'block') {
      return parseDecimal(lastValid.replace(',', '.'));
    }
    lastValid = input.value;
    return parsed;
  }
  on(input, 'blur', commit);
  return commit;
}

export function renderBakeForm(root: HTMLElement, deps: BakeFormDeps): void {
  const { recipeStore, bakeStore } = deps;
  const nowFn = deps.now ?? (() => new Date());

  const card = h('section', { className: 'card' });
  card.appendChild(h('h2', {}, ['Registrar fornada']));
  root.appendChild(card);

  const row = h('div', { className: 'row row--end' });
  card.appendChild(row);

  // --- Receita (§14.2) ---
  const recipeField = h('div', { className: 'field' });
  recipeField.appendChild(h('label', {}, ['Receita']));
  const recipeSelect = h('select', { className: 'input', 'aria-label': 'Receita' }) as HTMLSelectElement;
  recipeSelect.appendChild(h('option', { value: '' }, ['Selecione uma receita']));
  for (const r of recipeStore.list()) {
    recipeSelect.appendChild(h('option', { value: r.id }, [r.name])); // textContent — regra de ouro 3
  }
  recipeField.appendChild(recipeSelect);
  row.appendChild(recipeField);

  // --- Data (§14.2/§14.6) ---
  const dateField = h('div', { className: 'field' });
  dateField.appendChild(h('label', {}, ['Data']));
  const dateInput = h('input', {
    className: 'input',
    type: 'date',
    value: formatDate(nowFn()), // §14.2: padrão hoje
    'aria-label': 'Data',
  }) as HTMLInputElement;
  dateField.appendChild(dateInput);
  // `.hidden` (design-system.css, issue 022) — era style inline; default oculto,
  // `refreshPlannedBadge` (abaixo) alterna via `classList` conforme a data.
  const plannedBadge = h('span', { className: 'badge-planned hidden' }, ['◌ Planejada']);
  dateField.appendChild(plannedBadge);
  row.appendChild(dateField);

  // --- Quantidade Produzida (§14.2/§14.6) ---
  const producedField = h('div', { className: 'field' });
  producedField.appendChild(h('label', {}, ['Quantidade Produzida']));
  const producedInput = h('input', {
    className: 'input num',
    'aria-label': 'Quantidade Produzida',
  }) as HTMLInputElement;
  producedField.appendChild(producedInput);
  row.appendChild(producedField);

  // --- Quantidade Vendida (§14.2/§5.D/§14.6) ---
  const soldField = h('div', { className: 'field' });
  soldField.appendChild(h('label', {}, ['Quantidade Vendida']));
  const soldInput = h('input', { className: 'input num', 'aria-label': 'Quantidade Vendida' }) as HTMLInputElement;
  soldField.appendChild(soldInput);
  row.appendChild(soldField);

  // --- Custo Unitário (snapshot editável, §14.2) ---
  const costField = h('div', { className: 'field' });
  costField.appendChild(h('label', {}, ['Custo Unitário']));
  const costInput = h('input', { className: 'input num', 'aria-label': 'Custo Unitário' }) as HTMLInputElement;
  costField.appendChild(costInput);
  row.appendChild(costField);

  // --- Preço de Venda Unitário (snapshot editável, §14.2) ---
  const priceField = h('div', { className: 'field' });
  priceField.appendChild(h('label', {}, ['Preço de Venda Unitário']));
  const priceInput = h('input', {
    className: 'input num',
    'aria-label': 'Preço de Venda Unitário',
  }) as HTMLInputElement;
  priceField.appendChild(priceInput);
  row.appendChild(priceField);

  // --- Observações (texto livre opcional, §14.2 — NUNCA innerHTML) ---
  const notesFieldWrap = h('div', { className: 'field' });
  notesFieldWrap.appendChild(h('label', {}, ['Observações']));
  const notesInput = h('input', {
    className: 'input',
    'aria-label': 'Observações',
    placeholder: 'ex.: forno desregulado',
  }) as HTMLInputElement;
  notesFieldWrap.appendChild(notesInput);
  row.appendChild(notesFieldWrap);

  const submitBtn = h('button', { type: 'button', className: 'btn btn-primary' }, ['+ Registrar fornada']) as HTMLButtonElement;
  row.appendChild(submitBtn);

  const status = h('div', { className: 'form-status', role: 'status', 'aria-live': 'polite' });
  card.appendChild(status);

  function showStatus(message: string, kind: 'error' | 'ok'): void {
    status.textContent = message;
    status.classList.remove('form-status--error', 'form-status--ok');
    status.classList.add(kind === 'error' ? 'form-status--error' : 'form-status--ok');
  }

  // --- Pré-preenchimento por receita (§14.2, snapshot editável — recalculate 008) ---
  on(recipeSelect, 'change', () => {
    const recipe = recipeStore.list().find((r) => r.id === recipeSelect.value);
    if (!recipe) return;
    const { summary } = recalculate(recipe);
    if (summary.costPerUnit !== null) costInput.value = moneyPlain(summary.costPerUnit);
    if (summary.salePrice !== null) priceInput.value = moneyPlain(summary.salePrice);
  });

  // --- Aviso de data futura (§14.6 — aviso, nunca bloqueio) ---
  function refreshPlannedBadge(): void {
    const parsed = parseLocalDate(dateInput.value || formatDate(nowFn()));
    const issue = validateBakeDate(parsed, nowFn());
    plannedBadge.classList.toggle('hidden', issue === null);
  }
  on(dateInput, 'change', refreshPlannedBadge);
  on(dateInput, 'input', refreshPlannedBadge);
  refreshPlannedBadge();

  // --- Campos numéricos com bloqueio-reverte (§14.6) ---
  const commitProduced = bindNumericField(producedInput, (v) => validateQuantityProduced(v));
  const commitSold = bindNumericField(soldInput, (v) =>
    validateQuantitySold(v, parseDecimal(producedInput.value.replace(',', '.')) ?? 0),
  );
  const commitCost = bindNumericField(costInput, (v) => validateNonNegative(v, 'Custo Unitário'));
  const commitPrice = bindNumericField(priceInput, (v) => validateNonNegative(v, 'Preço de Venda Unitário'));

  on(submitBtn, 'click', () => {
    const recipe = recipeStore.list().find((r) => r.id === recipeSelect.value);
    if (!recipe) {
      showStatus('Selecione uma receita.', 'error');
      return;
    }

    // Recomita cada campo (mesmo sem blur prévio) — garante consistência (§14.6).
    const produced = commitProduced();
    const sold = commitSold();
    const cost = commitCost();
    const price = commitPrice();

    if (produced === null || validateQuantityProduced(produced) !== null) {
      showStatus('Corrija a quantidade produzida (mínimo 1) antes de registrar.', 'error');
      return;
    }
    if (sold === null || validateQuantitySold(sold, produced) !== null) {
      showStatus('Corrija a quantidade vendida (não pode exceder a produzida) antes de registrar.', 'error');
      return;
    }
    if (cost === null || validateNonNegative(cost, 'Custo Unitário') !== null) {
      showStatus('Corrija o custo unitário (não pode ser negativo) antes de registrar.', 'error');
      return;
    }
    if (price === null || validateNonNegative(price, 'Preço de Venda Unitário') !== null) {
      showStatus('Corrija o preço de venda unitário (não pode ser negativo) antes de registrar.', 'error');
      return;
    }

    const date = parseLocalDate(dateInput.value || formatDate(nowFn())); // §7.1: dia local, nunca UTC
    const dateIssue = validateBakeDate(date, nowFn()); // §14.6: aviso, nunca bloqueio
    const planned = dateIssue !== null;

    const seed: Partial<BakeEntry> = {
      recipeId: recipe.id,
      recipeName: recipe.name, // snapshot (§14.7)
      date,
      quantityProduced: produced,
      quantitySold: sold,
      unitCost: cost,
      unitSalePrice: price,
      notes: notesInput.value.trim() === '' ? undefined : notesInput.value,
    };
    if (planned) seed.planned = true;

    const created = bakeStore.create(seed);
    showStatus(planned ? 'Fornada planejada registrada.' : 'Fornada registrada.', 'ok');

    // Reseta campos de quantidade/observações; mantém a receita selecionada
    // para facilitar registros seguidos da mesma receita.
    producedInput.value = '';
    soldInput.value = '';
    notesInput.value = '';
    dateInput.value = formatDate(nowFn());
    refreshPlannedBadge();

    deps.onCreated?.(created);
  });
}
