// ワークフロー設定のデータモデル（docs/19 / docs/20）。
// 自動化作業リストの各 capability（＝チャットに送ると走るタスク）に対して、
// 「どんな手順・分岐・既定パラメータで動くか」をユーザーが編集・保存できるようにする。
//
// v1 スコープ: 定義の編集＋永続化まで。オーケストレーター(useCoreOrchestrator)への
// 反映配線は次段（保存された WorkflowDef を system プロンプト/分岐の出所にする）。

/** ワークフローの1ステップ。verb 実行、または分岐ポイント。 */
export interface WorkflowStep {
  /** 安定キー（ステップ並べ替え・保存の identity）。 */
  id: string;
  /** 人が読むラベル。 */
  label: string;
  /** 関連 verb（実行ステップのみ。分岐ステップは undefined）。 */
  verb?: string;
  /** このステップを実行するか。 */
  enabled: boolean;
  /** 分岐ステップの選択肢（ユーザーへ提示する候補）。 */
  branches?: { id: string; label: string }[];
}

export type WorkflowParamType = 'select' | 'text' | 'number' | 'toggle';

/** ワークフローの既定パラメータ（送信時のデフォルト値）。 */
export interface WorkflowParam {
  key: string;
  label: string;
  type: WorkflowParamType;
  /** select 用の選択肢。 */
  options?: string[];
  /** 現在値（toggle は 'on' | 'off' の文字列で保持）。 */
  value: string;
}

/** 1 capability = 1 ワークフロー定義。 */
export interface WorkflowDef {
  /** AutomationCapability.id と一致（永続キー）。 */
  capabilityId: string;
  /** この作業を起動する言い回し（例文の集合）。 */
  triggers: string[];
  /** 実行手順。 */
  steps: WorkflowStep[];
  /** 既定パラメータ。 */
  params: WorkflowParam[];
  /** ノードキャンバス上の位置（nodeId -> 座標）。未指定なら自動レイアウト。 */
  layout?: Record<string, { x: number; y: number }>;
}
