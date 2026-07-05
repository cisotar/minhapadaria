---
id: "012"
titulo: Backup/restauração em arquivo JSON (obrigatório v1)
tipo: storage
deps: ["011"]
status: todo
---

## Contexto
Proteção contra perda do localStorage (spec §10, decisão 11): exportar TODOS os dados (receitas + histórico de fornadas) para JSON; importar/restaurar do arquivo. Formato também é a futura migração SaaS (§11.2).

## O que fazer
- `src/storage/backup.ts`:
  - `exportBackup(): string` — JSON com envelope `{ app, schemaVersion: 1, exportedAt, recipes, bakeHistory }`. Histórico incluído quando existir (issue 013 pluga aqui; até lá, array vazio).
  - `importBackup(json: string)` — valida envelope (app/schemaVersion/shape); inválido → erro claro pt-BR, estado atual INTACTO (não zera nada em falha).
  - Estratégia de importação: substituição total documentada no código (leitura literal de "restaurar" §10); registrar em PROGRESS.md.
- Download/upload do arquivo: Blob + `URL.createObjectURL` + `<a download>`; `<input type="file">` + FileReader (MDN; sem lib — plataforma cobre).
- UI mínima: botões nas telas ficam com issues de UI (017); aqui só as funções + wiring básico exportável.

## Testes exigidos (TDD)
- Round-trip: export com 2 receitas + 1 fornada → import em storage limpo → deep-equal.
- Import de JSON inválido ("{oops", schemaVersion 99, sem envelope) → throw com mensagem pt-BR; storage anterior intacto.
- Export sem dados → envelope válido com arrays vazios.
- exportedAt em formato ISO.

## Critérios de aceite
- [ ] Backup cobre receitas + histórico (§10).
- [ ] Falha de import nunca corrompe/perde dados atuais.
- [ ] Zero rede; arquivo local apenas.

## Referências
- spec §10, §11.2, decisão 11 · MDN Blob/FileReader

---

## Plano Técnico

### Análise do existente
Busca real (`grep`/leitura) na camada `src/storage/` — tudo reusável, nada a duplicar:

- `src/storage/local.ts` → `StorageLike` (getItem/setItem/removeItem), `createMemoryStorage()` (Map, testes node-safe), `defaultStorage()` (única amarração ao browser). **REUSO:** `backup.ts` injeta `StorageLike` com default `defaultStorage()`; testes usam `createMemoryStorage()` sem jsdom. Mesmo padrão de injeção de recipes/prefs.
- `src/storage/recipes.ts` → `createRecipeStore()` já lê/escreve `Recipe[]` sob `mp.recipes.v1`, com `writeAll` (serializa `Date→ISO` por `toJSON` nativo) e `reviveDates` (reviver dirigido SÓ `createdAt`/`updatedAt`). `list()` já revive datas corretamente. **REUSO:** export lê via `recipeStore.list()` (datas já Date). **EXTENSÃO mínima:** adicionar `replaceAll(recipes: Recipe[]): void` (delega a `writeAll`) — necessário para substituição total preservando `id`/datas originais do backup (nunca `create()`, que regenera id). Estender é a regra de ouro 2; duplicar `writeAll` a violaria.
- `src/storage/prefs.ts` → padrão de leitura defensiva (`try/catch` → default sem crash) e chave versionada `mp.prefs.v1`. **REUSO do padrão** (não do módulo): mesma disciplina de parse defensivo e chave `mp.<x>.v1`. `showCosts` é pref global (§2.A.2), NÃO entra no backup (backup = dados do usuário: receitas + fornadas, §10/decisão 11).
- `src/storage/recipes.test.ts` → convenções de teste (clock determinístico `makeClock`, `makeIds`, `seed()` parcial). **REUSO:** `backup.test.ts` segue idêntico estilo (memory storage, clock injetado).
- `src/core/types.ts` → `Recipe`, `BakeEntry` (com `date: Date`, snapshots de custo/preço §14.3), `PackageCost`. **REUSO:** tipos do envelope importados daqui; zero tipo novo de domínio.
- Chave de fornadas (`mp.bakes.v1`) **ainda não existe** — issue 013 cria o store. `backup.ts` define e exporta `BAKES_STORAGE_KEY = 'mp.bakes.v1'` como fonte única; 013 importa dela (regra de ouro 2, sem literal duplicado). Até 013, `bakeHistory` é lido/escrito direto no `StorageLike` por essa chave (seam temporário documentado); array vazio quando ausente.

Decisão de segurança/lib (regra de ouro 1/3): backup é I/O de arquivo trivial via plataforma (`Blob`, `URL.createObjectURL`, `<a download>`, `FileReader.readAsText`) — **nenhuma lib nova**; libs só se justificariam para algo não-trivial. Dados 100% locais, zero rede, zero secret (§10, §11.1). Serialização é JSON puro (sem `innerHTML`, sem `eval`, sem reviver genérico) — dado do usuário nunca é executado; a UI (017) que renderizar nomes/notas fará escape lá.

### Desenho da API (`src/storage/backup.ts`)
Constantes exportadas (fonte única): `BACKUP_APP_ID = 'minhapadaria'`, `BACKUP_SCHEMA_VERSION = 1`, `BAKES_STORAGE_KEY = 'mp.bakes.v1'`.

Tipos: `BackupData = { recipes: Recipe[]; bakeHistory: BakeEntry[] }`; `BackupEnvelope = { app: 'minhapadaria'; schemaVersion: 1; exportedAt: string; recipes: Recipe[]; bakeHistory: BakeEntry[] }` (ordem exata da issue §14, decisão 11).

Funções **PURAS** (alvo do TDD, testáveis em node sem browser):
- `exportBackup(data: BackupData, opts?: { now?: () => Date }): string` — monta envelope; `exportedAt = (opts.now ?? () => new Date())().toISOString()` (clock injetável, §7.1 ISO); `JSON.stringify` (Date→ISO nativo). Não muta `data`.
- `importBackup(json: string): BackupData` — `JSON.parse` em `try/catch`; valida `app === BACKUP_APP_ID`, `schemaVersion === 1`, `Array.isArray(recipes)`, `Array.isArray(bakeHistory)`; revive datas por reviver dirigido (`Recipe.createdAt/updatedAt`; `BakeEntry.date`) — nunca reviver genérico. Qualquer falha → `throw new Error(<pt-BR>)` ANTES de qualquer escrita. Retorna `BackupData` validado; **não toca storage** → estado intacto em falha é garantido por construção.

Orquestradores de I/O (injetam storage/store, thin):
- `collectBackupData(deps: { recipeStore; storage? }): BackupData` — `recipes = recipeStore.list()` (REUSO); `bakeHistory` = parse defensivo de `mp.bakes.v1` (vazio até 013).
- `applyBackupData(data: BackupData, deps: { recipeStore; storage? }): void` — **SUBSTITUIÇÃO TOTAL** (leitura literal de "restaurar", §10): `recipeStore.replaceAll(data.recipes)` + `storage.setItem(BAKES_STORAGE_KEY, JSON.stringify(data.bakeHistory))`. Só chamado após `importBackup` ter sucesso. Documentado no cabeçalho do módulo e em PROGRESS.md (exigência da issue).

Helpers de DOM (browser-only, **wiring fica na 017**, não unit-testados em node):
- `downloadBackupFile(json: string, opts?: { now? }): void` — `Blob([json], {type:'application/json'})` → `URL.createObjectURL` → `<a download="minha-padaria-backup-AAAA-MM-DD.json">` → `click()` → `URL.revokeObjectURL` (libera referência, MDN). Filename derivado da data (§7.1 `aaaa-mm-dd`).
- `readBackupFile(file: File): Promise<string>` — `FileReader.readAsText` com `onload`/`onerror` (reject pt-BR). Wrapper fino, testável só com fake em jsdom (fora de escopo agora).

### Cenários
- **Caminho feliz (round-trip):** 2 receitas (com `ingredients`/`sourdough`/`pricing`) + 1 `BakeEntry` (golden §12: `unitCost 4,43`, `unitSalePrice 7,38`, produzida 2) → `exportBackup` → `importBackup` → `BackupData` deep-equal ao original, com `createdAt`/`updatedAt`/`date` como `Date`.
- **Export sem dados:** `{ recipes: [], bakeHistory: [] }` → envelope `{app:'minhapadaria', schemaVersion:1, exportedAt:<ISO>, recipes:[], bakeHistory:[]}` (arrays vazios, válido).
- **Substituição total:** storage com receita A → `applyBackupData` de backup contendo só B → `recipeStore.list()` === `[B]`, A removida (§10 restaurar).
- **Borda ISO:** `exportedAt` bate exatamente com clock injetado; formato ISO 8601.
- **Erro — JSON malformado:** `'{oops'` → `throw` "Arquivo de backup inválido: não é um JSON válido."
- **Erro — sem envelope:** `'{}'`/`'[]'` (sem `app`) → "Arquivo de backup inválido: não parece um backup do Minha Padaria."
- **Erro — versão incompatível:** `schemaVersion: 99` → "Versão de backup não suportada (esperado 1, recebido 99)."
- **Erro — shape corrompido:** `recipes` não-array → "Arquivo de backup inválido: estrutura de dados corrompida."
- **Estado intacto em falha:** store com receita A; `importAndApply` de JSON inválido lança e `store.list()` continua `[A]` (nada zerado).

### Testes primeiro (Vitest — escrever ANTES da implementação)
Backend: `createMemoryStorage()`; clock injetado (`() => new Date('2026-07-05T00:00:00.000Z')`); `recipeStore` real sobre memory storage (reuso do padrão de `recipes.test.ts`). Um caso por comportamento:
1. `exportBackup` vazio → parse do retorno tem `app='minhapadaria'`, `schemaVersion=1`, `recipes=[]`, `bakeHistory=[]`.
2. `exportBackup` com clock injetado → `exportedAt === '2026-07-05T00:00:00.000Z'` (ISO).
3. `exportBackup` não muta `data` de entrada (pureza; `JSON.stringify` antes/depois igual).
4. Round-trip: `importBackup(exportBackup({2 recipes, 1 bake}))` → deep-equal; `recipes[0].createdAt instanceof Date`; `bakeHistory[0].date instanceof Date`.
5. `importBackup('{oops')` → throw com mensagem pt-BR de JSON inválido.
6. `importBackup('{}')` (sem `app`) → throw pt-BR "não parece um backup".
7. `importBackup` com `schemaVersion: 99` → throw pt-BR de versão.
8. `importBackup` com `recipes` não-array → throw pt-BR de estrutura corrompida.
9. `applyBackupData` substitui total: seed A → aplica B → `store.list()` === `[B]`.
10. `collectBackupData` reúne `recipeStore.list()` + `bakeHistory` de `mp.bakes.v1` (semeado direto) e devolve ambos.
11. Estado intacto: seed A → import de JSON inválido lança e `store.list()` permanece `[A]` (nenhuma escrita ocorreu).
12. `bakeHistory` ausente (`mp.bakes.v1` não setado) → `collectBackupData` devolve `bakeHistory: []` sem throw.

### Arquivos a criar
- `src/storage/backup.ts` — funções puras `exportBackup`/`importBackup`, orquestradores `collectBackupData`/`applyBackupData`, helpers DOM `downloadBackupFile`/`readBackupFile`, constantes e tipos de envelope. Cabeçalho citando §10, §11.2, decisão 11 e docs MDN.
- `src/storage/backup.test.ts` — os 12 casos acima (TDD red→green).

### Arquivos a modificar
- `src/storage/recipes.ts` — adicionar `replaceAll(recipes: Recipe[]): void` à interface `RecipeStore` e à fábrica (delega a `writeAll`). Extensão mínima justificada; não altera comportamento existente.
- `PROGRESS.md` — registrar a estratégia de substituição total e o seam temporário de `mp.bakes.v1` (exigência da issue; feito pelo escriba na iteração).
- `references/architecture.md` — linha no mapa de módulos para `backup.ts` (escriba).

### Arquivos que NÃO devem ser tocados
- `src/core/**` (lógica pura; backup não recalcula nada — §1.6).
- `src/storage/local.ts` e `src/storage/prefs.ts` (só reuso; `showCosts` fora do backup).
- `spec/**`, `mockups/**`, `references/design-system.css`, demais issues.
- `vite.config.ts`, `package.json` (nenhuma dependência nova; plataforma cobre — regra de ouro 1).
- Nenhuma UI (`src/ui/**`): botões e wiring de download/upload são da issue 017.

### Ordem de implementação
1. Escrever `backup.test.ts` com os 12 casos (falhando).
2. Definir constantes, tipos e `exportBackup`/`importBackup` puros → verdes casos 1–8, 12.
3. Adicionar `replaceAll` em `recipes.ts`; implementar `collectBackupData`/`applyBackupData` → verdes 9–11.
4. Adicionar helpers DOM `downloadBackupFile`/`readBackupFile` (sem teste node; smoke manual/017).
5. Cabeçalho de spec no módulo; registrar substituição total + seam `mp.bakes.v1` em PROGRESS.md; atualizar mapa em architecture.md (escriba).

### Riscos
- **Seam `mp.bakes.v1`:** store real nasce na 013; backup grava/lê a chave direto até lá. Mitigação: constante única exportada de `backup.ts`, 013 importa e substitui o acesso raw por reuso do store.
- **`replaceAll` sem validação de forma das receitas:** por design o storage persiste estado "cru" (§1.6); receita importada só é validada/recalculada pela UI (016) — coerente com a decisão de 011. Não é bug, é contrato; anotar.

Fontes MDN consultadas (regra de ouro 4):
- https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
- https://developer.mozilla.org/en-US/docs/Web/API/Blob
- https://developer.mozilla.org/en-US/docs/Web/API/FileReader
