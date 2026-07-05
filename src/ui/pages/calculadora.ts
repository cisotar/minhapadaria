/**
 * calculadora.ts — Composition root da página Calculadora (index.html), issues 014/015/016.
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
 * Seções implementadas: §1–2 (composição da tela), §1.3, §1.5, §2.B, §2.C,
 * §2.D, §2.E, §3.D, §3.E, §4, §9–10 (app 100% client-side).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createPrefsStore } from '../../storage/prefs';
import { createAppState } from '../state';
import { goldenSeed } from '../seed';
import { renderBatchPanel } from '../batchPanel';
import { renderIngredientsTable } from '../ingredientsTable';
import { renderSourdoughTable, inheritSourdoughFlourCosts } from '../sourdoughTable';
import { renderHydrationPanel } from '../hydrationPanel';
import { renderPricingPanel } from '../pricingPanel';
import { h } from '../dom';

const prefs = createPrefsStore();
// §4: farinhas do fermento editadas manualmente (Preço Pago/Peso do Produto)
// param de herdar do ingrediente principal vinculado por flourId — seam vivo
// na UI (types.ts congelado, sem flag `manuallyEdited`), amarrado ao hook
// `normalize` de `state.ts` (chamado a cada `update`/`applyTransform`, antes
// de `recalculate` — 016 estende `applyTransform` para o mesmo hook, sem
// duplicar o pipeline, regra de ouro 2).
const editedCostIds = new Set<string>();
const store = createAppState(goldenSeed(), prefs, (draft) => inheritSourdoughFlourCosts(draft, editedCostIds));

const app = document.getElementById('app');
if (app) {
  renderBatchPanel(app, store); // §2.E/§2.E.1 — hospeda modeToggle (§1.3/§1.5) e scalePanel (§3.D)
  renderIngredientsTable(app, store);
  renderSourdoughTable(app, store, editedCostIds);

  const grid = h('div', { className: 'grid-2' });
  app.appendChild(grid);
  renderHydrationPanel(grid, store); // §2.C/§2.D
  renderPricingPanel(grid, store); // §3.E/§4
}
