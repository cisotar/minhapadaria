/**
 * inlineNameEdit.ts — Mecânica genérica de edição inline de nome (issue 036,
 * extraída de `startInlineEdit` em `recipesList.ts` — issue 033, refactor II
 * §134).
 *
 * O que faz: `startInlineNameEdit(opts)` troca um nó de exibição (`<h3>` no
 * card de `recipesList.ts`, `<h1>` no header da Calculadora) por um
 * `<input class="cell-input">` (§4.1 "sinal invertido" — campo editável vira
 * box), com a MESMA disciplina em ambos os usos: flag `settled` (evita que o
 * `blur` reprocesse uma confirmação/cancelamento já feito via Enter/Esc),
 * tríplice guarda (valor vazio ou igual ao nome original → restaura sem
 * gravar), Enter/blur confirmam, Esc cancela, `restore` troca o input de
 * volta pelo nó de exibição via `Element.replaceWith` (MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith).
 *
 * Reuso total (regra de ouro 2): a mecânica é byte-a-byte a mesma entre o
 * card de receitas (issue 033) e o `<h1>` editável da Calculadora (issue
 * 036) — só DOIS pontos variam, exatamente os parâmetros desta função:
 * `makeDisplay(name)` (o nó de exibição a recriar) e `onCommit(newName)` (o
 * caminho de escrita — `recipeStore.rename` direto no card,
 * `store.update(draft => draft.name = ...)` + autosave na Calculadora).
 *
 * Segurança (regra de ouro 3 / spec v5 §11.1): nome do usuário nunca passa
 * por `innerHTML` — `makeDisplay` é responsabilidade do chamador, mas ambos
 * os usos desta função constroem o nó via `h(...)` (dom.ts), que insere texto
 * só via `document.createTextNode` (escapa XSS automaticamente). Só `h`/`on`
 * de `dom.ts` — zero lib nova (regra de ouro 1).
 */
import { h, on } from './dom';

export interface StartInlineNameEditOptions {
  /** Nó atualmente no DOM (h3 do card, h1 do header) a ser substituído pelo input. */
  target: HTMLElement;
  /** Nome atual — valor inicial do input e referência da tríplice guarda. */
  currentName: string;
  /** Recria o nó de exibição com o nome dado (h3/h1) — nunca via `innerHTML`. */
  makeDisplay: (name: string) => HTMLElement;
  /** Chamado só quando o novo nome é válido (não vazio, diferente do atual). */
  onCommit: (newName: string) => void;
  /** Notificado com o novo nó de exibição sempre que o input é substituído de volta (confirmar ou cancelar) — permite ao chamador reatar sua própria referência (ex.: `nameRef.el`). */
  onDisplayChange?: (display: HTMLElement) => void;
  /** Default: 'Novo nome da receita' (mesmo rótulo usado desde a issue 033). */
  ariaLabel?: string;
}

/**
 * Inicia a edição inline: troca `opts.target` por um `<input>` focado com o
 * nome atual selecionado. Enter/blur confirmam (tríplice guarda); Esc
 * cancela restaurando o nome original. Sem `window.prompt`/modal.
 */
export function startInlineNameEdit(opts: StartInlineNameEditOptions): void {
  const { target, currentName, makeDisplay, onCommit, onDisplayChange, ariaLabel } = opts;
  let settled = false; // evita blur pós Enter/Esc reprocessar a confirmação

  const input = h('input', {
    type: 'text',
    className: 'cell-input',
    value: currentName,
    'aria-label': ariaLabel ?? 'Novo nome da receita',
  }) as HTMLInputElement;

  function restore(name: string): void {
    const display = makeDisplay(name); // textContent via `h` — escapa XSS (regra 3)
    input.replaceWith(display);
    onDisplayChange?.(display);
  }

  function confirmEdit(): void {
    if (settled) return;
    settled = true;
    const value = input.value;
    if (value === '' || value === currentName) {
      restore(currentName); // vazio/sem mudança — restaura, sem gravar
      return;
    }
    onCommit(value);
    restore(value);
  }

  function cancelEdit(): void {
    if (settled) return;
    settled = true;
    restore(currentName);
  }

  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') confirmEdit();
    else if (e.key === 'Escape') cancelEdit();
  });
  on(input, 'blur', () => confirmEdit());

  target.replaceWith(input);
  input.focus();
  input.select();
}
