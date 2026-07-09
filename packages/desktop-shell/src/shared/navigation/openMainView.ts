// SEKKEIYA OS からメイン領域のビュー（アカウントサイト／プロジェクト各ページ）を開くための配線。
//
// 子アプリ（S.Layout 等）を開く OPEN_SUBAPP_EVENT と対になる仕組み。子アプリは「ワークスペース
// タブ」だが、ここで扱うのは「アカウントサイト」と「プロジェクトのページ（Home / Schedules & Tasks /
// CAD Files / Work Files / Research & Memo）」というメイン領域のビュー切り替え。
//
// ・本体ウィンドウ内（メインコックピット）からは applyOpenView() を直接呼んでストアを更新する。
// ・ポップアウトした SEKKEIYA OS 窓（ChatWindow）は本体のストアを直接触れないため、OPEN_VIEW_EVENT を
//   emit し、本体側（App.tsx の常駐リスナー）が applyOpenView() を適用して前面化する。
import { useAppStore } from '../../store/useAppStore';

// ポップアウト窓 → 本体へ「このビューを開いて」と依頼するイベント（子→本体）。
export const OPEN_VIEW_EVENT = 'sekkeiya://open-view';

// プロジェクト直下のページ（ProjectHome の topNavItems と一致させる）。
export type ProjectViewTab = 'home' | 'schedule' | 'cadfiles' | 'workfiles' | 'memo';

// アカウントサイト（MySitePage）もプロジェクトと同じ5ページ（Home/Schedules/CAD/Work/Research）を
// 持ち、同じ activeProjectTab で切り替わるため、account も tab を受ける。
export type OpenViewPayload =
  | { target: 'account'; tab: ProjectViewTab }
  | { target: 'project'; projectId: string; tab: ProjectViewTab };

// 呼び出し元のウィンドウを問わず「メイン領域でこのビューを開く」を実行する。
//   ・ポップアウトした SEKKEIYA OS 窓（/?chatWindow=true）→ 本体へ OPEN_VIEW_EVENT を emit。
//   ・本体ウィンドウ / Web（単一ウィンドウ）→ その場でストアへ適用。
export const openMainViewFromHere = (payload: OpenViewPayload) => {
  const isChatWindow = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('chatWindow');
  if (isChatWindow) {
    import('@tauri-apps/api/event')
      .then(({ emit }) => emit(OPEN_VIEW_EVENT, payload))
      .catch(() => { /* Tauri 以外 or emit 失敗時は何もしない */ });
    return;
  }
  applyOpenView(payload);
};

// 本体ウィンドウのストアへビュー切り替えを適用する。
export const applyOpenView = (payload: OpenViewPayload) => {
  const s = useAppStore.getState();
  if (payload.target === 'account') {
    // アカウントサイト（マイページ）＝プロジェクト非依存の最上位ビュー。表示ページタブも選択する。
    s.setActiveProjectId(null);
    s.setCurrentMainView('my-site');
    s.setActiveProjectTab(payload.tab);
    return;
  }
  // プロジェクトのページ。'home' でワークスペース表示＋activeWorkspaceId=null（=ProjectHome）へ。
  // その上で表示するページタブ（Home/Schedules/CAD/Work/Research）を選択する。
  s.setActiveProjectId(payload.projectId, 'home');
  s.setActiveProjectTab(payload.tab);
};
