# Spec: Refactor Rota Inicial + Edição Inline de Nome de Receita

## Visão Geral
Dois refactors pontuais na Calculadora de Pão (app MPA já existente, spec v5):
1. Trocar a página inicial do site de `index.html` (Calculadora) para `receitas.html` (Minhas Receitas).
2. Substituir o fluxo de renomear receita (hoje `window.prompt` via botão "Renomear") por edição inline do nome, direto no card — sem abrir diálogo/modal.

Não é uma nova feature de produto: é ajuste de navegação e UX sobre telas já implementadas (`receitas.html`, `src/ui/recipesList.ts`).

## Stack Tecnológica
(inalterada — ver `references/architecture.md`)
- Frontend: TS strict + Vite (MPA, 3 páginas), sem framework
- Storage: localStorage via `src/storage/recipes.ts`
- Testes: Vitest + jsdom

## Páginas e Rotas

### Rota inicial — `/` (GitHub Pages: `https://cisotar.github.io/minhapadaria/`)
**Descrição:** Ao acessar a raiz do site publicado, o usuário deve cair em "Minhas Receitas" (`receitas.html`), não mais na Calculadora (`index.html`).

**Behaviors:**
- [ ] Acessar `https://cisotar.github.io/minhapadaria/` (sem sufixo) exibe a tela "Minhas Receitas".
- [ ] Nav global (`.app-nav`, presente nas 3 páginas) marca "Receitas" como item ativo quando na rota raiz.
- [ ] `index.html` (Calculadora) continua acessível a partir do card/receita aberta (`index.html?recipe=<id>`) e pelo link "Calculadora" no nav — não é removida, só deixa de ser a home.

**Nota de implementação (para a fase de plano, não decidir aqui):** GitHub Pages serve `index.html` como documento padrão da raiz; avaliar troca de conteúdo entre os arquivos `index.html`/`receitas.html` (mantendo cada `<script type="module">` apontando pro TS certo) vs. redirect. Decisão de arquitetura fica para `/plan`.

---

### Minhas Receitas — `/receitas.html`
**Descrição:** Grid de cards de receita (`.recipe-card`), cada um com nome, métricas (custo unit./margem) e ações (abrir/renomear/duplicar/excluir).

**Componentes:**
- `recipesList.ts` (`renderRecipesList`): monta toolbar (busca, nova receita, backup), subtítulo, grid de cards e estado vazio.
- Card de receita (`.recipe-card`): título `<h3>` do nome + ações.

**Behaviors (o que o usuário pode fazer):**
- [ ] Clicar em "Renomear" no card NÃO abre `window.prompt` nem qualquer modal/diálogo.
- [ ] Clicar em "Renomear" transforma o `<h3>` do nome em um campo de edição inline (input de texto), com foco automático e texto selecionado.
- [ ] Confirmar a edição inline (Enter ou blur/perda de foco) salva o novo nome via `recipeStore.rename(id, novoNome)` e volta o `<h3>` ao modo texto.
- [ ] Cancelar a edição inline (Esc) descarta a alteração e restaura o nome original, sem chamar `rename`.
- [ ] Nome vazio ao confirmar: mesma regra atual (cancelado/vazio/sem mudança → não chama `rename`, ver `recipesList.ts:218-223`).
- [ ] Nome do usuário renderizado sempre via `textContent`/atributo de `value`, nunca `innerHTML` (regra de ouro de segurança, spec v5 §11.1).
- [ ] Demais ações do card (abrir, duplicar, excluir) continuam com o comportamento atual, inalteradas.

---

## Componentes Compartilhados
- `recipeStore.rename(id, name)` (`src/storage/recipes.ts:37`) — já existe, reusado sem alteração de contrato.
- Nav global (`.app-nav`, replicado em `index.html`/`receitas.html`/`historico.html`).

## Modelos de Dados
Inalterados — `Recipe` (`src/storage/recipes.ts`), sem novos campos.

## Regras de Negócio
- Edição inline de nome segue as mesmas regras de validação hoje aplicadas no fluxo `window.prompt` (nome vazio ou igual ao atual não persiste, `updatedAt` só muda se `rename` for efetivamente chamado — `recipes.ts:225`).
- Nenhuma chamada de rede, nenhum dado sai do localStorage (regra de ouro 3, inalterada).
- Rota inicial é só um ajuste de qual página é servida na raiz — não altera dados nem storage.

## Fora do Escopo (v1 deste refactor)
- Criar diálogo/modal customizado no design system (explicitamente descartado pelo pedido).
- Editar outros campos inline além do nome (ingredientes, fermento etc. continuam nas telas existentes).
- Mudar a URL de `index.html?recipe=<id>` ou o fluxo de abrir receita.
- Migração de histórico (`historico.html`) — fora do escopo desta issue.
