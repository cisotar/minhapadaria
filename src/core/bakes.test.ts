/**
 * bakes.test.ts — Testes (TDD) do núcleo puro de histórico de fornadas.
 * Casos 1–15 do Plano Técnico da issue 013 (spec §14.3/§14.4/§14.5/§14.6/§14.7).
 *
 * Escritos ANTES da implementação (vermelho→verde). 100% node, sem DOM/storage.
 */
import { describe, it, expect } from 'vitest';
import type { BakeEntry, BakeHistorySummary } from './types';
import { formatDate } from './format';
import {
  computeBakeDerived,
  bakeWastageRate,
  isPlanned,
  confirmPlanned,
  aggregatePeriod,
  groupByDay,
  groupByWeek,
  groupByMonth,
  filterByRecipe,
  filterByDateRange,
  percentVariation,
  comparePeriods,
  bestPeriod,
  worstPeriod,
  isOrphan,
} from './bakes';

// Fábrica de fornada crua (snapshots) com defaults; sem campos derivados.
function bake(overrides: Partial<BakeEntry> = {}): BakeEntry {
  return {
    id: overrides.id ?? 'b1',
    recipeId: overrides.recipeId ?? 'r1',
    recipeName: overrides.recipeName ?? 'Pão',
    date: overrides.date ?? new Date(2026, 6, 5), // 2026-07-05 (local)
    quantityProduced: overrides.quantityProduced ?? 10,
    quantitySold: overrides.quantitySold ?? 8,
    unitCost: overrides.unitCost ?? 4.43,
    unitSalePrice: overrides.unitSalePrice ?? 7.38,
    ...overrides,
  };
}

describe('bakes core — por fornada (§14.3)', () => {
  it('1. computeBakeDerived: 10/8 · custo 4,43 · preço 7,38 → derivados do gabarito', () => {
    const d = computeBakeDerived(bake());
    expect(d.totalCost).toBeCloseTo(44.3, 10);
    expect(d.totalRevenue).toBeCloseTo(59.04, 10);
    expect(d.totalProfit).toBeCloseTo(14.74, 10);
    expect(d.wastage).toBe(2);
    expect(d.wastageRate).toBeCloseTo(20, 10);
  });

  it('2. bakeWastageRate(0,0) → null (guarda ÷0, contrato null≠0)', () => {
    expect(bakeWastageRate(0, 0)).toBeNull();
    expect(bakeWastageRate(10, 8)).toBeCloseTo(20, 10);
  });

  it('3. computeBakeDerived não muta a entrada (pureza)', () => {
    const entry = bake();
    const snapshot = JSON.stringify(entry);
    const d = computeBakeDerived(entry);
    expect(JSON.stringify(entry)).toBe(snapshot); // entrada intacta
    expect(entry).not.toHaveProperty('totalCost');
    expect(d).not.toBe(entry);
  });
});

describe('bakes core — planejadas (§14.6)', () => {
  it('13a. isPlanned reflete o flag', () => {
    expect(isPlanned(bake({ planned: true }))).toBe(true);
    expect(isPlanned(bake())).toBe(false);
  });

  it('13b. confirmPlanned remove o flag e a fornada passa a contar', () => {
    const planned = bake({ planned: true, quantityProduced: 5, quantitySold: 5 });
    const confirmed = confirmPlanned(planned);
    expect(confirmed).not.toHaveProperty('planned');
    expect(planned).toHaveProperty('planned'); // não muta
    // antes: só a base conta; depois: confirmada entra
    const base = bake({ id: 'b0' });
    const before = aggregatePeriod([base, planned], base.date, base.date);
    const after = aggregatePeriod([base, confirmed], base.date, base.date);
    expect(before.totalProduced).toBe(10);
    expect(after.totalProduced).toBe(15);
  });
});

describe('bakes core — agregações (§14.4)', () => {
  it('4. groupByDay: 2 na mesma data somam; planned NÃO entra', () => {
    const day = new Date(2026, 6, 5);
    const entries = [
      bake({ id: 'a', date: day, quantityProduced: 10, quantitySold: 8 }),
      bake({ id: 'b', date: day, quantityProduced: 6, quantitySold: 6, unitCost: 5, unitSalePrice: 9 }),
      bake({ id: 'c', date: day, planned: true, quantityProduced: 100, quantitySold: 100 }),
    ];
    const days = groupByDay(entries);
    expect(days).toHaveLength(1);
    expect(days[0].totalProduced).toBe(16);
    expect(days[0].totalSold).toBe(14);
    expect(days[0].totalCost).toBeCloseTo(10 * 4.43 + 6 * 5, 10);
    expect(days[0].totalRevenue).toBeCloseTo(8 * 7.38 + 6 * 9, 10);
  });

  it('5. aggregatePeriod ignora planned:true em todos os campos', () => {
    const day = new Date(2026, 6, 5);
    const s = aggregatePeriod(
      [bake({ date: day }), bake({ id: 'p', date: day, planned: true, quantityProduced: 999, quantitySold: 999 })],
      day,
      day,
    );
    expect(s.totalProduced).toBe(10);
    expect(s.totalSold).toBe(8);
  });

  it('6. groupByWeek: domingo 2026-07-12 e segunda 2026-07-13 → semanas distintas', () => {
    const sunday = new Date(2026, 6, 12); // domingo
    const monday = new Date(2026, 6, 13); // segunda
    const weeks = groupByWeek([bake({ id: 's', date: sunday }), bake({ id: 'm', date: monday })]);
    expect(weeks).toHaveLength(2);
    expect(formatDate(weeks[0].periodStart)).toBe('2026-07-06');
    expect(formatDate(weeks[1].periodStart)).toBe('2026-07-13');
  });

  it('7. groupByMonth: 2026-07-31 e 2026-08-01 → meses distintos', () => {
    const jul = new Date(2026, 6, 31);
    const aug = new Date(2026, 7, 1);
    const months = groupByMonth([bake({ id: 'j', date: jul }), bake({ id: 'a', date: aug })]);
    expect(months).toHaveLength(2);
    expect(formatDate(months[0].periodStart).slice(0, 7)).toBe('2026-07');
    expect(formatDate(months[1].periodStart).slice(0, 7)).toBe('2026-08');
  });

  it('15. aggregatePeriod de lista vazia → summary zerado sem NaN', () => {
    const day = new Date(2026, 6, 5);
    const s = aggregatePeriod([], day, day);
    expect(s.totalProduced).toBe(0);
    expect(s.totalCost).toBe(0);
    expect(s.wastageRate).toBe(0);
    expect(s.averageProfitMargin).toBe(0);
    expect(Number.isNaN(s.wastageRate)).toBe(false);
    expect(Number.isNaN(s.averageProfitMargin)).toBe(false);
  });

  it('16. groupByDay: dia com só fornadas planejadas NÃO gera bucket (§14.4/§14.6)', () => {
    const real = new Date(2026, 6, 5);
    const plannedOnly = new Date(2026, 6, 6);
    const days = groupByDay([
      bake({ id: 'r', date: real }),
      bake({ id: 'p', date: plannedOnly, planned: true, quantityProduced: 100, quantitySold: 100 }),
    ]);
    // só o dia real vira bucket; o dia só-planejado é descartado antes de agrupar
    expect(days).toHaveLength(1);
    expect(formatDate(days[0].periodStart)).toBe('2026-07-05');
  });

  it('17. groupByWeek: semana com só fornadas planejadas NÃO gera bucket (§14.4/§14.6)', () => {
    const real = new Date(2026, 6, 6); // segunda 2026-07-06
    const plannedNextWeek = new Date(2026, 6, 13); // segunda 2026-07-13
    const weeks = groupByWeek([
      bake({ id: 'r', date: real }),
      bake({ id: 'p', date: plannedNextWeek, planned: true }),
    ]);
    expect(weeks).toHaveLength(1);
    expect(formatDate(weeks[0].periodStart)).toBe('2026-07-06');
  });

  it('18. groupByMonth: mês com só fornadas planejadas NÃO gera bucket (§14.4/§14.6)', () => {
    const real = new Date(2026, 6, 15);
    const plannedNextMonth = new Date(2026, 7, 15);
    const months = groupByMonth([
      bake({ id: 'r', date: real }),
      bake({ id: 'p', date: plannedNextMonth, planned: true }),
    ]);
    expect(months).toHaveLength(1);
    expect(formatDate(months[0].periodStart).slice(0, 7)).toBe('2026-07');
  });

  it('19. groupByDay: TODAS planejadas → nenhum bucket', () => {
    const days = groupByDay([
      bake({ id: 'p1', date: new Date(2026, 6, 5), planned: true }),
      bake({ id: 'p2', date: new Date(2026, 6, 6), planned: true }),
    ]);
    expect(days).toEqual([]);
  });
});

describe('bakes core — filtros (§14.5)', () => {
  it('8. filterByRecipe separa por recipeId', () => {
    const entries = [
      bake({ id: 'a', recipeId: 'r1' }),
      bake({ id: 'b', recipeId: 'r2' }),
      bake({ id: 'c', recipeId: 'r1' }),
    ];
    expect(filterByRecipe(entries, 'r1').map((e) => e.id)).toEqual(['a', 'c']);
    expect(filterByRecipe(entries, 'zzz')).toEqual([]);
  });

  it('9. filterByDateRange é inclusivo nas bordas', () => {
    const entries = [
      bake({ id: 'before', date: new Date(2026, 6, 4) }),
      bake({ id: 'start', date: new Date(2026, 6, 5) }),
      bake({ id: 'mid', date: new Date(2026, 6, 7) }),
      bake({ id: 'end', date: new Date(2026, 6, 10) }),
      bake({ id: 'after', date: new Date(2026, 6, 11) }),
    ];
    const out = filterByDateRange(entries, new Date(2026, 6, 5), new Date(2026, 6, 10));
    expect(out.map((e) => e.id)).toEqual(['start', 'mid', 'end']);
  });
});

describe('bakes core — comparação (§14.5)', () => {
  it('10. percentVariation(100,80)=25; anterior 0 → null', () => {
    expect(percentVariation(100, 80)).toBeCloseTo(25, 10);
    expect(percentVariation(50, 0)).toBeNull();
  });

  it('11. comparePeriods produz variação por métrica + null quando anterior 0', () => {
    const current = summary({ totalProduced: 20, totalSold: 18, totalCost: 100, totalRevenue: 200, totalProfit: 100 });
    const previous = summary({ totalProduced: 10, totalSold: 9, totalCost: 80, totalRevenue: 160, totalProfit: 80 });
    const cmp = comparePeriods(current, previous);
    expect(cmp.producedVariation).toBeCloseTo(100, 10);
    expect(cmp.profitVariation).toBeCloseTo(25, 10);
    expect(cmp.revenueVariation).toBeCloseTo(25, 10);

    const zeroPrev = summary({ totalProfit: 0, totalRevenue: 0 });
    const cmp2 = comparePeriods(current, zeroPrev);
    expect(cmp2.profitVariation).toBeNull();
    expect(cmp2.revenueVariation).toBeNull();
  });
});

describe('bakes core — melhor/pior (§14.5)', () => {
  it('12. bestPeriod/worstPeriod por lucro; empate→primeiro; vazio→null', () => {
    const a = summary({ totalProfit: 10 });
    const b = summary({ totalProfit: 30 });
    const c = summary({ totalProfit: 20 });
    expect(bestPeriod([a, b, c])).toBe(b);
    expect(worstPeriod([a, b, c])).toBe(a);
    // empate → primeiro
    const t1 = summary({ totalProfit: 5, totalProduced: 1 });
    const t2 = summary({ totalProfit: 5, totalProduced: 2 });
    expect(bestPeriod([t1, t2])).toBe(t1);
    expect(worstPeriod([t1, t2])).toBe(t1);
    expect(bestPeriod([])).toBeNull();
    expect(worstPeriod([])).toBeNull();
  });

  it('20. bestPeriod/worstPeriod não retornam período só-planejado (§14.4/§14.6)', () => {
    // dia real com PREJUÍZO + dia só-planejado; sem bucket-fantasma o pior é o real.
    const lossDay = new Date(2026, 6, 5);
    const plannedDay = new Date(2026, 6, 6);
    const days = groupByDay([
      bake({ id: 'loss', date: lossDay, quantityProduced: 10, quantitySold: 0, unitCost: 5, unitSalePrice: 9 }),
      bake({ id: 'p', date: plannedDay, planned: true, quantityProduced: 100, quantitySold: 100 }),
    ]);
    expect(days).toHaveLength(1); // planejado não vira bucket
    const worst = worstPeriod(days);
    const best = bestPeriod(days);
    // o único bucket é o dia real (prejuízo −50); nenhum bucket lucro-0 fantasma
    expect(worst?.totalProfit).toBeCloseTo(-50, 10);
    expect(best?.totalProfit).toBeCloseTo(-50, 10);
    expect(formatDate(worst!.periodStart)).toBe('2026-07-05');
  });
});

describe('bakes core — órfãs (§14.7)', () => {
  it('14. isOrphan true quando recipeId ausente do conjunto; false quando presente', () => {
    const entry = bake({ recipeId: 'r1' });
    expect(isOrphan(entry, new Set())).toBe(true);
    expect(isOrphan(entry, new Set(['r1']))).toBe(false);
  });
});

// --- Helpers de teste ---
function summary(o: Partial<BakeHistorySummary>): BakeHistorySummary {
  return {
    periodStart: o.periodStart ?? new Date(2026, 6, 5),
    periodEnd: o.periodEnd ?? new Date(2026, 6, 5),
    totalProduced: o.totalProduced ?? 0,
    totalSold: o.totalSold ?? 0,
    totalCost: o.totalCost ?? 0,
    totalRevenue: o.totalRevenue ?? 0,
    totalProfit: o.totalProfit ?? 0,
    wastageRate: o.wastageRate ?? 0,
    averageProfitMargin: o.averageProfitMargin ?? 0,
  };
}
