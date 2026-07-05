---
id: "002"
titulo: Tipos da spec §6 + parsing/formatação numérica pt-BR
tipo: core
deps: ["001"]
status: todo
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
- [ ] Interfaces idênticas às da spec §6 (nomes e campos).
- [ ] Entrada aceita vírgula e ponto; exibição sempre vírgula.
- [ ] Nenhuma função de formatação usada em cálculo interno (regra §9).
- [ ] Cabeçalho do módulo cita §6/§7.1/§9.

## Regras de ouro
- `Intl.NumberFormat('pt-BR')` (plataforma, lib "consolidada" nativa) preferível a formatação manual — consultar MDN antes.

## Referências
- spec §6, §7.1, §9 · MDN Intl.NumberFormat

---

## Plano Técnico

### Análise do existente
Busca real (`grep -rn "format|parseDecimal|toFixed|Intl" src/`) → **nada existe** em `src/core`. Não há o que reusar nem estender; não há duplicação a evitar. Confirmações:
- `src/core/` contém apenas `.gitkeep` e `golden-example.test.ts` (teste dourado §12, falha proposital até issue 008). **NÃO tocar** neste arquivo.
- `src/ui/pages/*.ts` são stubs que só importam `design-system.css`; nenhuma formatação embutida. Nada a reusar.
- `tsconfig.json`: `strict:true`, `lib:["ES2022","DOM","DOM.Iterable"]`, `types:["vite/client","vitest/globals"]` → `Intl` disponível via lib DOM/ES2022; `describe/it/expect` globais (não precisam import, mas o golden test importa explicitamente — seguir o mesmo estilo por consistência).
- Runtime do projeto: Node 24 / V8 moderno; navegadores-alvo modernos (spec §10). `roundingMode` e `Intl` plenamente suportados.

### Decisão: `Intl.NumberFormat('pt-BR')` vs formatação manual
**Escolha: `Intl.NumberFormat('pt-BR', …)`** (regra de ouro 1 — plataforma nativa consolidada e mantida pelo runtime, preferível a `toFixed`+`replace` manual). Justificativa em uma linha: `toFixed` arredonda pela representação binária e **erra o half-up** — verificado neste ambiente: `(2.675).toFixed(2)==="2.67"` (deveria 2,68) e `(1.005).toFixed(2)==="1.00"` (deveria 1,01); `Intl` aplica arredondamento decimal correto e já entrega vírgula/símbolo/locale. Docs consultadas (regra de ouro 4):
- MDN `Intl.NumberFormat()` — opção `roundingMode`, default **`"halfExpand"`** (ties away from zero = half-up para valores ≥ 0, que é todo o domínio do app): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat
- MDN `Intl.NumberFormat.prototype.format` (`useGrouping`, `minimum/maximumFractionDigits`): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format

Arredondamento half-up confirmado empiricamente com o default `halfExpand`: `8.855→"8,86"`, `0.125→"0,13"`, `2.675→"2,68"`. **Passar `roundingMode:'halfExpand'` explicitamente** em cada formatter (auto-documenta a regra §9 e blinda contra mudança futura de default). Arredondamento SÓ na exibição (§9, architecture.md): estas funções recebem o valor canônico completo e nunca são chamadas dentro de cálculo — ver "O que NÃO fazer".

### Cuidado crítico — NBSP no `R$ 8,86`
Verificado no runtime: `Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(8.856)` → `"R$ 8,86"`, mas o separador entre `R$` e o número é **U+00A0 (NBSP, code 160)**, não o espaço ASCII U+0020. Em outras versões de ICU pode ser **U+202F (narrow NBSP)**. Se o teste for escrito com espaço comum, falha de forma confusa. **Decisão: normalizar** dentro de `formatCurrency`/`formatCostPerGram` — após `format()`, aplicar `.replace(/[  ]/g, ' ')` para retornar sempre espaço ASCII. Justificativa em uma linha: saída estável e igualdade previsível em teste, independente da versão de ICU/Node. Assim `formatCurrency(8.856) === "R$ 8,86"` com espaço comum, exatamente como a issue escreveu. (Alternativa de manter NBSP e assertar ` ` nos testes foi **descartada**: frágil entre versões de ICU.)

### Decisão: `useGrouping` por função
- `formatWeight`: **`useGrouping:false`** — obrigatório: `1041.6666→"1041,7"` (com grouping seria `"1.041,7"`, quebrando o teste exigido e o gabarito §12).
- `formatPercent`: **`useGrouping:false`** — percentuais são razões; consistência com weight; `192→"192,00"`.
- `formatCostPerGram`: **`useGrouping:false`** — valores < 1 (`R$ 0,0640`), grouping irrelevante.
- `formatCurrency`: **`useGrouping:true`** — convenção pt-BR para dinheiro (`R$ 1.234,56`); não afeta nenhum teste exigido (todos < 1000). Decisão registrada; zero ambiguidade.

### Cuidado crítico — `formatDate` em horário local
`formatDate` deve montar a string com getters **locais** (`getFullYear`, `getMonth()+1`, `getDate`) + `String(x).padStart(2,'0')` — **nunca** `toISOString()` (que converte para UTC e desloca o dia conforme o fuso: `new Date(2026,6,4)` é meia-noite local e em UTC-3 viraria `2026-07-04T03:00Z`, mas em fuso positivo poderia recuar para `2026-07-03`). Formato `aaaa-mm-dd` (§7.1).

### Cenários
- **Caminho feliz (gabarito §12)**: `formatCurrency(8.856)→"R$ 8,86"`; `formatWeight(1041.6666)→"1041,7"`; `formatPercent(72.72727)→"72,73"` (Hidratação Real ≈ 72,7%, mas exibição de % é 2 casas §9); `formatPercent(70)→"70,00"`; `formatPercent(192)→"192,00"`; `formatCostPerGram(0.064)→"R$ 0,0640"` (§2.A.1); `formatDate(new Date(2026,6,4))→"2026-07-04"`.
- **Bordas parseDecimal**: `"12,5"→12.5`; `"12.5"→12.5`; `""→null`; `"   "→null` (trim antes; `Number('')===0` — checar vazio ANTES); `"abc"→null`; `"12.5.5"→null`; `"1,5,5"→null`; `"Infinity"→null` (usar `Number.isFinite`); `"  8,00 "→8` (trim nas pontas); `"0"→0` e `"0,00"→0` (zero é válido, não confundir com null).
- **Bordas de arredondamento (half-up)**: `formatCurrency(8.855)→"R$ 8,86"`; `formatPercent(0.125)→"0,13"`; `formatCurrency(2.675)→"R$ 2,68"` (todos onde `toFixed` erraria).
- **Zero e valores triviais**: `formatCurrency(0)→"R$ 0,00"`; `formatWeight(0)→"0,0"`; `formatPercent(0)→"0,00"` (água a R$0,00/L e Isca=0g do §12).
- **Erros**: entrada não-string em `parseDecimal` está fora do contrato (assinatura `string`); não tratar `number`/`null` — o TS strict impede na chamada.

### Testes primeiro (Vitest, TDD — ANTES da implementação)
Arquivo `src/core/format.test.ts` (co-localizado, padrão do golden test). Um `it` por comportamento:
1. `parseDecimal("12,5")` → `12.5`
2. `parseDecimal("12.5")` → `12.5`
3. `parseDecimal("abc")` → `null`
4. `parseDecimal("")` → `null`
5. `parseDecimal("   ")` → `null`
6. `parseDecimal("12.5.5")` → `null`
7. `parseDecimal("Infinity")` → `null`
8. `parseDecimal("  8,00 ")` → `8`
9. `parseDecimal("0")` → `0` (garante que 0 não vira null)
10. `formatCurrency(8.856)` → `"R$ 8,86"` (§12, espaço ASCII normalizado)
11. `formatCurrency(8.855)` → `"R$ 8,86"` (half-up)
12. `formatCurrency(2.675)` → `"R$ 2,68"` (half-up onde toFixed erra)
13. `formatCurrency(0)` → `"R$ 0,00"`
14. asserção anti-NBSP: `expect(formatCurrency(8.856)).not.toContain(" ")` (blinda a normalização)
15. `formatCostPerGram(0.064)` → `"R$ 0,0640"` (§2.A.1, 4 casas)
16. `formatWeight(1041.6666)` → `"1041,7"` (§12, sem separador de milhar)
17. `formatWeight(0)` → `"0,0"`
18. `formatPercent(72.72727)` → `"72,73"`
19. `formatPercent(70)` → `"70,00"`
20. `formatPercent(192)` → `"192,00"` (§12 Soma da Receita)
21. `formatPercent(0.125)` → `"0,13"` (half-up)
22. `formatDate(new Date(2026, 6, 4))` → `"2026-07-04"` (§7.1; getters locais)
23. `formatDate(new Date(2026, 0, 1))` → `"2026-01-01"` (padStart mês/dia)

`src/core/types.test.ts` — **não é necessário** (interfaces são apagadas em runtime; sem lógica a testar). Em vez disso, garantir cobertura de tipo com um arquivo de uso mínimo? Não: `tsc --noEmit` (script `build`) já valida que `types.ts` compila em strict. Registrar isto no plano; não criar teste de tipo redundante.

### Arquivos a criar
- `src/core/types.ts` — cópia **fiel** das interfaces da spec §6 (§264–397): `CalculationMode`, `PackageCost`, `Ingredient`, `SourdoughFlour`, `SourdoughParts`, `Sourdough`, `HydrationSummary`, `Pricing`, `BatchPlanningMode`, `Recipe`, `RecipeSummary`, `BakeEntry`, `BakeHistorySummary`. Manter nomes, campos, opcionais (`?`) e comentários `§` idênticos ao bloco da spec. Cabeçalho citando §6. `export` em cada tipo/interface. `Date` para `createdAt/updatedAt/date/periodStart/periodEnd` (conforme spec; serialização JSON fica para issues 011/012).
- `src/core/format.ts` — `parseDecimal`, `formatPercent`, `formatWeight`, `formatCurrency`, `formatCostPerGram`, `formatDate`. Funções puras, sem DOM, sem localStorage. Cabeçalho citando §6/§7.1/§9. Instanciar os `Intl.NumberFormat` uma vez em escopo de módulo (const reutilizadas) para performance; cada uma com `roundingMode:'halfExpand'` explícito e o `useGrouping`/`fractionDigits` decidido acima.
- `src/core/format.test.ts` — os 23 casos acima.

### Arquivos a modificar
- Nenhum. `references/architecture.md` (Mapa de módulos) é atualizado pelo escriba, não por esta issue.

### Arquivos que NÃO devem ser tocados
- `src/core/golden-example.test.ts` (contrato §12; falha proposital até issue 008).
- `tsconfig.json`, `vite.config.ts`, `package.json` — sem dependência nova (Intl é nativo; **zero deps adicionadas**, spec §10/§11.1).
- `references/design-system.css`, mockups, spec.

### Ordem de implementação
1. Escrever `src/core/format.test.ts` com os 23 casos (falhando — vermelho).
2. Escrever `src/core/types.ts` (interfaces §6) e validar com `npx tsc --noEmit`.
3. Implementar `src/core/format.ts` até os 23 testes passarem (verde), sem tocar no golden test.
4. Rodar `npm test` (golden continua falhando de propósito — esperado) e `npm run build` (tsc) para checar tipos.

### O que NÃO fazer
- **Não** usar `toFixed`/`parseFloat`+`replace` manual para formatação (erra half-up — verificado).
- **Não** chamar nenhuma `format*` dentro de cálculo interno; elas são camada de exibição e devolvem `string` (regra §9 / critério de aceite). Cálculos operam sobre `number` canônico em gramas.
- **Não** usar `innerHTML` nem tocar em DOM (funções puras; render com escape é responsabilidade das issues de UI).
- **Não** manter o NBSP/narrow-NBSP na saída de moeda (normalizar para espaço ASCII).
- **Não** usar `toISOString()` em `formatDate` (desloca por fuso).
- **Não** adicionar dependência externa (Intl é nativo; app 100% offline em runtime, §10/§11.1).
- **Não** aplicar `useGrouping` em `formatWeight` (quebraria `"1041,7"`).
