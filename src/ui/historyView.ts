/**
 * historyView.ts — Dashboard de Fornadas (spec §14.4/§14.5/§14.6/§14.7) · issue 018.
 *
 * O que faz: `renderHistoryView(root, deps)` monta, dentro de `root`, TODA a
 * tela "Histórico de Fornadas" (mockup `mockups/historico.html`): a barra de
 * ações fixa no topo (`.row.row--mb.row--sticky`, §8, revisão issue 019 —
 * Exportar XLSX + Imprimir/Salvar em PDF via `export/print.ts`
 * `renderHistoryPrintView`/`mountPrintButton`), o registro rápido
 * (`bakeForm.ts`), a barra de filtros (receita/intervalo/granularidade,
 * `.filter-bar`/`.period-toggle`), os KPIs do período (`.kpi-row`) com
 * comparação vs. período anterior, o indicador melhor/pior (`.best-worst`), o
 * gráfico de tendência (`trendChart.ts`) e a listagem cronológica com editar/
 * excluir/confirmar planejada.
 *
 * Reuso total (regra de ouro 2, ZERO fórmula nova aqui):
 *  - `core/bakes.ts` (013): `filterByRecipe`/`filterByDateRange` (§14.5),
 *    `aggregatePeriod`/`groupByDay|Week|Month` (§14.4), `comparePeriods`
 *    (§14.5), `bestPeriod`/`worstPeriod` (§14.5), `isPlanned`/`confirmPlanned`
 *    (§14.6), `isOrphan` (§14.7), `computeBakeDerived` (§14.3).
 *  - `core/pricing.ts`: `priceFromSalePrice`/`isLoss`/`marginStatus` para o
 *    chip de status por fornada (margem/prejuízo do snapshot unitário —
 *    mesma fórmula do trio de precificação, 007, nada recalculado aqui).
 *  - `core/validation.ts` (010): valida a edição inline de quantidades.
 *  - `core/format.ts` (002/018): `formatCurrency`/`formatPercent`/`formatDate`/
 *    `parseLocalDate`/`parseDecimal` — nenhuma formatação/parsing reinventada.
 *
 * Bucket-fantasma planned (decisão do plano da issue, §14.4): os grupos do
 * gráfico/melhor-pior são construídos a partir de `entries.filter(!isPlanned)`
 * ANTES de `groupBy*` (que bucketiza tudo); `aggregatePeriod` já filtra
 * `planned` internamente, então os KPIs do período podem receber a lista
 * ainda com planejadas misturadas. A TABELA lista todas as fornadas do
 * filtro de receita (INCLUSIVE planejadas/futuras fora do intervalo De/Até —
 * §14.5 "listagem cronológica de TODAS as fornadas"), enquanto KPIs/gráfico/
 * comparação/melhor-pior respeitam também o filtro de intervalo (divergência
 * consciente vs. o card único do mockup, documentada abaixo).
 *
 * Datas (decisão 013.2/format.ts, regra crítica): todo `<input type="date">`
 * é lido via `parseLocalDate` (nunca `new Date(str)`) e escrito via
 * `formatDate`. Período anterior = mesma largura (dias), imediatamente antes
 * de "De" (aritmética trivial de UI, não fórmula de domínio — comentada onde
 * ocorre).
 *
 * Edição inline (§14.5): por escopo, a tabela só mostra Data/Receita/Prod./
 * Vend./Lucro/Status (mockup) — "Editar" abre inputs `.cell-input` (sinal
 * invertido, brandbook §4.1) só para Produzida/Vendida (as únicas colunas
 * numéricas visíveis e editáveis da linha), validados via `validation.ts`
 * antes de `bakeStore.update`. Corrigir custo/preço/data/receita de uma
 * fornada já registrada fica fora do escopo desta tela (não há coluna visível
 * para isso no mockup) — divergência consciente, documentada.
 *
 * Segurança (regra de ouro 3): `entry.recipeName`/`notes` do usuário nunca
 * passam por `innerHTML` — só via `h`/`textContent` (dom.ts).
 *
 * Seções implementadas: §8 (export/print, revisão issue 019), §14.2 (hospeda
 * bakeForm), §14.3, §14.4, §14.5, §14.6, §14.7.
 */
import {
  computeBakeDerived,
  isPlanned,
  confirmPlanned,
  aggregatePeriod,
  groupByDay,
  groupByWeek,
  groupByMonth,
  filterByRecipe,
  filterByDateRange,
  comparePeriods,
  bestPeriod,
  worstPeriod,
  isOrphan,
} from '../core/bakes';
import { priceFromSalePrice, isLoss, marginStatus } from '../core/pricing';
import { validateQuantityProduced, validateQuantitySold } from '../core/validation';
import { formatCurrency, formatPercent, formatDate, parseLocalDate, parseDecimal } from '../core/format';
import type { BakeEntry, BakeHistorySummary } from '../core/types';
import type { RecipeStore } from '../storage/recipes';
import type { BakeStore } from '../storage/bakes';
import type { PrefsStore } from '../storage/prefs';
import { workbookToBlob, downloadBlob } from '../export/download';
import { mountPrintButton, renderHistoryPrintView } from '../export/print';
import { h, clear, on } from './dom';
import { applyValidation, marginChipClass } from './cellHelpers';
import { renderBakeForm } from './bakeForm';
import { renderTrendChart } from './trendChart';

export interface HistoryViewDeps {
  recipeStore: RecipeStore;
  bakeStore: BakeStore;
  /** Injetável para teste/pureza (default `() => new Date()`). §14.6: "hoje". */
  now?: () => Date;
  /** Injetável para teste (default `window.confirm`). §14.5: excluir com confirmação. */
  confirm?: (message: string) => boolean;
  /** §2.A.2 (issue 019): pref global "Exibir custos" para o XLSX com/sem custos. */
  prefs?: PrefsStore;
  /**
   * Nó onde o subtítulo dinâmico (`.subtitle`) do intervalo De/Até é montado —
   * issue 026 item 3, mesmo padrão de `recipesList.ts`/`headerRoot` (issue
   * 025 item 3): `historico.ts` passa `#hist-header` (o `<header
   * class="page-header">` estático do shell, ao lado do `<h1>`), espelhando
   * `mockups/historico.html` (`.subtitle` = "aaaa-mm-dd – aaaa-mm-dd").
   * Default: `root` (mantém a suíte isolada/testável sem shell de página).
   */
  headerRoot?: HTMLElement;
}

type Granularity = 'day' | 'week' | 'month';

// --- Aritmética de UI (não é fórmula de domínio — só navegação de datas) ---

function addDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

/** Nº de dias entre `from` e `to`, INCLUSIVO nas duas pontas. */
function daysInclusive(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Diferença em pontos percentuais (não é `percentVariation` — é subtração
 *  direta de duas taxas já computadas pelo core; usado só para o "pp" do
 *  KPI de Desperdício, mockup). */
function pointsDelta(current: number, previous: number): number {
  return current - previous;
}

function granularityLabel(g: Granularity): string {
  return g === 'day' ? 'dia' : g === 'week' ? 'semana' : 'mês';
}

export function renderHistoryView(root: HTMLElement, deps: HistoryViewDeps): void {
  const { recipeStore, bakeStore } = deps;
  const nowFn = deps.now ?? (() => new Date());
  const confirmFn = deps.confirm ?? ((message: string) => window.confirm(message));
  const headerRoot = deps.headerRoot ?? root; // issue 026 item 3 — default preserva a suíte isolada

  // issue 026 item 3: subtítulo dinâmico do intervalo De/Até (`.subtitle`,
  // design-system.css) — montado em `headerRoot` (default `root`;
  // `historico.ts` passa `#hist-header` real), atualizado a cada renderAll
  // (filtro muda → subtítulo acompanha, fidelidade ao mockup).
  const subtitle = h('p', { className: 'subtitle' });
  headerRoot.appendChild(subtitle);

  let filterRecipeId = '';
  let granularity: Granularity = 'day';
  let editingId: string | null = null;
  // §8/§14.5 (issue 019): última fatia filtrada (fornadas derivadas + resumo do
  // período), capturada a cada renderAll para o Exportar XLSX consumir sem
  // recalcular (§1.6). Fornadas incluem planejadas (marca de status); o resumo
  // vem de aggregatePeriod (planejadas fora).
  let lastExport: { entries: BakeEntry[]; summary: BakeHistorySummary } | null = null;

  const today = nowFn();
  const dateFromStr0 = formatDate(addDays(today, -6)); // padrão: últimos 7 dias (§14.4)
  const dateToStr0 = formatDate(today);

  // --- Barra de ações (§8, revisão issue 019 — achados ALTO) ---
  // Exportar XLSX + Imprimir/Salvar em PDF do período filtrado, ANTES de
  // qualquer outro card (spec §8 literal "botão fixo no topo"). Reusa
  // `.row.row--mb.row--sticky` (`.export-bar` duplicava `.row`, removida) —
  // sticky fixa a barra no topo do scroll. `#print-root` fica no <body>
  // (único bloco visível em `@media print`, design-system.css); a impressão
  // do Histórico usava só o XLSX antes desta correção — agora tem o mesmo
  // botão "Imprimir / Salvar em PDF" da Calculadora, consumindo a MESMA fatia
  // filtrada (`lastExport`) sem recalcular (§1.6).
  const printRoot = h('div', { id: 'print-root' });
  document.body.appendChild(printRoot);
  const actionBar = h('div', { className: 'row row--mb row--sticky' });
  root.appendChild(actionBar);

  // --- Registro rápido (§14.2) — hospeda bakeForm.ts ---
  const formHost = h('div');
  root.appendChild(formHost);
  renderBakeForm(formHost, {
    recipeStore,
    bakeStore,
    now: nowFn,
    onCreated: () => renderAll(),
  });

  // --- Filtros (§14.4/§14.5) ---
  const filterCard = h('section', { className: 'card' });
  root.appendChild(filterCard);
  const filterBar = h('div', { className: 'filter-bar' });
  filterCard.appendChild(filterBar);

  const recipeFilterField = h('div', { className: 'field' });
  recipeFilterField.appendChild(h('label', {}, ['Receita']));
  const recipeFilterSelect = h('select', {
    className: 'input',
    'aria-label': 'Filtrar por receita',
  }) as HTMLSelectElement;
  recipeFilterField.appendChild(recipeFilterSelect);
  filterBar.appendChild(recipeFilterField);

  const fromField = h('div', { className: 'field' });
  fromField.appendChild(h('label', {}, ['De']));
  const fromInput = h('input', {
    className: 'input',
    type: 'date',
    value: dateFromStr0,
    'aria-label': 'De',
  }) as HTMLInputElement;
  fromField.appendChild(fromInput);
  filterBar.appendChild(fromField);

  const toField = h('div', { className: 'field' });
  toField.appendChild(h('label', {}, ['Até']));
  const toInput = h('input', {
    className: 'input',
    type: 'date',
    value: dateToStr0,
    'aria-label': 'Até',
  }) as HTMLInputElement;
  toField.appendChild(toInput);
  filterBar.appendChild(toField);

  const periodField = h('div', { className: 'field' });
  periodField.appendChild(h('label', {}, ['Período']));
  const periodToggle = h('div', { className: 'period-toggle' });
  const dayBtn = h('button', { type: 'button', className: 'active' }, ['Dia']) as HTMLButtonElement;
  const weekBtn = h('button', { type: 'button' }, ['Semana']) as HTMLButtonElement;
  const monthBtn = h('button', { type: 'button' }, ['Mês']) as HTMLButtonElement;
  periodToggle.appendChild(dayBtn);
  periodToggle.appendChild(weekBtn);
  periodToggle.appendChild(monthBtn);
  periodField.appendChild(periodToggle);
  filterBar.appendChild(periodField);

  // §8 (issue 019, revisão): Exportar XLSX + Imprimir/Salvar em PDF do período
  // filtrado (com/sem custos via pref §2.A.2) — na barra fixa `actionBar` no
  // topo da tela (spec §8 literal), não mais dentro do `.filter-bar`.
  const exportXlsxBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Exportar XLSX']);
  on(exportXlsxBtn, 'click', () => {
    if (lastExport === null) return;
    // Code-split (revisão issue 027, achado baixo #3): ExcelJS (~942 kB) só
    // entra no bundle no clique, via `import()` dinâmico — nunca no
    // carregamento inicial da tela do Histórico.
    const includeCosts = deps.prefs?.getShowCosts() ?? false; // §2.A.2
    const { entries, summary } = lastExport;
    const stamp = formatDate(nowFn()); // aaaa-mm-dd (§7.1)
    void import('../export/xlsx').then(({ buildHistoryWorkbook }) => {
      const wb = buildHistoryWorkbook(entries, summary, { includeCosts });
      return workbookToBlob(wb);
    }).then((blob) => downloadBlob(blob, `minha-padaria-historico-${stamp}.xlsx`));
  });
  actionBar.appendChild(exportXlsxBtn);
  mountPrintButton(actionBar, () => {
    // §8: renderiza o relatório do período filtrado atual e imprime — SÓ no
    // clique, nunca no init (achado ALTO da revisão: faltava no Histórico).
    if (lastExport === null) return;
    clear(printRoot);
    const includeCosts = deps.prefs?.getShowCosts() ?? false; // §2.A.2
    renderHistoryPrintView(printRoot, { entries: lastExport.entries, summary: lastExport.summary, includeCosts });
    window.print();
  });

  function setGranularity(g: Granularity, btn: HTMLButtonElement): void {
    granularity = g;
    for (const b of [dayBtn, weekBtn, monthBtn]) b.classList.remove('active');
    btn.classList.add('active');
    renderAll();
  }
  on(dayBtn, 'click', () => setGranularity('day', dayBtn));
  on(weekBtn, 'click', () => setGranularity('week', weekBtn));
  on(monthBtn, 'click', () => setGranularity('month', monthBtn));
  on(recipeFilterSelect, 'change', () => {
    filterRecipeId = recipeFilterSelect.value;
    renderAll();
  });
  on(fromInput, 'change', () => renderAll());
  on(toInput, 'change', () => renderAll());

  // --- KPIs (§14.4) ---
  const kpiCard = h('section', { className: 'card' });
  root.appendChild(kpiCard);
  kpiCard.appendChild(h('h2', {}, ['Resumo do período']));
  const kpiRow = h('div', { className: 'kpi-row' });
  kpiCard.appendChild(kpiRow);

  function buildKpiTile(label: string): { value: HTMLElement } {
    const tile = h('div', { className: 'kpi-tile' });
    tile.appendChild(h('span', { className: 'label' }, [label]));
    const value = h('span', { className: 'value' });
    tile.appendChild(value);
    kpiRow.appendChild(tile);
    return { value };
  }
  const producedTile = buildKpiTile('Produzido');
  const soldTile = buildKpiTile('Vendido');
  const costTile = buildKpiTile('Custo total');
  const revenueTile = buildKpiTile('Faturamento');
  const profitTile = buildKpiTile('Lucro');
  const marginTile = buildKpiTile('Margem média');
  const wastageTile = buildKpiTile('Desperdício');

  const comparisonNote = h('p', { className: 'note-muted mt-3' }); // issue 022 — era style inline
  kpiCard.appendChild(comparisonNote);

  /** Preenche o valor de um tile e, se houver comparação, o `.delta` (§14.5:
   *  anterior vazio/impossível → "—", nunca 0 forjado). */
  function setKpiValue(valueEl: HTMLElement, text: string, delta: number | null, fmt: (v: number) => string): void {
    valueEl.textContent = text;
    const span = h('span', { className: 'delta' });
    if (delta === null) {
      span.textContent = ' —'; // espaço à frente — mesmo padrão do ramo ↑/↓ abaixo, sem colar no valor
    } else {
      const dir = delta >= 0 ? 'up' : 'down';
      span.classList.add(dir);
      span.textContent = ` ${delta >= 0 ? '↑' : '↓'} ${fmt(Math.abs(delta))}`;
    }
    valueEl.appendChild(span);
  }

  // --- Melhor/pior (§14.5) ---
  const bestWorstSection = h('section', { className: 'best-worst' });
  root.appendChild(bestWorstSection);
  const bestCard = h('div', { className: 'card-mini best' });
  const bestLabel = h('div', { className: 'label' });
  const bestValue = h('div', { className: 'value' });
  bestCard.appendChild(bestLabel);
  bestCard.appendChild(bestValue);
  const worstCard = h('div', { className: 'card-mini worst' });
  const worstLabel = h('div', { className: 'label' });
  const worstValue = h('div', { className: 'value' });
  worstCard.appendChild(worstLabel);
  worstCard.appendChild(worstValue);
  bestWorstSection.appendChild(bestCard);
  bestWorstSection.appendChild(worstCard);

  // --- Gráfico de tendência (§14.5) ---
  const chartCard = h('section', { className: 'card' });
  root.appendChild(chartCard);
  chartCard.appendChild(h('h2', {}, ['Faturamento e Lucro no período']));
  // `.swatch-dot--revenue`/`.swatch-dot--profit` (design-system.css, issue 022) — era style inline.
  chartCard.appendChild(
    h('div', { className: 'chart-legend' }, [
      h('span', {}, [h('span', { className: 'swatch-dot swatch-dot--revenue' }), 'Faturamento']),
      h('span', {}, [h('span', { className: 'swatch-dot swatch-dot--profit' }), 'Lucro']),
    ]),
  );
  const chartHost = h('div');
  chartCard.appendChild(chartHost);

  // --- Tabela de fornadas (§14.5/§14.6/§14.7) ---
  const tableCard = h('section', { className: 'card' });
  root.appendChild(tableCard);
  tableCard.appendChild(h('h2', {}, ['Fornadas registradas']));
  const table = h('table', { className: 'table' });
  table.appendChild(
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['Data']),
        h('th', {}, ['Receita']),
        h('th', { className: 'num' }, ['Prod.']),
        h('th', { className: 'num' }, ['Vend.']),
        h('th', { className: 'num' }, ['Lucro']),
        h('th', {}, ['Status']),
        h('th', {}, []),
      ]),
    ]),
  );
  const tbody = h('tbody');
  table.appendChild(tbody);
  tableCard.appendChild(table);

  // --- Linha da tabela (edição inline só de Produzida/Vendida, §14.5) ---
  function buildRow(entry: BakeEntry, recipeIds: ReadonlySet<string>): HTMLElement {
    const planned = isPlanned(entry);
    const orphan = isOrphan(entry, recipeIds);
    const derived = computeBakeDerived(entry);
    const tr = h('tr', planned ? { className: 'planned' } : {});

    const dateCell = h('td', { className: 'num num--left' }, [formatDate(entry.date)]); // issue 022 — era style inline
    const recipeCell = h('td', {}, [entry.recipeName]); // textContent — regra de ouro 3

    let producedCell: HTMLElement;
    let soldCell: HTMLElement;
    let actionsCell: HTMLElement;

    if (editingId === entry.id) {
      const producedInput = h('input', {
        className: 'cell-input num',
        value: String(entry.quantityProduced),
        'aria-label': `Produzida (edição) de ${entry.recipeName}`,
      }) as HTMLInputElement;
      const soldInput = h('input', {
        className: 'cell-input num',
        value: String(entry.quantitySold),
        'aria-label': `Vendida (edição) de ${entry.recipeName}`,
      }) as HTMLInputElement;
      producedCell = h('td', { className: 'num' }, [producedInput]);
      soldCell = h('td', { className: 'num' }, [soldInput]);

      const saveBtn = h('button', { type: 'button', className: 'btn btn-primary' }, ['Salvar']) as HTMLButtonElement;
      const cancelBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancelar']) as HTMLButtonElement;
      on(cancelBtn, 'click', () => {
        editingId = null;
        renderAll();
      });
      on(saveBtn, 'click', () => {
        const produced = parseDecimal(producedInput.value);
        const producedIssue = produced === null ? null : validateQuantityProduced(produced);
        if (produced === null || (producedIssue && producedIssue.level === 'block')) {
          applyValidation(producedInput, producedIssue ?? { valid: false, level: 'block', message: 'Valor inválido.' }, () => {});
          return;
        }
        const sold = parseDecimal(soldInput.value);
        const soldIssue = sold === null ? null : validateQuantitySold(sold, produced);
        if (sold === null || (soldIssue && soldIssue.level === 'block')) {
          applyValidation(soldInput, soldIssue ?? { valid: false, level: 'block', message: 'Valor inválido.' }, () => {});
          return;
        }
        bakeStore.update({ ...entry, quantityProduced: produced, quantitySold: sold });
        editingId = null;
        renderAll();
      });
      actionsCell = h('td', {}, [saveBtn, cancelBtn]);
    } else {
      producedCell = h('td', { className: 'num' }, [String(entry.quantityProduced)]);
      soldCell = h('td', { className: 'num' }, [planned ? '—' : String(entry.quantitySold)]);

      const editBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Editar']) as HTMLButtonElement;
      on(editBtn, 'click', () => {
        editingId = entry.id;
        renderAll();
      });
      actionsCell = h('td', {}, [editBtn]);
      if (planned) {
        const confirmBtn = h('button', { type: 'button', className: 'btn btn-primary' }, ['Confirmar']) as HTMLButtonElement;
        on(confirmBtn, 'click', () => {
          bakeStore.update(confirmPlanned(entry)); // §14.6: remove `planned` → passa a contar
          renderAll();
        });
        actionsCell.appendChild(confirmBtn);
      }
      const deleteBtn = h('button', { type: 'button', className: 'btn btn-danger' }, ['Excluir']) as HTMLButtonElement;
      on(deleteBtn, 'click', () => {
        const message = `Excluir a fornada de "${entry.recipeName}" em ${formatDate(entry.date)}?`;
        if (!confirmFn(message)) return;
        bakeStore.remove(entry.id); // §14.7: remove só por id, nunca cascade
        renderAll();
      });
      actionsCell.appendChild(deleteBtn);
    }

    const profitCell = h('td', { className: 'num' }, [planned ? '—' : formatCurrency(derived.totalProfit ?? 0)]);
    if (!planned && (derived.totalProfit ?? 0) < 0) profitCell.classList.add('loss');

    const statusCell = h('td', {});
    if (planned) {
      statusCell.appendChild(h('span', { className: 'badge-planned' }, ['◌ Planejada — fora dos totais']));
    } else if (orphan) {
      // §14.7: receita excluída — reusa `.chip`/`.chip-warn` (zero classe nova).
      statusCell.appendChild(h('span', { className: 'chip chip-warn' }, ['Receita excluída']));
    } else {
      const { profitMargin } = priceFromSalePrice(entry.unitCost, entry.unitSalePrice); // §3.E, reuso
      const loss = isLoss(entry.unitCost, entry.unitSalePrice); // §4/§5.C, reuso
      const chip = h('span', { className: 'chip' }, [loss ? 'Prejuízo' : `Margem ${formatPercent(profitMargin)}%`]);
      chip.classList.add(loss ? 'chip-crit' : marginChipClass(marginStatus(profitMargin)));
      statusCell.appendChild(chip);
    }

    tr.appendChild(dateCell);
    tr.appendChild(recipeCell);
    tr.appendChild(producedCell);
    tr.appendChild(soldCell);
    tr.appendChild(profitCell);
    tr.appendChild(statusCell);
    tr.appendChild(actionsCell);
    return tr;
  }

  // --- Render central (§1.6: recálculo imediato a cada alteração de filtro) ---
  function renderAll(): void {
    const recipes = recipeStore.list();
    const recipeIds = new Set(recipes.map((r) => r.id));

    // Repovoa o <select> de filtro (cobre receitas criadas depois do mount),
    // preservando a seleção atual quando ainda existir.
    const previousSelection = filterRecipeId;
    clear(recipeFilterSelect);
    recipeFilterSelect.appendChild(h('option', { value: '' }, ['Todas as receitas']));
    for (const r of recipes) recipeFilterSelect.appendChild(h('option', { value: r.id }, [r.name]));
    filterRecipeId = recipes.some((r) => r.id === previousSelection) ? previousSelection : '';
    recipeFilterSelect.value = filterRecipeId;

    const all = bakeStore.list();
    const recipeFiltered = filterRecipeId === '' ? all : filterByRecipe(all, filterRecipeId); // §14.5

    const dateFrom = parseLocalDate(fromInput.value); // §7.1: dia local, nunca UTC
    const dateTo = parseLocalDate(toInput.value);
    // issue 026 item 3: subtítulo do header acompanha o intervalo De/Até corrente.
    subtitle.textContent = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
    const periodFiltered = filterByDateRange(recipeFiltered, dateFrom, dateTo); // §14.5 inclusivo
    const periodFilteredReal = periodFiltered.filter((e) => !isPlanned(e)); // §14.4: pré-filtro ANTES de agrupar

    const currentSummary = aggregatePeriod(periodFiltered, dateFrom, dateTo); // já filtra planned internamente

    const groups =
      granularity === 'day'
        ? groupByDay(periodFilteredReal)
        : granularity === 'week'
          ? groupByWeek(periodFilteredReal)
          : groupByMonth(periodFilteredReal);

    // Período anterior: mesma largura (dias), imediatamente antes de "De".
    const width = daysInclusive(dateFrom, dateTo);
    const prevTo = addDays(dateFrom, -1);
    const prevFrom = addDays(prevTo, -(width - 1));
    const previousFiltered = filterByDateRange(recipeFiltered, prevFrom, prevTo);
    const previousHasData = previousFiltered.some((e) => !isPlanned(e));
    const previousSummary = aggregatePeriod(previousFiltered, prevFrom, prevTo);
    const comparison = comparePeriods(currentSummary, previousSummary);

    // --- KPIs (§14.4) ---
    const producedLabel = currentSummary.totalProduced === 1 ? 'pão' : 'pães';
    const soldLabel = currentSummary.totalSold === 1 ? 'pão' : 'pães';
    producedTile.value.textContent = `${currentSummary.totalProduced} ${producedLabel}`;
    soldTile.value.textContent = `${currentSummary.totalSold} ${soldLabel}`;
    costTile.value.textContent = formatCurrency(currentSummary.totalCost);
    setKpiValue(
      revenueTile.value,
      formatCurrency(currentSummary.totalRevenue),
      previousHasData ? comparison.revenueVariation : null,
      (v) => `${formatPercent(v)}%`,
    );
    setKpiValue(
      profitTile.value,
      formatCurrency(currentSummary.totalProfit),
      previousHasData ? comparison.profitVariation : null,
      (v) => `${formatPercent(v)}%`,
    );
    marginTile.value.textContent = `${formatPercent(currentSummary.averageProfitMargin)}%`;
    setKpiValue(
      wastageTile.value,
      `${formatPercent(currentSummary.wastageRate)}%`,
      previousHasData ? pointsDelta(currentSummary.wastageRate, previousSummary.wastageRate) : null,
      (v) => `${formatPercent(v)}pp`,
    );
    comparisonNote.textContent = previousHasData
      ? `vs. período anterior (${formatDate(prevFrom)} – ${formatDate(prevTo)})`
      : '';

    // --- Melhor/pior (§14.5) ---
    // `.hidden` (design-system.css, issue 022) — era `el.style.display = 'none'`.
    bestWorstSection.classList.toggle('hidden', groups.length === 0);
    if (groups.length > 0) {
      const best = bestPeriod(groups) as BakeHistorySummary;
      const worst = worstPeriod(groups) as BakeHistorySummary;
      bestLabel.textContent = `✓ Melhor ${granularityLabel(granularity)} — ${formatDate(best.periodStart).slice(5)}`;
      bestValue.textContent = `Lucro ${formatCurrency(best.totalProfit)}`;
      worstLabel.textContent = `✕ Pior ${granularityLabel(granularity)} — ${formatDate(worst.periodStart).slice(5)}`;
      worstValue.textContent = `Lucro ${formatCurrency(worst.totalProfit)}`;
    }

    // --- Gráfico (§14.5): 0/1/N sem crash — delega a trendChart.ts ---
    clear(chartHost);
    chartHost.appendChild(renderTrendChart(groups));

    // --- Tabela (§14.5/§14.6/§14.7): TODAS as fornadas do filtro de receita,
    //     recentes primeiro (inclusive planejadas fora do intervalo/órfãs). ---
    clear(tbody);
    const sorted = [...recipeFiltered].sort((a, b) => {
      const ka = formatDate(a.date);
      const kb = formatDate(b.date);
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
    for (const entry of sorted) tbody.appendChild(buildRow(entry, recipeIds));

    // §8 (issue 019): fatia para o XLSX — fornadas do período (derivadas §14.3,
    // incl. planejadas com marca) + resumo já agregado (planejadas fora).
    lastExport = { entries: periodFiltered.map(computeBakeDerived), summary: currentSummary };
  }

  renderAll();
}
