// ローカル PDF からテキストを抽出する（AI要約の入力用）。
// dsf/lib/pdf.ts は画像描画専用なので、要約向けにテキスト抽出をここで行う。
import { loadPdf } from '../../dsf/lib/pdf';
import { readLocalBinaryFile } from '../api/knowledgeApi';

/** ローカル PDF の全ページ（上限あり）からプレーンテキストを抽出する */
export async function extractPdfText(filePath: string, maxChars = 40_000, maxPages = 80): Promise<string> {
  const bytes = await readLocalBinaryFile(filePath);
  const buf = new Uint8Array(bytes).buffer;
  const task = loadPdf(buf);
  const pdf = await task.promise;
  try {
    const pageCount = Math.min(pdf.numPages, maxPages);
    const parts: string[] = [];
    let total = 0;
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      try {
        const content = await page.getTextContent();
        const text = content.items.map((it: any) => (typeof it.str === 'string' ? it.str : '')).join(' ');
        parts.push(text);
        total += text.length;
      } finally {
        page.cleanup();
      }
      if (total >= maxChars) break;
    }
    return parts.join('\n').slice(0, maxChars);
  } finally {
    task.destroy();
  }
}
