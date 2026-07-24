// Research & Memo の「いま何を見ているか」をウィンドウ間で共有するバス。
//
// なぜ要るか: チャットはポップアウトすると別ウィンドウ＝別の JS コンテキストになり、
// useAppStore（activeProjectTab）もブリッジのホスト登録も本体側にしか無い。
// そのままだとポップアウト窓のオーケストレーターは「Research & Memo を開いている」と
// 気づけず、ボード系ツールを silo で落としてしまう（＝AIがマップを触れない）。
// 本体が状態を emit し、子ウィンドウはそれを受けて自分のローカルコピーを更新する。
// （WorkspaceTabBar の ACTIVE_SUBAPP_EVENT と同じ「本体が配信・子が問い合わせ」の型）

import { isTauri } from '../../../lib/platform';

export const BOARD_CONTEXT_EVENT = 'sekkeiya://board-context';
export const REQUEST_BOARD_CONTEXT_EVENT = 'sekkeiya://request-board-context';

/** Research & Memo の表示状態。 */
export interface BoardContext {
  /** Research & Memo タブを開いているか。 */
  open: boolean;
  /** 開いているビュー（マインドマップが既定）。タブを閉じていれば null。 */
  view: 'mindmap' | 'canvas' | null;
  /**
   * 表示中のボードキー（scope|docId）。タブを閉じていれば null。
   * ポップアウト窓はホスト登録を共有できないため、これが無いと AI の書き込みが
   * 既定ボード（メインボード）に逸れる。
   */
  boardKey: string | null;
}

const EMPTY: BoardContext = { open: false, view: null, boardKey: null };

// 本体ウィンドウ = 自分で持つ実体。子ウィンドウ = 本体から配信された最後の値。
let local: BoardContext = EMPTY;

/** いま Research & Memo で何を見ているか（このウィンドウから見た最新）。 */
export function getBoardContext(): BoardContext {
  return local;
}

/**
 * 本体側が呼ぶ: 表示状態を更新し、子ウィンドウへ配信する。
 * 値が変わらないときは emit しない（起動直後の連打を防ぐ）。
 */
export function publishBoardContext(ctx: BoardContext): void {
  if (local.open === ctx.open && local.view === ctx.view && local.boardKey === ctx.boardKey) return;
  local = ctx;
  if (!isTauri()) return;
  import('@tauri-apps/api/event')
    .then(({ emit }) => emit(BOARD_CONTEXT_EVENT, ctx))
    .catch(() => { /* Tauri 以外 or emit 失敗時は無視 */ });
}

/**
 * 子ウィンドウ側が呼ぶ: 配信を購読し、現在値を本体へ問い合わせる
 * （後から開いた窓が、次の切り替えまで状態を知れないのを防ぐ）。
 */
export function subscribeBoardContext(): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  import('@tauri-apps/api/event').then(({ listen, emit }) => {
    listen<BoardContext>(BOARD_CONTEXT_EVENT, e => {
      if (e.payload) local = e.payload;
    }).then(fn => { unlisten = fn; });
    emit(REQUEST_BOARD_CONTEXT_EVENT).catch(() => {});
  }).catch(() => { /* noop */ });
  return () => { unlisten?.(); };
}

/** 本体側が呼ぶ: 子ウィンドウからの問い合わせに現在値で応答する。 */
export function serveBoardContextRequests(): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  import('@tauri-apps/api/event').then(({ listen, emit }) => {
    listen(REQUEST_BOARD_CONTEXT_EVENT, () => {
      emit(BOARD_CONTEXT_EVENT, local).catch(() => { /* noop */ });
    }).then(fn => { unlisten = fn; });
  }).catch(() => { /* noop */ });
  return () => { unlisten?.(); };
}

// ─── 「該当画面を出す」リクエスト ────────────────────────────────────────────
// チャットが正: AI がボードへ書き始めたら、書き込み先のボードを本体ウィンドウに表示する
// （どこから指示しても、処理が始まった画面が目の前に出る）。
// 発火元はブリッジの書き込み経路。受け手は本体の App（プロジェクト/タブ切替）と、
// マウント中の ResearchBoardWorkspace（ボード・ビュー切替）。

export const SHOW_BOARD_EVENT = 'sekkeiya://show-research-board';

export interface ShowBoardRequest {
  /** 表示したいボードキー（scope|docId）。 */
  boardKey: string;
  /** 開くビュー。マインドマップ verb なら 'mindmap'、ノード画面 verb なら 'canvas'。 */
  view: 'mindmap' | 'canvas';
}

type ShowBoardHandler = (req: ShowBoardRequest) => void;
const showHandlers = new Set<ShowBoardHandler>();

/** 本体側のコンポーネントがハンドラを登録する（App=画面遷移 / Workspace=ボード切替）。 */
export function onShowBoard(h: ShowBoardHandler): () => void {
  showHandlers.add(h);
  return () => { showHandlers.delete(h); };
}

function dispatchShowBoard(req: ShowBoardRequest): void {
  showHandlers.forEach(h => { try { h(req); } catch { /* 個別ハンドラの失敗は他へ波及させない */ } });
}

/**
 * 書き込み経路が呼ぶ: このボードを画面に出してほしい。
 * Tauri では全ウィンドウへ emit し、ハンドラを登録している本体だけが反応する
 * （ポップアウト窓は未登録なので無反応）。Web は単一ウィンドウなので直接配る。
 */
export function requestShowBoard(req: ShowBoardRequest): void {
  if (!isTauri()) { dispatchShowBoard(req); return; }
  import('@tauri-apps/api/event')
    .then(({ emit }) => emit(SHOW_BOARD_EVENT, req))
    .catch(() => dispatchShowBoard(req));
}

/** 本体ウィンドウで1回だけ呼ぶ: emit されたリクエストをローカルのハンドラへ流す。 */
export function serveShowBoardRequests(): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<ShowBoardRequest>(SHOW_BOARD_EVENT, e => {
      if (e.payload?.boardKey) dispatchShowBoard(e.payload);
    }).then(fn => { unlisten = fn; });
  }).catch(() => { /* noop */ });
  return () => { unlisten?.(); };
}
