import { useEffect, useState } from 'react';
import { Box, ThemeProvider, CssBaseline, CircularProgress } from '@mui/material';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '../store/useAppStore';
import { WorkspacePanelContainer } from '../shared/layout/workspace/WorkspacePanelContainer';
import { WorkspaceProvider } from '../shared/layout/workspace/WorkspaceContext';
import { darkDesktopTheme } from '../styles/theme';

const SCOPE_TO_WS: Record<string, string> = {
  '3dss': 'models',
  '3dsl': 'layout',
  '3dsp': 'presents',
  '3dsc': 'create',
  '3dsd': 'diagram',
  '3dsr': 'drawing',
};

export const StandaloneWorkspace = () => {
  const params = new URLSearchParams(window.location.search);
  const scope = params.get('standalone') ?? '';
  const initialProjectId = params.get('projectId');
  const wsId = SCOPE_TO_WS[scope] ?? null;

  const [ready, setReady] = useState(false);

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

  // Sync project changes broadcast from the main window
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<{ projectId: string | null }>('sekkeiya://project-changed', (e) => {
      useAppStore.setState({ activeProjectId: e.payload.projectId });
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  return (
    <ThemeProvider theme={darkDesktopTheme}>
      <CssBaseline />
      <WorkspaceProvider>
        <Box sx={{ height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
          {ready ? (
            <WorkspacePanelContainer />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress size={32} sx={{ color: '#90caf9' }} />
            </Box>
          )}
        </Box>
      </WorkspaceProvider>
    </ThemeProvider>
  );
};
