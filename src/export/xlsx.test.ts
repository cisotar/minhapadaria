/**
 * xlsx.test.ts — TDD do gerador de planilhas XLSX (issue 019, spec §8/§12/§14.5).
 *
 * Ambiente node (default): ExcelJS gera o buffer com `writeBuffer()` e RELÊ com
 * `xlsx.load(buffer)` — o mesmo caminho do browser (regra de ouro 4, doc
 * oficial ExcelJS). Os valores lidos são NÚMEROS (decisão 019: célula numérica +
 * numFmt, não string pt-BR), arredondados à precisão de exibição §9.
 *
 * Casos: (1) golden §12 com custos → 1000/8,86/7,38 como números; (2) sem custos
 * → nenhuma coluna/valor financeiro; (3) seções por categoria §8; (4) derivado
 * impossível §5.C → célula vazia (null, nunca 0/NaN); (5) histórico 2 fornadas +
 * resumo §14.5; (6) histórico sem custos.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { recalculate } from '../core/recalc';
import { computeBakeDerived, aggregatePeriod } from '../core/bakes';
import { goldenSeed } from '../ui/seed';
import { buildRecipeWorkbook, buildHistoryWorkbook } from './xlsx';
import type { Recipe, PackageCost, BakeEntry } from '../core/types';

// --- Fixtures ---

function pkg(pricePaid: number, packageSize: number, packageUnit: PackageCost['packageUnit']): PackageCost {
  return { pricePaid, packageSize, packageUnit };
}
const FREE_WATER: PackageCost = pkg(0, 1, 'L');

// Gabarito §12 EXATO (sem o azeite do seed) → custo total 8,86 / preço 7,3833.
function goldenRecipe(): Recipe {
  return {
    id: 'golden',
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
      percentageOfTotalFlour: 20,
      parts: { isca: 0, water: 1 }, // refactor §5.3: proporção por linha
      flours: [{ flourId: 'sf1', name: 'Farinha Branca', proportion: 1, weight: 0, packageCost: pkg(8, 1, 'kg') }],
      waterPackageCost: FREE_WATER,
    },
    pricing: { quantity: 2, salePrice: 0, profitMargin: 40, profitPerUnit: 0, priceInputMode: 'margin' },
    createdAt: new Date('2026-07-05T00:00:00Z'),
    updatedAt: new Date('2026-07-05T00:00:00Z'),
  };
}

// --- Helpers de leitura (relê o buffer como o browser faria) ---

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buffer = await wb.xlsx.writeBuffer();
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(buffer as unknown as ArrayBuffer);
  return out;
}

interface Cell {
  value: unknown;
  numFmt: string | undefined;
}

function allCells(wb: ExcelJS.Workbook): Cell[] {
  const cells: Cell[] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cells.push({ value: cell.value, numFmt: cell.numFmt });
      });
    });
  }
  return cells;
}

function allNumbers(wb: ExcelJS.Workbook): number[] {
  return allCells(wb)
    .map((c) => c.value)
    .filter((v): v is number => typeof v === 'number');
}

function allStrings(wb: ExcelJS.Workbook): string[] {
  return allCells(wb)
    .map((c) => c.value)
    .filter((v): v is string => typeof v === 'string');
}

/** Valor da célula à direita (col B) de uma linha cujo rótulo (col A) === label. */
function valueByLabel(wb: ExcelJS.Workbook, label: string): unknown {
  for (const ws of wb.worksheets) {
    let found: unknown = undefined;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (row.getCell(1).value === label) found = row.getCell(2).value;
    });
    if (found !== undefined) return found;
  }
  return undefined;
}

// --- BakeEntries do histórico ---

function bakeA(): BakeEntry {
  return { id: 'b1', recipeId: 'r1', recipeName: 'Pão A', date: new Date(2026, 6, 1), quantityProduced: 2, quantitySold: 2, unitCost: 4.43, unitSalePrice: 7.38 };
}
function bakeB(): BakeEntry {
  return { id: 'b2', recipeId: 'r1', recipeName: 'Pão A', date: new Date(2026, 6, 2), quantityProduced: 10, quantitySold: 8, unitCost: 3, unitSalePrice: 6 };
}

describe('buildRecipeWorkbook', () => {
  it('1. golden §12 com custos: células numéricas 1000, 8.86, 7.38 presentes', async () => {
    const { state, summary } = recalculate(goldenRecipe());
    const wb = await reload(buildRecipeWorkbook(state, summary, { includeCosts: true }));
    const nums = allNumbers(wb);
    expect(nums).toContain(1000); // F_total (§12)
    expect(nums).toContain(8.86); // custo total (§12)
    expect(nums).toContain(7.38); // preço de venda (§12: 7,3833 → 2 casas §9)
  });

  it('2. sem custos: nenhuma coluna/valor financeiro, sem "R$", sem Precificação', async () => {
    const { state, summary } = recalculate(goldenRecipe());
    const wb = await reload(buildRecipeWorkbook(state, summary, { includeCosts: false }));
    const strings = allStrings(wb);
    expect(strings.some((s) => s.includes('R$'))).toBe(false);
    expect(strings).not.toContain('Precificação');
    expect(strings).not.toContain('Custo (R$)');
    expect(strings).not.toContain('Preço Pago (R$)');
    expect(strings).not.toContain('Peso do Produto');
  });

  it('3. seções por categoria (§8): Farinhas, Líquidos, Gorduras, Sal e Extras, Fermento, Hidratação, Precificação', async () => {
    const { state, summary } = recalculate(goldenSeed()); // seed tem as 4 categorias (inc. Azeite=fat)
    const wb = await reload(buildRecipeWorkbook(state, summary, { includeCosts: true }));
    const strings = allStrings(wb);
    for (const label of ['Farinhas', 'Líquidos', 'Gorduras', 'Sal e Extras', 'Fermento Natural', 'Hidratação', 'Precificação']) {
      expect(strings).toContain(label);
    }
  });

  it('4. derivado impossível (§5.C, Peso do Produto = 0): célula de custo vazia (não 0/NaN)', async () => {
    const recipe = goldenRecipe();
    recipe.ingredients[0].packageCost = pkg(8, 0, 'kg'); // Peso do Produto 0 → custo impossível
    const { state, summary } = recalculate(recipe);
    expect(summary.totalCost).toBeNull(); // contrato null≠0 do core
    const wb = await reload(buildRecipeWorkbook(state, summary, { includeCosts: true }));
    const custoTotal = valueByLabel(wb, 'Custo total (R$)');
    expect(custoTotal == null).toBe(true); // célula vazia (null), nunca 0
    expect(allNumbers(wb).some((n) => Number.isNaN(n))).toBe(false);
  });
});

describe('buildHistoryWorkbook', () => {
  it('5. histórico: aba Fornadas com 2 linhas + Resumo com totais de aggregatePeriod', async () => {
    const entries = [computeBakeDerived(bakeA()), computeBakeDerived(bakeB())];
    const period = aggregatePeriod(entries, new Date(2026, 6, 1), new Date(2026, 6, 2));
    const wb = await reload(buildHistoryWorkbook(entries, period, { includeCosts: true }));

    const fornadas = wb.getWorksheet('Fornadas');
    expect(fornadas).toBeDefined();
    expect(fornadas!.rowCount).toBe(3); // cabeçalho + 2 fornadas

    expect(valueByLabel(wb, 'Total produzido')).toBe(12);
    expect(valueByLabel(wb, 'Total vendido')).toBe(10);
    expect(valueByLabel(wb, 'Custo total (R$)')).toBe(38.86);
    expect(valueByLabel(wb, 'Faturamento (R$)')).toBe(62.76);
    expect(valueByLabel(wb, 'Lucro (R$)')).toBe(23.9);
  });

  it('6. histórico sem custos: sem colunas/valores financeiros nem "R$"', async () => {
    const entries = [computeBakeDerived(bakeA()), computeBakeDerived(bakeB())];
    const period = aggregatePeriod(entries, new Date(2026, 6, 1), new Date(2026, 6, 2));
    const wb = await reload(buildHistoryWorkbook(entries, period, { includeCosts: false }));
    const strings = allStrings(wb);
    expect(strings.some((s) => s.includes('R$'))).toBe(false);
    expect(strings).not.toContain('Custo total (R$)');
    expect(strings).not.toContain('Lucro (R$)');
    // dados não-financeiros permanecem:
    expect(valueByLabel(wb, 'Total produzido')).toBe(12);
  });
});
