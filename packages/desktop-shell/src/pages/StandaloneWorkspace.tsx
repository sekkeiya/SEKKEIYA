import { useEffect, useState } from 'react';
import { Box, ThemeProvider, CssBaseline, CircularProgress } from '@mui/material';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { WorkspacePanelContainer } from '../shared/layout/workspace/WorkspacePanelContainer';
import { WorkspaceProvider } from '../shared/layout/workspace/WorkspaceContext';
import { useAppTheme } from '../styles/useAppTheme';

const SCOPE_TO_WS: Record<string, string> = {
  '3dss': 'models',
  '3dsl': 'layout',
  '3dsp': 'presents',
  '3dsc': 'create',
  '3dsd': 'diagram',
  '3dsr': 'drawing',
  '3dsi': 'image',
  '3dsq': 'quest',
  '3dsf': 'portfolio',
  '3dsk': 'library',
  '3dsb': 'blog',
  '3dsm': 'movie',
  '3dsmt': 'material',
};

export const StandaloneWorkspace = () => {
  const appTheme = useAppTheme();
  const params = new URLSearchParams(window.location.search);
  const scope = params.get('standalone') ?? '';
  const initialProjectId = params.get('projectId');
  const wsId = SCOPE_TO_WS[scope] ?? null;

  const [ready, setReady] = useState(false);
  const currentUser = useAuthStore(s => s.currentUser);

  useEffect(() => {
    useAppStore.setState({
      activeProjectId: initialProjectId || null,
      activeWorkspaceId: wsId,
      currentMainView: 'workspace',
      isInitialized: true,
    });
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 本体の MainAppInitGate 相当：この窓の zustand ストアにもプロジェクト一覧を読み込む
  // （サイドバーの MY PROJECTS / TEAM PROJECTS が空になるのを防ぐ）。
  useEffect(() => {
    if (!currentUser) return;
    fetchUserProjects(currentUser.uid)
      .then(projects => useAppStore.getState().setProjects(projects))
      .catch(e => console.error('[StandaloneWorkspace] プロジェクト取得に失敗:', e));
  }, [currentUser]);

  // Sync project changes broadcast from the main window
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<{ projectId: string | null }>('sekkeiya://project-changed', (e) => {
      useAppStore.setState({ activeProjectId: e.payload.projectId });
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <WorkspaceProvider>
        {/* WorkspacePanelContainer のルートは flex:1 前提（メインでは flex 親の中にある）。
            block 親だと高さ 0 に潰れて真っ暗になるため、ここも flex 列にする。 */}
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
          {ready ? (
            <WorkspacePanelContainer />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress size={32} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
            </Box>
          )}
        </Box>
      </WorkspaceProvider>
    </ThemeProvider>
  );
};
