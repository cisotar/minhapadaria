// @vitest-environment jsdom
/**
 * inlineNameEdit.test.ts — unit test da mecânica genérica extraída (issue
 * 036, item recomendado do Plano Técnico): guarda/Enter/blur/Esc/XSS,
 * desacoplado de qualquer store — `makeDisplay`/`onCommit` são espiões.
 * Reforça o TDD da extração; os ACs de UI (Calculadora) ficam em
 * `calculadora.test.ts`; a regressão do card fica em `recipesList.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { h } from './dom';
import { startInlineNameEdit } from './inlineNameEdit';

function makeH3(name: string): HTMLHeadingElement {
  return h('h3', {}, [name]) as HTMLHeadingElement;
}

function mount(name: string): { root: HTMLElement; display: HTMLHeadingElement } {
  const root = document.createElement('div');
  const display = makeH3(name);
  root.appendChild(display);
  document.body.appendChild(root);
  return { root, display };
}

describe('startInlineNameEdit (issue 036 — extraída de recipesList.ts, issue 033)', () => {
  it('1. inicia: h3 some, input.cell-input com valor atual e foco', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });

    expect(root.querySelector('h3')).toBeNull();
    const input = root.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Pão Rústico');
    expect(document.activeElement).toBe(input);
  });

  it('2. Enter com nome novo válido → onCommit chamado, display volta com novo nome', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Pão Novo';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith('Pão Novo');
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelector('h3')!.textContent).toBe('Pão Novo');
  });

  it('3. blur com nome novo válido → mesmo resultado do Enter', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Pão Blur';
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledWith('Pão Blur');
    expect(root.querySelector('h3')!.textContent).toBe('Pão Blur');
  });

  it('4. Esc → onCommit NÃO chamado, display restaurado com nome original', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Xyz';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelector('h3')!.textContent).toBe('Pão Rústico');
  });

  it('5. confirmar com nome vazio → onCommit NÃO chamado, display restaurado', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(root.querySelector('h3')!.textContent).toBe('Pão Rústico');
  });

  it('6. confirmar com valor === nome atual → onCommit NÃO chamado', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Pão Rústico';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(root.querySelector('h3')!.textContent).toBe('Pão Rústico');
  });

  it('7. Enter seguido de blur não reprocessa (flag settled)', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'Pão Novo';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // blur pós-Enter não deveria reprocessar (input já foi substituído no DOM,
    // mas o listener ainda existe no nó desanexado — settled barra qualquer efeito).
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('8. XSS: nome <img src=x onerror> → sem nó <img>, textContent literal', () => {
    const { root, display } = mount('Pão Rústico');
    const onCommit = vi.fn();
    const evil = '<img src=x onerror="x">';

    startInlineNameEdit({ target: display, currentName: 'Pão Rústico', makeDisplay: makeH3, onCommit });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = evil;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('h3')!.textContent).toBe(evil);
  });

  it('9. onDisplayChange é notificado com o novo nó de exibição', () => {
    const { display } = mount('Pão Rústico');
    const onCommit = vi.fn();
    const onDisplayChange = vi.fn();

    startInlineNameEdit({
      target: display,
      currentName: 'Pão Rústico',
      makeDisplay: makeH3,
      onCommit,
      onDisplayChange,
    });
    const input = document.querySelector('input') as HTMLInputElement;
    input.value = 'Pão Novo';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onDisplayChange).toHaveBeenCalledTimes(1);
    expect((onDisplayChange.mock.calls[0][0] as HTMLElement).textContent).toBe('Pão Novo');
  });
});
