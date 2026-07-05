---
id: "006"
titulo: Custos — custo/g derivado, custo na receita, custo do fermento (isca zero)
tipo: core
deps: ["002", "004"]
status: todo
---

## Contexto
Entrada única de custo: Preço Pago + Peso do Produto (spec §2.A.1); tudo mais derivado. Isca custo SEMPRE zero (§2.B.2, §3.B).

## O que fazer
- `src/core/costs.ts`:
  - Normalizar `PackageCost` para gramas: `kg → ×1000`, `L → ×1000`, `mL → ×1` (densidade 1:1, §2.A).
  - `custoPorGrama = pricePaid / packageSizeGramas` (§2.A.1). Guard: packageSize > 0 (§5.C, bloqueio).
  - `custoNaReceita = peso_usado × custoPorGrama` (§2.A.1).
  - Fermento (§3.E): `Custo_farinha_i = FarinhaFerm_i × C_farinha_i`; `Custo_águaFerm = ÁguaFerm × C_água`; `Custo_fermento = Σ farinhas + água` — **Isca nunca soma**; `C_fermento (R$/g) = Custo_fermento / W_ferm` (guard W_ferm=0).
  - `CustoTotalReceita = Σ Custo_X (ingredientes) + Custo_fermento` (§3.E). Linha do fermento na tabela usa C_fermento, não custo próprio digitado.

## Testes exigidos (TDD)
- §2.A.1 exemplo: azeite R$80 / 1250g → 0.0640 R$/g; 40g usados → R$2,56.
- §12: farinha R$8,00/kg → 0.008 R$/g; FarinhaFerm 100g → R$0,80; água R$0/L → 0; Custo_fermento=R$0,80; CustoTotalReceita = 1000×0.008 + 20×0.003 + 700×0 + 0.80 = **R$8,86**.
- Isca com peso > 0 (partes 1:7:7) → custo fermento ignora isca.
- packageSize=0 → inválido explícito, sem Infinity.
- kg/L/mL normalizados: R$8 por 1kg ≡ R$8 por 1000g.

## Critérios de aceite
- [ ] Custo/g e custo na receita sempre derivados, nunca entrada direta (decisão 18/23).
- [ ] Isca fora de todo cálculo de custo.
- [ ] Golden §12: custo total R$8,86 exato (antes de arredondar: 8.86).
- [ ] Divisões por zero tratadas.

## Referências
- spec §2.A.1, §2.B.2, §3.E, §5.C, §12
