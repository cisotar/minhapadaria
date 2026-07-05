/**
 * xlsx.ts — Geração de relatórios XLSX estruturados (issue 019, spec §8/§9/§12/§14.5).
 *
 * O que faz: monta workbooks ExcelJS para (a) uma RECEITA já recalculada —
 * `buildRecipeWorkbook(recipe, summary, {includeCosts})` — com seções por
 * categoria (§8: Farinhas, Líquidos, Gorduras, Sal e Extras, Fermento,
 * Hidratação, Precificação) e (b) o HISTÓRICO — `buildHistoryWorkbook(entries,
 * period, {includeCosts})` — aba "Fornadas" (cronológica) + "Resumo do Período"
 * (§14.5). A opção `includeCosts` (pref global §2.A.2) omite TODAS as colunas/
 * seções financeiras.
 *
 * Reuso / camadas (regra de ouro 2, §1.6): NÃO recalcula NADA. Consome o
 * `state`+`summary` de `core/recalc.recalculate` (receita) e o `BakeHistorySummary`
 * de `core/bakes.aggregatePeriod` + `computeBakeDerived` (histórico). A única
 * conta local é `roundTo` — arredondamento de EXIBIÇÃO (§9), aplicado só ao
 * gravar a célula (o core continua em precisão total).
 *
 * Decisões de formato (issue 019):
 *  1. Célula = NÚMERO + `numFmt` (não string pt-BR): a planilha estruturada (§8)
 *     tem de ser recalculável — todo o ganho sobre CSV. O rótulo "R$" fica no
 *     CABEÇALHO da coluna/linha, nunca no valor (evita virar texto). numFmt por
 *     tipo (§9): peso `0.0`, % `0.00`, moeda `0.00`, custo/g `0.0000`.
 *  2. Valor gravado ARREDONDADO à precisão de exibição da §9 (a planilha é o
 *     relatório que o usuário vê): moeda 2 casas → 7,3833 vira 7,38; peso 1;
 *     custo/g 4. Assim o golden §12 relê 8.86/7.38 exatos.
 *  3. Derivado impossível (§5.C, ex.: Peso do Produto ≤ 0 → custo null): célula
 *     VAZIA (null), jamais 0/NaN (contrato null≠0 do core).
 *
 * Zero rede, zero secret, sem eval (§11.1, regra de ouro 3). ExcelJS gera 100%
 * no cliente (writeBuffer, doc oficial): https://github.com/exceljs/exceljs#browser
 *
 * Seções implementadas: §8 (relatórios), §9 (precisão de exibição), §12
 * (gabarito), §14.4/§14.5 (agregações do histórico).
 */
import ExcelJS from 'exceljs';
import type { Recipe, RecipeSummary, BakeEntry, BakeHistorySummary, PackageCost } from '../core/types';
import { formatDate } from '../core/format';

export interface ExportOptions {
  /** §2.A.2: inclui colunas/seções financeiras (pref global "Exibir custos"). */
  includeCosts: boolean;
}

// numFmt por tipo (§9). Moeda e % compartilham '0.00' (o "R$" vive no rótulo).
const FMT_WEIGHT = '0.0';
const FMT_PERCENT = '0.00';
const FMT_MONEY = '0.00';
const FMT_COST_PER_GRAM = '0.0000';

/**
 * Arredondamento de EXIBIÇÃO da §9 (halfExpand no domínio ≥0 do app, espelha a
 * decisão de format.ts). Aplicado SÓ ao gravar a célula — o core permanece em
 * precisão total (§9: arredondamento é exibição-apenas). Não há helper exportado
 * equivalente (format.* devolve string pt-BR; a célula precisa de number).
 * O nudge com Number.EPSILON corrige o "1.005" da representação binária.
 */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Descrição legível do Peso do Produto (§2.A.1): "1 kg", "1250 g". */
function packageSizeLabel(cost: PackageCost): string {
  return `${cost.packageSize} ${cost.packageUnit}`;
}

// --- Escrita de célula com numFmt e contrato null≠0 (§5.C) ---

/** Grava um número arredondado (§9) numa célula com numFmt; null → célula vazia. */
function setNum(cell: ExcelJS.Cell, value: number | null | undefined, decimals: number, numFmt: string): void {
  if (value === null || value === undefined) return; // §5.C: célula vazia, nunca 0
  cell.value = roundTo(value, decimals);
  cell.numFmt = numFmt;
}

// --- Receita (§8) ---

const CATEGORY_SECTIONS: { key: Recipe['ingredients'][number]['category']; title: string }[] = [
  { key: 'flour', title: 'Farinhas' },
  { key: 'liquid', title: 'Líquidos' },
  { key: 'fat', title: 'Gorduras' },
  { key: 'salt', title: 'Sal e Extras' },
];

/**
 * Workbook de UMA receita já recalculada. Uma planilha "Receita" com seções
 * empilhadas por categoria (§8). `recipe` é o `state` de `recalculate` (pesos/
 * custos já preenchidos); `summary` traz hidratação/precificação (§2.C/§3.E).
 */
export function buildRecipeWorkbook(
  recipe: Recipe,
  summary: RecipeSummary,
  opts: ExportOptions,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Receita');
  const { includeCosts } = opts;

  // Título da receita (texto do usuário — ExcelJS grava como valor, não fórmula).
  ws.addRow([recipe.name]);
  ws.addRow([]);

  // Cabeçalho das colunas de ingredientes.
  const ingHeader = includeCosts
    ? ['Ingrediente', 'Peso (g)', '%', 'Preço Pago (R$)', 'Peso do Produto', 'Custo/g (R$)', 'Custo (R$)']
    : ['Ingrediente', 'Peso (g)', '%'];

  // Sal e Extras agrupa 'salt' + 'extra' na mesma seção (§8).
  const bucketOf = (cat: Recipe['ingredients'][number]['category']): string =>
    cat === 'extra' ? 'salt' : cat;

  for (const section of CATEGORY_SECTIONS) {
    const rows = recipe.ingredients.filter((i) => bucketOf(i.category) === section.key);
    if (rows.length === 0) continue; // categoria vazia → sem seção (mantém o relatório enxuto)
    ws.addRow([section.title]);
    ws.addRow(ingHeader);
    for (const ing of rows) {
      const row = ws.addRow([ing.name]);
      setNum(row.getCell(2), ing.weight, 1, FMT_WEIGHT);
      setNum(row.getCell(3), ing.percentage, 2, FMT_PERCENT);
      if (includeCosts) {
        setNum(row.getCell(4), ing.packageCost.pricePaid, 2, FMT_MONEY);
        row.getCell(5).value = packageSizeLabel(ing.packageCost); // texto descritivo
        setNum(row.getCell(6), ing.costPerGram ?? null, 4, FMT_COST_PER_GRAM);
        setNum(row.getCell(7), ing.recipeCost ?? null, 2, FMT_MONEY);
      }
    }
    ws.addRow([]);
  }

  // --- Fermento Natural (§2.B) ---
  const sd = recipe.sourdough;
  ws.addRow(['Fermento Natural']);
  setNum(ws.addRow(['Proporção da farinha total (%)']).getCell(2), sd.percentageOfTotalFlour, 2, FMT_PERCENT);
  setNum(ws.addRow(['Peso total (g)']).getCell(2), sd.totalWeight ?? null, 1, FMT_WEIGHT);
  setNum(ws.addRow(['Isca (g)']).getCell(2), sd.iscaWeight ?? null, 1, FMT_WEIGHT);
  setNum(ws.addRow(['Farinha do fermento (g)']).getCell(2), sd.flourWeight ?? null, 1, FMT_WEIGHT);
  setNum(ws.addRow(['Água do fermento (g)']).getCell(2), sd.waterWeight ?? null, 1, FMT_WEIGHT);
  setNum(ws.addRow(['Hidratação do fermento (%)']).getCell(2), sd.hydration ?? null, 2, FMT_PERCENT);
  // §2.B.3: N farinhas do fermento → lista todas.
  for (const f of sd.flours) {
    const row = ws.addRow([`  ${f.name}`]);
    setNum(row.getCell(2), f.weight, 1, FMT_WEIGHT);
    setNum(row.getCell(3), f.proportion, 2, FMT_PERCENT); // refactor §5.3: proporção por linha (era %)
    if (includeCosts) setNum(row.getCell(6), f.costPerGram ?? null, 4, FMT_COST_PER_GRAM);
  }
  ws.addRow([]);

  // --- Hidratação (§2.C/§2.D) ---
  ws.addRow(['Hidratação']);
  setNum(ws.addRow(['Hidratação Nominal (%)']).getCell(2), summary.hydration.nominal, 2, FMT_PERCENT);
  setNum(ws.addRow(['Hidratação Real (%)']).getCell(2), summary.hydration.real, 2, FMT_PERCENT);
  setNum(ws.addRow(['Farinha Real Consumida (g)']).getCell(2), summary.realFlourConsumed, 1, FMT_WEIGHT);
  ws.addRow([]);

  // --- Precificação (§3.E) — só com custos ---
  if (includeCosts) {
    ws.addRow(['Precificação']);
    setNum(ws.addRow(['Custo total (R$)']).getCell(2), summary.totalCost, 2, FMT_MONEY);
    setNum(ws.addRow(['Custo por unidade (R$)']).getCell(2), summary.costPerUnit, 2, FMT_MONEY);
    ws.addRow(['Quantidade']).getCell(2).value = recipe.pricing.quantity;
    setNum(ws.addRow(['Preço de venda (R$)']).getCell(2), summary.salePrice, 2, FMT_MONEY);
    setNum(ws.addRow(['Margem de lucro (%)']).getCell(2), summary.profitMargin, 2, FMT_PERCENT);
    setNum(ws.addRow(['Lucro por unidade (R$)']).getCell(2), summary.profitPerUnit, 2, FMT_MONEY);
    setNum(ws.addRow(['Faturamento total (R$)']).getCell(2), summary.totalRevenue, 2, FMT_MONEY);
    setNum(ws.addRow(['Lucro total (R$)']).getCell(2), summary.totalProfit, 2, FMT_MONEY);
  }

  return wb;
}

// --- Histórico (§14.4/§14.5) ---

/**
 * Workbook do histórico filtrado: aba "Fornadas" (cronológica, uma linha por
 * `BakeEntry`, planejadas marcadas §14.6) + aba "Resumo do Período" com os
 * totais de `aggregatePeriod` (§14.5). Nada é recalculado — os derivados por
 * fornada vêm de `computeBakeDerived` (chamado pelo caller/UI).
 */
export function buildHistoryWorkbook(
  entries: BakeEntry[],
  period: BakeHistorySummary,
  opts: ExportOptions,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const { includeCosts } = opts;

  // --- Aba Fornadas ---
  const ws = wb.addWorksheet('Fornadas');
  const header = includeCosts
    ? ['Data', 'Receita', 'Produzido', 'Vendido', 'Custo unit. (R$)', 'Preço unit. (R$)', 'Custo total (R$)', 'Faturamento (R$)', 'Lucro (R$)', 'Status']
    : ['Data', 'Receita', 'Produzido', 'Vendido', 'Status'];
  ws.addRow(header);

  for (const entry of entries) {
    const status = entry.planned === true ? 'Planejada' : 'Confirmada';
    if (includeCosts) {
      const row = ws.addRow([formatDate(entry.date), entry.recipeName, entry.quantityProduced, entry.quantitySold]);
      setNum(row.getCell(5), entry.unitCost, 2, FMT_MONEY);
      setNum(row.getCell(6), entry.unitSalePrice, 2, FMT_MONEY);
      setNum(row.getCell(7), entry.totalCost ?? null, 2, FMT_MONEY);
      setNum(row.getCell(8), entry.totalRevenue ?? null, 2, FMT_MONEY);
      setNum(row.getCell(9), entry.totalProfit ?? null, 2, FMT_MONEY);
      row.getCell(10).value = status;
    } else {
      ws.addRow([formatDate(entry.date), entry.recipeName, entry.quantityProduced, entry.quantitySold, status]);
    }
  }

  // --- Aba Resumo do Período (§14.5) ---
  const rs = wb.addWorksheet('Resumo do Período');
  rs.addRow(['Total produzido']).getCell(2).value = period.totalProduced;
  rs.addRow(['Total vendido']).getCell(2).value = period.totalSold;
  if (includeCosts) {
    setNum(rs.addRow(['Custo total (R$)']).getCell(2), period.totalCost, 2, FMT_MONEY);
    setNum(rs.addRow(['Faturamento (R$)']).getCell(2), period.totalRevenue, 2, FMT_MONEY);
    setNum(rs.addRow(['Lucro (R$)']).getCell(2), period.totalProfit, 2, FMT_MONEY);
    setNum(rs.addRow(['Margem média (%)']).getCell(2), period.averageProfitMargin, 2, FMT_PERCENT);
  }
  setNum(rs.addRow(['Desperdício (%)']).getCell(2), period.wastageRate, 2, FMT_PERCENT);

  return wb;
}
