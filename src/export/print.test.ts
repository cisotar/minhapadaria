// @vitest-environment jsdom
/**
 * print.test.ts — TDD das views de impressão (issue 019 base, refactor issue
 * 028, refactor v2 issue 034, spec §8/§9/§14.5).
 *
 * Ambiente jsdom (file-level, precedente das telas 014+): as views são DOM
 * montado via `dom.ts h()` (escape automático por `textContent`, regra de ouro
 * 3).
 *
 * Refactor 034 (Plano Técnico — cards por seção, fermento reconstruído, coluna
 * Custo): `renderRecipePrintView`/`renderRecipeCostsPrintView` passam a montar
 * `.sec-card`/`table.rt` (mockups/pdf-receita-v2.html, mockups/pdf-custos-v2.html)
 * em vez de `<h2 class="pdf-section">` + `table.table`. `renderHistoryPrintView`/
 * `renderHistoryCostsPrintView` (Fornadas/Financeiro) NÃO mudam — casos 6/7/8c/8d
 * continuam usando `table.table`.
 *
 * Números do golden seed (recalculate(goldenSeed()), Isca=1, denom global 3;
 * issue 035: seed sem Azeite — o caso "2" abaixo injeta um `fat` local para
 * exercitar a categoria, sem afetar os demais números):
 * F 1.000g/100%, Água 700g/70%, Sal 20g/2%; fermento W_ferm=200g,
 * cada componente (Isca/Farinha/Água) = 66,7g, Proporção 1/1/1, Total 3/200,0g;
 * hidratação real 71,87%, Farinha Real Consumida 1.066,7g; custo Farinha R$8,00,
 * Sal R$0,06, Água R$0,00; fermento: Isca R$0,00, Farinha R$0,53,
 * Água R$0,00, Total de fermento R$0,53; custo total (fornada) R$8,59, custo/un
 * R$4,30, preço R$6,02, % de lucro 40,00%, lucro/un R$1,72, lucro fornada R$3,44 (markup, issue 041).
 * Rende (pricing.quantity) = 2.
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

/** Linha (`tr`) de `table.table` (Histórico) cujo primeiro `td` === texto. */
function tableRow(root: HTMLElement, firstCell: string): HTMLElement | null {
  for (const tr of Array.from(root.querySelectorAll('table.table tbody tr, table.table tfoot tr'))) {
    if (tr.querySelector('td')?.textContent === firstCell) return tr as HTMLElement;
  }
  return null;
}

/** Linha (`tr`) de `table.rt` (Receita/Custos v2) cujo PRIMEIRO texto (colspan=2) === texto. */
function rtRow(root: HTMLElement, firstCellText: string): HTMLElement | null {
  for (const tr of Array.from(root.querySelectorAll('table.rt tbody tr, table.rt tfoot tr'))) {
    if (tr.querySelector('td')?.textContent === firstCellText) return tr as HTMLElement;
  }
  return null;
}

/** `.sec-card` cujo `.sec-head` === título dado. */
function secCard(root: HTMLElement, title: string): HTMLElement | null {
  for (const card of Array.from(root.querySelectorAll('.sec-card'))) {
    if (card.querySelector('.sec-head')?.textContent === title) return card as HTMLElement;
  }
  return null;
}

describe('renderRecipePrintView (Receita v2 — cards por seção, zero $)', () => {
  it('1. existe uma .sec-card por categoria não-vazia; .sec-head na ordem correta', () => {
    const root = renderRecipe();
    const titles = Array.from(root.querySelectorAll('.sec-head')).map((el) => el.textContent);
    expect(titles).toEqual(['Farinhas', 'Líquidos', 'Sal e Extras', 'Fermento Natural', 'Hidratação']);
  });

  it('2. fat/extra caem em "Sal e Extras" (Azeite+Sal na mesma table.rt); sem seção "Gorduras"', () => {
    // issue 035: goldenSeed() não tem mais Azeite — fixture local com `fat`
    // para exercitar a categoria (não enfraquece a cobertura).
    const recipe = goldenSeed();
    recipe.ingredients.push({
      id: 'oil-1',
      name: 'Azeite',
      category: 'fat',
      weight: 0,
      percentage: 4,
      packageCost: { pricePaid: 80, packageSize: 1250, packageUnit: 'g' },
    });
    const root = renderRecipe(recipe); // recipe tem Azeite (fat) + Sal (salt)
    const titles = Array.from(root.querySelectorAll('.sec-head')).map((el) => el.textContent);
    expect(titles).not.toContain('Gorduras');
    const card = secCard(root, 'Sal e Extras');
    expect(card).not.toBeNull();
    const firstCells = Array.from(card!.querySelectorAll('table.rt tbody tr td:first-child')).map(
      (td) => td.textContent,
    );
    expect(firstCells).toContain('Sal');
    expect(firstCells).toContain('Azeite');
  });

  it('3. Fermento: linhas Isca/Farinha/Água (tbody) + Total de fermento (tfoot); Proporção presente; sem coluna %; múltiplas farinhas', () => {
    const root = renderRecipe();
    const card = secCard(root, 'Fermento Natural');
    expect(card).not.toBeNull();
    const table = card!.querySelector('table.rt')!;

    // Cabeçalho: "Proporção" presente, "%" ausente.
    const headTexts = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headTexts).toContain('Proporção');
    expect(headTexts).not.toContain('%');

    // Ordem das linhas: Isca, Farinha Branca, Água (tbody) + Total (tfoot).
    const bodyNames = Array.from(table.querySelectorAll('tbody tr td:first-child')).map((td) => td.textContent);
    expect(bodyNames).toEqual(['Isca', 'Farinha Branca', 'Água']);

    const iscaRow = rtRow(root, 'Isca');
    expect(iscaRow!.querySelectorAll('td.num')[0].textContent).toBe('1'); // proporção
    expect(iscaRow!.querySelectorAll('td.num')[1].textContent).toBe('66,7'); // peso

    const flourRow = rtRow(root, 'Farinha Branca');
    // (existe também Farinha Branca na seção Farinhas — pega a linha do fermento
    // pela tabela dentro do card correto)
    const flourRowsInFermento = Array.from(table.querySelectorAll('tbody tr')).find(
      (tr) => tr.querySelector('td')?.textContent === 'Farinha Branca',
    );
    expect(flourRowsInFermento).toBeDefined();
    expect(flourRowsInFermento!.querySelectorAll('td.num')[0].textContent).toBe('1');
    expect(flourRowsInFermento!.querySelectorAll('td.num')[1].textContent).toBe('66,7');
    void flourRow;

    const waterRow = Array.from(table.querySelectorAll('tbody tr')).find(
      (tr) => tr.querySelector('td')?.textContent === 'Água',
    );
    expect(waterRow!.querySelectorAll('td.num')[0].textContent).toBe('1');
    expect(waterRow!.querySelectorAll('td.num')[1].textContent).toBe('66,7');

    const footRow = table.querySelector('tfoot tr')!;
    expect(footRow.querySelector('td')?.textContent).toBe('Total de fermento');
    expect(footRow.querySelectorAll('td.num')[0].textContent).toBe('3');
    expect(footRow.querySelectorAll('td.num')[1].textContent).toBe('200,0');
  });

  it('3b. múltiplas farinhas do fermento renderizam 2+ linhas próprias', () => {
    const recipe = goldenSeed();
    recipe.sourdough.flours.push({
      flourId: 'flour-2',
      name: 'Farinha Integral',
      proportion: 1,
      packageCost: { pricePaid: 10, packageSize: 1, packageUnit: 'kg' },
      weight: 0,
    });
    const root = renderRecipe(recipe);
    const card = secCard(root, 'Fermento Natural')!;
    const bodyNames = Array.from(card.querySelectorAll('table.rt tbody tr td:first-child')).map(
      (td) => td.textContent,
    );
    expect(bodyNames).toEqual(['Isca', 'Farinha Branca', 'Farinha Integral', 'Água']);
  });

  it('4. alinhamento: toda table.rt (Receita) tem o mesmo colgroup (c-name span=2, c-pct, c-wt)', () => {
    const root = renderRecipe();
    const tables = Array.from(root.querySelectorAll('table.rt'));
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
      expect(cols.map((c) => c.className)).toEqual(['c-name', 'c-pct', 'c-wt']);
      expect(cols[0].getAttribute('span')).toBe('2');
    }
  });

  it('5. Rende: badge .pdf-yield contém pricing.quantity (=2) no cabeçalho', () => {
    const root = renderRecipe();
    const badge = root.querySelector('.pdf-yield');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('2');
  });

  it('conteúdo golden e ZERO "R$" (Receita nunca mostra dinheiro)', () => {
    const root = renderRecipe();
    const text = root.textContent ?? '';
    expect(text).toContain('Pão Rústico');
    expect(text).toContain('1.000,0'); // F_total (Farinhas)
    expect(text).toContain('700,0'); // água
    expect(text).toContain('71,87'); // hidratação real (seed Isca=1)
    expect(text).toContain('1.066,7'); // Farinha Real Consumida
    expect(text).not.toContain('R$');
  });

  it('11a. escape XSS: nome de ingrediente/farinha do fermento com <b>/<script> vira texto, zero nó', () => {
    const recipe = goldenSeed();
    recipe.ingredients[0].name = '<b>x</b><script>alert(1)</script>';
    recipe.sourdough.flours[0].name = '<img src=x onerror=alert(2)>';
    const root = renderRecipe(recipe);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<b>x</b>');
    expect(root.textContent).toContain('<img src=x onerror=alert(2)>');
  });
});

describe('renderRecipeCostsPrintView (Custos v2 — coluna Custo, Custo Total, Precificação)', () => {
  it('5b. Rende: badge .pdf-yield contém pricing.quantity (=2) no cabeçalho dos Custos', () => {
    const root = renderCosts();
    const badge = root.querySelector('.pdf-yield');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('2');
  });

  it('4b. alinhamento (Custos): colgroup c-name/c-pct/c-wt/c-cost em toda table.rt', () => {
    const root = renderCosts();
    const tables = Array.from(root.querySelectorAll('table.rt'));
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
      expect(cols.map((c) => c.className)).toEqual(['c-name', 'c-pct', 'c-wt', 'c-cost']);
    }
  });

  it('6. coluna Custo à direita em cada seção; isca R$ 0,00; tfoot Total Farinhas/Total de fermento', () => {
    const root = renderCosts();

    // Farinhas: linha + tfoot.
    const flourRow = rtRow(root, 'Farinha Branca');
    expect(flourRow!.querySelector('.pdf-debit')?.textContent).toBe('R$ 8,00');
    const flourFoot = Array.from(root.querySelectorAll('table.rt tfoot tr')).find(
      (tr) => tr.querySelector('td')?.textContent === 'Total Farinhas',
    )!;
    expect(flourFoot.querySelector('.pdf-debit')?.textContent).toBe('R$ 8,00');

    // Isca — custo sempre R$ 0,00 (§2.B.2).
    const iscaRow = rtRow(root, 'Isca');
    expect(iscaRow!.querySelector('.pdf-debit')?.textContent).toBe('R$ 0,00');

    // Fermento tfoot.
    const fermentoFoot = Array.from(root.querySelectorAll('table.rt tfoot tr')).find(
      (tr) => tr.querySelector('td')?.textContent === 'Total de fermento',
    )!;
    expect(fermentoFoot.querySelector('.pdf-debit')?.textContent).toBe('R$ 0,53');
  });

  it('7. Custo Total: fornada (2 pães) = R$ 8,59; um pão = R$ 4,30 (débito)', () => {
    const root = renderCosts();
    const fornada = kvCell(root, 'Custo da fornada (2 pães)');
    expect(fornada!.textContent).toBe('R$ 8,59');
    expect(fornada!.classList.contains('pdf-debit')).toBe(true);
    const umPao = kvCell(root, 'Custo de um pão');
    expect(umPao!.textContent).toBe('R$ 4,30');
    expect(umPao!.classList.contains('pdf-debit')).toBe(true);
  });

  it('8. null≠0: costPerUnit=null → "Custo de um pão" = "—", sem cor, sem "R$"', () => {
    const root = renderCosts(goldenSeed(), (s) => {
      s.costPerUnit = null;
    });
    const cell = kvCell(root, 'Custo de um pão');
    expect(cell!.textContent).toBe('—');
    expect(cell!.textContent).not.toContain('R$');
    expect(cell!.classList.contains('pdf-debit')).toBe(false);
    expect(cell!.classList.contains('pdf-credit')).toBe(false);
  });

  it('9. Precificação após Custo Total: Preço/Lucros crédito (feliz), Margem neutra, sem alerta', () => {
    const root = renderCosts();
    const preco = kvCell(root, 'Preço de venda (un.)');
    expect(preco!.textContent).toBe('R$ 6,02'); // markup 40%: 4,30 × 1,40 (issue 041)
    expect(preco!.classList.contains('pdf-credit')).toBe(true);

    const margem = kvCell(root, 'Margem de lucro');
    expect(margem!.textContent).toBe('40,00%');
    expect(margem!.classList.contains('pdf-credit')).toBe(false);
    expect(margem!.classList.contains('pdf-debit')).toBe(false);

    const lucroPao = kvCell(root, 'Lucro por pão');
    expect(lucroPao!.textContent).toBe('R$ 1,72'); // 4,30 × 0,40 (issue 041)
    expect(lucroPao!.classList.contains('pdf-credit')).toBe(true);

    const lucroFornada = kvCell(root, 'Lucro da fornada');
    expect(lucroFornada!.textContent).toBe('R$ 3,44'); // markup 40%: lucro/un 1,718 × 2 (issue 041)
    expect(lucroFornada!.classList.contains('pdf-credit')).toBe(true);

    expect(root.querySelector('.pdf-alert')).toBeNull();

    // ordem: Custo Total antes de Precificação.
    const cardTitles = Array.from(root.querySelectorAll('.sec-head')).map((el) => el.textContent);
    expect(cardTitles.indexOf('Custo Total')).toBeLessThan(cardTitles.indexOf('Precificação'));
    expect(cardTitles).not.toContain('Hidratação'); // Custo Total substitui Hidratação
  });

  it('10. prejuízo (isLoss): Lucro por pão/fornada em débito; alerta; Preço segue crédito', () => {
    const root = renderCosts(goldenSeed(), (s) => {
      s.salePrice = 1; // < custo/un (5,58) → isLoss
      s.costPerUnit = 5.58;
      s.profitPerUnit = -4.58;
      s.totalProfit = -9.16;
    });
    const lucroPao = kvCell(root, 'Lucro por pão');
    expect(lucroPao!.classList.contains('pdf-debit')).toBe(true);
    expect(lucroPao!.classList.contains('pdf-credit')).toBe(false);

    const lucroFornada = kvCell(root, 'Lucro da fornada');
    expect(lucroFornada!.classList.contains('pdf-debit')).toBe(true);

    const alert = root.querySelector('.pdf-alert');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('PREJUÍZO');

    expect(kvCell(root, 'Preço de venda (un.)')!.classList.contains('pdf-credit')).toBe(true);
  });

  it('11b. escape XSS: nome de ingrediente/farinha do fermento vira texto, zero nó', () => {
    const recipe = goldenSeed();
    recipe.ingredients[0].name = '<b>x</b><script>alert(1)</script>';
    recipe.sourdough.flours[0].name = '<img src=x onerror=alert(2)>';
    const root = renderCosts(recipe);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<b>x</b>');
    expect(root.textContent).toContain('<img src=x onerror=alert(2)>');
  });
});

// --- Histórico (NÃO tocado pela issue 034 — testes intactos) ---

function bake(overrides: Partial<BakeEntry> = {}): BakeEntry {
  return computeBakeDerived({
    id: overrides.id ?? 'b1',
    recipeId: overrides.recipeId ?? 'r1',
    recipeName: overrides.recipeName ?? 'Pão Rústico',
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

describe('renderHistoryPrintView (Fornadas — zero $, estilo v2)', () => {
  it('6. produção, ZERO "R$", planejada em tr.pdf-muted-row', () => {
    const confirmada = bake();
    const planejada = bake({ id: 'b2', date: new Date(2026, 6, 6), planned: true, quantitySold: 0 });
    const root = renderFornadas([confirmada, planejada]);
    const text = root.textContent ?? '';
    expect(text).toContain('Histórico de Fornadas');
    expect(text).toContain('Produzido');
    expect(text).toContain('2026-07-05'); // data (§7.1)
    expect(text).toContain('Pão Rústico');
    expect(text).not.toContain('R$');
    const plannedRow = root.querySelector('tr.pdf-muted-row');
    expect(plannedRow).not.toBeNull();
    expect(plannedRow!.textContent).toContain('Planejada');
  });

  it('6b. invólucro v2: .pdf-head (h1 "Histórico de Fornadas") + badge .pdf-yield "2 fornadas" (entries.length)', () => {
    const confirmada = bake();
    const planejada = bake({ id: 'b2', date: new Date(2026, 6, 6), planned: true, quantitySold: 0 });
    const root = renderFornadas([confirmada, planejada]);
    const head = root.querySelector('.pdf-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('h1')?.textContent).toBe('Histórico de Fornadas');
    const badge = root.querySelector('.pdf-yield');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('2'); // entries.length (confirmada + planejada)
    expect(badge!.textContent).toContain('fornadas');
  });

  it('6c. seções em .sec-card (Resumo do período / Fornadas); sem h2.pdf-section; rodapé "Página 1/1"', () => {
    const root = renderFornadas([bake()]);
    expect(secCard(root, 'Resumo do período')).not.toBeNull();
    expect(secCard(root, 'Fornadas')).not.toBeNull();
    expect(root.querySelector('h2.pdf-section')).toBeNull();
    expect(root.querySelector('.pdf-footer')?.textContent).toBe('Página 1/1');
  });

  it('8c. escape XSS: recipeName com <script> vira texto', () => {
    const root = renderFornadas([bake({ recipeName: '<script>alert(1)</script>' })]);
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('renderHistoryCostsPrintView (Financeiro — sempre $, estilo v2)', () => {
  it('7. Custo .pdf-debit, Lucro colorido por sinal; Margem média neutra', () => {
    const lucrativa = bake({ id: 'b1', unitCost: 4, unitSalePrice: 7, quantityProduced: 10, quantitySold: 10 });
    const prejuizo = bake({ id: 'b2', unitCost: 10, unitSalePrice: 2, quantityProduced: 10, quantitySold: 10 });
    const root = renderFinanceiro([lucrativa, prejuizo]);
    expect(root.textContent).toContain('R$');

    const rowOk = tableRow(root, '2026-07-05');
    expect(rowOk).not.toBeNull();

    expect(kvCell(root, 'Custo total')!.classList.contains('pdf-debit')).toBe(true);
    expect(kvCell(root, 'Faturamento')!.classList.contains('pdf-credit')).toBe(true);
    const margem = kvCell(root, 'Margem média');
    expect(margem!.classList.contains('pdf-credit')).toBe(false);
    expect(margem!.classList.contains('pdf-debit')).toBe(false);

    const debitCells = Array.from(root.querySelectorAll('table.table tbody td.pdf-debit'));
    const creditCells = Array.from(root.querySelectorAll('table.table tbody td.pdf-credit'));
    expect(debitCells.length).toBeGreaterThanOrEqual(3);
    expect(creditCells.length).toBeGreaterThanOrEqual(1);

    const totalRow = tableRow(root, 'Total');
    expect(totalRow).not.toBeNull();
    expect(totalRow!.querySelector('.pdf-debit')).not.toBeNull();
  });

  it('7b. invólucro v2: .pdf-head + badge .pdf-yield conta só confirmadas (§14.4); planejada fora', () => {
    const lucrativa = bake({ id: 'b1', unitCost: 4, unitSalePrice: 7, quantityProduced: 10, quantitySold: 10 });
    const prejuizo = bake({ id: 'b2', unitCost: 10, unitSalePrice: 2, quantityProduced: 10, quantitySold: 10 });
    const planejada = bake({ id: 'b3', date: new Date(2026, 6, 7), planned: true, quantitySold: 0 });
    const root = renderFinanceiro([lucrativa, prejuizo, planejada]);
    const head = root.querySelector('.pdf-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('h1')?.textContent).toBe('Financeiro — Histórico de Fornadas');
    const badge = root.querySelector('.pdf-yield');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain('2'); // só confirmadas (planejada fora, §14.4)
    expect(badge!.textContent).toContain('fornadas');
  });

  it('7c. seções em .sec-card (Resumo financeiro / Fornadas); sem h2.pdf-section; rodapé "Página 1/1"', () => {
    const root = renderFinanceiro([bake()]);
    expect(secCard(root, 'Resumo financeiro')).not.toBeNull();
    expect(secCard(root, 'Fornadas')).not.toBeNull();
    expect(root.querySelector('h2.pdf-section')).toBeNull();
    expect(root.querySelector('.pdf-footer')?.textContent).toBe('Página 1/1');
  });

  it('8d. escape XSS: recipeName com <script> vira texto', () => {
    const root = renderFinanceiro([bake({ recipeName: '<script>alert(1)</script>' })]);
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
  });

  // --- issue 049: Margem (F/C) ---

  it('049-8. coluna "Margem (F/C %)" na listagem, à direita de "Lucro"; célula neutra com "%"', () => {
    const lucrativa = bake({ id: 'b1', unitCost: 4.43, unitSalePrice: 7.38, quantityProduced: 2, quantitySold: 2 });
    const root = renderFinanceiro([lucrativa]);
    const headTexts = Array.from(root.querySelectorAll('table.table thead th')).map((th) => th.textContent);
    const iMargem = headTexts.indexOf('Margem (F/C %)');
    const iLucro = headTexts.indexOf('Lucro');
    expect(iMargem).toBeGreaterThan(-1);
    expect(iMargem).toBe(iLucro + 1);

    // Célula da fornada = bakeStatus(14.76, 8.86) = 166,59% (neutra).
    const rowOk = tableRow(root, '2026-07-05');
    const cells = rowOk!.querySelectorAll('td');
    const margemCell = cells[cells.length - 1] as HTMLElement;
    expect(margemCell.textContent).toBe('166,59%');
    expect(margemCell.classList.contains('pdf-credit')).toBe(false);
    expect(margemCell.classList.contains('pdf-debit')).toBe(false);
  });

  it('049-9. tfoot Total: Margem agregada ΣF/ΣC, neutra', () => {
    const a = bake({ id: 'b1', unitCost: 4.43, unitSalePrice: 7.38, quantityProduced: 2, quantitySold: 2 });
    const b = bake({ id: 'b2', date: new Date(2026, 6, 6), unitCost: 3, unitSalePrice: 6, quantityProduced: 10, quantitySold: 8 });
    const root = renderFinanceiro([a, b]);
    const totalRow = tableRow(root, 'Total');
    const cells = totalRow!.querySelectorAll('td');
    const margemCell = cells[cells.length - 1] as HTMLElement;
    // ΣF=62,76 / ΣC=38,86 → 161,50%.
    expect(margemCell.textContent).toBe('161,50%');
    expect(margemCell.classList.contains('pdf-credit')).toBe(false);
    expect(margemCell.classList.contains('pdf-debit')).toBe(false);
  });

  it('049-10. card "Resumo financeiro": linha "Margem (F/C)" = mesmo valor do tfoot; "Margem média" distinta', () => {
    const a = bake({ id: 'b1', unitCost: 4.43, unitSalePrice: 7.38, quantityProduced: 2, quantitySold: 2 });
    const b = bake({ id: 'b2', date: new Date(2026, 6, 6), unitCost: 3, unitSalePrice: 6, quantityProduced: 10, quantitySold: 8 });
    const root = renderFinanceiro([a, b]);
    const cardCell = kvCell(root, 'Margem (F/C)');
    expect(cardCell).not.toBeNull();
    expect(cardCell!.textContent).toBe('161,50%'); // mesmo valor do tfoot (049-9)
    expect(cardCell!.classList.contains('pdf-credit')).toBe(false);
    expect(cardCell!.classList.contains('pdf-debit')).toBe(false);
    // "Margem média" continua presente e distinta.
    expect(kvCell(root, 'Margem média')).not.toBeNull();
  });

  it('049-11. ΣC≤0 → "—" no tfoot E no card "Margem (F/C)"', () => {
    // só fornadas com unitCost 0 → ΣC=0 → bakeStatus(F,0)=null.
    const z1 = bake({ id: 'b1', unitCost: 0, unitSalePrice: 5, quantityProduced: 4, quantitySold: 4 });
    const root = renderFinanceiro([z1]);
    const totalRow = tableRow(root, 'Total');
    const totalCells = totalRow!.querySelectorAll('td');
    expect((totalCells[totalCells.length - 1] as HTMLElement).textContent).toBe('—');
    expect(kvCell(root, 'Margem (F/C)')!.textContent).toBe('—');
    // §3 caso 2: a própria linha do corpo (C=0 → bakeStatus null) também mostra "—".
    const bodyRow = tableRow(root, '2026-07-05');
    const bodyCells = bodyRow!.querySelectorAll('td');
    expect((bodyCells[bodyCells.length - 1] as HTMLElement).textContent).toBe('—');
  });

  it('049-12. planejada segue pulada na listagem financeira', () => {
    const confirmada = bake({ id: 'b1', unitCost: 4, unitSalePrice: 7, quantityProduced: 10, quantitySold: 10 });
    const planejada = bake({ id: 'b2', date: new Date(2026, 6, 7), planned: true, quantitySold: 0 });
    const root = renderFinanceiro([confirmada, planejada]);
    const bodyRows = Array.from(root.querySelectorAll('table.table tbody tr'));
    expect(bodyRows.length).toBe(1); // só a confirmada
  });

  it('049-13. PDF Fornadas sem custos (renderHistoryPrintView): sem "Margem"', () => {
    const root = renderFornadas([bake()]);
    expect(root.textContent).not.toContain('Margem');
  });

  it('049-14. §3 caso 1: confirmada Vendas=0 (F=0, C>0) → célula Margem do corpo = "0,00%" (0≠null, nunca "—"), neutra', () => {
    // bakeStatus(0, C>0) = 0 (não null): F=0 é resultado real, não impossível.
    const semVenda = bake({ id: 'b1', unitCost: 5, unitSalePrice: 5, quantityProduced: 5, quantitySold: 0 });
    const root = renderFinanceiro([semVenda]);
    const rowOk = tableRow(root, '2026-07-05');
    expect(rowOk).not.toBeNull();
    const cells = rowOk!.querySelectorAll('td');
    const margemCell = cells[cells.length - 1] as HTMLElement;
    expect(margemCell.textContent).toBe('0,00%');
    expect(margemCell.classList.contains('pdf-credit')).toBe(false);
    expect(margemCell.classList.contains('pdf-debit')).toBe(false);
  });
});

describe('mountPrintButton (clique-só, §8, intocado)', () => {
  it('12. montar as views NÃO chama window.print; só o clique no botão', () => {
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
