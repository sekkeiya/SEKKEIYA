import { useSurfaceFinishStore } from '../store/useSurfaceFinishStore';
import { useSurfacePatternStore } from '../store/useSurfacePatternStore';
import { useLightingStore } from '../store/useLightingStore';
import { useItemMaterialRegistryStore } from '../store/itemMaterialRegistryStore';
import { useItemSwapRegistryStore } from '../store/itemSwapRegistryStore';
import { usePatternOverrideStore } from '../store/patternOverrideStore';
import { loadSurfaceData } from '../api/surfaceFinishApi';
import { loadLayoutState } from '../api/layoutStateApi';
import { stripUndefinedDeep, type PatternSnapshot } from '../utils/layoutPatterns';

/**
 * 「現在の見た目」を差分スナップショットとして取り出す。
 *
 * 家具の選択は両レジストリの currentId から拾う（レジストリは register 時に currentId を
 * 積んでいる）。元のまま（default / base）のアイテムは保存しない＝差分のみ持つ。
 * レジストリは描画中のアイテムしか載らないため、画面外の家具は「元のまま」として扱われる。
 */
export function capturePattern(): PatternSnapshot {
  const finishes = Object.values(useSurfaceFinishStore.getState().finishes);
  const activePatterns = useSurfacePatternStore.getState().activePatterns;
  const lights = useLightingStore.getState().lights;

  const itemMaterials: Record<string, string> = {};
  useItemMaterialRegistryStore.getState().map.forEach((entry, itemId) => {
    if (entry.currentId && entry.currentId !== 'default') itemMaterials[itemId] = entry.currentId;
  });
  const itemSwaps: Record<string, string> = {};
  useItemSwapRegistryStore.getState().map.forEach((entry, itemId) => {
    if (entry.currentId && entry.currentId !== 'base') itemSwaps[itemId] = entry.currentId;
  });

  return stripUndefinedDeep<PatternSnapshot>({
    lights,
    surface: { finishes, activePatterns },
    itemMaterials,
    itemSwaps,
  });
}

/** パターンを各ストアへ一括適用する（未設定のフィールドは触らない＝現状維持）。 */
export function applyPattern(snap: PatternSnapshot): void {
  if (snap.surface?.finishes) useSurfaceFinishStore.getState().replaceAll(snap.surface.finishes);
  if (snap.surface?.activePatterns) useSurfacePatternStore.getState().replaceActive(snap.surface.activePatterns);
  if (snap.lights) useLightingStore.getState().setLights(snap.lights);
  usePatternOverrideStore.getState().setAll(snap.itemMaterials ?? {}, snap.itemSwaps ?? {});
}

/**
 * 「デフォルト」（パターン未選択）へ戻す。保存済みのプラン既定を Firestore から読み直す
 * ——各ローダーと同じ経路で、パターン適用で上書きしたストアを素の状態へ復帰させる。
 */
export async function restoreDefaults(
  projectId: string, workspaceId: string, layoutKey: string, baseKey: string,
): Promise<void> {
  usePatternOverrideStore.getState().clear();
  try {
    const surface = await loadSurfaceData(projectId, workspaceId, layoutKey);
    useSurfaceFinishStore.getState().replaceAll(surface.finishes || []);
    useSurfacePatternStore.getState().replaceActive(surface.activePatterns || {});
  } catch (e) {
    console.warn('[patternSnapshot] 面仕上げの復帰に失敗', e);
  }
  try {
    const state = await loadLayoutState(projectId, workspaceId, baseKey);
    useLightingStore.getState().setLights(state?.lights || []);
  } catch (e) {
    console.warn('[patternSnapshot] 照明の復帰に失敗', e);
  }
}
