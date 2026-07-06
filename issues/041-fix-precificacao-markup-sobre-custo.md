---
id: "041"
titulo: Precificação — trocar margem-sobre-preço por markup-sobre-custo (% de lucro)
tipo: fix
deps: ["007", "008"]
status: todo
---

## Contexto
Pedido do cliente (2026-07-06): o campo de percentual do card de Precificação
deve ser a **taxa de lucro que o cliente quer ganhar sobre o custo** — markup
sobre o custo — e não a margem sobre o preço. Exemplo do cliente: *produto
custa 100, quer ganhar 20% → digita 20 → vende por 120*.

Hoje (`pricing.ts`, issue 007/§3.E) o modo Margem% usa **margem sobre o preço**:
`preço = custo / (1 − margem/100)`. Isso faz o preço explodir perto de 100%
(custo R$5, margem 95% → R$100; 99,9% → R$5000) — o "bug" relatado para valores
> ~95%. A conta está consistente com a definição antiga, mas a definição é que
muda. Ver `spec.md` (ciclo bugfix precificação).

⚠️ **Contraria a spec v5 §3.E e o exemplo validado §12** (margem 40% → preço
7,38333). A nova definição vira a fonte da verdade do produto — o golden e os
testes de precificação precisam ser reescritos para os novos números.

## O que fazer
- `src/core/pricing.ts`:
  - `priceFromMargin(unitCost, p)` → markup: `salePrice = unitCost × (1 + p/100)`;
    `profitPerUnit = salePrice − unitCost` (= `unitCost × p/100`); devolver
    `profitMargin: p`. Renomear é opcional (ver Decisões) — manter a assinatura
    de 3 modos sincronizados.
  - `priceFromSalePrice(unitCost, salePrice)`: `profitPerUnit = salePrice −
    unitCost`; `profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) × 100 : 0`
    (denominador passa a ser o CUSTO, com guarda ÷0 em custo 0).
  - `priceFromProfit(unitCost, profitPerUnit)`: `salePrice = unitCost +
    profitPerUnit`; `profitMargin = unitCost > 0 ? (profitPerUnit / unitCost) ×
    100 : 0` (denominador CUSTO, guarda ÷0).
  - Remover `MARGIN_MAX` (99,9) e `clampMargin` do caminho de markup — o teto só
    existia para evitar ÷0 na fórmula margem-sobre-preço (divisor `1 − m/100`),
    que deixa de existir. `p` livre em `[0, +∞)`. Manter `MARGIN_MIN = 0` como
    piso (sem lucro negativo por esta via). Decidir no plano se remove o símbolo
    `MARGIN_MAX` de vez ou mantém por compat de import.
- `src/core/validation.ts`:
  - `validateMargin`: remover o teto 99,9%. Bloquear só `< 0` (mensagem ajustada:
    "% de lucro não pode ser negativa."). Reusar `MARGIN_MIN`.
- Sem arredondamento interno (§9): valores crus; `format.ts` arredonda na
  exibição. Sem throw/NaN/Infinity (§5.C): custo 0 / custo `null` fluem sem
  colapsar (o recalc em lote não pode ser interrompido).
- NÃO tocar em `costs.ts` nem no cálculo do custo unitário (`unitCost` inalterado).

## Testes exigidos (TDD — primeiro, depois implementação)
- `pricing.test.ts`:
  - `priceFromMargin`: custo 5, p 20 → preço 6, lucro 1, profitMargin 20.
  - markup alto sem explodir: custo 5, p 200 → preço 15, lucro 10.
  - `priceFromSalePrice`: custo 5, preço 6 → lucro 1, %lucro 20.
  - `priceFromProfit`: custo 5, lucro 1 → preço 6, %lucro 20.
  - guarda ÷0: custo 0 nos três modos → sem NaN/Infinity; `profitMargin` 0 onde
    o custo é denominador.
  - sincronia dos 3 modos: os três pontos de entrada reconstroem o mesmo trio
    consistente sobre um custo dado.
  - "sem arredondamento interno" (§9) permanece.
- `recalc.test.ts`: dispatch por `priceInputMode` continua correto com os novos
  números; propagação de `null` (custo indeterminado) intacta.
- `golden-example.test.ts`: recomputar os valores esperados de preço/lucro/%
  para markup-sobre-custo a partir do MESMO custo unitário do §12 e travar os
  novos números (documentar a conta no teste).

## Critérios de aceite
- [ ] Os três modos usam markup-sobre-custo; `profitMargin` = lucro/custo × 100.
- [ ] Preço não explode perto de 100%; `p` aceita valores > 100%.
- [ ] Sem teto 99,9%; `validateMargin` bloqueia só negativo.
- [ ] Custo 0 / custo `null` não produzem NaN/Infinity nem throw.
- [ ] `unitCost` e `costs.ts` inalterados.
- [ ] `pricing.test.ts`, `recalc.test.ts`, `golden-example.test.ts` verdes com os
      novos números; suíte inteira verde (`npm test`) e `tsc` limpo.

## Referências
- `spec.md` (ciclo bugfix precificação) · pedido do cliente 2026-07-06 ·
  `src/core/pricing.ts` (issue 007) · `src/core/recalc.ts` (008) ·
  `src/core/validation.ts` (010) · `src/core/golden-example.test.ts` · spec v5
  §3.E/§4/§5.C/§12 (definição antiga — sobrescrita por esta issue).

## Plano Técnico

### Análise do existente (busca real no código)
- `src/core/pricing.ts` (dono único das fórmulas): `priceFromMargin` usa hoje
  `salePrice = unitCost / (1 − m/100)` com `clampMargin` (spec v5 §3.E, decisão 4);
  `priceFromSalePrice`/`priceFromProfit` usam `salePrice` como denominador de
  `profitMargin`. Reusar as três assinaturas (retorno `PricingBreakdown` intacto),
  `unitCost`, `effectiveQuantity`, `pricingTotals`, `marginStatus`, `isLoss` — só
  troca a aritmética interna dos três pontos de entrada.
- `MARGIN_MAX`/`clampMargin`: importados/usados APENAS em `pricing.ts`,
  `pricing.test.ts` e `validation.ts` (grep confirmado). `MARGIN_MIN` segue vivo
  (piso). `pricingPanel.ts` NÃO importa nenhum dos dois — só `validateMargin`
  (assinatura preservada) → UI não quebra.
- `src/core/recalc.ts` (dono do dispatch §3.E, passo 6): despacha por
  `priceInputMode` para as três funções puras e propaga `null` (custo
  indeterminado) sem colapsar. NÃO muda — só herda os novos números.
- `src/core/validation.ts`: `validateMargin` reusa `MARGIN_MIN`/`MARGIN_MAX` e
  `isLoss` (donos únicos). Troca: remover teto, bloquear só `< 0`.
- Regra de ouro #1 (libs): fórmula é o core de cálculo do produto (aritmética
  pura) — sem lib externa, sem chamada de rede, sem secret (§10/§11.1). Nada a
  consultar na web.

### Cenários (números concretos)
Fonte da verdade NOVA: `preço = custo × (1 + p/100)`, `lucro = custo × p/100`,
`profitMargin = custo > 0 ? (lucro/custo) × 100 : 0` (§ spec.md "Regras de Negócio").
- Feliz (exemplo do cliente): custo 100, p 20 → preço 120, lucro 20.
- Golden §12 recomputado (MESMO `unitCost = 8,86/2 = 4,43`, p 40):
  - `P = 4,43 × 1,40 = 6,202`
  - `L = 4,43 × 0,40 = 1,772`
  - `profitMargin = 40`
  - Totais (q=2): `totalProductionCost = 4,43 × 2 = 8,86`;
    `totalRevenue = 6,202 × 2 = 12,404`; `totalProfit = 12,404 − 8,86 = 3,544`
    (= `L × 2 = 3,544`). ⚠️ Substitui o §12 antigo (7,38333 / 2,95333 / 14,76666
    / 5,90666).
- Borda markup alto (o "bug" some): custo 5, p 200 → preço 15, lucro 10 (linear,
  finito, sem teto). p aceita `[0, +∞)`.
- Erro/÷0 (§5.C, sem throw/NaN/Infinity): denominador de `profitMargin` passa a
  ser o CUSTO; guarda `custo > 0 ? … : 0` em `priceFromSalePrice`/`priceFromProfit`.
  Em `priceFromMargin` o custo não é denominador (`profitMargin = p` direto), logo
  custo 0 → preço 0, lucro 0, `profitMargin = p`. Custo `null` continua barrado
  antes de chamar pricing (recalc passo 6), fluindo como `null`.

### Testes primeiro (TDD — escrever ANTES; travar os novos números)
`src/core/pricing.test.ts` (reescrever os casos que assumiam margem-sobre-preço):
1. `priceFromMargin(5, 20)` → `{salePrice 6, profitPerUnit 1, profitMargin 20}`.
2. markup alto sem explodir: `priceFromMargin(5, 200)` → `{15, 10, 200}`;
   `Number.isFinite(salePrice) === true`.
3. golden §12: `priceFromMargin(4.43, 40)` → `{6.202, 1.772, 40}` (toBeCloseTo).
4. `priceFromSalePrice(5, 6)` → `{profitPerUnit 1, profitMargin 20, salePrice 6}`.
5. `priceFromProfit(5, 1)` → `{salePrice 6, profitMargin 20, profitPerUnit 1}`.
6. sincronia dos 3 modos sobre `uc = 4.43`: `byMargin = priceFromMargin(uc,40)`;
   `priceFromSalePrice(uc, byMargin.salePrice)` e `priceFromProfit(uc,
   byMargin.profitPerUnit)` reconstroem o mesmo trio `{6.202, 1.772, 40}`.
7. guarda ÷0 (custo 0), sem NaN/Infinity:
   - `priceFromSalePrice(0, 6)` → `profitMargin 0`, `profitPerUnit 6`.
   - `priceFromProfit(0, 1)` → `profitMargin 0`, `salePrice 1`.
   - `priceFromMargin(0, 20)` → `salePrice 0`, `profitPerUnit 0`, `profitMargin 20`;
     `Number.isNaN` false em todos.
8. §9 sem arredondamento interno: `priceFromMargin(4.43,40).salePrice !== 6.20`
   e `.profitPerUnit !== 1.77` (valores crus 6.202 / 1.772).
9. `pricingTotals(4.43, 6.202, 2)` → `{8.86, 12.404, 3.544}` (fórmula inalterada).
10. `marginStatus`/`isLoss`/`unitCost`/`effectiveQuantity`/`MARGIN_MIN`: casos
    atuais permanecem. REMOVER os testes de `clampMargin` e a asserção
    `MARGIN_MAX === 99.9` (símbolos deixam de existir).

`src/core/recalc.test.ts`: dispatch por `priceInputMode` e propagação de `null`
já cobertos e SEM asserção numérica de preço/lucro → permanecem verdes sem
edição (confirmar rodando; não alterar).

`src/core/golden-example.test.ts`: no bloco de precificação e no de totais,
trocar os números para os recomputados acima e documentar a conta no `it(...)`:
- `salePrice ≈ 6.202`, `profitPerUnit ≈ 1.772`, `profitMargin 40`,
  `costPerUnit 4.43`.
- `totalProductionCost 8.86`, `totalRevenue ≈ 12.404`, `totalProfit ≈ 3.544`.

`src/core/validation.test.ts` (caso 9): `validateMargin(100)` → `null` (OK agora);
`validateMargin(-1)` → block com mensagem `"% de lucro não pode ser negativa."`;
remover a asserção de teto 99,9.

### Arquivos a criar
- Nenhum.

### Arquivos a modificar
- `src/core/pricing.ts`: reescrever `priceFromMargin` (markup: `P = uc×(1+p/100)`,
  `L = uc×p/100`, `profitMargin: p`), `priceFromSalePrice` e `priceFromProfit`
  (denominador CUSTO com guarda `unitCost > 0 ? … : 0`); remover `MARGIN_MAX` e
  `clampMargin`; manter `MARGIN_MIN`; atualizar docstrings (§3.E → markup, retirar
  "margem sobre o preço" e "decisão 4/teto 99.9").
- `src/core/validation.ts`: `validateMargin` bloqueia só `< 0` (reusa
  `MARGIN_MIN`), mensagem `"% de lucro não pode ser negativa."`; remover
  `MARGIN_MAX` do import de `./pricing`.
- `src/core/pricing.test.ts`, `src/core/golden-example.test.ts`,
  `src/core/validation.test.ts`: conforme "Testes primeiro". Remover imports de
  `MARGIN_MAX`/`clampMargin` em `pricing.test.ts`.

### Arquivos que NÃO devem ser tocados
- `src/core/recalc.ts` (dispatch já correto; só herda números).
- `src/core/costs.ts` e todo o cálculo de `unitCost`/custo unitário.
- `src/ui/pricingPanel.ts` e demais UI (empilhamento/rótulo "% de lucro"/custo no
  topo são escopo de OUTRA issue; `validateMargin` mantém assinatura → nada quebra
  aqui).
- `src/export/*`, `src/storage/*` (usam `profitMargin` como número; semântica muda,
  identificador não — sem migração de localStorage).

### Ordem de implementação
1. Reescrever/rever os testes (pricing, golden, validation) com os números novos —
   suíte fica VERMELHA (TDD).
2. `pricing.ts`: markup nas três funções + remoção de `MARGIN_MAX`/`clampMargin`.
3. `validation.ts`: `validateMargin` só-negativo + ajuste do import.
4. `npm test` (incl. recalc.test.ts sem edição) + `tsc --noEmit` limpos.
