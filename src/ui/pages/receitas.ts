/**
 * receitas.ts — Composition root da página Minhas Receitas (receitas.html),
 * issue 017 (spec §2.F).
 *
 * O que faz: instancia `createRecipeStore()` (localStorage real, 011) +
 * `defaultStorage()` (mesmo backend, 010), preenche o `<h1>` estático do
 * cabeçalho (`#rc-header`, shell de `receitas.html`) e chama
 * `renderRecipesList(app, {recipeStore, storage})` — que monta a barra de
 * ações (busca/criar/backup), o subtítulo dinâmico e o grid/estado vazio
 * (017). Zero fórmula/lógica de negócio aqui: só composição/wiring (regra de
 * ouro 2).
 *
 * Seções implementadas: §2.F, §10 (backup local), §14.7 (fornadas órfãs).
 */
// Fonte única de tokens (architecture.md §Estilo). Nunca duplicar/editar tokens.
import '../../../references/design-system.css';
import { createRecipeStore } from '../../storage/recipes';
import { defaultStorage } from '../../storage/local';
import { renderRecipesList } from '../recipesList';
import { h } from '../dom';

const storage = defaultStorage();
const recipeStore = createRecipeStore({ storage });

const header = document.getElementById('rc-header');
if (header) {
  header.appendChild(h('h1', {}, ['📖 Minhas Receitas']));
}

const app = document.getElementById('app');
if (app) {
  renderRecipesList(app, { recipeStore, storage });
}
