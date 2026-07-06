---
id: "048"
titulo: Card Balanço — coluna Saldo também na visualização Unidades (antes de Status)
tipo: fix
deps: ["046"]
status: todo
---

## Contexto
Cliente pediu (2026-07-06, após entrega da 046): na visualização **Unidades** do
card Balanço faltou a coluna **Saldo**, que deve aparecer **antes de Status**.

Hoje Saldo é `.col-bake` (visível só em Completa/Fornadas). O cliente quer Saldo nas
**três** views. Como Data/Receita/Produção/Vendas/Status já são sempre-visíveis, tornar
Saldo sempre-visível **só o adiciona em Unidades** — Completa e Fornadas já o mostravam.

## Decisão
Saldo passa a ser coluna **sempre-visível** (remove `.col-bake` das 3 células: thead,
corpo, tfoot). Nenhum reorder de DOM: a ordem física já é `Faturamento(F) · Saldo ·
Status`; em Unidades o `Faturamento(F)` (`.col-bake`) segue escondido, então Saldo cai
exatamente **antes de Status**, como pedido. `.loss` em Saldo<0 preservado.

Mapa §2.6 atualizado:
- **Unidades** = 8 col: Data · Receita · Produção · Custo unitário · Vendas · Preço unitário · **Saldo** · Status
- **Fornadas** = 8 col (inalterada) · **Completa** = 10 col (inalterada).
- `.col-bake` fica só com Custo (C) e Faturamento (F).

## O que fazer
- `src/ui/historyView.ts` — remover `col-bake` das 3 células de Saldo
  (thead ~442, `buildBalanceRow` ~488, `buildBalanceFootRow` ~514); manter `.num` e a
  lógica condicional `.loss`.
- `specs/aba-balanco.md` §2.6 — atualizar o mapa de colunas (Saldo nas três views;
  Unidades = 8 col) via `arquiteto`, com linha de changelog.
- `references/design-system.html` — se o exemplo do Balanço marca Saldo como `.col-bake`,
  remover a classe da célula Saldo do exemplo (paridade com o código).

## Testes exigidos
- `src/ui/historyView.test.ts` — ajustar os testes da 046 que afirmam Saldo com
  `.col-bake`: Saldo **não** deve ter `.col-unit` nem `.col-bake` (sempre-visível), em
  thead, corpo e tfoot. Adicionar/ajustar caso que, em `.view-unidades`, a célula Saldo
  não está entre as escondidas.
- `tsc` limpo; `npm test` + `npm run build` verdes; nada da 046/045 regride.

## Critérios de aceite
- [ ] Visualização **Unidades** mostra Saldo, posicionado imediatamente antes de Status
      (8 colunas).
- [ ] Completa (10) e Fornadas (8) inalteradas; Saldo continua presente nelas.
- [ ] Saldo sem `.col-unit`/`.col-bake` em thead/corpo/tfoot; `.loss` em Saldo<0 mantido.
- [ ] `specs/aba-balanco.md` §2.6 reflete o novo mapa.
- [ ] Suíte verde + build OK.

## Referências
- Issue 046, `specs/aba-balanco.md` §2.6.
- `src/ui/historyView.ts` (células Saldo: thead/`buildBalanceRow`/`buildBalanceFootRow`).

## Plano Técnico

**Natureza (confirmado):** mudança **puramente de exibição** (spec §2.6). Zero fórmula, zero core, zero storage. As três células de Saldo já existem no DOM e são construídas com `formatCurrency(...totalProfit)` + `.loss` condicional; a única alteração é remover a classe de coluna `col-bake` para que a mecânica de `display` (mesma do toggle "Exibir custos", §2.6) deixe de escondê-las em `.view-unidades`. Nenhum valor, ordem, filtro (§2.5), ordenação (§2.5 P6) ou total (§2.4) muda.

### Análise do existente
Busca no código (`src/ui/historyView.ts`) confirma que **tudo já existe** e será apenas ajustado — nada novo:
- thead (linha 442): `h('th', { className: 'num col-bake' }, ['Saldo'])` → remover só `col-bake`, manter `num`.
- `buildBalanceRow` (linha 488): `balanceCell = h('td', { className: 'num col-bake' }, [...])` com `.loss` condicional (linha 489, §2.5 P5) → remover só `col-bake`; a lógica `.loss` em `totalProfit < 0` e o `'—'` de planejada ficam intactos.
- `buildBalanceFootRow` (linha 514): `balanceCell = h('td', { className: 'num col-bake' }, [...])` com `.loss` (linha 515) → remover só `col-bake`.
- Mecânica de visibilidade: `setBalanceView` (linhas 456-461) só troca a classe `view-*` no `<table>`; o esconde/mostra é CSS por `.col-bake`/`.col-unit`. `BALANCE_COLS = 10` (colspan do estado vazio, §3 caso 7) **não muda** — o número de colunas físicas continua 10.
- `formatCurrency`, `computeBakeDerived`, `bakeStatus` reusados sem tocar.

### Cenários
- **Feliz — Unidades:** Saldo passa a ser exibido entre Preço unitário e Status. Ex. fornada F=120, C=100 → Saldo `R$ 20,00` visível, Status `120,00%` (§2.2, gabarito §12). 8 colunas visíveis.
- **Saldo negativo em Unidades:** Vendas=0 → F=0, Saldo=−C (ex. C=100 → `R$ -100,00`), classe `.loss` (vermelho) presente em Unidades (antes só aparecia em Completa/Fornadas). §3 caso 1 + §2.5 P5.
- **Planejada em Unidades:** célula Saldo exibe `'—'` (sem `.loss`), badge "◌ Planejada" — §2.5 P4.
- **Completa/Fornadas:** inalteradas (Saldo já era visível). Regressão zero — §2.6.
- **Rodapé (tfoot):** ΣSaldo agora visível também em Unidades; `.loss` em ΣSaldo<0 preservado (§2.4).

### Arquivos a criar
Nenhum.

### Arquivos a modificar
- `src/ui/historyView.ts` — remover `col-bake` das 3 células de Saldo (thead ~442, `buildBalanceRow` ~488, `buildBalanceFootRow` ~514). Manter `num` e `.loss`.
- `src/ui/historyView.test.ts` — ajustar os casos da 046 que afirmam Saldo com `.col-bake`: Saldo não tem `col-unit` nem `col-bake` em thead/corpo/tfoot; em `.view-unidades` a célula Saldo não está entre as escondidas; Completa/Fornadas seguem exibindo Saldo.
- `references/design-system.html` — se o exemplo do Balanço marcar a célula Saldo com `col-bake`, removê-la para paridade com o código (verificar antes de editar).
- `specs/aba-balanco.md` §2.6 — **já atualizado** por este plano (mapa: Saldo nas 3 views; Unidades = 8 col; `.col-bake` só Custo C e Faturamento F) + changelog no topo.

### Arquivos que NÃO devem ser tocados
- `src/core/**` (nenhuma fórmula muda — §2.1/§2.2/§2.4).
- `src/state/**`, storage, export (§2.3 P2, só-leitura).
- Regras CSS de `.col-bake`/`.col-unit`/`.view-*` (o comportamento desejado emerge de tirar a classe da célula, não de mudar o seletor).

### Ordem de implementação
1. Ajustar `historyView.test.ts` (TDD leve, fix): asserts de Saldo sem `col-bake`/`col-unit` e visível em `.view-unidades` (vermelho).
2. Remover `col-bake` das 3 células de Saldo em `historyView.ts` (verde).
3. Conferir/ajustar `references/design-system.html` (paridade).
4. Gates: `tsc` limpo, `npm test` + `npm run build` verdes; verificar não-regressão da 045/046.
