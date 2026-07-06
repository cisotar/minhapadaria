---
id: "049"
titulo: Exportar métrica Margem (F/C) nos relatórios do Histórico (XLSX + PDF Financeiro)
tipo: export
deps: ["019", "028", "043", "045"]
status: todo
---

## Contexto
A métrica **Margem = F/C × 100%** (chamada "Status" na tela da aba BALANÇO, issue
045) existe **só na tela** — a exportação do Histórico não a inclui. Follow-up
registrado pelo arquiteto na 045.

Spec aprovada: `specs/export-status-balanco.md`. **Fonte única das regras** é
`specs/aba-balanco.md` §2.2 (fórmula), §2.4 (agregado ΣF/ΣC), §2.5 P4 + §3
(planejadas/bordas) — **não redefinir aqui**. Dono da métrica: `bakeStatus(totalRevenue,
totalCost): number|null` em `src/core/bakes.ts` (guarda C≤0→null, contrato null≠0)
— **reuso obrigatório, export não recalcula F/C**.

## O que fazer

### XLSX — `buildHistoryWorkbook` (`src/export/xlsx.ts`), modo COM custos
- Nova coluna **"Margem (F/C %)"** depois de "Lucro (R$)" e **antes** da coluna
  "Status" (Planejada/Confirmada) existente — que **permanece** com nome/conteúdo.
- Célula = número + `numFmt` percentual (`0.00`), via `setNum` (arredonda 2 casas
  na escrita; "%" vive no cabeçalho, nunca no valor). `null` (C≤0) → **célula
  vazia**, nunca 0. Vendas=0 → `0,00` (0≠null).
- Aba "Resumo do Período": nova linha **"Margem (ΣF/ΣC) (%)"** após "Margem média
  (%)", com `bakeStatus(period.totalRevenue, period.totalCost)`; ΣC≤0 → vazia.
  ("Margem média" da v5 §14.4 é **outra métrica** e fica intocada — coexistem.)
- **Modo SEM custos: Margem NÃO aparece** (deriva de C; sem custos omite financeiros).

### XLSX — mudança de comportamento nas planejadas (P2, atenção)
- Hoje a aba "Fornadas" com custos grava valores **projetados** das planejadas.
  Passa a **espelhar a aba BALANÇO**: "—"/vazio em **Vendido, Preço unit.,
  Faturamento, Lucro, Margem**; preenchidos **Data, Receita, Produzido, Custo unit.,
  Custo total**; e **fora de todos os Σ**.
- **Escopo verificado (spec §2.2.4)**: só a aba "Fornadas" com custos de
  `buildHistoryWorkbook`. "Resumo do Período" já usa `aggregatePeriod` (planejadas
  fora) — intocado; `buildRecipeWorkbook` não tem fornadas — intocado. Confirmar
  por leitura do código e **não** vazar a mudança pra outras abas.

### PDF Financeiro — `renderHistoryCostsPrintView` (`src/export/print.ts`)
- Listagem "Fornadas": nova coluna **"Margem (F/C %)"** à direita de "Lucro"
  (abreviar "Margem" se faltar largura; rótulo canônico "Margem (F/C %)"). Valor
  por fornada confirmada via `bakeStatus(...)` + helper `pct`/`formatPercent`
  (`null`→"—" neutro). O loop **já pula planejadas** — sem tratamento novo.
- `tfoot` "Total": Margem agregada `bakeStatus(summary.totalRevenue,
  summary.totalCost)` (razão dos totais, "—" se ΣC≤0).
- Card "Resumo financeiro": nova linha **"Margem (F/C)"** após "Margem média",
  **mesmo valor** do `tfoot` (mesma chamada, zero conta nova). — P3: os **dois** lugares.
- **Cor: Margem é percentual → NEUTRO** (`--print-text`), sem `.pdf-credit`/`.pdf-debit`
  (regra da memória issue 028; "% não é fluxo de caixa").
- PDF "Fornadas" sem custos (`renderHistoryPrintView`): **inalterado** (ZERO $).

## Casos de borda (herdados de aba-balanco §3, mapeados por meio — spec §3)
- Vendas=0 → Margem 0% (XLSX `0,00`, PDF `0,00%`), nunca vazio/"—".
- C=0 na fornada → `null` → XLSX vazia, PDF "—".
- ΣC=0 no agregado (só planejadas/período sem custos) → `null` → XLSX vazia, PDF
  "—" no tfoot e no Resumo financeiro.
- Planejada → fora dos Σ (garantido por `aggregatePeriod`, não re-filtrar); XLSX
  linha espelha a aba; PDF financeiro segue pulando a linha.
- Precisão: arredonda 2 casas só na escrita/exibição (`setNum`/`formatPercent`).

## Testes exigidos
- XLSX (`xlsx.test.ts` ou equivalente): coluna "Margem (F/C %)" presente com custos
  e ausente sem custos; valor correto (F/C), `null`→célula vazia, Vendas=0→0;
  linha "Margem (ΣF/ΣC)" no Resumo; **planejada com "—"/vazio nas 5 colunas e fora
  dos Σ** (regressão do comportamento antigo é esperada — atualizar asserções que
  supunham projetados de planejada).
- PDF (`print.test.ts`): coluna Margem na listagem, agregado no `tfoot` E no card
  Resumo financeiro (mesmo valor), "—" quando ΣC≤0, Margem neutra (sem classe de
  cor), PDF sem custos inalterado.
- `tsc` limpo; `npm test` + `npm run build` verdes.

## Critérios de aceite
- [ ] XLSX com custos tem "Margem (F/C %)" após Lucro, antes de "Status"; sem
      custos não tem Margem.
- [ ] Valor = F/C×100 (2 casas, numFmt); `null`→célula vazia; Vendas=0→0,00.
- [ ] "Resumo do Período" tem "Margem (ΣF/ΣC) (%)"; "Margem média" intocada.
- [ ] Planejadas no XLSX com custos: "—"/vazio em Vendido/Preço unit./Faturamento/
      Lucro/Margem, fora dos Σ; só a aba "Fornadas" afetada (Resumo e receita intocados).
- [ ] PDF: coluna Margem na listagem + agregado ΣF/ΣC no tfoot **e** no card Resumo
      financeiro; Margem neutra (sem `.pdf-credit`/`.pdf-debit`); PDF sem custos inalterado.
- [ ] `bakeStatus` reusado (zero recálculo de F/C no export).
- [ ] Suíte inteira verde e build OK.

## Referências
- `specs/export-status-balanco.md` (aprovada, 2026-07-06) · `specs/aba-balanco.md`
  §2.2/§2.4/§2.5/§3 (fonte das regras) · v5 §8/§7.1/§9/§14.4–14.6.
- `src/export/xlsx.ts` (`buildHistoryWorkbook`) · `src/export/print.ts`
  (`renderHistoryCostsPrintView`) · `src/core/bakes.ts` (`bakeStatus`, issue 045) ·
  memória cor issue 028.

## Plano Técnico

### Análise do existente (busca real no código)

**Dono da métrica — reuso obrigatório, zero recálculo (§2.1.2):**
- `src/core/bakes.ts` → `bakeStatus(totalRevenue, totalCost): number | null` (linhas 77–80). Guarda `totalCost <= 0 → null` (contrato null≠0); serve **linha** (F/C da fornada) e **agregado** (ΣF/ΣC, razão dos totais — §2.4 aba-balanco). Ambos os exports importam e chamam esta função; **nenhum export reimplementa F/C**.
- **Cuidado de tipo (verificado em `src/core/types.ts`):** `BakeEntry.totalRevenue/totalCost` são **opcionais** (`number | undefined`, linhas 138–139) — chamadas por-fornada precisam de guarda (`entry.totalRevenue != null && entry.totalCost != null ? bakeStatus(...) : null`). `BakeHistorySummary.totalRevenue/totalCost` são **obrigatórios** (`number`, linhas 151) — o agregado chama `bakeStatus(period.totalRevenue, period.totalCost)`/`bakeStatus(summary.totalRevenue, summary.totalCost)` direto.

**XLSX — `src/export/xlsx.ts` → `buildHistoryWorkbook` (linhas 180–223):**
- Header COM custos (linha 191): `['Data','Receita','Produzido','Vendido','Custo unit. (R$)','Preço unit. (R$)','Custo total (R$)','Faturamento (R$)','Lucro (R$)','Status']` — 10 colunas; "Status" = Planejada/Confirmada (col 10).
- Loop de entries (linhas 195–208): `status = planned ? 'Planejada' : 'Confirmada'`; grava Vendido (array, col 4), unitCost (col 5), unitSalePrice (col 6), totalCost (col 7), totalRevenue (col 8), totalProfit (col 9), status texto (col 10) — **hoje planejada grava projetados** (Vendido/Preço/Faturamento/Lucro).
- `setNum(cell, value, decimals, numFmt)` (linhas 70–74): `null|undefined → return` (célula vazia, contrato null≠0); senão `roundTo(value, decimals)` + `numFmt`. **É exatamente o comportamento que Margem precisa.**
- `FMT_PERCENT = '0.00'` **já existe** (linha 46) — reuso direto para a Margem.
- Aba "Resumo do Período" (linhas 210–221): com custos grava Custo total / Faturamento / Lucro / **"Margem média (%)"** (`period.averageProfitMargin`, linha 218) / Desperdício. `period` vem de `aggregatePeriod`, que **já exclui planejadas** (bakes.ts linha 131) — intocado.
- `buildRecipeWorkbook` (linhas 90–170): **não tem fornadas** — intocado (§2.2.4).

**PDF — `src/export/print.ts` → `renderHistoryCostsPrintView` (linhas 466–526):**
- Card "Resumo financeiro" (linhas 471–481): kv Custo total (débito) / Faturamento (crédito) / Lucro (por sinal) / **"Margem média"** (`pct`, neutro, linha 478).
- Listagem `table.table` header (linhas 485–494): Data / Receita / Custo / Lucro (4 colunas).
- Loop (linhas 496–506): `if (entry.planned === true) continue;` — **já pula planejadas** (nenhum tratamento novo, §2.3.1).
- `tfoot` "Total" (linhas 509–518): Total / vazio / Custo (débito) / Lucro (por sinal).
- Helpers reusáveis: `pct(n: number|null)` (linha 72) → `null → "—"`, senão `formatPercent(n)+"%"` pt-BR 2 casas; `td(text,{num,cls})` escapa via `h()` (§ segurança — sem innerHTML). `renderHistoryPrintView` (Fornadas sem custos, linhas 411–458): **intocado** (§2.3.4).

**Design/cor (memória issue 028):** Margem é percentual → **neutra** (`--print-text`), **sem** `.pdf-credit`/`.pdf-debit`. Espelha "Margem média" (linha 478, já neutra). Nada de novo no design-system.

### Cenários (números concretos — golden = fixtures dos testes)
- **Confirmada lucrativa** (bakeA: produz 2, vende 2, unitCost 4,43, preço 7,38): C=8,86; F=14,76 → `bakeStatus(14.76, 8.86)` = 166,59% (2 casas). XLSX grava `166.59` (numFmt 0.00); PDF `166,59%`.
- **Confirmada** (bakeB: produz 10, vende 8, unitCost 3, preço 6): C=30; F=48 → 160,00%.
- **Agregado ΣF/ΣC** (bakeA+bakeB): ΣF=62,76; ΣC=38,86 → `bakeStatus(62.76, 38.86)` = 161,50%. É **razão dos totais** (§2.4), não média das linhas — XLSX "Resumo do Período" e PDF tfoot+card.
- **Vendas=0** (confirmada, C>0): F=0 → `bakeStatus(0, C)` = 0 → XLSX `0,00` (0≠null, célula preenchida); PDF `0,00%`. Nunca vazio/"—" (borda 1, §3).
- **C=0 na fornada** (unitCost 0): `bakeStatus(F, 0)` → `null` → XLSX célula vazia; PDF "—" neutro (borda 2).
- **ΣC=0 no agregado** (período só planejadas / sem confirmadas): `aggregatePeriod` → totais 0 → `bakeStatus(0,0)` → `null` → XLSX "Resumo" vazia; PDF "—" no tfoot **e** no card (borda 3).
- **Planejada no XLSX com custos**: Data/Receita/Produzido/Custo unit./Custo total preenchidos; Vendido/Preço unit./Faturamento/Lucro/Margem **vazios**; fora dos Σ (herança de `aggregatePeriod`). No PDF financeiro a linha **nem aparece** (loop já pula).
- **Sem custos**: Margem ausente por completo (coluna não existe no XLSX; PDF Fornadas ZERO $ intocado — §2.2.2/§2.3.4).

### Testes primeiro (Vitest — escrever ANTES da implementação)

**`src/export/xlsx.test.ts` (`describe buildHistoryWorkbook`):**
1. **Coluna Margem posicionada** — com custos, header contém `'Margem (F/C %)'` imediatamente após `'Lucro (R$)'` e imediatamente antes de `'Status'` (asserção sobre a ordem das células do header row).
2. **Valor F/C por linha** — bakeA → célula Margem = `166.59` com `numFmt === '0.00'`; bakeB → `160.00`.
3. **null → célula vazia** — fornada confirmada com `unitCost: 0` (C=0) → célula Margem `undefined`/vazia, **nunca 0** (usar padrão do teste 4 existente).
4. **Vendas=0 → 0,00** — confirmada `quantitySold: 0`, unitCost>0 → célula Margem = `0` (não vazia; 0≠null).
5. **Resumo do Período** — linha `'Margem (ΣF/ΣC) (%)'` presente com valor `161.50` (bakeA+bakeB); linha `'Margem média (%)'` **ainda presente** e intocada (coexistem).
6. **Sem custos → sem Margem** — `includeCosts:false` → `allStrings` não contém `'Margem (F/C %)'` nem `'Margem (ΣF/ΣC) (%)'`; header tem só as 5 colunas atuais.
7. **Planejada espelha BALANÇO (comportamento novo)** — entrada `planned:true` com custos: células Vendido/Preço unit./Faturamento/Lucro/Margem **vazias**; Data/Receita/Produzido/Custo unit./Custo total **preenchidas**; e "Resumo do Período" (via `aggregatePeriod`) **não** soma a planejada (totais = só confirmadas).

**`src/export/print.test.ts` (`describe renderHistoryCostsPrintView`):**
8. **Coluna Margem na listagem** — header `table.table` contém `'Margem (F/C %)'` à direita de `'Lucro'`; linha confirmada tem célula Margem com `%`, **sem** `.pdf-credit`/`.pdf-debit` (neutra).
9. **Agregado no tfoot** — linha `'Total'` tem célula Margem = ΣF/ΣC formatada `%`, neutra.
10. **Agregado no card** — "Resumo financeiro" tem linha `'Margem (F/C)'` com **mesmo valor** do tfoot; neutra; "Margem média" continua presente e distinta.
11. **ΣC≤0 → "—"** — set só com planejada (ou confirmadas com unitCost 0) → tfoot Margem = "—" **e** card "Margem (F/C)" = "—".
12. **Planejada segue pulada** — planejada não aparece na listagem financeira (asserção reforço; loop já pula).
13. **PDF Fornadas sem custos inalterado** — `renderHistoryPrintView` não contém `'Margem'`.

### Arquivos a criar
Nenhum.

### Arquivos a modificar
- `src/export/xlsx.ts` — (a) `import { bakeStatus } from '../core/bakes'`; (b) header COM custos: inserir `'Margem (F/C %)'` entre `'Lucro (R$)'` e `'Status'` (col 10; "Status" passa a col 11); (c) loop de entries: para `planned`, gravar vazio em Vendido (col 4, `null` no array), Preço unit. (col 6), Faturamento (col 8), Lucro (col 9) e Margem (col 10); manter Custo unit. (col 5) e Custo total (col 7); Margem confirmada = guarda + `bakeStatus` via `setNum(...,2,FMT_PERCENT)`; `status` texto vai para `getCell(11)`; (d) "Resumo do Período": nova linha `'Margem (ΣF/ΣC) (%)'` com `bakeStatus(period.totalRevenue, period.totalCost)` logo após `'Margem média (%)'` (linha 218), via `setNum(...,2,FMT_PERCENT)`.
- `src/export/print.ts` — (a) `import { bakeStatus } from '../core/bakes'`; (b) listagem: `<th class="num">Margem (F/C %)</th>` após "Lucro"; célula por linha confirmada = `td(pct(guard ? bakeStatus(...) : null), { num: true })` (neutra); (c) `tfoot`: célula `td(pct(bakeStatus(summary.totalRevenue, summary.totalCost)), { num:true })`; (d) card "Resumo financeiro": nova linha `['Margem (F/C)', td(pct(bakeStatus(summary.totalRevenue, summary.totalCost)))]` após "Margem média".
- `src/export/xlsx.test.ts` e `src/export/print.test.ts` — novos casos acima.

### Arquivos que NÃO devem ser tocados
- `src/core/bakes.ts` (`bakeStatus` reusado sem alteração), `src/core/types.ts`, `src/core/format.ts` — core intocado.
- `buildRecipeWorkbook` (xlsx.ts) e `renderRecipePrintView`/`renderRecipeCostsPrintView`/`renderHistoryPrintView` (print.ts) — fora de escopo.
- `references/design-system.css`, `src/ui/historyView.ts` e a aba BALANÇO — Margem neutra reusa token existente; nada de UI/tela.
- `specs/aba-balanco.md` — fonte das regras, **não redefinir**.

### Ordem de implementação
1. Escrever os testes 1–13 (falhando) — TDD.
2. `xlsx.ts`: import `bakeStatus`, header, loop de planejada/Margem, linha do Resumo → verdes os testes 1–7.
3. `print.ts`: import `bakeStatus`, header/célula da listagem, tfoot, card → verdes os testes 8–13.
4. `npx tsc --noEmit` limpo; `npm test` e `npm run build` verdes.

### Regressão de planejadas no XLSX — verificação
Grep confirmou que `buildHistoryWorkbook` só é exercitado nos casos **5 e 6** de `xlsx.test.ts`, ambos com **fornadas confirmadas** (`bakeA`/`bakeB`) — **nenhuma asserção existente supõe projetados de planejada**. Logo a mudança P2 **não quebra teste algum hoje**; ela é coberta pelo **novo** caso 7. No PDF, o loop já pula planejadas e os casos 7/7b existentes usam `>=` em contagem de células coloridas — adicionar coluna neutra não os quebra. Conclusão: sem regressão de suíte; a mudança de comportamento exige cobertura **nova**, não reescrita de asserção antiga.
