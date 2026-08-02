import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { RESEARCH_WINDOW_LABEL } from '../features/projects/chat/researchWindowPresence';
import { RESEARCH_WINDOW_SCOPE_KEY, activeBoardStorageKey, boardViewStorageKey } from '../features/projects/research/researchScope';
import { parseBoardKey } from '../features/projects/repositories/ResearchCanvasRepository';
import { requestShowBoard } from '../features/projects/chat/boardContextBus';
import { isTauri } from '../lib/platform';

// Research & Memo を独立ネイティブ窓として開く。窓は1枚だけ使い回す。
// ラベルは capabilities の `sekkeiya-research-*` パターンに一致させる。

export interface OpenResearchWindowOptions {
  /** 開きたいボード（`scope|docId`）。省略時は窓が記憶しているスコープで開く。 */
  boardKey?: string;
  /** boardKey を指定したときに開くビュー。省略時はマインドマップ。 */
  view?: 'mindmap' | 'canvas';
  /** 初回オープン時のスコープ既定値（呼び出し元の選択中プロジェクト）。 */
  projectId?: string | null;
}

/**
 * 開きたいボードを localStorage に書いてから開く。
 * localStorage は同一オリジンの全ウィンドウで共有されるので、
 * ResearchBoardWorkspace が起動時に読む既存のキーへそのまま流し込める
 * （App.tsx の onShowBoard ハンドラと同じ手口）。
 */
const seedTargetBoard = (boardKey: string, view: 'mindmap' | 'canvas') => {
  const { scope, docId } = parseBoardKey(boardKey);
  try {
    localStorage.setItem(RESEARCH_WINDOW_SCOPE_KEY, scope);
    localStorage.setItem(activeBoardStorageKey(scope), docId);
    localStorage.setItem(boardViewStorageKey(scope, docId), view);
  } catch { /* ignore */ }
};

export const openResearchWindow = async (opts: OpenResearchWindowOptions = {}) => {
  // 設計書 §3.6: 呼び出し元のガード漏れに備え、ここでも isTauri() を確かめる。
  // Web には独立ウィンドウという概念が無いので、WebviewWindow に触る前に何もせず抜ける。
  if (!isTauri()) return null;

  const view = opts.view ?? 'mindmap';
  if (opts.boardKey) seedTargetBoard(opts.boardKey, view);

  const existing = await WebviewWindow.getByLabel(RESEARCH_WINDOW_LABEL);
  if (existing) {
    // 既に開いている窓へは、AI と同じ「このボードを出して」経路で伝える。
    if (opts.boardKey) requestShowBoard({ boardKey: opts.boardKey, view });
    try { await existing.show(); } catch { /* noop */ }
    try { await existing.unminimize(); } catch { /* noop */ }
    try { await existing.setFocus(); } catch { /* noop */ }
    return existing;
  }

  const params = new URLSearchParams({ researchWindow: 'true' });
  if (opts.projectId) params.set('projectId', opts.projectId);

  const win = new WebviewWindow(RESEARCH_WINDOW_LABEL, {
    url: `/?${params.toString()}`,
    title: 'Research & Memo — SEKKEIYA',
    width: 1280,
    height: 860,
    minWidth: 860,
    minHeight: 560,
    center: true,
    resizable: true,
    decorations: true,
  });
  win.once('tauri://error', (e) => console.error('[openResearchWindow] Failed to open window:', e));
  return win;
};
