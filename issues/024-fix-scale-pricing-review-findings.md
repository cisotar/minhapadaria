---
id: "024"
titulo: Fix — achados da revisão da issue 016 (escala/precificação UI)
tipo: fix
deps: ["016"]
status: todo
---

## Contexto
Achados médio/baixo remanescentes das revisões da issue 016. O achado alto do guardiao-design (`.field-row` duplicando `.row`) já foi corrigido na própria iteração (`.row`/`.row--end` promovidas ao design system). Estilos inline novos (modeToggle `margin-left:auto`; batchPanel `display:contents`) foram anexados à issue 022 item 6.

## O que fazer
1. **[médio, revisor-spec] F_total defasado em peso→%** — `src/ui/batchPanel.ts` (~linhas 119/258): no modo peso→% o core deriva `flourTotalWeight = Σ pesos das farinhas`, mas o campo "Peso de Farinha Total" continua editável (edição inerte — recalc sobrescreve) e `patchDynamic()` não o repinta nesse modo → valor exibido fica defasado ao editar pesos na tabela. Corrigir: campo readonly quando `calculationMode==='weight-to-percentage'` + incluir no repaint. Teste jsdom: editar peso de farinha em peso→% → F_total exibido acompanha.
2. **[baixo, revisor-spec] Testes de UI faltantes**: (a) editar Peso em peso→% → % derivada atualiza (ingredientsTable); (b) quantidade <1 reverte no blur do batchPanel (§5.C).
3. **[baixo, guardiao-design] Comentário impreciso** em `references/design-system.css` (~389–393): `.grid-2` cita recipe-grid/kpi-row como precedente de 300px, mas usam 260/140px — ajustar comentário para citar só o `.grid-2` do mockup.

## Testes exigidos (TDD)
- Casos jsdom dos itens 1 e 2; suíte existente permanece verde.

## Critérios de aceite
- [ ] F_total readonly e repintado em peso→% (§1.3/§3.A/§1.6).
- [ ] 3 testes novos verdes.
- [ ] Comentário do .grid-2 corrigido.
- [ ] Suíte 100% verde.

## Referências
- spec §1.3, §1.6, §3.A, §5.C · reviews da issue 016 (2026-07-05 ~05:50)
