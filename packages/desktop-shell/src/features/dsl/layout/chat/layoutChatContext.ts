// S.Layout スコープのチャット（右サイドバー埋め込み）用のクライアント文脈ビルダー（Phase 2）。
// 狙い: どの Base/Plan/Option が対象かを「確定情報」としてモデルに渡し、
// 「どのプランが対象ですか？」の聞き直しや一覧からの推測を無くす。
// useCoreOrchestrator から動的 import で呼ばれる（オーケストレーターを薄く保つ）。
import { useWorkspaceStructureStore } from '../store/useWorkspaceStructureStore';
import { useEditorModeStore } from '../store/useEditorModeStore';
import { useUiSelectionStore } from '../store/uiSelectionStore';

/** buildLayoutChatContext が必要とするセッション情報（ChatSession のサブセット）。 */
export interface LayoutChatSessionInfo {
  projectId: string;
  scope?: string;
  appScope?: string;
  taskId?: string;
  taskTitle?: string;
}

/**
 * S.Layout スコープのチャットに注入するクライアント文脈を組み立てる。
 * エディタが実際に対象ノードを開いているとき（＝ワークスペース構造ストアの選択チェーンに
 * セッションの taskId が含まれるとき）だけエディタ状態（モード・選択物）まで注入する。
 * 別画面からタスクセッションを開いた場合は、古いストア値を誤注入しないようノード情報のみ。
 */
export function buildLayoutChatContext(session: LayoutChatSessionInfo): string {
  const st = useWorkspaceStructureStore.getState();
  const base = st.bases.find((b) => b.id === st.selectedBaseId) ?? null;
  const plan = st.plansOfSelectedBase.find((p) => p.id === st.selectedPlanId) ?? null;
  const option = st.options.find((o) => o.id === st.selectedOptionId) ?? null;

  const chain = [st.selectedBaseId, st.selectedPlanId, st.selectedOptionId].filter(Boolean);
  const editorMatches = !session.taskId || chain.includes(session.taskId);

  const lines: string[] = [];
  lines.push('[S.Layout チャット文脈]');
  lines.push('このチャットは S.Layout（レイアウトエディタ）内の埋め込みチャットで、下記の対象に固定されています。');
  lines.push(`- projectId: ${session.projectId}`);
  if (session.taskId) {
    lines.push(`- 対象ノード: 「${session.taskTitle || session.taskId}」 (id: ${session.taskId})`);
  }

  if (editorMatches && (base || plan || option)) {
    const mode = useEditorModeStore.getState();
    const selectedItemIds: string[] = useUiSelectionStore.getState().selectedItemIds ?? [];
    lines.push('');
    lines.push('[現在エディタで開いている対象]');
    if (base) lines.push(`- Base（躯体）: 「${base.name ?? base.id}」 baseId=${base.id}`);
    if (plan) lines.push(`- Plan（プラン）: 「${plan.name ?? plan.id}」 planId=${plan.id}`);
    if (option) lines.push(`- Option（レイアウト案）: 「${option.name ?? option.id}」 optionId=${option.id}`);
    lines.push(
      `- 編集グループ: ${mode.editorViewGroup === '2d' ? '2D 配置（間取り・家具配置）' : '3D 演出（材質・照明・出力）'} / editorMode: ${mode.editorMode}`,
    );
    if (selectedItemIds.length) {
      const shown = selectedItemIds.slice(0, 5).join(', ');
      lines.push(`- 選択中アイテム: ${selectedItemIds.length}件 (${shown}${selectedItemIds.length > 5 ? ' …' : ''})`);
    }
  }

  lines.push('');
  lines.push('[振る舞い]');
  lines.push(
    '- レイアウト関連ツール（layout_* / run_auto_layout / render_layout / get_layout_outputs）を使う際は、上記の projectId / planId / optionId をそのまま指定すること。対象は確定済みなので、どのプラン/レイアウトが対象かをユーザーに聞き直したり、一覧から推測したりしない。',
  );
  lines.push('- 配置アイテムなど対象の中身が必要なときは layout_get / get_layout_outputs で取得する。');
  lines.push(
    '- このチャットの話題は原則この対象のレイアウト作業。他アプリ（ブログ・スライド等）の作業を求められたときだけ、SEKKEIYA Chat（全体チャット）の利用を案内してよい。',
  );
  return lines.join('\n');
}
