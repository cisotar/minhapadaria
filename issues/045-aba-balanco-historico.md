---
id: "045"
titulo: Aba BALANÇO — visão financeira por fornada (seção só-leitura no Histórico)
tipo: mista
deps: ["013", "018", "044"]
status: done
---

## Contexto
Cliente pediu (2026-07-06) uma nova visão **"BALANÇO"** reproduzindo a planilha
que ele usa hoje: uma linha por fornada cruzando custo de produção × faturamento
de venda, com saldo e um "Status" (markup F/C) por linha e um agregado no rodapé.

Spec formal aprovada: `specs/aba-balanco.md`. Aditiva pura — **não altera nenhuma
fórmula** da v5 §14; adiciona uma visão nova sobre os mesmos `BakeEntry` + 1
métrica nova (Status). Decisões travadas com o cliente (spec §5):

- **P1** — mora **dentro da tela Histórico** (`src/ui/historyView.ts`, issues
  018/044), como seção/tabela; não é página própria.
- **P2** — **só-leitura**; registro/edição de fornadas seguem nas telas existentes.
- **P3** — **linha de totais** no rodapé: Σ Produção · Σ C · Σ Vendas · Σ F ·
  Σ Saldo, com **Status agregado = ΣF/ΣC × 100%** (razão dos totais, NÃO média
  das linhas).
- **P4** — planejadas espelham o Histórico: badge "◌ Planejada — fora dos totais",
  "—" nas colunas de venda, fora de todos os Σ.
- **P5** — cor por semântica contábil (memória issue 028): Saldo < 0 → vermelho
  (`.loss`), ≥ 0 → azul; **Status % fica neutro** (não colorir percentual).
- **P6** — ordenação data decrescente, espelhando o Histórico.

## Colunas (spec §2.1)
`Data | Receita | Produção | Custo unitário | Custo (C) | Vendas | Preço unitário | Faturamento (F) | Saldo | Status`

Mapeamento para `BakeEntry` (v5 §6) — **nenhuma fórmula nova exceto Status**:
- Custo (C) = `totalCost` = Produção × Custo unitário (produção inteira, mesmo
  não vendida — pão não vendido conta como custo).
- Faturamento (F) = `totalRevenue` = Vendas × Preço unitário (só o vendido).
- Saldo = `totalProfit` = F − C (pode ser negativo).
- **Status (novo)** = F / C × 100% (spec §2.2). Ex.: F=120, C=100 → 120%.
  Markup sobre custo, não margem clássica — mesma ambiguidade da issue 041;
  registrar sob o rótulo "Status" que o cliente escolheu. NÃO substitui a
  "margem média" das agregações v5 §14.4.

## O que fazer
- Nova seção/tabela BALANÇO na tela Histórico (`historyView.ts`), só-leitura,
  reusando layout/tokens/componentes existentes do Histórico — sem valores brutos.
- Derivar Status por linha (F/C×100%) e o Status agregado do rodapé (ΣF/ΣC×100%)
  a partir dos `BakeEntry` já modelados (core da 013). Preferir função pura
  testável no core em vez de cálculo solto na view.
- Rodapé de totais (`tfoot`) somando Produção/C/Vendas/F/Saldo sobre o conjunto
  exibido (respeitando filtros ativos), **excluídas planejadas**.
- Aplicar cor por semântica contábil só a valores monetários; Status neutro.
- Exportação desta visão segue a regra geral v5 §8/§14.5 (HTML→impressão + XLSX,
  com/sem custos) — confirmar no plano se entra nesta issue ou vira issue própria.

## Casos de borda (spec §3)
- Vendas = 0 → F = 0, Saldo = −C, Status = 0%. Linha exibida normalmente.
- C = 0 → Status "—" (div/0), sem erro; vale também para Status agregado (ΣC=0 → "—").
- Venda > produção: impossível por construção (v5 §5.D/§14.6) — sem validação nova.
- Custo unitário variando entre fornadas da mesma receita: coberto por snapshots.
- Fornada órfã (receita excluída): linha permanece via `recipeName` snapshot.
- Tabela vazia / só planejadas: estado vazio ou totais 0 (Status agregado "—").
- Precisão: R$ 2 casas, % 2 casas, data `aaaa-mm-dd`, vírgula decimal (v5 §7.1/§9).

## Testes exigidos
- Core: testes Vitest da função de Status por linha e do agregado ΣF/ΣC,
  incluindo bordas (Vendas=0, C=0 → "—"/indefinido, ΣC=0, planejadas excluídas).
- UI/estrutura: cobertura da montagem da tabela (colunas, rodapé, "—" em
  planejadas) no padrão dos testes de view/print existentes.
- `tsc` limpo; `npm test` + `npm run build` verdes.

## Critérios de aceite
- [ ] Seção BALANÇO renderiza dentro da tela Histórico (não página própria),
      só-leitura, com as 10 colunas da spec §2.1.
- [ ] Status por linha = F/C×100% (2 casas); "—" quando C=0; 0% quando Vendas=0.
- [ ] Rodapé com Σ Produção/C/Vendas/F/Saldo e Status agregado = ΣF/ΣC×100%
      (não média das linhas); ΣC=0 → "—".
- [ ] Planejadas listadas com badge, "—" nas colunas de venda, fora de todos os Σ.
- [ ] Saldo < 0 vermelho (`.loss`), ≥ 0 azul; Status % neutro. Só tokens.
- [ ] Ordenação data decrescente.
- [ ] Suíte inteira verde e build OK; nada da v5 §14 existente regride.

## Referências
- `specs/aba-balanco.md` (aprovada, 2026-07-06) · v5 §14 (Histórico/fornadas),
  §6 (`BakeEntry`), §7.1/§9 (formatos/precisão), §5.D (validações).
- `src/ui/historyView.ts` (tela anfitriã, issues 018/044) · core de fornadas
  (issue 013) · export (issues 019/043) · memória cor issue 028.

## Plano Técnico

> Enriquecimentos de spec feitos ao planejar (ver `specs/aba-balanco.md`, changelog
> "arquiteto 2026-07-06"): (a) cor on-screen — sem token azul-crédito na paleta da
> tela, reusa-se só `.loss` em Saldo<0, resto neutro (azul-crédito é print-only,
> issue 028); (b) lista exata de colunas "—" em planejada (Vendas, Preço unitário,
> Faturamento, Saldo, Status).

### Análise do existente (grep real)

- **`src/core/bakes.ts`** já tem os derivados por fornada (issue 013, TDD):
  `bakeTotalCost(unitCost, produced)` (=C, §14.3), `bakeRevenue(unitSalePrice, sold)`
  (=F), `bakeProfit(revenue, cost)` (=Saldo), `bakeWastageRate` (padrão de guarda
  ÷0→`null`, contrato null≠0 §5.C), `computeBakeDerived(entry)` (clona e preenche os
  5 derivados), `isPlanned(entry)` (predicado único `planned===true`), `aggregatePeriod`
  (soma produced/sold/cost/revenue/profit **já excluindo planejadas internamente**).
  → **Não existe** função de Status F/C. É o único cálculo novo. Vai aqui, como pura
  testável (padrão 013), **não na view** — mantém a regra de negócio no core, testável
  sem jsdom, e permite reuso da MESMA função para linha e agregado.
- **`src/ui/historyView.ts`** (issues 018/044) já: monta filtros receita/intervalo/
  granularidade em `renderAll`; deriva `recipeFiltered` (só receita), `periodFiltered`
  (receita+intervalo, inclui planejadas em intervalo), `periodFilteredReal`
  (`!isPlanned`), e `currentSummary = aggregatePeriod(periodFiltered, ...)` (Σ produced/
  sold/cost/revenue/profit, planejadas fora). A tabela atual "Fornadas registradas"
  tem colunas **Data | Receita | Prod. | Vend. | Lucro | Status(chip de margem) |
  (ações)** — editável inline, com ações. **É outra tabela**: não tem Custo unitário /
  C / Preço unitário / Faturamento, e o "Status" dela é um chip de margem de venda, não
  F/C%. → BALANÇO é **tabela NOVA, só-leitura, na mesma página** — não estender/editar a
  atual (regrediria 018/044). Reuso de `isPlanned`, `computeBakeDerived`, `currentSummary`,
  `formatCurrency`/`formatPercent`/`formatDate`, `h`/`clear` (dom.ts), classes `.table`/
  `.table tfoot`/`.loss`/`.badge-planned`/`.planned`/`.num`.
- **`references/design-system.css`**: existem `.table` + `.table tfoot td` (negrito +
  borda topo), `.loss` (vermelho `--danger`), `.badge-planned`, `.planned` (linha),
  `.num`/`.num--left`. **Não existe** classe azul-crédito on-screen (só `.pdf-credit`
  dentro do bloco `@media print`). → **Zero CSS novo**: BALANÇO reusa tudo.
- **Export** (`src/export/print.ts` `renderHistoryCostsPrintView`, `src/export/xlsx.ts`
  `buildHistoryWorkbook`): o XLSX "Fornadas" com `includeCosts` **já exporta** Data/
  Receita/Produzido/Vendido/Custo unit./Preço unit./Custo total/Faturamento/Lucro/Status
  — ou seja, os mesmos dados do BALANÇO exceto a métrica Status F/C%. O PDF Financeiro já
  traz Data/Receita/Custo/Lucro + Σ. → Export do BALANÇO **fica FORA da 045** (follow-up),
  nenhum dado financeiro se perde no que já existe.

### Cenários (números concretos)

- **Feliz (linha)**: fornada F=120, C=100 (Produção 20 × Custo unit. 5; Vendas 24 ×
  Preço unit. 5) → C=`totalCost`, F=`totalRevenue`, Saldo=`totalProfit`=+20, Status=120%
  (§2.2 exemplo do cliente). Saldo ≥ 0 → neutro.
- **Feliz (agregado)**: A(F=120,C=100) + B(F=60,C=100) → ΣF=180, ΣC=200, ΣSaldo=−20,
  Status_total=ΣF/ΣC=**90%** (§2.4; NÃO média das linhas 120/60). ΣSaldo<0 → `.loss`.
- **Vendas=0**: F=0, Saldo=−C, Status=`bakeStatus(0,100)`=**0%** (não null). Linha
  exibida normal, Saldo negativo → `.loss` (§3 caso 1).
- **C=0** (custo unit. 0): Status por linha = `bakeStatus(F,0)`→`null`→ **"—"** (§3 caso 3).
- **ΣC=0** (tabela vazia/só planejadas): `bakeStatus(ΣF,0)`→`null`→ Status agregado **"—"**;
  Σ numéricos exibem 0 / R$ 0,00 (§3 caso 3b/7).
- **Planejada em intervalo**: linha com `.planned` + badge "◌ Planejada — fora dos
  totais"; "—" em Vendas/Preço unit./F/Saldo/Status; Data/Receita/Produção/Custo unit./
  C preenchidos; **fora de todos os Σ** (§2.5 P4, esclarecido).
- **Órfã** (receita excluída): linha permanece via `recipeName` snapshot (§3 caso 5) —
  sem tratamento especial no BALANÇO além do que `recipeName` já entrega.
- **Ordenação**: data decrescente (§2.5 P6), mesma comparação lexicográfica `formatDate`
  já usada na tabela atual.

### Testes primeiro

**Core — `src/core/bakes.test.ts` (adicionar ~6 casos à suíte 013):**
- `bakeStatus(120, 100)` → `120` (markup §2.2, gabarito do cliente).
- `bakeStatus(180, 200)` → `90` (razão dos totais §2.4 — mesma função serve o agregado).
- `bakeStatus(0, 100)` → `0` (Vendas=0 dá 0%, **não** null).
- `bakeStatus(60, 0)` → `null` (C=0, div/0 → contrato null≠0 §5.C).
- `bakeStatus(0, 0)` → `null` (ΣC=0, tabela vazia/só planejadas).
- `bakeStatus(50, 100)` → `50` (Saldo negativo, Status < 100%).

**UI — `src/ui/historyView.test.ts` (adicionar ao describe existente, fixtures no molde atual):**
- Seção BALANÇO renderiza com **thead de 10 colunas** na ordem da §2.1 (localizar pela
  `table` com `aria-label="Balanço por fornada"`, não a primeira `table` da página).
- Linha confirmada: Status = `formatPercent(F/C×100)`+"%"; Saldo<0 tem classe `.loss`,
  Saldo≥0 não; célula Status **sem** classe de cor.
- Linha C=0: célula Status = "—".
- `tfoot`: ΣProdução/ΣVendas (inteiros), ΣC/ΣF/ΣSaldo (moeda) batem com fixture; Status
  agregado = ΣF/ΣC% (não média); ΣSaldo<0 tem `.loss`.
- Planejada em intervalo: linha tem `.badge-planned`; "—" em Vendas/Preço unit./F/Saldo/
  Status; **não** entra no `tfoot` (Σ ignora a planejada).
- Só-planejadas/vazio: Σ numéricos 0, Status agregado "—".
- Ordenação: `td` de Data em ordem decrescente.

### Arquivos a criar
- Nenhum arquivo novo (regra de ouro 2 — tudo cabe em módulos existentes).

### Arquivos a modificar
1. **`src/core/bakes.ts`** — adicionar `bakeStatus(totalRevenue: number, totalCost: number):
   number | null` (§2.2): `if (totalCost <= 0) return null; return (totalRevenue / totalCost)
   * 100;`. Guarda ÷0 idêntica ao padrão `bakeWastageRate`. Serve linha **e** agregado
   (dono único de F/C×100). Cabeçalho: citar §14.3/§2.2 (spec aba-balanco). **Não** tocar
   `computeBakeDerived`/tipos — Status é display-only, não persistido.
2. **`src/core/bakes.test.ts`** — os 6 casos acima.
3. **`src/ui/historyView.ts`** — adicionar, **depois** da `tableCard` "Fornadas
   registradas" (preserva `querySelector('table')` das suítes atuais → 1ª tabela segue
   sendo a de edição), uma nova `section.card` "Balanço" com:
   - `<h2>Balanço</h2>` + `<table aria-label="Balanço por fornada">` (hook de teste, sem
     CSS novo) com thead de 10 colunas (§2.1) e `tfoot` de totais.
   - Em `renderAll()`, popular o tbody com **`periodFiltered`** (receita+intervalo, §2.4
     "sob filtros ativos"), ordenado data desc; cada linha: planejada → badge+`.planned`+
     "—" nas 5 colunas de venda; confirmada → valores via `computeBakeDerived(entry)` +
     `bakeStatus(derived.totalRevenue, derived.totalCost)`; Saldo<0 → `.loss`.
   - `tfoot`: **reusar `currentSummary`** (= `aggregatePeriod(periodFiltered)`, planejadas
     já fora) para ΣProdução/ΣVendas/ΣC/ΣF/ΣSaldo; Status agregado =
     `bakeStatus(currentSummary.totalRevenue, currentSummary.totalCost)`; ΣSaldo<0 → `.loss`;
     colunas não-somáveis (Data/Receita/Custo unit./Preço unit.) vazias/"Total".
   - Importar `bakeStatus` de `../core/bakes`. Strings do usuário só via `h`/`textContent`
     (regra 3, já é o padrão do arquivo).
4. **`src/ui/historyView.test.ts`** — os casos de UI acima.

### Arquivos que NÃO devem ser tocados
- `references/design-system.css` (zero classe/token novo — tudo reusado).
- `src/core/types.ts` (Status é derivado de exibição, não persiste; `BakeEntry` já basta).
- `src/storage/*` (só-leitura, P2 — nenhuma persistência nova).
- `src/export/print.ts`, `src/export/xlsx.ts` (export do BALANÇO é follow-up).
- `src/core/pricing.ts` e demais painéis da Calculadora, `bakeForm.ts`, `trendChart.ts`.
- A tabela "Fornadas registradas" existente e sua edição inline (não regredir 018/044).

### Ordem de implementação
1. `bakeStatus` + testes core (TDD, vermelho→verde) — `src/core/bakes.ts` / `.test.ts`.
2. Esqueleto da section/tabela BALANÇO em `historyView.ts` (thead 10 col + tfoot vazio).
3. Popular tbody (linhas confirmadas + planejadas "—") + ordenação desc no `renderAll`.
4. tfoot reusando `currentSummary` + `bakeStatus` agregado; cor `.loss` em Saldo/ΣSaldo<0.
5. Testes de UI em `historyView.test.ts`.
6. `tsc` limpo + `npm test` + `npm run build` verdes; conferir que nenhum teste 018/044/013
   regrediu.

### Decisão sobre export (§O que fazer, item export)
**Fora da 045.** O XLSX (`buildHistoryWorkbook`, includeCosts) e o PDF Financeiro já
exportam Custo/Faturamento/Lucro/Σ do período — nenhum dado se perde. A única adição
seria a coluna Status F/C% nesses relatórios. **Follow-up explícito:** issue própria
tipo fix — "Coluna Status (F/C%) no XLSX Fornadas e no PDF Financeiro do Histórico",
reusando `bakeStatus`. Mantém a 045 focada na visão on-screen.
