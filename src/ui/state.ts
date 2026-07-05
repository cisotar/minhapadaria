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
 * Extensões aditivas (issue 015, retrocompatíveis — 014 continua chamando
 * `createAppState(seed, prefs)` com 2 args sem mudança de comportamento):
 *  - Terceiro parâmetro opcional `normalize`: hook síncrono chamado sobre o
 *    draft, DEPOIS da mutação do chamador e ANTES de `recalculate` — ponto
 *    único para a herança de custo das farinhas do fermento (§4,
 *    `inheritSourdoughFlourCosts` em sourdoughTable.ts). Sem re-entrância:
 *    roda dentro do próprio `update`, nunca dispara novo `notify`.
 *  - `setShowCosts` agora chama `notify()` depois de persistir a pref (011),
 *    para o sub-bloco do fermento (sourdoughTable.ts) sincronizar sua classe
 *    `.show-costs` via `subscribe` — o toggle é uma preferência global única
 *    (§2.A.2) consumida por mais de uma tabela. O estado (`recipe`/`summary`)
 *    não muda, então notificar sem recalcular é seguro e `patchAllDerived` de
 *    014 é inócuo (reexibe os mesmos valores).
 *
 * Seções implementadas: §1.6 (recálculo em lote centralizado), §2.A.2, §4.
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

export function createAppState(
  initial: Recipe,
  prefs: PrefsStore,
  normalize?: (draft: Recipe) => void,
): AppStateStore {
  let current: AppState = runRecalculate(initial);
  const listeners = new Set<Listener>();

  function notify(): void {
    for (const fn of listeners) fn(current);
  }

  return {
    getState: () => current,
    update(mutator) {
      // Nunca muta o estado publicado: clona (§1.6), aplica a mutação do
      // chamador sobre o clone, roda o normalizador opcional (herança de
      // custo §4) e só então recalcula.
      const draft = structuredClone(current.recipe);
      mutator(draft);
      normalize?.(draft);
      current = runRecalculate(draft);
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    showCosts: () => prefs.getShowCosts(),
    setShowCosts: (value) => {
      prefs.setShowCosts(value);
      notify(); // §2.A.2: pref global — outras tabelas (sourdoughTable) reagem via subscribe
    },
  };
}
