# Refactor — Múltiplas Farinhas (Ancoragem ↔ Ingredientes)

**Status:** proposta (aguardando aprovação do cliente)
**Data:** 2026-07-06
**Supera:** v5 §2.A (trava-100% de farinha única), v5 §5.A (soma obrigatória bloqueante) — **apenas para as farinhas PRINCIPAIS**. Fermento e farinhas do fermento seguem a v5 inalterados.
**Relaciona:** v5 §2.A.2 (tabela de insumos), §2.B (sub-receita do fermento), §1.3 (modos de cálculo), §3.A (baker's %).

---

## 1. Motivação

Um pão pode usar **mais de um tipo de farinha**. O cliente define os tipos e a % de cada (relativa ao total de farinha) numa tabela dedicada no card **Ancoragem e Planejamento da Fornada**. Essas farinhas são **consumidas** (espelhadas, somente-leitura) pela tabela **Ingredientes** — mesma relação que a sub-receita do Fermento tem com a linha "Fermento".

Modelo de dados: as farinhas continuam sendo itens de `recipe.ingredients` com `category:'flour'`. **Não** há `recipe.flours`. O core (`recalc.ts`) já deriva `peso = %/100 × F_total`; logo Σ pesos das farinhas = F_total automaticamente. Nenhuma fórmula nova.

---

## 2. Tabela "Farinhas" (no card Ancoragem)

2.1. Fica dentro do card Ancoragem, entre a linha de campos-âncora e a métrica final "Peso Total de Farinha (F total)".

2.2. Colunas, na ordem, **análogas** à tabela Ingredientes (sem a coluna "Unidade" — farinha é sempre g):
`Farinha · % · Peso (g) · Preço pago · Peso do produto · Custo/g · Custo · [Ações]`

2.3. **Editáveis:** Nome, % (ver §4), Preço pago (≥0), Peso do produto (>0) + unidade. **Derivados (read-only):** Peso (g), Custo/g, Custo.

2.4. Estado inicial (seed): **uma** farinha "Farinha Branca" 100%. Editável desde o início (sem trava).

2.5. Botão **`+ farinha`** adiciona uma nova farinha. Botão remover por linha; desabilitado quando removeria a última farinha (mínimo 1, v5 §5.B mantido).

2.6. **Sensibilidade a modo (v5 §1.3):** em `percentage-to-weight` a % é editável e o Peso derivado; em `weight-to-percentage` inverte (Peso editável, % derivada com destaque `.pct`).

2.7. `tfoot` "Total de farinha": Σ% · Σpeso (= F_total) · Σcusto.

---

## 3. Contrato-espelho FARINHAS → INGREDIENTES  *(núcleo deste refactor)*

**A tabela Ingredientes deve exibir as farinhas EXATAMENTE como a tabela Farinhas.** Especificamente:

3.1. **Mesmas linhas:** cada farinha da tabela Farinhas aparece como exatamente uma linha na tabela Ingredientes. Nenhuma a mais, nenhuma a menos.

3.2. **Mesma ordem, contíguas:** as linhas de farinha aparecem na **mesma ordem** da tabela Farinhas e formam um **bloco contíguo** (não intercaladas com água/gordura/sal). O bloco de farinhas vem **no topo** da tabela Ingredientes, antes dos demais ingredientes e da linha Fermento.

3.3. **Somente-leitura:** na tabela Ingredientes as linhas de farinha não têm inputs editáveis nem botão remover. Cada uma traz o rótulo "↑ vem da Ancoragem". A edição acontece só na tabela Farinhas.

3.4. **Sincronização imediata (v5 §1.6), TODOS os campos:** qualquer mudança na tabela Farinhas reflete na tabela Ingredientes **na mesma interação**, sem recarregar:
  - **Nome** (renomear reflete o nome — hoje é o bug principal),
  - **%**, **Peso**, **Preço pago**, **Peso do produto**, **Custo/g**, **Custo**,
  - **Adicionar** farinha → nova linha aparece no bloco, na posição certa,
  - **Remover** farinha → linha some do bloco,
  - reordenar (se algum dia houver) → ordem reflete.

3.5. Os totais/derivados que dependem de farinha (Total da massa, Hidratação, Farinha Real Consumida, custos) recalculam normalmente (v5 §2.C/§2.D/§3.E).

---

## 4. Regra da soma das % das farinhas principais  *(supera v5 §2.A/§5.A)*

4.1. A % de **cada** farinha principal é **sempre editável** em `percentage-to-weight` (inclusive quando há só 1 farinha). **Não** existe trava-100%.

4.2. O blur **nunca reverte** a % digitada. (Reverter impedia montar 100% incrementalmente com várias farinhas partindo de 0 — comportamento inaceitável.)

4.3. Aviso **visível** (não-bloqueante) do estado da soma, no rodapé da tabela Farinhas, via chip do design system:
  - Σ == 100 → `.chip-ok`, "✓ 100%".
  - Σ < 100 → `.chip-warn`, "Faltam X,XX% para 100%".
  - Σ > 100 → `.chip-warn`, "Excede 100% em X,XX% — reduza."

4.4. Deve ser **possível chegar exatamente a 100%** por edições sucessivas. A soma **não deveria** passar de 100% (sinalizada como excesso), mas o excesso **não trava** a edição — apenas avisa, para o usuário corrigir.

4.5. Fermento e farinhas do **fermento** (sub-receita) mantêm a regra bloqueante da v5 §5.A — **não** são afetados por esta seção.

---

## 5. Sub-receita "composição do Fermento" — refactor (fase 2)

Reestrutura a tabela **Sub-receita: composição do Fermento**. **Supera** v5 §2.B.2 (Partes fixas Isca:Farinha:Água) e §2.B.3 (% das farinhas do fermento) — passam a **proporção por linha**.

### 5.1. Estrutura de linhas (nesta ordem)

1. **Total de fermento** — 1ª linha, em **negrito**, **read-only**. Consome o peso total do fermento (W_ferm) calculado a partir da linha "Fermento" da tabela Ingredientes (v5 §2.B.1). Substitui o campo avulso "Peso total do fermento" de hoje, virando a primeira linha da tabela. **Exibe o custo agregado** das linhas abaixo: Custo/g e Custo do fermento (= Σ custo das farinhas + água, isca fora) — os "preços proporcionais" do fermento inteiro.
2. **Isca** — hardcoded. Cliente edita **só a Proporção** (padrão **1**). **Sem custo** — custo sempre R$0,00 (v5 §2.B.2), sem colunas de preço.
3. **Água** — hardcoded. Cliente edita **Proporção + custo** (Preço pago, Peso do produto; padrão R$0,00 / 1 L — torneira, v5 §2.B.4). Não removível.
4. **Farinhas (0+)** — **criadas pelo cliente** via `+ farinha do fermento`, **abaixo da Água**. Cliente edita **Nome + Proporção + custo** (Preço pago, Peso do produto + unidade). Peso, Custo/g e Custo são derivados. Removíveis.
5. **Total** (`tfoot`) — Σ proporções · Σ peso (= W_ferm) · Σ custo.

> **Nota (seed / golden §12):** o padrão da Isca é **1**. O seed inicial (`src/ui/seed.ts`, "Pão Rústico de Azeite") passa a usar `parts {isca:1, water:1}`, então **deixa de reproduzir** os números do exemplo §12 (que usava 0:1:1). A validação das **fórmulas** da §12 permanece garantida por um fixture próprio, com isca 0, em `golden-example.test.ts` — o §12 segue sendo referência de fórmula, não mais o estado inicial do seed.

### 5.2. Colunas (análogas a Ingredientes, **% → Proporção**)

`Componente · Proporção · Peso (g) · Preço pago · Peso do produto · Custo/g · Custo · [Ações]`
- **Proporção**: número livre ≥ 0 (inteiro ou decimal), editável nas linhas Isca/Farinhas/Água. Substitui a coluna % (não há % nesta tabela).
- Custo (Preço pago / Peso do produto): editável só nas linhas de **Farinha** e **Água** (opção B, confirmada). Isca não tem custo.

### 5.3. Modelo de proporção *(muda o core)*

Cada linha tem **proporção própria**. Denominador = `isca + Σ(proporções das farinhas) + água`.
`peso_da_linha = W_ferm × (proporção_da_linha ÷ Σ proporções)`.
Remove o modelo antigo (Partes `{isca, flour, water}` fixas + farinhas dividindo a parte "flour" por %). As farinhas do fermento passam a ter **proporção**, não %.

Ex. (preserva o golden §12): Isca 0, 1 farinha proporção 1, Água 1 → Σ=2 → FarinhaFerm = W_ferm×1/2, ÁguaFerm = W_ferm×1/2 (idêntico a hoje).

### 5.4. Custo do fermento

`custo do fermento = Σ(custo das farinhas) + custo da água`. **Isca não conta** (custo 0). Preços são **digitados nas próprias linhas** de farinha/água da tabela Fermento (opção B). Isso alimenta `sourdoughCost` (v5 §3.E) → custo total da receita, sem mudança de fórmula de agregação.
- Herança de custo farinha principal → farinha do fermento (por `flourId`): **mantida como hoje** quando houver vínculo; farinhas do fermento criadas livres (sem vínculo) simplesmente usam o preço digitado. Sem regressão da fase 1 (AC13).

### 5.5. Hidratação resultante (v5 §2.B.5)

`hidratação = ÁguaFerm ÷ Σ(FarinhaFerm)` = `água ÷ Σ(proporções das farinhas)`. Mantida. Se Σ farinhas = 0 → indefinida → "—" (aviso, não bloqueio; mesmo contrato null-vs-0 da v5 §5.C).

### 5.6. Validações

- Proporção ≥ 0 em cada linha (bloqueio se < 0).
- Σ de todas as proporções > 0 (senão pesos indefinidos → "—", aviso). Isca e Água podem ser 0.
- Não há regra de "somar 100" aqui (proporções são livres). A regra §5.A block das farinhas do fermento **deixa de existir** (não há mais % no fermento) — isto atualiza §4.5/AC12 desta spec para a fase 2.
- Preço pago ≥ 0; Peso do produto > 0 (evita ÷0 no Custo/g), como na tabela Ingredientes.

### 5.7. Mudanças de modelo de dados (core)

- `types.ts`: `SourdoughParts` deixa de ter `flour` (fica `{ isca, water }`); `SourdoughFlour.percentage` → `SourdoughFlour.proportion`.
- `sourdough.ts`: `computeSourdoughWeights` e `distributeSourdoughFlourWeights` recomputam pelo denominador global (isca + Σfarinhas + água).
- `recalc.ts`: consome a nova distribuição; hidratação = água ÷ Σfarinhas.
- `seed.ts` (golden): `sourdough.parts` `{isca:0, water:1}` + farinha do fermento `proportion:1` — preserva os valores validados da §12.
- Reuso máximo; nenhuma fórmula de agregação de custo nova (§3.E intocado).

---

---

## 6. Critérios de aceite (testáveis)

**Espelho (fase 1):**
- [ ] AC1 — Seed inicial: tabela Farinhas mostra 1 farinha "Farinha Branca" 100%, editável (não readonly).
- [ ] AC2 — Renomear a farinha na tabela Farinhas atualiza o nome na tabela Ingredientes na mesma interação.
- [ ] AC3 — Editar % / preço / peso-do-produto na tabela Farinhas atualiza %/peso/custo da linha correspondente na tabela Ingredientes.
- [ ] AC4 — `+ farinha` cria a linha na tabela Farinhas E a linha-espelho aparece na tabela Ingredientes, dentro do bloco de farinhas, na mesma ordem.
- [ ] AC5 — Remover uma farinha some das duas tabelas.
- [ ] AC6 — Ordem e contiguidade: com N farinhas, as N primeiras linhas da tabela Ingredientes são exatamente as farinhas, na mesma ordem da tabela Farinhas, antes de água/gordura/sal/Fermento.
- [ ] AC7 — Linhas de farinha em Ingredientes não têm input editável nem botão remover; trazem "↑ vem da Ancoragem".

**Soma soft:**
- [ ] AC8 — % de farinha nunca é revertida no blur.
- [ ] AC9 — Chip `.chip-ok` "✓ 100%" quando Σ=100; `.chip-warn` com "Faltam…" (<100) ou "Excede…" (>100).
- [ ] AC10 — Partindo de 2+ farinhas em 0/…, é possível editar até Σ=100 sem nenhuma reversão.

**Não-regressão:**
- [ ] AC11 — Golden §12 (1 farinha, 100%) continua com todos os valores corretos.
- [ ] AC12 — Fermento e farinhas do fermento seguem com regra bloqueante da v5 §5.A. *(Vale só na fase 1; a fase 2 §5.6 remove o % do fermento.)*
- [ ] AC13 — Herança de custo farinha principal → farinha do fermento (mesmo `flourId`) continua funcionando ao editar na tabela Farinhas.
- [ ] AC14 — Suíte completa verde (`vitest`), `tsc --noEmit` limpo, `build` ok.

**Fase 2 — Sub-receita Fermento (§5):**
- [ ] AC15 — Ordem das linhas: Total de fermento (read-only, consumido, **negrito**) · Isca · Água · farinhas do cliente · Total (`tfoot`).
- [ ] AC24 — A linha "Total de fermento" exibe Custo/g e Custo agregados (= Σ farinhas + água, isca fora), sincronizados ao editar as linhas abaixo.
- [ ] AC25 — Seed usa `isca:1`; testes de painel refletem os números resultantes; `golden-example.test.ts` mantém o fixture §12 (isca 0) para validar as fórmulas.
- [ ] AC16 — Isca: só Proporção editável (padrão 1), sem colunas de custo, custo R$0,00.
- [ ] AC17 — `+ farinha do fermento` cria linha com Nome + Proporção + custo editáveis; removível.
- [ ] AC18 — Água: Proporção + custo editáveis; não removível.
- [ ] AC19 — Peso de cada linha = W_ferm × proporção ÷ Σproporções; `tfoot` Σpeso = W_ferm.
- [ ] AC20 — Custo do fermento = Σcusto farinhas + custo água; isca não conta.
- [ ] AC21 — Hidratação resultante = ÁguaFerm ÷ Σ FarinhaFerm; Σfarinhas=0 → "—".
- [ ] AC22 — `SourdoughParts` sem `flour`; `SourdoughFlour.proportion` (não `percentage`); golden §12 preservado com o novo modelo.
- [ ] AC23 — Não há regra "somar 100" na tabela Fermento (proporções livres).

---

## 7. Fora de escopo

- `recipe.flours` (novo array) — **não** criar; fonte da verdade continua `recipe.ingredients`.
- Fase 1: nenhuma mudança no core. Fase 2 muda **só** o modelo de proporção do fermento (`types.ts` `SourdoughParts`/`SourdoughFlour`, distribuição em `sourdough.ts`, consumo em `recalc.ts`) — **nenhuma** fórmula nova de custo/precificação/hidratação-nominal; agregação de custo (§3.E) intocada.
- Layout: cap de largura de coluna e respiro horizontal já entregues; ajustes finos são cosméticos, fora deste contrato.
