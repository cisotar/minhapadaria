/**
 * vite.config.ts — Configuração de build/dev/test da Calculadora de Pão.
 *
 * O que faz: define o app como MPA (3 páginas) e integra o Vitest.
 * Spec: §10 (app 100% client-side); architecture.md (Vite + TS strict + Vitest,
 * estrutura src/core|storage|export|ui, 3 páginas MPA).
 *
 * Docs oficiais consultadas (regra de ouro 4):
 * - Vite MPA (build.rollupOptions.input): https://vite.dev/guide/build.html#multi-page-app
 * - Vitest config via vitest/config: https://vitest.dev/guide/
 *
 * Nota (desvio consciente do plano): o plano sugeria import.meta.dirname + node:path
 * para resolver os caminhos das entradas, mas isso exigiria @types/node — dependência
 * fora do plano. Caminhos relativos são resolvidos por Vite a partir da raiz do
 * projeto (project root), então dispensam node:path e mantêm zero dependência extra.
 *
 * `base` (deploy 2026-07-06): o site é publicado em GitHub Pages como project site
 * (https://cisotar.github.io/minhapadaria/, subpasta — não domain root), então os
 * assets/scripts com caminho absoluto precisam do prefixo `/minhapadaria/` para não
 * resolverem para a raiz errada do domínio (404). Docs: https://vite.dev/config/shared-options.html#base
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/minhapadaria/',
  build: {
    rollupOptions: {
      // MPA: cada entrada vira uma página emitida em dist/ (Vite MPA docs).
      // Caminhos relativos à raiz do projeto (root = cwd do Vite).
      input: {
        main: 'index.html',
        receitas: 'receitas.html',
        historico: 'historico.html',
      },
    },
  },
  test: {
    globals: true,
    // Ambiente default 'node' (lógica pura de src/core e maioria de src/storage).
    // jsdom (devDependency, issue 014) é ligado só por arquivo, via comentário
    // `// @vitest-environment jsdom` no topo do próprio teste de UI
    // (src/ui/ingredientsTable.test.ts) — docs: https://vitest.dev/guide/environment.
    environment: 'node',
  },
});
