// 要件74: SEKKEIYA Code の利用可否（React / Tauri 非依存の純ロジック）。
//
// - クラウド（SEKKEIYA 本体の開発バックログ）は管理者専用。一般ユーザーには項目ごと見せない。
// - ローカルモードは Tauri の fs 経由でしか動かないため、Web では使えない。
//   → 一般ユーザー × Web は SEKKEIYA Code そのものを無効にする（見せても何も開けないため）。
//
// UI 側はこの結果だけを見てゲートする（isBlogAdmin を各所で直接呼ばない）。
import type { ProjectRef } from './createBacklogStore';

export interface CodeAccess {
  /** SEKKEIYA Code をそもそも開けるか（サイドバー項目・独立窓・ショートカットの露出条件）。 */
  enabled: boolean;
  /** クラウド（SEKKEIYA 本体の開発バックログ）を選べるか。 */
  cloud: boolean;
  /** ローカルプロジェクトを扱えるか。 */
  local: boolean;
}

export function resolveCodeAccess({ isAdmin, isDesktop }: { isAdmin: boolean; isDesktop: boolean }): CodeAccess {
  const cloud = isAdmin;
  const local = isDesktop;
  return { enabled: cloud || local, cloud, local };
}

/**
 * 初期表示・退避先のプロジェクト。
 * クラウドが使えるならクラウド（従来どおり）、使えないなら登録済みローカルの先頭。
 * どちらも無いときは null＝「プロジェクト未選択」で、呼び出し側は作成を促す空状態を出す。
 */
export function initialProjectRef(access: CodeAccess, projects: string[]): ProjectRef | null {
  if (access.cloud) return { kind: 'cloud' };
  if (access.local && projects.length > 0) return { kind: 'local', path: projects[0] };
  return null;
}
