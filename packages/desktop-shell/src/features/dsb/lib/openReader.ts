/**
 * openReader — Web記事を「アプリ内のネイティブウィンドウ」で開く。
 *
 * openReader   … SEKKEIYA Reader（翻訳・広告なしのクリーンリーダー表示 = /?readerWindow=true）
 * openReaderRaw … 元記事そのまま（原文・レイアウト・動画を含む生ページ）
 *
 * ★ウィンドウは1枚だけ使い回す（プロセス積み上がり防止）。
 *   - クリーンリーダー: 既存ウィンドウがあればリロードせず、ブロードキャストイベントで「タブを追加」させる。
 *     窓の中でブラウザのようにタブ表示するため、何本開いてもウィンドウ=WebView2レンダラーは1個のまま。
 *   - 原文(生ページ): 外部URLを直接読むためイベント差し替え不可。既存を閉じてから開き直し、常に1枚に保つ。
 *   どちらも Web版やウィンドウ生成失敗時は既定ブラウザ（新規タブ）へフォールバック。
 */
import type { BlogSourceRef } from '../types';

/** クリーンリーダー窓の固定ラベル。 */
const READER_LABEL = 'sblog-reader';
/** 原文(生ページ)窓の固定ラベル。 */
const RAW_LABEL = 'sblog-reader-raw';
/** 既存リーダー窓へ「次に表示する記事」を伝えるイベント名（ReaderWindow が購読）。 */
export const READER_NAV_EVENT = 'sblog-reader:navigate';

/** 既存ウィンドウを最前面に出す（最小化からの復帰＋フォーカス）。 */
async function focusWindow(win: { show(): Promise<void>; unminimize(): Promise<void>; setFocus(): Promise<void> }): Promise<void> {
  try { await win.show(); } catch { /* noop */ }
  try { await win.unminimize(); } catch { /* noop */ }
  try { await win.setFocus(); } catch { /* noop */ }
}

/** 指定ラベルでウィンドウを新規生成し、作成完了/失敗を待つ。 */
async function createWindow(label: string, url: string, title: string): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const win = new WebviewWindow(label, {
    url,
    title,
    width: 960,
    height: 800,
    minWidth: 420,
    minHeight: 480,
    center: true,
    resizable: true,
    decorations: true,
  });
  await new Promise<void>((resolve, reject) => {
    win.once('tauri://created', () => resolve());
    win.once('tauri://error', (e) => reject(e));
  });
}

/** Web版 / ウィンドウ生成不可 → 既定ブラウザへ。 */
async function fallbackBrowser(fallbackUrl: string): Promise<void> {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(fallbackUrl);
  } catch {
    try { window.open(fallbackUrl, '_blank'); } catch { /* noop */ }
  }
}

/** クリーンリーダー（翻訳＋画像＋動画・広告なし）で記事を開く。窓は1枚を使い回す。 */
export async function openReader(url: string, title?: string, source?: string): Promise<void> {
  const winTitle = title ? `${title} — SEKKEIYA Reader` : 'SEKKEIYA Reader';
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel(READER_LABEL);
    if (existing) {
      // 既存の窓を再利用: リロードせず、ブロードキャストで「タブを追加」させる
      await focusWindow(existing);
      const article: BlogSourceRef = { url, title: title || url, source: source || '' };
      const { emit } = await import('@tauri-apps/api/event');
      await emit(READER_NAV_EVENT, article);
      return;
    }
    const q = new URLSearchParams({ readerWindow: 'true', url, title: title || '', source: source || '' });
    await createWindow(READER_LABEL, `/?${q.toString()}`, winTitle);
  } catch {
    await fallbackBrowser(url);
  }
}

/** 元記事（原文の生ページ）をアプリ内ウィンドウで開く。窓は1枚に保つ（既存は閉じて開き直し）。 */
export async function openReaderRaw(url: string, title?: string): Promise<void> {
  const winTitle = title ? `${title} — SEKKEIYA Reader` : 'SEKKEIYA Reader';
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel(RAW_LABEL);
    if (existing) {
      // 外部URLは既存窓へ差し替えできないので、破棄を待ってから開き直す（ラベル衝突回避）
      await new Promise<void>((resolve) => {
        existing.once('tauri://destroyed', () => resolve());
        existing.close().catch(() => resolve());
        // destroyed が来ない環境向けの保険
        setTimeout(resolve, 400);
      });
    }
    await createWindow(RAW_LABEL, url, winTitle);
  } catch {
    await fallbackBrowser(url);
  }
}
