---
id: "046"
titulo: Card Balanço — pills de visualização (Completa / Unidades / Fornadas) com totais sempre visíveis
tipo: ui
deps: ["045"]
status: todo
---

## Contexto
Cliente pediu (2026-07-06) um seletor de **visualização** para a tabela do card
BALANÇO (issue 045, `specs/aba-balanco.md`). Três pills alternam **quais colunas**
a tabela mostra, sem tocar dados, filtros, ordenação ou o rodapé de totais:

- **Completa** — todas as 10 colunas (comportamento atual).
- **Unidades** — dados por-unidade + contagens.
- **Fornadas** — agregados da fornada.

Decisões travadas com o cliente (2026-07-06):
- **Totais (`tfoot`) sempre visíveis** nas três visualizações; escondem/mostram as
  mesmas colunas que o corpo.
- **Status (markup F/C%)** aparece nas **três** visualizações.
- **Produção** e **Vendas** (contagens de unidades) aparecem em **Unidades e
  Fornadas** (e Completa).
- **Data** e **Receita** = identidade da linha → sempre presentes.
- Só-leitura preservado (P2 da 045); corpo/filtro/ordem/planejadas intactos.

## Mapa de colunas (confirmado com o cliente)

| Coluna            | Completa | Unidades | Fornadas | Classe          |
|-------------------|:--------:|:--------:|:--------:|-----------------|
| Data              |    ✓     |    ✓     |    ✓     | *(sempre)*      |
| Receita           |    ✓     |    ✓     |    ✓     | *(sempre)*      |
| Produção          |    ✓     |    ✓     |    ✓     | *(sempre)*      |
| Custo unitário    |    ✓     |    ✓     |    —     | `.col-unit`     |
| Custo (C)         |    ✓     |    —     |    ✓     | `.col-bake`     |
| Vendas            |    ✓     |    ✓     |    ✓     | *(sempre)*      |
| Preço unitário    |    ✓     |    ✓     |    —     | `.col-unit`     |
| Faturamento (F)   |    ✓     |    —     |    ✓     | `.col-bake`     |
| Saldo             |    ✓     |    —     |    ✓     | `.col-bake`     |
| Status            |    ✓     |    ✓     |    ✓     | *(sempre)*      |

- **Unidades** = 7 col: Data · Receita · Produção · Custo unitário · Vendas · Preço unitário · Status
- **Fornadas** = 8 col: Data · Receita · Produção · Custo (C) · Vendas · Faturamento (F) · Saldo · Status
- **Completa** = 10 col.

Só 2 classes novas de coluna: `.col-unit` (Custo unitário, Preço unitário) e
`.col-bake` (Custo C, Faturamento F, Saldo). Colunas sempre-visíveis não recebem
classe.

## Precedentes de design system (já existem — reusar, zero token novo)

1. **Componente pill = `.period-toggle`** (`references/design-system.css:432`):
   segmented control `inline-flex` + borda + botões + `.active` (fundo `--primary`,
   texto `--creme`). Mesmo já usado no filtro Período (`historyView.ts:231`), com o
   padrão `.active`-swap em `setGranularity` (`historyView.ts:280`). Reusar essa
   classe (ou classe irmã `.view-toggle` herdando as mesmas regras, se `designer-ux`
   preferir separar semanticamente).
2. **Show/hide de coluna = `.table.show-costs .cost-col`**
   (`references/design-system.css:316-318`): classe no `<table>` + `display` no
   grupo de colunas. Mesmo mecanismo aqui — classe de view no `<table>` do balanço +
   `display: none` no grupo escondido. Sem re-render, sem tocar corpo/filtro/ordem.

CSS novo esperado (2 regras, só `display`):
```css
.balance-table.view-unidades .col-bake { display: none; }
.balance-table.view-fornadas .col-unit { display: none; }
```
`view-completa` = sem classe extra → tudo aparece. O `tfoot` carrega as mesmas
classes de coluna → totais escondem/aparecem junto, sempre presentes nas três views.

## Mockups (ASCII, aprovados pelo cliente)

**Barra de pills** (acima da tabela do card Balanço):
```
Exibição:  (● Completa)( Unidades )( Fornadas )
```

**Completa** — 10 col (tudo):
```
Data    Receita       Produção  Custo un.  Custo(C)  Vendas  Preço un.  Fatur.(F)  Saldo    Status
05/07   Pão campanha       40    R$2,10    R$84,00      38    R$6,00    R$228,00  R$144,00   171%
Total                      40              R$84,00      38              R$228,00  R$144,00   171%
```

**Unidades** — 7 col (por-unidade + contagens):
```
Data    Receita       Produção  Custo un.  Vendas  Preço un.  Status
05/07   Pão campanha       40    R$2,10       38    R$6,00     171%
Total                      40                 38               171%
```

**Fornadas** — 8 col (agregados da fornada):
```
Data    Receita       Produção  Custo(C)  Vendas  Fatur.(F)  Saldo    Status
05/07   Pão campanha       40    R$84,00      38   R$228,00  R$144,00   171%
Total                      40    R$84,00      38   R$228,00  R$144,00   171%
```

## O que fazer
- Adicionar barra de pills (`.period-toggle`/`.view-toggle`) acima da tabela do card
  Balanço, com três botões (Completa/Unidades/Fornadas); default **Completa** ativo.
- Marcar cada `<th>`/`<td>` de coluna condicional (thead, corpo, tfoot) com `.col-unit`
  ou `.col-bake` conforme o mapa. Colunas sempre-visíveis não recebem classe.
- Handler de troca de view: alterna `.active` no botão clicado (padrão `setGranularity`)
  e a classe `view-completa|view-unidades|view-fornadas` no `<table>` do balanço.
- Duas regras CSS de `display` (acima) — sem valor bruto, sem token novo. Documentar a
  classe/regras nova(s) em `references/design-system.html` se `designer-ux` criar `.view-toggle`.
- Preservar tudo da 045: só-leitura, ordenação data desc, filtros, planejadas com "—",
  totais no `tfoot`, cor `.loss` em Saldo<0.

## Casos de borda
- Trocar de view **não** re-renderiza o corpo nem reordena — só alterna classe (dados
  idênticos). Verificar que Saldo `.loss` persiste ao voltar para Completa/Fornadas.
- Coluna escondida via `display:none` continua no DOM (acessível a testes que a busquem)
  — os testes de estrutura da 045 não podem regredir.
- View **Fornadas** esconde Custo unitário/Preço unitário mas mantém Produção/Vendas —
  conferir contagem de colunas visíveis (8) no thead e no tfoot.
- View **Unidades** esconde Custo(C)/Faturamento(F)/Saldo — a célula `.loss` de Saldo
  fica escondida junto; ao voltar para Completa/Fornadas reaparece com a cor correta.
- Estado vazio (colspan da 045): o colspan cobre as 10 colunas; ao esconder colunas o
  `display:none` não deve quebrar o layout da linha de "sem fornadas" — validar visual.

## Testes exigidos
- UI/estrutura (`src/ui/historyView.test.ts`, molde dos testes de view existentes):
  - Barra de pills renderiza com 3 botões; **Completa** começa `.active`.
  - Clicar **Unidades** → tabela do balanço ganha `.view-unidades`; botão fica `.active`;
    os demais perdem `.active`. Idem **Fornadas** → `.view-fornadas`; **Completa** → sem
    classe de view (ou `.view-completa`).
  - `<th>`/`<td>` de Custo unitário e Preço unitário têm `.col-unit`; Custo(C)/Faturamento/
    Saldo têm `.col-bake`; Data/Receita/Produção/Vendas/Status **não** têm classe de coluna.
  - `tfoot` carrega as mesmas classes de coluna (totais escondem junto).
  - Trocar view não altera nº de linhas do corpo nem a ordem das datas.
- `tsc` limpo; `npm test` + `npm run build` verdes; nenhum teste da 045/044/018/013 regride.

## Critérios de aceite
- [ ] Barra de pills (Completa/Unidades/Fornadas) acima da tabela do card Balanço,
      reusando `.period-toggle`/`.view-toggle`; **Completa** default ativa.
- [ ] **Unidades** mostra exatamente: Data · Receita · Produção · Custo unitário ·
      Vendas · Preço unitário · Status (7 col); esconde Custo(C)/Faturamento(F)/Saldo.
- [ ] **Fornadas** mostra exatamente: Data · Receita · Produção · Custo(C) · Vendas ·
      Faturamento(F) · Saldo · Status (8 col); esconde Custo unitário/Preço unitário.
- [ ] **Completa** mostra as 10 colunas.
- [ ] `tfoot` de totais visível e coerente com as colunas exibidas nas três views.
- [ ] Status aparece nas três; Produção e Vendas aparecem nas três; Data/Receita sempre.
- [ ] Troca de view só alterna classes — sem re-render, sem reordenar, sem tocar filtros;
      Saldo `.loss` preservado. Só tokens/classes do design system, zero valor bruto.
- [ ] Suíte inteira verde e build OK; nada da 045 regride.

## Referências
- `specs/aba-balanco.md` (§2.1 colunas, §2.4 totais) — o `arquiteto` deve enriquecê-la
  com a definição das três visualizações e o mapa de colunas acima.
- `src/ui/historyView.ts` (card Balanço + `.period-toggle`/`setGranularity`, issues 045/018/044).
- `references/design-system.css:432` (`.period-toggle`), `:316-318` (`.table.show-costs .cost-col`).
- Issue 045 (tabela Balanço anfitriã).

---

## Plano Técnico

**Confirmação de escopo:** issue puramente UI. Nenhuma fórmula/core muda — `bakeStatus`,
`computeBakeDerived` e `aggregatePeriod` (core/bakes.ts) continuam intocados; `buildBalanceRow`
e `buildBalanceFootRow` já produzem TODAS as 10 células. O trabalho é (a) marcar 5 células
condicionais com 2 classes CSS, (b) adicionar uma barra de pills que alterna 1 classe no
`<table>`, (c) 2 regras CSS de `display`. Zero mudança de dado, filtro, ordenação ou agregação.

### Análise do existente (busca real: grep em historyView.ts, design-system.css/.html)

- **Precedente pill = `.period-toggle`** (`design-system.css:432-438`): segmented control
  `inline-flex` + botões + `.active` (`--primary`/`--creme`). Já instanciado no filtro Período
  (`historyView.ts:229-238`) com o handler `setGranularity(g, btn)` (`:280-288`) que faz o
  padrão `.active`-swap: `for (const b of [...]) b.classList.remove('active'); btn.classList.add('active')`.
  → **Reusar a classe `.period-toggle` diretamente** para a barra de views (é o mesmo componente
  visual; criar `.view-toggle` irmã seria duplicar regra idêntica — regra de ouro 2). Decisão:
  não criar `.view-toggle`; usar `.period-toggle`.
- **Precedente show/hide de coluna = `.table.show-costs .cost-col`** (`design-system.css:316-318`):
  classe no `<table>` + `display` no grupo de células. → **Mesmo mecanismo**: classe de view no
  `<table>` do balanço + `display:none` no grupo escondido. Sem re-render.
- **Tabela Balanço existente** (`historyView.ts:396-420`): `balanceTable` = `h('table',
  {className:'table', 'aria-label':'Balanço por fornada'})`; thead com 10 `<th>` (`:403-412`),
  `buildBalanceRow` (`:429-457`) e `buildBalanceFootRow` (`:463-478`) montam as 10 `<td>` na
  MESMA ordem. `BALANCE_COLS = 10` alimenta o colspan do estado vazio (`:423`, `:699`).
  → **Estender essas 3 funções** adicionando `.col-unit`/`.col-bake` nas 5 células condicionais;
  nada mais muda nelas.
- **Hook de teste**: `aria-label="Balanço por fornada"` já localiza a tabela sem colidir com a
  1ª `table` editável (`historyView.test.ts:95-96`). Reusar; não alterar.
- **`h()` helper** (`dom.ts`) aceita `className` como string única → `'num col-unit'` funciona;
  escape XSS preservado (textContent), nenhum `innerHTML`.

### Cenários (números do gabarito §12 / mockup da issue)

- **Feliz — Completa (default):** 10 colunas visíveis; pill "Completa" `.active`; `<table>` com
  `view-completa`. Fornada exemplo 05/07 Pão campanha: Produção 40, Custo un. R$2,10, Custo(C)
  R$84,00, Vendas 38, Preço un. R$6,00, Fatur.(F) R$228,00, Saldo R$144,00, Status 171%.
- **Unidades (7 col):** clicar pill → `<table>` ganha `view-unidades` → `.col-bake` some
  (Custo C, Fatur. F, Saldo). Restam: Data · Receita · Produção 40 · Custo un. R$2,10 ·
  Vendas 38 · Preço un. R$6,00 · Status 171%. tfoot idem: Total · · 40 · · 38 · · 171%.
- **Fornadas (8 col):** `view-fornadas` → `.col-unit` some (Custo un., Preço un.). Restam:
  Data · Receita · Produção 40 · Custo(C) R$84,00 · Vendas 38 · Fatur.(F) R$228,00 ·
  Saldo R$144,00 · Status 171%.
- **Borda — Saldo negativo:** célula `.loss` (§2.5 P5) permanece no DOM em qualquer view; em
  Unidades fica escondida junto com `.col-bake`, ao voltar p/ Completa/Fornadas reaparece
  vermelha (é só `display`, classe `.loss` intacta).
- **Borda — troca de view não re-renderiza:** handler só faz `classList` swap; corpo/ordem
  (data desc, `:690`) idênticos. Nenhum `renderAll()`/`clear()` chamado.
- **Borda — estado vazio:** linha única com `colspan={BALANCE_COLS}` (10); `display:none` de
  colunas não afeta uma célula com colspan → layout da linha "sem fornadas" intacto nas 3 views.
- **Borda — planejada:** "—" nas 5 colunas de venda já vem da 045; as classes de coluna são as
  mesmas → nada regride.

### Arquivos a criar
- Nenhum.

### Arquivos a modificar

1. **`src/ui/historyView.ts`**
   - No `balanceTable`: `className: 'table balance-table view-completa'` (adiciona marcador
     `balance-table` p/ escopo CSS + view default explícita `view-completa` p/ testabilidade).
   - thead (`:403-412`): adicionar 2ª classe às 5 células condicionais — `'num col-unit'` em
     Custo unitário e Preço unitário; `'num col-bake'` em Custo (C), Faturamento (F), Saldo.
     Data/Receita/Produção/Vendas/Status **sem** classe de coluna.
   - `buildBalanceRow` (`:444-455`): mesmas 5 células ganham `col-unit`/`col-bake`. A `balanceCell`
     (Saldo) recebe `col-bake` além do `.loss` condicional já existente.
   - `buildBalanceFootRow` (`:470-477`): mesmas 5 células (incl. a `balanceCell` do Saldo) ganham
     `col-unit`/`col-bake`. Colunas Total/Data/Receita e Produção/Vendas/Status sem classe.
   - Barra de pills: logo após `h2 'Balanço'` (`:398`) e antes de `balanceTable`, inserir
     `.period-toggle` com label "Exibição:" e 3 botões (Completa `.active` / Unidades / Fornadas),
     molde exato de `:229-238`.
   - Handler `setBalanceView(view, btn)`: molde de `setGranularity` (`:280-285`) — remove `.active`
     dos 3 botões, add no clicado; `balanceTable.classList.remove('view-completa','view-unidades',
     'view-fornadas')` + add da view escolhida. **NÃO** chama `renderAll()` (é só CSS; §2.3 P2).

2. **`references/design-system.css`** (2 regras novas, só `display`, zero token novo — logo
   após o bloco `.table.show-costs .cost-col`, `:318`, por analogia):
   ```css
   /* Balanço (issue 046): views alternam grupos de colunas por display (mesmo
      mecanismo de .show-costs). view-completa = tudo visível (sem regra). */
   .balance-table.view-unidades .col-bake { display: none; }
   .balance-table.view-fornadas .col-unit { display: none; }
   ```

3. **`references/design-system.html`**: documentar as classes novas (`.balance-table`,
   `.col-unit`, `.col-bake`, `.view-completa|unidades|fornadas`) num bloco de exemplo, seguindo
   o padrão do exemplo `show-costs`/`cost-col` (`:260-284`).

4. **`src/ui/historyView.test.ts`**: adicionar os casos abaixo (não regredir os 045/044/018/013).

5. **`specs/aba-balanco.md`**: enriquecida com §2.6 (feito pelo arquiteto, ver abaixo).

### Arquivos que NÃO devem ser tocados
- `src/core/**` inteiro (nenhuma fórmula muda — `bakeStatus`, `computeBakeDerived`,
  `aggregatePeriod` intocados).
- `references/design-system.css` tokens de `:root` (imutáveis; usamos só `display`).
- Tabela editável "Fornadas registradas", filtros, KPIs, gráfico, comparação de períodos,
  `setGranularity`/ordenação/estado vazio da 045.

### Testes primeiro (UI — `src/ui/historyView.test.ts`, molde dos casos 13–18 já existentes)
Um caso por comportamento, localizando a tabela via `balanceTable(root)` (`:95`) e a barra via
`.period-toggle` dentro do `balanceCard`:
1. **Barra de pills renderiza 3 botões, Completa `.active` default:** `balanceCard` contém uma
   `.period-toggle` com botões de texto "Completa"/"Unidades"/"Fornadas"; "Completa" tem `.active`;
   `<table>` tem `view-completa`.
2. **Clicar Unidades → `view-unidades`:** tabela ganha `view-unidades` e perde `view-completa`;
   botão Unidades `.active`, os outros dois sem `.active`.
3. **Clicar Fornadas → `view-fornadas`:** idem, `view-fornadas`.
4. **Voltar p/ Completa → `view-completa`:** classe de view volta a `view-completa`.
5. **Classes de coluna no thead:** os `<th>` "Custo unitário" e "Preço unitário" têm `col-unit`;
   "Custo (C)", "Faturamento (F)", "Saldo" têm `col-bake`; "Data"/"Receita"/"Produção"/"Vendas"/
   "Status" **não** têm `col-unit` nem `col-bake`.
6. **Classes de coluna no tfoot:** mesmas 5 células do `tfoot tr` carregam `col-unit`/`col-bake`
   (totais escondem junto).
7. **Troca de view não altera corpo:** nº de `tbody tr` e a sequência de datas (col Data)
   idênticos antes e depois de alternar para Unidades e voltar (sem re-render/reordenar).
8. **Saldo `.loss` persiste:** com fornada de Saldo<0, a célula Saldo mantém `.loss` após
   Completa → Unidades → Completa (classe intacta, só `display` mudou).

### Ordem de implementação
1. Enriquecer `specs/aba-balanco.md` §2.6 (feito).
2. Escrever os 8 testes UI (falham — TDD leve de UI).
3. `historyView.ts`: marcar as 5 células condicionais (thead + 2 builders) com `col-unit`/`col-bake`
   e adicionar `balance-table view-completa` ao `<table>`.
4. `historyView.ts`: barra `.period-toggle` + handler `setBalanceView`.
5. `design-system.css`: 2 regras de `display`; documentar em `design-system.html`.
6. `tsc` limpo, `npm test` + `npm run build` verdes; conferir 045/044/018/013 sem regressão.
