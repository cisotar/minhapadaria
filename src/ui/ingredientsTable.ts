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
 * mudança estrutural: add/remove/alternância de unidade do peso do produto,
 * que chamam `fullRender()`). `blur` valida via `validation.ts` (010): bloqueio reverte
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
 * Refactor de múltiplas farinhas (2026-07-05, aprovado — `mockups/
 * calculadora-farinhas.html`): a edição de farinha (nome, %, peso, preço,
 * peso do produto, remover) migrou para a tabela "Farinhas" do card Ancoragem
 * (`batchPanel.ts`) — mesmo desenho de sub-receita já usado pelo Fermento
 * (a linha "Fermento" abaixo consome `recipe.sourdough`, somente-leitura).
 * Aqui, cada linha `category:'flour'` de `recipe.ingredients` vira uma linha
 * CONSUMIDA (`buildFlourDisplayRow`): nome + `(vem da Ancoragem)`, %, peso,
 * preço pago, peso do produto, custo/g e custo — todos texto plano
 * somente-leitura, sem botão remover. `buildIngredientRow` só atende as
 * demais categorias (liquid/fat/salt/extra) — sem farinha, então a trava
 * de 100%/mínimo-1-farinha não se aplica mais aqui (migrou por completo).
 *
 * Contrato-espelho (2026-07-06, `spec/refactor-farinhas-multiplas.md` §3, fase
 * 1) — 2 bugs corrigidos:
 *  1. §3.2 (ordem/contiguidade): `fullRender()` agora faz DOIS passes sobre
 *     `recipe.ingredients` — primeiro as farinhas (`buildFlourDisplayRow`),
 *     formando um bloco CONTÍGUO NO TOPO, depois as demais categorias
 *     (`buildIngredientRow`, preservando o índice real do array) — antes a
 *     ordem seguia o array cru (`forEach` único), então farinhas adicionadas
 *     via `+ farinha` (push no fim do array) apareciam DEPOIS de água/
 *     azeite/sal em vez de formarem bloco com a 1ª farinha. Como
 *     `batchPanel.ts` também filtra `category==='flour'` na ordem do array,
 *     a ordem das duas tabelas bate automaticamente (mesmo array, mesmo
 *     filtro) — não foi preciso trocar `push` por `splice`.
 *  2. §3.4 (sincronização do nome): `patchAllDerived` repintava %/peso/preço/
 *     custo da farinha mas não o nome — `buildFlourDisplayRow` não guardava
 *     ref dele. Renomear na tabela Farinhas (sem mudar a lista de ids) não
 *     dispara `fullRender()`, então o nome ficava "velho". Fix: `nameCell`
 *     (novo campo opcional de `RowRefs`) aponta pro `<span>` do nome; `patchAllDerived`
 *     repinta via `textContent` (regra de ouro 3 — nunca `innerHTML`) a cada
 *     notificação do store, junto com os demais campos consumidos.
 * Fase 2 (sub-receita do Fermento, spec §5) — FORA de escopo, não tocada.
 *
 * Seções implementadas: §1.3, §2.A.2, §4, §5.A, §5.B, §5.C, §7.1, §9.
 */
import { parseDecimal, formatPercent, formatWeight, formatCurrency, formatCostPerGram } from '../core/format';
import {
  validateNonNegative,
  validatePackageSize,
  validateSourdoughProportion,
  type ValidationResult,
} from '../core/validation';
import { recipeSumPercent } from '../core/scaling'; // reuso (regra de ouro 2): Σ%ingredientes + %fermento (§3.D)
import type { Ingredient, PackageCost } from '../core/types';
import { h, clear, on } from './dom';
import type { AppStateStore } from './state';
// Extraídos para cellHelpers.ts (issue 015, regra de ouro 2) — reusados também
// por sourdoughTable.ts/batchPanel.ts. Comportamento idêntico ao anterior, só de local.
import { UNIT_OPTIONS, moneyPlain, applyValidation, setDerivedDisplay } from './cellHelpers';
// issue 030 (divergência aprovada — sem volume): removida a coluna "Unidade"
// e o alternador g/mL (`buildUnitToggle`); todo peso de produto é sempre "g"
// (comunicado pelo header "Peso do produto"/select kg-g), então uma coluna
// dedicada de unidade virou ruído sem informação (brandbook §4.1, decisão 24).

/**
 * Referências às células derivadas de uma linha — únicas repintadas via
 * `subscribe`. Para ingredientes não-farinha, exatamente um de
 * `derivedWeightTarget`/`derivedPctTarget` é não-nulo, conforme o modo
 * vigente no momento do `fullRender()` (§1.3/§4, ver cabeçalho do arquivo); a
 * linha do Fermento sempre usa `derivedWeightTarget` (peso sempre derivado,
 * nos dois modos). Para farinha (linha CONSUMIDA, somente-leitura — edição em
 * `batchPanel.ts`), AMBOS `derivedWeightTarget`/`derivedPctTarget` são
 * preenchidos (sempre texto plano) e `priceCell`/`pwCell` também são
 * repintados, porque a edição acontece num módulo diferente.
 */
interface RowRefs {
  derivedWeightTarget: HTMLElement | null;
  derivedPctTarget: HTMLElement | null;
  costGCell: HTMLElement;
  costCell: HTMLElement;
  priceCell?: HTMLElement; // só farinha — preço pago também é consumido/repintado aqui
  pwCell?: HTMLElement; // só farinha — peso do produto também é consumido/repintado aqui
  nameCell?: HTMLElement; // só farinha — nome também é consumido/repintado aqui (spec §3.4, bug do nome)
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
        if (ing.category === 'flour') {
          // Linha CONSUMIDA (somente-leitura, edição em batchPanel.ts): nome/
          // %/peso/preço/peso-do-produto podem mudar por uma edição em OUTRO
          // módulo — sempre repintados aqui (nunca só um dos dois, ao
          // contrário das demais categorias, ver header do arquivo). Nome via
          // `textContent` (regra de ouro 3, nunca innerHTML) — spec
          // §3.4/bug do nome (renomear na Ancoragem não refletia aqui).
          if (refs.nameCell) refs.nameCell.textContent = ing.name;
          if (refs.derivedWeightTarget) setDerivedDisplay(refs.derivedWeightTarget, formatWeight(ing.weight));
          if (refs.derivedPctTarget) setDerivedDisplay(refs.derivedPctTarget, formatPercent(ing.percentage));
          if (refs.priceCell) refs.priceCell.textContent = formatCurrency(ing.packageCost.pricePaid);
          if (refs.pwCell) {
            refs.pwCell.textContent = `${formatWeight(ing.packageCost.packageSize)} ${ing.packageCost.packageUnit}`;
          }
        } else {
          // §1.3: só um dos dois é derivado por vez, conforme o modo (ver fullRender).
          if (refs.derivedWeightTarget) setDerivedDisplay(refs.derivedWeightTarget, formatWeight(ing.weight));
          else if (refs.derivedPctTarget) setDerivedDisplay(refs.derivedPctTarget, formatPercent(ing.percentage));
        }
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
    // vêm primeiro; a coluna de ações (botão remover) é sempre a última da
    // linha (§10). Issue 030: coluna "Unidade" removida (sem volume, toda
    // linha era sempre "g" — ruído sem informação, ver nota de importação acima).
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
        h('th', { className: 'col-actions', 'aria-label': 'Ações' }),
      ]),
    );
    return thead;
  }

  /**
   * Linha editável de ingrediente NÃO-farinha (liquid/fat/salt/extra) — a
   * farinha migrou por completo para `batchPanel.ts` (tabela "Farinhas"),
   * então nem a trava de mínimo-1-farinha nem a trava de 100% da farinha
   * única se aplicam mais aqui.
   */
  function buildIngredientRow(ing: Ingredient, index: number): { tr: HTMLTableRowElement; refs: RowRefs } {
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

    const removeBtn = h(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm', // `.btn-sm` (design-system.css, issue 022) — era style inline
        title: 'Remover ingrediente',
        'aria-label': `Remover ${label}`,
      },
      ['×'],
    ) as HTMLButtonElement;
    on(removeBtn, 'click', () => {
      store.update((draft) => {
        draft.ingredients = draft.ingredients.filter((i) => i.id !== ing.id);
      });
      fullRender(); // add/remove é mudança estrutural (§5.B)
    });
    // Nome só com o input; o botão remover foi para a coluna de ações no fim da
    // linha (diretiva de layout do coordenador — última ação horizontal, §10).
    const nameCell = h('td', {}, [nameInput]);
    const actionsCell = h('td', { className: 'col-actions' }, [removeBtn]);

    // Modo de cálculo (§1.3/§4, ver cabeçalho do arquivo): decide qual dos
    // dois campos (% ou Peso) é a fonte de verdade editável desta linha.
    const mode = store.getState().recipe.calculationMode;
    const isWeightToPct = mode === 'weight-to-percentage';
    const pctReadonly = isWeightToPct;

    // % — classe `pct` sempre presente (marcador do destaque §1.3); em
    // peso→% é derivada (readonly, mas com o destaque, ver cabeçalho);
    // no modo padrão é sempre editável (§5.A — a única categoria com regra de
    // soma-100%/trava é farinha, que migrou para batchPanel.ts).
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
        // §5.A: farinha (única categoria com regra de soma-100%) não passa
        // mais por este builder — não há validação de blur para % de
        // ingredientes comuns; só limpa qualquer sinalização anterior.
        applyValidation(pctInput, null, () => {});
        lastValidPct = formatPercent(parsed); // §9: arredondamento só na exibição
        pctInput.value = lastValidPct;
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

    // Ordem: Ingrediente · % · Peso · [custos] · Ações (diretiva do
    // coordenador — botão remover na extrema direita; issue 030 removeu a
    // coluna "Unidade" que ficava entre Custo e Ações).
    tr.appendChild(nameCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
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
   * Linha de farinha CONSUMIDA (somente-leitura): a edição (nome, %, peso,
   * preço pago, peso do produto, remover) vive na tabela "Farinhas" do card
   * Ancoragem (`batchPanel.ts`) — mesmo desenho de sub-receita já usado pelo
   * Fermento (`buildFermentoRow` abaixo consome `recipe.sourdough`). Todas as
   * 7 células são texto plano (brandbook §4.1: valor derivado sem box); nunca
   * um único remove-button (célula de ações vazia, §5.B — mínimo 1 farinha é
   * garantido lá).
   *
   * `nameValue` (spec/refactor-farinhas-multiplas.md §3.4, bug do nome):
   * guarda a referência do `<span>` do nome (mantendo o `<small
   * class="note-muted">` ao lado) para `patchAllDerived` repintar via
   * `textContent` a cada notificação do store — renomear na Ancoragem sem
   * mudar a lista de ids não disparava `fullRender()`, então o nome ficava
   * desatualizado sem esta ref.
   */
  function buildFlourDisplayRow(ing: Ingredient): { tr: HTMLTableRowElement; refs: RowRefs } {
    const tr = h('tr') as HTMLTableRowElement;
    tr.dataset.ingredientId = ing.id; // âncora estável (mesma convenção das demais linhas)

    const nameValue = h('span', {}, [ing.name]);
    const nameCell = h('td', {}, [nameValue, ' ', h('small', { className: 'note-muted' }, ['(↑ vem da Ancoragem)'])]);

    const pctCell = h('td', { className: 'num readonly' });
    pctCell.textContent = formatPercent(ing.percentage);

    const weightCell = h('td', { className: 'num readonly' });
    weightCell.textContent = formatWeight(ing.weight);

    const priceCell = h('td', { className: 'num cost-col readonly' });
    priceCell.textContent = formatCurrency(ing.packageCost.pricePaid);

    const pwCell = h('td', { className: 'num cost-col readonly' });
    pwCell.textContent = `${formatWeight(ing.packageCost.packageSize)} ${ing.packageCost.packageUnit}`;

    const costGCell = h('td', { className: 'num cost-col readonly' });
    costGCell.textContent = ing.costPerGram !== undefined ? formatCostPerGram(ing.costPerGram) : '—';
    const costCell = h('td', { className: 'num cost-col readonly' });
    costCell.textContent = ing.recipeCost !== undefined ? formatCurrency(ing.recipeCost) : '—';

    // Mesma ordem das demais linhas; sem botão remover (célula de ações vazia).
    tr.appendChild(nameCell);
    tr.appendChild(pctCell);
    tr.appendChild(weightCell);
    tr.appendChild(priceCell);
    tr.appendChild(pwCell);
    tr.appendChild(costGCell);
    tr.appendChild(costCell);
    tr.appendChild(h('td', { className: 'col-actions' }));

    return {
      tr,
      refs: {
        derivedWeightTarget: weightCell,
        derivedPctTarget: pctCell,
        costGCell,
        costCell,
        priceCell,
        pwCell,
        nameCell: nameValue,
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
    tr.appendChild(h('td', { colspan: 8, className: 'table-add-cell' }, [addBtn])); // colspan = nº de colunas (issue 030: 9→8, sem "Unidade")
    return tr;
  }

  function buildTfoot(): { tfoot: HTMLTableSectionElement; refs: FootRefs } {
    const tfoot = h('tfoot');
    const pctCell = h('td', { className: 'num' });
    const weightCell = h('td', { className: 'num' });
    const costCell = h('td', { className: 'num cost-col' });
    // Colunas: Ingrediente · % · Peso · [Preço·PesoProduto·Custo/g] · Custo ·
    // Ações. A última (Ações) não tem total (issue 030: colspan 2→1, sem "Unidade").
    tfoot.appendChild(
      h('tr', {}, [
        h('td', {}, ['Total da massa']),
        pctCell,
        weightCell,
        h('td', { className: 'cost-col', colspan: 3 }),
        costCell,
        h('td', {}),
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
    // Contrato-espelho (spec/refactor-farinhas-multiplas.md §3.2): bloco de
    // farinhas CONTÍGUO NO TOPO, na MESMA ORDEM da tabela Farinhas
    // (batchPanel.ts filtra `category==='flour'` na ordem do array — igual
    // aqui, então a 1ª farinha do array é sempre a 1ª linha nas DUAS
    // tabelas), antes dos demais ingredientes e da linha Fermento — nunca
    // intercalado com água/gordura/sal. Dois passes sobre o MESMO array (não
    // dois arrays filtrados novos) preservam o índice REAL de cada
    // ingrediente para `buildIngredientRow` (usado nos `store.update`).
    recipe.ingredients.forEach((ing) => {
      if (ing.category !== 'flour') return;
      const { tr, refs } = buildFlourDisplayRow(ing);
      rowRefs.set(ing.id, refs);
      tbody.appendChild(tr);
    });
    recipe.ingredients.forEach((ing, index) => {
      if (ing.category === 'flour') return;
      const { tr, refs } = buildIngredientRow(ing, index);
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

  /** Assinatura estável da lista de ingredientes (ids na ordem atual) — usada só
   *  para detectar add/remove estrutural vindo de OUTRO módulo (ex.: tabela de
   *  Farinhas em batchPanel.ts), já que a troca de unidade do peso do produto e
   *  o "+ ingrediente"/remover locais já chamam `fullRender()` diretamente. */
  function ingredientIdsSignature(): string {
    return store
      .getState()
      .recipe.ingredients.map((i) => i.id)
      .join(',');
  }

  fullRender();
  // §1.3/§4: alternar `calculationMode` é mudança ESTRUTURAL (editabilidade
  // de %/Peso se inverte) — exige `fullRender()`, não só `patchAllDerived()`.
  // Add/remove de farinha feito em batchPanel.ts também é estrutural (linhas
  // desta tabela aparecem/somem) — detectado via mudança na assinatura de ids.
  // Qualquer outra mutação segue só repintando as células derivadas (§1.6).
  let lastMode = store.getState().recipe.calculationMode;
  let lastIds = ingredientIdsSignature();
  store.subscribe(() => {
    const mode = store.getState().recipe.calculationMode;
    const ids = ingredientIdsSignature();
    if (mode !== lastMode || ids !== lastIds) {
      lastMode = mode;
      lastIds = ids;
      fullRender();
    } else {
      patchAllDerived();
    }
  });
}
