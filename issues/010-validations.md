---
id: "010"
titulo: Validações da Seção 5 consolidadas (blur, bloqueios, avisos)
tipo: core
deps: ["008"]
status: todo
---

## Contexto
Camada de validação pura (spec §5) consumida pela UI: distinção bloqueio (reverte/impede) × aviso (permite, sinaliza).

## O que fazer
- `src/core/validation.ts` — funções puras retornando `{ valid, level: 'block' | 'warn', message }` (mensagens pt-BR, spec §7.1):
  - Soma % farinhas (principais e fermento) ≠ 100 no blur → bloqueio, reverte campo; NUNCA redistribuição automática (§5.A, §5.B).
  - Mínimo 1 farinha por grupo (§5.B).
  - Quantidade produtos ≥ 1; custos ≥ 0; Preço Pago ≥ 0 (§5.C).
  - Partes ≥ 0 e SomaPartes > 0 → bloqueio (§5.C).
  - Parte farinha = 0 → aviso (hidratação "—") (§5.C).
  - Proporção fermento ≥ 0; aviso se 0 (§5.C).
  - Margem 0–99,9 (§5.C).
  - Preço ≤ custo unitário → aviso (§5.C).
  - Peso/Volume do Produto > 0 → bloqueio (§5.C).
  - Histórico (§5.D/§14.6): vendida ≤ produzida (bloqueio); produzida ≥ 1; data futura → aviso "fornada planejada"; custos/preços unitários ≥ 0.

## Testes exigidos (TDD)
- Farinhas 60+50 → block; 60+40 → ok.
- SomaPartes 0 → block; partes 0:1:1 → ok (golden).
- Margem 100 → block/clamp; 99.9 → ok.
- packageSize 0 → block.
- Vendida 10 > produzida 8 → block; 8 ≤ 8 → ok.
- Data amanhã → warn planned; hoje → ok.
- Preço 4 ≤ custo 4.43 → warn.

## Critérios de aceite
- [ ] Todos os itens §5.A–D cobertos, um teste por regra.
- [ ] Nenhuma redistribuição automática em circunstância alguma (§5.A).
- [ ] Mensagens pt-BR.

## Referências
- spec §5, §14.6, §7.1
