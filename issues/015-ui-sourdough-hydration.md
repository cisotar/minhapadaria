---
id: "015"
titulo: UI Calculadora — bloco do fermento (Partes) + painéis hidratação e farinha real
tipo: ui
deps: ["014"]
status: done
---

## Contexto
Sub-receita do fermento em tabela vertical estilo planilha (spec §2.B.2, decisão 22) e painéis informativos (§2.C, §2.D). Mockup `mockups/calculadora.html`.

## O que fazer
- Bloco do fermento (§2.B):
  - Proporção % (incremento 1%, §2.B.1) — input editável.
  - Tabela vertical: linhas Isca/Farinha/Água/Total; colunas Componente · Proporção · Peso (g) · Preço Pago · Peso do Produto · Custo/g · Custo (custos sob o mesmo toggle da 014, §2.B.2).
  - Proporção (Partes) editável; Peso derivado texto plano; Isca custo "—", nunca editável (§2.B.2).
  - Múltiplas farinhas do fermento: sub-linhas da linha Farinha (§2.B.2/B.3), soma 100% com bloqueio no blur, mínimo 1; custo herdado da farinha principal quando não editado manualmente (§4).
  - Custo da água do fermento: padrão R$0,00/1L, configurável (§2.B.4).
  - Resumo (§2.B.5): peso total, Isca, Farinha, Água, hidratação derivada ("Hidratação resultante: X%" ou "—"), custo total, custo/kg.
- Painel hidratação (§2.C): "Nominal: X% · Real: Y%" lado a lado.
- Farinha Real Consumida (§2.D): somente-leitura, visível quando há fermento.
- Tudo via core (004/005/006/008); recálculo imediato; avisos/bloqueios via 010.
- Escape XSS em nomes de farinha do fermento (textContent).

## Critérios de aceite
- [x] Layout tabela vertical fiel ao §2.B.2/mockup (ex 1:7:7 → 21/147/147 exibidos, total 15/310g).
- [x] Alterar Parte redistribui pesos mantendo W_ferm; alterar Proporção% recalcula tudo (§4).
- [x] Hidratação derivada exibe "—" com parte farinha 0 (§5.C).
- [x] Isca sem campo de custo em nenhum estado.
- [x] Editável com box, derivado texto plano (decisão 24).
- [x] Golden §12 visível correto na tela (200g, 100/100, 100%, 1100g, 70%/72,73%).
- [x] Strings pt-BR; zero lógica de negócio no DOM.

## Referências
- spec §2.B, §2.C, §2.D, §4, §5.C · mockups/calculadora.html · brandbook §4.1

---

## Plano Técnico

> Escopo: **só UI** (`src/ui/`). O core (§3.B/§3.E/§2.C/§2.D) já está pronto e
> preenchido por `recalculate` (008). Esta issue apenas **lê `store.getState()`
> e escreve DOM**. Zero fórmula nova de negócio; toda soma/produto de exibição
> reusa função pura de `src/core/*` (regra de ouro 2).

### Análise do existente (busca real no código)

O que já existe e será **reusado** (arquivo → símbolo → como):

- **`src/ui/dom.ts`** → `h` / `clear` / `on`: único ponto que toca DOM cru;
  todo texto do usuário (nome de farinha do fermento) entra por `createTextNode`
  (escape XSS, regra 3). **Nunca** `innerHTML`. Reuso obrigatório.
- **`src/ui/state.ts`** → `AppStateStore` (`getState`/`update`/`subscribe`/
  `showCosts`/`setShowCosts`): mesma store da tabela de insumos. `update(mutator)`
  clona + roda `recalculate` (008) + notifica (§1.6). `subscribe` repinta só
  células derivadas — **nunca recriar `<input>` em foco** (mesmo padrão de 014).
- **`src/ui/ingredientsTable.ts`** (014) → padrões a copiar 1:1 (não duplicar
  helpers, extrair os compartilhados): `applyValidation(el, issue, revert)`
  (bloqueio reverte + `setCustomValidity`/`reportValidity`; aviso só anota
  `title`), `moneyPlain(n)` (moeda sem "R$" no campo editável), padrão de par
  `.pw-combo` (valor + `<select>` unidade), `UNIT_OPTIONS` por categoria,
  edição inline `input`→`parseDecimal`→`store.update` + `blur`→valida→reverte,
  `lastValidX` por campo. **Ação**: extrair `applyValidation`, `moneyPlain` e
  `UNIT_OPTIONS` para um `src/ui/cellHelpers.ts` e reusar nos dois módulos
  (hoje são privados de 014 — extrair evita duplicar; regra 2). A linha
  "Fermento" da tabela principal e o **input de Proporção %** já existem em 014
  e **não serão duplicados** (ver decisão abaixo).
- **`src/core/sourdough.ts`** → `partsSum(parts)` (total da coluna Proporção do
  rodapé, §2.B.2), `sourdoughFlourPercentagesSumTo100(flours)` (blur soma 100,
  §2.B.3). Reuso direto — sem reimplementar soma/epsilon.
- **`src/core/costs.ts`** → `ingredientRecipeCost(weight, packageCost)`: coluna
  "Custo" de cada sub-linha de farinha e da linha Água (`SourdoughFlour` **não**
  tem `recipeCost` no tipo — confirmado em `types.ts`; deriva-se para exibição
  reusando esta pura, não multiplicação solta).
- **`src/core/validation.ts`** → `validatePercentageSum(pcts,'fermento')`
  (§5.A/§2.B.3 blur), `validateFlourCount(count,'fermento')` (§5.B mín 1),
  `validateSourdoughParts(parts)` (§5.C ≥0 e soma>0), `validateSourdoughFlourPart`
  (§5.C aviso Farinha=0), `validateNonNegative` (Preço Pago ≥0),
  `validatePackageSize` (Peso do Produto >0). Todas já existem — só fiar.
- **Estado derivado já pronto em `recalculate`/`state.sourdough`** (recalc.ts
  linhas 154–165): `totalWeight` (W_ferm), `iscaWeight`, `flourWeight`
  (Farinha do Fermento), `waterWeight`, `hydration` (`number|undefined`; `null`
  do core vira `undefined` → exibir "—"), `flours[i].weight`,
  `flours[i].costPerGram`, `waterCostPerGram`, `totalCost`, `costPerGram`.
  E em `summary`: `hydration.nominal`/`hydration.real` (`number|null`),
  `realFlourConsumed` (sempre number). **Nada disso é recalculado na UI.**
- **`references/design-system.css`** → reusar: `.card`, `.card > h2`,
  `.sub-recipe-note`, `.table` + `.table.show-costs .cost-col` (mesmo
  mecanismo de colunas de custo de 014), `.cell-input`/`.num`/`.readonly`,
  `.pw-combo`, `.metric-pair`/`.metric .label`/`.metric .value`, `.field`.
  **Nenhuma classe/token novo previsto.** (`.grid-2` do mockup **não existe**
  no design-system — mas é dispensável: o painel de negócios ao lado é da issue
  016; a Hidratação é um `.card` isolado com `.metric-pair`.)
- **`src/ui/seed.ts`** → golden §12 já traz `sourdough.flours[0].flourId ==='flour-1'`
  == `ingredients[0].id`, custo idêntico (R$8/kg). Confirma a herança de custo
  "já bate" no golden e o alvo do vínculo por `flourId`.

### Cenários (números concretos §12 = gabarito)

**Caminho feliz (golden §12, seed atual):** F_total=1000g, Proporção 20% →
W_ferm=200g; Partes 0:1:1 → SomaPartes=2 → Isca 0,0g · Farinha 100,0g · Água
100,0g; Total: Proporção 2, Peso 200,0g. Hidratação resultante = 100/100×100 =
**100,00%**. Custo do fermento = 100g×0,0080 + 100g×0 = **R$0,80**; custo/g do
fermento 0,0040. Farinha do fermento (1 farinha, 100%): Custo/g 0,0080 · Custo
R$0,80. Painel Hidratação: Nominal **70,00%** · Real **72,73%**. Farinha Real
Consumida **1.100,0 g**. (Tabela §2.B.2 exemplo 1:7:7 → 21/147/147, total 15/310
é o outro gabarito de layout — usar como fixture alternativa no teste de rateio.)

**Bordas/erros:**
- **Parte Farinha = 0** (ex. Partes 0:0:1): `sd.hydration` = null → exibir
  **"—"** em "Hidratação resultante" (§5.C, `validateSourdoughFlourPart` → aviso).
  Água/Isca ainda repartem; Custo do fermento continua definido.
- **SomaPartes = 0** (0:0:0): `computeSourdoughWeights` → null; pesos exibidos 0,0
  e "—"; `validateSourdoughParts` **bloqueia** no blur → reverte ao último válido.
- **Parte negativa**: `validateSourdoughParts` bloqueia → reverte.
- **Soma % das farinhas do fermento ≠ 100** no blur: bloqueia e reverte (não
  redistribui, §5.A/§2.B.3).
- **Remover única farinha do fermento**: `validateFlourCount(0,'fermento')`
  bloqueia (botão remover desabilitado quando restaria 0, §5.B).
- **Peso do Produto ≤ 0** (Preço/Peso da farinha ou água do fermento):
  `validatePackageSize` bloqueia → reverte; Custo/g exibe "—".
- **Proporção 0%**: W_ferm=0 → todos os pesos 0,0; custo/g do fermento 0
  (`sourdoughCostPerGram` guard). Painel Farinha Real Consumida = F_total.
- **F_total=0 com fermento>0**: Nominal null → "—"; Real numérico (denominador
  = FarinhaFerm). Já coberto pelo core; UI só exibe "—" no null.

### Testes primeiro (jsdom — `sourdoughTable.test.ts` + `hydrationPanel.test.ts`)

Ambiente `// @vitest-environment jsdom` file-level (mesma justificativa de 014;
default segue `node`). Montagem espelha `mount()` de `ingredientsTable.test.ts`
(`createMemoryStorage` + `createPrefsStore` + `createAppState(goldenSeed())`).

`sourdoughTable.test.ts`:
1. **Layout golden §12** — renderiza linhas Isca/Farinha/Água/Total; asserts:
   Peso Isca `0,0`, Farinha `100,0`, Água `100,0`, Total peso `200,0`, Total
   proporção `2`; "Hidratação resultante" = `100,00%`.
2. **Fixture 1:7:7 (§2.B.2)** — Partes 1:7:7 sobre W_ferm=310 (proporção/f_total
   ajustados) → Pesos `21,0`/`147,0`/`147,0`, Total `15`/`310,0` (arredondamento
   §9 na exibição).
3. **Alterar Parte redistribui mantendo W_ferm (§4)** — parts 0:1:1→1:1:1
   (input Isca 0→1): dispara `input`; pesos repintam para ~`66,7` cada, Total
   peso permanece `200,0` (W_ferm inalterado). Sem recriar input focado.
4. **Hidratação derivada "—" com Farinha=0 (§5.C)** — parte Farinha 1→0 →
   "Hidratação resultante" exibe `—`.
5. **Blur soma farinhas do fermento ≠ 100 reverte (§2.B.3/§5.A)** — 2 farinhas
   100/… ; editar uma para 60, blur → valor revertido; sem redistribuição.
6. **Isca sem campo de custo em nenhum estado (§2.B.2)** — a linha Isca não tem
   `<input>` de Preço Pago nem `.pw-combo`; célula Custo é `readonly` com "—"
   (ou R$ 0,00); vale com `show-costs` ligado e desligado.
7. **XSS (regra 3)** — `flours[0].name = '<script>x</script>'` → `querySelector
   ('script')` é `null`; texto literal presente.
8. **Custo herdado (§4)** — editar Preço Pago da farinha **principal** (via
   `store.update`) reflete no Custo/g da farinha do fermento **não editada**
   manualmente; após editar manualmente o Preço da farinha do fermento, nova
   mudança na principal **não** sobrescreve. (Ver seam de herança abaixo.)
9. **Toggle de custos (§2.A.2)** — colunas de custo do sub-bloco escondidas por
   padrão; após `setShowCosts(true)` a tabela do fermento ganha `.show-costs`.

`hydrationPanel.test.ts`:
10. **Golden §12** — "Nominal" `70,00%`, "Real" `72,73%`, "Farinha Real
    Consumida" `1.100,0 g`.
11. **Nominal "—"** — F_total=0 (esvaziar farinhas via estado) → Nominal exibe
    `—`, Real ainda numérico; sem crash.
12. **Recálculo vivo (§1.6)** — alterar % da Água (70→80) repinta "Nominal" para
    `80,00%` via `subscribe`.

### Arquivos a criar
- `src/ui/sourdoughTable.ts` — `renderSourdoughTable(root, store, editedCostIds)`:
  card "Sub-receita: composição do Fermento" (§2.B). Monta `Peso total do
  fermento` (readonly, W_ferm), a tabela vertical §2.B.2 (colunas Componente ·
  Proporção · Peso (g) · Preço Pago · Peso do Produto · Custo/g · Custo, as 4 de
  custo com `.cost-col` sob o mesmo `show-costs`), linhas Isca/Farinha(+sub-linhas
  por farinha)/Água/Total, e o resumo §2.B.5 (`.metric-pair`: peso total, Isca,
  Farinha, Água, "Hidratação resultante" derivada ou "—", custo total, custo/kg).
  Exporta também `inheritSourdoughFlourCosts(draft, editedCostIds)` (helper puro
  do seam de herança §4).
- `src/ui/hydrationPanel.ts` — `renderHydrationPanel(root, store)`: card
  "Hidratação" com `.metric-pair` (Nominal · Real · Farinha Real Consumida,
  §2.C/§2.D). Farinha Real Consumida visível quando há fermento (W_ferm>0);
  Nominal/Real exibem "—" quando `null`.
- `src/ui/cellHelpers.ts` — extrai `applyValidation`, `moneyPlain`, `UNIT_OPTIONS`
  hoje privados de 014 (reuso, regra 2). *(Se a extração for julgada arriscada
  para 014 no momento, aceitável duplicar mínimo comentando — mas preferir
  extrair.)*
- `src/ui/sourdoughTable.test.ts` (jsdom) — casos 1–9.
- `src/ui/hydrationPanel.test.ts` (jsdom) — casos 10–12.

### Arquivos a modificar
- `src/ui/pages/calculadora.ts` — composition root: após `renderIngredientsTable`,
  criar `const editedCostIds = new Set<string>()`, chamar
  `renderSourdoughTable(app, store, editedCostIds)` e
  `renderHydrationPanel(app, store)` na ordem do mockup (fermento → hidratação).
- `src/ui/state.ts` — **duas** extensões aditivas, retrocompatíveis:
  1. Terceiro parâmetro opcional `normalize?: (draft: Recipe) => void` em
     `createAppState`, chamado dentro de `update` **antes** de `recalculate`
     (ponto único e síncrono para a herança de custo §4; sem re-entrância de
     `subscribe`). Wiring:
     `createAppState(seed, prefs, d => inheritSourdoughFlourCosts(d, editedCostIds))`.
  2. `setShowCosts` passa a chamar `notify()` após `prefs.setShowCosts`, para o
     sub-bloco do fermento sincronizar a classe `.show-costs` via `subscribe`
     (toggle é pref global única, §2.A.2; hoje só a tabela de 014 reage). Estado
     não muda → `notify` sem recalc é seguro; `patchAllDerived` de 014 é inócuo.
  *(Ambas mantêm as chamadas atuais de 014 com 2 args funcionando.)*
- `references/architecture.md` e `PROGRESS.md` — mapa de módulos + Decisões da
  noite (feito pelo escriba ao fim; registrar as decisões abaixo).

### Arquivos que NÃO devem ser tocados
- `src/core/**` (todo o core — sourdough/hydration/costs/recalc/validation/
  types/format/bakers/scaling/pricing): **congelado**. A regra de negócio já
  existe; UI só consome. Em especial **`src/core/types.ts`** — não adicionar
  flag `manuallyEdited` (o seam de herança fica na UI via `editedCostIds`).
- `src/ui/ingredientsTable.ts` — **não** duplicar a linha Fermento nem mover a
  edição da Proporção %; não alterar sua lógica (só extrair helpers p/ cellHelpers
  se feito com cuidado, sem mudar comportamento).
- `src/storage/**`, outras páginas (`receitas.ts`/`historico.ts`), `index.html`
  shell, tokens `:root` do design-system.

### Ordem de implementação
1. Extrair `cellHelpers.ts` (mover `applyValidation`/`moneyPlain`/`UNIT_OPTIONS`);
   reapontar imports de `ingredientsTable.ts` (sem mudar comportamento; suíte de
   014 deve permanecer verde).
2. Extensões aditivas em `state.ts` (normalize + notify no setShowCosts).
3. Escrever `hydrationPanel.test.ts` (10–12) → implementar `hydrationPanel.ts`.
4. Escrever `sourdoughTable.test.ts` (1–7,9) → implementar `sourdoughTable.ts`
   (tabela + resumo + toggle), reusando core/validation/cellHelpers.
5. Implementar `inheritSourdoughFlourCosts` + caso 8 (herança §4); marcar
   `editedCostIds` no blur/edição de Preço Pago/Peso do Produto da farinha do
   fermento.
6. Fiar tudo no composition root; rodar suíte (node + jsdom) e build.

### Decisões tomadas (para revisor humano)
- **Proporção % não é duplicada**: editada apenas na linha "Fermento" da tabela
  principal (014). §2.B.1 diz explicitamente que é "o mesmo valor consumido pela
  linha Fermento"; a sub-receita mostra **W_ferm readonly** ("vem da % acima",
  mockup). Evita dois inputs editáveis do mesmo campo fora de sincronia. "Step 1%"
  (§2.B.1) é semântica de spinner; os campos do app são texto (parseDecimal,
  vírgula/ponto) — não aplicável; documentado.
- **Coluna Proporção da tabela = Partes/`%` das farinhas** (não a proporção do
  fermento). Partes como texto livre (parseDecimal), coerente com os demais campos.
- **Derivados como texto plano (`<td class="readonly">`), não `<input readonly>`**
  — brandbook §4.1 / decisão 24 > mockup (mesma escolha de 014).
- **Herança de custo §4 via UI** (`editedCostIds: Set<flourId>` + normalizador
  pré-recalc em `state.ts`), pois `types.ts` está congelado e não há flag
  `manuallyEdited`. Vínculo por `flourId` ↔ `ingredient.id`.
- **Custo por sub-linha/água** derivado para exibição via `ingredientRecipeCost`
  (core puro), pois `SourdoughFlour` não tem `recipeCost` no tipo.
