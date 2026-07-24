// ──────────────────────────────────────────────────────────────────────────────
// 既存モデルのサムネイルを、現在の生成設定で作り直す。
//
// 背景: 以前のサムネイル生成はカメラを引き過ぎ（外接球の約1.74倍遠く）かつ
// 800x450 だったため、被写体が小さく余白だらけで、大きな詳細ビューアでは
// 引き伸ばされて画質も落ちていた。generateThumbnailFromGlb を修正した今、
// GLB から作り直せば構図と解像度の両方が改善する。
//
// 処理は「GLB を取得 → 画面外レンダリング → Storage へアップロード →
// asset.thumbnailUrl を差し替え」。表示は不要なので一括で回せる。
// ──────────────────────────────────────────────────────────────────────────────

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { resolveGlbUrl } from '../hooks/useLocalModelThumbnail';
import { generateThumbnailFromGlb } from '../upload/utils/generateThumbnailFromGlb';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { getCanonicalModelId } from './modelUtils';

export interface ThumbRegenProgress {
  index: number;
  total: number;
  title: string;
  phase: 'load' | 'render' | 'upload' | 'done' | 'skip' | 'error';
  message?: string;
}

export interface ThumbRegenResult {
  modelId: string;
  title: string;
  thumbnailUrl?: string;
  skipped?: boolean;
  error?: string;
}

/** サムネイルの生成サイズ。詳細ビューア（約1400px幅）で破綻しない解像度にする。 */
const THUMB_SIZE = 1024;

/**
 * 選択されたモデルのサムネイルを作り直す。
 * GLB を持たないモデルは skip する（作り直す材料が無いため）。
 */
export async function bulkRegenerateThumbnails(
  models: any[],
  opts: { onProgress?: (p: ThumbRegenProgress) => void; signal?: AbortSignal } = {},
): Promise<ThumbRegenResult[]> {
  const { onProgress, signal } = opts;
  const out: ThumbRegenResult[] = [];

  for (let i = 0; i < models.length; i++) {
    if (signal?.aborted) break;
    const model = models[i];
    const title = model?.title || model?.name || `モデル${i + 1}`;
    const canonicalId = getCanonicalModelId(model) || model?.id;

    try {
      onProgress?.({ index: i, total: models.length, title, phase: 'load' });
      const glbUrl = await resolveGlbUrl(model);
      if (!glbUrl || !canonicalId) {
        out.push({ modelId: model?.id, title, skipped: true });
        onProgress?.({ index: i, total: models.length, title, phase: 'skip', message: 'GLB なし' });
        continue;
      }

      const res = await fetch(glbUrl);
      if (!res.ok) throw new Error(`GLB取得失敗 (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      const file = new File([buf], 'model.glb', { type: 'model/gltf-binary' });

      if (signal?.aborted) break;
      onProgress?.({ index: i, total: models.length, title, phase: 'render' });
      const { blob } = await generateThumbnailFromGlb(file as any, {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
      });
      if (!blob) throw new Error('サムネイル生成に失敗しました');

      if (signal?.aborted) break;
      onProgress?.({ index: i, total: models.length, title, phase: 'upload' });
      // 旧サムネイルとは別パスに置き、URL の差し替えで切り替える（巻き戻しやすくするため）。
      const sRef = ref(storage, `assets/${canonicalId}/thumbnail_v2.webp`);
      await uploadBytes(sRef, blob, { contentType: 'image/webp' });
      const thumbnailUrl = await getDownloadURL(sRef);

      await WorkspaceItemRepository.updateGlobalAsset(canonicalId, { thumbnailUrl });

      out.push({ modelId: model?.id, title, thumbnailUrl });
      onProgress?.({ index: i, total: models.length, title, phase: 'done' });
    } catch (e: any) {
      console.error(`[bulkRegenerateThumbnails] #${i} "${title}" failed`, e);
      out.push({ modelId: model?.id, title, error: e?.message || '失敗' });
      onProgress?.({ index: i, total: models.length, title, phase: 'error', message: e?.message || '失敗' });
    }
  }

  return out;
}
