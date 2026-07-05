/**
 * seed.ts — Estado inicial em memória da Calculadora (spec §12, exemplo validado).
 *
 * O que faz: `goldenSeed()` devolve uma `Recipe` crua (sem derivados — quem
 * preenche pesos/custos é `recalculate`, §1.6) reproduzindo o gabarito da §12
 * (Farinha Branca 1000g/100% · Água 700g/70% · Sal 20g/2% · Fermento 20%,
 * Partes 0:1:1) mais o Azeite 40g/4% do mockup `mockups/calculadora.html`
 * (usado ali para exercitar a categoria `fat`/g-mL — plano da issue 014).
 * Só dados — zero lógica, zero fórmula. Serve de estado inicial até existir o
 * fluxo "abrir receita" (telas de Receitas, issue 017/`src/storage/recipes.ts`).
 *
 * Seções implementadas: §12 (exemplo validado), §6 (estrutura de dados).
 */
import type { Recipe } from '../core/types';

export function goldenSeed(): Recipe {
  const now = new Date(2026, 6, 3); // 2026-07-03 (determinístico, sem `new Date()` ambíguo)
  return {
    id: 'golden-seed',
    name: 'Pão Rústico de Azeite',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'total',
    flourTotalWeight: 1000, // F_total — âncora (§12)
    ingredients: [
      {
        id: 'flour-1',
        name: 'Farinha Branca',
        category: 'flour',
        weight: 0, // derivado por `recalculate` (§1.6)
        percentage: 100, // única farinha — trava 100% (§2.A)
        packageCost: { pricePaid: 8, packageSize: 1, packageUnit: 'kg' },
      },
      {
        id: 'water-1',
        name: 'Água',
        category: 'liquid',
        weight: 0,
        percentage: 70,
        packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' },
        inputUnit: 'weight',
      },
      {
        id: 'oil-1',
        name: 'Azeite',
        category: 'fat', // fora da hidratação (§2.A/§2.C)
        weight: 0,
        percentage: 4,
        packageCost: { pricePaid: 80, packageSize: 1250, packageUnit: 'g' },
        inputUnit: 'weight',
      },
      {
        id: 'salt-1',
        name: 'Sal',
        category: 'salt',
        weight: 0,
        percentage: 2,
        packageCost: { pricePaid: 3, packageSize: 1, packageUnit: 'kg' },
      },
    ],
    sourdough: {
      percentageOfTotalFlour: 20, // §12: proporção do fermento
      parts: { isca: 0, flour: 1, water: 1 }, // §12: Partes 0:1:1
      flours: [
        {
          flourId: 'flour-1',
          name: 'Farinha Branca',
          percentage: 100,
          packageCost: { pricePaid: 8, packageSize: 1, packageUnit: 'kg' },
          weight: 0,
        },
      ],
      waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'L' }, // torneira (§2.B.4)
    },
    pricing: {
      quantity: 2, // §12: precificação com 2 unidades
      salePrice: 0,
      profitMargin: 40, // §12: 40% de margem
      profitPerUnit: 0,
      priceInputMode: 'margin',
    },
    createdAt: now,
    updatedAt: now,
  };
}
