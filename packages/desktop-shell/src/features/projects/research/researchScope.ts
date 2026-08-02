// R&M 独立ウィンドウのスコープ選択（React / Tauri / Firestore 非依存の純ロジック）。
//
// 窓は本体に追従せず自分でスコープを持つ（設計書 決定1）。どのスコープで開くかの
// 決定と、プロジェクトが消えていたときの退避だけをここに置き、UI は結果を使うだけにする。

/**
 * アカウントサイト（個人ボード）のスコープ ID。
 * ResearchCanvasRepository の ACCOUNT_BOARD_ID と同じ値をここで再定義している。
 * あちらは module top-level で firebase/firestore と lib/firebase/client を読み込むため、
 * import すると単体テストが Firebase の初期化を要求してしまう。
 * この値は Firestore のパス（users/{uid}/research/*）に固定されており変わらない。
 */
export const ACCOUNT_SCOPE = 'account';

/** 窓が選択中のスコープを覚える localStorage キー。 */
export const RESEARCH_WINDOW_SCOPE_KEY = 'research-window-scope';

export interface ScopeProject {
  id: string;
  name: string;
  isTeam?: boolean;
}

export interface ScopeOption {
  id: string;
  label: string;
}

export interface ScopeGroups {
  my: ScopeOption[];
  team: ScopeOption[];
}

/**
 * 窓を開いた直後のスコープ。前回の選択を最優先し、無ければ開いた時点の
 * プロジェクト、それも無ければアカウントサイト。
 * この時点ではプロジェクト一覧が未取得なので実在確認はしない（reconcileScope が後で行う）。
 */
export function initialScope(saved: string | null, activeProjectId: string | null): string {
  if (saved) return saved;
  if (activeProjectId) return activeProjectId;
  return ACCOUNT_SCOPE;
}

/** プロジェクト一覧の取得後に呼ぶ。消えたプロジェクトを指していたらアカウントサイトへ退避する。 */
export function reconcileScope(current: string, knownProjectIds: string[]): string {
  if (current === ACCOUNT_SCOPE) return current;
  return knownProjectIds.includes(current) ? current : ACCOUNT_SCOPE;
}

/** サイドバーに出す「マイプロジェクト」「チームプロジェクト」の 2 グループへ分ける。 */
export function groupProjectsForScope(projects: ScopeProject[]): ScopeGroups {
  const my: ScopeOption[] = [];
  const team: ScopeOption[] = [];
  for (const p of projects) {
    const option: ScopeOption = { id: p.id, label: p.name || '(名称未設定)' };
    (p.isTeam ? team : my).push(option);
  }
  return { my, team };
}
