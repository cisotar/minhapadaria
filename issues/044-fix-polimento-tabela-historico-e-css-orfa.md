---
id: "044"
titulo: Polir densidade da listagem do Histórico (paridade table.rt) + remover CSS órfã pdf-section
tipo: fix
deps: ["043"]
status: todo
---

## Contexto
Achados do guardião-design na revisão da issue 043 (relatórios do Histórico no
estilo v2). O invólucro já ficou idêntico ao da Calculadora (aprovado), mas
restaram dois pontos de polimento:

1. **MÉDIO — densidade da listagem.** A tabela de listagem do Histórico
   (`table.table`, em `src/export/print.ts`) vive agora dentro de `.sec-body`,
   mas mantém padding de célula 2× maior que a `table.rt` da Calculadora
   (`.table td` = `var(--sp-2) var(--sp-4)` vs `table.rt td` = `var(--sp-1)
   var(--sp-2)`). Linhas ficam visivelmente mais "soltas" que as da Calculadora
   — destoa da paridade fina pedida na 043.
2. **BAIXO — CSS órfã.** A regra `#print-root h2.pdf-section` (em
   `references/design-system.css`, ~L622-628) ficou sem uso em produção após a
   043 remover `section()`/`pageCard` de `print.ts` (grep: só mockups/comentários
   referenciam `pdf-section`). Código morto.

## O que fazer
- Densidade (achado 1): aproximar a listagem `table.table` do Histórico da
  densidade da `table.rt` da Calculadora quando dentro de `.sec-body`. Opções
  (decidir no plano):
  - (a) regra CSS escopada tokens-only `.sec-body table.table td/th { padding:
    var(--sp-1) var(--sp-2); }` em `design-system.css` (documentar em
    design-system.html); OU
  - (b) reusar a densidade de `table.rt` de outra forma sem regra nova.
  Só tokens, nenhum hex/valor bruto. Não alterar a `table.table` fora do
  contexto de impressão (não regredir Calculadora/telas).
- CSS órfã (achado 2): remover a regra `#print-root h2.pdf-section` de
  `references/design-system.css` (confirmar por grep que nada em `src/` a usa) e
  ajustar qualquer menção em `design-system.html`.
- Não alterar conteúdo/semântica dos relatórios — só densidade visual + limpeza.

## Testes exigidos
- Suíte de `print.test.ts` segue verde (nenhuma asserção de padding; garantir
  que a estrutura/o conteúdo não regrediram).
- `tsc` limpo; `npm test` + `npm run build` verdes.

## Critérios de aceite
- [ ] Listagem do Histórico com densidade visual equivalente à `table.rt` da
      Calculadora dentro do `.sec-card`.
- [ ] Regra `#print-root h2.pdf-section` removida; sem órfãos (grep limpo).
- [ ] Só tokens; nenhum hex/valor bruto novo; mudanças documentadas em
      design-system.html.
- [ ] Suíte inteira verde e build OK.

## Referências
- Revisão da issue 043 (guardião-design, 2026-07-06) · `src/export/print.ts` ·
  `references/design-system.css` (`.table td` L276, `table.rt td` L721-722,
  `#print-root h2.pdf-section` ~L622-628) · `references/design-system.html`.

## Plano Técnico

### Análise do existente (grep real)
- **`table.table` da listagem do Histórico** — `src/export/print.ts:428`
  (`renderHistoryPrintView`, Fornadas) e `:484` (`renderHistoryCostsPrintView`,
  Financeiro). Ambas são passadas a `secCard()` (`:124-128`), que embrulha em
  `.sec-card > .sec-body`. Logo, no print, a estrutura real é
  `#print-root .sec-card > .sec-body > table.table`. É o único ponto onde
  `table.table` vive dentro de `.sec-body`.
- **`table.table` fora do print (NÃO regredir)** — `src/ui/historyView.ts:361`
  (tela Histórico), `src/ui/sourdoughTable.ts:154`, `src/ui/ingredientsTable.ts:146`,
  `src/ui/batchPanel.ts:297`, `src/ui/pricingPanel.ts:167` (`.table mt-3`). Nenhuma
  fica sob `#print-root .sec-body` — o seletor escopado abaixo não as toca.
- **Densidade-alvo já existente** — `#print-root table.rt td/th`
  (`design-system.css:718,722`) usa `padding: var(--sp-1) var(--sp-2)`. É a
  densidade a espelhar (§14.5 é o conteúdo; a paridade visual v2 vem da 034/043).
- **Padrão de escopo já usado** — `#print-root .sec-card > .sec-body { ... }`
  (`design-system.css:702-704`). O novo seletor segue exatamente esse prefixo.
- **Regra genérica que fica intacta** — `.table td/th` (`:268,276`,
  `var(--sp-2) var(--sp-4)`) e `#print-root .table td/th` (`:631-632`, só
  recolore). Continuam valendo para as telas e para o recolorir de impressão.
- **Órfã `#print-root h2.pdf-section`** (`design-system.css:622-628`): grep
  `pdf-section` em `src/` só acha `print.test.ts` (comentário-doc + asserções
  `toBeNull`, linhas 13/411/466) — nenhum código gera `h2.pdf-section`. Confirmado
  morto. Também há comentário CSS estale em `:661-662` afirmando que o Histórico
  "continua em h2.pdf-section/table.table" — falso pós-043 (usa `.sec-card`).

### Cenários
- **Caminho feliz** — PDF Histórico/Fornadas e Histórico/Financeiro: as linhas
  Data/Receita/Produzidas/Vendidas (ou /Custo/Lucro) passam a `--sp-1 --sp-2`
  (mesma altura de linha da `table.rt` da Calculadora). Especificidade do novo
  seletor = (1,0,3,1), acima de `#print-root .table td` (1,0,1,1) e de `.table td`
  (0,0,1,1): o override de padding vence independente da ordem no arquivo.
- **Borda — tela Histórico (`historyView.ts:361`)**: `table.table` fora de
  `#print-root` → seletor não casa → padding de tela (`--sp-2 --sp-4`) preservado.
- **Borda — Calculadora e demais telas**: `table.table` das telas de edição
  (sourdough/ingredients/batch/pricing) não estão sob `#print-root .sec-body` →
  intactas. `table.rt` do print não é `table.table` → não casa → intacta.
- **Erro/regressão evitada**: NÃO alterar `.table td` global (linha 276) — isso
  atingiria todas as telas (o próprio comentário L272-275 documenta o ajuste
  pós-teste do cliente). A correção é escopada, não global.

### Decisão de implementação (1 linha cada)
- **Opção (a) — regra CSS escopada tokens-only.** Adotada: reusa os tokens
  `--sp-1/--sp-2` da `table.rt` sem duplicar valores e sem tocar em `.table`
  global; alternativa (b) "reusar de outra forma" exigiria trocar a classe no
  DOM (`print.ts`), mudando estrutura/testes sem ganho — rejeitada.
- **Seletor:** `#print-root .sec-card > .sec-body table.table td` e `... th`,
  espelhando o prefixo já usado em `:702` — garante escopo só à listagem do
  print, nunca às telas.

### Arquivos a criar
- Nenhum.

### Arquivos a modificar
- `references/design-system.css`:
  1. **Remover** a regra órfã `#print-root h2.pdf-section { ... }` (L622-628).
  2. **Adicionar**, logo após `:704` (bloco `.sec-card > .sec-body`), a regra
     escopada tokens-only:
     `#print-root .sec-card > .sec-body table.table td,`
     `#print-root .sec-card > .sec-body table.table th { padding: var(--sp-1) var(--sp-2); }`
     com comentário citando paridade com `table.rt` (§14.5, achado 043).
  3. **Corrigir** o comentário estale em `:656-662`: o Histórico já não usa
     `h2.pdf-section` (pós-043 usa `.sec-card`); a listagem interna herda `.table`
     + novo padding escopado.
- `references/design-system.html`:
  - Complementar a nota da linha 529 (que já diz "só a tabela de listagem interna
    segue em `table.table`") acrescentando que ela recebe padding escopado
    `--sp-1 --sp-2` para paridade de densidade com `table.rt`. A menção histórica
    de "deixam de usar `h2.pdf-section`" (L511) descreve a remoção e permanece
    correta — não é doc de regra viva; não requer remoção.

### Arquivos que NÃO devem ser tocados
- `src/export/print.ts` (estrutura DOM não muda — só CSS).
- `src/export/print.test.ts` (asserções são DOM/`toBeNull`, não padding; seguem
  verdes — a classe `pdf-section` já não é gerada; o comentário-doc L13 é
  histórico e correto).
- `.table td/th` global (`design-system.css:268,276`) e `#print-root .table
  td/th` (`:631-632`) — telas dependem deles.
- Qualquer `table.table` de tela (`historyView`, `sourdoughTable`,
  `ingredientsTable`, `batchPanel`, `pricingPanel`).

### Ordem de implementação
1. CSS: remover órfã (L622-628); corrigir comentário estale (L656-662).
2. CSS: adicionar regra escopada de padding após L704.
3. HTML: complementar nota de densidade na L529.
4. Gates: `npx tsc --noEmit`, `npm test` (print.test.ts verde), `npm run build`.
5. Sanidade visual: abrir `design-system.html` e conferir densidade da listagem.
