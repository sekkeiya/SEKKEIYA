import { getCanonicalModelId } from './modelUtils';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';

/**
 * S.Model 詳細画面の複数の保存経路（概要フォーム・ウォークスルー設定・サムネイル・実在商品の削除）で
 * 共通の「プロジェクトへ複製されたアイテムかどうかで書き込み先を切り替える」ロジックを1箇所に集約する。
 *
 * 判定・分岐は `DssRightPanel.tsx` の `DssModelInfoPanel.persistModelInfo` の `isProjectAsset` 分岐を
 * 踏襲する（元々 OverviewSection.persistOverview だけがこれを踏襲しており、他の保存経路は
 * 無条件で `assets/{canonicalId}`（グローバル資産）へ書いていた——Task 11 レビュー Finding I5）。
 * プロジェクト複製アイテムを編集中にウォークスルー設定やサムネイルを保存すると、プロジェクト側には
 * 一切反映されず、かつコピー元のグローバル資産はユーザーが所有者とは限らないため Firestore rules に
 * 拒否されて保存自体が失敗しうる——という「同じ画面内で書き込み先がバラバラ」な状態を解消する。
 *
 * 2026-08-01（プラン別モデル設定 仕様 §5）から `DssMaterialPresets` / `DssFurnitureSwap` も
 * この経路に統一した（素材/置き換えの編集がプロジェクト複製でグローバルを汚さないように）。
 */
export async function persistAssetPatch(
  model: any,
  activeProjectId: string | null | undefined,
  patch: Record<string, any>,
): Promise<void> {
  const sourceModelId = model?.sourceModelId || model?.metadata?.sourceModelId || model?.originalModelId;
  const isProjectAsset = !!sourceModelId;

  if (isProjectAsset && activeProjectId) {
    // 主書き込み: プロジェクト資産。失敗したら呼び出し元の catch で保存失敗として表面化させる
    // （ここが正のデータなので握りつぶさない）。
    const { projectAssetsApi } = await import('../../projects/api/projectAssetsApi');
    await projectAssetsApi.updateAsset(activeProjectId, model.id, patch);

    // グローバル資産（コピー元）へのベストエフォート同期。ユーザーが所有者でなければ
    // Firestore rules に拒否されるため、失敗は握りつぶす（persistModelInfo と同じ方針）。
    try {
      await WorkspaceItemRepository.updateGlobalAsset(sourceModelId, patch);
    } catch (err) {
      console.warn('[persistAssetPatch] グローバル資産への同期に失敗（所有者でない可能性）', err);
    }
    return;
  }

  // プロジェクト複製ではない通常のグローバル資産。従来どおりここが唯一の書き込み先。
  const canonicalId = getCanonicalModelId(model) || model?.id;
  if (!canonicalId) return;
  await WorkspaceItemRepository.updateGlobalAsset(canonicalId, patch);
}
