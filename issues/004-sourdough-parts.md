---
id: "004"
titulo: Fermento por Partes — W_ferm, rateio Isca/Farinha/Água, hidratação derivada
tipo: core
deps: ["003"]
status: done
---

## Contexto
Sub-receita do fermento (spec §2.B, §3.B): peso total vem da proporção sobre F_total; repartição interna por Partes (Isca:Farinha:Água); hidratação é derivada, nunca entrada.

## O que fazer
- `src/core/sourdough.ts`:
  - `W_ferm = F_total × (proporção% / 100)` (§3.B).
  - `SomaPartes = parte_isca + parte_farinha + parte_água` (§2.B.2).
  - `Isca = W_ferm × parte_isca/SomaPartes` · `FarinhaFerm = W_ferm × parte_farinha/SomaPartes` · `ÁguaFerm = W_ferm × parte_água/SomaPartes` (§3.B).
  - `H_ferm% = ÁguaFerm / FarinhaFerm × 100` — derivada; se `parte_farinha = 0` → indefinida (null; UI exibe "—", §5.C).
  - Farinhas do fermento: `FarinhaFerm_i = FarinhaFerm × P_i/100`, com `Σ P_i = 100` (§3.B, §2.B.3); predicado de soma 100.
  - Guard: `SomaPartes > 0` obrigatório (§5.C — divisão por zero); partes ≥ 0.

## Testes exigidos (TDD)
- §12: F_total=1000, fermento 20%, partes 0:1:1 → W_ferm=200, Isca=0, FarinhaFerm=100, ÁguaFerm=100, H_ferm=100%.
- §2.B.2 exemplo 1:7:7 com W_ferm=310 (fermento ~31% de 1000) → Isca≈20.67, Farinha≈144.67, Água≈144.67 (valores exatos sem arredondar; mockup mostra 21/147/147 arredondado — testar valor puro), H_ferm=100%.
- parte_farinha=0 → H_ferm null.
- SomaPartes=0 → erro/estado inválido explícito, sem NaN.
- 2 farinhas do fermento 50/50 sobre FarinhaFerm=100 → 50g cada.

## Critérios de aceite
- [ ] Fórmulas §3.B exatas; W_ferm = Isca + FarinhaFerm + ÁguaFerm (aditivo).
- [ ] Hidratação somente derivada; null quando indefinida.
- [ ] SomaPartes=0 bloqueado; partes negativas rejeitadas (§5.C).

## Referências
- spec §2.B, §3.B, §5.C, §12

---

## Plano Técnico

### Análise do existente (busca real: `grep`/Read em src/core/)
- `src/core/types.ts` → `SourdoughParts` (isca/flour/water), `Sourdough`
  (percentageOfTotalFlour, parts, hydration?, flours[], totalWeight?, iscaWeight?,
  flourWeight?, waterWeight?) e `SourdoughFlour` (percentage, weight) **já existem,
  1:1 com §6** — este módulo apenas os popula; **não adicionar/alterar campos**.
- `src/core/bakers.ts` → `weightFromPercentage(flourTotal, percentage)` é exatamente
  `F_total × %/100` (§3.A). **REUSAR** para `W_ferm` (§3.B) — a linha do fermento é
  genérica (§2.A.2), não recriar a fórmula.
- `src/core/bakers.ts` → `flourPercentagesSumTo100(ingredients)` tem a lógica do
  predicado soma-100 **com o `SUM_EPSILON` anti-drift IEEE-754**, mas filtra por
  `category === 'flour'` sobre `Ingredient[]`; `SourdoughFlour` **não tem `category`**,
  então não serve direto. **Decisão: generalizar** — extrair de bakers.ts um
  `percentagesSumTo100(percentages: readonly number[]): boolean` (dono único do
  epsilon), refatorar `flourPercentagesSumTo100` para chamá-lo, e sourdough.ts reusa o
  mesmo. Evita duplicar o epsilon (regra de ouro #2). Testes atuais de bakers seguem verdes.
- `src/core/bakers.test.ts` → fábrica `ing()` e estilo de casos TDD servem de molde
  para `sourdough.test.ts`.
- Padrão do core (bakers.ts): funções puras, sem DOM/localStorage, **sem arredondamento
  interno** (§9), sem mutar entrada, divisão por zero tratada (§5.C). Seguir idêntico.

### Cenários (números concretos da spec)
- **Feliz — golden §12**: F_total=1000, fermento 20%, partes 0:1:1 →
  W_ferm=200, SomaPartes=2, Isca=0, FarinhaFerm=100, ÁguaFerm=100, H_ferm=100%.
- **Feliz — §2.B.2 (1:7:7)**: F_total=1000, fermento 31% → W_ferm=310, SomaPartes=15,
  Isca=310/15=20,6666…, FarinhaFerm=310×7/15=144,6666…, ÁguaFerm=144,6666…, H_ferm=100%.
  (mockup exibe 21/147/147 arredondado; o core devolve o valor puro — §9.)
- **Borda — H indefinida (§5.C)**: parte_farinha=0 (ex. 1:0:1) → FarinhaFerm=0 →
  `hydration = null` (UI exibe "—"), sem divisão por zero; ÁguaFerm continua válida.
- **Borda — aditividade (§3.B)**: Isca+FarinhaFerm+ÁguaFerm = W_ferm em todo caso.
- **Borda — farinhas do fermento (§B.3/§3.B)**: 2 farinhas 50/50 sobre FarinhaFerm=100
  → [50, 50]; soma P_i deve ser 100 (`percentagesSumTo100`).
- **Erro — SomaPartes=0 (§5.C, bloqueio)**: 0:0:0 → estado inválido explícito
  (retorno `null`), nunca `NaN`/`Infinity`.
- **Erro — parte negativa (§5.C)**: qualquer parte < 0 → inválido explícito (`null`),
  validador reprova.

### Testes primeiro (Vitest — `src/core/sourdough.test.ts`, ANTES da implementação)
1. `sourdoughTotalWeight(1000, 20)` → `200` (reuso weightFromPercentage, §3.B).
2. `partsSum({isca:0,flour:1,water:1})` → `2`; `partsSum({isca:1,flour:7,water:7})` → `15`.
3. `computeSourdoughWeights(1000, 20, {isca:0,flour:1,water:1})` →
   `{ totalWeight:200, iscaWeight:0, flourWeight:100, waterWeight:100, hydration:100 }` (golden §12).
4. `computeSourdoughWeights(1000, 31, {isca:1,flour:7,water:7})` →
   iscaWeight `toBeCloseTo(310/15, 6)`, flourWeight/waterWeight `toBeCloseTo(310*7/15, 6)`,
   hydration `toBeCloseTo(100, 9)`, totalWeight `200`→ aqui `310`; e
   `iscaWeight+flourWeight+waterWeight` `toBeCloseTo(310, 9)` (aditividade §3.B).
5. parte_farinha=0: `computeSourdoughWeights(1000, 20, {isca:1,flour:0,water:1})` →
   `flourWeight:0`, `waterWeight` > 0, `hydration: null` (§5.C).
6. SomaPartes=0: `computeSourdoughWeights(1000, 20, {isca:0,flour:0,water:0})` → `null`
   (explícito, `expect(result).toBeNull()` — garante ausência de NaN).
7. parte negativa: `computeSourdoughWeights(1000, 20, {isca:-1,flour:1,water:1})` → `null`;
   `isValidSourdoughParts({isca:-1,flour:1,water:1})` → `false`.
8. `isValidSourdoughParts({isca:0,flour:1,water:1})` → `true`;
   `isValidSourdoughParts({isca:0,flour:0,water:0})` → `false` (SomaPartes>0, §5.C).
9. `distributeSourdoughFlourWeights(100, [P50, P50])` → `[50, 50]` (§3.B: FarinhaFerm_i).
10. `distributeSourdoughFlourWeights(0, [P50, P50])` → `[0, 0]` (FarinhaFerm=0, sem NaN).
11. `sourdoughFlourPercentagesSumTo100` via `percentagesSumTo100`: `[100]`→true,
    `[50,50]`→true, `[50,40]`→false; drift `[33.33,33.33,33.34]`→true (epsilon).
12. Pureza: chamar `computeSourdoughWeights` não muta o objeto `parts` de entrada.

### Assinaturas propostas (`src/core/sourdough.ts`)
```ts
export function sourdoughTotalWeight(flourTotal: number, sourdoughPercentage: number): number;
// = weightFromPercentage(flourTotal, sourdoughPercentage)  (§3.B, reuso)

export function partsSum(parts: SourdoughParts): number; // §2.B.2

export function isValidSourdoughParts(parts: SourdoughParts): boolean;
// §5.C: todas as partes ≥ 0 E partsSum > 0

export interface SourdoughWeights {         // shape alinhado a Sourdough (§6)
  totalWeight: number; iscaWeight: number;
  flourWeight: number; waterWeight: number;
  hydration: number | null;                 // §2.B/§5.C: derivada; null se flour=0
}
export function computeSourdoughWeights(
  flourTotal: number, sourdoughPercentage: number, parts: SourdoughParts,
): SourdoughWeights | null;                  // null se !isValidSourdoughParts (§5.C)

export function distributeSourdoughFlourWeights(
  sourdoughFlourWeight: number, flours: readonly SourdoughFlour[],
): number[];                                 // FarinhaFerm_i = FarinhaFerm × P_i/100 (§3.B)

export function sourdoughFlourPercentagesSumTo100(flours: readonly SourdoughFlour[]): boolean;
// = percentagesSumTo100(flours.map(f => f.percentage))  (§B.3)
```
Guards/decisões (uma linha cada):
- **SomaPartes ≤ 0 ou parte < 0 → `computeSourdoughWeights` retorna `null`** (não lança):
  estado inválido explícito, sem NaN, e seguro para o recalc em lote da issue 008
  (throw quebraria o batch); UI usa `isValidSourdoughParts` para o bloqueio §5.C.
- **hydration = `null` quando `flourWeight === 0`** (parte_farinha=0), casando com
  `Sourdough.hydration?` opcional (§2.B/§5.C).
- **rateio na ordem `(totalWeight × parte) / soma`** — mesma ordem da fórmula §3.B.
- **sem arredondamento interno** (§9); **sem custo aqui** (custo do fermento e Isca=0 são
  §3.E, issue separada) — este módulo só resolve pesos e hidratação derivada.

### Arquivos a criar
- `src/core/sourdough.ts` — cabeçalho citando §2.B/§3.B/§5.C; fórmulas comentadas com `§`.
- `src/core/sourdough.test.ts` — os 12 casos acima (TDD, escritos antes).

### Arquivos a modificar
- `src/core/bakers.ts` — extrair `export function percentagesSumTo100(percentages:
  readonly number[]): boolean` (move o `SUM_EPSILON` para dentro dele) e refatorar
  `flourPercentagesSumTo100` para reusá-lo. Comportamento externo idêntico.
- `src/core/bakers.test.ts` — 1–2 casos para `percentagesSumTo100` (lista genérica +
  drift); casos existentes de `flourPercentagesSumTo100` permanecem.

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts` (interfaces §6 já completas — não adicionar campos).
- `src/core/format.ts`, `src/core/format.test.ts` (arredondamento é da exibição, §9).
- `src/core/golden-example.test.ts` (contrato §12; só o recalc engine o destrava).
- `weightFromPercentage`/`flourTotal` (lógica reusada, não reescrever); `src/ui/*`,
  `src/storage/*`. `references/architecture.md` (mapa de módulos é do escriba, pós-merge).

### O que NÃO fazer
- Não tratar hidratação como entrada — é **sempre derivada** (§2.B, §5.C).
- Não normalizar/redistribuir as Partes para somar 100 — são números livres (§2.B.2, §5.A).
- Não incluir FarinhaFerm em `flourTotal`/F_total — é sub-receita (§3.A).
- Não computar custo nem tratar a Isca aqui (Isca custo 0 é §3.E, outra issue).
- Não arredondar internamente (§9); não retornar `NaN`/`Infinity`; não duplicar o epsilon.

### Ordem de implementação
1. Refatorar bakers.ts: extrair `percentagesSumTo100` + teste; suíte verde.
2. Escrever `sourdough.test.ts` com os 12 casos (falhando — TDD).
3. Implementar `sourdough.ts` (partsSum → isValidSourdoughParts → sourdoughTotalWeight →
   computeSourdoughWeights → distributeSourdoughFlourWeights → sourdoughFlourPercentagesSumTo100).
4. Rodar Vitest; golden §12 e 1:7:7 verdes; `npm run build`/typecheck strict limpo.
