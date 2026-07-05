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
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    // Ambiente default 'node' (lógica pura de src/core). jsdom entra apenas
    // quando houver teste de UI (architecture.md) — sem dependência extra agora.
    environment: 'node',
  },
});
