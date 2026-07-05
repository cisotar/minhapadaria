# PROGRESS — Calculadora de Pão com Fermento Natural (v5)

> Log de iterações concluídas. Mantido pelo agente `escriba`. Topo da página: seção "Decisões da noite" acumulando toda interpretação de spec tomada de forma autônoma — é o que o humano revisa de manhã.

## Decisões da noite

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

