---
id: "009"
titulo: Escalonamento por peso alvo + fornada por unidade
tipo: core
deps: ["008"]
status: todo
---

## Contexto
Escalonamento explícito (spec §3.D — única ação não-imediata, §1.6) e planejamento por unidade (§2.E.1, decisão 16).

## O que fazer
- `src/core/scaling.ts`:
  - `SomaReceita% = Σ %ingredientes + Proporção%fermento` (§3.D passo 1 — fermento ENTRA, decisão 3).
  - `F_nova = W_alvo / (SomaReceita%/100)` (passo 2); novos pesos = F_nova × %/100 (passo 3).
  - Só no modo `percentage-to-weight` (§3.D).
- Fornada por unidade (§2.E.1):
  - Modo `per-unit`: `F_total = F_unit × N` — derivado, somente-leitura; alterar F_unit ou N recasca tudo (mesma recalc §1.6).
  - Disponível só em %→peso; peso→% força `total`.
  - Escalonamento por alvo no modo per-unit: resultado ajusta `F_unit` mantendo `N`.

## Testes exigidos (TDD)
- §12: soma 100+70+2+20 = 192%; alvo 2000g → F_nova = 2000/1.92 ≈ 1041.6667 (toBeCloseTo), água nova = 729.1667, sal 20.83, fermento 208.33.
- Per-unit: F_unit 250, N 4 → F_total 1000, receita idêntica ao golden.
- Per-unit + escalonamento alvo 2000 → N mantém 4, F_unit = 1041.6667/4 ≈ 260.4167.
- SomaReceita% inclui fermento (192 no golden, não 172).
- W_alvo 0 ou soma 0 → inválido explícito.

## Critérios de aceite
- [ ] Fermento na soma (decisão 3); golden 192% → 1041,7g exibido.
- [ ] Per-unit deriva F_total, restrito a %→peso (§2.E.1).
- [ ] Escalonamento é função explícita, não reação de campo (§1.6).

## Referências
- spec §1.6, §2.E.1, §3.D, §12, decisões 3 e 16

---

## Plano Técnico

### Análise do existente (grep real em src/core/)
Reuso máximo — nada de fórmula duplicada (regra de ouro #2):
- `src/core/recalc.ts` → `recalculate(recipe)`: engine central em lote (§1.6). Já assume `batchPlanningMode='total'` (PROGRESS decisão 008-4). O ponto de extensão é a **âncora F_total** (linhas 64–65): hoje em `%→peso` usa `state.flourTotalWeight` direto. Per-unit muda SÓ essa linha para derivar `F_total = flourPerUnit × N`. Todo o resto (deriva pesos via `weightFromPercentage`, fermento, hidratação, custo, preço) permanece intacto e passa a valer para per-unit de graça.
- `src/core/recalc.ts` → `transitionToPercentageMode` — NÃO tocar; é a transição §1.5, ortogonal a esta issue.
- `src/core/bakers.ts` → `weightFromPercentage(fTotal, %)` (§3.A): já implementa o passo 3 do escalonamento (`Novo Peso_X = F_nova × %/100`). **Scaling NÃO reimplementa o passo 3** — só calcula `F_nova` e delega ao `recalculate` existente.
- `src/core/pricing.ts` → `effectiveQuantity(quantity)` (≥1, guarda ÷0, já exportada): reusar como N em per-unit (deriva `flourPerUnit` mantendo a mesma guarda de quantidade do resto do app).
- `src/core/types.ts`: `BatchPlanningMode = 'total' | 'per-unit'`, `Recipe.batchPlanningMode`, `Recipe.flourTotalWeight` (readonly-derivado em per-unit), `Recipe.flourPerUnit?` — **já existem** (§6/§2.E.1). Nenhuma mudança de tipo necessária; a issue apenas passa a consumi-los.
- Fixtures de teste: reusar `goldenRecipe()`/`pkg()`/`FREE_WATER` de `recalc.test.ts` (mesmo padrão) num novo `scaling.test.ts`.
- Nenhuma dependência externa nova (v1 100% client-side, §10/§11.1). Escalonamento é aritmética pura do domínio — é o produto, fica no core com TDD (regra de ouro #1).

### Cenários (números concretos da §12, gabarito)
Caminho feliz — escalonamento (§3.D, decisão 3):
- Soma da Receita % = Σ %ingredientes + Proporção%fermento = 100 + 70 + 2 + 20 = **192%** (fermento ENTRA — decisão 3; NÃO 172).
- Alvo 2000g → `F_nova = 2000 / (192/100) = 2000/1,92 ≈ 1041,6667`.
- Ao reaplicar via `recalculate`: farinha 1041,6667 · água 729,1667 · sal 20,8333 · W_ferm 208,3333. Soma da massa = 2000 (alvo batido).
- `F_nova` vira a nova âncora: em `total` → `flourTotalWeight = 1041,6667`; em `per-unit` → `flourPerUnit = F_nova/N`.

Caminho feliz — per-unit (§2.E.1, decisão 16):
- `flourPerUnit = 250`, `N = pricing.quantity = 4` → `F_total = 1000`. Pesos e hidratação **idênticos ao golden** (mesma F_total); apenas a precificação divide por N=4 (não por 2). `F_total` é derivado somente-leitura.
- Per-unit + escalonamento alvo 2000: N mantém 4, `flourPerUnit = 1041,6667/4 ≈ 260,4167`; `F_total` derivado volta a 1041,6667.

Casos de borda e erro (guards explícitos, §5.C, contrato null≠0):
- `W_alvo ≤ 0` (0 ou negativo) → escalonamento inválido → `null` (sem throw; caller não altera a receita).
- Soma da Receita % = 0 (sem ingredientes e fermento 0) → divisão impossível → `null`.
- Modo `peso→%`: escalonamento por alvo **indisponível** (§3.D "modo %→peso apenas") → `applyTargetScaling` retorna `null`; e per-unit **força total** (§2.E.1) → `recalculate` ignora `flourPerUnit` em `peso→%`.
- Per-unit com `N` inválido (`quantity < 1`) → `effectiveQuantity` clampa a 1 (guarda reusada), sem ÷0.

### Testes primeiro (TDD — escrever ANTES; novo `src/core/scaling.test.ts`)
Comparações cruas com `toBeCloseTo(_, 9)` (§9: sem arredondar no core):
1. `recipeSumPercent(golden)` → **192** (inclui fermento; assert explícito ≠ 172).
2. `recipeSumPercent` com fermento 0 e ingredientes 100+70+2 → 172.
3. `scaledFlourTotal(golden, 2000)` → **1041,6667**.
4. `applyTargetScaling(golden, 2000)` seguido de `recalculate`: farinha 1041,6667 · água **729,1667** · sal **20,8333** · `sourdough.totalWeight` **208,3333**; `flourTotalWeight` = 1041,6667.
5. Per-unit sem escalonamento: recipe `batchPlanningMode='per-unit'`, `flourPerUnit=250`, `quantity=4` → `recalculate` deriva `state.flourTotalWeight` = **1000**; pesos/hidratação idênticos ao golden (água 700, sal 20, nominal 70, real ≈72,7273).
6. Per-unit + escalonamento: `applyTargetScaling(perUnitRecipe, 2000)` → `flourPerUnit ≈ 260,4167`, `quantity` inalterado = 4; após `recalculate`, `flourTotalWeight` = 1041,6667.
7. Guard `scaledFlourTotal(golden, 0)` → `null`; `(golden, -5)` → `null`.
8. Guard soma 0 (`recipeSumPercent` = 0) → `scaledFlourTotal` → `null`.
9. `applyTargetScaling` num recipe `weight-to-percentage` → `null` (§3.D só %→peso).
10. Pureza: `applyTargetScaling` não muta o recipe de entrada (clona); `recalculate` per-unit não muta entrada.
11. (em `recalc.test.ts`) per-unit em `weight-to-percentage` é ignorado: engine deriva F_total das farinhas, `flourPerUnit` não influi (força total, §2.E.1).

### Arquivos a criar
- `src/core/scaling.ts` — cabeçalho citando §1.6/§2.E.1/§3.D/§12, decisões 3 e 16. Funções puras (sem DOM, sem arredondamento, sem rede):
  - `recipeSumPercent(recipe: Recipe): number` — `Σ recipe.ingredients[].percentage + recipe.sourdough.percentageOfTotalFlour` (§3.D passo 1; fermento entra — decisão 3). NÃO inclui as % internas das farinhas do fermento (sub-receita).
  - `scaledFlourTotal(recipe: Recipe, targetWeight: number): number | null` — guarda `targetWeight ≤ 0` → null; `soma = recipeSumPercent(recipe)`, guarda `soma ≤ 0` → null; `F_nova = targetWeight / (soma/100)` (§3.D passo 2).
  - `applyTargetScaling(recipe: Recipe, targetWeight: number): Recipe | null` — **ação explícita** (§1.6), não reação de campo. Só em `calculationMode==='percentage-to-weight'` (§3.D), senão `null`. Clona o recipe; `F_nova = scaledFlourTotal(...)` (null → retorna null). Se `batchPlanningMode==='per-unit'`: `next.flourPerUnit = F_nova / effectiveQuantity(pricing.quantity)` (mantém N, §2.E.1). Senão: `next.flourTotalWeight = F_nova`. Retorna a Recipe pura; o **caller roda `recalculate` em seguida** (passo 3 via `weightFromPercentage`, sem duplicar).
- `src/core/scaling.test.ts` — os 10 casos acima (1–10).

### Arquivos a modificar
- `src/core/recalc.ts` — SÓ a âncora F_total (linhas 64–65) e escrita do derivado:
  - importar `effectiveQuantity` de `./pricing`.
  - em `percentage-to-weight`: se `state.batchPlanningMode==='per-unit'` → `fTotal = (state.flourPerUnit ?? 0) × effectiveQuantity(state.pricing.quantity)` (§2.E.1) e gravar `state.flourTotalWeight = fTotal` (derivado somente-leitura); senão manter `state.flourTotalWeight`.
  - em `weight-to-percentage`: planejamento é sempre `total` (§2.E.1) — normalizar `state.batchPlanningMode='total'` e nunca ler `flourPerUnit`. Atualizar o comentário "(Fornada per-unit é a 009.)".
- `src/core/recalc.test.ts` — adicionar o caso 11 (per-unit ignorado em peso→%). Golden `total` existente permanece verde (regressão).
- `references/architecture.md` (Mapa de módulos + Decisões) e `PROGRESS.md` — pelo escriba após implementar; não é código.

### Arquivos que NÃO devem ser tocados
- `src/core/bakers.ts`, `sourdough.ts`, `hydration.ts`, `costs.ts`, `pricing.ts` (só reuso via import; `weightFromPercentage`/`effectiveQuantity` já bastam).
- `src/core/types.ts` — campos já existem; nenhuma mudança de tipo (evitar tocar contrato da 008).
- `src/core/golden-example.test.ts` — contrato dourado permanente (`total`, quantity 2) intacto.
- `transitionToPercentageMode` em `recalc.ts` — fora de escopo.
- Qualquer arquivo de UI (`src/ui/**`) — o botão/ação de escalonamento e o toggle per-unit são das issues 016; aqui é core puro.

### Ordem de implementação
1. Escrever `scaling.test.ts` (casos 1–10) e o caso 11 em `recalc.test.ts` — RED.
2. Estender a âncora F_total em `recalc.ts` (per-unit derivado; peso→% força total) — caso 5/11 GREEN.
3. Implementar `scaling.ts` (`recipeSumPercent` → `scaledFlourTotal` → `applyTargetScaling`) — casos 1–4, 6–10 GREEN.
4. Rodar suíte completa (golden §12 e 008 devem permanecer verdes) + build Vite.

### O que NÃO fazer
- NÃO chamar `applyTargetScaling`/`scaledFlourTotal` de dentro de `recalculate`: escalonamento é ação explícita e distinta (§1.6, decisão 26), jamais reação de edição de campo.
- NÃO reimplementar o passo 3 do §3.D (`Novo Peso_X = F_nova × %/100`): já é `bakers.weightFromPercentage` via `recalculate` (regra de ouro #2).
- NÃO omitir o fermento da Soma da Receita % (seria 172; decisão 3 manda 192).
- NÃO habilitar per-unit em `peso→%` nem deixar `flourTotalWeight` editável em per-unit (é derivado, §2.E.1).
- NÃO arredondar no core (§9) — arredondamento só na exibição (UI 016).
- NÃO adicionar dependência externa, chamada de rede ou secret (§10/§11.1).
- NÃO lançar exceção em alvo/soma inválidos — retornar `null` (contrato null≠0 das issues 004–008).
