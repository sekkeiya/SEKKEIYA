// ──────────────────────────────────────────────────────────────────────────────
// S.Library カタログPDF → ページ画像 → 家具を自動クロップ → CLIP埋め込み → ローカル索引。
// ──────────────────────────────────────────────────────────────────────────────

import { loadPdf, renderPdfPage } from '../../dsf/lib/pdf';
import { readLocalBinaryFile } from '../api/knowledgeApi';
import { detectFurniture, embedImage } from '../../../shared/vision/visionEngine';
import { cropToDataUrl } from '../../../shared/vision/cropImage';
import { saveCatalogItems, type CatalogVisionItem, type CatalogIndexMeta } from './catalogVisionStore';

export interface IngestProgress {
  page: number;
  totalPages: number;
  items: number;
}

export interface IngestableEntry {
  localId: string;
  title: string;
  filePath?: string | null;
  kind?: string;
}

/** 1件のカタログPDFを索引化する。既存の同カタログ索引は置き換える。 */
export async function ingestCatalogEntry(
  entry: IngestableEntry,
  opts: {
    maxPages?: number;
    detThreshold?: number;
    pageScale?: number;
    onProgress?: (p: IngestProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<CatalogIndexMeta> {
  if (!entry.filePath) throw new Error('カタログにPDFファイルパスがありません。');
  const { maxPages = 60, detThreshold = 0.6, pageScale = 2.0, onProgress, signal } = opts;

  const bytes = await readLocalBinaryFile(entry.filePath);
  const buf = new Uint8Array(bytes).buffer;
  const task = loadPdf(buf);
  const pdf = await task.promise;
  const items: CatalogVisionItem[] = [];

  try {
    const totalPages = Math.min(pdf.numPages, maxPages);
    for (let p = 1; p <= totalPages; p++) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const pageDataUrl = await renderPdfPage(pdf, p, pageScale);
      const dets = await detectFurniture(pageDataUrl, { threshold: detThreshold });
      let idx = 0;
      for (const d of dets) {
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
        const crop = await cropToDataUrl(pageDataUrl, d.box, { maxSize: 384 });
        if (!crop) continue;
        const embedding = await embedImage(crop);
        items.push({
          id: `${entry.localId}:${p}:${idx}`,
          catalogEntryId: entry.localId,
          catalogTitle: entry.title,
          page: p,
          label: d.label,
          score: d.score,
          cropDataUrl: crop,
          embedding,
        });
        idx++;
      }
      onProgress?.({ page: p, totalPages, items: items.length });
    }
  } finally {
    task.destroy();
  }

  const meta: CatalogIndexMeta = {
    catalogEntryId: entry.localId,
    catalogTitle: entry.title,
    indexedAt: new Date().toISOString(),
    itemCount: items.length,
  };
  await saveCatalogItems(meta, items);
  return meta;
}
