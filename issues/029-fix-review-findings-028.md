---
id: "029"
titulo: Fix — achados da revisão da issue 028 (refactor PDF)
tipo: fix
deps: ["028"]
status: done
---

## Contexto

Achados médios da revisão da issue 028 (refactor visual dos PDFs), não
bloqueantes (o alto já foi corrigido na própria 028 antes do commit).

## O que fazer

1. **`revisor-spec`, médio** — `src/ui/pages/calculadora.ts` (botão "Imprimir
   Custos", gate por `showCosts` §2.A.2): sem teste. `calculadora.test.ts` não
   exercita `.hidden`/`store.subscribe(syncCostsBtn)`. Adicionar caso: montar
   com `prefs.getShowCosts()===false` → botão "Imprimir Custos" com `.hidden`;
   após `store.setShowCosts(true)` → visível (valida reatividade via
   `subscribe`). Mesmo padrão do caso já existente em `historyView.test.ts`
   para o botão "Imprimir Financeiro".
2. **`guardiao-design`, médio** — `references/design-system.html` (seção
   "Impressão / Salvar em PDF", linhas ~444-485) ficou obsoleta após a issue
   028: ainda cita `renderPrintView` (removida/renomeada), exemplo usa classes
   mortas `.print-view/.print-title/.print-section/.print-line/.print-label/
   .print-value` (removidas de `design-system.css`) e mostra um botão único em
   vez do padrão novo de 2 botões por tela. Nenhum dos tokens/classes novos
   (`--print-credit`/`--print-debit`/`--print-muted`, `.pdf-section`/`.kv`/
   `.pdf-credit`/`.pdf-debit`/`.pdf-muted-row`/`.pdf-alert`/`.pdf-footer`) está
   documentado. Reescrever a seção: 4 fluxos de PDF (Receita/Custos/Fornadas/
   Financeiro), exemplo com `.card`+`.table`/`.kv`, 2 botões por tela, paleta
   `--print-*` documentada.

## Testes exigidos (TDD)

- Item 1: novo caso em `calculadora.test.ts` (vermelho → verde).

## Critérios de aceite

- [ ] Gate do botão "Imprimir Custos" coberto por teste (paridade com histórico).
- [ ] `design-system.html` reflete o estado atual de `print.ts`/`design-system.css`
      pós-028 (zero referência a função/classe removida).
- [ ] Suíte + build seguem verdes.

## Referências

- issue 028 (base) · revisão `revisor-spec`/`guardiao-design` da 028 ·
  `src/ui/pages/calculadora.ts`, `src/ui/historyView.test.ts` (padrão do caso
  a espelhar), `references/design-system.html`, `references/design-system.css`

---

## Plano Técnico

> **Nota de escopo (verificação real com `grep`, 2026-07-05):** a issue 029 foi
> escrita no estado pós-028. Desde então a **issue 034** (commit `6486296`)
> reescreveu a seção "Impressão / Salvar em PDF" de `design-system.html`
> (linhas 444-513) e da CSS. Confirmado por busca: as referências mortas citadas
> no item 2 **já não existem** — `grep -n "renderPrintView\|print-view\|
> print-title\|print-section\|print-line\|print-label\|print-value"` retorna
> **zero** em `design-system.html` e em `design-system.css`; e os tokens/classes
> novos (`--print-credit`/`--print-debit`/`--print-muted`, `.sec-card`/`.kv`/
> `.pdf-credit`/`.pdf-debit`/`.pdf-muted-row`/`.pdf-alert`/`.pdf-footer`/
> `table.rt`) **já estão documentados**. O item 2 fica reduzido ao único gap
> residual descrito abaixo — **não** um rewrite completo (não desfazer 034).

### Análise do existente
Busca real (`grep`) no código, nos testes e no design system:

- `src/ui/pages/calculadora.ts:152-172` → wiring dos 2 PDFs por contexto.
  `mountPrintButton(exportBar, …, 'Imprimir Receita')` (`:152`) e
  `printCostsBtn = mountPrintButton(exportBar, …, 'Imprimir Custos')` (`:161`).
  O gate é reativo: `syncCostsBtn` (`:167`) faz
  `printCostsBtn.classList.toggle('hidden', !prefs.getShowCosts())`, é chamado
  uma vez (`:170`) e **religado a cada notificação** via
  `store.subscribe(syncCostsBtn)` (`:171`). É exatamente esta reatividade que o
  item 1 exige cobrir — hoje sem teste.
- `src/ui/state.ts:114-117` → `store.setShowCosts(v)` persiste em
  `prefs.setShowCosts(v)` e chama `notify()`; `notify()` dispara os subscribers
  (`:79`), logo `syncCostsBtn` roda e relê `prefs.getShowCosts()`. É o caminho
  de reatividade a validar (§2.A.2).
- `src/ui/ingredientsTable.ts:139-152` → a **fonte real** do `setShowCosts` na
  UI: checkbox "Exibir custos" (`<label class="toggle-label push-right">` +
  `<input type="checkbox">`, sem `aria-label`). `on(toggleInput,'change', …)`
  (`:149`) chama `store.setShowCosts(toggleInput.checked)`. O teste do item 1
  aciona ESTE checkbox (marca + `change`) para exercitar a cadeia real
  checkbox → `setShowCosts` → `notify` → `subscribe` → `syncCostsBtn` → `.hidden`,
  sem precisar de acesso ao `store` interno de `initCalculadora`.
- `src/ui/historyView.test.ts:293-317` (caso 12) → **molde a espelhar**: helper
  `findFin(root)` acha o botão por `textContent === 'Imprimir Financeiro'`;
  monta com `createPrefsStore({ storage: createMemoryStorage() })` +
  `setShowCosts(false|true)`; assere `.classList.contains('hidden')`. O caso
  novo de `calculadora.test.ts` reusa o mesmo padrão (`find` por textContent,
  prefs em memória).
- `src/ui/pages/calculadora.test.ts:64-156` → suíte jsdom já existente de
  `initCalculadora`. `beforeEach` (`:52-55`) monta `#app`; os testes já
  localizam `input[aria-label="Porcentagem de Água"]` — prova de que a tabela de
  Ingredientes (e portanto o checkbox "Exibir custos") renderiza em jsdom.
  Reusar a infra (`makeStore`, `createPrefsStore` em memória, `document.body`).
  Injeção: `initCalculadora({ recipeStore, prefs, search })` (`:81`).
- `references/design-system.html:444-513` → seção de impressão **já pós-034**:
  intro (`:446-460`) cita as 4 funções render, `:475-497` descreve o refactor
  v2 (`.sec-card`/`.rt`/`.pdf-*`), exemplo vivo de `.sec-card`+`table.rt`
  (`:498-512`). **Gap residual**: a barra de ações de exemplo (`:466-469`) ainda
  mostra **1 botão** ("Imprimir / Salvar em PDF") ao lado de "Exportar XLSX",
  em vez do padrão real de **2 botões por tela** (Receita/Custos e
  Fornadas/Financeiro) com o botão de custos *gated* por `.hidden`. É o único
  ponto do item 2 ainda desalinhado com `print.ts`/`calculadora.ts`.
- `references/design-system.css:734` → `.hidden { display:none !important; }`
  já existe (issue 022). `.row.row--sticky`, `.btn.btn-secondary` já existem.
  **Nenhuma classe/token novo** é necessário — item 2 é só texto/exemplo em
  `design-system.html`, zero CSS (regra de ouro 2).

### Cenários
Regra de negócio: gate do botão de custos pela pref global "Exibir custos"
(spec §2.A.2, gate por botão inteiro — issue 028). Escape/segurança: item sem
render de dado de usuário (só toggle de classe e doc estática) — nada de
`innerHTML`; nenhum secret; 100% client-side (§10/§11.1).

- **Caminho feliz — gate inicial oculto:** `prefs.getShowCosts() === false`
  (default §2.A.2) → após `initCalculadora`, o botão "Imprimir Custos" existe e
  tem `.hidden`; o botão "Imprimir Receita" (sem custo) sempre presente e SEM
  `.hidden` (paridade com "Imprimir Fornadas" no caso 12 do histórico).
- **Caminho feliz — reatividade liga o botão:** com o botão oculto, marcar o
  checkbox "Exibir custos" (`change`) → `store.setShowCosts(true)` → `notify()`
  → `syncCostsBtn` → "Imprimir Custos" perde `.hidden` (visível). Valida o
  `subscribe` (§2.A.2), não só o estado de mount.
- **Borda — desligar de volta:** desmarcar o checkbox → `setShowCosts(false)` →
  botão volta a `.hidden` (reatividade nos dois sentidos).
- **Borda item 2 (doc):** telas com 2 fluxos — Calculadora
  (Receita + Custos) e Histórico (Fornadas + Financeiro); em ambas o segundo
  botão (custos/financeiro) é o que recebe `.hidden` quando `showCosts=false`.
  O exemplo do design-system deve refletir esse par + a nota do gate.

### Testes primeiro (TDD — item 1)
Issue `tipo: fix`; teste é jsdom em `src/ui/pages/calculadora.test.ts`. Escrever
ANTES (vermelho → verde). Um caso novo, espelhando o caso 12 de
`historyView.test.ts`:

- **Caso: "gate do botão 'Imprimir Custos' pela pref showCosts (issue 028)"**
  1. `prefs = createPrefsStore({ storage: createMemoryStorage() })`;
     `prefs.setShowCosts(false)`. `initCalculadora({ recipeStore: makeStore(),
     prefs, search: '' })`.
  2. Helper `findBtn(label)` = `Array.from(document.querySelectorAll('button'))
     .find(b => b.textContent === label)`.
  3. **Entrada:** `showCosts=false` → **saída esperada:**
     `findBtn('Imprimir Custos')` definido e
     `.classList.contains('hidden') === true`; `findBtn('Imprimir Receita')`
     definido e `.classList.contains('hidden') === false`.
  4. Localizar o checkbox "Exibir custos": `Array.from(document
     .querySelectorAll('label.toggle-label')).find(l => l.textContent
     ?.includes('Exibir custos'))` → seu `input` (ou
     `input[type="checkbox"]`). Marcar `.checked = true` + `dispatchEvent(new
     Event('change', { bubbles: true }))`.
  5. **Saída esperada (reatividade via `subscribe`):**
     `findBtn('Imprimir Custos').classList.contains('hidden') === false`.
  6. (Opcional, reforço da reatividade bidirecional) desmarcar + `change` →
     `.hidden` volta a `true`.

  Notas: sem `?recipe` (`search:''`) não liga auto-save — irrelevante para o
  gate, mantém o teste isolado (sem fake timers). Não acessar o `store`
  interno: a reatividade é dirigida pelo checkbox real (mesma cadeia de
  produção), o que é MAIS fiel que chamar `store.setShowCosts` direto.

### Arquivos a criar
Nenhum.

### Arquivos a modificar
- `src/ui/pages/calculadora.test.ts` — adicionar o caso novo (gate do botão
  "Imprimir Custos" + reatividade via checkbox "Exibir custos"). Reusa
  `makeStore`, `createPrefsStore`, `createMemoryStorage` já importados; não
  precisa de `vi.useFakeTimers()` (sem debounce no fluxo). Atualizar o
  docblock do topo listando o novo caso (paridade com o caso 12 do histórico).
- `references/design-system.html` — **apenas** o gap residual do item 2:
  substituir a barra de ações de exemplo (`:466-469`, hoje 1 botão "Imprimir /
  Salvar em PDF") pelo padrão real de **2 botões por tela** — mostrar os dois
  pares (Calculadora: "Exportar XLSX" + "Imprimir Receita" + "Imprimir Custos";
  Histórico: "Exportar XLSX" + "Imprimir Fornadas" + "Imprimir Financeiro"),
  com o botão de custos/financeiro marcado `class="btn btn-secondary hidden"`
  no estado `showCosts=false` e uma linha de nota explicando o gate `.hidden`
  por `prefs.getShowCosts()` (§2.A.2). Ajustar a `<p>` de `:461-465` que ainda
  diz "Imprimir/Salvar em PDF" (singular) para citar os 2 botões por contexto.
  Nenhuma CSS nova (usa `.hidden`/`.btn`/`.row--sticky` já existentes).

### Arquivos que NÃO devem ser tocados
- `src/ui/pages/calculadora.ts` — o gate/`subscribe` já está correto (issue
  028); o item 1 só ADICIONA teste, não muda produção.
- `src/export/print.ts` — inalterado (item 1 é teste, item 2 é doc).
- `references/design-system.css` — `.hidden`/tokens `--print-*`/`.sec-card`/
  `.rt` já existem (034); zero CSS novo.
- `src/ui/historyView.ts` / `historyView.test.ts` — só molde de leitura.
- `src/ui/state.ts`, `src/storage/prefs.ts` — contratos `setShowCosts`/
  `getShowCosts` inalterados.
- `src/core/*` — nenhuma regra de cálculo afetada.

### Ordem de implementação
1. Escrever o caso novo em `calculadora.test.ts` (TDD) — deve FALHAR se o gate
   quebrar; com o código atual já passa (é teste de caracterização/paridade,
   memória "Fixes sem re-review"). Confirmar que exercita `.hidden` inicial E a
   reatividade via checkbox (a asserção pós-`change` é a que valida `subscribe`).
2. Rodar a suíte: garantir verde (o golden §12 e os demais casos de
   `calculadora.test.ts` intactos).
3. Editar `references/design-system.html`: barra de 2 botões por tela + nota do
   gate `.hidden`; remover o singular "Imprimir / Salvar em PDF" do exemplo.
4. `grep` de sanidade em `design-system.html`/`.css` para confirmar zero
   referência a função/classe removida (AC 2) e rodar build — sem quebra
   (design-system.html não entra no bundle; a CSS não muda).
