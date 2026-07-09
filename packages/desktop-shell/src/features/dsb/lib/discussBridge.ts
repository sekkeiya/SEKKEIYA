/**
 * discussBridge — SEKKEIYA Reader（独立ウィンドウ）→ メインウィンドウの
 * 「AIと議論して書く」へのシームレスな橋渡し。
 *
 * Reader側: requestDiscussWrite() が Tauri イベントを emit して自ウィンドウを閉じる。
 * メイン側: installDiscussBridge() が受信し、メインウィンドウを前面化 → S.Blog を開き
 *           議論ファーストのエディタ（題材記事つき）を起動する。
 */
import { useAuthStore } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { useDsbStore } from '../store/useDsbStore';
import { isTauri } from '../../../lib/platform';
import type { BlogSourceRef } from '../types';

const EVENT = 'sblog-discuss-write';

/** Reader側: 「AIと議論して書く」をメインウィンドウへ依頼し、Readerを閉じる。 */
export async function requestDiscussWrite(source: BlogSourceRef): Promise<void> {
  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(EVENT, source);
  } catch (e) {
    console.warn('[discussBridge] emit failed', e);
    return;
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch { /* 閉じられなくても致命的ではない */ }
}

/**
 * メイン側: ブリッジを起動する。App でマウント時に1度だけ呼ぶ（Readerウィンドウでは呼ばない）。
 * 返り値でアンサブスクライブ。Web/非Tauri では何もしない。
 */
export function installDiscussBridge(): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  (async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<BlogSourceRef>(EVENT, async (event) => {
        const src = event.payload;
        if (!src?.url) return;
        const user = useAuthStore.getState().currentUser as any;
        const uid = user?.uid as string | undefined;
        if (!uid) return;

        // メインウィンドウを前面へ
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const w = getCurrentWindow();
          await w.show();
          await w.unminimize();
          await w.setFocus();
        } catch { /* best-effort */ }

        // S.Blog を前面に出し、議論ファーストのエディタを開く（blogActions と同じ手順）
        const app = useAppStore.getState();
        app.setActiveWorkspaceId('blog');
        app.setLastActiveAppScope('3dsb');
        app.setCurrentMainView('workspace');

        const dsb = useDsbStore.getState();
        dsb.startNew(uid, user?.displayName ?? null, undefined);
        dsb.updateDraft({
          sourceRefs: [{ title: src.title, url: src.url, source: src.source || '', date: src.date || '' }],
          aiDialogue: [],
        });
      });
    } catch (e) {
      console.warn('[discussBridge] listen setup failed', e);
    }
  })();
  return () => { if (unlisten) unlisten(); };
}
