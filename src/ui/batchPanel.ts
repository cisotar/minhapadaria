/**
 * batchPanel.ts — Ancoragem e Planejamento da Fornada (spec §2.E/§2.E.1) ·
 * issue 016.
 *
 * O que faz: `renderBatchPanel(root, store)` monta o card "Ancoragem e
 * Planejamento da Fornada" (mockup `mockups/calculadora.html`) com o toggle
 * `.period-toggle` Fornada inteira/Por unidade (`batchPlanningMode`), o campo
 * Peso de Farinha Total (editável em `percentage-to-weight`+`total`; derivado
 * somente-leitura em `per-unit`, §2.E.1 — F_total = F_unit × N — E também em
 * `weight-to-percentage`, §1.3/§3.A — F_total = Σ pesos das farinhas — ambos já
 * vêm prontos de `recalculate`, 008; issue 024 corrigiu o segundo caso, que
 * ficava editável-inerte e defasado), o campo Farinha por Unidade (só em
 * `per-unit`) e a Quantidade de
 * Produtos (`pricing.quantity`, sempre visível — é o N do per-unit E o
 * divisor de custo do painel de Precificação, §3.E). Hospeda também o botão
 * de modo (`renderModeToggle`, §1.3/§1.5) e o escalonamento por peso alvo
 * (`renderScalePanel`, §3.D/§1.6) — ambos self-contained (gerenciam sua
 * própria reatividade via `store.subscribe`), montados uma única vez para
 * não vazar assinaturas duplicadas a cada re-render estrutural deste painel.
 *
 * Recálculo imediato (§1.6): `input`→`parseDecimal`→`store.update` recalcula
 * na hora; `blur`→`validation.ts` (010, reuso) bloqueia/avisa via
 * `applyValidation` (cellHelpers.ts, 015). Mudança ESTRUTURAL — alternar
 * `batchPlanningMode` (mostra/esconde Farinha por Unidade, muda a
 * editabilidade de F_total) ou `calculationMode` (desabilita "Por unidade" e
 * também muda a editabilidade de F_total, §2.E.1/§1.3) — dispara
 * `fullRenderDynamic()`; qualquer outra mutação só repinta F_total quando ele
 * é derivado nos dois casos (per-unit OU peso→%, `patchDynamic`), nunca
 * recria um input em foco (mesmo padrão de `ingredientsTable.ts`, 014).
 *
 * Zero lógica de negócio nova: F_total/F_unit/Quantidade só formatam/validam
 * valores já derivados por `recalculate`; a única conta local é a
 * inicialização de `flourPerUnit`/`flourTotalWeight` ao trocar de modo de
 * planejamento (F_unit = F_total/N e vice-versa) — preserva o peso corrente
 * em vez de zerar a receita, mesma divisão trivial que `recalc.ts` já faz
 * (linha 73), não uma fórmula nova.
 *
 * Seções implementadas: §1.3, §1.5, §1.6, §2.E, §2.E.1, §3.D, §5.C.
 */
import { parseDecimal, formatWeight } from '../core/format';
import { validateNonNegative, validateProductQuantity, type ValidationResult } from '../core/validation';
import { h, clear, on } from './dom';
import type { AppStateStore } from './state';
import { applyValidation } from './cellHelpers';
import { renderModeToggle } from './modeToggle';
import { renderScalePanel } from './scalePanel';

/** Exibição de Quantidade (número livre, sem casas fixas em format.ts, §9) — só troca separador (§7.1), mesma convenção de `partsPlain` em sourdoughTable.ts. */
function quantityPlain(n: number): string {
  return String(n).replace('.', ',');
}

export function renderBatchPanel(root: HTMLElement, store: AppStateStore): void {
  const card = h('section', { className: 'card' });
  card.appendChild(h('h2', {}, ['Ancoragem e Planejamento da Fornada']));
  root.appendChild(card);

  const fieldRow = h('div', { className: 'row row--end' });
  card.appendChild(fieldRow);

  // Campos que mudam de estrutura conforme `batchPlanningMode`/`calculationMode`
  // (§2.E.1) — recriados por `fullRenderDynamic()`; `display:contents` não
  // participa do layout flex de `.row` (os `.field` filhos é que são
  // os itens flex), só agrupa o container para poder limpar/reconstruir.
  const dynamicFields = h('div', { className: 'contents' }); // `.contents` (design-system.css, issue 022)
  fieldRow.appendChild(dynamicFields);

  let ftotalInput: HTMLInputElement | null = null;

  function buildPlanningToggle(): HTMLElement {
    const { recipe } = store.getState();
    const isPerUnit = recipe.batchPlanningMode === 'per-unit';
    const isAlt = recipe.calculationMode === 'weight-to-percentage';

    const field = h('div', { className: 'field' });
    field.appendChild(h('label', {}, ['Modo de planejamento']));
    const toggle = h('div', { className: 'period-toggle' });
    const totalBtn = h('button', { type: 'button' }, ['Fornada inteira']) as HTMLButtonElement;
    const perUnitBtn = h(
      'button',
      { type: 'button', disabled: isAlt }, // §2.E.1: indisponível em peso→%
      ['Por unidade'],
    ) as HTMLButtonElement;
    totalBtn.classList.toggle('active', !isPerUnit);
    perUnitBtn.classList.toggle('active', isPerUnit);

    on(totalBtn, 'click', () => {
      store.update((draft) => {
        if (draft.batchPlanningMode !== 'total') {
          // Preserva o peso corrente ao trocar de âncora (F_total = F_unit × N).
          draft.flourTotalWeight = (draft.flourPerUnit ?? 0) * Math.max(1, draft.pricing.quantity);
          draft.batchPlanningMode = 'total';
        }
      });
    });
    on(perUnitBtn, 'click', () => {
      if (isAlt) return; // §2.E.1
      store.update((draft) => {
        if (draft.batchPlanningMode !== 'per-unit') {
          // Inicializa F_unit a partir do F_total corrente (mesma divisão trivial de recalc.ts).
          draft.flourPerUnit = draft.flourTotalWeight / Math.max(1, draft.pricing.quantity);
          draft.batchPlanningMode = 'per-unit';
        }
      });
    });

    toggle.appendChild(totalBtn);
    toggle.appendChild(perUnitBtn);
    field.appendChild(toggle);
    return field;
  }

  function buildFTotalField(): HTMLElement {
    const { recipe } = store.getState();
    const isPerUnit = recipe.batchPlanningMode === 'per-unit';
    // §1.3/§3.A: em peso→% o core sempre deriva F_total (Σ pesos das
    // farinhas), independente do planejamento (que fica forçado a 'total',
    // §2.E.1) — o campo também vira somente-leitura nesse modo (issue 024,
    // achado médio: editável-inerte + defasado antes desta correção).
    const isWeightToPct = recipe.calculationMode === 'weight-to-percentage';
    const isDerived = isPerUnit || isWeightToPct;

    const field = h('div', { className: 'field' });
    field.appendChild(h('label', {}, ['Peso de Farinha Total (F total)']));
    const row = h('div', { className: 'row' });
    ftotalInput = h('input', {
      className: 'input num',
      value: formatWeight(recipe.flourTotalWeight),
      readonly: isDerived, // §2.E.1/§1.3: F_total é derivado (F_unit × N, ou Σ farinhas em peso→%)
      'aria-label': 'Peso de Farinha Total',
    }) as HTMLInputElement;
    const input = ftotalInput;
    let lastValid = input.value;
    if (!isDerived) {
      on(input, 'input', () => {
        const parsed = parseDecimal(input.value);
        if (parsed === null) return;
        store.update((draft) => {
          draft.flourTotalWeight = parsed;
        });
      });
      on(input, 'blur', () => {
        const parsed = parseDecimal(input.value);
        if (parsed === null) {
          input.value = lastValid;
          return;
        }
        const issue = validateNonNegative(parsed, 'Peso de Farinha Total');
        applyValidation(input, issue, () => {
          input.value = lastValid;
          const reverted = parseDecimal(lastValid.replace(',', '.'));
          if (reverted !== null) {
            store.update((draft) => {
              draft.flourTotalWeight = reverted;
            });
          }
        });
        if (!issue || issue.level !== 'block') {
          lastValid = formatWeight(parsed);
          input.value = lastValid;
        }
      });
    }
    row.appendChild(input);
    row.appendChild(h('span', { className: 'unit-suffix' }, ['g']));
    field.appendChild(row);
    return field;
  }

  function buildFUnitField(): HTMLElement {
    const { recipe } = store.getState();
    const field = h('div', { className: 'field' });
    field.appendChild(h('label', {}, ['Farinha por Unidade (F unit)']));
    const row = h('div', { className: 'row' });
    const input = h('input', {
      className: 'input num',
      value: formatWeight(recipe.flourPerUnit ?? 0),
      'aria-label': 'Farinha por Unidade',
    }) as HTMLInputElement;
    let lastValid = input.value;
    on(input, 'input', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.flourPerUnit = parsed;
      });
    });
    on(input, 'blur', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) {
        input.value = lastValid;
        return;
      }
      const issue = validateNonNegative(parsed, 'Farinha por Unidade');
      applyValidation(input, issue, () => {
        input.value = lastValid;
        const reverted = parseDecimal(lastValid.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.flourPerUnit = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValid = formatWeight(parsed);
        input.value = lastValid;
      }
    });
    row.appendChild(input);
    row.appendChild(h('span', { className: 'unit-suffix' }, ['g']));
    field.appendChild(row);
    return field;
  }

  function buildQtyField(): HTMLElement {
    const { recipe } = store.getState();
    const field = h('div', { className: 'field' });
    field.appendChild(h('label', {}, ['Quantidade de Produtos']));
    const input = h('input', {
      className: 'input num',
      value: quantityPlain(recipe.pricing.quantity),
      'aria-label': 'Quantidade de Produtos',
    }) as HTMLInputElement;
    let lastValid = input.value;
    on(input, 'input', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.pricing.quantity = parsed;
      });
    });
    on(input, 'blur', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) {
        input.value = lastValid;
        return;
      }
      const issue: ValidationResult = validateProductQuantity(parsed); // §5.C: ≥ 1
      applyValidation(input, issue, () => {
        input.value = lastValid;
        const reverted = parseDecimal(lastValid.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.pricing.quantity = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValid = quantityPlain(parsed);
        input.value = lastValid;
      }
    });
    field.appendChild(input);
    return field;
  }

  function fullRenderDynamic(): void {
    clear(dynamicFields);
    dynamicFields.appendChild(buildPlanningToggle());
    dynamicFields.appendChild(buildFTotalField());
    if (store.getState().recipe.batchPlanningMode === 'per-unit') {
      dynamicFields.appendChild(buildFUnitField());
    }
    dynamicFields.appendChild(buildQtyField());
  }

  /** Repinta F_total quando ele é o campo derivado (per-unit OU peso→%, §1.3/§3.A/issue 024) — nunca recria um input em foco. */
  function patchDynamic(): void {
    const { recipe } = store.getState();
    const isDerived = recipe.batchPlanningMode === 'per-unit' || recipe.calculationMode === 'weight-to-percentage';
    if (isDerived && ftotalInput) {
      ftotalInput.value = formatWeight(recipe.flourTotalWeight);
    }
  }

  fullRenderDynamic();

  let lastMode = store.getState().recipe.calculationMode;
  let lastPlanning = store.getState().recipe.batchPlanningMode;
  store.subscribe(() => {
    const { recipe } = store.getState();
    if (recipe.calculationMode !== lastMode || recipe.batchPlanningMode !== lastPlanning) {
      lastMode = recipe.calculationMode;
      lastPlanning = recipe.batchPlanningMode;
      fullRenderDynamic(); // mudança estrutural (§2.E.1)
    } else {
      patchDynamic();
    }
  });

  // Botão de modo (§1.3/§1.5) e escalonamento (§3.D) — montados uma única vez;
  // cada um gerencia sua própria reatividade via `store.subscribe` internamente.
  const modeField = h('div', { className: 'field' });
  modeField.appendChild(h('label', {}, ['Modo de cálculo']));
  renderModeToggle(modeField, store);
  fieldRow.appendChild(modeField);

  renderScalePanel(fieldRow, store);
}
