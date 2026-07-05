/**
 * state.ts — Estado da tela Calculadora em memória (spec §1.6).
 *
 * O que faz: guarda `{ recipe, summary }` e orquestra clone + `recalculate`
 * (008) + notificação dos assinantes a cada mutação. Zero fórmula — a única
 * lógica própria é "clonar o estado puro, aplicar a mutação do chamador,
 * rodar `recalculate` e notificar" (§1.6: recálculo imediato, sem submit).
 * `showCosts` é lido/escrito via o `PrefsStore` (011) — não duplica
 * persistência (regra de ouro 2).
 *
 * Seções implementadas: §1.6 (recálculo em lote centralizado).
 */
import { recalculate } from '../core/recalc';
import type { Recipe, RecipeSummary } from '../core/types';
import type { PrefsStore } from '../storage/prefs';

export interface AppState {
  recipe: Recipe;
  summary: RecipeSummary;
}

export type Listener = (state: AppState) => void;

export interface AppStateStore {
  getState(): AppState;
  /** Clona o estado atual, aplica `mutator` sobre o clone e recalcula (§1.6). */
  update(mutator: (draft: Recipe) => void): void;
  /** Registra um assinante; devolve a função de cancelamento. */
  subscribe(fn: Listener): () => void;
  showCosts(): boolean;
  setShowCosts(value: boolean): void;
}

function runRecalculate(recipe: Recipe): AppState {
  const { state, summary } = recalculate(recipe); // §1.6 — única fonte de derivados
  return { recipe: state, summary };
}

export function createAppState(initial: Recipe, prefs: PrefsStore): AppStateStore {
  let current: AppState = runRecalculate(initial);
  const listeners = new Set<Listener>();

  function notify(): void {
    for (const fn of listeners) fn(current);
  }

  return {
    getState: () => current,
    update(mutator) {
      // Nunca muta o estado publicado: clona (§1.6), aplica a mutação do
      // chamador sobre o clone e só então recalcula.
      const draft = structuredClone(current.recipe);
      mutator(draft);
      current = runRecalculate(draft);
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    showCosts: () => prefs.getShowCosts(),
    setShowCosts: (value) => prefs.setShowCosts(value),
  };
}
