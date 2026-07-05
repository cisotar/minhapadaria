---
id: "003"
titulo: Baker's percentage — F_total âncora e pesos derivados
tipo: core
deps: ["002"]
status: todo
---

## Contexto
Núcleo da convenção de padeiro (spec §1.1–1.2, §3.A): farinha total é a âncora 100%; tudo deriva dela.

## O que fazer
- `src/core/bakers.ts` (nome livre, reusar módulo se fizer sentido):
  - Peso de cada farinha: `Peso_i = F_total × %_i / 100` (§1.1).
  - Peso de ingrediente não-farinha: `Peso_X = F_total × %_X / 100` (§1.2, §3.A) — inclusive a linha do fermento (§2.A.2).
  - Inverso: `%_X = (Peso_X / F_total) × 100` (§3.A).
  - `F_total = Σ pesos das farinhas principais` (§3.A) — usado na transição de modo (§1.5).
  - Múltiplas farinhas: soma de % deve ser exatamente 100 (validação exposta como predicado puro; bloqueio de UI vem na issue 010/014).
- Funções puras sobre `Ingredient[]`; sem arredondamento interno.

## Testes exigidos (TDD)
- §12: `F_total=1000`, água 70% → 700g; sal 2% → 20g; fermento 20% → 200g.
- Farinha única → 100% travado: peso = F_total.
- Duas farinhas 80/20 de 1000g → 800g/200g; soma % = 100 ok; 80/30 → predicado de soma acusa ≠100.
- Inverso: peso 700 sobre F_total 1000 → 70%.
- F_total = 0 → pesos 0, sem divisão por zero no inverso (retorno 0 ou null documentado).

## Critérios de aceite
- [ ] Fórmulas §3.A exatas, sem arredondamento interno.
- [ ] Fermento tratado como linha genérica (peso = F_total × %/100) — sem caso especial.
- [ ] Divisão por zero tratada (§5.C).

## Referências
- spec §1.1, §1.2, §2.A.2, §3.A, §12
