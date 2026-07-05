---
id: "029"
titulo: Fix — achados da revisão da issue 028 (refactor PDF)
tipo: fix
deps: ["028"]
status: todo
---

## Contexto

Achados médios da revisão da issue 028 (refactor visual dos PDFs), não
bloqueantes (o alto já foi corrigido na própria 028 antes do commit).

## O que fazer

1. **`revisor-spec`, médio** — `src/ui/pages/calculadora.ts` (botão "Imprimir
   Custos", gate por `showCosts` §2.A.2): sem teste. `calculadora.test.ts` não
   exercita `.hidden`/`store.subscribe(syncCostsBtn)`. Adicionar caso: montar
   com `prefs.getShowCosts()===false` → botão "Imprimir Custos" com `.hidden`;
   após `store.setShowCosts(true)` → visível (valida reatividade via
   `subscribe`). Mesmo padrão do caso já existente em `historyView.test.ts`
   para o botão "Imprimir Financeiro".
2. **`guardiao-design`, médio** — `references/design-system.html` (seção
   "Impressão / Salvar em PDF", linhas ~444-485) ficou obsoleta após a issue
   028: ainda cita `renderPrintView` (removida/renomeada), exemplo usa classes
   mortas `.print-view/.print-title/.print-section/.print-line/.print-label/
   .print-value` (removidas de `design-system.css`) e mostra um botão único em
   vez do padrão novo de 2 botões por tela. Nenhum dos tokens/classes novos
   (`--print-credit`/`--print-debit`/`--print-muted`, `.pdf-section`/`.kv`/
   `.pdf-credit`/`.pdf-debit`/`.pdf-muted-row`/`.pdf-alert`/`.pdf-footer`) está
   documentado. Reescrever a seção: 4 fluxos de PDF (Receita/Custos/Fornadas/
   Financeiro), exemplo com `.card`+`.table`/`.kv`, 2 botões por tela, paleta
   `--print-*` documentada.

## Testes exigidos (TDD)

- Item 1: novo caso em `calculadora.test.ts` (vermelho → verde).

## Critérios de aceite

- [ ] Gate do botão "Imprimir Custos" coberto por teste (paridade com histórico).
- [ ] `design-system.html` reflete o estado atual de `print.ts`/`design-system.css`
      pós-028 (zero referência a função/classe removida).
- [ ] Suíte + build seguem verdes.

## Referências

- issue 028 (base) · revisão `revisor-spec`/`guardiao-design` da 028 ·
  `src/ui/pages/calculadora.ts`, `src/ui/historyView.test.ts` (padrão do caso
  a espelhar), `references/design-system.html`, `references/design-system.css`
