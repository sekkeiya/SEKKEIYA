import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const SCOPE_TO_LABEL: Record<string, string> = {
  '3dss': 'S.Model',
  '3dsl': 'S.Layout',
  '3dsp': 'S.Slide',
  '3dsc': 'S.Create',
  '3dsd': 'S.Diagram',
  '3dsr': 'S.Drawing',
  '3dsi': 'S.Image',
  '3dsq': 'S.Quest',
  '3dsf': 'S.Portfolio',
  '3dsk': 'S.Library',
  '3dsb': 'S.Blog',
  '3dsm': 'S.Movie',
  '3dsmt': 'S.Material',
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
