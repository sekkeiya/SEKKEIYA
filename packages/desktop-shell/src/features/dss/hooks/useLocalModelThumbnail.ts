import { useEffect, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// S.Models「Local Models」のグリッドカード用サムネを GLB から遅延生成する。
// - glb/gltf 本体・隣接コンパニオン GLB は model.glbUrl をそのまま使う
// - 3dm/blend は ensure_local_preview_glb でオンデマンド変換した GLB を使う
// 生成結果は modelId 単位でメモリキャッシュし、再マウント/再スクロールで再生成しない。
// ──────────────────────────────────────────────────────────────────────────────

const thumbCache = new Map<string, string>();      // modelId → objectURL
const inflight = new Map<string, Promise<string | null>>();

// WebGL コンテキスト枯渇を防ぐため、サムネ生成の同時実行数を制限するセマフォ。
// generateThumbnailFromGlb は1回ごとに WebGLRenderer を作るため、多数同時だと
// ブラウザのコンテキスト上限（〜16）を超えて失敗し、サムネが空白になる。
const THUMB_CONCURRENCY = 3;
let activeThumbs = 0;
const thumbWaiters: Array<() => void> = [];
async function acquireThumbSlot(): Promise<void> {
  if (activeThumbs < THUMB_CONCURRENCY) { activeThumbs++; return; }
  await new Promise<void>((resolve) => thumbWaiters.push(resolve));
  activeThumbs++;
}
function releaseThumbSlot(): void {
  activeThumbs--;
  const next = thumbWaiters.shift();
  if (next) next();
}

export async function resolveGlbUrl(model: any): Promise<string | null> {
  if (model?.glbUrl) return model.glbUrl as string;
  const ext = String(model?.topExt || '').toLowerCase();
  if ((ext === '3dm' || ext === 'blend') && model?.localPath) {
    try {
      const { invoke, convertFileSrc, isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) return null;
      const glbPath = await invoke<string>('ensure_local_preview_glb', { path: model.localPath });
      return glbPath ? convertFileSrc(String(glbPath).replace(/\\/g, '/')) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function buildThumb(model: any): Promise<string | null> {
  const glbUrl = await resolveGlbUrl(model);
  if (!glbUrl) return null;
  await acquireThumbSlot();
  try {
    const res = await fetch(glbUrl);
    const buf = await res.arrayBuffer();
    const file = new File([buf], 'preview.glb', { type: 'model/gltf-binary' });
    const { generateThumbnailFromGlb } = await import('../upload/utils/generateThumbnailFromGlb');
    const { blob } = await generateThumbnailFromGlb(file as any, { width: 512, height: 384 });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('[useLocalModelThumbnail] failed', e);
    return null;
  } finally {
    releaseThumbSlot();
  }
}

/** ローカルモデル用のサムネ URL を返す（非ローカル/生成不可なら null）。 */
export function useLocalModelThumbnail(model: any): string | null {
  const id: string | undefined = model?.id;
  const [thumb, setThumb] = useState<string | null>(
    id && thumbCache.has(id) ? thumbCache.get(id)! : null,
  );

  useEffect(() => {
    if (!model?.isLocal || !id) { setThumb(null); return; }
    if (thumbCache.has(id)) { setThumb(thumbCache.get(id)!); return; }

    let cancelled = false;
    let promise = inflight.get(id);
    if (!promise) {
      promise = buildThumb(model);
      inflight.set(id, promise);
    }
    promise.then((url) => {
      inflight.delete(id);
      if (url) thumbCache.set(id, url);
      if (!cancelled && url) setThumb(url);
    });
    return () => { cancelled = true; };
  }, [id, model?.isLocal, model?.glbUrl, model?.localPath, model?.topExt]);

  return thumb;
}
