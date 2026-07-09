// ──────────────────────────────────────────────────────────────────────────────
// 3Dモデルを Rhino / Blender へ配置（外部アプリで開く）共通ロジック。
// DssModelCard のホバーメニューと、DssDashboard の選択バー一括配置の両方から使う。
// ──────────────────────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import { resolveDownloadUrl, getCanonicalModelId, getAvailableFormatsFromModel } from './modelUtils';
import { getModelLocalPathCached, invalidateModelLocalPathCacheByModelId } from '../../../lib/modelLocalPathCache';
import { useAppStore } from '../../../store/useAppStore';
import { useDssSyncStore } from '../../../store/useDssSyncStore';

export type DccApp = 'rhino' | 'blender';

/** モデルが対象アプリで開ける形式を持つか（rhino=3dm/glb, blender=blend/glb）。 */
export function pickDccExt(model: any, app: DccApp): string | null {
  const f = getAvailableFormatsFromModel(model);
  if (app === 'rhino') {
    if (f.has3dm) return '3dm';
    if (f.hasGlb) return 'glb';
    return null;
  }
  if (f.hasBlend) return 'blend';
  if (f.hasGlb) return 'glb';
  return null;
}

export function canPlaceInDcc(model: any, app: DccApp): boolean {
  return !!model && !model.isProjectItem && pickDccExt(model, app) !== null;
}

/**
 * 1モデルを Rhino / Blender で開く。ローカルキャッシュが無ければダウンロードしてから開く。
 * DssModelCard.handleSelectTarget の中核と等価。
 */
export async function openModelInDcc(model: any, app: DccApp): Promise<void> {
  const modelId = getCanonicalModelId(model) || model?.id;
  if (!modelId) throw new Error('モデルIDがありません');
  const ext = pickDccExt(model, app);
  if (!ext) {
    throw new Error(app === 'rhino' ? 'Rhinoで開ける形式(3dm/glb)がありません' : 'Blenderで開ける形式(blend/glb)がありません');
  }

  useAppStore.getState().setGlobalLaunchingTool(app);
  try {
    let filePath = await getModelLocalPathCached(modelId, ext);
    if (!filePath) {
      const url = await resolveDownloadUrl(model, ext, modelId);
      if (!url) throw new Error('ダウンロードURLを解決できませんでした');
      await invoke('ensure_model_cached', { modelId, ext, downloadUrl: url });
      invalidateModelLocalPathCacheByModelId(modelId);
      filePath = await getModelLocalPathCached(modelId, ext);
    }
    await invoke(app === 'rhino' ? 'open_model_in_rhino' : 'open_model_in_blender', { modelId, ext });
    if (filePath) useDssSyncStore.getState().registerActiveModel(modelId, filePath);
  } finally {
    useAppStore.getState().setGlobalLaunchingTool(null);
  }
}
