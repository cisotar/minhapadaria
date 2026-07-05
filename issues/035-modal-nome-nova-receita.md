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
