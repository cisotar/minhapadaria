---
id: "033"
titulo: Renomear receita vira edição inline (sem prompt/modal)
tipo: ui
deps: ["017"]
status: done
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
- [x] Botão "Renomear" não abre `window.prompt` nem qualquer modal.
- [x] Edição inline funciona via Enter/blur (confirma) e Esc (cancela).
- [x] Nome do usuário nunca passa por `innerHTML`.
- [x] Testes de `recipesList.test.ts` atualizados (o teste 7 atual, linha 174, que mocka `promptFn`, é substituído pelo fluxo inline).

## Referências
- spec.md (refactor II) · src/ui/recipesList.ts:218-223,326-329 · src/storage/recipes.ts:37,225

---

## Plano Técnico

### Análise do existente
Busca real (`grep`) no código e no design system:

- `src/ui/recipesList.ts:292-338` → `buildCard(recipe)` monta o card. O `<h3>` do
  nome é criado em `:296` via `h('h3', {}, [recipe.name])` (já usa `textContent`
  por construção do `h`, escape XSS garantido — regra de ouro 3, spec §11.1).
- `src/ui/recipesList.ts:219-224` → `renameRecipe(id, currentName)` usa `promptFn`
  (`window.prompt` injetável). A guarda atual é `result === null || result === '' ||
  result === currentName` (cancelado/vazio/sem mudança). Essa mesma tripla guarda é
  reusada na confirmação inline.
- `src/ui/recipesList.ts:327,330` → botão "Renomear" já existe e dispara
  `renameRecipe`. Mantém-se o botão; muda só o que ele faz (toggle inline).
- `src/ui/recipesList.ts:216,223,232` → `renderList()` repinta o grid inteiro. NÃO
  reusar no confirmar inline: `renderList()` recria todos os cards e destruiria o
  input em foco. O padrão de `ingredientsTable.ts` (cabeçalho `:11` "elementos
  `<input>` em foco NUNCA são recriados") é a abordagem a seguir — a troca
  `<h3>`↔`<input>` é local ao card, sem `renderList()`. Só o próprio `<h3>` é
  reescrito com `textContent` ao confirmar.
- `src/storage/recipes.ts:37` (`rename(id, name)`) → contrato inalterado; segue
  chamado exatamente como hoje. `recipeStore.rename` já persiste e atualiza datas.
- `src/ui/dom.ts` → `h` (`:45`, cria `<input>` com `value` como propriedade),
  `clear` (`:99`), `on` (`:104`). Reuso total, nenhuma lib nova (regra de ouro 2).
- `src/ui/ingredientsTable.ts:237-246` → molde de `<input className:'cell-input'>`
  com `aria-label` para edição inline de nome; reusar `className:'cell-input'`
  (classe já existente no design-system, sem CSS novo).
- `references/design-system.css:358` → `.recipe-card h3` tem estilo próprio; o
  `<input>` temporário usa `.cell-input` (já estilizada). Nenhuma classe nova.
- Padrão de eventos teclado (Enter/Esc) não existe ainda em recipesList; é novo,
  mas trivial via `on(input,'keydown',...)` com `e.key === 'Enter'`/`'Escape'`
  (Web API nativa, sem lib — regra de ouro 1). Doc: MDN KeyboardEvent.key
  (https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).

### Cenários
Regra de negócio: spec §2.F ("Renomear") + refactor II ("Edição inline, linha a
linha, como na tabela principal", spec.md:134). Escape: regra de ouro 3 / §11.1.

- Caminho feliz (Enter): card com `<h3>Pão Rústico</h3>`. Clique "Renomear" → `<h3>`
  é substituído por `<input value="Pão Rústico">`, `focus()` + `select()`. Usuário
  digita "Pão Novo", Enter → `recipeStore.rename(id,'Pão Novo')`; `<input>` volta a
  `<h3>Pão Novo</h3>`.
- Caminho feliz (blur): idêntico ao Enter — blur confirma com o valor atual.
- Cancelar (Esc): usuário digita algo, Esc → `<h3>` restaurado com o nome ORIGINAL,
  `rename` NÃO chamado. Guarda: flag para o `blur` disparado pelo Esc não reconfirmar.
- Borda vazio: valor `''` (ou só espaços? seguir guarda atual literal `=== ''`, sem
  `trim` para preservar comportamento idêntico ao prompt antigo) → `rename` NÃO
  chamado; `<h3>` restaurado com nome original.
- Borda igual: valor === nome atual → `rename` NÃO chamado; volta a `<h3>` (sem
  gravação redundante, idêntico à guarda do prompt).
- Segurança: nome `<img src=x onerror=alert(1)>` → tanto `<h3>` (via `h`/`textContent`)
  quanto `<input>.value` (propriedade, nunca `innerHTML`) renderizam literal; nenhum
  nó `<img>`/`<script>` criado.
- Regressão §8/UX: `promptFn`/`window.prompt` nunca é invocado no fluxo de renomear.

### Testes primeiro — não se aplica (issue de UI)
Esta é issue `tipo: ui`; os testes são jsdom em `recipesList.test.ts`, não Vitest
core/storage. Ainda assim, escrever ANTES da implementação (TDD, memória
"Fixes sem re-review"). Casos a substituir o teste 7 atual (linha 174) e adicionar:

1. Clique "Renomear" → `.recipe-card h3` some, existe `.recipe-card input`
   (ou `input.cell-input`) com `value === 'Pão Rústico'`; `document.activeElement`
   é esse input (foco). (Nota jsdom: `select()` não observável — verificar só foco.)
2. Enter com "Pão Novo" válido → `recipeStore.get(id).name === 'Pão Novo'`; card
   volta com `.recipe-card h3` textContent `'Pão Novo'`; sem `input`.
3. Blur com "Pão Novo" válido → mesmo resultado do caso 2.
4. Esc após digitar "Xyz" → `recipeStore.get(id).name === 'Pão Rústico'` (inalterado);
   `.recipe-card h3` restaurado com `'Pão Rústico'`; `rename` (spy) não chamado.
5. Confirmar com `''` → `rename` (spy) não chamado; `<h3>` restaurado.
6. Confirmar com valor === nome atual → `rename` (spy) não chamado.
7. `promptFn` (vi.fn injetado) NÃO é chamado ao clicar "Renomear" nem ao confirmar.
8. XSS: renomear para `<img src=x onerror>` → confirmar → `card.querySelector('img')`
   é null; `h3.textContent` é o literal.

Montagem: reusar `mount(...)` já existente na suíte (createMemoryStorage +
makeStore + deps vi.fn). Para casos 4-7, injetar `rename` spy via
`vi.spyOn(recipeStore,'rename')`.

### Arquivos a criar
Nenhum.

### Arquivos a modificar
- `src/ui/recipesList.ts` — substituir `renameRecipe(id, currentName)` (`:219-224`)
  por lógica de toggle inline operando sobre o `<h3>` e o botão do card. Refatorar
  `buildCard` (`:292-338`) para: (a) manter referência ao `<h3>` (`nameEl`) e à célula
  onde ele vive; (b) `renameBtn` (`:327,330`) dispara `startInlineEdit(nameEl, recipe)`
  em vez de `renameRecipe`. `startInlineEdit` cria `<input className:'cell-input'
  value=recipe.name aria-label:'Novo nome da receita'>`, substitui o `<h3>` no DOM
  (`replaceWith`), `focus()`+`select()`, e liga `keydown` (Enter=confirmar,
  Escape=cancelar) + `blur` (confirmar). `confirm(value)`: aplica guarda
  `value === '' || value === recipe.name` → cancela; senão `recipeStore.rename(id,
  value)` e reconstrói o `<h3>` com o novo nome via `h('h3',{},[value])`. `cancel()`:
  recria `<h3>` com nome original. Flag `settled` para blur pós-Enter/Esc não
  reprocessar. Remover a dep default `promptFn` NÃO — pode permanecer no tipo
  `RecipesListDeps` (usado por testes antigos) mas deixa de ser referenciado no
  fluxo renomear; decisão: remover `renameRecipe` e a linha `:220` do prompt.
  Manter `promptFn` declarado? Sim — inofensivo e evita quebrar assinatura de deps;
  registrar em comentário que não é mais usado (ou removê-lo se lint acusar não-uso:
  remover `promptFn` local `:111` e o campo `prompt?` do tipo). Escolha: remover
  `promptFn` local e o campo `prompt?` de `RecipesListDeps` para não deixar código
  morto (regra de ouro 2). Atualizar `src/ui/pages/receitas.ts` se injetar `prompt`.
- `src/ui/recipesList.test.ts` — substituir teste 7 (`:174-188`) pelos casos 1-8
  acima; remover uso de `prompt` mock onde não se aplica.

### Arquivos que NÃO devem ser tocados
- `src/storage/recipes.ts` (contrato `rename` inalterado).
- `src/core/*` (nenhuma regra de cálculo afetada).
- `references/design-system.css` (reusa `.cell-input`/`.recipe-card h3`, sem CSS novo).
- `src/ui/dom.ts` (`h/clear/on` já suficientes).
- Demais componentes UI.

### Ordem de implementação
1. Escrever/atualizar testes jsdom (casos 1-8) em `recipesList.test.ts` — TDD,
   devem falhar.
2. Verificar se `src/ui/pages/receitas.ts` injeta `prompt`; se sim, remover a
   injeção junto com a remoção do campo.
3. Implementar `startInlineEdit`/`confirm`/`cancel` em `recipesList.ts`; religar o
   botão "Renomear"; remover `renameRecipe` + `promptFn` + campo `prompt?`.
4. Rodar suíte; garantir golden §12 e demais testes verdes.
