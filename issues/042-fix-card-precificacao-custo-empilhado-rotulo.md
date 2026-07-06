---
id: "042"
titulo: Card Precificação — custo read-only no topo, campos empilhados, rótulo "% de lucro"
tipo: fix
deps: ["041", "016"]
status: todo
---

## Contexto
Pedido do cliente (2026-07-06), sobre o card de Precificação
(`src/ui/pricingPanel.ts`, issue 016). Três ajustes de UI, todos consumindo o
core já corrigido pela issue 041 (markup-sobre-custo — não há lógica de negócio
nova aqui):

1. Exibir o **Custo unitário** dentro do trio, como **primeiro item** e
   **somente leitura** (derivado dos ingredientes via `summary.costPerUnit`;
   sem entrada manual — cliente pediu explicitamente só exibição).
2. **Empilhar os campos verticalmente** (não mais lado a lado), na ordem de cima
   para baixo: Custo unitário → Lucro unitário → % de lucro → Preço de venda.
3. **Renomear** o rótulo "Margem %" para **"% de lucro"** (e o `aria-label`).

## O que fazer
- `src/ui/pricingPanel.ts`:
  - Trocar o rótulo/`aria-label` do campo de margem: "Margem %" → "% de lucro".
    O `mode` interno permanece o que a issue 041 definir (`'margin'` mantido por
    compat, ou renomeado se 041 renomeou) — sem introduzir divergência.
  - Adicionar o **Custo unitário** como primeiro item empilhado, read-only
    (reuso `.readonly`/`.input` do design-system; texto via `formatCurrency`,
    "—" quando `costPerUnit === null`). Pode sair da tabela de totais atual e
    virar o 1º item do bloco empilhado; a linha "Custo unitário" da tabela de
    totais pode ser removida para não duplicar (decidir no plano — não exibir o
    mesmo dado duas vezes).
  - Empilhar: substituir o layout lado-a-lado (`.row.row--end` do trio) por
    coluna vertical (ex.: `.field`s empilhados numa coluna; reuso das classes de
    layout já existentes no design-system, sem valor bruto novo). Ordem: Custo →
    Lucro unitário → % de lucro → Preço de venda.
  - Manter a proteção `activeField` (campo em edição não sobrescrito), o `blur`
    que formata (§9), o chip de status e os totais (Receita total, Lucro total).
  - Nenhum número calculado na UI — tudo vem de `summary`/`recipe.pricing`
    (`recalculate`). Sem hex/valor bruto novo (só tokens/classes do design-system).
- Guardião-design roda depois (auditoria de tokens/tipografia/estados) — manter
  aderência ao design-system.

## Testes exigidos (TDD — `pricingPanel.test.ts`)
- Rótulo do campo de percentual é "% de lucro" (e `aria-label`); não existe mais
  "Margem %".
- Custo unitário aparece como primeiro item do bloco, read-only (não é `input`
  editável / não dispara `store.update` ao receber foco/digitação).
- Ordem vertical dos campos: Custo → Lucro unitário → % de lucro → Preço de
  venda (assertar a sequência no DOM).
- Sincronia mantida: digitar em "% de lucro" → Preço de venda e Lucro unitário
  repintam a partir do custo (via store/recalc já testado na 041); campo em
  edição não é sobrescrito.
- Custo unitário indeterminado (`costPerUnit === null`) → exibe "—".
- Chip de status e totais seguem funcionando (não regredir os casos da 016/024).

## Critérios de aceite
- [ ] Rótulo "% de lucro" no lugar de "Margem %" (visível + `aria-label`).
- [ ] Custo unitário exibido, read-only, como 1º item empilhado; não duplicado
      na tabela de totais.
- [ ] Campos empilhados na ordem Custo → Lucro unitário → % de lucro → Preço.
- [ ] Trio sincronizado e proteção do campo em edição intactos.
- [ ] Sem lógica de cálculo na UI; sem hex/valor bruto novo (só design-system).
- [ ] `pricingPanel.test.ts` cobre os casos; suíte inteira verde e `tsc` limpo.

## Referências
- `spec.md` (ciclo bugfix precificação) · pedido do cliente 2026-07-06 ·
  `src/ui/pricingPanel.ts` (issue 016) · `src/ui/cellHelpers.ts` ·
  `src/core/format.ts` · `references/design-system.css` · depende dos números
  da issue 041 (markup-sobre-custo).

## Plano Técnico

Issue tipo **fix** (processo leve): zero lógica nova — o core markup-sobre-custo
já foi entregue e testado na 041 (`src/core/pricing.ts`, commit 15bc803). Aqui
só muda rótulo, um campo read-only e o layout do card.

### Análise do existente (busca real no código + design-system)
- `src/ui/pricingPanel.ts` (issue 016): monta o card. Reutiliza `buildTrioField`
  (fábrica de `.field` + `<input class="input num">` com `activeField`/`sync`/
  `blur` que formata, §1.6/§9) — **estender**, não reescrever. O trio é montado
  em `trioRow = h('div',{className:'row row--end'})` (linhas 60, 134-136) e os
  totais numa `table.table.mt-3` cuja 1ª linha é `['Custo unitário', unitCostCell]`
  (linhas 140-151, 178). `repaint()` (153-183) já lê `summary.costPerUnit` e o
  escreve em `unitCostCell` via `formatCurrency`/"—" — a lógica de exibição do
  custo **já existe**, só muda o alvo (do `<td>` da tabela para o novo campo do
  topo).
- `src/ui/cellHelpers.ts`: `setDerivedDisplay(el,text)` (linhas 69-72) escreve em
  `<input readonly>` via `.value` — **reusar** para pintar o Custo unitário
  read-only (regra de ouro 2, mesmo padrão de `ingredientsTable`/`batchPanel`).
  `moneyPlain`/`marginChipClass`/`applyValidation` seguem em uso, sem mudança.
- `src/core/format.ts`: `formatCurrency` (moeda com "R$"), `formatPercent`
  (2 casas) — donos únicos, reusados sem tocar.
- `src/core/pricing.ts`: mantém `priceInputMode='margin'`/`profitMargin` (041 os
  preservou por compat de localStorage, spec §16 "Estruturas"); a UI não muda o
  identificador interno — só o rótulo visível. Decisão registrada: **manter
  `'margin'`/`profitMargin`** (evita migração de dados; semântica já é markup).
- `references/design-system.css` (é o stylesheet real, importado por
  `src/ui/pages/*.ts` via Vite): `.field` (flex column, gap `--sp-1`, linha 193),
  `.input`, `.readonly`/`.input[readonly]` (transparente, sem borda, linhas
  211-217), `.chip-*`, `.table`, `.num` — todos reusados. **Não existe** classe
  utilitária genérica de coluna com gap (só `.row`/`.row--end` horizontais e
  colunas escopadas a `.recipe-card`). Decisão: adicionar **uma** utilitária
  documentada tokens-only `.stack { display:flex; flex-direction:column;
  gap: var(--sp-3); }` (permitido pela regra do design-system: só tokens +
  documentada) para empilhar os 4 campos — reusável, sem hex/valor bruto novo.
- Escopo confinado: só `pricingPanel.test.ts` referencia o DOM deste card
  (verificado por grep; `bakeForm.test.ts`/`recipesList.test.ts` só citam em
  comentário). `recipesList.ts`/`historyView.ts`/`export/*` também usam a palavra
  "Margem", mas **fora do escopo desta issue** — não tocar.

### Cenários (números do seed atual: Custo unitário R$4,30, spec §12/041)
- **Feliz** — digitar `40` em "% de lucro" → Preço `6,02` (4,30×1,40) e Lucro
  `1,72` (4,30×0,40); campo em foco não é reformatado (§3.E/§1.6, já é o test 7).
- **Custo no topo** — `summary.costPerUnit=4,30` → 1º campo read-only exibe
  "R$ 4,30" (`formatCurrency`); não dispara `store.update` (spec AC40).
- **Custo indeterminado** — `costPerUnit === null` (sem ingredientes válidos) →
  1º campo exibe "—" (spec AC40).
- **Ordem** — de cima p/ baixo: Custo unitário → Lucro unitário → % de lucro →
  Preço de venda (spec §11.3/AC45).
- **Prejuízo** — forçar `salePrice=1` (< custo 4,30) → chip `chip-crit`
  "Prejuízo R$…" + `.loss` (§4, já é o test 8).
- **% acima de 100 / negativo** — `150` aceito e formatado "150,00"; `-10`
  bloqueia (`validateMargin`, sem teto, só piso 0) e reverte (§5.C, já é test 9).

### Testes primeiro (ajustar `pricingPanel.test.ts` ANTES do source)
Seletores/asserções a **mudar** (o source atual ainda usa "Margem %"):
- Linha 45: `input[aria-label="Margem %"]` → `input[aria-label="% de lucro"]`.
- Linha 61: `expect(chip.textContent).toBe('Margem 40,00%')` →
  `toBe('Lucro 40,00%')` (decisão de chip abaixo).
- Linha 75: `input[aria-label="Margem %"]` → `input[aria-label="% de lucro"]`.

Casos **novos** a adicionar (um por comportamento):
1. Rótulo/`aria-label` do percentual é "% de lucro" e **não existe** mais
   `input[aria-label="Margem %"]` (`root.querySelector(...)` === null).
2. Custo unitário é o **1º** campo e é read-only: `costInput.readOnly === true`
   e disparar `input`/`focus` nele **não** altera `store.getState().recipe.pricing`.
3. Exibição do custo: seed → 1º campo `.value === 'R$ 4,30'`.
4. Custo indeterminado: `mount(r => r.ingredients = [])` (ou zerar custos) →
   1º campo `.value === '—'`.
5. Ordem vertical: `[...root.querySelectorAll('.stack .field label')]
   .map(l => l.textContent)` === `['Custo unitário','Lucro unitário',
   '% de lucro','Preço de venda']`.
(Sincronia e prejuízo já cobertos pelos tests 7/8/9 ajustados.)

### Decisões (uma linha cada)
- **Chip** hoje = `Margem ${formatPercent(margin)}%` (linha 168). Vira
  `Lucro ${formatPercent(margin)}%` → "Lucro 40,00%": coerente com o rótulo
  "% de lucro" sem o feio "% de lucro 40,00%" (duplo "%"). Mensagem de prejuízo
  inalterada.
- **Custo unitário** renderizado como `.field` (label "Custo unitário" +
  `<input class="input num readonly" readonly aria-label="Custo unitário">`),
  pintado por `setDerivedDisplay` com `formatCurrency`/"—" — mantém alinhamento
  de rótulo idêntico aos irmãos e reusa `.readonly` (sem borda).
- **Tabela de totais**: **remover** a linha "Custo unitário" (o dado migra p/ o
  topo) — não exibir o mesmo valor duas vezes (issue §"O que fazer"; AC "não
  duplicado"). Totais restantes: Receita total + Lucro total, inalterados.
- **Layout**: trocar `trioRow` (`.row.row--end`) por `.stack` e anexar os 4
  campos na ordem Custo → Lucro → % de lucro → Preço.

### Segurança/privacidade
Sem dado de usuário livre: todos os valores são numéricos derivados do core,
escritos via `.value`/`.textContent`/`setDerivedDisplay` (sem `innerHTML`).
100% client-side, sem rede, sem secret (spec §10/§11.1). OK.

### Arquivos a criar
- (nenhum)

### Arquivos a modificar
- `src/ui/pricingPanel.ts`: renomear rótulo/`aria-label` "Margem %" → "% de
  lucro"; criar campo Custo unitário read-only como 1º item; empilhar em `.stack`
  na nova ordem; remover a linha "Custo unitário" da tabela de totais; redirecionar
  a pintura do custo em `repaint()` para o novo campo (via `setDerivedDisplay`);
  chip → "Lucro …%"; atualizar o docstring do módulo (mencionar markup/§041,
  novo rótulo e layout empilhado).
- `src/ui/pricingPanel.test.ts`: os 3 seletores/asserção acima + os 5 casos novos.
- `references/design-system.css`: adicionar `.stack` (flex column, gap
  `var(--sp-3)`), tokens-only, com comentário documentando o uso (mesmo padrão
  dos utilitários `.mt-3`/`.row--mb`).

### Arquivos que NÃO devem ser tocados
- `src/core/pricing.ts`, `src/core/validation.ts`, `src/core/format.ts` (core já
  correto — 041).
- `src/ui/cellHelpers.ts` (só reuso de `setDerivedDisplay`).
- `src/ui/recipesList.ts`, `src/ui/historyView.ts`, `src/export/*` (usam "Margem"
  fora do escopo desta issue).
- `src/ui/seed.ts`, `golden-example.test.ts` (fixture próprio, §12/AC25).

### Ordem de implementação
1. Ajustar `pricingPanel.test.ts` (3 trocas de seletor/asserção + 5 casos novos)
   → rodar Vitest e ver os novos falharem (vermelho esperado).
2. `references/design-system.css`: adicionar `.stack` documentado.
3. `pricingPanel.ts`: campo Custo read-only, `.stack` na nova ordem, remover linha
   do custo dos totais, redirecionar pintura, rótulo "% de lucro", chip "Lucro …%",
   docstring.
4. `npx vitest run` (suíte inteira verde) + `npx tsc --noEmit` limpo.

## Riscos identificados
- Nova classe `.stack` toca o stylesheet real; é tokens-only e documentada
  (dentro da regra), mas fica sob auditoria do guardião-design depois.
- Tensão leve com spec AC47 ("Custo unitário total" na tabela de totais): o valor
  é per-unit (mesmo do topo), então removê-lo dos totais evita duplicação sem
  perda de informação — AC40 + corpo da issue prevalecem.
- Chip "Lucro …%" diverge de `recipesList`/`historyView` que ainda dizem "Margem";
  alinhamento global desses cards fica para issue futura (fora deste escopo).
