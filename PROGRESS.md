# PROGRESS — Calculadora de Pão com Fermento Natural (v5)

> Log de iterações concluídas. Mantido pelo agente `escriba`. Topo da página: seção "Decisões da noite" acumulando toda interpretação de spec tomada de forma autônoma — é o que o humano revisa de manhã.

## Decisões da noite

**2026-07-05 (issue 013 — histórico de fornadas)**

1. **wastageRate/averageProfitMargin do período = agregado ponderado, não média aritmética das % por fornada**: spec §14.4 diz "média", leitura defensável. Solução implementada: wastageRate = totalWastage/totalProduced × 100 (taxa global do período), averageProfitMargin = totalProfit/totalRevenue × 100 (margem global do período). Motivo: sincronização com BakeEntry.totalCost (§14.3 é snapshot do tempo de confirmação) — somar custo/receita de período requer ponderar por volume, não média direta das %/fornada. Decisão adotada no código; revisor humano confirmar se alinha à intenção.

2. **Datas de agrupamento 100% locais via formatDate — UI 017/018 NÃO deve gravar date como ISO UTC meia-noite**: agrupador genérico groupBy usa formatDate (getters locais, sem toISOString). Chaves lexicográficas aaaa-mm-dd são strings comparáveis (§14.5 levanta "comparação métrica-a-métrica"). Sem date-fns — operações triviais (~8 linhas) em Date puro (new Date(y, mIndex, d) = meia-noite local, getDay() nativo). MDN consultada. Bloqueio de implementação: UI 017/018 deve receber `date` local do padeiro, nunca UTC deslocado. Quando entregar BakeEntry, usar a data do input sem conversão.

3. **Sem date-fns — agrupamento trivial ~8 linhas, MDN getDay citada**: mondayOf, groupBy, groupByDay/Week/Month são ~40 linhas puras, sem lib. `date-fns` seria nova devDependency para lógica trivial. Motivo: regra de ouro 1/2 (libs consolidadas para não-trivial; reuso total). A aritmética de Date aqui não é complexa — getDay()%7 offset, new Date(y, m±1, d) para bordas. Link MDN documentado no cabeçalho do arquivo.

---

## Iteração 013 — 2026-07-05 ~04:05 (histórico de fornadas)

| Campo | Valor |
|-------|-------|
| **Issue** | 013-bakes-history |
| **Timestamp** | 2026-07-05 04:05 |
| **O que foi feito** | src/core/bakes.ts: 16 funções puras orquestrando histórico (spec §14.3–§14.7). Por-fornada: bakeTotalCost/bakeRevenue/bakeProfit/bakeWastage/bakeWastageRate (guarda ÷0→null per-unidade); computeBakeDerived (clona + preenche 5 derivados, §14.3). Planejadas (§14.6): isPlanned, confirmPlanned (deleta chave planned, passa a contar). Agregações (§14.4): aggregatePeriod (filtra planned antes de somar; wastageRate/averageProfitMargin = agregados PONDERADOS do período com guarda ÷0→0); groupBy genérico + groupByDay/Week/Month (chaves formatDate aaaa-mm-dd lexicográficas, sem date-fns; mondayOf: seg–dom literal). Filtros (§14.5): filterByRecipe, filterByDateRange (inclusivo bordas, formatDate). Comparação (§14.5): percentVariation (anterior 0→null), comparePeriods (métrica-a-métrica). Melhor/pior (§14.5): bestPeriod/worstPeriod por lucro. Órfãs (§14.7): isOrphan (recipeId não existe, SEM cascade delete). Sem DOM, sem localStorage, sem arredondamento (§9), pureza total, Date nativo (MDN getDay). src/storage/bakes.ts: BakeStore CRUD (list/get/listByRecipe/create/update/remove/replaceAll) persistindo BakeEntry[] sob BAKES_STORAGE_KEY (seam de backup.ts, fonte única). Serializa JSON nativo (Date→ISO toJSON), reviver dirigido SÓ date (nunca coage recipeName/notes a Date). State "cru" — sem recalc (core responsabilidade). I/O/tempo injetados (now, newId). **+replaceAll** (backup issue 012 integrada; restauração sem cascade, §14.7). Sem rede, sem secret (§10, §11.1). src/core/bakes.test.ts: 16 casos TDD (computeBakeDerived 2, wastageRate 2, isPlanned/confirmPlanned 2, aggregatePeriod 3, groupBy dia/semana/mês 3, filtros 2, variação/comparação 2, best/worst 1, isOrphan 1, pureza 2). src/storage/bakes.test.ts: 7 casos TDD (list/get/listByRecipe 2, create/update 3, remove 1, replaceAll 1). Total 23 testes. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: bakes.test.ts core (16) + bakes.test.ts storage (7) + toda suíte (sourdough 12 + recipes.test 10 + backup 12 + scaling 11 + recalc 8 + bakers 22 + costs 13 + pricing 18 + hydration 14 + prefs 3 + format 23 + validation 15 + golden 5) = **189 total**. **Pass: 189. Fail: 0.** 🟢 Build Vite: verde. Gates: testes 189/189 ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado com **1 achado médio + 2 baixos** (diferidos para issue fix 021): (a) **bucket-fantasma em groupBy**: quando key inicia no dia 1 da semana mas period.start calcula segunda anterior (não cobrida por nenhuma fornada), buckets.entries() não contém a chave — benign (summaries lista apenas períodos com fornadas reais). Flag para clareza UI (017): "última semana" pode ter boundary sem dados. (b) **fmt duplicado em teste** (src/storage/bakes.test.ts linha ~30, data hardcoded 2026-07-05 sem usar formatDate helper — menor, caso de uso claro mas não-reusável). (c) **Confirmação humana: leitura "média" §14.4 como agregado ponderado**: spec diz "média", implementação usa taxa global (totalWastage/totalProduced, totalProfit/totalRevenue). Sem contradição textual, mas cliente deve validar intenção. Todos 3 aprovados, bloqueadores 0. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em bakes.ts (§14.3/§14.4/§14.5/§14.6/§14.7, MDN Date/getDay links), bakes.test.ts (both core + storage). Reuso total: computeBakeDerived reusa funções unitárias (bakeTotalCost/Revenue/Profit/Wastage/WastageRate); aggregatePeriod filtra isPlanned(e) antes de somar (reutiliza predicate); groupBy agrupador genérico (reusado 3×); filterByDateRange delega formatDate (format.ts); comparePeriods reutiliza percentVariation. Backup integrada: backup.ts exporta BAKES_STORAGE_KEY (fonte única), storage/bakes.ts importa e usa, collectBackupData sabe somar histórico real (sem corrupção). Mapa de módulos será atualizado agora. |

---

**2026-07-05 (issue 012 — backup/restauração)**

1. **RESTAURAÇÃO = SUBSTITUIÇÃO TOTAL**: leitura literal de "restaurar" (§10) — o backup é o novo estado, receitas/histórico anteriores são descartados (sem merge). applyBackupData → replaceAll em recipes.ts + escrita direta de BAKES_STORAGE_KEY. Sem UX de "manter dados atuais" — nesse momento não existe. Revisor humano confirmar.

2. **Seam temporário BAKES_STORAGE_KEY exportado**: backup.ts define `export const BAKES_STORAGE_KEY = 'mp.bakes.v1'` (fonte única). Issue 013 importa daqui e pluga o store real de fornadas. Até lá, backup lê/escreve direto no storage keyed (readBakeHistory defensiva, sem crash).

3. **Validação ANTES de qualquer escrita**: importBackup valida envelope completo (app id, schemaVersion, arrays presentes) ANTES de mexer em nada. Só applyBackupData toca storage/store — e só se importBackup retornar. Por construção: falha de import nunca corrompe estado (testado caso 11).

4. **showCosts (pref) fora do backup**: backup.ts não persiste prefs.showCosts — backup é dados do usuário (receitas + histórico de fornadas §10, §11.2), não preferência de UI. Issue 017 (UI) carrega prefs via prefs.ts após restauração (sem reset acidental ao ligar o app).

---

**2026-07-05 (issue 011 — storage receitas)**

1. **Interface StorageLike própria + stub em memória em vez de happy-dom/jsdom**: Vitest roda em `node` (default), zero dependência nova. createMemoryStorage() cobre testes sem jsdom (regra de ouro 1/2/4: deps consolidadas + reuso + zero deps extras). localStorage acessado uma única vez (local.ts); recipes.ts/prefs.ts recebem StorageLike injetado.

2. **Storage NÃO limpa nem recalcula derivados no save/load — persiste tal-qual**: recipes.ts serializa estado COMPLETO (ingredientes, sourdough, modos, pricing) via JSON nativo (Date→ISO via toJSON); reviver dirigido SÓ reativa createdAt/updatedAt (nunca coage strings arbitrárias a Date). Recalc é do core recalculate (§1.6). Conseq: uma receita carregada é entregue "cru"; UI ou core (issue 016/020) decide se valida/recalcula. Revisor humano: conferir se é aceitável persistir estado sem derivados.

3. **crypto.randomUUID exige secure context — OK localhost/HTTPS, quebra em file:// (newId injetável permite fallback)**: newId() é função injetada em createRecipeStore (interface RecipeStoreOptions), padrão usa crypto.randomUUID (§10 offline, no browser). Fallback simples em testes: `() => 'uuid-' + Math.random()` (não criptograficamente seguro, mas determinístico). Issue 016 (UI) decide se instancia newId padrão ou custom para ambiente especial (ex.: file:// debug).

4. **priceInputMode round-trips dentro de Recipe.pricing, não é pref global**: Pricing.priceInputMode (novo em issue 008) persiste junto com cada receita. Não é toggle global como showCosts (prefs.ts). UI 016 deve restaurar modo ao carregar a receita (recipes.get(id) devolve completo).

---

**2026-07-05 (issue 010 — validações §5)**

1. **Contrato ValidationResult = ValidationIssue|null (null=OK)**: bloqueio (reverte/impede UI) ⇒ valid:false, level:'block'; aviso (permite valor, sinaliza) ⇒ valid:true, level:'warn'. null significa "tudo OK, nada a reportar" — alinhado ao core (issue 005/006 retornam `number|null` para ÷0 defensivo; aqui null ≠ 0 ≠ erro, é "sem mensagem"). UI 014/016/018 deve tratar null como estado válido silencioso e checar `if (issue) { ... }` antes de exibir.

2. **today injetado em validateBakeDate, nunca new Date() interno**: validateBakeDate recebe `today: Date` como parâmetro (caller calcula `new Date()`), preservando pureza e determinismo total (sem I/O interno). Garante testes previsíveis (fixture today=2026-07-05, valida 2026-07-04=passado/OK, 2026-07-06=futuro/warn, 2026-07-05=hoje/OK). Sem mudança de assinatura no engine; recalculate não toca em histórico (§14.6 é responsabilidade de issue 011/012 storage).

3. **Validação sobre valor CRUS, nunca sobre arredondado de exibição**: validatePercentageSum recebe `percentages: number[]` (pesos reais em precisão total, nunca formatCurrency/formatPercent de §9), compara com SUM_EPSILON 1e-9 (dono em bakers.percentagesSumTo100). Motivo: divergência de epsilon — se UI arredondar para 2 casas (60,00+40,00=100,00 exato) mas core calcular 60,0001+39,9999=100,0000, validação cai diferente. Bloqueio: validar ANTES de arredondar; exibição de % nunca sinaliza se soma válida ou não (é contrato da entrada).

4. **Partes 0:0:1 passa validateSourdoughParts mas warn em validateSourdoughFlourPart**: `isValidSourdoughParts({isca:0, flour:0, water:1})` retorna true (SomaPartes=1>0, todas≥0 § §5.B literal). Mas `validateSourdoughFlourPart(0, 'fermento')` retorna warn (mínimo 1 farinha recomendado §5.B, literal "pelo menos 1 farinha em cada grupo"). UI chama AS DUAS — primeira passa guarda, segunda avisa sobre composição sem farinha (edge case defensivo: fermento só com água é inviável biologicamente, mas não bloqueado por §5.C; issue 011 em histórico pode avisar ao gravar "fornada com fermento 0% farinha").

---

## Iteração 012 — 2026-07-05 ~03:50 (backup/restauração)

| Campo | Valor |
|-------|-------|
| **Issue** | 012-backup-restore |
| **Timestamp** | 2026-07-05 03:50 |
| **O que foi feito** | src/storage/backup.ts: 2 funções puras (exportBackup — monta envelope {app 'minhapadaria', schemaVersion 1, exportedAt ISO §7.1, recipes, bakeHistory} e serializa JSON nativo; importBackup — valida ANTES de qualquer escrita, revive datas dirigidas, throw pt-BR em erro); 2 orquestradores (collectBackupData — reúne recipes via recipeStore.list() + bakeHistory de seam mp.bakes.v1; applyBackupData — SUBSTITUIÇÃO TOTAL via replaceAll + setItem). 2 helpers DOM browser-only sem wiring node: downloadBackupFile (Blob→objectURL→<a download>→revoke §7.1 aaaa-mm-dd); readBackupFile (FileReader Promise). Reviver dirigido (só createdAt/updatedAt de Recipe/BakeEntry, nunca eval §11.1, decisão 11). src/storage/recipes.ts: **+replaceAll** (preserva id/datas, delega writeAll — mínima extensão). src/storage/backup.test.ts: 12 testes TDD (exportBackup 3: vazio+clock+pureza, import 3: round-trip+JSON ruim+sem envelope+versão, applyBackupData 2: substituição+coleta, estado intacto 2: falha não corrompe+bakeHistory ausente→[]). Zero rede, zero secret, validação antes de escrita (por construção, testado), sem DOM em node. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: backup.test.ts (12) + recipes.test.ts (10) + prefs.test.ts (3) + validation.test.ts (15) + recalc.test.ts (9, +1 per-unit) + scaling.test.ts (11) + pricing.test.ts (18) + costs.test.ts (13) + hydration.test.ts (14) + sourdough.test.ts (12) + bakers.test.ts (22) + format.test.ts (23) + golden-example.test.ts (5 asserts) = **166 total**. **Pass: 166. Fail: 0.** 🟢 Build Vite: verde. Gates: testes 166/166 ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados. **ZERO ACHADOS** (primeira issues 012 100% verde desde o início). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em backup.ts (§10/§11.2/decisão 11/§7.1) e backup.test.ts. Reuso total: collectBackupData delega recipeStore.list() (não reimplementa); applyBackupData delega replaceAll (extensão mínima recipes.ts); readBakeHistory defensiva como prefs.ts. Seam BAKES_STORAGE_KEY exportado de backup.ts — issue 013 importa e pluga store real. Mapa de módulos será atualizado agora. |

---

## Iteração 011 — 2026-07-05 ~03:35 (storage receitas)

| Campo | Valor |
|-------|-------|
| **Issue** | 011-storage-recipes |
| **Timestamp** | 2026-07-05 03:35 |
| **O que foi feito** | src/storage/local.ts: interface StorageLike (subconjunto Web Storage API: getItem/setItem/removeItem); createMemoryStorage (Map, testes sem jsdom); defaultStorage (acessor único ao localStorage real, só aqui). src/storage/recipes.ts: createRecipeStore (CRUD list/get/create/update/rename/duplicate/remove) persistindo Recipe[] sob chave mp.recipes.v1 (versionada). Serializa JSON nativo (Date→ISO toJSON); reviver dirigido SÓ createdAt/updatedAt, nunca coage strings usuário a Date. Recipe carregada é "crua" — derivados (hidratação, custos, preço) não recalculados na carga (§1.6); UI issue 016 ou smoke issue 020 decidem validação/recalc. I/O tempo injetados (clock, newId): createRecipeStore recebe RecipeStoreOptions = {storage?, now?, newId?} para determinismo teste. newId padrão = crypto.randomUUID (secure context localhost/HTTPS, quebra file://; fallback injetável). src/storage/prefs.ts: createPrefsStore persistindo toggle showCosts (pref global única §2.A.2, não per-receita) sob chave mp.prefs.v1. Default false (custos ocultos), JSON corrompido/ausente → default sem crash, sem eval. Zero rede, zero secret (§10, §11.1, regra de ouro 3). src/storage/*.test.ts: 13 testes TDD (recipes 10 casos: list/get/create/update/rename/duplicate/remove/round-trip reviver/pureza/newId; prefs 3 casos: default/set/persist). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: recipes.test.ts (10) + prefs.test.ts (3) + toda suíte core (validation 15 + recalc 8 + scaling 11 + pricing 18 + costs 13 + hydration 14 + sourdough 12 + bakers 22 + format 23 + golden 5) = **154 total**. **Pass: 154. Fail: 0.** 🟢 Build Vite: verde. Gates: testes 154/154 ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado. **ACHADO DIFERIDO PARA REVISOR HUMANO** (registrado em "Decisões da noite" acima): (a) critério "zero rede" não tem teste dedicado — estruturalmente verificado (storage recebe StorageLike injetável, nenhuma fetch/XHR em código, sem observable side-effects). Cobertura automatizada fica no smoke da issue 020 (validar que app roda offline). (b) crypto.randomUUID fallback; (c) storage persiste estado cru sem derivados. Sem demais achados. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em todos os 5 arquivos novos (local.ts §10, recipes.ts §2.F/§6/§10, prefs.ts §2.A.2/§10, recipes.test.ts, prefs.test.ts). Reuso total: StorageLike é predicate minimalista (3 métodos); recipes.ts/prefs.ts reusam StorageLike/defaultStorage sem duplicar acesso ao browser; both recebem injeção de clock/newId. Não recalcula derivados (§1.6 responsabilidade core). Mapa de módulos será atualizado agora. |

---

## Iteração 010 — 2026-07-05 ~03:25 (validações §5)

| Campo | Valor |
|-------|-------|
| **Issue** | 010-validation |
| **Timestamp** | 2026-07-05 03:25 |
| **O que foi feito** | src/core/validation.ts: 13 funções puras (validatePercentageSum — bloqueia soma ≠ 100% §5.A; validateFlourCount — mínimo 1 farinha por grupo §5.B; validateProductQuantity — ≥ 1 §5.C; validateNonNegative — ingrediente peso ≥ 0 §5.C; validateSourdoughParts — guarda SomaPartes>0 e partes≥0, reusa isValidSourdoughParts; validateSourdoughFlourPart — aviso se farinha=0 no grupo §5.B; validateSourdoughProportion — aviso se %fermento fora [0, 100] §5.C; validateMargin — aviso faixa [0, 99.9] §5.C; validatePriceVsUnitCost — bloqueia se prejuízo §5.C, reusa isLoss; validatePackageSize — bloqueia se ≤ 0 §5.C; validateQuantityProduced — ≥ 1 §5.C; validateQuantitySold — ≥ 0, aviso se > produzida §5.D; validateBakeDate — aviso se futuro §14.6; todos puros, today injetado, valor cru nunca arredondado). Contrato ValidationResult = ValidationIssue|null (null=OK, bloqueia level:'block' valid:false, aviso level:'warn' valid:true). Sem DOM, sem localStorage, sem rede, pureza total (§5/§14.6/§7.1/§10/§11.1). src/core/validation.test.ts: 15 casos TDD cobrindo regras 5.A/5.B/5.C/5.D/14.6; soma percentagem, count farinhas, quantidades, partes sourdough, proporção fermento, margem, prejuízo, tamanho embalagem, quantidade produzida/vendida, data fornada; includes golden §12 nas bordas; nenhuma redistribuição/mutação (§5.A garantido por teste). Gates: testes 141/141 verde (novos 15 casos + suíte existente 126); build Vite verde. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: validation.test.ts (15 novos) + recalc.test.ts (8) + scaling.test.ts (11) + pricing.test.ts (18) + costs.test.ts (13) + hydration.test.ts (14) + sourdough.test.ts (12) + bakers.test.ts (22) + format.test.ts (23) + golden-example.test.ts (5 asserts) = 141 total. **Pass: 141. Fail: 0.** 🟢 Build Vite: verde. Gates: testes 141 pass ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados estruturais no código da issue 010 (validation.ts/test.ts fielmente §5/§14.6). Contrato ValidationResult null=OK aprovado (alinha core issues 005/006). **DECISÕES DIFERIDAS PARA REVISOR HUMANO** (registradas em "Decisões da noite" acima): (a) ValidationResult null vs block/warn; (b) today injetado; (c) validação valor cru; (d) 0:0:1 passes guarda, warns em flour-part. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em validation.ts (§5.A/§5.B/§5.C/§5.D/§14.6/§7.1, §10/§11.1) e validation.test.ts. Reuso total: validatePercentageSum delega percentagesSumTo100 (bakers.ts dono); validateSourdoughParts reusa isValidSourdoughParts (sourdough.ts); validatePriceVsUnitCost reusa isLoss (pricing.ts); validateSourdoughFlourPart usa validateFlourCount; validateBakeDate usa formatDate (format.ts para parsing ISO 8601 pt-BR). Nenhuma função redistribui % ou normaliza entrada (§5.A literal); todas retornam null ou {valid, level, message}. Alinhamento futuro: UI 014/016/018 devem tratar null como silencioso (OK) e checar type guard `if (issue) { show(...) }` antes de exibir. Mapa de módulos será atualizado agora. |

---

**2026-07-05 (issue 009 — escalonamento + per-unit)**

1. **peso→% NORMALIZA batchPlanningMode para 'total'**: quando recalculate detecta modo 'weight-to-percentage' em state.batchPlanningMode='per-unit', força a 'total' (linha 78 recalc.ts). Alternativa seria ignorar silenciosamente e derivar F_total das farinhas de qualquer forma. Motivo: §2.E.1 diz "planejamento por unidade só em %→peso"; peso→% é implicitamente planejamento em lote inteiro. Decisão: reescrever o campo e deixar claro que modo é 'total' — evita UI inconsistente (campo exibindo 'per-unit' quando F_total vem de Σ pesos, §3.A). Revisor humano: conferir se esta normalização silenciosa é aceitável ou deve-se avisar/bloquear.

2. **applyTargetScaling retorna Recipe|null (não muta, não throws)**: escalonamento por alvo é ação explícita (§1.6) que pode falhar (alvo ≤ 0, soma ≤ 0 → divisão impossível). Retorna null em caso de guarda falhar (contrato null≠0, issues 004–008); o caller deve checar antes de re-alimentar recalculate. Sem throw. Motivo: contrato defensivo alinhado a toda a suite (§5.C). UI 016 deve tratar null (ex.: desabilitar botão ou mostrar alerta).

3. **Em per-unit, N = pricing.quantity e divide o mesmo N**: applyTargetScaling(per-unit) recalcula fluorPerUnit = F_nova / N onde N vem de effectiveQuantity(state.pricing.quantity) — linha 73 scaling.ts. effectiveQuantity já guarda N ≥ 1 (evita ÷0). Precificação (issue 007) também usa o mesmo N via unitCost. Motivo: sincronização — uma única âncora N para escalonamento e preço. Quando N muda (UI 016), tanto F_unit quanto unitCost refazem via recalculate.

4. **recipeSumPercent INCLUI fermento (decisão 3 antiga, reconfirmada)**: a proporção do fermento entra na soma (§3.D passo 1). Golden §12: 100+70+2+20 = 192 (não 172). O fermento é parte da receita, não uma sub-célula isolada. Reuso: recipeSumPercent centraliza esta regra; scaledFlourTotal (passo 2) reusa sem duplicar.

---

**2026-07-05 (issue 008 — recalc engine)**

1. **types.ts diverge da spec §6 — DESTAQUE PARA REVISOR HUMANO**: campos derivados HydrationSummary/RecipeSummary alargados para `number | null` (contrato PROGRESS-005/006 decide null ≠ 0 ≠ erro). Exemplo: `realHydration?: number | null` (nil se ÷0 defensivo), `realFlourConsumed: number` (sempre). Sem mapeamento auto de undefined→0 no engine. Motivo: preservar contrato null-vs-0; consumidores (UI issue 016) decidem exibição.

2. **Pricing.priceInputMode é campo novo de modelo**: nova chave `'sale-price' | 'margin' | 'profit'` em Pricing.ts §6 extensão. Engine recalc respeitou 3 modos isolados (recalculate não força modo); storage 011/012 e UI 016 devem persistir/definir este campo. Motivo: contrato de issue 007 (precificação 3-modos) requer persistência; tipos refletem realidade.

3. **Denominador do modo peso→% INCLUI W_ferm (fermento)**: spec §1.3 ("total geral da massa") + §3.D nota ("o peso do fermento conta como parte do peso final da massa"). Fórmula: `% = peso / (Σ pesos ingredientes + W_ferm) × 100`. Fixture do teste: farinhas 800+200 + água 700 + sal 20 + W_ferm 200 = **1920**. O exemplo trabalhado do plano usava 1720 (lapso: omitia W_ferm da própria fórmula); revisor-spec confirmou 1920 como correto — só com W_ferm no denominador as proporções somam exatamente 100%.

4. **recalc assume batchPlanningMode 'total' permanentemente**: issue 008 implementou engine para modo 'total' (toda fornada). Per-unit é extensão blocada na issue 009 (calculadora multi-unidade). Motivo: spec §1.2 assume total; mudanças de modo requerem bloquear entrada diferente, issue 009 decide. Engine puro respeitou premissa (recalculate valida batchPlanningMode='total' ou null-safe-returns).

---

## Iteração 009 — 2026-07-05 ~03:10 (escalonamento + per-unit)

| Campo | Valor |
|-------|-------|
| **Issue** | 009-scaling-per-unit |
| **Timestamp** | 2026-07-05 03:10 |
| **O que foi feito** | src/core/scaling.ts: 3 funções puras (recipeSumPercent — Σ %ingredientes + %fermento, fermento ENTRA soma decisão 3; scaledFlourTotal — F_nova = W_alvo/(SomaReceita%/100) §3.D passo 2, guardas null; applyTargetScaling — ação explícita §1.6 retorna Recipe clonada ou null, suporta âncoras 'total' (reescreve flourTotalWeight) e 'per-unit' §2.E.1 (reescreve flourPerUnit = F_nova/N, N intacto)). scaling.test.ts: 11 its TDD cobrindo golden, fermento 0, validação alvo/soma, escalonamento pesos/per-unit, guards null, pureza. src/core/recalc.ts estendido: detecção per-unit em %→peso (F_total = flourPerUnit × N via effectiveQuantity §2.E.1), peso→% força 'total' e normaliza batchPlanningMode (linha 78–79). src/core/recalc.test.ts: +1 it caso 11 (per-unit sem escalonamento — F_total derivado, pesos ≡ golden, hidratação real/nominal bate §2.E.1). Sem DOM, sem localStorage, precisão total (§1.6/§2.E.1/§3.D/§12). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: scaling.test.ts (11) + recalc.test.ts (8, +1) + pricing.test.ts (18) + costs.test.ts (13) + hydration.test.ts (14) + sourdough.test.ts (12) + bakers.test.ts (22) + format.test.ts (23) + golden-example.test.ts (5 asserts) = 126 total. **Pass: 126. Fail: 0.** 🟢 Build Vite: verde. Gates: testes 126 pass ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados estruturais no código da issue 009 (scaling.ts/recalc.ts). ACHADOS REPORTADOS (3 total, 2 médios, 1 baixo): 2 edições em spec/ (pré-existentes, git status desde início da sessão, nunca staged pelo loop); 1 em mockups/calculadora.html (pré-existente id.). Achados não atribuíveis ao loop (presentes antes de issue 009 começar, confirmados por revisores 002–008, não revertidos por regra "nunca deletar trabalho"). ZERO falhas no core scaling/recalc. |
| **Observações** | Decisões de spec registradas em "Decisões da noite" acima. Cabeçalhos de spec presentes em scaling.ts (§1.6/§2.E.1/§3.D/§12, decisões 3, 16) e scaling.test.ts; recalc.ts anotado sobre extensão per-unit (§2.E.1); recalc.test.ts novo caso comentado. Reuso total: recipeSumPercent simples predicate; scaledFlourTotal usa recipeSumPercent; applyTargetScaling reusa effectiveQuantity (pricing.ts) para N ≥ 1; recalculate orquestra sem duplicar passo 3 (bakers.weightFromPercentage); transitionToPercentageMode inalterado. Mapa de módulos será atualizado agora. |

---

## Iteração 008 — 2026-07-05 ~02:55 (recalc engine)

| Campo | Valor |
|-------|-------|
| **Issue** | 008-recalc |
| **Timestamp** | 2026-07-05 02:55 |
| **O que foi feito** | src/core/recalc.ts: 1 função central `recalculate` orquestrando recálculo em lote de Recipe a partir do estado puro (§1.2/§1.6). Funções puras: (a) modo %→peso — derivar pesos de %; (b) modo peso→% — exibir % como peso/total geral da massa (INCLUI W_ferm denominador correto §1.3); (c) transitionToPercentageMode (§1.5) — converter explicitamente peso→% calculando F_total dos pesos atuais, reusando bakers.weightFromPercentage em marcha-ré; (d) orquestra camadas bakers (§3.A)·sourdough (§3.B)·hydration (§2.C/§2.D)·costs (§3.E)·pricing (§3.E) sem duplicar fórmula; (e) sem DOM, sem arredondamento (§9), sem localStorage, sem rede, pureza total. types.ts: HydrationSummary/RecipeSummary ampliados para `number | null` conforme contrato null-vs-0 (issue 005/006); Pricing.priceInputMode novo (`'sale-price'|'margin'|'profit'`). src/core/recalc.test.ts: 7 casos TDD (modo %→peso, modo peso→%, transição peso→%, idempotência ambos modos, pureza, null defensivo). src/core/golden-example.test.ts substituído por teste real ponta a ponta via `recalculate`: gabarito §12 fixado como contrato permanente (5 asserts: unitCost, salePrice, profitMargin, realHydration, farinha real consumida; antes era placeholder que falhava). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: recalc.test.ts (7) + golden-example.test.ts (5 asserts em 1 suite) + pricing.test.ts (18) + costs.test.ts (13) + hydration.test.ts (14) + sourdough.test.ts (12) + bakers.test.ts (22) + format.test.ts (23) = 114 total. **Pass: 114. Fail: 0.** 🟢 Primeira vez 100% verde da suíte (antes golden-example era 1 fail intencional). Build Vite: verde. Gates: testes 114 pass ✓✓✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados estruturais. Denominador 1920 validado contra §1.3/§3.D (Σ ingredientes + W_ferm; fixture 800+200+700+20+200). types.ts alargamento null aprovado conforme contrato issues 005/006. **ACHADOS DIFERIDOS PARA REVISOR HUMANO** (registrados em "Decisões da noite" acima): (a) types.ts diverge literalmente de spec §6 (campos derivados + null); (b) Pricing.priceInputMode campo novo tipo — storage/UI devem persist; (c) modo peso→% denominador inclui W_ferm (fixture 1920); (d) batchPlanningMode 'total' bloqueado, per-unit issue 009. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em recalc.ts (§1.2/§1.3/§1.5/§1.6/§3.A/§3.B/§3.E/§2.C/§2.D/§9), recalc.test.ts, golden-example.test.ts. Reuso total: recalculate orquestra sem duplicar — bakers.weightFromPercentage/percentageFromWeight, sourdough.computeSourdoughWeights/distributeSourdoughFlourWeights, hydration.*, costs.*, pricing.priceFromMargin/priceFromSalePrice/pricingTotals em 1 função. Idempotência matemática validada (recalc de recalc ≡ recalc). golden §12 agora real: executa receita dourada e valida exatamente valores esperados. Mapa de módulos será atualizado agora. |

---

**2026-07-05 (issue 007 — precificação)**

1. **Inconsistência na spec §3.E linha 232 — DESTAQUE PARA REVISOR HUMANO**: redação diz "CustoTotalProdução = CustoTotalReceita × Qtd", que quebraria o golden §12 (daria 8,86 × 2 = 17,72, e lucro total −2,95 em vez de 5,90). Resolvido conforme golden §12 fonte da verdade: totalProductionCost = unitCost × quantity = 4,43 × 2 = 8,86 (coerente com §14.3 BakeEntry.totalCost, custo por unidade vezes quantidade produzida). Motivo: golden §12 é contrato permanente da suíte; a fórmula literal de §3.E parece confundir CustoTotalProdução com CustoTotalReceita. Sugerir ao cliente: revisar redação de §3.E ou clarificar que totalProductionCost ≠ totalRecipeCost × Qtd.

2. **isLoss usa ≤ (break-even inclusivo, §5.C literal) — §4 contradiz sutilmente**: §5.C diz "aviso quando preço não cobre custo", interpretado como salePrice ≤ unitCost. §4 diz "red quando <15% OU prejuízo", implicando prejuízo strict <. Não bloqueio: ambas leituras são defensivas (aviso sem rejeição). isLoss devolveu ≤ por literalidade de §5.C ("não cobre" inclui empate exato).

3. **Faixas de marginStatus 30/15 literais**: >30 verde, 15–30 inclusive amarelo (leitura literal §4, "15–30" com hífen implica intervalo fechado), <15 ou negativa vermelho. Teste: 30→yellow, 15→yellow (exatitude nos limites, sem fuzzy).

4. **Margem negativa clampada a 0 em modo margem**: §5.C proíbe margem negativa ("margem não pode ser negativa"). priceFromMargin recebe entrada, clampeia via clampMargin(margin) a [0, 99.9]. Resultado devolvido é sempre m = clampmargin(entrada), nunca entra NaN. Sem throw. O clamp garante que profitMargin devolvido = margem saneada (auto-consistente: profit/price = m%).

---

**2026-07-05 (issue 006 — custos)**

1. **Soma compensada de Neumaier em totalRecipeCost/sourdoughCost — NÃO é arredondamento decimal**: elimina drift IEEE-754 acumulado na ordem dos termos (golden §12: 8+0,06+0,8 → 8,86 exato, não 8,860000000000001). Algoritmo de Neumaier (1974), variante do Kahan compensation, implementado em core puro (custo é o domínio) sem lib nova. NÃO viola §9 (arredondamento decimal é só exibição): compensatedSum retorna o mesmo `sum + compensation` exato em precisão total IEEE-754 dupla. Consumidor de totalRecipeCost (issue 008/UI) vê number cru; formatCurrency arredonda só na exibição.

2. **Contrato para issue 008: Recipe.ingredients[] NÃO contém linha de fermento**: custo do fermento entra exclusivamente via `sourdoughCost` (parâmetro de totalRecipeCost), nunca packaged com category própria. Motivo: fermento é sub-receita (§2.B), não um ingrediente comum. Se houvesse linha de fermento em ingredients[], haveria dupla contagem (Isca+Farinha+Água via sourdoughCost + a mesma via ingredients[]). Bloqueia em tipo: Ingredient não tem flag "é fermento", e sourdoughCost só soma FarinhaFerm+ÁguaFerm (Isca sempre fora, §2.B.2).

3. **Distinção null vs 0**: packageSize ≤ 0 → null (bloqueio §5.C, estado inválido); água/óleo @R$0/L → 0 (estado válido, peso×0=0). Consumidores em issue 008/010 não devem colapsar null em 0: null é "cálculo impossível" (UI valida antes); 0 é "contribuição zero legítima" (ex.: água gratuita, sal em peso puro sem custo).

---

**2026-07-05 (issue 005 — hidratação + farinha real)**

1. **Hidratações (nominal, real) retornam number|null (não throw)**: null apenas quando denominador=0 (F_total=0 em nominal; F_total+FarinhaFerm=0 em real). Semelhante a issue 004 (computeSourdoughWeights null em partes inválidas) — interface limpa para recalc engine (issue 008). UI e issue 010 (validações) decidem sinalizar ao usuário. Motivo: bloqueio de ÷0 é tarefa do valor tácito (null), não da assinatura (number), mantém contrato puro.

2. **sourdough=null (sem fermento OU partes inválidas) → ÁguaFerm=FarinhaFerm=0 → Real=Nominal**: tratamento defensivo alinhado a issue 004 (computeSourdoughWeights retorna null em partes inválidas). Aqui, realHydration recebe `sourdough | null` e usa `?? 0` para desdobrá-lo em componentes. UI bloqueia via isValidSourdoughParts antes de tocar em hidratação real; backend nunca força valor, apenas entrega null em denominador 0. Motivo: simplicidade — sem branching em UI, lógica pura.

3. **Borda assimétrica: F_total=0 com fermento>0 → Nominal null, Real numérico**: edge case onde só há fermento (F_total=0 declarado, FarinhaFerm>0 da sub-receita). nominalHydration retorna null (÷0 literal), realHydration retorna número (denominador=FarinhaFerm>0, numerador=ÁguaFerm≥0). Exibição da UI (issue 008/014) decide como sinalizar — possível indicar "hidratação do fermento puro" ou bloquear estado. Motivo: princípio de pureza — sem check `if fermento exists`, função entrega o que as fórmulas mandam.

---

**2026-07-05 (issue 004 — fermento por Partes)**

1. **computeSourdoughWeights retorna null (não throw) em partes inválidas**: guarda defensiva (§5.C). Semelhante a percentageFromWeight (issue 003, F_total ≤ 0 → 0), mantém contrato limpo para recalc em lote issue 008. UI bloqueia via isValidSourdoughParts; backend nunca toca em partes inválidas.

2. **Parte farinha=0 retorna com hydration null (não erro)**: interpretação literal de §5.C (estado inválido ≠ inviável). Se usuario entrar fermento com zero farinha (ex.: 1:0:1 Isca:Farinha:Água), resultado tem flourWeight=0, waterWeight>0, hydration=null. Não bloqueio; UI e issue 010 (validações) decidem se avisar ou rejeitar. Motivo: bloqueia derivação de 0 pelas farinhas (§3.B), preserva pureza.

3. **SUM_EPSILON vive em bakers.percentagesSumTo100, dono único**: issue 003 introduziu percentagesSumTo100 com epsilon 1e-9. Issue 004 importa dela (não reduplica). flourPercentagesSumTo100 delega a percentagesSumTo100 (refactor bakers.ts/bakers.test.ts: +2 novos testes 21–22). Mesma tolerância vale para sourdoughFlourPercentagesSumTo100 (§2.B.3).

---

**2026-07-05 (issue 003 — baker's percentage)**

1. **percentageFromWeight retorna 0 quando F_total ≤ 0, não null**: guarda de divisão por zero (§5.C) mantém assinatura `number` limpa. UI futura (issue 008) pode distinguir "indefinido" (F_total=0) de "valor calculado" na exibição, sem mudar tipo. Afeta issue 008 (recalc em lote): percentageFromWeight permanece `number → number`, contrato preservado.

2. **flourPercentagesSumTo100 usa epsilon 1e-9 (SUM_EPSILON), não arredondamento**: tolerância anti-drift IEEE-754 (ex.: 33,33+33,33+33,34 pode não somar exato 100 em binário). Epsilon NÃO é caixa de arredondamento §9. Issues 010 (bloqueio de UI) e 014 (validação) devem alinhar critério de comparação: usar same epsilon ou definir novo? Registrado para revisão.

3. **Farinhas do fermento (§2.B) nunca entram na lista principal com category 'flour'**: premissa estrutural respeitada em bakers.ts (flourTotal só soma category='flour'). Issues 004 (gerenciar fermento) e 008 (recalc engine) devem preservar: fermento é sub-receita com own Ingredient[], não linha com category='flour'. Trata a linha do fermento como genérica (§2.A.2), sem caso especial.

---

**2026-07-05 (issue 002 — types + formatação)**

1. **roundingMode via tipo local NumberFormatOptionsWithRounding**: ES2022 do TS não declara `roundingMode` em `Intl.NumberFormatOptions`, apesar do runtime Node 24 suportá-la. Decisão: estender o tipo localmente em format.ts sem alterar tsconfig (fora de escopo). Valor 'halfExpand' (default do Intl, half-up em todo domínio do app) documentado explicitamente para blindar §9 contra mudanças futuras de default. Motivo: auto-documentação + clarity sem deps extras.

2. **parseDecimal rejeita entrada com múltiplos separadores decimais**: "1.234,5" (dígito + ponto + vírgula) retorna null. Leitura literal de §7.1 ("vírgula OU ponto"). Caso de uso: UI pode validar em tempo real e prevenir user error. Achado diferido para revisor-spec avaliar se milhar digitado (ex.: "1.234") precisa de suporte — por enquanto, rejeita.

3. **formatCurrency com useGrouping true, demais sem**: convenção pt-BR para moeda é separador de milhar ("R$ 1.234,56"). Decisão: apenas formatCurrency usa `useGrouping: true`; formatPercent, formatWeight, formatCostPerGram usam `false` para não quebrar §12 (gabarito "1041,7", não "1.041,7"). Motivo: preservar fidelidade gabarito + convenção moeda.

---

**2026-07-05 (issue 001 — scaffold)**

1. **Caminhos relativos no vite.config.ts**: plano original sugeria `import.meta.dirname + node:path` para resolver entradas MPA, mas isso exigiria dependência `@types/node`. Opção tomada: caminhos relativos à raiz do projeto, resolvidos nativamente pelo Vite — zero deps extra, sem `@types/node`. Documentado em vite.config.ts (linhas 12–15).

2. **Google Fonts CDN vs auto-hospedagem**: mockups usam `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` no design-system.css. **Decisão**: app (index.html, receitas.html, historico.html) carrega apenas `design-system.css` via Vite, com fonte fallback `system-ui` até issue de UI decidir auto-hospedagem. Alinhado com spec §10 (app 100% client-side) e §11.1 (zero secrets em front-end). Ação diferida para issue 014+.

3. **Polyfill modulepreload em dist/**: achado do revisor-design (baixa prioridade): Vite injeta `<link rel="modulepreload" as="script" ...>` em dist/index.html que contém `fetch()` same-origin para chunks. Artefato de build sem risco (fetch é same-origin, sem headers de autorização, offline ok). Sem ação necessária.

---

## Iteração 007 — 2026-07-05 ~02:35 (precificação)

| Campo | Valor |
|-------|-------|
| **Issue** | 007-pricing |
| **Timestamp** | 2026-07-05 02:35 |
| **O que foi feito** | src/core/pricing.ts: 8 funções puras (clampMargin — [0, 99.9], §5.C decisão 4; effectiveQuantity — ≥1 guarda de ÷0; unitCost — CustoTotalReceita/Qtd derivado §3.E; priceFromSalePrice — modo Preço Fixo, null guarda em salePrice≤0; priceFromMargin — modo Margem%, Preço = CustoUnit/(1−m/100), m clampeada, 0 se denominador; priceFromProfit — modo Lucro Fixo, reverte profit-margin; pricingTotals — totais (RESOLUÇÃO §12: totalProductionCost = unitCost×Qtd, NÃO CustoTotalReceita×Qtd — golden fonte da verdade); marginStatus — faixas 30/15 §4 literal (>30 verde, 15–30 amarelo, <15/neg vermelho); isLoss — break-even inclusivo ≤ §5.C). Sem DOM, sem localStorage, precisão total (§3.E/§4/§5.C). src/core/pricing.test.ts: 18 casos TDD (unitCost 2, clampMargin 5, priceFromMargin 2, priceFromSalePrice 2, priceFromProfit 1, sincronização 3 modos 1, pricingTotals 2, marginStatus 6, isLoss 1, pureza 1). Golden §12 validado completo: unitCost=4,43, margin 40→salePrice 7,3833/profit 2,9533, totals 8,86/14,7666/5,9066. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: pricing.test.ts (18) + costs.test.ts (13) + hydration.test.ts (14) + bakers.test.ts (22) + sourdough.test.ts (12) + format.test.ts (23) + golden-example.test.ts (1 falha intencional) = 103 total. Pass: 102. Fail: 1 intencional. Build Vite: verde. Gates: testes 102 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados. **ACHADOS DIFERIDOS PARA REVISOR HUMANO** (registrados em "Decisões da noite" acima): (a) inconsistência §3.E linha 232 vs golden §12; (b) isLoss ≤ vs §4 prejudicial <; (c) faixas 30/15 literais; (d) clamp margem negativa. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em pricing.ts (§3.E/§4/§5.C/§12 decisão 4) e pricing.test.ts (§3.E/§4/§5.C/§12 decisão 4, §9). Reuso total: unitCost usa effectiveQuantity (guarda); clampMargin centraliza regra de domínio; pricingTotals base para issue 008 (recalc). Sincronização dos 3 modos (Preço/Margem/Lucro) validada em testes: byMargin, bySalePrice, byProfit convergem. Mapa de módulos será atualizado agora. |

---

## Iteração 006 — 2026-07-05 ~02:20 (custos)

| Campo | Valor |
|-------|-------|
| **Issue** | 006-costs |
| **Timestamp** | 2026-07-05 02:20 |
| **O que foi feito** | src/core/costs.ts: 6 funções puras (packageSizeInGrams — normaliza kg/L→×1000, mL/g→×1; costPerGram — Preço÷Peso, derivado nunca digitado, null se Peso≤0 §5.C; ingredientRecipeCost — peso×custo/g, propaga null; sourdoughCost — Σ FarinhaFerm×C + ÁguaFerm×C, Isca SEMPRE fora §2.B.2; sourdoughCostPerGram — Custo÷W_ferm, 0 se W_ferm≤0; totalRecipeCost — Σ ingredientes+fermento com compensatedSum de Neumaier, reduz drift IEEE-754, §3.E). Sem DOM, sem localStorage, precisão total (§2.A/§2.A.1/§2.B.2/§3.E/§5.C). src/core/costs.test.ts: 13 testes TDD (packageSizeInGrams 1, costPerGram 4, ingredientRecipeCost 1, sourdoughCost 3, sourdoughCostPerGram 1, totalRecipeCost 2, pureza 1). Golden §12 validado: 8,86 exato (farinha 8+água 0+sal 0,06+fermento 0,80), azeite 0,064/g e 2,56 para 40g (§2.A.1). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: costs.test.ts (13) + bakers.test.ts (22) + sourdough.test.ts (12) + hydration.test.ts (14) + format.test.ts (23) + golden-example.test.ts (1 falha intencional) = 85 total. Pass: 84. Fail: 1 intencional. Build Vite: verde. Gates: testes 84 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado sem achados (Neumaier validado como técnica de precisão legítima; soma compensada ≠ arredondamento decimal §9; Isca fora de sourdoughCost correto §2.B.2; contrato para issue 008: Recipe.ingredients[] NÃO contém fermento; distinção null/0 preservada para consumidores). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec presentes em costs.ts (§2.A/§2.A.1/§2.B.2/§3.E/§5.C) e costs.test.ts. Reuso total: packageSizeInGrams normaliza unidades (§2.A); costPerGram base de ingredientRecipeCost e sourdoughCost; compensatedSum puro sem lib. Alinhamento futuro: issue 008 (recalc engine) recebe funções deste módulo; issue 010 (validações UI) decide se avisar sobre null vs 0. Mapa de módulos será atualizado agora. |

---

## Iteração 005 — 2026-07-05 ~02:05 (hidratação + farinha real)

| Campo | Valor |
|-------|-------|
| **Issue** | 005-hydration-real-flour |
| **Timestamp** | 2026-07-05 02:05 |
| **O que foi feito** | src/core/hydration.ts: 4 funções puras (declaredLiquidsWeight — Σ pesos category 'liquid' sem 'fat', decisão 15; nominalHydration — ΣLíquidos/F_total×100, null se F_total=0; realHydration — (ΣLíquidos+ÁguaFerm)/(F_total+FarinhaFerm)×100, null se denominador=0; realFlourConsumed — F_total+FarinhaFerm, derivado somente-leitura). Sem DOM, sem localStorage, precisão total (§2.C/§2.D, decisão 15, §5.C). src/core/hydration.test.ts: 14 testes TDD (declaredLiquidsWeight 4, nominalHydration 3, realHydration 4, realFlourConsumed 3). Golden §12 validado (70% nominal, 72,7272…% real, 1100g farinha real). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: hydration.test.ts (14) + bakers.test.ts (22) + sourdough.test.ts (12) + format.test.ts (23) + golden-example.test.ts (1 falha intencional) = 72 total. Pass: 71. Fail: 1 intencional (golden). Build Vite: verde. Gates: testes 71 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§2.C/§2.D/§12 implementado fielmente; fat excluído de hidratação; null defensivo em ÷0; reuso bakers.ts correto; prefixo spec em cabeçalhos). Achado baixa prioridade: faltaram 2 linhas no Mapa de módulos (hydration.ts/hydration.test.ts) — cobrir agora. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 2 arquivos novos. Reuso total: declaredLiquidsWeight filtra só liquid (categoria bakers.ts); nominalHydration/realHydration/realFlourConsumed reusam flourTotal (bakers.ts); sourdough=null trata-se defensivamente com `?? 0` (segue padrão issue 004). Mapa de módulos será atualizado agora pelo escriba. |

---

## Iteração 004 — 2026-07-05 ~01:55–~02:25 (fermento por Partes)

| Campo | Valor |
|-------|-------|
| **Issue** | 004-sourdough-parts |
| **Timestamp** | 2026-07-05 01:55 |
| **O que foi feito** | src/core/sourdough.ts: 6 funções puras (sourdoughTotalWeight — W_ferm = F_total × %/100, reuso de bakers.weightFromPercentage; partsSum — Σ Isca+Farinha+Água; isValidSourdoughParts — guarda SomaPartes>0 e partes≥0; computeSourdoughWeights — rateio interno e hidratação DERIVADA; distributeSourdoughFlourWeights — Farinha_i = FarinhaFerm × P_i/100; sourdoughFlourPercentagesSumTo100 — predicado delega a percentagesSumTo100). Sem DOM, sem localStorage, precisão total (§1.6/§2.B/§3.B/§5.C). src/core/sourdough.test.ts: 12 testes TDD (sourdoughTotalWeight 1, partsSum 1, computeSourdoughWeights 5 casos limites, isValidSourdoughParts 1, distributeSourdoughFlourWeights 2, sourdoughFlourPercentagesSumTo100+pureza 2). Refactor bakers.ts: percentagesSumTo100 extraído e exportado como dono único de SUM_EPSILON; flourPercentagesSumTo100 delega (comportamento idêntico, +2 testes em bakers.test.ts → 22 total). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: sourdough.test.ts (12) + bakers.test.ts (22, +2 de percentagesSumTo100) + format.test.ts (23) + golden-example.test.ts (1 falha intencional) = 58 total. Pass: 57. Fail: 1 intencional. Build Vite: verde. Gates: testes 57 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§2.B/§2.B.2/§2.B.3/§3.B/§5.C implementado; hidratação derivada correta; null em farinha=0 literal; SUM_EPSILON centralizado; prefixo spec em cabeçalhos). Sem achados. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 2 arquivos novos (sourdough.ts, sourdough.test.ts). Reuso total: sourdoughTotalWeight reusa weightFromPercentage; sourdoughFlourPercentagesSumTo100 reusa percentagesSumTo100; %SUM_EPSILON centralizado em bakers.ts, importado por sourdough.test.ts. Premissa de issue 003 preservada: fermento é sub-receita com own Ingredient[], farinhas do fermento não entram em flourTotal (bakers.ts). |

---

## Iteração 003 — 2026-07-05 ~01:45–~02:30 (baker's percentage)

| Campo | Valor |
|-------|-------|
| **Issue** | 003-bakers-percentage |
| **Timestamp** | 2026-07-05 01:45 |
| **O que foi feito** | src/core/bakers.ts: 4 funções puras (flourTotal — Σ pesos farinhas category='flour'; weightFromPercentage — Peso = F_total × %/100; percentageFromWeight — % = Peso/F_total × 100, guarda F_total ≤ 0; flourPercentagesSumTo100 — predicado puro com epsilon 1e-9 anti-drift IEEE-754). Sem DOM, sem localStorage, precisão total (§1.6/§3.A/§5.C). src/core/bakers.test.ts: 20 testes TDD red→green (flourTotal 4 casos, weightFromPercentage 6, percentageFromWeight 4, flourPercentagesSumTo100 4, pureza 2). Golden §12 validado: 1000g farinha, 700g água (70%), 20g sal (2%), 200g fermento (20%). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 20 suites (bakers.test.ts) + 23 (format.test.ts) + 1 golden (golden-example.test.ts) = 44 testes total. Pass: 43. Fail: 1 intencional (golden placeholder, aguarda issue 008). Build Vite: verde. Gates: testes 43 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§1.1/§1.2/§2.A.2/§3.A/§5.C implementado; farinhas do fermento correto não contam em flourTotal; epsilon justificado §9). Sem achados. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 2 arquivos novos (bakers.ts, bakers.test.ts). Premissa registrada: fermento é sub-receita (§2.B), não linha com category='flour' — issues 004/008 preservam. |

---

## Iteração 002 — 2026-07-05 01:35–~02:00 (types + formatação pt-BR)

| Campo | Valor |
|-------|-------|
| **Issue** | 002-types-formatting |
| **Timestamp** | 2026-07-05 01:35 |
| **O que foi feito** | src/core/types.ts: 13 interfaces fiéis à spec §6 (Recipe, Ingredient, Sourdough, BakeEntry, etc.), valor canônico em gramas, campos derivados marcados readonly; src/core/format.ts: parseDecimal (aceita vírgula OU ponto, rejeita múltiplos separadores), formatPercent/Weight/Currency/CostPerGram (via Intl.NumberFormat pt-BR, roundingMode 'halfExpand'), formatDate (aaaa-mm-dd, getters locais não UTC); NBSP normalizado para espaço ASCII; useGrouping off exceto currency; src/core/format.test.ts: 23 testes TDD (parseDecimal 9, formatCurrency 4, formatCostPerGram 1, formatWeight 2, formatPercent 4, formatDate 2); golden §12 validado (1041,7 g, R$ 8,86). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 23 suites (format.test.ts) + 1 golden example suite (golden-example.test.ts) = 24 testes total. Pass: 23. Fail: 1 intencional (golden, aguarda issue 008). Build Vite: verde. Gates: testes 23 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§6 implementado fielmente, §7.1 parseDecimal correto, §9 precisão exibição OK, §12 golden validado). Achado baixa prioridade: working tree tem modificações pré-existentes em spec/ e mockups/ (não staged, alheias à issue). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 3 arquivos novos. |

---

## Iteração 001 — 2026-07-05 00:00–01:20 (scaffold)

| Campo | Valor |
|-------|-------|
| **Issue** | 001-scaffold |
| **Timestamp** | 2026-07-05 01:20 |
| **O que foi feito** | Scaffold Vite 7 + TypeScript 5 strict + Vitest 3; MPA com 3 páginas (index/receitas/historico) importando design-system.css via entry points src/ui/pages/*.ts; estrutura de pastas src/core\|storage\|export\|ui criada; teste dourado §12 implementado como placeholder que falha de propósito (única falha da suíte); zero dependências de runtime além de Vite; package-lock.json commitado. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 1 suite, 1 test, 1 falha intencional (golden example placeholder). Build Vite: verde. Gates: build ✓, test 1 falha esperada ✓. |
| **Reviews** | revisor-spec: aprovado (spec §10, §12, architecture.md alinhados). guardiao-design: aprovado (design-system.css carregado, nenhum estilo hardcoded, mockups refletidos em HTML). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Backlog de 20 issues gerado e commitado no commit anterior (122da55). |

