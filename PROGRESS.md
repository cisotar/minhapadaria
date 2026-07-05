# PROGRESS — Calculadora de Pão com Fermento Natural (v5)

> Log de iterações concluídas. Mantido pelo agente `escriba`. Topo da página: seção "Decisões da noite" acumulando toda interpretação de spec tomada de forma autônoma — é o que o humano revisa de manhã.

## Decisões da noite

**2026-07-05 (issue 004 — fermento por Partes)**

1. **computeSourdoughWeights retorna null (não throw) em partes inválidas**: guarda defensiva (§5.C). Semelhante a percentageFromWeight (issue 003, F_total ≤ 0 → 0), mantém contrato limpo para recalc em lote issue 008. UI bloqueia via isValidSourdoughParts; backend nunca toca em partes inválidas.

2. **Parte farinha=0 retorna com hydration null (não erro)**: interpretação literal de §5.C (estado inválido ≠ inviável). Se usuario entrar fermento com zero farinha (ex.: 1:0:1 Isca:Farinha:Água), resultado tem flourWeight=0, waterWeight>0, hydration=null. Não bloqueio; UI e issue 010 (validações) decidem se avisar ou rejeitar. Motivo: bloqueia derivação de 0 pelas farinhas (§3.B), preserva pureza.

3. **SUM_EPSILON vive em bakers.percentagesSumTo100, dono único**: issue 003 introduziu percentagesSumTo100 com epsilon 1e-9. Issue 004 importa dela (não reduplica). flourPercentagesSumTo100 delega a percentagesSumTo100 (refactor bakers.ts/bakers.test.ts: +2 novos testes 21–22). Mesma tolerância vale para sourdoughFlourPercentagesSumTo100 (§2.B.3).

---

**2026-07-05 (issue 003 — baker's percentage)**

1. **percentageFromWeight retorna 0 quando F_total ≤ 0, não null**: guarda de divisão por zero (§5.C) mantém assinatura `number` limpa. UI futura (issue 008) pode distinguir "indefinido" (F_total=0) de "valor calculado" na exibição, sem mudar tipo. Afeta issue 008 (recalc em lote): percentageFromWeight permanece `number → number`, contrato preservado.

2. **flourPercentagesSumTo100 usa epsilon 1e-9 (SUM_EPSILON), não arredondamento**: tolerância anti-drift IEEE-754 (ex.: 33,33+33,33+33,34 pode não somar exato 100 em binário). Epsilon NÃO é caixa de arredondamento §9. Issues 010 (bloqueio de UI) e 014 (validação) devem alinhar critério de comparação: usar same epsilon ou definir novo? Registrado para revisão.

3. **Farinhas do fermento (§2.B) nunca entram na lista principal com category 'flour'**: premissa estrutural respeitada em bakers.ts (flourTotal só soma category='flour'). Issues 004 (gerenciar fermento) e 008 (recalc engine) devem preservar: fermento é sub-receita com own Ingredient[], não linha com category='flour'. Trata a linha do fermento como genérica (§2.A.2), sem caso especial.

---

**2026-07-05 (issue 002 — types + formatação)**

1. **roundingMode via tipo local NumberFormatOptionsWithRounding**: ES2022 do TS não declara `roundingMode` em `Intl.NumberFormatOptions`, apesar do runtime Node 24 suportá-la. Decisão: estender o tipo localmente em format.ts sem alterar tsconfig (fora de escopo). Valor 'halfExpand' (default do Intl, half-up em todo domínio do app) documentado explicitamente para blindar §9 contra mudanças futuras de default. Motivo: auto-documentação + clarity sem deps extras.

2. **parseDecimal rejeita entrada com múltiplos separadores decimais**: "1.234,5" (dígito + ponto + vírgula) retorna null. Leitura literal de §7.1 ("vírgula OU ponto"). Caso de uso: UI pode validar em tempo real e prevenir user error. Achado diferido para revisor-spec avaliar se milhar digitado (ex.: "1.234") precisa de suporte — por enquanto, rejeita.

3. **formatCurrency com useGrouping true, demais sem**: convenção pt-BR para moeda é separador de milhar ("R$ 1.234,56"). Decisão: apenas formatCurrency usa `useGrouping: true`; formatPercent, formatWeight, formatCostPerGram usam `false` para não quebrar §12 (gabarito "1041,7", não "1.041,7"). Motivo: preservar fidelidade gabarito + convenção moeda.

---

**2026-07-05 (issue 001 — scaffold)**

1. **Caminhos relativos no vite.config.ts**: plano original sugeria `import.meta.dirname + node:path` para resolver entradas MPA, mas isso exigiria dependência `@types/node`. Opção tomada: caminhos relativos à raiz do projeto, resolvidos nativamente pelo Vite — zero deps extra, sem `@types/node`. Documentado em vite.config.ts (linhas 12–15).

2. **Google Fonts CDN vs auto-hospedagem**: mockups usam `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` no design-system.css. **Decisão**: app (index.html, receitas.html, historico.html) carrega apenas `design-system.css` via Vite, com fonte fallback `system-ui` até issue de UI decidir auto-hospedagem. Alinhado com spec §10 (app 100% client-side) e §11.1 (zero secrets em front-end). Ação diferida para issue 014+.

3. **Polyfill modulepreload em dist/**: achado do revisor-design (baixa prioridade): Vite injeta `<link rel="modulepreload" as="script" ...>` em dist/index.html que contém `fetch()` same-origin para chunks. Artefato de build sem risco (fetch é same-origin, sem headers de autorização, offline ok). Sem ação necessária.

---

## Iteração 004 — 2026-07-05 ~01:55–~02:25 (fermento por Partes)

| Campo | Valor |
|-------|-------|
| **Issue** | 004-sourdough-parts |
| **Timestamp** | 2026-07-05 01:55 |
| **O que foi feito** | src/core/sourdough.ts: 6 funções puras (sourdoughTotalWeight — W_ferm = F_total × %/100, reuso de bakers.weightFromPercentage; partsSum — Σ Isca+Farinha+Água; isValidSourdoughParts — guarda SomaPartes>0 e partes≥0; computeSourdoughWeights — rateio interno e hidratação DERIVADA; distributeSourdoughFlourWeights — Farinha_i = FarinhaFerm × P_i/100; sourdoughFlourPercentagesSumTo100 — predicado delega a percentagesSumTo100). Sem DOM, sem localStorage, precisão total (§1.6/§2.B/§3.B/§5.C). src/core/sourdough.test.ts: 12 testes TDD (sourdoughTotalWeight 1, partsSum 1, computeSourdoughWeights 5 casos limites, isValidSourdoughParts 1, distributeSourdoughFlourWeights 2, sourdoughFlourPercentagesSumTo100+pureza 2). Refactor bakers.ts: percentagesSumTo100 extraído e exportado como dono único de SUM_EPSILON; flourPercentagesSumTo100 delega (comportamento idêntico, +2 testes em bakers.test.ts → 22 total). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: sourdough.test.ts (12) + bakers.test.ts (22, +2 de percentagesSumTo100) + format.test.ts (23) + golden-example.test.ts (1 falha intencional) = 58 total. Pass: 57. Fail: 1 intencional. Build Vite: verde. Gates: testes 57 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§2.B/§2.B.2/§2.B.3/§3.B/§5.C implementado; hidratação derivada correta; null em farinha=0 literal; SUM_EPSILON centralizado; prefixo spec em cabeçalhos). Sem achados. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 2 arquivos novos (sourdough.ts, sourdough.test.ts). Reuso total: sourdoughTotalWeight reusa weightFromPercentage; sourdoughFlourPercentagesSumTo100 reusa percentagesSumTo100; %SUM_EPSILON centralizado em bakers.ts, importado por sourdough.test.ts. Premissa de issue 003 preservada: fermento é sub-receita com own Ingredient[], farinhas do fermento não entram em flourTotal (bakers.ts). |

---

## Iteração 003 — 2026-07-05 ~01:45–~02:30 (baker's percentage)

| Campo | Valor |
|-------|-------|
| **Issue** | 003-bakers-percentage |
| **Timestamp** | 2026-07-05 01:45 |
| **O que foi feito** | src/core/bakers.ts: 4 funções puras (flourTotal — Σ pesos farinhas category='flour'; weightFromPercentage — Peso = F_total × %/100; percentageFromWeight — % = Peso/F_total × 100, guarda F_total ≤ 0; flourPercentagesSumTo100 — predicado puro com epsilon 1e-9 anti-drift IEEE-754). Sem DOM, sem localStorage, precisão total (§1.6/§3.A/§5.C). src/core/bakers.test.ts: 20 testes TDD red→green (flourTotal 4 casos, weightFromPercentage 6, percentageFromWeight 4, flourPercentagesSumTo100 4, pureza 2). Golden §12 validado: 1000g farinha, 700g água (70%), 20g sal (2%), 200g fermento (20%). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 20 suites (bakers.test.ts) + 23 (format.test.ts) + 1 golden (golden-example.test.ts) = 44 testes total. Pass: 43. Fail: 1 intencional (golden placeholder, aguarda issue 008). Build Vite: verde. Gates: testes 43 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§1.1/§1.2/§2.A.2/§3.A/§5.C implementado; farinhas do fermento correto não contam em flourTotal; epsilon justificado §9). Sem achados. |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 2 arquivos novos (bakers.ts, bakers.test.ts). Premissa registrada: fermento é sub-receita (§2.B), não linha com category='flour' — issues 004/008 preservam. |

---

## Iteração 002 — 2026-07-05 01:35–~02:00 (types + formatação pt-BR)

| Campo | Valor |
|-------|-------|
| **Issue** | 002-types-formatting |
| **Timestamp** | 2026-07-05 01:35 |
| **O que foi feito** | src/core/types.ts: 13 interfaces fiéis à spec §6 (Recipe, Ingredient, Sourdough, BakeEntry, etc.), valor canônico em gramas, campos derivados marcados readonly; src/core/format.ts: parseDecimal (aceita vírgula OU ponto, rejeita múltiplos separadores), formatPercent/Weight/Currency/CostPerGram (via Intl.NumberFormat pt-BR, roundingMode 'halfExpand'), formatDate (aaaa-mm-dd, getters locais não UTC); NBSP normalizado para espaço ASCII; useGrouping off exceto currency; src/core/format.test.ts: 23 testes TDD (parseDecimal 9, formatCurrency 4, formatCostPerGram 1, formatWeight 2, formatPercent 4, formatDate 2); golden §12 validado (1041,7 g, R$ 8,86). |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 23 suites (format.test.ts) + 1 golden example suite (golden-example.test.ts) = 24 testes total. Pass: 23. Fail: 1 intencional (golden, aguarda issue 008). Build Vite: verde. Gates: testes 23 pass ✓, 1 fail esperada ✓, build ✓. |
| **Reviews** | revisor-spec: aprovado (§6 implementado fielmente, §7.1 parseDecimal correto, §9 precisão exibição OK, §12 golden validado). Achado baixa prioridade: working tree tem modificações pré-existentes em spec/ e mockups/ (não staged, alheias à issue). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Cabeçalhos de spec adicionados aos 3 arquivos novos. |

---

## Iteração 001 — 2026-07-05 00:00–01:20 (scaffold)

| Campo | Valor |
|-------|-------|
| **Issue** | 001-scaffold |
| **Timestamp** | 2026-07-05 01:20 |
| **O que foi feito** | Scaffold Vite 7 + TypeScript 5 strict + Vitest 3; MPA com 3 páginas (index/receitas/historico) importando design-system.css via entry points src/ui/pages/*.ts; estrutura de pastas src/core\|storage\|export\|ui criada; teste dourado §12 implementado como placeholder que falha de propósito (única falha da suíte); zero dependências de runtime além de Vite; package-lock.json commitado. |
| **Hash do commit** | _(pendente de commit)_ |
| **Testes** | Vitest: 1 suite, 1 test, 1 falha intencional (golden example placeholder). Build Vite: verde. Gates: build ✓, test 1 falha esperada ✓. |
| **Reviews** | revisor-spec: aprovado (spec §10, §12, architecture.md alinhados). guardiao-design: aprovado (design-system.css carregado, nenhum estilo hardcoded, mockups refletidos em HTML). |
| **Observações** | Decisões de spec registradas na seção "Decisões da noite" acima. Backlog de 20 issues gerado e commitado no commit anterior (122da55). |

