# PROGRESS — Calculadora de Pão com Fermento Natural (v5)

> Log de iterações concluídas. Mantido pelo agente `escriba`. Topo da página: seção "Decisões da noite" acumulando toda interpretação de spec tomada de forma autônoma — é o que o humano revisa de manhã.

## Decisões da noite

**2026-07-05 (issue 001 — scaffold)**

1. **Caminhos relativos no vite.config.ts**: plano original sugeria `import.meta.dirname + node:path` para resolver entradas MPA, mas isso exigiria dependência `@types/node`. Opção tomada: caminhos relativos à raiz do projeto, resolvidos nativamente pelo Vite — zero deps extra, sem `@types/node`. Documentado em vite.config.ts (linhas 12–15).

2. **Google Fonts CDN vs auto-hospedagem**: mockups usam `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` no design-system.css. **Decisão**: app (index.html, receitas.html, historico.html) carrega apenas `design-system.css` via Vite, com fonte fallback `system-ui` até issue de UI decidir auto-hospedagem. Alinhado com spec §10 (app 100% client-side) e §11.1 (zero secrets em front-end). Ação diferida para issue 014+.

3. **Polyfill modulepreload em dist/**: achado do revisor-design (baixa prioridade): Vite injeta `<link rel="modulepreload" as="script" ...>` em dist/index.html que contém `fetch()` same-origin para chunks. Artefato de build sem risco (fetch é same-origin, sem headers de autorização, offline ok). Sem ação necessária.

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

