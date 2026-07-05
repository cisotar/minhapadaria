---
id: "016"
titulo: UI Calculadora — painel escala/produção, precificação, escalonamento, banner peso→%
tipo: ui
deps: ["009", "015"]
status: todo
---

## Contexto
Painel de controle de escala e produção (spec §2.E), precificação sincronizada (§3.E, §4) e sinalização do modo alternativo (§1.3). Mockup `mockups/calculadora.html`.

## O que fazer
- Toggle global de modo de cálculo %→peso / peso→% (§1.3):
  - Ativo peso→%: **banner fixo no topo + destaque nos campos de %** (§1.3, obrigatório); pesos editáveis, % derivadas do total da massa.
  - Volta: transição §1.5 via core (008), sem prompt.
- Planejamento da fornada (§2.E.1): toggle Fornada inteira / Por unidade; per-unit: F_unit + N editáveis, F_total derivado somente-leitura; per-unit desabilitado no modo peso→%.
- Painel de precificação (§3.E, §4): Quantidade, e trio Preço/Margem%/Lucro sincronizado — editar um recalcula os outros (007); totais de produção (custo, receita, lucro).
- Indicadores (§4): margem colorida verde >30 / amarelo 15–30 / vermelho <15 ou negativa; destaque de prejuízo se custo > preço. Usar tokens de estado do design system existentes.
- Escalonamento por peso alvo (§3.D): campo alvo + botão explícito "Re-escalar" (ÚNICA ação com botão, §1.6); em per-unit ajusta F_unit mantendo N.
- Validações via 010 (margem ≤99,9, qtd ≥1 etc.).

## Critérios de aceite
- [ ] Banner + destaque visíveis SEMPRE que peso→% ativo; somem na volta (§1.3).
- [ ] Editar margem 40% com custo 8,86/2un → preço R$7,38 na tela (golden §12).
- [ ] Escalonar alvo 2000g → farinha exibida 1041,7g (§12).
- [ ] Per-unit: F_unit 250 × N 4 → F_total 1000 somente-leitura.
- [ ] Cores de margem pelos tokens (sem hex novo).
- [ ] Zero lógica de negócio no DOM; strings pt-BR.

## Referências
- spec §1.3, §1.5, §1.6, §2.E, §3.D, §3.E, §4 · mockups/calculadora.html · design-system.css tokens de estado
