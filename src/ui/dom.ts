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
 * `svg` (issue 018, §14.5) estende o mesmo contrato seguro para o namespace
 * SVG (gráfico de tendência): elementos SVG exigem `document.createElementNS`
 * (não `createElement`) — sem isso o nó nasce como `HTMLUnknownElement` e não
 * renderiza. Atributos via `setAttribute` (idêntico a `h`); texto de filho via
 * `createTextNode` (mesma blindagem XSS, regra de ouro 3).
 *
 * Docs oficiais consultadas (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
 * - https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
 * - https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS
 * - https://developer.mozilla.org/en-US/docs/Web/SVG/Namespace
 */

/** Namespace XML do SVG (constante da spec SVG, não um token de design). */
const SVG_NS = 'http://www.w3.org/2000/svg';

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

/**
 * Cria um elemento SVG tipado (namespace SVG, `createElementNS` — regra de
 * ouro 4/MDN) com o mesmo contrato seguro de `h`: atributos via `setAttribute`,
 * filhos (nós ou strings) sempre via `createTextNode`. Usado só pelo gerador
 * do gráfico de tendência (`trendChart.ts`, §14.5) — zero `innerHTML`.
 */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  const { className, ...rest } = attrs;
  if (className) el.setAttribute('class', String(className));
  for (const [key, v] of Object.entries(rest)) {
    if (v === undefined || v === null || v === false) continue;
    if (v === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(v));
  }
  for (const child of children) {
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
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
