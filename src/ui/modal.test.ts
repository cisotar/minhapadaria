// @vitest-environment jsdom
/**
 * modal.test.ts — TDD de `openPromptModal` (issue 035, casos 3–11 do Plano
 * Técnico). Componente genérico, zero lógica de receita (fica em
 * `recipesList.ts`, testado à parte em `recipesList.test.ts`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openPromptModal, type PromptModalOptions } from './modal';

// Cada teste que abre o modal deixa um `.modal-overlay` órfão em
// `document.body` se não fechar — limpeza defensiva entre testes (o jsdom
// deste projeto reusa 1 `document` por arquivo de teste, não por `it`).
afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
});

function open(overrides: Partial<PromptModalOptions> = {}) {
  const trigger = document.createElement('button');
  trigger.textContent = 'gatilho';
  document.body.appendChild(trigger);
  trigger.focus();

  const onConfirm = overrides.onConfirm ?? vi.fn();
  openPromptModal({
    title: 'Nova receita',
    label: 'Nome da receita',
    confirmLabel: 'Criar',
    cancelLabel: 'Cancelar',
    ...overrides,
    onConfirm,
  });
  return { trigger, onConfirm };
}

function dialog(): HTMLElement {
  return document.querySelector('[role="dialog"]') as HTMLElement;
}
function overlay(): HTMLElement {
  return document.querySelector('.modal-overlay') as HTMLElement;
}
function input(): HTMLInputElement {
  return dialog().querySelector('input') as HTMLInputElement;
}
function findBtn(text: string): HTMLButtonElement {
  return Array.from(dialog().querySelectorAll('button')).find((b) => b.textContent === text) as HTMLButtonElement;
}

describe('openPromptModal (issue 035)', () => {
  it('3. abrir: document.body tem [role="dialog"][aria-modal="true"]; input com foco', () => {
    open();
    const d = dialog();
    expect(d).not.toBeNull();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.hasAttribute('aria-labelledby')).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it('3b. nome acessível do input vem do <label for> (sem aria-label redundante) — issue 039', () => {
    open();
    const inp = input();
    expect(inp.hasAttribute('aria-label')).toBe(false);
    const lbl = dialog().querySelector('label') as HTMLLabelElement;
    expect(lbl.getAttribute('for')).toBe(inp.id);
    expect(lbl.textContent).toBe('Nome da receita');
  });

  it('4. "Criar" com nome válido → onConfirm chamado 1× com o nome; modal removido do DOM', () => {
    const { onConfirm } = open();
    input().value = 'Pão de Forma';
    findBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Pão de Forma');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('5. "Criar"/Enter com \'\' → onConfirm NÃO chamado; modal presente; .form-status--error com texto; foco no input', () => {
    const { onConfirm } = open();
    input().value = '';
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    const error = dialog().querySelector('.form-status--error');
    expect(error).not.toBeNull();
    expect(error!.textContent).not.toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('6. \'   \' (só espaços, trim) → mesmo resultado do vazio', () => {
    const { onConfirm } = open();
    input().value = '   ';
    findBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    expect(dialog().querySelector('.form-status--error')).not.toBeNull();
  });

  it('7. Esc → onConfirm NÃO chamado; modal removido; foco restaurado ao gatilho', () => {
    const { trigger, onConfirm } = open();
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('8. clique no .modal-overlay (backdrop) fecha sem onConfirm; clique dentro do .modal NÃO fecha', () => {
    const { onConfirm } = open();

    // Clique dentro da caixa (alvo === box, não overlay) não fecha.
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // Clique no backdrop (alvo === overlay) fecha.
    overlay().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('9. "Cancelar" fecha sem onConfirm', () => {
    const { onConfirm } = open();
    findBtn('Cancelar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('10. tab-trap: Shift+Tab no primeiro focável → foco no último; Tab no último → primeiro', () => {
    open();
    input().focus();
    dialog().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(findBtn('Criar'));

    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input());
  });

  it('11. XSS: onConfirm recebe <img ...> literal; document.querySelector(".modal img") é null', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { onConfirm } = open();
    input().value = evil;
    expect(document.querySelector('.modal img')).toBeNull(); // nunca vira nó, mesmo com o modal aberto

    findBtn('Criar').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onConfirm).toHaveBeenCalledWith(evil);
    expect(document.querySelector('.modal img')).toBeNull();
  });
});
