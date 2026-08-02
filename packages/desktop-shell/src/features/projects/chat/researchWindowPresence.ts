// Research & Memo 独立ウィンドウが開いているかをウィンドウ間で共有するバス。
//
// なぜ要るか: R&M は Firestore をリアルタイム購読していないため、本体タブと独立窓で
// 同じボードを開くと後勝ちで丸ごと上書きされる。さらに ResearchBoardWorkspace は
// マウント中ずっと publishBoardContext で「見ているボード」を配信するので、
// 二重にマウントすると AI の書き込み先が揺れる。
// → 窓が開いている間は本体側でワークスペースをマウントしない（デタッチ方式）。
//    その判定材料をここが配る。
//
// 型: 本体が購読、窓が配信・問い合わせに応答（boardContextBus と同じ形）。

import { useEffect, useState } from 'react';
import { isTauri } from '../../../lib/platform';

/** 独立ウィンドウのラベル。capabilities の `sekkeiya-research-*` に一致させること。 */
export const RESEARCH_WINDOW_LABEL = 'sekkeiya-research-main';

export const RESEARCH_WINDOW_STATE_EVENT = 'sekkeiya://research-window-state';
export const REQUEST_RESEARCH_WINDOW_STATE_EVENT = 'sekkeiya://request-research-window-state';

/**
 * 窓が実在するかを直接確かめる（権威確認）。
 * emit の取りこぼしや強制終了に備えて、購読と併用する。
 */
export async function isResearchWindowOpenNow(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    return !!(await WebviewWindow.getByLabel(RESEARCH_WINDOW_LABEL));
  } catch {
    return false;
  }
}

/**
 * 独立ウィンドウ側が1回だけ呼ぶ。
 * マウントで「開いています」を配信し、問い合わせにも応答し、閉じるときに「閉じました」を配信する。
 */
export function serveResearchWindowPresence(): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  let announceClosed: () => void = () => {};
  let alive = true;
  let hasAnnouncedClosed = false;

  import('@tauri-apps/api/event').then(({ listen, emit }) => {
    const announce = (open: boolean) => {
      emit(RESEARCH_WINDOW_STATE_EVENT, { open }).catch(() => { /* noop */ });
    };

    if (alive) {
      announce(true);
      announceClosed = () => {
        // 一度きりのラッチ: beforeunload / cleanup のどちらが先でも、
        // "閉じました" の emit は必ず 1 回だけ。
        if (hasAnnouncedClosed) return;
        hasAnnouncedClosed = true;
        announce(false);
      };
      window.addEventListener('beforeunload', announceClosed);
      listen(REQUEST_RESEARCH_WINDOW_STATE_EVENT, () => announce(true))
        .then(fn => {
          if (alive) unlisten = fn;
          else fn();
        });
    } else {
      // cleanup が import 解決より先に走った場合、"閉じた" を配信し、
      // listen ハンドルは直ちに破棄して、誤った "開いている" 状態の再アナウンスを防ぐ。
      hasAnnouncedClosed = true;
      announce(false);
      listen(REQUEST_RESEARCH_WINDOW_STATE_EVENT, () => announce(true))
        .then(fn => fn());
    }
  }).catch(() => { /* noop */ });

  return () => {
    alive = false;
    window.removeEventListener('beforeunload', announceClosed);
    announceClosed();
    unlisten?.();
  };
}

/**
 * 本体側が使う。独立ウィンドウが開いているかを返す。
 * 購読（即時反映）＋ マウント時と focus 時の権威確認（取りこぼし対策）の二段構え。
 * Web では常に false。
 */
export function useResearchWindowOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | null = null;

    const verify = () => {
      isResearchWindowOpenNow().then(exists => { if (alive) setOpen(exists); });
    };

    import('@tauri-apps/api/event').then(({ listen, emit }) => {
      listen<{ open: boolean }>(RESEARCH_WINDOW_STATE_EVENT, e => {
        if (alive) setOpen(!!e.payload?.open);
      }).then(fn => {
        if (alive) unlisten = fn;
        else fn();
      });
      emit(REQUEST_RESEARCH_WINDOW_STATE_EVENT).catch(() => { /* noop */ });
    }).catch(() => { /* noop */ });

    verify();
    window.addEventListener('focus', verify);
    return () => {
      alive = false;
      unlisten?.();
      window.removeEventListener('focus', verify);
    };
  }, []);

  return open;
}
