---
id: "007"
titulo: Precificação — 3 modos sincronizados, margem ≤99,9%, totais, faixas 30/15
tipo: core
deps: ["006"]
status: done
---

## Contexto
Painel de precificação (spec §3.E, §4): três formas de entrada que convergem para o mesmo estado (Preço, Margem%, Lucro unitário).

## O que fazer
- `src/core/pricing.ts`:
  - `CustoUnitário = CustoTotalReceita / Quantidade` (§3.E). Quantidade ≥ 1 (§5.C).
  - Modo Preço Fixo: `Lucro = Preço − CustoUnit`; `Margem% = Lucro/Preço × 100`.
  - Modo Margem%: `Preço = CustoUnit / (1 − Margem/100)` — clamp margem a [0, 99.9] (§5.C, decisão 4).
  - Modo Lucro Fixo: `Preço = CustoUnit + Lucro`.
  - Cada modo recalcula os outros dois campos — estado final sempre consistente.
  - Totais: `CustoTotalProdução = CustoTotalReceita × Qtd` · `ReceitaTotal = Preço × Qtd` · `LucroTotal = ReceitaTotal − CustoTotalProdução` (§3.E).
  - Faixa de status da margem (§4): `'green'` >30 · `'yellow'` 15–30 · `'red'` <15 ou negativa; flag prejuízo se custo > preço.

## Testes exigidos (TDD)
- §12: CustoTotal 8.86, 2 unidades, margem 40% → CustoUnit 4.43, Preço 7.383…→R$7,38 exib., Lucro unit 2.95…, ReceitaTotal 14.766…→14,76*, LucroTotal 5.90…. Testar valores puros com toBeCloseTo (7.3833, 2.9533, 14.7666, 5.9066) — exibição arredonda depois (§9).
- Margem 100 → clamp 99.9, sem Infinity.
- Preço 10, custo unit 4 → margem 60%, lucro 6.
- Lucro fixo 3, custo 4.43 → preço 7.43.
- Margens 31/20/10/−5 → green/yellow/yellow/red (30 e 15 exatos: 30→yellow, 15→yellow — faixa §4: verde >30, amarelo 15–30, vermelho <15).
- Preço ≤ custo → flag prejuízo true (aviso, não bloqueio §5.C).

## Critérios de aceite
- [ ] 3 modos produzem estado sincronizado idêntico dado mesmo trio custo/entrada.
- [ ] Margem clamp 0–99,9 (§5.C).
- [ ] Golden §12 completo passa.
- [ ] Faixas 30/15 e flag prejuízo (§4).

## Referências
- spec §3.E, §4, §5.C, §12, decisão 4

## Plano Técnico

### Análise do existente
Busca real (`grep`/leitura) em `src/core/`:
- `src/core/types.ts` → `interface Pricing` (§6) JÁ EXISTE (quantity, salePrice, profitMargin, profitPerUnit, totalCost?, totalRevenue?, totalProfit?) e `RecipeSummary` (costPerUnit, totalProductionCost, totalRevenue, profitPerUnit, totalProfit, profitMargin). REUSAR os tipos; `pricing.ts` NÃO redefine domínio, só importa. Não alterar `types.ts` (campos já batem 1:1 com a spec).
- `src/core/costs.ts` → `totalRecipeCost(ingredients, sourdoughCost): number | null` (§3.E) é o dono do "Custo Total Receita". `pricing.ts` CONSOME o `number` já pronto (entrada `totalRecipeCost`); NÃO recalcula custo, NÃO importa `costs.ts` — o recalc engine (issue 008) é quem encadeia. Zero duplicação (regra de ouro #2).
- Convenções confirmadas em `costs.ts`/`hydration.ts` e a seguir: 100% puro (sem DOM/localStorage/rede); SEM arredondamento interno (§9) — retorna cru, `format.ts` arredonda só na exibição; sem mutação; `null`/clamp para inválido, NUNCA `throw` (recalc em lote não pode ser interrompido); cabeçalho citando `§`; comentário `§` em fórmula não óbvia.
- Estilo de teste espelha `hydration.test.ts`: `describe` por função, `it` numerado com valores no título, `toBeCloseTo` para valores crus, asserção anti-arredondamento.
- Sem lib nova: aritmética nativa; o core de cálculo é o produto (regra de ouro #1, exceção declarada). Vitest já é a suíte. Nenhuma API/lib não-trivial → nenhuma consulta de doc externa necessária; app segue 100% offline (§10, §11.1).

### Cenários
Números concretos da §12 (gabarito) — entrada: `CustoTotalReceita = 8.86`, `quantity = 2`, `margin = 40`:
- **Feliz (modo Margem%)**: `unitCost = 8.86/2 = 4.43` (§3.E) · `salePrice = 4.43/(1−40/100) = 7.38333…` · `profitPerUnit = 7.38333−4.43 = 2.95333…` · `profitMargin = 40` · totais: `totalProductionCost = 4.43×2 = 8.86`, `totalRevenue = 7.38333×2 = 14.76666…`, `totalProfit = 14.76666−8.86 = 5.90666…`.
- **Sincronização dos 3 modos (§3.E)**: alimentar cada modo com o valor correspondente do mesmo trio (margin 40 · salePrice 7.38333… · profit 2.95333…) sobre `unitCost 4.43` produz o MESMO triple `{salePrice, profitMargin, profitPerUnit}`. É a álgebra da §3.E: em Margem%, `profit/price = margin` por construção.
- **Borda — margem 100 (decisão 4, §5.C)**: clamp para 99.9 → `salePrice = 4.43/0.001 = 4430`, finito, sem `Infinity`/`NaN`.
- **Borda — margem negativa**: clamp para 0 (piso), sem preço abaixo do custo por essa via.
- **Borda — quantity < 1**: clamp defensivo para 1 (§5.C: quantidade ≥ 1) — evita ÷0 no `unitCost`; UI já bloqueia, core é a rede de segurança. Sem forçar inteiro no core (UI trata).
- **Borda — salePrice ≤ 0 (modo Preço Fixo)**: guarda ÷0 → `profitMargin = 0` (não `NaN`); `profitPerUnit = 0 − unitCost` (negativo), refletido no status vermelho e na flag.
- **Faixas de status (§4, leitura literal da issue)**: `>30 → green`; `15–30 inclusive → yellow` (30 exato → yellow, 15 exato → yellow); `<15 ou negativa → red`.
- **Prejuízo (§5.C, aviso não bloqueio)**: `salePrice ≤ unitCost → true`. A issue cita §5.C ("alerta se preço ≤ custo") no caso de teste → limiar inclusivo (`≤`), cobrindo break-even; §4 descreve o mesmo destaque. Nunca bloqueia.

> **Inconsistência resolvida (registrar):** issue linha 19 e spec §3.E linha 232 escrevem `CustoTotalProdução = CustoTotalReceita × Qtd`, o que daria `8.86×2 = 17.72` e `LucroTotal = 14.76666−17.72 = −2.95` — QUEBRA o golden §12 (`LucroTotal = 5.90`). O gabarito §12 exige `CustoTotalProdução = 8.86`. Resolução: `totalProductionCost = unitCost × quantity` (= `4.43×2 = 8.86` = CustoTotalReceita, algebricamente idêntico e semanticamente "custo por unidade × unidades produzidas", coerente com §14.3 `BakeEntry.totalCost = unitCost × quantityProduced`). O golden é a fonte da verdade (architecture.md; regra de ouro do cliente). NÃO usar `CustoTotalReceita × Qtd` literal.

### Testes primeiro (issue core)
Escrever `src/core/pricing.test.ts` ANTES de `pricing.ts`, um `it` por comportamento (espelhando `hydration.test.ts`), `toBeCloseTo(x, 3)` para crus:
1. `unitCost(8.86, 2)` → `4.43` (§3.E golden).
2. `unitCost(8.86, 0)` → `8.86` (clamp quantity→1, §5.C, sem ÷0).
3. `clampMargin(40)`→`40`; `clampMargin(100)`→`99.9`; `clampMargin(-5)`→`0` (§5.C, decisão 4).
4. `priceFromMargin(4.43, 40)` → `{salePrice≈7.3833, profitPerUnit≈2.9533, profitMargin:40}` (golden §12).
5. `priceFromMargin(4.43, 100)` → `salePrice≈4430`, `Number.isFinite` true, sem `Infinity` (clamp 99.9).
6. `priceFromSalePrice(4, 10)` → `{profitMargin:60, profitPerUnit:6}` (modo Preço Fixo).
7. `priceFromSalePrice(4.43, 0)` → `profitMargin:0` (guarda ÷0, sem `NaN`), `profitPerUnit:-4.43`.
8. `priceFromProfit(4.43, 3)` → `salePrice:7.43`, `profitMargin≈40.377…` (modo Lucro Fixo).
9. **Sincronização**: os 3 modos com `unitCost 4.43` alimentados por margin 40 / salePrice 7.38333… / profit 2.95333… → triples iguais (`toBeCloseTo`).
10. `pricingTotals(4.43, 7.38333…, 2)` → `{totalProductionCost≈8.86, totalRevenue≈14.7666, totalProfit≈5.9066}` (golden §12; trava a resolução da inconsistência).
11. `marginStatus`: `31→'green'` · `30→'yellow'` · `20→'yellow'` · `15→'yellow'` · `10→'red'` · `-5→'red'` (faixas §4, limites literais).
12. `isLoss(4.43, 4)` → `true`; `isLoss(4.43, 8)` → `false`; `isLoss(4.43, 4.43)` → `true` (break-even inclusivo, §5.C).
13. Pureza (§9): resultado do modo Margem% NÃO é o valor arredondado (`.not.toBe(7.38)` / `.not.toBe(2.95)`), confirmando cru.

### Arquivos a criar
- `src/core/pricing.test.ts` — os ~13 casos acima (TDD, primeiro).
- `src/core/pricing.ts` — cabeçalho citando §3.E/§4/§5.C/§12/decisão 4. Assinaturas:
  ```ts
  export const MARGIN_MIN = 0;
  export const MARGIN_MAX = 99.9;              // §5.C, decisão 4 (dono único do teto)
  export type MarginStatus = 'green' | 'yellow' | 'red';
  export interface PricingBreakdown { salePrice: number; profitMargin: number; profitPerUnit: number; }
  export interface PricingTotals { totalProductionCost: number; totalRevenue: number; totalProfit: number; }

  export function clampMargin(margin: number): number;                     // min(99.9, max(0, m))
  export function effectiveQuantity(quantity: number): number;             // max(1, quantity) §5.C
  export function unitCost(totalRecipeCost: number, quantity: number): number; // /effectiveQuantity §3.E
  export function priceFromSalePrice(unitCost: number, salePrice: number): PricingBreakdown; // Preço Fixo §3.E
  export function priceFromMargin(unitCost: number, margin: number): PricingBreakdown;       // Margem% §3.E, dec.4
  export function priceFromProfit(unitCost: number, profitPerUnit: number): PricingBreakdown; // Lucro Fixo §3.E
  export function pricingTotals(unitCost: number, salePrice: number, quantity: number): PricingTotals; // §3.E
  export function marginStatus(margin: number): MarginStatus;              // §4 (>30 green; 15–30 yellow; <15/neg red)
  export function isLoss(unitCost: number, salePrice: number): boolean;    // §5.C/§4: salePrice <= unitCost
  ```
  - `priceFromMargin`: `m = clampMargin(margin)`; `salePrice = unitCost/(1 − m/100)`; `profitPerUnit = salePrice − unitCost`; `profitMargin = m` (auto-consistente: `profit/price = m` por construção).
  - `priceFromSalePrice`: `profitPerUnit = salePrice − unitCost`; `profitMargin = salePrice > 0 ? profitPerUnit/salePrice*100 : 0` (guarda ÷0, §5.C).
  - `priceFromProfit`: `salePrice = unitCost + profitPerUnit`; `profitMargin = salePrice > 0 ? profitPerUnit/salePrice*100 : 0`.
  - `pricingTotals`: `totalProductionCost = unitCost × effectiveQuantity(quantity)`; `totalRevenue = salePrice × effectiveQuantity`; `totalProfit = totalRevenue − totalProductionCost` (§3.E; ver nota da inconsistência).
  - `marginStatus`: `m > 30 → 'green'`; `m >= 15 → 'yellow'`; senão `'red'`.

### Arquivos a modificar
- Nenhum. (O recalc engine da issue 008 fará o wiring `costs.ts → pricing.ts → Pricing/RecipeSummary`; fora do escopo desta issue.)

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts` (Pricing/RecipeSummary já corretos §6), `src/core/costs.ts`, `bakers.ts`, `sourdough.ts`, `hydration.ts`, `format.ts` e seus testes.
- `spec/…v5.md`, `mockups/`, `references/`, `golden-example.test.ts`.

### O que NÃO fazer
- NÃO arredondar internamente (§9): retornar cru; `format.ts` arredonda na exibição. NÃO importar `format.ts`.
- NÃO importar DOM/localStorage/rede (pasta `core/`, §10/§11.1).
- NÃO recalcular/duplicar `totalRecipeCost` — consumir o `number` da `costs.ts`.
- NÃO usar `CustoTotalReceita × Qtd` literal (quebra o golden) — usar `unitCost × quantity`.
- NÃO `throw`: clamp (margem 0–99.9, quantity ≥1) e guarda ÷0 → `0`/valor finito, nunca `NaN`/`Infinity`.
- NÃO bloquear preço ≤ custo (é aviso, §5.C) — só `isLoss` retorna `true`.
- NÃO forçar quantidade inteira no core (UI trata) nem adicionar lib nova.

### Ordem de implementação
1. Escrever `pricing.test.ts` com os ~13 casos (TDD, vermelho).
2. `MARGIN_MIN/MAX`, `clampMargin`, `effectiveQuantity`.
3. `unitCost` (§3.E) — passa casos 1–2.
4. `priceFromSalePrice`, `priceFromMargin`, `priceFromProfit` — passa 3–9, 13.
5. `pricingTotals` — passa 10 (trava a inconsistência resolvida).
6. `marginStatus`, `isLoss` — passa 11–12.
7. `npm test` verde; cabeçalho `§` e comentários de fórmula revisados.
