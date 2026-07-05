---
id: "006"
titulo: Custos — custo/g derivado, custo na receita, custo do fermento (isca zero)
tipo: core
deps: ["002", "004"]
status: todo
---

## Contexto
Entrada única de custo: Preço Pago + Peso do Produto (spec §2.A.1); tudo mais derivado. Isca custo SEMPRE zero (§2.B.2, §3.B).

## O que fazer
- `src/core/costs.ts`:
  - Normalizar `PackageCost` para gramas: `kg → ×1000`, `L → ×1000`, `mL → ×1` (densidade 1:1, §2.A).
  - `custoPorGrama = pricePaid / packageSizeGramas` (§2.A.1). Guard: packageSize > 0 (§5.C, bloqueio).
  - `custoNaReceita = peso_usado × custoPorGrama` (§2.A.1).
  - Fermento (§3.E): `Custo_farinha_i = FarinhaFerm_i × C_farinha_i`; `Custo_águaFerm = ÁguaFerm × C_água`; `Custo_fermento = Σ farinhas + água` — **Isca nunca soma**; `C_fermento (R$/g) = Custo_fermento / W_ferm` (guard W_ferm=0).
  - `CustoTotalReceita = Σ Custo_X (ingredientes) + Custo_fermento` (§3.E). Linha do fermento na tabela usa C_fermento, não custo próprio digitado.

## Testes exigidos (TDD)
- §2.A.1 exemplo: azeite R$80 / 1250g → 0.0640 R$/g; 40g usados → R$2,56.
- §12: farinha R$8,00/kg → 0.008 R$/g; FarinhaFerm 100g → R$0,80; água R$0/L → 0; Custo_fermento=R$0,80; CustoTotalReceita = 1000×0.008 + 20×0.003 + 700×0 + 0.80 = **R$8,86**.
- Isca com peso > 0 (partes 1:7:7) → custo fermento ignora isca.
- packageSize=0 → inválido explícito, sem Infinity.
- kg/L/mL normalizados: R$8 por 1kg ≡ R$8 por 1000g.

## Critérios de aceite
- [ ] Custo/g e custo na receita sempre derivados, nunca entrada direta (decisão 18/23).
- [ ] Isca fora de todo cálculo de custo.
- [ ] Golden §12: custo total R$8,86 exato (antes de arredondar: 8.86).
- [ ] Divisões por zero tratadas.

## Referências
- spec §2.A.1, §2.B.2, §3.E, §5.C, §12

---

## Plano Técnico

### Análise do existente
Busca real (`grep`/leitura) em `src/core/`:
- `src/core/types.ts` → `PackageCost {pricePaid, packageSize, packageUnit:'g'|'kg'|'mL'|'L'}`, `Ingredient {weight, packageCost, costPerGram?, recipeCost?}`, `SourdoughFlour {percentage, packageCost, costPerGram?, weight}`, `Sourdough {waterPackageCost, totalWeight?, iscaWeight?, flourWeight?, waterWeight?, totalCost?, costPerGram?}`. **REUSAR 1:1** — todos os campos derivados já existem no shape; `costs.ts` só os calcula, não altera tipos.
- `src/core/sourdough.ts` → `SourdoughWeights {totalWeight, iscaWeight, flourWeight, waterWeight, hydration}` e `distributeSourdoughFlourWeights(flourWeight, flours) → number[]` (FarinhaFerm_i por P_i, §3.B). **REUSAR**: `costs.ts` consome esses pesos crus; NÃO recalcula peso de farinha do fermento (regra de ouro #2, sem duplicar §3.B).
- `src/core/bakers.ts` → `weightFromPercentage` (não usado aqui; custo não deriva de %). Padrão de guarda `<= 0 → estado explícito` (ex.: `percentageFromWeight`) e `null` para estado inválido (`computeSourdoughWeights`) — **seguir a mesma convenção** (retorno `null`, nunca throw, para o recalc em lote da issue 008).
- `src/core/format.ts` → `formatCurrency`/`formatCostPerGram` já arredondam exibição (§9). **NÃO** importar em `costs.ts`: core devolve number cru, precisão total (§9).
- Suíte segue TDD com `describe/it` numerados e fábricas mínimas (ver `sourdough.test.ts`). **Seguir o mesmo estilo.**

Lib externa: **nenhuma**. Custo é o core de cálculo da spec (o produto) — implementação própria com TDD, sem dependência (regra de ouro #1, exceção do core; architecture.md linha 9). Aritmética number nativa basta.

### Cenários
Caminho feliz (golden §12): farinha 1000g @R$8/kg → C=0,008; água 700g @R$0/L → C=0; sal 20g @R$3/kg → C=0,003; fermento 20% (W_ferm=200g), Partes 0:1:1 → FarinhaFerm=100g, ÁguaFerm=100g, Isca=0. Custo_fermento = 100×0,008 + 100×0 = **0,80**; C_fermento = 0,80/200 = **0,004 R$/g**; CustoTotalReceita = 1000×0,008 + 20×0,003 + 700×0 + 0,80 = **8,86** (§3.E, §12).
Exemplo §2.A.1: azeite R$80/1250g → 0,0640 R$/g; 40g → R$2,56.
Bordas/erros:
- Isca com peso > 0 (Partes 1:7:7): custo do fermento **ignora a isca** — só FarinhaFerm + ÁguaFerm somam (§2.B.2, §3.B "Custo da Isca = R$0,00 sempre").
- `packageSize = 0`: **inválido explícito** (§5.C bloqueio "Peso do Produto > 0"). `costPerGram` → `null`, sem `Infinity`; propaga `null` no total.
- `packageSize < 0`: mesmo tratamento → `null` (defensivo).
- `W_ferm = 0` (proporção 0% ou F_total 0): `C_fermento` guard → `0`, sem `NaN` (§5.C).
- Água @R$0/L: contribui 0 (não invalida — `packageSize` do L > 0).
- Normalização: R$8 por 1kg ≡ R$8 por 1000g (mesmo C=0,008); L↔mL densidade 1:1 (§2.A: kg→×1000, L→×1000, mL→×1, g→×1).

### Testes primeiro (issue core)
`src/core/costs.test.ts` (escrever ANTES da implementação):
1. `packageSizeInGrams` — `{_,1250,'g'}`→1250; `{_,1,'kg'}`→1000; `{_,1,'L'}`→1000; `{_,500,'mL'}`→500 (§2.A).
2. `costPerGram` azeite `{80,1250,'g'}`→0.064 (§2.A.1).
3. `costPerGram` farinha `{8,1,'kg'}`→0.008; sal `{3,1,'kg'}`→0.003; água `{0,1,'L'}`→0 (§12).
4. `costPerGram` normalização equivalente: `{8,1,'kg'}` === `{8,1000,'g'}` === 0.008 (§2.A).
5. `costPerGram` `{80,0,'g'}`→`null`, e `Number.isFinite` do resultado nunca vira Infinity; `packageSize` negativo→`null` (§5.C).
6. `ingredientRecipeCost` azeite 40g `{80,1250,'g'}`→2.56 (§2.A.1); farinha 1000g `{8,1,'kg'}`→8; água 700g `{0,1,'L'}`→0; packageSize 0 → `null` (§5.C).
7. `sourdoughCost` golden: flourWeights `[100]`, flours `[100% @R$8/kg]`, água 100g @R$0/L → 0.80 (§3.E, §12).
8. `sourdoughCost` isca ignorada: Partes 1:7:7 com iscaWeight>0 → custo = FarinhaFerm×C + ÁguaFerm×C, isca fora (§2.B.2, §3.B).
9. `sourdoughCost` água @R$0 contribui 0; múltiplas farinhas do fermento somam por P_i (usa `distributeSourdoughFlourWeights`, reuso).
10. `sourdoughCostPerGram` 0.80/200→0.004; `W_ferm=0`→0 sem NaN (§5.C).
11. `totalRecipeCost` golden: ingredientes [farinha,água,sal] + sourdoughCost 0.80 → **8.86 exato** (`toBe(8.86)`) (§3.E, §12).
12. `totalRecipeCost` propaga inválido: um ingrediente com packageSize 0 → `null` (§5.C).
13. Pureza: entradas não são mutadas (§1.6).

### Arquivos a criar
- `src/core/costs.ts` — cabeçalho citando §2.A.1/§2.B.2/§3.E/§5.C; fórmulas comentadas com `§`. Assinaturas (retorno cru, sem arredondar §9; `null` = estado inválido, sem throw):
  - `packageSizeInGrams(cost: PackageCost): number` — kg/L→×1000, mL/g→×1 (densidade 1:1, §2.A). Só converte, não guarda.
  - `costPerGram(cost: PackageCost): number | null` — `pricePaid / packageSizeInGrams`; guard `packageSizeInGrams > 0` senão `null` (§2.A.1, §5.C).
  - `ingredientRecipeCost(weight: number, cost: PackageCost): number | null` — `weight × costPerGram(cost)`; `null` se custo inválido (§2.A.1).
  - `sourdoughCost(flourWeights: number[], flours: readonly SourdoughFlour[], waterWeight: number, waterCost: PackageCost): number | null` — `Σ(flourWeights[i] × costPerGram(flours[i].packageCost)) + waterWeight × costPerGram(waterCost)`; **Isca nunca entra** (§3.E "Custo_fermento = farinhas + água"). `flourWeights` vem de `distributeSourdoughFlourWeights` (reuso, §3.B).
  - `sourdoughCostPerGram(totalCost: number, sourdoughTotalWeight: number): number` — `totalCost / W_ferm`; guard `W_ferm > 0` senão `0` (§3.E, §5.C).
  - `totalRecipeCost(ingredients: readonly Ingredient[], sourdoughCost: number): number | null` — `Σ ingredientRecipeCost(peso, packageCost) + sourdoughCost`; propaga `null` se algum ingrediente inválido (§3.E). **A linha do fermento NÃO está em `ingredients[]`**: seu custo entra só via `sourdoughCost` (= Custo_fermento), nunca por packageCost próprio digitado (§2.A.2, §3.E).
- `src/core/costs.test.ts` — os 13 casos acima.

### Arquivos a modificar
- Nenhum arquivo de código-fonte. `references/architecture.md` (mapa de módulos + linha da suíte) é atualizado pelo agente `escriba`, não por esta issue.

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts` (shape já suficiente; campos derivados já existem — reuso).
- `src/core/sourdough.ts`, `bakers.ts`, `hydration.ts`, `format.ts` (reuso por import; nada a estender).
- `src/core/golden-example.test.ts` (permanece falhando de propósito até o recalc engine, issue 008).
- spec, mockups, design-system, brandbook.

### Ordem de implementação
1. Escrever `costs.test.ts` com os 13 casos (TDD, vermelho).
2. `packageSizeInGrams` → `costPerGram` → `ingredientRecipeCost` (verde casos 1–6).
3. `sourdoughCost` + `sourdoughCostPerGram` reusando `distributeSourdoughFlourWeights` (verde 7–10).
4. `totalRecipeCost` (verde 11–13, golden 8.86 exato).
5. `npm test` verde; conferir pureza (nada mutado, §1.6).

### Segurança e privacidade
Módulo puro: só `number`/interfaces, sem DOM, sem `innerHTML`, sem rede, sem secret, sem localStorage (architecture.md regra #3; §10/§11.1). Nenhum dado de usuário renderizado aqui.
