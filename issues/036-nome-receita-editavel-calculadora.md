---
id: "036"
titulo: Calculadora exibe e permite editar o nome da receita carregada
tipo: ui
deps: ["014", "033"]
status: todo
---

## Contexto
Pedido do cliente (spec.md, refactor "Nova Receita" item 2). Hoje a Calculadora (`receitas.html`/`calculadora.ts`) não exibe o nome da receita em lugar nenhum — só o `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural" (`receitas.html:25`). Quando há `?recipe=<id>` válido (`initCalculadora`, `calculadora.ts:88-100`), o nome da receita carregada deve aparecer no lugar do `<h1>` estático, editável inline no mesmo padrão sem `window.prompt`/modal já usado no card de `recipesList.ts` (issue 033).

## O que fazer
- Quando `initCalculadora` carrega uma receita via `?recipe=<id>` válido (`autosaveEnabled === true`), substituir o `<h1>` estático por um elemento com o nome da receita (`store.getState().recipe.name`).
- Sem `?recipe=<id>` ou com id inexistente (banner "Receita não encontrada"): `<h1>` estático permanece — comportamento atual inalterado.
- Nome editável inline: reusar o MESMO padrão de `startInlineEdit` de `recipesList.ts` (Enter/blur confirmam, Esc cancela, tríplice guarda vazio/igual-ao-atual → não grava).
- Confirmar com nome novo válido: atualizar `recipe.name` no `store` (`createAppState`) — NÃO chamar `recipeStore.rename` direto; deixar o pipeline de autosave já existente (`calculadora.ts:219-237`, debounce ~400ms + flush em `visibilitychange`/`beforeunload`) persistir, para não duplicar caminho de escrita.
- Nome sempre via `textContent`/`value` (nunca `innerHTML` — regra de ouro 3, spec v5 §11.1).
- Reusar `h/clear/on` de `dom.ts` (regra de ouro 2) — nenhuma lib nova.

## Testes exigidos (TDD)
- `?recipe=<id>` válido → elemento com o nome da receita aparece no lugar do `<h1>` estático; `<h1>` estático não está no DOM.
- Sem `?recipe` (golden seed efêmera) → `<h1>` estático continua presente.
- `?recipe=<id>` inexistente (banner) → `<h1>` estático continua presente, sem elemento de nome editável.
- Clicar/ativar o nome → vira `<input>` com valor atual, foco automático.
- Enter com nome novo válido → `store.getState().recipe.name` atualizado; após o debounce (`vi.useFakeTimers`), `recipeStore.update`/`recipeStore.get(id).name` reflete o novo nome; elemento volta a modo texto com o novo nome.
- Blur com nome novo válido → mesmo resultado do Enter.
- Esc → nome restaurado ao original; nada gravado (nem no `store` nem após o debounce).
- Nome vazio ou igual ao atual ao confirmar → não altera `recipe.name`, elemento volta ao nome original.
- XSS: nome `<img src=x onerror>` → `card`/nó do nome não contém `<img>`; renderizado como texto literal.

## Critérios de aceite
- [ ] Nome da receita aparece na Calculadora no lugar do `<h1>` estático quando há receita carregada via `?recipe=<id>`.
- [ ] Sem receita carregada, `<h1>` estático permanece (comportamento atual).
- [ ] Nome editável inline, mesmo padrão sem prompt/modal do card (issue 033).
- [ ] Edição do nome persiste via o pipeline de autosave já existente (sem escrita duplicada/direta a `recipeStore.rename` fora dele).
- [ ] Nome do usuário nunca passa por `innerHTML`.
- [ ] `calculadora.test.ts` cobre os casos acima.

## Referências
- spec.md (refactor "Nova Receita", página Calculadora) · src/ui/pages/calculadora.ts:81-238 · receitas.html:22-28 · src/ui/recipesList.ts (padrão `startInlineEdit`, issue 033)
