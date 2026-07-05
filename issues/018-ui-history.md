---
id: "018"
titulo: UI Tela de histórico — registro de fornada, filtros, KPIs, gráfico, melhor/pior, órfãs
tipo: ui
deps: ["013", "014"]
status: todo
---

## Contexto
Dashboard de fornadas (spec §14; mockup `mockups/historico.html`). Consome integralmente o core 013.

## O que fazer
- `historico.html` + `src/ui/`:
  - Registro rápido (§14.2): receita (select das cadastradas), data (default hoje, formato aaaa-mm-dd §7.1), qtd produzida, qtd vendida, custo unitário e preço (pré-preenchidos da receita, editáveis — snapshots), observações. Validações via 010 (§14.6): vendida ≤ produzida bloqueio; data futura aviso + badge "planejada".
  - Listagem cronológica, recentes primeiro, com editar/excluir (confirmação) (§14.5).
  - Filtros: por receita, por intervalo custom, granularidade dia/semana/mês (§14.4/14.5).
  - KPIs do período (§14.4): produzidos, vendidos, custo, faturamento, lucro, margem média, desperdício médio — planned fora.
  - Comparação período atual vs anterior com variação % (§14.5).
  - Melhor/pior dia/semana/mês por lucro (§14.5).
  - Gráfico de tendência faturamento+lucro (§14.5): lib consolidada leve client-side (candidatas: Chart.js, uPlot; critério: zero rede em runtime, bundle razoável) OU SVG próprio se o plano julgar mais simples — decidir no plano com doc oficial consultada (regras de ouro 1/4).
  - Órfãs: badge "receita excluída", registro visível (§14.7).
  - Confirmar fornada planejada → entra nos totais (§14.6).
- **Escape XSS**: observações e nomes renderizados via textContent (campo de texto livre! §14.2).

## Critérios de aceite
- [ ] Registro→listagem→agregação ponta a ponta consistente com o core 013.
- [ ] Planejada: badge, fora dos KPIs, confirmável.
- [ ] Vendida > produzida bloqueada na UI.
- [ ] Gráfico renderiza com 0, 1 e N fornadas sem crash.
- [ ] Observação `<script>alert(1)</script>` inerte.
- [ ] Datas aaaa-mm-dd; strings pt-BR; fiel ao mockup.

## Referências
- spec §5.D, §7.1, §14 · mockups/historico.html · docs oficiais da lib de gráfico escolhida
