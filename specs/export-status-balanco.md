# Exportação da métrica Margem (F/C) nos relatórios do Histórico

**Status:** aprovada
**Data:** 2026-07-06
**Changelog:** 2026-07-06 — cliente respondeu P1–P3; proposta promovida a aprovada. P1: rótulo da coluna nova = **"Margem (F/C %)"** (NÃO reusar "Status", que já é a coluna Planejada/Confirmada) — §2.2.1/§2.3.1, com nota de nomenclatura em §2.1.4. P2: XLSX passa a **alinhar planejadas à aba BALANÇO** ("—"/vazio nas colunas de venda + Margem, fora dos Σ) — é mudança de comportamento do export atual (issue 019), §2.2.4/§6. P3: agregado no PDF nos **dois** lugares (tfoot + card "Resumo financeiro") — §2.3.2/§2.3.3. Perguntas em aberto convertidas em decisões travadas (§5).
**Supera:** nenhuma fórmula é alterada (aditivo quanto à métrica). Porém **muda o comportamento** do XLSX `buildHistoryWorkbook` (issue 019) para linhas planejadas na aba "Fornadas" com custos: deixam de gravar Vendido/Faturamento/Lucro/Margem projetados e passam a "—"/vazio, fora dos Σ (§2.2.4/§6) — alinhamento tela↔export.
**Relaciona:** `specs/aba-balanco.md` §2.2 (fórmula do Status), §2.4 (Status agregado ΣF/ΣC), §2.5 P4 (planejadas) e §3 (casos de borda) — **fonte única das regras da métrica, não redefinidas aqui**; v5 §8 (exportação), §7.1 (formatos), §9 (precisão), §14.4–14.6 (agregações, funcionalidades e planejadas do Histórico). Código-alvo: `src/export/xlsx.ts` (`buildHistoryWorkbook`), `src/export/print.ts` (`renderHistoryCostsPrintView`). Dono da métrica: `bakeStatus(totalRevenue, totalCost): number | null` em `src/core/bakes.ts` (issue 045). Convenção de cor: memória `pdf-credit-debit-color-and-financial-debt` (issue 028).

---

## 1. Motivação

Follow-up registrado pelo arquiteto na issue 045 (2026-07-06), ao entregar a aba BALANÇO (`specs/aba-balanco.md`): a métrica **Margem = F/C × 100%** (chamada "Status" na tela da aba BALANÇO, §2.2 daquela spec) passou a existir **só na tela** — a exportação atual do Histórico não a inclui em lugar nenhum:

- **XLSX "Fornadas" com custos** (`buildHistoryWorkbook`) já exporta Data / Receita / Produzido / Vendido / Custo unit. / Preço unit. / Custo total / Faturamento / Lucro — **falta a coluna da Margem F/C**.
- **PDF/impressão Financeiro** (`renderHistoryCostsPrintView`) já traz Data / Receita / Custo / Lucro por linha + Σ no `tfoot` e no card "Resumo financeiro" — **falta a Margem por linha e a Margem agregada ΣF/ΣC**.

Nenhum outro dado financeiro se perde hoje; o gap é exclusivamente essa métrica. A própria `aba-balanco.md` §2.5 já antecipava este follow-up ("se/quando esta visão for exportada para PDF").

> **Nota de rótulo:** na tela (aba BALANÇO) a coluna se chama **"Status"**; no export ela recebe o rótulo **"Margem (F/C %)"** (decisão do cliente, P1 §5) — não se pode reusar "Status" no XLSX porque lá "Status" já é a coluna Planejada/Confirmada preexistente. É a **mesma métrica**, rótulos distintos por contexto para evitar colisão. Ver a nota de nomenclatura em §2.1.4.

## 2. Regra(s)

### 2.1. Fonte única — mesma fórmula, mesmo contrato, mesma função

1. Os exports usam **a mesma fórmula e o mesmo contrato da aba BALANÇO**, sem redefinição: Margem = F/C × 100% por fornada (`aba-balanco.md` §2.2) e Margem agregada = ΣF/ΣC × 100% — razão dos totais, **nunca** média das Margens das linhas (`aba-balanco.md` §2.4).
2. **Reuso obrigatório de `bakeStatus`** (`src/core/bakes.ts`), dono único da métrica: guarda C ≤ 0 → `null`, contrato null≠0. Os exports **não reimplementam** F/C — chamam `bakeStatus(entry.totalRevenue, entry.totalCost)` por linha e `bakeStatus(summary.totalRevenue, summary.totalCost)` para o agregado (o `BakeHistorySummary` de `aggregatePeriod` já exclui planejadas dos Σ, v5 §14.4 — nada a somar de novo).
3. Esta regra segue o padrão já documentado nos cabeçalhos de `xlsx.ts`/`print.ts`: export **não recalcula nada** (regra de ouro 2); a única operação local é formatação/arredondamento de exibição (§9).
4. **Nota de nomenclatura (registro obrigatório, não muda a fórmula):** o rótulo escolhido pelo cliente é **"Margem"**, mas F/C é conceitualmente um **markup sobre o custo**, não a margem clássica sobre faturamento ($(F-C)/F$). O cliente confirmou o rótulo "MARGEM %" na planilha original e agora para o export — esta spec registra a métrica literal F/C pedida. É a **mesma ambiguidade já sancionada** no projeto: issue 041 ("% de lucro" = markup sobre custo) e `aba-balanco.md` §2.2 (a coluna "Status" da tela). Atenção: a métrica **"Margem média (%)"** das agregações da v5 §14.4 (linha "Margem média" já presente nos exports) é **outra métrica** e permanece intocada — a nova coluna "Margem (F/C %)" coexiste com ela, não a substitui.

### 2.2. XLSX — `buildHistoryWorkbook` (`src/export/xlsx.ts`)

1. **Aba "Fornadas", modo com custos** (`includeCosts: true`): nova coluna **"Margem (F/C %)"** inserida **depois de "Lucro (R$)"** e **antes** da coluna existente **"Status"** (Planejada/Confirmada), que permanece com esse nome e conteúdo — sem colisão de rótulo (P1 travado, §5). A ordem espelha a aba BALANÇO, onde a métrica é a última coluna financeira antes da marcação de planejamento.
   - Célula = **número + `numFmt`** (`FMT_PERCENT`, `0.00`), seguindo a decisão de formato 1 da issue 019 (planilha recalculável; o símbolo "%" vive no cabeçalho da coluna, nunca no valor). Ex.: F=120, C=100 → célula `120,00` com formato `0.00`.
   - Valor gravado arredondado a 2 casas na escrita (helper `setNum` existente, §9 — o core permanece em precisão total).
   - **`null` (C ≤ 0) → célula VAZIA**, jamais 0 — mesma decisão de formato 3 da issue 019 (contrato null≠0; o "—" da tela vira célula vazia no XLSX, que é o equivalente já estabelecido nesse meio). `setNum` já implementa isso.
2. **Aba "Fornadas", modo sem custos** (`includeCosts: false`): **Margem NÃO aparece.** O modo sem custos omite todas as colunas financeiras (§2.A.2 da v5, comportamento atual do arquivo); a Margem deriva de C — expor F/C revelaria informação de custo por trás do véu. Decisão registrada: **sem custos ⇒ sem Margem**, em ambos os exports (vale também para §2.3.4).
3. **Aba "Resumo do Período", modo com custos**: nova linha **"Margem (ΣF/ΣC) (%)"** logo após "Margem média (%)", com `bakeStatus(period.totalRevenue, period.totalCost)` — número + `FMT_PERCENT`; ΣC ≤ 0 → célula vazia. Reiterando §2.1.4: "Margem média" (v5 §14.4) é **outra métrica** e permanece intocada — as duas linhas coexistem (rótulos deliberadamente distintos: "Margem média" vs. "Margem (ΣF/ΣC)").
4. **Planejadas na aba "Fornadas" com custos — alinhamento à aba BALANÇO (P2 travado, mudança de comportamento):** o XLSX **hoje** grava, nas linhas planejadas, os valores financeiros **projetados** (Vendido, Custo total, Faturamento, Lucro). A partir desta spec, a linha planejada passa a **espelhar a aba BALANÇO** (`aba-balanco.md` §2.5 P4 e §3): exibe **"—"/célula vazia** nas colunas dependentes de venda — **Vendido, Preço unit., Faturamento, Lucro e Margem** — e mantém preenchidas **Data, Receita, Produzido, Custo unit. e Custo total** (custo projetado, informativo, independe de venda). A linha planejada **não entra** em nenhum Σ. Racional: uma única verdade sobre a mesma fornada entre tela e export.
   - **Escopo verificado no código (`src/export/xlsx.ts`):** a mudança afeta **apenas a aba "Fornadas" de `buildHistoryWorkbook`** (loop de `entries`, hoje linhas 195–208). A aba **"Resumo do Período"** já consome `period`/`aggregatePeriod`, que **já exclui planejadas** dos totais (v5 §14.4) — nada muda ali. O outro workbook, `buildRecipeWorkbook` (receita), **não tem fornadas** e é intocado. Nenhuma outra aba/visão é afetada.
   - **Marcação da planejada:** a coluna "Status" (Planejada/Confirmada) já sinaliza a linha como "Planejada"; mantém-se. (Se no futuro se quiser badge textual, é fora de escopo.)

### 2.3. PDF Financeiro — `renderHistoryCostsPrintView` (`src/export/print.ts`)

1. **Listagem "Fornadas"**: nova coluna **"Margem (F/C %)"** à direita de "Lucro" — rótulo coerente com o XLSX (P1 travado). Se o cabeçalho do PDF ficar apertado, é aceitável abreviar para **"Margem"** (a métrica é inequívoca no contexto do relatório financeiro); registrar essa liberdade de largura, mas o rótulo canônico é "Margem (F/C %)". Uma célula por fornada confirmada com `bakeStatus(entry.totalRevenue, entry.totalCost)` formatado pelo helper `pct` existente (`formatPercent` + "%"; `null` → "—" neutro). O loop atual já **pula linhas planejadas** (`continue` em `entry.planned === true`, v5 §14.4) — nenhum tratamento novo de planejada é necessário na listagem.
2. **`tfoot` "Total"** da listagem (P3 travado, **os dois lugares**): célula de Margem agregada com `bakeStatus(summary.totalRevenue, summary.totalCost)` — razão dos totais (`aba-balanco.md` §2.4), formato `pct`, "—" se ΣC ≤ 0. É o espelho direto do rodapé da tabela BALANÇO na tela.
3. **Card "Resumo financeiro"** (P3 travado, **os dois lugares**): nova linha **"Margem (F/C)"** após "Margem média", com o **mesmo valor** do `tfoot` (mesma chamada a `bakeStatus` sobre o mesmo `summary` — zero conta nova). O card já exibe os três agregados que compõem a métrica (Custo total, Faturamento, Lucro); o cliente confirmou que quer a métrica também aqui.
4. **PDF "Fornadas" sem custos** (`renderHistoryPrintView`): **inalterado** — é ZERO $ por definição (issue 028) e a Margem depende de C; mesma decisão do §2.2.2.
5. **Cor: Margem é percentual → NEUTRO (preto, `--print-text`), sem `.pdf-credit`/`.pdf-debit`.** Mesma regra já aplicada a "Margem média" no próprio arquivo ("% não é fluxo de caixa → neutro") e à convenção da memória issue 028 ("nunca colorir métrica-percentual"). A ressalva da `aba-balanco.md` §2.5 sobre azul-crédito no PDF refere-se aos **valores monetários** (que já estão coloridos hoje), não à Margem.

### 2.4. Formatos (consolidação — v5 §7.1/§9)

| Meio | Rótulo da coluna/linha | Valor válido | `null` (C ≤ 0 ou ΣC ≤ 0) | Planejada |
|---|---|---|---|---|
| XLSX | "Margem (F/C %)" (linha; "Margem (ΣF/ΣC) (%)" no Resumo) | número, 2 casas, `numFmt 0.00` ("%" no cabeçalho) | célula vazia | célula vazia (§2.2.4) |
| PDF | "Margem (F/C %)" ("Margem" se faltar largura) | `formatPercent` pt-BR (vírgula, 2 casas) + "%", ex.: `120,00%` | "—" | (linha nem aparece na listagem financeira) |

Vendas = 0 → Margem **0,00%** exibida/gravada normalmente — `0` é valor válido, distinto de `null` (contrato null≠0; borda 1 da `aba-balanco.md` §3).

## 3. Casos de borda / validações

Herdados integralmente de `aba-balanco.md` §3 (não redefinidos — só o mapeamento para cada meio):

1. **Vendas = 0** → Margem = 0% → XLSX grava `0,00`; PDF exibe `0,00%`. Nunca célula vazia/"—" (0 ≠ null).
2. **C = 0 na fornada** → `bakeStatus` retorna `null` → XLSX célula vazia; PDF "—" neutro. Sem erro, sem NaN.
3. **ΣC = 0 no agregado** (período vazio de custos, ou só planejadas no filtro) → agregado `null` → XLSX "Resumo do Período" célula vazia; PDF "—" no `tfoot` e no "Resumo financeiro". O `aggregatePeriod` com zero confirmadas já produz totais 0 → `bakeStatus(0, 0)` → `null`, coberto pela mesma guarda.
4. **Fornada planejada** → fora de todos os Σ (garantido por `aggregatePeriod`, v5 §14.4 — não re-filtrar) e sem Margem individual: no XLSX a **linha inteira** passa a espelhar a aba BALANÇO — "—"/vazio em Vendido/Preço unit./Faturamento/Lucro/Margem, preenchidos Data/Receita/Produzido/Custo unit./Custo total (§2.2.4); no PDF financeiro a linha planejada segue **ausente** (o loop já a pula). Espelha `aba-balanco.md` §2.5 P4/§3.
5. **Precisão**: arredondamento a 2 casas **só na escrita/exibição** (v5 §9) — `setNum` no XLSX, `formatPercent` no PDF; nenhum arredondamento intermediário.
6. **Específico de export — modo sem custos**: Margem ausente por completo (coluna não existe no XLSX sem custos; PDF Fornadas segue ZERO $). Decisão do §2.2.2.

## 4. Fora de escopo (não pedido)

- Nenhuma mudança na coluna XLSX "Status" (Planejada/Confirmada), que mantém nome e conteúdo — a métrica nova é uma coluna separada "Margem (F/C %)" (P1).
- Nenhuma mudança em `bakeStatus`, na aba BALANÇO ou nas agregações da v5 §14.4 (a linha "Margem média" preexistente fica intocada).
- Nenhum export novo (a spec só adiciona a métrica aos dois relatórios financeiros existentes).
- O alinhamento de planejadas a "—"/fora dos Σ (§2.2.4) restringe-se à **aba "Fornadas" com custos** de `buildHistoryWorkbook`; nenhuma outra aba/workbook é tocada (verificado, §2.2.4).

## 5. Decisões travadas (2026-07-06)

| # | Pergunta | Decisão |
|---|---|---|
| P1 | Nome da coluna nova no XLSX (colisão com "Status" Planejada/Confirmada) | **"Margem (F/C %)"** — NÃO reusar "Status"; alinha ao rótulo "MARGEM %" da planilha original do cliente. Registrada a nota de nomenclatura (F/C = markup sobre custo, não margem clássica; mesma ambiguidade das issues 041 e `aba-balanco.md` §2.2) em §2.1.4. No PDF, rótulo coerente: "Margem (F/C %)" (ou "Margem" se faltar largura de cabeçalho), §2.3.1. |
| P2 | Planejadas no XLSX com custos | **Alinhar à aba BALANÇO**: "—"/vazio em Vendido/Preço unit./Faturamento/Lucro/Margem, preenchidos Data/Receita/Produzido/Custo unit./Custo total, e **fora de todos os Σ** (§2.2.4). É **mudança de comportamento** do export atual, que hoje grava projetados — registrada explicitamente para consistência tela↔export. Escopo verificado: só a aba "Fornadas" com custos; "Resumo do Período" e `buildRecipeWorkbook` intocados. |
| P3 | Margem agregada no PDF | **Nos dois lugares**: `tfoot` "Total" da listagem **e** card "Resumo financeiro" (§2.3.2/§2.3.3), mesmo valor/mesma chamada. |
