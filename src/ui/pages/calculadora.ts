/**
 * calculadora.ts — Composition root da página Calculadora (receitas.html após issue 032), issues 014/015/016/017/028/029/036/040.
 *
 * O que faz: instancia `createPrefsStore` (011), o estado inicial via
 * `goldenSeed` (§12) + `createAppState` (§1.6) — com o `normalize` opcional
 * (issue 015) amarrando `inheritSourdoughFlourCosts` (herança de custo §4,
 * seam via `editedCostIds`) — e monta, na ordem do mockup
 * `mockups/calculadora.html`, o card Ancoragem/Planejamento da Fornada
 * (`renderBatchPanel`, §2.E/§2.E.1, 016 — hospeda o toggle de modo §1.3/§1.5
 * e o escalonamento §3.D), o card Ingredientes (`renderIngredientsTable`,
 * 014), a sub-receita do Fermento (`renderSourdoughTable`, §2.B, 015) e, lado
 * a lado (`.grid-2`), a Hidratação (`renderHydrationPanel`, §2.C/§2.D, 015) e
 * a Precificação (`renderPricingPanel`, §3.E/§4, 016) — no `<div id="app">`
 * do shell estático de `receitas.html` (nav/header já são HTML puro). Zero
 * fórmula aqui: só composição/wiring (regra de ouro 2).
 *
 * Integração `?recipe=<id>` (issue 017, §2.F): `new
 * URLSearchParams(location.search).get('recipe')` — se presente e
 * `recipeStore.get(id)` existir, essa `Recipe` (storage real, 011) vira a
 * semente inicial (no lugar de `goldenSeed()`) e liga o auto-save
 * (`recipeId = found.id`); se o id não existir, cai em `goldenSeed()` + chip
 * de aviso discreto ("Receita não encontrada; abrindo modelo padrão."). Sem
 * `?recipe` (acesso direto a `receitas.html`) a semente é o golden seed
 * efêmero e `recipeId` nasce `null` — SEM auto-save até o usuário nomear a
 * receita pelo campo fixo do header (issue 040, abaixo).
 *
 * Auto-save (decisão registrada, §10 "debounce em inputs" + §1.6 "sem
 * botão Salvar"): `store.subscribe` reagenda um `setTimeout` de ~400ms a
 * cada notificação — só o ÚLTIMO da rajada de edições chega a gravar
 * (`recipeStore.update`, 011); `visibilitychange` (aba escondida) e
 * `beforeunload` forçam o flush imediato, para não perder a última edição
 * se o usuário fechar a aba antes do debounce disparar.
 *
 * Extração testável (issue 025, achado médio "integração ?recipe sem
 * teste"): toda a lógica acima mora em `initCalculadora(deps)`, uma função
 * pura o bastante para jsdom (recebe `prefs`/`recipeStore`/`search`
 * injetáveis, default = as mesmas instâncias reais de sempre) — o
 * comportamento em produção não muda: o rodapé do arquivo chama
 * `initCalculadora()` sem argumentos, exatamente como o script fazia no
 * nível de módulo antes desta issue. Testes em `calculadora.test.ts` usam
 * `createMemoryStorage()` + `vi.useFakeTimers()` para cobrir os 3 casos do
 * plano (§2.F): id válido + auto-save após debounce, id inexistente (banner
 * + sem persistir) e flush em `visibilitychange` (aba escondida).
 *
 * Nome da receita como campo fixo (issue 040, refino de posicionamento): o
 * `<h1>` estático "🍞 Calculadora de Pão com Fermento Natural" e o
 * `.subtitle` do shell (`receitas.html`) permanecem SEMPRE intactos — a 036
 * os substituía quando havia receita carregada; a 040 reverteu isso. O
 * `<input class="input">` fixo (label "Nome da receita") mora dentro de um
 * `<section class="card">` próprio, anexado a `#app` logo após a barra de
 * exportação (`exportBar`) e ANTES do card de Ancoragem/Planejamento da
 * Fornada (`renderBatchPanel`) — sempre visível, mesmo na efêmera (sem
 * `?recipe`), caso em que nasce VAZIO (nunca o nome do `goldenSeed()`). Ao
 * confirmar (Enter/blur):
 *  - receita carregada (`recipeId !== null`): guarda (vazio ou igual ao nome
 *    atual → não grava) e só então `store.update((draft) => { draft.name =
 *    value; })` — o MESMO pipeline de autosave abaixo persiste; nunca
 *    `recipeStore.rename` direto (evita um segundo caminho de escrita).
 *  - efêmera (`recipeId === null`): nome vazio não cria nada (junk-
 *    prevention); nome não-vazio → `recipeStore.create({ ...recipe, name })`
 *    (novo id, ignora o id da semente), sincroniza esse id de volta no store
 *    (`store.update((draft) => { draft.id = created.id; draft.name = value;
 *    })` — necessário porque o autosave localiza o registro por `recipe.id`),
 *    liga o autosave (`recipeId = created.id`) e `replaceUrl(...)` para
 *    `receitas.html?recipe=<id>` (dep injetável, default
 *    `history.replaceState`) — reload subsequente mantém a receita.
 * `inlineNameEdit.ts` (issue 036) NÃO é reusado aqui: o pedido é um campo
 * SEMPRE visível (inclusive vazio/placeholder), o oposto do click-to-edit —
 * ele segue intocado servindo `recipesList.ts` (renomear o card, issue 033).
 *
 * Seções implementadas: §1–2 (composição da tela), §1.3, §1.5, §2.B, §2.C,
 * §2.D, §2.E, §2.F, §3.D, §3.E, §4, §9–10 (app 100% client-side).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createPrefsStore, type PrefsStore } from '../../storage/prefs';
import { createRecipeStore, type RecipeStore } from '../../storage/recipes';
import { defaultStorage, type StorageLike } from '../../storage/local';
import { createAppState } from '../state';
import { goldenSeed } from '../seed';
import { renderBatchPanel } from '../batchPanel';
import { renderIngredientsTable } from '../ingredientsTable';
import { renderSourdoughTable, inheritSourdoughFlourCosts } from '../sourdoughTable';
import { renderHydrationPanel } from '../hydrationPanel';
import { renderPricingPanel } from '../pricingPanel';
import { h, clear, on } from '../dom';
import { formatDate } from '../../core/format';
import { workbookToBlob, downloadBlob } from '../../export/download';
import { renderRecipePrintView, renderRecipeCostsPrintView, mountPrintButton } from '../../export/print';

/** Dependências injetáveis (issue 025) — default = instâncias reais de produção. */
export interface InitCalculadoraDeps {
  prefs?: PrefsStore;
  recipeStore?: RecipeStore;
  /** Default `defaultStorage()` — só usado quando `recipeStore` não é informado. */
  storage?: StorageLike;
  /** Default `location.search` — permite jsdom simular `?recipe=<id>` sem tocar na URL global. */
  search?: string;
  /**
   * Default `(url) => history.replaceState(null, '', url)` (issue 040): troca
   * a URL sem navegar/recarregar, para que um reload após a criação lazy
   * (caminho efêmera → nomeada) mantenha `?recipe=<id>`. Injetável para jsdom
   * nunca tocar `history`/`location` reais em teste.
   */
  replaceUrl?: (url: string) => void;
}

/**
 * Composition root da Calculadora (§2.F): monta o estado inicial (golden seed
 * ou receita salva via `?recipe=<id>`), o auto-save e todos os cards da tela
 * dentro de `#app` (shell estático de `receitas.html`). Chamada sem argumentos
 * pelo rodapé deste módulo — o comportamento de produção não muda com a
 * extração (regra de ouro 2/arquitetura: zero lógica nova, só testabilidade).
 */
export function initCalculadora(deps: InitCalculadoraDeps = {}): void {
  const prefs = deps.prefs ?? createPrefsStore();
  const storage = deps.storage ?? defaultStorage();
  const recipeStore = deps.recipeStore ?? createRecipeStore({ storage });
  const search = deps.search ?? location.search;
  const replaceUrl = deps.replaceUrl ?? ((url: string) => history.replaceState(null, '', url));

  // §2.F: `?recipe=<id>` carrega uma receita salva; ausente/inexistente → golden seed.
  const requestedId = new URLSearchParams(search).get('recipe');
  let initialRecipe = goldenSeed();
  let recipeNotFound = false;
  // Issue 040: `recipeId` substitui o antigo `autosaveEnabled: boolean` — o
  // pipeline de autosave abaixo é SEMPRE registrado, mas só grava quando
  // `recipeId !== null` (nulo na efêmera até o usuário nomear a receita).
  let recipeId: string | null = null;
  if (requestedId) {
    const found = recipeStore.get(requestedId);
    if (found) {
      initialRecipe = found;
      recipeId = found.id; // só grava quando a tela foi aberta por uma receita real
    } else {
      recipeNotFound = true;
    }
  }
  // Campo de nome fixo (issue 040): valor inicial é o nome da receita
  // carregada, ou VAZIO na efêmera — NUNCA `goldenSeed().name` (o cliente não
  // quer "Pão Rústico" pré-preenchido num rascunho ainda não salvo).
  const initialNameFieldValue = recipeId !== null ? initialRecipe.name : '';

  // §4: farinhas do fermento editadas manualmente (Preço Pago/Peso do Produto)
  // param de herdar do ingrediente principal vinculado por flourId — seam vivo
  // na UI (types.ts congelado, sem flag `manuallyEdited`), amarrado ao hook
  // `normalize` de `state.ts` (chamado a cada `update`/`applyTransform`, antes
  // de `recalculate` — 016 estende `applyTransform` para o mesmo hook, sem
  // duplicar o pipeline, regra de ouro 2).
  const editedCostIds = new Set<string>();
  const store = createAppState(initialRecipe, prefs, (draft) => inheritSourdoughFlourCosts(draft, editedCostIds));

  const app = document.getElementById('app');
  if (app) {
    if (recipeNotFound) {
      // Banner discreto (§2.F, borda "?recipe=<id> inexistente"): reusa o chip
      // de status (design-system.css, §4) — nenhuma classe nova.
      app.appendChild(
        h('div', { className: 'chip chip-warn', style: 'margin-bottom:var(--sp-3)' }, [
          'Receita não encontrada; abrindo modelo padrão.',
        ]),
      );
    }
    // §8 (issue 019, spec literal "botão fixo no topo" — revisão: barra sticky):
    // barra fixa no topo — Exportar XLSX + Imprimir Receita + Imprimir Custos
    // (issue 028: 2 PDFs por contexto). Consome o estado JÁ recalculado
    // (store.getState()), sem recalcular (§1.6); o botão "Imprimir Custos" é
    // gated pela pref global "Exibir custos" (§2.A.2). O #print-root fica no
    // <body> (único bloco visível em @media print, design-system.css).
    const printRoot = h('div', { id: 'print-root' });
    document.body.appendChild(printRoot);

    // `.row.row--mb.row--sticky` (revisão issue 019, achado ALTO): reusa `.row`
    // em vez do extinto `.export-bar` duplicado; `--sticky` fixa a barra no
    // topo (spec §8 literal), `--mb` mantém o respiro para o card seguinte.
    const exportBar = h('div', { className: 'row row--mb row--sticky' });
    const xlsxBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Exportar XLSX']);
    on(xlsxBtn, 'click', () => {
      // Code-split (revisão issue 027, achado baixo #3): ExcelJS (~942 kB) só
      // entra no bundle no clique, via `import()` dinâmico (doc oficial Vite/
      // Rollup) — nunca no carregamento inicial da tela.
      const { recipe, summary } = store.getState();
      const includeCosts = prefs.getShowCosts();
      const stamp = formatDate(new Date()); // aaaa-mm-dd (§7.1)
      void import('../../export/xlsx').then(({ buildRecipeWorkbook }) => {
        const wb = buildRecipeWorkbook(recipe, summary, { includeCosts });
        return workbookToBlob(wb);
      }).then((blob) => downloadBlob(blob, `minha-padaria-receita-${stamp}.xlsx`));
    });
    exportBar.appendChild(xlsxBtn);
    // Issue 028: 2 PDFs por contexto — "Imprimir Receita" (ingredientes/
    // proporções, zero $) e "Imprimir Custos" (custo/g, precificação). Ambos
    // consomem o estado JÁ recalculado (§1.6); §8: imprime SÓ no clique.
    mountPrintButton(exportBar, () => {
      clear(printRoot);
      const { recipe, summary } = store.getState();
      renderRecipePrintView(printRoot, { recipe, summary });
      window.print();
    }, 'Imprimir Receita');
    // Botão de custos gated pela pref global "Exibir custos" (§2.A.2, issue 028
    // — gate por botão inteiro). `store.setShowCosts` notifica (state.ts) →
    // o `subscribe` abaixo alterna `.hidden` sem código de reatividade novo.
    const printCostsBtn = mountPrintButton(exportBar, () => {
      clear(printRoot);
      const { recipe, summary } = store.getState();
      renderRecipeCostsPrintView(printRoot, { recipe, summary });
      window.print();
    }, 'Imprimir Custos');
    const syncCostsBtn = (): void => {
      printCostsBtn.classList.toggle('hidden', !prefs.getShowCosts());
    };
    syncCostsBtn();
    store.subscribe(syncCostsBtn);
    app.appendChild(exportBar);

    // Card do nome da receita (issue 040, refino de posicionamento): `<h1>`/
    // `.subtitle` do shell permanecem estáticos; este `.card` novo mora em
    // `#app`, entre a barra de exportação (`exportBar`, acima) e o card de
    // Ancoragem/Planejamento da Fornada (`renderBatchPanel`, logo abaixo).
    // Reuso total do design system (`.field` label+control, `.input`) —
    // nenhuma classe/token novo (regra de ouro 1).
    const nameCard = h('section', { className: 'card' });
    const nameField = h('div', { className: 'field' });
    nameField.appendChild(h('label', { for: 'recipe-name-input' }, ['Nome da receita']));
    const nameInput = h('input', {
      // Nome acessível vem do `<label for>` acima — sem `aria-label` redundante
      // (WAI-ARIA: evitar nome duplicado; mesma diretriz da issue 039).
      id: 'recipe-name-input',
      type: 'text',
      className: 'input',
      placeholder: 'Nome da receita',
      value: initialNameFieldValue, // '' na efêmera — nunca goldenSeed().name
    }) as HTMLInputElement;
    nameField.appendChild(nameInput);
    nameCard.appendChild(nameField);
    app.appendChild(nameCard);

    // Commit (Enter/blur) — decisões 3/5 do Plano Técnico (issue 040). Nome
    // do usuário só chega ao DOM via `h`/`textContent` (regra de ouro 3) —
    // aqui só entra em `value`/estado, nunca `innerHTML`.
    const commitName = (value: string): void => {
      if (recipeId !== null) {
        // Receita carregada: guarda vazio/igual → não grava; senão o MESMO
        // pipeline de autosave abaixo persiste (nunca `recipeStore.rename`).
        if (value === '' || value === store.getState().recipe.name) return;
        store.update((draft) => {
          draft.name = value;
        });
        return;
      }
      // Efêmera: nome vazio não cria nada (junk-prevention); nome não-vazio
      // cria a receita agora (lazy-create) e liga o autosave dali em diante.
      if (value === '') return;
      const created = recipeStore.create({ ...store.getState().recipe, name: value });
      // Sincroniza o id publicado no store — `recipeStore.update` (autosave
      // abaixo) localiza o registro por `recipe.id` (storage/recipes.ts).
      store.update((draft) => {
        draft.id = created.id;
        draft.name = value;
      });
      recipeId = created.id; // liga o autosave a partir de agora
      replaceUrl(`receitas.html?recipe=${created.id}`);
    };
    on(nameInput, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitName(nameInput.value);
      }
    });
    on(nameInput, 'blur', () => commitName(nameInput.value));

    // Cada `render*` anexa uma `section.card` a `app`; capturamos a referência
    // logo após, via `lastElementChild`, sem alterar as assinaturas usadas nos
    // testes (que ignoram retorno).
    renderBatchPanel(app, store); // §2.E/§2.E.1 — hospeda modeToggle (§1.3/§1.5) e scalePanel (§3.D)
    const batchCard = app.lastElementChild as HTMLElement;
    renderIngredientsTable(app, store);
    const ingredientsCard = app.lastElementChild as HTMLElement;
    // O card de Ingredientes dimensiona-se pelo CONTEÚDO (não estica à largura
    // da página): cresce/encolhe conforme as colunas visíveis do toggle "Exibir
    // custos" (spec §10 desktop-first). Classe do design system, só keyword de
    // layout — sem valor visual novo.
    ingredientsCard.classList.add('card--fit');
    renderSourdoughTable(app, store, editedCostIds);
    const sourdoughCard = app.lastElementChild as HTMLElement;

    const grid = h('div', { className: 'grid-2' });
    app.appendChild(grid);
    renderHydrationPanel(grid, store); // §2.C/§2.D
    renderPricingPanel(grid, store); // §3.E/§4

    // Simetria da tela (pedido de layout): os demais blocos acompanham a MESMA
    // largura recalculada pelo card de Ingredientes — nunca larguras
    // independentes. Medição pura de layout (não é lógica de negócio nem token
    // visual): lê a largura renderizada e a espelha nos irmãos; um
    // `ResizeObserver` re-sincroniza quando a tabela cresce/encolhe (toggle de
    // custos, add/remove de linhas). Em jsdom (testes) não há layout
    // (`width === 0`) nem `ResizeObserver` — o sync é um no-op, sem afetar o
    // comportamento observado pelos testes.
    const followers = [exportBar, nameCard, batchCard, sourdoughCard, grid];
    const syncWidths = (): void => {
      const width = ingredientsCard.getBoundingClientRect().width;
      if (width <= 0) return; // sem layout (jsdom) — nada a espelhar
      for (const el of followers) {
        el.style.width = `${width}px`;
        el.style.marginInline = 'auto'; // centraliza junto com o card--fit de Ingredientes
      }
    };
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => syncWidths());
      ro.observe(ingredientsCard);
    } else {
      syncWidths();
    }
  }

  // Autosave (issue 040: `autosaveEnabled: boolean` virou `recipeId: string |
  // null` — subscribe/flush/visibilitychange/beforeunload ficam SEMPRE
  // registrados; `flush` faz early-return enquanto `recipeId === null`
  // (efêmera não-nomeada, junk-prevention). Mesmo debounce ~400ms (§10) +
  // flush imediato em `visibilitychange`/`beforeunload` de sempre.
  const AUTOSAVE_DEBOUNCE_MS = 400; // §10 "debounce em inputs"
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (recipeId === null) return; // efêmera não-nomeada — nada a gravar
    recipeStore.update(store.getState().recipe); // 011 — grava, preserva id/createdAt
  };
  store.subscribe(() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush(); // aba escondida — não esperar o debounce
  });
  window.addEventListener('beforeunload', flush); // fechar/recarregar — última chance de gravar
}

// Composition root real (script da página, `receitas.html`): sem argumentos —
// mesmas instâncias/URL de produção de sempre (comportamento inalterado).
initCalculadora();
