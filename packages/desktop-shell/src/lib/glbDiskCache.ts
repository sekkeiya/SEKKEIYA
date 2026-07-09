/**
 * GLB ディスクキャッシュ — account_root/GLBCache/ への保存と asset:// URL 解決。
 *
 * フロー:
 *  1. メモリキャッシュ（MEM_CACHE）に hit → 即返す（同期）
 *  2. Tauri `get_model_local_path` で disk hit → asset:// 変換してキャッシュ
 *  3. miss → `ensure_model_cached` でダウンロード → asset:// 変換してキャッシュ
 *
 * 保存先: %USERPROFILE%\SEKKEIYA\Accounts\<user>\GLBCache\<modelId>.glb
 * （Tauri 側 account_root() が決定するため、JS 側では知らなくてよい）
 */

import { convertFileSrc, invoke } from "@tauri-apps/api/core";

// in-memory キャッシュ: modelId → asset:// URL
const MEM_CACHE = new Map<string, string>();

function toAssetUrl(osPath: string): string {
  // Windows のバックスラッシュを正規化しないと asset.localhost のスコープ照合に
  // 失敗して 403 になる（RightPanelModelViewer と同じ対策）
  return convertFileSrc(osPath.replace(/\\/g, "/"));
}

/**
 * GLB が disk にあれば asset:// URL を返す。なければ null。
 * メモリキャッシュを先にチェックするので 2 回目は同期的に高速。
 */
export async function resolveGlbUrl(modelId: string): Promise<string | null> {
  if (!modelId) return null;
  const cached = MEM_CACHE.get(modelId);
  if (cached) return cached;

  try {
    const osPath: string = await invoke("get_model_local_path", {
      modelId,
      ext: "glb",
    });
    if (osPath) {
      const url = toAssetUrl(osPath);
      MEM_CACHE.set(modelId, url);
      return url;
    }
  } catch {
    // disk に無い場合は invoke がエラーを返す（正常ケース）
  }
  return null;
}

/**
 * GLB をディスクキャッシュに保存し、asset:// URL を返す。
 * 既にキャッシュ済みなら再ダウンロードしない。
 */
export async function ensureGlbCached(
  modelId: string,
  downloadUrl: string
): Promise<string> {
  if (!modelId || !downloadUrl) return downloadUrl;

  const cached = MEM_CACHE.get(modelId);
  if (cached) return cached;

  try {
    const osPath: string = await invoke("ensure_model_cached", {
      modelId,
      ext: "glb",
      downloadUrl,
    });
    if (osPath) {
      const url = toAssetUrl(osPath);
      MEM_CACHE.set(modelId, url);
      return url;
    }
  } catch (e) {
    console.warn("[glbDiskCache] ensure_model_cached failed, falling back to network URL:", e);
  }
  return downloadUrl;
}

/**
 * 同期メモリキャッシュのみ参照。
 * resolveGlbUrl / ensureGlbCached が一度成功していれば返る。
 */
export function getGlbLocalUrlSync(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined;
  return MEM_CACHE.get(modelId);
}
