---
id: "014"
titulo: UI Calculadora — tabela de insumos, edição inline, toggle custos, g/mL, linha do fermento
tipo: ui
deps: ["008", "010", "011"]
status: todo
---

## Contexto
Tela principal (spec §2.A, §4; mockup `mockups/calculadora.html`). UI consome o core testado — zero fórmula na camada DOM.

## O que fazer
- `src/ui/` + `index.html`: reproduzir a tabela de insumos do mockup 1:1 com o design system (classes existentes primeiro — regra de ouro 2; novas classes só com tokens, documentadas em `references/design-system.html`).
- Colunas ordem fixa (§2.A.2): Ingrediente · Unidade · % · Peso · Preço Pago · Peso do Produto · Custo/g · Custo na Receita.
- Unidade: sólidos "g" explícito; `liquid`/`fat` com alternador compacto g/mL (conversão densidade 1:1, valor canônico g §2.A).
- Toggle "Exibir custos" no topo: oculta/mostra as 4 colunas financeiras; default oculto; persistência via prefs (011).
- Edição inline linha a linha (§4): nome, %, peso (conforme modo), preço pago, peso do produto; derivados texto plano SEM box; editáveis COM box (decisão 24, brandbook §4.1).
- Adicionar/remover ingrediente na própria tabela ("+ ingrediente", ícone remover por linha §4); mínimo 1 farinha (010).
- Linha Fermento: genérica na tabela, peso/% consumidos do core; sem edição de peso; custos exibem C_fermento derivado (§2.A.2).
- Recálculo imediato em cada alteração (sem submit §1.6), via `recalculate` (008); validações no blur via 010 (reverte + erro).
- Entrada numérica: vírgula/ponto (002); exibição vírgula, arredondamento só exibição (§9).
- **Escape XSS**: nome de ingrediente renderizado via `textContent`/DOM API — nunca `innerHTML` com string do usuário (regra de ouro 3).
- Ferramenta opcional: /design ou DesignSync se disponível; senão mockup + design system bastam.

## Critérios de aceite
- [ ] Colunas, ordem e toggle idênticos a §2.A.2/mockup; nada oculto no desktop (§10).
- [ ] Editar % de água atualiza peso instantaneamente (e vice-versa no modo peso→%).
- [ ] g/mL alterna exibição, canônico em g.
- [ ] Blur com farinhas ≠100% reverte campo com erro (§5.A).
- [ ] Nome `<script>` renderiza inerte (escape).
- [ ] Zero lógica de negócio no DOM — só chamadas ao core.
- [ ] Strings UI pt-BR.

## Referências
- spec §1.6, §2.A, §4, §5, §9, §10 · mockups/calculadora.html · brandbook §4.1 · references/design-system.css
