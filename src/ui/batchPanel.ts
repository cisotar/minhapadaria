/**
 * batchPanel.ts — Ancoragem e Planejamento da Fornada · issue 016, refatorado
 * (pedido do usuário, 2026-07-05): planejamento EXCLUSIVAMENTE por unidade.
 *
 * O que faz: `renderBatchPanel(root, store)` monta o card "Ancoragem e
 * Planejamento da Fornada" com apenas dois dados de entrada — Quantidade de
 * Produtos (`pricing.quantity`, também divisor de custo da Precificação,
 * §3.E) e Farinha por Unidade (`flourPerUnit`, §2.E.1) — e, isolado na
 * ÚLTIMA linha do card, o Peso Total de Farinha derivado (F_total =
 * F_unit × N) em destaque visual (`.metric`, design-system.css — nenhuma
 * classe nova).
 *
 * O modo de planejamento 'total' foi removido da UI: o card normaliza
 * qualquer receita que chegue com `batchPlanningMode: 'total'` (legado do
 * storage, volta do modo peso→% — `recalculate` força 'total' nesse modo)
 * para 'per-unit', preservando o peso corrente (F_unit = F_total / N, mesma
 * divisão trivial que recalc.ts já faz). O core continua suportando 'total'
 * (types.ts congelado, recalc/scaling intocados) — só a UI deixou de expor.
 *
 * Em peso→% (§1.3/§3.A) o F_total vem de Σ pesos das farinhas e a âncora por
 * unidade fica suspensa: Farinha por Unidade vira somente-leitura exibindo o
 * derivado F_total / N.
 *
 * Recálculo imediato (§1.6): `input`→`parseDecimal`→`store.update`;
 * `blur`→`validation.ts` (010, reuso) via `applyValidation` (cellHelpers.ts,
 * 015). Mudança ESTRUTURAL — `calculationMode` (muda a editabilidade de
 * F_unit) — dispara `fullRenderDynamic()`; qualquer outra mutação só repinta
 * o F_total da última linha e o F_unit derivado, nunca recria um input em
 * foco (mesmo padrão de `ingredientsTable.ts`, 014).
 *
 * Hospeda também o botão de modo (`renderModeToggle`, §1.3/§1.5) e o
 * escalonamento por peso alvo (`renderScalePanel`, §3.D/§1.6) — ambos
 * self-contained, montados uma única vez.
 *
 * Seções implementadas: §1.3, §1.5, §1.6, §2.E.1 (per-unit), §3.D, §5.C.
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
  // Normaliza legado/volta do modo alt: a UI só conhece per-unit. Preserva o
  // peso corrente (F_unit = F_total / N) em vez de zerar a receita.
  function ensurePerUnit(): boolean {
    const { recipe } = store.getState();
    if (recipe.calculationMode === 'percentage-to-weight' && recipe.batchPlanningMode !== 'per-unit') {
      store.update((draft) => {
        draft.flourPerUnit = draft.flourTotalWeight / Math.max(1, draft.pricing.quantity);
        draft.batchPlanningMode = 'per-unit';
      });
      return true;
    }
    return false;
  }
  ensurePerUnit();

  const card = h('section', { className: 'card' });
  card.appendChild(h('h2', {}, ['Ancoragem e Planejamento da Fornada']));
  root.appendChild(card);

  // `row--mb` (design-system.css) dá respiro vertical (--sp-4) antes do
  // `totalRow`: sem ele o `.metric` de fechamento — leitura mais evidente do
  // card (brandbook §3, hierarquia) — ficava colado na linha de campos
  // (feedback do usuário). Reuso puro, nenhum valor novo.
  const fieldRow = h('div', { className: 'row row--end row--mb' });
  card.appendChild(fieldRow);

  // Campos que mudam de estrutura conforme `calculationMode` (F_unit vira
  // somente-leitura em peso→%) — recriados por `fullRenderDynamic()`;
  // `display:contents` não participa do layout flex de `.row` (os `.field`
  // filhos é que são os itens flex), só agrupa para poder limpar/reconstruir.
  const dynamicFields = h('div', { className: 'contents' }); // `.contents` (design-system.css, issue 022)
  fieldRow.appendChild(dynamicFields);

  let funitInput: HTMLInputElement | null = null;

  /** F_unit exibido: âncora do usuário em %→peso; derivado (F_total / N) em peso→%. */
  function currentFUnit(): number {
    const { recipe } = store.getState();
    if (recipe.calculationMode === 'weight-to-percentage') {
      return recipe.flourTotalWeight / Math.max(1, recipe.pricing.quantity);
    }
    return recipe.flourPerUnit ?? 0;
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

  function buildFUnitField(): HTMLElement {
    const { recipe } = store.getState();
    // §1.3/§3.A: em peso→% as farinhas editadas mandam (F_total = Σ pesos) e a
    // âncora por unidade fica suspensa — campo somente-leitura com o derivado.
    const isAlt = recipe.calculationMode === 'weight-to-percentage';

    const field = h('div', { className: 'field' });
    field.appendChild(h('label', {}, ['Farinha por Unidade (F unit)']));
    const row = h('div', { className: 'row' });
    funitInput = h('input', {
      className: 'input num',
      value: formatWeight(currentFUnit()),
      readonly: isAlt,
      'aria-label': 'Farinha por Unidade',
    }) as HTMLInputElement;
    const input = funitInput;
    let lastValid = input.value;
    if (!isAlt) {
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
    }
    row.appendChild(input);
    row.appendChild(h('span', { className: 'unit-suffix' }, ['g']));
    field.appendChild(row);
    return field;
  }

  function fullRenderDynamic(): void {
    clear(dynamicFields);
    dynamicFields.appendChild(buildQtyField());
    dynamicFields.appendChild(buildFUnitField());
  }

  fullRenderDynamic();

  // Botão de modo (§1.3/§1.5) e escalonamento (§3.D) — montados uma única vez;
  // cada um gerencia sua própria reatividade via `store.subscribe` internamente.
  const modeField = h('div', { className: 'field' });
  modeField.appendChild(h('label', {}, ['Modo de cálculo']));
  renderModeToggle(modeField, store);
  fieldRow.appendChild(modeField);

  renderScalePanel(fieldRow, store);

  // ÚLTIMA linha do card, isolada: Peso Total de Farinha em destaque
  // (`.metric` — fundo sutil + valor grande em negrito, design-system.css).
  // Wrapper `.metric-pair` (não `.row`): mesmo idioma já usado no catálogo
  // (design-system.html) e no mockup para um `.metric` isolado ("Hidratação
  // resultante") — `.row` é para agrupar campos/botões, `.metric-pair` é o
  // container dedicado a `.metric`(s) de fechamento. Reuso, não invenção.
  const totalRow = h('div', { className: 'metric-pair' });
  const totalMetric = h('div', { className: 'metric' });
  totalMetric.appendChild(h('div', { className: 'label' }, ['Peso Total de Farinha (F total)']));
  const totalValue = h('div', { className: 'value', 'aria-label': 'Peso Total de Farinha' });
  totalMetric.appendChild(totalValue);
  totalRow.appendChild(totalMetric);
  card.appendChild(totalRow);

  /**
   * Repinta os derivados sem recriar inputs: o F_total da última linha muda
   * com QUALQUER edição relevante (F_unit, N, escalonamento §3.D, pesos das
   * farinhas em peso→%); o F_unit só é sobrescrito fora de foco (mesmo padrão
   * de não recriar/sobrescrever input em foco, ingredientsTable.ts) — cobre o
   * escalonamento, que grava `flourPerUnit` sem passar pelo input.
   */
  function patchDynamic(): void {
    const { recipe } = store.getState();
    totalValue.textContent = `${formatWeight(recipe.flourTotalWeight)} g`;
    if (funitInput && document.activeElement !== funitInput) {
      funitInput.value = formatWeight(currentFUnit());
    }
  }

  patchDynamic();

  let lastMode = store.getState().recipe.calculationMode;
  store.subscribe(() => {
    if (ensurePerUnit()) return; // o update aninhado re-notifica com o estado normalizado
    const { recipe } = store.getState();
    if (recipe.calculationMode !== lastMode) {
      lastMode = recipe.calculationMode;
      fullRenderDynamic(); // mudança estrutural: editabilidade de F_unit
    }
    patchDynamic();
  });
}
