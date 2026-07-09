/**
 * visionCategorize
 * ------------------------------------------------------------------
 * アップロード対象のサムネイル画像を vision LLM(Cloud Function `categorizeModelImage`)
 * に送り、構造化カテゴリ(macro/main/sub) + マテリアル + タグを取得する。
 *
 * - 画像はアップロード前にローカル生成した GLB サムネイル(webp blob)を base64 で送る。
 *   → アセット保存前でも呼べる(既存 analyzeDriveAsset は保存済み assetId が必要なため不可)。
 * - taxonomy(ユーザーのカテゴリ階層)を一緒に渡し、LLM には「この中から選べ」と制約する。
 *   → 返ってくる値が必ず有効なカテゴリになり、自動レイアウト等での誤りを防ぐ。
 * - Function 未デプロイ/失敗時は null を返し、呼び出し側はルールベースにフォールバックする。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../lib/firebase/client';

export interface VisionCategory {
  macroCategory: string;
  mainCategory: string;
  subCategory: string;
  materials: string[];
  tags: string[];
  /** 0..1。LLM が返さなければ undefined */
  confidence?: number;
  /** Gemini が提案する商品名風タイトル。空文字の場合はルールベースタイトルを維持する。 */
  suggestedTitle?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s); // data URL の prefix を除去
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export async function categorizeByVision(params: {
  thumbnailBlob?: Blob | null;
  imageUrl?: string | null;
  title?: string;
  /** ルールベースのタグ。サーバ側の類似モデル検索(RAG)のクエリに使う */
  ruleTags?: string[];
  dimensionsMm?: { width?: string | number; depth?: string | number; height?: string | number } | null;
  mergedCategoryMap?: Record<string, Record<string, string[]>> | null;
  timeoutMs?: number;
}): Promise<VisionCategory | null> {
  try {
    let imageBase64: string | undefined;
    let mimeType: string | undefined;

    if (params.thumbnailBlob) {
      imageBase64 = await blobToBase64(params.thumbnailBlob);
      mimeType = params.thumbnailBlob.type || 'image/webp';
    }
    if (!imageBase64 && !params.imageUrl) return null;

    const fn = httpsCallable(functions, 'categorizeModelImage', {
      timeout: params.timeoutMs ?? 30000,
    });
    const res = await fn({
      imageBase64,
      mimeType,
      imageUrl: params.imageUrl || null,
      title: params.title || '',
      ruleTags: params.ruleTags || [],
      dimensionsMm: params.dimensionsMm || null,
      taxonomy: params.mergedCategoryMap || null,
    });

    const data = (res?.data || {}) as any;
    if (!data || (!data.mainCategory && !data.macroCategory && !(data.tags?.length))) {
      return null;
    }
    return {
      macroCategory: data.macroCategory || data.type || '',
      mainCategory: data.mainCategory || '',
      subCategory: data.subCategory || '',
      materials: Array.isArray(data.materials) ? data.materials : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
      suggestedTitle: typeof data.suggestedTitle === 'string' ? data.suggestedTitle.trim() : '',
    };
  } catch (err) {
    // Function 未デプロイ・権限・タイムアウト等 → 静かにフォールバック
    console.warn('[Vision Categorize] unavailable/failed, falling back to rules:', err);
    return null;
  }
}
