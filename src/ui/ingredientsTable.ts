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
 * Editabilidade sensível ao modo (issue 016, §1.3/§4): em `percentage-to-weight`
 * (padrão), a % é a fonte de verdade (editável, exceto farinha única — trava
 * 100%) e o Peso é derivado (texto plano, sem box). Em `weight-to-percentage`,
 * a direção se INVERTE para qualquer ingrediente não-fermento (§1.3, "inclusive
 * farinha e água"): o Peso vira editável e a % passa a ser derivada — a trava
 * de farinha única só existe no modo padrão. A % recebe a classe `pct`
 * (marcador do destaque obrigatório do banner, `.mode-alt .cell-input.pct`,
 * design-system.css) nos dois modos; quando derivada, o campo continua sendo
 * um `<input readonly>` (não texto plano) porque o PRÓPRIO destaque visual é
 * o sinal exigido pela §1.3 — exceção documentada ao sinal invertido genérico
 * do brandbook §4.1. O Fermento é a exceção da exceção (§1.3: "o peso do
 * fermento nunca é editado diretamente"): sua % permanece sempre editável e
 * seu Peso sempre derivado, nos dois modos — `buildFermentoRow` não muda.
 * Alternar `calculationMode` é mudança ESTRUTURAL (editabilidade dos campos
 * muda) — `fullRender()`, nunca só `patchAllDerived()`.
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
 * Issue 022 (achados baixos da revisão da 014): zero `style=` inline —
 * `.title-row`/`.toggle-label`/`.push-right`/`.btn-sm`/`.row.row--tight`/
 * `.table-add-cell` (design-system.css) substituem os 7 encontrados aqui.
 *
 * Seções implementadas: §1.3, §2.A.2, §4, §5.A, §5.B, §5.C, §7.1, §9.
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
// Extraídos para cellHelpers.ts (issue 015, regra de ouro 2) — reusados também
// por sourdoughTable.ts. Comportamento idêntico ao anterior, só de local.
import { UNIT_OPTIONS, moneyPlain, applyValidation } from './cellHelpers';

/**
 * Referências às células derivadas de uma linha — únicas repintadas via
 * `subscribe`. Exatamente um de `derivedWeightTarget`/`derivedPctTarget` é
 * não-nulo por linha de ingrediente, conforme o modo vigente no momento do
 * `fullRender()` (§1.3/§4, ver cabeçalho do arquivo); a linha do Fermento
 * sempre usa `derivedWeightTarget` (peso sempre derivado, nos dois modos).
 */
interface RowRefs {
  derivedWeightTarget: HTMLElement | null;
  derivedPctTarget: HTMLElement | null;
  costGCell: HTMLElement;
  costCell: HTMLElement;
}
interface FootRefs {
  pctCell: HTMLElement;
  weightCell: HTMLElement;
  costCell: HTMLElement;
}

export function renderIngredientsTable(root: HTMLElement, store: AppStateStore): void {
  const card = h('section', { className: 'card' });
  root.appendChild(card);

  // Barra de título + toggle "Exibir custos" (§2.A.2: default oculto, persistido via prefs 011).
  // `.title-row`/`.toggle-label`/`.push-right` (design-system.css, issue 022) —
  // substituem os `style=` inline achados na revisão da issue 014.
  const titleBar = h('div', { className: 'title-row' });
  titleBar.appendChild(h('h2', {}, ['Ingredientes']));

  const toggleLabel = h('label', { className: 'toggle-label push-right' });
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

  /** Escreve texto formatado num alvo derivado — `<input readonly>` usa `.value`, célula plana usa `.textContent` (§1.3/§4). */
  function setDerivedDisplay(el: HTMLElement, text: string): void {
    if (el instanceof HTMLInputElement) el.value = text;
    else el.textContent = text;
  }

  /** Repinta só as células derivadas + rodapé — nunca recria um input em foco. */
  function patchAllDerived(): void {
    const { recipe } = store.getState();
    for (const [id, refs] of rowRefs) {
      if (id === 'fermento') {
        const sd = recipe.sourdough;
        if (refs.derivedWeightTarget) setDerivedDisplay(refs.derivedWeightTarget, formatWeight(sd.totalWeight ?? 0));
        refs.costGCell.textContent = sd.costPerGram !== undefined ? formatCostPerGram(sd.costPerGram) : '—';
        refs.costCell.textContent = sd.totalCost !== undefined ? formatCurrency(sd.totalCost) : '—';
      } else {
        const ing = recipe.ingredients.find((i) => i.id === id);
        if (!ing) continue;
        // §1.3: só um dos dois é derivado por vez, conforme o modo (ver fullRender).
        if (refs.derivedWeightTarget) setDerivedDisplay(refs.derivedWeightTarget, formatWeight(ing.weight));
        else if (refs.derivedPctTarget) setDerivedDisplay(refs.derivedPctTarget, formatPercent(ing.percentage));
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
    // Ordem das colunas (diretiva de layout do coordenador — desvio consciente
    // vs `mockups/calculadora.html`/spec §2.A.2): as colunas de dados/custo
    // vêm primeiro; "Unidade" foi movida para logo depois de "Custo" e antes da
    // coluna de ações (botão remover), que é sempre a última da linha (§10).
    const thead = h('thead');
    thead.appendChild(
      h('tr', {}, [
        h('th', {}, ['Ingrediente']),
        h('th', { className: 'num' }, ['%']),
        h('th', { className: 'num' }, ['Peso (g)']),
        h('th', { className: 'num cost-col' }, ['Preço pago']),
        h('th', { className: 'num cost-col' }, ['Peso do produto']),
        h('th', { className: 'num cost-col' }, ['Custo/g']),
        h('th', { className: 'num cost-col' }, ['Custo']),
        h('th', {}, ['Unidade']),
        h('th', { className: 'col-actions', 'aria-label': 'Ações' }),
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
        className: 'btn btn-secondary btn-sm', // `.btn-sm` (design-system.css, issue 022) — era style inline
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
    // Nome só com o input; o botão remover foi para a coluna de ações no fim da
    // linha (diretiva de layout do coordenador — última ação horizontal, §10).
    const nameCell = h('td', {}, [nameInput]);
    const actionsCell = h('td', { className: 'col-actions' }, [removeBtn]);

    // Unidade — sólidos "g" fixo; líquidos/gorduras alternador g/mL (§2.A.2).
    const unitCell = h('td');
    if (ing.category === 'liquid' || ing.category === 'fat') {
      unitCell.appendChild(buildUnitToggle(ing, index));
    } else {
      unitCell.textContent = 'g';
    }

    // Modo de cálculo (§1.3/§4, ver cabeçalho do arquivo): decide qual dos
    // dois campos (% ou Peso) é a fonte de verdade editável desta linha.
    const mode = store.getState().recipe.calculationMode;
    const isWeightToPct = mode === 'weight-to-percentage';
    // Trava de farinha única (100%) só existe no modo padrão — em peso→% a %
    // é sempre derivada, então a trava não se aplica (§1.3, "inclusive farinha e água").
    const isLockedFlour = !isWeightToPct && ing.category === 'flour' && flourCount === 1;
    const pctReadonly = isWeightToPct || isLockedFlour;

    // % — classe `pct` sempre presente (marcador do destaque §1.3); em
    // peso→% é derivada (readonly, mas com o destaque, ver cabeçalho);
    // no modo padrão trava 100% se única farinha; senão editável (§5.A).
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
    // Só marca a célula como `.readonly` quando a % é REALMENTE derivada
    // (peso→%, §1.3) — a trava de farinha única (100%) no modo padrão não
    // muda essa classe (comportamento pré-016 preservado, ver `td.readonly`
    // único por linha usado pelos testes de 014/016).
    const pctCell = h('td', { className: isWeightToPct ? 'num readonly' : 'num' }, [pctInput]);

    // Peso — derivado (texto plano, sem box, decisão 24/brandbook §4.1) no
    // modo padrão; editável (§1.3, "inclusive farinha e água") em peso→%.
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

    // Ordem: Ingrediente · % · Peso · [custos] · Unidade · Ações (diretiva do
    // coordenador — Unidade após Custo, botão remover na extrema direita).
    tr.appendChild(nameCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(unitCell);
    tr.appendChild(actionsCell);

    // §1.3/§4: só um dos dois é derivado por vez, conforme o modo vigente
    // neste `fullRender()` — patchAllDerived escreve no alvo certo.
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

    // §1.3: o Fermento é sempre por proporção, nos dois modos — a %
    // permanece editável (nunca derivada); a classe `pct` só reflete o
    // destaque visual global do banner, sem mudar comportamento.
    const pctInput = h('input', {
      className: 'cell-input num pct',
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

    // Mesma ordem das linhas de ingrediente; o Fermento não tem botão remover
    // (linha consolidada da sub-receita), então a célula de ações fica vazia.
    tr.appendChild(nameCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(dashPrice);
    tr.appendChild(dashPw);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(unitCell);
    tr.appendChild(h('td', { className: 'col-actions' }));

    // §1.3: peso do fermento é SEMPRE derivado, nos dois modos.
    return { tr, refs: { derivedWeightTarget: weightCell, derivedPctTarget: null, costGCell, costCell } };
  }

  function buildAddRow(): HTMLTableRowElement {
    const tr = h('tr') as HTMLTableRowElement;
    const addBtn = h(
      'button',
      { type: 'button', className: 'btn btn-secondary btn-sm' }, // `.btn-sm` (issue 022) — era style inline
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
    tr.appendChild(h('td', { colspan: 9, className: 'table-add-cell' }, [addBtn])); // colspan = nº de colunas (com Unidade + Ações)
    return tr;
  }

  function buildTfoot(): { tfoot: HTMLTableSectionElement; refs: FootRefs } {
    const tfoot = h('tfoot');
    const pctCell = h('td', { className: 'num' });
    const weightCell = h('td', { className: 'num' });
    const costCell = h('td', { className: 'num cost-col' });
    // Colunas: Ingrediente · % · Peso · [Preço·PesoProduto·Custo/g] · Custo ·
    // Unidade · Ações. As duas últimas (Unidade/Ações) não têm total (colspan 2).
    tfoot.appendChild(
      h('tr', {}, [
        h('td', {}, ['Total da massa']),
        pctCell,
        weightCell,
        h('td', { className: 'cost-col', colspan: 3 }),
        costCell,
        h('td', { colspan: 2 }),
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
  // §1.3/§4: alternar `calculationMode` é mudança ESTRUTURAL (editabilidade
  // de %/Peso se inverte) — exige `fullRender()`, não só `patchAllDerived()`.
  // Qualquer outra mutação segue só repintando as células derivadas (§1.6).
  let lastMode = store.getState().recipe.calculationMode;
  store.subscribe(() => {
    const mode = store.getState().recipe.calculationMode;
    if (mode !== lastMode) {
      lastMode = mode;
      fullRender();
    } else {
      patchAllDerived();
    }
  });
}
