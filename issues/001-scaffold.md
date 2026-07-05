---
id: "001"
titulo: Scaffold Vite + TypeScript strict + Vitest (MPA 3 páginas)
tipo: infra
deps: []
status: todo
---

## Contexto
Base técnica do app 100% client-side (spec §10). Stack decidida em `references/architecture.md`: Vite + TS strict + Vitest, vanilla DOM, MPA com 3 páginas espelhando `mockups/`.

## O que fazer
- Iniciar projeto Vite (template vanilla-ts) na raiz do repo, sem apagar nada existente.
- `tsconfig.json` com `strict: true`.
- Vitest configurado (`npm test` roda `vitest`; gates usam `npm test -- --run`).
- MPA: `index.html` (calculadora), `receitas.html`, `historico.html` — entradas no `vite.config.ts` (`build.rollupOptions.input`). Cada página importa `references/design-system.css`.
- Estrutura de pastas alvo: `src/core/`, `src/storage/`, `src/export/`, `src/ui/` (vazias com `.gitkeep` ou módulo placeholder).
- Scripts npm: `dev`, `build`, `preview`, `test`.
- Teste dourado da Seção 12 como placeholder **falhando** (`test.todo` NÃO serve — deve falhar de verdade, ex: `expect(goldenExample).toBeDefined()` contra módulo inexistente → usar `it.fails` invertido ou teste com `expect(false).toBe(true)` e comentário apontando §12). Marcar com `// TODO issue 008/020`.
- `package-lock.json` commitado (regra de ouro 3).
- `.gitignore`: `node_modules/`, `dist/`, `.env*` (spec §11.1).

## Critérios de aceite
- [ ] `npm run build` gera as 3 páginas.
- [ ] `npm test -- --run` roda e falha SOMENTE no teste dourado placeholder.
- [ ] TS strict ativo; zero dependência de runtime além do Vite toolchain.
- [ ] design-system.css importado, tokens intactos (nunca editar `references/design-system.css` tokens).

## Referências
- spec §10, §12 · references/architecture.md (stack, estrutura) · docs oficiais: vitejs.dev/guide (MPA), vitest.dev
