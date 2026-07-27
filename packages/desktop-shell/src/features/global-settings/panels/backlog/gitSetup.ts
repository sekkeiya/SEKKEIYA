// 要件77: Git 未初期化プロジェクトの初期化とリモート設定（React / Tauri 非依存の純ロジック）。
// 実際の git 実行は Rust 側（src-tauri/src/git.rs の git_init / git_set_remote）。

/** 既定のブランチ名。git init 後に `git branch -M` で揃える。 */
export const DEFAULT_BRANCH = 'main';

/**
 * リモート URL の検証。問題なければ null。
 * 空文字は「リモート無しで初期化する」を意味するので、呼び出し側で先に弾くこと。
 * 受け付ける形: https://host/owner/repo(.git) / ssh://... / git@host:owner/repo(.git)
 */
export function validateRemoteUrl(url: string): string | null {
  const t = (url ?? '').trim();
  if (!t) return 'リモート URL を入力してください';
  if (/\s/.test(t)) return 'URL に空白は使えません';
  if (t.length > 500) return 'URL が長すぎます';
  if (/^https?:\/\/\S+\/\S+/.test(t)) return null;
  if (/^ssh:\/\/\S+\/\S+/.test(t)) return null;
  if (/^[\w.-]+@[\w.-]+:\S+/.test(t)) return null;  // git@github.com:owner/repo.git
  return 'URL の形式が正しくありません（例: https://github.com/owner/repo.git）';
}

/** git_status の error 文字列に頼らず「リポジトリではない」を判定するための表示用メッセージ。 */
export function notARepoMessage(path: string): string {
  return `このフォルダはまだ Git リポジトリではありません（${path}）。`;
}
