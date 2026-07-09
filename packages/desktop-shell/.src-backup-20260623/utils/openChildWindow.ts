import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const SCOPE_TO_LABEL: Record<string, string> = {
  '3dss': '3DSS（Models）',
  '3dsl': '3DSL（Layout）',
  '3dsp': '3DSP（Presents）',
  '3dsc': '3DSC（Create）',
  '3dsd': 'S.Diagram',
  '3dsr': 'S.Drawing',
};

export const openChildWindow = (scope: string, projectId: string | null) => {
  const label = SCOPE_TO_LABEL[scope] ?? scope;
  const windowLabel = `sekkeiya-child-${scope}-${Date.now()}`;

  const params = new URLSearchParams({ standalone: scope });
  if (projectId) params.set('projectId', projectId);

  const win = new WebviewWindow(windowLabel, {
    url: `/?${params.toString()}`,
    title: `${label} — SEKKEIYA`,
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    center: true,
    resizable: true,
    decorations: true,
  });

  win.once('tauri://error', (e) => {
    console.error('[openChildWindow] Failed to open window:', e);
  });

  return win;
};
