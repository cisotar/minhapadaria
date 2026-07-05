/**
 * types.ts — Estruturas de dados do domínio (spec §6).
 *
 * O que faz: define fielmente as interfaces/tipos da Seção 6 da spec v5
 * (Estrutura de Dados). Cópia 1:1 de nomes, campos, opcionais e comentários
 * de seção. São apenas tipos (apagados em runtime) — sem lógica, sem DOM.
 *
 * Convenções da spec: valor canônico sempre em gramas (§7); custos derivados
 * são somente-leitura, calculados pelo engine (§2.A.1, §9), nunca digitados.
 */

export type CalculationMode = 'percentage-to-weight' | 'weight-to-percentage';

// Entrada de custo (Seção 2.A.1): usuário informa preço pago + peso do
// produto; custo por grama é sempre derivado, nunca digitado diretamente.
export interface PackageCost {
  pricePaid: number;                    // R$ pago pelo produto
  packageSize: number;                  // peso/volume do produto, na unidade abaixo
  packageUnit: 'g' | 'kg' | 'mL' | 'L';
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'flour' | 'liquid' | 'fat' | 'salt' | 'extra';
  weight: number;              // valor canônico, sempre em gramas
  percentage: number;
  packageCost: PackageCost;
  costPerGram?: number;        // derivado: R$/g, somente-leitura
  recipeCost?: number;         // derivado: weight × costPerGram
  inputUnit?: 'weight' | 'volume'; // apenas para category 'liquid' ou 'fat'; padrão 'weight'
}

export interface SourdoughFlour {
  flourId: string;
  name: string;
  percentage: number;
  packageCost: PackageCost;
  costPerGram?: number;        // derivado
  weight: number;
}

// Partes de construção do fermento (Seção 2.B.2): Isca:Farinha:Água, ex 1:7:7.
// Substituem a antiga entrada de Hidratação — hydration agora é derivada.
export interface SourdoughParts {
  isca: number;
  flour: number;
  water: number;
}

export interface Sourdough {
  percentageOfTotalFlour: number;
  parts: SourdoughParts;
  hydration?: number;      // derivada, somente-leitura: waterWeight / flourWeight × 100
  flours: SourdoughFlour[];
  waterPackageCost: PackageCost;  // padrão: R$0,00 / 1L (torneira)
  waterCostPerGram?: number;      // derivado
  totalWeight?: number;    // W_ferm = iscaWeight + flourWeight + waterWeight
  iscaWeight?: number;     // Isca — custo sempre zero (Seção 2.B.2)
  flourWeight?: number;   // Farinha do Fermento
  waterWeight?: number;   // Água do Fermento
  totalCost?: number;
  costPerGram?: number;    // derivado: totalCost / totalWeight
}

export interface HydrationSummary {
  // §5.C: F_total=0 (ou denominador 0) torna a hidratação impossível → null
  // (nunca 0/NaN). Alargado de number para number|null pela issue 008 (engine
  // ininterrompível, §1.6). Entradas válidas (golden §12) saem number concreto.
  nominal: number | null;
  real: number | null;
}

export interface Pricing {
  quantity: number;
  salePrice: number;
  profitMargin: number;
  profitPerUnit: number;
  // §3.E: qual dos três pontos de entrada sincronizados dirige o cálculo do
  // engine (estado persistido do usuário; UI 016 o define). Adicionado pela 008.
  priceInputMode: 'sale-price' | 'margin' | 'profit';
  totalCost?: number;
  totalRevenue?: number;
  totalProfit?: number;
}

export type BatchPlanningMode = 'total' | 'per-unit';

export interface Recipe {
  id: string;
  name: string;
  calculationMode: CalculationMode;
  batchPlanningMode: BatchPlanningMode; // Seção 2.E.1; padrão 'total'
  flourTotalWeight: number;    // em 'per-unit', derivado: flourPerUnit * pricing.quantity
  flourPerUnit?: number;       // farinha-âncora de 1 unidade; usado apenas em 'per-unit'
  ingredients: Ingredient[];
  sourdough: Sourdough;
  pricing: Pricing;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeSummary {
  hydration: HydrationSummary;
  // §2.D: Farinha Real Consumida = F_total + FarinhaFerm; nunca impossível → number.
  realFlourConsumed: number;
  // §5.C + contrato null-vs-0: campos dependentes de custo/preço impossível
  // (Peso do Produto ≤ 0) são number|null (null = cálculo impossível, jamais 0).
  // Alargados de number pela issue 008. Golden §12 (entradas válidas) → number.
  totalCost: number | null;
  costPerUnit: number | null;
  totalProductionCost: number | null;
  salePrice: number | null;
  totalRevenue: number | null;
  profitPerUnit: number | null;
  totalProfit: number | null;
  profitMargin: number | null;
}

// --- Histórico de Fornadas ---

export interface BakeEntry {
  id: string;
  recipeId: string;
  recipeName: string;        // snapshot do nome no momento do registro
  date: Date;
  quantityProduced: number;
  quantitySold: number;      // pode ser < produzida (sobra/perda)
  unitCost: number;          // snapshot do custo unitário no momento
  unitSalePrice: number;     // snapshot do preço de venda no momento
  notes?: string;
  planned?: boolean;         // true se data futura ainda não confirmada (Seção 14.6)
  // Calculados
  totalCost?: number;        // unitCost * quantityProduced
  totalRevenue?: number;     // unitSalePrice * quantitySold
  totalProfit?: number;      // totalRevenue - totalCost
  wastage?: number;          // quantityProduced - quantitySold
  wastageRate?: number;      // % — wastage / quantityProduced
}

export interface BakeHistorySummary {
  periodStart: Date;
  periodEnd: Date;
  totalProduced: number;
  totalSold: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  wastageRate: number;       // %
  averageProfitMargin: number; // %
}
