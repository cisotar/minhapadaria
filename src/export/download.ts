/**
 * download.ts — Disparo de download de arquivos no navegador (spec §8/§10/§11.1).
 *
 * O que faz: dono ÚNICO do padrão "Blob → object URL → <a download> → click →
 * revoke" (extraído de storage/backup.ts, regra de ouro 2 — não duplicar).
 * `downloadBlob(blob, filename)` serve qualquer relatório (JSON de backup §10,
 * XLSX §8); `workbookToBlob(workbook)` serializa um `ExcelJS.Workbook` 100% no
 * cliente (`workbook.xlsx.writeBuffer()`, sem rede — §11.1) e o embrulha em um
 * Blob com o MIME oficial OpenXML de planilha.
 *
 * Browser-only por natureza (Blob/URL/document): sem unit test node — o
 * contrato é exercido pelo wiring (calculadora/histórico) e a serialização do
 * workbook é testada em xlsx.test.ts relendo o buffer (não este wrapper).
 * Zero rede, zero secret, sem eval (§11.1, regra de ouro 3).
 *
 * Docs oficiais consultadas (regra de ouro 4):
 * - https://developer.mozilla.org/en-US/docs/Web/API/Blob
 * - https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
 * - https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
 * - ExcelJS writeBuffer (geração no browser): https://github.com/exceljs/exceljs#browser
 *
 * Seções implementadas: §8 (exportação de relatórios), §10 (client-side), §11.1.
 */
import type ExcelJS from 'exceljs';

/** MIME oficial OpenXML SpreadsheetML (.xlsx). */
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Dispara o download de um Blob como arquivo. object URL é puramente local
 * (sem rede); revoga a referência após o clique (MDN). Único ponto do app que
 * cria âncora de download (regra de ouro 2).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Serializa um workbook ExcelJS em Blob .xlsx 100% no cliente
 * (`workbook.xlsx.writeBuffer()` — zero rede, §11.1). O buffer devolvido é
 * um ArrayBuffer/Buffer; embrulhado com o MIME OpenXML de planilha.
 */
export async function workbookToBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as unknown as ArrayBuffer], { type: XLSX_MIME });
}
