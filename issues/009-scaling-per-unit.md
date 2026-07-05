---
id: "009"
titulo: Escalonamento por peso alvo + fornada por unidade
tipo: core
deps: ["008"]
status: todo
---

## Contexto
Escalonamento explícito (spec §3.D — única ação não-imediata, §1.6) e planejamento por unidade (§2.E.1, decisão 16).

## O que fazer
- `src/core/scaling.ts`:
  - `SomaReceita% = Σ %ingredientes + Proporção%fermento` (§3.D passo 1 — fermento ENTRA, decisão 3).
  - `F_nova = W_alvo / (SomaReceita%/100)` (passo 2); novos pesos = F_nova × %/100 (passo 3).
  - Só no modo `percentage-to-weight` (§3.D).
- Fornada por unidade (§2.E.1):
  - Modo `per-unit`: `F_total = F_unit × N` — derivado, somente-leitura; alterar F_unit ou N recasca tudo (mesma recalc §1.6).
  - Disponível só em %→peso; peso→% força `total`.
  - Escalonamento por alvo no modo per-unit: resultado ajusta `F_unit` mantendo `N`.

## Testes exigidos (TDD)
- §12: soma 100+70+2+20 = 192%; alvo 2000g → F_nova = 2000/1.92 ≈ 1041.6667 (toBeCloseTo), água nova = 729.1667, sal 20.83, fermento 208.33.
- Per-unit: F_unit 250, N 4 → F_total 1000, receita idêntica ao golden.
- Per-unit + escalonamento alvo 2000 → N mantém 4, F_unit = 1041.6667/4 ≈ 260.4167.
- SomaReceita% inclui fermento (192 no golden, não 172).
- W_alvo 0 ou soma 0 → inválido explícito.

## Critérios de aceite
- [ ] Fermento na soma (decisão 3); golden 192% → 1041,7g exibido.
- [ ] Per-unit deriva F_total, restrito a %→peso (§2.E.1).
- [ ] Escalonamento é função explícita, não reação de campo (§1.6).

## Referências
- spec §1.6, §2.E.1, §3.D, §12, decisões 3 e 16
