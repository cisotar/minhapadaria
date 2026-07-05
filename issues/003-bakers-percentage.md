---
id: "003"
titulo: Baker's percentage — F_total âncora e pesos derivados
tipo: core
deps: ["002"]
status: done
---

## Contexto
Núcleo da convenção de padeiro (spec §1.1–1.2, §3.A): farinha total é a âncora 100%; tudo deriva dela.

## O que fazer
- `src/core/bakers.ts` (nome livre, reusar módulo se fizer sentido):
  - Peso de cada farinha: `Peso_i = F_total × %_i / 100` (§1.1).
  - Peso de ingrediente não-farinha: `Peso_X = F_total × %_X / 100` (§1.2, §3.A) — inclusive a linha do fermento (§2.A.2).
  - Inverso: `%_X = (Peso_X / F_total) × 100` (§3.A).
  - `F_total = Σ pesos das farinhas principais` (§3.A) — usado na transição de modo (§1.5).
  - Múltiplas farinhas: soma de % deve ser exatamente 100 (validação exposta como predicado puro; bloqueio de UI vem na issue 010/014).
- Funções puras sobre `Ingredient[]`; sem arredondamento interno.

## Testes exigidos (TDD)
- §12: `F_total=1000`, água 70% → 700g; sal 2% → 20g; fermento 20% → 200g.
- Farinha única → 100% travado: peso = F_total.
- Duas farinhas 80/20 de 1000g → 800g/200g; soma % = 100 ok; 80/30 → predicado de soma acusa ≠100.
- Inverso: peso 700 sobre F_total 1000 → 70%.
- F_total = 0 → pesos 0, sem divisão por zero no inverso (retorno 0 ou null documentado).

## Critérios de aceite
- [x] Fórmulas §3.A exatas, sem arredondamento interno.
- [x] Fermento tratado como linha genérica (peso = F_total × %/100) — sem caso especial.
- [x] Divisão por zero tratada (§5.C).

## Referências
- spec §1.1, §1.2, §2.A.2, §3.A, §12

---

## Plano Técnico

### Análise do existente
Busca real (`grep -rn "bakers\|F_total\|flourTotal\|percentage" src/ --include=*.ts`) → em `src/core/` existem hoje apenas `types.ts`, `format.ts`, `golden-example.test.ts` e os testes de `format`. **Nenhuma lógica de baker's percentage existe** — nada a duplicar; tudo a criar do zero. Reusos obrigatórios:
- **`src/core/types.ts` → `Ingredient` (e `Ingredient.category`, `Ingredient.weight`, `Ingredient.percentage`)** — o módulo importa e opera sobre `Ingredient[]`; **não redefinir** o tipo. `category: 'flour'|'liquid'|'fat'|'salt'|'extra'` é o discriminador de "farinha principal" (`'flour'`) para o somatório de `F_total` (§3.A). `weight` é o valor canônico em gramas (§7); `percentage` é % sobre `F_total` (§1.1/§1.2).
- **`src/core/format.ts` → NÃO importar aqui.** É a camada de exibição (§9); usá-la dentro do cálculo violaria "arredondamento só na exibição". `bakers.ts` devolve `number` cru, precisão total. Registrado em "o que NÃO fazer".
- **`src/core/format.test.ts` → estilo de teste a espelhar**: import explícito de `{ describe, it, expect } from 'vitest'` (embora `vitest/globals` esteja em `tsconfig`), casos numerados um-por-comportamento, cabeçalho citando as §. Seguir 1:1 por consistência.
- **`golden-example.test.ts`** cobre o gabarito §12 ponta-a-ponta e falha de propósito até a issue 008 (recalc engine). Esta issue **não o toca**; adiciona o subconjunto §12 que é dele isoladamente testável (F_total=1000 → água 700 / sal 20 / fermento 200).
- Config: `tsconfig` `strict:true`, `target/lib ES2022`; Node 24. Nada de DOM/localStorage neste módulo (regra de pasta `core/` em `references/architecture.md`).

### Decisão de biblioteca
**Nenhuma dependência nova.** Este é o core de cálculo da spec — o produto (exceção explícita da regra de ouro 1 em `architecture.md`): aritmética própria, pura, com TDD. Zero rede em runtime (§10/§11.1). Não se aplica busca de doc de lib externa.

### Assinaturas propostas (`src/core/bakers.ts`, funções puras, sem mutação)
```ts
import type { Ingredient } from './types';

// F_total = Σ pesos das farinhas principais (category 'flour'). §1.1, §3.A, §1.5.
export function flourTotal(ingredients: readonly Ingredient[]): number;

// Peso derivado de %: Peso_X = F_total × %_X / 100.
// Genérica p/ farinha (§1.1), não-farinha (§1.2/§3.A) E a linha do fermento (§2.A.2).
export function weightFromPercentage(flourTotal: number, percentage: number): number;

// Inverso: %_X = (Peso_X / F_total) × 100. §3.A (modo peso→%, transição §1.5).
// Divisão por zero: se flourTotal <= 0 → retorna 0 (§5.C). Documentado, testado.
export function percentageFromWeight(weight: number, flourTotal: number): number;

// Predicado puro: soma das % das farinhas principais é exatamente 100%. §1.1, §2.A.
// Tolerância epsilon (1e-9) só p/ blindar drift IEEE-754; NÃO é arredondamento de valor.
// Bloqueio/UI-blur fica nas issues 010/014 — aqui só o predicado.
export function flourPercentagesSumTo100(ingredients: readonly Ingredient[]): boolean;
```
Notas de decisão (uma linha cada):
- `flourTotal` filtra `category === 'flour'` e soma `weight` — as farinhas do *fermento* são sub-receita (§2.B) e **não** têm categoria `flour` na lista principal, logo não entram (correto por §3.A).
- `weightFromPercentage(0, x) === 0` naturalmente (0 × qualquer) — F_total=0 já dá peso 0 sem guarda extra.
- `percentageFromWeight` é a única com risco de divisão por zero → guarda `flourTotal <= 0 ? 0` (retorno **0**, não `null`: mantém a assinatura `number` limpa para o recalc em lote da issue 008; `<= 0` também cobre negativo indevido, §5.C).
- `flourPercentagesSumTo100` opera sobre `Ingredient[]` (filtra `'flour'`) para a mesma fonte das demais; epsilon `1e-9` documentado como anti-drift, não como caixa de arredondamento (80+20 é exato em IEEE-754; 80,1+19,9 pode driftar).
- `readonly` nos parâmetros e retorno de novos números garantem pureza (sem mutar o array de entrada — o recalc parte sempre do estado puro, §1.6).

### Cenários (números concretos da spec)
- **Caminho feliz §12** (`F_total=1000`): `weightFromPercentage(1000,70)===700` (água); `(1000,2)===20` (sal); `(1000,20)===200` (fermento, **linha genérica**, §2.A.2). `percentageFromWeight(700,1000)===70` (inverso).
- **Farinha única** trava em 100% (§2.A): peso = `weightFromPercentage(F,100) === F`; `flourPercentagesSumTo100([farinha 100%]) === true`.
- **Duas farinhas 80/20 de 1000g**: `weightFromPercentage(1000,80)===800`, `(1000,20)===200`; soma 800+200=1000=`flourTotal` (consistência); `flourPercentagesSumTo100(80,20) === true`.
- **Duas farinhas 80/30**: `flourPercentagesSumTo100(80,30) === false` (soma 110 ≠ 100) — predicado acusa, sem redistribuir (§5.A/§5.B).
- **Borda — F_total = 0**: `flourTotal([])===0`; `weightFromPercentage(0,70)===0`; `percentageFromWeight(700,0)===0` (guarda §5.C, sem `Infinity`/`NaN`).
- **Borda — drift**: `flourPercentagesSumTo100(33.33/33.33/33.34)` → epsilon evita falso negativo; `flourPercentagesSumTo100(60/60)` → `false`.
- **Erros**: entradas fora do contrato de tipo (não-`Ingredient[]`, `percentage` não-número) são barradas pelo TS strict na chamada — não há tratamento defensivo em runtime (mantém núcleo enxuto).

### Testes primeiro (`src/core/bakers.test.ts`, Vitest, ANTES da implementação)
Um caso por comportamento, valores de entrada → saída:
1. `flourTotal` de 1 farinha 1000g → `1000` (§3.A).
2. `flourTotal` de 2 farinhas 800g+200g → `1000` (§3.A).
3. `flourTotal([])` → `0` (borda, sem farinha).
4. `flourTotal` ignora não-farinhas: farinha 1000 + água 700 (`liquid`) + sal 20 (`salt`) → `1000` (só `category 'flour'`, §3.A).
5. `weightFromPercentage(1000, 70)` → `700` (água §12).
6. `weightFromPercentage(1000, 2)` → `20` (sal §12).
7. `weightFromPercentage(1000, 20)` → `200` (fermento como linha genérica, §2.A.2 — **sem caso especial**).
8. `weightFromPercentage(1000, 100)` → `1000` (farinha única travada, §2.A).
9. `weightFromPercentage(1000, 80)` → `800` e `weightFromPercentage(1000, 20)` → `200` (duas farinhas 80/20).
10. `weightFromPercentage(0, 70)` → `0` (F_total=0, sem divisão por zero).
11. `percentageFromWeight(700, 1000)` → `70` (inverso §3.A).
12. `percentageFromWeight(800, 1000)` → `80` e `percentageFromWeight(200,1000)` → `20` (inverso 80/20, transição §1.5).
13. `percentageFromWeight(700, 0)` → `0` (guarda divisão por zero, §5.C — **não** `Infinity`/`NaN`).
14. `percentageFromWeight(0, 0)` → `0` (borda dupla).
15. `flourPercentagesSumTo100` com 100% (única) → `true` (§2.A).
16. `flourPercentagesSumTo100` com 80/20 → `true`.
17. `flourPercentagesSumTo100` com 80/30 → `false` (soma 110 ≠ 100, acusa).
18. `flourPercentagesSumTo100` com 33,33/33,33/33,34 → `true` (epsilon anti-drift IEEE-754).
19. Pureza: chamar as funções não altera o `Ingredient[]` de entrada (snapshot antes/depois igual).
20. Precisão total (sem arredondamento interno): `weightFromPercentage(1000, 72.7272727)` retorna `727.272727` cru (não `727,3`) — prova que `format.*` não é chamado aqui.

### Arquivos a criar
- `src/core/bakers.ts` — módulo com cabeçalho citando §1.1/§1.2/§2.A.2/§3.A/§5.C e as 4 funções acima.
- `src/core/bakers.test.ts` — os 20 casos TDD, import explícito de `vitest`.

### Arquivos a modificar
- `issues/003-bakers-percentage.md` (este arquivo) — apenas o plano.

### Arquivos que NÃO devem ser tocados
- `src/core/types.ts`, `src/core/format.ts` (reuso por import; sem alteração).
- `src/core/golden-example.test.ts`, `src/core/format.test.ts` (suítes de outras issues).
- `references/architecture.md` (mapa de módulos é atualizado pelo escriba, não por esta issue).
- `spec/…`, mockups, design-system, qualquer arquivo de UI/storage/export.

### O que NÃO fazer (regras da issue)
- **Sem arredondamento interno**: nunca chamar `formatWeight`/`formatPercent`/qualquer `format.*` dentro de `bakers.ts`; retornar `number` com precisão total (§9; teste 20 blinda isso).
- **Sem caso especial para o fermento**: a linha do fermento usa `weightFromPercentage` genérica (§2.A.2/§3.A). Toda a composição interna (Partes, farinhas do fermento, hidratação derivada) é da issue 004 — não vaza para cá.
- **Sem redistribuição/validação-bloqueante de %**: `flourPercentagesSumTo100` só reporta; bloqueio no blur e "sempre ≥1 farinha" são das issues 010/014 (§5.A/§5.B).
- **Sem mutação** do array de entrada e **sem I/O** (DOM, localStorage, rede) — módulo `core/` puro.

### Ordem de implementação
1. Escrever `src/core/bakers.test.ts` com os 20 casos (falha vermelha).
2. Implementar `flourTotal` → `weightFromPercentage` → `percentageFromWeight` (com guarda de divisão por zero) → `flourPercentagesSumTo100` (epsilon).
3. Rodar `vitest` até verde; cabeçalho do módulo com as § citadas; commit `test:`/`feat:` com nº 003.
