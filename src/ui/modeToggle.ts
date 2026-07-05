/**
 * modeToggle.ts — Toggle global de modo de cálculo %→peso / peso→% (spec
 * §1.3/§1.4/§1.5) · issue 016.
 *
 * O que faz: `renderModeToggle(root, store)` injeta em `root` (o card
 * "Ancoragem e Planejamento da Fornada", via `batchPanel.ts`) o botão
 * "Alternar p/ peso → %" e gerencia, fora de `root`, o banner sticky
 * obrigatório (§1.3: "sinalização visual obrigatória enquanto ativo") —
 * inserido/removido de `document.body` conforme `calculationMode`, mais a
 * classe `document.body.classList.toggle('mode-alt', ...)` que liga o
 * destaque dos campos de % (`.mode-alt .input.pct`/`.mode-alt .cell-input.pct`,
 * design-system.css).
 *
 * Entrar em peso→% é só um flag (`calculationMode`) — os pesos já existem
 * (derivados por `recalculate`, 008), não há nada a preservar; por isso é um
 * `store.update` comum, sem transformação especial. Voltar ao modo padrão é a
 * transição do §1.5 (`transitionToPercentageMode`, recalc.ts — reuso, regra
 * de ouro 2): os pesos editados viram a nova fonte de verdade, sem prompt de
 * confirmação — por isso usa `store.applyTransform` (016/state.ts), a mesma
 * via do escalonamento (scalePanel.ts).
 *
 * Zero lógica de negócio aqui: a única conta é decidir se o modo está ativo
 * (`calculationMode === 'weight-to-percentage'`) para sincronizar botão,
 * classe e banner — `transitionToPercentageMode` faz toda a matemática.
 *
 * Seções implementadas: §1.3, §1.4, §1.5.
 */
import { transitionToPercentageMode } from '../core/recalc';
import { h, on } from './dom';
import type { AppStateStore } from './state';

export function renderModeToggle(root: HTMLElement, store: AppStateStore): void {
  const toggleBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary' },
    ['Alternar p/ peso → %'],
  ) as HTMLButtonElement;
  on(toggleBtn, 'click', () => {
    // Entrar em peso→% é reversível e sem perda (§1.4): flag simples, os
    // pesos já derivados por `recalculate` viram a fonte de verdade a partir
    // daqui — sem transformação especial (essa só existe para VOLTAR, §1.5).
    store.update((draft) => {
      draft.calculationMode = 'weight-to-percentage';
    });
  });
  root.appendChild(toggleBtn);

  // Banner sticky (§1.3) — inserido logo após a navegação global (mesma
  // ordem do mockup `mockups/calculadora.html`), fora de `root`.
  let banner: HTMLElement | null = null;

  function buildBanner(): HTMLElement {
    const b = h('div', { className: 'banner-mode-alt' });
    b.appendChild(
      document.createTextNode(
        '⚠ Modo alternativo ativo (peso → %) — a convenção de porcentagem de padeiro está suspensa.',
      ),
    );
    const backBtn = h(
      'button',
      { type: 'button', className: 'btn btn-secondary push-right' }, // `.push-right` (issue 022) — era style inline
      ['Voltar ao modo padrão'],
    ) as HTMLButtonElement;
    on(backBtn, 'click', () => {
      store.applyTransform(transitionToPercentageMode); // §1.5 — sem prompt, nada descartado
    });
    b.appendChild(backBtn);
    return b;
  }

  function sync(): void {
    const alt = store.getState().recipe.calculationMode === 'weight-to-percentage';
    document.body.classList.toggle('mode-alt', alt); // liga o destaque §1.3 (design-system.css)
    toggleBtn.classList.toggle('hidden', alt); // `.hidden` (issue 022) — a saída é só pelo botão do banner
    if (alt && !banner) {
      banner = buildBanner();
      const nav = document.querySelector('.app-nav');
      if (nav?.parentNode) nav.insertAdjacentElement('afterend', banner);
      else document.body.insertBefore(banner, document.body.firstChild);
    } else if (!alt && banner) {
      banner.remove();
      banner = null;
    }
  }

  sync();
  store.subscribe(sync); // §1.6: reage a qualquer mudança de estado (própria ou de outro painel)
}
