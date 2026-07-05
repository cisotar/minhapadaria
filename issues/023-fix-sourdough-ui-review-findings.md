---
id: "023"
titulo: Fix — achados da revisão da issue 015 (fermento/hidratação UI)
tipo: fix
deps: ["015"]
status: todo
---

## Contexto
Achados médio/baixo do revisor-spec na auditoria da issue 015. O achado alto do guardiao-design (`.num` ausente no peso total do fermento) já foi corrigido na própria iteração; os estilos inline novos foram anexados à issue 022 (item 6).

## O que fazer
Médios — testes jsdom faltantes em `src/ui/sourdoughTable.test.ts`:
1. §5.B: botão remover desabilitado quando resta 1 farinha do fermento (`validateFlourCount('fermento')`).
2. §5.C: bloqueio + reversão no blur para Partes inválidas — casos 0:0:0 (SomaPartes=0) e parte negativa (`validateSourdoughParts`).

Baixo:
3. "Custo por kg" calculado como `sd.costPerGram * 1000` no DOM (`sourdoughTable.ts` ~linha 713) — avaliar derivar `costPerKg` no core (resumo §2.B.5) e consumir de lá; se mantido na UI, justificar como conversão trivial de unidade documentada.

## Testes exigidos (TDD)
- Os 2 casos jsdom acima; suíte existente permanece verde.

## Critérios de aceite
- [ ] Testes §5.B e §5.C do fermento verdes.
- [ ] Decisão sobre costPerKg registrada (core ou UI justificada).
- [ ] Suíte 100% verde.

## Referências
- spec §2.B.5, §5.B, §5.C · review da issue 015 (2026-07-05 ~05:15)
