---
id: "037"
titulo: Fix — achado da revisão da issue 029 (nota de reatividade do PDF Financeiro)
tipo: fix
deps: ["029"]
status: todo
---

## Contexto

Achado médio da revisão `guardiao-design` da issue 029 (doc de impressão em `references/design-system.html`).

## O que fazer

1. **`guardiao-design`, médio** — `references/design-system.html:483-485` afirma que o
   botão "Imprimir Financeiro" do Histórico é "re-exibido reativamente via
   `store.subscribe` ... sem re-mount da tela (coberto em `historyView.test.ts`)".
   Não corresponde ao comportamento real: `src/ui/historyView.ts:259-268` resolve
   `.hidden` UMA VEZ no mount (comentário explícito no próprio código), sem
   `store.subscribe`/checkbox "Exibir custos" nessa tela. O caso 12 de
   `historyView.test.ts` testa só o estado inicial, não reatividade. A
   reatividade via `store.subscribe`/checkbox real só existe na Calculadora
   (`src/ui/pages/calculadora.ts:167-171`, coberta pelo caso 4 de
   `calculadora.test.ts`, issue 029).
   Corrigir a nota em `design-system.html`: separar em duas frases — Calculadora:
   reativo via checkbox "Exibir custos" + `store.subscribe`, sem re-mount
   (coberto por `calculadora.test.ts`); Histórico: resolvido uma única vez no
   mount a partir de `prefs.getShowCosts()` (sem toggle nesta tela — precisa
   reabrir/remontar pra refletir mudança feita alhures), citando só o caso 12
   de `historyView.test.ts` como cobertura do estado inicial (não de
   reatividade).

## Testes exigidos (TDD)

Não se aplica — mudança é só de texto/doc, nenhum código de produção ou teste novo.

## Critérios de aceite

- [ ] `design-system.html` não afirma mais que o Histórico é reativo via `store.subscribe`.
- [ ] Nota distingue claramente Calculadora (reativa) de Histórico (resolvido uma vez no mount).
- [ ] Suíte + build seguem verdes (nenhuma mudança de código esperada, só confirmar que nada quebrou).

## Referências

- issue 029 (base) · revisão `guardiao-design` da 029 · `references/design-system.html:483-485` ·
  `src/ui/historyView.ts:259-268` · `src/ui/pages/calculadora.ts:167-171`
