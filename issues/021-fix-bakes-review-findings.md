---
id: "021"
titulo: Fix — achados da revisão da issue 013 (bakes)
tipo: fix
deps: ["013"]
status: todo
---

## Contexto
Achados médio/baixo do revisor-spec na auditoria da issue 013 (histórico de fornadas), diferidos para issue própria conforme o processo do loop.

## O que fazer
1. **[médio] Bucket-fantasma de fornadas planejadas** — `src/core/bakes.ts` (~linha 154): `groupBy` monta buckets a partir de TODAS as entradas (incluindo `planned:true`) antes de `aggregatePeriod` filtrar; período cujas únicas fornadas são planejadas gera bucket com totais zerados na saída de `groupByDay/Week/Month`, podendo ser escolhido por `bestPeriod`/`worstPeriod` (lucro 0). Corrigir: filtrar `!isPlanned` ANTES do agrupamento (ou descartar buckets vazios). Adicionar teste: período só-planejado não gera bucket (§14.4/§14.6).
2. **[baixo] fmt duplicado em teste** — `src/core/bakes.test.ts` (~linha 215): helper `fmt` reimplementa `formatDate`; importar de `./format` (regra de ouro 2).
3. **[baixo] Confirmar com cliente** — `wastageRate`/`averageProfitMargin` do período são agregados ponderados, não média aritmética simples (§14.4 diz "média"); decisão já registrada em PROGRESS.md — item permanece só para rastreio da confirmação humana, sem código.

## Testes exigidos (TDD)
- groupByDay/Week/Month com entradas exclusivamente `planned` no período → nenhum bucket para o período.
- bestPeriod/worstPeriod não retornam período só-planejado.
- Suíte existente permanece verde.

## Critérios de aceite
- [ ] Nenhum bucket derivado apenas de fornadas planejadas (§14.4/§14.6).
- [ ] fmt do teste importa formatDate.
- [ ] Suíte 100% verde.

## Referências
- spec §14.4, §14.6 · review da issue 013 (iteração 2026-07-05 ~04:05)
