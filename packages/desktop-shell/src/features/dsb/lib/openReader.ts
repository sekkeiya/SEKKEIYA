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
import { isTauri } from '../../../lib/platform';

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

/** Web版 / ウィンドウ生成不可 → 既定ブラウザへ。
 *  Web では plugin-opener（shim）が握りつぶされる場合があるので、window.open を直に使う。
 *  クリック直後に呼ばれる前提でここは同期的に window.open して、ポップアップブロックを避ける。 */
async function fallbackBrowser(fallbackUrl: string): Promise<void> {
  if (!isTauri()) {
    try { window.open(fallbackUrl, '_blank', 'noopener'); return; } catch { /* noop */ }
  }
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(fallbackUrl);
  } catch {
    try { window.open(fallbackUrl, '_blank'); } catch { /* noop */ }
  }
}

/** クリーンリーダー（翻訳＋画像＋動画・広告なし）で記事を開く。窓は1枚を使い回す。
 *  opts.autoRead=true で本文読み込み後に読み上げを自動開始（投稿スケジュール実行などの聴き流し用）。 */
export async function openReader(url: string, title?: string, source?: string, opts?: { autoRead?: boolean }): Promise<void> {
  // Web版はネイティブ窓（WebviewWindow）が無い。shim だと生成が resolve/reject どちらも
  // 返さずハングして「記事が開かない」ため、Web は原文を新規タブで開く。
  if (!isTauri()) { await fallbackBrowser(url); return; }
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
    if (opts?.autoRead) q.set('autoRead', '1');
    await createWindow(READER_LABEL, `/?${q.toString()}`, winTitle);
  } catch {
    await fallbackBrowser(url);
  }
}

/** 記事を指定せず SEKKEIYA Reader を開く（S.Blog ホーム「記事を読む」と同じ体験）。
 *  購読フィードを取得してプレイリスト化 → 先頭記事で Reader を開く（ギャラリー付き）。
 *  フィードが空/失敗時は空のリーダー（プレースホルダ）を開く。窓は1枚を使い回す。
 *  SEKKEIYA OS などから「リーダーを開く」導線に使う。Web版は窓が無いため何もしない。 */
export async function openReaderHome(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { auth } = await import('../../../lib/firebase/client');
    const uid = auth.currentUser?.uid;
    if (uid) {
      const { fetchBlogNewsPlaylist, saveReaderPlaylist } = await import('./newsFeed');
      const items = await fetchBlogNewsPlaylist(uid);
      if (items.length > 0) {
        // ReaderWindow がマウント時に読むプレイリストを先に保存してから開く（ギャラリー表示のため）。
        saveReaderPlaylist(items);
        await openReader(items[0].url, items[0].title, items[0].source);
        return;
      }
    }
  } catch (e) {
    console.warn('[openReaderHome] フィード取得に失敗、空のリーダーを開きます:', e);
  }
  // フィード無し/失敗/未ログイン → 空のリーダー（既存窓があれば前面化）。
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel(READER_LABEL);
    if (existing) { await focusWindow(existing); return; }
    await createWindow(READER_LABEL, '/?readerWindow=true', 'SEKKEIYA Reader');
  } catch (e) {
    console.error('[openReaderHome] failed:', e);
  }
}

/**
 * 元記事ウィンドウを開き、**閉じられるまで待つ**（サイトログイン用）。
 * ユーザーがこの窓の中でログインして閉じると resolve する。アプリ内ウィンドウは
 * 本体と WebView2 の Cookie を共有するため、以後の隠しWebView抽出にログインが効く。
 * @returns true=アプリ内ウィンドウで開けた（Cookie共有あり）/ false=ブラウザへ
 *          フォールバックした（Cookie は共有されないのでログイン記録すべきでない）
 */
export async function openReaderRawAndWait(url: string, title?: string): Promise<boolean> {
  // Web は Cookie 共有できるネイティブ窓が無いので、ブラウザで開いて false を返す
  // （呼び出し側はログイン記録を残さない）。
  if (!isTauri()) { await fallbackBrowser(url); return false; }
  const winTitle = title ? `${title} — SEKKEIYA Reader` : 'SEKKEIYA Reader';
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel(RAW_LABEL);
    if (existing) {
      await new Promise<void>((resolve) => {
        existing.once('tauri://destroyed', () => resolve());
        existing.close().catch(() => resolve());
        setTimeout(resolve, 400);
      });
    }
    await createWindow(RAW_LABEL, url, winTitle);
    const win = await WebviewWindow.getByLabel(RAW_LABEL);
    if (!win) return true; // 生成直後に既に閉じられていた
    await new Promise<void>((resolve) => {
      void win.once('tauri://destroyed', () => resolve());
    });
    return true;
  } catch {
    await fallbackBrowser(url);
    return false;
  }
}

/** 元記事（原文の生ページ）をアプリ内ウィンドウで開く。窓は1枚に保つ（既存は閉じて開き直し）。 */
export async function openReaderRaw(url: string, title?: string): Promise<void> {
  if (!isTauri()) { await fallbackBrowser(url); return; }
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
