---
id: "035"
titulo: "+ Nova receita" abre modal de nome antes de criar; seed sem Azeite
tipo: ui
deps: ["017"]
status: todo
---

## Contexto
Pedido do cliente (spec.md, refactor "Nova Receita" item 1 e 3). Hoje `createRecipe()` (`recipesList.ts:196-201`) cria a receita direto via `recipeStore.create(goldenSeed())` — nome genérico "Pão Rústico de Azeite" — e navega imediato para a Calculadora. Passa a: clique em "+ Nova receita" abre um modal pedindo o nome; só ao confirmar a receita é criada JÁ com esse nome. Além disso, `goldenSeed()` (`src/ui/seed.ts:32-`) hoje inclui o ingrediente "Azeite" (40g/4%) pré-preenchido — deixa de vir sugerido por padrão.

## O que fazer
- Criar o primeiro componente de modal do design system (hoje não existe nenhum — decisão anterior era "sem modal", `architecture.md:191`; exceção explícita do cliente, escopo restrito a este fluxo). Estrutura: overlay/backdrop + caixa com campo de texto "Nome da receita", botão "Criar" e botão "Cancelar".
- Botão "+ Nova receita" (`newBtn`, `recipesList.ts:130-134`) passa a abrir o modal em vez de chamar `createRecipe()` direto.
- Confirmar (botão "Criar" ou Enter no campo) com nome não-vazio (trim): `recipeStore.create({ ...goldenSeed(), name: <nome> })`, fecha modal, navega para `receitas.html?recipe=<id>` (mesmo destino atual).
- Confirmar com nome vazio/só espaços: NÃO cria — modal permanece aberto, mensagem de erro (reusar classe `.form-status--error`), foco volta ao campo.
- Cancelar (botão "Cancelar", tecla Esc, clique no backdrop fora da caixa): fecha modal sem criar nada, sem navegar.
- Nome digitado só via `value`/`textContent` (nunca `innerHTML` — regra de ouro 3, spec v5 §11.1).
- "Nova receita em branco" (`newBlankBtn`) continua criando direto, sem modal — comportamento inalterado.
- `goldenSeed()` (`src/ui/seed.ts`): remover a linha do ingrediente "Azeite" da lista de ingredientes. Atualizar o `name` padrão da seed (hoje `'Pão Rústico de Azeite'`) para não referenciar mais Azeite (usado quando a Calculadora é aberta direto, sem `?recipe`).

## Testes exigidos (TDD)
- Clicar "+ Nova receita" NÃO chama `recipeStore.create` imediatamente — abre o modal (elemento visível, input com foco).
- Confirmar com nome preenchido → `recipeStore.create` chamado com `name` igual ao digitado; navega para `receitas.html?recipe=<id>` (spy `navigate`); modal fecha.
- Confirmar com campo vazio → `recipeStore.create` NÃO chamado; modal continua aberto; mensagem de erro visível.
- Confirmar com só espaços → mesmo resultado do vazio (trim aplicado).
- Cancelar via botão "Cancelar" → `recipeStore.create` NÃO chamado; modal fecha; `navigate` NÃO chamado.
- Esc fecha o modal sem criar receita.
- Clique no backdrop (fora da caixa do modal) fecha sem criar receita.
- XSS: nome `<img src=x onerror=alert(1)>` → receita criada com esse nome literal (via `recipeStore.create`), nenhum nó `<img>` no DOM do modal.
- `goldenSeed()`: lista de ingredientes NÃO contém item com `name === 'Azeite'`.
- "Nova receita em branco" continua sem abrir modal (regressão).

## Critérios de aceite
- [ ] "+ Nova receita" abre modal em vez de criar direto.
- [ ] Receita só é criada ao confirmar o modal com nome válido, já com o nome digitado.
- [ ] Nome vazio/só espaços bloqueia a criação com mensagem de erro, sem fechar o modal.
- [ ] Cancelar (botão, Esc, backdrop) fecha sem criar nada.
- [ ] Nome do usuário nunca passa por `innerHTML`.
- [ ] `goldenSeed()` não inclui mais "Azeite"; nome padrão da seed atualizado.
- [ ] "Nova receita em branco" inalterada (sem modal).
- [ ] Testes de `recipesList.test.ts`/`seed` atualizados cobrindo os casos acima.

## Referências
- spec.md (refactor "Nova Receita", páginas Minhas Receitas/Calculadora) · src/ui/recipesList.ts:130-134,196-201 · src/ui/seed.ts:32-70 · references/architecture.md:191 (decisão anterior "sem modal", exceção registrada nesta issue)

## Plano Técnico

### Análise do existente (busca real no código/design-system)
- **`src/ui/dom.ts`** → `h`/`clear`/`on` (e `svg`): único ponto que toca DOM cru, sempre via `createElement`/`setAttribute`/`createTextNode` — NUNCA `innerHTML` (regra de ouro 3). Todo o modal é montado com esses helpers. Reuso total, nenhuma função nova de DOM.
- **`src/ui/recipesList.ts`** → `createRecipe()` (:196-201) hoje faz `recipeStore.create(goldenSeed())` + `navigateFn(...)`; `newBtn` (:130-134) já existe e continua o mesmo botão — só muda o handler (`on(newBtn,'click',...)` :307). `navigateFn` (:110) e o padrão `showStatus`/`.form-status--error` (:182-186) são reusados como molde da mensagem de erro do modal (mesma classe). `newBlankBtn`/`createBlankRecipe` (:203-210) NÃO mudam.
- **`startInlineEdit`** (:224-272): é o molde de edição *inline* (issue 033) — NÃO se aplica aqui (modal é outro padrão), mas confirma a convenção "nome do usuário só via `value`/`textContent`" que o modal segue.
- **`src/ui/seed.ts`** → `goldenSeed()`: ingrediente `oil-1`/"Azeite" (:58-65) a remover; `name: 'Pão Rústico de Azeite'` (:36) a renomear; comentário de cabeçalho (:8) cita "Azeite 40g/4%" (atualizar).
- **`references/design-system.css`** (busca `grep overlay|backdrop|dialog|modal`): **nenhuma classe de modal existe** — este é o 1º (confirma issue/architecture.md:191). Reusáveis prontos: `.card` (:144, box), `.btn`/`.btn-primary`/`.btn-secondary` (:168-185), `.input` (:193), `.form-status`/`.form-status--error` (:380-382), `.row`/`.row--end` (:456,467). Só faltam `.modal-overlay` (backdrop/centralização) e `.modal` (largura do box) — tokens novos, sem valores mágicos.
- **`src/ui/recipesList.test.ts`** → helper `mount(deps)` (:61-75), `goldenSeedNoFat()` (:23-27), spy `navigate = vi.fn()` (caso 5, :136-150): molde exato dos novos testes de modal. `document.body.appendChild(root)` (:191) é o padrão já usado quando o teste precisa de `document.activeElement` — o modal exige isso (foco no input).
- **`src/ui/pages/receitas.ts`** → composition root: NÃO muda (o modal se anexa a `document.body` por conta própria; recipesList só o invoca).
- **`src/core/golden-example.test.ts`** → constrói `goldenRecipe()` PRÓPRIO (não usa `goldenSeed()`) — **verificado por grep**: a validação de fórmula da §12 NÃO depende do seed; remover o Azeite do seed **não é bloqueio** para o gabarito §12.

### Decisão técnica: modal manual (`div`) vs. `<dialog>` nativo — regra de ouro 1 e 4
`<dialog>` + `showModal()` daria foco-preso, backdrop, `inert`, top-layer e Esc "de graça" (MDN). **Porém**: o `jsdom 29.1.1` deste projeto **não implementa `HTMLDialogElement.prototype.showModal()`/`close()`** — verificado empiricamente (`d.showModal is not a function`). Toda a suíte é Vitest+jsdom e a issue exige testar Esc/backdrop/foco; usar `<dialog>` obrigaria feature-detect com um caminho de produção não testado ("testar o que se envia" proíbe). **Recomendado: `div` manual** com `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, foco gerenciado, Esc, foco-preso (trap) e clique no backdrop — 100% testável em jsdom, zero dependência nova (foco-preso é trivial: ciclar entre 3 focáveis; não justifica lib `focus-trap`). Comportamento idêntico em teste e produção.

### Cenários (números concretos)
- **Feliz**: clicar "+ Nova receita" → modal abre (`role="dialog"` visível em `document.body`, input focado, campo vazio). Digitar `"Pão de Forma"` + Enter/"Criar" → `recipeStore.create({ ...goldenSeed(), name: 'Pão de Forma' })` (spec.md AC :29), modal fecha, `navigate('receitas.html?recipe=<id>')` (mesmo destino de :200).
- **Vazio**: campo `''` → não cria, modal permanece, `.form-status--error` visível ("Digite um nome para a receita."), foco volta ao input (spec.md AC :30).
- **Só espaços**: `'   '` → `trim()` = `''` → idêntico ao vazio (issue :26).
- **Cancelar** (botão / Esc / clique no backdrop fora do box): fecha sem criar, `navigate` não chamado, foco restaurado ao elemento anterior (`document.activeElement` salvo na abertura) (spec.md AC :31).
- **Enter no input** = "Criar"; **foco-preso**: Tab no último focável volta ao primeiro e Shift+Tab no primeiro vai ao último.
- **XSS**: nome `<img src=x onerror=alert(1)>` → `recipeStore.create` recebe a string literal (via `input.value`, nunca `innerHTML`); nenhum nó `<img>` no DOM do modal (issue :30, regra 3, spec §11.1).
- **Seed sem Azeite**: `goldenSeed().ingredients` não tem item `name === 'Azeite'`; `name` não contém "Azeite" (issue :31).
- **Regressão**: "Nova receita em branco" cria direto, sem abrir modal (issue :32).

### Testes primeiro (TDD — escrever antes)
**`src/ui/seed.test.ts` (novo):**
1. `goldenSeed().ingredients.find(i => i.name === 'Azeite')` é `undefined`; nenhum ingrediente `category === 'fat'`.
2. `goldenSeed().name` não contém "Azeite" (e é string não-vazia).

**`src/ui/modal.test.ts` (novo — componente genérico, ou bloco em recipesList.test.ts):**
3. Abrir → `document.body` contém `[role="dialog"][aria-modal="true"]`; input com foco (`document.activeElement`).
4. "Criar" com nome válido → `onConfirm('Pão de Forma')` chamado 1×; modal removido do DOM.
5. "Criar"/Enter com `''` → `onConfirm` NÃO chamado; modal presente; `.form-status--error` com texto; foco no input.
6. `'   '` (trim) → igual ao vazio.
7. Esc → `onConfirm` NÃO chamado; modal removido; foco restaurado ao gatilho.
8. Clique no `.modal-overlay` (backdrop, alvo === overlay) → fecha sem `onConfirm`; clique dentro do box (`.modal`) NÃO fecha.
9. "Cancelar" → fecha sem `onConfirm`.
10. Tab-trap: Shift+Tab no primeiro focável → foco no último; Tab no último → primeiro.
11. XSS: `onConfirm` recebe `<img ...>` literal; `document.querySelector('.modal img')` é `null`.

**`src/ui/recipesList.test.ts` (integração — novo bloco `describe('modal nova receita')`):**
12. Clicar "+ Nova receita" → `recipeStore.create` NÃO chamado ainda; modal aberto (substitui/expande o caso 5 atual, que hoje espera criação imediata).
13. Confirmar com nome → `recipeStore.create` chamado; nova receita com `name` digitado; `navigate('receitas.html?recipe=<id>')`; modal fecha.
14. Confirmar vazio → `create`/`navigate` não chamados; modal aberto com erro.
15. Cancelar/Esc/backdrop → `create`/`navigate` não chamados; modal fecha.
16. XSS: nome malicioso → `create` recebe literal; sem `<img>` no DOM do modal.
17. "Nova receita em branco" continua sem modal (regressão do caso 15 atual).

### Arquivos a criar
- `src/ui/modal.ts` — componente genérico `openPromptModal({ title, label, confirmLabel, cancelLabel, emptyError, onConfirm })`: monta overlay+box em `document.body` via `h`/`on`, gerencia foco/Esc/trap/backdrop, valida `trim()` não-vazio, chama `onConfirm(name)` só no caminho válido. Zero lógica de receita (reuso/separação: negócio fica em recipesList).
- `src/ui/modal.test.ts` — casos 3–11.
- `src/ui/seed.test.ts` — casos 1–2.

### Arquivos a modificar
- `src/ui/seed.ts` — remover bloco `oil-1` (:58-65); `name` → `'Pão Rústico'`; atualizar comentário de cabeçalho (:8) (remove menção a Azeite).
- `src/ui/recipesList.ts` — `createRecipe()` passa a `openPromptModal({ title:'Nova receita', label:'Nome da receita', confirmLabel:'Criar', cancelLabel:'Cancelar', onConfirm:(name)=>{ const created = recipeStore.create({ ...goldenSeed(), name }); navigateFn(\`receitas.html?recipe=${encodeURIComponent(created.id)}\`); } })`. Import de `./modal`. `newBlankBtn`/`createBlankRecipe` inalterados.
- `references/design-system.css` — novas classes `.modal-overlay` (`position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index` acima dos banners sticky :489 que usam 11; backdrop = token novo `--overlay`) e `.modal` (largura/max-width do box; composta com `.card`). Novo token `--overlay` em `:root` (dark da marca com ~50% de opacidade — sem valor mágico solto).
- `references/design-system.html` — documentar `.modal-overlay`/`.modal`/`--overlay` (convenção do projeto: toda classe/token novo é documentado).
- `references/architecture.md` — registrar a exceção "1º modal do design system" (linha 191 era "sem modal") como decisão consciente/log, escopo restrito a este fluxo.
- **Colateral inevitável da remoção do Azeite do seed compartilhado** (suítes que hoje usam `goldenSeed()` cru e assertam sobre `oil-1`/"Azeite"/seção "Gorduras" — precisam ficar verdes):
  - `src/export/print.test.ts` — caso §2 (:99-110) exige um ingrediente `fat`: construir o Azeite localmente na receita antes de `renderRecipe()`; atualizar asserts de nome `'Pão Rústico de Azeite'` (:192, :341, :374) → `'Pão Rústico'`; ajustar comentário-cabeçalho de números.
  - `src/export/xlsx.test.ts` — caso 3 (:134-141) espera seção "Gorduras": adicionar um ingrediente `fat` localmente à receita.
  - `src/ui/batchPanel.test.ts` — AC4/AC6 (:513-533): remover `'oil-1'` da lista esperada de `data-ingredient-id` e reindexar (`rows[3]='salt-1'`, `rows[4]='fermento'`).
  - `src/ui/ingredientsTable.test.ts` — caso 11 (:187-211): remover `'oil-1'` do array esperado do espelho.
  - `src/ui/recipesList.test.ts` — casos novos 12–17 + ajuste do caso 5 (deixa de esperar criação imediata).

### Arquivos que NÃO devem ser tocados
- `src/core/**` (recalc, pricing, format, types) e `src/core/golden-example.test.ts` — §12 tem fixture próprio (verificado); zero impacto.
- `src/storage/**`.
- `src/ui/pages/calculadora.ts`/`calculadora.test.ts` — o item 2 da spec (nome editável na Calculadora) é OUTRA issue; fora de escopo aqui.
- `src/ui/pages/receitas.ts` — o modal se auto-anexa a `document.body`.
- Suítes que já usam `goldenSeedNoFat()`/filtram `fat` ou independem do Azeite (pricingPanel, scalePanel, bakeForm, historyView, sourdoughTable, hydrationPanel, modeToggle) — verificar verde, não editar.

### Ordem de implementação
1. `seed.test.ts` (vermelho) → editar `seed.ts` (verde).
2. Corrigir colaterais (batchPanel, ingredientsTable, print, xlsx) até a suíte inteira ficar verde de novo.
3. `modal.test.ts` (vermelho) → `modal.ts` (verde) + `.modal-overlay`/`.modal`/`--overlay` no design-system.css e doc no design-system.html.
4. Novos testes em `recipesList.test.ts` (vermelho) → wiring em `recipesList.ts` (verde).
5. Registrar a exceção do modal em `architecture.md`.
6. Suíte completa verde + lint/typecheck.
