/**
 * scalePanel.ts — Escalonamento por peso alvo (spec §3.D/§1.6) · issue 016.
 *
 * O que faz: `renderScalePanel(root, store)` injeta em `root` (o card
 * "Ancoragem e Planejamento da Fornada", via `batchPanel.ts`) o campo
 * "Escalonar para peso alvo" + o botão "Re-escalar" — a ÚNICA ação
 * não-imediata do app (§1.6): diferente de todo outro campo da receita, o
 * escalonamento só roda no clique explícito do botão, nunca a cada tecla.
 *
 * Zero fórmula aqui: `applyTargetScaling` (scaling.ts) já devolve a Recipe
 * nova com a âncora recalculada, ou `null` quando indisponível (modo peso→%)
 * ou o alvo/soma da receita são inválidos (§5.C) — nesse caso
 * `store.applyTransform` (016/state.ts) não muta nem notifica, então "alvo
 * inválido" e "modo errado" simplesmente não fazem nada, sem precisar
 * duplicar a validação aqui. O botão também fica desabilitado em peso→%
 * (§3.D "modo %→peso apenas") como reforço visual — não é a única guarda.
 *
 * Seções implementadas: §1.6, §3.D.
 */
import { parseDecimal } from '../core/format';
import { applyTargetScaling } from '../core/scaling';
import { h, on } from './dom';
import type { AppStateStore } from './state';

export function renderScalePanel(root: HTMLElement, store: AppStateStore): void {
  const field = h('div', { className: 'field' });
  field.appendChild(h('label', {}, ['Escalonar para peso alvo']));

  const row = h('div', { className: 'row row--end' });
  const targetInput = h('input', {
    className: 'input num',
    placeholder: 'ex: 2000',
    'aria-label': 'Peso alvo para escalonamento',
  }) as HTMLInputElement;
  const applyBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary' },
    ['Re-escalar'], // única ação com botão do app, §1.6
  ) as HTMLButtonElement;
  row.appendChild(targetInput);
  row.appendChild(applyBtn);
  field.appendChild(row);
  root.appendChild(field);

  on(applyBtn, 'click', () => {
    const target = parseDecimal(targetInput.value);
    if (target === null) return; // texto não numérico — nada a aplicar (§7.1)
    // §3.D: alvo/soma inválidos ou modo peso→% → applyTargetScaling devolve
    // null → applyTransform não muta nem notifica (016/state.ts).
    store.applyTransform((recipe) => applyTargetScaling(recipe, target));
  });

  function sync(): void {
    const alt = store.getState().recipe.calculationMode === 'weight-to-percentage';
    applyBtn.disabled = alt; // §3.D: escalonamento só em %→peso
    targetInput.disabled = alt;
  }

  sync();
  store.subscribe(sync);
}
