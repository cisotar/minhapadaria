---
id: "002"
titulo: Tipos da spec §6 + parsing/formatação numérica pt-BR
tipo: core
deps: ["001"]
status: done
---

## Contexto
Todas as estruturas de dados da spec §6 e a camada de parsing/formatação pt-BR (§7.1, §9). Arredondamento SÓ na exibição; valor canônico sempre gramas (§9, architecture.md).

## O que fazer
- `src/core/types.ts`: copiar fielmente as interfaces da spec §6 (`CalculationMode`, `PackageCost`, `Ingredient`, `SourdoughFlour`, `SourdoughParts`, `Sourdough`, `HydrationSummary`, `Pricing`, `BatchPlanningMode`, `Recipe`, `RecipeSummary`, `BakeEntry`, `BakeHistorySummary`).
- `src/core/format.ts`:
  - `parseDecimal(input: string): number | null` — aceita vírgula OU ponto (§7.1); rejeita lixo (`NaN` → null); string vazia → null.
  - `formatPercent(n)` — 2 casas, vírgula (§9). Ex: `70` → `"70,00"`.
  - `formatWeight(n)` — 1 casa, vírgula. Ex: `1041.666…` → `"1041,7"`.
  - `formatCurrency(n)` — 2 casas, vírgula, prefixo `R$ `. Ex: `8.856` → `"R$ 8,86"`.
  - `formatCostPerGram(n)` — 4 casas (§9). Ex: `0.064` → `"R$ 0,0640"`.
  - `formatDate(d: Date)` — `aaaa-mm-dd` (§7.1).
- Arredondamento half-up padrão de exibição; funções puras, sem DOM.

## Testes exigidos (TDD)
- `parseDecimal("12,5")` → 12.5 · `parseDecimal("12.5")` → 12.5 · `parseDecimal("abc")` → null · `parseDecimal("")` → null.
- `formatCurrency(8.856)` → `"R$ 8,86"` (valor do exemplo §12).
- `formatCostPerGram(0.064)` → `"R$ 0,0640"` (exemplo §2.A.1).
- `formatWeight(1041.6666)` → `"1041,7"` (§12 escalonamento).
- `formatPercent(72.72727)` → `"72,73"`.
- `formatDate(new Date(2026, 6, 4))` → `"2026-07-04"`.

## Critérios de aceite
- [x] Interfaces idênticas às da spec §6 (nomes e campos).
- [x] Entrada aceita vírgula e ponto; exibição sempre vírgula.
- [x] Nenhuma função de formatação usada em cálculo interno (regra §9).
- [x] Cabeçalho do módulo cita §6/§7.1/§9.

## Regras de ouro
- `Intl.NumberFormat('pt-BR')` (plataforma, lib "consolidada" nativa) preferível a formatação manual — consultar MDN antes.

## Referências
- spec §6, §7.1, §9 · MDN Intl.NumberFormat
