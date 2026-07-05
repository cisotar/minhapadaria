---
id: "013"
titulo: Fornadas — cálculos, agregações dia/semana/mês, comparação, melhor/pior + persistência
tipo: core
deps: ["002", "011"]
status: todo
---

## Contexto
Histórico de produção/vendas (spec §14): registro por fornada, snapshots de custo/preço, agregações e comparações. `planned` fora dos totais (§14.4/14.6).

## O que fazer
- `src/core/bakes.ts` (cálculo puro):
  - Por fornada (§14.3): `CustoTotal = unitCost × qtdProduzida` · `Receita = unitSalePrice × qtdVendida` · `Lucro = Receita − CustoTotal` · `Desperdício = produzida − vendida` · `Taxa% = desperdício/produzida × 100`.
  - Agregações (§14.4): por dia, semana (segunda–domingo) e mês calendário → `BakeHistorySummary` (§6): produzidos, vendidos, custo, faturamento, lucro, margem média %, taxa desperdício média %. **`planned: true` fora de TODAS as agregações.**
  - Filtros (§14.5): por receita (`recipeId`), por intervalo de datas custom.
  - Comparação de períodos (§14.5): atual vs anterior com variação % (guard divisão por zero: anterior 0 → variação null/"—").
  - Melhor/pior dia/semana/mês por lucro no período (§14.5).
  - Confirmação de planejada (§14.6): remover `planned` → entra nos totais.
- `src/storage/bakes.ts`: CRUD de `BakeEntry` (reusar helpers/idioma da 011 — regra de ouro 2); edição e exclusão (§14.5); órfãs preservadas quando receita excluída (§14.7 — nunca cascade delete).
- Datas: agrupar semana/mês com código próprio simples sobre `Date` OU lib consolidada (`date-fns`) se complexidade justificar — decidir no plano, doc oficial consultada (regra de ouro 1/4).

## Testes exigidos (TDD)
- Fornada produzida 10, vendida 8, custo 4.43, preço 7.38 → custo 44.30, receita 59.04, lucro 14.74, desperdício 2, taxa 20%.
- Agregação dia: 2 fornadas mesma data somam; planned na mesma data NÃO soma.
- Semana segunda–domingo: fornadas domingo e segunda seguinte caem em semanas distintas.
- Mês: 2026-07-31 e 2026-08-01 em meses distintos.
- Comparação: semana atual lucro 100 vs anterior 80 → +25%; anterior 0 → null.
- Melhor/pior por lucro entre 3 dias.
- Excluir receita → fornada vira órfã, permanece listável (§14.7).
- Confirmar planejada → conta nas agregações.

## Critérios de aceite
- [ ] Fórmulas §14.3 exatas; snapshots nunca recalculados da receita atual.
- [ ] Planned fora dos totais até confirmação (§14.4/14.6).
- [ ] Órfãs íntegras e visíveis (§14.7).
- [ ] Backup (012) passa a incluir o histórico real.

## Referências
- spec §5.D, §6, §14 · date-fns docs (se adotada)
