---
id: "025"
titulo: Fix — achados da revisão da issue 017 (tela de receitas)
tipo: fix
deps: ["017"]
status: done
---

## Contexto
Achados médio/baixo das revisões da issue 017. Estilos inline novos anexados à issue 022.

## O que fazer
Médios (revisor-spec):
1. Integração `?recipe=<id>` sem teste (pages/calculadora.ts ~98): adicionar jsdom cobrindo id válido → semente = receita salva + auto-save grava após debounce; id inexistente → banner + goldenSeed sem persistir; flush em visibilitychange(hidden)/beforeunload (§2.F/§10).
2. Operação "Abrir" sem assert (recipesList.ts ~269): teste do href `index.html?recipe=<encodeURIComponent(id)>` (§2.F).

Médios (guardiao-design):
3. Subtítulo dinâmico reimplementa `.page-header .subtitle` via inline (recipesList.ts ~127) — mover para `#rc-header` com class="subtitle" ou promover classe utilitária documentada.
4. `style: 'width:220px'` na busca (recipesList.ts ~96) — px bruto; usar atributo `size` ou deixar flex decidir.

Baixos:
5. "Criar em branco" (§2.F) ausente — só "valores padrão"; expor caminho em branco ou confirmar corte com cliente.
6. Divergência de layout (toolbar fora do page-header) — registrar como divergência aceita nesta issue (feito aqui) e revisar com cliente.

## Testes exigidos (TDD)
- Casos jsdom dos itens 1 e 2; suíte existente permanece verde.

## Critérios de aceite
- [x] Testes ?recipe/auto-save e Abrir verdes.
- [x] Subtítulo via classe do design system.
- [x] Sem px bruto na busca.
- [x] Decisão sobre "em branco" registrada.
- [x] Suíte 100% verde.

## Referências
- spec §2.F, §10 · reviews da issue 017 (2026-07-05 ~06:20)
