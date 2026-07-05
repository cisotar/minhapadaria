// @vitest-environment jsdom
/**
 * bakeForm.test.ts — Testes jsdom do registro rápido de fornada (issue 018,
 * spec §14.2/§14.6/§5.D). Casos do Plano Técnico da issue.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMemoryStorage } from '../storage/local';
import { createRecipeStore, type RecipeStore } from '../storage/recipes';
import { createBakeStore, type BakeStore } from '../storage/bakes';
import { goldenSeed } from './seed';
import { renderBakeForm } from './bakeForm';
import type { Recipe } from '../core/types';

/** Fixture §12 exata: goldenSeed() sem a categoria `fat` (Azeite) — mesma
 *  técnica de pricingPanel.test.ts/recipesList.test.ts (regra de ouro 2). */
function goldenSeedNoFat(): Recipe {
  const recipe = goldenSeed();
  recipe.ingredients = recipe.ingredients.filter((i) => i.category !== 'fat');
  return recipe;
}

function fixedNow(iso: string): () => Date {
  return () => new Date(iso);
}

function mount(opts: { now?: () => Date; recipe?: Partial<Recipe> } = {}) {
  const root = document.createElement('div');
  const storage = createMemoryStorage();
  const recipeStore: RecipeStore = createRecipeStore({ storage, newId: (() => { let n = 0; return () => `r-${++n}`; })() });
  const bakeStore: BakeStore = createBakeStore({ storage, newId: (() => { let n = 0; return () => `b-${++n}`; })() });
  const recipe = recipeStore.create({ ...goldenSeedNoFat(), name: 'Pão Rústico de Azeite', ...opts.recipe });
  const now = opts.now ?? fixedNow('2026-07-05T00:00:00');
  renderBakeForm(root, { recipeStore, bakeStore, now });
  return { root, storage, recipeStore, bakeStore, recipe, now };
}

function selectRecipe(root: HTMLElement, recipeId: string): void {
  const select = root.querySelector('select[aria-label="Receita"]') as HTMLSelectElement;
  select.value = recipeId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function setAndBlur(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

describe('bakeForm (jsdom) — §14.2/§14.6/§5.D', () => {
  it('1. select de receitas populado; escolher pré-preenche Custo/Preço unitário (golden §12: 4,43/7,38)', () => {
    const { root, recipe } = mount();
    const select = root.querySelector('select[aria-label="Receita"]') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Pão Rústico de Azeite');

    selectRecipe(root, recipe.id);

    const costInput = root.querySelector('input[aria-label="Custo Unitário"]') as HTMLInputElement;
    const priceInput = root.querySelector('input[aria-label="Preço de Venda Unitário"]') as HTMLInputElement;
    expect(costInput.value).toBe('4,43');
    expect(priceInput.value).toBe('7,38');
  });

  it('2. data default = formatDate(now()) com now injetado fixo 2026-07-05', () => {
    const { root } = mount({ now: fixedNow('2026-07-05T12:00:00') });
    const dateInput = root.querySelector('input[aria-label="Data"]') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-07-05');
  });

  it('3. Vendida 12 > Produzida 10 → bloqueio, campo revertido, mensagem "não pode exceder a produzida"', () => {
    const { root } = mount();
    const producedInput = root.querySelector('input[aria-label="Quantidade Produzida"]') as HTMLInputElement;
    const soldInput = root.querySelector('input[aria-label="Quantidade Vendida"]') as HTMLInputElement;

    setAndBlur(producedInput, '10');
    setAndBlur(soldInput, '5'); // valor válido primeiro, vira lastValid
    setAndBlur(soldInput, '12'); // agora bloqueia

    expect(soldInput.getAttribute('aria-invalid')).toBe('true');
    expect(soldInput.validationMessage).toMatch(/não pode exceder a produzida/);
    expect(soldInput.value).toBe('5'); // reverteu ao último válido, nunca 12
  });

  it('4. Produzida 0 → bloqueio "no mínimo 1"', () => {
    const { root } = mount();
    const producedInput = root.querySelector('input[aria-label="Quantidade Produzida"]') as HTMLInputElement;
    setAndBlur(producedInput, '0');
    expect(producedInput.getAttribute('aria-invalid')).toBe('true');
    expect(producedInput.validationMessage).toMatch(/no mínimo 1/);
  });

  it('5. Custo −1 → bloqueio não-negativo', () => {
    const { root } = mount();
    const costInput = root.querySelector('input[aria-label="Custo Unitário"]') as HTMLInputElement;
    setAndBlur(costInput, '-1');
    expect(costInput.getAttribute('aria-invalid')).toBe('true');
    expect(costInput.validationMessage).toMatch(/não pode ser negativo/);
  });

  it('6. Data futura (2026-07-08, hoje 07-05) → badge "Planejada" visível; registro grava planned:true', () => {
    const { root, recipe, bakeStore } = mount();
    selectRecipe(root, recipe.id);

    const dateInput = root.querySelector('input[aria-label="Data"]') as HTMLInputElement;
    dateInput.value = '2026-07-08';
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));

    const badge = root.querySelector('.badge-planned') as HTMLElement;
    expect(badge.style.display).not.toBe('none');

    const producedInput = root.querySelector('input[aria-label="Quantidade Produzida"]') as HTMLInputElement;
    const soldInput = root.querySelector('input[aria-label="Quantidade Vendida"]') as HTMLInputElement;
    setAndBlur(producedInput, '30');
    setAndBlur(soldInput, '0');

    const submitBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Registrar fornada')!;
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const entries = bakeStore.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].planned).toBe(true);
  });

  it('7. submeter válido → bakeStore.create chamado com date = parseLocalDate(input.value) (dia local correto)', () => {
    const { root, recipe, bakeStore } = mount();
    selectRecipe(root, recipe.id);

    const createSpy = vi.spyOn(bakeStore, 'create');
    const dateInput = root.querySelector('input[aria-label="Data"]') as HTMLInputElement;
    dateInput.value = '2026-07-03';
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));

    const producedInput = root.querySelector('input[aria-label="Quantidade Produzida"]') as HTMLInputElement;
    const soldInput = root.querySelector('input[aria-label="Quantidade Vendida"]') as HTMLInputElement;
    setAndBlur(producedInput, '24');
    setAndBlur(soldInput, '22');

    const submitBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Registrar fornada')!;
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(createSpy).toHaveBeenCalledTimes(1);
    const seed = createSpy.mock.calls[0][0]!;
    expect(seed.date).toBeInstanceOf(Date);
    expect(seed.date!.getFullYear()).toBe(2026);
    expect(seed.date!.getMonth()).toBe(6); // julho (0-indexado) — dia local, não UTC-1
    expect(seed.date!.getDate()).toBe(3);
    expect(seed.recipeId).toBe(recipe.id);
    expect(seed.quantityProduced).toBe(24);
    expect(seed.quantitySold).toBe(22);

    const entries = bakeStore.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].planned).toBeUndefined();
  });

  it('8. observações com <script> → sem nó <script> no DOM (textContent/atributo de valor, nunca innerHTML)', () => {
    const { root, recipe, bakeStore } = mount();
    selectRecipe(root, recipe.id);

    const notesInput = root.querySelector('input[aria-label="Observações"]') as HTMLInputElement;
    const evil = '<script>alert(1)</script>';
    notesInput.value = evil;

    const producedInput = root.querySelector('input[aria-label="Quantidade Produzida"]') as HTMLInputElement;
    const soldInput = root.querySelector('input[aria-label="Quantidade Vendida"]') as HTMLInputElement;
    setAndBlur(producedInput, '5');
    setAndBlur(soldInput, '5');

    const submitBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === '+ Registrar fornada')!;
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.querySelector('script')).toBeNull();
    const entries = bakeStore.list();
    expect(entries[0].notes).toBe(evil); // valor cru preservado, nunca executado
  });
});
