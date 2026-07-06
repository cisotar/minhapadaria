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
