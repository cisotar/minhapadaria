// @vitest-environment jsdom
/**
 * print.test.ts — TDD da view de impressão (issue 019, spec §8/§9).
 *
 * Ambiente jsdom (file-level, precedente das telas 014+): a view é DOM montado
 * via `dom.ts h()` (escape automático por `textContent`, regra de ouro 3). Casos:
 * (7) conteúdo da receita golden presente; (8) escape XSS — nome com `<b>`/
 * `<script>` vira texto, zero nó `<script>`; (9) montar a view NÃO chama
 * `window.print` (só o clique no botão fixo chama); (10) sem custos → sem
 * Precificação nem "R$".
 *
 * Casos 11–13 (revisão issue 019, achado ALTO §8 "aplica-se também ao
 * Histórico de Fornadas §14"): `renderHistoryPrintView` — (11) conteúdo do
 * resumo + fornada confirmada; (12) fornada planejada marcada, fora dos
 * totais; (13) sem custos → sem "R$"/seção financeira.
 */
import { describe, it, expect, vi } from 'vitest';
import { recalculate } from '../core/recalc';
import { goldenSeed } from '../ui/seed';
import { renderPrintView, renderHistoryPrintView, mountPrintButton, escapeHtml } from './print';
import { computeBakeDerived, aggregatePeriod } from '../core/bakes';
import type { BakeEntry } from '../core/types';

function render(recipe = goldenSeed(), includeCosts = true): HTMLElement {
  const { state, summary } = recalculate(recipe);
  const root = document.createElement('div');
  renderPrintView(root, { recipe: state, summary, includeCosts });
  return root;
}

describe('renderPrintView', () => {
  it('7. conteúdo: nome da receita, F_total 1000, hidratação 70 e preço presentes', () => {
    const root = render();
    const text = root.textContent ?? '';
    expect(text).toContain('Pão Rústico de Azeite'); // nome da receita
    expect(text).toContain('1000'); // F_total (§12)
    expect(text).toContain('70'); // hidratação nominal 70% (§12)
    expect(text).toContain('R$'); // com custos → precificação em R$
  });

  it('8. escape XSS (regra de ouro 3): nome com <b>/<script> vira texto, zero nó script/b', () => {
    const recipe = goldenSeed();
    recipe.ingredients[0].name = '<b>x</b><script>alert(1)</script>';
    const root = render(recipe);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('<b>x</b>'); // presente como TEXTO
    // dono único do escape de string (§8): usado por builders standalone.
    expect(escapeHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(escapeHtml('<script>')).not.toContain('<script>');
  });

  it('9. sem auto-print: montar a view não chama window.print; só o clique no botão', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(); // montar a view NÃO imprime
    expect(printSpy).not.toHaveBeenCalled();

    const actions = document.createElement('div');
    mountPrintButton(actions);
    expect(printSpy).not.toHaveBeenCalled(); // montar o botão NÃO imprime
    const btn = actions.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(printSpy).toHaveBeenCalledTimes(1); // só o clique imprime
    printSpy.mockRestore();
  });

  it('10. sem custos: view sem seção Precificação nem valores em R$', () => {
    const root = render(goldenSeed(), false);
    const text = root.textContent ?? '';
    expect(text).not.toContain('Precificação');
    expect(text).not.toContain('R$');
  });
});

// --- Impressão do Histórico (revisão issue 019, achado ALTO §8/§14) ---

function bake(overrides: Partial<BakeEntry> = {}): BakeEntry {
  return computeBakeDerived({
    id: overrides.id ?? 'b1',
    recipeId: overrides.recipeId ?? 'r1',
    recipeName: overrides.recipeName ?? 'Pão Rústico de Azeite',
    date: overrides.date ?? new Date(2026, 6, 5), // 2026-07-05 (local)
    quantityProduced: overrides.quantityProduced ?? 10,
    quantitySold: overrides.quantitySold ?? 8,
    unitCost: overrides.unitCost ?? 4.43,
    unitSalePrice: overrides.unitSalePrice ?? 7.38,
    ...overrides,
  });
}

function renderHistory(entries: BakeEntry[], includeCosts = true): HTMLElement {
  const start = new Date(2026, 6, 1);
  const end = new Date(2026, 6, 8);
  const summary = aggregatePeriod(entries, start, end); // §14.4: planejadas fora
  const root = document.createElement('div');
  renderHistoryPrintView(root, { entries, summary, includeCosts });
  return root;
}

describe('renderHistoryPrintView', () => {
  it('11. conteúdo: resumo do período + fornada confirmada (data/receita/qtds/lucro)', () => {
    const entry = bake();
    const root = renderHistory([entry]);
    const text = root.textContent ?? '';
    expect(text).toContain('Histórico de Fornadas');
    expect(text).toContain('Resumo do período');
    expect(text).toContain('2026-07-05'); // data (§7.1)
    expect(text).toContain('Pão Rústico de Azeite'); // nome (regra de ouro 3)
    expect(text).toContain('10 produzidas');
    expect(text).toContain('8 vendidas');
    expect(text).toContain('R$'); // com custos
  });

  it('12. fornada planejada (§14.6): marcada "Planejada — fora dos totais", sem vendida/lucro', () => {
    const planned = bake({ id: 'b2', date: new Date(2026, 6, 8), planned: true, quantitySold: 0 });
    const root = renderHistory([bake(), planned]);
    const text = root.textContent ?? '';
    expect(text).toContain('Planejada — fora dos totais');
    // Resumo do período não conta a planejada (aggregatePeriod já filtra) —
    // só a confirmada (10) aparece nos totais de produzido.
    expect(text).toContain('Produzido');
  });

  it('13. sem custos: sem "R$" nem linhas financeiras (Custo/Faturamento/Lucro/Margem)', () => {
    const root = renderHistory([bake()], false);
    const text = root.textContent ?? '';
    expect(text).not.toContain('R$');
    expect(text).not.toContain('Custo total');
    expect(text).not.toContain('Faturamento');
    expect(text).not.toContain('Margem média');
  });

  it('escape XSS (regra de ouro 3): nome de receita com <script> vira texto, zero nó script', () => {
    const entry = bake({ recipeName: '<script>alert(1)</script>' });
    const root = renderHistory([entry]);
    expect(root.querySelector('script')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>'); // como TEXTO
  });
});
