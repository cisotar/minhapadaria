---
id: "047"
titulo: Fix — achados baixos da revisão da issue 046 (pills de visualização do Balanço)
tipo: fix
deps: ["046"]
status: todo
---

## Contexto
Revisão da issue 046 (pills Completa/Unidades/Fornadas do card Balanço) aprovou a
implementação com dois achados de severidade **baixo**, encaminhados aqui.

## Achados

### 1. Cobertura — estado vazio sob views (revisor-spec)
`src/ui/historyView.test.ts` — o caso de borda "estado vazio (colspan) alternando de
view" (issue 046 §Casos de borda; `specs/aba-balanco.md` §2.6 / §3 caso 7) não tem
teste. É seguro por construção (a célula `td[colspan=10]` do estado vazio não recebe
`.col-unit`/`.col-bake`, logo `display:none` não a atinge), mas falta o teste que trava
esse contrato.
- **Fazer:** adicionar um caso que renderize o Histórico **sem fornadas**, alterne para
  Unidades e Fornadas, e verifique que a linha de estado vazio permanece com exatamente
  1 `td[colspan=10]` visível (não escondido por classe de coluna).

### 2. Doc — `style` bruto no exemplo do design system (guardiao-design)
`references/design-system.html:508` — a célula de exemplo da nova seção (Balanço, pills)
usa `style="text-align:left"` na coluna Data, em vez de `class="num num--left"` que o
próprio guia documenta como o substituto oficial (linha 166) e que o código real
(`historyView.ts`) já usa. Repete um padrão pré-existente falho de outras linhas, mas
introduzido nesta issue → corrigir.
- **Fazer:** trocar `style="text-align:left"` por `class="num num--left"` na célula
  Data do exemplo, igual ao exemplo já existente em ~linha 197 do mesmo arquivo.

## Critérios de aceite
- [ ] Novo teste de estado-vazio-sob-views verde; alterna Unidades/Fornadas e confirma
      1 `td[colspan=10]` na linha de "sem fornadas".
- [ ] `references/design-system.html` sem `style="text-align:left"` na célula Data do
      exemplo do Balanço — usa `.num--left`.
- [ ] Suíte inteira verde + build OK; nada da 046/045 regride.

## Referências
- Issue 046, `specs/aba-balanco.md` §2.6.
- `references/design-system.css:166`/`:197` (padrão `.num--left`).
