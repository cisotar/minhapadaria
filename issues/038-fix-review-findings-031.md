---
id: "038"
titulo: Fix — resíduo de doc da issue 031/030 (Água "1 L" → "1 kg" no guia vivo)
tipo: fix
deps: ["031"]
status: todo
---

## Contexto

Achados baixo das revisões `revisor-spec` e `guardiao-design` da issue 031.
Resíduo da issue 030 (eliminação de unidades de volume mL/L) não coberto pelo
escopo estrito da 031 (que só tratou a coluna "Unidade"/`.unit-toggle`).

## O que fazer

1. **baixo** — `references/design-system.html:269`: célula "Peso do produto" da
   linha Água na tabela de insumos `#tbl-insumos` ainda mostra `value="1 L"`
   (unidade de volume eliminada na 030). Trocar para `"1 kg"`.
2. **baixo** — `references/design-system.html:366`: mesma inconsistência na
   célula "Peso do produto" da linha Água na tabela de composição do fermento
   (`sub-fermento`) — ainda `"1 L"`. Trocar para `"1 kg"`.

## Testes exigidos (TDD)

Nenhum teste novo (mudança só em doc/guia vivo); rodar suíte + build ao final
para confirmar zero regressão.

## Critérios de aceite

- [ ] `design-system.html` não mostra mais `"1 L"` em nenhuma célula "Peso do
      produto" (nem tabela de insumos nem composição do fermento).
- [ ] Suíte + build seguem verdes.

## Referências

- issue 031/030 (base) · revisões `revisor-spec`/`guardiao-design` da 031 ·
  `references/design-system.html:269,366`
