// S.Layout 埋め込み AI チャット（Phase 1: スコープ付きオーケストレーターの配線）。
// 選択中の Base/Plan/Option ノードを task スコープのチャットセッションに対応付け、
// AIChatPanel を fixedSessionId で固定表示する。右ドックのグローバルチャットとは
// セッションを共有しない（activate: false で取得するため、互いの表示を奪わない）。
// ノードを切り替えるとセッションも追従する（ノードごとに議論が別セッションで残る）。
import React from 'react';
import { Box, Typography } from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AIChatPanel from '../../../../../../../components/AI/AIChatPanel';
import { useAIChatStore } from '../../../../../../../store/useAIChatStore';
import { useWorkspaceStructureStore } from '../../../../store/useWorkspaceStructureStore';

const APP_SCOPE = '3dsl';

interface LayoutChatPanelProps {
  projectId?: string | null;
}

const LayoutChatPanel: React.FC<LayoutChatPanelProps> = ({ projectId }) => {
  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plans = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);

  // チャットを結びつけるノード。深い方（Option > Plan > Base）を優先する。
  // 何も選択されていなければ null（→ subapp スコープの S.Layout チャットに落とす）。
  const { taskId, taskTitle } = React.useMemo(() => {
    const baseName = bases.find((b) => b.id === selectedBaseId)?.name;
    const planName = plans.find((p) => p.id === selectedPlanId)?.name;
    const optionName = options.find((o) => o.id === selectedOptionId)?.name;
    const id = selectedOptionId ?? selectedPlanId ?? selectedBaseId ?? null;
    if (!id) return { taskId: null as string | null, taskTitle: '' };
    const title = [baseName, planName, selectedOptionId ? (optionName || 'Option') : null]
      .filter(Boolean)
      .join(' / ') || 'レイアウト';
    return { taskId: id, taskTitle: title };
  }, [bases, plans, options, selectedBaseId, selectedPlanId, selectedOptionId]);

  // ノード（またはプロジェクト）が変わったらセッションを取得/作成して固定する。
  // activate: false でグローバルの activeSessionId には触れない。
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!projectId) { setSessionId(null); return; }
    const store = useAIChatStore.getState();
    if (taskId) {
      setSessionId(store.getOrCreateTaskSession(projectId, APP_SCOPE, taskId, taskTitle, { activate: false }));
      return;
    }
    // ノード未選択: プロジェクト × S.Layout の subapp スコープセッションを使い回す。
    const existing = store
      .getSessionsForScope({ projectId, appScope: APP_SCOPE })
      .find((s) => s.scope === 'subapp');
    setSessionId(
      existing?.id ??
        store.createScopedSession('subapp', {
          projectId,
          appScope: APP_SCOPE,
          title: 'S.Layout チャット',
          activate: false,
        }),
    );
  }, [projectId, taskId, taskTitle]);

  if (!projectId || !sessionId) {
    return (
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textAlign: 'center' }}>
          プロジェクトを開くとチャットを利用できます
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* このチャットが束ねられているノード（スコープ）の表示 */}
      <Box
        sx={{
          px: 1.25, py: 0.5, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 0.5,
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
        }}
      >
        <AccountTreeRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
        <Typography
          noWrap
          title={taskId ? taskTitle : 'S.Layout 全体'}
          sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontWeight: 500 }}
        >
          {taskId ? taskTitle : 'S.Layout 全体'}
        </Typography>
      </Box>
      <Box sx={{ flex: '1 1 0px', minHeight: 0 }}>
        <AIChatPanel fixedSessionId={sessionId} hideHeader hideWindowControls />
      </Box>
    </Box>
  );
};

export default LayoutChatPanel;
