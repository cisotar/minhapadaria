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
