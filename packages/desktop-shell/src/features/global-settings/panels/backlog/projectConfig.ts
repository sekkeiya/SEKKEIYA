// 要件78: プロジェクトごとの検証コマンド（テスト/リンタ/ビルド）。
// 置き場所は `.claude/sekkeiya-code/project.json`（backlog.json と同じフォルダ）。
// SEKKEIYA Code アプリが編集し、Claude Code の /queue スキルが実装後に読んで実行する。
// SKILL.md 側は「project.json の verify[] を実行する」とだけ書いてあるので、
// コマンドを変えてもスキルの書き直しは要らない。
//
// React / Tauri fs 非依存の純ロジック（fs 層は DevStatusPanel 側）。

/** 実行する検証 1 件。command はプロジェクトルートで実行するシェルコマンド。 */
export interface VerifyCommand { label: string; command: string; }

export interface ProjectConfig {
  version: 1;
  /** 実装後に流す検証コマンド（順に実行し、すべて成功で合格）。 */
  verify: VerifyCommand[];
}

/** プロジェクトルートからの相対パス。 */
export const PROJECT_CONFIG_PATH = '.claude/sekkeiya-code/project.json';

export function emptyProjectConfig(): ProjectConfig {
  return { version: 1, verify: [] };
}

/**
 * project.json を読む。壊れていても落とさず、読めた範囲だけ拾う
 * （ユーザーが手で編集していることを前提にする）。
 */
export function parseProjectConfig(text: string): ProjectConfig {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return emptyProjectConfig(); }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyProjectConfig();
  const o = raw as { verify?: unknown };
  const list = Array.isArray(o.verify) ? o.verify : [];
  const verify = list
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v))
    .map(v => ({
      label: typeof v.label === 'string' ? v.label : '',
      command: typeof v.command === 'string' ? v.command : '',
    }));
  return { version: 1, verify: normalizeVerify(verify) };
}

/** 空コマンドを落とし、前後の空白を落とす。ラベル未入力はコマンドで代用する。 */
export function normalizeVerify(list: VerifyCommand[]): VerifyCommand[] {
  return list
    .map(v => ({ label: (v.label ?? '').trim(), command: (v.command ?? '').trim() }))
    .filter(v => v.command !== '')
    .map(v => ({ label: v.label || v.command, command: v.command }));
}

/** git diff の読みやすさのためキー順を固定して直列化する（backlog.json と同じ方針）。 */
export function serializeProjectConfig(cfg: ProjectConfig): string {
  const out = {
    version: 1,
    verify: normalizeVerify(cfg.verify).map(v => ({ label: v.label, command: v.command })),
  };
  return JSON.stringify(out, null, 2) + '\n';
}

/** 入力欄のバリデーション。問題なければ null。 */
export function validateVerifyCommand(command: string): string | null {
  const t = (command ?? '').trim();
  if (!t) return 'コマンドを入力してください';
  if (t.length > 300) return 'コマンドが長すぎます（300文字まで）';
  if (/[\r\n]/.test(command)) return '改行は使えません（1行で書いてください）';
  return null;
}
