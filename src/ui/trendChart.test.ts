// @vitest-environment jsdom
/**
 * trendChart.test.ts — Testes jsdom do gráfico de tendência (issue 018, §14.5).
 * Casos do Plano Técnico: 0/1/N summaries sem crash, escala a partir do máximo.
 */
import { describe, it, expect } from 'vitest';
import { renderTrendChart } from './trendChart';
import type { BakeHistorySummary } from '../core/types';

function summary(o: Partial<BakeHistorySummary>): BakeHistorySummary {
  return {
    periodStart: o.periodStart ?? new Date(2026, 5, 28),
    periodEnd: o.periodEnd ?? new Date(2026, 5, 28),
    totalProduced: o.totalProduced ?? 0,
    totalSold: o.totalSold ?? 0,
    totalCost: o.totalCost ?? 0,
    totalRevenue: o.totalRevenue ?? 0,
    totalProfit: o.totalProfit ?? 0,
    wastageRate: o.wastageRate ?? 0,
    averageProfitMargin: o.averageProfitMargin ?? 0,
  };
}

describe('trendChart (jsdom) — 0/1/N pontos sem crash (§14.5)', () => {
  it('1. 0 summaries → SVG com gridlines/axis, 0 dots, sem crash', () => {
    expect(() => renderTrendChart([])).not.toThrow();
    const node = renderTrendChart([]);
    expect(node.tagName.toLowerCase()).toBe('svg');
    expect(node.querySelectorAll('.gridline').length).toBeGreaterThan(0);
    expect(node.querySelectorAll('.axis-label').length).toBeGreaterThan(0);
    expect(node.querySelectorAll('.dot-revenue')).toHaveLength(0);
    expect(node.querySelectorAll('.dot-profit')).toHaveLength(0);
    expect(node.querySelectorAll('path')).toHaveLength(0);
  });

  it('2. 1 summary → 1 dot-revenue + 1 dot-profit, sem <path> de linha', () => {
    const node = renderTrendChart([
      summary({ periodStart: new Date(2026, 6, 5), totalRevenue: 120, totalProfit: 45 }),
    ]);
    expect(node.querySelectorAll('.dot-revenue')).toHaveLength(1);
    expect(node.querySelectorAll('.dot-profit')).toHaveLength(1);
    expect(node.querySelectorAll('path.line-revenue')).toHaveLength(0);
    expect(node.querySelectorAll('path.line-profit')).toHaveLength(0);
  });

  it('3. N=6 summaries → 6 dots por série, path com 6 vértices, <title> por dot com data+valor', () => {
    const days = [
      { d: new Date(2026, 5, 28), rev: 120, profit: 45 },
      { d: new Date(2026, 5, 29), rev: 95, profit: 30 },
      { d: new Date(2026, 5, 30), rev: 140, profit: 55 },
      { d: new Date(2026, 6, 1), rev: 110, profit: 18 },
      { d: new Date(2026, 6, 2), rev: 130, profit: 48 },
      { d: new Date(2026, 6, 3), rev: 158, profit: 61 },
    ];
    const summaries = days.map((x) => summary({ periodStart: x.d, totalRevenue: x.rev, totalProfit: x.profit }));
    const node = renderTrendChart(summaries);

    expect(node.querySelectorAll('.dot-revenue')).toHaveLength(6);
    expect(node.querySelectorAll('.dot-profit')).toHaveLength(6);

    const linePath = node.querySelector('path.line-revenue') as SVGPathElement;
    expect(linePath).not.toBeNull();
    const d = linePath.getAttribute('d') ?? '';
    // 1 "M" + 5 "L" = 6 vértices.
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect((d.match(/L/g) ?? []).length).toBe(5);

    const firstDot = node.querySelector('.dot-revenue')!;
    const title = firstDot.querySelector('title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('06-28');
    expect(title!.textContent).toContain('Faturamento');
    expect(title!.textContent).toContain('R$ 120,00');
  });

  it('4. escala Y: maior faturamento não gera cy negativo nem NaN (mapeamento correto)', () => {
    const node = renderTrendChart([
      summary({ periodStart: new Date(2026, 6, 3), totalRevenue: 158, totalProfit: 61 }),
    ]);
    const dot = node.querySelector('.dot-revenue') as SVGCircleElement;
    const cy = Number(dot.getAttribute('cy'));
    expect(Number.isNaN(cy)).toBe(false);
    expect(cy).toBeGreaterThanOrEqual(0);
    expect(cy).toBeLessThan(180); // acima da baseline (valor 0)
  });
});
