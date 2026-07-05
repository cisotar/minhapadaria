---
id: "011"
titulo: Receitas em localStorage — CRUD, duplicar, estado completo + toggle custos persistido
tipo: storage
deps: ["002"]
status: todo
---

## Contexto
Persistência local (spec §10): receitas com estado completo (§2.F); preferência do toggle "Exibir custos" persistida entre sessões (§2.A.2).

## O que fazer
- `src/storage/recipes.ts`:
  - CRUD sobre `Recipe[]` em localStorage (chave versionada, ex `mp.recipes.v1`): `list`, `get`, `create`, `update`, `rename`, `duplicate`, `remove`.
  - Duplicar = cópia integral (ingredientes, fermento, precificação, modos) com novo `id`, novo nome ("Cópia de X"), datas novas (§2.F).
  - Estado completo por receita: ingredientes, sourdough, calculationMode, batchPlanningMode, pricing (§2.F).
  - `Date` serializada ISO; revive no load. IDs: `crypto.randomUUID()` (plataforma; MDN).
  - JSON corrompido/ausente → lista vazia, sem crash.
- `src/storage/prefs.ts`: get/set do toggle "Exibir custos" (default: oculto §2.A.2).
- Injetar storage (interface mínima) para testabilidade — Vitest sem browser usa stub/`happy-dom`.

## Testes exigidos (TDD)
- create → list contém 1; get por id retorna igual (deep, com datas revividas).
- duplicate → id diferente, nome "Cópia de X", conteúdo deep-equal exceto id/nome/datas.
- rename/update → updatedAt muda.
- remove → some da lista; get → undefined.
- localStorage com lixo (`"{oops"`) → list() = [] sem throw.
- Toggle custos: default false; set true → persiste.

## Critérios de aceite
- [ ] Round-trip sem perda: save→load deep-equal (datas incluídas).
- [ ] Duplicação integral (§2.F).
- [ ] Toggle custos persistido, default oculto (§2.A.2).
- [ ] Zero rede; dados 100% locais (regra de ouro 3).

## Referências
- spec §2.A.2, §2.F, §6, §10 · MDN localStorage, crypto.randomUUID

---

## Plano Técnico

### Análise do existente
Busca real (`grep`/leitura) no código e docs:
- `src/core/types.ts` — `Recipe` (§6) já é o modelo a persistir: `id`, `name`, `calculationMode`, `batchPlanningMode`, `flourTotalWeight`, `flourPerUnit?`, `ingredients[]`, `sourdough`, `pricing`, `createdAt: Date`, `updatedAt: Date`. `Pricing.priceInputMode: 'sale-price'|'margin'|'profit'` **já existe** (issue 008) e é parte de `Recipe.pricing` → persiste automaticamente no round-trip; não é preferência global. **Reuso: importar os tipos, não redefinir.**
- `src/storage/` — só existe `.gitkeep`. Sem StorageLike, sem CRUD prévio. Nada a estender; criar do zero.
- `vite.config.ts` — `test.environment: 'node'` (default), sem jsdom/happy-dom; `test.globals: true` (usar `describe/it/expect` sem import). **Reusar como está** (ver decisão de injeção).
- `src/core/*` — camada pura já pronta (recalc, costs, pricing…). Storage **não** recalcula derivados: separação de camadas (recalc é do core, §1.6). Storage só serializa/desserializa estado.
- Convenção do projeto (validation.ts issue 010): dependências de I/O/tempo **injetadas, nunca `new Date()`/`crypto` internos** — replicar aqui (clock + gerador de id injetáveis) para determinismo em teste.

### Decisão de injeção de storage (regra de ouro 4 — docs consultadas)
**Interface própria mínima `StorageLike` + stub em memória; Vitest permanece `environment: 'node'`. NÃO adotar happy-dom/jsdom.**
- Justificativa (1 linha): o módulo usa só 3 métodos (`getItem/setItem/removeItem`); um stub de ~6 linhas cobre os testes sem nova devDependency (regra de ouro 1/2), e mantém a suíte core pura e rápida em node.
- Docs: Vitest — ambiente `node` é o default; happy-dom/jsdom só quando se precisa de `window`/DOM real (não é o caso). `crypto.randomUUID` é global no Node 18+ (ambiente node do Vitest já o expõe) e no browser é **secure-context**: Vite dev serve em `http://localhost` (secure context ✓) — sem risco em runtime.
  - https://vitest.dev/guide/environment
  - https://vitest.dev/config/environment
  - https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

### Contrato dos módulos
`src/storage/local.ts` (compartilhado, reuso entre recipes/prefs):
- `interface StorageLike { getItem(k): string | null; setItem(k, v): void; removeItem(k): void }`.
- `createMemoryStorage(): StorageLike` — `Map` em memória (usado por testes e como fallback SSR-safe).
- `defaultStorage(): StorageLike` — retorna `globalThis.localStorage` (única amarração ao browser).

`src/storage/recipes.ts` — factory `createRecipeStore(opts?: { storage?, now?, newId? })`:
- Chave versionada `mp.recipes.v1`. `now = () => new Date()`, `newId = () => crypto.randomUUID()` (defaults; injetáveis).
- `list(): Recipe[]` — lê a chave, `JSON.parse`, **revive só `createdAt`/`updatedAt` para `Date`** (reviver dirigido por campo, nunca reviver genérico — não coagir strings do usuário, ex. nome que pareça ISO). Chave ausente ou JSON inválido → `[]` (try/catch), sem throw.
- `get(id): Recipe | undefined`.
- `create(seed?: Partial<Recipe>): Recipe` — gera `id`, `createdAt=updatedAt=now()`, faz merge sobre um default válido; grava; retorna clone. Não muta `seed`.
- `update(recipe: Recipe): Recipe` — substitui por `id`, seta `updatedAt=now()`, preserva `createdAt`; persiste estado completo (§2.F).
- `rename(id, name): Recipe | undefined` — muda `name` + `updatedAt`.
- `duplicate(id): Recipe | undefined` — cópia integral (deep clone de ingredients/sourdough/pricing/modos/flourPerUnit), novo `id`, `name = "Cópia de " + original`, `createdAt=updatedAt=now()` (§2.F).
- `remove(id): void` — remove da lista; grava.
- Serialização: `JSON.stringify` (Date→ISO via `toJSON` nativo, sem lib de datas). Persistência 100% local (§10, regra de ouro 3): nenhum fetch, nenhum secret.

`src/storage/prefs.ts` — factory `createPrefsStore(opts?: { storage? })`:
- Chave `mp.prefs.v1`, objeto `{ showCosts: boolean }`. Toggle "Exibir custos" é **global e único** (§2.A.2), não por receita → mora aqui.
- `getShowCosts(): boolean` — default **`false`** (oculto, §2.A.2); JSON inválido/ausente → `false`.
- `setShowCosts(v: boolean): void` — persiste.

### Cenários
- **Feliz**: `create` receita golden §12 → `list()` tem 1; `get(id)` deep-equal com `createdAt/updatedAt` como `Date`.
- **Round-trip datas**: gravar com `now` fixo (ex. `2026-07-05T00:00:00.000Z`); nova instância do store sobre o mesmo backend → `get().createdAt instanceof Date` e `getTime()` idêntico.
- **priceInputMode** (nota da issue): receita com `pricing.priceInputMode='margin'` → sobrevive save→load como `'margin'`.
- **Duplicar**: id diferente, `name='Cópia de Pão Rústico'`, `ingredients/sourdough/pricing/calculationMode/batchPlanningMode/flourPerUnit` deep-equal ao original; `createdAt/updatedAt` novos.
- **Borda**: storage vazio → `list()===[]`, `get('x')===undefined`. JSON corrompido `"{oops"` → `list()===[]` sem throw. `duplicate('inexistente')/rename('inexistente')` → `undefined`.
- **Toggle**: prefs vazio → `getShowCosts()===false`; `setShowCosts(true)` persiste `true` em nova instância; prefs corrompido → `false`.

### Testes primeiro (Vitest, escrever ANTES da implementação)
`src/storage/recipes.test.ts` (backend = `createMemoryStorage()`, `now`/`newId` injetados determinísticos):
1. `create` → `list().length===1`; `get(id)` deep-equal; `createdAt`/`updatedAt` são `Date`.
2. round-trip datas: `now` fixo; novo store mesmo backend → `createdAt instanceof Date` e `getTime()` igual.
3. `pricing.priceInputMode='margin'` sobrevive save→load.
4. `duplicate` → `id` novo (≠ original), `name='Cópia de X'`, restante deep-equal, datas novas.
5. `update` altera campo e `updatedAt` (clock avançado → estritamente maior), `createdAt` inalterado.
6. `rename` muda `name` e `updatedAt`; demais campos intactos.
7. `remove` → some de `list()`; `get(id)===undefined`.
8. lixo no storage (`getItem→"{oops"`) → `list()===[]` sem throw; `get()===undefined`.
9. chave ausente (`getItem→null`) → `list()===[]`.
10. pureza: `create(seed)` não muta `seed`; objeto retornado não é a mesma referência guardada (mutar retorno não afeta store).

`src/storage/prefs.test.ts`:
11. default `getShowCosts()===false`.
12. `setShowCosts(true)` → novo store mesmo backend → `true`.
13. prefs corrompido → `getShowCosts()===false` sem throw.

### Arquivos a criar
- `src/storage/local.ts` — `StorageLike`, `createMemoryStorage`, `defaultStorage`.
- `src/storage/recipes.ts` — `createRecipeStore` + CRUD/duplicate.
- `src/storage/recipes.test.ts` — casos 1–10.
- `src/storage/prefs.ts` — `createPrefsStore`.
- `src/storage/prefs.test.ts` — casos 11–13.

### Arquivos a modificar
- `references/architecture.md` — 5 linhas no Mapa de módulos (escriba).
- `PROGRESS.md` — iteração 011 + decisões da noite (escriba).

### Arquivos que NÃO devem ser tocados
- `src/core/**` (types.ts inclusive — `priceInputMode` e `number|null` já existem).
- `vite.config.ts` (ambiente permanece `node`; sem happy-dom/jsdom).
- `spec/`, `mockups/`, `references/design-system.css`, `brand/`.

### O que NÃO fazer
- Não trocar o ambiente do Vitest para jsdom/happy-dom; não adicionar dependência (nem lib de datas — `Date.toJSON`/ISO nativo basta).
- Não usar reviver genérico de `JSON.parse` que coaja qualquer string ISO a `Date` (só `createdAt`/`updatedAt`); nunca `eval`.
- Não recalcular derivados no load (isso é do core `recalculate`, §1.6) — storage persiste/retorna estado completo tal-qual.
- Não persistir histórico/`BakeEntry` aqui (issue 012); não criar migração/versão nova de chave.
- Não usar `new Date()`/`crypto.randomUUID()` diretamente no corpo das funções — só via defaults injetáveis (determinismo).
- Não renderizar dado do usuário nem tocar DOM (camada storage); escape de `name`/`notes` é responsabilidade da UI. Zero rede, zero secret (§10, §11.1, regra de ouro 3).
- Não mutar entradas (`create`/`update`/`duplicate` clonam).

### Ordem de implementação
1. `src/storage/local.ts` (StorageLike + memory stub).
2. `src/storage/recipes.test.ts` (red, casos 1–10).
3. `src/storage/recipes.ts` (green).
4. `src/storage/prefs.test.ts` (red, casos 11–13).
5. `src/storage/prefs.ts` (green).
6. `npm test` (suíte cheia verde) + `npm run build`; escriba atualiza Mapa de módulos e PROGRESS.
