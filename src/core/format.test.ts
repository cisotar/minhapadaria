/**
 * format.test.ts — Testes da camada de parsing/formatação numérica pt-BR.
 *
 * Cobre spec §7.1 (entrada aceita vírgula OU ponto; datas aaaa-mm-dd) e
 * §9 (precisão de exibição: % 2 casas, peso 1 casa, R$ 2 casas, custo/g 4 casas;
 * arredondamento half-up SÓ na exibição).
 *
 * TDD: estes casos são escritos ANTES da implementação (issue 002).
 */
import { describe, it, expect } from 'vitest';
import {
  parseDecimal,
  formatPercent,
  formatWeight,
  formatCurrency,
  formatCostPerGram,
  formatProportion,
  formatDate,
  parseLocalDate,
} from './format';

describe('parseDecimal (spec §7.1 — aceita vírgula ou ponto)', () => {
  it('1. "12,5" → 12.5', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
  });
  it('2. "12.5" → 12.5', () => {
    expect(parseDecimal('12.5')).toBe(12.5);
  });
  it('3. "abc" → null', () => {
    expect(parseDecimal('abc')).toBe(null);
  });
  it('4. "" → null', () => {
    expect(parseDecimal('')).toBe(null);
  });
  it('5. "   " → null (só espaços)', () => {
    expect(parseDecimal('   ')).toBe(null);
  });
  it('6. "12.5.5" → null (dois separadores)', () => {
    expect(parseDecimal('12.5.5')).toBe(null);
  });
  it('7. "Infinity" → null (não finito)', () => {
    expect(parseDecimal('Infinity')).toBe(null);
  });
  it('8. "  8,00 " → 8 (trim nas pontas)', () => {
    expect(parseDecimal('  8,00 ')).toBe(8);
  });
  it('9. "0" → 0 (zero é válido, não vira null)', () => {
    expect(parseDecimal('0')).toBe(0);
  });
});

describe('formatCurrency (spec §9 — R$ 2 casas, half-up)', () => {
  it('10. 8.856 → "R$ 8,86" (§12, espaço ASCII normalizado)', () => {
    expect(formatCurrency(8.856)).toBe('R$ 8,86');
  });
  it('11. 8.855 → "R$ 8,86" (half-up)', () => {
    expect(formatCurrency(8.855)).toBe('R$ 8,86');
  });
  it('12. 2.675 → "R$ 2,68" (half-up onde toFixed erra)', () => {
    expect(formatCurrency(2.675)).toBe('R$ 2,68');
  });
  it('13. 0 → "R$ 0,00"', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });
  it('14. anti-NBSP: não contém NBSP (U+00A0)', () => {
    expect(formatCurrency(8.856)).not.toContain(' ');
  });
});

describe('formatCostPerGram (spec §9/§2.A.1 — R$ 4 casas)', () => {
  it('15. 0.064 → "R$ 0,0640" (§2.A.1, 4 casas)', () => {
    expect(formatCostPerGram(0.064)).toBe('R$ 0,0640');
  });
});

describe('formatWeight (spec §9 — peso 1 casa, com ponto de milhar)', () => {
  it('16. 1041.6666 → "1.041,7" (§12, com separador de milhar)', () => {
    expect(formatWeight(1041.6666)).toBe('1.041,7');
  });
  it('17. 0 → "0,0"', () => {
    expect(formatWeight(0)).toBe('0,0');
  });
});

describe('formatPercent (spec §9 — % 2 casas)', () => {
  it('18. 72.72727 → "72,73"', () => {
    expect(formatPercent(72.72727)).toBe('72,73');
  });
  it('19. 70 → "70,00"', () => {
    expect(formatPercent(70)).toBe('70,00');
  });
  it('20. 192 → "192,00" (§12 Soma da Receita)', () => {
    expect(formatPercent(192)).toBe('192,00');
  });
  it('21. 0.125 → "0,13" (half-up)', () => {
    expect(formatPercent(0.125)).toBe('0,13');
  });
});

describe('formatProportion (proporção do fermento — pt-BR, até 2 casas, sem zeros à direita)', () => {
  it('27. 1 → "1" (inteiro sem casas)', () => {
    expect(formatProportion(1)).toBe('1');
  });
  it('28. 3 → "3" (inteiro sem casas)', () => {
    expect(formatProportion(3)).toBe('3');
  });
  it('29. 20 → "20" (inteiro sem casas)', () => {
    expect(formatProportion(20)).toBe('20');
  });
  it('30. 200 → "200" (inteiro sem casas)', () => {
    expect(formatProportion(200)).toBe('200');
  });
  it('31. 1.5 → "1,5" (fracionário com vírgula)', () => {
    expect(formatProportion(1.5)).toBe('1,5');
  });
  it('32. 0.25 → "0,25" (duas casas com vírgula)', () => {
    expect(formatProportion(0.25)).toBe('0,25');
  });
  it('33. 0 → "0" (zero sem casas)', () => {
    expect(formatProportion(0)).toBe('0');
  });
  it('34. 1.5 não tem zero à direita ("1,50")', () => {
    expect(formatProportion(1.5)).not.toBe('1,50');
  });
});

describe('formatDate (spec §7.1 — aaaa-mm-dd, getters locais)', () => {
  it('22. new Date(2026, 6, 4) → "2026-07-04"', () => {
    expect(formatDate(new Date(2026, 6, 4))).toBe('2026-07-04');
  });
  it('23. new Date(2026, 0, 1) → "2026-01-01" (padStart mês/dia)', () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('parseLocalDate (spec §7.1 — meia-noite LOCAL, nunca UTC)', () => {
  it('24. "2026-07-08" → dia local 8 (new Date(2026,6,8)), não 7 (UTC não desloca)', () => {
    const d = parseLocalDate('2026-07-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(8);
  });
  it('25. round-trip: formatDate(parseLocalDate(s)) === s', () => {
    expect(formatDate(parseLocalDate('2026-02-28'))).toBe('2026-02-28');
    expect(formatDate(parseLocalDate('2026-07-08'))).toBe('2026-07-08');
  });
  it('26. "2026-01-01" → getFullYear 2026, getMonth 0, getDate 1', () => {
    const d = parseLocalDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});
