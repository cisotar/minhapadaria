/**
 * print.ts — View de impressão "Salvar em PDF" (issue 019, spec §8/§9).
 *
 * O que faz: `renderPrintView(root, {recipe, summary, includeCosts})` monta,
 * dentro de `root`, um resumo imprimível da receita (nome, ingredientes por
 * categoria, fermento, hidratação e — só com custos — precificação), usando
 * EXCLUSIVAMENTE `dom.ts h()` (nunca `innerHTML`, regra de ouro 3: nome de
 * ingrediente/receita do usuário vira nó de texto escapado por `textContent`).
 * `renderHistoryPrintView(root, {entries, summary, includeCosts})` (revisão da
 * issue 019, achado ALTO §8 "aplica-se também ao Histórico de Fornadas §14")
 * monta o mesmo tipo de relatório para a listagem filtrada do Histórico —
 * mesmo padrão DOM/escape/`#print-root`, sem recalcular nada: `entries` já vem
 * de `computeBakeDerived` (core/bakes.ts) e `summary` de `aggregatePeriod`.
 * `mountPrintButton(actionsRoot, onPrint?)` cria o botão fixo "Imprimir /
 * Salvar em PDF" que chama `window.print()` SÓ no clique (§8: nunca automático).
 *
 * Reuso / camadas (regra de ouro 2, §1.6): NÃO recalcula nada — consome o
 * `state`+`summary` de `recalculate` e formata para pt-BR com `core/format.ts`
 * (§9: % 2 casas, peso 1, R$ 2 — arredondamento de exibição, dono único).
 * Escape de STRING→HTML: 100% via `dom.ts h()`/`textContent` (regra de ouro
 * 3) — não há builder de string standalone no app (revisão issue 027, achado
 * baixo #2: removido o `escapeHtml` morto, sem uso em produção).
 *
 * `window.print()` disparado só em handler de clique — nunca em init (§8).
 * Zero rede, zero secret, sem eval (§11.1). Docs oficiais (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/print
 *
 * Seções implementadas: §8 (impressão/PDF), §9 (formatação de exibição), §14
 * (impressão do Histórico, revisão issue 019).
 */
import type { Recipe, RecipeSummary, BakeEntry, BakeHistorySummary } from '../core/types';
import { formatWeight, formatPercent, formatCurrency, formatDate } from '../core/format';
import { h } from '../ui/dom';

export interface PrintViewOptions {
  recipe: Recipe;
  summary: RecipeSummary;
  includeCosts: boolean;
}

export interface HistoryPrintViewOptions {
  /** Fornadas já derivadas (`computeBakeDerived`) do filtro/período exibido na tela. */
  entries: BakeEntry[];
  /** Resumo do período já agregado (`aggregatePeriod`) — planejadas fora (§14.4). */
  summary: BakeHistorySummary;
  includeCosts: boolean;
}

// "—" quando o derivado é impossível (§5.C, contrato null≠0).
const DASH = '—';
const pct = (n: number | null): string => (n === null ? DASH : `${formatPercent(n)}%`);
const money = (n: number | null): string => (n === null ? DASH : formatCurrency(n));
// Peso derivado (ex.: fermento, revisão issue 027 achado médio #1): mesmo
// tratamento null≠0 de pct()/money() — `?? 0` mascarava derivado impossível
// como "0 g".
const weight = (n: number | null | undefined): string =>
  n === null || n === undefined ? DASH : `${formatWeight(n)} g`;

const CATEGORY_SECTIONS: { key: Recipe['ingredients'][number]['category']; title: string }[] = [
  { key: 'flour', title: 'Farinhas' },
  { key: 'liquid', title: 'Líquidos' },
  { key: 'fat', title: 'Gorduras' },
  { key: 'salt', title: 'Sal e Extras' },
];

/** Linha rótulo → valor (`.print-line`), texto sempre via `h` (escape §3). */
function line(label: string, value: string): HTMLElement {
  return h('div', { className: 'print-line' }, [
    h('span', { className: 'print-label' }, [label]),
    h('span', { className: 'print-value' }, [value]),
  ]);
}

/**
 * Monta o resumo imprimível da receita em `root`. Somente leitura — o estilo de
 * impressão vem do `@media print` do design system (tokens). Zero `innerHTML`.
 */
export function renderPrintView(root: HTMLElement, opts: PrintViewOptions): void {
  const { recipe, summary, includeCosts } = opts;
  const view = h('div', { className: 'print-view' });

  view.appendChild(h('h1', { className: 'print-title' }, [recipe.name]));

  // Ingredientes por categoria (§8). 'extra' cai em Sal e Extras.
  const bucketOf = (cat: Recipe['ingredients'][number]['category']): string =>
    cat === 'extra' ? 'salt' : cat;
  for (const section of CATEGORY_SECTIONS) {
    const rows = recipe.ingredients.filter((i) => bucketOf(i.category) === section.key);
    if (rows.length === 0) continue;
    view.appendChild(h('h2', { className: 'print-section' }, [section.title]));
    for (const ing of rows) {
      const detail = includeCosts
        ? `${formatWeight(ing.weight)} g · ${formatPercent(ing.percentage)}% · ${money(ing.recipeCost ?? null)}`
        : `${formatWeight(ing.weight)} g · ${formatPercent(ing.percentage)}%`;
      view.appendChild(line(ing.name, detail));
    }
  }

  // Fermento Natural (§2.B).
  const sd = recipe.sourdough;
  view.appendChild(h('h2', { className: 'print-section' }, ['Fermento Natural']));
  view.appendChild(line('Peso total', weight(sd.totalWeight)));
  view.appendChild(line('Farinha do fermento', weight(sd.flourWeight)));
  view.appendChild(line('Água do fermento', weight(sd.waterWeight)));

  // Hidratação (§2.C/§2.D).
  view.appendChild(h('h2', { className: 'print-section' }, ['Hidratação']));
  view.appendChild(line('Hidratação Nominal', pct(summary.hydration.nominal)));
  view.appendChild(line('Hidratação Real', pct(summary.hydration.real)));
  view.appendChild(line('Farinha Real Consumida', `${formatWeight(summary.realFlourConsumed)} g`));

  // Precificação (§3.E) — só com custos.
  if (includeCosts) {
    view.appendChild(h('h2', { className: 'print-section' }, ['Precificação']));
    view.appendChild(line('Custo total', money(summary.totalCost)));
    view.appendChild(line('Custo por unidade', money(summary.costPerUnit)));
    view.appendChild(line('Preço de venda', money(summary.salePrice)));
    view.appendChild(line('Margem de lucro', pct(summary.profitMargin)));
    view.appendChild(line('Lucro total', money(summary.totalProfit)));
  }

  root.appendChild(view);
}

/**
 * Monta o resumo imprimível do Histórico de Fornadas (revisão issue 019, §8
 * "aplica-se também ao Histórico de Fornadas §14") em `root`: resumo do
 * período (`summary`) seguido da listagem cronológica (`entries`, mesma fatia
 * filtrada que a tela mostra — inclusive planejadas, marcadas §14.6). Zero
 * `innerHTML`/recálculo — mesmo padrão de `renderPrintView`.
 */
export function renderHistoryPrintView(root: HTMLElement, opts: HistoryPrintViewOptions): void {
  const { entries, summary, includeCosts } = opts;
  const view = h('div', { className: 'print-view' });

  view.appendChild(h('h1', { className: 'print-title' }, ['Histórico de Fornadas']));

  // Resumo do período (§14.4/§14.5) — planejadas já ficam fora do `summary`.
  view.appendChild(h('h2', { className: 'print-section' }, ['Resumo do período']));
  view.appendChild(line('Produzido', `${summary.totalProduced} un.`));
  view.appendChild(line('Vendido', `${summary.totalSold} un.`));
  if (includeCosts) {
    view.appendChild(line('Custo total', money(summary.totalCost)));
    view.appendChild(line('Faturamento', money(summary.totalRevenue)));
    view.appendChild(line('Lucro', money(summary.totalProfit)));
    view.appendChild(line('Margem média', pct(summary.averageProfitMargin)));
  }
  view.appendChild(line('Desperdício', pct(summary.wastageRate)));

  // Listagem cronológica (§14.5) — inclusive planejadas, marcadas (§14.6).
  view.appendChild(h('h2', { className: 'print-section' }, ['Fornadas']));
  for (const entry of entries) {
    const planned = entry.planned === true;
    const label = `${formatDate(entry.date)} — ${entry.recipeName}`; // textContent via `h` (escape §3)
    const parts = [`${entry.quantityProduced} produzidas`];
    if (planned) {
      parts.push('Planejada — fora dos totais');
    } else {
      parts.push(`${entry.quantitySold} vendidas`);
      if (includeCosts) parts.push(`Lucro ${money(entry.totalProfit ?? null)}`);
    }
    view.appendChild(line(label, parts.join(' · ')));
  }

  root.appendChild(view);
}

/**
 * Cria o botão fixo "Imprimir / Salvar em PDF" e o anexa a `actionsRoot`. O
 * clique — e SÓ o clique (§8: nunca automático/no init) — dispara `onPrint`
 * (default `window.print()`). Devolve o botão para o chamador (wiring).
 */
export function mountPrintButton(
  actionsRoot: HTMLElement,
  onPrint: () => void = () => window.print(),
): HTMLButtonElement {
  const btn = h('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Imprimir / Salvar em PDF',
  ]) as HTMLButtonElement;
  btn.addEventListener('click', () => onPrint()); // §8: só no clique
  actionsRoot.appendChild(btn);
  return btn;
}
