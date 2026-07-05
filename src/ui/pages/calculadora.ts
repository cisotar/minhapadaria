/**
 * calculadora.ts — Composition root da página Calculadora (index.html), issue 014.
 *
 * O que faz: instancia `createPrefsStore` (011), o estado inicial via
 * `goldenSeed` (§12) + `createAppState` (§1.6), e monta o card Ingredientes
 * (`renderIngredientsTable`) no `<div id="app">` do shell estático de
 * `index.html` (nav/header já são HTML puro — issue 014 monta só o
 * conteúdo dinâmico). Zero fórmula aqui: só composição/wiring (regra de
 * ouro 2). Painéis de Hidratação/Farinha Real/Precificação/Ancoragem e a
 * sub-receita do Fermento ficam para a issue 016 (fora do escopo aqui).
 *
 * Seções implementadas: §1–2 (composição da tela), §9–10 (app 100% client-side).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createPrefsStore } from '../../storage/prefs';
import { createAppState } from '../state';
import { goldenSeed } from '../seed';
import { renderIngredientsTable } from '../ingredientsTable';

const prefs = createPrefsStore();
const store = createAppState(goldenSeed(), prefs);

const app = document.getElementById('app');
if (app) {
  renderIngredientsTable(app, store);
}
