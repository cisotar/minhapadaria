/**
 * seed.test.ts — TDD de `goldenSeed()` (issue 035, casos 1–2 do Plano Técnico).
 *
 * Ajuste do cliente: o ingrediente Azeite (categoria `fat`) deixa de vir
 * pré-preenchido; o `name` padrão da seed deixa de referenciar Azeite.
 */
import { describe, it, expect } from 'vitest';
import { goldenSeed } from './seed';

describe('goldenSeed (issue 035)', () => {
  it('1. ingredientes não contêm "Azeite" nem categoria "fat"', () => {
    const seed = goldenSeed();
    expect(seed.ingredients.find((i) => i.name === 'Azeite')).toBeUndefined();
    expect(seed.ingredients.some((i) => i.category === 'fat')).toBe(false);
  });

  it('2. name não contém "Azeite" e é string não-vazia', () => {
    const seed = goldenSeed();
    expect(seed.name).not.toContain('Azeite');
    expect(typeof seed.name).toBe('string');
    expect(seed.name.trim()).not.toBe('');
  });
});
