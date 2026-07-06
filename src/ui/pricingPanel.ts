/**
 * pricingPanel.ts — Painel de Precificação (spec §3.E/§4) · issue 016.
 *
 * O que faz: `renderPricingPanel(root, store)` monta o card "Precificação"
 * (mockup `mockups/calculadora.html`) com o chip de status ("Lucro …%",
 * `marginStatus`/`isLoss`, pricing.ts — reuso, regra de ouro 2) e um bloco
 * `.stack` (empilhado verticalmente, issue 042) com 4 campos, nesta ordem:
 * Custo unitário (1º, somente leitura, derivado de `summary.costPerUnit`) →
 * Lucro unitário → % de lucro → Preço de venda (trio sincronizado, §3.E:
 * editar um grava `pricing.priceInputMode` + o valor cru via `store.update`;
 * `recalculate`, 008, já reconstrói os outros dois). Os totais de produção
 * (Receita total, Lucro total) seguem numa tabela — a linha "Custo unitário"
 * saiu de lá (issue 042: não exibir o mesmo dado duas vezes, agora é o 1º
 * item do `.stack`).
 *
 * Sincronização do trio (§1.6, "recalcula imediatamente"): o campo em edição
 * NUNCA é sobrescrito por `store.subscribe` — `activeField` (análogo ao
 * `lastPricingEdit` do mockup) marca qual dos três está sendo digitado; os
 * outros dois são repintados a cada notificação. `blur` formata o próprio
 * campo (§9) e limpa `activeField`, liberando-o para repintura normal.
 * Validação (010, reuso): "% de lucro" bloqueia negativo (`validateMargin` —
 * markup sem teto desde a issue 041, só piso 0 — o core clampa internamente,
 * mas o bloqueio no blur também sinaliza `aria-invalid`, §5.C); Preço só
 * AVISA se não cobrir o custo unitário (`validatePriceVsUnitCost`, aviso não
 * bloqueante). O identificador interno `mode='margin'`/`profitMargin`
 * (`pricing.ts`) é mantido por compat de dados — só o rótulo visível mudou
 * (issue 042, decisão registrada no plano técnico).
 *
 * Indicadores (§4): margem colorida via `marginStatus` (verde >30%, amarelo
 * 15–30%, vermelho <15% ou negativa) mapeada para `.chip-ok/.chip-warn/
 * .chip-crit` (design-system.css); prejuízo (`isLoss`, preço ≤ custo) vira
 * chip "Prejuízo R$…" + classe `.loss` nos valores afetados — nenhum hex
 * novo, só os tokens de estado já existentes.
 *
 * Zero lógica de negócio nova: todo número vem de `summary`/`recipe.pricing`
 * (`recalculate`, 008); a única conta local é o rótulo pt-BR de Quantidade
 * ("N un.") na linha de Receita Total, texto puro sem fórmula. Custo unitário
 * é pintado via `setDerivedDisplay` (cellHelpers.ts, regra de ouro 2), mesmo
 * padrão de `ingredientsTable.ts`/`batchPanel.ts`.
 *
 * Seções implementadas: §1.6, §3.E, §4, §5.C, §9.
 */
import { parseDecimal, formatPercent, formatCurrency } from '../core/format';
import { marginStatus, isLoss } from '../core/pricing';
import { validateMargin, validatePriceVsUnitCost, type ValidationResult } from '../core/validation';
import { h, on } from './dom';
import type { AppStateStore } from './state';
import { moneyPlain, applyValidation, marginChipClass, setDerivedDisplay } from './cellHelpers';

type ActiveField = 'price' | 'margin' | 'profit' | null;

/** Quantidade (número livre, §9 não define casas fixas) — só troca separador (§7.1). */
function quantityPlain(n: number): string {
  return String(n).replace('.', ',');
}

export function renderPricingPanel(root: HTMLElement, store: AppStateStore): void {
  const card = h('section', { className: 'card' });
  card.appendChild(h('h2', {}, ['Precificação']));
  root.appendChild(card);

  // Chip de status (§4).
  const chipRow = h('div', { className: 'row mb-3' }); // `.mb-3` (design-system.css, issue 022) — era style inline
  const chip = h('span', { className: 'chip' });
  chipRow.appendChild(chip);
  card.appendChild(chipRow);

  // Bloco empilhado (§3.E, issue 042): Custo unitário (read-only) → Lucro
  // unitário → % de lucro → Preço de venda, um abaixo do outro (`.stack`).
  const stack = h('div', { className: 'stack' });
  card.appendChild(stack);

  let activeField: ActiveField = null;

  function buildTrioField(
    label: string,
    ariaLabel: string,
    mode: 'sale-price' | 'margin' | 'profit',
    fieldKey: ActiveField,
    validate: ((parsed: number) => ValidationResult) | null,
  ): { field: HTMLElement; input: HTMLInputElement; sync: (text: string) => void } {
    const field = h('div', { className: 'field field--inline' }); // issue 042 revisão: rótulo + valor na mesma linha
    field.appendChild(h('label', {}, [label]));
    const input = h('input', { className: 'input num', 'aria-label': ariaLabel }) as HTMLInputElement;
    // Último valor confirmado (§7.1) — atualizado só por `sync` (nunca durante
    // a própria edição), para o blur poder reverter a um valor conhecido bom.
    let lastValid = '';
    /** Só toca o campo quando ele NÃO é o que está sendo digitado agora (§1.6). */
    function sync(text: string): void {
      if (activeField === fieldKey) return;
      input.value = text;
      lastValid = text;
    }
    on(input, 'input', () => {
      activeField = fieldKey;
      const parsed = parseDecimal(input.value);
      if (parsed === null) return;
      store.update((draft) => {
        draft.pricing.priceInputMode = mode;
        if (mode === 'sale-price') draft.pricing.salePrice = parsed;
        else if (mode === 'margin') draft.pricing.profitMargin = parsed;
        else draft.pricing.profitPerUnit = parsed;
      });
    });
    on(input, 'blur', () => {
      const parsed = parseDecimal(input.value);
      if (parsed === null) {
        input.value = lastValid;
        activeField = null;
        return;
      }
      const issue = validate?.(parsed) ?? null;
      applyValidation(input, issue, () => {
        input.value = lastValid;
        const reverted = parseDecimal(lastValid.replace(',', '.'));
        if (reverted !== null) {
          store.update((draft) => {
            draft.pricing.priceInputMode = mode;
            if (mode === 'sale-price') draft.pricing.salePrice = reverted;
            else if (mode === 'margin') draft.pricing.profitMargin = reverted;
            else draft.pricing.profitPerUnit = reverted;
          });
        }
      });
      activeField = null; // libera `sync` — o `repaint()` abaixo formata o próprio campo (§9)
      repaint();
    });
    field.appendChild(input);
    return { field, input, sync };
  }

  const priceField = buildTrioField(
    'Preço de venda',
    'Preço de venda',
    'sale-price',
    'price',
    (parsed) => {
      const { summary } = store.getState();
      return summary.costPerUnit !== null ? validatePriceVsUnitCost(parsed, summary.costPerUnit) : null; // §5.C: aviso, não bloqueio
    },
  );
  const marginField = buildTrioField('% de lucro', '% de lucro', 'margin', 'margin', (parsed) => validateMargin(parsed)); // §5.C
  const profitField = buildTrioField('Lucro unitário', 'Lucro unitário', 'profit', 'profit', null);

  // Custo unitário (issue 042, AC40): 1º item do `.stack`, somente leitura —
  // derivado de `summary.costPerUnit`, sem entrada manual (nunca dispara
  // `store.update`). Reusa `.field`/`.readonly` (design-system.css) e
  // `setDerivedDisplay` (cellHelpers.ts, regra de ouro 2), mesmo padrão de
  // `ingredientsTable.ts`/`batchPanel.ts`.
  const costField = h('div', { className: 'field field--inline' }); // issue 042 revisão: rótulo + valor na mesma linha
  costField.appendChild(h('label', {}, ['Custo unitário']));
  const costInput = h('input', {
    className: 'input num readonly',
    'aria-label': 'Custo unitário',
    readonly: true,
  }) as HTMLInputElement;
  costField.appendChild(costInput);

  stack.appendChild(costField);
  stack.appendChild(profitField.field);
  stack.appendChild(marginField.field);
  stack.appendChild(priceField.field);

  // Totais de produção (§3.E) — sempre derivados, texto plano (brandbook §4.1).
  // Custo unitário saiu daqui (issue 042): já é o 1º item do `.stack` acima,
  // não exibir o mesmo dado duas vezes.
  const table = h('table', { className: 'table mt-3' }); // `.mt-3` (design-system.css, issue 022) — era style inline
  const qtyLabel = h('span', {});
  const totalRevenueCell = h('td', { className: 'num readonly' });
  const totalProfitCell = h('td', { className: 'num readonly' });
  table.appendChild(
    h('tbody', {}, [
      h('tr', {}, [h('td', {}, ['Receita total (', qtyLabel, ' un.)']), totalRevenueCell]),
      h('tr', {}, [h('td', {}, ['Lucro total']), totalProfitCell]),
    ]),
  );
  card.appendChild(table);

  function repaint(): void {
    const { recipe, summary } = store.getState();
    const uc = summary.costPerUnit;
    const price = summary.salePrice;
    const margin = summary.profitMargin;
    const profit = summary.profitPerUnit;
    const loss = uc !== null && price !== null && isLoss(uc, price);

    // Chip (§4): prejuízo tem prioridade sobre a cor de margem.
    chip.classList.remove('chip-ok', 'chip-warn', 'chip-crit');
    if (loss && profit !== null) {
      chip.classList.add('chip-crit');
      chip.textContent = `Prejuízo ${formatCurrency(profit)}`;
    } else if (margin !== null) {
      chip.classList.add(marginChipClass(marginStatus(margin)));
      chip.textContent = `Lucro ${formatPercent(margin)}%`; // issue 042: rótulo "% de lucro", sem duplo "%"
    } else {
      chip.textContent = '—';
    }

    priceField.sync(price !== null ? moneyPlain(price) : '');
    marginField.sync(margin !== null ? formatPercent(margin) : '');
    profitField.sync(profit !== null ? moneyPlain(profit) : '');
    profitField.input.classList.toggle('loss', loss); // §4: destaque de prejuízo no próprio valor

    // Custo unitário (issue 042): 1º item do `.stack`, read-only — mesmo
    // padrão de `setDerivedDisplay` usado em `ingredientsTable.ts`/`batchPanel.ts`.
    setDerivedDisplay(costInput, uc !== null ? formatCurrency(uc) : '—');
    qtyLabel.textContent = quantityPlain(recipe.pricing.quantity);
    totalRevenueCell.textContent = summary.totalRevenue !== null ? formatCurrency(summary.totalRevenue) : '—';
    totalProfitCell.textContent = summary.totalProfit !== null ? formatCurrency(summary.totalProfit) : '—';
    totalProfitCell.classList.toggle('loss', loss); // §4: destaque de prejuízo no total
  }

  repaint();
  store.subscribe(repaint); // §1.6: repintura central em qualquer `update`/`applyTransform`
}
