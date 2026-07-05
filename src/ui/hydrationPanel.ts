/**
 * hydrationPanel.ts — Painel de Hidratação + Farinha Real Consumida (issue 015).
 *
 * O que faz: `renderHydrationPanel(root, store)` monta o card "Hidratação"
 * (§2.C) com `.metric-pair` (mesma classe do design system usada pelo resumo
 * do fermento) mostrando Nominal · Real lado a lado, mais o indicador de
 * Farinha Real Consumida (§2.D), visível apenas quando há fermento
 * configurado (W_ferm > 0). Zero fórmula aqui: `summary.hydration.nominal`/
 * `.real` e `summary.realFlourConsumed` já vêm prontos de `recalculate`
 * (008/`recalc.ts` linhas 118–120,177–179) — a UI só formata para exibição
 * (`formatPercent`/`formatWeight`, 002) e decide "—" quando o core devolve
 * `null` (§5.C: denominador impossível, nunca 0/NaN).
 *
 * Recálculo imediato (§1.6): `store.subscribe` repinta os três valores a cada
 * `update`, sem recriar nenhum nó (não há input aqui — tudo é somente-leitura).
 *
 * Seções implementadas: §2.C, §2.D, §5.C, §9.
 */
import { formatPercent, formatWeight } from '../core/format';
import { h } from './dom';
import type { AppStateStore } from './state';

export function renderHydrationPanel(root: HTMLElement, store: AppStateStore): void {
  const card = h('section', { className: 'card' });
  card.appendChild(h('h2', {}, ['Hidratação']));

  const nominalValue = h('div', { className: 'value' });
  const realValue = h('div', { className: 'value' });
  const flourValue = h('div', { className: 'value' });

  const flourMetric = h('div', { className: 'metric' }, [
    h('div', { className: 'label' }, ['Farinha Real Consumida']),
    flourValue,
  ]);

  const pair = h('div', { className: 'metric-pair' }, [
    h('div', { className: 'metric' }, [h('div', { className: 'label' }, ['Nominal']), nominalValue]),
    h('div', { className: 'metric' }, [h('div', { className: 'label' }, ['Real']), realValue]),
    flourMetric,
  ]);
  card.appendChild(pair);
  root.appendChild(card);

  /** Repinta os 3 valores somente-leitura a partir de `store.getState()` (§1.6). */
  function repaint(): void {
    const { recipe, summary } = store.getState();
    // §5.C: null = denominador impossível (F_total=0 etc.) → "—", nunca 0/NaN.
    nominalValue.textContent =
      summary.hydration.nominal !== null ? `${formatPercent(summary.hydration.nominal)}%` : '—';
    realValue.textContent = summary.hydration.real !== null ? `${formatPercent(summary.hydration.real)}%` : '—';
    flourValue.textContent = `${formatWeight(summary.realFlourConsumed)} g`;

    // §2.D: "sempre visível quando há fermento configurado" — W_ferm > 0.
    const hasSourdough = (recipe.sourdough.totalWeight ?? 0) > 0;
    flourMetric.style.display = hasSourdough ? '' : 'none';
  }

  repaint();
  store.subscribe(repaint); // §1.6: recálculo imediato, sem recriar nós
}
