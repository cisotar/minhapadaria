/**
 * sourdoughTable.ts — Sub-receita: composição do Fermento (spec §2.B) · issue 015.
 *
 * Refactor-farinhas-multiplas §5 (2026-07-06, fase 2 — PROPORÇÃO POR LINHA):
 * o core (`sourdough.ts`/`types.ts`/`recalc.ts`) já foi migrado do modelo de
 * Partes fixas `{isca, flour, water}` + % das farinhas do fermento para
 * PROPORÇÃO PRÓPRIA por linha — `SourdoughParts` agora é `{isca, water}` (sem
 * `flour`) e `SourdoughFlour.proportion` substitui `percentage`. O denominador
 * é GLOBAL (`sourdoughDenominator`, sourdough.ts) = isca + Σ(proporções das
 * farinhas) + água; peso_linha = W_ferm × proporção ÷ denominador. Esta UI
 * CONSOME essas novas assinaturas — nenhuma fórmula nova aqui (regra de ouro
 * #1/#2).
 *
 * O que faz: `renderSourdoughTable(root, store, editedCostIds)` monta o card
 * "Sub-receita: composição do Fermento" — a tabela (§5.1/§5.2), na ordem
 * (ajuste do cliente, 2026-07-06 — Água SOBE, antes das farinhas; AC15):
 *  1. **Total de fermento** — 1ª linha, EM NEGRITO, somente-leitura, consome
 *     W_ferm (vem da % editada na linha "Fermento" da tabela Ingredientes,
 *     §2.B.1) E o CUSTO AGREGADO das linhas abaixo (Custo/g/Custo = Σ
 *     farinhas + água, isca fora — AC24). Substitui o antigo campo avulso
 *     "Peso total do fermento" ACIMA da tabela — agora é a primeira LINHA dela.
 *  2. **Isca** — só Proporção editável (padrão 1); sem colunas de custo
 *     (custo sempre R$0,00, §2.B.2).
 *  3. **Água** — Proporção + custo editáveis (padrão R$0,00/1L, §2.B.4); não
 *     removível.
 *  4. **Farinhas (0+)** — criadas via `+ farinha do fermento`, linhas DIRETAS
 *     (não mais sub-linhas de um cabeçalho "Farinha" — `buildFarinhaHeaderRow`
 *     foi removido): Nome + Proporção + custo (Preço pago, Peso do produto +
 *     unidade) editáveis; Peso/Custo-g/Custo derivados; removíveis (§5.B).
 *  5. `tfoot` **Total** — Σ proporções (`sourdoughDenominator`), Σ peso
 *     (= W_ferm), Σ custo.
 * Colunas análogas a Ingredientes, com "% " virando "Proporção" (número livre
 * ≥0, sem casas fixas em format.ts — mesmo `partsPlain` de sempre) — as 4 de
 * custo sob o MESMO toggle "Exibir custos" da tabela de insumos (§2.A.2), e o
 * Resumo (§2.B.5: peso total, Isca, Farinha do Fermento, Água do Fermento,
 * "Hidratação resultante" derivada ou "—", custo total e custo/kg — os 2
 * últimos também sob o toggle).
 *
 * Sem regra "somar 100" nas farinhas do fermento (refactor §5.6/AC23):
 * proporções são livres — nenhuma trava, nenhum `validatePercentageSum` aqui
 * (só a validação de proporção ≥0 + denominador global >0,
 * `validateSourdoughParts(parts, flours)`, e o aviso de Σfarinhas=0 via
 * `validateSourdoughFlourPart(flours)`, ambos aditivos em `validation.ts`).
 *
 * Zero fórmula de negócio aqui: todo peso/custo/hidratação vem pronto de
 * `store.getState()` (`recalculate`, 008 — `recalc.ts`). As únicas contas
 * locais são triviais e documentadas: (a) `partsPlain` troca separador
 * decimal para vírgula nas Proporções (§7.1) — não há casas fixas definidas
 * para esses números livres em `format.ts` (só %/peso/R$/custo-g têm, §9);
 * (b) "Custo por kg" = Custo/g (já derivado pelo core) × 1000 — conversão de
 * unidade trivial (mesma família de `packageSizeInGrams`, costs.ts), não uma
 * fórmula de negócio nova (decisão registrada, issue 023). (c) "Custo" de
 * cada linha de farinha/água NÃO está pronto (`SourdoughFlour`/
 * `waterPackageCost` não têm campo `recipeCost` no tipo, §6) — reusa
 * `ingredientRecipeCost` (costs.ts, puro) para derivar, em vez de multiplicar
 * peso×custo/g solto na UI.
 *
 * Herança de custo (§4, MANTIDA sem regressão — AC13): como `types.ts` está
 * congelado (sem flag `manuallyEdited`), o vínculo farinha do fermento ↔
 * farinha principal (`flourId === ingredient.id`) e o "não sobrescrever após
 * edição manual" vivem inteiramente na UI via `inheritSourdoughFlourCosts`
 * (helper puro exportado) + `editedCostIds: Set<flourId>` (injetado pelo
 * composition root e amarrado ao hook `normalize` de `state.ts`, chamado a
 * cada `store.update`, ANTES do recálculo). Edição manual do Preço Pago/Peso
 * do Produto da farinha do fermento marca o id no Set antes de `store.update`
 * — herança para de sobrescrever aquele id dali em diante.
 *
 * Recálculo imediato (§1.6): edição inline `input`→`parseDecimal`→
 * `store.update`; `blur`→valida (010)→bloqueio reverte o campo (e o estado)
 * + erro nativo, aviso só anota. Mudança estrutural (add/remove farinha do
 * fermento, troca de unidade) chama `fullRenderTable()`; qualquer outra
 * mutação repinta só as células derivadas via `store.subscribe` — nenhum
 * `<input>` em foco é recriado nesse caminho (mesmo padrão de 014).
 *
 * Escape XSS (regra de ouro 3, §11.1): nome de farinha do fermento só entra
 * via `dom.ts` (`h`/valor de `<input>`), nunca `innerHTML`.
 *
 * Seções implementadas: §2.B, §2.B.1, §2.B.2, §2.B.3, §2.B.4, §2.B.5, §4,
 * §5.B, §5.C, §7.1, §9; refactor-farinhas-multiplas §5.1–§5.6.
 */
import { parseDecimal, formatPercent, formatWeight, formatCurrency, formatCostPerGram } from '../core/format';
import {
  validateFlourCount,
  validatePackageSize,
  validateNonNegative,
  validateSourdoughParts,
  validateSourdoughFlourPart,
  type ValidationResult,
} from '../core/validation';
import { sourdoughDenominator } from '../core/sourdough'; // reuso (regra de ouro 2): Σ proporções do rodapé (refactor §5.1/§5.3)
import { ingredientRecipeCost } from '../core/costs'; // reuso: Custo de linha (peso × custo/g), §2.A.1
import type { Recipe, SourdoughFlour, SourdoughParts, PackageCost } from '../core/types';
import { h, clear, on } from './dom';
import type { AppStateStore } from './state';
import { UNIT_OPTIONS, moneyPlain, applyValidation } from './cellHelpers'; // extraídos de 014 (regra de ouro 2)

/** Referências às células derivadas de uma linha — únicas repintadas via `subscribe`. */
interface DerivedRowRefs {
  weightCell: HTMLElement;
  costGCell: HTMLElement;
  costCell: HTMLElement;
  propCell?: HTMLElement; // só a linha "Total de fermento" repinta a Proporção (Σ)
}
interface FootRefs {
  partsCell: HTMLElement;
  weightCell: HTMLElement;
  costCell: HTMLElement;
}

/**
 * Exibição das Proporções (Isca/Farinha(s)/Água, refactor §5.2) — números
 * livres, sem regra de casas fixas em `format.ts` (só %/peso/R$/custo-g têm,
 * §9). Único ajuste é trocar o separador decimal para vírgula (§7.1); não
 * reimplementa arredondamento (os valores do gabarito — 0, 1, 1 — não têm
 * casas).
 */
function partsPlain(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Herança de custo da farinha principal (§4, decisão da issue 015, MANTIDA
 * sem regressão pelo refactor — AC13): farinhas do fermento NÃO presentes em
 * `editedCostIds` têm seu `packageCost` copiado do ingrediente principal
 * correspondente (vínculo por `flourId === ingredient.id`, `category ===
 * 'flour'`). Chamado como `normalize` de `state.ts` — DEPOIS da mutação do
 * chamador, ANTES de `recalculate` — assim uma edição no Preço Pago/Peso do
 * Produto da farinha principal se propaga de imediato (§1.6). Farinhas do
 * fermento sem farinha principal correspondente (id não bate com nenhum
 * ingrediente atual) ficam como estão — nada a herdar.
 */
export function inheritSourdoughFlourCosts(draft: Recipe, editedCostIds: ReadonlySet<string>): void {
  for (const flour of draft.sourdough.flours) {
    if (editedCostIds.has(flour.flourId)) continue; // editado manualmente (§4) — não sobrescreve
    const principal = draft.ingredients.find((i) => i.id === flour.flourId && i.category === 'flour');
    if (!principal) continue; // sem farinha principal vinculada — nada a herdar
    flour.packageCost = { ...principal.packageCost };
  }
}

export function renderSourdoughTable(root: HTMLElement, store: AppStateStore, editedCostIds: Set<string>): void {
  const card = h('section', { className: 'card' });
  root.appendChild(card);

  card.appendChild(h('h2', {}, ['Sub-receita: composição do Fermento']));
  card.appendChild(
    h('p', { className: 'sub-recipe-note' }, [
      '↳ Consumida pela linha ',
      h('strong', {}, ['Fermento']),
      ' da tabela acima — receita dentro da receita.',
    ]),
  );

  const table = h('table', { className: 'table' }) as HTMLTableElement;
  card.appendChild(table);

  // Resumo (§2.B.5) — mesma classe `.metric-pair` do painel de Hidratação.
  const resumo = h('div', { className: 'metric-pair mt-3' }); // `.mt-3` (issue 022) — era style inline
  card.appendChild(resumo);

  function metric(label: string, key: string): { wrap: HTMLElement; value: HTMLElement } {
    const value = h('div', { className: 'value', 'data-metric': key });
    const wrap = h('div', { className: 'metric' }, [h('div', { className: 'label' }, [label]), value]);
    resumo.appendChild(wrap);
    return { wrap, value };
  }
  const mPesoTotal = metric('Peso total', 'peso-total');
  const mIsca = metric('Isca', 'isca');
  const mFarinha = metric('Farinha do Fermento', 'farinha');
  const mAgua = metric('Água do Fermento', 'agua');
  const mHydration = metric('Hidratação resultante (Água ÷ Farinha)', 'hydration');
  const mCustoTotal = metric('Custo total', 'custo-total');
  const mCustoKg = metric('Custo por kg', 'custo-kg');

  let rowRefs = new Map<string, DerivedRowRefs>();
  let footRefs: FootRefs | null = null;

  /**
   * Constrói o `<input>` editável de uma Proporção fixa (Isca/Água, refactor
   * §5.2). Bloqueio (`validateSourdoughParts`, §5.6: proporções≥0 e
   * denominador global>0) reverte só este campo — sem redistribuir. As
   * farinhas do fermento (proporção própria, criadas pelo cliente) têm seu
   * próprio input em `buildFlourRow` — não passam por aqui.
   */
  function buildPartInput(field: keyof SourdoughParts, ariaLabel: string): HTMLInputElement {
    const input = h('input', {
      className: 'cell-input num',
      value: partsPlain(store.getState().recipe.sourdough.parts[field]),
      'aria-label': ariaLabel,
    }) as HTMLInputElement;
    let lastValid = input.value;
    on(input, 'input', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.sourdough.parts[field] = parsed;
      });
    });
    on(input, 'blur', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) {
        input.value = lastValid;
        return;
      }
      const { parts, flours } = store.getState().recipe.sourdough;
      const issue: ValidationResult = validateSourdoughParts(parts, flours); // refactor §5.6: bloqueio
      applyValidation(input, issue, () => {
        input.value = lastValid;
        const reverted = parseDecimal(lastValid.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.sourdough.parts[field] = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValid = partsPlain(parsed);
        input.value = lastValid;
      }
    });
    return input;
  }

  /**
   * "Total de fermento" (refactor §5.1, item 1; ajuste do cliente §5.1/AC15/
   * AC24, 2026-07-06): 1ª linha da tabela, EM NEGRITO, somente-leitura —
   * substitui o antigo campo avulso acima da tabela. Consome W_ferm (peso
   * total do fermento, vem da % da linha "Fermento" em Ingredientes, §2.B.1)
   * e o CUSTO AGREGADO das linhas abaixo (Custo/g = `sd.costPerGram`, Custo =
   * `sd.totalCost` — já derivados pelo core: Σ farinhas + água, isca fora,
   * §5.4). Negrito via `<strong>` nativo (regra de ouro 1: zero CSS novo —
   * não há classe de negrito de LINHA em design-system.css que sirva aqui sem
   * efeito colateral; `.row-fermento` é compartilhada com a linha "Fermento"
   * de `ingredientsTable.ts` e não tem `font-weight`, e `.table tfoot td` só
   * se aplica a `<tfoot>`, não a esta linha do `<tbody>`). As referências de
   * `weightCell`/`costGCell`/`costCell` apontam para os nós `<strong>`
   * internos — repintados via `.textContent` como qualquer outra célula
   * derivada (`patchAllDerived`), preservando o negrito entre repinturas.
   * Proporção/Preço pago/Peso do produto não se aplicam a este total agregado
   * (só a `tfoot` soma proporções) — exibidos como "—" em negrito também.
   */
  function buildTotalFermentoRow(): { tr: HTMLTableRowElement; refs: DerivedRowRefs } {
    const tr = h('tr', { 'data-sd-row': 'total-fermento' }) as HTMLTableRowElement;
    const nameCell = h('td', {}, [
      h('strong', {}, ['Total de fermento ', h('small', { className: 'note-muted' }, ['(↑ vem da % da linha Fermento em Ingredientes)'])]),
    ]);
    // Proporção da linha Total = Σ das proporções abaixo (isca + Σfarinhas +
    // água = `sourdoughDenominator`) — pedido do cliente (2026-07-06): a 1ª
    // linha soma as partes informadas nas linhas de baixo. Repintada em
    // `patchAllDerived`; nó `<strong>` interno preserva o negrito.
    const propValue = h('strong');
    const propCell = h('td', { className: 'num readonly' }, [propValue]);
    const weightValue = h('strong');
    const weightCell = h('td', { className: 'num readonly' }, [weightValue]);
    const priceCell = h('td', { className: 'num cost-col readonly' }, [h('strong', {}, ['—'])]);
    const pwCell = h('td', { className: 'num cost-col readonly' }, [h('strong', {}, ['—'])]);
    const costGValue = h('strong');
    const costGCell = h('td', { className: 'num cost-col readonly' }, [costGValue]);
    const costValue = h('strong');
    const costCell = h('td', { className: 'num cost-col readonly' }, [costValue]);

    tr.appendChild(nameCell);
    tr.appendChild(propCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(h('td', { className: 'col-actions' })); // não removível — célula de ações vazia
    // refs apontam para os `<strong>` internos (não o `<td>`) — repintura
    // (`.textContent`) preserva o negrito (refactor §5.1/AC24).
    return { tr, refs: { weightCell: weightValue, costGCell: costGValue, costCell: costValue, propCell: propValue } };
  }

  /** Isca (§2.B.2, refactor §5.1 item 2): custo SEMPRE zero, nunca editável — sem campo de custo em nenhum estado. */
  function buildIscaRow(): { tr: HTMLTableRowElement; refs: DerivedRowRefs } {
    const tr = h('tr', { 'data-sd-row': 'isca' }) as HTMLTableRowElement;
    const nameCell = h('td', {}, [
      'Isca ',
      h('small', { className: 'note-muted' }, ['(sobra do fermento anterior — custo zero)']), // issue 022
    ]);
    const partCell = h('td', { className: 'num' }, [buildPartInput('isca', 'Proporção da Isca')]);
    const weightCell = h('td', { className: 'num readonly' });
    const priceCell = h('td', { className: 'num cost-col readonly' }, ['—']);
    const pwCell = h('td', { className: 'num cost-col readonly' }, ['—']);
    const costGCell = h('td', { className: 'num cost-col readonly' }, ['—']);
    const costCell = h('td', { className: 'num cost-col readonly' });
    costCell.textContent = formatCurrency(0); // §2.B.2: Isca — custo sempre R$0,00, nunca editável

    tr.appendChild(nameCell);
    tr.appendChild(partCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(h('td', { className: 'col-actions' })); // Isca não remove — célula de ações vazia
    return { tr, refs: { weightCell, costGCell, costCell } };
  }

  /**
   * Linha de uma farinha do fermento (refactor §5.1 item 3/§5.2): agora
   * DIRETA (não mais sub-linha de um cabeçalho "Farinha" — removido). Nome,
   * Proporção (número livre ≥0, SEM regra de soma-100 — refactor §5.6/AC23),
   * peso rateado (derivado, denominador GLOBAL), Preço Pago + Peso do
   * Produto (editável, marca `editedCostIds` — §4), Custo/g e Custo
   * (derivados).
   */
  function buildFlourRow(flour: SourdoughFlour, index: number, flourCount: number): { tr: HTMLTableRowElement; refs: DerivedRowRefs } {
    const tr = h('tr', { 'data-sd-row': 'flour', 'data-flour-id': flour.flourId }) as HTMLTableRowElement;
    const label = flour.name || 'farinha do fermento';

    const nameInput = h('input', {
      className: 'cell-input',
      value: flour.name,
      'aria-label': 'Nome da farinha do fermento',
    }) as HTMLInputElement;
    on(nameInput, 'input', () => {
      store.update((draft) => {
        draft.sourdough.flours[index].name = nameInput.value;
      });
    });

    const wouldBeCount = flourCount - 1;
    const removeIssue = validateFlourCount(wouldBeCount, 'fermento'); // §5.B: mín 1
    const removeBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm', // `.btn-sm` (design-system.css, issue 022) — era style inline
        title: removeIssue ? removeIssue.message : 'Remover farinha do fermento',
        'aria-label': `Remover ${label}`,
        disabled: Boolean(removeIssue),
      },
      ['×'],
    ) as HTMLButtonElement;
    if (!removeIssue) {
      on(removeBtn, 'click', () => {
        store.update((draft) => {
          draft.sourdough.flours = draft.sourdough.flours.filter((f) => f.flourId !== flour.flourId);
        });
        fullRenderTable(); // add/remove é mudança estrutural (mesmo padrão de 014)
      });
    }
    // O botão remover foi para a coluna de ações no fim da linha (diretiva de
    // layout do coordenador — última ação horizontal, §10). Sem indentação:
    // linha DIRETA, não mais sub-linha de um cabeçalho "Farinha" (refactor §5.1).
    const nameCell = h('td', {}, [nameInput]);
    const actionsCell = h('td', { className: 'col-actions' }, [removeBtn]);

    // Proporção — número livre ≥0, sempre editável (refactor §5.6/AC23: sem
    // trava, sem regra de soma-100 no fermento).
    // Proporção em BRANCO quando 0 (pedido do cliente 2026-07-06): `+ farinha`
    // cria a linha com nome e proporção vazios para o cliente digitar. `0` no
    // dado renderiza input vazio (placeholder "0") — não o literal "0".
    const propInput = h('input', {
      className: 'cell-input num',
      value: flour.proportion === 0 ? '' : partsPlain(flour.proportion),
      placeholder: '0',
      'aria-label': `Proporção de ${label}`,
    }) as HTMLInputElement;
    let lastValidProp = propInput.value;
    on(propInput, 'input', () => {
      const parsed = parseDecimal(propInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.sourdough.flours[index].proportion = parsed;
      });
    });
    on(propInput, 'blur', () => {
      const parsed = parseDecimal(propInput.value);
      if (parsed === null) {
        propInput.value = lastValidProp;
        return;
      }
      const { parts, flours } = store.getState().recipe.sourdough;
      // refactor §5.6: proporções≥0 e denominador global>0 — bloqueio; sem
      // regra de soma-100 (AC23). Aviso separado (não-bloqueante) se
      // Σ(proporções das farinhas) = 0 (hidratação indefinida, §5.5).
      let issue: ValidationResult = validateSourdoughParts(parts, flours);
      if (!issue) issue = validateSourdoughFlourPart(flours);
      applyValidation(propInput, issue, () => {
        propInput.value = lastValidProp;
        const reverted = parseDecimal(lastValidProp);
        if (reverted !== null) {
          store.update((draft) => {
            draft.sourdough.flours[index].proportion = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidProp = partsPlain(parsed);
        propInput.value = lastValidProp;
      }
    });
    const propCell = h('td', { className: 'num' }, [propInput]);

    const weightCell = h('td', { className: 'num readonly' }); // derivado (rateio §3.B/refactor §5.3)

    const priceInput = h('input', {
      className: 'cell-input num',
      value: moneyPlain(flour.packageCost.pricePaid),
      title: 'Herdado da farinha principal — editável manualmente (§4)',
      'aria-label': `Preço pago de ${label}`,
    }) as HTMLInputElement;
    let lastValidPrice = priceInput.value;
    on(priceInput, 'input', () => {
      const parsed = parseDecimal(priceInput.value);
      if (parsed === null) return;
      editedCostIds.add(flour.flourId); // §4: edição manual — herança para de sobrescrever
      store.update((draft) => {
        draft.sourdough.flours[index].packageCost.pricePaid = parsed;
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
            draft.sourdough.flours[index].packageCost.pricePaid = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidPrice = moneyPlain(parsed);
        priceInput.value = lastValidPrice;
      }
    });
    const priceCell = h('td', { className: 'num cost-col' }, [priceInput]);

    const pwValInput = h('input', {
      className: 'cell-input num',
      value: formatWeight(flour.packageCost.packageSize),
      'aria-label': `Peso do produto de ${label}`,
      size: 6,
    }) as HTMLInputElement;
    let lastValidPw = pwValInput.value;
    on(pwValInput, 'input', () => {
      const parsed = parseDecimal(pwValInput.value);
      if (parsed === null) return;
      editedCostIds.add(flour.flourId); // §4
      store.update((draft) => {
        draft.sourdough.flours[index].packageCost.packageSize = parsed;
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
            draft.sourdough.flours[index].packageCost.packageSize = reverted;
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
    pwUnitSelect.value = flour.packageCost.packageUnit;
    on(pwUnitSelect, 'change', () => {
      editedCostIds.add(flour.flourId); // §4
      store.update((draft) => {
        draft.sourdough.flours[index].packageCost.packageUnit = pwUnitSelect.value as PackageCost['packageUnit'];
      });
      fullRenderTable(); // troca de unidade é mudança estrutural (mesmo padrão de 014)
    });
    const pwCell = h('td', { className: 'num cost-col' }, [
      h('div', { className: 'pw-combo' }, [pwValInput, pwUnitSelect]),
    ]);

    const costGCell = h('td', { className: 'num cost-col readonly' }); // derivado (§2.A.1)
    const costCell = h('td', { className: 'num cost-col readonly' }); // derivado (ingredientRecipeCost)

    tr.appendChild(nameCell);
    tr.appendChild(propCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(actionsCell);

    return { tr, refs: { weightCell, costGCell, costCell } };
  }

  /** Água do Fermento (§2.B.4, refactor §5.1 item 4): Proporção + custo editáveis; padrão R$0,00/1L. Não removível. */
  function buildAguaRow(): { tr: HTMLTableRowElement; refs: DerivedRowRefs } {
    const tr = h('tr', { 'data-sd-row': 'agua' }) as HTMLTableRowElement;
    const nameCell = h('td', {}, ['Água']);
    const partCell = h('td', { className: 'num' }, [buildPartInput('water', 'Proporção da Água do fermento')]);
    const weightCell = h('td', { className: 'num readonly' });

    const water = store.getState().recipe.sourdough.waterPackageCost;
    const priceInput = h('input', {
      className: 'cell-input num',
      value: moneyPlain(water.pricePaid),
      'aria-label': 'Preço pago da água do fermento',
    }) as HTMLInputElement;
    let lastValidPrice = priceInput.value;
    on(priceInput, 'input', () => {
      const parsed = parseDecimal(priceInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.sourdough.waterPackageCost.pricePaid = parsed;
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
            draft.sourdough.waterPackageCost.pricePaid = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidPrice = moneyPlain(parsed);
        priceInput.value = lastValidPrice;
      }
    });
    const priceCell = h('td', { className: 'num cost-col' }, [priceInput]);

    const pwValInput = h('input', {
      className: 'cell-input num',
      value: formatWeight(water.packageSize),
      'aria-label': 'Peso do produto da água do fermento',
      size: 6,
    }) as HTMLInputElement;
    let lastValidPw = pwValInput.value;
    on(pwValInput, 'input', () => {
      const parsed = parseDecimal(pwValInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.sourdough.waterPackageCost.packageSize = parsed;
      });
    });
    on(pwValInput, 'blur', () => {
      const parsed = parseDecimal(pwValInput.value);
      if (parsed === null) {
        pwValInput.value = lastValidPw;
        return;
      }
      const issue = validatePackageSize(parsed);
      applyValidation(pwValInput, issue, () => {
        pwValInput.value = lastValidPw;
        const reverted = parseDecimal(lastValidPw.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.sourdough.waterPackageCost.packageSize = reverted;
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
      'aria-label': 'Unidade do peso do produto da água do fermento',
    }) as HTMLSelectElement;
    for (const u of UNIT_OPTIONS.liquid) {
      pwUnitSelect.appendChild(h('option', { value: u }, [u]));
    }
    pwUnitSelect.value = water.packageUnit;
    on(pwUnitSelect, 'change', () => {
      store.update((draft) => {
        draft.sourdough.waterPackageCost.packageUnit = pwUnitSelect.value as PackageCost['packageUnit'];
      });
      fullRenderTable(); // troca de unidade é mudança estrutural
    });
    const pwCell = h('td', { className: 'num cost-col' }, [
      h('div', { className: 'pw-combo' }, [pwValInput, pwUnitSelect]),
    ]);

    const costGCell = h('td', { className: 'num cost-col readonly' });
    const costCell = h('td', { className: 'num cost-col readonly' });

    tr.appendChild(nameCell);
    tr.appendChild(partCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(h('td', { className: 'col-actions' })); // Água não remove — célula de ações vazia

    return { tr, refs: { weightCell, costGCell, costCell } };
  }

  function buildAddFlourRow(): HTMLTableRowElement {
    const tr = h('tr') as HTMLTableRowElement;
    const addBtn = h(
      'button',
      { type: 'button', className: 'btn btn-secondary btn-sm' }, // `.btn-sm` (issue 022) — era style inline
      ['+ farinha do fermento'],
    ) as HTMLButtonElement;
    on(addBtn, 'click', () => {
      store.update((draft) => {
        draft.sourdough.flours.push({
          flourId: crypto.randomUUID(),
          name: '',
          proportion: 0, // refactor §5.7 (era percentage:0)
          packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' },
          weight: 0,
        });
      });
      fullRenderTable(); // add/remove é mudança estrutural (§5.B)
    });
    tr.appendChild(h('td', { colspan: 8, className: 'table-add-cell' }, [addBtn])); // colspan = nº de colunas (com Ações)
    return tr;
  }

  function buildThead(): HTMLTableSectionElement {
    const thead = h('thead');
    thead.appendChild(
      h('tr', {}, [
        h('th', {}, ['Componente']),
        h('th', { className: 'num' }, ['Proporção']),
        h('th', { className: 'num' }, ['Peso (g)']),
        h('th', { className: 'num cost-col' }, ['Preço pago']),
        h('th', { className: 'num cost-col' }, ['Peso do produto']),
        h('th', { className: 'num cost-col' }, ['Custo/g']),
        h('th', { className: 'num cost-col' }, ['Custo']),
        h('th', { className: 'col-actions', 'aria-label': 'Ações' }), // botão remover (extrema direita, §10)
      ]),
    );
    return thead;
  }

  function buildTfoot(): { tfoot: HTMLTableSectionElement; refs: FootRefs } {
    const tfoot = h('tfoot');
    const partsCell = h('td', { className: 'num' });
    const weightCell = h('td', { className: 'num' });
    const costCell = h('td', { className: 'num cost-col' });
    tfoot.appendChild(
      h('tr', {}, [
        h('td', {}, ['Total']),
        partsCell,
        weightCell,
        h('td', { className: 'cost-col', colspan: 3 }),
        costCell,
        h('td'), // coluna de ações — sem total
      ]),
    );
    return { tfoot, refs: { partsCell, weightCell, costCell } };
  }

  function fullRenderTable(): void {
    clear(table);
    table.classList.toggle('show-costs', store.showCosts());
    table.appendChild(buildThead());

    const tbody = h('tbody');
    rowRefs = new Map();

    // Ordem (ajuste do cliente §5.1/AC15, 2026-07-06 — Água SOBE, farinhas
    // vão pro fim): Total de fermento · Isca · Água · farinhas (0+) ·
    // [+ farinha do fermento] · [tfoot] Total.
    const { tr: totalTr, refs: totalRefs } = buildTotalFermentoRow();
    rowRefs.set('total-fermento', totalRefs);
    tbody.appendChild(totalTr);

    const { tr: iscaTr, refs: iscaRefs } = buildIscaRow();
    rowRefs.set('isca', iscaRefs);
    tbody.appendChild(iscaTr);

    const { tr: aguaTr, refs: aguaRefs } = buildAguaRow();
    rowRefs.set('agua', aguaRefs);
    tbody.appendChild(aguaTr);

    const flours = store.getState().recipe.sourdough.flours;
    flours.forEach((flour, index) => {
      const { tr, refs } = buildFlourRow(flour, index, flours.length);
      rowRefs.set(`flour-${flour.flourId}`, refs);
      tbody.appendChild(tr);
    });
    tbody.appendChild(buildAddFlourRow());

    table.appendChild(tbody);

    const built = buildTfoot();
    footRefs = built.refs;
    table.appendChild(built.tfoot);

    patchAllDerived(); // sincroniza valores exibidos com o estado atual
  }

  /** Repinta só as células/metrics derivadas — nunca recria um input em foco (§1.6). */
  function patchAllDerived(): void {
    const { recipe } = store.getState();
    const sd = recipe.sourdough;
    const showCosts = store.showCosts();
    table.classList.toggle('show-costs', showCosts); // §2.A.2: mesmo toggle global (state.ts notify)

    const totalRefs = rowRefs.get('total-fermento');
    if (totalRefs) {
      if (totalRefs.propCell) totalRefs.propCell.textContent = partsPlain(sourdoughDenominator(sd.parts, sd.flours)); // Σ proporções
      totalRefs.weightCell.textContent = formatWeight(sd.totalWeight ?? 0);
      // AC24: custo agregado do fermento (Σ farinhas + água, isca fora, §5.4)
      // — já derivado pelo core (`recalc.ts`/`costs.ts`), nenhuma soma nova aqui.
      totalRefs.costGCell.textContent = sd.costPerGram !== undefined ? formatCostPerGram(sd.costPerGram) : '—';
      totalRefs.costCell.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';
    }

    const iscaRefs = rowRefs.get('isca');
    if (iscaRefs) iscaRefs.weightCell.textContent = formatWeight(sd.iscaWeight ?? 0);

    sd.flours.forEach((f) => {
      const refs = rowRefs.get(`flour-${f.flourId}`);
      if (!refs) return;
      refs.weightCell.textContent = formatWeight(f.weight);
      refs.costGCell.textContent = f.costPerGram !== undefined ? formatCostPerGram(f.costPerGram) : '—';
      const cost = ingredientRecipeCost(f.weight, f.packageCost); // reuso (costs.ts) — sem recipeCost no tipo
      refs.costCell.textContent = cost !== null ? formatCurrency(cost) : '—';
    });

    const aguaRefs = rowRefs.get('agua');
    if (aguaRefs) {
      aguaRefs.weightCell.textContent = formatWeight(sd.waterWeight ?? 0);
      aguaRefs.costGCell.textContent =
        sd.waterCostPerGram !== undefined ? formatCostPerGram(sd.waterCostPerGram) : '—';
      const waterCost = ingredientRecipeCost(sd.waterWeight ?? 0, sd.waterPackageCost); // reuso (costs.ts)
      aguaRefs.costCell.textContent = waterCost !== null ? formatCurrency(waterCost) : '—';
    }

    if (footRefs) {
      // refactor §5.1/§5.3: Σ proporções = denominador GLOBAL (isca + Σfarinhas + água).
      footRefs.partsCell.textContent = partsPlain(sourdoughDenominator(sd.parts, sd.flours)); // reuso (sourdough.ts)
      footRefs.weightCell.textContent = formatWeight(sd.totalWeight ?? 0);
      footRefs.costCell.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';
    }

    // Resumo (§2.B.5).
    mPesoTotal.value.textContent = formatWeight(sd.totalWeight ?? 0);
    mIsca.value.textContent = formatWeight(sd.iscaWeight ?? 0);
    mFarinha.value.textContent = formatWeight(sd.flourWeight ?? 0);
    mAgua.value.textContent = formatWeight(sd.waterWeight ?? 0);
    // §5.C: hidratação indefinida (Σ FarinhaFerm=0) → undefined no state → "—".
    mHydration.value.textContent = sd.hydration !== undefined ? `${formatPercent(sd.hydration)}%` : '—';
    mCustoTotal.value.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';
    // Custo/kg = Custo/g (derivado) × 1000 — conversão de unidade trivial, não fórmula
    // nova; mantida na UI (decisão registrada acima, issue 023 — não é mudança aditiva
    // trivial ao contrato de `SourdoughWeights`, §6).
    mCustoKg.value.textContent = sd.costPerGram !== undefined ? formatCurrency(sd.costPerGram * 1000) : '—';

    // Custo total/por kg sob o mesmo toggle "Exibir custos" (§2.A.2/§2.B.2).
    // `.hidden` (design-system.css, issue 022) — era `el.style.display = 'none'`.
    mCustoTotal.wrap.classList.toggle('hidden', !showCosts);
    mCustoKg.wrap.classList.toggle('hidden', !showCosts);
  }

  fullRenderTable();
  store.subscribe(() => patchAllDerived()); // §1.6: repintura central em qualquer `update`
}
