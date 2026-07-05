/**
 * print.ts — Views de impressão "Salvar em PDF" (issue 019 base, refactor
 * issue 028, refactor v2 issue 034, spec §8/§9/§14.5).
 *
 * O que faz: monta, dentro de `#print-root`, relatórios imprimíveis que
 * REUSAM o layout de cards/tabelas da tela, com uma paleta dedicada de
 * impressão (tokens `--print-*`, `@media print` de design-system.css). 4 PDFs
 * por contexto —
 *  - `renderRecipePrintView` — Receita v2 (cards por seção, fermento
 *    reconstruído Isca→farinha(s)→Água→Total, coluna Proporção, badge "Rende N
 *    pães", ZERO $ — mockups/pdf-receita-v2.html, issue 034).
 *  - `renderRecipeCostsPrintView` — Custos v2 (base = Receita v2 + coluna
 *    Custo à direita por seção, "Custo Total" no lugar de Hidratação,
 *    Precificação mantida depois — mockups/pdf-custos-v2.html, issue 034).
 *  - `renderHistoryPrintView` — Fornadas (produção/vendas, ZERO $) — INTOCADA.
 *  - `renderHistoryCostsPrintView` — Financeiro do período (custo/faturamento/
 *    lucro, prejuízo por fornada) — INTOCADA.
 * `mountPrintButton(actionsRoot, onPrint?, label?)` cria o botão que chama
 * `onPrint` (default `window.print()`) SÓ no clique (§8: nunca automático).
 *
 * Semântica de cor (§ "Direção visual" da issue 028, mantida na v2): preto
 * (`--print-text`) é o padrão de TUDO (títulos, th, labels, %/Proporção, peso,
 * data, margem); azul-escuro (`.pdf-credit`) só em CRÉDITO (dinheiro entrando:
 * preço/faturamento/lucro≥0); vermelho (`.pdf-debit`) só em DÉBITO (dinheiro
 * saindo: custo por ingrediente/seção, custo total, custo/unidade,
 * lucro<0/prejuízo). Regra de sinal do Lucro reusa `isLoss` de `core/pricing`
 * (sem duplicar predicado, §4/§5.C).
 *
 * Reuso / camadas (regra de ouro 2, §1.6): NÃO recalcula nada — consome
 * `state`+`summary` de `recalculate` (008), `entries` de `computeBakeDerived`
 * e `summary` de `aggregatePeriod` (013). Custo por linha do fermento reusa
 * `ingredientRecipeCost` (puro, `core/costs.ts`) — mesma fórmula do core, NÃO
 * duplicação (Isca sempre fica de fora, §2.B.2, custo fixo R$0,00). Subtotais
 * de peso/custo ("Total Farinhas", "Total de fermento", "Total da massa") são
 * soma PRESENTACIONAL de valores já derivados (precedente sancionado em
 * ingredientsTable.ts §2.A.2 — não é recálculo de negócio); propagam null se
 * algum termo for impossível (§5.C, null≠0). Formatação pt-BR via
 * `core/format.ts` (§9: % 2 casas, peso 1, R$ 2, Proporção livre sem zero à
 * direita — arredondamento só na exibição). Escape STRING→DOM 100% via
 * `dom.ts h()`/`textContent` (regra de ouro 3). Datas em `aaaa-mm-dd` via
 * `formatDate` (§7.1) — mesma convenção da tela (historyView subtitle).
 *
 * `window.print()` disparado só em handler de clique — nunca em init (§8).
 * Zero rede, zero secret, sem eval (§11.1). Docs oficiais (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/print
 *
 * Seções implementadas: §8 (impressão/PDF), §9 (formatação de exibição),
 * §2.B (fermento/isca), §3.E (precificação), §14.5 (impressão do Histórico).
 */
import type { Recipe, RecipeSummary, BakeEntry, BakeHistorySummary, Sourdough } from '../core/types';
import { formatWeight, formatPercent, formatCurrency, formatProportion, formatDate } from '../core/format';
import { ingredientRecipeCost } from '../core/costs';
import { isLoss } from '../core/pricing';
import { h } from '../ui/dom';

export interface RecipePrintViewOptions {
  recipe: Recipe;
  summary: RecipeSummary;
}

export interface HistoryPrintViewOptions {
  /** Fornadas já derivadas (`computeBakeDerived`) do filtro/período exibido na tela. */
  entries: BakeEntry[];
  /** Resumo do período já agregado (`aggregatePeriod`) — planejadas fora (§14.4). */
  summary: BakeHistorySummary;
}

// "—" quando o derivado é impossível (§5.C, contrato null≠0).
const DASH = '—';
const pct = (n: number | null): string => (n === null ? DASH : `${formatPercent(n)}%`);
const money = (n: number | null | undefined): string =>
  n === null || n === undefined ? DASH : formatCurrency(n);

// Seções do mockup aprovado `mockups/pdf-refactor.html` (§8): só Farinhas,
// Líquidos e "Sal e Extras" — não há "Gorduras" isolada (Azeite/gorduras entram
// junto de Sal/extras na mesma tabela, ver mockup ~137-144).
const CATEGORY_SECTIONS: { key: string; title: string }[] = [
  { key: 'flour', title: 'Farinhas' },
  { key: 'liquid', title: 'Líquidos' },
  { key: 'salt', title: 'Sal e Extras' },
];

// 'extra' e 'fat' compartilham o bucket "Sal e Extras" (§8, mockup pdf-refactor:
// gorduras não têm seção própria — caem na tabela de Sal/extras).
const bucketOf = (cat: Recipe['ingredients'][number]['category']): string =>
  cat === 'extra' || cat === 'fat' ? 'salt' : cat;

/** `<td>` com texto escapado (regra de ouro 3), classes de alinhamento/cor opcionais. */
function td(text: string, opts: { num?: boolean; cls?: string } = {}): HTMLElement {
  const classes = [opts.num ? 'num' : '', opts.cls ?? ''].filter(Boolean).join(' ');
  return h('td', classes ? { className: classes } : {}, [text]);
}

/**
 * Célula monetária com cor por SINAL (regra do trio de Precificação/coluna
 * Lucro, issue 028): crédito (azul) quando ≥0, débito (vermelho) quando <0;
 * `null`/impossível → "—" NEUTRO (sem cor, §5.C). `num` alinha à direita.
 */
function signedMoneyTd(n: number | null | undefined, num = true): HTMLElement {
  if (n === null || n === undefined) return td(DASH, { num });
  return td(formatCurrency(n), { num, cls: n < 0 ? 'pdf-debit' : 'pdf-credit' });
}

/** `.kv` (chave→valor): `rows` = [label, célula-valor]. Escape via `h`/`td`. */
function kvTable(rows: [string, HTMLElement][]): HTMLElement {
  const table = h('table', { className: 'kv' });
  for (const [label, valueCell] of rows) {
    table.appendChild(h('tr', {}, [td(label), valueCell]));
  }
  return table;
}

/** `.card` "página" do PDF: h1 + `.pdf-meta` + corpo (seções). */
function pageCard(title: string, meta: string, body: HTMLElement[]): HTMLElement {
  const card = h('section', { className: 'card' });
  card.appendChild(h('h1', {}, [title]));
  card.appendChild(h('div', { className: 'pdf-meta' }, [meta]));
  for (const el of body) card.appendChild(el);
  return card;
}

/** `<h2 class="pdf-section">` (título em maiúsculas via CSS `text-transform`) — só Histórico (v2 usa `secCard`). */
function section(title: string): HTMLElement {
  return h('h2', { className: 'pdf-section' }, [title]);
}

const generatedMeta = (): string => `Gerado em ${formatDate(new Date())} · Calculadora de Pão`;

// ===== Helpers v2 (issue 034 — cards por seção, `table.rt` alinhada) =====

/**
 * `.sec-card` (mockups pdf-receita-v2/pdf-custos-v2, req 1): faixa de título
 * (`.sec-head`) + corpo (`.sec-body`). `content` aceita 1 ou mais elementos
 * (ex.: Precificação = `.kv` + alerta opcional).
 */
function secCard(title: string, content: HTMLElement | HTMLElement[]): HTMLElement {
  const bodyEl = h('div', { className: 'sec-body' });
  for (const el of Array.isArray(content) ? content : [content]) bodyEl.appendChild(el);
  return h('div', { className: 'sec-card' }, [h('div', { className: 'sec-head' }, [title]), bodyEl]);
}

/**
 * "Página" do PDF v2: `.pdf-head` (h1 + `.pdf-meta` + badge `.pdf-yield` "Rende
 * N pães", req 5) seguido das seções e do rodapé — substitui `pageCard` (que
 * segue servindo o Histórico, inalterado).
 */
function recipePageV2(title: string, meta: string, yieldQty: number, sections: HTMLElement[]): HTMLElement {
  const card = h('section', { className: 'card' });
  const headText = h('div', {}, [h('h1', {}, [title]), h('div', { className: 'pdf-meta' }, [meta])]);
  const yieldBadge = h('div', { className: 'pdf-yield' }, ['Rende ', h('strong', {}, [String(yieldQty)]), ' pães']);
  card.appendChild(h('div', { className: 'pdf-head' }, [headText, yieldBadge]));
  for (const el of sections) card.appendChild(el);
  card.appendChild(h('div', { className: 'pdf-footer' }, ['Página 1/1']));
  return card;
}

/** Uma linha de `table.rt`: nome (colspan=2) + célula %/Proporção + célula Peso [+ célula Custo]. */
interface RtRow {
  name: string;
  pct: string;
  weight: string;
  /** Só quando `withCost`; texto já formatado (`money`/DASH). */
  cost?: string;
  /** Classe da célula Custo (`pdf-debit`/`undefined` = neutro, §5.C). */
  costCls?: string;
}

/**
 * `table.rt` (mockups v2, req 3/4): `table-layout: fixed` + colgroup idêntico
 * (`c-name` span=2, `c-pct`, `c-wt`[, `c-cost`]) em TODA seção — garante as
 * colunas %/Proporção e Peso (e Custo, nos Custos) alinhadas verticalmente
 * entre Farinhas/Líquidos/Sal e Extras/Fermento (req 4). `pctLabel` é "%" nas
 * seções comuns e "Proporção" só no Fermento (req 3, mesmo slot — nunca as
 * duas colunas juntas).
 */
function rtTable(opts: {
  nameLabel: string;
  pctLabel: string;
  rows: RtRow[];
  foot?: RtRow;
  withCost: boolean;
}): HTMLElement {
  const { nameLabel, pctLabel, rows, foot, withCost } = opts;
  const table = h('table', { className: 'rt' });

  const cols = [h('col', { className: 'c-name', span: 2 }), h('col', { className: 'c-pct' }), h('col', { className: 'c-wt' })];
  if (withCost) cols.push(h('col', { className: 'c-cost' }));
  table.appendChild(h('colgroup', {}, cols));

  const headCells = [h('th', { colspan: 2 }, [nameLabel]), h('th', { className: 'num' }, [pctLabel]), h('th', { className: 'num' }, ['Peso (g)'])];
  if (withCost) headCells.push(h('th', { className: 'num' }, ['Custo']));
  table.appendChild(h('thead', {}, [h('tr', {}, headCells)]));

  const rowCells = (r: RtRow): HTMLElement[] => {
    const cells = [h('td', { colspan: 2 }, [r.name]), td(r.pct, { num: true }), td(r.weight, { num: true })];
    if (withCost) cells.push(td(r.cost ?? DASH, { num: true, cls: r.costCls }));
    return cells;
  };

  table.appendChild(h('tbody', {}, rows.map((r) => h('tr', {}, rowCells(r)))));
  if (foot) table.appendChild(h('tfoot', {}, [h('tr', {}, rowCells(foot))]));
  return table;
}

/**
 * Fermento Natural reconstruído (req 2): Isca → farinha(s) → Água → Total
 * (tfoot, negrito). Suporta múltiplas `sourdough.flours[]` (refactor-farinhas).
 * `withCost=false` (Receita): sem coluna Custo. `withCost=true` (Custos):
 * Isca sempre `R$ 0,00` (§2.B.2); custo de cada farinha/água via
 * `ingredientRecipeCost` (puro, `core/costs.ts` — reuso, não recálculo);
 * `null` (Peso do Produto ≤0) → célula "—" neutra (§5.C). Total do fermento =
 * `sd.totalCost` (já derivado por `recalculate` — soma exata do core, não
 * recomputada aqui).
 */
function sourdoughTable(sd: Sourdough, withCost: boolean): HTMLElement {
  const iscaWeight = sd.iscaWeight ?? 0;
  const waterWeight = sd.waterWeight ?? 0;
  const flours = sd.flours;

  const rows: RtRow[] = [];
  rows.push({
    name: 'Isca',
    pct: formatProportion(sd.parts.isca),
    weight: formatWeight(iscaWeight),
    cost: withCost ? money(0) : undefined, // §2.B.2: Isca nunca tem custo
    costCls: withCost ? 'pdf-debit' : undefined,
  });
  for (const f of flours) {
    const w = f.weight ?? 0;
    const flourCost = withCost ? ingredientRecipeCost(w, f.packageCost) : null;
    rows.push({
      name: f.name,
      pct: formatProportion(f.proportion),
      weight: formatWeight(w),
      cost: withCost ? money(flourCost) : undefined,
      costCls: withCost && flourCost !== null ? 'pdf-debit' : undefined,
    });
  }
  const waterCost = withCost ? ingredientRecipeCost(waterWeight, sd.waterPackageCost) : null;
  rows.push({
    name: 'Água',
    pct: formatProportion(sd.parts.water),
    weight: formatWeight(waterWeight),
    cost: withCost ? money(waterCost) : undefined,
    costCls: withCost && waterCost !== null ? 'pdf-debit' : undefined,
  });

  const totalProportion = sd.parts.isca + flours.reduce((a, f) => a + f.proportion, 0) + sd.parts.water;
  const foot: RtRow = {
    name: 'Total de fermento',
    pct: formatProportion(totalProportion),
    weight: formatWeight(sd.totalWeight ?? 0),
    cost: withCost ? money(sd.totalCost) : undefined,
    costCls: withCost && sd.totalCost !== undefined ? 'pdf-debit' : undefined,
  };

  return rtTable({ nameLabel: 'Componente', pctLabel: 'Proporção', rows, foot, withCost });
}

/**
 * PDF Receita v2 (issue 034, mockups/pdf-receita-v2.html): cards por seção
 * (Farinhas/Líquidos/Sal e Extras/Fermento Natural/Hidratação), fermento
 * reconstruído com coluna Proporção, badge "Rende N pães". ZERO $.
 */
export function renderRecipePrintView(root: HTMLElement, opts: RecipePrintViewOptions): void {
  const { recipe, summary } = opts;
  const sections: HTMLElement[] = [];

  // Ingredientes por categoria — table.rt %/peso (Farinhas ganha tfoot "Total").
  for (const sec of CATEGORY_SECTIONS) {
    const rows = recipe.ingredients.filter((i) => bucketOf(i.category) === sec.key);
    if (rows.length === 0) continue;

    const rtRows: RtRow[] = rows.map((ing) => ({
      name: ing.name,
      pct: formatPercent(ing.percentage),
      weight: formatWeight(ing.weight),
    }));

    let foot: RtRow | undefined;
    if (sec.key === 'flour') {
      const sumPct = rows.reduce((a, i) => a + i.percentage, 0);
      const sumWeight = rows.reduce((a, i) => a + i.weight, 0);
      foot = { name: 'Total Farinhas', pct: formatPercent(sumPct), weight: formatWeight(sumWeight) };
    }

    sections.push(
      secCard(sec.title, rtTable({ nameLabel: 'Ingrediente', pctLabel: '%', rows: rtRows, foot, withCost: false })),
    );
  }

  // Fermento Natural reconstruído (req 2/3).
  sections.push(secCard('Fermento Natural', sourdoughTable(recipe.sourdough, false)));

  // Hidratação (§2.C/§2.D) + Total da massa (Σpesos + fermento — §2.A.2).
  const doughWeight = recipe.ingredients.reduce((a, i) => a + i.weight, 0) + (recipe.sourdough.totalWeight ?? 0);
  sections.push(
    secCard(
      'Hidratação',
      kvTable([
        ['Nominal', td(pct(summary.hydration.nominal))],
        ['Real', td(pct(summary.hydration.real))],
        ['Farinha Real Consumida', td(`${formatWeight(summary.realFlourConsumed)} g`)],
        ['Total da massa', td(`${formatWeight(doughWeight)} g`)],
      ]),
    ),
  );

  root.appendChild(recipePageV2(recipe.name, generatedMeta(), recipe.pricing.quantity, sections));
}

/**
 * PDF Custos v2 (issue 034, mockups/pdf-custos-v2.html): base idêntica à
 * Receita v2 + coluna Custo à direita por seção (débito), "Custo Total"
 * (fornada + um pão) no lugar da Hidratação, Precificação mantida depois
 * (Lucro por pão + Lucro da fornada, alerta de prejuízo via `isLoss`).
 */
export function renderRecipeCostsPrintView(root: HTMLElement, opts: RecipePrintViewOptions): void {
  const { recipe, summary } = opts;
  const sections: HTMLElement[] = [];

  for (const sec of CATEGORY_SECTIONS) {
    const rows = recipe.ingredients.filter((i) => bucketOf(i.category) === sec.key);
    if (rows.length === 0) continue;

    const rtRows: RtRow[] = rows.map((ing) => ({
      name: ing.name,
      pct: formatPercent(ing.percentage),
      weight: formatWeight(ing.weight),
      cost: money(ing.recipeCost),
      costCls: ing.recipeCost !== undefined && ing.recipeCost !== null ? 'pdf-debit' : undefined,
    }));

    let foot: RtRow | undefined;
    if (sec.key === 'flour') {
      const sumPct = rows.reduce((a, i) => a + i.percentage, 0);
      const sumWeight = rows.reduce((a, i) => a + i.weight, 0);
      // Soma presentacional (§2.A.2) com propagação de null (§5.C, null≠0):
      // qualquer custo impossível torna o subtotal impossível, nunca 0 forjado.
      const costs = rows.map((i) => i.recipeCost);
      const sumCost = costs.some((c) => c === undefined || c === null)
        ? null
        : costs.reduce((a: number, c) => a + (c as number), 0);
      foot = {
        name: 'Total Farinhas',
        pct: formatPercent(sumPct),
        weight: formatWeight(sumWeight),
        cost: money(sumCost),
        costCls: sumCost !== null ? 'pdf-debit' : undefined,
      };
    }

    sections.push(
      secCard(sec.title, rtTable({ nameLabel: 'Ingrediente', pctLabel: '%', rows: rtRows, foot, withCost: true })),
    );
  }

  // Fermento Natural — Isca custo sempre R$ 0,00 (§2.B.2).
  sections.push(secCard('Fermento Natural', sourdoughTable(recipe.sourdough, true)));

  // Custo Total (req 7) — no lugar da Hidratação: fornada (N pães) + um pão.
  sections.push(
    secCard(
      'Custo Total',
      kvTable([
        [
          `Custo da fornada (${recipe.pricing.quantity} pães)`,
          summary.totalCost === null ? td(DASH) : td(money(summary.totalCost), { cls: 'pdf-debit' }),
        ],
        [
          'Custo de um pão',
          summary.costPerUnit === null ? td(DASH) : td(money(summary.costPerUnit), { cls: 'pdf-debit' }),
        ],
      ]),
    ),
  );

  // Precificação (req 8, mantida após Custo Total): preço crédito, margem
  // neutra, Lucro por pão + Lucro da fornada por sinal (`signedMoneyTd`).
  const precificacaoBody: HTMLElement[] = [
    kvTable([
      ['Preço de venda (un.)', summary.salePrice === null ? td(DASH) : td(money(summary.salePrice), { cls: 'pdf-credit' })],
      ['Margem de lucro', td(pct(summary.profitMargin))], // % não é fluxo de caixa → neutro
      ['Lucro por pão', signedMoneyTd(summary.profitPerUnit)],
      ['Lucro da fornada', signedMoneyTd(summary.totalProfit)],
    ]),
  ];

  // Alerta de prejuízo: reusa `isLoss` (§4/§5.C) — só quando ambos os
  // operandos existem (custo/un e preço); null≠0 não dispara alerta forjado.
  if (summary.costPerUnit !== null && summary.salePrice !== null && isLoss(summary.costPerUnit, summary.salePrice)) {
    precificacaoBody.push(h('div', { className: 'pdf-alert' }, ['⚠ PREJUÍZO — preço não cobre o custo']));
  }
  sections.push(secCard('Precificação', precificacaoBody));

  root.appendChild(recipePageV2(recipe.name, generatedMeta(), recipe.pricing.quantity, sections));
}

const periodMeta = (summary: BakeHistorySummary): string =>
  `Período: ${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)} · ${generatedMeta()}`;

/**
 * PDF Histórico · Fornadas (issue 028, §14.5): resumo de produção + listagem
 * Data/Receita/Produzidas/Vendidas. ZERO valor monetário; planejadas em
 * `tr.pdf-muted-row` com Vendidas "—" (§14.6).
 */
export function renderHistoryPrintView(root: HTMLElement, opts: HistoryPrintViewOptions): void {
  const { entries, summary } = opts;
  const body: HTMLElement[] = [];

  // Resumo do período (§14.4) — planejadas já ficam fora do `summary`.
  body.push(section('Resumo do período'));
  body.push(
    kvTable([
      ['Produzido', td(`${summary.totalProduced} un.`)],
      ['Vendido', td(`${summary.totalSold} un.`)],
      ['Desperdício', td(pct(summary.wastageRate))],
    ]),
  );

  // Listagem cronológica (§14.5) — inclusive planejadas, marcadas (§14.6).
  body.push(section('Fornadas'));
  const table = h('table', { className: 'table' });
  table.appendChild(
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['Data']),
        h('th', {}, ['Receita']),
        h('th', { className: 'num' }, ['Produzidas']),
        h('th', { className: 'num' }, ['Vendidas']),
      ]),
    ]),
  );
  const tbody = h('tbody');
  for (const entry of entries) {
    const planned = entry.planned === true;
    const nameCell = td(planned ? `${entry.recipeName} — Planejada` : entry.recipeName);
    const tr = h('tr', planned ? { className: 'pdf-muted-row' } : {}, [
      td(formatDate(entry.date)),
      nameCell,
      td(String(entry.quantityProduced), { num: true }),
      td(planned ? DASH : String(entry.quantitySold), { num: true }),
    ]);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  body.push(table);
  body.push(h('div', { className: 'pdf-footer' }, ['Calculadora de Pão']));

  root.appendChild(pageCard('Histórico de Fornadas', periodMeta(summary), body));
}

/**
 * PDF Histórico · Financeiro (issue 028, §14.5): resumo financeiro (custo
 * débito, faturamento/lucro crédito por sinal, margem neutra) + listagem
 * Data/Receita/Custo(débito)/Lucro(por sinal). Só fornadas confirmadas
 * (planejadas ficam fora dos números — §14.4/§14.6).
 */
export function renderHistoryCostsPrintView(root: HTMLElement, opts: HistoryPrintViewOptions): void {
  const { entries, summary } = opts;
  const body: HTMLElement[] = [];

  // Resumo financeiro (§14.4).
  body.push(section('Resumo financeiro'));
  body.push(
    kvTable([
      ['Custo total', td(money(summary.totalCost), { cls: 'pdf-debit' })],
      ['Faturamento', td(money(summary.totalRevenue), { cls: 'pdf-credit' })],
      ['Lucro', signedMoneyTd(summary.totalProfit, false)],
      ['Margem média', td(pct(summary.averageProfitMargin))], // métrica — neutra
    ]),
  );

  // Listagem financeira (§14.5) — só confirmadas (planejadas fora dos números).
  body.push(section('Fornadas'));
  const table = h('table', { className: 'table' });
  table.appendChild(
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['Data']),
        h('th', {}, ['Receita']),
        h('th', { className: 'num' }, ['Custo']),
        h('th', { className: 'num' }, ['Lucro']),
      ]),
    ]),
  );
  const tbody = h('tbody');
  for (const entry of entries) {
    if (entry.planned === true) continue; // §14.4: planejada não tem financeiro real
    tbody.appendChild(
      h('tr', {}, [
        td(formatDate(entry.date)),
        td(entry.recipeName),
        td(money(entry.totalCost), { num: true, cls: 'pdf-debit' }),
        signedMoneyTd(entry.totalProfit),
      ]),
    );
  }
  table.appendChild(tbody);
  // tfoot Total: custo débito, lucro por sinal.
  table.appendChild(
    h('tfoot', {}, [
      h('tr', {}, [
        td('Total'),
        td('', {}),
        td(money(summary.totalCost), { num: true, cls: 'pdf-debit' }),
        signedMoneyTd(summary.totalProfit),
      ]),
    ]),
  );
  body.push(table);
  body.push(h('div', { className: 'pdf-footer' }, ['Calculadora de Pão']));

  root.appendChild(pageCard('Financeiro — Histórico de Fornadas', periodMeta(summary), body));
}

/**
 * Cria um botão de impressão e o anexa a `actionsRoot`. O clique — e SÓ o
 * clique (§8: nunca automático/no init) — dispara `onPrint` (default
 * `window.print()`). `label` (default "Imprimir / Salvar em PDF", compat com o
 * wiring anterior) permite os 2 botões por contexto (Receita/Custos,
 * Fornadas/Financeiro). Devolve o botão para o chamador (gate `.hidden`).
 */
export function mountPrintButton(
  actionsRoot: HTMLElement,
  onPrint: () => void = () => window.print(),
  label = 'Imprimir / Salvar em PDF',
): HTMLButtonElement {
  const btn = h('button', { type: 'button', className: 'btn btn-secondary' }, [label]) as HTMLButtonElement;
  btn.addEventListener('click', () => onPrint()); // §8: só no clique
  actionsRoot.appendChild(btn);
  return btn;
}
