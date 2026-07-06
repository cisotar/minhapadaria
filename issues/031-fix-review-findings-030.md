---
id: "031"
titulo: Fix — achados da revisão da issue 030 (eliminação de volume)
tipo: fix
deps: ["030"]
status: todo
---

## Contexto

Achados médios/baixo da revisão `guardiao-design` da issue 030 (eliminação de
unidades de volume), não bloqueantes (`revisor-spec` aprovou sem achados).

## O que fazer

1. **médio** — `references/design-system.css:309-318`: classe `.unit-toggle`
   ficou órfã (nenhum módulo em `src/` a referencia mais após a remoção do
   alternador g/mL na issue 030) mas segue no bundle de produção. Remover a
   regra (ou comentário `/* deprecated */` se preferir manter por histórico —
   preferência: remover, brandbook §4.1 minimalismo).
2. **médio** — `references/design-system.html:246,269-270,283-284`: o guia de
   estilo vivo ainda documenta a coluna "Unidade" e o `<span
   class="unit-toggle">` (botões g/mL) como parte do padrão canônico da tabela
   de insumos — não existe mais na UI real. Atualizar o exemplo da tabela
   removendo a coluna/toggle, sincronizando com `ingredientsTable.ts` pós-030.
3. **baixo, informativo, sem ação de código** — `mockups/calculadora.html` e
   `mockups/calculadora-farinhas.html` ainda mostram visualmente a coluna
   "Unidade"/alternador g/mL removidos. Mockups são somente-leitura (regra de
   ouro do projeto) — não editar. Apenas registrar a divergência no
   `PROGRESS.md` (mesmo tratamento já dado à divergência de volume vs. spec
   v5 na issue 030).

## Testes exigidos (TDD)

- Nenhum teste novo necessário (mudança só em CSS morto + doc); rodar suíte
  completa + build ao final para confirmar zero regressão.

## Critérios de aceite

- [ ] `.unit-toggle` removida (ou explicitamente marcada deprecated) de
      `design-system.css`.
- [ ] `design-system.html` não mostra mais coluna "Unidade"/toggle g-mL no
      exemplo da tabela de insumos.
- [ ] Divergência mockups-vs-app registrada em `PROGRESS.md` (sem editar
      `mockups/`).
- [ ] Suíte + build seguem verdes.

## Referências

- issue 030 (base) · revisão `guardiao-design` da 030 ·
  `references/design-system.css`, `references/design-system.html`,
  `mockups/calculadora.html`, `mockups/calculadora-farinhas.html`

## Plano Técnico

### Análise do existente

Busca real (`grep -rn "unit-toggle" src/ references/`) confirma:

- `.unit-toggle` NÃO é referenciada em nenhum lugar de `src/` — só existe em
  `references/design-system.css:310,314,318` (definição da regra, 3 linhas de
  uso: `.unit-toggle`, `.unit-toggle button`, `.unit-toggle button.active`) e
  em `references/design-system.html:269,283` (dois `<span class="unit-toggle">`
  no exemplo da tabela de insumos). É CSS/HTML morto no guia de estilo (o
  bundle de produção não usa mais). A issue 030 já removeu o alternador g/mL e
  a função `buildUnitToggle` do app real.
- `src/ui/ingredientsTable.ts` (fonte da verdade da tabela real, pós-030): o
  `thead` (`buildThead`, ~L209-221) tem 8 colunas SEM "Unidade" — `Ingrediente
  · % · Peso (g) · Preço pago · Peso do produto · Custo/g · Custo · Ações`; os
  comentários L98-101/L207-208/L458/L644/L654 já documentam a remoção da coluna
  "Unidade" e os colspans recalculados (`buildAddRow` colspan 8; `buildTfoot`
  "Total da massa" + célula final sem total). É o layout com que o
  `design-system.html` deve ser sincronizado.
- As demais ocorrências de "Unidade" em `src/` (`ingredientsTable.ts:436`,
  `sourdoughTable.ts:476,589`, `batchPanel.ts:562`) são o `aria-label`
  "Unidade do peso do produto…" do `<select>` kg/g do par `.pw-combo` — controle
  DISTINTO e vivo; NÃO é a coluna "Unidade" nem o `.unit-toggle`. Não tocar.
- `references/design-system.css:300-307` (`.cost-col`/`.col-actions`) fica
  imediatamente antes do bloco `.unit-toggle`; L320 (`/* ==== Fornada ==== */`)
  logo depois. A remoção é um recorte limpo de L309-318 (comentário + 3 regras),
  sem afetar vizinhos.
- `PROGRESS.md:19` (entrada da issue 030, item 2) JÁ registrou preliminarmente a
  divergência mockup-vs-app apontando "issues/031 (status todo, NÃO corrigir)".
  O fechamento da 031 apenas confirma/consolida essa divergência no bloco de
  iteração 031 (padrão do bloco "Iteração 034" em `PROGRESS.md:37+`, mantido
  pelo escriba) — mesmo tratamento dado à divergência de volume vs. spec v5.

### Cenários

- **Caminho feliz (CSS)**: removidas as 10 linhas L309-318 de
  `design-system.css`; `npm run build` continua verde; nenhum seletor quebrado
  (grep pós-edição em `src/` retorna zero `.unit-toggle`).
- **Caminho feliz (HTML doc)**: a tabela `#tbl-insumos` do guia passa de 8 para
  7 colunas (`Ingrediente · % · Peso (g) · Preço pago · Peso do produto ·
  Custo/g · Custo`), espelhando a tabela real menos a coluna "Ações" (que o guia
  já não exibia — recorte mínimo, sem adicionar coluna nova fora de escopo).
  Cada `<tr>` do `<tbody>` perde exatamente sua célula de unidade; o `colspan`
  do "+ ingrediente" cai 8→7 e o "Total da massa" do `<tfoot>` cai `colspan 2→1`.
- **Borda (contagem de colunas)**: se alguma `<tr>` ficar com nº de `<td>`
  diferente do `<thead>` (7), o alinhamento visual do guia quebra — por isso o
  plano lista célula a célula (thead L246; tbody L258, L268-272, L283-285/toda a
  célula da unidade do Azeite, L299, L309; addRow L318; tfoot L325). Conferir
  que TODA célula "Unidade" (inclusive as de texto plano `<td>g</td>`) saia,
  não só os dois `.unit-toggle`.
- **Erro a evitar**: NÃO remover os `aria-label="Unidade do peso do produto…"`
  de `src/` (controle vivo do `.pw-combo`); NÃO editar `mockups/` (imutáveis,
  regra de ouro 2); NÃO tocar `:root`/tokens nem outras regras do CSS.

### Testes primeiro (issues core/storage/export)

Não se aplica. Esta é uma issue `tipo: fix` que altera apenas CSS morto e
documentação viva (`references/`) + registro em `PROGRESS.md` — zero código de
produção, zero comportamento novo. Nenhum teste Vitest novo. Gate: rodar a
suíte completa (`npm test`) + `npm run build` ao final e confirmar zero
regressão (suíte hoje em 344/344 conforme `PROGRESS.md:9`). Nenhum teste
existente referencia `.unit-toggle` nem a coluna "Unidade" da tabela real
(`grep` em `tests/` e `src/**/*.test.ts` só acha o comentário de
`ingredientsTable.test.ts:80` e labels de "Farinha por Unidade" do batchPanel —
ambos intocados).

### Arquivos a criar

Nenhum.

### Arquivos a modificar

1. `references/design-system.css` — remover o bloco L309-318 inteiro (o
   comentário `/* Toggle g/mL compacto por linha (líquidos) */` + as 3 regras
   `.unit-toggle`, `.unit-toggle button`, `.unit-toggle button.active`).
   Preferência do cliente: remover (não marcar deprecated), brandbook §4.1
   minimalismo (AC 1).
2. `references/design-system.html` — na tabela `#tbl-insumos`, remover a coluna
   "Unidade": `<th>Unidade</th>` (L246); as células de unidade de cada linha —
   Farinha Branca `<td>g</td>` (L258), Água `<td>…unit-toggle…</td>`
   (L268-272), Azeite `<td>…unit-toggle…</td>` (L282-286), Fermento
   `<td>g</td>` (L299), Sal `<td>g</td>` (L309); ajustar o `colspan` do botão
   "+ ingrediente" 8→7 (L318) e o "Total da massa" do `<tfoot>` `colspan 2→1`
   (L325). Resultado: thead e todas as linhas com 7 colunas (AC 2).
3. `PROGRESS.md` — o escriba adiciona o bloco de iteração da issue 031 (padrão
   "Iteração NNN" já usado, ex. L37+) registrando: limpeza do CSS morto
   `.unit-toggle` + sincronização do `design-system.html` (coluna "Unidade"/toggle
   g-mL removidos), e CONSOLIDA a divergência mockups-vs-app já anotada em
   `PROGRESS.md:19` — `mockups/calculadora.html` e `mockups/calculadora-farinhas.html`
   permanecem exibindo a coluna "Unidade"/alternador g/mL por serem
   somente-leitura (regra de ouro 2), divergência consciente e informativa (AC 3).

### Arquivos que NÃO devem ser tocados

- `mockups/calculadora.html`, `mockups/calculadora-farinhas.html` — imutáveis
  (regra de ouro 2); a divergência é só registrada, nunca corrigida.
- `spec/Calculadora_Pao_Fermento_Natural_v5.md` — somente-leitura.
- `src/**` (todo o código de produção, incl. `ingredientsTable.ts` e os
  `aria-label` "Unidade do peso do produto" do `.pw-combo`) — a tabela real já
  está correta pós-030; nada a mudar.
- `tests/**`, `src/**/*.test.ts` — nenhum teste novo, nenhum teste alterado.
- `:root`/tokens e demais regras de `design-system.css` fora de L309-318.

### Ordem de implementação

1. Remover o bloco `.unit-toggle` (L309-318) de `references/design-system.css`.
2. `grep -rn "unit-toggle" references/ src/` deve retornar apenas as 2 linhas
   de `design-system.html` (a serem removidas no passo 3) — confirma que o CSS
   não deixou seletor pendente.
3. Remover a coluna "Unidade" da tabela `#tbl-insumos` em
   `references/design-system.html` (thead + 5 células de linha + colspans do
   addRow e do tfoot), deixando 7 colunas consistentes.
4. `grep -rn "unit-toggle" references/ src/` deve retornar VAZIO.
5. Escriba registra o bloco de iteração 031 em `PROGRESS.md` (limpeza +
   consolidação da divergência mockups-vs-app).
6. Gate final: `npm test` (esperado 344/344, zero regressão) + `npm run build`
   (3 páginas, sem erro).
