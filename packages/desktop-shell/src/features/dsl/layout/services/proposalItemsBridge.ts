/**
 * 提案（パターン）と LayoutShell の家具配置状態を繋ぐモジュールブリッジ。
 *
 * 配置の現在値（layoutDraft.items）と復元（applyLayoutDraft → saveLayout）は
 * LayoutShell のローカル状態・フックに閉じていて、提案側のフック/サービスから直接は
 * 触れない。layoutSceneRef と同じ流儀で、LayoutShell がマウント時に実装を登録する。
 */
export interface ProposalItemsBridge {
  /** 現在の配置（保存対象の形に軽量化する前の生 items）。 */
  getItems: () => Record<string, unknown>[];
  /** 提案のスナップショットを Plan（作業バッファ）へ書き戻す。 */
  restoreItems: (items: Record<string, unknown>[]) => Promise<void>;
}

let bridge: ProposalItemsBridge | null = null;

export function setProposalItemsBridge(next: ProposalItemsBridge | null): void {
  bridge = next;
}

export function getProposalItemsBridge(): ProposalItemsBridge | null {
  return bridge;
}
