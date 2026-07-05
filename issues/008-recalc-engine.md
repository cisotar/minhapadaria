---
id: "008"
titulo: Função central de recálculo em lote + modos %→peso / peso→% + transição
tipo: core
deps: ["005", "006", "007"]
status: todo
---

## Contexto
Coração da arquitetura (spec §1.6): UMA função reconstrói todo o derivado a partir do estado puro, a cada alteração. Modos de cálculo §1.2–1.5.

## O que fazer
- `src/core/recalc.ts`:
  - `recalculate(recipe: Recipe): RecipeSummary + derivados` — orquestra bakers (003), sourdough (004), hydration (005), costs (006), pricing (007). Nunca lê valor derivado/arredondado como entrada (§1.6, §9). **Reusar** os módulos existentes — zero fórmula duplicada (regra de ouro 2).
  - Modo `percentage-to-weight` (§1.2): % é fonte de verdade; pesos derivados.
  - Modo `weight-to-percentage` (§1.3): pesos fonte de verdade (não-fermento); % exibida = peso / total geral da massa × 100; fermento SEMPRE por proporção+Partes nos dois modos.
  - Transição peso→% para %→peso (§1.5): F_total = Σ pesos farinhas principais; todas as % recalculadas dos pesos vigentes; nada descartado, sem confirmação.
  - Substituir placeholder do teste dourado (001) por teste real do §12 ponta a ponta via `recalculate`.

## Testes exigidos (TDD)
- Golden §12 integral por UMA chamada: F_total 1000, água 70%, sal 2%, fermento 20% 0:1:1 → W_ferm 200, FarinhaFerm/ÁguaFerm 100/100, H_ferm 100%, FarinhaReal 1100, nominal 70%, real ≈72.73%, custo 8.86, e com qtd 2 + margem 40%: unit 4.43, preço ≈7.3833, lucro ≈2.9533, receita ≈14.7666, lucro total ≈5.9066.
- Modo peso→%: pesos farinha 800+200, água 700, sal 20, fermento 20% → % sobre total geral da massa (incl. fermento no total).
- Transição §1.5: editar pesos em peso→% (farinha 1200), voltar → F_total=1200, % recalculadas, água mantém peso e ganha nova %.
- Determinismo: recalculate(recalculate(r).state) idêntico (idempotente sobre estado puro).
- Alteração de qualquer campo → resultado igual a recalcular do zero (sem cache intermediário).

## Critérios de aceite
- [ ] Função única; derivados nunca realimentam o cálculo (§1.6).
- [ ] Fermento por proporção nos dois modos (§1.3).
- [ ] Transição §1.5 sem perda de dados.
- [ ] Teste dourado §12 verde e permanente na suíte.

## Referências
- spec §1.2–1.6, §9, §12 · architecture.md convenções

---

## Plano Técnico

### Análise do existente
Tudo já existe como funções puras — o engine SÓ orquestra (regra de ouro 2, zero fórmula duplicada). Verificado por leitura direta dos módulos:

- `src/core/bakers.ts` → `flourTotal(ingredients)` (§3.A, Σ pesos category 'flour'), `weightFromPercentage(F_total, %)` (Peso = F_total×%/100), `percentageFromWeight(weight, F_total)` (%=peso/F_total×100, guarda ≤0→0 — **usada só na transição §1.5, denominador = F_total**), `percentagesSumTo100`. Reuso direto.
- `src/core/sourdough.ts` → `computeSourdoughWeights(F_total, %, parts)` retorna `SourdoughWeights|null` (totalWeight/isca/flour/water/hydration; null se partes inválidas §5.C), `distributeSourdoughFlourWeights(flourFerm, flours)`, `sourdoughTotalWeight`. Reuso direto; recalc consome o `null` sem throw.
- `src/core/hydration.ts` → `declaredLiquidsWeight`, `nominalHydration(ingredients): number|null`, `realHydration(ingredients, sourdough|null): number|null`, `realFlourConsumed(...): number`. Recebem os ingredientes JÁ com pesos derivados + o `SourdoughWeights` pronto. Reuso direto.
- `src/core/costs.ts` → `costPerGram(packageCost): number|null`, `ingredientRecipeCost(weight, packageCost): number|null`, `sourdoughCost(flourWeights, flours, waterWeight, waterCost): number|null` (Isca fora, §2.B.2), `sourdoughCostPerGram`, `totalRecipeCost(ingredients, sourdoughCost): number|null` (Neumaier → 8,86 exato). Reuso direto. Contrato PROGRESS-006: `ingredients[]` NÃO tem pseudolinha de fermento; custo do fermento entra só via `sourdoughCost`.
- `src/core/pricing.ts` → `unitCost(totalRecipeCost, qty)`, `priceFromMargin/priceFromSalePrice/priceFromProfit(uc, x): PricingBreakdown`, `pricingTotals(uc, salePrice, qty): PricingTotals`. Reuso direto.
- `src/core/types.ts` → `Recipe`, `Ingredient`, `Sourdough`, `Pricing`, `RecipeSummary`, `HydrationSummary`, `CalculationMode`. Reusadas; três ajustes pontuais abaixo.
- `src/core/golden-example.test.ts` → placeholder que falha de propósito (`expect(false).toBe(true)`); esta issue o substitui pelo teste real.

**Nenhuma fórmula duplicada.** A ÚNICA conta que o engine possui é a % de exibição do modo peso→% (§1.3): `%_i = peso_i / TotalGeralDaMassa × 100` — denominador diferente de `bakers.percentageFromWeight` (que é sobre F_total, §3.A). É a semântica-definidora do modo, não duplicação; fica inline em recalc.ts, comentada com `§1.3`.

### Reconciliação `null` das camadas inferiores × `RecipeSummary` (decisão-chave)
Camadas inferiores devolvem `number|null` (hidratação com F_total=0; custo com packageSize≤0) e o contrato PROGRESS-005/006 **proíbe colapsar `null`→0** (`null`=cálculo impossível; `0`=contribuição legítima). `RecipeSummary`/`HydrationSummary` hoje tipam esses campos como `number` não-nulo. Decisão: **alargar em `types.ts` os campos derivados que podem ser impossíveis para `number|null`** (nunca 0, nunca NaN). É a representação honesta de §5.C e mantém o engine ininterrompível (sem throw, §1.6). O golden §12 tem entradas válidas → todos os campos saem `number` concreto, teste intacto.
- **FLAG revisor humano**: §6 mostra esses campos como `number`; alargamos para `number|null` por §5.C + contrato null-vs-0. Registrar em "Decisões da noite".

### Ajustes em `types.ts` (mínimos, justificados)
1. `HydrationSummary`: `nominal: number|null`, `real: number|null` (§5.C, F_total=0).
2. `RecipeSummary`: alargar para `number|null` os campos que dependem de custo/preço impossível — `totalCost`, `costPerUnit`, `totalProductionCost`, `salePrice`, `totalRevenue`, `profitPerUnit`, `totalProfit`, `profitMargin`. `realFlourConsumed` permanece `number` (nunca null, §2.D).
3. `Pricing`: adicionar `priceInputMode: 'sale-price' | 'margin' | 'profit'` — o engine precisa saber QUAL dos 3 modos sincronizados dirige o cálculo (§3.E); é estado persistido do usuário (UI 016 o define). Golden usa `'margin'` + `profitMargin: 40`.

### Assinaturas (`src/core/recalc.ts`)
```ts
export interface RecalcResult {
  state: Recipe;          // §1.6: estado puro + derivados readonly preenchidos (idempotente ao re-alimentar)
  summary: RecipeSummary; // §2.C/§2.D/§3.E: painéis de hidratação, farinha real, custo, precificação
}
export function recalculate(recipe: Recipe): RecalcResult;        // orquestra tudo do estado puro (§1.6)
export function transitionToPercentageMode(recipe: Recipe): Recipe; // §1.5 (função explícita)
```

### Algoritmo de `recalculate` (ordem, do estado puro — §1.6)
1. **F_total (âncora)**: modo `percentage-to-weight` → `F_total = recipe.flourTotalWeight`; modo `weight-to-percentage` → `F_total = bakers.flourTotal(ingredients)` (Σ pesos de farinha editados). (Nota: `batchPlanningMode:'per-unit'` — F_total = flourPerUnit×qty — é escopo da issue 009; aqui assume-se `'total'` lendo `flourTotalWeight`.)
2. **Derivar linhas** (sem mutar entrada — clonar): 
   - `%→peso` (§1.2): `%` é verdade; `weight_i = weightFromPercentage(F_total, %_i)` para farinha E não-farinha.
   - `peso→%` (§1.3): `weight` é verdade (não-fermento); `%_i = weight_i / TotalGeralDaMassa × 100`, onde `TotalGeralDaMassa = Σ pesos ingredientes + W_ferm` (fermento entra no total, §3.D nota). NÃO usar `bakers.percentageFromWeight` aqui.
3. **Fermento (SEMPRE por proporção+Partes nos dois modos, §1.3)**: `sd = computeSourdoughWeights(F_total, sourdough.percentageOfTotalFlour, sourdough.parts)` → `SourdoughWeights|null`; `flourWeights = distributeSourdoughFlourWeights(sd.flourWeight, sourdough.flours)`. Peso do fermento nunca é editado.
4. **Hidratação**: `nominalHydration(ingredientsDerivados)`, `realHydration(ingredientsDerivados, sd)`, `realFlourConsumed(ingredientsDerivados, sd)`.
5. **Custos**: por linha `costPerGram`/`ingredientRecipeCost`; `sc = sourdoughCost(flourWeights, sourdough.flours, sd.waterWeight, sourdough.waterPackageCost)`; `total = totalRecipeCost(ingredientsDerivados, sc ?? …)`. Propagar `null` (não colapsar).
6. **Precificação**: `uc = total===null ? null : unitCost(total, qty)`; se `uc!==null`, `breakdown = priceInputMode==='margin' ? priceFromMargin(uc, profitMargin) : priceInputMode==='sale-price' ? priceFromSalePrice(uc, salePrice) : priceFromProfit(uc, profitPerUnit)`; `totals = pricingTotals(uc, breakdown.salePrice, qty)`. Se `uc===null`, campos de preço/lucro do summary = `null`.
7. **Montar `state`** (clone da Recipe com derivados readonly preenchidos: `ingredient.weight/percentage/costPerGram/recipeCost`, `sourdough.*` pesos+hidratação+custos, `pricing.*`) e **`summary`**. Retornar `RecalcResult`.

**Idempotência garantida por construção**: recalculate lê SÓ o campo fonte-de-verdade do modo (percentuais em %→peso; pesos em peso→%) e IGNORA o campo que ele mesmo derivou (§1.6) — re-alimentar `state` reproduz o mesmo `weight`/`%`. Sem cache, sem estado entre chamadas.

### `transitionToPercentageMode` (§1.5)
Entrada em `weight-to-percentage`; pesos editados viram fonte de verdade: (1) `flourTotalWeight = bakers.flourTotal(ingredients)`; (2) para cada ingrediente `percentage = bakers.percentageFromWeight(weight, F_total)` — **denominador F_total** (baker's, §3.A), pois o destino é %→peso; (3) `calculationMode = 'percentage-to-weight'`; proporção/Partes do fermento inalteradas (sempre por proporção). Nada descartado, sem confirmação (§1.5). Não recalcula derivados — devolve Recipe pura; o chamador roda `recalculate` em seguida.

### Cenários (números concretos)
- **Golden §12 (caminho feliz, §12)**: Farinha 1000g@R$8/kg, Água 700g@R$0, Sal 20g@R$3/kg, Fermento 20% Partes 0:1:1 100% branca; qty 2, margin 40 → W_ferm 200, Isca 0, FarinhaFerm 100, ÁguaFerm 100, H_ferm 100%, FarinhaReal 1100, nominal 70%, real 72,7272…%, custo 8,86; unitCost 4,43, salePrice 7,38333…, profit 2,95333…, totalProductionCost 8,86, revenue 14,76666…, totalProfit 5,90666….
- **Borda F_total=0**: nominal `null`, real numérico se FarinhaFerm>0 (PROGRESS-005 dec 3), realFlourConsumed numérico.
- **Borda custo inválido** (packageSize=0): totalCost/costPerUnit/preços = `null`; hidratação/pesos permanecem numéricos.
- **Fermento inválido** (partes 0:0:0): `computeSourdoughWeights`→null; hidratação real cai para = nominal; sourdoughCost sobre pesos 0.

### Testes primeiro (Vitest, ANTES da implementação)
Arquivo novo `src/core/recalc.test.ts` (unitários do engine) + substituição de `golden-example.test.ts` (ponta-a-ponta §12):

`recalc.test.ts`:
1. **%→peso deriva pesos** — fixture golden pura → `state.ingredients` água.weight=700, sal.weight=20; `summary.hydration.nominal=70`.
2. **peso→% (§1.3)** — farinha 800+200, água 700, sal 20, fermento 20%; F_total=1000, W_ferm=200, TotalGeralDaMassa=1720 → %água=700/1720×100≈40,6977, %farinha1≈46,5116, %farinha2≈11,6279, %sal≈1,1628, %fermento≈11,6279; **pesos preservados**; fermento continua por proporção (W_ferm=200).
3. **transição §1.5** — peso→% com farinha 1200, água 700 (peso) → `transitionToPercentageMode` → `flourTotalWeight=1200`, farinha %=100, água %=700/1200×100≈58,3333, `calculationMode='percentage-to-weight'`, água.weight mantém 700 após `recalculate`.
4. **idempotência** — `recalculate(recalculate(r).state)` deep-equal a `recalculate(r)`, nos DOIS modos.
5. **sem cache / pureza** — mutar campo puro (ex.: sal %=3) e `recalculate` = `recalculate` de uma receita reconstruída do zero com sal 3; entrada original não mutada (`toStrictEqual` no input).
6. **null não colapsa** — packageSize=0 numa farinha → `summary.totalCost===null` e `costPerUnit===null`, `hydration.nominal` numérico.

`golden-example.test.ts` (real, permanente §12, uma chamada `recalculate`):
- `totalCost` `toBeCloseTo(8.86, 2)` (exato via Neumaier), `realFlourConsumed` 1100, `hydration.nominal` `toBeCloseTo(70,10)`, `hydration.real` `toBeCloseTo(72.72727,4)`, sourdough weights 200/0/100/100, H_ferm 100; pricing `unitCost` 4.43, `salePrice` `toBeCloseTo(7.38333,4)`, `profitPerUnit` `toBeCloseTo(2.95333,4)`, `totalProductionCost` `toBeCloseTo(8.86,2)`, `totalRevenue` `toBeCloseTo(14.76666,4)`, `totalProfit` `toBeCloseTo(5.90666,4)`.

### Arquivos a criar
- `src/core/recalc.ts` — engine `recalculate` + `transitionToPercentageMode` + `RecalcResult`. Cabeçalho citando §1.2–1.6/§3.E/§9. Sem DOM, sem localStorage, sem rede, sem `format.ts` (nada de arredondamento, §9).
- `src/core/recalc.test.ts` — casos 1–6 acima.

### Arquivos a modificar
- `src/core/types.ts` — alargar `HydrationSummary` e campos derivados de `RecipeSummary` para `number|null`; adicionar `Pricing.priceInputMode`. (Justificativas acima.)
- `src/core/golden-example.test.ts` — substituir placeholder pelo teste real §12 via `recalculate`.
- `references/architecture.md` (Mapa de módulos + Decisões) e `PROGRESS.md` — pelo escriba, ao fim (registrar alargamento de tipos + flag ao humano).

### Arquivos que NÃO devem ser tocados
- `bakers.ts`, `sourdough.ts`, `hydration.ts`, `costs.ts`, `pricing.ts` e seus `.test.ts` — apenas importados; reuso puro (regra 2). NÃO adicionar a % de total-geral-da-massa a bakers.ts (fica inline em recalc, é semântica de modo §1.3).
- `format.ts` — engine não arredonda (§9).
- Qualquer coisa em `src/ui/`, `src/storage/`, `src/export/`, `vite.config.ts`, `spec/`, `mockups/`.

### Ordem de implementação
1. Ajustar `types.ts` (alargar nulos + `priceInputMode`).
2. Escrever `recalc.test.ts` (casos 1–6) e reescrever `golden-example.test.ts` — TODOS vermelhos.
3. Implementar `recalculate` (F_total → linhas → fermento → hidratação → custos → preço → montar `state`+`summary`).
4. Implementar `transitionToPercentageMode`.
5. Rodar Vitest até verde; confirmar golden §12 permanente verde e build Vite ok.

### O que NÃO fazer
- NÃO ler valor derivado/arredondado como entrada; sempre do estado puro (§1.6/§9).
- NÃO colapsar `null`→0 nem →NaN (PROGRESS-005/006).
- NÃO duplicar fórmula das camadas inferiores (só a % de total-geral §1.3 é do engine).
- NÃO adicionar pseudolinha de fermento em `ingredients[]`; custo do fermento só via `sourdoughCost` (contrato PROGRESS-006).
- NÃO mutar a Recipe de entrada (clonar; retornar novo `state`).
- NÃO lançar exceção (engine ininterrompível; nulos fluem).
- NÃO implementar escalonamento §3.D nem fornada per-unit (issue 009).
- NÃO usar `bakers.percentageFromWeight` para a % de exibição de peso→% (denominador é o total-geral, não F_total).
- NÃO importar `format.ts`, DOM, localStorage ou rede.
