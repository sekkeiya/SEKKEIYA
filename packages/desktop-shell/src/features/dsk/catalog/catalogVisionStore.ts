// ──────────────────────────────────────────────────────────────────────────────
// カタログ視覚索引のローカル永続化（IndexedDB）。
// カタログは非公開のため端末内完結。埋め込み(512次元float)＋クロップ画像＋出典を保持。
// ──────────────────────────────────────────────────────────────────────────────

export interface CatalogVisionItem {
  id: string;             // PDF: `${catalogEntryId}:${page}:${index}` / Web: `${catalogEntryId}:p:${productId}`
  catalogEntryId: string; // S.Library LibraryEntry.localId
  catalogTitle: string;
  page: number;           // PDF: 1-based ページ番号 / Web: 0
  label: string;          // 検出クラス（PDF）または商品名（Web）
  score: number;          // 検出スコア（PDF）/ Web は 1
  cropDataUrl: string;    // 表示用画像（PDFはクロップ、Webは商品画像）
  embedding: number[];    // CLIP 埋め込み（L2正規化済み）
  // ── Web 巡回由来の商品メタ（PDF では未設定）──
  sourceType?: 'pdf' | 'web';
  productUrl?: string;    // 商品ページ URL（クリックで開く）
  price?: string;         // 価格テキスト（例 "¥120,000"）
  brand?: string;         // ブランド/メーカー
  siteUrl?: string;       // 登録元サイト URL
  // ── 分類（S.Model と同様にカテゴリ/タグを付与し、Search/Chat 連携で活用）──
  category?: string;      // 例 "家具・什器"
  tags?: string[];        // 例 ["ソファ","家具"]（出典カテゴリ由来）
}

export interface CatalogIndexMeta {
  catalogEntryId: string;
  catalogTitle: string;
  indexedAt: string;      // RFC3339（呼び出し側で付与）
  itemCount: number;
}

const DB_NAME = 'sekkeiya_catalog_vision';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_META = 'meta';

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const os = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        os.createIndex('byCatalog', 'catalogEntryId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'catalogEntryId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode): IDBTransaction {
  return db.transaction(stores, mode);
}

// 全アイテムのメモリキャッシュ。検索（毎キーストローク）やビュー切替で IndexedDB を
// 何度も全件読み直すのを避ける。保存/削除で無効化。
let _itemsCache: CatalogVisionItem[] | null = null;
function invalidateItemsCache() { _itemsCache = null; }

/** 1カタログ分のアイテムを置き換え保存し、メタを更新する。 */
export async function saveCatalogItems(
  meta: CatalogIndexMeta,
  items: CatalogVisionItem[],
): Promise<void> {
  const db = await openDb();
  // 既存の同カタログ分を削除
  await deleteCatalogItems(meta.catalogEntryId);
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS, STORE_META], 'readwrite');
    const itemsStore = t.objectStore(STORE_ITEMS);
    for (const it of items) itemsStore.put(it);
    t.objectStore(STORE_META).put(meta);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  invalidateItemsCache();
}

/** 指定カタログのアイテムとメタを削除する。 */
export async function deleteCatalogItems(catalogEntryId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS, STORE_META], 'readwrite');
    const idx = t.objectStore(STORE_ITEMS).index('byCatalog');
    const range = IDBKeyRange.only(catalogEntryId);
    const cur = idx.openCursor(range);
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { c.delete(); c.continue(); }
    };
    t.objectStore(STORE_META).delete(catalogEntryId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  invalidateItemsCache();
}

/** 全アイテムを返す（照合用）。メモリキャッシュ優先で全件再読込を回避。 */
export async function getAllItems(): Promise<CatalogVisionItem[]> {
  if (_itemsCache) return _itemsCache;
  const db = await openDb();
  const all = await new Promise<CatalogVisionItem[]>((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS], 'readonly');
    const req = t.objectStore(STORE_ITEMS).getAll();
    req.onsuccess = () => resolve(req.result as CatalogVisionItem[]);
    req.onerror = () => reject(req.error);
  });
  _itemsCache = all;
  return all;
}

/** 指定カタログの既存アイテムを返す（再巡回時の差分スキップ用）。 */
export async function getItemsByCatalog(catalogEntryId: string): Promise<CatalogVisionItem[]> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS], 'readonly');
    const idx = t.objectStore(STORE_ITEMS).index('byCatalog');
    const req = idx.getAll(IDBKeyRange.only(catalogEntryId));
    req.onsuccess = () => resolve(req.result as CatalogVisionItem[]);
    req.onerror = () => reject(req.error);
  });
}

/** 指定カタログの代表サムネ（最初の1件の商品画像）を返す。カード表示用。 */
export async function getFirstThumbForCatalog(catalogEntryId: string): Promise<string | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS], 'readonly');
    const idx = t.objectStore(STORE_ITEMS).index('byCatalog');
    const cur = idx.openCursor(IDBKeyRange.only(catalogEntryId));
    cur.onsuccess = () => {
      const c = cur.result;
      resolve(c ? ((c.value as CatalogVisionItem).cropDataUrl || null) : null);
    };
    cur.onerror = () => reject(cur.error);
  });
}

/** 索引済みカタログのメタ一覧。 */
export async function getAllMeta(): Promise<CatalogIndexMeta[]> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const t = tx(db, [STORE_META], 'readonly');
    const req = t.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve(req.result as CatalogIndexMeta[]);
    req.onerror = () => reject(req.error);
  });
}

/** 索引済みアイテム総数。 */
export async function countItems(): Promise<number> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const t = tx(db, [STORE_ITEMS], 'readonly');
    const req = t.objectStore(STORE_ITEMS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
