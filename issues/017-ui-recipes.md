---
id: "017"
titulo: UI Tela de receitas — criar, abrir, renomear, duplicar, excluir + backup
tipo: ui
deps: ["011", "012", "014"]
status: done
---

## Contexto
Gerenciamento de receitas (spec §2.F; mockup `mockups/receitas.html`). Também abriga os botões de backup/restauração (012, §10).

## O que fazer
- `receitas.html` + `src/ui/`: lista das receitas salvas (storage 011), fiel ao mockup/design system.
- Operações (§2.F): criar (em branco ou padrão), abrir (carrega na calculadora — navegação com id, ex `index.html?recipe=<id>`), renomear, duplicar (cópia integral), excluir (com confirmação; §14.7 órfãs preservadas — mensagem avisa que fornadas ficam).
- Botões "Exportar backup" / "Restaurar backup" usando 012 (download JSON / input file); falha de import → mensagem de erro pt-BR sem perder dados.
- **Escape XSS**: nome da receita via textContent — dado do usuário (regra de ouro 3).
- Estado vazio (nenhuma receita) com chamada para criar.
- Reusar componentes/classes já criados nas issues 014–016 (regra de ouro 2).

## Critérios de aceite
- [x] 5 operações §2.F funcionais ponta a ponta com persistência.
- [x] Duplicar gera cópia integral independente (editar cópia não afeta original).
- [x] Excluir pede confirmação; fornadas da receita permanecem órfãs (§14.7).
- [x] Backup: export → limpar storage → import → receitas de volta.
- [x] Nome `<img onerror>` renderiza inerte.
- [x] Strings pt-BR; layout fiel ao mockup.

## Referências
- spec §2.F, §10, §14.7 · mockups/receitas.html · brandbook · issues 011/012

---

## Plano Técnico

### Análise do existente (busca real no código + design system)

**Reusar sem tocar (regra de ouro 2):**
- `src/storage/recipes.ts` → `createRecipeStore()` já entrega **todas** as 5 operações §2.F: `list/get/create(seed?)/rename(id,name)/duplicate(id)/remove(id)` + `replaceAll`. Injeta `StorageLike` e `newId` (determinismo em teste). `duplicate` já faz deep clone `structuredClone` com novo id/nome "Cópia de X" e datas novas → critério "cópia integral independente" já garantido pelo store; a UI só chama.
- `src/storage/backup.ts` → `collectBackupData({recipeStore,storage})`, `exportBackup(data,{now})`, `downloadBackupFile(json,{now})` (Blob→objectURL→`<a download>`→revoke, nome `minha-padaria-backup-aaaa-mm-dd.json` §7.1), `readBackupFile(file)`, `importBackup(json)` (valida ANTES de escrever — decisão 012.3: falha nunca corrompe estado, já testado), `applyBackupData(data,{recipeStore,storage})` (substituição total via `replaceAll`). A tela só faz o wiring dos botões; zero lógica nova de backup.
- `src/storage/local.ts` → `createMemoryStorage()` (backend dos testes, sem jsdom-storage), `defaultStorage()` (localStorage real no composition root).
- `src/ui/dom.ts` → `h/clear/on` (único ponto DOM; `textContent`/`createTextNode`, nunca `innerHTML`) → escape XSS do nome da receita (regra 3) sai de graça.
- `src/core/recalc.ts` → `recalculate(recipe)` (clona, preserva id/createdAt/updatedAt via `structuredClone`) → fonte dos números do card (`summary.costPerUnit`, `summary.profitMargin`).
- `src/core/format.ts` → `formatCurrency` (R$ 2 casas §9), `formatPercent` (2 casas §9), `formatDate` (aaaa-mm-dd §7.1) para "Editado …" e F total.
- `src/core/pricing.ts` → `marginStatus(margin)` (verde >30 / amarelo 15–30 / vermelho <15, §4) para o chip de margem do card.
- `src/ui/seed.ts` → `goldenSeed()` (Recipe "valores padrão" §2.F) como semente do "criar a partir de valores padrão".
- **design-system.css já tem tudo do mockup**: `.recipe-grid` (l.317), `.recipe-card` + `h3/.meta/.stats/.stat-label/.stat-value/.actions` (l.321–332), `.chip-ok/.chip-warn/.chip-crit` (l.229–231), `.btn/.btn-primary/.btn-secondary/.btn-danger` (l.158–175), `.app-nav` (l.113), `.page-header .inner/.subtitle/.actions` (l.126–141), `.input` (l.183). Nenhuma classe de card/botão nova.

**Estender (quase existe):**
- `src/ui/cellHelpers.ts` → **extrair** o `CHIP_CLASS: Record<MarginStatus,string>` hoje duplicado em `pricingPanel.ts` (l.44) para um helper exportado `marginChipClass(status)`; `pricingPanel.ts` e o novo `recipesList.ts` passam a reusar (regra 2, zero duplicação).
- `receitas.html` (hoje só `<script>`) e `src/ui/pages/receitas.ts` (hoje só importa o CSS) → viram shell + composition root reais, espelhando `index.html`/`calculadora.ts`.
- `src/ui/pages/calculadora.ts` → integra `?recipe=<id>` (ver seção Integração).
- `references/design-system.css` + `.html` → 2 classes novas documentadas, só tokens (ver "Arquivos a modificar").

**Lacuna coberta pela issue:** não existe UI de lista de receitas, nem wiring de backup, nem carregamento de receita na calculadora. Nenhum diálogo/modal no design system → usar `window.confirm`/`window.prompt` (API nativa, zero dep, regra 1) **injetáveis** para teste jsdom.

### Cenários

- **Caminho feliz — lista**: N receitas no storage → N `.recipe-card` (ordem = `recipeStore.list()`), cada card com nome (escape), "Editado <formatDate(updatedAt)> · F total <formatWeight(flourTotalWeight)> g", Custo unit. = `formatCurrency(recalculate(r).summary.costPerUnit)`, chip Margem = `formatPercent(summary.profitMargin)` com classe `marginChipClass(marginStatus(profitMargin))`. Subtítulo do header = "N receita(s) cadastrada(s)".
- **Criar (§2.F)**: clique "+ Nova receita" → `recipeStore.create(goldenSeed())` (valores padrão) → navega para `index.html?recipe=<id>`. Decisão registrada: o mockup tem 1 botão; "em branco" (`create()` sem seed → `defaultRecipe`) fica como follow-up de design (não bloqueia — "criar" está funcional). Marcado como risco/decisão.
- **Abrir (§2.F)**: link "Abrir" = `<a href="index.html?recipe=<encodeURIComponent(id)>">` (mockup aponta `calculadora.html`; arquivo real é `index.html` — usar index.html).
- **Renomear (§2.F)**: `prompt("Novo nome da receita:", nomeAtual)` → se string não-vazia e ≠ atual → `recipeStore.rename(id, nome)` → re-render. `null`/vazio → no-op.
- **Duplicar (§2.F)**: `recipeStore.duplicate(id)` → novo card "Cópia de X"; independência já garantida pelo deep clone do store.
- **Excluir (§2.F/§14.7)**: `confirm("Excluir \"<nome>\"? As fornadas já registradas desta receita continuarão no histórico como fornadas órfãs.")` → true → `recipeStore.remove(id)`; o histórico (`mp.bakes.v1`) **não é tocado** → fornadas permanecem órfãs (§14.7, sem cascade — já é o comportamento de `remove`). false → no-op.
- **Backup exportar (§10)**: `downloadBackupFile(exportBackup(collectBackupData({recipeStore,storage})))`.
- **Backup restaurar (§10)**: `<input type="file" accept="application/json">` → `readBackupFile(file)` → `importBackup(json)` → `applyBackupData(data,{recipeStore,storage})` → re-render. Golden do ciclo: exportar → `replaceAll([])` (limpar) → importar → receitas de volta.
- **Borda — import inválido**: JSON quebrado / envelope errado / versão ≠ 1 → `importBackup` lança Error pt-BR → capturar, exibir mensagem no `role="status"` (aria-live), **storage intacto** (validação antes da escrita, decisão 012.3). Dados não se perdem.
- **Borda — estado vazio**: `list()` vazio → bloco `.empty-state` "Você ainda não tem receitas." + botão primário "Criar primeira receita" (mesma ação de criar).
- **Borda — busca**: input "Buscar receita…" filtra cards por `name` (case-insensitive, comparação sobre string crua; render por `textContent`).
- **Borda — `?recipe=<id>` inexistente** (na calculadora): `get(id)` undefined → cai em `goldenSeed()` + banner discreto "Receita não encontrada; abrindo modelo padrão." Sem auto-save (id órfão não persiste).
- **XSS**: nome `<img src=x onerror=…>` / `<script>` → via `h(...,textContent)` renderiza inerte, sem nó `<img>`/`<script>` (critério de aceite).

### Testes primeiro (jsdom — `// @vitest-environment jsdom`, backend `createMemoryStorage()` + `recipeStore` com `newId` stub)

Um por comportamento; deps (`confirm`/`prompt`/`navigate`/`readFile`/`onError`) injetadas:
1. **Estado vazio**: storage vazio → renderiza `.empty-state` com botão "Criar primeira receita"; nenhum `.recipe-card`.
2. **Lista**: 2 receitas → 2 `.recipe-card`; `h3.textContent` = nomes; subtítulo "2 receitas cadastradas".
3. **Card stats**: receita fixture §12 SEM azeite → card mostra Custo unit. `R$ 4,43` e chip `40,00%` com classe `chip-ok` (`marginStatus(40)=green`).
4. **XSS**: nome `<img src=x onerror="x">` → sem nó `<img>`; `h3.textContent` === string literal.
5. **Criar**: clique "+ Nova receita" → `list().length` +1; `navigate` chamado com `index.html?recipe=<id do novo>`.
6. **Duplicar independente**: `duplicate` → `list().length` +1, nome "Cópia de X"; mutar peso da cópia via `update` não altera o original (asserção de deep clone).
7. **Renomear**: `prompt` stub → "Pão Novo" → `h3.textContent` atualiza e `get(id).name === "Pão Novo"`.
8. **Excluir confirmado + órfãs**: `mp.bakes.v1` semeado com 1 fornada da receita; `confirm` stub true → `list()` sem a receita; `storage.getItem('mp.bakes.v1')` inalterado (fornada órfã preservada, §14.7); mensagem do confirm contém "órfã".
9. **Excluir cancelado**: `confirm` false → receita permanece.
10. **Backup export**: espia `downloadBackupFile`/`exportBackup` (ou injeta `download`) → JSON contém `app:"minhapadaria"` e o nome da receita.
11. **Restaurar round-trip**: exporta JSON → `replaceAll([])` → `readFile` devolve o JSON → após restaurar, `list().length` volta ao original com mesmos ids.
12. **Import inválido não perde dados**: storage com 1 receita; `readFile` devolve `"{lixo"` → `onError`/status recebe mensagem pt-BR; `list()` ainda tem a receita.
13. **Busca**: 2 receitas, digitar termo do nome de uma → só 1 card visível.

### Arquivos a criar
- `src/ui/recipesList.ts` — `renderRecipesList(root, deps)`. Responsável por: header actions (busca, "+ Nova receita", "Exportar backup", "Restaurar backup" + `<input file>` oculto), grid/estado vazio, e as 5 operações §2.F + backup. `deps = { recipeStore, storage, confirm?, prompt?, navigate?, readFile?, download?, onError? }` (defaults = `window.confirm/prompt`, `location.assign`, `readBackupFile`, `downloadBackupFile`, status region). Zero fórmula: números via `recalculate`, formatação via `format.ts`, chip via `marginChipClass`, DOM via `dom.ts`. Cabeçalho citando §2.F/§10/§14.7/§7.1/§9.
- `src/ui/recipesList.test.ts` — 13 casos jsdom acima.

### Arquivos a modificar
- `receitas.html` — adicionar shell: `<nav class="app-nav">` (Receitas ativa; links `index.html`/`receitas.html`/`historico.html`), `<header class="page-header"><div class="inner" id="rc-header"></div></header>`, `<div id="app" class="page"></div>`. Sem `<style>` inline, sem CDN de fontes (offline §10) — o mockup usa Google Fonts; **não** copiar (app 100% local).
- `src/ui/pages/receitas.ts` — composition root fino: instancia `createRecipeStore()` (localStorage real) + `defaultStorage()`, chama `renderRecipesList(app, {recipeStore, storage})` e preenche `#rc-header`. Mantém o `import` do design-system.css.
- `src/ui/pages/calculadora.ts` — **Integração `?recipe=<id>`**: ler `new URLSearchParams(location.search).get('recipe')`; se houver e `recipeStore.get(id)` existir → usar essa Recipe como semente (no lugar de `goldenSeed()`) e ativar auto-save; senão `goldenSeed()` (banner "não encontrada" se id presente e ausente). **Auto-save (decisão registrada)**: `store.subscribe` com **debounce ~400ms** (§10 "debounce em inputs") chamando `recipeStore.update(store.getState().recipe)`; `flush` no `visibilitychange`(hidden)/`beforeunload`. Sem botão "Salvar" (§1.6 sem submit). Só ativa quando aberta via `?recipe` válido (seed golden efêmero segue sem persistir — preserva comportamento atual).
- `src/ui/cellHelpers.ts` — exportar `marginChipClass(status: MarginStatus): string`; migrar o mapa de `pricingPanel.ts`.
- `src/ui/pricingPanel.ts` — trocar `CHIP_CLASS` local por `marginChipClass` importado (dedup, regra 2).
- `references/design-system.css` — 2 classes novas, só tokens: `.empty-state` (bloco centralizado, `--text-muted`, gap/padding por tokens) e `.form-status`/`.form-status--error`/`.form-status--ok` (mensagem de backup com `role="status"`/`aria-live`, cores `--danger`/`--status-ok-text`). Documentar em `references/design-system.html`.

### Arquivos que NÃO devem ser tocados
- `src/storage/recipes.ts`, `src/storage/backup.ts`, `src/storage/local.ts` (já entregam tudo; só consumir).
- `src/core/**` (recalc, pricing, format, types) — só leitura.
- `src/ui/dom.ts`, `src/ui/seed.ts` — reuso sem alteração.
- Qualquer `:root`/token do design system (imutável).
- `mockups/**` (referência), `spec/**`.

### Ordem de implementação
1. Extrair `marginChipClass` para `cellHelpers.ts`; ajustar `pricingPanel.ts` (rodar suíte — verde, sem regressão).
2. Escrever `recipesList.test.ts` (13 casos, falhando) — TDD.
3. Implementar `recipesList.ts` até verde (lista → estado vazio → criar/abrir/renomear/duplicar/excluir → busca → backup export/restore/erro).
4. Adicionar as 2 classes documentadas ao design-system (css + html).
5. Shell `receitas.html` + composition root `receitas.ts`; verificação manual (`npm run dev`).
6. Integração `?recipe=<id>` + auto-save debounced em `calculadora.ts`; verificação manual (abrir card → editar → voltar → persistiu).
7. Gates: `tsc --noEmit` + `vite build` + Vitest verdes; atualizar PROGRESS/architecture (escriba).
