---
id: "015"
titulo: UI Calculadora — bloco do fermento (Partes) + painéis hidratação e farinha real
tipo: ui
deps: ["014"]
status: todo
---

## Contexto
Sub-receita do fermento em tabela vertical estilo planilha (spec §2.B.2, decisão 22) e painéis informativos (§2.C, §2.D). Mockup `mockups/calculadora.html`.

## O que fazer
- Bloco do fermento (§2.B):
  - Proporção % (incremento 1%, §2.B.1) — input editável.
  - Tabela vertical: linhas Isca/Farinha/Água/Total; colunas Componente · Proporção · Peso (g) · Preço Pago · Peso do Produto · Custo/g · Custo (custos sob o mesmo toggle da 014, §2.B.2).
  - Proporção (Partes) editável; Peso derivado texto plano; Isca custo "—", nunca editável (§2.B.2).
  - Múltiplas farinhas do fermento: sub-linhas da linha Farinha (§2.B.2/B.3), soma 100% com bloqueio no blur, mínimo 1; custo herdado da farinha principal quando não editado manualmente (§4).
  - Custo da água do fermento: padrão R$0,00/1L, configurável (§2.B.4).
  - Resumo (§2.B.5): peso total, Isca, Farinha, Água, hidratação derivada ("Hidratação resultante: X%" ou "—"), custo total, custo/kg.
- Painel hidratação (§2.C): "Nominal: X% · Real: Y%" lado a lado.
- Farinha Real Consumida (§2.D): somente-leitura, visível quando há fermento.
- Tudo via core (004/005/006/008); recálculo imediato; avisos/bloqueios via 010.
- Escape XSS em nomes de farinha do fermento (textContent).

## Critérios de aceite
- [ ] Layout tabela vertical fiel ao §2.B.2/mockup (ex 1:7:7 → 21/147/147 exibidos, total 15/310g).
- [ ] Alterar Parte redistribui pesos mantendo W_ferm; alterar Proporção% recalcula tudo (§4).
- [ ] Hidratação derivada exibe "—" com parte farinha 0 (§5.C).
- [ ] Isca sem campo de custo em nenhum estado.
- [ ] Editável com box, derivado texto plano (decisão 24).
- [ ] Golden §12 visível correto na tela (200g, 100/100, 100%, 1100g, 70%/72,73%).
- [ ] Strings pt-BR; zero lógica de negócio no DOM.

## Referências
- spec §2.B, §2.C, §2.D, §4, §5.C · mockups/calculadora.html · brandbook §4.1
