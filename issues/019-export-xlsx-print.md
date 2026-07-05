---
id: "019"
titulo: Exportação — XLSX com/sem custos + página de impressão (PDF)
tipo: export
deps: ["008", "013"]
status: done
---

## Contexto
Relatórios (spec §8): XLSX estruturado (não CSV) e "PDF" = página HTML formatada para impressão. Vale para receita E histórico (§14.5).

## O que fazer
- Lib XLSX: decidir aqui entre `exceljs` e `xlsx`/SheetJS (candidatas em architecture.md). Critérios: geração 100% no navegador, zero rede em runtime, manutenção ativa, licença. Consultar doc oficial antes (regras de ouro 1/4); registrar escolha + link no plano.
- `src/export/xlsx.ts`:
  - Receita: abas/seções por categoria (ingredientes, fermento, hidratação, precificação §8); opção com/sem custos (omite colunas financeiras).
  - Histórico: fornadas + agregações do período filtrado; com/sem custos (§14.5).
  - Valores formatados pt-BR (002) OU numéricos com format de célula — decidir no plano.
- `src/export/print.ts` + view de impressão:
  - Botão fixo no topo "Imprimir / Salvar em PDF" (§8); abre página/print stylesheet formatada; `window.print()` SÓ ao clicar — nunca automático (§8).
  - CSS de impressão com tokens do design system (media print).
- Download via Blob (mesmo padrão da 012 — reusar helper, regra de ouro 2).

## Testes exigidos (TDD)
- XLSX receita golden §12: gerar workbook e reler (API da própria lib) → células de F_total 1000, custo total 8,86, preço 7,38 presentes.
- Com/sem custos: versão sem custos não contém colunas financeiras nem R$.
- XLSX histórico: 2 fornadas + summary com totais corretos.
- print: markup gerado contém dados da receita e nenhum script inline; ação só por clique (teste de unidade no gerador de markup, escape verificado).
- Nome de ingrediente com `<b>x</b>` → escapado no HTML de impressão.

## Critérios de aceite
- [x] XLSX abre no LibreOffice/Excel com seções por categoria (§8).
- [x] Opção com/sem custos nos dois relatórios.
- [x] Impressão só por botão; sem diálogo automático (§8).
- [x] Lib escolhida justificada com link da doc oficial.
- [x] Zero rede em runtime; escape de dados do usuário no HTML.

## Referências
- spec §8, §12, §14.5 · architecture.md (candidatas) · docs oficiais exceljs / SheetJS

---

## Plano Técnico

### Decisão da lib XLSX (regra de ouro 1 e 4) — **ExcelJS 4.4.0**

Escolhida **`exceljs`** (não SheetJS/`xlsx`). Um-liner: única das duas com versão
íntegra publicada no npm (lockfile commitável, regra 3), MIT, e geração 100%
browser via `workbook.xlsx.writeBuffer()` → `Blob` (zero rede em runtime, §10/§11.1).

Critérios verificados (consulta ao npm registry + advisories oficiais em 2026-07-05):

| Critério | ExcelJS | SheetJS `xlsx` |
|---|---|---|
| Versão npm / data | 4.4.0 (2023-10-19) | **0.18.5 (2022-03-24) congelada** |
| Licença | MIT | Apache-2.0 |
| Geração 100% browser | `xlsx.writeBuffer()` → Blob | sim |
| Vulnerabilidades | sem CVE alta aberta no uso write-only | **CVE-2023-30533 (High, prototype pollution) + CVE-2024-22363 (ReDoS) sem correção no npm** |
| Correção das CVEs | — | só em 0.19.3/0.20.2, **distribuídas fora do npm (`cdn.sheetjs.com`)** |
| Lockfile / `npm install` | normal | exigiria apontar para CDN próprio (fere regra 3) |

SheetJS foi rejeitada: o único artefato instalável do npm é o 0.18.5 vulnerável;
o fix vive apenas no registro auto-hospedado da SheetJS — incompatível com
`package-lock.json` commitado e "zero vulnerabilidades conhecidas" (regra 3).
Como só **geramos** planilhas (nunca lemos arquivo não-confiável do usuário), o
risco das CVEs de parsing seria baixo, mas a distribuição fora do npm é decisiva.
`exceljs` roda igual em node (Vitest, `xlsx.load(buffer)` relê) e no browser (Vite bundla).

Links oficiais consultados:
- ExcelJS npm/README (browser + `writeBuffer`, MIT): https://github.com/exceljs/exceljs#browser · https://www.npmjs.com/package/exceljs
- SheetJS advisory CVE-2023-30533: https://cdn.sheetjs.com/advisories/CVE-2023-30533
- SheetJS advisory CVE-2024-22363: https://cdn.sheetjs.com/advisories/CVE-2024-22363
- Issue oficial "não publicaremos correção no npm": https://git.sheetjs.com/sheetjs/sheetjs/issues/2961

> Nova devDependency justificada: `exceljs` (regra 1 — XLSX estruturado é
> não-trivial; core de cálculo continua nosso). `package-lock.json` re-commitado.

### Análise do existente

- `src/storage/backup.ts` → `downloadBackupFile()` (linhas 186–199): padrão
  **Blob → `URL.createObjectURL` → `<a download>` → `click()` → `revokeObjectURL`**
  já provado. Reusar via **extração** de um helper genérico `downloadBlob(blob, filename)`
  (regra 2 — não duplicar); `downloadBackupFile` passa a delegar. `readBackupFile` intocado.
- `src/core/recalc.ts` → `recalculate(recipe): { state, summary }` (linha 58):
  fonte única de TODOS os derivados do relatório de receita (custo, preço, hidratação).
  xlsx/print **consomem** `state`+`summary`, nunca recalculam (regra 2, §1.6).
- `src/core/bakes.ts` → `aggregatePeriod(entries, start, end): BakeHistorySummary`
  (linha 106, já filtra `planned` §14.4) e `computeBakeDerived` (linha 67):
  fonte única dos totais do histórico. Reusar direto.
- `src/core/format.ts` → `formatWeight/Percent/Currency/CostPerGram/Date` (§9/§7.1):
  usados **só na página de impressão** (texto pt-BR). No XLSX ver decisão de células abaixo.
- `src/ui/dom.ts` → `h()`/`clear()` (escape automático via `textContent`, nunca
  `innerHTML`): a view de impressão é montada por aqui — zero innerHTML (regra 3).
- `src/core/types.ts` → `Ingredient.category` (`flour|liquid|fat|salt|extra`),
  `RecipeSummary`, `BakeEntry`: modelos prontos; **nenhum campo novo necessário**.
- `references/design-system.css` → tokens `:root`, `.card`, `.btn`, `.page-header .actions`:
  reusados; **sem `@media print` hoje** → adicionar bloco novo (só classes/tokens, `:root` imutável).
- `src/ui/recipesList.ts` (toolbar `.row`, linhas 89–125) e `src/ui/historyView.ts`
  (`.filter-bar`, entries filtradas + `aggregatePeriod`): pontos de wiring dos botões.
- `src/core/format.ts` **não** tem `escapeHtml` (grep confirmou) → criar dono único em `print.ts`.

### Cenários (números da §12 = gabarito)

**XLSX receita — caminho feliz (golden §12):** F_total 1000; Farinha 1000g/100%,
Água 700g/70%, Sal 20g/2%, Azeite 40g/4% (fat), linha Fermento 200g/20%; seção
Hidratação Nominal 70% / Real 72,73% / Farinha Real 1100g; seção Precificação
custo total **8,86**, custo unit 4,43, preço **7,38**, margem 40%, lucro unit 2,95.
- Borda: derivado impossível (`summary.totalCost === null`, Peso Produto ≤ 0 §5.C) →
  célula vazia (não 0, contrato null≠0), nunca `NaN`.
- Borda: N farinhas do fermento (§2.B.3) → seção lista todas.

**XLSX receita sem custos:** mesma planilha sem as 4 colunas financeiras (Preço
Pago, Peso do Produto, Custo/g, Custo) e **sem** a seção Precificação — nenhuma
célula com numFmt de moeda, nenhum "R$".

**XLSX histórico (§14.4/§14.5):** aba "Fornadas" cronológica (todas as entries do
filtro; planejadas com marca de status) + aba/seção "Resumo do Período" com
`aggregatePeriod` (planejadas fora): total produzido, vendido, custo, faturamento,
lucro, margem média %, desperdício %. Ex.: 2 fornadas confirmadas → totais somados.
- Borda: período vazio → resumo com zeros (guarda ÷0→0 já no core), sem crash.

**Impressão (§8):** botão fixo no topo "Imprimir / Salvar em PDF"; clique →
`window.print()`. **Nunca** dispara automaticamente (nem em load, nem em recálculo).
- Borda XSS: ingrediente nomeado `<b>x</b>` / `<script>alert(1)</script>` →
  renderizado como **texto** (via `dom.ts h()`), zero nó `<script>`, zero `innerHTML`.
- Com/sem custos: reusa a pref global `showCosts` (§2.A.2) já persistida.

### Decisões de formato (registrar no cabeçalho dos módulos)

1. **Células XLSX = numéricas + `numFmt`, não strings pt-BR.** Motivo: XLSX
   estruturado (§8) tem de ser recalculável na planilha (todo o ganho sobre CSV);
   o teste golden relê `cell.value` como número (1000, 8.86, 7.38). numFmt por tipo
   (§9): peso `'0.0'`, % `'0.00'`, moeda `'0.00'` (label "R$" no cabeçalho da coluna,
   não no valor — evita virar texto), custo/g `'0.0000'`. O app-planilha localiza a
   vírgula pelo locale; o code de formato ExcelJS usa `.`/`,` que o Excel/LibreOffice traduz.
2. **Valor gravado arredondado à precisão de exibição da §9** (moeda 2 casas → 7,3833
   vira 7,38; peso 1 casa; custo/g 4 casas). Motivo: a planilha é o **relatório** que
   o usuário vê (§8), e §9 fixa a precisão de exibição; assim o golden relê 8.86/7.38
   exatos e as somas exibidas fecham. Helper puro `roundTo(n, casas)` local em `xlsx.ts`
   (não há um exportado); espelha o halfExpand da §9 no domínio ≥0 do app (decisão format.ts).
3. **Página de impressão = DOM via `dom.ts h()`**, montada em container `#print-root`
   estilizado por `@media print` do design system (regra 2, tokens). Zero `innerHTML`
   (regra 3). `escapeHtml` fica como dono único em `print.ts` **apenas** para o caso de
   um builder de string standalone; a via primária (DOM) já escapa por `textContent`.
4. **`window.print()` só em handler de clique** do botão fixo — nunca em código de init.

### Testes primeiro (Vitest — TDD antes da implementação)

`src/export/xlsx.test.ts` (environment **node** default; ExcelJS relê com `xlsx.load`):
1. **golden §12 com custos**: gera workbook de `recalculate(goldenSeed())`, relê
   buffer → existe célula com valor `1000` (F_total), `8.86` (custo total), `7.38`
   (preço venda). (entrada: goldenSeed; saída: números exatos.)
2. **sem custos**: mesma receita, `includeCosts:false` → nenhuma célula de moeda /
   nenhum header "R$" / colunas Preço Pago·Peso Produto·Custo/g·Custo ausentes.
3. **seções por categoria (§8)**: existem rótulos de seção Farinhas, Líquidos,
   Gorduras, Sal/Extras, Fermento, Hidratação (e Precificação só com custos).
4. **derivado null (§5.C)**: receita com Peso do Produto = 0 → célula de custo vazia
   (não 0, não NaN).
5. **histórico 2 fornadas + resumo**: 2 `BakeEntry` confirmadas (via
   `computeBakeDerived`) → aba Fornadas com 2 linhas + resumo com totais de
   `aggregatePeriod` corretos (produzido/vendido/custo/faturamento/lucro).
6. **histórico sem custos**: sem colunas/valores financeiros.

`src/export/print.test.ts` (environment **jsdom**, file-level `// @vitest-environment jsdom`,
precedente decisão 135):
7. **conteúdo**: markup gerado da receita golden contém "1000"/"70"/preço e o nome da receita.
8. **escape XSS (regra 3)**: ingrediente `<b>x</b>` / `<script>alert(1)</script>` →
   nenhum nó `<script>`/`<b>` criado; texto aparece escapado; nenhuma chamada a `innerHTML`.
9. **sem auto-print**: montar a view NÃO chama `window.print` (spy); só o clique no
   botão fixo chama (spy verifica 1 chamada após `click()`).
10. **sem custos**: view sem seção Precificação nem valores de moeda.

`src/storage/backup.test.ts`: manter verde após extrair `downloadBlob` (delegação — sem regressão).

### Arquivos a criar
- `src/export/xlsx.ts` — `buildRecipeWorkbook(recipe, summary, { includeCosts }): ExcelJS.Workbook`
  e `buildHistoryWorkbook(entries, period, { includeCosts })`; `roundTo` privado; seções
  por categoria §8; helpers de coluna com/sem custos. Cabeçalho citando §8/§9/§12/§14.4/§14.5.
- `src/export/xlsx.test.ts` — casos 1–6 acima (node).
- `src/export/print.ts` — `renderPrintView(root, { recipe, summary, includeCosts })` (DOM via
  `dom.ts`); `escapeHtml` dono único; `mountPrintButton(actionsRoot, onPrint)` que só
  chama `window.print()` no clique. Cabeçalho §8/§9.
- `src/export/print.test.ts` — casos 7–10 (jsdom).
- `src/export/download.ts` — `downloadBlob(blob, filename)` (browser-only) + helper
  `workbookToBlob(workbook)` (usa `xlsx.writeBuffer` + MIME
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Sem rede (§10/§11.1).

### Arquivos a modificar
- `src/storage/backup.ts` — `downloadBackupFile` passa a delegar a `downloadBlob`
  (`src/export/download.ts`); nome do arquivo/lógica idênticos (regra 2, sem duplicar Blob).
- `references/design-system.css` — adicionar bloco `@media print` (esconder nav/chrome,
  exibir `.print-root`, quebras de página) usando **só tokens** (`:root` imutável);
  documentar em `references/design-system.html`.
- `src/ui/pages/calculadora.ts` (ou `page-header .actions`) — wiring mínimo: botões
  "Exportar XLSX" e "Imprimir / Salvar em PDF" sobre o `AppState` atual (recipe+summary),
  `includeCosts = prefs.getShowCosts()` (§2.A.2). Download via `downloadBlob`.
- `src/ui/historyView.ts` — na barra de ações: "Exportar XLSX" + "Imprimir / Salvar em PDF"
  sobre entries filtradas + `aggregatePeriod` do período; `includeCosts` (pref ou checkbox).
- `package.json` / `package-lock.json` — nova dependência `exceljs` (não devDep: usada em runtime).
- `references/architecture.md` (mapa de módulos + decisão da lib) e `PROGRESS.md` — via `escriba`.

### Arquivos que NÃO devem ser tocados
- `src/core/*` (recalc, bakes, costs, pricing, hydration, sourdough, bakers, scaling,
  validation, format, types) — export só consome; **nenhum campo novo em `types.ts`**.
- Lógica de `src/storage/recipes.ts`, `prefs.ts`, `bakes.ts`, `local.ts`; e de
  `backup.ts` além da extração do `downloadBlob`.
- `:root` (tokens) do design system — imutáveis (só classes/`@media` novas).
- `src/ui/ingredientsTable/sourdoughTable/hydrationPanel/pricingPanel/batchPanel/…`
  (só recebem botões via page/host, sem alterar seus componentes).

### Ordem de implementação
1. `src/export/download.ts` (`downloadBlob`) + refatorar `backup.ts` p/ delegar; suíte verde.
2. `xlsx.test.ts` (casos 1–6) → `xlsx.ts` até verde (instalar `exceljs`; golden §12 primeiro).
3. `print.test.ts` (casos 7–10) → `print.ts` (DOM + escape + botão só-clique).
4. `@media print` no design-system.css (tokens) + doc.
5. Wiring: botões em `calculadora.ts` e `historyView.ts` (`downloadBlob` + `renderPrintView`).
6. `build` (`tsc --noEmit && vite build`) + `test` completos; `escriba` atualiza architecture/PROGRESS.
