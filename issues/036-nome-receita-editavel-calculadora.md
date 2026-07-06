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

## Plano Técnico

### Análise do existente (busca real no código)
- **`src/ui/recipesList.ts:240-288` `startInlineEdit`** — o MOLDE. Toda a mecânica já existe: flag `settled` (evita blur pós-Enter/Esc reprocessar), `input.cell-input` com `value`/`aria-label='Novo nome da receita'`, tríplice guarda `value === '' || value === originalName → restaura sem gravar`, Enter/blur confirmam, Esc cancela, `restore(name)` via `input.replaceWith(el)` + reatribui a referência do nó. Só DUAS coisas variam entre card e Calculadora: (1) o nó exibido — `<h3>` no card vs `<h1>` no header; (2) o caminho de escrita — `recipeStore.rename(recipe.id, value)` (linha 269) no card vs `store.update` na Calculadora. Lógica idêntica ⇒ regra de ouro 2 manda EXTRAIR, não duplicar.
- **`src/ui/state.ts:85-94` `store.update(mutator)`** — é o método a usar: clona o `recipe`, aplica o `mutator`, roda `normalize` + `recalculate` e chama `notify()`. É `notify()` que dispara o `store.subscribe` do autosave. Mudar só `draft.name` deixa `recalculate` inerte (nenhum derivado depende do nome) — seguro. NÃO usar `applyTransform` (é para transformações que retornam `Recipe` nova; overkill aqui).
- **`src/ui/pages/calculadora.ts:219-237`** — pipeline de autosave já pronto: `store.subscribe` reagenda `setTimeout(flush, 400ms)`; `flush` chama `recipeStore.update(store.getState().recipe)`; `visibilitychange`/`beforeunload` forçam flush. Reusar tal-qual — o `store.update` do nome entra nesse fluxo sem código novo.
- **`src/ui/pages/calculadora.ts:88-100`** — `autosaveEnabled` já é `true` só quando `?recipe=<id>` resolve uma `Recipe` real; é o gate exato para "só mostrar o nome editável quando há receita carregada".
- **`receitas.html:23-28`** — shell com `<header class="page-header"><div class="inner"><h1>🍞 Calculadora…</h1><p class="subtitle">…</p></div></header>`. É o único `<h1>` da tela → localizável por `document.querySelector('.page-header h1')`. `design-system.css:140` estiliza `.page-header h1`; `.cell-input` (`:270`) estiliza o input de edição. Nenhuma classe nova.
- **`src/ui/dom.ts`** — `h`/`clear`/`on`; `h('h1',{},[name])` insere o nome via `createTextNode` (escapa XSS, regra 3). `Element.replaceWith` já é o padrão de troca usado no card (recipesList.ts:257,285).

**Decisão 1 (extrair vs. função separada): EXTRAIR.** Criar `src/ui/inlineNameEdit.ts` exportando `startInlineNameEdit(opts)` genérico (recebe `target`, `currentName`, `makeDisplay(name)=>HTMLElement`, `onCommit(newName)`, `onDisplayChange?`, `ariaLabel?`). `recipesList.ts.startInlineEdit` vira um wrapper fino (passa `makeDisplay = h3`, `onCommit = recipeStore.rename`, `onDisplayChange = nameRef.el = el`); a Calculadora passa `makeDisplay = h1`, `onCommit = store.update(d=>{d.name=v})`. Justificativa (uma linha): a mecânica settled/guarda/Enter-blur-Esc/restore é byte-a-byte a mesma — só o nó e o caminho de escrita mudam, exatamente os dois pontos de parametrização (regra de ouro 2: "se quase existe, estender; nunca duplicar").

**Decisão 2 (escrita no store + autosave):** `onCommit: (value) => store.update((draft) => { draft.name = value; })` — atualiza `recipe.name` e `notify()` dispara o debounce → `recipeStore.update` persiste. NUNCA chamar `recipeStore.rename` direto na Calculadora (evita caminho de escrita duplicado, §49 da spec + pedido explícito da issue).

**Decisão 3 (onde renderizar):** dentro do bloco `if (autosaveEnabled)` de `calculadora.ts`, localizar `document.querySelector('.page-header h1')` e, se existir, `staticH1.replaceWith(makeName(store.getState().recipe.name))`, onde `makeName(name)` cria um `<h1 title="Clique para renomear">` com `on(el,'click', …startInlineNameEdit…)` e recursivamente reusa `makeName` como `makeDisplay` (cada novo `<h1>` reata seu próprio clique). Sem `?recipe` ou id inexistente → `autosaveEnabled=false` → bloco não roda → `<h1>` estático permanece intacto. Nenhuma mudança em `receitas.html` (troca é em runtime).

### Cenários
- **Feliz:** `?recipe=<id>` de "Pão Salvo" → header mostra `<h1>Pão Salvo</h1>` (estático "🍞 Calculadora…" fora do DOM). Clique → `<input.cell-input value="Pão Salvo">` focado/selecionado. Enter/blur com "Pão Editado" → `store.update` → `<h1>Pão Editado</h1>`; após 400ms `recipeStore.get(id).name === 'Pão Editado'`.
- **Borda — sem `?recipe`:** golden seed efêmera (§12, água 70%), `autosaveEnabled=false` → `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural" permanece; nenhum nó de nome editável.
- **Borda — id inexistente:** banner `.chip-warn` "Receita não encontrada…" + `<h1>` estático permanece; sem nome editável.
- **Borda — Esc:** nome restaurado ao original; nenhum `store.update` (sem `notify`, nada agendado); mesmo após avançar timers, `recipeStore` inalterado.
- **Borda — vazio (`''`) ou igual ao atual ("Pão Salvo"):** tríplice guarda → `restore(original)` sem `onCommit`; `store` e `recipeStore` inalterados.
- **Erro/segurança (XSS):** nome `<img src=x onerror=alert(1)>` → `.page-header h1 img` é `null`; `.page-header h1`.textContent === a string literal (via `createTextNode`, regra 3 / spec v5 §11.1).

### Testes primeiro (TDD — `calculadora.test.ts`, jsdom + `vi.useFakeTimers`)
Ajuste de fixture: `beforeEach` passa a montar o shell real (header + `#app`):
`document.body.innerHTML = '<header class="page-header"><div class="inner"><h1>🍞 Calculadora de Pão com Fermento Natural</h1><p class="subtitle">…</p></div></header><div id="app"></div>'` (inócuo aos testes 1–4 existentes).

1. `?recipe=<id>` válido ("Pão Salvo") → `document.querySelector('.page-header h1').textContent === 'Pão Salvo'`; nenhum nó com textContent `'🍞 Calculadora de Pão com Fermento Natural'`.
2. `search=''` (golden seed) → `.page-header h1`.textContent === `'🍞 Calculadora de Pão com Fermento Natural'`; `.page-header input` é `null`.
3. `?recipe=inexistente` → banner `.chip-warn` presente; `.page-header h1`.textContent === estático; sem input de nome.
4. Clique em `.page-header h1` → `.page-header input`.value === 'Pão Salvo'; `document.activeElement === input`.
5. Enter com "Pão Editado" válido → `.page-header h1`.textContent === 'Pão Editado' e sem `.page-header input`; `advanceTimersByTime(399)` → `recipeStore.get(id).name === 'Pão Salvo'`; `+1` (400) → `=== 'Pão Editado'`.
6. Blur com "Pão Blur" → idêntico ao caso 5 (h1 restaurado; após 400ms `recipeStore` reflete "Pão Blur").
7. Esc após digitar "Xyz" → `.page-header h1`.textContent === 'Pão Salvo'; `advanceTimersByTime(5000)` → `recipeStore.get(id).name === 'Pão Salvo'` (nada gravado).
8. Confirmar vazio (`''`) com Enter → h1 volta 'Pão Salvo', `recipeStore` inalterado após timers. E confirmar valor igual ('Pão Salvo') → sem gravação.
9. XSS: receita nome `<img src=x onerror=alert(1)>` + `?recipe` válido → `.page-header h1 img` é `null`; textContent === a string literal.

(Regressão da extração: `recipesList.test.ts` casos 1-7 de "renomear inline" devem permanecer VERDES sem alteração — é a rede de segurança do refactor.)

### Arquivos a criar
- `src/ui/inlineNameEdit.ts` — `startInlineNameEdit(opts)` genérico (extração da mecânica de `startInlineEdit`). Doc-comment cita issue 033 (origem) e regra de ouro 2 (motivo). Só `h`/`on` de `dom.ts`; zero lib nova.
- `src/ui/inlineNameEdit.test.ts` (recomendado) — unit test da mecânica genérica (guarda/Enter/blur/Esc/XSS) desacoplada de qualquer store, injetando `makeDisplay`/`onCommit` espiões. Reforça o TDD da extração; os ACs de UI ficam em `calculadora.test.ts`.

### Arquivos a modificar
- `src/ui/pages/calculadora.ts` — dentro de `if (autosaveEnabled)`: localizar `.page-header h1` e substituí-lo pelo `<h1>` editável (`makeName` + `startInlineNameEdit`, `onCommit = store.update`). Import de `inlineNameEdit.ts`. Atualizar o doc-comment do topo (nova responsabilidade: nome editável no header).
- `src/ui/recipesList.ts` — `startInlineEdit` vira wrapper fino sobre `startInlineNameEdit` (comportamento idêntico; `onCommit = recipeStore.rename`). Import de `inlineNameEdit.ts`.
- `src/ui/pages/calculadora.test.ts` — `beforeEach` monta o shell com header; +9 casos acima.

### Arquivos que NÃO devem ser tocados
- `receitas.html` — o `<h1>` é localizado/trocado em runtime; nenhuma mudança de shell.
- `src/ui/state.ts` — `store.update` já faz exatamente o necessário (clona/normaliza/recalcula/notifica).
- `src/storage/recipes.ts` — `rename`/`update` reusados sem mudança; na Calculadora o caminho é `store.update` → autosave (nunca `rename` direto).
- `src/ui/dom.ts` — reuso de `h`/`clear`/`on`.
- `src/ui/seed.ts` — remoção do Azeite é OUTRO item do refactor (issue à parte), fora do escopo desta issue.
- `references/design-system.css` — reuso de `.page-header h1` + `.cell-input`; nenhuma classe nova.
- `src/ui/recipesList.test.ts` — permanece intacto como regressão da extração.

### Ordem de implementação
1. Escrever `inlineNameEdit.test.ts` (mecânica genérica) — RED.
2. Criar `src/ui/inlineNameEdit.ts` até o teste passar — GREEN.
3. Refatorar `recipesList.ts.startInlineEdit` para delegar; rodar `recipesList.test.ts` (deve seguir verde sem edição).
4. Ampliar `calculadora.test.ts` (`beforeEach` + 9 casos) — RED.
5. Wiring do `<h1>` editável em `calculadora.ts` (`if (autosaveEnabled)`) — GREEN.
6. `npm test` + typecheck/lint (gates) completos.

### Notas de conformidade
- Regra de ouro 1: nenhuma dependência nova — só DOM nativo + `dom.ts`. `Element.replaceWith`/`focus`/`select` já são padrão no código (recipesList.ts:257,285); MDN: https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith
- Regra de ouro 3 / spec v5 §11.1: nome sempre via `textContent`/`value` (`h(...)` + `input.value`), nunca `innerHTML`; 100% client-side, sem rede/secret.
- Divergência consciente registrada: o input de edição no header reusa `.cell-input` (mesmo molde do card) — visualmente compacto para um `<h1>`; polish tipográfico do input de header fica fora do escopo (nenhuma classe nova, regra de ouro 2).
