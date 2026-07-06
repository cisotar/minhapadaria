---
id: "039"
titulo: Fix — achado da revisão da issue 035 (aria-label redundante no input do modal)
tipo: fix
deps: ["035"]
status: todo
---

## Contexto

Achado baixo da revisão `guardiao-design` da issue 035 (1º modal do design system).

## O que fazer

1. **`guardiao-design`, baixo** — `src/ui/modal.ts:67`: o `<input>` recebe um
   `aria-label` com o MESMO texto do `<label for>` associado (linha ~72). O
   `aria-label` sobrepõe o `<label>` para leitores de tela, criando nome
   acessível duplicado sem necessidade (o `for`/`id` já dá o nome). Boa prática
   WAI-ARIA: evitar nome acessível duplicado. Remover o `aria-label` do input
   e deixar só o `<label for>` nomear o campo.

## Testes exigidos (TDD)

Nenhum teste novo necessário (ajuste de atributo a11y); os testes de foco/modal
existentes (`modal.test.ts`) devem seguir verdes. Rodar suíte + build ao final.

## Critérios de aceite

- [ ] Input do modal não tem mais `aria-label` redundante; nome acessível vem só do `<label for>`.
- [ ] `modal.test.ts` (foco/abertura/confirmação) segue verde.
- [ ] Suíte + build seguem verdes.

## Referências

- issue 035 (base) · revisão `guardiao-design` da 035 · `src/ui/modal.ts:67,72`
