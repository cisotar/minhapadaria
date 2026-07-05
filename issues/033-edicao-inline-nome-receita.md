---
id: "033"
titulo: Renomear receita vira edição inline (sem prompt/modal)
tipo: ui
deps: ["017"]
status: todo
---

## Contexto
Pedido do cliente (spec.md, refactor II): botão "Renomear" no card de receita (`recipesList.ts:326-329`) hoje chama `window.prompt` (`renameRecipe`, `recipesList.ts:218-223`). Deve virar edição inline do `<h3>` do nome, direto no card — sem diálogo.

## O que fazer
- Trocar `renameRecipe` (hoje `promptFn`) por toggle de modo edição no card: `<h3>` vira `<input type="text">` com `value` = nome atual, foco automático + `select()`.
- Confirmar (Enter ou blur) → chama `recipeStore.rename(id, novoValor)` (contrato inalterado, `recipes.ts:37`) e volta o `<h3>` a modo texto; mesma regra de guarda atual (vazio/igual ao atual → não chama `rename`).
- Cancelar (Esc) → restaura nome original sem chamar `rename`.
- Nome renderizado sempre via `textContent`/`value` (nunca `innerHTML` — regra de ouro 3, spec v5 §11.1).
- Botão "Renomear" continua existindo (dispara o toggle) — não abre mais `window.prompt`.
- Reusar `h/clear/on` de `dom.ts` (regra de ouro 2, sem lib nova).

## Testes exigidos (TDD)
- Clicar "Renomear" substitui `<h3>` por `<input>` com valor atual e foco.
- Enter com nome novo válido → `recipeStore.rename` chamado, card volta a `<h3>` com novo nome.
- Blur com nome novo válido → mesmo comportamento do Enter.
- Esc → `recipeStore.rename` NÃO chamado, `<h3>` restaurado com nome original.
- Nome vazio ao confirmar → `recipeStore.rename` NÃO chamado (mesma regra do prompt antigo).
- Nome igual ao atual ao confirmar → `recipeStore.rename` NÃO chamado.
- `window.prompt`/`promptFn` não é mais invocado no fluxo de renomear (spy/mock não chamado).

## Critérios de aceite
- [ ] Botão "Renomear" não abre `window.prompt` nem qualquer modal.
- [ ] Edição inline funciona via Enter/blur (confirma) e Esc (cancela).
- [ ] Nome do usuário nunca passa por `innerHTML`.
- [ ] Testes de `recipesList.test.ts` atualizados (o teste 7 atual, linha 174, que mocka `promptFn`, é substituído pelo fluxo inline).

## Referências
- spec.md (refactor II) · src/ui/recipesList.ts:218-223,326-329 · src/storage/recipes.ts:37,225
