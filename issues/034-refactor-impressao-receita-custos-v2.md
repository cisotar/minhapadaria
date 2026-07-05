---
id: "034"
titulo: Refactor impressão Receita/Custos (v2) — cards por seção, fermento reconstruído, coluna custo
tipo: export
deps: ["019", "028", "030"]
status: done
---

## Contexto
Pedido do cliente: refatorar as views de impressão "Salvar em PDF" (§8) a partir de
dois mockups aprovados nesta sessão:
- `mockups/pdf-receita-v2.html` — PDF **Receita** (zero $).
- `mockups/pdf-custos-v2.html` — PDF **Custos** (base = receita v2 + coluna Custo).

Substitui o layout da issue 028 (`mockups/pdf-refactor.html`). Reusa a paleta de
impressão `--print-*` e a semântica de cor contábil de 028 (débito vermelho,
crédito azul). Nenhuma lógica de negócio nova — consome derivados já existentes.

## O que fazer — PDF Receita (`renderRecipePrintView`, print.ts)
1. **Cards por seção** (mockup req 1): cada seção (Farinhas, Líquidos, Sal e Extras,
   Fermento Natural, Hidratação) vira um card com faixa de título (`.sec-card` +
   `.sec-head` + `.sec-body` no mockup) — substitui os `<h2 class="pdf-section">`.
2. **Fermento Natural reconstruído** (req 2): tabela com linhas na ordem
   `Isca → farinha(s) do fermento → Água → Total de fermento` (tfoot, negrito).
   Consome `recipe.sourdough` (`isca`/`parts.isca`, `flours[]`, `parts.water`,
   pesos derivados `iscaWeight`/`flourWeight`/`waterWeight`/`totalWeight`).
   Suporta **múltiplas farinhas** do fermento (`SourdoughFlour[]`, refactor-farinhas).
3. **Coluna Proporção só no Fermento** (req 3): a coluna existe apenas na tabela do
   Fermento, ocupando o **mesmo slot** onde as outras tabelas mostram `%` (req 4:
   colunas `%`/Proporção e Peso alinhadas verticalmente entre todas as seções via
   `table-layout: fixed` + colgroup idêntico). NÃO exibir `%` no fermento.
4. **Rende N pães** (req 5): badge no cabeçalho (`.pdf-yield`) = `recipe.pricing.quantity`.
5. Manter seção **Hidratação** (kv): Nominal, Real, Farinha Real Consumida, Total da massa.

## O que fazer — PDF Custos (`renderRecipeCostsPrintView`, print.ts)
6. Base idêntica à Receita v2 + **coluna Custo à direita da última coluna** em cada
   tabela de seção (custo por ingrediente, débito vermelho `.pdf-debit`). Total por
   seção no tfoot (Farinhas, Fermento). Isca custo sempre `R$ 0,00` (Seção 2.B.2).
7. Substituir a seção Hidratação por **Custo Total** (kv, ambos débito):
   - `Custo da fornada (N pães)` = custo total da receita.
   - `Custo de um pão` = custo total ÷ `pricing.quantity`.
8. **Precificação mantida** após Custo Total (decisão do cliente nesta sessão —
   o mockup a documenta comentada): Preço de venda (crédito), Margem (neutro),
   Lucro por pão + Lucro da fornada (crédito/débito por sinal via `isLoss`), e
   alerta `.pdf-alert` de prejuízo quando `isLoss`.

## Regras transversais
- Escape STRING→DOM 100% via `dom.ts h()`/`textContent` (regra de ouro 3, §11.1).
- Sem recálculo de negócio: subtotais de peso/custo são soma presentacional de
  derivados já calculados (precedente §2.A.2). `isLoss` reusado de `core/pricing`.
- Formatação pt-BR via `core/format.ts` (§9). `null`/impossível → "—" neutro (§5.C).
- CSS novo em `@media print` de `design-system.css` (escopado; `:root` da tela intacto).
- `window.print()` só em clique (§8). Zero rede, zero secret.

## Testes exigidos (TDD — `src/export/print.test.ts`)
- Receita: existe um card/seção por categoria com título; ordem das seções.
- Fermento: linhas na ordem Isca, farinha(s), Água, Total (negrito/tfoot); coluna
  Proporção presente; coluna `%` AUSENTE no fermento; múltiplas farinhas renderizam.
- Alinhamento: todas as tabelas de seção usam o mesmo nº de colunas de dados (slot
  `%`/Proporção + Peso coincidem) — verificar via colgroup/estrutura.
- Rende: badge com `pricing.quantity` no cabeçalho da Receita e dos Custos.
- Custos: coluna Custo à direita em cada seção; isca `R$ 0,00`; total por seção.
- Custo Total: linha fornada = custo total; linha um pão = total ÷ quantity.
- Precificação: presente após Custo Total; prejuízo (`isLoss`) → alerta + cores.
- Segurança: nome de receita/ingrediente com HTML não gera nós (`textContent`).

## Critérios de aceite
- [ ] PDF Receita bate com `mockups/pdf-receita-v2.html` (cards, fermento, proporção, rende).
- [ ] PDF Custos bate com `mockups/pdf-custos-v2.html` (coluna Custo, Custo Total, Precificação).
- [ ] Coluna Proporção só no Fermento, no slot da `%`; colunas alinhadas entre seções.
- [ ] Isca custo `R$ 0,00`; débito vermelho / crédito azul conforme §028.
- [ ] Testes de `print.test.ts` atualizados e verdes; golden §12 intacto.
- [ ] Nomes nunca via `innerHTML`.

## Referências
- mockups/pdf-receita-v2.html · mockups/pdf-custos-v2.html
- spec §8 (impressão/PDF), §9 (formatação), §2.B (fermento/isca), §3.E (precificação)
- src/export/print.ts · src/export/print.test.ts · references/design-system.css
- issue 028 (paleta/semântica de cor) · core/types.ts (Sourdough/SourdoughFlour) · core/pricing (isLoss)

## Plano Técnico

### Análise do existente
Busca real (grep/read) no código e no design-system. Tudo que segue já existe e será REUSADO:

- `src/export/print.ts:129 renderRecipePrintView` e `:202 renderRecipeCostsPrintView` — as duas funções a refatorar. Assinatura `(root, {recipe, summary})` **permanece** → wiring em `src/ui/pages/calculadora.ts:155,164` não muda.
- Helpers em `print.ts`: `td` (`:85`, escape via `h()`), `kvTable` (`:101`), `signedMoneyTd` (`:95`, crédito≥0/débito<0/null→"—"), `pageCard` (`:110`), `section` (`:119`), `CATEGORY_SECTIONS` (`:73`), `bucketOf` (`:81`, `fat`/`extra`→`salt`). Formatadores locais `pct`/`money`/`costPerGram`/`weight` (`:62-68`) com contrato null≠0→`DASH` (`:61`). **`renderHistoryPrintView`/`renderHistoryCostsPrintView` (`:285`,`:337`) continuam usando `pageCard`/`section`/`table.table` — NÃO serão tocados**, logo esses helpers permanecem.
- Fermento em `src/core/types.ts:55 Sourdough`: derivados já preenchidos por `recalculate` em `src/core/recalc.ts:155-166` — `totalWeight`, `iscaWeight`, `flourWeight`, `waterWeight`, `totalCost`, `costPerGram`; e `parts.isca`/`parts.water` (`:50`). Cada `SourdoughFlour` (`:37`) recebe `weight` e `costPerGram` derivados (`recalc.ts:160-163`); `proportion` e `name` são estado puro.
- Custo por linha: ingredientes têm `recipeCost`/`costPerGram` derivados (`recalc.ts:126-127`). **Discrepância mockup×core:** `SourdoughFlour` NÃO tem campo `recipeCost` (só `weight`+`costPerGram`). Para o custo por linha das farinhas/água do fermento REUSO a função pura `ingredientRecipeCost(weight, packageCost)` de `src/core/costs.ts:78` (é a fórmula §2.A.1 do core, não duplicação). Isca = `R$ 0,00` fixo (§2.B.2, `costs.ts:87`). Total do fermento = `sd.totalCost` derivado (equivale à soma das linhas: `costs.ts:91 sourdoughCost`).
- `pricing.quantity` (Rende N) em `types.ts:79`; custo total = `summary.totalCost`, custo/un = `summary.costPerUnit`, preço = `summary.salePrice`, margem = `summary.profitMargin`, lucro/un = `summary.profitPerUnit`, lucro fornada = `summary.totalProfit` (`types.ts:107-122`, todos `number|null`).
- `isLoss(unitCost, salePrice)` de `src/core/pricing.ts:114` — reuso para colorir Lucro por sinal e disparar `.pdf-alert`.
- Formatação: `src/core/format.ts` (`formatPercent` 2 casas, `formatWeight` 1 casa, `formatCurrency` 2 casas). **Não existe formatador de "proporção"** (número livre ≥0, sem casa fixa na §9). Decisão: adicionar `formatProportion(n)` a `format.ts` (Intl pt-BR, `maximumFractionDigits:2`, sem zeros à direita — rende "1"/"3" do seed e "20"/"200" do mockup, com vírgula quando fracionário). Justificativa (regra de ouro 1/2): formatação pt-BR é dona única de `format.ts` (§9); Intl já é a lib consolidada usada lá.
- Design-system: `references/design-system.css:530-612` bloco `@media print` escopado a `#print-root` (que é `display:none` na tela). Já traz tokens `--print-*` (incl. `--print-credit`/`--print-debit`), `.pdf-credit`/`.pdf-debit` (`:584`), `.pdf-alert` (`:587`), `.pdf-meta`, `#print-root .card` (moldura de página). As classes do mockup (`.sec-card`/`.sec-head`/`.sec-body`, `table.rt`+colgroup, `.pdf-head`, `.pdf-yield`) **não existem ainda** → criar dentro desse mesmo bloco (escopadas a `#print-root`, `:root` de tela intacto).
- `src/ui/seed.ts` (`goldenSeed`) é o fixture dos testes via `recalculate(goldenSeed())`.

### Cenários (números concretos = `recalculate(goldenSeed())`)
Seed: F_total = 500×2 = **1.000 g**; fermento 20% → W_ferm **200 g**; `parts {isca:1, water:1}`, 1 farinha `proportion:1` → denominador global 3.

- **Caminho feliz — Receita.** Rende = `pricing.quantity` = **2**. Farinhas: Farinha Branca 100,00% / 1.000,0 g; tfoot Total Farinhas 100,00% / 1.000,0 g. Líquidos: Água 70,00% / 700,0 g. Sal e Extras: Sal 2,00% / 20,0 g, Azeite 4,00% / 40,0 g. Fermento (Proporção | Peso): Isca 1 / 66,7 g · Farinha Branca 1 / 66,7 g · Água 1 / 66,7 g · **tfoot** Total de fermento 3 / 200,0 g. Hidratação: Nominal 70,00%, Real 71,87%, Farinha Real Consumida 1.066,7 g, Total da massa 1.960,0 g. **Zero "R$".**
- **Caminho feliz — Custos.** Mesmas seções + coluna Custo (débito). Farinhas: Farinha Branca R$ 8,00; tfoot Total Farinhas R$ 8,00. Líquidos: Água R$ 0,00. Sal e Extras: Sal R$ 0,06, Azeite R$ 2,56. Fermento: Isca **R$ 0,00** (§2.B.2) · Farinha Branca R$ 0,53 · Água R$ 0,00 · tfoot Total de fermento R$ 0,53 (= `sd.totalCost`). Custo Total: Custo da fornada (2 pães) = `summary.totalCost` **R$ 11,15**; Custo de um pão = `summary.costPerUnit` **R$ 5,58** (ambos débito). Precificação: Preço de venda (un.) **R$ 9,29** (crédito), Margem 40,00% (neutro), Lucro por pão **R$ 3,72** (crédito), Lucro da fornada **R$ 7,44** (crédito). Sem `.pdf-alert`.
- **Borda — múltiplas farinhas do fermento.** `sourdough.flours` com 2+ itens → 2+ linhas entre Isca e Água, cada uma com sua `proportion`/`weight`/custo próprio; tfoot Proporção = isca+Σprop+water, tfoot Peso = `sd.totalWeight`, tfoot Custo = `sd.totalCost`.
- **Borda — Isca 0 (fórmula §12).** `parts.isca:0` → linha Isca "0 / 0,0 g / R$ 0,00" (0 real, não "—").
- **Erro/impossível (§5.C).** `summary.costPerUnit=null` → Custo de um pão = "—" neutro (sem cor, nunca "R$ 0,00"). `costPerGram` de farinha do fermento null (Peso do Produto ≤0) → célula Custo "—" neutra. Fermento inválido → derivados 0 (degrade seguro, sem NaN).
- **Prejuízo.** `salePrice`<`costPerUnit` (via `isLoss`): Lucro por pão e Lucro da fornada em `.pdf-debit`; Preço de venda permanece crédito; `.pdf-alert` "⚠ PREJUÍZO …" após a Precificação.
- **XSS.** `recipe.name`/`ingredient.name`/`flour.name` com `<script>`/`<b>` → só texto (via `td`/`h()`), zero nó.

### Testes primeiro (Vitest — `src/export/print.test.ts`)
Atualizar helpers `tableRow` (`:72`) e seletores para aceitar `table.rt` (hoje só `table.table`). Casos:
1. Receita: existe uma `.sec-card` por categoria não-vazia; `.sec-head` na ordem `Farinhas, Líquidos, Sal e Extras, Fermento Natural, Hidratação`. (substitui os testes 2/2b que checavam `.pdf-section`/`table.table`).
2. Receita: `fat`/`extra` caem em "Sal e Extras" (Azeite+Sal na mesma `table.rt`); sem `.sec-head` "Gorduras".
3. Fermento (Receita): linhas em ordem `Isca, Farinha Branca, Água` no tbody + `Total de fermento` no tfoot (negrito); coluna Proporção presente (valores 1/1/1, total 3); célula `%`/texto "70,00" AUSENTE no card do Fermento; 2 farinhas → 2 linhas.
4. Alinhamento: toda `table.rt` (Receita) tem colgroup com o MESMO conjunto de `col` (`c-name` span=2, `c-pct`, `c-wt`) → mesmo nº de colunas de dados; em Custos idem + `c-cost`.
5. Rende: badge `.pdf-yield` contém `String(pricing.quantity)` (=2) no cabeçalho da Receita e dos Custos.
6. Custos: cada `table.rt` tem coluna Custo à direita (débito); linha Isca = "R$ 0,00" em `.pdf-debit`; tfoot Total Farinhas e Total de fermento com custo; valores R$ 8,00 / R$ 0,53.
7. Custo Total: `kv` com "Custo da fornada (2 pães)" = R$ 11,15 e "Custo de um pão" = R$ 5,58, ambos `.pdf-debit`.
8. null≠0: `costPerUnit=null` → "Custo de um pão" = "—", sem `.pdf-debit`/`.pdf-credit`, sem "R$".
9. Precificação após Custo Total: Preço `.pdf-credit`, Margem neutra, Lucro por pão e Lucro da fornada `.pdf-credit` (feliz). Sem `.pdf-alert`.
10. Prejuízo (`s.salePrice=1; s.costPerUnit=5,58; profitPerUnit/totalProfit<0`): Lucro por pão e Lucro da fornada `.pdf-debit`; `.pdf-alert` com "PREJUÍZO"; Preço segue `.pdf-credit`.
11. Segurança: `recipe.name`/`ingredient.name`/`sourdough.flours[0].name` com `<script>`/`<b>` → `querySelector('script'|'b')` null, `textContent` contém o literal.
- Manter intactos os testes de Histórico (6/7/8c/8d) e clique-só (9→renumerar) — as 4 views de histórico não mudam.
- `src/core/format.test.ts`: adicionar casos de `formatProportion` (1→"1", 3→"3", 20→"20", 1.5→"1,5", 0→"0").

### Arquivos a criar
- Nenhum.

### Arquivos a modificar
- `src/export/print.ts` — reescrever `renderRecipePrintView` e `renderRecipeCostsPrintView` para o layout v2; adicionar helpers privados: `recipePageV2(title, yieldQty, body)` (`section.card` > `.pdf-head` com h1 + `.pdf-meta` + `.pdf-yield`), `secCard(title, contentEl)` (`.sec-card`/`.sec-head`/`.sec-body`), `rtTable({head, rows, foot, withCost})` (constrói `table.rt` + colgroup idêntico via `<col>` com `span="2"` no nome; `<td colspan="2">` nos dados). Importar `ingredientRecipeCost` de `../core/costs` e `formatProportion` de `../core/format`. Adicionar `const proportion = (n)=> formatProportion(n)`. Não alterar as 4 funções/ helpers do Histórico nem `mountPrintButton`.
- `src/export/print.test.ts` — atualizar/adicionar os casos acima; ajustar `tableRow`/seletores para `table.rt`.
- `src/core/format.ts` — adicionar `formatProportion(n): string` (Intl pt-BR, `maximumFractionDigits:2`, sem zeros à direita).
- `src/core/format.test.ts` — casos de `formatProportion`.
- `references/design-system.css` — dentro do bloco `@media print` existente (`:532`), escopado a `#print-root`: `.pdf-head` (flex, border-bottom 2px, e reset de border/margin do `.pdf-meta` interno), `.pdf-yield`, `.sec-card`/`.sec-card > .sec-head`/`.sec-card > .sec-body`, `table.rt`+`col.c-name`/`c-pct`/`c-wt`/`c-cost`+`th`/`td`/`.num`/`tfoot`. Reusar tokens `--print-*` já definidos; adicionar `--print-head-bg:#F1EEE7` ao `#print-root`. **Não** tocar `:root`, `.table`, `.kv` de tela, nem regras do Histórico.

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts`, `recalc.ts`, `costs.ts`, `sourdough.ts`, `pricing.ts` (só consumo — zero recálculo de negócio).
- `renderHistoryPrintView`/`renderHistoryCostsPrintView` e helpers `pageCard`/`section` (Histórico intacto — issue 034 é só Receita/Custos).
- `src/ui/pages/calculadora.ts` e `src/ui/historyView.ts` (assinaturas de render inalteradas → wiring intacto).
- `src/core/golden-example.test.ts` (golden §12 intacto).
- `mockups/*` (fonte da verdade, somente leitura). `:root` de tela em `design-system.css`.

### Ordem de implementação
1. `formatProportion` em `format.ts` + testes (verde).
2. CSS: classes `.pdf-head`/`.pdf-yield`/`.sec-card`/`table.rt` no `@media print` (visual, sem lógica).
3. Testes primeiro: reescrever casos 1-11 de Receita/Custos em `print.test.ts` (vermelho).
4. Helpers `recipePageV2`/`secCard`/`rtTable` em `print.ts`.
5. Reescrever `renderRecipePrintView` (cards, fermento reconstruído, Proporção, Rende) → casos 1-5,11 verdes.
6. Reescrever `renderRecipeCostsPrintView` (coluna Custo, Custo Total, Precificação c/ Lucro por pão + Lucro da fornada, alerta) → casos 6-10 verdes.
7. Suite completa verde (incl. Histórico e golden §12 intocados); conferência visual contra os dois mockups.
