---
id: "008"
titulo: Função central de recálculo em lote + modos %→peso / peso→% + transição
tipo: core
deps: ["005", "006", "007"]
status: todo
---

## Contexto
Coração da arquitetura (spec §1.6): UMA função reconstrói todo o derivado a partir do estado puro, a cada alteração. Modos de cálculo §1.2–1.5.

## O que fazer
- `src/core/recalc.ts`:
  - `recalculate(recipe: Recipe): RecipeSummary + derivados` — orquestra bakers (003), sourdough (004), hydration (005), costs (006), pricing (007). Nunca lê valor derivado/arredondado como entrada (§1.6, §9). **Reusar** os módulos existentes — zero fórmula duplicada (regra de ouro 2).
  - Modo `percentage-to-weight` (§1.2): % é fonte de verdade; pesos derivados.
  - Modo `weight-to-percentage` (§1.3): pesos fonte de verdade (não-fermento); % exibida = peso / total geral da massa × 100; fermento SEMPRE por proporção+Partes nos dois modos.
  - Transição peso→% para %→peso (§1.5): F_total = Σ pesos farinhas principais; todas as % recalculadas dos pesos vigentes; nada descartado, sem confirmação.
  - Substituir placeholder do teste dourado (001) por teste real do §12 ponta a ponta via `recalculate`.

## Testes exigidos (TDD)
- Golden §12 integral por UMA chamada: F_total 1000, água 70%, sal 2%, fermento 20% 0:1:1 → W_ferm 200, FarinhaFerm/ÁguaFerm 100/100, H_ferm 100%, FarinhaReal 1100, nominal 70%, real ≈72.73%, custo 8.86, e com qtd 2 + margem 40%: unit 4.43, preço ≈7.3833, lucro ≈2.9533, receita ≈14.7666, lucro total ≈5.9066.
- Modo peso→%: pesos farinha 800+200, água 700, sal 20, fermento 20% → % sobre total geral da massa (incl. fermento no total).
- Transição §1.5: editar pesos em peso→% (farinha 1200), voltar → F_total=1200, % recalculadas, água mantém peso e ganha nova %.
- Determinismo: recalculate(recalculate(r).state) idêntico (idempotente sobre estado puro).
- Alteração de qualquer campo → resultado igual a recalcular do zero (sem cache intermediário).

## Critérios de aceite
- [ ] Função única; derivados nunca realimentam o cálculo (§1.6).
- [ ] Fermento por proporção nos dois modos (§1.3).
- [ ] Transição §1.5 sem perda de dados.
- [ ] Teste dourado §12 verde e permanente na suíte.

## Referências
- spec §1.2–1.6, §9, §12 · architecture.md convenções
