/**
 * ingredientsTable.ts — Tabela de Insumos (spec §2.A.2/§4/§5/§9) · issue 014.
 *
 * O que faz: `renderIngredientsTable(root, store)` monta o card "Ingredientes"
 * — thead com a ordem fixa de colunas (§2.A.2), uma linha por ingrediente +
 * a linha consolidada do Fermento (§2.A.2), tfoot com o total da massa, o
 * toggle "Exibir custos" (persistido via `prefs`, 011) e o botão
 * "+ ingrediente". Edição inline linha a linha (§4): `input` chama
 * `parseDecimal` (002) + `store.update` (que roda `recalculate`, 008); a
 * repintura de células derivadas/tfoot acontece via `store.subscribe` — os
 * elementos `<input>` em foco NUNCA são recriados nesse caminho (só em
 * mudança estrutural: add/remove/alternância g-mL/unidade, que chamam
 * `fullRender()`). `blur` valida via `validation.ts` (010): bloqueio reverte
 * o campo (e o estado) ao último valor válido e sinaliza erro nativo via
 * `setCustomValidity`/`reportValidity`; aviso apenas anota, sem reverter.
 *
 * Zero lógica de negócio aqui: todo peso/custo/% deriva de `store.getState()`
 * (que só existe porque `recalculate` já rodou, 008); a única soma feita
 * nesta camada é o total de peso do rodapé (§2.A.2 "Total da massa"), porque
 * não há função exportada em `src/core` para essa agregação de exibição e
 * `src/core/**` está fora do escopo desta issue (não pode ser tocado) — soma
 * trivial de valores já derivados pelo core, sem fórmula nova (documentado no
 * relatório da issue). O total de % reusa `recipeSumPercent` (scaling.ts,
 * regra de ouro 2) e o total de custo reusa `summary.totalCost` (recalc.ts).
 *
 * Escape XSS (regra de ouro 3, §11.1): nome de ingrediente e qualquer texto
 * do usuário passam só por `dom.ts` (`h`/`textContent`), nunca `innerHTML`.
 *
 * Seções implementadas: §2.A.2, §4, §5.A, §5.B, §5.C, §7.1, §9.
 */
import { parseDecimal, formatPercent, formatWeight, formatCurrency, formatCostPerGram } from '../core/format';
import {
  validatePercentageSum,
  validateFlourCount,
  validatePackageSize,
  validateNonNegative,
  validateSourdoughProportion,
  type ValidationResult,
} from '../core/validation';
import { recipeSumPercent } from '../core/scaling'; // reuso (regra de ouro 2): Σ%ingredientes + %fermento (§3.D)
import type { Ingredient, PackageCost } from '../core/types';
import { h, clear, on } from './dom';
import type { AppStateStore } from './state';

/** Referências às células derivadas de uma linha — únicas repintadas via `subscribe`. */
interface RowRefs {
  weightCell: HTMLElement;
  costGCell: HTMLElement;
  costCell: HTMLElement;
}
interface FootRefs {
  pctCell: HTMLElement;
  weightCell: HTMLElement;
  costCell: HTMLElement;
}

/**
 * Opções de unidade da coluna "Peso do produto" por categoria (§2.A.1/§7):
 * sólidos em massa (kg/g); líquidos em volume (L/mL); gorduras podem ser
 * compradas por massa OU volume (g/kg/mL/L, como o Azeite do mockup).
 */
const UNIT_OPTIONS: Record<Ingredient['category'], PackageCost['packageUnit'][]> = {
  flour: ['kg', 'g'],
  salt: ['kg', 'g'],
  extra: ['kg', 'g'],
  liquid: ['L', 'mL'],
  fat: ['g', 'kg', 'mL', 'L'],
};

/** Formata moeda (format.ts, dono único) e remove o prefixo "R$" — campo
 *  editável de Preço Pago mostra só o número (mockups/calculadora.html),
 *  sem reimplementar arredondamento/vírgula. */
function moneyPlain(n: number): string {
  return formatCurrency(n).replace('R$', '').trim();
}

/**
 * Aplica o resultado de uma validação (010) a um input: bloqueio reverte
 * (callback do chamador) e sinaliza erro nativo; aviso não reverte, só
 * anota a mensagem. `null` limpa qualquer sinalização anterior.
 */
function applyValidation(el: HTMLInputElement, issue: ValidationResult, revert: () => void): void {
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

export function renderIngredientsTable(root: HTMLElement, store: AppStateStore): void {
  const card = h('section', { className: 'card' });
  root.appendChild(card);

  // Barra de título + toggle "Exibir custos" (§2.A.2: default oculto, persistido via prefs 011).
  const titleBar = h('div', {
    style: 'display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3)',
  });
  titleBar.appendChild(h('h2', { style: 'margin:0;border:none;padding:0' }, ['Ingredientes']));

  const toggleLabel = h('label', {
    style:
      'margin-left:auto;display:flex;align-items:center;gap:var(--sp-2);' +
      'font-size:var(--fs-small);font-weight:600;color:var(--text-2);cursor:pointer',
  });
  const toggleInput = h('input', { type: 'checkbox', checked: store.showCosts() }) as HTMLInputElement;
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(document.createTextNode('Exibir custos'));
  titleBar.appendChild(toggleLabel);
  card.appendChild(titleBar);

  const table = h('table', { className: 'table' }) as HTMLTableElement;
  card.appendChild(table);

  on(toggleInput, 'change', () => {
    store.setShowCosts(toggleInput.checked); // persistência via prefs (011) — sem recálculo
    table.classList.toggle('show-costs', toggleInput.checked);
  });

  let rowRefs = new Map<string, RowRefs>();
  let footRefs: FootRefs | null = null;

  /** Repinta só as células derivadas + rodapé — nunca recria um input em foco. */
  function patchAllDerived(): void {
    const { recipe } = store.getState();
    for (const [id, refs] of rowRefs) {
      if (id === 'fermento') {
        const sd = recipe.sourdough;
        refs.weightCell.textContent = formatWeight(sd.totalWeight ?? 0);
        refs.costGCell.textContent = sd.costPerGram !== undefined ? formatCostPerGram(sd.costPerGram) : '—';
        refs.costCell.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';
      } else {
        const ing = recipe.ingredients.find((i) => i.id === id);
        if (!ing) continue;
        refs.weightCell.textContent = formatWeight(ing.weight);
        refs.costGCell.textContent = ing.costPerGram !== undefined ? formatCostPerGram(ing.costPerGram) : '—';
        refs.costCell.textContent = ing.recipeCost !== undefined ? formatCurrency(ing.recipeCost) : '—';
      }
    }
    if (footRefs) {
      footRefs.pctCell.textContent = formatPercent(recipeSumPercent(recipe)); // reuso (scaling.ts)
      // Soma de exibição do rodapé — ver nota de cabeçalho do arquivo (core fora de escopo).
      const totalWeight =
        recipe.ingredients.reduce((sum, i) => sum + i.weight, 0) + (recipe.sourdough.totalWeight ?? 0);
      footRefs.weightCell.textContent = formatWeight(totalWeight);
      const { summary } = store.getState();
      footRefs.costCell.textContent = summary.totalCost !== null ? formatCurrency(summary.totalCost) : '—';
    }
  }

  function buildThead(): HTMLTableSectionElement {
    const thead = h('thead');
    thead.appendChild(
      h('tr', {}, [
        h('th', {}, ['Ingrediente']),
        h('th', {}, ['Unidade']),
        h('th', { className: 'num' }, ['%']),
        h('th', { className: 'num' }, ['Peso (g)']),
        h('th', { className: 'num cost-col' }, ['Preço pago']),
        h('th', { className: 'num cost-col' }, ['Peso do produto']),
        h('th', { className: 'num cost-col' }, ['Custo/g']),
        h('th', { className: 'num cost-col' }, ['Custo']),
      ]),
    );
    return thead;
  }

  function buildUnitToggle(ing: Ingredient, index: number): HTMLElement {
    const label = ing.name || 'ingrediente';
    const span = h('span', { className: 'unit-toggle' });
    const gBtn = h('button', { type: 'button', 'aria-label': `Usar gramas para ${label}` }, ['g']) as HTMLButtonElement;
    const mlBtn = h('button', { type: 'button', 'aria-label': `Usar mililitros para ${label}` }, ['mL']) as HTMLButtonElement;
    const isVolume = ing.inputUnit === 'volume';
    gBtn.classList.toggle('active', !isVolume);
    mlBtn.classList.toggle('active', isVolume);
    gBtn.setAttribute('aria-pressed', String(!isVolume));
    mlBtn.setAttribute('aria-pressed', String(isVolume));
    // g/mL só troca o rótulo/inputUnit — densidade 1:1, canônico em g inalterado (§2.A).
    on(gBtn, 'click', () => {
      store.update((draft) => {
        draft.ingredients[index].inputUnit = 'weight';
      });
      fullRender(); // mudança estrutural (troca de unidade) — plano da issue 014
    });
    on(mlBtn, 'click', () => {
      store.update((draft) => {
        draft.ingredients[index].inputUnit = 'volume';
      });
      fullRender();
    });
    span.appendChild(gBtn);
    span.appendChild(mlBtn);
    return span;
  }

  function buildIngredientRow(
    ing: Ingredient,
    index: number,
    flourCount: number,
  ): { tr: HTMLTableRowElement; refs: RowRefs } {
    const tr = h('tr') as HTMLTableRowElement;
    tr.dataset.ingredientId = ing.id; // âncora estável para localizar a linha (repintura/testes)
    const label = ing.name || 'ingrediente';

    // Nome — editável (§4), nunca via innerHTML (regra de ouro 3); ícone de remover ao lado.
    const nameInput = h('input', {
      className: 'cell-input',
      value: ing.name,
      'aria-label': 'Nome do ingrediente',
    }) as HTMLInputElement;
    on(nameInput, 'input', () => {
      store.update((draft) => {
        draft.ingredients[index].name = nameInput.value;
      });
    });

    const wouldBeFlourCount = flourCount - (ing.category === 'flour' ? 1 : 0);
    const removeIssue = ing.category === 'flour' ? validateFlourCount(wouldBeFlourCount, 'principal') : null;
    const removeBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary',
        style: 'font-size:var(--fs-small)',
        title: removeIssue ? removeIssue.message : 'Remover ingrediente',
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
        fullRender(); // add/remove é mudança estrutural (§5.B)
      });
    }
    const nameCell = h('td', {}, [
      h('div', { style: 'display:flex;align-items:center;gap:var(--sp-2)' }, [nameInput, removeBtn]),
    ]);

    // Unidade — sólidos "g" fixo; líquidos/gorduras alternador g/mL (§2.A.2).
    const unitCell = h('td');
    if (ing.category === 'liquid' || ing.category === 'fat') {
      unitCell.appendChild(buildUnitToggle(ing, index));
    } else {
      unitCell.textContent = 'g';
    }

    // % — trava 100% se única farinha (§2.A); senão editável, validação no blur (§5.A).
    const isLockedFlour = ing.category === 'flour' && flourCount === 1;
    const pctInput = h('input', {
      className: 'cell-input num',
      value: formatPercent(ing.percentage),
      readonly: isLockedFlour,
      'aria-label': `Porcentagem de ${label}`,
    }) as HTMLInputElement;
    let lastValidPct = pctInput.value;
    if (!isLockedFlour) {
      on(pctInput, 'input', () => {
        const parsed = parseDecimal(pctInput.value);
        if (parsed === null) return; // §7.1: digitação em curso, ainda não numérica
        store.update((draft) => {
          draft.ingredients[index].percentage = parsed;
        }); // recalcula (008) e repinta via subscribe — input em foco intocado
      });
      on(pctInput, 'blur', () => {
        const parsed = parseDecimal(pctInput.value);
        if (parsed === null) {
          pctInput.value = lastValidPct;
          return;
        }
        // §5.A: só farinhas precisam somar 100% — outras categorias não têm essa regra.
        const issue: ValidationResult =
          ing.category === 'flour'
            ? validatePercentageSum(
                store
                  .getState()
                  .recipe.ingredients.filter((i) => i.category === 'flour')
                  .map((i) => i.percentage),
                'principal',
              )
            : null;
        applyValidation(pctInput, issue, () => {
          pctInput.value = lastValidPct;
          const reverted = parseDecimal(lastValidPct);
          if (reverted !== null) {
            store.update((draft) => {
              draft.ingredients[index].percentage = reverted;
            });
          }
        });
        if (!issue || issue.level !== 'block') {
          lastValidPct = formatPercent(parsed); // §9: arredondamento só na exibição
          pctInput.value = lastValidPct;
        }
      });
    }
    const pctCell = h('td', { className: 'num' }, [pctInput]);

    // Peso — derivado, texto plano SEM box (decisão 24/brandbook §4.1).
    const weightCell = h('td', { className: 'num readonly' });
    weightCell.textContent = formatWeight(ing.weight);

    // Preço Pago — editável (§2.A.1); Preço Pago ≥ 0 (§5.C).
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
      // `size` é contagem de caracteres (atributo HTML), não um valor CSS —
      // dá largura intrínseca razoável ao par .pw-combo sem token de largura.
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
    for (const u of UNIT_OPTIONS[ing.category]) {
      pwUnitSelect.appendChild(h('option', { value: u }, [u]));
    }
    pwUnitSelect.value = ing.packageCost.packageUnit;
    on(pwUnitSelect, 'change', () => {
      store.update((draft) => {
        draft.ingredients[index].packageCost.packageUnit = pwUnitSelect.value as PackageCost['packageUnit'];
      });
      fullRender(); // troca de unidade é mudança estrutural (plano da issue 014)
    });
    const pwCell = h('td', { className: 'num cost-col' }, [h('div', { className: 'pw-combo' }, [pwValInput, pwUnitSelect])]);

    // Custo/g e Custo na Receita — derivados, texto plano (decisão 24).
    const costGCell = h('td', { className: 'num cost-col readonly' });
    costGCell.textContent = ing.costPerGram !== undefined ? formatCostPerGram(ing.costPerGram) : '—';
    const costCell = h('td', { className: 'num cost-col readonly' });
    costCell.textContent = ing.recipeCost !== undefined ? formatCurrency(ing.recipeCost) : '—';

    tr.appendChild(nameCell);
    tr.appendChild(unitCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);

    return { tr, refs: { weightCell, costGCell, costCell } };
  }

  /**
   * Linha consolidada do Fermento (§2.A.2): peso/% seguem a mesma fórmula
   * genérica de linha, mas vêm de `recipe.sourdough` (sub-receita, §2.B) —
   * sem edição de peso; custos exibem o custo derivado do fermento.
   */
  function buildFermentoRow(): { tr: HTMLTableRowElement; refs: RowRefs } {
    const sd = store.getState().recipe.sourdough;
    const tr = h('tr', { className: 'row-fermento' }) as HTMLTableRowElement;
    tr.dataset.ingredientId = 'fermento'; // âncora estável (mesma convenção das linhas de ingrediente)

    const nameCell = h('td', {}, ['Fermento']);
    const unitCell = h('td', {}, ['g']);

    const pctInput = h('input', {
      className: 'cell-input num',
      value: formatPercent(sd.percentageOfTotalFlour),
      'aria-label': 'Proporção do fermento',
    }) as HTMLInputElement;
    let lastValidPct = pctInput.value;
    on(pctInput, 'input', () => {
      const parsed = parseDecimal(pctInput.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.sourdough.percentageOfTotalFlour = parsed;
      });
    });
    on(pctInput, 'blur', () => {
      const parsed = parseDecimal(pctInput.value);
      if (parsed === null) {
        pctInput.value = lastValidPct;
        return;
      }
      const issue = validateSourdoughProportion(parsed); // §5.C: <0 bloqueia, =0 avisa
      applyValidation(pctInput, issue, () => {
        pctInput.value = lastValidPct;
        const reverted = parseDecimal(lastValidPct);
        if (reverted !== null) {
          store.update((draft) => {
            draft.sourdough.percentageOfTotalFlour = reverted;
          });
        }
      });
      if (!issue || issue.level !== 'block') {
        lastValidPct = formatPercent(parsed);
        pctInput.value = lastValidPct;
      }
    });
    const pctCell = h('td', { className: 'num' }, [pctInput]);

    const weightCell = h('td', { className: 'num readonly' });
    weightCell.textContent = formatWeight(sd.totalWeight ?? 0);

    // Preço Pago/Peso do Produto não se aplicam à linha consolidada (custo vem
    // da sub-receita, §2.B — fora do escopo desta issue, ver header do arquivo).
    const dashPrice = h('td', { className: 'num cost-col readonly' }, ['—']);
    const dashPw = h('td', { className: 'num cost-col readonly' }, ['—']);

    const costGCell = h('td', { className: 'num cost-col readonly' });
    costGCell.textContent = sd.costPerGram !== undefined ? formatCostPerGram(sd.costPerGram) : '—';
    const costCell = h('td', { className: 'num cost-col readonly' });
    costCell.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';

    tr.appendChild(nameCell);
    tr.appendChild(unitCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(dashPrice);
    tr.appendChild(dashPw);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);

    return { tr, refs: { weightCell, costGCell, costCell } };
  }

  function buildAddRow(): HTMLTableRowElement {
    const tr = h('tr') as HTMLTableRowElement;
    const addBtn = h(
      'button',
      { type: 'button', className: 'btn btn-secondary', style: 'font-size:var(--fs-small)' },
      ['+ ingrediente'],
    ) as HTMLButtonElement;
    on(addBtn, 'click', () => {
      store.update((draft) => {
        draft.ingredients.push({
          id: crypto.randomUUID(),
          name: '',
          category: 'extra',
          weight: 0,
          percentage: 0,
          packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' },
        });
      });
      fullRender(); // add/remove é mudança estrutural
    });
    tr.appendChild(h('td', { colspan: 8, style: 'padding:var(--sp-2) var(--sp-3)' }, [addBtn]));
    return tr;
  }

  function buildTfoot(): { tfoot: HTMLTableSectionElement; refs: FootRefs } {
    const tfoot = h('tfoot');
    const pctCell = h('td', { className: 'num' });
    const weightCell = h('td', { className: 'num' });
    const costCell = h('td', { className: 'num cost-col' });
    tfoot.appendChild(
      h('tr', {}, [
        h('td', { colspan: 2 }, ['Total da massa']),
        pctCell,
        weightCell,
        h('td', { className: 'cost-col', colspan: 3 }),
        costCell,
      ]),
    );
    return { tfoot, refs: { pctCell, weightCell, costCell } };
  }

  function fullRender(): void {
    clear(table);
    table.classList.toggle('show-costs', store.showCosts());
    table.appendChild(buildThead());

    const tbody = h('tbody');
    rowRefs = new Map();
    const { recipe } = store.getState();
    const flourCount = recipe.ingredients.filter((i) => i.category === 'flour').length;
    recipe.ingredients.forEach((ing, index) => {
      const { tr, refs } = buildIngredientRow(ing, index, flourCount);
      rowRefs.set(ing.id, refs);
      tbody.appendChild(tr);
    });
    const { tr: fermentoTr, refs: fermentoRefs } = buildFermentoRow();
    rowRefs.set('fermento', fermentoRefs);
    tbody.appendChild(fermentoTr);
    tbody.appendChild(buildAddRow());
    table.appendChild(tbody);

    const built = buildTfoot();
    footRefs = built.refs;
    table.appendChild(built.tfoot);

    patchAllDerived(); // sincroniza valores exibidos com o estado atual
  }

  fullRender();
  store.subscribe(() => patchAllDerived()); // §1.6: repintura central em qualquer `update`
}
