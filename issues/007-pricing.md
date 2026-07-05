---
id: "007"
titulo: Precificação — 3 modos sincronizados, margem ≤99,9%, totais, faixas 30/15
tipo: core
deps: ["006"]
status: todo
---

## Contexto
Painel de precificação (spec §3.E, §4): três formas de entrada que convergem para o mesmo estado (Preço, Margem%, Lucro unitário).

## O que fazer
- `src/core/pricing.ts`:
  - `CustoUnitário = CustoTotalReceita / Quantidade` (§3.E). Quantidade ≥ 1 (§5.C).
  - Modo Preço Fixo: `Lucro = Preço − CustoUnit`; `Margem% = Lucro/Preço × 100`.
  - Modo Margem%: `Preço = CustoUnit / (1 − Margem/100)` — clamp margem a [0, 99.9] (§5.C, decisão 4).
  - Modo Lucro Fixo: `Preço = CustoUnit + Lucro`.
  - Cada modo recalcula os outros dois campos — estado final sempre consistente.
  - Totais: `CustoTotalProdução = CustoTotalReceita × Qtd` · `ReceitaTotal = Preço × Qtd` · `LucroTotal = ReceitaTotal − CustoTotalProdução` (§3.E).
  - Faixa de status da margem (§4): `'green'` >30 · `'yellow'` 15–30 · `'red'` <15 ou negativa; flag prejuízo se custo > preço.

## Testes exigidos (TDD)
- §12: CustoTotal 8.86, 2 unidades, margem 40% → CustoUnit 4.43, Preço 7.383…→R$7,38 exib., Lucro unit 2.95…, ReceitaTotal 14.766…→14,76*, LucroTotal 5.90…. Testar valores puros com toBeCloseTo (7.3833, 2.9533, 14.7666, 5.9066) — exibição arredonda depois (§9).
- Margem 100 → clamp 99.9, sem Infinity.
- Preço 10, custo unit 4 → margem 60%, lucro 6.
- Lucro fixo 3, custo 4.43 → preço 7.43.
- Margens 31/20/10/−5 → green/yellow/yellow/red (30 e 15 exatos: 30→yellow, 15→yellow — faixa §4: verde >30, amarelo 15–30, vermelho <15).
- Preço ≤ custo → flag prejuízo true (aviso, não bloqueio §5.C).

## Critérios de aceite
- [ ] 3 modos produzem estado sincronizado idêntico dado mesmo trio custo/entrada.
- [ ] Margem clamp 0–99,9 (§5.C).
- [ ] Golden §12 completo passa.
- [ ] Faixas 30/15 e flag prejuízo (§4).

## Referências
- spec §3.E, §4, §5.C, §12, decisão 4
