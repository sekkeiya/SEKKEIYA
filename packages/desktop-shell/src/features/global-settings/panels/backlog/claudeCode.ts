// 要件75: Claude Code の導入状況（React / Tauri 非依存の純ロジック）。
// 実行ループは「SEKKEIYA Code でキューを積む → ユーザーの PC の Claude Code が /queue で処理する」で
// 成立するため、Claude Code が入っていないと /queue スキルを配っても何も起きない。
// 実際の検出（`claude --version` の実行）は Rust 側の check_claude_code コマンド。

/** Rust の check_claude_code が返す形（src-tauri/src/devtools.rs と対応）。 */
export interface ClaudeCodeStatus {
  installed: boolean;
  /** 検出できたバージョン文字列（例 "1.0.30"）。取れなければ null。 */
  version: string | null;
  /** 実行ファイルの場所。取れなければ null。 */
  path: string | null;
  /**
   * PATH から `claude` で起動できるか。
   * ネイティブインストーラは ~/.local/bin に置くだけで PATH を通さないことがあり、
   * その場合 installed=true / onPath=false になる（ターミナルで `claude` と打てない状態）。
   */
  onPath: boolean;
  /** 検出に失敗したときの理由（installed=false のときだけ意味がある）。 */
  error: string | null;
}

export const CLAUDE_CODE_INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code';
export const CLAUDE_CODE_DOCS_URL = 'https://docs.claude.com/en/docs/claude-code/overview';

/**
 * `claude --version` の出力からバージョンを取り出す。
 * 出力例: "1.0.30 (Claude Code)" / "claude 1.2.3" / 前後に空行が入ることもある。
 */
export function parseClaudeVersion(stdout: string): string | null {
  const m = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/.exec(stdout ?? '');
  return m ? m[1] : null;
}

/** 未導入のときに UI へ出す案内文（コマンドは別途コピー可能な形で見せる）。 */
export function installGuidance(status: ClaudeCodeStatus): string {
  if (status.installed) return '';
  return status.error
    ? `Claude Code を検出できませんでした（${status.error}）。下のコマンドでインストールしてください。`
    : 'Claude Code が見つかりませんでした。下のコマンドでインストールしてください。';
}

/** 状態の詳細部（「Claude Code:」プレフィックス無し）。ラベルを自前で組む UI 向け。 */
export function statusDetail(status: ClaudeCodeStatus | null): string {
  if (!status) return '確認中…';
  if (!status.installed) return '未導入';
  const base = status.version ? `v${status.version}` : '導入済み';
  // PATH に無いと `claude` とタイプして起動できないので、その一点だけ知らせる。
  return status.onPath ? base : `${base}（PATH 未設定）`;
}

/** ヘッダーのチップに出す短いラベル。 */
export function statusLabel(status: ClaudeCodeStatus | null): string {
  return `Claude Code: ${statusDetail(status)}`;
}

/** PATH に通っていないときの案内（導入済みだがターミナルから起動できない状態）。 */
export function pathGuidance(status: ClaudeCodeStatus): string {
  if (!status.installed || status.onPath) return '';
  return 'インストールはされていますが、PATH に登録されていないためターミナルで `claude` と打っても起動しません。'
    + '実行ファイルのあるフォルダを PATH に追加するか、フルパスで起動してください。';
}
