/**
 * historico.ts — Composition root da página Histórico de Fornadas
 * (historico.html), issue 018 (spec §14).
 *
 * O que faz: instancia `createRecipeStore()`/`createBakeStore()` (localStorage
 * real, issues 011/013) sobre `defaultStorage()` (010), preenche o `<h1>`
 * estático do cabeçalho (`#hist-header`, shell de `historico.html`) e chama
 * `renderHistoryView(app, {recipeStore, bakeStore})` — que monta o registro
 * rápido, os filtros, os KPIs, o gráfico de tendência e a listagem
 * cronológica de fornadas (018). Zero fórmula/lógica de negócio aqui: só
 * composição/wiring (regra de ouro 2).
 *
 * Seções implementadas: §14 (todas as subseções, via historyView.ts).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createRecipeStore } from '../../storage/recipes';
import { createBakeStore } from '../../storage/bakes';
import { createPrefsStore } from '../../storage/prefs';
import { defaultStorage } from '../../storage/local';
import { renderHistoryView } from '../historyView';
import { h } from '../dom';

const storage = defaultStorage();
const recipeStore = createRecipeStore({ storage });
const bakeStore = createBakeStore({ storage });
const prefs = createPrefsStore({ storage }); // §2.A.2: XLSX com/sem custos (issue 019)

const header = document.getElementById('hist-header');
if (header) {
  header.appendChild(h('h1', {}, ['📊 Histórico de Fornadas']));
}

const app = document.getElementById('app');
if (app) {
  renderHistoryView(app, { recipeStore, bakeStore, prefs });
}
