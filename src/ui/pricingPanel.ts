/**
 * pricingPanel.ts — Painel de Precificação (spec §3.E/§4) · issue 016.
 *
 * O que faz: `renderPricingPanel(root, store)` monta o card "Precificação"
 * (mockup `mockups/calculadora.html`) com o chip de status da margem
 * (`marginStatus`/`isLoss`, pricing.ts — reuso, regra de ouro 2), o trio
 * sincronizado Preço de venda/Margem %/Lucro unitário (§3.E: editar um grava
 * `pricing.priceInputMode` + o valor cru via `store.update`; `recalculate`,
 * 008, já reconstrói os outros dois) e os totais de produção (Custo
 * unitário, Receita total, Lucro total) de `summary`.
 *
 * Sincronização do trio (§1.6, "recalcula imediatamente"): o campo em edição
 * NUNCA é sobrescrito por `store.subscribe` — `activeField` (análogo ao
 * `lastPricingEdit` do mockup) marca qual dos três está sendo digitado; os
 * outros dois são repintados a cada notificação. `blur` formata o próprio
 * campo (§9) e limpa `activeField`, liberando-o para repintura normal.
 * Validação (010, reuso): Margem bloqueia fora de [0, 99,9] (`validateMargin`
 * — o core já clampa internamente, mas o bloqueio no blur também sinaliza
 * `aria-invalid`, §5.C); Preço só AVISA se não cobrir o custo unitário
 * (`validatePriceVsUnitCost`, aviso não bloqueante).
 *
 * Indicadores (§4): margem colorida via `marginStatus` (verde >30%, amarelo
 * 15–30%, vermelho <15% ou negativa) mapeada para `.chip-ok/.chip-warn/
 * .chip-crit` (design-system.css); prejuízo (`isLoss`, preço ≤ custo) vira
 * chip "Prejuízo R$…" + classe `.loss` nos valores afetados — nenhum hex
 * novo, só os tokens de estado já existentes.
 *
 * Zero lógica de negócio nova: todo número vem de `summary`/`recipe.pricing`
 * (`recalculate`, 008); a única conta local é o rótulo pt-BR de Quantidade
 * ("N un.") na linha de Receita Total, texto puro sem fórmula.
 *
 * Seções implementadas: §1.6, §3.E, §4, §5.C, §9.
 */
import { parseDecimal, formatPercent, formatCurrency } from '../core/format';
import { marginStatus, isLoss } from '../core/pricing';
import { validateMargin, validatePriceVsUnitCost, type ValidationResult } from '../core/validation';
import { h, on } from './dom';
import type { AppStateStore } from './state';
import { moneyPlain, applyValidation, marginChipClass } from './cellHelpers';

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
  const chipRow = h('div', { className: 'row', style: 'margin-bottom:var(--sp-3)' });
  const chip = h('span', { className: 'chip' });
  chipRow.appendChild(chip);
  card.appendChild(chipRow);

  // Trio sincronizado (§3.E).
  const trioRow = h('div', { className: 'row row--end' });
  card.appendChild(trioRow);

  let activeField: ActiveField = null;

  function buildTrioField(
    label: string,
    ariaLabel: string,
    mode: 'sale-price' | 'margin' | 'profit',
    fieldKey: ActiveField,
    validate: ((parsed: number) => ValidationResult) | null,
  ): { field: HTMLElement; input: HTMLInputElement; sync: (text: string) => void } {
    const field = h('div', { className: 'field' });
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
  const marginField = buildTrioField('Margem %', 'Margem %', 'margin', 'margin', (parsed) => validateMargin(parsed)); // §5.C
  const profitField = buildTrioField('Lucro unitário', 'Lucro unitário', 'profit', 'profit', null);
  trioRow.appendChild(priceField.field);
  trioRow.appendChild(marginField.field);
  trioRow.appendChild(profitField.field);

  // Totais de produção (§3.E) — sempre derivados, texto plano (brandbook §4.1).
  const table = h('table', { className: 'table', style: 'margin-top:var(--sp-3)' });
  const unitCostCell = h('td', { className: 'num readonly' });
  const qtyLabel = h('span', {});
  const totalRevenueCell = h('td', { className: 'num readonly' });
  const totalProfitCell = h('td', { className: 'num readonly' });
  table.appendChild(
    h('tbody', {}, [
      h('tr', {}, [h('td', {}, ['Custo unitário']), unitCostCell]),
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
      chip.textContent = `Margem ${formatPercent(margin)}%`;
    } else {
      chip.textContent = '—';
    }

    priceField.sync(price !== null ? moneyPlain(price) : '');
    marginField.sync(margin !== null ? formatPercent(margin) : '');
    profitField.sync(profit !== null ? moneyPlain(profit) : '');
    profitField.input.classList.toggle('loss', loss); // §4: destaque de prejuízo no próprio valor

    unitCostCell.textContent = uc !== null ? formatCurrency(uc) : '—';
    qtyLabel.textContent = quantityPlain(recipe.pricing.quantity);
    totalRevenueCell.textContent = summary.totalRevenue !== null ? formatCurrency(summary.totalRevenue) : '—';
    totalProfitCell.textContent = summary.totalProfit !== null ? formatCurrency(summary.totalProfit) : '—';
    totalProfitCell.classList.toggle('loss', loss); // §4: destaque de prejuízo no total
  }

  repaint();
  store.subscribe(repaint); // §1.6: repintura central em qualquer `update`/`applyTransform`
}
