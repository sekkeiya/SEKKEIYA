import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useAppStore } from '../../../store/useAppStore';
import ProjectHome from '../../../pages/ProjectHome';
import { DssAdapter, DslAdapter, DspAdapter, DscAdapter, AiCanvasAdapter, DsdAdapter, DsrAdapter, DsiAdapter, DsqAdapter, DsfAdapter, DskAdapter, DsbAdapter, DsmAdapter, DsmtAdapter } from './Adapters';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { PluginFrame } from '../../../features/plugins/host/PluginFrame';
import { usePluginRegistry } from '../../../features/plugins/registry/usePluginRegistry';
import { PLUGIN_TAB_PREFIX } from './WorkspaceTabBar';
const FIXED_PANELS = [
  { id: 'models', type: 'ModelsPanel' },
  { id: 'layout', type: 'LayoutPanel' },
  { id: 'presents', type: 'PresentsPanel' },
  { id: 'create', type: 'CreatePanel' },
  { id: 'canvas', type: 'CanvasPanel' },
  { id: 'diagram', type: 'DiagramPanel' },
  { id: 'drawing', type: 'DrawingPanel' },
  { id: 'image', type: 'ImagePanel' },
  { id: 'quest', type: 'QuestPanel' },
  { id: 'portfolio', type: 'PortfolioPanel' },
  { id: 'library', type: 'LibraryPanel' },
  { id: 'blog', type: 'BlogPanel' },
  { id: 'movie', type: 'MoviePanel' },
  { id: 'material', type: 'MaterialPanel' },
];

// workspaceId → appScope（dirty 判定に使用）
const PANEL_SCOPE: Record<string, string> = {
  models: '3dss', layout: '3dsl', presents: '3dsp', create: '3dsc', canvas: 'canvas',
  diagram: '3dsd', drawing: '3dsr', image: '3dsi', quest: '3dsq', portfolio: '3dsf',
  library: '3dsk', blog: '3dsb', movie: '3dsm', material: '3dsmt',
};

// WebGL コンテキスト枯渇対策：直近この数のパネルだけマウントしたままにし、
// それ以外（かつ未保存でない）パネルはアンマウントして Canvas/コンテキストを解放する。
// 未保存（dirty）パネルは常に保持し、作業中データを失わない。
const KEEP_RECENT = 3;

export const WorkspacePanelContainer: React.FC = () => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const getActiveWorkspace = useAppStore(s => s.getActiveWorkspace);
  const dirtyScopes = useAppStore(s => s.dirtyScopes);

  // 要件65: プラグインのタブはここで描画する。ALL_CHILD_TABS 由来の固定パネルとは
  // 別扱いにする（KeepAlive の対象にせず、タブを離れたらアンマウントして iframe を解放する）。
  const { plugins, loading: pluginsLoading } = usePluginRegistry();
  const isPluginTab = !!activeWorkspaceId?.startsWith(PLUGIN_TAB_PREFIX);
  const activePlugin = isPluginTab
    ? plugins.find(p => `${PLUGIN_TAB_PREFIX}${p.manifest.id}` === activeWorkspaceId) ?? null
    : null;

  // 直近にアクティブだったパネル順（先頭が最新）。KEEP_RECENT 件までマウント維持。
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setRecentIds(prev => {
      if (prev[0] === activeWorkspaceId) return prev;
      return [activeWorkspaceId, ...prev.filter(id => id !== activeWorkspaceId)].slice(0, 8);
    });
  }, [activeWorkspaceId]);

  const [mountedPanels, setMountedPanels] = useState<Set<string>>(new Set());
  // 各パネルが「アクティブだったときに渡された payload」を記憶しておく。
  // 非アクティブになっても payload を保持し続けることで、子アプリ（エディタ等）が
  // アンマウントされず、作業中の状態をそのまま残したままタブを行き来できる。
  const [panelPayloads, setPanelPayloads] = useState<Record<string, any>>({});

  useEffect(() => {
    if (activeWorkspaceId) {
      setMountedPanels(prev => {
        if (prev.has(activeWorkspaceId)) return prev;
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  // アクティブなパネルの最新 payload を記憶する
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const rawWs = getActiveWorkspace();
    const payload = {
      projectId: activeProjectId || '',
      workspaceId: activeWorkspaceId,
      workspaceName: rawWs?.name || '',
      appScope: (rawWs as any)?.appScope || (rawWs as any)?.workspaceType || '',
    };
    setPanelPayloads(prev => {
      const existing = prev[activeWorkspaceId];
      if (
        existing &&
        existing.projectId === payload.projectId &&
        existing.workspaceName === payload.workspaceName &&
        existing.appScope === payload.appScope
      ) {
        return prev;
      }
      return { ...prev, [activeWorkspaceId]: payload };
    });
  }, [activeWorkspaceId, activeProjectId, getActiveWorkspace]);

  if (activePlugin) {
    // ErrorBoundary で包む: プラグイン起因の描画例外が本体全体を落とさないようにする。
    // PluginFrame 内の state で拾えるのは読み込み失敗と RPC エラーだけで、
    // 描画中に投げられた例外はここでしか止められない。
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.default' }}>
        <ErrorBoundary key={activePlugin.manifest.id}>
          <PluginFrame plugin={activePlugin} projectId={activeProjectId || ''} />
        </ErrorBoundary>
      </Box>
    );
  }

  if (isPluginTab) {
    // activeWorkspaceId は plugin: prefix を持つのに activePlugin が見つからない取りこぼしケース。
    // usePluginRegistry の共有キャッシュ化で通常は起きなくなるが、将来また競合状態が
    // 起きたときに FIXED_PANELS.map まで落ちて「エラーも読み込み中表示も出ない空白」に
    // なるのを避けるため、専用の受け皿を残す（レビュー指摘）。
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, bgcolor: 'background.default' }}>
        {pluginsLoading ? (
          <CircularProgress />
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            プラグインが見つかりません（{activeWorkspaceId}）
          </Typography>
        )}
      </Box>
    );
  }

  if (!activeWorkspaceId) {
    // If no specific workspace tab is open, we can show the Overview or an empty state
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.default' }}>
        <ProjectHome />
      </Box>
    );
  }

  const rawWs = getActiveWorkspace();
  const adapterPayload = {
    projectId: activeProjectId || '',
    workspaceId: activeWorkspaceId,
    workspaceName: rawWs?.name || '',
    appScope: (rawWs as any)?.appScope || (rawWs as any)?.workspaceType || ''
  };

  // Render fixed panels, display current one (KeepAlive)
  return (
    <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {FIXED_PANELS.map(panel => {
        const isActive = panel.id === activeWorkspaceId;
        const isMounted = mountedPanels.has(panel.id);

        if (!isMounted && !isActive) return null;

        // WebGL コンテキスト枯渇対策：アクティブ／直近 KEEP_RECENT／未保存(dirty) 以外は
        // アンマウントして Canvas を解放する。dirty は作業中データ保護のため常に維持。
        const isRecent = recentIds.slice(0, KEEP_RECENT).includes(panel.id);
        const isDirty = !!dirtyScopes[PANEL_SCOPE[panel.id]];
        if (!isActive && !isRecent && !isDirty) return null;

        // アクティブパネルは最新の payload を、非アクティブパネルは記憶済みの
        // payload を渡し続ける。これにより非アクティブ中もエディタが生き続け、
        // 作業中の状態を保持したままタブ切り替えができる。
        const panelPayload = isActive ? adapterPayload : panelPayloads[panel.id];
        if (!panelPayload) return null;

        return (
          <Box
            key={panel.id}
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: isActive ? 'flex' : 'none',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <PanelRenderer type={panel.type} payload={panelPayload} />
          </Box>
        );
      })}
    </Box>
  );
};

// Assuming payload is passed simply to trigger rendering context
const PanelRenderer: React.FC<{ type: string; payload?: any }> = ({ type, payload }) => {
  switch (type) {
    case 'ProjectOverview':
      return <ProjectHome />;
    case 'ModelsPanel':
      return <DssAdapter payload={payload} />;
    case 'LayoutPanel':
        return <DslAdapter payload={payload} />;
    case 'PresentsPanel':
        return <DspAdapter payload={payload} />;
    case 'CreatePanel':
        return <DscAdapter payload={payload} />;
    case 'CanvasPanel':
        return <AiCanvasAdapter payload={payload} />;
    case 'DiagramPanel':
        return <DsdAdapter payload={payload} />;
    case 'DrawingPanel':
        return <DsrAdapter payload={payload} />;
    case 'ImagePanel':
        return <DsiAdapter payload={payload} />;
    case 'QuestPanel':
        return <DsqAdapter payload={payload} />;
    case 'PortfolioPanel':
        return <DsfAdapter payload={payload} />;
    case 'LibraryPanel':
        return <DskAdapter payload={payload} />;
    case 'BlogPanel':
        return <DsbAdapter payload={payload} />;
    case 'MoviePanel':
        return <DsmAdapter payload={payload} />;
    case 'MaterialPanel':
        return <DsmtAdapter payload={payload} />;
    default:
      return (
        <Box sx={{ flex: 1, p: 4 }}>
          <Typography variant="h6" color="#ff9800">Unknown Panel Type: {type}</Typography>
        </Box>
      );
  }
};
