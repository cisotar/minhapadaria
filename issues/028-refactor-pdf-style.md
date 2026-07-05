---
id: "028"
titulo: Refactor — estilo dos PDFs (visual tipo tela) + split Receita/Custos
tipo: export
deps: ["019", "027"]
status: done
---

## Contexto

Hoje "PDF" (issue 019) = `window.print()` + `@media print` (`references/design-system.css:515-557`),
sem lib de PDF. Layout impresso atual é lista rótulo→valor (`.print-line`), **não**
reaproveita `.card`/`.table` da tela — só herda cores/fontes dos tokens de marca
(`--primary` verde-floresta, `--text-2` chocolate, `--danger` ferrugem).

Pedido do usuário (2026-07-05): refatorar o estilo de **todos** os PDFs para
parecerem com os cards/tabelas que o usuário já vê na tela, com fundo branco e
fontes de alto contraste (preto, azul escuro, vermelho) — paleta dedicada de
impressão, distinta da paleta de marca (§ "Direção visual" abaixo). Decisão
confirmada com o usuário: **2 PDFs separados** por contexto (Receita e Custos;
mesmo split no Histórico) em vez de 1 PDF com seção de custo condicional.

## O que fazer

- Nova paleta de impressão em `references/design-system.css` (tokens `--print-*`,
  só dentro do bloco `@media print` — `:root` de tela continua imutável, regra
  de ouro do projeto): fundo branco, texto preto, títulos azul-escuro, alertas/
  totais financeiros em vermelho. Ver tabela de tokens abaixo.
- `src/export/print.ts`: substituir `.print-line` por markup `.card`/`.table`
  (mesma estrutura de `thead`/`tbody`/`tfoot` da tela) dentro de `#print-root`.
  Split em 4 funções de render (2 pares, mesma ideia do split já existente
  receita/histórico):
  - `renderRecipePrintView` — Receita (ingredientes/proporções/totais, **zero
    coluna financeira**).
  - `renderRecipeCostsPrintView` — Custos (custo/g, custo por ingrediente,
    precificação, prejuízo).
  - `renderHistoryPrintView` — Fornadas (produção/vendas, **zero $**).
  - `renderHistoryCostsPrintView` — Financeiro do período (custo, faturamento,
    lucro, margem, prejuízo por fornada).
- Botões de ação: cada tela ganha 2 botões de imprimir (Receita/Custos na
  calculadora; Fornadas/Financeiro no histórico) — reusar `mountPrintButton`
  parametrizado por view + gate do botão "Custos"/"Financeiro" pela pref
  `showCosts` já existente (§2.A.2), igual ao gate atual de colunas.
- Zero `innerHTML` (regra de ouro 3, escape via `dom.ts h()`); zero recálculo
  (regra de ouro 2, só consome `state`/`summary`/`aggregatePeriod`).

## Testes exigidos (TDD)

- Cada uma das 4 funções: markup contém os dados esperados (golden §12) e
  nenhuma coluna/valor da categoria oposta (Receita nunca tem "R$"; Custos
  sempre tem).
- Escape XSS mantido (ingrediente `<b>x</b>`/`<script>` → texto, zero nó).
- `window.print()` só por clique, nunca automático (regressão do contrato atual).
- Botão "Custos"/"Financeiro" some quando `showCosts` é `false` (novo — gate
  por botão, não só por coluna).
- Snapshot de classes: markup usa `.card`/`.table`/`thead`/`tfoot` (não mais
  `.print-line`/`.print-section`) — trava a migração de layout.

## Critérios de aceite

- [ ] 4 PDFs distintos, cada um só com o botão pertinente na tela.
- [ ] Visual = cards com tabela (thead/tfoot), igual ao padrão da tela.
- [ ] Fundo branco; preto é a cor padrão de TUDO (títulos, labels, %, peso,
      datas, margem); azul-escuro só em valor de CRÉDITO (entrada de dinheiro);
      vermelho só em valor de DÉBITO (saída de dinheiro/prejuízo) — só via
      tokens `--print-*` novos.
- [ ] Receita/Fornadas nunca mostram valor monetário; Custos/Financeiro sempre.
- [ ] Zero regressão nos contratos existentes (escape, clique-só, `null≠0`→"—").

## Referências

- spec §8, §9, §14.5 · issue 019 (base) · issue 027 (achados anteriores) ·
  `src/export/print.ts`, `src/ui/ingredientsTable.ts` (estrutura de tabela-
  modelo), `src/ui/pricingPanel.ts` (estrutura do card de precificação),
  `references/design-system.css:515-557` (`@media print` atual) ·
  `mockups/pdf-refactor.html` (mockups HTML dos 4 PDFs, aprovar antes do
  `arquiteto`/`dev-ui`)

---

## Direção visual — paleta dedicada de impressão

Paleta de marca (verde-floresta/oliva/creme/caramelo) fica só na tela. No PDF,
o pedido é priorizar **legibilidade/impressão em preto-e-branco/contraste** com
semântica contábil: **preto é a cor padrão de tudo** (títulos, `th`, labels, %,
peso, data, margem — qualquer coisa que não seja um valor monetário de entrada/
saída); azul-escuro marca só **crédito** (dinheiro entrando: preço de venda,
faturamento, lucro positivo); vermelho marca só **débito** (dinheiro saindo:
custo/g, custo por ingrediente, custo total, custo por unidade, e lucro quando
negativo/prejuízo). Tokens novos, escopados a `@media print` (`:root` de tela
intocado):

| Token | Valor | Uso |
|---|---|---|
| `--print-bg` | `#FFFFFF` | fundo da página e dos cards |
| `--print-text` | `#111111` | **padrão de tudo**: títulos, `th`, labels, nomes, %, peso, data, margem |
| `--print-border` | `#B8B8B8` | linha entre `td` |
| `--print-border-strong` | `#333333` | linha abaixo do `thead`, acima do `tfoot` |
| `--print-credit` | `#0B2E59` (azul-escuro) | só valor de CRÉDITO: preço de venda, faturamento, lucro (se positivo) |
| `--print-debit` | `#B3261E` (vermelho) | só valor de DÉBITO: custo/g, custo por ingrediente, custo total, custo/unidade, lucro (se negativo/prejuízo) |
| `--print-muted` | `#5A5A5A` | rodapé de página, data de geração, notas pequenas |

Tipografia: mantém `--font-sans` (Inter) da marca — só a cor de valores
crédito/débito muda, tudo o mais (inclusive `h1`/`h2`/`th`) é `--print-text`
(preto). Valores numéricos `font-variant-numeric: tabular-nums`.

**Nota (2026-07-05):** registros financeiros do Histórico (`bakes.ts`/
`aggregatePeriod`) ficam como estão por ora — melhoria maior é trabalho
futuro, fora do escopo desta issue (só o estilo do PDF muda aqui).

## Mockups (texto) — um por PDF

Convenção: `[preto]` = `--print-text` (padrão — títulos, `th`, labels, %,
peso, data, margem, tudo que NÃO é fluxo de caixa); `[azul=crédito]` =
`--print-credit` (dinheiro entrando); `[vermelho=débito]` = `--print-debit`
(dinheiro saindo); `[cinza]` = `--print-muted`. Estrutura = `.card` (borda
fina `--print-border`, fundo branco) contendo `.table`.

### 1. PDF Receita (ingredientes, proporções, totais — zero $)

```
┌──────────────────────────────────────────────────────────────┐
│ Pão de Fermentação Natural                       [preto, h1] │
│ Gerado em 05/07/2026 · Calculadora de Pão      [cinza, pequeno]│
├──────────────────────────────────────────────────────────────┤
│ FARINHAS                                    [preto, uppercase]│
│ ┌────────────────────────────┬────────┬──────────┐            │
│ │ Ingrediente                │   %    │ Peso (g) │ [th preto] │
│ ├────────────────────────────┼────────┼──────────┤            │
│ │ Farinha de Trigo Tipo 1    │ 90,00  │  900,0   │ [preto]    │
│ │ Farinha Integral           │ 10,00  │  100,0   │            │
│ ├────────────────────────────┼────────┼──────────┤            │
│ │ Total Farinhas             │ 100,00 │ 1000,0   │ [negrito]  │
│ └────────────────────────────┴────────┴──────────┘            │
│                                                                │
│ LÍQUIDOS                                                      │
│ ┌────────────────────────────┬────────┬──────────┐            │
│ │ Água                       │ 70,00  │  700,0   │            │
│ └────────────────────────────┴────────┴──────────┘            │
│                                                                │
│ SAL E EXTRAS                                                  │
│ ┌────────────────────────────┬────────┬──────────┐            │
│ │ Sal                        │  2,00  │   20,0   │            │
│ │ Azeite                     │  4,00  │   40,0   │            │
│ └────────────────────────────┴────────┴──────────┘            │
│                                                                │
│ FERMENTO NATURAL                                              │
│ ┌────────────────────────────┬──────────┐                     │
│ │ Peso total                 │  200,0 g │                     │
│ │ Farinha do fermento        │  100,0 g │                     │
│ │ Água do fermento           │  100,0 g │                     │
│ └────────────────────────────┴──────────┘                     │
│                                                                │
│ HIDRATAÇÃO                                                    │
│ ┌────────────────────────────┬──────────┐                     │
│ │ Nominal                    │  70,00%  │                     │
│ │ Real                       │  72,73%  │                     │
│ │ Farinha Real Consumida     │ 1100,0 g │                     │
│ └────────────────────────────┴──────────┘                     │
│                                                                │
│ TOTAL DA MASSA               100,00%   1200,0 g   [negrito,   │
│                                                       preto]   │
├──────────────────────────────────────────────────────────────┤
│                                          Página 1/1  [cinza]  │
└──────────────────────────────────────────────────────────────┘
```
Nenhuma cor de crédito/débito aparece aqui — PDF Receita é 100% neutro (preto),
zero valor monetário (§ split confirmado com usuário).

### 2. PDF Custos (cálculo de custo — só financeiro)

```
┌──────────────────────────────────────────────────────────────┐
│ Custos — Pão de Fermentação Natural              [preto, h1] │
│ Gerado em 05/07/2026                            [cinza]      │
├──────────────────────────────────────────────────────────────┤
│ CUSTO POR INGREDIENTE                       [preto, uppercase]│
│ ┌───────────────────┬──────────┬────────────┐                │
│ │ Ingrediente       │ Custo/g  │ Custo total│ [th preto]     │
│ ├───────────────────┼──────────┼────────────┤                │
│ │ Farinha Trigo T1  │ 0,0040   │   R$ 3,60  │ [vermelho =    │
│ │ Farinha Integral  │ 0,0060   │   R$ 0,60  │  débito, cada  │
│ │ Água              │ 0,0000   │   R$ 0,00  │  linha]        │
│ │ Sal               │ 0,0080   │   R$ 0,16  │                │
│ │ Azeite            │ 0,0250   │   R$ 1,00  │                │
│ │ Fermento Natural  │ 0,0180   │   R$ 3,50  │                │
│ ├───────────────────┼──────────┼────────────┤                │
│ │ CUSTO TOTAL       │          │   R$ 8,86  │ [vermelho,     │
│ └───────────────────┴──────────┴────────────┘   negrito]     │
│                                                                │
│ PRECIFICAÇÃO                                                  │
│ ┌────────────────────────────┬──────────┐                     │
│ │ Custo por unidade          │  R$ 4,43 │ [vermelho: débito] │
│ │ Preço de venda             │  R$ 7,38 │ [azul: crédito]    │
│ │ Margem de lucro            │  40,00%  │ [preto — % não é   │
│ │                            │          │  fluxo de caixa]   │
│ │ Lucro total                │  R$ 2,95 │ [azul: crédito     │
│ │                            │          │  (positivo)]       │
│ └────────────────────────────┴──────────┘                     │
│                                                                │
│ ⚠ PREJUÍZO — preço não cobre o custo    [só se isLoss: caixa │
│                                            vermelha, negrito] │
├──────────────────────────────────────────────────────────────┤
│                                          Página 1/1  [cinza]  │
└──────────────────────────────────────────────────────────────┘
```
Regra do trio Precificação: "Custo por unidade" é sempre débito (vermelho);
"Preço de venda" é sempre crédito (azul); "Lucro total" **muda de cor pelo
sinal** — azul (crédito) quando ≥0, vermelho (débito) quando <0/prejuízo (ver
variante 2b abaixo). "Margem de lucro" nunca ganha azul/vermelho — é métrica
(%), não movimento de caixa; fica preta sempre (o alerta de prejuízo já é
sinalizado pela caixa `.pdf-alert`, não pela cor do número da margem).

**Variante 2b — prejuízo** (mesma seção Precificação, `isLoss = true`):
"Preço de venda" continua azul (ainda é a entrada de caixa), mas "Custo por
unidade" continua vermelho, e "Lucro total" agora vermelho (débito líquido) +
caixa `.pdf-alert` com "⚠ PREJUÍZO".

### 3. PDF Histórico — Fornadas (produção, zero $)

```
┌──────────────────────────────────────────────────────────────┐
│ Histórico de Fornadas                            [preto, h1] │
│ Período: 01/06/2026 – 05/07/2026 · Gerado em 05/07/2026 [cinza]│
├──────────────────────────────────────────────────────────────┤
│ RESUMO DO PERÍODO                            [preto, uppercase]│
│ ┌────────────────────────────┬──────────┐                     │
│ │ Produzido                  │  48 un.  │ [preto]            │
│ │ Vendido                    │  42 un.  │                     │
│ │ Desperdício                │  12,50%  │                     │
│ └────────────────────────────┴──────────┘                     │
│                                                                │
│ FORNADAS                                                      │
│ ┌────────────┬──────────────────┬───────────┬──────────┐      │
│ │ Data       │ Receita          │ Produzidas│ Vendidas │      │
│ ├────────────┼──────────────────┼───────────┼──────────┤      │
│ │ 04/07/2026 │ Pão Francês      │    24     │    22    │      │
│ │ 02/07/2026 │ Fermentação Nat. │    24     │    20    │      │
│ │ 06/07/2026 │ Pão Francês      │    24     │    —     │ [cinza,│
│ │            │ Planejada        │           │          │ itálico]│
│ └────────────┴──────────────────┴───────────┴──────────┘      │
├──────────────────────────────────────────────────────────────┤
│                                          Página 1/1  [cinza]  │
└──────────────────────────────────────────────────────────────┘
```
Sem crédito/débito aqui também — PDF Histórico-Fornadas é neutro (preto/cinza).

### 4. PDF Histórico — Financeiro (custo/faturamento/lucro do período)

```
┌──────────────────────────────────────────────────────────────┐
│ Financeiro — Histórico de Fornadas               [preto, h1] │
│ Período: 01/06/2026 – 05/07/2026               [cinza]        │
├──────────────────────────────────────────────────────────────┤
│ RESUMO FINANCEIRO                            [preto, uppercase]│
│ ┌────────────────────────────┬──────────┐                     │
│ │ Custo total                │ R$ 96,00 │ [vermelho: débito] │
│ │ Faturamento                │ R$168,00 │ [azul: crédito]    │
│ │ Lucro                      │ R$ 72,00 │ [azul: crédito]    │
│ │ Margem média                │  42,86%  │ [preto — métrica]  │
│ └────────────────────────────┴──────────┘                     │
│                                                                │
│ FORNADAS                                                      │
│ ┌────────────┬──────────────────┬───────────┬──────────┐      │
│ │ Data       │ Receita          │ Custo     │ Lucro    │      │
│ ├────────────┼──────────────────┼───────────┼──────────┤      │
│ │ 04/07/2026 │ Pão Francês      │  R$ 48,00 │ R$ 36,00 │[custo │
│ │ 02/07/2026 │ Fermentação Nat. │  R$ 48,00 │ R$ 36,00 │vermelho,│
│ │ 28/06/2026 │ Pão Francês      │  R$ 48,00 │ -R$ 4,00 │lucro azul│
│ │            │                  │           │          │(vermelho│
│ │            │                  │           │          │ se <0)] │
│ ├────────────┴──────────────────┼───────────┼──────────┤      │
│ │ TOTAL                          │  R$ 96,00 │ R$ 72,00 │[negrito,│
│ │                                │ vermelho  │  azul     │mesma cor│
│ └────────────────────────────────┴───────────┴──────────┘  regra]│
├──────────────────────────────────────────────────────────────┤
│                                          Página 1/1  [cinza]  │
└──────────────────────────────────────────────────────────────┘
```
Coluna "Custo" sempre vermelho (débito); coluna "Lucro" azul quando ≥0,
vermelho quando <0 (linha 28/06 vira débito líquido) — mesma regra de sinal
do trio de Precificação (mockup 2).

## Notas de decisão

- 2 PDFs separados por contexto (confirmado com usuário) em vez de 1 PDF com
  seção condicional — o botão "Custos"/"Financeiro" some quando `showCosts`
  está desligado (mesmo gate de hoje, só que por botão inteiro, não por coluna).
- `escriba` deve atualizar `references/architecture.md`/`PROGRESS.md` ao final;
  `arquiteto` grava o "## Plano Técnico" (arquivos a criar/tocar, ordem de
  implementação, testes primeiro) antes do `dev-ui`/`dev-core` mexerem em código —
  fluxo padrão do loop, este documento é só a especificação + mockups.

---

## Plano Técnico

Issue puramente de **camada de apresentação (export/print + CSS de impressão +
wiring)**. Nenhum arquivo de `src/core/**` ou `src/storage/**` é tocado: os
dados já vêm prontos de `recalculate` (008) e `aggregatePeriod` (013). Não é
issue "core/storage", logo a seção "Testes primeiro" abaixo é de testes jsdom
de UI (mesmo precedente de `print.test.ts`), não de Vitest puro.

### Análise do existente (busca real no código/design system)

- **`src/export/print.ts`** — dono único das views de impressão. Já expõe
  `renderPrintView` (receita, com/sem custos condicional), `renderHistoryPrintView`
  (histórico, com/sem custos condicional) e `mountPrintButton(actionsRoot, onPrint?)`.
  Reusa: `h()` de `../ui/dom` (escape XSS via `textContent`, regra 3), os
  formatadores `formatWeight/formatPercent/formatCurrency/formatDate` (002, §9),
  e os helpers-módulo `DASH`/`pct`/`money`/`weight` (contrato null≠0, §5.C).
  **Reuso**: manter `mountPrintButton`, `DASH/pct/money/weight`, imports e o
  cabeçalho de doc. **Substituir**: o helper `line()` (`.print-line`) e as duas
  funções de render por 4 novas funções que montam `.card` + `.table`/`.kv`.
- **`src/export/print.test.ts`** — 8 casos jsdom (montagem `recalculate(goldenSeed())`
  + `computeBakeDerived`/`aggregatePeriod`). Reaproveitar os helpers `render()`,
  `bake()`, `renderHistory()` e o padrão `valueOf()` (adaptado às novas classes).
- **`references/design-system.css:515-557`** — bloco `@media print` atual + classes
  `.print-view/.print-title/.print-section/.print-line/.print-label/.print-value`
  (tokens de marca `--primary/--text-2/--text-muted`). O seletor
  `body:has(#print-root) > *:not(#print-root){display:none}` (achado CRÍTICO 019)
  **fica intocado** — resolve o degrade seguro. As classes `.print-*` de layout
  antigo são substituídas.
- **`.card` (:144)** e **`.table`/`.table th`/`.table td`/`.table th.num`/
  `.table tfoot td` (:247-261)** já existem no design system e são a base visual
  da tela (critério de aceite "igual ao padrão da tela") — **reusar as classes,
  sobrepondo só cor/borda dentro de `@media print`** via tokens `--print-*`.
- **`mockups/pdf-refactor.html`** (aprovado) — fonte visual dos 4 PDFs + variante
  2b (prejuízo). Já define `.pdf-page/.pdf-meta/.pdf-section/.kv/.pdf-credit/
  .pdf-debit/.pdf-muted-row/.pdf-alert/.pdf-footer` e os 7 tokens `--print-*`.
  **Decisão**: no mockup o container é `.pdf-page`; na implementação real usa-se
  **`.card`** (issue "O que fazer" + critério de aceite + snapshot de classes
  mandam `.card`); o mockup declara os tokens em `:root` só para pré-visualizar
  na tela — na implementação vão **dentro de `@media print`** (regra de ouro do
  projeto: `:root` de tela imutável; `#print-root` é `display:none` na tela, então
  não há perda visual).
- **`src/ui/pages/calculadora.ts:127-155`** — cria `#print-root` no `<body>`, monta
  `exportBar` (`.row.row--mb.row--sticky`) com "Exportar XLSX" + `mountPrintButton`.
  `store.subscribe` já dispara em `setShowCosts` (state.ts:114-116 chama `notify()`)
  → o gate por `.hidden` do botão "Custos" reage sem código novo de reatividade.
- **`src/ui/historyView.ts:167-257`** — mesmo padrão: `#print-root`, `actionBar`,
  `mountPrintButton` consumindo `lastExport.{entries,summary}`; `renderAll()`
  re-executa a cada filtro. `deps.prefs?.getShowCosts()` (§2.A.2) já é a fonte do
  gate de custos.
- **Dados já disponíveis (zero recálculo, regra 2)**: por ingrediente
  `ing.costPerGram`/`ing.recipeCost`; fermento `sourdough.costPerGram`/
  `sourdough.totalCost`; `summary.totalCost/costPerUnit/salePrice/profitMargin/
  totalProfit`; por fornada `entry.totalCost/totalProfit`; período
  `summary.totalProduced/totalSold/wastageRate/totalCost/totalRevenue/totalProfit/
  averageProfitMargin`. Subtotais de peso ("Total Farinhas", "Total da massa")
  são soma presentacional de pesos já derivados — **precedente sancionado** em
  `ingredientsTable.ts:192` (comentário §2.A.2 "única soma feita nesta camada é o
  total de peso do rodapé"); replicar aqui é legítimo, não é recálculo de negócio.
- **`isLoss(unitCost, salePrice)`** (`core/pricing.ts:114`) já usado por
  `pricingPanel.ts:159` — reusar para a caixa `.pdf-alert` (variante 2b), sem
  duplicar predicado.

### Cenários (números concretos §12 = gabarito)

`goldenSeed()` = "Pão Rústico de Azeite": Farinha 1000g/100%, Água 700g/70%,
Sal 20g/2%, Azeite 40g/4% (fat), Fermento 200g/20%, quantidade 2.

- **Receita (feliz)**: Farinhas tfoot 100,00% / 1000,0 g; Líquidos Água 70,00 /
  700,0; Sal e Extras Sal 2,00/20,0 + Azeite 4,00/40,0; Fermento kv 200,0/100,0/
  100,0 g; Hidratação Nominal 70,00% · Real 72,73% · Farinha Real 1100,0 g; Total
  da massa = Σpesos + `sourdough.totalWeight`. **Nenhum "R$" no DOM.**
- **Custos (feliz)**: Custo/ingrediente (tudo `.pdf-debit`) + linha "Fermento
  Natural" (`sourdough.costPerGram`/`sourdough.totalCost`); tfoot CUSTO TOTAL =
  `summary.totalCost` = **R$ 8,86**. Precificação: Custo por unidade R$ 4,43
  (`.pdf-debit`), Preço de venda R$ 7,38 (`.pdf-credit`), Margem 40,00% (neutro,
  `--print-text`), Lucro total `summary.totalProfit` (`.pdf-credit` se ≥0).
- **Custos (prejuízo, variante 2b)**: `isLoss(costPerUnit, salePrice)===true` →
  Lucro total em `.pdf-debit` **e** caixa `.pdf-alert` "⚠ PREJUÍZO — preço não
  cobre o custo". Preço de venda continua `.pdf-credit`; Custo por unidade
  continua `.pdf-debit`; Margem continua neutra (§ mockup: métrica, não caixa).
- **Custos (borda null≠0, §5.C)**: Peso do Produto ≤0 → `costPerGram/recipeCost/
  costPerUnit/salePrice/totalProfit` = `null` → célula "—" (via `money/pct`),
  nunca "R$ 0,00"; sem cor de crédito/débito quando "—".
- **Fornadas (feliz)**: Resumo Produzido/Vendido (un.) + Desperdício %; tabela
  Data/Receita/Produzidas/Vendidas; planejada (`entry.planned`) em `.pdf-muted-row`,
  Vendidas "—". **Nenhum "R$".**
- **Financeiro (feliz)**: Resumo Custo total (`.pdf-debit`)/Faturamento
  (`.pdf-credit`)/Lucro (`.pdf-credit` se ≥0)/Margem média (neutro); tabela
  Data/Receita/Custo (`.pdf-debit`)/Lucro (`.pdf-credit` se ≥0, `.pdf-debit` se <0);
  tfoot Total = `summary.totalCost`/`summary.totalProfit` (mesma regra de sinal).
- **Erro/borda**: período vazio → `lastExport===null` já barra o clique
  (historyView:252); XSS em `ing.name`/`entry.recipeName` (`<b>x</b>`/`<script>`)
  → texto puro, zero nó; clique-só (nunca `print()` no init).

### Testes primeiro (jsdom, em `print.test.ts` salvo o gate de botão)

Escrever ANTES da implementação; reaproveitar `render()`/`bake()`/`renderHistory()`.

1. **`renderRecipePrintView` conteúdo**: contém "Pão Rústico de Azeite", "1.000",
   "700,0", "72,73", "1100,0"/"1.100"; **NÃO** contém "R$".
2. **`renderRecipePrintView` snapshot de classes**: DOM tem `.card` e `table.table`
   com `thead`+`tbody`+`tfoot`; **zero** `.print-line`/`.print-section`.
3. **`renderRecipeCostsPrintView` conteúdo**: contém "R$ 8,86" (tfoot), "R$ 4,43",
   "R$ 7,38", "40,00"; cada célula monetária de custo tem classe `.pdf-debit`;
   "Preço de venda" tem `.pdf-credit`; "Margem de lucro" **sem** `.pdf-credit/
   .pdf-debit`.
4. **`renderRecipeCostsPrintView` prejuízo (2b)**: fixture com `costPerUnit >
   salePrice` → "Lucro total" em `.pdf-debit` **e** existe `.pdf-alert` com
   "PREJUÍZO". Caso feliz: **zero** `.pdf-alert`.
5. **`renderRecipeCostsPrintView` null≠0 (§5.C)**: forçar `summary.costPerUnit=null`
   (sem tocar core, como caso 14 atual) → célula "—", **não** "R$ 0,00", sem
   `.pdf-credit/.pdf-debit`.
6. **`renderHistoryPrintView` (Fornadas) conteúdo**: "Histórico de Fornadas",
   "Produzido", data, nome, "produzidas"/"vendidas"; **NÃO** contém "R$";
   planejada em `tr.pdf-muted-row`.
7. **`renderHistoryCostsPrintView` (Financeiro) conteúdo**: "R$" presente; Custo
   `.pdf-debit`, Lucro `.pdf-credit` (fornada ≥0), Lucro `.pdf-debit` (fixture
   fornada com `totalProfit<0`); tfoot Total com Custo `.pdf-debit` + Lucro colorido
   por sinal; Margem média **sem** cor.
8. **Escape XSS (todas as 4)**: `ing.name`/`entry.recipeName` = `<b>x</b>
   <script>alert(1)</script>` → `querySelector('script')` e `('b')` nulos, texto
   presente literal.
9. **Clique-só (regressão §8)**: montar qualquer das 4 views **não** chama
   `window.print`; só o clique no botão de `mountPrintButton` chama (manter caso 9).
10. **Gate do botão "Financeiro"** (em `historyView.test.ts`, que já tem harness
    com `prefs`): com `getShowCosts()===false` o botão de custos tem classe
    `.hidden` (ou está ausente); com `true`, visível. (Calculadora espelha o mesmo
    wiring — ver Riscos.)

### Arquivos a criar

- **Nenhum arquivo de produção novo.** (Os 4 renders vivem em `print.ts`; os
  tokens/estilos vivem no `@media print` de `design-system.css`.)

### Arquivos a modificar

- **`src/export/print.ts`**: remover `line()` e as 2 funções antigas; adicionar
  `renderRecipePrintView`, `renderRecipeCostsPrintView`, `renderHistoryPrintView`
  (reescrita), `renderHistoryCostsPrintView`; helper interno `card(titleUpper,
  bodyEl)` e `kvTable(rows)`/`dataTable(headers, rows, {tfoot})` que montam `.card`/
  `.table`/`.kv` via `h()` (escape §3, zero `innerHTML`); helper de célula
  monetária que aplica `.pdf-debit`/`.pdf-credit`/neutro e "—" para null. Estender
  `mountPrintButton(actionsRoot, onPrint?, label?)` com 3º parâmetro `label`
  (default mantém compat com o caso 9). Importar `isLoss` de `../core/pricing`.
  Atualizar cabeçalho de doc (§8/§9/§14.5 + nota do split e paleta de impressão).
- **`src/export/print.test.ts`**: substituir/ampliar casos 7-14 pelos 1-9 acima;
  adaptar `valueOf()` às novas classes (`.kv td`/`.table td`).
- **`references/design-system.css`** (bloco :515-557): declarar os 7 tokens
  `--print-*` **dentro de `@media print`** (escopados a `#print-root` ou `:root`
  sob `@media print`); adicionar `.pdf-meta/.pdf-section/.kv/.pdf-credit/.pdf-debit/
  .pdf-muted-row/.pdf-alert/.pdf-footer` e overrides de `#print-root .card`/`.table
  th`/`.table td`/`.table tfoot td` (fundo branco, texto `--print-text`, bordas
  `--print-border`/`--print-border-strong`) — **sem** alterar `:root` de tela nem
  o seletor `body:has(#print-root)` (achado CRÍTICO 019). Remover as classes
  `.print-view/.print-title/.print-section/.print-line/.print-label/.print-value`
  (mortas após a migração).
- **`src/ui/pages/calculadora.ts`** (~148-155): trocar o único `mountPrintButton`
  por dois — "Imprimir Receita" (→ `renderRecipePrintView`) e "Imprimir Custos"
  (→ `renderRecipeCostsPrintView`); guardar a ref do botão "Custos" e no
  `store.subscribe` alternar `.hidden` por `prefs.getShowCosts()` (§2.A.2). Ambos
  limpam `#print-root`, renderizam e chamam `window.print()` só no clique.
- **`src/ui/historyView.ts`** (~249-257): trocar por "Imprimir Fornadas" (→
  `renderHistoryPrintView`) e "Imprimir Financeiro" (→ `renderHistoryCostsPrintView`,
  gated por `.hidden`/`getShowCosts()`), ambos consumindo `lastExport`.
- **`src/ui/historyView.test.ts`**: adicionar o caso 10 (gate do botão Financeiro).
- **`references/architecture.md` / `PROGRESS.md`**: atualizados pelo `escriba` ao
  final (mapa de módulos de `print.ts`).

### Arquivos que NÃO devem ser tocados

- Todo `src/core/**` e `src/storage/**` (dados já prontos — regra 2, zero recálculo).
- `src/ui/dom.ts` (`h()` já basta), `src/export/xlsx.ts`, `src/export/download.ts`.
- `:root` de tela em `design-system.css` e o seletor `body:has(#print-root) >
  *:not(#print-root)` (achado CRÍTICO 019).
- `mockups/pdf-refactor.html` (fonte já aprovada).

### Ordem de implementação

1. CSS: tokens `--print-*` + classes `.pdf-*`/overrides `.card`/`.table` dentro de
   `@media print` (design-system.css). Base visual para os testes lerem classes.
2. Testes primeiro: reescrever `print.test.ts` (casos 1-9) — falham (RED).
3. `print.ts`: helpers `card/kvTable/dataTable/moneyCell` + as 4 funções de render
   + `mountPrintButton` com `label`. Verde (GREEN).
4. `historyView.test.ts`: caso 10 (gate) — RED → wiring historyView (2 botões +
   gate) → GREEN.
5. Wiring `calculadora.ts` (2 botões + gate por subscribe), espelhando historyView.
6. Remover classes `.print-*` mortas do CSS; rodar suíte completa + typecheck.
7. `escriba`: atualizar architecture.md/PROGRESS.md.
