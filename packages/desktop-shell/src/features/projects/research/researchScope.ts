// R&M 独立ウィンドウのスコープ選択（React / Tauri / Firestore 非依存の純ロジック）。
//
// 窓は本体に追従せず自分でスコープを持つ（設計書 決定1）。どのスコープで開くかの
// 決定と、プロジェクトが消えていたときの退避だけをここに置き、UI は結果を使うだけにする。
//
// 型のみ import: ResearchWindowState は researchWindowPresence.ts のものを使うが、
// 値としては import しない（Tauri の event API に依存する実行コードを引き込むと、
// このファイルが Firebase 同様「単体テストに実行環境が要る」ものになってしまう）。
import type { ResearchWindowState } from '../chat/researchWindowPresence';

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

/**
 * スコープごとの「最後に開いていたボード」を覚える localStorage キー。
 * この文字列は本体タブ・独立ウィンドウ・openResearchWindow の間で
 * どのボードを開くかを伝え合う唯一の手段なので、必ずここ経由で作る。
 * 実利用者の localStorage に既に書き込まれているため、フォーマットは変更しない
 * （変えると既存のキーがどこからも読めなくなり、記憶が無言で失われる）。
 */
export function activeBoardStorageKey(scope: string): string {
  return `research-active-board:${scope}`;
}

/** スコープ×ボードごとの「最後に見ていたビュー（マインドマップ/ノード）」を覚える localStorage キー。 */
export function boardViewStorageKey(scope: string, docId: string): string {
  return `research-board-view:${scope}|${docId}`;
}

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

/**
 * ResearchMemoTab / AccountResearchMemoTab が独立ウィンドウの開閉状態から出す表示判定。
 * 「常に1インスタンスのみ」の不変条件を守る枝分かれそのものなので、両タブで重複させず
 * ここへ集約する。
 * - 'detached': 窓が開いている → ワークスペースはマウントせず、誘導表示のみ。
 * - 'pending' : 開閉確認前（'unknown'）→ 何も描画しない（一瞬でも二重マウントさせない）。
 * - 'workspace': 閉じている → ワークスペースをマウントしてよい。
 */
export type ResearchTabView = 'detached' | 'pending' | 'workspace';

export function resolveResearchTabView(windowState: ResearchWindowState): ResearchTabView {
  if (windowState === 'open') return 'detached';
  if (windowState === 'unknown') return 'pending';
  return 'workspace';
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
