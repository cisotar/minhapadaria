// @vitest-environment jsdom
/**
 * historyView.test.ts — Testes jsdom do dashboard de Fornadas (issues 018/028,
 * spec §14.4/§14.5/§14.6/§14.7). Casos do Plano Técnico das issues. Issue 028
 * adiciona caso 12: gate do botão "Imprimir Financeiro" pela pref showCosts.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createRecipeStore, type RecipeStore } from '../storage/recipes';
import { createBakeStore, type BakeStore } from '../storage/bakes';
import { createPrefsStore } from '../storage/prefs';
import { goldenSeed } from './seed';
import { renderHistoryView } from './historyView';
import { formatCurrency, formatPercent } from '../core/format';
import type { Recipe, BakeEntry } from '../core/types';

function goldenSeedNoFat(name: string): Recipe {
  const recipe = goldenSeed();
  recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'fat');
  recipe.name = name;
  return recipe;
}

function idGen(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

function fixedNow(iso: string): () => Date {
  return () => new Date(iso);
}

interface MountOpts {
  now?: () => Date;
  confirm?: (message: string) => boolean;
  headerRoot?: HTMLElement;
  prefs?: ReturnType<typeof createPrefsStore>;
}

function mount(opts: MountOpts = {}) {
  const root = document.createElement('div');
  const storage = createMemoryStorage();
  const recipeStore: RecipeStore = createRecipeStore({ storage, newId: idGen('r') });
  const bakeStore: BakeStore = createBakeStore({ storage, newId: idGen('b') });
  return { root, storage, recipeStore, bakeStore, opts };
}

function render(m: ReturnType<typeof mount>) {
  renderHistoryView(m.root, {
    recipeStore: m.recipeStore,
    bakeStore: m.bakeStore,
    now: m.opts.now ?? fixedNow('2026-07-05T00:00:00'),
    confirm: m.opts.confirm,
    headerRoot: m.opts.headerRoot,
    prefs: m.opts.prefs,
  });
}

function bake(bakeStore: BakeStore, overrides: Partial<BakeEntry>): BakeEntry {
  return bakeStore.create({
    recipeId: overrides.recipeId ?? 'r-1',
    recipeName: overrides.recipeName ?? 'Pão',
    date: overrides.date ?? new Date(2026, 6, 3),
    quantityProduced: overrides.quantityProduced ?? 10,
    quantitySold: overrides.quantitySold ?? 8,
    unitCost: overrides.unitCost ?? 4,
    unitSalePrice: overrides.unitSalePrice ?? 7,
    ...overrides,
  });
}

function kpiValue(root: HTMLElement, label: string): HTMLElement {
  const tiles = Array.from(root.querySelectorAll('.kpi-tile'));
  const tile = tiles.find((t) => t.querySelector('.label')?.textContent === label)!;
  return tile.querySelector('.value') as HTMLElement;
}

function setDateInput(root: HTMLElement, ariaLabel: string, value: string): void {
  const input = root.querySelector(`input[aria-label="${ariaLabel}"]`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// issue 045: a página ganhou uma 2ª `table` (BALANÇO, `aria-label="Balanço por
// fornada"`) depois da tabela editável "Fornadas registradas". `table tbody tr`
// sem escopo passaria a casar linhas das DUAS tabelas — este helper mantém as
// asserções das suítes 018/044 apontando só para a 1ª `table` (a editável),
// preservando `querySelector('table')` = editável (Plano Técnico da 045).
function editableRows(root: HTMLElement): NodeListOf<HTMLTableRowElement> {
  return root.querySelector('table')!.querySelectorAll('tbody tr');
}

// issue 045: tabela BALANÇO, localizada pelo `aria-label` (hook de teste — não
// é a 1ª `table` da página, que é a editável "Fornadas registradas").
function balanceTable(root: HTMLElement): HTMLTableElement {
  return root.querySelector('table[aria-label="Balanço por fornada"]') as HTMLTableElement;
}

describe('historyView (jsdom) — §14.4/§14.5/§14.6/§14.7', () => {
  it('1. filtro por receita restringe tabela e KPIs', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    const r2 = m.recipeStore.create(goldenSeedNoFat('Pão de Centeio'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8 });
    bake(m.bakeStore, { recipeId: r2.id, recipeName: r2.name, date: new Date(2026, 6, 3), quantityProduced: 5, quantitySold: 5 });
    render(m);

    expect(kpiValue(m.root, 'Produzido').textContent).toContain('15 pães');

    const select = m.root.querySelector('select[aria-label="Filtrar por receita"]') as HTMLSelectElement;
    select.value = r1.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(kpiValue(m.root, 'Produzido').textContent).toContain('10 pães');
    const rows = editableRows(m.root);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Pão Rústico');
  });

  it('2. filtro de intervalo De/Até (parseLocalDate) é inclusivo nas bordas', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 5, 20), quantityProduced: 3, quantitySold: 3 }); // fora do padrão
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8 }); // dentro
    render(m);

    expect(kpiValue(m.root, 'Produzido').textContent).toContain('10 pães');

    setDateInput(m.root, 'De', '2026-06-01');
    expect(kpiValue(m.root, 'Produzido').textContent).toContain('13 pães');
  });

  it('3. toggle Dia/Semana/Mês alimenta gráfico e melhor/pior', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1), quantityProduced: 10, quantitySold: 8 });
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 12, quantitySold: 12 });
    render(m);

    const dotsPerDay = m.root.querySelectorAll('.dot-revenue').length;
    expect(dotsPerDay).toBe(2); // 2 dias distintos
    expect(m.root.querySelector('.best-worst .best .label')!.textContent).toContain('dia');

    const weekBtn = Array.from(m.root.querySelectorAll('.period-toggle button')).find((b) => b.textContent === 'Semana') as HTMLButtonElement;
    weekBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const dotsPerWeek = m.root.querySelectorAll('.dot-revenue').length;
    expect(dotsPerWeek).toBe(1); // mesma semana
    expect(m.root.querySelector('.best-worst .best .label')!.textContent).toContain('semana');
  });

  it('4. KPIs excluem fornada planejada (§14.4/§14.6)', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8 });
    bake(m.bakeStore, {
      recipeId: r1.id,
      recipeName: r1.name,
      date: new Date(2026, 6, 4),
      quantityProduced: 999,
      quantitySold: 999,
      planned: true,
    });
    render(m);

    expect(kpiValue(m.root, 'Produzido').textContent).toContain('10 pães');
    // mas a planejada continua visível na tabela (§14.6)
    expect(m.root.querySelector('table .badge-planned')).not.toBeNull();
  });

  it('5. comparação com período anterior: variação renderizada; anterior vazio → "—"', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    // período atual (dentro do padrão 06-29..07-05)
    bake(m.bakeStore, {
      recipeId: r1.id,
      recipeName: r1.name,
      date: new Date(2026, 6, 3),
      quantityProduced: 10,
      quantitySold: 10,
      unitCost: 4,
      unitSalePrice: 10,
    });
    render(m);
    // sem fornada no período anterior → "—" (espaço à frente — não cola no
    // valor, mesmo padrão do ramo ↑/↓, bug relatado 2026-07-06)
    const revenueDeltaEmpty = kpiValue(m.root, 'Faturamento').querySelector('.delta')!;
    expect(revenueDeltaEmpty.textContent).toBe(' —');

    // adiciona fornada na janela anterior EXATA (mesma largura de 7 dias,
    // imediatamente antes de "De" 2026-06-29 → janela 2026-06-22–2026-06-28)
    // com faturamento menor.
    bake(m.bakeStore, {
      recipeId: r1.id,
      recipeName: r1.name,
      date: new Date(2026, 5, 25),
      quantityProduced: 5,
      quantitySold: 5,
      unitCost: 4,
      unitSalePrice: 8,
    });
    setDateInput(m.root, 'De', '2026-06-29'); // dispara re-render (mesmo valor, força recompute via change)
    const revenueDelta = kpiValue(m.root, 'Faturamento').querySelector('.delta')!;
    expect(revenueDelta.textContent).toMatch(/↑/);
    expect(revenueDelta.classList.contains('up')).toBe(true);
  });

  it('6. melhor/pior por lucro; 0 fornadas → ocultos', () => {
    const m = mount();
    render(m);
    expect((m.root.querySelector('.best-worst') as HTMLElement).classList.contains('hidden')).toBe(true); // `.hidden` (issue 022)

    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1), quantityProduced: 10, quantitySold: 8, unitCost: 4, unitSalePrice: 10 });
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 2, unitCost: 4, unitSalePrice: 5 });
    setDateInput(m.root, 'De', '2026-06-29');

    expect((m.root.querySelector('.best-worst') as HTMLElement).classList.contains('hidden')).toBe(false);
    expect(m.root.querySelector('.best-worst .best .value')!.textContent).toMatch(/Lucro/);
    expect(m.root.querySelector('.best-worst .worst .value')!.textContent).toMatch(/Lucro/);
  });

  it('7. tabela ordena recentes-primeiro; fornada órfã exibe badge "Receita excluída"', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1) });
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3) });
    bake(m.bakeStore, { recipeId: 'ghost-id', recipeName: 'Receita Fantasma', date: new Date(2026, 6, 2) }); // órfã
    render(m);

    const rows = editableRows(m.root);
    const dates = Array.from(rows).map((r) => r.querySelector('td')!.textContent);
    expect(dates).toEqual(['2026-07-03', '2026-07-02', '2026-07-01']); // recentes primeiro

    const orphanRow = Array.from(rows).find((r) => r.textContent!.includes('Receita Fantasma'))!;
    expect(orphanRow.querySelector('.chip-warn')!.textContent).toBe('Receita excluída');
  });

  it('8. excluir fornada: confirm true → bakeStore.remove chamado; confirm false → não remove', () => {
    const m1 = mount({ confirm: () => true });
    const r1 = m1.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m1.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3) });
    render(m1);
    const removeSpy = vi.spyOn(m1.bakeStore, 'remove');
    const deleteBtn = Array.from(m1.root.querySelectorAll('button')).find((b) => b.textContent === 'Excluir') as HTMLButtonElement;
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(editableRows(m1.root)).toHaveLength(0);

    const m2 = mount({ confirm: () => false });
    const r2 = m2.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m2.bakeStore, { recipeId: r2.id, recipeName: r2.name, date: new Date(2026, 6, 3) });
    render(m2);
    const removeSpy2 = vi.spyOn(m2.bakeStore, 'remove');
    const deleteBtn2 = Array.from(m2.root.querySelectorAll('button')).find((b) => b.textContent === 'Excluir') as HTMLButtonElement;
    deleteBtn2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(removeSpy2).not.toHaveBeenCalled();
    expect(editableRows(m2.root)).toHaveLength(1);
  });

  it('9. confirmar planejada: confirmPlanned + bakeStore.update; passa a contar nos KPIs', () => {
    const m = mount();
    const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8, planned: true });
    render(m);

    expect(kpiValue(m.root, 'Produzido').textContent).toContain('0 pães');
    const updateSpy = vi.spyOn(m.bakeStore, 'update');
    const confirmBtn = Array.from(m.root.querySelectorAll('button')).find((b) => b.textContent === 'Confirmar') as HTMLButtonElement;
    confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(m.bakeStore.list()[0].planned).toBeUndefined();
    expect(kpiValue(m.root, 'Produzido').textContent).toContain('10 pães');
    expect(m.root.querySelector('table .badge-planned')).toBeNull(); // badge do bakeForm (oculto) não conta
  });

  it('10. XSS: recipeName/notes órfãos com <script> nunca viram nó <script> (textContent)', () => {
    const m = mount();
    bake(m.bakeStore, {
      recipeId: 'ghost',
      recipeName: '<script>alert(1)</script>',
      date: new Date(2026, 6, 3),
      notes: '<img src=x onerror="x">',
    });
    render(m);
    expect(m.root.querySelector('script')).toBeNull();
    expect(m.root.querySelector('img')).toBeNull();
    const rows = editableRows(m.root);
    expect(rows[0].textContent).toContain('<script>alert(1)</script>');
  });

  it('11. subtítulo dinâmico (issue 026 item 3): montado em headerRoot, acompanha o filtro De/Até', () => {
    const headerRoot = document.createElement('div');
    const m = mount({ headerRoot });
    render(m);

    // Padrão default (últimos 7 dias, "hoje" fixo = 2026-07-05).
    const subtitle = headerRoot.querySelector('.subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toBe('2026-06-29 – 2026-07-05');
    expect(m.root.querySelector('.subtitle')).toBeNull(); // não duplica dentro de root

    setDateInput(m.root, 'De', '2026-06-01');
    setDateInput(m.root, 'Até', '2026-06-10');
    expect(subtitle!.textContent).toBe('2026-06-01 – 2026-06-10');
  });

  it('12. gate do botão "Imprimir Financeiro" pela pref showCosts (issue 028)', () => {
    const findFin = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Imprimir Financeiro') as
        | HTMLButtonElement
        | undefined;

    // showCosts = false → botão de custos oculto (`.hidden`)
    const off = mount({ prefs: createPrefsStore({ storage: createMemoryStorage() }) });
    off.opts.prefs!.setShowCosts(false);
    render(off);
    const finOff = findFin(off.root);
    expect(finOff).toBeDefined();
    expect(finOff!.classList.contains('hidden')).toBe(true);
    // botão de Fornadas (sem custo) sempre presente e visível
    const fornadasBtn = Array.from(off.root.querySelectorAll('button')).find((b) => b.textContent === 'Imprimir Fornadas') as HTMLButtonElement;
    expect(fornadasBtn.classList.contains('hidden')).toBe(false);

    // showCosts = true → botão de custos visível
    const on = mount({ prefs: createPrefsStore({ storage: createMemoryStorage() }) });
    on.opts.prefs!.setShowCosts(true);
    render(on);
    const finOn = findFin(on.root);
    expect(finOn).toBeDefined();
    expect(finOn!.classList.contains('hidden')).toBe(false);
  });

  // --- BALANÇO (issue 045, spec `specs/aba-balanco.md` §2) ---
  describe('BALANÇO (§2) — tabela nova, só-leitura, dentro do Histórico', () => {
    it('13. thead com as 10 colunas da §2.1, na ordem, via aria-label da tabela', () => {
      const m = mount();
      render(m);
      const table = balanceTable(m.root);
      expect(table).not.toBeNull();
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent);
      expect(headers).toEqual([
        'Data',
        'Receita',
        'Produção',
        'Custo unitário',
        'Custo (C)',
        'Vendas',
        'Preço unitário',
        'Faturamento (F)',
        'Saldo',
        'Status',
      ]);
    });

    it('14. linha confirmada: Status = F/C×100 (2 casas); Saldo≥0 neutro; Status sem classe de cor', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      // Produção 10 × Custo unit. 4 → C=40; Vendas 8 × Preço unit. 7 → F=56; Saldo=+16; Status=140%.
      bake(m.bakeStore, {
        recipeId: r1.id,
        recipeName: r1.name,
        date: new Date(2026, 6, 3),
        quantityProduced: 10,
        quantitySold: 8,
        unitCost: 4,
        unitSalePrice: 7,
      });
      render(m);

      const row = balanceTable(m.root).querySelector('tbody tr')!;
      const cells = Array.from(row.querySelectorAll('td'));
      expect(cells[2].textContent).toBe('10'); // Produção
      expect(cells[3].textContent).toBe(formatCurrency(4)); // Custo unitário
      expect(cells[4].textContent).toBe(formatCurrency(40)); // Custo (C)
      expect(cells[5].textContent).toBe('8'); // Vendas
      expect(cells[6].textContent).toBe(formatCurrency(7)); // Preço unitário
      expect(cells[7].textContent).toBe(formatCurrency(56)); // Faturamento (F)
      expect(cells[8].textContent).toBe(formatCurrency(16)); // Saldo
      expect(cells[8].classList.contains('loss')).toBe(false);
      expect(cells[9].textContent).toBe(`${formatPercent(140)}%`); // Status
      // Status % neutro (§2.5 P5): só `.num` (tabular-nums, célula numérica),
      // nenhuma classe de cor (`.loss`/chip) — diferente de Saldo, que ganha
      // `.loss` quando negativo.
      expect(cells[9].className).toBe('num');
    });

    it('15. Saldo negativo → `.loss`; Status continua neutro', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      // Vendas=0 → F=0, Saldo=-C=-40, Status=0% (não null, §3 caso 1).
      bake(m.bakeStore, {
        recipeId: r1.id,
        recipeName: r1.name,
        date: new Date(2026, 6, 3),
        quantityProduced: 10,
        quantitySold: 0,
        unitCost: 4,
        unitSalePrice: 7,
      });
      render(m);

      const row = balanceTable(m.root).querySelector('tbody tr')!;
      const cells = Array.from(row.querySelectorAll('td'));
      expect(cells[8].textContent).toBe(formatCurrency(-40));
      expect(cells[8].classList.contains('loss')).toBe(true);
      expect(cells[9].textContent).toBe(`${formatPercent(0)}%`);
      expect(cells[9].classList.contains('loss')).toBe(false);
    });

    it('16. Custo unitário 0 (C=0): Status da linha = "—" (§3 caso 3)', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      bake(m.bakeStore, {
        recipeId: r1.id,
        recipeName: r1.name,
        date: new Date(2026, 6, 3),
        quantityProduced: 10,
        quantitySold: 8,
        unitCost: 0,
        unitSalePrice: 7,
      });
      render(m);

      const row = balanceTable(m.root).querySelector('tbody tr')!;
      const cells = Array.from(row.querySelectorAll('td'));
      expect(cells[4].textContent).toBe(formatCurrency(0)); // Custo (C) = 0
      expect(cells[9].textContent).toBe('—'); // Status indefinido
    });

    it('17. tfoot: Σ bate com `currentSummary`; Status agregado = ΣF/ΣC (não média das linhas)', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      // A: F=120,C=100 (Produção 20×5, Vendas 24×5) · B: F=60,C=100 (Produção 20×5, Vendas 12×5)
      // ΣF=180, ΣC=200, ΣSaldo=-20, Status_total=90% (§2.4 exemplo do cliente).
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1), quantityProduced: 20, quantitySold: 24, unitCost: 5, unitSalePrice: 5 });
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 2), quantityProduced: 20, quantitySold: 12, unitCost: 5, unitSalePrice: 5 });
      render(m);

      const foot = balanceTable(m.root).querySelector('tfoot tr')!;
      const cells = Array.from(foot.querySelectorAll('td'));
      expect(cells[2].textContent).toBe('40'); // ΣProdução
      expect(cells[4].textContent).toBe(formatCurrency(200)); // ΣC
      expect(cells[5].textContent).toBe('36'); // ΣVendas
      expect(cells[7].textContent).toBe(formatCurrency(180)); // ΣF
      expect(cells[8].textContent).toBe(formatCurrency(-20)); // ΣSaldo
      expect(cells[8].classList.contains('loss')).toBe(true);
      expect(cells[9].textContent).toBe(`${formatPercent(90)}%`); // Status agregado ΣF/ΣC
      // NÃO é a média simples dos Status das linhas (120% e 60% → mean 90% aqui
      // por coincidência de números; a fórmula é sempre ΣF/ΣC, não a média).
    });

    it('18. planejada: badge + "—" em Vendas/Preço unit./F/Saldo/Status; Data/Receita/Produção/Custo unit./C reais; fora do tfoot', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8, unitCost: 4, unitSalePrice: 7 });
      bake(m.bakeStore, {
        recipeId: r1.id,
        recipeName: r1.name,
        date: new Date(2026, 6, 4),
        quantityProduced: 15,
        quantitySold: 0,
        unitCost: 3,
        unitSalePrice: 6,
        planned: true,
      });
      render(m);

      const rows = balanceTable(m.root).querySelectorAll('tbody tr');
      const plannedRow = Array.from(rows).find((r) => r.querySelector('.badge-planned') !== null)!;
      expect(plannedRow).toBeDefined();
      const cells = Array.from(plannedRow.querySelectorAll('td'));
      expect(cells[0].textContent).toBe('2026-07-04'); // Data real
      expect(cells[1].textContent).toContain('Pão Rústico'); // Receita real
      expect(cells[2].textContent).toBe('15'); // Produção real
      expect(cells[3].textContent).toBe(formatCurrency(3)); // Custo unitário real
      expect(cells[4].textContent).toBe(formatCurrency(45)); // Custo (C) real (15×3, projetado)
      expect(cells[5].textContent).toBe('—'); // Vendas
      expect(cells[6].textContent).toBe('—'); // Preço unitário
      expect(cells[7].textContent).toBe('—'); // Faturamento (F)
      expect(cells[8].textContent).toBe('—'); // Saldo
      expect(cells[9].textContent).toBe('—'); // Status

      // fora do tfoot: os totais refletem SÓ a fornada confirmada (C=40,F=56,Saldo=16).
      const foot = balanceTable(m.root).querySelector('tfoot tr')!;
      const footCells = Array.from(foot.querySelectorAll('td'));
      expect(footCells[4].textContent).toBe(formatCurrency(40));
      expect(footCells[7].textContent).toBe(formatCurrency(56));
      expect(footCells[8].textContent).toBe(formatCurrency(16));
    });

    it('19a. tabela vazia (nenhuma fornada): estado vazio orientando a registrar; Σ = 0; Status agregado "—"', () => {
      const m = mount();
      render(m); // nenhuma fornada
      const table = balanceTable(m.root);
      expect(table.querySelector('tbody tr')!.textContent).toMatch(/Nenhuma fornada/);

      const foot = table.querySelector('tfoot tr')!;
      const cells = Array.from(foot.querySelectorAll('td'));
      expect(cells[2].textContent).toBe('0');
      expect(cells[4].textContent).toBe(formatCurrency(0));
      expect(cells[5].textContent).toBe('0');
      expect(cells[7].textContent).toBe(formatCurrency(0));
      expect(cells[8].textContent).toBe(formatCurrency(0));
      expect(cells[9].textContent).toBe('—'); // ΣC=0 → "—"
    });

    it('19b. só fornada planejada (sem confirmadas): tbody lista a linha; Σ segue 0/"—"', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), planned: true });
      render(m);

      const rowsOnlyPlanned = balanceTable(m.root).querySelectorAll('tbody tr');
      expect(rowsOnlyPlanned.length).toBe(1);
      expect(rowsOnlyPlanned[0].querySelector('.badge-planned')).not.toBeNull();
      const foot2 = balanceTable(m.root).querySelector('tfoot tr')!;
      const cells2 = Array.from(foot2.querySelectorAll('td'));
      expect(cells2[2].textContent).toBe('0'); // ΣProdução (planejada fora)
      expect(cells2[9].textContent).toBe('—'); // ΣC=0 → "—"
    });

    it('20. ordenação por data decrescente (§2.5 P6)', () => {
      const m = mount();
      const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1) });
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3) });
      bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 2) });
      render(m);

      const rows = balanceTable(m.root).querySelectorAll('tbody tr');
      const dates = Array.from(rows).map((r) => r.querySelector('td')!.textContent);
      expect(dates).toEqual(['2026-07-03', '2026-07-02', '2026-07-01']);
    });

    // --- pills de visualização (issue 046, §2.6) ---
    describe('pills de visualização (§2.6) — Completa/Unidades/Fornadas', () => {
      function viewToggle(root: HTMLElement): HTMLElement {
        // barra de views vive dentro do mesmo `.card` da tabela do Balanço,
        // localizada via `.period-toggle` mais próximo da `balanceTable`.
        return balanceTable(root).parentElement!.querySelector('.period-toggle') as HTMLElement;
      }
      function viewBtn(root: HTMLElement, label: string): HTMLButtonElement {
        return Array.from(viewToggle(root).querySelectorAll('button')).find(
          (b) => b.textContent === label,
        ) as HTMLButtonElement;
      }

      it('21. barra de pills renderiza 3 botões; Completa ativa por padrão; table com view-completa', () => {
        const m = mount();
        render(m);
        const toggle = viewToggle(m.root);
        const labels = Array.from(toggle.querySelectorAll('button')).map((b) => b.textContent);
        expect(labels).toEqual(['Completa', 'Unidades', 'Fornadas']);
        expect(viewBtn(m.root, 'Completa').classList.contains('active')).toBe(true);
        expect(viewBtn(m.root, 'Unidades').classList.contains('active')).toBe(false);
        expect(viewBtn(m.root, 'Fornadas').classList.contains('active')).toBe(false);
        expect(balanceTable(m.root).classList.contains('view-completa')).toBe(true);
      });

      it('22. clicar Unidades → table ganha view-unidades e perde view-completa; botão Unidades ativo', () => {
        const m = mount();
        render(m);
        viewBtn(m.root, 'Unidades').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const table = balanceTable(m.root);
        expect(table.classList.contains('view-unidades')).toBe(true);
        expect(table.classList.contains('view-completa')).toBe(false);
        expect(viewBtn(m.root, 'Unidades').classList.contains('active')).toBe(true);
        expect(viewBtn(m.root, 'Completa').classList.contains('active')).toBe(false);
        expect(viewBtn(m.root, 'Fornadas').classList.contains('active')).toBe(false);
      });

      it('23. clicar Fornadas → table ganha view-fornadas', () => {
        const m = mount();
        render(m);
        viewBtn(m.root, 'Fornadas').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const table = balanceTable(m.root);
        expect(table.classList.contains('view-fornadas')).toBe(true);
        expect(table.classList.contains('view-completa')).toBe(false);
        expect(viewBtn(m.root, 'Fornadas').classList.contains('active')).toBe(true);
      });

      it('24. voltar para Completa restaura view-completa', () => {
        const m = mount();
        render(m);
        viewBtn(m.root, 'Unidades').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        viewBtn(m.root, 'Completa').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const table = balanceTable(m.root);
        expect(table.classList.contains('view-completa')).toBe(true);
        expect(table.classList.contains('view-unidades')).toBe(false);
        expect(viewBtn(m.root, 'Completa').classList.contains('active')).toBe(true);
      });

      it('25. thead: Custo unitário/Preço unitário têm col-unit; Custo (C)/Faturamento (F)/Saldo têm col-bake; demais sem classe de coluna', () => {
        const m = mount();
        render(m);
        const headers = Array.from(balanceTable(m.root).querySelectorAll('thead th'));
        const byText = (label: string) => headers.find((th) => th.textContent === label)!;
        expect(byText('Custo unitário').classList.contains('col-unit')).toBe(true);
        expect(byText('Preço unitário').classList.contains('col-unit')).toBe(true);
        expect(byText('Custo (C)').classList.contains('col-bake')).toBe(true);
        expect(byText('Faturamento (F)').classList.contains('col-bake')).toBe(true);
        expect(byText('Saldo').classList.contains('col-bake')).toBe(true);
        for (const label of ['Data', 'Receita', 'Produção', 'Vendas', 'Status']) {
          const th = byText(label);
          expect(th.classList.contains('col-unit')).toBe(false);
          expect(th.classList.contains('col-bake')).toBe(false);
        }
      });

      it('26. tfoot carrega as mesmas classes de coluna (totais escondem junto)', () => {
        const m = mount();
        const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
        bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 8, unitCost: 4, unitSalePrice: 7 });
        render(m);
        const foot = balanceTable(m.root).querySelector('tfoot tr')!;
        const cells = Array.from(foot.querySelectorAll('td'));
        // ordem: Total, Receita, Produção, Custo unit., Custo(C), Vendas, Preço unit., Fatur.(F), Saldo, Status
        expect(cells[3].classList.contains('col-unit')).toBe(true);
        expect(cells[4].classList.contains('col-bake')).toBe(true);
        expect(cells[6].classList.contains('col-unit')).toBe(true);
        expect(cells[7].classList.contains('col-bake')).toBe(true);
        expect(cells[8].classList.contains('col-bake')).toBe(true);
        expect(cells[2].classList.contains('col-unit')).toBe(false);
        expect(cells[2].classList.contains('col-bake')).toBe(false);
        expect(cells[5].classList.contains('col-unit')).toBe(false);
        expect(cells[9].classList.contains('col-bake')).toBe(false);
      });

      it('27. troca de view não altera nº de linhas do corpo nem a ordem das datas', () => {
        const m = mount();
        const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
        bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 1) });
        bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3) });
        bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 2) });
        render(m);
        const datesBefore = Array.from(balanceTable(m.root).querySelectorAll('tbody tr')).map(
          (r) => r.querySelector('td')!.textContent,
        );
        viewBtn(m.root, 'Unidades').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const rowsAfter = balanceTable(m.root).querySelectorAll('tbody tr');
        const datesAfter = Array.from(rowsAfter).map((r) => r.querySelector('td')!.textContent);
        expect(rowsAfter.length).toBe(3);
        expect(datesAfter).toEqual(datesBefore);
      });

      it('28. Saldo .loss persiste ao alternar Completa → Unidades → Completa', () => {
        const m = mount();
        const r1 = m.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
        // Vendas=0 → Saldo negativo (§2.5 P5).
        bake(m.bakeStore, { recipeId: r1.id, recipeName: r1.name, date: new Date(2026, 6, 3), quantityProduced: 10, quantitySold: 0, unitCost: 4, unitSalePrice: 7 });
        render(m);
        const saldoCell = () => balanceTable(m.root).querySelector('tbody tr td:nth-child(9)') as HTMLElement;
        expect(saldoCell().classList.contains('loss')).toBe(true);
        viewBtn(m.root, 'Unidades').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(saldoCell().classList.contains('loss')).toBe(true); // escondido via display, classe intacta
        viewBtn(m.root, 'Completa').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(saldoCell().classList.contains('loss')).toBe(true);
      });
    });
  });
});
