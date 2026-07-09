import type { AppScopeConfig } from './types';

export const APP_SCOPES: Record<string, AppScopeConfig> = {
  '3DSS': { scope: '3DSS', defaultStrategy: 'webview', description: '3D Shape Share Viewer' },
  '3DSL': { scope: '3DSL', defaultStrategy: 'webview', description: '3D Shape Layout Editor' },
  '3DSP': { scope: '3DSP', defaultStrategy: 'webview', description: '3D Shape Presents Builder' },
  '3DSC': { scope: '3DSC', defaultStrategy: 'webview', description: '3D Shape Create - Custom Furniture Builder' },
  'SEKKEIYA': { scope: 'SEKKEIYA', defaultStrategy: 'internal', description: 'Parent Web Operations' },
};

export const resolveLaunchStrategy = (appScope: string) => {
  return APP_SCOPES[appScope.toUpperCase()]?.defaultStrategy || 'webview';
};
