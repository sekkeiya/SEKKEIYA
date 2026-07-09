import { useEffect, useState } from 'react';
import { renderFirstPageCoverFromUrl } from './pdf';
import { dsfUploadService } from '../upload/dsfUploadService';

// セッション内でレンダリング済みの表紙をキャッシュ（id → data URL）。再マウントでも再描画しない。
const coverCache = new Map<string, string>();
// バックフィル（Storage/Firestore への保存）を試行済みの id。多重書き込みを防ぐ。
const backfilled = new Set<string>();

/**
 * ポートフォリオの表紙サムネを返す。
 * - 保存済み thumbnailUrl があればそれを使う。
 * - 無い PDF は downloadUrl から 1 ページ目をその場でレンダリングして表示。
 * - persist=true（編集可能なプロジェクトのアイテム）なら、生成した表紙を一度だけ
 *   Storage/Firestore に保存して次回以降と Gallery でも即表示されるようにする。
 */
export function useCoverThumbnail(item: any, persist = false): string | null {
  const stored: string | null = item?.thumbnailUrl || item?.thumbnail || null;
  const [thumb, setThumb] = useState<string | null>(stored || (item?.id ? coverCache.get(item.id) ?? null : null));

  useEffect(() => {
    if (stored) { setThumb(stored); return; }
    if (!item?.id || !item?.downloadUrl) return;
    if ((item.format || 'pdf').toLowerCase() !== 'pdf') return;

    const cached = coverCache.get(item.id);
    if (cached) { setThumb(cached); return; }

    let active = true;
    (async () => {
      try {
        const { dataUrl, blob } = await renderFirstPageCoverFromUrl(item.downloadUrl);
        if (!active || !dataUrl) return;
        coverCache.set(item.id, dataUrl);
        setThumb(dataUrl);
        // 編集可能なプロジェクトのアイテムなら一度だけ永続化（ベストエフォート）
        if (persist && item.projectId && blob && !backfilled.has(item.id)) {
          backfilled.add(item.id);
          dsfUploadService.backfillCover(item.projectId, item.id, blob).catch((e) => {
            console.warn('[useCoverThumbnail] backfill skipped', e);
          });
        }
      } catch (e) {
        console.warn('[useCoverThumbnail] cover render failed', e);
      }
    })();
    return () => { active = false; };
  }, [item?.id, item?.downloadUrl, stored, persist]);

  return thumb;
}
