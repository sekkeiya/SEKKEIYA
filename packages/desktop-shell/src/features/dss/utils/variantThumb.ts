import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';

/** データURL(JPEG) を Blob に変換する。 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const [, mime, b64] = m;
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/**
 * 素材パターンのサムネイルを Storage へ保存し、公開URLを返す。
 * 保存先: assets/{modelId}/variants/{variantId}.jpg
 * 失敗しても致命的ではない（ギャラリーはスウォッチ表示にフォールバックする）ため null を返す。
 */
/**
 * 3Dビューアの現在の描画を、このモデルのサムネイルとして保存する。
 * 保存先: assets/{modelId}/thumbnail_v2.jpg（旧サムネとは別パスなので巻き戻せる）
 * 戻り値は公開URL。失敗時は null。
 */
export async function uploadModelThumbFromView(
  modelId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    const sRef = ref(storage, `assets/${modelId}/thumbnail_v2.jpg`);
    await uploadBytes(sRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(sRef);
  } catch (e) {
    console.warn('[uploadModelThumbFromView] upload failed', e);
    return null;
  }
}

export async function uploadVariantThumb(
  modelId: string,
  variantId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    const sRef = ref(storage, `assets/${modelId}/variants/${variantId}.jpg`);
    await uploadBytes(sRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(sRef);
  } catch (e) {
    console.warn('[variantThumb] upload failed', e);
    return null;
  }
}
