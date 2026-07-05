---
id: "030"
titulo: Eliminar unidades de volume (mL/L) — todo ingrediente em peso (g/kg)
tipo: mista
deps: ["002", "006", "010", "011", "014", "015"]
status: done
---

## Contexto

Pedido do usuário (2026-07-05): nenhum ingrediente será mais considerado em
volume — eliminar litros e mililitros do sistema; todos os ingredientes
trabalham só com peso (g/kg).

**Divergência consciente da spec v5 — registrar, não perguntar**: a spec
(`spec/Calculadora_Pao_Fermento_Natural_v5.md`, somente leitura, não editar)
**exige hoje** suporte a volume: §2.A ("entrada opcional em volume... por
líquido, o usuário pode alternar o campo para mL/L... densidade 1 assumida"),
§2.A.1 ("Peso ou Volume do Produto... g, kg, mL ou L"), §2.A.2 (alternador
g/mL na UI), §5.C (validação "Peso/Volume do Produto > 0"), §6 (tipos
`PackageCost.packageUnit: 'g'|'kg'|'mL'|'L'` e `Ingredient.inputUnit:
'weight'|'volume'`), e a tabela de decisões itens 5/13/18. Esta issue
**contradiz essas seções por instrução direta do cliente** — a mudança é
aprovada e definitiva, não uma ambiguidade a resolver sozinho. `revisor-spec`:
**não reportar ausência de volume como achado** — é divergência documentada
aqui e em `PROGRESS.md` → "Decisões da noite"; o `escriba` deve registrar essa
divergência lá.

## Mapeamento do estado atual (já levantado, não precisa re-explorar)

- `src/core/types.ts:19` — `PackageCost.packageUnit: 'g'|'kg'|'mL'|'L'`.
- `src/core/types.ts:31` — `Ingredient.inputUnit?: 'weight'|'volume'`.
- `src/core/costs.ts:50-63` — `packageSizeInGrams(cost)`: `switch` converte
  `'kg'/'L'` ×1000, `'mL'/'g'` ×1 (densidade 1:1, §2.A). **Insight-chave**: como
  a densidade é 1:1, `'L'` e `'kg'` representam a MESMA magnitude, e `'mL'` e
  `'g'` também — a migração de dados existentes é uma **troca de rótulo, não
  uma conversão de valor** (`packageSize` numérico não muda, só o rótulo da
  unidade).
- `src/core/validation.ts:158-161` — `validatePackageSize`: mensagem cita
  "Peso/Volume do produto" (copy a simplificar para "Peso").
- `src/ui/cellHelpers.ts:35-41` — `UNIT_OPTIONS`: `liquid: ['L','mL']`,
  `fat: ['g','kg','mL','L']` (farinha/sal/extra já são só `['kg','g']`) — fonte
  única consumida por `ingredientsTable.ts`/`sourdoughTable.ts`/`batchPanel.ts`.
- `src/ui/ingredientsTable.ts:221-247` — `buildUnitToggle`: par de botões
  "g"/"mL" (só para `category==='liquid'||'fat'`), grava `ing.inputUnit`.
  Chamado só na linha 296. Coluna "Unidade" do `thead` (linha ~214) mostra
  esse toggle ou texto fixo "g" pros sólidos.
- `src/ui/ingredientsTable.ts:466-479` — `<select>` de unidade do "Peso do
  Produto", itera `UNIT_OPTIONS[ing.category]`.
- `src/ui/sourdoughTable.ts:591-599` — select de unidade da Água do Fermento
  (`UNIT_OPTIONS.liquid`) — único uso de volume dentro do fermento.
- `src/ui/seed.ts:56-57,66,89` — `goldenSeed()` **já nasce com `packageUnit:
  'L'`** na Água (receita e fermento) e `inputUnit:'weight'` explícito na Água
  e no Azeite — não é caso de borda, é o default hoje.
- `src/export/xlsx.ts:63-65` — `packageSizeLabel(cost)`: só reflete o
  `packageUnit` salvo em string, sem lógica própria — não precisa mudar (mas
  vai naturalmente parar de emitir "L"/"mL" após a migração).
- **Dados persistidos**: `src/storage/recipes.ts` (chave `mp.recipes.v1`) e
  `src/storage/backup.ts` (envelope `schemaVersion:1`) serializam `Recipe[]`
  cru via `JSON.stringify`/`JSON.parse` + `reviveDates`/`migrateSourdough`
  (recipes.ts:77-118) — **nenhuma migração de unidade existe hoje**. Como o
  seed padrão já usa `'L'`, é praticamente certo que existam receitas salvas
  com `packageUnit∈{'mL','L'}` e possivelmente `inputUnit:'volume'`.
- Testes que exercitam volume hoje (a ajustar/remover, não exaustivo — ver
  levantamento completo se precisar): `core/costs.test.ts` (describe inteiro
  "packageSizeInGrams kg/L→×1000, mL/g→×1"), `core/validation.test.ts:159,163`
  (mensagem "peso/volume"), `ui/ingredientsTable.test.ts` (teste nomeado
  "alternador g/mL da Água: clicar 'mL' não muda o Peso"),
  `ui/sourdoughTable.test.ts:359-382` (fixtures `packageUnit:'L'` com comentário
  de conversão), `storage/recipes.test.ts`/`storage/backup.test.ts` (fixtures
  com `packageUnit` — conferir se alguma usa `'mL'/'L'`).

## O que fazer

1. **`core/types.ts`**: `PackageCost.packageUnit` estreita para `'g'|'kg'`;
   remover o campo `Ingredient.inputUnit` inteiramente (não é mais necessário
   sem alternador peso/volume).
2. **`core/costs.ts`**: `packageSizeInGrams` perde os casos `'L'/'mL'` — só
   `'kg'`×1000, `'g'`×1. Atualizar comentário de cabeçalho (§2.A não se aplica
   mais a volume).
3. **`core/validation.ts`**: mensagem de `validatePackageSize` vira só "Peso do
   produto deve ser maior que zero." (remove "/Volume").
4. **Migração de dados existentes** (novo, ao lado de `migrateSourdough` em
   `storage/recipes.ts`, mesmo padrão): para qualquer `packageCost` com
   `packageUnit==='L'` → vira `packageUnit:'kg'` (mesmo `packageSize`
   numérico); `packageUnit==='mL'` → vira `packageUnit:'g'` (mesmo
   `packageSize`); campo `inputUnit`, se presente, é removido do objeto.
   Aplicar em toda leitura de receita (`recipes.ts`) **e** na restauração de
   backup (`backup.ts`) — mesmos dois pontos que hoje chamam `migrateSourdough`.
5. **`ui/cellHelpers.ts`**: `UNIT_OPTIONS.liquid`/`UNIT_OPTIONS.fat` viram
   `['kg','g']` (igual farinha/sal/extra — remove `'L'`/`'mL'`).
6. **`ui/ingredientsTable.ts`**: remover `buildUnitToggle` e sua chamada;
   decidir com o `arquiteto` se a coluna "Unidade" do `thead` desaparece
   inteira (todo ingrediente é sempre "g" na linha — coluna sem informação) ou
   vira texto fixo "g" sem toggle — recalcular `colspan` de `buildAddRow`/
   `buildTfoot` conforme a decisão. Remover `aria-label` "Usar mililitros
   para…"/"Usar gramas para…" órfãos.
7. **`ui/sourdoughTable.ts`**: sem mudança de código além do que já vem de
   `cellHelpers.ts` (select da Água usa a mesma constante estreitada).
8. **`ui/seed.ts`**: `packageUnit: 'L'` → `'kg'` (Água da receita e do
   fermento, mesmo `packageSize` numérico — é relabel, não conversão); remover
   os dois `inputUnit: 'weight'` (campo deixou de existir).
9. Auditar (grep) qualquer outra string de UI/aria-label/teste mencionando
   "mL"/"litro"/"volume" fora do já listado e limpar.

## Testes exigidos (TDD)

- `core/costs.test.ts`: reescrever o describe de `packageSizeInGrams` só com
  casos `kg`/`g`; remover casos `L`/`mL`.
- `core/validation.test.ts`: atualizar asserts de mensagem (sem "/Volume").
- **Migração** (novo, `storage/recipes.test.ts` e `storage/backup.test.ts`):
  fixture com `packageUnit:'L'`/`'mL'` e `inputUnit:'volume'` → após
  carregar, `packageUnit` vira `'kg'`/`'g'` (mesmo número), `inputUnit`
  ausente. Caso extra: receita sem nada de volume passa incólume (idempotente).
  Aplica-se aos dois pontos: dado guardado em `recipes.ts` e dado de
  backup restaurado.
- `ui/ingredientsTable.test.ts`: remover o teste do alternador g/mL; ajustar
  qualquer teste que dependa do número de colunas/colspan.
  `ui/sourdoughTable.test.ts`: trocar fixtures `packageUnit:'L'` por `'kg'`
  (mesmo valor numérico, comentário deixa de citar "conversão" e passa a citar
  "unidade nativa").
- Suíte completa + `tsc --noEmit` + `vite build` verdes.

## Critérios de aceite

- [ ] Zero opção `'mL'`/`'L'` em qualquer `<select>` do app.
- [ ] Zero alternador "g/mL" em qualquer tela.
- [ ] `PackageCost.packageUnit` só aceita `'g'|'kg'` em tipo (TS falha se
      alguém tentar `'mL'`/`'L'`); `Ingredient.inputUnit` não existe mais.
- [ ] Receitas salvas (`localStorage`) e backups antigos com unidade de volume
      migram automaticamente, sem alterar o `packageSize` numérico (só o
      rótulo da unidade) — nenhuma perda de precisão de custo.
- [ ] `goldenSeed()` não usa mais `'L'`/`inputUnit`.
- [ ] Suíte + build verdes; nenhum achado de "falta suporte a volume" aceito
      do `revisor-spec` (divergência aprovada, ver Contexto acima).

## Referências

- Pedido do usuário 2026-07-05 · spec §2.A, §2.A.1, §2.A.2, §5.C, §6,
  decisões 5/13/18 (divergência registrada, não seguida) · `src/core/types.ts`,
  `src/core/costs.ts`, `src/core/validation.ts`, `src/storage/recipes.ts`
  (`migrateSourdough` como precedente de migração), `src/storage/backup.ts`,
  `src/ui/cellHelpers.ts`, `src/ui/ingredientsTable.ts`,
  `src/ui/sourdoughTable.ts`, `src/ui/seed.ts`, `src/export/xlsx.ts`

---

## Plano Técnico

> Nenhuma dependência externa nova (spec §10/§11.1 — app 100% client-side).
> Migração de dados = aritmética `number` nativa + walk de objeto (trivial, é
> relabel, não conversão — não é caso de "lib consolidada"). Renderização de
> dado do usuário permanece via `dom.ts h()`/`textContent` (escape XSS, regra 3);
> esta issue só REMOVE controles, não adiciona superfície nova de render.

### Análise do existente (grep real, regra de ouro 2)

- `src/core/types.ts:19,31` — `PackageCost.packageUnit: 'g'|'kg'|'mL'|'L'` e
  `Ingredient.inputUnit?: 'weight'|'volume'`. São os dois tipos a estreitar/remover;
  o TS estreitado vira a rede de segurança (AC: `tsc` falha em `'mL'`/`'L'`).
- `src/core/costs.ts:53-63` — `packageSizeInGrams` `switch` com `'kg'|'L'`→×1000
  e `'mL'|'g'`→×1. Reutilizada por `costPerGram` (todo custo deriva daqui, §2.A.1).
- `src/core/validation.ts:158-161` — `validatePackageSize`, única string "peso/volume".
- `src/storage/recipes.ts:97-118` — `migrateSourdough` é o **precedente exato**
  de migração (mesmo padrão: função pura sobre `Record<string,unknown>`,
  idempotente, chamada em `reviveDates:82`). Reusar o molde, não inventar.
- **GAP 1 (não listado na issue, achado no grep)**: `src/storage/recipes.ts:57`
  — `defaultRecipe()` também tem `waterPackageCost: { ... packageUnit: 'L' }`.
  Com o tipo estreitado, isto QUEBRA `tsc`. Precisa virar `'kg'` também.
- **GAP 2 (achado no grep, contradiz o texto da issue)**: `backup.ts:78-83`
  `reviveRecipeDates` **NÃO** chama `migrateSourdough` hoje — logo não há "os
  mesmos dois pontos". Para cumprir o AC "backups antigos migram", a migração de
  volume precisa ser ADICIONADA explicitamente em `reviveRecipeDates`.
- `src/ui/cellHelpers.ts:35-41` — `UNIT_OPTIONS` (fonte única consumida por
  `ingredientsTable.ts:470`, `sourdoughTable.ts` e `batchPanel.ts:565`). Estreitar
  aqui propaga para os 3 `<select>` sem tocá-los individualmente.
- `src/ui/ingredientsTable.ts` — `buildUnitToggle:221-247` (+ chamada `:296`);
  coluna "Unidade" existe em `buildThead:214`, `buildIngredientRow:294-299,497`,
  `buildFlourDisplayRow:535,562`, `buildFermentoRow:590,653`; colspans em
  `buildAddRow:680` (9) e `buildTfoot:698` (2). `patchAllDerived:176-178` escreve
  `packageSize + packageUnit` na célula de farinha (segue emitindo "g"/"kg" ok).
- `src/ui/seed.ts:56-57,66,89` — `packageUnit:'L'` (2×) + `inputUnit:'weight'` (2×).
- `src/export/xlsx.ts:63-65` — `packageSizeLabel` só ecoa a string salva; após
  migração nunca mais emite "L"/"mL". **NÃO tocar** (reuso passivo).

### Decisão sobre a coluna "Unidade" (item 6 da issue — resolvida)

**Remover a coluna "Unidade" inteira** dos 4 pontos da tabela de Ingredientes
(thead + 3 row builders + colspans). Justificativa (uma linha): sem volume, toda
linha é sempre "g" — uma coluna de "g" repetido é ruído sem informação (o header
"Peso (g)" e o rótulo no "Peso do produto" já comunicam gramas; minimalismo do
brandbook §4.1, mesma diretriz da decisão 24). Recalcular: `buildAddRow` colspan
9→8; `buildTfoot` última `<td>` colspan 2→1 (só "Ações").

### Cenários

- **Caminho feliz (golden §12 intacto)**: água `pkg(0,1,'L')`=1000g@R$0 → após
  relabel `pkg(0,1,'kg')`=1000g@R$0 → custo 0 idêntico. Todos os números §12
  (R$ 8,86 · 70%/72,7% · 1100 g · 1041,7 g) **inalterados** — é relabel, não
  conversão. `packageSizeInGrams(kg 1)=1000`, `(g 500)=500`.
- **Borda — migração relabel**: receita salva `packageUnit:'L', packageSize:1`
  → `packageUnit:'kg', packageSize:1` (número intocado, custo/g idêntico).
  `'mL', packageSize:500` → `'g', packageSize:500`. `inputUnit:'volume'` presente
  → removido do objeto.
- **Borda — idempotência**: receita já só com `'kg'/'g'` e sem `inputUnit` passa
  incólume (migração é no-op).
- **Borda — backup antigo**: mesmo relabel ao restaurar (GAP 2 — adicionar chamada).
- **Erro/defensivo (§5.C)**: `packageSize<=0` → `costPerGram` null (comportamento
  já existente, preservado); mensagem de `validatePackageSize` só "Peso".

### Testes primeiro (TDD — core/storage antes da implementação)

- `core/costs.test.ts` (reescrever describe `packageSizeInGrams`):
  - `packageSizeInGrams(pkg(0,1,'kg'))` → `1000`.
  - `packageSizeInGrams(pkg(0,500,'g'))` → `500`.
  - remover asserts `'L'`/`'mL'` (linhas 56-57); trocar todos os `pkg(...,'L')`
    de água (69,89,97,103,111,128,151) por `pkg(...,'kg')` mantendo a magnitude
    em gramas (1 L = 1000 g = `pkg(0,1,'kg')`) — custo esperado idêntico.
- `core/validation.test.ts:159,163`: `expect(bad?.message).toBe('O peso do produto
  deve ser maior que zero.')` (sem "/Volume").
- `storage/recipes.test.ts` (NOVOS, molde do teste de `migrateSourdough`):
  - fixture `packageUnit:'L', packageSize:2, inputUnit:'volume'` em um ingrediente
    → após `list()/get()`: `packageUnit==='kg'`, `packageSize===2`, `'inputUnit'
    not in` objeto.
  - fixture `packageUnit:'mL', packageSize:250` → `'g'`, `250`.
  - migrar também `sourdough.waterPackageCost` e `sourdough.flours[].packageCost`.
  - idempotência: receita `'kg'/'g'` sem `inputUnit` → inalterada.
  - trocar fixtures `waterPackageCost:'L'` existentes (36,205) por `'kg'`.
- `storage/backup.test.ts` (NOVOS): mesma fixture de volume dentro do envelope →
  após `importBackup(json)`, receitas vêm com `'kg'/'g'` e sem `inputUnit`.
  Trocar fixtures `'L'` (47,74) por `'kg'`.
- Ajustes de compilação (o tipo estreitado quebra `tsc` nos helpers `pkg`):
  `scaling.test.ts:28`, `recalc.test.ts:30`, `golden-example.test.ts:23`,
  `xlsx.test.ts:27` — `FREE_WATER = pkg(0,1,'L')` → `pkg(0,1,'kg')`.
  `sourdoughTable.test.ts:360,382` → `'kg'` (comentário deixa de citar "conversão").
- `ui/ingredientsTable.test.ts`: **remover** o teste 6 (alternador g/mL, 95-108);
  auditar qualquer contagem de coluna/colspan (nenhum assert atual depende de 9,
  mas confirmar após remover a coluna).

### Arquivos a criar

- Nenhum arquivo novo. A migração é uma função exportada de `recipes.ts`
  (reuso pelo `backup.ts`, regra 2 — sem novo módulo para uma função de relabel).

### Arquivos a modificar

1. `src/core/types.ts` — `packageUnit: 'g'|'kg'`; remover `Ingredient.inputUnit`;
   atualizar comentário `:18` ("peso do produto").
2. `src/core/costs.ts` — `packageSizeInGrams`: só `'kg'`×1000 / `'g'`×1; atualizar
   cabeçalho e comentário §2.A (densidade de volume não se aplica mais).
3. `src/core/validation.ts:158-161` — mensagem "Peso do produto deve ser maior
   que zero." (sem "/Volume"), comentário idem.
4. `src/storage/recipes.ts` — (a) `defaultRecipe():57` `'L'`→`'kg'` [GAP 1];
   (b) nova função **exportada** `migrateVolumeUnits(r)` ao lado de
   `migrateSourdough`, chamada em `reviveDates` após `migrateSourdough`; percorre
   `ingredients[].packageCost`, `sourdough.waterPackageCost`,
   `sourdough.flours[].packageCost` (`'L'`→`'kg'`, `'mL'`→`'g'`, `packageSize`
   intocado) e `delete f.inputUnit` de cada ingrediente. Idempotente.
5. `src/storage/backup.ts` — importar `migrateVolumeUnits` e chamá-la em
   `reviveRecipeDates:78-83` [GAP 2] (regra 2: reusa a mesma função, sem duplicar).
6. `src/ui/cellHelpers.ts:35-41` — `liquid:['kg','g']`, `fat:['kg','g']`;
   atualizar comentário `:32-33` (remover "volume"/"mL/L").
7. `src/ui/ingredientsTable.ts` — remover `buildUnitToggle` (221-247) + chamada
   (296); remover a coluna "Unidade" (thead 214; `unitCell` em 294-299/497,
   535/562, 590/653); `buildAddRow` colspan 9→8 (680); `buildTfoot` colspan 2→1
   (698); remover aria-labels órfãos "Usar mililitros/gramas para…".
8. `src/ui/seed.ts:56,89` — `'L'`→`'kg'`; remover `inputUnit:'weight'` (57,66).
9. `src/core/costs.test.ts`, `src/core/validation.test.ts`,
   `src/storage/recipes.test.ts`, `src/storage/backup.test.ts`,
   `src/ui/ingredientsTable.test.ts`, `src/core/scaling.test.ts`,
   `src/core/recalc.test.ts`, `src/core/golden-example.test.ts`,
   `src/export/xlsx.test.ts`, `src/ui/sourdoughTable.test.ts` — conforme "Testes
   primeiro".

### Arquivos que NÃO devem ser tocados

- `src/export/xlsx.ts` (`packageSizeLabel` ecoa a string migrada — reuso passivo).
- `src/ui/sourdoughTable.ts` (o `<select>` da Água herda de `UNIT_OPTIONS`
  estreitado — zero mudança de código, item 7 da issue confirmado).
- `src/ui/batchPanel.ts` (farinhas já são só `['kg','g']`; herda `UNIT_OPTIONS`).
- `spec/Calculadora_Pao_Fermento_Natural_v5.md` (somente leitura; divergência
  registrada aqui e em `PROGRESS.md`, não editar a spec).
- Núcleo de cálculo além de `packageSizeInGrams` (fórmulas §12 intocadas).

### Ordem de implementação (TDD)

1. Escrever/ajustar os testes (bloco "Testes primeiro") — devem falhar/quebrar `tsc`.
2. `core/types.ts` (estreitar tipo + remover `inputUnit`) — dispara os erros `tsc`
   que guiam o resto.
3. `core/costs.ts` + `core/validation.ts` (satisfaz testes core).
4. `storage/recipes.ts` (`defaultRecipe` + `migrateVolumeUnits`) + `storage/backup.ts`.
5. `ui/cellHelpers.ts` (estreitar `UNIT_OPTIONS`).
6. `ui/ingredientsTable.ts` (remover toggle + coluna + colspans) e `ui/seed.ts`.
7. `grep -rn "'mL'\|'L'\|inputUnit\|volume\|litro\|mililitro"` final para varredura.
8. Suíte Vitest verde + `tsc --noEmit` + `vite build` verdes.
