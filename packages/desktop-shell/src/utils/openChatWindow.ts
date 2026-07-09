import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useAppStore } from '../store/useAppStore';

// SEKKEIYA Chat を独立したネイティブ・ウィンドウとして開く（デスクトップ上の任意位置へ
// ドラッグ移動でき、本体の SEKKEIYA 画面と並べて使える）。
//
// ★窓は1枚だけ使い回す（プロセス積み上がり防止）。既に開いていれば最前面に出すだけ。
//   チャット履歴（useAIChatStore）は zustand persist=localStorage を同一オリジンで共有するため、
//   窓を開いた時点で本体と同じアクティブセッションが表示される。ただし zustand ストアは
//   ウィンドウごとに別インスタンスのため、同時に開いた2窓のメッセージはリアルタイム相互反映されない。
//   → 呼び出し側で本体パネルを畳む運用（1箇所だけで会話する）が前提。
const CHAT_WINDOW_LABEL = 'sekkeiya-chat';

/** 既存ウィンドウを最前面に出す（最小化からの復帰＋フォーカス）。 */
async function focusWindow(win: WebviewWindow): Promise<void> {
  try { await win.show(); } catch { /* noop */ }
  try { await win.unminimize(); } catch { /* noop */ }
  try { await win.setFocus(); } catch { /* noop */ }
}

// ポップアウト窓の破棄を検知して本体の isChatPoppedOut を戻す。多重登録を避けるためのガード。
let destroyListenerAttached = false;
async function markPoppedOutAndWatch(win: WebviewWindow): Promise<void> {
  useAppStore.getState().setChatPoppedOut(true);
  if (destroyListenerAttached) return;
  destroyListenerAttached = true;
  try {
    // 窓が閉じられたら本体内チャットを再び開けるようにする。
    await win.once('tauri://destroyed', () => {
      destroyListenerAttached = false;
      useAppStore.getState().setChatPoppedOut(false);
    });
  } catch {
    destroyListenerAttached = false;
  }
}

/**
 * すでに開いているポップアウト窓（あれば）を最前面に出す。
 * @returns 既存窓を前面化できたら true / 無ければ false。
 * 本体内チャットを開く前に「窓が開いていればそちらを見せる」ために使う。
 */
export async function focusChatWindowIfOpen(): Promise<boolean> {
  try {
    const existing = await WebviewWindow.getByLabel(CHAT_WINDOW_LABEL);
    if (!existing) return false;
    await focusWindow(existing);
    await markPoppedOutAndWatch(existing);
    return true;
  } catch {
    return false;
  }
}

/** 本体起動時に、既にポップアウト窓が存在するかを本体ストアへ同期する（リロード後の取りこぼし防止）。 */
export async function syncChatPoppedOutState(): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel(CHAT_WINDOW_LABEL);
    if (existing) await markPoppedOutAndWatch(existing);
    else useAppStore.getState().setChatPoppedOut(false);
  } catch { /* noop */ }
}

/**
 * SEKKEIYA Chat を別ウィンドウで開く。
 * @param projectId アクティブプロジェクト ID（窓側の初期プロジェクト。以後の切替は本体からブロードキャストで追従）。
 * @returns 開けたら true / Web版・生成失敗で false。
 */
export async function openChatWindow(projectId: string | null): Promise<boolean> {
  try {
    const existing = await WebviewWindow.getByLabel(CHAT_WINDOW_LABEL);
    if (existing) {
      await focusWindow(existing);
      await markPoppedOutAndWatch(existing);
      return true;
    }
    const params = new URLSearchParams({ chatWindow: 'true' });
    if (projectId) params.set('projectId', projectId);

    const win = new WebviewWindow(CHAT_WINDOW_LABEL, {
      url: `/?${params.toString()}`,
      title: 'SEKKEIYA OS',
      width: 460,
      height: 820,
      minWidth: 360,
      minHeight: 480,
      center: true,
      resizable: true,
      decorations: true,
    });
    await new Promise<void>((resolve, reject) => {
      win.once('tauri://created', () => resolve());
      win.once('tauri://error', (e) => reject(e));
    });
    await markPoppedOutAndWatch(win);
    return true;
  } catch (e) {
    console.error('[openChatWindow] Failed to open window:', e);
    return false;
  }
}
