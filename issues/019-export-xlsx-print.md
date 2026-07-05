---
id: "019"
titulo: Exportação — XLSX com/sem custos + página de impressão (PDF)
tipo: export
deps: ["008", "013"]
status: todo
---

## Contexto
Relatórios (spec §8): XLSX estruturado (não CSV) e "PDF" = página HTML formatada para impressão. Vale para receita E histórico (§14.5).

## O que fazer
- Lib XLSX: decidir aqui entre `exceljs` e `xlsx`/SheetJS (candidatas em architecture.md). Critérios: geração 100% no navegador, zero rede em runtime, manutenção ativa, licença. Consultar doc oficial antes (regras de ouro 1/4); registrar escolha + link no plano.
- `src/export/xlsx.ts`:
  - Receita: abas/seções por categoria (ingredientes, fermento, hidratação, precificação §8); opção com/sem custos (omite colunas financeiras).
  - Histórico: fornadas + agregações do período filtrado; com/sem custos (§14.5).
  - Valores formatados pt-BR (002) OU numéricos com format de célula — decidir no plano.
- `src/export/print.ts` + view de impressão:
  - Botão fixo no topo "Imprimir / Salvar em PDF" (§8); abre página/print stylesheet formatada; `window.print()` SÓ ao clicar — nunca automático (§8).
  - CSS de impressão com tokens do design system (media print).
- Download via Blob (mesmo padrão da 012 — reusar helper, regra de ouro 2).

## Testes exigidos (TDD)
- XLSX receita golden §12: gerar workbook e reler (API da própria lib) → células de F_total 1000, custo total 8,86, preço 7,38 presentes.
- Com/sem custos: versão sem custos não contém colunas financeiras nem R$.
- XLSX histórico: 2 fornadas + summary com totais corretos.
- print: markup gerado contém dados da receita e nenhum script inline; ação só por clique (teste de unidade no gerador de markup, escape verificado).
- Nome de ingrediente com `<b>x</b>` → escapado no HTML de impressão.

## Critérios de aceite
- [ ] XLSX abre no LibreOffice/Excel com seções por categoria (§8).
- [ ] Opção com/sem custos nos dois relatórios.
- [ ] Impressão só por botão; sem diálogo automático (§8).
- [ ] Lib escolhida justificada com link da doc oficial.
- [ ] Zero rede em runtime; escape de dados do usuário no HTML.

## Referências
- spec §8, §12, §14.5 · architecture.md (candidatas) · docs oficiais exceljs / SheetJS
