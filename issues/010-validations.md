---
id: "010"
titulo: Validações da Seção 5 consolidadas (blur, bloqueios, avisos)
tipo: core
deps: ["008"]
status: todo
---

## Contexto
Camada de validação pura (spec §5) consumida pela UI: distinção bloqueio (reverte/impede) × aviso (permite, sinaliza).

## O que fazer
- `src/core/validation.ts` — funções puras retornando `{ valid, level: 'block' | 'warn', message }` (mensagens pt-BR, spec §7.1):
  - Soma % farinhas (principais e fermento) ≠ 100 no blur → bloqueio, reverte campo; NUNCA redistribuição automática (§5.A, §5.B).
  - Mínimo 1 farinha por grupo (§5.B).
  - Quantidade produtos ≥ 1; custos ≥ 0; Preço Pago ≥ 0 (§5.C).
  - Partes ≥ 0 e SomaPartes > 0 → bloqueio (§5.C).
  - Parte farinha = 0 → aviso (hidratação "—") (§5.C).
  - Proporção fermento ≥ 0; aviso se 0 (§5.C).
  - Margem 0–99,9 (§5.C).
  - Preço ≤ custo unitário → aviso (§5.C).
  - Peso/Volume do Produto > 0 → bloqueio (§5.C).
  - Histórico (§5.D/§14.6): vendida ≤ produzida (bloqueio); produzida ≥ 1; data futura → aviso "fornada planejada"; custos/preços unitários ≥ 0.

## Testes exigidos (TDD)
- Farinhas 60+50 → block; 60+40 → ok.
- SomaPartes 0 → block; partes 0:1:1 → ok (golden).
- Margem 100 → block/clamp; 99.9 → ok.
- packageSize 0 → block.
- Vendida 10 > produzida 8 → block; 8 ≤ 8 → ok.
- Data amanhã → warn planned; hoje → ok.
- Preço 4 ≤ custo 4.43 → warn.

## Critérios de aceite
- [ ] Todos os itens §5.A–D cobertos, um teste por regra.
- [ ] Nenhuma redistribuição automática em circunstância alguma (§5.A).
- [ ] Mensagens pt-BR.

## Referências
- spec §5, §14.6, §7.1

---

## Plano Técnico

> Camada de **mensagens + níveis** sobre os predicados que já existem no core.
> `validation.ts` NÃO refaz aritmética: só traduz o resultado de predicados puros
> em `{ valid, level, message }` pt-BR. Um bloqueio (`block`) reverte/impede na UI;
> um aviso (`warn`) permite o valor e apenas sinaliza (§5, §7.1).

### Análise do existente (busca real: `grep`/Read em `src/core/`)

Reusar como fonte da verdade (nunca duplicar — regra de ouro #2):

| Predicado/const | Arquivo → símbolo | Uso na validação |
|---|---|---|
| Soma de % = 100 (epsilon anti-drift, dono único) | `bakers.ts` → `percentagesSumTo100(number[])` | §5.A soma principais **e** fermento (genérico sobre `number[]`) |
| Partes válidas (≥0 e Soma>0) | `sourdough.ts` → `isValidSourdoughParts(SourdoughParts)` | §5.C bloqueio de partes |
| Teto/piso da margem | `pricing.ts` → `MARGIN_MIN`(0), `MARGIN_MAX`(99.9) | §5.C faixa 0–99,9% |
| Guarda qtd ≥ 1 | `pricing.ts` → `effectiveQuantity(n)` | referência do critério qtd ≥ 1 (§5.C) — a validação reporta, a UI/engine clampa |
| Prejuízo (break-even inclusivo) | `pricing.ts` → `isLoss(unitCost, salePrice)` | §5.C aviso preço ≤ custo unitário |
| Data → `aaaa-mm-dd` | `format.ts` → `formatDate(Date)` | §5.D/§14.6 comparação de dia-calendário por string lexicográfica (evita fuso/UTC) |
| Tipos de domínio | `types.ts` → `SourdoughParts`, `PackageCost`, `BakeEntry` | assinaturas |

Não existe `validation.ts` hoje (confirmado por `ls src/core/` e `grep -rn "ValidationResult" src/`). Convenções herdadas de todo o core: **funções puras, sem DOM/localStorage, sem `throw`, sem arredondamento** (§9 é só exibição), cabeçalho citando `§`, TDD antes da implementação. Estilo de teste: Vitest `describe/it`, `toBeCloseTo(x, 9)` para números crus.

### Decisões de design (cada uma justificada em 1 linha)

1. **Tipo de retorno** `ValidationResult = ValidationIssue | null`, onde `ValidationIssue = { valid: boolean; level: 'block' | 'warn'; message: string }`; **`null` = OK** (nada a sinalizar). Justificativa: o par `{level:'block'|'warn'}` não comporta "ok"; `null` é o contrato null≠0/ok já usado no core (issues 004–009) e testa-se com `toBeNull()`.
2. **`block` ⇒ `valid:false`; `warn` ⇒ `valid:true`** (aviso permite o valor). Justificativa: espelha "bloqueio reverte/impede × aviso permite/sinaliza" (§5), UI decide reverter vs. marcar.
3. **`today` é parâmetro injetado** em `validateBakeDate(date, today)`, nunca `new Date()` interno. Justificativa: pureza/determinismo e TDD (amanhã→warn, hoje→ok) sem mockar relógio.
4. **§5.A é genérico sobre `number[]`** com rótulo de grupo `'principal' | 'fermento'` para a mensagem — um só código, delega a `percentagesSumTo100`. Justificativa: mesma regra para os dois grupos (§5.A), zero duplicação.
5. **Nenhuma lib nova.** Justificativa: validação é comparação trivial sobre predicados que já são do produto (core de cálculo é nosso, regra de ouro #1); 100% offline (§10/§11.1). *Nenhuma doc externa a consultar — sem API/lib não-trivial.*

### Assinaturas propostas (`src/core/validation.ts`)

```ts
export type ValidationLevel = 'block' | 'warn';
export interface ValidationIssue { valid: boolean; level: ValidationLevel; message: string; }
export type ValidationResult = ValidationIssue | null; // null = OK

// §5.A — soma de % (blur/Enter); NUNCA redistribui, só reporta
export function validatePercentageSum(
  percentages: readonly number[],
  group: 'principal' | 'fermento',
): ValidationResult;                                   // reusa percentagesSumTo100

// §5.B — mínimo 1 farinha por grupo (principal e fermento)
export function validateFlourCount(count: number, group: 'principal' | 'fermento'): ValidationResult;

// §5.C — gerais
export function validateProductQuantity(quantity: number): ValidationResult;   // ≥1
export function validateNonNegative(value: number, fieldLabel: string): ValidationResult; // custos/preço pago ≥0
export function validateSourdoughParts(parts: SourdoughParts): ValidationResult; // reusa isValidSourdoughParts
export function validateSourdoughFlourPart(flourPart: number): ValidationResult;  // =0 → warn (hidratação "—")
export function validateSourdoughProportion(percentage: number): ValidationResult; // <0 block; =0 warn
export function validateMargin(margin: number): ValidationResult;               // reusa MARGIN_MIN/MARGIN_MAX
export function validatePriceVsUnitCost(salePrice: number, unitCost: number): ValidationResult; // reusa isLoss → warn
export function validatePackageSize(packageSize: number): ValidationResult;     // >0

// §5.D / §14.6 — histórico
export function validateQuantityProduced(produced: number): ValidationResult;   // ≥1
export function validateQuantitySold(sold: number, produced: number): ValidationResult; // sold<0 → block; sold>produced → block
export function validateBakeDate(date: Date, today: Date): ValidationResult;    // futuro → warn "planejada"; reusa formatDate
```

`validateNonNegative` cobre: custos de insumo, Preço Pago (§5.C) e Custo/Preço Unitário do histórico (§14.6) — mesma regra ≥0, um só código.

### Mensagens pt-BR propostas (§7.1)

- Soma %: `"A soma das porcentagens das farinhas {do grupo} deve ser 100%."` (grupo → "principais" / "do fermento").
- Mín. 1 farinha: `"É necessária ao menos 1 farinha {no grupo principal | no fermento}."`
- Qtd produtos: `"A quantidade de produtos deve ser no mínimo 1."`
- Não-negativo (genérico): `"{Campo} não pode ser negativo."` (ex.: "Preço Pago", "Custo unitário").
- Partes fermento: `"As partes do fermento não podem ser negativas e a soma deve ser maior que zero."`
- Parte farinha = 0 (warn): `"Parte de farinha do fermento é 0: a hidratação fica indefinida (—)."`
- Proporção 0 (warn): `"Proporção do fermento é 0%: nenhum fermento será usado."`
- Proporção negativa (block): `"A proporção do fermento não pode ser negativa."`
- Margem: `"A margem deve estar entre 0% e 99,9%."`
- Preço ≤ custo (warn): `"O preço de venda não cobre o custo unitário (prejuízo)."`
- Peso/Volume do Produto: `"O peso/volume do produto deve ser maior que zero."`
- Qtd produzida: `"A quantidade produzida deve ser no mínimo 1."`
- Vendida > produzida: `"A quantidade vendida não pode exceder a produzida."`
- Vendida negativa: `"A quantidade vendida não pode ser negativa."`
- Data futura (warn): `"Data futura: registrada como fornada planejada."`

### Cenários (números concretos)

- Caminho feliz (golden §12): farinhas principais 100% → OK; fermento partes `0:1:1` (Soma 2>0) → OK; proporção 20% → OK; margem 40 (∈[0,99.9]) → OK; qtd 2 → OK; Peso do Produto 1000 g → OK; data = hoje → OK.
- Borda: margem **99,9** → OK; margem **100** → block. Vendida **8 ≤ 8** → OK; **10 > 8** → block. Parte farinha 0 (partes `0:0:1`) → partes OK (Soma 1>0) **mas** `validateSourdoughFlourPart(0)` → warn.
- Erro: soma `60+50` → block (reverte campo, **sem redistribuir**); `{0,0,0}` partes → block; `packageSize 0` → block; preço `4 ≤ custo 4,43` → warn (permite).

### Testes primeiro (`src/core/validation.test.ts`) — 1 caso por regra (TDD, antes da implementação)

1. §5.A `validatePercentageSum([60,50],'principal')` → block · `([60,40],'principal')` → null.
2. §5.A fermento `validatePercentageSum([100],'fermento')` → null · `([100,1],'fermento')` → block (mesma regra, outro grupo/rótulo).
3. §5.B `validateFlourCount(0,'principal')` → block · `(1,'principal')` → null.
4. §5.C `validateProductQuantity(0)` → block · `(1)` → null.
5. §5.C `validateNonNegative(-0.01,'Preço Pago')` → block · `(0,'Preço Pago')` → null.
6. §5.C `validateSourdoughParts({isca:0,flour:0,water:0})` → block · `({isca:0,flour:1,water:1})` (golden) → null.
7. §5.C `validateSourdoughFlourPart(0)` → warn · `(7)` → null.
8. §5.C `validateSourdoughProportion(-1)` → block · `(0)` → warn · `(20)` → null.
9. §5.C `validateMargin(100)` → block · `(99.9)` → null · `(-1)` → block.
10. §5.C `validatePriceVsUnitCost(4, 4.43)` → warn · `(8, 4.43)` → null.
11. §5.C `validatePackageSize(0)` → block · `(1000)` → null.
12. §14.6 `validateQuantityProduced(0)` → block · `(1)` → null.
13. §14.6 `validateQuantitySold(10,8)` → block · `(8,8)` → null · `(-1,8)` → block.
14. §14.6 `validateBakeDate(amanhã, hoje)` → warn (level `warn`) · `(hoje,hoje)` → null · `(ontem,hoje)` → null (usa `new Date(2026,6,5)` etc., datas fixas).
15. Pureza/§5.A: chamar `validateSourdoughParts`/`validatePercentageSum` NÃO muta a entrada (objeto/array intactos) e NÃO retorna array normalizado — só o resultado (garante "nenhuma redistribuição automática").

### Arquivos a criar
- `src/core/validation.ts` — funções acima; cabeçalho citando §5.A/§5.B/§5.C/§5.D/§14.6/§7.1; reusa `bakers`, `sourdough`, `pricing`, `format`.
- `src/core/validation.test.ts` — 15 casos acima (Vitest).

### Arquivos a modificar
- Nenhum. (`types.ts` já expõe `SourdoughParts`, `PackageCost`, `BakeEntry`; predicados já existem.)
- `references/architecture.md` e `PROGRESS.md` são atualizados pelo escriba **após** a implementação (não nesta issue de core).

### Arquivos que NÃO devem ser tocados
- `bakers.ts`, `sourdough.ts`, `pricing.ts`, `costs.ts`, `format.ts`, `recalc.ts`, `scaling.ts`, `hydration.ts`, `types.ts` e seus `.test.ts` — só importar, jamais alterar (aritmética é deles; validação é camada de mensagens).
- `spec/`, `mockups/`, `design-system.css` — fonte da verdade, imutáveis aqui.
- Qualquer arquivo de UI (`src/ui/**`) — validação é pura; consumo é das issues 014/016/018.

### Ordem de implementação
1. Escrever `validation.test.ts` com os 15 casos (falhando) — TDD.
2. Definir `ValidationResult`/`ValidationIssue` em `validation.ts`.
3. Implementar as funções §5.A→§5.C reusando `percentagesSumTo100`, `isValidSourdoughParts`, `MARGIN_*`, `isLoss`.
4. Implementar §5.D/§14.6 (produzida/vendida/data) reusando `formatDate`.
5. `npm test` verde (inclusive golden §12 intacto); `tsc --noEmit` sem erros.

### O que NÃO fazer
- **Nunca** redistribuir/normalizar porcentagens (§5.A) — validação só reporta; sem mutação, sem retorno de novo array.
- Não reimplementar soma-100, partes, margem, prejuízo ou formatação de data — reusar os donos únicos.
- Não arredondar (§9 é só exibição): comparar valores crus; a tolerância de soma vem só de `percentagesSumTo100`.
- Não usar `throw`, DOM, localStorage nem `new Date()` interno (injetar `today`).
- Não bloquear casos que a spec marca como aviso: parte-farinha=0, proporção 0%, preço≤custo, data futura → sempre `warn`.
- Nenhuma dependência externa; nenhum acesso de rede; nenhum secret (§10/§11.1).
