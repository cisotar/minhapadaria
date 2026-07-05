/**
 * print.ts — Views de impressão "Salvar em PDF" (issue 019 base, refactor
 * issue 028, spec §8/§9/§14.5).
 *
 * O que faz: monta, dentro de `#print-root`, relatórios imprimíveis que
 * REUSAM o layout de cards/tabelas da tela (`.card` + `.table`/`.kv`), com uma
 * paleta dedicada de impressão (tokens `--print-*`, `@media print` de
 * design-system.css). Refactor 028: **2 PDFs por contexto** em vez de 1 PDF com
 * seção de custo condicional —
 *  - `renderRecipePrintView` — Receita (ingredientes/proporções/totais, ZERO $).
 *  - `renderRecipeCostsPrintView` — Custos (custo/g, custo por ingrediente,
 *    precificação, prejuízo) — semântica contábil: débito vermelho, crédito azul.
 *  - `renderHistoryPrintView` — Fornadas (produção/vendas, ZERO $).
 *  - `renderHistoryCostsPrintView` — Financeiro do período (custo/faturamento/
 *    lucro, prejuízo por fornada).
 * `mountPrintButton(actionsRoot, onPrint?, label?)` cria o botão que chama
 * `onPrint` (default `window.print()`) SÓ no clique (§8: nunca automático).
 *
 * Semântica de cor (§ "Direção visual" da issue 028): preto (`--print-text`) é
 * o padrão de TUDO (títulos, th, labels, %, peso, data, margem); azul-escuro
 * (`.pdf-credit`) só em CRÉDITO (dinheiro entrando: preço/faturamento/lucro≥0);
 * vermelho (`.pdf-debit`) só em DÉBITO (dinheiro saindo: custo/g, custo por
 * ingrediente, custo total, custo/unidade, lucro<0/prejuízo). Regra de sinal do
 * Lucro reusa `isLoss` de `core/pricing` (sem duplicar predicado, §4/§5.C).
 *
 * Reuso / camadas (regra de ouro 2, §1.6): NÃO recalcula nada — consome
 * `state`+`summary` de `recalculate` (008), `entries` de `computeBakeDerived`
 * e `summary` de `aggregatePeriod` (013). Subtotais de peso ("Total Farinhas",
 * "Total da massa") são soma PRESENTACIONAL de pesos já derivados (precedente
 * sancionado em ingredientsTable.ts §2.A.2 — não é recálculo de negócio).
 * Formatação pt-BR via `core/format.ts` (§9: % 2 casas, peso 1, R$ 2, custo/g
 * 4 — arredondamento só na exibição). Escape STRING→DOM 100% via `dom.ts h()`/
 * `textContent` (regra de ouro 3). Datas em `aaaa-mm-dd` via `formatDate`
 * (§7.1) — mesma convenção da tela (historyView subtitle).
 *
 * `window.print()` disparado só em handler de clique — nunca em init (§8).
 * Zero rede, zero secret, sem eval (§11.1). Docs oficiais (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/print
 *
 * Seções implementadas: §8 (impressão/PDF), §9 (formatação de exibição),
 * §14.5 (impressão do Histórico).
 */
import type { Recipe, RecipeSummary, BakeEntry, BakeHistorySummary } from '../core/types';
import { formatWeight, formatPercent, formatCurrency, formatCostPerGram, formatDate } from '../core/format';
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
const costPerGram = (n: number | null | undefined): string =>
  n === null || n === undefined ? DASH : formatCostPerGram(n);
const weight = (n: number | null | undefined): string =>
  n === null || n === undefined ? DASH : `${formatWeight(n)} g`;

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

/** `<h2 class="pdf-section">` (título em maiúsculas via CSS `text-transform`). */
function section(title: string): HTMLElement {
  return h('h2', { className: 'pdf-section' }, [title]);
}

const generatedMeta = (): string => `Gerado em ${formatDate(new Date())} · Calculadora de Pão`;

/**
 * PDF Receita (issue 028, §8): ingredientes por categoria (%/peso), fermento,
 * hidratação e total da massa. ZERO coluna/valor financeiro.
 */
export function renderRecipePrintView(root: HTMLElement, opts: RecipePrintViewOptions): void {
  const { recipe, summary } = opts;
  const body: HTMLElement[] = [];

  // Ingredientes por categoria — tabela %/peso (Farinhas ganha tfoot "Total").
  for (const sec of CATEGORY_SECTIONS) {
    const rows = recipe.ingredients.filter((i) => bucketOf(i.category) === sec.key);
    if (rows.length === 0) continue;
    body.push(section(sec.title));

    const table = h('table', { className: 'table' });
    table.appendChild(
      h('thead', {}, [
        h('tr', {}, [
          h('th', {}, ['Ingrediente']),
          h('th', { className: 'num' }, ['%']),
          h('th', { className: 'num' }, ['Peso (g)']),
        ]),
      ]),
    );
    const tbody = h('tbody');
    for (const ing of rows) {
      tbody.appendChild(
        h('tr', {}, [td(ing.name), td(formatPercent(ing.percentage), { num: true }), td(formatWeight(ing.weight), { num: true })]),
      );
    }
    table.appendChild(tbody);

    // Farinhas: tfoot "Total Farinhas" — soma presentacional de %/peso (§2.A.2).
    if (sec.key === 'flour') {
      const sumPct = rows.reduce((a, i) => a + i.percentage, 0);
      const sumWeight = rows.reduce((a, i) => a + i.weight, 0);
      table.appendChild(
        h('tfoot', {}, [
          h('tr', {}, [td('Total Farinhas'), td(formatPercent(sumPct), { num: true }), td(formatWeight(sumWeight), { num: true })]),
        ]),
      );
    }
    body.push(table);
  }

  // Fermento Natural (§2.B).
  const sd = recipe.sourdough;
  body.push(section('Fermento Natural'));
  body.push(
    kvTable([
      ['Peso total', td(weight(sd.totalWeight))],
      ['Farinha do fermento', td(weight(sd.flourWeight))],
      ['Água do fermento', td(weight(sd.waterWeight))],
    ]),
  );

  // Hidratação (§2.C/§2.D) + Total da massa (Σpesos + fermento — §2.A.2).
  const doughWeight =
    recipe.ingredients.reduce((a, i) => a + i.weight, 0) + (sd.totalWeight ?? 0);
  body.push(section('Hidratação'));
  body.push(
    kvTable([
      ['Nominal', td(pct(summary.hydration.nominal))],
      ['Real', td(pct(summary.hydration.real))],
      ['Farinha Real Consumida', td(`${formatWeight(summary.realFlourConsumed)} g`)],
      ['Total da massa', td(`${formatWeight(doughWeight)} g`)],
    ]),
  );

  root.appendChild(pageCard(recipe.name, generatedMeta(), body));
}

/**
 * PDF Custos (issue 028, §3.E/§9): custo por ingrediente (tudo débito), custo
 * total (tfoot débito) e precificação (custo/un débito, preço crédito, margem
 * neutra, lucro por sinal) + alerta de prejuízo (`isLoss`, §4/§5.C).
 */
export function renderRecipeCostsPrintView(root: HTMLElement, opts: RecipePrintViewOptions): void {
  const { recipe, summary } = opts;
  const body: HTMLElement[] = [];

  // Custo por ingrediente — custo/g e custo total, ambos DÉBITO (dinheiro sai).
  body.push(section('Custo por ingrediente'));
  const table = h('table', { className: 'table' });
  table.appendChild(
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['Ingrediente']),
        h('th', { className: 'num' }, ['Custo/g']),
        h('th', { className: 'num' }, ['Custo total']),
      ]),
    ]),
  );
  const tbody = h('tbody');
  // débito só quando há valor (null≠0 → "—" neutro, §5.C).
  const debitCell = (text: string, hasValue: boolean): HTMLElement =>
    td(text, { num: true, cls: hasValue ? 'pdf-debit' : undefined });
  for (const ing of recipe.ingredients) {
    tbody.appendChild(
      h('tr', {}, [
        td(ing.name),
        debitCell(costPerGram(ing.costPerGram), ing.costPerGram !== undefined && ing.costPerGram !== null),
        debitCell(money(ing.recipeCost), ing.recipeCost !== undefined && ing.recipeCost !== null),
      ]),
    );
  }
  // Fermento Natural (§2.B): custo/g e custo total agregados da sub-receita.
  const sd = recipe.sourdough;
  tbody.appendChild(
    h('tr', {}, [
      td('Fermento Natural'),
      debitCell(costPerGram(sd.costPerGram), sd.costPerGram !== undefined && sd.costPerGram !== null),
      debitCell(money(sd.totalCost), sd.totalCost !== undefined && sd.totalCost !== null),
    ]),
  );
  table.appendChild(tbody);
  // tfoot: CUSTO TOTAL = summary.totalCost (débito).
  table.appendChild(
    h('tfoot', {}, [
      h('tr', {}, [
        td('Custo total'),
        td('', { num: true }),
        debitCell(money(summary.totalCost), summary.totalCost !== null),
      ]),
    ]),
  );
  body.push(table);

  // Precificação (§3.E): custo/un débito, preço crédito, margem neutra, lucro por sinal.
  body.push(section('Precificação'));
  body.push(
    kvTable([
      ['Custo por unidade', summary.costPerUnit === null ? td(DASH) : td(money(summary.costPerUnit), { cls: 'pdf-debit' })],
      ['Preço de venda', summary.salePrice === null ? td(DASH) : td(money(summary.salePrice), { cls: 'pdf-credit' })],
      ['Margem de lucro', td(pct(summary.profitMargin))], // % não é fluxo de caixa → neutro
      ['Lucro total', signedMoneyTd(summary.totalProfit, false)], // crédito ≥0 / débito <0
    ]),
  );

  // Alerta de prejuízo (variante 2b): reusa `isLoss` (§4/§5.C) — só quando ambos
  // os operandos existem (custo/un e preço); null≠0 não dispara alerta forjado.
  if (
    summary.costPerUnit !== null &&
    summary.salePrice !== null &&
    isLoss(summary.costPerUnit, summary.salePrice)
  ) {
    body.push(h('div', { className: 'pdf-alert' }, ['⚠ PREJUÍZO — preço não cobre o custo']));
  }

  root.appendChild(pageCard(`Custos — ${recipe.name}`, generatedMeta(), body));
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
