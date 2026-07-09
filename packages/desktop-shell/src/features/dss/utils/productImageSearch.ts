// ──────────────────────────────────────────────────────────────────────────────
// S.Models「選択中の3Dモデルを画像検索して実在する商品を探す」機能のバックエンド。
//
// 方針: A. 逆画像検索 + 自動アップロード
//   - クラウド保存済み/公開モデル … 既存の公開 thumbnailUrl をそのまま使う
//   - ローカルモデル … GLB からサムネ画像を生成し、Firebase Storage に一時アップロード
//     して公開 URL を得る（逆画像検索サービスは「画像 URL」を要求するため）
//
// エンジン（すべて画像 URL を渡す逆画像検索。モデル名テキスト検索は精度が出ないため不採用）:
//   - Google Lens … 逆画像検索＋商品マッチ（一致商品/類似商品を表示）
//   - Yandex      … 逆画像検索（商品・出所特定に強い）
//   - Bing        … Visual Search 逆画像検索
// ──────────────────────────────────────────────────────────────────────────────

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { resolveGlbUrl } from '../hooks/useLocalModelThumbnail';
import { generateThumbnailFromGlb } from '../upload/utils/generateThumbnailFromGlb';

export type SearchEngine = 'lens' | 'yandex' | 'bing';

// すべて画像（公開 URL）を使う逆画像検索エンジン。
export const SEARCH_ENGINES: { key: SearchEngine; label: string }[] = [
  { key: 'lens', label: 'Google Lens（画像検索）' },
  { key: 'yandex', label: 'Yandex（画像検索）' },
  { key: 'bing', label: 'Bing（画像検索）' },
];

/** Tauri デスクトップ webview では window.open が機能しないため、plugin-opener で外部ブラウザを開く（Web では window.open にフォールバック）。 */
export function openExternalUrl(url: string): void {
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => { if (openUrl) openUrl(url); else window.open(url, '_blank'); })
    .catch(() => window.open(url, '_blank'));
}

/** GLB からプレビュー画像 Blob を生成する（逆画像検索の一時アップロード/ローカル照合のクエリ用）。 */
export async function getModelImageBlob(model: any): Promise<Blob | null> {
  const glbUrl = await resolveGlbUrl(model);
  if (!glbUrl) return null;
  try {
    const res = await fetch(glbUrl);
    const buf = await res.arrayBuffer();
    const file = new File([buf], 'preview.glb', { type: 'model/gltf-binary' });
    const { blob } = await generateThumbnailFromGlb(file as any, { width: 768, height: 576 });
    return blob ?? null;
  } catch (e) {
    console.warn('[productImageSearch] thumbnail generation failed', e);
    return null;
  }
}

/** ローカル照合用のクエリ画像を返す。公開サムネがあれば URL、無ければ GLB から生成した Blob。 */
export async function getModelQueryImage(model: any): Promise<Blob | string | null> {
  const existing = model?.thumbnailUrl || model?.imageUrl;
  if (typeof existing === 'string' && /^https?:\/\//i.test(existing)) return existing;
  return await getModelImageBlob(model);
}

/**
 * 逆画像検索に渡せる公開画像 URL を返す。
 * - 既に公開 thumbnailUrl/imageUrl があればそれを使う
 * - ローカルモデルはサムネを生成して Firebase Storage に一時アップロードする
 */
export async function ensurePublicImageUrl(model: any, uid: string | null): Promise<string> {
  const existing = model?.thumbnailUrl || model?.imageUrl;
  if (typeof existing === 'string' && /^https?:\/\//i.test(existing)) return existing;

  if (!uid) {
    throw new Error('ローカルモデルの画像検索には一時アップロードが必要です。ログインしてください。');
  }
  const blob = await getModelImageBlob(model);
  if (!blob) {
    throw new Error('モデルのプレビュー画像を生成できませんでした。');
  }
  const id = String(model?.id || 'model').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const ext = (blob.type && blob.type.includes('png')) ? 'png' : (blob.type && blob.type.includes('jpeg')) ? 'jpg' : 'webp';
  const path = `imageSearch/${uid}/${id}-${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/webp' });
  return await getDownloadURL(storageRef);
}

/** エンジンごとの逆画像検索 URL を組み立てる（すべて公開画像 URL を渡す）。 */
function buildEngineUrl(engine: SearchEngine, imageUrl: string): string {
  const img = encodeURIComponent(imageUrl);
  switch (engine) {
    case 'lens':
      return `https://lens.google.com/uploadbyurl?url=${img}`;
    case 'yandex':
      return `https://yandex.com/images/search?rpt=imageview&url=${img}`;
    case 'bing':
      return `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${img}`;
    default:
      return `https://lens.google.com/uploadbyurl?url=${img}`;
  }
}

/**
 * 選択中モデルを指定エンジンで逆画像検索する。
 * 公開画像 URL を確保（ローカルモデルは必要に応じて一時アップロード）してから開く。
 */
export async function runProductSearch(engine: SearchEngine, model: any, uid: string | null): Promise<void> {
  const imageUrl = await ensurePublicImageUrl(model, uid);
  openExternalUrl(buildEngineUrl(engine, imageUrl));
}
