/**
 * format.ts — Camada de parsing e formatação numérica pt-BR (spec §6/§7.1/§9).
 *
 * O que faz:
 *  - parseDecimal: converte texto do usuário em number, aceitando vírgula OU
 *    ponto (§7.1); rejeita lixo/vazio/não-finito devolvendo null.
 *  - format*: formatam o valor canônico (number em gramas/R$) para EXIBIÇÃO em
 *    pt-BR com vírgula e as casas decimais da §9 (% 2, peso 1, R$ 2, custo/g 4).
 *
 * Regras da spec respeitadas aqui:
 *  - §9: arredondamento ocorre SÓ na exibição; estas funções recebem o valor
 *    completo e NÃO são chamadas dentro de cálculo interno (devolvem string).
 *  - §7.1: entrada aceita vírgula ou ponto; exibição sempre com vírgula; datas
 *    no formato aaaa-mm-dd.
 *
 * Decisão de implementação (regra de ouro 4 — doc oficial antes de codar):
 *  Usa Intl.NumberFormat('pt-BR', ...) em vez de toFixed()+replace manual.
 *  Motivo: toFixed arredonda pela representação binária e erra o half-up
 *  ((2.675).toFixed(2)==='2.67'; (1.005).toFixed(2)==='1.00'), enquanto Intl
 *  aplica arredondamento decimal correto e já entrega vírgula/símbolo/locale.
 *  roundingMode:'halfExpand' (default do Intl, mas passado explicitamente para
 *  auto-documentar a §9 e blindar contra mudança futura de default) = ties away
 *  from zero = half-up em todo o domínio (valores >= 0) do app.
 *  Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat
 *        https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format
 */

// Formatters instanciados uma vez no escopo de módulo (reuso/performance).

// `roundingMode` foi adicionado ao Intl (ES2023 / Intl.NumberFormat v3) e é
// suportado pelo runtime (Node 24), mas a lib "ES2022" do TS ainda não o
// declara em NumberFormatOptions. Estendemos o tipo localmente para manter o
// valor explícito ('halfExpand' = half-up, §9) sem alterar o tsconfig (fora do
// escopo desta issue). Doc: MDN Intl.NumberFormat (opção roundingMode).
type NumberFormatOptionsWithRounding = Intl.NumberFormatOptions & {
  roundingMode?: 'halfExpand';
};

// Percentuais: 2 casas, sem separador de milhar (§9). Ex: 192 -> "192,00".
const percentOptions: NumberFormatOptionsWithRounding = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
  roundingMode: 'halfExpand',
};
const percentFormatter = new Intl.NumberFormat('pt-BR', percentOptions);

// Pesos: 1 casa, sem milhar — obrigatório para o gabarito §12 (1041,7, não 1.041,7).
const weightOptions: NumberFormatOptionsWithRounding = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
  roundingMode: 'halfExpand',
};
const weightFormatter = new Intl.NumberFormat('pt-BR', weightOptions);

// Moeda: 2 casas, com separador de milhar (convenção pt-BR: R$ 1.234,56) (§9).
const currencyOptions: NumberFormatOptionsWithRounding = {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
  roundingMode: 'halfExpand',
};
const currencyFormatter = new Intl.NumberFormat('pt-BR', currencyOptions);

// Custo por grama: 4 casas (§9 — com 2 casas viraria ruído). Ex: R$ 0,0640.
const costPerGramOptions: NumberFormatOptionsWithRounding = {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
  useGrouping: false,
  roundingMode: 'halfExpand',
};
const costPerGramFormatter = new Intl.NumberFormat('pt-BR', costPerGramOptions);

/**
 * Normaliza o separador entre "R$" e o número. Intl (dependendo da versão de
 * ICU/Node) usa NBSP (U+00A0) ou narrow-NBSP (U+202F); trocamos por espaço
 * ASCII para igualdade previsível em teste e saída estável entre versões.
 */
function normalizeSpaces(s: string): string {
  return s.replace(/[  ]/g, ' ');
}

/**
 * parseDecimal — converte texto do usuário em number (§7.1).
 * Aceita vírgula OU ponto como separador decimal. Devolve null para vazio,
 * lixo, mais de um separador decimal ou valor não-finito. Zero é válido.
 */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null; // §7.1: vazio não é 0 — checar ANTES (Number('') === 0)

  // Vírgula é separador decimal em pt-BR; normaliza para ponto antes do parse.
  const normalized = trimmed.replace(',', '.');
  // Mais de um separador (ex.: "12.5.5" ou "1,5,5") é entrada inválida.
  if ((normalized.match(/\./g) ?? []).length > 1) return null;

  const value = Number(normalized);
  // Number.isFinite rejeita NaN ("abc") e Infinity/-Infinity ("Infinity").
  if (!Number.isFinite(value)) return null;
  return value;
}

/** formatPercent — % com 2 casas e vírgula (§9). Ex: 72.72727 -> "72,73". */
export function formatPercent(n: number): string {
  return percentFormatter.format(n);
}

/** formatWeight — peso com 1 casa e vírgula, sem milhar (§9). Ex: 1041.6666 -> "1041,7". */
export function formatWeight(n: number): string {
  return weightFormatter.format(n);
}

/** formatCurrency — R$ com 2 casas e vírgula (§9). Ex: 8.856 -> "R$ 8,86". */
export function formatCurrency(n: number): string {
  return normalizeSpaces(currencyFormatter.format(n));
}

/** formatCostPerGram — R$ com 4 casas (§9/§2.A.1). Ex: 0.064 -> "R$ 0,0640". */
export function formatCostPerGram(n: number): string {
  return normalizeSpaces(costPerGramFormatter.format(n));
}

/**
 * formatDate — data no formato aaaa-mm-dd (§7.1).
 * Usa getters LOCAIS (nunca toISOString, que converte para UTC e pode deslocar
 * o dia conforme o fuso). Ex: new Date(2026, 6, 4) -> "2026-07-04".
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * parseLocalDate — parseia `'aaaa-mm-dd'` (valor de `<input type="date">`) para
 * meia-noite LOCAL (§7.1, dono único, simétrico a `formatDate`). NUNCA
 * `new Date('aaaa-mm-dd')`: o construtor de string trata esse formato como
 * UTC meia-noite (ISO 8601 date-only), o que em fusos negativos (ex.: Brasil,
 * UTC−3) desloca o dia ao ler com getters locais (getDate() devolveria o dia
 * anterior). Construindo por componentes (y, m-1, d) o resultado é meia-noite
 * local, garantindo round-trip com `formatDate`.
 * Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
 *       https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
 */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
