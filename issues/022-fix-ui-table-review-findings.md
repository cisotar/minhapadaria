---
id: "022"
titulo: Fix — achados da revisão da issue 014 (tabela de insumos)
tipo: fix
deps: ["014"]
status: done
---

## Contexto
Achados médio/baixo do revisor-spec na auditoria da issue 014, diferidos conforme o processo do loop. guardiao-design aprovou sem achados.

## O que fazer
Testes jsdom faltantes em `src/ui/ingredientsTable.test.ts` (4 médios):
1. Alternador g/mL: clicar mL → weightCell inalterada (canônico g, §2.A).
2. Blur §5.C reverte+erro: Peso do Produto = 0 e Preço Pago = −1.
3. Mínimo 1 farinha: botão remover desabilitado na última farinha (§5.B).
4. Ordem fixa das colunas: asserção dos textos dos `<th>` (§2.A.2).

Baixos:
5. `.unit-suffix` em `references/design-system.css` está morta (não consumida) — remover OU aplicar onde o mockup previa; ajustar `design-system.html` conforme.
6. 7 estilos inline via `style` em `ingredientsTable.ts` (~linha 106) — extrair para classes utilitárias com tokens, documentadas. **Ampliado pela review da 015**: +8 ocorrências em `sourdoughTable.ts` (linhas ~124/134/207/285/301/302/576/591). **Ampliado pela review da 016**: +2 (`modeToggle.ts` ~61 `margin-left:auto` → utilitário `.push-right`; `batchPanel.ts` ~61 `display:contents` → classe `.contents` ou remover wrapper). **Ampliado pela review da 017**: +3 em `recipesList.ts` (~90/105/117 — incl. terceiro `margin-left:auto`; priorizar `.push-right`). **Ampliado pela review da 018**: +6 (`bakeForm.ts` ~127 display:none → `.hidden` ou atributo hidden; `historyView.ts` ~227 nota muted → `.note-muted`, ~269/272 swatches → `.swatch-dot--revenue/--profit`, ~307 text-align → `.num--left` ou remover .num da data; `trendChart.ts` ~119 → atributo fill). Total 26; extrair todas para classes utilitárias tokenizadas documentadas em `references/design-system.html`.
7. Soma do "Total da massa" feita no DOM (~linha 153) — avaliar expor peso total no RecipeSummary do core e consumir de lá (§1.6).

## Testes exigidos (TDD)
- Os 4 casos jsdom acima; suíte existente permanece verde.

## Critérios de aceite
- [x] 4 testes novos verdes.
- [x] Sem classe morta no design system.
- [x] Sem estilos inline em ingredientsTable.ts (ou justificados um a um).
- [x] Suíte 100% verde.

## Referências
- spec §2.A, §2.A.2, §5.B, §5.C, §1.6 · review da issue 014 (2026-07-05 ~04:40)
