---
id: "004"
titulo: Fermento por Partes — W_ferm, rateio Isca/Farinha/Água, hidratação derivada
tipo: core
deps: ["003"]
status: todo
---

## Contexto
Sub-receita do fermento (spec §2.B, §3.B): peso total vem da proporção sobre F_total; repartição interna por Partes (Isca:Farinha:Água); hidratação é derivada, nunca entrada.

## O que fazer
- `src/core/sourdough.ts`:
  - `W_ferm = F_total × (proporção% / 100)` (§3.B).
  - `SomaPartes = parte_isca + parte_farinha + parte_água` (§2.B.2).
  - `Isca = W_ferm × parte_isca/SomaPartes` · `FarinhaFerm = W_ferm × parte_farinha/SomaPartes` · `ÁguaFerm = W_ferm × parte_água/SomaPartes` (§3.B).
  - `H_ferm% = ÁguaFerm / FarinhaFerm × 100` — derivada; se `parte_farinha = 0` → indefinida (null; UI exibe "—", §5.C).
  - Farinhas do fermento: `FarinhaFerm_i = FarinhaFerm × P_i/100`, com `Σ P_i = 100` (§3.B, §2.B.3); predicado de soma 100.
  - Guard: `SomaPartes > 0` obrigatório (§5.C — divisão por zero); partes ≥ 0.

## Testes exigidos (TDD)
- §12: F_total=1000, fermento 20%, partes 0:1:1 → W_ferm=200, Isca=0, FarinhaFerm=100, ÁguaFerm=100, H_ferm=100%.
- §2.B.2 exemplo 1:7:7 com W_ferm=310 (fermento ~31% de 1000) → Isca≈20.67, Farinha≈144.67, Água≈144.67 (valores exatos sem arredondar; mockup mostra 21/147/147 arredondado — testar valor puro), H_ferm=100%.
- parte_farinha=0 → H_ferm null.
- SomaPartes=0 → erro/estado inválido explícito, sem NaN.
- 2 farinhas do fermento 50/50 sobre FarinhaFerm=100 → 50g cada.

## Critérios de aceite
- [ ] Fórmulas §3.B exatas; W_ferm = Isca + FarinhaFerm + ÁguaFerm (aditivo).
- [ ] Hidratação somente derivada; null quando indefinida.
- [ ] SomaPartes=0 bloqueado; partes negativas rejeitadas (§5.C).

## Referências
- spec §2.B, §3.B, §5.C, §12
