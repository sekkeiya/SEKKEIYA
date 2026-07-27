// ローカル開発プロジェクトの置き場所と名前検証（React / fs 非依存の純ロジック）。
//
// 置き場所は %USERPROFILE%\SEKKEIYA\Dev\<プロジェクト名>\。
// SEKKEIYA 直下は既に <projectId>/WorkFiles/（本体プロジェクトの作業ファイル）が使うため、
// 開発用は Dev/ サブフォルダに分けて混同を避ける。
// $HOME/SEKKEIYA/** は capabilities で静的に許可済みなので、ここに作ったプロジェクトは
// アプリを再起動してもフォルダ選択なしで開ける（任意の場所のリポより堅牢）。

/** SEKKEIYA ルートからの相対サブディレクトリ。 */
export const DEV_PROJECTS_SUBDIR = 'SEKKEIYA/Dev';

// Windows で使えない文字と予約名。
const INVALID_CHARS = /[\\/:*?"<>|]/;
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * プロジェクト名を検証する。問題なければ null、あればユーザー向けメッセージを返す。
 * 呼び出し側は trim 済みの値を渡さなくてよい（内部で trim する）。
 */
export function validateProjectName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'プロジェクト名を入力してください';
  if (t.length > 64) return 'プロジェクト名が長すぎます（64文字まで）';
  if (INVALID_CHARS.test(t)) return '使用できない文字が含まれています（\\ / : * ? " < > |）';
  if (t === '.' || t === '..') return 'その名前は使用できません';
  if (t.endsWith('.') || t.endsWith(' ')) return '末尾に「.」や空白は使用できません';
  if (RESERVED.test(t)) return 'Windows の予約語は使用できません';
  return null;
}

/**
 * ホームディレクトリとプロジェクト名から、作成先の絶対パスを組み立てる。
 * 区切りは fs プラグインが解釈できる `/` に統一する。
 */
export function buildDevProjectPath(home: string, name: string): string {
  const base = home.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  return `${base}/${DEV_PROJECTS_SUBDIR}/${name.trim()}`;
}
