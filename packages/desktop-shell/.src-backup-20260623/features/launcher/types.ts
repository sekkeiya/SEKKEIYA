import type { WorkspaceLaunchPayload } from '../projects/types';

export type LaunchStrategy = 'multiwindow' | 'webview' | 'external' | 'internal';

export interface AppScopeConfig {
  scope: string;
  defaultStrategy: LaunchStrategy;
  description: string;
}

export type LauncherHandler = (payload: WorkspaceLaunchPayload) => Promise<void>;
