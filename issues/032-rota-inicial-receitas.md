---
id: "032"
titulo: Rota inicial do site deve ser receitas.html
tipo: ui
deps: ["017"]
status: todo
---

## Contexto
Pedido do cliente (spec.md, refactor I): `https://cisotar.github.io/minhapadaria/` hoje serve a Calculadora (`index.html`); deve servir "Minhas Receitas" (`receitas.html`).

## O que fazer
- GitHub Pages serve `index.html` como documento padrão da raiz — não há como apontar a raiz direto pra `receitas.html` sem trocar conteúdo.
- Trocar o conteúdo dos dois arquivos-shell (`index.html` ↔ `receitas.html`), mantendo cada `<script type="module" src="...">` apontando pro TS correto (`calculadora.ts` continua montando a Calculadora, `receitas.ts` continua montando Receitas — só o nome do arquivo HTML shell muda).
- Ajustar `vite.config.ts` `build.rollupOptions.input` se os nomes de entrada dependerem do path do arquivo.
- Ajustar link `index.html?recipe=<id>` usado em `recipesList.ts` para abrir a Calculadora — deve continuar indo pro arquivo que hoje é a Calculadora (o que passa a ter o nome de `index.html` ou o que for decidido, mas o destino funcional é o mesmo).
- Nav global (`.app-nav`) nas 3 páginas: item ativo deve refletir a página certa em cada shell após a troca.

## Critérios de aceite
- [x] Acessar `https://cisotar.github.io/minhapadaria/` exibe "Minhas Receitas".
- [x] Link "Calculadora" no nav e `?recipe=<id>` continuam abrindo a tela de cálculo, sem quebrar querystring.
- [x] Build Vite (`npm run build`) gera as 3 páginas normalmente, sem 404 de asset.
- [x] Nenhuma lógica de `calculadora.ts`/`receitas.ts`/`historico.ts` é alterada — só o roteamento/shell HTML.

## Referências
- spec.md (refactor I) · references/architecture.md (Vite MPA, base `/minhapadaria/`)

## Plano Técnico

### Decisão de roteamento (uma linha, justificada)
Swap literal de **conteúdo** entre `index.html` e `receitas.html` (mantendo os
dois nomes de arquivo): GitHub Pages serve `index.html` como documento default
da raiz (não há como apontar a raiz para outro arquivo sem trocar conteúdo — o
próprio contexto da issue), e o swap de conteúdo é o menor diff possível (zero
arquivo criado/removido, zero mudança em `vite.config.ts`, pois as três entradas
do `rollupOptions.input` continuam apontando para `index.html`/`receitas.html`/
`historico.html`, que seguem existindo). Trade-off aceito (issue: "o que for
decidido, mas o destino funcional é o mesmo"): a **Calculadora passa a ser
servida em `receitas.html`** e as **Receitas em `index.html`** — inversão
nome↔conteúdo mitigada com comentário `<!-- -->` explícito em cada shell.

### Análise do existente
Busca real (`grep`/Read) confirmou os pontos de acoplamento:
- `index.html` → shell da Calculadora: `nav.app-nav` com `Calculadora`
  `class="active"`, `<header class="page-header">` com `<h1>`/`<p class="subtitle">`
  estáticos, `<div id="app" class="page">`, `<script src="/src/ui/pages/calculadora.ts">`,
  `<title>Calculadora…`.
- `receitas.html` → shell das Receitas: `nav.app-nav` com `Receitas` `active`,
  `<header class="page-header">` com `<div class="inner" id="rc-header">` (vazio,
  preenchido por `receitas.ts`), `<div id="app" class="page">`,
  `<script src="/src/ui/pages/receitas.ts">`, `<title>Minhas Receitas`.
- `historico.html` → shell do Histórico: `nav.app-nav` (Calculadora→`index.html`,
  Receitas→`receitas.html`, Histórico `active`), `<style>` local (`.page` max-width
  1080px + `.chart-svg`) que **deve permanecer**, script `historico.ts`.
- `src/ui/recipesList.ts` → link de abertura da Calculadora em 3 pontos:
  `navigateFn(\`index.html?recipe=…\`)` (L201 criar-com-seed, L210 criar-em-branco) e
  `href: \`index.html?recipe=…\`` do card "Abrir" (L323); comentário L49 cita
  `index.html`. É o único código que hardcoda o destino da Calculadora.
- `src/ui/pages/calculadora.ts` → NÃO hardcoda nome de arquivo; lê
  `deps.search ?? location.search` e faz `URLSearchParams(search).get('recipe')`
  (L85–88). Funciona idêntico em qualquer nome de shell — só o comentário de
  cabeçalho cita "index.html". Reuso: nada muda na lógica.
- `vite.config.ts` → `rollupOptions.input = { main:'index.html',
  receitas:'receitas.html', historico:'historico.html' }`. Como os nomes de
  arquivo são preservados, **não requer alteração** (contradiz o "se…" do bullet
  da issue: a condição "nomes de entrada dependerem do path" não se aplica).
- `mockups/*.html` → referências de design (não são runtime), links internos
  próprios; fora do escopo desta issue.

### Cenários
- **Caminho feliz (raiz)**: `GET /minhapadaria/` serve `index.html` (agora shell
  de Receitas) → `receitas.ts` monta `renderRecipesList` no `#app` → usuário vê
  "Minhas Receitas" (AC1). Links relativos resolvem sob `base` `/minhapadaria/`.
- **Abrir Calculadora pelo nav**: item "Calculadora" (agora `href="receitas.html"`)
  → `receitas.html` serve shell da Calculadora → `calculadora.ts` monta cards; sem
  `?recipe`, cai no `goldenSeed()` (golden §12: R$ 8,86 · 70%/72,7% · 1100 g).
- **Abrir receita salva (`?recipe=<id>`)**: card "Abrir" navega para
  `receitas.html?recipe=<id>` → `calculadora.ts` lê `location.search`,
  `recipeStore.get(id)` carrega a receita; querystring preservada (AC2).
- **`?recipe=<id>` inexistente**: comportamento atual intacto (banner "modelo
  padrão", §2.F) — nenhuma mudança de lógica.
- **Build (AC3)**: `npm run build` emite `dist/index.html`, `dist/receitas.html`,
  `dist/historico.html` com assets sob `/minhapadaria/`; nenhum 404 (input map
  inalterado).
- **Borda — nav ativo por shell**: cada shell marca `active` na página que agora
  representa (index=Receitas, receitas=Calculadora, historico=Histórico); links
  cruzados consistentes nos três (AC do bullet "Nav global").

### Testes primeiro
Issue de UI/roteamento (não core/storage/export), sem nova lógica pura → nenhum
teste Vitest novo. Ajustar as expectativas existentes que hardcodam o destino
(TDD leve: mudar a asserção ANTES de tocar o `recipesList.ts`):
- `src/ui/recipesList.test.ts` L151 → `expect(navigate).toHaveBeenCalledWith(\`receitas.html?recipe=${created.id}\`)`.
- `src/ui/recipesList.test.ts` L329 → `expect(openLink.getAttribute('href')).toBe(\`receitas.html?recipe=${encodeURIComponent(created.id)}\`)`.
- `src/ui/recipesList.test.ts` L350 → `expect(navigate).toHaveBeenCalledWith(\`receitas.html?recipe=${created.id}\`)`.
- Atualizar os textos dos `it(...)` (L138, L321) que citam `index.html?recipe=`.
Gate de verificação: `npm test` (suíte inteira verde) + `npm run build` sem erro.

### Arquivos a criar
- Nenhum.

### Arquivos a modificar
- `index.html` → passa a ser o shell de **Receitas**: `<title>Minhas Receitas`;
  nav com Calculadora `href="receitas.html"`, Receitas `href="index.html"
  class="active"`, Histórico inalterado; header com `<div class="inner"
  id="rc-header">`; `<script src="/src/ui/pages/receitas.ts">`; comentário
  explicando a inversão nome↔conteúdo (mitiga confusão da decisão).
- `receitas.html` → passa a ser o shell da **Calculadora**: `<title>Calculadora —
  Pão com Fermento Natural`; nav com Calculadora `href="receitas.html"
  class="active"`, Receitas `href="index.html"`, Histórico inalterado; header
  estático `<div class="inner">` com `<h1>🍞 …</h1>` + `<p class="subtitle">`;
  `<script src="/src/ui/pages/calculadora.ts">`; comentário da inversão.
- `historico.html` → só o `nav.app-nav`: Calculadora `href="receitas.html"`,
  Receitas `href="index.html"`; Histórico segue `active`; `<style>` local e script
  intocados.
- `src/ui/recipesList.ts` → trocar as 3 ocorrências `index.html?recipe=` →
  `receitas.html?recipe=` (L201, L210, L323) e atualizar o comentário L49.
- `src/ui/recipesList.test.ts` → as expectativas/descrições listadas acima.
- (Cosmético, docs vivas) cabeçalhos de `src/ui/pages/calculadora.ts` e
  `src/ui/pages/receitas.ts` que citam o nome do shell: atualizar a menção para
  refletir o novo arquivo. Sem tocar em lógica.

### Arquivos que NÃO devem ser tocados
- `vite.config.ts` (input map preservado; sem necessidade de mudança).
- Lógica de `src/ui/pages/calculadora.ts`, `receitas.ts`, `historico.ts` (AC4:
  só roteamento/shell) — apenas comentário de cabeçalho, nada funcional.
- `src/ui/recipesList.ts` além das strings de destino (nenhuma mudança de fluxo).
- `src/core/**`, `src/storage/**`, `src/export/**`, `references/design-system.css`,
  `mockups/**`, `brand/**`.

### Ordem de implementação
1. Atualizar as 3 asserções + 2 descrições em `recipesList.test.ts` (destino
   `receitas.html?recipe=`); rodar `npm test` e ver os 3 casos falharem (vermelho).
2. Trocar as 3 strings de destino + comentário L49 em `recipesList.ts`; `npm test`
   volta ao verde.
3. Reescrever `index.html` como shell de Receitas e `receitas.html` como shell da
   Calculadora (swap de conteúdo, com comentário da inversão).
4. Atualizar os `href` do nav em `historico.html`.
5. (Opcional) Atualizar comentários de cabeçalho de `calculadora.ts`/`receitas.ts`.
6. `npm run build` (AC3: 3 páginas, sem 404) + `npm test` final. Verificação
   manual dev: raiz mostra Receitas; "Calculadora" e card "Abrir" chegam à tela
   de cálculo com `?recipe` preservado.
