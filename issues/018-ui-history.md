---
id: "018"
titulo: UI Tela de histórico — registro de fornada, filtros, KPIs, gráfico, melhor/pior, órfãs
tipo: ui
deps: ["013", "014"]
status: done
---

## Contexto
Dashboard de fornadas (spec §14; mockup `mockups/historico.html`). Consome integralmente o core 013.

## O que fazer
- `historico.html` + `src/ui/`:
  - Registro rápido (§14.2): receita (select das cadastradas), data (default hoje, formato aaaa-mm-dd §7.1), qtd produzida, qtd vendida, custo unitário e preço (pré-preenchidos da receita, editáveis — snapshots), observações. Validações via 010 (§14.6): vendida ≤ produzida bloqueio; data futura aviso + badge "planejada".
  - Listagem cronológica, recentes primeiro, com editar/excluir (confirmação) (§14.5).
  - Filtros: por receita, por intervalo custom, granularidade dia/semana/mês (§14.4/14.5).
  - KPIs do período (§14.4): produzidos, vendidos, custo, faturamento, lucro, margem média, desperdício médio — planned fora.
  - Comparação período atual vs anterior com variação % (§14.5).
  - Melhor/pior dia/semana/mês por lucro (§14.5).
  - Gráfico de tendência faturamento+lucro (§14.5): lib consolidada leve client-side (candidatas: Chart.js, uPlot; critério: zero rede em runtime, bundle razoável) OU SVG próprio se o plano julgar mais simples — decidir no plano com doc oficial consultada (regras de ouro 1/4).
  - Órfãs: badge "receita excluída", registro visível (§14.7).
  - Confirmar fornada planejada → entra nos totais (§14.6).
- **Escape XSS**: observações e nomes renderizados via textContent (campo de texto livre! §14.2).

## Critérios de aceite
- [ ] Registro→listagem→agregação ponta a ponta consistente com o core 013.
- [ ] Planejada: badge, fora dos KPIs, confirmável.
- [ ] Vendida > produzida bloqueada na UI.
- [ ] Gráfico renderiza com 0, 1 e N fornadas sem crash.
- [ ] Observação `<script>alert(1)</script>` inerte.
- [ ] Datas aaaa-mm-dd; strings pt-BR; fiel ao mockup.

## Referências
- spec §5.D, §7.1, §14 · mockups/historico.html · docs oficiais da lib de gráfico escolhida

---

## Plano Técnico

### Decisão do gráfico — SVG próprio (sem lib)

**O mockup `mockups/historico.html` já desenha o gráfico como SVG inline** (`<svg class="chart-svg" viewBox="0 0 600 220">` com `<line class="gridline">`, `<path class="line-revenue/line-profit">`, `<circle class="dot-revenue/dot-profit">` + `<title>` para tooltip nativo, `<text class="axis-label/direct-label">`). **E `references/design-system.css` (linhas 380–388) já exporta TODAS as classes** do gráfico (`.chart-svg .gridline/.axis-label/.line-revenue/.line-profit/.dot-revenue/.dot-profit/.direct-label`) + tokens `--mark-revenue`/`--mark-profit` (linhas 48–49). Só falta gerar os nós SVG a partir dos dados.

Comparação (regra de ouro 1/4, docs oficiais consultadas):
| Opção | Bundle | Rede runtime | Fidelidade ao mockup | Veredito |
|---|---|---|---|---|
| **SVG próprio** | 0 kB (é só DOM via `dom.ts`) | zero | 1:1 (o mockup JÁ é este SVG) | **ESCOLHIDA** |
| uPlot | ~48 kB min ([github.com/leeoniya/uPlot](https://github.com/leeoniya/uplot)) | zero (import local ok) | reconstruir o visual | rejeitada |
| Chart.js v4 | ~254 kB / ~117 kB gzip ([bundlephobia](https://bundlephobia.com/package/chart.js-v2), [chartjs.org tree-shaking](https://www.chartjs.org/docs/latest/getting-started/integration.html)) | zero (ESM local) | usa `<canvas>` — diverge do SVG do mockup, sem tooltip acessível grátis | rejeitada |

Justificativa (uma linha): o gráfico é 2 séries × poucos pontos (linha+dots+gridlines+labels) — trivial em SVG; qualquer lib seria dependência nova para reconstruir um visual que o mockup e o design system já entregam prontos, violando reuso máximo. `svg`/`path`/`circle`/`text` precisam de `createElementNS('http://www.w3.org/2000/svg', …)` — **estender `dom.ts` com um helper `svg(tag, attrs, children)`** (namespace SVG), dono único, sem `innerHTML`.

### Análise do existente (busca real no código + design system)

Reuso total — quase tudo já existe; esta issue é wiring de DOM (regra de ouro 2):

- **`src/core/bakes.ts` (issue 013, completo)** — consome integralmente: `computeBakeDerived` (§14.3, preenche totalCost/Revenue/Profit/wastage/wastageRate por fornada), `aggregatePeriod` (§14.4, **já filtra `isPlanned` antes de somar**), `groupByDay/Week/Month` (§14.4, chaves aaaa-mm-dd), `filterByRecipe`/`filterByDateRange` (§14.5, inclusivo nas bordas), `percentVariation`/`comparePeriods` (§14.5, anterior 0→null), `bestPeriod`/`worstPeriod` (§14.5, lucro; vazio→null), `isPlanned`/`confirmPlanned` (§14.6), `isOrphan(entry, ReadonlySet<recipeId>)` (§14.7). **Zero fórmula nova na UI.**
- **`src/storage/bakes.ts` (issue 013)** — `createBakeStore({storage, now, newId})`: `list/get/listByRecipe/create(seed)/update/remove/replaceAll`. É o CRUD do registro/edição/exclusão.
- **`src/storage/recipes.ts` (issue 011)** — `createRecipeStore`: `list()` popula o `<select>` de receitas do form e do filtro; o `Set` de `recipe.id` alimenta `isOrphan`; `get(id)`+`recalculate` pré-preenche custo/preço unitário no form (§14.2).
- **`src/core/recalc.ts` (issue 008)** — `recalculate(recipe)` → `summary.pricing.unitCost` e `summary.pricing.salePrice` para pré-preencher os snapshots do form (§14.2).
- **`src/core/validation.ts` (issue 010)** — `validateQuantityProduced` (≥1 §14.6), `validateQuantitySold(sold, produced)` (bloqueio vendida>produzida §5.D/§14.6), `validateBakeDate(date, today)` (futura→aviso "planejada" §14.6), `validateNonNegative` (custo/preço ≥0 §14.6). `today` é **injetado** — nunca `new Date()` interno.
- **`src/core/format.ts` (issue 002)** — `formatCurrency/formatPercent/formatWeight`, `formatDate` (aaaa-mm-dd §7.1, getters locais), `parseDecimal` (vírgula ou ponto §7.1). **Falta `parseLocalDate` — criar aqui (ver abaixo).**
- **`src/ui/dom.ts` (issue 014)** — `h/clear/on` (escape XSS via `textContent`, nunca `innerHTML`). **Estender com `svg()` (namespace SVG).**
- **`src/ui/cellHelpers.ts` (issue 015/017)** — `applyValidation` (bloqueio reverte + erro/aviso, reuso no form), `marginChipClass(marginStatus)` (chip da tabela §4).
- **`src/ui/recipesList.ts` (issue 017)** — **molde exato** para: injeção de `deps` (`confirm`/`navigate`/`alert` + stores + `now`), região de status `role="status" aria-live="polite"`, montagem testável em `root`, divergências conscientes documentadas (ex.: "Abrir"→`index.html`).
- **`src/ui/pages/historico.ts`** — hoje só importa o CSS; vira composition root.
- **`references/design-system.css` — NENHUMA classe nova é necessária.** Já existem: `.filter-bar`/`.field`/`.period-toggle`(+`.active`) (349–359), `.kpi-row`/`.kpi-tile`(`.label`/`.value`/`.delta.up`/`.delta.down`) (362–377), `.best-worst`/`.card-mini`/`.best`/`.worst` (449–458), `.chart-legend`/`.swatch-dot` (380–381), `.chart-svg .*` (382–388), `.table`(+`.show-costs .cost-col`, `.num`) (237–275), `.planned`/`.badge-planned` (289–293), `.chip`/`.chip-ok/warn/crit` (223–231), `.loss` (234). **Zero edição em design-system.css/html** (evita revisão guardião-design).

### Datas — regra crítica (decisão 013.2, issue 021)

`<input type="date">.value` é a string `'aaaa-mm-dd'`. **Nunca** `new Date('2026-07-08')` — o construtor trata `aaaa-mm-dd` como **UTC meia-noite**; em fuso do Brasil (UTC−3) vira `2026-07-07 21:00` local e `getDate()` retorna **07**, deslocando o dia. Simétrico ao alerta já documentado em `formatDate`.

- **Criar `parseLocalDate(s: string): Date` em `format.ts`** (dono único, regra 2): `const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d);` → meia-noite **local**. Round-trip garantido: `formatDate(parseLocalDate('2026-07-08')) === '2026-07-08'`.
- Fluxo: ler `input.value` → `parseLocalDate` → `BakeEntry.date` (Date local). Escrever de volta: `input.value = formatDate(entry.date)`. Comparações de dia (`validateBakeDate`, filtros) já usam `formatDate` lexicográfico — consistente.
- **`today` injetado** em toda a árvore via `deps.now: () => Date` (default `() => new Date()`); default do campo Data = `formatDate(now())`.

### Buckets planejados (decisão para issue 021)

`aggregatePeriod` já exclui `planned` dos totais, mas `groupBy*` **bucketiza todas as entries** — um bucket só-planejadas viraria summary com zeros (bucket-fantasma). Para gráfico, KPIs e melhor/pior: **pré-filtrar `entries.filter(e => !isPlanned(e))` ANTES de agrupar** (§14.4 "planned fora de todas as agregações"). A tabela (§14.5) lista TODAS as fornadas, planejadas inclusive (com badge).

### Cenários (números concretos do mockup `historico.html`, gabarito da tela)

Fixture do período 2026-06-28 – 2026-07-03, hoje = 2026-07-05 (memória):
- **Caminho feliz (KPIs §14.4):** Produzido 130, Vendido 115, Custo total R$ 496,00, Faturamento R$ 753,00 (↑12% vs anterior), Lucro R$ 257,00 (↑8%), Margem média 34,1%, Desperdício 11,5% (↓3pp). Comparação vs semana anterior 2026-06-21 – 2026-06-27 (§14.5).
- **Melhor/pior (§14.5):** Melhor dia 2026-07-03 lucro R$ 61,00; Pior dia 2026-07-01 lucro R$ 18,00.
- **Gráfico:** 6 pontos/dia, séries Faturamento (73,3…39,6 no viewBox) e Lucro; tooltip nativo `<title>` "06-28 · Faturamento R$ 120,00"; direct-label no último ponto.
- **Tabela cronológica (recentes primeiro):** 2026-07-03 Pão Rústico (24/22, lucro R$ 61,00, chip `.chip-ok` "Margem 38,6%"); 2026-07-01 Pão de Centeio (12/7, `.loss` −R$ 4,10, chip `.chip-crit` "Prejuízo").
- **Borda — planejada:** 2026-07-08 (futura vs hoje 07-05) Pão Rústico 30/—, linha `.planned`, `.badge-planned` "◌ Planejada — fora dos totais", **fora dos KPIs/gráfico/melhor-pior**, botão "Confirmar" → `confirmPlanned` → passa a contar (§14.6).
- **Borda — 0 fornadas:** KPIs "0 pães"/"R$ 0,00"/"—"; melhor/pior ocultos ou "—"; gráfico renderiza só gridlines/eixos, **sem crash** (critério de aceite).
- **Borda — 1 fornada:** gráfico 1 dot por série (sem `path` de linha ou `path` degenerado M=L), KPIs = essa fornada; comparação sem período anterior → variação "—" (`percentVariation` anterior=0→null).
- **Borda — órfã (§14.7):** `recipeId` inexistente → `isOrphan` true → exibe `recipeName` (snapshot) + badge "receita excluída"; registro visível; edição preserva.
- **Erro — vendida > produzida:** bloqueio no form (`validateQuantitySold`), reverte campo + mensagem pt-BR; não persiste.
- **Erro — produzida < 1 / custo ou preço negativo:** bloqueio (`validateQuantityProduced`/`validateNonNegative`).
- **Segurança — XSS:** `notes` = `<script>alert(1)</script>` e `recipeName` renderizados via `textContent` (dom.ts) → inertes (critério de aceite).

### Testes primeiro

**Core (TDD-first, `format.test.ts` — node):**
- `parseLocalDate('2026-07-08')` → `new Date(2026, 6, 8)` (dia local 8, não 7).
- `parseLocalDate` round-trip: `formatDate(parseLocalDate('2026-02-28')) === '2026-02-28'`.
- `parseLocalDate('2026-01-01')` → `getFullYear()===2026 && getMonth()===0 && getDate()===1`.

**UI (jsdom, `@vitest-environment jsdom`, molde recipesList.test.ts — montagem `createMemoryStorage + createBakeStore + createRecipeStore + deps{now,confirm,navigate,alert}`):**

`bakeForm.test.ts`
- Select de receitas populado de `recipeStore.list()`; escolher receita pré-preenche `unitCost`/`unitSalePrice` de `recalculate(recipe).summary` (§14.2). Entrada: golden §12 → unitCost 4,43, salePrice 7,38.
- Data default = `formatDate(now())` com `now` injetado fixo 2026-07-05 → input.value `"2026-07-05"`.
- Vendida 12, Produzida 10 → bloqueio, campo revertido, mensagem "não pode exceder a produzida" (§5.D).
- Produzida 0 → bloqueio "no mínimo 1".
- Custo −1 → bloqueio não-negativo.
- Data 2026-07-08 (futura, now 07-05) → aviso "planejada"; entry criada com `planned:true` via `bakeStore.create`.
- Submeter válido → `bakeStore.create` chamado com `date` = `parseLocalDate(input.value)` (dia local correto).
- `notes` `<script>alert(1)</script>` → sem nó `<script>` no DOM (textContent).

`trendChart.test.ts`
- 0 summaries → SVG com gridlines/axis, **0** `.dot-revenue`/`.dot-profit`, sem crash.
- 1 summary → 1 `.dot-revenue` + 1 `.dot-profit`, sem `<path class="line-*">` (ou path degenerado), sem crash.
- N=6 summaries → 6 dots por série, `path` com 6 vértices, `<title>` por dot com data+valor formatado (`formatCurrency`).
- Escala Y a partir do máximo faturamento (mapeamento viewBox correto para o maior valor).

`historyView.test.ts`
- Filtro por receita → `filterByRecipe` restringe tabela+KPIs (spy).
- Filtro intervalo De/Até (via `parseLocalDate`) → `filterByDateRange` inclusivo bordas.
- Toggle Dia/Semana/Mês → `groupByDay/Week/Month` alimentam gráfico/melhor-pior.
- KPIs excluem planejada: fixture com 1 planejada não altera totais (§14.4).
- Comparação período anterior: variação % renderizada; anterior vazio → "—".
- Melhor/pior por lucro renderizados; 0 fornadas → ocultos.
- Tabela ordena recentes-primeiro; órfã (recipeId ausente do Set) → badge "receita excluída".
- Excluir fornada → `confirm` injetado retorna true → `bakeStore.remove` chamado (spy); false → não remove.
- Confirmar planejada → `confirmPlanned` + `bakeStore.update`; entra nos KPIs no re-render.

### Arquivos a criar
- `src/ui/bakeForm.ts` — form de registro rápido §14.2 (select receita, data, produzida, vendida, custo unit., preço unit., observações), pré-preenchimento via `recalculate`, validações §14.6/§5.D via `cellHelpers.applyValidation`. Deps injetáveis. Zero fórmula.
- `src/ui/bakeForm.test.ts` — casos acima (jsdom).
- `src/ui/trendChart.ts` — gerador SVG faturamento+lucro (§14.5): recebe `BakeHistorySummary[]` → nós SVG via `dom.svg`. Puro de dados, sem store. Classes do design system.
- `src/ui/trendChart.test.ts` — 0/1/N pontos (jsdom).
- `src/ui/historyView.ts` — orquestrador: filtros (§14.4/14.5), KPIs+comparação (§14.4/14.5), melhor/pior (§14.5), tabela cronológica com editar/excluir confirmado (§14.5), badge planejada/órfã (§14.6/14.7), confirmar planejada. Hospeda `bakeForm` e `trendChart`. Deps injetáveis.
- `src/ui/historyView.test.ts` — casos acima (jsdom).

### Arquivos a modificar
- `src/core/format.ts` — adicionar `parseLocalDate` (dono único de parse de data §7.1; simétrico a `formatDate`).
- `src/core/format.test.ts` — 3 casos `parseLocalDate` (TDD-first).
- `src/ui/dom.ts` — adicionar `svg(tag, attrs, children)` (namespace SVG, mesmo contrato seguro de `h`).
- `src/ui/pages/historico.ts` — composition root: instanciar `createBakeStore`+`createRecipeStore`+`defaultStorage`, `deps` (now/confirm/navigate/alert), chamar `renderHistoryView(app, deps)`.
- `historico.html` — shell real espelhando `index.html`/`receitas.html`: `<nav class="app-nav">` (Histórico ativo), `<header class="page-header">` (h1 "📊 Histórico de Fornadas"), `<div id="app" class="page">`, `<script type="module" src="/src/ui/pages/historico.ts">`. Sem CDN, sem `<style>` inline, sem `<link>` a fontes externas em runtime (offline §10) — o mockup atual carrega Google Fonts, o HTML de produção não.

### Arquivos que NÃO devem ser tocados
- `src/core/bakes.ts`, `src/storage/bakes.ts`, `src/storage/recipes.ts`, `src/core/recalc.ts`, `src/core/validation.ts`, `src/core/pricing.ts` — consumidos como estão; nenhuma fórmula nova na UI.
- `references/design-system.css` e `.html` — todas as classes já existem; **não criar classe nova** (nenhum `<style>` inline em src/).
- Demais telas: `index.html`, `receitas.html`, `src/ui/pages/{calculadora,receitas}.ts`, `src/ui/{ingredientsTable,sourdoughTable,hydrationPanel,pricingPanel,batchPanel,scalePanel,modeToggle,recipesList}.ts`.
- `mockups/historico.html` — referência; não editar.

### O que NÃO fazer
- **NÃO** `new Date('aaaa-mm-dd')` em lugar algum (UTC → desloca dia); sempre `parseLocalDate` para ler e `formatDate` para escrever.
- **NÃO** gravar `date` como ISO UTC meia-noite; persistir a data local do padeiro (decisão 013.2).
- **NÃO** adicionar lib de gráfico (Chart.js/uPlot) — SVG próprio.
- **NÃO** `innerHTML`/`insertAdjacentHTML` com dado do usuário (`notes`/`recipeName`); só `textContent`/`dom.h`/`dom.svg` (regra de ouro 3).
- **NÃO** incluir fornadas `planned` em KPIs, gráfico ou melhor/pior — pré-filtrar antes de agrupar.
- **NÃO** deletar a fornada quando a receita é excluída (§14.7, sem cascade) — vira órfã visível.
- **NÃO** duplicar agregação/validação/formatação — reusar bakes.ts/validation.ts/format.ts.
- **NÃO** implementar exportação XLSX aqui (botão "Exportar" do header) — é da issue 019; deixar stub/desabilitado ou seguir HTML→impressão só se trivial, sem bloquear.
- **NÃO** editar tokens `:root` nem criar classe fora de design-system.css.

### Ordem de implementação
1. `format.ts`: `parseLocalDate` + testes (TDD-first, node).
2. `dom.ts`: helper `svg()`.
3. `trendChart.ts` + testes (0/1/N) — isolado, sem store.
4. `bakeForm.ts` + testes — registro §14.2 com validações e pré-preenchimento.
5. `historyView.ts` + testes — filtros, KPIs, comparação, melhor/pior, tabela, hospeda form+chart.
6. `historico.html` shell + `pages/historico.ts` composition root; verificação manual (`npm run dev`, aba Network vazia §10, mockup 1:1).

### Riscos
- **Fuso/data (alto):** todo o produto depende de `parseLocalDate`; um único `new Date(str)` desloca o dia. Mitigação: dono único em format.ts + teste de round-trip; comparações sempre por `formatDate` lexicográfico.
- **Bucket-fantasma planned (médio, issue 021):** pré-filtrar `isPlanned` antes de agrupar; garante KPIs/gráfico/melhor-pior sem zeros espúrios.
- **Comparação de período anterior (médio):** exige computar janela anterior (mesma largura, deslocada) — derivar de De/Até via `parseLocalDate`; `percentVariation` anterior=0→null renderiza "—".
- **Escala do gráfico (baixo):** mapear valores→viewBox com máximo dinâmico; 0/1 ponto sem crash (coberto por teste).
- **Botão "Exportar" (baixo):** fora do escopo (issue 019); não bloquear o critério de aceite.
