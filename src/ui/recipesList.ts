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
 * Excluir usa `window.confirm` (API nativa, regra de ouro 1) por padrão, mas
 * SEMPRE injetável via `deps.confirm` para determinismo em teste jsdom (nenhum
 * `window.confirm` real roda nos testes) — avisa que fornadas ficam órfãs
 * (§14.7 — `remove` já não toca `mp.bakes.v1`, sem cascade). Renomear (issue
 * 033) é edição inline no `<h3>` do card, sem `window.prompt`/modal (ver
 * `startInlineEdit`). Restaurar backup: falha de import nunca perde dados
 * (validação de `importBackup` ocorre ANTES de qualquer escrita, decisão
 * 012.3) — mensagem pt-BR na região de status + `onError` opcional.
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
 * "em branco ou a partir de valores padrão". "+ Nova receita" (padrão, issue
 * 035: abre `openPromptModal` pedindo o nome antes de criar — `modal.ts`,
 * 1º modal do design system) semeia com `goldenSeed()`; "Nova receita em
 * branco" continua sem modal, chama `recipeStore.create()` SEM seed —
 * `defaultRecipe()` (recipes.ts) já é um `Recipe` válido e mínimo (zero
 * ingredientes, zero fermento), reuso total (regra de ouro 1), nenhuma
 * lógica nova aqui.
 *
 * Reordenar por arrastar (issue 050): cada card ganha uma alça dedicada
 * (`.recipe-drag-handle`, glyph "⠿", topo-esquerda) — NÃO o card inteiro —
 * porque o card hospeda botões de ação e a edição inline do nome
 * (`startInlineEdit`); arrastar o card inteiro por padrão quebraria clique/
 * seleção de texto. A alça só liga `card.draggable` no `mousedown`; o drag
 * nativo HTML5 (`dragstart`/`dragover`/`drop`/`dragend`) é delegado no
 * `.recipe-grid` (`attachDragEvents`) — reordena AO VIVO no DOM durante
 * `dragover` (`insertBefore` no ponto de inserção calculado por ordem de
 * leitura 2D — ver `insertionPoint`) e só persiste via `recipeStore.reorder`
 * (storage/recipes.ts,
 * NÃO altera `updatedAt`) em `dragend`, seguido de `renderList()` para
 * ressincronizar com o store. Só ativo com `searchTerm === ''` — reordenar
 * uma lista filtrada (resultado parcial da busca) é ambíguo, então a alça
 * simplesmente não é renderizada nesse caso. Limitação documentada: DnD
 * nativo não é acessível por teclado (mouse/touch-pointer continuam 100%
 * operáveis); nenhuma affordance existente foi removida.
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
import { openPromptModal } from './modal';
import { startInlineNameEdit } from './inlineNameEdit';

/** Duração da animação FLIP dos cards (issue 050, revisão UX) em ms —
 *  parâmetro de COMPORTAMENTO, não um valor de design/token (`:root` é
 *  imutável e não tem token de duração de transição) — curta o bastante
 *  para não atrapalhar reordenações rápidas em sequência. */
const FLIP_DURATION_MS = 150;

/**
 * `prefers-reduced-motion: reduce` (issue 050, revisão UX, spec
 * acessibilidade) — quando ativo, a reordenação continua idêntica (mesmo
 * `insertBefore`), só pula a animação FLIP (o card "salta" direto pra
 * posição final, sem transição). `window.matchMedia` não existe no jsdom
 * padrão deste projeto (nenhum outro módulo o usa) — checagem defensiva via
 * `typeof` evita quebrar a suíte quando não implementado.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** First (do FLIP): posição atual (`getBoundingClientRect`) de cada card do
 *  grid, capturada ANTES do `insertBefore` que efetivamente reordena o DOM. */
function captureCardRects(grid: HTMLElement): Map<HTMLElement, DOMRect> {
  const rects = new Map<HTMLElement, DOMRect>();
  for (const child of Array.from(grid.children)) {
    if (child instanceof HTMLElement) rects.set(child, child.getBoundingClientRect());
  }
  return rects;
}

/**
 * Invert + Play do FLIP: para cada card cuja posição mudou (exceto `skip` —
 * o card sendo arrastado, que já segue o cursor via drag nativo, não
 * "salta" junto com os outros), aplica a diferença de posição invertida
 * como `transform` SEM transição (Invert — o card parece não ter se
 * movido), depois, num `requestAnimationFrame` seguinte, zera o `transform`
 * COM `transition` (Play — anima suavemente até a posição real, já
 * reordenada no DOM). `transitionend`/timeout de segurança limpam o
 * `transition` inline no final (jsdom nunca dispara `transitionend` de
 * verdade — só o timeout roda em teste). Pulado inteiramente com
 * `prefers-reduced-motion: reduce`.
 */
function playFlip(grid: HTMLElement, before: Map<HTMLElement, DOMRect>, skip: HTMLElement | null): void {
  if (prefersReducedMotion()) return; // reordena instantâneo — sem FLIP
  for (const child of Array.from(grid.children)) {
    if (!(child instanceof HTMLElement) || child === skip) continue;
    const prevRect = before.get(child);
    if (!prevRect) continue;
    const nextRect = child.getBoundingClientRect();
    const dx = prevRect.left - nextRect.left;
    const dy = prevRect.top - nextRect.top;
    if (dx === 0 && dy === 0) continue; // não se moveu — nada a animar

    child.style.transition = 'none';
    child.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      child.style.transition = `transform ${FLIP_DURATION_MS}ms ease`;
      child.style.transform = '';
    });
    const cleanup = (): void => {
      child.style.transition = '';
      child.removeEventListener('transitionend', cleanup);
    };
    child.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, FLIP_DURATION_MS + 50); // rede de segurança
  }
}

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
  const navigateFn = deps.navigate ?? ((url: string) => { window.location.assign(url); });
  const readFileFn = deps.readFile ?? readBackupFile;
  const downloadFn = deps.download ?? ((json: string) => downloadBackupFile(json));

  let searchTerm = '';
  // Issue 050 (drag-and-drop de cards): id da receita cujo card está sendo
  // arrastado no momento (nulo fora de um gesto de drag). Escopo do módulo
  // (não de `renderList`) porque o grid é recriado a cada render, mas o
  // gesto de drag atravessa um único ciclo dragstart→dragend sobre o MESMO
  // grid — nunca precisa sobreviver a um re-render.
  let draggedCard: HTMLElement | null = null;

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
    // Issue 035: "+ Nova receita" abre um modal pedindo o nome ANTES de criar
    // (era criação direta com nome genérico) — só ao confirmar com nome
    // válido (trim não-vazio) a receita nasce já com esse nome, semeada com
    // `goldenSeed()` (§2.F, caminho 1 de 2: "a partir de valores padrão" —
    // mesmo gabarito usado na Calculadora quando não há `?recipe`). Cancelar
    // (botão/Esc/backdrop) ou confirmar vazio não cria nada (`openPromptModal`
    // cuida da validação/mensagem de erro/foco — zero lógica de receita ali).
    openPromptModal({
      title: 'Nova receita',
      label: 'Nome da receita',
      confirmLabel: 'Criar',
      cancelLabel: 'Cancelar',
      onConfirm: (name) => {
        const created = recipeStore.create({ ...goldenSeed(), name });
        navigateFn(`receitas.html?recipe=${encodeURIComponent(created.id)}`);
      },
    });
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

  /**
   * Edição inline do nome (issue 033, refactor II §134; extraída para
   * `startInlineNameEdit` na issue 036 — regra de ouro 2, a mecânica é
   * reusada tal-qual pelo `<h1>` editável da Calculadora). Wrapper fino:
   * exibição = `<h3>`, caminho de escrita = `recipeStore.rename` direto
   * (card não passa pelo pipeline de autosave da Calculadora).
   */
  function startInlineEdit(nameRef: { el: HTMLHeadingElement }, recipe: Recipe): void {
    startInlineNameEdit({
      target: nameRef.el,
      currentName: recipe.name,
      makeDisplay: (name) => h('h3', {}, [name]) as HTMLHeadingElement, // textContent — escapa XSS (regra 3)
      onCommit: (value) => recipeStore.rename(recipe.id, value),
      onDisplayChange: (display) => {
        nameRef.el = display as HTMLHeadingElement; // reatribui para o próximo clique em "Renomear"
      },
    });
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
    card.dataset.id = recipe.id; // issue 050 — identifica o card na ordem do grid após reordenar

    // Issue 050 (drag-and-drop): a alça só existe com a busca vazia — com
    // filtro ativo a lista exibida é parcial e reordenar fica ambíguo (a
    // ordem "verdadeira" no store inclui receitas fora do resultado da
    // busca). `card.draggable` começa `false`: só a alça (mousedown) liga o
    // drag do CARD inteiro (imagem de arrasto = card completo, não só o
    // ícone) — evita conflito com clique nos botões de ação e com a edição
    // inline do nome (`startInlineEdit`), que ficariam inutilizáveis se o
    // card inteiro fosse `draggable` por padrão.
    const dragEnabled = searchTerm === '';
    if (dragEnabled) {
      card.classList.add('has-drag-handle');
      const handle = h(
        'button',
        {
          type: 'button',
          // `.card-icon-btn` (design-system.css, issue 050 revisão) — base
          // compartilhada com `.card-delete-btn` (posição/tamanho/aparência
          // neutra); reuso total (regra de ouro 1) em vez de duplicar props.
          className: 'card-icon-btn recipe-drag-handle',
          'aria-label': `Reordenar receita ${recipe.name}`,
          title: 'Arrastar para reordenar',
        },
        ['⠿'],
      ) as HTMLButtonElement;
      on(handle, 'mousedown', () => {
        card.draggable = true;
      });
      // Cobre o caso de mousedown sem drag efetivo (clique solto na alça,
      // ou o próprio navegador não iniciar o gesto) — sem isso o card
      // ficaria `draggable` indefinidamente. Quando o drag REALMENTE
      // ocorre, `dragend` (delegado no grid) já reseta antes deste evento.
      on(handle, 'mouseup', () => {
        card.draggable = false;
      });
      card.appendChild(handle);
    }

    const nameRef = { el: h('h3', {}, [recipe.name]) as HTMLHeadingElement }; // textContent — escapa XSS (regra 3)
    card.appendChild(nameRef.el);

    // Excluir vira ícone no canto superior direito do card (fora de `.actions`,
    // separado das ações primárias) — mesmo glyph "×"/aria-label já usado nos
    // botões de remover linha (ingredientsTable.ts/sourdoughTable.ts), reuso
    // total (regra de ouro 2).
    const deleteBtn = h(
      'button',
      {
        type: 'button',
        // `.card-icon-btn` (design-system.css, issue 050 revisão) — base
        // compartilhada com `.recipe-drag-handle` (posição/tamanho/aparência
        // neutra); reuso total (regra de ouro 1) em vez de duplicar props.
        className: 'card-icon-btn card-delete-btn',
        title: 'Excluir receita',
        'aria-label': `Excluir ${recipe.name}`,
      },
      ['×'],
    ) as HTMLButtonElement;
    on(deleteBtn, 'click', () => deleteRecipe(recipe.id, recipe.name));
    card.appendChild(deleteBtn);
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
    stats.appendChild(
      h('div', {}, [
        h('span', { className: 'stat-label' }, ['Preço']),
        h('span', { className: 'stat-value' }, [
          summary.salePrice !== null ? formatCurrency(summary.salePrice) : '—',
        ]),
      ]),
    );
    stats.appendChild(
      h('div', {}, [
        h('span', { className: 'stat-label' }, ['Lucro']),
        h('span', { className: 'stat-value' }, [
          summary.profitPerUnit !== null ? formatCurrency(summary.profitPerUnit) : '—',
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
    on(dupBtn, 'click', () => duplicateRecipe(recipe.id));
    on(renameBtn, 'click', () => startInlineEdit(nameRef, recipe));
    actions.appendChild(openLink);
    actions.appendChild(dupBtn);
    actions.appendChild(renameBtn);
    card.appendChild(actions);
    return card;
  }

  /** Ids das receitas na ordem atual dos filhos do grid (issue 050) —
   *  extraído à parte para ficar pequeno e testável isoladamente do gesto
   *  de arrastar em si (`data-id` setado em `buildCard`). */
  function cardIdsInOrder(grid: HTMLElement): string[] {
    return Array.from(grid.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .map((el) => el.dataset.id)
      .filter((id): id is string => Boolean(id));
  }

  /**
   * Ponto de inserção do card arrastado, por ORDEM DE LEITURA 2D (correção
   * do bug: a régua antiga só olhava o eixo vertical — `clientY` vs o meio
   * do alvo — num `.recipe-grid` de 3/2/1 colunas, então cards LADO A LADO
   * na mesma linha, com o mesmo topo, eram indistinguíveis; a reordenação
   * só "andava" num sentido). Percorre os cards na ordem do DOM e devolve o
   * PRIMEIRO cujo card o ponteiro precede na leitura (esq→dir, cima→baixo):
   *   • ponteiro acima do card (`py < top`)  → precede  (linha anterior);
   *   • ponteiro abaixo do card (`py > bottom`) → NÃO precede (linha adiante);
   *   • ponteiro na faixa vertical do card → decide pelo meio horizontal
   *     (`px < left + width/2`), ou seja, qual metade (esq/dir) do card.
   * O arrastado entra ANTES desse card (`desiredNext`); se nenhum card é
   * precedido, vai para o fim (`null`). Funciona igual em 3, 2 ou 1 coluna
   * sem o código saber de antemão o formato da grade — a própria geometria
   * (`getBoundingClientRect`) informa linha e lado a cada evento.
   */
  function insertionPoint(grid: HTMLElement, px: number, py: number): HTMLElement | null {
    for (const child of Array.from(grid.children)) {
      if (!(child instanceof HTMLElement) || child === draggedCard) continue;
      const box = child.getBoundingClientRect();
      const precedes =
        py < box.top ? true
        : py > box.bottom ? false
        : px < box.left + box.width / 2;
      if (precedes) return child;
    }
    return null; // ponteiro depois de todos os cards → anexa ao fim
  }

  /**
   * Issue 050 (+ revisão UX + correção do eixo) — DnD nativo HTML5 delegado
   * no `.recipe-grid` (um novo grid nasce a cada `renderList`, por isso
   * religa a cada chamada). Reordena "ao vivo" no DOM durante `dragover`:
   * `insertionPoint` calcula o alvo por ordem de leitura 2D (ver acima) e o
   * `insertBefore` acontece só quando a posição realmente muda (guarda
   * contra thrash, já que `dragover` dispara repetidamente mesmo parado
   * sobre o mesmo alvo); a escrita no store (`recipeStore.reorder`) e o
   * `renderList()` de sincronização só acontecem em `dragend` — fonte única
   * de verdade nunca diverge por mais que o tempo de um gesto. Cada
   * reordenação ao vivo dispara `playFlip` (FLIP: First/Last/Invert/Play)
   * para os cards deslocados deslizarem suavemente até a nova posição em
   * vez de teleportar — pulado com `prefers-reduced-motion: reduce`.
   *
   * Limitação documentada: DnD nativo não é acessível por teclado — mouse/
   * touch-pointer continuam 100% operáveis; nenhuma affordance existente
   * (Abrir/Duplicar/Renomear/Excluir/edição inline) foi removida ou alterada.
   */
  function attachDragEvents(grid: HTMLElement): void {
    function cardOf(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest('.recipe-card');
    }

    on(grid, 'dragstart', (e) => {
      const card = cardOf(e.target);
      if (!card || !card.draggable) return; // só a alça liga `draggable` (buildCard)
      draggedCard = card;
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id ?? ''); // exigido pelo Firefox
      }
    });

    on(grid, 'dragover', (e) => {
      if (!draggedCard) return;
      e.preventDefault(); // habilita o drop
      // Alvo por ordem de leitura 2D (linha + lado) — não mais só o eixo Y.
      const desiredNext = insertionPoint(grid, e.clientX, e.clientY);
      // Evita thrash: só mexe no DOM se a posição REALMENTE muda — sem isso
      // todo `dragover` (dispara várias vezes por segundo, mesmo parado)
      // chamaria `insertBefore`/FLIP à toa.
      if (draggedCard.nextSibling === desiredNext) return;
      const rectsBefore = captureCardRects(grid); // First (FLIP)
      grid.insertBefore(draggedCard, desiredNext); // Last (FLIP)
      playFlip(grid, rectsBefore, draggedCard); // Invert + Play (FLIP) — card arrastado não anima
    });

    on(grid, 'drop', (e) => {
      e.preventDefault();
    });

    on(grid, 'dragend', () => {
      if (!draggedCard) return;
      draggedCard.classList.remove('dragging');
      draggedCard.draggable = false;
      const ids = cardIdsInOrder(grid);
      draggedCard = null;
      recipeStore.reorder(ids);
      renderList(); // ressincroniza com o store (fonte única de verdade)
    });
  }

  function renderList(): void {
    draggedCard = null; // qualquer render fora de um gesto de drag começa limpo
    const all = recipeStore.list();
    subtitle.textContent = `${all.length} receita${all.length === 1 ? '' : 's'} cadastrada${all.length === 1 ? '' : 's'}`;
    clear(listRoot);
    if (all.length === 0) {
      listRoot.appendChild(buildEmptyState());
      return;
    }
    const grid = h('section', { className: 'recipe-grid' });
    attachDragEvents(grid);
    for (const recipe of all.filter(matchesSearch)) grid.appendChild(buildCard(recipe));
    listRoot.appendChild(grid);
  }

  renderList();
}
