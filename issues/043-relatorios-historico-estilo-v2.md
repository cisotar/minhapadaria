---
id: "043"
titulo: Relatórios do Histórico no mesmo estilo v2 (cards por seção) dos relatórios da Calculadora
tipo: export
deps: ["028", "034"]
status: todo
---

## Contexto
Pedido do cliente (2026-07-06): os relatórios PDF do **Histórico**
(`renderHistoryPrintView` = Fornadas; `renderHistoryCostsPrintView` = Financeiro,
em `src/export/print.ts`) devem ter o MESMO estilo dos relatórios da
**Calculadora** (Receita/Custos), que foram refatorados para o visual v2 nas
issues 028/034.

Hoje há duas famílias de estilo no mesmo arquivo:
- **Calculadora (v2, alvo):** `recipePageV2` → `.pdf-head` (h1 + `.pdf-meta` +
  badge `.pdf-yield`) + seções em `.sec-card` (`secCard`: `.sec-head` + `.sec-body`)
  + `.pdf-footer` "Página 1/1". Mockups `mockups/pdf-receita-v2.html`,
  `mockups/pdf-custos-v2.html`.
- **Histórico (antigo):** `pageCard` (`.card` liso: h1 + `.pdf-meta` + corpo) +
  `section()` (`<h2 class="pdf-section">`, sem card) + rodapé "Calculadora de Pão".

Toda a CSS v2 (`.pdf-head`, `.sec-card`, `.sec-head`, `.sec-body`, `.pdf-yield`,
`.pdf-footer`) já existe e está aprovada — a paridade sai por **reuso** (regra de
ouro 2), sem token/classe nova.

## O que fazer
- `src/export/print.ts`:
  - Generalizar o helper de página v2: extrair de `recipePageV2` um
    `pdfPageV2(title, meta, badge: HTMLElement | null, sections)` que monta
    `.pdf-head` (headText + badge opcional) + seções + `.pdf-footer` "Página 1/1".
    Manter `recipePageV2` como fino wrapper que constrói o badge `.pdf-yield`
    "Rende N pães" e chama `pdfPageV2` — assim os dois relatórios da Calculadora
    NÃO mudam de saída (tests 1–5/5b seguem verdes).
  - `renderHistoryPrintView` (Fornadas): trocar `pageCard` por `pdfPageV2` e
    envolver as duas seções ("Resumo do período" e "Fornadas") em `secCard`
    (`.sec-card`) em vez de `section()` (`<h2 class="pdf-section">`). Manter o
    conteúdo: `kvTable` do resumo e `table.table` da listagem (com
    `tr.pdf-muted-row` das planejadas, §14.6) — SÓ muda o invólucro/estilo.
    Badge do head: `.pdf-yield` com "N fornadas" (contagem de `entries`) — análogo
    de "Rende N pães". ZERO "R$" continua valendo (§14.5).
  - `renderHistoryCostsPrintView` (Financeiro): idem — `pdfPageV2` + `secCard`
    para "Resumo financeiro" e "Fornadas"; manter `kvTable`, a `table.table` com
    `td.pdf-debit`/`signedMoneyTd` e o `tfoot` Total. Badge `.pdf-yield` com a
    contagem de fornadas CONFIRMADAS (planejadas ficam fora do financeiro,
    §14.4). Cores crédito/débito inalteradas (memória do projeto: azul=crédito,
    vermelho=débito).
  - Remover o helper `section()` e o rodapé "Calculadora de Pão" se ficarem sem
    uso após a migração (o rodapé v2 é "Página 1/1"). Se `pageCard`/`section`
    ficarem órfãos, removê-los (evita código morto); confirmar por grep.
- NÃO alterar os números/semântica dos relatórios, só o invólucro visual.
- NÃO tocar em `spec/`, `brand/`, `mockups/` (somente-leitura). Nenhuma CSS nova
  esperada (reuso das classes v2); se algo faltar, só tokens + documentar.

## Testes exigidos (TDD — `src/export/print.test.ts`)
- Receita/Custos (v2): tests 1–5/5b permanecem VERDES sem edição (regressão zero).
- Fornadas (adaptar o describe "intocado" → "estilo v2"):
  - existe `.pdf-head` com h1 "Histórico de Fornadas" e badge `.pdf-yield` com a
    contagem de fornadas.
  - "Resumo do período" e "Fornadas" são `.sec-card` (`.sec-head` com esses
    títulos), não mais `<h2 class="pdf-section">`.
  - rodapé `.pdf-footer` "Página 1/1".
  - mantém: ZERO "R$", `tr.pdf-muted-row` das planejadas, XSS do recipeName vira
    texto (test 8c).
- Financeiro (idem):
  - `.pdf-head` + badge `.pdf-yield`; "Resumo financeiro"/"Fornadas" em `.sec-card`.
  - mantém: `kvCell` "Custo total" `.pdf-debit`, "Faturamento" `.pdf-credit`,
    "Margem média" neutra; `td.pdf-debit`/`.pdf-credit` na listagem; `tfoot` Total;
    XSS (test 8d).
- `mountPrintButton` test 12 (montar não chama `window.print`) segue verde.

## Critérios de aceite
- [ ] Fornadas e Financeiro usam `.pdf-head` (h1 + `.pdf-meta` + badge
      `.pdf-yield`), seções em `.sec-card` e rodapé `.pdf-footer` "Página 1/1" —
      mesmo invólucro dos relatórios da Calculadora.
- [ ] Relatórios da Calculadora (Receita/Custos) inalterados (tests 1–5/5b verdes).
- [ ] Conteúdo/semântica do Histórico preservados (zero $, muted rows, cores
      crédito/débito, tfoot Total, XSS).
- [ ] Reuso das classes v2; sem token/classe/hex novo. Código morto removido.
- [ ] `print.test.ts` cobre a nova estrutura; suíte inteira verde e `tsc` limpo.

## Plano Técnico

### Análise do existente (grep real em `src/` + `references/design-system.css`)
- `src/export/print.ts`:
  - `recipePageV2(title, meta, yieldQty, sections)` (L147-155) — monta
    `<section.card>` → `.pdf-head` (`headText` = h1 + `.pdf-meta`) + badge
    `.pdf-yield` "Rende N pães" + seções + `.pdf-footer` "Página 1/1". É a fonte
    do refactor: dá para EXTRAIR o miolo genérico.
  - `secCard(title, content)` (L136-140) — `.sec-card` (`.sec-head` + `.sec-body`),
    aceita 1+ elementos. REUSAR tal-qual para envolver as seções do Histórico.
  - `kvTable` (L105-111), `td`/`signedMoneyTd` (L89-102), `generatedMeta`/
    `periodMeta` (L127/399-400) — REUSAR inalterados (conteúdo/semântica).
  - `pageCard` (L114-120) e `section()` (L122-125) — usados HOJE só pelas 2
    funções do Histórico (grep: `pageCard` → L450,514; `section(` → L412,422,464,475).
    Após migrar, ambos ficam ÓRFÃOS → remover (código morto, regra de ouro 2).
  - Footer "Calculadora de Pão" (`h('div',{className:'pdf-footer'},['Calculadora de Pão'])`
    L448,512) — some; o footer v2 "Página 1/1" passa a vir de `pdfPageV2`.
    Obs.: a string "Calculadora de Pão" SOBREVIVE no `.pdf-meta` via
    `generatedMeta` (L127) — logo NÃO se pode asserir ausência global dela.
- `references/design-system.css` (grep sob `#print-root`): `.pdf-head` (L667),
  `.pdf-yield` (L675) + `strong` (L682), `.sec-card`/`.sec-head`/`.sec-body`
  (L685-704), `.pdf-footer` (L650), `.pdf-muted-row td` (L644), `.pdf-debit`/
  `.pdf-credit` (L642-643) — TODAS já existem e aprovadas. Zero CSS/token/hex novo.

### Cenários (números concretos do fixture do test)
- Fornadas (test 6): 1 confirmada + 1 planejada → `entries.length` = 2 → badge
  `.pdf-yield` "2 fornadas". h1 "Histórico de Fornadas". Planejada em
  `tr.pdf-muted-row` com "Planejada" e Vendidas "—" (§14.6). ZERO "R$" (§14.5).
- Financeiro (test 7): 2 confirmadas (lucrativa + prejuízo) → badge conta só
  CONFIRMADAS = 2 (planejadas fora, §14.4). "Custo total" débito, "Faturamento"
  crédito, "Margem média" neutra; `td.pdf-debit`/`.pdf-credit` na listagem;
  `tfoot` Total. Se houvesse planejada, ela NÃO entra no badge nem nas linhas.
- Borda: `entries` vazio → badge "0 fornadas", tabela sem linhas, tfoot Total
  com "—" onde o core devolve null (§5.C) — inalterado, só o invólucro muda.
- XSS (test 8c/8d): `recipeName` `<script>` vira texto via `td`/`h` (regra 3).
- Badge — decisão de texto: "N fornadas" SEM pluralização (análogo de "Rende N
  pães", que também não flexiona) — `h('div',{className:'pdf-yield'},
  [h('strong',{},[String(n)]),' fornadas'])`.

### Refactor do helper de página (cirúrgico)
- Extrair de `recipePageV2` um `pdfPageV2(title: string, meta: string,
  badge: HTMLElement | null, sections: HTMLElement[]): HTMLElement` que monta
  `<section.card>` → `.pdf-head` (`headText` h1+`.pdf-meta` + `badge` se != null)
  + `...sections` + `.pdf-footer` "Página 1/1".
- `recipePageV2` vira wrapper fino: constrói `yieldBadge` = `.pdf-yield`
  "Rende N pães" e chama `pdfPageV2(title, meta, yieldBadge, sections)`.
  Saída byte-a-byte idêntica → tests 1–5/5b/9/10 seguem verdes (regressão zero).
- Quando `badge === null`, `.pdf-head` recebe só `headText` (Histórico sempre
  passa badge, então na prática nunca é null — parâmetro fica para simetria).

### Testes primeiro (TDD — `src/export/print.test.ts`)
Reusar o helper `secCard(root, title)` já definido no test (L86-92).
- Receita/Custos: tests 1–5/5b/6–11b permanecem SEM edição (regressão zero).
- describe Fornadas — renomear "…intocado" → "…estilo v2"; ADAPTAR test 6 e
  ADICIONAR casos:
  - `.pdf-head` existe e seu h1 === "Histórico de Fornadas".
  - `root.querySelector('.pdf-yield')` != null e `.textContent` contém "2"
    (entries.length) e "fornadas".
  - `secCard(root,'Resumo do período')` != null e `secCard(root,'Fornadas')` != null.
  - `root.querySelector('h2.pdf-section')` === null (não usa mais `section()`).
  - `root.querySelector('.pdf-footer')?.textContent` === "Página 1/1".
  - MANTER: `not.toContain('R$')`, `tr.pdf-muted-row` com "Planejada".
  - test 8c (XSS) inalterado.
- describe Financeiro — idem:
  - `.pdf-head` + `.pdf-yield` `.textContent` contém "2" (só confirmadas).
    Caso NOVO: adicionar 1 planejada ao fixture e asserir badge continua "2"
    (planejada fora do financeiro, §14.4).
  - `secCard(root,'Resumo financeiro')`/`secCard(root,'Fornadas')` != null;
    `h2.pdf-section` === null; footer "Página 1/1".
  - MANTER (test 7): `kvCell` "Custo total" `.pdf-debit`, "Faturamento"
    `.pdf-credit`, "Margem média" neutra; `td.pdf-debit`/`.pdf-credit` na
    `table.table`; `tfoot` "Total". test 8d (XSS) inalterado.
- test 12 (`mountPrintButton` não chama `window.print` ao montar) inalterado.

### Implementação em `print.ts`
- `renderHistoryPrintView`: trocar `body.push(section(...))` por montar
  `sections: HTMLElement[]` com `secCard('Resumo do período', kvTable([...]))`
  e `secCard('Fornadas', table)` (a `table.table` + tbody/`pdf-muted-row`
  inalterada). Remover o `body.push(pdf-footer 'Calculadora de Pão')`. Trocar o
  `pageCard(...)` final por `pdfPageV2('Histórico de Fornadas', periodMeta(summary),
  yieldBadge, sections)` com `yieldBadge` = `.pdf-yield` `${entries.length} fornadas`.
- `renderHistoryCostsPrintView`: idem — `secCard('Resumo financeiro', kvTable)`,
  `secCard('Fornadas', table)` (mantém `td.pdf-debit`/`signedMoneyTd` + `tfoot`
  Total). Badge conta confirmadas: `entries.filter((e) => e.planned !== true).length`
  (§14.4/§14.6). `pdfPageV2('Financeiro — Histórico de Fornadas', periodMeta, badge, sections)`.
- Remover helpers `pageCard` e `section` (órfãos). Atualizar o comentário de
  cabeçalho (linhas 15-17: "INTOCADA" → "estilo v2 por reuso, issue 043").

### Arquivos a criar
Nenhum.

### Arquivos a modificar
- `src/export/print.ts` — extrair `pdfPageV2`; `recipePageV2` vira wrapper;
  migrar as 2 funções do Histórico para `pdfPageV2`+`secCard`; remover
  `pageCard`/`section` e os 2 footers "Calculadora de Pão"; atualizar cabeçalho.
- `src/export/print.test.ts` — adaptar os 2 describes do Histórico (estrutura v2)
  conforme "Testes primeiro"; Receita/Custos intocados.

### Arquivos que NÃO devem ser tocados
- `references/design-system.css` (todas as classes v2 já existem — reuso puro).
- `spec/`, `brand/`, `mockups/` (somente-leitura).
- Núcleo `core/` e `storage/` (nenhum número/derivado muda).
- `src/ui/historyView.ts` e wiring de botões (só o layout do PDF muda).

### Ordem de implementação
1. `print.test.ts`: adaptar describes do Histórico (RED) — badge, `.pdf-head`,
   `secCard`, footer "Página 1/1", ausência de `h2.pdf-section`; manter asserts
   de conteúdo/cor/XSS.
2. `print.ts`: extrair `pdfPageV2`; `recipePageV2` → wrapper (rodar suíte:
   Receita/Custos devem seguir verdes).
3. `print.ts`: migrar `renderHistoryPrintView` e `renderHistoryCostsPrintView`
   para `pdfPageV2`+`secCard`+badge; remover footers antigos.
4. Remover `pageCard` e `section` (grep confirma órfãos); atualizar cabeçalho.
5. `npx vitest run src/export/print.test.ts` verde + `tsc --noEmit` limpo.

## Referências
- Pedido do cliente 2026-07-06 · `src/export/print.ts` (issues 028/034) ·
  `src/export/print.test.ts` · mockups `pdf-receita-v2.html`/`pdf-custos-v2.html`
  (referência de estilo, read-only) · spec §14.4/§14.5/§14.6 · memória do projeto
  (azul=crédito, vermelho=débito).
