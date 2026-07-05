---
id: "027"
titulo: Fix — achados da revisão da issue 019 (export)
tipo: fix
deps: ["019"]
status: todo
---

## Contexto
Achados remanescentes das revisões da issue 019. O crítico (impressão em branco fora da calculadora) e os 3 altos (§8 impressão no histórico; .export-bar duplicada; barra não-sticky) foram corrigidos na própria iteração.

## O que fazer
1. **[médio, revisor-spec]** `src/export/print.ts` (~98): pesos do fermento usam `?? 0` — exibem "0 g" quando derivado é impossível; contrato null≠0 manda "—" (mesmo tratamento de money()/pct()). Corrigir + teste.
2. **[baixo]** `escapeHtml` exportado/testado mas nunca chamado em produção — remover ou empregar de fato.
3. **[baixo, follow-up de performance]** exceljs no bundle estático = 942 kB raw / 273 kB gzip carregado em index e historico — migrar para `import()` dinâmico no clique do botão (code-split); build warning >500kB some.
4. **[baixo]** 2 estilos inline novos em references/design-system.html (arquivo de documentação — convenção local; avaliar na 022).
   - **Aceito/sem ação (2026-07-05).** `design-system.html` é documentação (não produto/UI real): estilo inline ali é convenção local do próprio arquivo de doc, fora do escopo da regra "nenhum valor visual hardcoded" (que vale para `src/**`/telas reais). Nenhuma mudança de código nesta issue.

## Critérios de aceite
- [x] Derivado impossível exibe "—" na impressão.
- [x] escapeHtml resolvido (removido ou usado).
- [x] exceljs code-split (bundle inicial sem os 942 kB).
- [x] Suíte 100% verde.

## Referências
- spec §5.C, §8, §9 · reviews da issue 019 (2026-07-05 ~07:40)
