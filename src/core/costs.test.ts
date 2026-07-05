/**
 * costs.test.ts — Testes de custo, núcleo puro (spec §2.A.1/§2.B.2/§3.E/§5.C).
 *
 * Cobre: normalização do PackageCost para gramas (§2.A, densidade 1:1),
 * custo/g SEMPRE derivado de Preço Pago ÷ Peso do Produto (§2.A.1, nunca
 * digitado), custo na receita (§2.A.1), custo do fermento com Isca SEMPRE
 * fora (§2.B.2/§3.E), custo/g do fermento (§3.E) e custo total da receita
 * (§3.E, golden §12 → R$8,86 exato). Guardas de divisão por zero (§5.C).
 * §9: nenhum arredondamento interno — valores crus, precisão total.
 *
 * TDD: estes 13 casos são escritos ANTES da implementação (issue 006).
 */
import { describe, it, expect } from 'vitest';
import type { Ingredient, PackageCost, SourdoughFlour } from './types';
import {
  packageSizeInGrams,
  costPerGram,
  ingredientRecipeCost,
  sourdoughCost,
  sourdoughCostPerGram,
  totalRecipeCost,
} from './costs';

// Fábrica mínima de PackageCost.
function pkg(pricePaid: number, packageSize: number, packageUnit: PackageCost['packageUnit']): PackageCost {
  return { pricePaid, packageSize, packageUnit };
}

// Fábrica mínima de SourdoughFlour (só os campos usados pelo core de custo).
function sflour(percentage: number, cost: PackageCost): SourdoughFlour {
  return {
    flourId: `f-${percentage}`,
    name: `farinha ${percentage}`,
    percentage,
    packageCost: cost,
    weight: 0,
  };
}

// Fábrica mínima de Ingredient (só peso + packageCost importam ao custo).
function ing(weight: number, cost: PackageCost): Ingredient {
  return {
    id: `i-${weight}`,
    name: `ing ${weight}`,
    category: 'extra',
    weight,
    percentage: 0,
    packageCost: cost,
  };
}

describe('packageSizeInGrams (spec §2.A — kg/L→×1000, mL/g→×1, densidade 1:1)', () => {
  it('1. g→×1, kg→×1000, L→×1000, mL→×1', () => {
    expect(packageSizeInGrams(pkg(0, 1250, 'g'))).toBe(1250);
    expect(packageSizeInGrams(pkg(0, 1, 'kg'))).toBe(1000);
    expect(packageSizeInGrams(pkg(0, 1, 'L'))).toBe(1000);
    expect(packageSizeInGrams(pkg(0, 500, 'mL'))).toBe(500);
  });
});

describe('costPerGram (spec §2.A.1 — Preço Pago ÷ Peso do Produto, derivado)', () => {
  it('2. azeite R$80 / 1250g → 0.064 R$/g', () => {
    expect(costPerGram(pkg(80, 1250, 'g'))).toBe(0.064);
  });

  it('3. farinha R$8/kg → 0.008; sal R$3/kg → 0.003; água R$0/L → 0 (§12)', () => {
    expect(costPerGram(pkg(8, 1, 'kg'))).toBe(0.008);
    expect(costPerGram(pkg(3, 1, 'kg'))).toBe(0.003);
    expect(costPerGram(pkg(0, 1, 'L'))).toBe(0);
  });

  it('4. normalização equivalente: R$8/1kg === R$8/1000g === 0.008 (§2.A)', () => {
    expect(costPerGram(pkg(8, 1, 'kg'))).toBe(costPerGram(pkg(8, 1000, 'g')));
    expect(costPerGram(pkg(8, 1000, 'g'))).toBe(0.008);
  });

  it('5. packageSize=0 → null, nunca Infinity; negativo → null (§5.C)', () => {
    const zero = costPerGram(pkg(80, 0, 'g'));
    expect(zero).toBeNull();
    expect(Number.isFinite(zero as unknown as number)).toBe(false);
    expect(costPerGram(pkg(80, -5, 'g'))).toBeNull();
  });
});

describe('ingredientRecipeCost (spec §2.A.1 — peso × custo/g)', () => {
  it('6. azeite 40g→2.56; farinha 1000g→8; água 700g→0; packageSize 0→null (§5.C)', () => {
    expect(ingredientRecipeCost(40, pkg(80, 1250, 'g'))).toBe(2.56);
    expect(ingredientRecipeCost(1000, pkg(8, 1, 'kg'))).toBe(8);
    expect(ingredientRecipeCost(700, pkg(0, 1, 'L'))).toBe(0);
    expect(ingredientRecipeCost(40, pkg(80, 0, 'g'))).toBeNull();
  });
});

describe('sourdoughCost (spec §3.E — Σ farinhas + água; Isca SEMPRE fora)', () => {
  it('7. golden §12: [100g] @R$8/kg + 100g água @R$0/L → 0.80', () => {
    const flours = [sflour(100, pkg(8, 1, 'kg'))];
    expect(sourdoughCost([100], flours, 100, pkg(0, 1, 'L'))).toBe(0.8);
  });

  it('8. Isca (Partes 1:7:7, iscaWeight>0) fora: só FarinhaFerm + ÁguaFerm somam (§2.B.2)', () => {
    // W_ferm=300, 1:7:7 → isca=20, farinha=140, água=140. Isca não entra.
    const flours = [sflour(100, pkg(8, 1, 'kg'))];
    const custo = sourdoughCost([140], flours, 140, pkg(0, 1, 'L'));
    // 140×0.008 + 140×0 = 1.12; isca (20g) não contribui.
    expect(custo).toBe(1.12);
  });

  it('9. água @R$0 contribui 0; múltiplas farinhas do fermento somam por peso', () => {
    const flours = [sflour(50, pkg(8, 1, 'kg')), sflour(50, pkg(10, 1, 'kg'))];
    // farinhas: 50×0.008 + 50×0.010 = 0.4 + 0.5 = 0.9; água 100g @R$0 → 0.
    expect(sourdoughCost([50, 50], flours, 100, pkg(0, 1, 'L'))).toBe(0.9);
  });
});

describe('sourdoughCostPerGram (spec §3.E — Custo_fermento ÷ W_ferm)', () => {
  it('10. 0.80 / 200 → 0.004; W_ferm=0 → 0 sem NaN (§5.C)', () => {
    expect(sourdoughCostPerGram(0.8, 200)).toBe(0.004);
    const guard = sourdoughCostPerGram(0.8, 0);
    expect(guard).toBe(0);
    expect(Number.isNaN(guard)).toBe(false);
  });
});

describe('totalRecipeCost (spec §3.E — Σ ingredientes + Custo_fermento; golden §12)', () => {
  it('11. golden §12: farinha+água+sal + fermento 0.80 → 8.86 exato', () => {
    const ingredients = [
      ing(1000, pkg(8, 1, 'kg')), // farinha → 8
      ing(700, pkg(0, 1, 'L')), // água → 0
      ing(20, pkg(3, 1, 'kg')), // sal → 0.06
    ];
    expect(totalRecipeCost(ingredients, 0.8)).toBe(8.86);
  });

  it('12. propaga inválido: ingrediente com packageSize 0 → null (§5.C)', () => {
    const ingredients = [ing(1000, pkg(8, 1, 'kg')), ing(20, pkg(3, 0, 'g'))];
    expect(totalRecipeCost(ingredients, 0.8)).toBeNull();
  });
});

describe('pureza (spec §1.6)', () => {
  it('13. entradas não são mutadas', () => {
    const cost = pkg(80, 1250, 'g');
    const costSnap = JSON.parse(JSON.stringify(cost));
    const flours = [sflour(100, pkg(8, 1, 'kg'))];
    const floursSnap = JSON.parse(JSON.stringify(flours));
    const ingredients = [ing(1000, pkg(8, 1, 'kg'))];
    const ingSnap = JSON.parse(JSON.stringify(ingredients));

    costPerGram(cost);
    ingredientRecipeCost(40, cost);
    sourdoughCost([100], flours, 100, pkg(0, 1, 'L'));
    totalRecipeCost(ingredients, 0.8);

    expect(cost).toEqual(costSnap);
    expect(flours).toEqual(floursSnap);
    expect(ingredients).toEqual(ingSnap);
  });
});
