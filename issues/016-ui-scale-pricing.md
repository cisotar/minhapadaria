---
id: "016"
titulo: UI Calculadora — painel escala/produção, precificação, escalonamento, banner peso→%
tipo: ui
deps: ["009", "015"]
status: done
---

## Contexto
Painel de controle de escala e produção (spec §2.E), precificação sincronizada (§3.E, §4) e sinalização do modo alternativo (§1.3). Mockup `mockups/calculadora.html`.

## O que fazer
- Toggle global de modo de cálculo %→peso / peso→% (§1.3):
  - Ativo peso→%: **banner fixo no topo + destaque nos campos de %** (§1.3, obrigatório); pesos editáveis, % derivadas do total da massa.
  - Volta: transição §1.5 via core (008), sem prompt.
- Planejamento da fornada (§2.E.1): toggle Fornada inteira / Por unidade; per-unit: F_unit + N editáveis, F_total derivado somente-leitura; per-unit desabilitado no modo peso→%.
- Painel de precificação (§3.E, §4): Quantidade, e trio Preço/Margem%/Lucro sincronizado — editar um recalcula os outros (007); totais de produção (custo, receita, lucro).
- Indicadores (§4): margem colorida verde >30 / amarelo 15–30 / vermelho <15 ou negativa; destaque de prejuízo se custo > preço. Usar tokens de estado do design system existentes.
- Escalonamento por peso alvo (§3.D): campo alvo + botão explícito "Re-escalar" (ÚNICA ação com botão, §1.6); em per-unit ajusta F_unit mantendo N.
- Validações via 010 (margem ≤99,9, qtd ≥1 etc.).

## Critérios de aceite
- [x] Banner + destaque visíveis SEMPRE que peso→% ativo; somem na volta (§1.3).
- [x] Editar margem 40% com custo 8,86/2un → preço R$7,38 na tela (golden §12).
- [x] Escalonar alvo 2000g → farinha exibida 1041,7g (§12).
- [x] Per-unit: F_unit 250 × N 4 → F_total 1000 somente-leitura.
- [x] Cores de margem pelos tokens (sem hex novo).
- [x] Zero lógica de negócio no DOM; strings pt-BR.

## Referências
- spec §1.3, §1.5, §1.6, §2.E, §3.D, §3.E, §4 · mockups/calculadora.html · design-system.css tokens de estado

---

## Plano Técnico

### Análise do existente (busca real — `grep`/Read)

**Core (congelado, `src/core/**` NÃO tocar — todo o produto já existe):**
- `recalc.ts` → `recalculate(recipe)` já reconstrói TODOS os derivados nos dois modos: em `weight-to-percentage` deriva `%` de cada linha como `peso/totalMassa×100` (linhas 103-115, denominador INCLUI `wFerm`), força `batchPlanningMode='total'` (linha 79), e em `per-unit` %→peso deriva `F_total = flourPerUnit × effectiveQuantity(quantity)` (linha 73, §2.E.1). Também exporta `transitionToPercentageMode(recipe)` (§1.5, linhas 202-211): recalcula `F_total = Σ pesos farinhas` e `%` baker's — retorna Recipe pura, o chamador roda `recalculate` depois.
- `scaling.ts` → `applyTargetScaling(recipe, targetWeight): Recipe|null` (§3.D/§1.6): clona e grava nova âncora (`flourTotalWeight` em `total`; `flourPerUnit = F_nova/N` em `per-unit`); retorna `null` se modo≠%→peso ou alvo/soma inválidos (decisão 16). `recipeSumPercent` (Σ%ingredientes+%fermento = 192% no golden).
- `pricing.ts` → `unitCost`, `priceFromSalePrice`/`priceFromMargin`/`priceFromProfit` (trio sincronizado §3.E), `pricingTotals`, `marginStatus(m): 'green'|'yellow'|'red'` (faixas 30/15 §4), `isLoss(unitCost, salePrice)` (break-even ≤ §5.C). `recalculate` já chama tudo isso conforme `pricing.priceInputMode`.
- `validation.ts` → `validateMargin` (≤99,9 §5.C), `validateProductQuantity` (≥1), `validateNonNegative`, `validatePackageSize` — retornam `ValidationResult|null`.
- `format.ts` → `parseDecimal`, `formatPercent/Weight/Currency/CostPerGram`. `types.ts` → `Pricing.priceInputMode`, `BatchPlanningMode`, `flourPerUnit`, `RecipeSummary` (campos `number|null`).

**UI existente (REUSAR, extensão mínima):**
- `state.ts` → `createAppState` expõe `getState/update(mutator)/subscribe/showCosts`. `update` clona → mutator → `normalize?` → `recalculate` → `notify`. **Falta** um caminho para transformações que retornam Recipe nova/`null` (transição §1.5 e escalonamento §3.D) — ver "Arquivos a modificar".
- `dom.ts` → `h/clear/on` (escape XSS, regra 3 — único ponto que toca DOM). `cellHelpers.ts` → `applyValidation`, `moneyPlain`, `UNIT_OPTIONS`.
- `ingredientsTable.ts` → padrão a espelhar: `input`→`parseDecimal`→`store.update`; repintura de derivados via `subscribe` sem recriar input em foco; `blur`→`applyValidation`. Hoje renderiza `%` editável e Peso readonly hardcoded (decisão 014: peso→% adiado para 016).
- `hydrationPanel.ts` / `sourdoughTable.ts` → padrão de card + `subscribe`/repaint; reusam `metric-pair`/`metric`.
- `pages/calculadora.ts` → composition root; monta `#app` (nav/header já são HTML estático em `index.html`). Injetará os 4 módulos novos.

**Design system (REUSAR tokens/classes existentes — nenhum hex novo):**
- `.banner-mode-alt` (sticky top, tokens `--mode-alt-*`) — já existe (linha 207). `.mode-alt .input.pct` já destaca campos % (linha 204, token `--mode-alt-field`).
- `.chip`/`.chip-ok`/`.chip-warn`/`.chip-crit` (tokens `--status-ok/warn/crit-*`, brandbook §2.1) — cores de margem §4. `.loss` (linha 228) — destaque de prejuízo.
- `.field`, `.period-toggle`/`.period-toggle button.active` (toggle planejamento), `.metric-pair`/`.metric`, `.table`/`.readonly`/`.num`.
- **NÃO existe em DS-css**: `.grid-2` e `.row` (só no `<style>` inline do mockup) — 015 flagou que 016 precisaria. Ver "Arquivos a modificar".

### Cenários (números concretos §12 = gabarito)

**Modo peso→% (§1.3/§1.5):**
- Caminho feliz: clicar "Alternar p/ peso → %" → `calculationMode='weight-to-percentage'`; banner sticky aparece; `body.mode-alt` liga → campos `%` destacados; Peso vira editável, `%` derivada readonly (recalc: denominador = Σ pesos + `wFerm`, as % somam 100). Voltar → `transitionToPercentageMode` (§1.5): `F_total = Σ pesos farinhas`, % baker's recalculadas, sem prompt; banner e destaque somem.
- Borda: em peso→%, `batchPlanningMode` é forçado a `total` pelo core → o toggle "Por unidade" fica desabilitado (§2.E.1).

**Planejamento (§2.E/§2.E.1):**
- Fornada inteira: `F_total` editável (golden 1000,0g); Quantidade `N=2`.
- Por unidade: `F_unit=250` × `N=4` → `F_total=1000,0g` derivado readonly (§2.E.1). Editar `F_unit`/`N` recalcula em cascata.
- Borda: `N<1` bloqueado (`validateProductQuantity`, §5.C).

**Precificação (§3.E/§4):**
- Golden §12 (fixture SEM azeite, custo total R$8,86, 2 un → custoUnit R$4,43): editar Margem `40` → Preço `R$ 7,38`, Lucro `R$ 2,95`; Receita total `R$ 14,76`, Lucro total `R$ 5,90`. Chip verde "Margem 40,00%" (§4: >30 verde).
- Bordas de cor (`marginStatus`): 30→amarelo, 15→amarelo, 14,9→vermelho. Prejuízo (`isLoss`, salePrice ≤ custoUnit): chip `.chip-crit` "Prejuízo R$ …" + valores em `.loss`.
- Borda: margem 150 → `validateMargin` bloqueia no blur, clamp core a 99,9.

**Escalonamento (§3.D/§1.6):**
- Alvo `2000` (golden, soma 192%) → `F_nova = 2000/1,92 ≈ 1041,67` → Peso da farinha exibido `1041,7g`. Ação SÓ no clique do botão "Re-escalar" (única ação com botão, §1.6).
- Borda: `applyTargetScaling` devolve `null` (alvo ≤0, ou modo peso→%) → **não aplicar** nada (botão desabilitado em peso→%; alvo vazio/inválido não muta estado). Per-unit: ajusta `F_unit` mantendo `N`.

### Testes primeiro
Não há issue core/storage aqui (core congelado); os testes são jsdom de UI (`// @vitest-environment jsdom`, precedente 014/015), montados com `createMemoryStorage()`+`createPrefsStore`+`createAppState`. Escrever ANTES:

`src/ui/modeToggle.test.ts`
1. Clicar alternar → `document.body` ganha classe `mode-alt` E existe nó `.banner-mode-alt` no DOM; `getState().recipe.calculationMode === 'weight-to-percentage'`.
2. Estado peso→% → inputs de % da tabela têm classe `pct` e ancestral `.mode-alt` (destaque §1.3 presente).
3. Clicar "Voltar ao modo padrão" (no banner) → some `.banner-mode-alt`, `body` perde `mode-alt`, `calculationMode==='percentage-to-weight'`, e `flourTotalWeight` = Σ pesos das farinhas vigentes (§1.5, `transitionToPercentageMode`).

`src/ui/batchPanel.test.ts`
4. `batchPlanningMode='per-unit'`, `flourPerUnit=250`, `pricing.quantity=4` → campo F_total exibe `1000,0` e é readonly (§2.E.1).
5. Editar `N` de 2→3 (fornada inteira, golden) → recalcula (`summary.costPerUnit` muda); F_total inalterado.
6. Modo peso→% → botão "Por unidade" desabilitado (§2.E.1).

`src/ui/pricingPanel.test.ts` (fixture §12 exata, SEM azeite)
7. Editar Margem `40` → input Preço exibe `7,38` e Lucro `2,95` (golden §12); input em foco (margem) não é sobrescrito.
8. `marginStatus` na tela: margem 40 → chip com classe `chip-ok`; forçar custo>preço → `chip-crit` + `.loss` (tokens, sem hex novo).
9. Editar Margem `150` → blur bloqueia via `validateMargin` (aria-invalid) OU clamp a 99,9 exibido.

`src/ui/scalePanel.test.ts` (fixture §12 exata)
10. Digitar alvo `2000` + clicar "Re-escalar" → Peso da farinha na tabela de insumos exibe `1041,7` (§12).
11. Modo peso→% → botão desabilitado; alvo `0` + clique → nenhuma mudança de estado (`applyTargetScaling`→null não aplica).

### Arquivos a criar
- `src/ui/modeToggle.ts` — `renderModeToggle(root, store)`: botão de modo (no card de Ancoragem) + gestão do banner sticky (`h('div',{className:'banner-mode-alt'})` inserido/removido de `document.body`) + `document.body.classList.toggle('mode-alt', alt)`. Alt: `store.update(d => { d.calculationMode='weight-to-percentage'; })`. Volta: `store.applyTransform(transitionToPercentageMode)` (§1.5). `subscribe` sincroniza rótulo/banner/classe com `getState().recipe.calculationMode`. Cabeçalho §1.3/§1.4/§1.5.
- `src/ui/batchPanel.ts` — `renderBatchPanel(root, store)`: card "Ancoragem e Planejamento da Fornada" (§2.E). `.period-toggle` Fornada inteira/Por unidade (grava `batchPlanningMode`); campo `F_total` (editável em `total`, readonly derivado em `per-unit`); campo `F_unit` + `N` (Quantidade de Produtos = `pricing.quantity`) só em `per-unit`; "Por unidade" desabilitado em peso→% (§2.E.1). Hospeda o botão de modo (`renderModeToggle`) e o `renderScalePanel`. Cabeçalho §2.E/§2.E.1/§5.C.
- `src/ui/pricingPanel.ts` — `renderPricingPanel(root, store)`: card "Precificação" (§3.E). Chip de margem (`marginStatus`/`isLoss` → `chip-ok/warn/crit`), trio Preço/Margem%/Lucro (editar um → `priceInputMode`+valor cru via `store.update`; repaint atualiza os outros dois, nunca o focado), totais Custo unitário/Receita total (N un.)/Lucro total de `summary`, `.loss` em prejuízo. `blur` via `applyValidation`+`validateMargin`/`validateProductQuantity`. Cabeçalho §3.E/§4/§5.C.
- `src/ui/scalePanel.ts` — `renderScalePanel(root, store)`: campo "Escalonar para peso alvo" + botão "Re-escalar" (única ação com botão §1.6). Clique: `store.applyTransform(r => applyTargetScaling(r, alvo))`; `false`/`null` → não aplica (+ dica). Botão desabilitado em peso→% (§3.D). Cabeçalho §3.D/§1.6.
- `src/ui/modeToggle.test.ts`, `src/ui/batchPanel.test.ts`, `src/ui/pricingPanel.test.ts`, `src/ui/scalePanel.test.ts` (jsdom).

### Arquivos a modificar
- `src/ui/state.ts` — adicionar método aditivo `applyTransform(transform: (r: Recipe) => Recipe | null): boolean`: clona `current.recipe`, roda `transform`; se `null` retorna `false` (não muta/não notifica); senão `recalculate`+`notify`, retorna `true`. Serve a §1.5 (`transitionToPercentageMode`) E §3.D (`applyTargetScaling`) sem duplicar (regra 2). Retrocompatível (014/015 seguem usando `update`).
- `src/ui/ingredientsTable.ts` — tornar a edição sensível ao modo (§4): em `weight-to-percentage`, `%` vira readonly (derivada) e Peso vira `input` editável (`store.update` grava `weight`; `blur`→`validateNonNegative`); trava de farinha única só em %→peso. Adicionar classe `pct` ao input/célula de `%` (marcador do destaque §1.3). Reusar handlers/`applyValidation` existentes; sem lógica de negócio nova.
- `src/ui/pages/calculadora.ts` — wiring: instanciar `renderBatchPanel` (que agrega mode toggle + scale panel) ANTES da tabela, `renderPricingPanel` após Hidratação; ordem do mockup (Ancoragem → Ingredientes → Fermento → Hidratação+Precificação).
- `references/design-system.css` (+ `references/design-system.html`) — classes NOVAS só-tokens, documentadas: `.mode-alt .cell-input.pct` (espelha `--mode-alt-field`/`--areia` do `.input.pct` existente, para os inputs `.cell-input` da tabela); `.grid-2` (grid responsivo 2-col, para Hidratação+Precificação lado a lado); `.field-row` (flex-wrap de `.field`, `align-items:flex-end`, gap `--sp-3`) substituindo estilos inline (reduz débito do achado guardião-design 015). Nenhum token de `:root` alterado.

### Arquivos que NÃO devem ser tocados
- `src/core/**` (todo o cálculo — produto pronto e testado; congelado).
- `src/storage/**`, outras `src/ui/pages/*` (receitas/historico).
- `src/ui/seed.ts` (mantém Azeite do mockup — ver risco), `src/ui/dom.ts`, `src/ui/cellHelpers.ts`, `src/ui/hydrationPanel.ts`, `src/ui/sourdoughTable.ts` (proporção do fermento é sempre por Partes §1.3 — NÃO recebe `pct`/destaque).
- Tokens `:root` de `design-system.css`; `spec/`, `mockups/`, `brand/`.

### Ordem de implementação
1. `state.ts`: `applyTransform` (base de §1.5 e §3.D).
2. DS-css/html: `.mode-alt .cell-input.pct`, `.grid-2`, `.field-row`.
3. Testes jsdom (11 casos acima) — falhando primeiro.
4. `ingredientsTable.ts`: edição sensível ao modo + classe `pct`.
5. `modeToggle.ts` → `scalePanel.ts` → `batchPanel.ts` → `pricingPanel.ts`.
6. `pages/calculadora.ts`: composição/wiring.
7. Rodar suíte + `vite build`; verificação manual `npm run dev`.
