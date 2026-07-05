---
id: "005"
titulo: Hidratação nominal/real (fat fora) + Farinha Real Consumida
tipo: core
deps: ["003", "004"]
status: todo
---

## Contexto
Painéis informativos do padeiro (spec §2.C, §2.D). Gordura (`fat`) NÃO hidrata (§2.C, decisão 15).

## O que fazer
- `src/core/hydration.ts`:
  - `HidrataçãoNominal = Σ LíquidosDeclarados / F_total × 100` — somente `category === 'liquid'` (§2.C).
  - `HidrataçãoReal = (Σ LíquidosDeclarados + ÁguaFerm) / (F_total + FarinhaFerm) × 100` (§2.C).
  - `FarinhaRealConsumida = F_total + FarinhaFerm` (§2.D).
  - Divisão por zero: F_total=0 e sem fermento → nominal/real null.

## Testes exigidos (TDD)
- §12: água 700g, F_total 1000, ÁguaFerm 100, FarinhaFerm 100 → Nominal=70%, Real=800/1100≈72.7272…% (comparar sem arredondar, `toBeCloseTo(72.7272, 3)`), FarinhaReal=1100g.
- Receita com água 700 (`liquid`) + azeite 40 (`fat`) → nominal usa só 700 (fat fora).
- Leite+cerveja+água todos `liquid` → somam.
- Sem fermento (W_ferm=0) → Real = Nominal.
- F_total=0 → null, sem NaN.

## Critérios de aceite
- [ ] `fat` excluído das duas hidratações; entra em peso/custo normalmente (§2.A).
- [ ] Farinha Real Consumida = F_total + Farinha do Fermento (§2.D).
- [ ] Zero NaN em bordas.

## Referências
- spec §2.A, §2.C, §2.D, §12, decisão 15
