# Arquitetura — Calculadora de Pão com Fermento Natural (v5)

> Documento vivo, mantido pelo agente `escriba` a cada iteração do loop.
> Fonte da verdade do produto: `spec/Calculadora_Pao_Fermento_Natural_v5.md`.
> Este arquivo registra **como** construímos, não **o quê**.

## Regras de ouro (do cliente, 2026-07-05 — valem para TODO o código)

1. **Prefira libs consolidadas.** Funcionalidade não-trivial (XLSX, gráficos, datas, etc.): use lib estabelecida e mantida em vez de implementar à mão. Justifique a escolha em uma linha na issue. Exceção: o core de cálculo da spec é o produto — esse é nosso, com TDD.
2. **Reuse tudo o que existir.** Antes de criar função, componente ou classe CSS: procure no código (`grep`) e no design system. Se existe, reuse; se quase existe, estenda; nunca duplique. Roda já inventada não se reinventa.
3. **Segurança e privacidade são mandatórios.** Nenhum secret em código/commit (spec §11.1); nenhuma chamada de rede em runtime do app; dados do usuário ficam 100% locais (localStorage + arquivo de backup), sem telemetria; todo dado digitado pelo usuário (nomes, observações) é renderizado com escape — nunca `innerHTML` com string bruta, nunca `eval`; `package-lock.json` commitado.
4. **Documentação validada antes de implementar.** Ao usar lib, API do navegador ou configuração não-trivial, consulte a documentação oficial na internet (docs da lib, MDN, repositório oficial) — não implemente de memória. Registre na issue o link consultado. (Vale para os agentes durante o desenvolvimento; o app em runtime continua 100% offline.)

## Stack (decisão 2026-07-04)

- **Vite + TypeScript (strict) + Vitest**, sem framework de UI (vanilla TS + DOM).
  Motivo: app 100% client-side (spec §10); os mockups já são HTML+CSS puros sobre o design system — vanilla preserva fidelidade 1:1; as estruturas de dados da spec (§6) já são interfaces TypeScript.
- **3 páginas** (MPA do Vite): `index.html` (calculadora), `receitas.html`, `historico.html` — espelham `mockups/`.
- **Estilo**: importar `references/design-system.css` diretamente — única fonte de tokens e componentes. Tokens de `:root` imutáveis; classes novas permitidas (só com tokens, documentadas em `references/design-system.html`).
- **Testes**: Vitest. Core com TDD obrigatório; `jsdom` só se um teste de UI precisar.
- **Export XLSX**: lib a decidir na issue 019 (candidatas: `exceljs`, `xlsx`/SheetJS; critério: gerar 100% no navegador, zero rede em runtime).
- **Sem** back-end, sem secrets, sem chamadas de rede (spec §10, §11.1).

## Estrutura de pastas (alvo)

```
src/
  core/      # lógica pura: cálculo, validação, parsing/formatação — TDD, sem DOM, sem localStorage
  storage/   # persistência localStorage + backup/restauração JSON
  export/    # XLSX + página de impressão
  ui/        # componentes DOM por tela — zero lógica de negócio
```

## Convenções

- Valor canônico sempre em **gramas**, precisão total; arredondar **só na exibição** (spec §9): % 2 casas · peso 1 casa · R$ 2 casas · custo/g 4 casas.
- **Uma única função central de recálculo** por receita, sempre a partir do estado puro (spec §1.6). Sem botão de enviar; recálculo imediato por campo.
- Entrada numérica aceita vírgula ou ponto; exibição com vírgula; datas `aaaa-mm-dd` (spec §7.1).
- Todo módulo novo: cabeçalho citando as seções da spec que implementa; fórmulas não óbvias comentadas com `§`.
- Commits convencionais (`feat:`, `fix:`, `test:`, `chore:`), sempre com o nº da issue. Nunca push automático.
- **Idioma (decisão do cliente 2026-07-05)**: código, comentários, commits, planos, issues e docs de processo (PROGRESS, este arquivo) podem ser integralmente em inglês. **Exceção**: toda string visível ao usuário final na UI é pt-BR (produto para padeiro brasileiro; formatos da spec §7.1).
- O exemplo validado da Seção 12 é o **teste dourado** permanente da suíte: R$ 8,86 · 70% / 72,7% · 1100 g · 192% · 1041,7 g.

## Mapa de módulos

_(preenchido pelo escriba conforme o código nasce — caminho → responsabilidade → seções da spec)_

| Caminho | Responsabilidade | Seções da spec |
|---------|------------------|-----------------|
| `src/core/types.ts` | Interfaces de domínio: Recipe, Ingredient, Sourdough, BakeEntry, Pricing, etc. Cópia 1:1 da seção 6. Campos derivados marcados readonly. Sem lógica, sem DOM. | §6 (estrutura de dados) |
| `src/core/format.ts` | Parsing e formatação numérica pt-BR: parseDecimal (aceita vírgula OU ponto), formatPercent/Weight/Currency/CostPerGram (Intl.NumberFormat), formatDate (aaaa-mm-dd). Arredonda SOMENTE exibição (§9). | §6, §7.1, §9 (entrada/exibição) |
| `src/core/format.test.ts` | TDD: 23 casos parseDecimal, formatters, formatDate. Golden §12 validado (1041,7; R$ 8,86). | §7.1, §9, §12 |
| `src/core/bakers.ts` | Baker's percentage — convenção de padeiro. Funções puras: flourTotal (Σ pesos farinhas principal); weightFromPercentage (Peso = F_total × %/100); percentageFromWeight (% = Peso/F_total × 100, guarda F_total ≤ 0); **percentagesSumTo100** (dono único SUM_EPSILON, reusável); flourPercentagesSumTo100 (delega a percentagesSumTo100). Sem DOM, sem arredondamento (§9), precisão total. | §1.1, §1.2, §1.5, §2.A.2, §3.A, §5.C |
| `src/core/bakers.test.ts` | TDD: 22 casos baker's percentage — flourTotal (4), weightFromPercentage (6), percentageFromWeight (4), flourPercentagesSumTo100 (4), **percentagesSumTo100 (2, novo)**, pureza (2). Golden §12 validado (1000g farinha; 700g água, 20g sal, 200g fermento). | §1.1, §1.2, §2.A.2, §3.A, §5.C, §9, §12 |
| `src/core/sourdough.ts` | Sub-receita do fermento natural. Funções puras: sourdoughTotalWeight (W_ferm = F_total × %/100, reuso weightFromPercentage); partsSum (Σ Isca+Farinha+Água); isValidSourdoughParts (guarda SomaPartes>0 e partes≥0); computeSourdoughWeights (rateio interno, hidratação DERIVADA); distributeSourdoughFlourWeights (rateio por %); sourdoughFlourPercentagesSumTo100 (reusa percentagesSumTo100). Sem DOM, sem arredondamento (§9), precisão total. | §2.B, §2.B.2, §2.B.3, §3.B, §5.C |
| `src/core/sourdough.test.ts` | TDD: 12 casos sourdough — sourdoughTotalWeight (1), partsSum (1), computeSourdoughWeights (5 limites), isValidSourdoughParts (1), distributeSourdoughFlourWeights (2), sourdoughFlourPercentagesSumTo100+pureza (2). Cobre hidratação derivada (null quando FarinhaFerm=0), valores crus (§9), transição entre Partes e pesos. | §2.B, §2.B.2, §2.B.3, §3.B, §5.C, §9 |
| `src/core/hydration.ts` | Painel de hidratação e Farinha Real Consumida. Funções puras: declaredLiquidsWeight (Σ category 'liquid' sem 'fat'); nominalHydration (ΣLíquidos/F_total×100, null se ÷0); realHydration ((ΣLíquidos+ÁguaFerm)/(F_total+FarinhaFerm)×100, null se ÷0); realFlourConsumed (F_total+FarinhaFerm, sempre número). Sem DOM, sem arredondamento (§9), precisão total. Reusa flourTotal (bakers.ts, §3.A). | §2.C, §2.D, §5.C, decisão 15 |
| `src/core/hydration.test.ts` | TDD: 14 casos hidratação — declaredLiquidsWeight (4, fat excluído), nominalHydration (3), realHydration (4, sourdough=null, ÷0 defensivo), realFlourConsumed (3). Golden §12 validado (70% nominal, 72,7272…% real, 1100g farinha real). Cobre edge case F_total=0 com fermento>0 (Nominal null, Real numérico). | §2.C, §2.D, §5.C, §9, §12, decisão 15 |
| `src/core/costs.ts` | Cálculo de custos — núcleo puro. Funções: packageSizeInGrams (normaliza unidades kg/L→×1000, mL/g→×1); costPerGram (Preço÷Peso, derivado nunca digitado, null se Peso≤0); ingredientRecipeCost (peso×C/g, propaga null); sourdoughCost (Σ FarinhaFerm×C + ÁguaFerm×C, Isca SEMPRE fora); sourdoughCostPerGram (Custo÷W_ferm, 0 se inválido); totalRecipeCost (Σ ingredientes+fermento com soma compensada Neumaier). Sem DOM, sem localStorage, precisão total. Reusa costPerGram base. | §2.A, §2.A.1, §2.B.2, §3.E, §5.C |
| `src/core/costs.test.ts` | TDD: 13 casos custo — packageSizeInGrams (1), costPerGram (4, derivado, null em Peso≤0), ingredientRecipeCost (1, propaga null), sourdoughCost (3, Isca fora), sourdoughCostPerGram (1, divide segura), totalRecipeCost (2, golden §12 → 8,86 exato), pureza (1). Golden §12 validado (R$ 8,86 com Neumaier; azeite 0,064/g para 1250g a R$80). | §2.A, §2.A.1, §2.B.2, §3.E, §5.C, §9, §12 |
| `src/core/pricing.ts` | Precificação — núcleo puro. Funções: clampMargin (limita [0, 99.9] §5.C decisão 4); effectiveQuantity (≥1, guarda ÷0); unitCost (CustoTotal/Qtd derivado §3.E); priceFromSalePrice (modo Preço Fixo, guarda salePrice≤0→profitMargin=0); priceFromMargin (modo Margem%, Preço=(CustoUnit)/(1−m/100), m clampeada); priceFromProfit (modo Lucro Fixo, reverte); pricingTotals (totais §3.E — **RESOLUÇÃO: totalProductionCost = unitCost×Qtd, golden §12 fonte da verdade**); marginStatus (faixas >30/15-30/<15 §4); isLoss (break-even inclusivo ≤ §5.C). Sem DOM, sem localStorage, precisão total. Reusa effectiveQuantity, clampMargin. | §3.E, §4, §5.C, §12, decisão 4 |
| `src/core/pricing.test.ts` | TDD: 18 casos precificação — unitCost (2), clampMargin/effectiveQuantity (5), priceFromMargin (2), priceFromSalePrice (2), priceFromProfit (1), sincronização 3 modos (1), pricingTotals (2), marginStatus (6), isLoss (1), pureza (1). Golden §12 completo: unitCost=4,43, margin 40→salePrice 7,3833/profit 2,9533, totals 8,86/14,7666/5,9066. | §3.E, §4, §5.C, §9, §12, decisão 4 |
| `src/ui/pages/calculadora.ts` | Entry da página Calculadora (index.html) · carrega design-system.css · será UI completa da calculadora | §1–6, §9, §10 (app MPA client-side) |
| `src/ui/pages/receitas.ts` | Entry da página Minhas Receitas (receitas.html) · carrega design-system.css | §2.F (gestão de receitas) |
| `src/ui/pages/historico.ts` | Entry da página Histórico de Fornadas (historico.html) · carrega design-system.css | §14 (histórico de fornadas) |
| `src/core/golden-example.test.ts` | Teste dourado permanente · fixa gabarito da §12 como contrato da suíte · falha propositalmente até issue 008/020 implementar o recalc engine | §12 (exemplo validado) |

## Decisões técnicas registradas

| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-07-04 | Vanilla TS, sem framework | Fidelidade aos mockups HTML/CSS; escopo v1 pequeno; spec já em TS |
| 2026-07-04 | Issues locais em `issues/`, não GitHub | Loop noturno sem dependência de rede/permissões do `gh` |
| 2026-07-05 | Caminhos relativos no vite.config.ts | Evita dependência `@types/node` · Vite resolve naturalmente paths da raiz · desvia conscientemente do plano original com `import.meta.dirname + node:path` |
| 2026-07-05 | Intl.NumberFormat ('pt-BR') + halfExpand vs toFixed manual | toFixed erra half-up (ex.: 2.675→2.67 instead of 2.68) · Intl.NumberFormat aplica rounding decimal correto, já entrega vírgula/símbolo/locale · halfExpand = half-up em todo domínio ≥ 0 do app · roundingMode passado explicitamente para auto-documentar §9 |
| 2026-07-05 | percentagesSumTo100 extraído de bakers.ts como dono único de SUM_EPSILON (issue 004) | flourPercentagesSumTo100 delega a percentagesSumTo100; sourdoughFlourPercentagesSumTo100 também reusa · epsilon centralizado 1e-9, anti-drift IEEE-754 · zero duplicação (regra de ouro #2) · testado em 2 novos casos (21–22 bakers.test.ts) |
| 2026-07-05 | Soma compensada (Neumaier) em totalRecipeCost/sourdoughCost (issue 006) | Elimina drift IEEE-754 acumulado em ordem dos termos · golden §12: 8+0,06+0,8 → 8,86 exato (não 8,860000000000001) · algoritmo puro sem lib · NÃO é arredondamento decimal §9 (exibição-apenas), é precisão total dupla · implementado no core (regra de ouro #1: custo é do domínio) |
| 2026-07-05 | totalProductionCost = unitCost × quantity (issue 007 — resolução da inconsistência §3.E vs §12) | §3.E linha 232 redação diz "CustoTotalProdução = CustoTotalReceita × Qtd" (quebraria golden); golden §12 é contrato permanente (8,86 não 17,72) · totalProductionCost deve ser custo unitário vezes unidades produzidas, coerente com §14.3 BakeEntry.totalCost · interpretação: §3.E confundiu CustoTotalProdução com CustoTotalReceita · golden fonte da verdade · flagged para revisor humano |
