/**
 * 画像の視覚的類似度判定 — dHash（difference hash）ベース。
 *
 * Tauri 環境（デスクトップ）: Rust バックエンドで画像をダウンロード・リサイズ・ハッシュ計算。
 *   → ブラウザ Canvas の CORS 制限を完全回避。Firebase Storage や local path も問題なく読める。
 *
 * Web 環境（フォールバック）: Canvas API でハッシュ計算。CORS 設定済み画像のみ有効。
 *
 * dHash: 9×8 にリサイズ → グレースケール → 隣接ピクセルの大小比較 → 64 ビット列。
 * ハミング距離の目安:
 *   0    = 完全一致（同一ファイル相当）
 *   1〜8  = 人の目ではほぼ区別できない
 *   9〜15 = 気づく人は気づく程度の差異
 *   16+  = 明らかに違う
 */

export function hammingDistance(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}

export interface SimilarGroup<T> {
  keep: T;
  remove: T[];
  minDist: number;
}

// ── Tauri バックエンド呼び出し ────────────────────────────────────────────

async function isTauri(): Promise<boolean> {
  try {
    return !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
}

/** Rust の hash_images_dhash コマンドで一括ハッシュ計算（CORS フリー）。 */
async function computeHashesTauri(
  items: { id: string; url: string }[],
): Promise<Map<string, number[] | null>> {
  const { invoke } = await import('@tauri-apps/api/core');
  const results: { id: string; hash: number[] | null }[] = await invoke('hash_images_dhash', { items });
  const map = new Map<string, number[] | null>();
  results.forEach((r) => map.set(r.id, r.hash));
  return map;
}

// ── Canvas フォールバック（Web 環境） ─────────────────────────────────────

const HASH_W = 9;
const HASH_H = 8;

async function computeHashCanvas(url: string): Promise<number[] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(t);
      const canvas = document.createElement('canvas');
      canvas.width = HASH_W;
      canvas.height = HASH_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, HASH_W, HASH_H);
      try {
        const data = ctx.getImageData(0, 0, HASH_W, HASH_H).data;
        const gray: number[][] = Array.from({ length: HASH_H }, (_, y) =>
          Array.from({ length: HASH_W }, (_, x) => {
            const i = (y * HASH_W + x) * 4;
            return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }),
        );
        const bits: number[] = [];
        for (let y = 0; y < HASH_H; y++) {
          for (let x = 0; x < HASH_W - 1; x++) {
            bits.push(gray[y][x] > gray[y][x + 1] ? 1 : 0);
          }
        }
        resolve(bits);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

// ── 類似グループ検出（Union-Find） ───────────────────────────────────────

function groupByHashes<T>(
  items: T[],
  hashes: (number[] | null)[],
  keepPriority: (item: T) => number,
  threshold: number,
): SimilarGroup<T>[] {
  const parent = Array.from({ length: items.length }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  for (let i = 0; i < items.length; i++) {
    if (!hashes[i]) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (!hashes[j]) continue;
      if (hammingDistance(hashes[i]!, hashes[j]!) <= threshold) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const root = find(i);
    const arr = groups.get(root) || [];
    arr.push(i);
    groups.set(root, arr);
  });

  const result: SimilarGroup<T>[] = [];
  groups.forEach((indices) => {
    if (indices.length <= 1) return;
    const sorted = [...indices].sort((a, b) => keepPriority(items[b]) - keepPriority(items[a]));
    const keepIdx = sorted[0];
    const removeIdxs = sorted.slice(1);
    const minDist = hashes[keepIdx]
      ? Math.min(
          ...removeIdxs
            .filter((ri) => hashes[ri])
            .map((ri) => hammingDistance(hashes[keepIdx]!, hashes[ri]!)),
          64,
        )
      : 64;
    result.push({ keep: items[keepIdx], remove: removeIdxs.map((ri) => items[ri]), minDist });
  });
  return result;
}

// ── 公開 API ──────────────────────────────────────────────────────────────

/**
 * アイテム群を視覚的類似度でグループ化する。
 *
 * @param items         比較対象アイテム配列
 * @param getId         アイテムの一意 ID（Tauri バックエンドへの送受信キーに使用）
 * @param getUrl        ハッシュ計算に使う画像 URL を返す関数（undefined なら比較対象外）
 * @param keepPriority  グループ内で残す 1 件のスコア（高いほど優先）
 * @param threshold     ハミング距離の閾値（≤ threshold なら「類似」）
 * @param onProgress    進捗コールバック (done, total)
 */
export async function detectSimilarByHash<T>(
  items: T[],
  getId: (item: T) => string,
  getUrl: (item: T) => string | undefined,
  keepPriority: (item: T) => number,
  threshold = 8,
  onProgress?: (done: number, total: number) => void,
): Promise<SimilarGroup<T>[]> {
  const urlItems = items
    .map((item) => ({ id: getId(item), url: getUrl(item) || '' }))
    .filter((x) => x.url);

  let hashMap: Map<string, number[] | null>;

  if (await isTauri()) {
    // Tauri: Rust バックエンドで一括計算（バッチ 20 件ずつ進捗通知）
    hashMap = new Map();
    const BATCH = 20;
    for (let i = 0; i < urlItems.length; i += BATCH) {
      const batch = urlItems.slice(i, i + BATCH);
      const partial = await computeHashesTauri(batch);
      partial.forEach((v, k) => hashMap.set(k, v));
      onProgress?.(Math.min(i + BATCH, urlItems.length), urlItems.length);
    }
  } else {
    // Web: Canvas（CORS が設定されていれば機能する）
    hashMap = new Map();
    const CONCURRENCY = 8;
    for (let i = 0; i < urlItems.length; i += CONCURRENCY) {
      const batch = urlItems.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((x) => computeHashCanvas(x.url)));
      batch.forEach((x, j) => hashMap.set(x.id, results[j]));
      onProgress?.(Math.min(i + CONCURRENCY, urlItems.length), urlItems.length);
    }
  }

  // items 配列の順番でハッシュを並べ直す
  const hashes = items.map((item) => {
    const url = getUrl(item);
    return url ? (hashMap.get(getId(item)) ?? null) : null;
  });

  onProgress?.(items.length, items.length);
  return groupByHashes(items, hashes, keepPriority, threshold);
}
