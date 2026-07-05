# Spec: Refactor Fluxo "Nova Receita" (nome via modal + nome editável na Calculadora + seed sem Azeite)

## Visão Geral
Três ajustes pontuais no fluxo de criação de receita da Calculadora de Pão (app MPA já existente, spec v5), pedidos pelo cliente:

1. Hoje, clicar em "+ Nova receita" (`recipesList.ts`) cria a receita direto com nome genérico da golden seed ("Pão Rústico de Azeite") e já direciona para a Calculadora. Passa a: clique abre um modal pedindo o nome da receita → cliente digita e confirma → receita é criada JÁ com esse nome → só então direciona para a Calculadora (`receitas.html?recipe=<id>`).
2. Hoje a tela Calculadora não exibe o nome da receita em lugar nenhum (só o `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural"). Passa a exibir o nome da receita carregada (no lugar do `<h1>` estático, só quando há `?recipe=<id>` válido) — editável inline, no mesmo padrão sem `window.prompt`/modal já usado no card de `recipesList.ts` (issue 033).
3. A golden seed usada no fluxo de criação deixa de incluir o ingrediente "Azeite" — hoje toda receita nova nasce com Azeite 40g/4% pré-preenchido; não deve mais vir sugerido por padrão.

Não é uma nova feature de produto: é ajuste de UX sobre telas já implementadas (`index.html`/`recipesList.ts`, `receitas.html`/`calculadora.ts`, `src/ui/seed.ts`).

## Stack Tecnológica
(inalterada — ver `references/architecture.md`)
- Frontend: TS strict + Vite (MPA, 3 páginas), sem framework
- Storage: localStorage via `src/storage/recipes.ts`
- Testes: Vitest + jsdom

## Páginas e Rotas

### Minhas Receitas — `/index.html`
**Descrição:** Grid de cards de receita (`.recipe-card`) + toolbar de ações (busca, nova receita, backup). O botão "+ Nova receita" (`recipesList.ts:130-134`) hoje chama `createRecipe()` (`:196-201`), que cria direto via `recipeStore.create(goldenSeed())` e navega.

**Componentes:**
- `recipesList.ts` (`renderRecipesList`): toolbar, subtítulo, grid de cards, estado vazio.
- **Novo:** modal "Nome da nova receita" — primeiro componente de modal do design system (hoje não existe nenhum, decisão registrada em `architecture.md` linha 191 era "sem modal"; este pedido do cliente é uma exceção explícita, escopo restrito a este fluxo).

**Behaviors (o que o usuário pode fazer):**
- [ ] Clicar em "+ Nova receita" NÃO cria a receita imediatamente — abre um modal com um campo de texto "Nome da receita" vazio, foco automático.
- [ ] Confirmar o modal (botão "Criar" e/ou Enter no campo) com nome preenchido: cria a receita via `recipeStore.create({ ...goldenSeed(), name: <nome digitado> })`, fecha o modal e navega para `receitas.html?recipe=<id>` (mesmo destino atual).
- [ ] Confirmar o modal com nome vazio (ou só espaços): NÃO cria a receita — modal permanece aberto, mensagem de erro exibida (reusar padrão `.form-status--error` já existente), foco volta ao campo.
- [ ] Cancelar o modal (botão "Cancelar", tecla Esc, ou clique fora/no backdrop): fecha o modal sem criar nenhuma receita, sem navegar.
- [ ] Nome digitado nunca passa por `innerHTML` (regra de ouro 3, spec v5 §11.1) — renderização/leitura via `value`/`textContent`.
- [ ] "Nova receita em branco" (`newBlankBtn`, `:138-142`) e as demais ações do card (abrir/duplicar/renomear inline/excluir) continuam com o comportamento atual, inalteradas — o modal é exclusivo do botão "+ Nova receita".

---

### Calculadora — `/receitas.html`
**Descrição:** Composição de cards (Ancoragem/Planejamento, Ingredientes, Fermento, Hidratação, Precificação) via `calculadora.ts`. Hoje o cabeçalho é 100% estático (`<h1>🍞 Calculadora de Pão com Fermento Natural</h1>`, `receitas.html:25`), sem qualquer referência ao nome da receita carregada.

**Componentes:**
- `calculadora.ts` (`initCalculadora`): já resolve `?recipe=<id>` (`:88-100`) e liga autosave quando a receita existe.
- **Novo:** nome da receita editável inline, substituindo o `<h1>` estático quando há receita carregada.

**Behaviors (o que o usuário pode fazer):**
- [ ] Ao abrir a Calculadora com `?recipe=<id>` válido, o nome da receita aparece no lugar do `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural".
- [ ] Sem `?recipe=<id>` (acesso direto a `receitas.html`, golden seed efêmera) ou com `id` inexistente (banner "Receita não encontrada"), o `<h1>` estático permanece — comportamento atual inalterado.
- [ ] O nome exibido é editável inline (mesmo padrão de `startInlineEdit` do card — sem `window.prompt`/modal, Enter ou blur confirmam, Esc cancela).
- [ ] Confirmar com nome vazio ou igual ao atual: não grava, nome exibido volta ao original (mesma tríplice guarda de `recipesList.ts`/issue 033).
- [ ] Confirmar com nome novo válido: atualiza o nome no estado da receita (`store`) e segue o mesmo pipeline de autosave já existente (debounce ~400ms, flush em `visibilitychange`/`beforeunload`) — sem chamada direta a `recipeStore.rename` fora desse pipeline, para não duplicar caminho de escrita.
- [ ] Nome sempre renderizado via `textContent`/`value` (nunca `innerHTML`, regra de ouro 3).

---

## Componentes Compartilhados
- `recipeStore.create(recipe)` / `.rename(id, name)` (`src/storage/recipes.ts`) — reusados sem alteração de contrato.
- `goldenSeed()` (`src/ui/seed.ts`) — deixa de incluir o ingrediente "Azeite"; nome padrão da seed (`'Pão Rústico de Azeite'`, `seed.ts:36`) é atualizado para não referenciar mais Azeite (evita inconsistência quando a seed é usada sem passar por um nome customizado — ex.: acesso direto a `receitas.html` sem `?recipe`).
- Modal "Nome da nova receita" — novo componente compartilhável (estrutura genérica o bastante para reuso futuro, mas esta issue só cobre o fluxo de criação).
- `startInlineEdit`-like: mecanismo de edição inline de nome já existe em `recipesList.ts` (issue 033); a Calculadora reusa o mesmo padrão (Enter/blur/Esc), não uma implementação nova do zero.

## Modelos de Dados
Inalterados — `Recipe` (`src/storage/recipes.ts`), sem novos campos. `goldenSeed()` (`src/ui/seed.ts`) perde a linha do ingrediente "Azeite" da lista semente.

## Regras de Negócio
- Nome da receita nunca pode ficar vazio ao ser CRIADA (diferente da edição, onde vazio só cancela a edição sem apagar o nome existente) — o modal bloqueia a confirmação até haver um nome não-vazio.
- Nomes duplicados continuam permitidos (nenhuma regra de unicidade existia antes; não é introduzida agora).
- Remover Azeite da golden seed é só a lista padrão de ingredientes sugerida — o usuário pode adicionar Azeite manualmente na tabela de ingredientes a qualquer momento (funcionalidade de adicionar ingrediente já existe, inalterada).
- Nenhuma chamada de rede, nenhum dado sai do localStorage (regra de ouro 3, inalterada).
- Modal é um padrão novo neste projeto (decisão anterior evitava modal, `architecture.md`:191) — escopo desta exceção é estritamente o fluxo "+ Nova receita"; o fluxo de renomear (card e Calculadora) continua sem modal, edição inline (issue 033).

## Fora do Escopo (v1 deste refactor)
- Modal genérico reutilizável para outros fluxos (excluir, restaurar backup etc.) — só o de "Nova receita" é criado agora.
- "Nova receita em branco" ganhar o mesmo modal de nome — continua criando com nome padrão (`defaultRecipe()`, "Nova Receita"), sem alteração.
- Regra de unicidade de nome de receita.
- Editar outros campos inline na Calculadora além do nome (ingredientes, fermento etc. continuam nas telas/tabelas existentes).
- Migração de receitas já existentes que tenham Azeite pré-preenchido — a mudança afeta só a seed usada em receitas NOVAS a partir desta issue.
