/**
 * calculadora.ts — Composition root da página Calculadora (index.html), issues 014/015/016/017.
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
 * do shell estático de `index.html` (nav/header já são HTML puro). Zero
 * fórmula aqui: só composição/wiring (regra de ouro 2).
 *
 * Integração `?recipe=<id>` (issue 017, §2.F): `new
 * URLSearchParams(location.search).get('recipe')` — se presente e
 * `recipeStore.get(id)` existir, essa `Recipe` (storage real, 011) vira a
 * semente inicial (no lugar de `goldenSeed()`) e liga o auto-save; se o id
 * não existir, cai em `goldenSeed()` + chip de aviso discreto ("Receita não
 * encontrada; abrindo modelo padrão."). Sem `?recipe` (acesso direto a
 * `index.html`) o comportamento é o de sempre: golden seed efêmero, SEM
 * auto-save (preserva o comportamento anterior às issues 014–016).
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
import { renderPrintView, mountPrintButton } from '../../export/print';

/** Dependências injetáveis (issue 025) — default = instâncias reais de produção. */
export interface InitCalculadoraDeps {
  prefs?: PrefsStore;
  recipeStore?: RecipeStore;
  /** Default `defaultStorage()` — só usado quando `recipeStore` não é informado. */
  storage?: StorageLike;
  /** Default `location.search` — permite jsdom simular `?recipe=<id>` sem tocar na URL global. */
  search?: string;
}

/**
 * Composition root da Calculadora (§2.F): monta o estado inicial (golden seed
 * ou receita salva via `?recipe=<id>`), o auto-save e todos os cards da tela
 * dentro de `#app` (shell estático de `index.html`). Chamada sem argumentos
 * pelo rodapé deste módulo — o comportamento de produção não muda com a
 * extração (regra de ouro 2/arquitetura: zero lógica nova, só testabilidade).
 */
export function initCalculadora(deps: InitCalculadoraDeps = {}): void {
  const prefs = deps.prefs ?? createPrefsStore();
  const storage = deps.storage ?? defaultStorage();
  const recipeStore = deps.recipeStore ?? createRecipeStore({ storage });
  const search = deps.search ?? location.search;

  // §2.F: `?recipe=<id>` carrega uma receita salva; ausente/inexistente → golden seed.
  const requestedId = new URLSearchParams(search).get('recipe');
  let initialRecipe = goldenSeed();
  let recipeNotFound = false;
  let autosaveEnabled = false;
  if (requestedId) {
    const found = recipeStore.get(requestedId);
    if (found) {
      initialRecipe = found;
      autosaveEnabled = true; // só grava quando a tela foi aberta por uma receita real
    } else {
      recipeNotFound = true;
    }
  }

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
    // barra fixa no topo — Exportar XLSX + Imprimir/Salvar em PDF. Consome o
    // estado JÁ recalculado (store.getState()), sem recalcular (§1.6);
    // `includeCosts` segue a pref global "Exibir custos" (§2.A.2). O #print-root
    // fica no <body> (único bloco visível em @media print, design-system.css).
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
    mountPrintButton(exportBar, () => {
      // §8: renderiza o relatório atual e imprime — SÓ no clique, nunca no init.
      clear(printRoot);
      const { recipe, summary } = store.getState();
      renderPrintView(printRoot, { recipe, summary, includeCosts: prefs.getShowCosts() });
      window.print();
    });
    app.appendChild(exportBar);

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
    const followers = [exportBar, batchCard, sourdoughCard, grid];
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

  if (autosaveEnabled) {
    const AUTOSAVE_DEBOUNCE_MS = 400; // §10 "debounce em inputs"
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
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
}

// Composition root real (script da página, `index.html`): sem argumentos —
// mesmas instâncias/URL de produção de sempre (comportamento inalterado).
initCalculadora();
