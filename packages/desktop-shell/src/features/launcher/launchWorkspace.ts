import type { WorkspaceLaunchPayload } from '../projects/types';
import { resolveLaunchStrategy } from './appScopeResolvers';
import { useAppStore } from '../../store/useAppStore';

// Phase 2.3/2.4 Mock/Real launcher
export const launchWorkspace = async (payload: WorkspaceLaunchPayload): Promise<void> => {
  const strategy = resolveLaunchStrategy(payload.appScope);
  
  console.log(`[Launcher] Routing request for scope: ${payload.appScope}`);
  console.log(`[Launcher] Selected strategy: ${strategy}`);
  console.log(`[Launcher] Payload Context:`, payload);

  // Phase 5: Generalize Webview Strategy for 3DSS, 3DSL, 3DSP
  if (strategy === 'webview') {
    console.log(`[Launcher Action] Native tab routing requested for ${payload.appScope}. Payload stored in Zustand.`);
    useAppStore.getState().setLastLaunchPayload(payload);
    return;
  }

  // Fallback to mocks for other scopes
  switch (strategy) {
    case 'multiwindow':
      console.log(`[Launcher Action Mock] Creating new Tauri Window for ${payload.appScope} (Workspace: ${payload.workspaceId})`);
      break;
    case 'external':
      console.log(`[Launcher Action] Opening System Browser for external app.`);
      break;
    case 'internal':
      console.log(`[Launcher Action] Routing internal navigation to ${payload.workspaceId}.`);
      break;
    default:
      console.warn(`[Launcher Action] Unknown strategy: ${strategy}`);
  }
};
