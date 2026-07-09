// ──────────────────────────────────────────────────────────────────────────────
// 複数の3Dモデルへ「AIによる寸法・カテゴリ自動入力」を一括適用する。
// 単体版（DssRightPanel.handleAutoFill）と同じ executeAiAutoFill を使い、
// 各モデルの GLB から寸法を実測＋ルールベースでカテゴリ/タグ等を補完して
// グローバルアセットへ永続化する。GLB 解析（WebGL）が重いので直列実行。
// ──────────────────────────────────────────────────────────────────────────────

import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';
import { resolveDownloadUrl, getCanonicalModelId } from './modelUtils';
import { executeAiAutoFill } from './aiAutoFillService';

export interface AiAutoFillProgress {
  index: number;   // 0-based
  total: number;
  title: string;
  phase: 'analyze' | 'done' | 'error';
  fields?: number; // 補完できた項目数
  message?: string;
}

export interface AiAutoFillResult {
  modelId: string;
  title: string;
  fields: number;          // 補完した項目数
  payload?: any;           // 反映したフィールド（呼び出し側で grid/panel に即時反映するため）
  error?: string;
}

/** 1モデルに AI 自動入力を適用してグローバルアセットへ保存する。 */
async function applyToModel(model: any): Promise<{ fields: number; payload: any }> {
  const canonicalId = getCanonicalModelId(model) || model.id;
  const glbUrl = await resolveDownloadUrl(model, 'glb', canonicalId);
  const res = await executeAiAutoFill(model?.title || model?.name || '', model?.tags || [], glbUrl || '');

  const filled: string[] = [];

  // カテゴリ3階層（res.mainCategory → macroCategory のシフトは単体版と同じ）。
  let macroCategory = model?.macroCategory;
  let mainCategory = model?.mainCategory;
  let subCategory = model?.subCategory;
  if (res.mainCategory) {
    macroCategory = res.mainCategory;
    mainCategory = res.subCategory || '';
    subCategory = res.detailedCategory || '';
    filled.push('macroCategory', 'mainCategory');
    if (res.detailedCategory) filled.push('subCategory');
  }

  let tags = Array.from(new Set([...(model?.tags || []), ...((res.tags) || [])]));
  if (res.tags && res.tags.length) filled.push('tags');
  // 既製品/造作のタグ正規化（単体版 persistModelInfo と同じ）。
  if (macroCategory === '家具 (造作)') {
    if (!tags.includes('造作家具')) tags.push('造作家具');
    tags = tags.filter((t) => t !== '既製品家具');
  } else if (macroCategory === '家具 (既製品)') {
    if (!tags.includes('既製品家具')) tags.push('既製品家具');
    tags = tags.filter((t) => t !== '造作家具');
  }

  const inferredModelType = macroCategory === '建築・空間' ? 'Architecture' : 'Furniture';

  const payload: any = {
    macroCategory,
    mainCategory,
    subCategory,
    modelType: inferredModelType,
    tags,
  };
  if (res.rooms && res.rooms.length) { payload.rooms = Array.from(new Set([...(model?.rooms || []), ...res.rooms])); filled.push('rooms'); }
  if (res.zones && res.zones.length) { payload.zones = Array.from(new Set([...(model?.zones || []), ...res.zones])); filled.push('zones'); }
  if (res.buildingTypes && res.buildingTypes.length) { payload.buildingTypes = Array.from(new Set([...(model?.buildingTypes || []), ...res.buildingTypes])); filled.push('buildingTypes'); }
  if (res.companionClasses && res.companionClasses.length) { payload.companionClasses = Array.from(new Set([...(model?.companionClasses || []), ...res.companionClasses])); filled.push('companionClasses'); }
  if (res.materials && res.materials.length) { payload.materials = Array.from(new Set([...(model?.materials || []), ...res.materials])); filled.push('materials'); }
  if (res.dimensions) {
    payload.dimensions = {
      ...(model?.dimensions || {}),
      width: Number(res.dimensions.width) || 0,
      depth: Number(res.dimensions.depth) || 0,
      height: Number(res.dimensions.height) || 0,
    };
    filled.push('width', 'depth', 'height');
  }

  if (!model?.id) throw new Error('モデルIDがありません');
  await WorkspaceItemRepository.updateGlobalAsset(model.id, payload);
  return { fields: filled.length, payload };
}

/**
 * 複数モデルへ AI 自動入力を一括適用する。直列実行（GLB 解析の WebGL 枯渇回避）。
 */
export async function bulkAiAutoFill(
  models: any[],
  opts: { onProgress?: (p: AiAutoFillProgress) => void; signal?: AbortSignal } = {},
): Promise<AiAutoFillResult[]> {
  const { onProgress, signal } = opts;
  const out: AiAutoFillResult[] = [];
  for (let i = 0; i < models.length; i++) {
    if (signal?.aborted) break;
    const model = models[i];
    const title = model?.title || model?.name || `モデル${i + 1}`;
    try {
      onProgress?.({ index: i, total: models.length, title, phase: 'analyze' });
      const { fields, payload } = await applyToModel(model);
      out.push({ modelId: model.id, title, fields, payload });
      onProgress?.({ index: i, total: models.length, title, phase: 'done', fields });
    } catch (e: any) {
      console.error(`[bulkAiAutoFill] #${i} "${title}" failed`, e);
      out.push({ modelId: model.id, title, fields: 0, error: e?.message || '失敗' });
      onProgress?.({ index: i, total: models.length, title, phase: 'error', message: e?.message || '失敗' });
    }
  }
  return out;
}
