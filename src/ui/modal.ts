/**
 * modal.ts — Primeiro componente de modal do design system (issue 035,
 * exceção explícita do cliente ao registro anterior "sem modal" de
 * `references/architecture.md`, escopo restrito ao fluxo "+ Nova receita").
 *
 * O que faz: `openPromptModal(options)` monta um overlay+caixa de diálogo
 * genérico (nome, "Criar"/"Cancelar") direto em `document.body`, via
 * `h`/`on` (dom.ts) — NUNCA `innerHTML` (regra de ouro 3): o valor digitado
 * pelo usuário só é lido via `input.value` e só chega a `onConfirm` como
 * string, nunca inserido em nó DOM algum além do próprio `<input>`.
 *
 * Contrato de acessibilidade (spec §10): `role="dialog"`/`aria-modal="true"`/
 * `aria-labelledby` na caixa; foco vai para o campo ao abrir e é preso entre
 * os focáveis (input → Cancelar → Criar, cíclico) enquanto o modal está
 * aberto; Esc fecha (equivalente a Cancelar); clique no backdrop (fora da
 * caixa) fecha; foco é restaurado ao elemento que abriu o modal ao fechar
 * (`document.activeElement` no momento da chamada).
 *
 * Validação: `trim()` não-vazio — nome vazio/só espaços mostra
 * `.form-status--error` (reuso total, mesma classe de `recipesList.ts`) e
 * MANTÉM o modal aberto, foco de volta ao campo. `onConfirm(nome)` só é
 * chamado no caminho válido; o próprio modal fecha logo em seguida.
 *
 * Decisão `<dialog>` nativo vs. `div` manual: registrada no Plano Técnico da
 * issue 035 — `jsdom` (versão fixada no projeto) não implementa
 * `HTMLDialogElement.showModal()`, o que tornaria os cenários de Esc/backdrop/
 * foco-preso não-testáveis com o elemento nativo. `div` manual replica o
 * mesmo contrato (role/aria-modal/foco/Esc/backdrop) 100% testável em jsdom,
 * comportamento idêntico em teste e produção — zero dependência nova.
 */
import { h, on } from './dom';

export interface PromptModalOptions {
  /** Título do modal (h2, ligado por `aria-labelledby`). */
  title: string;
  /** Rótulo do campo de texto. */
  label: string;
  /** Texto do botão de confirmação (ex.: "Criar"). */
  confirmLabel: string;
  /** Texto do botão de cancelamento (ex.: "Cancelar"). */
  cancelLabel: string;
  /** Mensagem de erro para nome vazio/só espaços (default pt-BR). */
  emptyError?: string;
  /** Chamado com o nome (já com `trim()` aplicado) só no caminho válido. */
  onConfirm: (value: string) => void;
}

const DEFAULT_EMPTY_ERROR = 'Digite um nome para a receita.';

let modalSeq = 0;

/** Abre um modal genérico de "nome" (overlay+caixa) em `document.body`. */
export function openPromptModal(options: PromptModalOptions): void {
  const { title, label, confirmLabel, cancelLabel, onConfirm } = options;
  const emptyError = options.emptyError ?? DEFAULT_EMPTY_ERROR;

  // Gatilho: elemento com foco no momento da abertura (ex.: o botão "+ Nova
  // receita") — recebe o foco de volta ao fechar (acessibilidade, spec §10).
  const trigger = document.activeElement as HTMLElement | null;

  const seq = ++modalSeq;
  const titleId = `modal-title-${seq}`;
  const inputId = `modal-input-${seq}`;

  // O nome acessível vem do `<label for>` associado (abaixo) — sem `aria-label`
  // redundante, que sobreporia o `<label>` para leitores de tela (WAI-ARIA:
  // evitar nome acessível duplicado). Achado baixo da revisão da issue 035.
  const input = h('input', {
    type: 'text',
    className: 'input',
    id: inputId,
  }) as HTMLInputElement;

  const fieldLabel = h('label', { for: inputId }, [label]);
  const field = h('div', { className: 'field' }, [fieldLabel, input]);

  const status = h('div', { className: 'form-status', role: 'status', 'aria-live': 'polite' });

  const cancelBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary' },
    [cancelLabel],
  ) as HTMLButtonElement;
  const confirmBtn = h(
    'button',
    { type: 'button', className: 'btn btn-primary' },
    [confirmLabel],
  ) as HTMLButtonElement;
  const actions = h('div', { className: 'row row--end' }, [cancelBtn, confirmBtn]);

  const heading = h('h2', { id: titleId }, [title]); // textContent — escapa XSS (regra 3)

  const box = h(
    'div',
    {
      className: 'modal card',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    },
    [heading, field, status, actions],
  );

  const overlay = h('div', { className: 'modal-overlay' }, [box]);

  // Ordem de tabulação = ordem visual (input → Cancelar → Criar) — foco-preso
  // cicla entre os 3 (Plano Técnico issue 035: trivial, sem lib nova).
  const focusables = [input, cancelBtn, confirmBtn];

  function close(): void {
    overlay.remove();
    trigger?.focus?.();
  }

  function showError(message: string): void {
    status.textContent = message;
    status.classList.add('form-status--error');
    input.focus();
  }

  function clearError(): void {
    if (status.textContent === '') return;
    status.textContent = '';
    status.classList.remove('form-status--error');
  }

  function confirm(): void {
    const value = input.value.trim();
    if (value === '') {
      showError(emptyError);
      return;
    }
    close();
    onConfirm(value);
  }

  on(overlay, 'click', (e) => {
    if (e.target === overlay) close(); // só fecha se o clique foi no backdrop, não na caixa
  });

  on(input, 'input', clearError);
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    }
  });

  on(cancelBtn, 'click', close);
  on(confirmBtn, 'click', confirm);

  // Esc fecha (equivalente a Cancelar); Tab/Shift+Tab prendem o foco dentro
  // do modal (cicla entre os focáveis, só nas bordas — o resto do
  // percurso é o comportamento padrão do navegador).
  on(box, 'keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.body.appendChild(overlay);
  input.focus();
}
