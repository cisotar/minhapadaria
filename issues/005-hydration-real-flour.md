---
id: "005"
titulo: Hidratação nominal/real (fat fora) + Farinha Real Consumida
tipo: core
deps: ["003", "004"]
status: todo
---

## Contexto
Painéis informativos do padeiro (spec §2.C, §2.D). Gordura (`fat`) NÃO hidrata (§2.C, decisão 15).

## O que fazer
- `src/core/hydration.ts`:
  - `HidrataçãoNominal = Σ LíquidosDeclarados / F_total × 100` — somente `category === 'liquid'` (§2.C).
  - `HidrataçãoReal = (Σ LíquidosDeclarados + ÁguaFerm) / (F_total + FarinhaFerm) × 100` (§2.C).
  - `FarinhaRealConsumida = F_total + FarinhaFerm` (§2.D).
  - Divisão por zero: F_total=0 e sem fermento → nominal/real null.

## Testes exigidos (TDD)
- §12: água 700g, F_total 1000, ÁguaFerm 100, FarinhaFerm 100 → Nominal=70%, Real=800/1100≈72.7272…% (comparar sem arredondar, `toBeCloseTo(72.7272, 3)`), FarinhaReal=1100g.
- Receita com água 700 (`liquid`) + azeite 40 (`fat`) → nominal usa só 700 (fat fora).
- Leite+cerveja+água todos `liquid` → somam.
- Sem fermento (W_ferm=0) → Real = Nominal.
- F_total=0 → null, sem NaN.

## Critérios de aceite
- [ ] `fat` excluído das duas hidratações; entra em peso/custo normalmente (§2.A).
- [ ] Farinha Real Consumida = F_total + Farinha do Fermento (§2.D).
- [ ] Zero NaN em bordas.

## Referências
- spec §2.A, §2.C, §2.D, §12, decisão 15

---

## Plano Técnico

### Análise do existente (busca real: `grep`/Read em `src/core/`)
Reusar tudo; nada duplicado (regra de ouro #2):
- `src/core/types.ts` → `Ingredient` (campo `category: 'flour'|'liquid'|'fat'|'salt'|'extra'`, `weight` em gramas) e `HydrationSummary` (`nominal`, `real`). O filtro de líquidos usa `category === 'liquid'` já existente — não criar flag nova.
- `src/core/sourdough.ts` → interface **`SourdoughWeights`** (`totalWeight`, `iscaWeight`, `flourWeight`, `waterWeight`, `hydration`) já exportada e já é o retorno de `computeSourdoughWeights(...)` (issue 004). `hydration.ts` **consome** `flourWeight` (= Farinha do Fermento) e `waterWeight` (= Água do Fermento) desse objeto; NÃO recalcula rateio de fermento. Importar `import type { SourdoughWeights } from './sourdough'`.
- `src/core/bakers.ts` → **`flourTotal(ingredients)`** já soma `category === 'flour'` (F_total, §3.A). Reusar diretamente — não reimplementar a soma da farinha.
- Convenções de `bakers.ts`/`sourdough.ts` a espelhar no novo módulo: cabeçalho citando `§`, 100% puro (sem DOM/localStorage/`format.ts`), sem arredondar (§9), sem mutar entrada (§1.6), guarda de ÷0 devolvendo estado explícito (`null`) em vez de `NaN`/`Infinity`.
- Padrão de teste a seguir: `src/core/sourdough.test.ts` (Vitest `describe/it`, fábrica mínima de objeto, `toBeCloseTo(x, 9)` para crus, `toBeNull()` para indefinido).

### Decisões de projeto (cada uma, uma linha)
- **Sem lib externa**: é o core de cálculo da spec (o produto) — TDD manual, exceção declarada à regra de ouro #1. Zero rede/secret (§10, §11.1). Nenhuma dependência nova.
- **`SourdoughWeights | null` como 2º parâmetro**: `null` = sem fermento configurado ou Partes inválidas (`computeSourdoughWeights` já retorna `null`, §5.C) → ÁguaFerm=0 e FarinhaFerm=0, logo Real = Nominal e FarinhaReal = F_total.
- **Retorno `number | null`** nas hidratações: `null` só quando o denominador é 0 (§5.C, sem `NaN`). Mapear para `HydrationSummary` (campos não-nulos) fica a cargo do recalc engine (issue 008) — este módulo entrega o valor cru; `types.ts` NÃO é tocado.

### Assinaturas (`src/core/hydration.ts`)
```ts
import type { Ingredient } from './types';
import type { SourdoughWeights } from './sourdough';

// Σ pesos SOMENTE category 'liquid' (§2.C, decisão 15 — 'fat' fora).
export function declaredLiquidsWeight(ingredients: readonly Ingredient[]): number;

// Nominal = ΣLíquidos / F_total × 100 (§2.C). F_total=0 → null (§5.C).
export function nominalHydration(ingredients: readonly Ingredient[]): number | null;

// Real = (ΣLíquidos + ÁguaFerm) / (F_total + FarinhaFerm) × 100 (§2.C).
// sourdough=null → ÁguaFerm=FarinhaFerm=0 (Real=Nominal). Denominador 0 → null.
export function realHydration(
  ingredients: readonly Ingredient[],
  sourdough: SourdoughWeights | null,
): number | null;

// Farinha Real Consumida = F_total + FarinhaFerm (§2.D). sourdough=null → F_total.
export function realFlourConsumed(
  ingredients: readonly Ingredient[],
  sourdough: SourdoughWeights | null,
): number;
```
Implementação: `declaredLiquidsWeight` = filter `'liquid'` + reduce; `F_total` via `flourTotal(ingredients)` (reuso bakers.ts); `flourFerm = sourdough?.flourWeight ?? 0`, `waterFerm = sourdough?.waterWeight ?? 0`; hidratações checam `denominador === 0 ? null : num/den*100`. Sem arredondamento (§9).

### Cenários (números concretos da spec)
- **Caminho feliz (golden §12)**: água 700 `liquid`, F_total 1000, `SourdoughWeights{flourWeight:100, waterWeight:100}` → Nominal 70; Real = 800/1100 = 72,7272…% (comparar **sem arredondar**); FarinhaReal = 1100.
- **`fat` fora (§2.A/§2.C, decisão 15)**: água 700 `liquid` + azeite 40 `fat`, F_total 1000 → Nominal usa só 700 (=70%); azeite entra em peso/custo em outra issue, não aqui.
- **Vários líquidos**: leite 300 + cerveja 200 + água 100 (todos `liquid`) → soma 600.
- **Sem fermento (`sourdough=null`)**: Real = Nominal; FarinhaReal = F_total.
- **Borda ÷0**: F_total=0 e `sourdough=null` → Nominal e Real `null`; FarinhaReal 0. Sem `NaN`.
- **Borda ÷0 assimétrica**: F_total=0 mas `SourdoughWeights{flourWeight:100,waterWeight:100}` → Nominal `null`, Real = (ΣLíq+100)/(0+100) válido (denominador>0). Sem `NaN`.

### Testes primeiro (TDD) — `src/core/hydration.test.ts`, um caso por comportamento
`declaredLiquidsWeight`:
1. [água 700 `liquid`] → `700`.
2. [água 700 `liquid`, azeite 40 `fat`] → `700` (fat excluído, decisão 15).
3. [leite 300, cerveja 200, água 100 — todos `liquid`] → `600`.
4. [sem `liquid`: só farinha/sal] → `0`.

`nominalHydration`:
5. golden: [água 700 `liquid`] + [farinha 1000 `flour`] → `70`.
6. [água 700 `liquid`, azeite 40 `fat`] + farinha 1000 → `70` (fat fora).
7. F_total=0 (sem `flour`) → `toBeNull()` (sem `NaN`).

`realHydration`:
8. golden: liquids 700, farinha 1000, `{flourWeight:100, waterWeight:100}` → `toBeCloseTo(72.7272, 3)` **e** `not.toBe(72.73)` (garante que não arredondou).
9. `sourdough = null` (liquids 700, farinha 1000) → `70` (Real=Nominal).
10. F_total=0 e `sourdough=null` → `toBeNull()`.
11. F_total=0 e `{flourWeight:100, waterWeight:100}`, sem líquidos → `toBeCloseTo(100, 9)` (denominador>0, sem `NaN`).

`realFlourConsumed`:
12. golden: farinha 1000, `{flourWeight:100}` → `1100`.
13. farinha 1000, `sourdough=null` → `1000`.
14. F_total=0, `sourdough=null` → `0`.

### Arquivos a criar
- `src/core/hydration.ts` — as 4 funções acima (§2.C/§2.D, decisão 15).
- `src/core/hydration.test.ts` — os 14 casos acima, escritos ANTES da implementação.

### Arquivos a modificar
- `references/architecture.md` — acrescentar 2 linhas no "Mapa de módulos" (`hydration.ts` e `hydration.test.ts` → responsabilidade + §2.C/§2.D/§12) ao final da implementação (tarefa do escriba, não do arquiteto).

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts`, `src/core/bakers.ts`, `src/core/sourdough.ts` (apenas importados).
- Qualquer arquivo de `src/ui/`, `src/storage/`, `src/export/`, mockups, spec, design-system.

### O que NÃO fazer
- NÃO incluir `fat` (nem `salt`/`extra`) na soma de líquidos (decisão 15, §2.C).
- NÃO arredondar internamente (§9) — comparar cru nos testes.
- NÃO recalcular pesos/rateio do fermento aqui — consumir `SourdoughWeights` de `computeSourdoughWeights` (issue 004).
- NÃO calcular custo, precificação ou peso do azeite (§3.E/§2.A — outras issues).
- NÃO importar `format.ts`, DOM ou localStorage; sem rede, sem secret (§10/§11.1).
- NÃO mutar os arrays/objetos de entrada (§1.6); sem `throw` em borda — retornar `null`/`0`.

### Ordem de implementação
1. Escrever `hydration.test.ts` com os 14 casos (falhando).
2. Implementar `declaredLiquidsWeight` → casos 1–4 verdes.
3. Implementar `nominalHydration` (reuso `flourTotal`) → 5–7.
4. Implementar `realHydration` → 8–11.
5. Implementar `realFlourConsumed` → 12–14.
6. `vitest` toda a suíte verde; escriba atualiza `architecture.md`.
