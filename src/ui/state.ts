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
 * Extensão aditiva (issue 016, retrocompatível): `applyTransform(transform)`
 * serve as duas transformações que devolvem uma `Recipe` NOVA (ou `null`) em
 * vez de mutar um draft in-place — a transição de volta ao modo padrão (§1.5,
 * `transitionToPercentageMode`, recalc.ts) e o escalonamento por peso alvo
 * (§3.D/§1.6, `applyTargetScaling`, scaling.ts), a ÚNICA ação não-imediata do
 * app. Clona `current.recipe`, roda `transform` sobre o clone; `null` (alvo/
 * modo inválido) não muta nem notifica (devolve `false`); caso contrário roda
 * o mesmo `normalize` opcional + `recalculate` de `update` (regra de ouro 2 —
 * não duplica o pipeline) e notifica (devolve `true`).
 *
 * Seções implementadas: §1.5, §1.6 (recálculo em lote centralizado), §2.A.2,
 * §3.D, §4.
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
  /**
   * Clona o estado atual e roda `transform` sobre o clone (§1.5/§3.D):
   * `null` (transição/escalonamento indisponível ou inválido) não muta nem
   * notifica — devolve `false`; uma `Recipe` nova recalcula e notifica —
   * devolve `true`.
   */
  applyTransform(transform: (draft: Recipe) => Recipe | null): boolean;
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
    applyTransform(transform) {
      // §1.5/§3.D: mesma disciplina de `update` (clona, nunca muta o estado
      // publicado), mas a transformação devolve a Recipe nova (ou `null`) em
      // vez de mutar um draft — `transitionToPercentageMode`/
      // `applyTargetScaling` já clonam internamente; clonar aqui garante que
      // um `transform` mal comportado nunca veja o estado publicado.
      const draft = structuredClone(current.recipe);
      const next = transform(draft);
      if (next === null) return false; // §5.C: alvo/modo inválido — nada a aplicar
      normalize?.(next); // mesmo hook de `update` (regra de ouro 2 — não duplica o pipeline)
      current = runRecalculate(next);
      notify();
      return true;
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
