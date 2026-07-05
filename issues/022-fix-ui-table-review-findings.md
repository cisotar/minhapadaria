---
id: "022"
titulo: Fix — achados da revisão da issue 014 (tabela de insumos)
tipo: fix
deps: ["014"]
status: todo
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
6. 7 estilos inline via `style` em `ingredientsTable.ts` (~linha 106) — extrair para classes utilitárias com tokens, documentadas.
7. Soma do "Total da massa" feita no DOM (~linha 153) — avaliar expor peso total no RecipeSummary do core e consumir de lá (§1.6).

## Testes exigidos (TDD)
- Os 4 casos jsdom acima; suíte existente permanece verde.

## Critérios de aceite
- [ ] 4 testes novos verdes.
- [ ] Sem classe morta no design system.
- [ ] Sem estilos inline em ingredientsTable.ts (ou justificados um a um).
- [ ] Suíte 100% verde.

## Referências
- spec §2.A, §2.A.2, §5.B, §5.C, §1.6 · review da issue 014 (2026-07-05 ~04:40)
