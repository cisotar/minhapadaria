// @vitest-environment jsdom
/**
 * print.test.ts — TDD das views de impressão (issue 019 base, refactor issue
 * 028, spec §8/§9/§14.5).
 *
 * Ambiente jsdom (file-level, precedente das telas 014+): as views são DOM
 * montado via `dom.ts h()` (escape automático por `textContent`, regra de ouro
 * 3). Refactor 028 (2 PDFs por contexto — Receita/Custos e Fornadas/Financeiro):
 *  1. `renderRecipePrintView` — conteúdo golden, ZERO "R$".
 *  2. `renderRecipePrintView` — snapshot de classes: `.card`/`table.table` com
 *     thead+tbody+tfoot; zero `.print-line`/`.print-section` (trava a migração).
 *  3. `renderRecipeCostsPrintView` — custo/precificação com "R$"; débito em
 *     `.pdf-debit`, crédito em `.pdf-credit`, margem sem cor.
 *  4. `renderRecipeCostsPrintView` — prejuízo (isLoss): Lucro em `.pdf-debit` +
 *     `.pdf-alert`; caso feliz sem `.pdf-alert`.
 *  5. `renderRecipeCostsPrintView` — null≠0 (§5.C): célula "—", nunca "R$ 0,00".
 *  6. `renderHistoryPrintView` (Fornadas) — produção, ZERO "R$", planejada em
 *     `tr.pdf-muted-row`.
 *  7. `renderHistoryCostsPrintView` (Financeiro) — "R$"; Custo `.pdf-debit`,
 *     Lucro colorido por sinal; Margem média sem cor.
 *  8. Escape XSS nas 4 views.
 *  9. Clique-só (§8): montar não chama `window.print`; só o clique no botão.
 *
 * Números do seed (recalculate(goldenSeed()), seed com Isca=1 — o §12 de fórmula
 * vive em golden-example.test.ts): F 1.000g/100%, Água 700g/70%, hidratação real
 * 71,87%, Farinha Real 1.066,7g; custo total R$ 11,15, custo/un R$ 5,58, preço
 * R$ 9,29, margem 40,00%, lucro R$ 7,44.
 */
import { describe, it, expect, vi } from 'vitest';
import { recalculate } from '../core/recalc';
import { goldenSeed } from '../ui/seed';
import {
  renderRecipePrintView,
  renderRecipeCostsPrintView,
  renderHistoryPrintView,
  renderHistoryCostsPrintView,
  mountPrintButton,
} from './print';
import { computeBakeDerived, aggregatePeriod } from '../core/bakes';
import type { BakeEntry, RecipeSummary, Recipe } from '../core/types';

function state(recipe = goldenSeed()): { recipe: Recipe; summary: RecipeSummary } {
  const { state, summary } = recalculate(recipe);
  return { recipe: state, summary };
}

function renderRecipe(recipe = goldenSeed()): HTMLElement {
  const { recipe: r, summary } = state(recipe);
  const root = document.createElement('div');
  renderRecipePrintView(root, { recipe: r, summary });
  return root;
}

function renderCosts(recipe = goldenSeed(), mutate?: (s: RecipeSummary) => void): HTMLElement {
  const { recipe: r, summary } = state(recipe);
  if (mutate) mutate(summary);
  const root = document.createElement('div');
  renderRecipeCostsPrintView(root, { recipe: r, summary });
  return root;
}

/** Célula-valor (`td` final) da linha `.kv` cujo primeiro `td` === label. */
function kvCell(root: HTMLElement, label: string): HTMLElement | null {
  for (const tr of Array.from(root.querySelectorAll('.kv tr'))) {
    const tds = tr.querySelectorAll('td');
    if (tds[0]?.textContent === label) return (tds[tds.length - 1] as HTMLElement) ?? null;
  }
  return null;
}

/** Linha (`tr`) de `table.table` (tbody ou tfoot) cujo primeiro `td` === texto. */
function tableRow(root: HTMLElement, firstCell: string): HTMLElement | null {
  for (const tr of Array.from(root.querySelectorAll('table.table tbody tr, table.table tfoot tr'))) {
    if (tr.querySelector('td')?.textContent === firstCell) return tr as HTMLElement;
  }
  return null;
}

describe('renderRecipePrintView (Receita — zero $)', () => {
  it('1. conteúdo golden e ZERO "R$"', () => {
    const root = renderRecipe();
    const text = root.textContent ?? '';
    expect(text).toContain('Pão Rústico de Azeite');
    expect(text).toContain('1.000'); // F_total (§12)
    expect(text).toContain('700,0'); // água
    expect(text).toContain('71,87'); // hidratação real (seed Isca=1)
    expect(text).toContain('1.066,7'); // Farinha Real Consumida
    expect(text).not.toContain('R$'); // Receita nunca mostra dinheiro
  });

  it('2. snapshot de classes: .card + table.table (thead/tbody/tfoot); zero .print-*', () => {
    const root = renderRecipe();
    expect(root.querySelector('.card')).not.toBeNull();
    const table = root.querySelector('table.table');
    expect(table).not.toBeNull();
    expect(table!.querySelector('thead')).not.toBeNull();
    expect(table!.querySelector('tbody')).not.toBeNull();
    expect(table!.querySelector('tfoot')).not.toBeNull(); // Total Farinhas
    expect(root.querySelector('.print-line')).toBeNull();
    expect(root.querySelector('.print-section')).toBeNull();
    expect(root.querySelector('.print-view')).toBeNull();
  });

  it('2b. gorduras (fat) caem em "Sal e Extras" junto com Sal — sem seção "Gorduras" (mockup pdf-refactor)', () => {
    const root = renderRecipe(); // seed tem Azeite (fat) + Sal (salt)
    // Nenhuma seção "Gorduras" isolada (mockup só tem Farinhas/Líquidos/Sal e Extras).
    const sectionTitles = Array.from(root.querySelectorAll('.pdf-section')).map((el) => el.textContent);
    expect(sectionTitles).not.toContain('Gorduras');
    expect(sectionTitles).toContain('Sal e Extras');
    // Azeite e Sal na MESMA tabela (a que segue o título "Sal e Extras").
    const saltHeading = Array.from(root.querySelectorAll('.pdf-section')).find(
      (el) => el.textContent === 'Sal e Extras',
    );
    expect(saltHeading).not.toBeUndefined();
    const table = saltHeading!.nextElementSibling as HTMLElement;
    expect(table.classList.contains('table')).toBe(true);
    const firstCells = Array.from(table.querySelectorAll('tbody tr td:first-child')).map((td) => td.textContent);
    expect(firstCells).toContain('Sal');
    expect(firstCells).toContain('Azeite');
  });

  it('8a. escape XSS: nome de ingrediente com <b>/<script> vira texto, zero nó', () => {
    const recipe = goldenSeed();
    recipe.ingredients[0].name = '<b>x</b><script>alert(1)</script>';
    const root = renderRecipe(recipe);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('<b>x</b>');
  });
});

describe('renderRecipeCostsPrintView (Custos — sempre $)', () => {
  it('3. custo/precificação: débito em .pdf-debit, crédito em .pdf-credit, margem neutra', () => {
    const root = renderCosts();
    const text = root.textContent ?? '';
    expect(text).toContain('R$ 11,15'); // custo total (tfoot)
    expect(text).toContain('R$ 5,58'); // custo por unidade
    expect(text).toContain('R$ 9,29'); // preço de venda
    expect(text).toContain('40,00'); // margem

    // tfoot Custo total → débito
    const totalRow = tableRow(root, 'Custo total');
    expect(totalRow).not.toBeNull();
    expect(totalRow!.querySelector('.pdf-debit')?.textContent).toBe('R$ 11,15');

    // linha de ingrediente: ambas as células monetárias em .pdf-debit
    const flourRow = tableRow(root, 'Farinha Branca');
    expect(flourRow).not.toBeNull();
    expect(flourRow!.querySelectorAll('.pdf-debit')).toHaveLength(2);

    // Precificação (.kv)
    const custoUnit = kvCell(root, 'Custo por unidade');
    expect(custoUnit!.classList.contains('pdf-debit')).toBe(true);
    const preco = kvCell(root, 'Preço de venda');
    expect(preco!.classList.contains('pdf-credit')).toBe(true);
    const margem = kvCell(root, 'Margem de lucro');
    expect(margem!.classList.contains('pdf-credit')).toBe(false);
    expect(margem!.classList.contains('pdf-debit')).toBe(false);
    const lucro = kvCell(root, 'Lucro total');
    expect(lucro!.classList.contains('pdf-credit')).toBe(true); // lucro ≥ 0 → crédito
  });

  it('4. prejuízo (isLoss): Lucro total em .pdf-debit + .pdf-alert; feliz sem alerta', () => {
    expect(renderCosts().querySelector('.pdf-alert')).toBeNull(); // feliz

    const root = renderCosts(goldenSeed(), (s) => {
      s.salePrice = 1; // preço < custo/un (5,58) → isLoss
      s.totalProfit = -9;
      s.profitMargin = -458;
    });
    const lucro = kvCell(root, 'Lucro total');
    expect(lucro!.classList.contains('pdf-debit')).toBe(true);
    expect(lucro!.classList.contains('pdf-credit')).toBe(false);
    const alert = root.querySelector('.pdf-alert');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('PREJUÍZO');
    // Preço de venda continua crédito mesmo em prejuízo (é a entrada de caixa)
    expect(kvCell(root, 'Preço de venda')!.classList.contains('pdf-credit')).toBe(true);
  });

  it('5. null≠0 (§5.C): custo/un impossível → "—", nunca "R$ 0,00", sem cor', () => {
    const root = renderCosts(goldenSeed(), (s) => {
      s.costPerUnit = null;
    });
    const cell = kvCell(root, 'Custo por unidade');
    expect(cell!.textContent).toBe('—');
    expect(cell!.textContent).not.toContain('R$');
    expect(cell!.classList.contains('pdf-debit')).toBe(false);
    expect(cell!.classList.contains('pdf-credit')).toBe(false);
  });

  it('8b. escape XSS: nome de ingrediente vira texto, zero nó', () => {
    const recipe = goldenSeed();
    recipe.ingredients[0].name = '<b>x</b><script>alert(1)</script>';
    const root = renderCosts(recipe);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('<b>x</b>');
  });
});

// --- Histórico ---

function bake(overrides: Partial<BakeEntry> = {}): BakeEntry {
  return computeBakeDerived({
    id: overrides.id ?? 'b1',
    recipeId: overrides.recipeId ?? 'r1',
    recipeName: overrides.recipeName ?? 'Pão Rústico de Azeite',
    date: overrides.date ?? new Date(2026, 6, 5),
    quantityProduced: overrides.quantityProduced ?? 10,
    quantitySold: overrides.quantitySold ?? 8,
    unitCost: overrides.unitCost ?? 4.43,
    unitSalePrice: overrides.unitSalePrice ?? 7.38,
    ...overrides,
  });
}

function renderFornadas(entries: BakeEntry[]): HTMLElement {
  const summary = aggregatePeriod(entries, new Date(2026, 6, 1), new Date(2026, 6, 8));
  const root = document.createElement('div');
  renderHistoryPrintView(root, { entries, summary });
  return root;
}

function renderFinanceiro(entries: BakeEntry[]): HTMLElement {
  const summary = aggregatePeriod(entries, new Date(2026, 6, 1), new Date(2026, 6, 8));
  const root = document.createElement('div');
  renderHistoryCostsPrintView(root, { entries, summary });
  return root;
}

describe('renderHistoryPrintView (Fornadas — zero $)', () => {
  it('6. produção, ZERO "R$", planejada em tr.pdf-muted-row', () => {
    const confirmada = bake();
    const planejada = bake({ id: 'b2', date: new Date(2026, 6, 6), planned: true, quantitySold: 0 });
    const root = renderFornadas([confirmada, planejada]);
    const text = root.textContent ?? '';
    expect(text).toContain('Histórico de Fornadas');
    expect(text).toContain('Produzido');
    expect(text).toContain('2026-07-05'); // data (§7.1)
    expect(text).toContain('Pão Rústico de Azeite');
    expect(text).not.toContain('R$');
    // planejada marcada em linha esmaecida
    const plannedRow = root.querySelector('tr.pdf-muted-row');
    expect(plannedRow).not.toBeNull();
    expect(plannedRow!.textContent).toContain('Planejada');
  });

  it('8c. escape XSS: recipeName com <script> vira texto', () => {
    const root = renderFornadas([bake({ recipeName: '<script>alert(1)</script>' })]);
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('renderHistoryCostsPrintView (Financeiro — sempre $)', () => {
  it('7. Custo .pdf-debit, Lucro colorido por sinal; Margem média neutra', () => {
    const lucrativa = bake({ id: 'b1', unitCost: 4, unitSalePrice: 7, quantityProduced: 10, quantitySold: 10 });
    const prejuizo = bake({ id: 'b2', unitCost: 10, unitSalePrice: 2, quantityProduced: 10, quantitySold: 10 });
    const root = renderFinanceiro([lucrativa, prejuizo]);
    expect(root.textContent).toContain('R$');

    const rowOk = tableRow(root, '2026-07-05'); // ambas na mesma data; pega a 1ª (lucrativa)
    expect(rowOk).not.toBeNull();

    // Resumo financeiro (.kv)
    expect(kvCell(root, 'Custo total')!.classList.contains('pdf-debit')).toBe(true);
    expect(kvCell(root, 'Faturamento')!.classList.contains('pdf-credit')).toBe(true);
    const margem = kvCell(root, 'Margem média');
    expect(margem!.classList.contains('pdf-credit')).toBe(false);
    expect(margem!.classList.contains('pdf-debit')).toBe(false);

    // Toda coluna Custo (tbody) é débito; ao menos uma linha de Lucro é débito (prejuízo)
    const debitCells = Array.from(root.querySelectorAll('table.table tbody td.pdf-debit'));
    const creditCells = Array.from(root.querySelectorAll('table.table tbody td.pdf-credit'));
    expect(debitCells.length).toBeGreaterThanOrEqual(3); // 2 custos + 1 lucro negativo
    expect(creditCells.length).toBeGreaterThanOrEqual(1); // 1 lucro positivo

    // tfoot Total: Custo débito, Lucro por sinal
    const totalRow = tableRow(root, 'Total');
    expect(totalRow).not.toBeNull();
    expect(totalRow!.querySelector('.pdf-debit')).not.toBeNull();
  });

  it('8d. escape XSS: recipeName com <script> vira texto', () => {
    const root = renderFinanceiro([bake({ recipeName: '<script>alert(1)</script>' })]);
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('mountPrintButton (clique-só, §8)', () => {
  it('9. montar as views NÃO chama window.print; só o clique no botão', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderRecipe();
    renderCosts();
    renderFornadas([bake()]);
    renderFinanceiro([bake()]);
    expect(printSpy).not.toHaveBeenCalled();

    const actions = document.createElement('div');
    const btn = mountPrintButton(actions, undefined, 'Imprimir Receita');
    expect(btn.textContent).toBe('Imprimir Receita');
    expect(printSpy).not.toHaveBeenCalled();
    btn.click();
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
