---
id: "026"
titulo: Fix — achados da revisão da issue 018 (histórico UI)
tipo: fix
deps: ["018"]
status: done
---

## Contexto
Achados baixos das revisões da issue 018 (ambas aprovadas). Estilos inline novos anexados à issue 022 (total 26).

## O que fazer
1. `bakeForm.ts` (~79/86/210): remover `.replace(',', '.')` antes de `parseDecimal` — normalização já é interna (§7.1).
2. `bakeForm.test.ts`: adicionar caso "Preço de venda −1 → bloqueio não-negativo" (§14.6), espelhando o teste do custo.
3. `pages/historico.ts` / `historyView.ts`: preencher `.subtitle` do header com o intervalo De/Até corrente (fidelidade ao mockup).
4. `trendChart.ts` (~119): usar atributo SVG `fill` em vez de `style="fill:..."`.
5. Documentar em `references/design-system.html` que `.chip-warn` também cobre "atenção operacional" (badge órfã) — ou criar variante semântica.

## Critérios de aceite
- [ ] parseDecimal recebe valor cru.
- [ ] Teste preço negativo verde.
- [ ] Subtítulo do período no header.
- [ ] Suíte 100% verde.

## Referências
- spec §7.1, §14.6 · reviews da issue 018 (2026-07-05 ~06:55)
