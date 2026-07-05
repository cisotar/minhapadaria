/**
 * seed.ts — Estado inicial em memória da Calculadora (spec §12, exemplo validado).
 *
 * O que faz: `goldenSeed()` devolve uma `Recipe` crua (sem derivados — quem
 * preenche pesos/custos é `recalculate`, §1.6) reproduzindo o gabarito da §12
 * (Farinha Branca 1000g/100% · Água 700g/70% · Sal 20g/2% · Fermento 20%,
 * Partes 0:1:1) mais o Azeite 40g/4% do mockup `mockups/calculadora.html`
 * (usado ali para exercitar a categoria `fat` — plano da issue 014).
 * Só dados — zero lógica, zero fórmula. Serve de estado inicial até existir o
 * fluxo "abrir receita" (telas de Receitas, issue 017/`src/storage/recipes.ts`).
 *
 * Refactor-farinhas-multiplas §5.7 (2026-07-06, fase 2 — proporção por linha
 * no fermento): `sourdough.parts` não tem mais `flour` (fica `{isca, water}`);
 * a farinha do fermento usa `proportion` (era `percentage`).
 *
 * Ajuste do cliente (§5.1, nota "seed/golden §12", 2026-07-06): a Isca padrão
 * passa a ser **1** (era 0) — `parts {isca:1, water:1}` + farinha do fermento
 * `proportion:1` → denominador global = 1+1+1 = 3 (não mais 2). O seed
 * DEIXA DE reproduzir os números do exemplo §12 (que usava Isca 0): agora
 * FarinhaFerm = ÁguaFerm = W_ferm(200)/3 ≈ 66,67g (era 100g), Farinha Real
 * Consumida = 1000 + 66,67 ≈ 1066,67g (era 1100g) — a hidratação do FERMENTO
 * continua 100% (água=farinha em qualquer denom), mas a hidratação REAL da
 * receita e os custos mudam (recalculados pelo engine, não à mão aqui). A
 * validação das FÓRMULAS da §12 (Isca 0) permanece garantida à parte, em
 * `golden-example.test.ts` (fixture próprio) — o §12 é referência de fórmula,
 * não mais o estado inicial deste seed.
 *
 * Seções implementadas: §12 (exemplo de fórmula, fixture próprio), §6 (estrutura de dados).
 */
import type { Recipe } from '../core/types';

export function goldenSeed(): Recipe {
  const now = new Date(2026, 6, 3); // 2026-07-03 (determinístico, sem `new Date()` ambíguo)
  return {
    id: 'golden-seed',
    name: 'Pão Rústico de Azeite',
    calculationMode: 'percentage-to-weight',
    batchPlanningMode: 'per-unit', // planejamento por unidade — único modo exposto na UI (refactor 2026-07-05)
    flourPerUnit: 500, // F_unit × N(=2) = F_total 1000 do gabarito §12
    flourTotalWeight: 1000, // F_total derivado (500 × 2) — valor inicial coerente com §12
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
        packageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' }, // issue 030: torneira em peso (era 'L')
      },
      {
        id: 'oil-1',
        name: 'Azeite',
        category: 'fat', // fora da hidratação (§2.A/§2.C)
        weight: 0,
        percentage: 4,
        packageCost: { pricePaid: 80, packageSize: 1250, packageUnit: 'g' },
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
      parts: { isca: 1, water: 1 }, // ajuste do cliente §5.1: Isca padrão 1 (era 0) — sem `flour` (refactor §5.7)
      flours: [
        {
          flourId: 'flour-1',
          name: 'Farinha Branca',
          proportion: 1, // refactor §5.7 (era percentage:100) — denom global agora 1+1+1=3 (Isca 1, ajuste do cliente)
          packageCost: { pricePaid: 8, packageSize: 1, packageUnit: 'kg' },
          weight: 0,
        },
      ],
      waterPackageCost: { pricePaid: 0, packageSize: 1, packageUnit: 'kg' }, // torneira (§2.B.4); issue 030: peso (era 'L')
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
