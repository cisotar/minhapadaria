/**
 * recipesList.ts — Tela "Minhas Receitas" (spec §2.F/§10/§14.7) · issue 017.
 *
 * O que faz: `renderRecipesList(root, deps)` monta, dentro de `root`, a barra
 * de ações (busca, "+ Nova receita", "Exportar backup"/"Restaurar backup" +
 * `<input type="file">` oculto), o subtítulo "N receita(s) cadastrada(s)", a
 * região de status (`role="status"`/`aria-live`, §5/§10) e o grid de cards
 * (`.recipe-grid`/`.recipe-card`, design-system.css) OU o estado vazio
 * (`.empty-state`) — espelhando `mockups/receitas.html`.
 *
 * Reuso total (regra de ouro 2): as 5 operações §2.F (criar/abrir/renomear/
 * duplicar/excluir) e o backup vêm prontos de `src/storage/recipes.ts` e
 * `src/storage/backup.ts` — esta tela só faz o wiring de DOM. Números do
 * card (Custo unit./Margem) vêm de `recalculate` (core, §1.6); formatação de
 * `format.ts` (§9); classe do chip de `marginChipClass` (cellHelpers.ts,
 * extraído de `pricingPanel.ts` nesta issue). DOM só via `h/clear/on`
 * (dom.ts) — nome da receita (dado do usuário) nunca vai a `innerHTML`
 * (regra de ouro 3: escape via `textContent`, XSS inerte).
 *
 * Sem diálogo/modal no design system: usa `window.confirm`/`window.prompt`
 * (API nativa, regra de ouro 1) por padrão, mas SEMPRE injetáveis via `deps`
 * para determinismo em teste jsdom (nenhum `window.confirm` real roda nos
 * testes). Excluir avisa que fornadas ficam órfãs (§14.7 — `remove` já não
 * toca `mp.bakes.v1`, sem cascade). Restaurar backup: falha de import nunca
 * perde dados (validação de `importBackup` ocorre ANTES de qualquer escrita,
 * decisão 012.3) — mensagem pt-BR na região de status + `onError` opcional.
 *
 * Diferenças conscientes vs. `mockups/receitas.html` (registradas, regra do
 * cliente — divergência documentada):
 *  1. A barra de ações (busca/criar/backup) é renderizada dentro de `root`
 *     (o mesmo nó recebido por este módulo, testável isoladamente em jsdom)
 *     em vez de dentro do `<header class="page-header">` estático do shell.
 *     Divergência revisada na issue 025 (achado "toolbar fora do header") e
 *     mantida por decisão de arquitetura: a toolbar depende de estado/eventos
 *     só resolvíveis dentro de `renderRecipesList` (busca reativa, `deps`
 *     injetáveis) — mover para o shell estático quebraria o isolamento de
 *     teste sem ganho visual (mesma ordem/classes do mockup). O `<h1>`
 *     estático permanece no shell (`receitas.html`/`receitas.ts`); a issue
 *     025 já move o subtítulo dinâmico para lá (item 2 abaixo) — só a
 *     divergência da toolbar permanece registrada, a revisar com o cliente.
 *  2. O subtítulo dinâmico ("N receita(s) cadastrada(s)") é montado em
 *     `deps.headerRoot` (default `root`, para a suíte continuar isolada) com
 *     a classe `.subtitle` já documentada em `design-system.css`
 *     (`.page-header .subtitle`) — `receitas.ts` passa o `#rc-header` real
 *     do shell, ao lado do `<h1>`, igual ao mockup (issue 025, item 3).
 *  3. Margem do card usa `formatPercent` (2 casas, §9) — "40,00%" — em vez
 *     do "40,0%" (1 casa) do HTML estático do mockup; `format.ts` é a fonte
 *     única de formatação (regra de ouro 2), não a demo estática.
 *  4. "Abrir" aponta para `receitas.html` (arquivo real da Calculadora após a
 *     inversão nome↔conteúdo, issue 032), não `calculadora.html` (nome usado
 *     só no mockup).
 *
 * "Criar em branco" (§2.F, issue 025 item 5): a spec pede as duas formas —
 * "em branco ou a partir de valores padrão". "+ Nova receita" (padrão)
 * semeia com `goldenSeed()`; "Nova receita em branco" chama
 * `recipeStore.create()` SEM seed — `defaultRecipe()` (recipes.ts) já é um
 * `Recipe` válido e mínimo (zero ingredientes, zero fermento), reuso total
 * (regra de ouro 1), nenhuma lógica nova aqui.
 *
 * Seções implementadas: §2.F, §4 (chip de margem), §5 (mensagens de erro),
 * §7.1 (datas aaaa-mm-dd), §9 (formatação), §10 (backup local), §14.7
 * (fornadas órfãs).
 */
import { recalculate } from '../core/recalc';
import { marginStatus } from '../core/pricing';
import { formatCurrency, formatPercent, formatWeight, formatDate } from '../core/format';
import type { Recipe } from '../core/types';
import type { RecipeStore } from '../storage/recipes';
import type { StorageLike } from '../storage/local';
import {
  collectBackupData,
  exportBackup,
  importBackup,
  applyBackupData,
  downloadBackupFile,
  readBackupFile,
} from '../storage/backup';
import { goldenSeed } from './seed';
import { h, clear, on } from './dom';
import { marginChipClass } from './cellHelpers';

export interface RecipesListDeps {
  recipeStore: RecipeStore;
  storage: StorageLike;
  /**
   * Nó onde o subtítulo dinâmico (`.subtitle`) é montado — issue 025 item 3:
   * `receitas.ts` passa `#rc-header` (o mesmo `<header class="page-header">`
   * estático do shell, ao lado do `<h1>`), espelhando `mockups/receitas.html`.
   * Default: `root` (mantém a suíte isolada/testável sem precisar de um shell
   * de página completo em jsdom).
   */
  headerRoot?: HTMLElement;
  /** Injetável para teste (default `window.confirm`). */
  confirm?: (message: string) => boolean;
  /** Injetável para teste (default `window.prompt`). */
  prompt?: (message: string, defaultValue?: string) => string | null;
  /** Injetável para teste (default `location.assign`). */
  navigate?: (url: string) => void;
  /** Injetável para teste (default `readBackupFile`, FileReader real). */
  readFile?: (file: File) => Promise<string>;
  /** Injetável para teste (default `downloadBackupFile`, Blob/anchor real). */
  download?: (json: string) => void;
  /** Notificado (além da região de status) quando o import de backup falha. */
  onError?: (message: string) => void;
}

export function renderRecipesList(root: HTMLElement, deps: RecipesListDeps): void {
  const { recipeStore, storage } = deps;
  const headerRoot = deps.headerRoot ?? root; // issue 025 item 3 — default preserva a suíte isolada
  const confirmFn = deps.confirm ?? ((message: string) => window.confirm(message));
  const promptFn = deps.prompt ?? ((message: string, def?: string) => window.prompt(message, def));
  const navigateFn = deps.navigate ?? ((url: string) => { window.location.assign(url); });
  const readFileFn = deps.readFile ?? readBackupFile;
  const downloadFn = deps.download ?? ((json: string) => downloadBackupFile(json));

  let searchTerm = '';

  // --- Barra de ações (§2.F: criar + busca; §10: backup) ---
  // `.mb-2`/`.push-right`/`.hidden` (design-system.css, issue 022) — substituem
  // os `style=` inline achados na revisão da issue 014 (ampliação issue 017).
  const toolbar = h('div', { className: 'row mb-2' });
  const searchInput = h('input', {
    className: 'input',
    type: 'search',
    placeholder: 'Buscar receita…',
    'aria-label': 'Buscar receita',
    // `size` é contagem de caracteres (atributo HTML, não CSS) — mesmo padrão
    // de `pwValInput` em `ingredientsTable.ts`/`sourdoughTable.ts`: largura
    // intrínseca razoável sem token de largura (não existe em :root).
    size: 26,
  }) as HTMLInputElement;
  const newBtn = h(
    'button',
    { type: 'button', className: 'btn btn-primary' },
    ['+ Nova receita'],
  ) as HTMLButtonElement;
  // issue 025 item 5 (§2.F "em branco ou a partir de valores padrão"): segunda
  // ação explícita, sem seed — `recipeStore.create()` já usa `defaultRecipe()`
  // (recipes.ts) como base mínima válida, reuso total (regra de ouro 1).
  const newBlankBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary' },
    ['Nova receita em branco'],
  ) as HTMLButtonElement;
  const exportBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary push-right' },
    ['Exportar backup'],
  ) as HTMLButtonElement;
  const restoreBtn = h(
    'button',
    { type: 'button', className: 'btn btn-secondary' },
    ['Restaurar backup'],
  ) as HTMLButtonElement;
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json',
    'aria-label': 'Selecionar arquivo de backup',
    className: 'hidden',
  }) as HTMLInputElement;

  toolbar.appendChild(searchInput);
  toolbar.appendChild(newBtn);
  toolbar.appendChild(newBlankBtn);
  toolbar.appendChild(exportBtn);
  toolbar.appendChild(restoreBtn);
  toolbar.appendChild(fileInput);
  root.appendChild(toolbar);

  // issue 025 item 3: classe `.subtitle` (design-system.css, `.page-header
  // .subtitle`) — montado em `headerRoot` (default `root`; `receitas.ts`
  // passa `#rc-header`, o header estático real, igual ao mockup).
  const subtitle = h('p', { className: 'subtitle' });
  headerRoot.appendChild(subtitle);

  // Região de status do backup (§5/§10): erro de import nunca perde dados —
  // aria-live anuncia a mensagem pt-BR sem exigir foco do usuário.
  const status = h('div', { className: 'form-status', role: 'status', 'aria-live': 'polite' });
  root.appendChild(status);

  const listRoot = h('div');
  root.appendChild(listRoot);

  function showStatus(message: string, kind: 'error' | 'ok'): void {
    status.textContent = message;
    status.classList.remove('form-status--error', 'form-status--ok');
    status.classList.add(kind === 'error' ? 'form-status--error' : 'form-status--ok');
    if (kind === 'error') deps.onError?.(message);
  }

  function clearStatus(): void {
    status.textContent = '';
    status.classList.remove('form-status--error', 'form-status--ok');
  }

  // --- Operações §2.F ---

  function createRecipe(): void {
    // Semente de valores padrão (§2.F, caminho 1 de 2: "a partir de valores
    // padrão") — mesmo gabarito usado na Calculadora quando não há `?recipe`.
    const created = recipeStore.create(goldenSeed());
    navigateFn(`receitas.html?recipe=${encodeURIComponent(created.id)}`);
  }

  function createBlankRecipe(): void {
    // §2.F, caminho 2 de 2 ("em branco"): sem seed — `recipeStore.create()`
    // (recipes.ts) já cai no `defaultRecipe()` mínimo válido por padrão do
    // próprio store (zero ingredientes/fermento), reuso total (regra de
    // ouro 1) — nenhuma fórmula/estrutura nova aqui.
    const created = recipeStore.create();
    navigateFn(`receitas.html?recipe=${encodeURIComponent(created.id)}`);
  }

  function duplicateRecipe(id: string): void {
    recipeStore.duplicate(id); // deep clone + novo id/nome/datas (011) — independência já garantida
    renderList();
  }

  function renameRecipe(id: string, currentName: string): void {
    const result = promptFn('Novo nome da receita:', currentName);
    if (result === null || result === '' || result === currentName) return; // cancelado/vazio/sem mudança
    recipeStore.rename(id, result);
    renderList();
  }

  function deleteRecipe(id: string, name: string): void {
    // §14.7: fornadas da receita excluída permanecem órfãs — sem cascade,
    // `remove` já não toca `mp.bakes.v1`. A mensagem avisa isso explicitamente.
    const message = `Excluir "${name}"? As fornadas já registradas desta receita continuarão no histórico como fornadas órfãs.`;
    if (!confirmFn(message)) return;
    recipeStore.remove(id);
    renderList();
  }

  function exportBackupNow(): void {
    clearStatus();
    const data = collectBackupData({ recipeStore, storage });
    const json = exportBackup(data);
    downloadFn(json);
  }

  function restoreBackupFrom(file: File): void {
    readFileFn(file)
      .then((json) => {
        const data = importBackup(json); // lança ANTES de qualquer escrita (decisão 012.3)
        applyBackupData(data, { recipeStore, storage });
        showStatus('Backup restaurado com sucesso.', 'ok');
        renderList();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Não foi possível restaurar o backup.';
        showStatus(message, 'error'); // storage intacto — importBackup não escreveu nada
      })
      .finally(() => {
        fileInput.value = '';
      });
  }

  on(newBtn, 'click', createRecipe);
  on(newBlankBtn, 'click', createBlankRecipe);
  on(exportBtn, 'click', exportBackupNow);
  on(restoreBtn, 'click', () => fileInput.click());
  on(fileInput, 'change', () => {
    const file = fileInput.files?.[0];
    if (file) restoreBackupFrom(file);
  });
  on(searchInput, 'input', () => {
    searchTerm = searchInput.value;
    renderList();
  });

  // --- Render do grid/estado vazio ---

  function matchesSearch(recipe: Recipe): boolean {
    if (searchTerm === '') return true;
    return recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
  }

  function buildEmptyState(): HTMLElement {
    const wrap = h('div', { className: 'empty-state' });
    wrap.appendChild(h('p', {}, ['Você ainda não tem receitas.']));
    const btn = h(
      'button',
      { type: 'button', className: 'btn btn-primary' },
      ['Criar primeira receita'],
    ) as HTMLButtonElement;
    on(btn, 'click', createRecipe);
    wrap.appendChild(btn);
    return wrap;
  }

  function buildCard(recipe: Recipe): HTMLElement {
    const { summary } = recalculate(recipe); // §1.6 — única fonte dos derivados do card

    const card = h('div', { className: 'recipe-card' });
    card.appendChild(h('h3', {}, [recipe.name])); // textContent — escapa XSS (regra 3)
    card.appendChild(
      h('div', { className: 'meta' }, [
        `Editado ${formatDate(recipe.updatedAt)} · F total ${formatWeight(recipe.flourTotalWeight)} g`,
      ]),
    );

    const stats = h('div', { className: 'stats' });
    stats.appendChild(
      h('div', {}, [
        h('span', { className: 'stat-label' }, ['Custo unit.']),
        h('span', { className: 'stat-value' }, [
          summary.costPerUnit !== null ? formatCurrency(summary.costPerUnit) : '—',
        ]),
      ]),
    );
    const marginChip = h('span', { className: 'chip' }, [
      summary.profitMargin !== null ? `${formatPercent(summary.profitMargin)}%` : '—',
    ]);
    if (summary.profitMargin !== null) {
      marginChip.classList.add(marginChipClass(marginStatus(summary.profitMargin))); // §4
    }
    stats.appendChild(h('div', {}, [h('span', { className: 'stat-label' }, ['Margem']), marginChip]));
    card.appendChild(stats);

    const actions = h('div', { className: 'actions' });
    const openLink = h('a', {
      className: 'btn btn-primary',
      href: `receitas.html?recipe=${encodeURIComponent(recipe.id)}`,
    }, ['Abrir']);
    const dupBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Duplicar']) as HTMLButtonElement;
    const renameBtn = h('button', { type: 'button', className: 'btn btn-secondary' }, ['Renomear']) as HTMLButtonElement;
    const deleteBtn = h('button', { type: 'button', className: 'btn btn-danger' }, ['Excluir']) as HTMLButtonElement;
    on(dupBtn, 'click', () => duplicateRecipe(recipe.id));
    on(renameBtn, 'click', () => renameRecipe(recipe.id, recipe.name));
    on(deleteBtn, 'click', () => deleteRecipe(recipe.id, recipe.name));
    actions.appendChild(openLink);
    actions.appendChild(dupBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    return card;
  }

  function renderList(): void {
    const all = recipeStore.list();
    subtitle.textContent = `${all.length} receita${all.length === 1 ? '' : 's'} cadastrada${all.length === 1 ? '' : 's'}`;
    clear(listRoot);
    if (all.length === 0) {
      listRoot.appendChild(buildEmptyState());
      return;
    }
    const grid = h('section', { className: 'recipe-grid' });
    for (const recipe of all.filter(matchesSearch)) grid.appendChild(buildCard(recipe));
    listRoot.appendChild(grid);
  }

  renderList();
}
