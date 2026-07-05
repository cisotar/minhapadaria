---
id: "028"
titulo: Refactor — estilo dos PDFs (visual tipo tela) + split Receita/Custos
tipo: export
deps: ["019", "027"]
status: pending
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
