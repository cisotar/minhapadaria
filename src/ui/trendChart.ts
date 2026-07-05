/**
 * trendChart.ts — Gráfico de tendência Faturamento + Lucro (spec §14.5) · issue 018.
 *
 * O que faz: `renderTrendChart(summaries)` gera o `<svg class="chart-svg">`
 * (card "Faturamento e Lucro no período" de `mockups/historico.html`): grade
 * de fundo (`.gridline` + `.axis-label`), uma label de eixo X por período
 * (`formatDate` truncado a "mm-dd", §7.1), duas séries (`.line-revenue`/
 * `.line-profit` + `.dot-revenue`/`.dot-profit`) com `<title>` (tooltip
 * nativo acessível — "mm-dd · Faturamento R$…", `formatCurrency`) e um rótulo
 * direto (`.direct-label`) no último ponto de cada série.
 *
 * Puro de dados (regra de ouro 2): recebe só `BakeHistorySummary[]` — já
 * filtrados `!isPlanned` e agrupados por `historyView.ts` (bucket-fantasma
 * planned é responsabilidade do orquestrador, não deste módulo) — nenhum
 * acesso a store/DOM fora do nó `<svg>` retornado.
 *
 * 0/1/N pontos sem crash (critério de aceite §018): 0 summaries → só
 * grade+eixos, sem dots/path; 1 summary → 1 dot por série, SEM `<path>` de
 * linha (um único ponto não forma linha, guarda explícita); N → `<path>`
 * com N vértices.
 *
 * Escala Y — técnica "nice number" clássica de bibliotecas de gráfico (D3
 * `scaleLinear().nice()`, regra de ouro 4, doc oficial consultada):
 * arredonda o maior valor (faturamento OU lucro) para cima ao próximo
 * 1/2/5×10ⁿ, dando folga visual acima do maior ponto (nenhum dot encosta na
 * borda superior). Implementado aqui em poucas linhas — não importa a lib
 * (zero dependência nova, critério da issue).
 * Doc: https://d3js.org/d3-scale/linear#linear_nice
 *
 * Classes usadas — TODAS já existentes em design-system.css (linhas
 * 380–388), zero classe nova: `.chart-svg`, `.gridline`, `.axis-label`,
 * `.line-revenue`, `.line-profit`, `.dot-revenue`, `.dot-profit`,
 * `.direct-label`. Nós criados só via `svg()` (dom.ts, namespace SVG) — zero
 * `innerHTML`.
 *
 * Divergência consciente vs. mockup: os rótulos do eixo Y/diretos usam
 * `formatCurrency` (fonte única de formatação, §9 — regra de ouro 2) em vez
 * do "R$158" abreviado sem casas decimais do HTML estático do mockup.
 *
 * Seções implementadas: §14.5.
 */
import { formatCurrency, formatDate } from '../core/format';
import type { BakeHistorySummary } from '../core/types';
import { svg } from './dom';

const VIEW_W = 600;
const VIEW_H = 220;
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const BASELINE_Y = 180; // y do valor 0
const TOP_Y = 20; // topo utilizável do gráfico (folga acima do maior ponto)
const TICKS = 4;

/**
 * "Nice number" clássico (D3 `scaleLinear().nice()`): arredonda `max` para
 * cima ao próximo 1/2/5×10ⁿ. `max` ≤ 0 (sem fornadas ou tudo zero) → 1
 * (guarda ÷0, nunca NaN/Infinity no restante da escala).
 */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function yFor(value: number, max: number): number {
  return BASELINE_Y - (value / max) * (BASELINE_Y - TOP_Y);
}

function xFor(index: number, count: number): number {
  if (count <= 1) return MARGIN_LEFT;
  const usableWidth = VIEW_W - MARGIN_LEFT - MARGIN_RIGHT;
  return MARGIN_LEFT + (index / (count - 1)) * usableWidth;
}

/** Rótulo do eixo X (§7.1): "mm-dd" a partir de `periodStart` (aaaa-mm-dd → 5 últimos chars). */
function xLabel(summary: BakeHistorySummary): string {
  return formatDate(summary.periodStart).slice(5);
}

/** Constrói uma série (linha + dots + rótulo direto) sobre o `<svg>` já com grade. */
function buildSeries(
  parent: SVGSVGElement,
  summaries: BakeHistorySummary[],
  max: number,
  valueOf: (s: BakeHistorySummary) => number,
  lineClass: string,
  dotClass: string,
  seriesLabel: string,
): void {
  if (summaries.length === 0) return; // 0 pontos: nada a desenhar (sem crash)

  const points = summaries.map((s, i) => ({
    x: xFor(i, summaries.length),
    y: yFor(valueOf(s), max),
    s,
  }));

  // §14.5/critério de aceite: 1 ponto não forma linha — path só com ≥2 pontos.
  if (points.length > 1) {
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    parent.appendChild(svg('path', { className: lineClass, d }));
  }

  for (const p of points) {
    const dot = svg('circle', { className: dotClass, cx: p.x, cy: p.y, r: 4 });
    dot.appendChild(
      svg('title', {}, [`${xLabel(p.s)} · ${seriesLabel} ${formatCurrency(valueOf(p.s))}`]),
    );
    parent.appendChild(dot);
  }

  // Rótulo direto no último ponto de cada série (§14.5, mockup).
  const last = points[points.length - 1];
  parent.appendChild(
    svg(
      'text',
      { className: 'direct-label', x: last.x + 10, y: last.y + 4, style: 'fill:var(--text-2)' },
      [formatCurrency(valueOf(last.s))],
    ),
  );
}

/**
 * Gera o `<svg class="chart-svg">` de faturamento+lucro por período (§14.5).
 * `summaries` deve chegar JÁ ordenado cronologicamente e SEM fornadas
 * planejadas (pré-filtro é responsabilidade de `historyView.ts`, §14.4).
 */
export function renderTrendChart(summaries: BakeHistorySummary[]): SVGSVGElement {
  const root = svg('svg', {
    className: 'chart-svg',
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: 'img',
    'aria-label': 'Gráfico de tendência de faturamento e lucro por período',
  });

  const allValues = summaries.flatMap((s) => [s.totalRevenue, s.totalProfit]);
  const max = niceMax(Math.max(0, ...allValues));

  // Grade + rótulos do eixo Y (§14.5) — sempre desenhados, mesmo com 0 fornadas.
  for (let i = 0; i <= TICKS; i++) {
    const value = (max / TICKS) * i;
    const y = yFor(value, max);
    root.appendChild(
      svg('line', { className: 'gridline', x1: MARGIN_LEFT, y1: y, x2: VIEW_W - MARGIN_RIGHT, y2: y }),
    );
    root.appendChild(svg('text', { className: 'axis-label', x: 0, y: y + 4 }, [formatCurrency(value)]));
  }

  // Eixo X — uma label por período (§14.5).
  summaries.forEach((s, i) => {
    const x = xFor(i, summaries.length);
    root.appendChild(svg('text', { className: 'axis-label', x, y: 200, 'text-anchor': 'middle' }, [xLabel(s)]));
  });

  buildSeries(root, summaries, max, (s) => s.totalRevenue, 'line-revenue', 'dot-revenue', 'Faturamento');
  buildSeries(root, summaries, max, (s) => s.totalProfit, 'line-profit', 'dot-profit', 'Lucro');

  return root;
}
