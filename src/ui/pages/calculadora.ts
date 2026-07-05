/**
 * calculadora.ts — Composition root da página Calculadora (index.html), issues 014/015.
 *
 * O que faz: instancia `createPrefsStore` (011), o estado inicial via
 * `goldenSeed` (§12) + `createAppState` (§1.6) — agora com o `normalize`
 * opcional (issue 015) amarrando `inheritSourdoughFlourCosts` (herança de
 * custo §4, seam via `editedCostIds`) — e monta, na ordem do mockup, o card
 * Ingredientes (`renderIngredientsTable`, 014), a sub-receita do Fermento
 * (`renderSourdoughTable`, §2.B, 015) e o painel de Hidratação
 * (`renderHydrationPanel`, §2.C/§2.D, 015) no `<div id="app">` do shell
 * estático de `index.html` (nav/header já são HTML puro). Zero fórmula aqui:
 * só composição/wiring (regra de ouro 2). Precificação/Ancoragem/Escala
 * ficam para a issue 016 (fora do escopo aqui).
 *
 * Seções implementadas: §1–2 (composição da tela), §2.B, §2.C, §2.D, §4,
 * §9–10 (app 100% client-side).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createPrefsStore } from '../../storage/prefs';
import { createAppState } from '../state';
import { goldenSeed } from '../seed';
import { renderIngredientsTable } from '../ingredientsTable';
import { renderSourdoughTable, inheritSourdoughFlourCosts } from '../sourdoughTable';
import { renderHydrationPanel } from '../hydrationPanel';

const prefs = createPrefsStore();
// §4: farinhas do fermento editadas manualmente (Preço Pago/Peso do Produto)
// param de herdar do ingrediente principal vinculado por flourId — seam vivo
// na UI (types.ts congelado, sem flag `manuallyEdited`), amarrado ao hook
// `normalize` de `state.ts` (chamado a cada `update`, antes de `recalculate`).
const editedCostIds = new Set<string>();
const store = createAppState(goldenSeed(), prefs, (draft) => inheritSourdoughFlourCosts(draft, editedCostIds));

const app = document.getElementById('app');
if (app) {
  renderIngredientsTable(app, store);
  renderSourdoughTable(app, store, editedCostIds);
  renderHydrationPanel(app, store);
}
