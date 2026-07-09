// Verb レジストリの共通型（docs/20）。
// 1 verb = 1 定義（name + schema + risk + handler）を子アプリの chat/*Verbs.ts に置き、
// verbRegistry.ts で集約する。dispatchAgentTool は VERB_MAP を優先実行する。

/** データ損失フットプリントに基づくリスク（docs/10）。 */
export type VerbRisk = 'low' | 'medium' | 'high';

/** verb ハンドラに渡す実行コンテキスト（orchestrator が構築）。 */
export interface VerbCtx {
  /** モデルが渡したツール入力。 */
  input: any;
  /** 実行中のチャットセッション ID（UI 描画・projectId 解決に使用）。 */
  sessionId?: string | null;
  /** useActionRegistry.dispatch（サイト編集ツール等の委譲先）。 */
  dispatch: Function;
  /**
   * projectId 解決ヘルパー。
   * 優先度: input.projectId → session.projectId → site project → active project。
   */
  resolveProjectId: (inputPid?: string) => string | undefined;
}

/** 1 つの verb（チャットから呼べる機能）の単一定義。 */
export interface VerbDef {
  /** ツール名（Anthropic tool name と一致。snake_case）。 */
  name: string;
  /** モデル向けの説明（agentTurn.js の TOOLS[] へ生成同期される）。 */
  description: string;
  /** Anthropic input_schema 互換の JSON Schema。 */
  input: Record<string, any>;
  /** リスク階級。 */
  risk: VerbRisk;
  /**
   * S.Layout 等の「ビューポートに読み込まれた live 3D シーン」に作用するか（docs/20 §2）。
   * true の verb は ensureLayoutOpen + sceneActionBus 経由で実行する（段階導入中）。
   */
  sceneBound?: boolean;
  /** 進捗表示ラベル（例: 'レイアウトを確認しています…'）。 */
  label?: string;
  /** UI を出してユーザー操作を待つ（propose_choices 系）。 */
  yields?: boolean;
  /** 実行体。返り値は JSON 文字列（{ ok, ... } | { ok:false, error }）またはオブジェクト。 */
  handler: (ctx: VerbCtx) => Promise<any>;
}
