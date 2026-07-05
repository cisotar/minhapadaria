---
id: "013"
titulo: Fornadas — cálculos, agregações dia/semana/mês, comparação, melhor/pior + persistência
tipo: core
deps: ["002", "011"]
status: todo
---

## Contexto
Histórico de produção/vendas (spec §14): registro por fornada, snapshots de custo/preço, agregações e comparações. `planned` fora dos totais (§14.4/14.6).

## O que fazer
- `src/core/bakes.ts` (cálculo puro):
  - Por fornada (§14.3): `CustoTotal = unitCost × qtdProduzida` · `Receita = unitSalePrice × qtdVendida` · `Lucro = Receita − CustoTotal` · `Desperdício = produzida − vendida` · `Taxa% = desperdício/produzida × 100`.
  - Agregações (§14.4): por dia, semana (segunda–domingo) e mês calendário → `BakeHistorySummary` (§6): produzidos, vendidos, custo, faturamento, lucro, margem média %, taxa desperdício média %. **`planned: true` fora de TODAS as agregações.**
  - Filtros (§14.5): por receita (`recipeId`), por intervalo de datas custom.
  - Comparação de períodos (§14.5): atual vs anterior com variação % (guard divisão por zero: anterior 0 → variação null/"—").
  - Melhor/pior dia/semana/mês por lucro no período (§14.5).
  - Confirmação de planejada (§14.6): remover `planned` → entra nos totais.
- `src/storage/bakes.ts`: CRUD de `BakeEntry` (reusar helpers/idioma da 011 — regra de ouro 2); edição e exclusão (§14.5); órfãs preservadas quando receita excluída (§14.7 — nunca cascade delete).
- Datas: agrupar semana/mês com código próprio simples sobre `Date` OU lib consolidada (`date-fns`) se complexidade justificar — decidir no plano, doc oficial consultada (regra de ouro 1/4).

## Testes exigidos (TDD)
- Fornada produzida 10, vendida 8, custo 4.43, preço 7.38 → custo 44.30, receita 59.04, lucro 14.74, desperdício 2, taxa 20%.
- Agregação dia: 2 fornadas mesma data somam; planned na mesma data NÃO soma.
- Semana segunda–domingo: fornadas domingo e segunda seguinte caem em semanas distintas.
- Mês: 2026-07-31 e 2026-08-01 em meses distintos.
- Comparação: semana atual lucro 100 vs anterior 80 → +25%; anterior 0 → null.
- Melhor/pior por lucro entre 3 dias.
- Excluir receita → fornada vira órfã, permanece listável (§14.7).
- Confirmar planejada → conta nas agregações.

## Critérios de aceite
- [ ] Fórmulas §14.3 exatas; snapshots nunca recalculados da receita atual.
- [ ] Planned fora dos totais até confirmação (§14.4/14.6).
- [ ] Órfãs íntegras e visíveis (§14.7).
- [ ] Backup (012) passa a incluir o histórico real.

## Referências
- spec §5.D, §6, §14 · date-fns docs (se adotada)

---

## Plano Técnico

### Análise do existente (busca real no código)

- `src/core/types.ts` → `BakeEntry` e `BakeHistorySummary` (linhas 122–151) já existem, fiéis à spec §6/§14.3. Campos derivados de `BakeEntry` (`totalCost`, `totalRevenue`, `totalProfit`, `wastage`, `wastageRate`) e o flag `planned?` já modelados. **Reusar 1:1 — não alterar types.ts** (evita churn de contrato já revisado).
- `src/storage/backup.ts` → `export const BAKES_STORAGE_KEY = 'mp.bakes.v1'` (linha 37) é a **fonte única** da chave. `bakes.ts` (storage) importa daqui (regra de ouro 2). `collectBackupData` (linha 140) e `readBakeHistory` (linha 167) já leem essa mesma chave → **backup passa a incluir o histórico real sem tocar em backup.ts** (satisfaz o critério de aceite 4 por construção).
- `src/storage/recipes.ts` → molde exato do CRUD: `RecipeStoreOptions {storage?, now?, newId?}`, injeção de clock/newId, `readAll/writeAll` com JSON nativo, `reviveDates` dirigido por campo, `structuredClone` para pureza, `newId = crypto.randomUUID`. `bakes.ts` (storage) espelha esse padrão (regra de ouro 2).
- `src/storage/local.ts` → `StorageLike`, `createMemoryStorage`, `defaultStorage`. **Reusar** para injeção e testes em `node` sem jsdom.
- `src/core/validation.ts` → `validateQuantitySold` (§5.D), `validateQuantityProduced`, `validateBakeDate(date, today)` (§14.6) já prontos; `today` injetado, comparação por `formatDate` lexicográfica (sem UTC). **Validação de fornada já é da 010 — bakes.ts NÃO revalida**; storage confia no dado cru (mesma disciplina de recipes.ts).
- `src/core/format.ts` → `formatDate(date)` = `aaaa-mm-dd` com getters **locais** (não UTC). **Reusar como derivador de chave de dia/mês** (dayKey/monthKey) — mesma convenção de fuso que validation.ts, garante coerência com §14.6.
- Precedente do codebase: revivers de data são **locais por módulo** (recipes.ts tem seu `reviveDates`; backup.ts tem `reviveBakeDates` privado). bakes.ts (storage) segue o precedente com `reviveBakeDate` local (3 linhas triviais) — a chave é que se compartilha, não o reviver.

### Decisão de datas — código próprio sobre `Date` (sem date-fns)

Adotar **código próprio** para agrupar semana/mês. Justificativa (uma linha): agrupar por dia (`formatDate`), mês (`formatDate.slice(0,7)`) e semana segunda–domingo (`mondayOf`: `offset=(getDay()+6)%7`, subtrai dias) é aritmética trivial de ~8 linhas puras sobre `Date` — introduzir date-fns violaria "zero dep nova sem justificativa" para ganho nulo (regra de ouro 1, exceção "trivial"). Doc oficial consultada para fixar a semântica do dia-da-semana (regra de ouro 4): `Date.prototype.getDay()` retorna 0=domingo…6=sábado — https://developer.mozilla.org/en-US/docs/Web/API/Date/getDay ; construção por componentes locais `new Date(y, mIndex, d)` (meia-noite local) — https://developer.mozilla.org/en-US/docs/Web/API/Date/Date . **Chaves derivadas sempre por componentes locais (via `formatDate`)**, nunca UTC, para casar com validation.ts/§14.6 e evitar deslocamento de dia por fuso.

### Assinaturas propostas

`src/core/bakes.ts` (puro, sem DOM/storage; cabeçalho citando §14.3/§14.4/§14.5/§14.6/§14.7):
- Por fornada (§14.3):
  - `bakeTotalCost(unitCost: number, quantityProduced: number): number` → `unitCost × produced`
  - `bakeRevenue(unitSalePrice: number, quantitySold: number): number` → `price × sold`
  - `bakeProfit(revenue: number, totalCost: number): number` → `revenue − totalCost`
  - `bakeWastage(produced: number, sold: number): number` → `produced − sold`
  - `bakeWastageRate(produced: number, sold: number): number | null` → guarda `produced ≤ 0 → null` (contrato null≠0 do codebase, §5.C)
  - `computeBakeDerived(entry: BakeEntry): BakeEntry` → clona e preenche os 5 campos derivados a partir dos snapshots crus (não muta).
- Planejadas (§14.6):
  - `isPlanned(entry: BakeEntry): boolean` → `entry.planned === true`
  - `confirmPlanned(entry: BakeEntry): BakeEntry` → clona e **remove** a chave `planned` (spec "planned é removido"); não muta.
- Agregações (§14.4) — sempre `filter(e => !isPlanned(e))` ANTES de somar:
  - `aggregatePeriod(entries: BakeEntry[], periodStart: Date, periodEnd: Date): BakeHistorySummary` → soma produced/sold/cost/revenue/profit; `wastageRate = totalWastage/totalProduced×100` (guarda ÷0→0); `averageProfitMargin = totalProfit/totalRevenue×100` (guarda ÷0→0).
  - `groupByDay(entries): BakeHistorySummary[]` (key `formatDate`), `groupByWeek(entries): BakeHistorySummary[]` (key `formatDate(mondayOf(date))`), `groupByMonth(entries): BakeHistorySummary[]` (key `formatDate.slice(0,7)`); ordenados por `periodStart` asc; cada bucket delega a `aggregatePeriod`.
- Filtros (§14.5):
  - `filterByRecipe(entries: BakeEntry[], recipeId: string): BakeEntry[]`
  - `filterByDateRange(entries: BakeEntry[], start: Date, end: Date): BakeEntry[]` → inclusivo, compara por `formatDate` (lexicográfico, sem fuso).
- Comparação (§14.5):
  - `percentVariation(current: number, previous: number): number | null` → `previous === 0 → null`; senão `(current − previous)/previous×100`.
  - `comparePeriods(current: BakeHistorySummary, previous: BakeHistorySummary): PeriodComparison` (novo tipo LOCAL em bakes.ts: `{ producedVariation, soldVariation, costVariation, revenueVariation, profitVariation: number|null }`), cada campo via `percentVariation`.
- Melhor/pior (§14.5):
  - `bestPeriod(summaries: BakeHistorySummary[]): BakeHistorySummary | null` → max `totalProfit`, vazio→null, empate→primeiro.
  - `worstPeriod(summaries: BakeHistorySummary[]): BakeHistorySummary | null` → min `totalProfit`.
- Órfãs (§14.7):
  - `isOrphan(entry: BakeEntry, existingRecipeIds: ReadonlySet<string>): boolean` → `!existingRecipeIds.has(entry.recipeId)` (para a UI sinalizar "receita não existe mais"; a preservação em si é estrutural — sem cascade).
- Helper interno `mondayOf(date: Date): Date` (não exportado ou exportado para teste): componentes locais, `(getDay()+6)%7`.

`src/storage/bakes.ts` (CRUD, espelha recipes.ts; cabeçalho §6/§10/§14.7):
- `import { BAKES_STORAGE_KEY } from './backup'` (fonte única da chave).
- `interface BakeStoreOptions { storage?: StorageLike; now?: () => Date; newId?: () => string }`
- `interface BakeStore { list(): BakeEntry[]; get(id): BakeEntry|undefined; listByRecipe(recipeId): BakeEntry[]; create(seed): BakeEntry; update(entry): BakeEntry; remove(id): void; replaceAll(entries): void }`
- `createBakeStore(opts)` → `readAll/writeAll` JSON nativo; `reviveBakeDate` local (só `date`); `structuredClone` na entrada/saída; `newId = crypto.randomUUID` (fallback injetável); persiste **cru** (não recalcula derivados — §1.6 é do core). `remove` filtra só por `id` — **nunca** cascade por `recipeId` (§14.7).

### Cenários (números concretos)

- **Caminho feliz (§14.3, gabarito do issue)**: produzida 10, vendida 8, unitCost 4,43 (= unitCost golden §12), preço 7,38 → totalCost **44,30**; revenue **59,04**; profit **14,74**; wastage **2**; wastageRate **20%**.
- **Borda ÷0**: `bakeWastageRate(0, 0) → null`; `aggregatePeriod` de período sem receita → `averageProfitMargin 0`, `wastageRate 0` (não NaN).
- **Planned fora**: 2 fornadas mesma data + 1 `planned:true` mesma data → agregação do dia soma só as 2.
- **Fronteira semana**: `new Date(2026,6,12)` (domingo) e `new Date(2026,6,13)` (segunda) → semanas distintas (`mondayOf` = 2026-07-06 vs 2026-07-13). Verificado: 2026-07-12=domingo, 2026-07-13=segunda.
- **Fronteira mês**: `new Date(2026,6,31)` e `new Date(2026,7,1)` → chaves "2026-07"/"2026-08" distintas.
- **Comparação**: lucro atual 100 vs anterior 80 → `+25`; anterior 0 → `null`.
- **Órfã**: bake com `recipeId='r1'`; após `recipeStore.remove('r1')`, `bakeStore.list()` ainda contém a bake com `recipeName` snapshot; `isOrphan(bake, new Set())===true`.
- **Confirmação**: `confirmPlanned(entry)` sem `planned` → passa a contar em `aggregatePeriod`.

### Testes primeiro (Vitest — escrever ANTES da implementação)

`src/core/bakes.test.ts`:
1. `computeBakeDerived`: produzida 10/vendida 8/custo 4,43/preço 7,38 → totalCost 44,30, revenue 59,04, profit 14,74, wastage 2, wastageRate 20 (`toBeCloseTo`).
2. `bakeWastageRate(0,0) → null` (guarda ÷0).
3. `computeBakeDerived` não muta a entrada (pureza).
4. `groupByDay`: 2 fornadas mesma data somam produced/cost/revenue; 1 `planned:true` mesma data NÃO entra.
5. `aggregatePeriod` ignora `planned:true` em todos os campos.
6. `groupByWeek`: domingo 2026-07-12 e segunda 2026-07-13 → 2 buckets, `periodStart` 2026-07-06 e 2026-07-13.
7. `groupByMonth`: 2026-07-31 e 2026-08-01 → 2 buckets ("2026-07"/"2026-08").
8. `filterByRecipe`: separa `recipeId`.
9. `filterByDateRange` inclusivo nas bordas (start/end contam).
10. `percentVariation(100,80) → 25`; `percentVariation(50,0) → null`.
11. `comparePeriods` produz variações por métrica + `null` quando anterior 0.
12. `bestPeriod`/`worstPeriod` entre 3 dias de lucros distintos (empate→primeiro; vazio→null).
13. `confirmPlanned` remove `planned` e a fornada passa a contar em `aggregatePeriod`.
14. `isOrphan(entry, new Set())===true`; com id presente → `false`.
15. `aggregatePeriod` de lista vazia → summary zerado sem NaN.

`src/storage/bakes.test.ts` (backend `createMemoryStorage`, clock/newId injetados — molde recipes.test.ts):
16. `create → list` tem 1; `get` deep-equal; `date` é `Date`.
17. round-trip: novo store no mesmo backend revive `date` como `Date` (getTime igual).
18. `update` altera campo, persiste; `remove` some da lista.
19. `listByRecipe` filtra por `recipeId`.
20. **Órfã (§14.7)**: bake com `recipeId='r1'` + `recipeStore.remove('r1')` → `bakeStore.list()` mantém a bake com `recipeName` snapshot (dois stores no mesmo backend; sem cascade).
21. lixo no storage / chave ausente → `list()=[]` sem throw.
22. pureza: `create` não muta seed; retorno não é a referência guardada.

### Arquivos a criar
- `src/core/bakes.ts`
- `src/core/bakes.test.ts`
- `src/storage/bakes.ts`
- `src/storage/bakes.test.ts`

### Arquivos a modificar
- Nenhum. (`types.ts` já tem `BakeEntry`/`BakeHistorySummary`; `backup.ts` já lê `BAKES_STORAGE_KEY` — critério de aceite 4 satisfeito sem edição.)

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts` (contrato §6 já revisado; sem novos campos).
- `src/storage/backup.ts` (seam e leitura já corretos; só é importado).
- `src/core/validation.ts` (validações §5.D/§14.6 já são da 010; bakes não revalida).
- `src/storage/recipes.ts`, `local.ts`, demais core (`format.ts` só importado, não alterado).
- `spec/`, `mockups/`, `references/` (fonte da verdade / fora de escopo core).

### Ordem de implementação
1. `src/core/bakes.test.ts` (casos 1–15, red).
2. `src/core/bakes.ts` — fórmulas §14.3, depois `mondayOf`/chaves, agregações com planned fora, filtros, comparação, melhor/pior, `confirmPlanned`, `isOrphan` (green).
3. `src/storage/bakes.test.ts` (casos 16–22, red) — importar `BAKES_STORAGE_KEY` de backup.ts.
4. `src/storage/bakes.ts` — CRUD espelhando recipes.ts, sem cascade (green).
5. Rodar suíte completa + build Vite; conferir que backup (012) agora exporta histórico real gravado por bakes.ts.

### Decisão de spec a registrar (revisor humano)
- `averageProfitMargin`/`wastageRate` do período calculados como **agregado ponderado** (`totalProfit/totalRevenue`, `totalWastage/totalProduced`), não média aritmética simples das % por fornada — leitura de "média **do período**" (§14.4) como margem/taxa global do período; evita distorção por fornadas pequenas. Flag para confirmação.
