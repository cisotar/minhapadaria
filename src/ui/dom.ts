/**
 * dom.ts — Helpers DOM seguros (spec §10/§11.1, regra de ouro 3).
 *
 * O que faz: único ponto que toca o DOM cru nesta tela. `h` cria elementos via
 * `document.createElement`/`setAttribute`/`textContent`/`appendChild` — NUNCA
 * `innerHTML` com string do usuário (nome de ingrediente, observações etc.).
 * Texto de filho é sempre inserido via `document.createTextNode` (escapa
 * automaticamente `<script>` e afins). `clear` esvazia um nó com
 * `removeChild` (nunca `innerHTML = ''`); `on` é um wrapper fino e tipado de
 * `addEventListener`.
 *
 * Regras da spec respeitadas: §10 (zero rede), §11.1 (zero secret) — todo dado
 * digitado pelo usuário passa por este módulo antes de virar nó DOM, sempre
 * via API segura (regra de ouro 3).
 *
 * Docs oficiais consultadas (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
 * - https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
 */

export type Attrs = Record<string, string | number | boolean | undefined | null> & {
  className?: string;
};

/**
 * Cria um elemento tipado, aplica atributos via `setAttribute` (nunca
 * `innerHTML`) e anexa filhos (nós ou strings, sempre via `createTextNode`).
 * `value`/`checked` são aplicados como PROPRIEDADE (não atributo) após montar
 * os filhos — necessário para `<select>` (a opção correspondente precisa
 * existir antes de `el.value = ...` funcionar) e mais confiável para
 * checkboxes.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { className, value, checked, ...rest } = attrs as Attrs & {
    value?: string | number;
    checked?: boolean;
  };
  if (className) el.className = String(className);
  for (const [key, v] of Object.entries(rest)) {
    if (v === undefined || v === null || v === false) continue;
    if (v === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(v));
  }
  for (const child of children) {
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  if (value !== undefined) {
    (el as unknown as { value?: string }).value = String(value);
  }
  if (checked !== undefined) {
    (el as unknown as { checked?: boolean }).checked = Boolean(checked);
  }
  return el;
}

/** Esvazia um nó via `removeChild` — nunca `innerHTML = ''` (regra de ouro 3). */
export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Wrapper fino e tipado de `addEventListener` — único ponto de wiring de eventos. */
export function on<K extends keyof HTMLElementEventMap>(
  node: EventTarget,
  evt: K,
  fn: (e: HTMLElementEventMap[K]) => void,
): void {
  node.addEventListener(evt, fn as EventListener);
}
