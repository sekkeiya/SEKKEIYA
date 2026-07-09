// ──────────────────────────────────────────────────────────────────────────────
// ローカル視覚検索エンジン（transformers.js / ONNX を WebView 内で実行）。
//
// 用途:
//   - DETR で家具を物体検出 → カタログページから商品を自動クロップ
//   - CLIP で画像を埋め込みベクトル化 → 3Dモデルサムネとカタログ商品の類似度照合
//
// すべて端末内で完結（カタログは非公開）。モデルは初回に HF Hub から取得しキャッシュ。
// ライブラリは重いので dynamic import で遅延ロードする。
// ──────────────────────────────────────────────────────────────────────────────

export interface Detection {
  label: string;
  score: number;
  // 0..1 正規化されたボックス（左上原点）
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

// COCO クラスのうちインテリア/家具に相当するラベル。
export const FURNITURE_LABELS = new Set<string>([
  'chair', 'couch', 'bed', 'dining table', 'potted plant', 'tv',
  'refrigerator', 'oven', 'sink', 'toilet', 'vase', 'clock', 'book',
  'bench', 'bottle', 'cup', 'bowl', 'laptop', 'keyboard',
]);

const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
const DETR_MODEL = 'Xenova/detr-resnet-50';

type AnyPipeline = (input: any, options?: any) => Promise<any>;

let _embedderPromise: Promise<AnyPipeline> | null = null;
let _detectorPromise: Promise<AnyPipeline> | null = null;
let _rawImageCtor: any = null;

async function loadLib() {
  const lib: any = await import('@huggingface/transformers');
  // ブラウザ/WebView では WASM/WebGPU を使い、ローカルモデル探索は無効化（HF Hub から取得）。
  if (lib.env) {
    lib.env.allowLocalModels = false;
  }
  _rawImageCtor = lib.RawImage;
  return lib;
}

async function getEmbedder(): Promise<AnyPipeline> {
  if (!_embedderPromise) {
    _embedderPromise = (async () => {
      const lib = await loadLib();
      return await lib.pipeline('image-feature-extraction', CLIP_MODEL) as AnyPipeline;
    })();
  }
  return _embedderPromise;
}

async function getDetector(): Promise<AnyPipeline> {
  if (!_detectorPromise) {
    _detectorPromise = (async () => {
      const lib = await loadLib();
      return await lib.pipeline('object-detection', DETR_MODEL) as AnyPipeline;
    })();
  }
  return _detectorPromise;
}

/** Blob / dataURL / HTMLCanvasElement を transformers.js が扱える画像に変換する。 */
async function toImageInput(src: Blob | string | HTMLCanvasElement): Promise<any> {
  if (!_rawImageCtor) await loadLib();
  if (typeof src === 'string') {
    return await _rawImageCtor.fromURL(src);
  }
  if (src instanceof Blob) {
    return await _rawImageCtor.fromBlob(src);
  }
  // HTMLCanvasElement → Blob 経由
  const blob: Blob = await new Promise((resolve, reject) => {
    (src as HTMLCanvasElement).toBlob((b) => b ? resolve(b) : reject(new Error('canvas toBlob failed')), 'image/png');
  });
  return await _rawImageCtor.fromBlob(blob);
}

/** CLIP 画像埋め込み（L2 正規化済み number[]）を返す。 */
export async function embedImage(src: Blob | string | HTMLCanvasElement): Promise<number[]> {
  const embedder = await getEmbedder();
  const image = await toImageInput(src);
  const out: any = await embedder(image, { pooling: 'mean', normalize: false });
  const data: Float32Array = out.data ?? out[0]?.data ?? out;
  const vec = Array.from(data as Float32Array);
  // L2 正規化（cosine = dot にする）
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

/** DETR 物体検出。閾値以上の検出を 0..1 正規化ボックスで返す。 */
export async function detectObjects(
  src: Blob | string | HTMLCanvasElement,
  options: { threshold?: number } = {},
): Promise<Detection[]> {
  const detector = await getDetector();
  const image = await toImageInput(src);
  const threshold = options.threshold ?? 0.5;
  // percentage:true で 0..1 ボックスを得る（transformers.js のオプション）。
  const raw: any[] = await detector(image, { threshold, percentage: true });
  return (raw || []).map((d) => ({
    label: String(d.label),
    score: Number(d.score),
    box: {
      xmin: Number(d.box.xmin),
      ymin: Number(d.box.ymin),
      xmax: Number(d.box.xmax),
      ymax: Number(d.box.ymax),
    },
  }));
}

/** 検出のうち家具/インテリア相当のものだけ返す。 */
export async function detectFurniture(
  src: Blob | string | HTMLCanvasElement,
  options: { threshold?: number } = {},
): Promise<Detection[]> {
  const all = await detectObjects(src, options);
  return all.filter((d) => FURNITURE_LABELS.has(d.label));
}

/** 正規化済みベクトル同士の cosine 類似度（= 内積）。 */
export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

/** モデルのプリロード（任意。初回検索のもたつきを減らす用途）。 */
export async function warmupVision(): Promise<void> {
  await Promise.all([getEmbedder(), getDetector()]);
}
