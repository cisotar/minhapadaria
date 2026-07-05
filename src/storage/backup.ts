/**
 * backup.ts — Backup e restauração de TODOS os dados do usuário em arquivo JSON
 * (spec §10 "backup/restaurar", decisão 11, formato de migração SaaS §11.2).
 *
 * O que faz: serializa receitas + histórico de fornadas em um envelope JSON
 * versionado `{ app, schemaVersion, exportedAt, recipes, bakeHistory }` e o
 * restaura de volta. Estratégia de restauração é SUBSTITUIÇÃO TOTAL — leitura
 * literal de "restaurar" (§10): o conteúdo do backup passa a ser o estado, o
 * anterior é descartado (ver applyBackupData / PROGRESS.md).
 *
 * Camadas (§1.6): este módulo NÃO recalcula derivados; só serializa/desserializa
 * estado cru. Funções de cálculo ficam em src/core. As funções puras
 * exportBackup/importBackup não tocam storage nem DOM — falha de import nunca
 * corrompe o estado atual por construção (validação acontece ANTES de qualquer
 * escrita). Zero rede, zero secret, sem eval, sem reviver genérico (§11.1,
 * regra de ouro 3): dado do usuário nunca é executado; a UI (017) faz o escape.
 *
 * I/O de arquivo é trivial via plataforma — nenhuma lib nova (regra de ouro 1).
 * O disparo do download (Blob→object URL→<a>) foi extraído para o dono único
 * `export/download.ts` (`downloadBlob`, issue 019, regra de ouro 2): este módulo
 * apenas monta o nome do arquivo e delega — sem duplicar o padrão de Blob.
 * Docs MDN consultadas (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/FileReader
 *
 * Seções implementadas: §10 (backup/restaurar local), §11.2 (formato de
 * migração), decisão 11 (backup obrigatório na v1), §7.1 (datas ISO/aaaa-mm-dd).
 */
import type { Recipe, BakeEntry } from '../core/types';
import { type StorageLike, defaultStorage } from './local';
import type { RecipeStore } from './recipes';
import { downloadBlob } from '../export/download';

// --- Constantes (fonte única; issue 013 importa BAKES_STORAGE_KEY daqui) ---
export const BACKUP_APP_ID = 'minhapadaria';
export const BACKUP_SCHEMA_VERSION = 1;
// Seam temporário: o store de fornadas nasce na issue 013 e passará a ser a
// fonte desta chave; até lá, backup lê/escreve a chave direto no StorageLike.
export const BAKES_STORAGE_KEY = 'mp.bakes.v1';

// --- Tipos do envelope (ordem exata da issue §14, decisão 11) ---
export interface BackupData {
  recipes: Recipe[];
  bakeHistory: BakeEntry[];
}

export interface BackupEnvelope {
  app: typeof BACKUP_APP_ID;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  recipes: Recipe[];
  bakeHistory: BakeEntry[];
}

// --- Funções PURAS (alvo do TDD; testáveis em node, sem browser) ---

/**
 * Monta o envelope de backup e serializa. `exportedAt` em ISO 8601 (§7.1),
 * com clock injetável para determinismo. Não muta `data`; Date→ISO é feito
 * pelo JSON.stringify nativo (toJSON), sem lib de datas.
 */
export function exportBackup(
  data: BackupData,
  opts: { now?: () => Date } = {},
): string {
  const now = opts.now ?? (() => new Date());
  const envelope: BackupEnvelope = {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now().toISOString(),
    recipes: data.recipes,
    bakeHistory: data.bakeHistory,
  };
  return JSON.stringify(envelope);
}

// Reviver dirigido por campo (nunca genérico): só coage datas conhecidas do
// domínio (§2.F / §14.3) de volta a Date. Mesma disciplina de recipes.ts.
function reviveRecipeDates(raw: unknown): Recipe {
  const r = raw as Record<string, unknown>;
  if (typeof r.createdAt === 'string') r.createdAt = new Date(r.createdAt);
  if (typeof r.updatedAt === 'string') r.updatedAt = new Date(r.updatedAt);
  return r as unknown as Recipe;
}

function reviveBakeDates(raw: unknown): BakeEntry {
  const b = raw as Record<string, unknown>;
  if (typeof b.date === 'string') b.date = new Date(b.date);
  return b as unknown as BakeEntry;
}

/**
 * Valida e desserializa um backup. Qualquer falha lança Error (mensagem pt-BR)
 * ANTES de qualquer escrita — não toca storage, então o estado atual permanece
 * intacto por construção. Retorna BackupData com datas revividas como Date.
 */
export function importBackup(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Arquivo de backup inválido: não é um JSON válido.');
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(
      'Arquivo de backup inválido: não parece um backup do Minha Padaria.',
    );
  }
  const env = parsed as Record<string, unknown>;

  // §11.2: identidade do formato antes de tudo.
  if (env.app !== BACKUP_APP_ID) {
    throw new Error(
      'Arquivo de backup inválido: não parece um backup do Minha Padaria.',
    );
  }
  if (env.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Versão de backup não suportada (esperado ${BACKUP_SCHEMA_VERSION}, recebido ${env.schemaVersion}).`,
    );
  }
  if (!Array.isArray(env.recipes) || !Array.isArray(env.bakeHistory)) {
    throw new Error(
      'Arquivo de backup inválido: estrutura de dados corrompida.',
    );
  }

  return {
    recipes: env.recipes.map(reviveRecipeDates),
    bakeHistory: env.bakeHistory.map(reviveBakeDates),
  };
}

// --- Orquestradores de I/O (thin; injetam store/storage) ---

/**
 * Reúne o estado do usuário para exportar: receitas via recipeStore.list()
 * (REUSO; datas já Date) + histórico de fornadas do seam mp.bakes.v1 (parse
 * defensivo — chave ausente/corrompida → array vazio, sem crash).
 */
export function collectBackupData(deps: {
  recipeStore: RecipeStore;
  storage?: StorageLike;
}): BackupData {
  const storage = deps.storage ?? defaultStorage();
  return {
    recipes: deps.recipeStore.list(),
    bakeHistory: readBakeHistory(storage),
  };
}

/**
 * Aplica um backup já validado: SUBSTITUIÇÃO TOTAL (§10 "restaurar"). Sobrescreve
 * o conjunto de receitas (preservando id/datas do arquivo) e o histórico de
 * fornadas. Só deve ser chamado após importBackup ter sucesso.
 */
export function applyBackupData(
  data: BackupData,
  deps: { recipeStore: RecipeStore; storage?: StorageLike },
): void {
  const storage = deps.storage ?? defaultStorage();
  deps.recipeStore.replaceAll(data.recipes); // REUSO da extensão mínima (011)
  storage.setItem(BAKES_STORAGE_KEY, JSON.stringify(data.bakeHistory));
}

// Leitura defensiva do seam de fornadas (mesmo padrão de prefs.ts): qualquer
// problema → [] sem lançar. Revive `date` das entradas presentes.
function readBakeHistory(storage: StorageLike): BakeEntry[] {
  const raw = storage.getItem(BAKES_STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(reviveBakeDates);
  } catch {
    return [];
  }
}

// --- Helpers de DOM (browser-only; wiring é da issue 017, sem unit test node) ---

/**
 * Dispara o download do JSON como arquivo. Nome deriva da data (§7.1
 * aaaa-mm-dd); o padrão Blob→object URL→<a>→click→revoke vive no dono único
 * `downloadBlob` (export/download.ts, issue 019 — regra de ouro 2, sem duplicar).
 */
export function downloadBackupFile(
  json: string,
  opts: { now?: () => Date } = {},
): void {
  const now = opts.now ?? (() => new Date());
  const stamp = now().toISOString().slice(0, 10); // aaaa-mm-dd (§7.1)
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `minha-padaria-backup-${stamp}.json`);
}

/**
 * Lê um File selecionado como texto (FileReader.readAsText, MDN). Wrapper fino
 * em Promise; rejeita com mensagem pt-BR em erro de leitura. Testado em jsdom
 * pela issue 017 (fora do escopo node atual).
 */
export function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error('Não foi possível ler o arquivo de backup.'));
    reader.readAsText(file);
  });
}
