---
id: "014"
titulo: UI Calculadora — tabela de insumos, edição inline, toggle custos, g/mL, linha do fermento
tipo: ui
deps: ["008", "010", "011"]
status: done
---

## Contexto
Tela principal (spec §2.A, §4; mockup `mockups/calculadora.html`). UI consome o core testado — zero fórmula na camada DOM.

## O que fazer
- `src/ui/` + `index.html`: reproduzir a tabela de insumos do mockup 1:1 com o design system (classes existentes primeiro — regra de ouro 2; novas classes só com tokens, documentadas em `references/design-system.html`).
- Colunas ordem fixa (§2.A.2): Ingrediente · Unidade · % · Peso · Preço Pago · Peso do Produto · Custo/g · Custo na Receita.
- Unidade: sólidos "g" explícito; `liquid`/`fat` com alternador compacto g/mL (conversão densidade 1:1, valor canônico g §2.A).
- Toggle "Exibir custos" no topo: oculta/mostra as 4 colunas financeiras; default oculto; persistência via prefs (011).
- Edição inline linha a linha (§4): nome, %, peso (conforme modo), preço pago, peso do produto; derivados texto plano SEM box; editáveis COM box (decisão 24, brandbook §4.1).
- Adicionar/remover ingrediente na própria tabela ("+ ingrediente", ícone remover por linha §4); mínimo 1 farinha (010).
- Linha Fermento: genérica na tabela, peso/% consumidos do core; sem edição de peso; custos exibem C_fermento derivado (§2.A.2).
- Recálculo imediato em cada alteração (sem submit §1.6), via `recalculate` (008); validações no blur via 010 (reverte + erro).
- Entrada numérica: vírgula/ponto (002); exibição vírgula, arredondamento só exibição (§9).
- **Escape XSS**: nome de ingrediente renderizado via `textContent`/DOM API — nunca `innerHTML` com string do usuário (regra de ouro 3).
- Ferramenta opcional: /design ou DesignSync se disponível; senão mockup + design system bastam.

## Critérios de aceite
- [x] Colunas, ordem e toggle idênticos a §2.A.2/mockup; nada oculto no desktop (§10).
- [x] Editar % de água atualiza peso instantaneamente (e vice-versa no modo peso→%).
- [x] g/mL alterna exibição, canônico em g.
- [x] Blur com farinhas ≠100% reverte campo com erro (§5.A).
- [x] Nome `<script>` renderiza inerte (escape).
- [x] Zero lógica de negócio no DOM — só chamadas ao core.
- [x] Strings UI pt-BR.

## Referências
- spec §1.6, §2.A, §4, §5, §9, §10 · mockups/calculadora.html · brandbook §4.1 · references/design-system.css

---

## Plano Técnico

> Escopo desta issue: página `index.html` (shell real) + **card Ingredientes** (tabela de insumos §2.A.2) com edição inline, toggle de custos, alternador g/mL e linha do Fermento consumindo o core. **Fora de escopo** (issue 016): painéis de Hidratação, Farinha Real, Precificação, sub-receita do Fermento editável, ancoragem/escala. A camada DOM tem **zero fórmula**: só chama `recalculate` (008), `validation.*` (010), `format.*` (002) e `prefs` (011).

### Análise do existente (busca real no código/design system)

**Core já pronto e testado — reusar, nunca reimplementar (regra de ouro 2):**
- `src/core/recalc.ts` → `recalculate(recipe): { state, summary }` — engine central §1.6; idempotente; deriva pesos/%, fermento, hidratação, custos, precificação. **A UI só monta a Recipe crua e lê o resultado.**
- `src/core/recalc.ts` → `transitionToPercentageMode(recipe)` — conversão explícita peso→%→peso (§1.5), disponível para issue de modo (não usada aqui).
- `src/core/validation.ts` → `validatePercentageSum` (§5.A), `validateFlourCount` (§5.B), `validatePackageSize` (§5.C), `validateNonNegative` (§5.C), `validateSourdoughProportion` (§5.C). Contrato `ValidationResult = ValidationIssue | null` (null = OK) — checar `if (issue)` antes de exibir; mensagens já em pt-BR.
- `src/core/format.ts` → `parseDecimal` (vírgula OU ponto, §7.1), `formatPercent` (2 casas), `formatWeight` (1 casa), `formatCurrency` (R$ 2 casas), `formatCostPerGram` (4 casas §9). **Toda entrada passa por parseDecimal; toda exibição por um formatter — nunca `toLocaleString` ad-hoc.**
- `src/core/types.ts` → `Recipe`, `Ingredient`, `PackageCost`, `Sourdough`, `RecipeSummary`. Valor canônico em gramas; `inputUnit?: 'weight'|'volume'` já existe em `Ingredient` para o alternador.
- `src/storage/prefs.ts` → `createPrefsStore()` com `getShowCosts()/setShowCosts()` (default false, §2.A.2). **Toggle de custos usa este store — não criar persistência nova.**
- `src/storage/recipes.ts` → `createRecipeStore()` — disponível para carregar/salvar, mas o fluxo "abrir receita" é da issue de receitas; aqui o estado inicial é um seed em memória (golden §12).

**Design system já existente — reusar classes, não inventar (regra de ouro 2; `references/design-system.css`):**
- Layout: `.app-nav`, `.page-header`, `.card`, `.btn`/`.btn-secondary`/`.btn-primary`, `.field`, `.row` (helper do mockup).
- Tabela: `.table`, `.table th`, `.table th.num`, `td.num`/`input.num` (linha 106, alinhamento à direita §brandbook 4.1), `.table tfoot td`.
- Células: `.cell-input` (input editável COM box), `.cell-input[readonly]`, `.readonly` (célula derivada — texto plano SEM box).
- Custos: `.table .cost-col` + `.table.show-costs .cost-col` (mostra/oculta as 4 colunas financeiras via classe no `<table>`).
- Alternador: `.unit-toggle` + `.unit-toggle button.active` (g/mL); `.expand-link` (link "ver composição").
- **Classes utilitárias do mockup ausentes do design system**: `.page`, `.pw-combo`, `.unit-suffix`. Decisão: adicioná-las a `references/design-system.css` usando SÓ tokens (`var(--sp-*)`, `var(--text-muted)`, `var(--fs-small)`) e documentá-las em `references/design-system.html` (architecture.md §Estilo). Não usar `<style>` inline no `index.html` nem estilos hardcoded.

**Placeholder a substituir:** `index.html` (shell vazio) e `src/ui/pages/calculadora.ts` (só importa o CSS). Nav/header já mapeados no mapa de módulos.

### Decisão de renderização de derivados (brandbook §4.1 / decisão 24) — DIVERGE do mockup
O mockup usa `<input readonly>` para Peso, Custo/g e Custo na Receita. A **decisão 24 / brandbook §4.1** manda: **derivado = texto plano SEM box** (`<td class="num readonly">valor</td>` com `textContent`), **editável = input COM box** (`.cell-input`). Seguir o brandbook, não o mockup, nesses campos. Editáveis: nome, %, Preço Pago, Peso do Produto (valor + `<select>` de unidade), e — só no modo peso→% — o Peso.

### Cenários (números concretos §12 = gabarito)
- **Caminho feliz (seed golden §12):** Farinha Branca 1000g/100% (única → trava 100%, readonly), Água 700g/70% a R$0, Azeite 40g/4% (fat) a R$80/1250g, Fermento 200g/20% (Partes 0:1:1), Sal 20g/2% a R$3/kg. Renderizar: pesos 1.000,0 / 700,0 / 40,0 / 200,0 / 20,0 g; Custo/g azeite R$ 0,0640; Custo azeite R$ 2,56; Custo fermento R$ 0,80 (C/g R$ 0,0040); total da massa 1.960,0 g / 196,00% / R$ 11,42 (com Azeite; sem Azeite a spec §12 dá R$ 8,86). O total exibido soma o que estiver na tabela.
- **Editar % da Água** 70 → 80 no `input` event: `recalculate` roda, Peso da água passa a 800,0 g, total e derivados atualizam **na hora** (§1.6), sem submit.
- **Borda — soma de farinhas ≠ 100% (§5.A):** com múltiplas farinhas, digitar % que rompe 100% e sair (blur) → `validatePercentageSum` bloqueia → **reverte o campo ao último valor válido + exibe erro**; nenhuma redistribuição automática (§5.A literal). Farinha única permanece travada em 100,00 (readonly).
- **Borda — Peso do Produto ≤ 0 (§5.C):** blur em Peso do Produto = 0 → `validatePackageSize` bloqueia (impede ÷0 no Custo/g) → reverte + erro.
- **Borda — Preço Pago negativo (§5.C):** blur → `validateNonNegative` bloqueia → reverte + erro. Preço Pago = 0 é válido (água de torneira → Custo/g 0,0000).
- **g/mL:** alternar unidade de Água/Azeite (liquid/fat) troca só o rótulo/`inputUnit`; densidade 1:1 → valor numérico canônico em g inalterado (§2.A). Sólidos (farinha/sal): "g" fixo, sem alternador.
- **Toggle "Exibir custos":** default oculto (§2.A.2). Marcar → `table.classList.add('show-costs')` + `prefs.setShowCosts(true)`; persiste entre sessões; ao carregar, aplica `prefs.getShowCosts()`.
- **XSS:** nome de ingrediente `<script>alert(1)</script>` → renderizado inerte via `textContent`/`value` (nunca `innerHTML`); nenhuma execução.
- **Add/remove:** "+ ingrediente" adiciona linha (categoria default `extra`, peso/% 0); ícone remover apaga a linha; **mínimo 1 farinha** — bloquear/ocultar remover na última farinha (§5.B, `validateFlourCount`).

### Testes primeiro
Issue de UI (deps 008/010/011 já cobertas por 189 testes Vitest em `node`). O core não recebe testes novos aqui. **Verificação primária = manual** (ver abaixo). **Automatizado opcional e recomendado** para o único comportamento não coberto por manual barato e crítico à segurança: um teste jsdom de **escape XSS** e de **wiring de recálculo**. Isso exige nova devDependency `jsdom` (architecture.md: "jsdom só se um teste de UI precisar") — justificativa em uma linha: validar automaticamente que `renderRow(name='<script>')` não cria nó `<script>` e que um `input` event em % dispara `recalculate` e reescreve o Peso. Casos (se adotado, em `src/ui/ingredientsTable.test.ts`, `environment: 'jsdom'` só neste arquivo via comentário `// @vitest-environment jsdom`):
  1. `renderIngredientsTable` com ingrediente nome `<script>x</script>` → `table.querySelector('script')` é `null`; o texto aparece como conteúdo literal da célula de nome.
  2. Disparar `input` na célula % da Água (70→80) → célula Peso da Água exibe `800,0`.
  3. Toggle custos → `table.classList.contains('show-costs')` reflete o checkbox e `prefs.setShowCosts` foi chamado.
  4. Blur em % que quebra 100% (2 farinhas) → valor do input revertido ao anterior.

### Arquivos a criar
- `src/ui/dom.ts` — helpers DOM seguros: `h(tag, attrs, children)` (cria via `document.createElement`, seta texto por `textContent`, **nunca `innerHTML`**), `clear(node)`, `on(node, evt, fn)`. Único ponto que toca o DOM cru; garante escape (regra de ouro 3). Cabeçalho citando §10/§11.1.
- `src/ui/state.ts` — `createAppState(initial: Recipe, prefs)`: guarda `{ recipe, summary }` em memória; `update(mutator: (draft: Recipe) => void)` clona o estado puro, aplica a mutação, chama `recalculate` (008) e notifica `subscribe(fn)`. **Zero fórmula** — só orquestra clone + `recalculate` + notificação (§1.6). Expõe `showCosts` lido/escrito via `prefs`.
- `src/ui/seed.ts` — `goldenSeed(): Recipe` (dados crus do §12) como estado inicial em memória até existir o fluxo "abrir receita". Sem lógica.
- `src/ui/ingredientsTable.ts` — `renderIngredientsTable(root, state, prefs)`: monta thead (colunas fixas §2.A.2), tbody por ingrediente + linha do Fermento, tfoot (total), botão "+ ingrediente", checkbox "Exibir custos". Wiring: `input` → `parseDecimal` + `state.update` + repintar só células derivadas/tfoot (não recriar o input focado); `blur` → validação (010) e reverter+erro se `block`; `unit-toggle`/`select` → troca `inputUnit`; add/remove com guarda de farinha mínima (§5.B). Derivados via `textContent` (SEM box, §4.1). Zero fórmula.
- (opcional) `src/ui/ingredientsTable.test.ts` — ver "Testes primeiro".

### Arquivos a modificar
- `index.html` — substituir placeholder pelo shell real: `<nav class="app-nav">` (3 links, Calculadora ativa), `<header class="page-header">` (título/subtítulo pt-BR), `<div id="app" class="page">` como ponto de montagem, `<script type="module" src="/src/ui/pages/calculadora.ts">`. **Sem `<style>` inline, sem Google Fonts CDN** (offline §10/§11.1; fallback `system-ui`, decisão 001-2).
- `src/ui/pages/calculadora.ts` — composition root: importar `design-system.css` (mantém), instanciar `createPrefsStore()`, seed via `goldenSeed()`, `createAppState`, montar nav/header/card e chamar `renderIngredientsTable`, `subscribe` para repintar. Sem fórmula.
- `references/design-system.css` — adicionar `.page`, `.pw-combo`, `.unit-suffix` (só tokens). `references/design-system.html` — documentar as 3 classes novas.
- `package.json`/`vite.config.ts` — **somente se** adotar o teste jsdom: `jsdom` em devDependencies e `environment` por-arquivo. `package-lock.json` commitado (regra de ouro 3).

### Arquivos que NÃO devem ser tocados
- `src/core/**` e `src/storage/**` (contratos fechados, 189 testes verdes) — a UI consome, não altera.
- `spec/**`, `mockups/**` (fonte da verdade; edições pré-existentes no working tree não são desta issue).
- `receitas.html`, `historico.html`, `src/ui/pages/receitas.ts`, `src/ui/pages/historico.ts` (outras telas).
- Tokens `:root` do design system (imutáveis).

### Ordem de implementação
1. `references/design-system.css`/`.html`: `.page`, `.pw-combo`, `.unit-suffix` documentadas (tokens).
2. `src/ui/dom.ts` (helpers seguros, base de tudo).
3. `src/ui/seed.ts` (golden §12).
4. `src/ui/state.ts` (estado + `recalculate`).
5. `src/ui/ingredientsTable.ts` (render + wiring inline/toggle/g-mL/add-remove/validação).
6. `index.html` shell + `src/ui/pages/calculadora.ts` (montagem, subscribe).
7. (opcional) `ingredientsTable.test.ts` jsdom (escape + recálculo) e ajuste `package.json`/`vite.config.ts`.
8. Verificação manual (abaixo).

### Como testar manualmente
- `npm run dev` (Vite) → abrir `http://localhost:5173/` (offline; nenhuma chamada de rede — conferir aba Network vazia, §10/§11.1).
- Conferir o gabarito §12 na tela: pesos 1.000,0 / 700,0 / 40,0 (azeite) / 200,0 (fermento) / 20,0 g; Custo/g azeite R$ 0,0640; Custo azeite R$ 2,56; Custo fermento R$ 0,80.
- Editar % Água 70→80 → Peso vira 800,0 na hora (sem botão).
- Blur % que rompe 100% (com 2 farinhas) → campo reverte + erro (§5.A).
- Blur Peso do Produto = 0 → reverte + erro (§5.C).
- Alternar g/mL da Água → número inalterado (1:1), rótulo muda.
- Marcar/desmarcar "Exibir custos" → 4 colunas aparecem/somem; recarregar a página mantém o estado (prefs).
- Nome do ingrediente = `<script>alert(1)</script>` → texto literal, sem alerta (escape).
- `npm run build` (tsc --noEmit + vite build) verde; `npm test` continua 189+ verde.

### O que NÃO fazer
- Não colocar nenhuma fórmula na camada DOM (baker's %, custo, hidratação, preço) — tudo vem de `recalculate`/`summary`.
- Não usar `innerHTML` com string do usuário, nem `eval`/`new Function` (regra de ouro 3).
- Não recriar o input em foco no `input` event (perde o cursor) — repintar só derivados/tfoot; rebuild total só em mudança estrutural (add/remove/unidade/modo).
- Não arredondar em cálculo — arredondar só na exibição, via formatters (§9); validar sobre valor CRU (parseDecimal), nunca sobre string formatada (PROGRESS 010-3).
- Não redistribuir % automaticamente em erro de soma (§5.A literal) — só reverter.
- Não implementar painéis de Hidratação/Precificação nem sub-receita editável (issue 016); não usar `<input readonly>` para derivados (usar texto plano §4.1); não adicionar Google Fonts CDN nem qualquer fetch de runtime.
