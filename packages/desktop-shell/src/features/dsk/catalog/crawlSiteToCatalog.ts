// ──────────────────────────────────────────────────────────────────────────────
// S.Library に登録した Web サイト（家具EC等）を隠し WebView で巡回し、
// 商品画像を CLIP 埋め込みしてローカル視覚索引に保存する。
//
// フロー: BFS（上限つき）で登録URL→カテゴリ/一覧ページを巡回し、商品カードから
// {商品URL・画像・価格・名前} を収集 → Rust(reqwest) で画像を取得(CORS回避) →
// CLIP 埋め込み → catalogVisionStore へ保存（sourceType:'web'）。
// ──────────────────────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { embedImage } from '../../../shared/vision/visionEngine';
import { saveCatalogItems, getItemsByCatalog, type CatalogVisionItem, type CatalogIndexMeta } from './catalogVisionStore';
import { getSiteConfig, buildExtractorScript } from './webCrawlConfig';

export interface CrawlProgress {
  phase: 'crawl' | 'embed';
  pagesVisited: number;
  productsFound: number;
  embedded?: number;
  total?: number;
}

export interface CrawlableEntry {
  localId: string;
  title: string;
  sourceUrl?: string | null;
  /** S.Models 同様の分類。索引アイテムに付与し Search/Chat 連携で活用。 */
  category?: string | null;
  tags?: string[] | null;
}

interface CrawlPagePayload {
  crawlId?: string;
  products?: string[];   // 商品ページ URL（パスのみ収集、詳細は Rust が取得）
  categories?: string[]; // カテゴリ/一覧ページ URL
  pages?: string[];      // ページネーション URL（同一一覧の続き）
  self?: string | null;  // 現在ページ自体が商品ページならその URL
  diag?: { anchors: number; productLinks: number; categories: number; ready: string };
}

interface ProductMeta {
  name: string;
  price: string;
  image_data_url: string;
}

export interface CrawlDiagnostics {
  pagesVisited: number;
  pagesResponded: number;   // ブリッジへ抽出データが届いたページ数（0なら注入/通信の問題）
  productLinksSeen: number; // 検出した商品リンク総数（0なら抽出/レンダリングの問題）
  productsWithImage: number;
  categoriesSeen: number;
}

export interface CrawlOptions {
  maxPages?: number;
  maxProducts?: number;
  maxDepth?: number;
  pageTimeoutMs?: number;
  politenessMs?: number;
  onProgress?: (p: CrawlProgress) => void;
  signal?: AbortSignal;
}

let _crawlSeq = 0;

export interface CrawlResult {
  meta: CatalogIndexMeta;
  diag: CrawlDiagnostics;
}

/** 登録URLのサイトを巡回して視覚索引化する。 */
export async function crawlSiteEntry(entry: CrawlableEntry, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const startUrl = entry.sourceUrl;
  if (!startUrl) throw new Error('Webエントリに URL がありません。');
  const {
    maxPages = 200,
    maxProducts = 3000,
    maxDepth = 3,
    pageTimeoutMs = 22000,
    politenessMs = 400,
    onProgress,
    signal,
  } = opts;

  const cfg = getSiteConfig(startUrl);

  // 商品が1件も増えないページ（最終ページの先＝404/空）が続いたら終端とみなして打ち切る。
  const MAX_EMPTY_STREAK = 4;
  let emptyStreak = 0;

  // crawlId → ページ受信コールバック
  const pending = new Map<string, (p: CrawlPagePayload) => void>();
  const unlisten = await listen<CrawlPagePayload>('crawl-page-received', (e) => {
    const p = e.payload;
    if (p && p.crawlId && pending.has(p.crawlId)) {
      const cb = pending.get(p.crawlId)!;
      pending.delete(p.crawlId);
      cb(p);
    }
  });

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: normalize(startUrl), depth: 0 }];
  const productUrls = new Set<string>();
  let pagesVisited = 0;
  const diag: CrawlDiagnostics = { pagesVisited: 0, pagesResponded: 0, productLinksSeen: 0, productsWithImage: 0, categoriesSeen: 0 };

  try {
    while (queue.length && pagesVisited < maxPages && productUrls.size < maxProducts) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const { url, depth } = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      pagesVisited++;

      const crawlId = `c${_crawlSeq++}_${pagesVisited}`;
      const initScript = buildExtractorScript(crawlId, cfg);

      const payload = await renderPage(url, crawlId, initScript, pending, pageTimeoutMs, signal);

      // 応答がまったく無いまま数ページ巡回した＝注入/通信が機能していない。長時間ハングを避けて打ち切る。
      if (diag.pagesResponded === 0 && pagesVisited >= 3) {
        await invoke('close_all_crawl_webviews').catch(() => {});
        throw new Error('WebViewからの応答がありません（ローカル通信ブロックの可能性）。巡回を中止しました。');
      }

      if (payload) {
        diag.pagesResponded++;
        if (payload.diag) {
          diag.productLinksSeen += payload.diag.productLinks || 0;
          diag.categoriesSeen += payload.diag.categories || 0;
        }
        console.log('[crawl]', url, 'diag=', payload.diag, 'products=', (payload.products || []).length);
        const beforeCount = productUrls.size;
        for (const purl of payload.products || []) {
          if (purl) productUrls.add(purl);
        }
        if (payload.self) productUrls.add(payload.self);
        const addedHere = productUrls.size - beforeCount;

        // ページネーション（同一一覧の続き）は、商品が増えたページからのみ辿る。
        // 空ページ（最終ページの先＝404）から次ページを派生させないことで 404 連鎖を断つ。
        if (addedHere > 0) {
          for (const pg of payload.pages || []) {
            const n = normalize(pg);
            if (!visited.has(n) && !queue.some((q) => q.url === n)) {
              queue.push({ url: n, depth });
            }
          }
        }
        // カテゴリ（他ジャンルへの波及）は従来どおり無条件に辿る（maxDepth まで）。
        if (depth < maxDepth) {
          for (const cat of payload.categories || []) {
            const n = normalize(cat);
            if (!visited.has(n) && !queue.some((q) => q.url === n)) {
              queue.push({ url: n, depth: depth + 1 });
            }
          }
        }
        // 終端検出は「カテゴリも商品も増えなかった空ページ」が連続したときだけ。
        if (addedHere > 0) {
          emptyStreak = 0;
        } else if ((payload.categories || []).length === 0) {
          emptyStreak++;
          if (emptyStreak >= MAX_EMPTY_STREAK) {
            console.log('[crawl] 終端検出：商品もカテゴリも無いページが連続したため巡回を終了', { emptyStreak });
            break;
          }
        }
      }
      onProgress?.({ phase: 'crawl', pagesVisited, productsFound: productUrls.size });
      if (politenessMs) await sleep(politenessMs);
    }
  } finally {
    unlisten();
    // 残った巡回用 WebView を確実に後片付け。
    await invoke('close_all_crawl_webviews').catch(() => {});
  }

  // 商品詳細（サーバレンダリング）を Rust で取得し、画像を CLIP 埋め込み。
  // 再巡回時は既存の索引済み商品（同一URL）を再利用し、取得＋埋め込みをスキップする。
  const existing = await getItemsByCatalog(entry.localId);
  const existingByUrl = new Map<string, CatalogVisionItem>();
  for (const it of existing) {
    if (it.productUrl) existingByUrl.set(it.productUrl, it);
  }
  const list = Array.from(productUrls).slice(0, maxProducts);
  const items: CatalogVisionItem[] = [];
  let embedded = 0;
  let reused = 0;
  for (const purl of list) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const prev = existingByUrl.get(purl);
    if (prev) {
      // 既存の埋め込み・画像をそのまま流用（重い取得/CLIP をスキップ）。
      items.push(prev);
      if (prev.cropDataUrl) diag.productsWithImage++;
      reused++;
      embedded++;
      onProgress?.({ phase: 'embed', pagesVisited, productsFound: productUrls.size, embedded, total: list.length });
      continue;
    }
    try {
      const meta = await invoke<ProductMeta>('fetch_product_meta', { url: purl });
      if (meta.image_data_url) {
        const embedding = await embedImage(meta.image_data_url);
        diag.productsWithImage++;
        items.push({
          id: `${entry.localId}:p:${hashUrl(purl)}`,
          catalogEntryId: entry.localId,
          catalogTitle: entry.title,
          page: 0,
          label: meta.name || '商品',
          score: 1,
          cropDataUrl: meta.image_data_url,
          embedding,
          sourceType: 'web',
          productUrl: purl,
          price: meta.price || undefined,
          siteUrl: startUrl,
          category: entry.category || undefined,
          tags: entry.tags && entry.tags.length ? entry.tags : undefined,
        });
      }
    } catch (e) {
      console.warn('[crawlSiteEntry] product meta failed for', purl, e);
    }
    embedded++;
    onProgress?.({ phase: 'embed', pagesVisited, productsFound: productUrls.size, embedded, total: list.length });
  }

  diag.pagesVisited = pagesVisited;
  console.log('[crawl] done', { startUrl, ...diag, indexed: items.length, reused, newlyEmbedded: items.length - reused });

  const meta: CatalogIndexMeta = {
    catalogEntryId: entry.localId,
    catalogTitle: entry.title,
    indexedAt: new Date().toISOString(),
    itemCount: items.length,
  };
  await saveCatalogItems(meta, items);
  return { meta, diag };
}

function renderPage(
  url: string,
  crawlId: string,
  initScript: string,
  pending: Map<string, (p: CrawlPagePayload) => void>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CrawlPagePayload | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (p: CrawlPagePayload | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pending.delete(crawlId);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(p);
    };
    const onAbort = () => {
      invoke('close_crawl_webview', { crawlId }).catch(() => {});
      finish(null);
    };
    const timer = setTimeout(() => {
      invoke('close_crawl_webview', { crawlId }).catch(() => {});
      finish(null);
    }, timeoutMs);
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort);
    }
    pending.set(crawlId, (p) => finish(p));
    invoke('open_crawl_webview', { url, crawlId, initScript }).catch((err) => {
      console.error('[crawl] open_crawl_webview failed for', url, err);
      finish(null);
    });
  });
}

function normalize(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.href;
  } catch {
    return u.split('#')[0];
  }
}

function hashUrl(u: string): string {
  let h = 0;
  for (let i = 0; i < u.length; i++) { h = (h * 31 + u.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
