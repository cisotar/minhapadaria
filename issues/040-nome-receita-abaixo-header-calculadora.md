---
id: "040"
titulo: Nome da receita como campo fixo abaixo do header da Calculadora (+ criar-ao-nomear)
tipo: ui
deps: ["036", "035"]
status: todo
---

## Contexto
Refino do pedido do cliente sobre a issue 036 (`3de722c`). Hoje a Calculadora
(`receitas.html`/`calculadora.ts`), ao abrir com `?recipe=<id>` válido,
**substitui** o `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural"
pelo nome da receita (editável inline). O cliente quer outro comportamento:

1. O título "🍞 Calculadora de Pão com Fermento Natural" e o subtítulo "Os
   ingredientes recalculam automaticamente a cada edição — sem enviar
   formulário (§1.6)" devem **sempre** permanecer (nunca substituídos).
2. O nome da receita vira um **campo fixo, editável, logo abaixo do
   subtítulo** (dentro de `.page-header .inner`), sempre visível.
3. Clicar em "Calculadora" (abrir `receitas.html` sem `?recipe`) passa a ser
   **outro caminho de criar/salvar receita**: o campo de nome aparece vazio e,
   ao ser nomeado, a receita é criada e salva com esse nome — aparecendo já
   nomeada na aba Receitas (`index.html`). Sem nome digitado → nada é criado
   (sem lixo na lista).

Decisão do cliente (respondida em 2026-07-05):
- Campo sempre visível/editável, mesmo sem `?recipe`.
- Posição: dentro do header, abaixo do subtítulo.
- Gatilho de salvar (caminho sem `?recipe`): **ao digitar o nome** (confirmar o
  campo com texto não-vazio) — não ao abrir, não a cada edição de ingrediente.

## O que fazer
- **Reverter** a substituição do `<h1>` da issue 036: `.page-header h1` e o
  `.subtitle` permanecem estáticos e intactos em todos os casos.
- Adicionar, dentro de `.page-header .inner` (abaixo do `<p class="subtitle">`),
  um campo de nome da receita editável — sempre presente. Sugestão: `<input
  class="input">` com `aria-label`/label "Nome da receita" e `placeholder`
  "Nome da receita" (reuso de `.input`, design-system; sem classe nova). Valor
  inicial = `store.getState().recipe.name` (vazio quando efêmera sem nome).
- Persistência ao confirmar (Enter/blur), com a mesma disciplina de guarda:
  - **Com receita carregada** (`?recipe=<id>` válido, autosave já ligado):
    `store.update((d) => { d.name = value; })` com guarda (vazio ou igual ao
    atual → não grava) — o pipeline de autosave existente persiste. NUNCA
    `recipeStore.rename` direto (evitar caminho de escrita duplicado).
  - **Sem receita** (acesso direto, efêmera): ao confirmar com nome não-vazio,
    `recipeStore.create({ ...store.getState().recipe, name: value })`; sincronizar
    o id no store (`store.update((d) => { d.id = created.id; d.name = value; })`),
    ligar o autosave (mesma pipeline), e `history.replaceState(null, '',
    'receitas.html?recipe=<id>')` para que reload mantenha a receita. Nome vazio
    → nenhuma criação.
- Autosave: reestruturar `calculadora.ts` para o subscribe/flush existirem
  sempre, mas só gravarem quando há um `recipeId` (nulo na efêmera até nomear).
  Reusar o debounce ~400ms + flush em `visibilitychange`/`beforeunload` já
  existentes (sem lógica nova de persistência).
- Nome do usuário sempre via `value`/`textContent` — nunca `innerHTML` (regra de
  ouro 3, §11.1).
- Reuso: `h/clear/on` (dom.ts); `.input`/`.subtitle`/`.page-header` (design-
  system). A mecânica de edição inline `inlineNameEdit.ts` (issue 036) pode ser
  reusada OU substituída por input fixo — decidir no plano conforme a UX
  "campo sempre visível" (input fixo tende a encaixar melhor que click-to-edit
  para o estado vazio/placeholder).

## Testes exigidos (TDD — `calculadora.test.ts`, jsdom + `vi.useFakeTimers`)
- `?recipe=<id>` válido → `.page-header h1` continua com o texto estático "🍞
  Calculadora…"; existe campo de nome abaixo do subtítulo com value = nome da
  receita.
- Sem `?recipe` → `.page-header h1` estático presente; campo de nome presente e
  vazio (placeholder).
- `?recipe` inexistente → banner "Receita não encontrada"; `<h1>` estático
  presente; campo de nome presente (efêmera).
- Editar nome com receita carregada (Enter/blur) → `store.getState().recipe.name`
  atualizado; após 400ms, `recipeStore.get(id).name` reflete o novo nome.
- Guarda: vazio ou igual ao atual (receita carregada) → não grava.
- Esc (se usar inline) / não-confirmação → sem gravação.
- Caminho novo (sem `?recipe`): confirmar nome não-vazio → `recipeStore.create`
  chamado 1× com esse nome; a receita passa a existir na lista
  (`recipeStore.list()` +1); autosave passa a persistir edições seguintes;
  `history.replaceState` chamado com `receitas.html?recipe=<id>` (spy/mocável).
- Caminho novo com nome vazio → `recipeStore.create` NÃO chamado; nada na lista.
- XSS: nome `<img src=x onerror>` → sem nó `<img>`; texto literal no campo/estado.

## Critérios de aceite
- [ ] `<h1>` "🍞 Calculadora…" + subtítulo sempre presentes (comportamento da
      036 de substituir o `<h1>` revertido).
- [ ] Campo de nome fixo, editável, sempre visível, num `.card` próprio em
      `#app` posicionado ENTRE a barra de export (Exportar XLSX / Imprimir
      Receita / Imprimir Custos) e o card "Ancoragem e Planejamento da Fornada"
      (refino de posição pedido pelo cliente — não mais no header).
- [ ] Com receita carregada: edição do nome persiste via autosave (sem
      `recipeStore.rename` direto).
- [ ] Sem `?recipe`: nomear a receita cria+salva (aparece na aba Receitas), com
      `history.replaceState` para `?recipe=<id>`; sem nome → nada criado.
- [ ] Nome nunca via `innerHTML`.
- [ ] `calculadora.test.ts` cobre os casos acima; `recipesList.test.ts`
      (renomear inline do card, issue 033) segue verde.

## Referências
- Pedido do cliente 2026-07-05 (refino da 036) · issue 036 (`3de722c`),
  035 (`ff615e1`) · src/ui/pages/calculadora.ts · receitas.html:22-28 ·
  src/ui/inlineNameEdit.ts · src/storage/recipes.ts (create/update) ·
  MDN History.replaceState

## Plano Técnico

### Decisões (tomadas, uma linha cada)
1. **Input fixo, NÃO reusar `inlineNameEdit`** — o cliente pediu "campo
   sempre visível + estado vazio com placeholder"; `startInlineNameEdit`
   é click-to-edit (nó de exibição → input só ao clicar), o oposto de
   "sempre visível". Um `<input class="input">` fixo encaixa; `inlineNameEdit.ts`
   permanece INTOCADO (segue servindo o card em `recipesList.ts`). A tríplice
   guarda (vazio/igual → não grava) é reimplementada no handler de commit —
   são 2 condições triviais, não justificam abstração acoplada ao `replaceWith`.
2. **Autosave sempre registrado, gravação condicionada a `recipeId`** — troca o
   `let autosaveEnabled: boolean` por `let recipeId: string | null`; o
   `subscribe`/`flush`/`visibilitychange`/`beforeunload` passam a existir SEMPRE
   (fora de qualquer `if`), mas `flush()` faz `if (recipeId === null) return;`
   antes de `recipeStore.update(...)` — na efêmera não-nomeada nada é gravado
   (junk-prevention). Zero lógica nova de persistência (§10 debounce, §1.6).
3. **Lazy-create ao nomear a efêmera** — commit com nome não-vazio e
   `recipeId === null` → `recipeStore.create({ ...store.getState().recipe, name })`
   (create gera id novo, ignora o id da semente; honra ingredientes/modos),
   depois `store.update((d) => { d.id = created.id; d.name = value; })` para
   sincronizar o id no store publicado (senão o `recipeStore.update` do autosave
   não acha o registro — localiza por `recipe.id`), set `recipeId = created.id`
   (liga o autosave) e `replaceUrl('receitas.html?recipe=' + created.id)`.
4. **`replaceUrl` injetável** — novo dep opcional
   `replaceUrl?: (url: string) => void` (default `(url) => history.replaceState(null, '', url)`);
   em jsdom o teste passa `vi.fn()` e nunca toca a `location`/`history` real.
5. **Guarda no caminho carregado** — `recipeId !== null`: se
   `value === '' || value === store.getState().recipe.name` → retorna sem gravar.

### Análise do existente
- `src/ui/pages/calculadora.ts` → `initCalculadora(deps)`: contém HOJE o bloco
  `if (autosaveEnabled) { ...substitui <h1>... + pipeline autosave }`. A
  substituição do `<h1>` (linhas ~233–280, `startInlineNameEdit`) é REVERTIDA;
  o pipeline (debounce 400ms + `flush` + `visibilitychange` + `beforeunload`,
  ~282–298) é REUSADO, movido para fora do `if` e guardado por `recipeId`.
- `src/ui/dom.ts` → `h`/`clear`/`on`: constroem o `<input>`/label via
  `createElement`/`textContent` (escapa XSS, regra 3). `h` aplica `value` como
  PROPRIEDADE (dom.ts:64) — nome do usuário nunca vira HTML. Reuso total.
- `src/storage/recipes.ts` → `create(seed)` gera `id: newId()` (linha 200,
  ignora `seed.id`), mescla os demais campos (`...clone(seed)`), retorna clone;
  `update(recipe)` localiza por `recipe.id` (findIndex, 211) e faz append se não
  achar. CONFIRMA a necessidade do id-sync (decisão 3). NÃO usar `rename` (evita
  segundo caminho de escrita, fora do autosave).
- `src/ui/state.ts` → `update(mutator)`: `draft = structuredClone(current.recipe)`,
  aplica o mutator (pode setar `draft.id`/`draft.name`), `recalculate` preserva
  ambos (`recalc.ts:60 state = structuredClone(recipe)`). CONFIRMA que o id-sync
  via `store.update` funciona. `subscribe` já dispara o pipeline no `notify`.
- `references/design-system.css` → `.field` (label+control, 193), `.input`
  (198), `.page-header .inner` (flex baseline wrap, 136). Reuso: `div.field` >
  `label` + `input.input`, com `style="flex-basis:100%"` (quebra de linha =
  keyword de layout, mesma convenção dos `style` inline já usados no arquivo)
  para o campo cair ABAIXO do subtítulo dentro do `.inner`. NENHUMA classe nova.
- `src/ui/recipesList.ts` → `startInlineEdit` (241) chama `startInlineNameEdit`
  com `onCommit = recipeStore.rename`: independente do header — não é tocado.

### Cenários (números da spec / §12 quando cabível)
- **Caminho feliz carregado** (`?recipe=<id>` válido): `<h1>` "🍞 Calculadora…"
  e o `.subtitle` intactos; campo abaixo com `value = recipe.name`. Editar
  "Pão Salvo"→"Pão Editado" (Enter/blur) → `store.recipe.name` imediato; após
  400ms `recipeStore.get(id).name === 'Pão Editado'` (mesmo pipeline §10).
- **Caminho feliz efêmera** (sem `?recipe`): `<h1>`/subtítulo estáticos; campo
  VAZIO (placeholder), mesmo com `goldenSeed().name === 'Pão Rústico'` — o valor
  inicial do campo é `''` na efêmera, não o nome do seed. Digitar "Minha Receita"
  + Enter → `recipeStore.create` 1×, `list()` +1, `replaceUrl` com
  `receitas.html?recipe=<id>`, e edições seguintes de ingrediente passam a
  persistir (autosave ligado).
- **Borda `?recipe` inexistente**: banner `.chip-warn` "Receita não encontrada…";
  `<h1>` estático; campo presente e VAZIO (efêmera, `recipeId = null`).
- **Junk-prevention 1**: efêmera, editar % Água 70→90 SEM nomear, avançar
  5000ms → `recipeStore.list()` inalterado; `replaceUrl` não chamado (`flush`
  no-op com `recipeId === null`).
- **Junk-prevention 2**: efêmera, confirmar nome VAZIO ('') → `create` NÃO
  chamado; `list()` inalterado.
- **Guarda carregado**: nome '' ou igual ao atual → sem gravação (§ nenhuma
  mutação → nenhum `notify` → nenhum autosave).
- **XSS** (§11.1, regra 3): nome `<img src=x onerror=alert(1)>` carregado →
  `.page-header img` inexistente; `input.value` é o texto literal (h aplica
  `value` como propriedade, nunca `innerHTML`).

### Testes primeiro (TDD — `calculadora.test.ts`, jsdom + `vi.useFakeTimers`)
Substituir o describe "nome da receita editável no header (issue 036)" por
"nome da receita como campo fixo (issue 040)". Casos:
1. `?recipe=<id>` válido → `.page-header h1`.textContent === STATIC_H1;
   `.page-header input`.value === 'Pão Salvo'.
2. sem `?recipe` → `.page-header h1` estático; `.page-header input` presente e
   `value === ''`.
3. `?recipe` inexistente → `.chip-warn` presente; `h1` estático; input presente
   e `value === ''`.
4. carregado, Enter "Pão Editado" → `store`/campo imediato; `advanceTimersByTime(399)`
   ainda 'Pão Salvo' no store; `+1` → `recipeStore.get(id).name === 'Pão Editado'`.
5. carregado, blur "Pão Blur" → após 400ms `recipeStore.get(id).name === 'Pão Blur'`.
6. guarda: `value=''` e depois `value='Pão Salvo'` (igual) → após 400ms nome
   inalterado no store.
7. efêmera, Enter "Minha Receita": `vi.spyOn(recipeStore,'create')` chamado 1×;
   `recipeStore.list().length === before+1` com esse nome; `replaceUrl` (`vi.fn`)
   chamado com `receitas.html?recipe=${created.id}`; depois editar % Água e
   `advanceTimersByTime(400)` → `recipeStore.get(id)` reflete a % nova (autosave
   ligado pós-nomeação).
8. efêmera, Enter com `value=''` → `create` NÃO chamado; `list()` inalterado;
   `replaceUrl` não chamado.
9. junk-prevention: efêmera, editar % Água sem nomear + `advanceTimersByTime(5000)`
   → `recipeStore.list()` igual ao `before`; `replaceUrl` não chamado.
10. XSS: nome `<img src=x onerror=alert(1)>` carregado → `.page-header img` null;
    `input.value` === string literal.
- Manter verdes os testes 1–4 do primeiro describe (integração `?recipe`) e
  `recipesList.test.ts` (renomear inline do card, issue 033).

### Arquivos a criar
- Nenhum. A lógica permanece em `initCalculadora` (testável via deps injetáveis);
  não há módulo/lib novo (sem dependência externa nova, §10/§11.1).

### Arquivos a modificar
- `src/ui/pages/calculadora.ts`: (a) remover a substituição do `<h1>` (bloco
  036 + import `startInlineNameEdit`); (b) adicionar o dep `replaceUrl` em
  `InitCalculadoraDeps`; (c) montar o campo fixo `div.field > label + input.input`
  em `.page-header .inner` (valor inicial `autosaveEnabled ? recipe.name : ''`,
  placeholder "Nome da receita"); (d) handler de commit (Enter/blur) com as
  decisões 3/5; (e) trocar `autosaveEnabled` por `recipeId: string|null` e mover
  o pipeline para fora do `if`, com `flush` guardado por `recipeId`; (f)
  atualizar o docblock do topo.
- `src/ui/pages/calculadora.test.ts`: substituir o describe do header 036 pelos
  casos 1–10 acima; ajustar o comentário do `beforeEach` (o `<h1>` não é mais
  trocado).

### Arquivos que NÃO devem ser tocados
- `src/ui/inlineNameEdit.ts` (segue servindo o card via `recipesList.ts`).
- `src/ui/recipesList.ts` e `src/ui/recipesList.test.ts` (renome do card intacto).
- `src/storage/recipes.ts`, `src/ui/state.ts`, `src/ui/dom.ts`, `src/core/*`
  (APIs existentes bastam — reuso, regra 2).
- `references/design-system.css` (só `.field`/`.input`/`.page-header`; sem token
  ou classe nova).
- `receitas.html` (o `<h1>`+subtítulo do shell já são estáticos; o campo é
  injetado em runtime — nenhuma mudança no shell).

### Ordem de implementação
1. Escrever os testes 1–10 (falhando) no describe novo de `calculadora.test.ts`.
2. Em `calculadora.ts`: remover o bloco de substituição do `<h1>` e o import
   `startInlineNameEdit` (testes 1–3 dos header-036 deixam de valer; casos novos
   passam a exigir o campo).
3. Adicionar `replaceUrl` ao `InitCalculadoraDeps` (default `history.replaceState`).
4. Trocar `autosaveEnabled` por `recipeId`; mover o pipeline
   `subscribe`/`flush`/`visibilitychange`/`beforeunload` para fora do `if`, com
   `flush` fazendo `if (recipeId === null) return;`.
5. Montar o campo fixo em `.page-header .inner` (valor inicial + placeholder) e o
   handler de commit (guarda carregado; lazy-create + id-sync + `replaceUrl`).
6. Rodar `calculadora.test.ts` + `recipesList.test.ts` verdes; lint/typecheck.
