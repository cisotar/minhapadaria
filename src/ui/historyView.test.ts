// @vitest-environment jsdom
/**
 * historyView.test.ts — Testes jsdom do dashboard de Fornadas (issue 018,
 * spec §14.4/§14.5/§14.6/§14.7). Casos do Plano Técnico da issue.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createRecipeStore, type RecipeStore } from '../storage/recipes';
import { createBakeStore, type BakeStore } from '../storage/bakes';
import { goldenSeed } from './seed';
import { renderHistoryView } from './historyView';
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
    const rows = m.root.querySelectorAll('table tbody tr');
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

    const rows = m.root.querySelectorAll('table tbody tr');
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
    expect(m1.root.querySelectorAll('table tbody tr')).toHaveLength(0);

    const m2 = mount({ confirm: () => false });
    const r2 = m2.recipeStore.create(goldenSeedNoFat('Pão Rústico'));
    bake(m2.bakeStore, { recipeId: r2.id, recipeName: r2.name, date: new Date(2026, 6, 3) });
    render(m2);
    const removeSpy2 = vi.spyOn(m2.bakeStore, 'remove');
    const deleteBtn2 = Array.from(m2.root.querySelectorAll('button')).find((b) => b.textContent === 'Excluir') as HTMLButtonElement;
    deleteBtn2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(removeSpy2).not.toHaveBeenCalled();
    expect(m2.root.querySelectorAll('table tbody tr')).toHaveLength(1);
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
    const rows = m.root.querySelectorAll('table tbody tr');
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
});
