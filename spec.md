# Spec: Bugfix Card de Precificação (custo + trio empilhado + % de lucro sobre custo)

## Visão Geral

Ajuste no card **Precificação** da Calculadora de Pão (`src/ui/pricingPanel.ts`, app MPA já existente, spec v5). Pedido do cliente, três partes:

1. **Redefinir o campo de percentual.** Hoje o card tem "Margem %", calculada como **margem sobre o preço** (`margem = lucro / preço`, logo `preço = custo / (1 − margem/100)`). Isso faz o preço explodir perto de 100% (ex.: custo R$5, margem 95% → preço R$100; margem 99,9% → preço R$5000) — o "bug" relatado pelo cliente para valores acima de ~95%. A conta está matematicamente consistente com a definição atual, mas **não é a definição desejada**. O campo passa a ser **"% de lucro" = markup sobre o custo**: a taxa que o cliente quer ganhar sobre cada produto. Exemplo do cliente: *produto custa 100, quer ganhar 20% → digita 20 → vende por 120*. Fórmula: `preço = custo × (1 + %lucro/100)`; `lucro = custo × %lucro/100`. Cresce linearmente, sem explosão perto de 100%, e aceita valores acima de 100%.

2. **Exibir o custo no card.** Adicionar o **Custo unitário** como primeiro item do trio empilhado, **somente leitura** (derivado dos ingredientes via `summary.costPerUnit`, sem entrada manual — coerente com o resto do app). Não é campo editável, é exibição.

3. **Empilhar os campos verticalmente**, nesta ordem de cima para baixo:
   1. Custo unitário (read-only)
   2. Lucro unitário (editável)
   3. % de lucro (editável — renomeado de "Margem %")
   4. Preço de venda (editável)

O trio sincronizado continua: o cliente preenche **qualquer um** dos três campos editáveis (Lucro unitário, % de lucro, Preço de venda) e os outros dois são recalculados automaticamente a partir do custo unitário. O Custo unitário não é editável e ancora as três contas.

Não é feature nova de produto — é ajuste de UX + correção de fórmula sobre tela já implementada.

## Stack Tecnológica
(inalterada — ver `references/architecture.md`)
- Frontend: TS strict + Vite (MPA), sem framework
- Core de cálculo: funções puras em `src/core/` (sem DOM, sem arredondamento interno — §9)
- Storage: localStorage via `src/storage/`
- Testes: Vitest + jsdom

## Páginas e Rotas

### Calculadora — `/receitas.html?recipe=<id>`
**Descrição:** Tela de edição da receita. O card **Precificação** (`renderPricingPanel`) mostra o status da margem/lucro e o trio sincronizado de precificação sobre o custo unitário derivado dos ingredientes.

**Componentes:**
- `pricingPanel.ts` (`renderPricingPanel`): card Precificação — chip de status, trio de campos, totais de produção.
- `pricing.ts` (core): fórmulas puras dos três modos de entrada + totais + status.
- `recalc.ts` (core): engine de recálculo em lote que despacha o modo de entrada.
- `validation.ts` (core): validação dos campos (faixa de %, aviso de prejuízo).

**Behaviors (o que o usuário pode fazer):**
- [ ] Ver o **Custo unitário** no topo do card, somente leitura, derivado dos ingredientes (formato moeda R$; "—" quando indeterminado).
- [ ] Preencher **% de lucro** (novo rótulo): o app calcula `preço = custo × (1 + %/100)` e `lucro = custo × %/100`, e repinta Preço de venda e Lucro unitário. Aceita 0 e valores acima de 100% sem explodir.
- [ ] Preencher **Lucro unitário**: o app calcula `preço = custo + lucro` e `%lucro = (lucro / custo) × 100`, e repinta Preço de venda e % de lucro.
- [ ] Preencher **Preço de venda**: o app calcula `lucro = preço − custo` e `%lucro = (lucro / custo) × 100`, e repinta Lucro unitário e % de lucro.
- [ ] Editar qualquer um dos três campos editáveis SEM que o campo em edição seja sobrescrito durante a digitação (proteção `activeField` já existente); no `blur` o campo é formatado (§9).
- [ ] Ver os três campos **empilhados verticalmente** na ordem Custo → Lucro unitário → % de lucro → Preço de venda (não mais lado a lado).
- [ ] Ver o chip de status refletindo a saúde do preço (verde/amarelo/vermelho) e o aviso de **Prejuízo** quando o preço não cobre o custo.
- [ ] Ver os totais de produção (Custo unitário total, Receita total, Lucro total) inalterados abaixo do trio.

---

## Componentes Compartilhados
- `cellHelpers.ts` (`moneyPlain`, `applyValidation`, `marginChipClass`): reutilizados sem mudança.
- `format.ts` (`parseDecimal`, `formatPercent`, `formatCurrency`): reutilizados sem mudança.
- Design system (`references/design-system.css`): classes `.field`, `.input.num`, `.chip-*`, `.table`, `.readonly` — o empilhamento vertical usa layout já existente (coluna de `.field` sem a `row--end` lado a lado). Nenhum hex/valor bruto novo.

## Modelos de Dados

`recipe.pricing` (em `src/core/types.ts`) — campos relevantes:
- `priceInputMode`: qual campo o cliente editou por último. Valores atuais: `'sale-price' | 'margin' | 'profit'`. **A semântica de `'margin'` muda** de margem-sobre-preço para markup-sobre-custo (% de lucro). Manter o identificador `'margin'`/`profitMargin` (evita migração de dados no localStorage) **ou** renomear para `'markup'`/`profitPct` — decidir no plano técnico; se mantiver o nome, documentar que a semântica agora é markup.
- `profitMargin`: valor cru do % de lucro digitado (markup sobre custo).
- `salePrice`: preço de venda cru.
- `profitPerUnit`: lucro por unidade cru.
- `quantity`: quantidade (≥ 1).
- Derivados read-only: `totalCost`, `totalRevenue`, `totalProfit`.

`summary` (RecipeSummary): `costPerUnit` (custo unitário exibido no topo), `salePrice`, `profitMargin`, `profitPerUnit`, totais.

## Regras de Negócio

Sendo `c` = custo unitário (`summary.costPerUnit`), `p` = % de lucro, `L` = lucro unitário, `P` = preço de venda:

- **Modo % de lucro (markup):** `P = c × (1 + p/100)`; `L = c × p/100`. `p` livre em `[0, +∞)` — **remover o teto de 99,9%** (`MARGIN_MAX`) e o clamp, que só existiam para evitar ÷0 na fórmula margem-sobre-preço, agora inexistente. Padrão: `p ≥ 0` (sem lucro negativo por esta via).
- **Modo Lucro unitário:** `P = c + L`; `p = c > 0 ? (L / c) × 100 : 0` (guarda ÷0 quando custo é 0).
- **Modo Preço de venda:** `L = P − c`; `p = c > 0 ? (L / c) × 100 : 0` (guarda ÷0).
- **Custo unitário** permanece derivado de `totalRecipeCost / quantidade` — NÃO editável, NÃO recalculado por este card.
- **Sem arredondamento interno (§9):** o core devolve valores crus; `format.ts` arredonda só na exibição.
- **Sem throw / sem NaN / sem Infinity (§5.C):** entradas impossíveis (custo 0, custo indeterminado → `null`) fluem como `null` sem colapsar para 0, para não interromper o recálculo em lote.
- **Prejuízo (§5.C):** `isLoss` = `salePrice ≤ unitCost` — aviso não bloqueante, inalterado.
- **Status de cor (§4):** as faixas atuais (`>30` verde / `15–30` amarelo / `<15` vermelho) foram calibradas para margem-sobre-preço. Reavaliar se fazem sentido para markup-sobre-custo — decidir no plano técnico; padrão: manter as faixas aplicadas ao novo `%lucro`.

## Impacto em Spec/Golden

⚠️ Esta mudança **contradiz** a definição de margem em **spec v5 §3.E** (margem sobre o preço) e o **exemplo validado §12 / golden-example.test.ts** (margem 40% → preço 7,38333, lucro 2,95333). Sob markup-sobre-custo, o mesmo custo unitário + 40% dá outro preço/lucro. **É preciso:**
- Atualizar `src/core/golden-example.test.ts` e os testes de `pricing.test.ts`/`recalc.test.ts` que assumem margem-sobre-preço.
- Registrar a decisão na spec (nota de revisão §3.E) via `escriba` — a fonte-da-verdade do produto muda de "margem" para "% de lucro (markup)".
- O `revisor-spec` deve validar contra a **nova** definição, não contra o §12 antigo.

## Fora do Escopo (v1)
- Campo de custo **editável** / override manual do custo unitário (cliente pediu explicitamente só exibição read-only).
- Manter as duas definições (margem E markup) ou um toggle entre elas.
- Mudança nos totais de produção além do que decorre do novo preço.
- Mudança no cálculo de custo dos ingredientes (`costs.ts`) — permanece a fonte do custo unitário.
- Reprojeto visual do card além do empilhamento e do novo rótulo.
