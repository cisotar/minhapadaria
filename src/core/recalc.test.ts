/**
 * recalc.test.ts — Testes do engine central de recálculo (spec §1.2–1.6/§3.E/§9).
 *
 * Cobre (TDD, escritos ANTES da implementação, issue 008):
 *  1. Modo %→peso deriva pesos a partir das % (§1.2).
 *  2. Modo peso→%: % de exibição = peso / total geral da massa × 100, com o
 *     fermento entrando no total (§1.3, §3.D nota); pesos preservados; fermento
 *     sempre por proporção.
 *  3. Transição peso→% → %→peso (§1.5): F_total = Σ pesos das farinhas; % dos
 *     ingredientes recalculadas sobre F_total (baker's); nada descartado.
 *  4. Idempotência sobre o estado puro (§1.6): recalculate(recalculate(r).state)
 *     ≡ recalculate(r), nos dois modos.
 *  5. Pureza / sem cache: mutar campo puro reproduz recálculo do zero; a Recipe
 *     de entrada NÃO é mutada.
 *  6. null não colapsa (§5.C + contrato null-vs-0): custo impossível → campos de
 *     custo/preço null, hidratação/pesos permanecem numéricos.
 *
 * §9: sem arredondamento no engine — comparações cruas (toBeCloseTo/deep-equal).
 */
import { describe, it, expect } from 'vitest';
import { recalculate, transitionToPercentageMode } from './recalc';
import type { Recipe, PackageCost } from './types';

// --- Fábricas de fixtures (estado puro, sem derivados preenchidos) ---

function pkg(pricePaid: number, packageSize: number, packageUnit: PackageCost['packageUnit']): PackageCost {
  return { pricePaid, packageSize, packageUnit };
}

const FREE_WATER: PackageCost = pkg(0, 1, 'kg'); // torneira R$0,00/kg

/** Recipe do exemplo validado §12, modo %→peso, estado puro. */
function goldenRecipe(): Recipe {
  return {
    id: 'r1',
    name: 'Pão §12',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'total',
    flourTotalWeight: 1000,
    ingredients: [
      { id: 'f1', name: 'Farinha Branca', category: 'flour', weight: 0, percentage: 100, packageCost: pkg(8, 1, 'kg') },
      { id: 'a1', name: 'Água', category: 'liquid', weight: 0, percentage: 70, packageCost: FREE_WATER },
      { id: 's1', name: 'Sal', category: 'salt', weight: 0, percentage: 2, packageCost: pkg(3, 1, 'kg') },
    ],
    sourdough: {
      // refactor §5.3: proporção por linha (denom global isca + Σfarinhas + água).
      percentageOfTotalFlour: 20,
      parts: { isca: 0, water: 1 },
      flours: [
        { flourId: 'sf1', name: 'Farinha Branca', proportion: 1, weight: 0, packageCost: pkg(8, 1, 'kg') },
      ],
      waterPackageCost: FREE_WATER,
    },
    pricing: {
      quantity: 2,
      salePrice: 0,
      profitMargin: 40,
      profitPerUnit: 0,
      priceInputMode: 'margin',
    },
    createdAt: new Date('2026-07-05T00:00:00Z'),
    updatedAt: new Date('2026-07-05T00:00:00Z'),
  };
}

/** Receita em modo peso→%: pesos são fonte de verdade. */
function weightModeRecipe(): Recipe {
  const r = goldenRecipe();
  r.calculationMode = 'weight-to-percentage';
  // Duas farinhas somando 1000; pesos editados diretamente (§1.3).
  r.ingredients = [
    { id: 'f1', name: 'Farinha 1', category: 'flour', weight: 800, percentage: 0, packageCost: pkg(8, 1, 'kg') },
    { id: 'f2', name: 'Farinha 2', category: 'flour', weight: 200, percentage: 0, packageCost: pkg(8, 1, 'kg') },
    { id: 'a1', name: 'Água', category: 'liquid', weight: 700, percentage: 0, packageCost: FREE_WATER },
    { id: 's1', name: 'Sal', category: 'salt', weight: 20, percentage: 0, packageCost: pkg(3, 1, 'kg') },
  ];
  r.flourTotalWeight = 0; // derivado em peso→% (Σ pesos das farinhas)
  return r;
}

describe('recalculate — modo %→peso (§1.2)', () => {
  it('1. deriva pesos a partir das % e calcula hidratação nominal', () => {
    const { state, summary } = recalculate(goldenRecipe());
    const agua = state.ingredients.find((i) => i.id === 'a1')!;
    const sal = state.ingredients.find((i) => i.id === 's1')!;
    const farinha = state.ingredients.find((i) => i.id === 'f1')!;
    expect(farinha.weight).toBeCloseTo(1000, 9);
    expect(agua.weight).toBeCloseTo(700, 9);
    expect(sal.weight).toBeCloseTo(20, 9);
    expect(summary.hydration.nominal).toBeCloseTo(70, 9);
  });
});

describe('recalculate — modo peso→% (§1.3, fermento no total §3.D)', () => {
  it('2. % de exibição = peso / total geral da massa (incl. W_ferm); pesos preservados', () => {
    const { state } = recalculate(weightModeRecipe());
    // F_total = 800+200 = 1000; W_ferm = 20% × 1000 = 200; fermento entra no total (§3.D).
    // TotalGeralDaMassa = 800+200+700+20 + 200 = 1920.
    const TOTAL = 1920;
    const f1 = state.ingredients.find((i) => i.id === 'f1')!;
    const f2 = state.ingredients.find((i) => i.id === 'f2')!;
    const agua = state.ingredients.find((i) => i.id === 'a1')!;
    const sal = state.ingredients.find((i) => i.id === 's1')!;
    // Pesos preservados (fonte de verdade em peso→%).
    expect(f1.weight).toBe(800);
    expect(f2.weight).toBe(200);
    expect(agua.weight).toBe(700);
    expect(sal.weight).toBe(20);
    // % recalculadas sobre o total geral da massa.
    expect(f1.percentage).toBeCloseTo((800 / TOTAL) * 100, 9); // ≈41,6667
    expect(f2.percentage).toBeCloseTo((200 / TOTAL) * 100, 9); // ≈10,4167
    expect(agua.percentage).toBeCloseTo((700 / TOTAL) * 100, 9); // ≈36,4583
    expect(sal.percentage).toBeCloseTo((20 / TOTAL) * 100, 9); // ≈1,0417
    // As 4 linhas + fermento (200/1920) somam 100% (proporção sobre o total).
    const soma = f1.percentage + f2.percentage + agua.percentage + sal.percentage + (200 / TOTAL) * 100;
    expect(soma).toBeCloseTo(100, 9);
    // Fermento continua por proporção (W_ferm=200), nunca editado.
    expect(state.sourdough.totalWeight).toBeCloseTo(200, 9);
    expect(state.flourTotalWeight).toBeCloseTo(1000, 9);
  });
});

describe('transitionToPercentageMode (§1.5)', () => {
  it('3. pesos viram verdade: F_total=Σ farinhas, % sobre F_total, água mantém peso após recalcular', () => {
    const r = weightModeRecipe();
    // Ajuste do cenário: farinha única 1200, água 700 (peso).
    r.ingredients = [
      { id: 'f1', name: 'Farinha', category: 'flour', weight: 1200, percentage: 0, packageCost: pkg(8, 1, 'kg') },
      { id: 'a1', name: 'Água', category: 'liquid', weight: 700, percentage: 0, packageCost: FREE_WATER },
    ];
    const transitioned = transitionToPercentageMode(r);
    expect(transitioned.calculationMode).toBe('percentage-to-weight');
    expect(transitioned.flourTotalWeight).toBeCloseTo(1200, 9);
    const tf = transitioned.ingredients.find((i) => i.id === 'f1')!;
    const ta = transitioned.ingredients.find((i) => i.id === 'a1')!;
    expect(tf.percentage).toBeCloseTo(100, 9); // 1200/1200×100 (baker's, §3.A)
    expect(ta.percentage).toBeCloseTo((700 / 1200) * 100, 9); // ≈58,3333
    // Após recalcular no novo modo, a água mantém 700 (nada descartado, §1.5).
    const { state } = recalculate(transitioned);
    const agua = state.ingredients.find((i) => i.id === 'a1')!;
    expect(agua.weight).toBeCloseTo(700, 9);
  });
});

describe('idempotência sobre o estado puro (§1.6)', () => {
  it('4a. %→peso: recalculate(recalculate(r).state) ≡ recalculate(r)', () => {
    const first = recalculate(goldenRecipe());
    const second = recalculate(first.state);
    expect(second.state).toEqual(first.state);
    expect(second.summary).toEqual(first.summary);
  });

  it('4b. peso→%: recalculate(recalculate(r).state) ≡ recalculate(r)', () => {
    const first = recalculate(weightModeRecipe());
    const second = recalculate(first.state);
    expect(second.state).toEqual(first.state);
    expect(second.summary).toEqual(first.summary);
  });
});

describe('pureza / sem cache intermediário (§1.6)', () => {
  it('5. mutar campo puro ≡ recalcular do zero; entrada não é mutada', () => {
    const original = goldenRecipe();
    const snapshot = structuredClone(original);
    // Muda o sal para 3% e recalcula.
    const edited = goldenRecipe();
    edited.ingredients.find((i) => i.id === 's1')!.percentage = 3;
    const viaEdit = recalculate(edited);
    // Reconstrói do zero uma receita com sal 3% e recalcula.
    const fresh = goldenRecipe();
    fresh.ingredients.find((i) => i.id === 's1')!.percentage = 3;
    const viaFresh = recalculate(fresh);
    expect(viaEdit.state).toEqual(viaFresh.state);
    expect(viaEdit.summary).toEqual(viaFresh.summary);
    // A Recipe original passada ao engine não foi mutada.
    recalculate(original);
    expect(original).toStrictEqual(snapshot);
  });
});

describe('fornada per-unit ignorada em peso→% (§2.E.1, força total)', () => {
  it('11. em peso→%, F_total vem das farinhas; flourPerUnit não influi e o modo é normalizado a total', () => {
    // Recipe peso→% com per-unit espúrio: o engine deve ignorar flourPerUnit
    // (planejamento é sempre 'total' neste modo, §2.E.1) e derivar F_total das
    // farinhas editadas (§1.3/§3.A), exatamente como no caso 'total'.
    const perUnit = weightModeRecipe();
    perUnit.batchPlanningMode = 'per-unit';
    perUnit.flourPerUnit = 99999; // valor absurdo: não pode influenciar peso→%
    const asTotal = weightModeRecipe(); // idêntico, mas em 'total'
    const viaPerUnit = recalculate(perUnit);
    const viaTotal = recalculate(asTotal);
    // Planejamento normalizado a 'total' (§2.E.1: per-unit indisponível em peso→%).
    expect(viaPerUnit.state.batchPlanningMode).toBe('total');
    // F_total derivado das farinhas (800+200), não de flourPerUnit.
    expect(viaPerUnit.state.flourTotalWeight).toBeCloseTo(1000, 9);
    // Resultado idêntico ao caso 'total' (flourPerUnit ignorado por completo).
    expect(viaPerUnit.summary).toEqual(viaTotal.summary);
    const f1p = viaPerUnit.state.ingredients.find((i) => i.id === 'f1')!;
    const f1t = viaTotal.state.ingredients.find((i) => i.id === 'f1')!;
    expect(f1p.percentage).toBeCloseTo(f1t.percentage, 9);
    expect(f1p.weight).toBe(f1t.weight);
  });
});

describe('null não colapsa (§5.C + contrato null-vs-0)', () => {
  it('6. Peso do Produto ≤ 0 → custo/preço null; hidratação/pesos numéricos', () => {
    const r = goldenRecipe();
    // Farinha com Peso do Produto 0 → custo por grama impossível (§5.C).
    r.ingredients.find((i) => i.id === 'f1')!.packageCost = pkg(8, 0, 'kg');
    const { state, summary } = recalculate(r);
    expect(summary.totalCost).toBeNull();
    expect(summary.costPerUnit).toBeNull();
    expect(summary.salePrice).toBeNull();
    expect(summary.totalProfit).toBeNull();
    expect(summary.profitMargin).toBeNull();
    // Não colapsou para 0 nem NaN: hidratação e pesos seguem numéricos.
    expect(summary.hydration.nominal).toBeCloseTo(70, 9);
    expect(summary.realFlourConsumed).toBeCloseTo(1100, 9);
    expect(state.ingredients.find((i) => i.id === 'a1')!.weight).toBeCloseTo(700, 9);
  });
});
