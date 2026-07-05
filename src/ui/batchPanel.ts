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
 * Refactor de múltiplas farinhas (2026-07-05, aprovado — `mockups/
 * calculadora-farinhas.html`): o card ganha, entre a linha de campos-âncora e
 * a métrica final de F_total, a tabela "Farinhas" — colunas análogas a
 * Ingredientes MENOS "Unidade" (farinha é sempre g). Fonte de verdade
 * continua sendo `recipe.ingredients` com `category:'flour'` (decisão
 * travada — NÃO existe `recipe.flours`; o core já deriva peso = %/100×F_total
 * por linha, `recalc.ts`, sem fórmula nova aqui). Mesmo padrão de "sub-receita
 * consumida" já usado pelo Fermento (`sourdoughTable.ts` define a composição;
 * a linha "Fermento" de `ingredientsTable.ts` só consome, somente-leitura) —
 * aqui é o inverso simétrico: esta tabela DEFINE as farinhas (edição) e as N
 * linhas de farinha da tabela Ingredientes (`ingredientsTable.ts`) CONSOMEM
 * (somente-leitura, sem botão remover).
 * Reatividade: add/remove/troca de unidade/troca de `calculationMode` são
 * mudança ESTRUTURAL (`fullRenderFlours()`); qualquer outra mutação só
 * repinta as células derivadas + tfoot (`patchFlourDerived()`), nunca recria
 * um input em foco (mesmo padrão do resto do arquivo/`ingredientsTable.ts`).
 *
 * Ajuste de comportamento pedido pelo cliente após teste (2026-07-05) — DESVIO
 * CONSCIENTE da spec §2.A/§5.A (trava-100%/soma obrigatória bloqueante), não
 * bug:
 *  1. A trava-100% da farinha única foi eliminada em `percentage-to-weight`:
 *     a % é SEMPRE editável, mesmo com 1 farinha só. Motivo relatado pelo
 *     cliente: com várias farinhas partindo de 0%, bloquear cada blur com
 *     Σ≠100 (o comportamento antigo) tornava IMPOSSÍVEL chegar a 100% — cada
 *     tentativa intermediária era revertida antes de a próxima linha ser
 *     ajustada. Em `weight-to-percentage` a % continua derivada/readonly pela
 *     inversão de modo (§1.3) — isso não mudou.
 *  2. O blur da % NUNCA mais reverte aqui: troca `validatePercentageSum`
 *     (bloqueio) por `validateFlourPercentageSumSoft` (`validation.ts`,
 *     aditivo) — sempre `warn` (nunca `block`), então `applyValidation`
 *     (cellHelpers.ts) nunca chama `revert()`. Mensagens: soma=100 → nada;
 *     <100 → "Faltam X% para 100%."; >100 → "Excede 100% em X% — reduza."
 *     (exibida via `el.title`, §5).
 *  3. Escopo do desvio: SÓ a tabela de farinhas PRINCIPAIS (esta, batchPanel.ts).
 *     O fermento segue por proporção livre (fase 2, refactor §5.6 — não há mais
 *     regra "somar 100" nas farinhas do fermento); a proporção do fermento em si
 *     usa `validateSourdoughProportion`. Ver `sourdoughTable.ts`.
 *
 * Ajuste de UX (2026-07-06, pedido do cliente): o aviso de Σ% só como
 * `el.title` (tooltip de hover) não é "visto" sem ação do usuário. Adicionado
 * um chip VISÍVEL logo abaixo da tabela de Farinhas (`flourSumChip`) — reusa
 * `.chip`/`.chip-ok`/`.chip-warn` (design-system.css, mesmo padrão de
 * `pricingPanel.ts`/`recipesList.ts`, nenhuma classe nova) e a MESMA função/
 * mensagem do `title` (`validateFlourPercentageSumSoft`, sem duplicar
 * cálculo): `chip-ok`/"✓ 100%" quando `issue === null`; `chip-warn` com
 * `issue.message` ("Faltam X% para 100%."/"Excede 100% em X% — reduza.")
 * caso contrário. Repintado em `patchFlourDerived()` — mesmo caminho reativo
 * dos demais derivados, nunca recria input em foco. Fica FORA do `<tfoot>`
 * (não altera a estrutura/largura das colunas); só existe na tabela de
 * Farinhas — Ingredientes não tem essa regra de soma.
 *
 * Seções implementadas: §1.3, §1.5, §1.6, §2.A.2, §2.E.1 (per-unit), §3.D, §5.B,
 * §5.C.
 */
import { parseDecimal, formatWeight, formatPercent, formatCurrency, formatCostPerGram } from '../core/format';
import {
  validateNonNegative,
  validateProductQuantity,
  validateFlourPercentageSumSoft,
  validateFlourCount,
  validatePackageSize,
  type ValidationResult,
} from '../core/validation';
import { flourTotal } from '../core/bakers'; // reuso (regra de ouro 2): Σ pesos das farinhas = F_total (tfoot)
import type { Ingredient, PackageCost } from '../core/types';
import { h, clear, on } from './dom';
import type { AppStateStore } from './state';
import { applyValidation, setDerivedDisplay, UNIT_OPTIONS, moneyPlain } from './cellHelpers';
import { renderModeToggle } from './modeToggle';
import { renderScalePanel } from './scalePanel';

/**
 * Referências às células derivadas de uma linha de farinha — únicas repintadas
 * via `store.subscribe` (mesmo contrato de `RowRefs` em ingredientsTable.ts):
 * exatamente um de `derivedWeightTarget`/`derivedPctTarget` é não-nulo por
 * linha, conforme o modo vigente no momento do `fullRenderFlours()` (§1.3).
 */
interface FlourRowRefs {
  derivedWeightTarget: HTMLElement | null;
  derivedPctTarget: HTMLElement | null;
  costGCell: HTMLElement;
  costCell: HTMLElement;
}
interface FlourFootRefs {
  pctCell: HTMLElement;
  weightCell: HTMLElement;
  costCell: HTMLElement;
}

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

  // ============ NOVA TABELA: Farinhas (dentro do card Ancoragem, entre a
  // linha de campos-âncora e a métrica final de F_total — mockup
  // `calculadora-farinhas.html`) ============
  card.appendChild(h('h2', {}, ['Farinhas']));
  card.appendChild(
    h('p', { className: 'sub-recipe-note' }, [
      '↳ Consumidas pelas linhas de ',
      h('strong', {}, ['farinha']),
      ' da tabela Ingredientes abaixo — a % é relativa ao total de farinha e deve somar 100%.',
    ]),
  );
  const flourTable = h('table', { className: 'table' }) as HTMLTableElement;
  card.appendChild(flourTable);

  // Aviso VISÍVEL de Σ% (pedido do cliente, 2026-07-06): o `title` no blur
  // (abaixo, em `buildFlourRow`) é só tooltip de hover — não é "visto" sem
  // ação do usuário. Chip logo abaixo da tabela, fora do tfoot (não quebra o
  // layout das colunas): `.chip`/`.chip-ok`/`.chip-warn` (design-system.css,
  // reuso — mesmo padrão de `pricingPanel.ts`/`recipesList.ts`, nenhuma classe
  // nova). Texto/estado reaproveitam `validateFlourPercentageSumSoft` (core,
  // mesma função/mensagem do aviso de `title` — não duplica cálculo/msg);
  // `issue === null` decide ok/warn.
  const flourSumRow = h('div', { className: 'row row--tight mb-3' });
  const flourSumChip = h('span', { className: 'chip' });
  flourSumRow.appendChild(flourSumChip);
  card.appendChild(flourSumRow);

  let flourRowRefs = new Map<string, FlourRowRefs>();
  let flourFootRefs: FlourFootRefs | null = null;

  function buildFlourThead(): HTMLTableSectionElement {
    const thead = h('thead');
    thead.appendChild(
      h('tr', {}, [
        h('th', {}, ['Farinha']),
        h('th', { className: 'num' }, ['%']),
        h('th', { className: 'num' }, ['Peso (g)']),
        h('th', { className: 'num cost-col' }, ['Preço pago']),
        h('th', { className: 'num cost-col' }, ['Peso do produto']),
        h('th', { className: 'num cost-col' }, ['Custo/g']),
        h('th', { className: 'num cost-col' }, ['Custo']),
        h('th', { className: 'col-actions', 'aria-label': 'Ações' }),
      ]),
    );
    return thead;
  }

  /**
   * Linha de farinha: colunas análogas a `buildIngredientRow`
   * (ingredientsTable.ts) MENOS "Unidade" (farinha sempre g) — mesma
   * sensibilidade a modo (§1.3): em `percentage-to-weight` a % é editável
   * (trava 100% se única farinha) e o Peso é derivado; em
   * `weight-to-percentage` o Peso vira editável e a % passa a derivada
   * (input readonly com a classe `pct`, destaque do banner §1.3).
   */
  function buildFlourRow(
    ing: Ingredient,
    index: number,
    flourCount: number,
  ): { tr: HTMLTableRowElement; refs: FlourRowRefs } {
    const tr = h('tr') as HTMLTableRowElement;
    tr.dataset.flourId = ing.id; // âncora estável para localizar a linha (repintura/testes)
    const label = ing.name || 'farinha';

    // Nome — editável, nunca via innerHTML (regra de ouro 3).
    const nameInput = h('input', {
      className: 'cell-input',
      value: ing.name,
      'aria-label': 'Nome da farinha',
    }) as HTMLInputElement;
    on(nameInput, 'input', () => {
      store.update((draft) => {
        draft.ingredients[index].name = nameInput.value;
      });
    });

    // §5.B: mínimo 1 farinha — trava o botão remover da última.
    const wouldBeFlourCount = flourCount - 1;
    const removeIssue = validateFlourCount(wouldBeFlourCount, 'principal');
    const removeBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        title: removeIssue ? removeIssue.message : 'Remover farinha',
        'aria-label': `Remover ${label}`,
        disabled: Boolean(removeIssue),
      },
      ['×'],
    ) as HTMLButtonElement;
    if (!removeIssue) {
      on(removeBtn, 'click', () => {
        store.update((draft) => {
          draft.ingredients = draft.ingredients.filter((i) => i.id !== ing.id);
        });
        fullRenderFlours(); // add/remove é mudança estrutural (§5.B)
      });
    }
    const nameCell = h('td', {}, [nameInput]);
    const actionsCell = h('td', { className: 'col-actions' }, [removeBtn]);

    // Modo de cálculo (§1.3) — decide qual dos dois campos (% ou Peso) é a
    // fonte de verdade editável desta linha. Desvio consciente do cliente
    // (2026-07-05, ver cabeçalho do arquivo): a trava-100% da farinha única
    // foi ELIMINADA — em `percentage-to-weight` a % é SEMPRE editável, mesmo
    // com 1 farinha só; só `weight-to-percentage` a torna derivada/readonly.
    const mode = store.getState().recipe.calculationMode;
    const isWeightToPct = mode === 'weight-to-percentage';
    const pctReadonly = isWeightToPct;

    const pctInput = h('input', {
      className: 'cell-input num pct',
      value: formatPercent(ing.percentage),
      readonly: pctReadonly,
      'aria-label': `Porcentagem de ${label}`,
    }) as HTMLInputElement;
    let lastValidPct = pctInput.value;
    if (!pctReadonly) {
      on(pctInput, 'input', () => {
        const parsed = parseDecimal(pctInput.value);
        if (parsed === null) return;
        store.update((draft) => {
          draft.ingredients[index].percentage = parsed;
        });
      });
      on(pctInput, 'blur', () => {
        const parsed = parseDecimal(pctInput.value);
        if (parsed === null) {
          pctInput.value = lastValidPct;
          return;
        }
        // Desvio consciente do cliente (2026-07-05, ver cabeçalho do arquivo):
        // versão SOFT — NUNCA bloqueia/reverte, só avisa (§5.A soft). Com N
        // farinhas partindo de 0, bloquear cada blur com Σ≠100 tornava
        // impossível chegar a 100%.
        const issue: ValidationResult = validateFlourPercentageSumSoft(
          store
            .getState()
            .recipe.ingredients.filter((i) => i.category === 'flour')
            .map((i) => i.percentage),
        );
        applyValidation(pctInput, issue, () => {
          pctInput.value = lastValidPct;
          const reverted = parseDecimal(lastValidPct);
          if (reverted !== null) {
            store.update((draft) => {
              draft.ingredients[index].percentage = reverted;
            });
          }
        });
        // `issue` aqui é sempre `null` ou `warn` (nunca `block`) — o valor
        // digitado NUNCA é revertido (só reformatado com 2 casas, §9).
        lastValidPct = formatPercent(parsed);
        pctInput.value = lastValidPct;
      });
    }
    const pctCell = h('td', { className: isWeightToPct ? 'num readonly' : 'num' }, [pctInput]);

    // Peso — derivado (texto plano) no modo padrão; editável em peso→% (§1.3).
    let weightCell: HTMLElement;
    if (!isWeightToPct) {
      weightCell = h('td', { className: 'num readonly' });
      weightCell.textContent = formatWeight(ing.weight);
    } else {
      const wInput = h('input', {
        className: 'cell-input num',
        value: formatWeight(ing.weight),
        'aria-label': `Peso de ${label}`,
      }) as HTMLInputElement;
      let lastValidWeight = wInput.value;
      on(wInput, 'input', () => {
        const parsed = parseDecimal(wInput.value);
        if (parsed === null) return;
        store.update((draft) => {
          draft.ingredients[index].weight = parsed;
        });
      });
      on(wInput, 'blur', () => {
        const parsed = parseDecimal(wInput.value);
        if (parsed === null) {
          wInput.value = lastValidWeight;
          return;
        }
        const issue = validateNonNegative(parsed, 'Peso');
        applyValidation(wInput, issue, () => {
          wInput.value = lastValidWeight;
          const reverted = parseDecimal(lastValidWeight.replace(',', '.'));
          if (reverted !== null) {
            store.update((draft) => {
              draft.ingredients[index].weight = reverted;
            });
          }
        });
        if (!issue || issue.level !== 'block') {
          lastValidWeight = formatWeight(parsed);
          wInput.value = lastValidWeight;
        }
      });
      weightCell = h('td', { className: 'num' }, [wInput]);
    }

    // Preço Pago — editável (§2.A.1); ≥ 0 (§5.C).
    const priceInput = h('input', {
      className: 'cell-input num',
      value: moneyPlain(ing.packageCost.pricePaid),
      'aria-label': `Preço pago de ${label}`,
    }) as HTMLInputElement;
    let lastValidPrice = priceInput.value;
    on(priceInput, 'input', () => {
      const parsed = parseDecimal(priceInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.ingredients[index].packageCost.pricePaid = parsed;
      });
    });
    on(priceInput, 'blur', () => {
      const parsed = parseDecimal(priceInput.value);
      if (parsed === null) {
        priceInput.value = lastValidPrice;
        return;
      }
      const issue = validateNonNegative(parsed, 'Preço Pago');
      applyValidation(priceInput, issue, () => {
        priceInput.value = lastValidPrice;
        const reverted = parseDecimal(lastValidPrice.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.ingredients[index].packageCost.pricePaid = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidPrice = moneyPlain(parsed);
        priceInput.value = lastValidPrice;
      }
    });
    const priceCell = h('td', { className: 'num cost-col' }, [priceInput]);

    // Peso do Produto — par valor + unidade (.pw-combo, §2.A.1).
    const pwValInput = h('input', {
      className: 'cell-input num',
      value: formatWeight(ing.packageCost.packageSize),
      'aria-label': `Peso do produto de ${label}`,
      size: 6,
    }) as HTMLInputElement;
    let lastValidPw = pwValInput.value;
    on(pwValInput, 'input', () => {
      const parsed = parseDecimal(pwValInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.ingredients[index].packageCost.packageSize = parsed;
      });
    });
    on(pwValInput, 'blur', () => {
      const parsed = parseDecimal(pwValInput.value);
      if (parsed === null) {
        pwValInput.value = lastValidPw;
        return;
      }
      const issue = validatePackageSize(parsed); // §5.C: impede ÷0 no Custo/g
      applyValidation(pwValInput, issue, () => {
        pwValInput.value = lastValidPw;
        const reverted = parseDecimal(lastValidPw.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.ingredients[index].packageCost.packageSize = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidPw = formatWeight(parsed);
        pwValInput.value = lastValidPw;
      }
    });
    const pwUnitSelect = h('select', {
      className: 'cell-input',
      'aria-label': `Unidade do peso do produto de ${label}`,
    }) as HTMLSelectElement;
    for (const u of UNIT_OPTIONS.flour) {
      pwUnitSelect.appendChild(h('option', { value: u }, [u]));
    }
    pwUnitSelect.value = ing.packageCost.packageUnit;
    on(pwUnitSelect, 'change', () => {
      store.update((draft) => {
        draft.ingredients[index].packageCost.packageUnit = pwUnitSelect.value as PackageCost['packageUnit'];
      });
      fullRenderFlours(); // troca de unidade é mudança estrutural (mesmo padrão de ingredientsTable.ts)
    });
    const pwCell = h('td', { className: 'num cost-col' }, [
      h('div', { className: 'pw-combo' }, [pwValInput, pwUnitSelect]),
    ]);

    // Custo/g e Custo — derivados, texto plano.
    const costGCell = h('td', { className: 'num cost-col readonly' });
    costGCell.textContent = ing.costPerGram !== undefined ? formatCostPerGram(ing.costPerGram) : '—';
    const costCell = h('td', { className: 'num cost-col readonly' });
    costCell.textContent = ing.recipeCost !== undefined ? formatCurrency(ing.recipeCost) : '—';

    tr.appendChild(nameCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(actionsCell);

    return {
      tr,
      refs: {
        derivedWeightTarget: isWeightToPct ? null : weightCell,
        derivedPctTarget: isWeightToPct ? pctInput : null,
        costGCell,
        costCell,
      },
    };
  }

  function buildAddFlourRow(): HTMLTableRowElement {
    const tr = h('tr') as HTMLTableRowElement;
    const addBtn = h(
      'button',
      { type: 'button', className: 'btn btn-secondary btn-sm' },
      ['+ farinha'],
    ) as HTMLButtonElement;
    on(addBtn, 'click', () => {
      store.update((draft) => {
        draft.ingredients.push({
          id: crypto.randomUUID(),
          name: '',
          category: 'flour',
          weight: 0,
          percentage: 0,
          packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' },
        });
      });
      fullRenderFlours(); // add/remove é mudança estrutural
    });
    // colspan = nº de colunas desta tabela (sem "Unidade"): Farinha·%·Peso·Preço·PesoProduto·Custo/g·Custo·Ações
    tr.appendChild(h('td', { colspan: 8, className: 'table-add-cell' }, [addBtn]));
    return tr;
  }

  function buildFlourTfoot(): { tfoot: HTMLTableSectionElement; refs: FlourFootRefs } {
    const tfoot = h('tfoot');
    const pctCell = h('td', { className: 'num' });
    const weightCell = h('td', { className: 'num' });
    const costCell = h('td', { className: 'num cost-col' });
    tfoot.appendChild(
      h('tr', {}, [
        h('td', {}, ['Total de farinha']),
        pctCell,
        weightCell,
        h('td', { className: 'cost-col', colspan: 3 }),
        costCell,
        h('td'),
      ]),
    );
    return { tfoot, refs: { pctCell, weightCell, costCell } };
  }

  function fullRenderFlours(): void {
    clear(flourTable);
    flourTable.classList.toggle('show-costs', store.showCosts());
    flourTable.appendChild(buildFlourThead());

    const tbody = h('tbody');
    flourRowRefs = new Map();
    const { recipe } = store.getState();
    const flours = recipe.ingredients
      .map((ing, index) => ({ ing, index }))
      .filter(({ ing }) => ing.category === 'flour');
    flours.forEach(({ ing, index }) => {
      const { tr, refs } = buildFlourRow(ing, index, flours.length);
      flourRowRefs.set(ing.id, refs);
      tbody.appendChild(tr);
    });
    tbody.appendChild(buildAddFlourRow());
    flourTable.appendChild(tbody);

    const built = buildFlourTfoot();
    flourFootRefs = built.refs;
    flourTable.appendChild(built.tfoot);

    patchFlourDerived(); // sincroniza valores exibidos com o estado atual
  }

  /**
   * Repinta só as células derivadas + tfoot da tabela de Farinhas — nunca
   * recria um input em foco (mesmo padrão do resto do arquivo). Soma de
   * exibição do tfoot (%/custo): mesma decisão registrada em
   * ingredientsTable.ts (core fora de escopo) — trivial, sem fórmula nova; o
   * peso total reusa `flourTotal` (bakers.ts, regra de ouro 2) = F_total.
   */
  function patchFlourDerived(): void {
    const { recipe } = store.getState();
    flourTable.classList.toggle('show-costs', store.showCosts());
    let sumPct = 0;
    let sumCost = 0;
    for (const [id, refs] of flourRowRefs) {
      const ing = recipe.ingredients.find((i) => i.id === id);
      if (!ing) continue;
      if (refs.derivedWeightTarget) setDerivedDisplay(refs.derivedWeightTarget, formatWeight(ing.weight));
      else if (refs.derivedPctTarget) setDerivedDisplay(refs.derivedPctTarget, formatPercent(ing.percentage));
      refs.costGCell.textContent = ing.costPerGram !== undefined ? formatCostPerGram(ing.costPerGram) : '—';
      refs.costCell.textContent = ing.recipeCost !== undefined ? formatCurrency(ing.recipeCost) : '—';
      sumPct += ing.percentage;
      sumCost += ing.recipeCost ?? 0;
    }
    if (flourFootRefs) {
      flourFootRefs.pctCell.textContent = formatPercent(sumPct);
      flourFootRefs.weightCell.textContent = formatWeight(flourTotal(recipe.ingredients));
      flourFootRefs.costCell.textContent = formatCurrency(sumCost);
    }

    // Chip visível de Σ% (ver comentário na criação do elemento acima) — mesma
    // função/mensagem do aviso de `title` do blur, nenhum cálculo duplicado.
    const flourPercentages = recipe.ingredients.filter((i) => i.category === 'flour').map((i) => i.percentage);
    const sumIssue = validateFlourPercentageSumSoft(flourPercentages);
    flourSumChip.classList.remove('chip-ok', 'chip-warn');
    if (sumIssue === null) {
      flourSumChip.classList.add('chip-ok');
      flourSumChip.textContent = '✓ 100%';
    } else {
      flourSumChip.classList.add('chip-warn');
      flourSumChip.textContent = sumIssue.message;
    }
  }

  fullRenderFlours();

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
      fullRenderFlours(); // mudança estrutural: editabilidade %↔peso das farinhas se inverte (§1.3)
    } else {
      patchFlourDerived(); // qualquer outra mutação só repinta os derivados (§1.6)
    }
    patchDynamic();
  });
}
