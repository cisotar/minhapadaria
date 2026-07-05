---
id: "031"
titulo: Fix — achados da revisão da issue 030 (eliminação de volume)
tipo: fix
deps: ["030"]
status: todo
---

## Contexto

Achados médios/baixo da revisão `guardiao-design` da issue 030 (eliminação de
unidades de volume), não bloqueantes (`revisor-spec` aprovou sem achados).

## O que fazer

1. **médio** — `references/design-system.css:309-318`: classe `.unit-toggle`
   ficou órfã (nenhum módulo em `src/` a referencia mais após a remoção do
   alternador g/mL na issue 030) mas segue no bundle de produção. Remover a
   regra (ou comentário `/* deprecated */` se preferir manter por histórico —
   preferência: remover, brandbook §4.1 minimalismo).
2. **médio** — `references/design-system.html:246,269-270,283-284`: o guia de
   estilo vivo ainda documenta a coluna "Unidade" e o `<span
   class="unit-toggle">` (botões g/mL) como parte do padrão canônico da tabela
   de insumos — não existe mais na UI real. Atualizar o exemplo da tabela
   removendo a coluna/toggle, sincronizando com `ingredientsTable.ts` pós-030.
3. **baixo, informativo, sem ação de código** — `mockups/calculadora.html` e
   `mockups/calculadora-farinhas.html` ainda mostram visualmente a coluna
   "Unidade"/alternador g/mL removidos. Mockups são somente-leitura (regra de
   ouro do projeto) — não editar. Apenas registrar a divergência no
   `PROGRESS.md` (mesmo tratamento já dado à divergência de volume vs. spec
   v5 na issue 030).

## Testes exigidos (TDD)

- Nenhum teste novo necessário (mudança só em CSS morto + doc); rodar suíte
  completa + build ao final para confirmar zero regressão.

## Critérios de aceite

- [ ] `.unit-toggle` removida (ou explicitamente marcada deprecated) de
      `design-system.css`.
- [ ] `design-system.html` não mostra mais coluna "Unidade"/toggle g-mL no
      exemplo da tabela de insumos.
- [ ] Divergência mockups-vs-app registrada em `PROGRESS.md` (sem editar
      `mockups/`).
- [ ] Suíte + build seguem verdes.

## Referências

- issue 030 (base) · revisão `guardiao-design` da 030 ·
  `references/design-system.css`, `references/design-system.html`,
  `mockups/calculadora.html`, `mockups/calculadora-farinhas.html`
