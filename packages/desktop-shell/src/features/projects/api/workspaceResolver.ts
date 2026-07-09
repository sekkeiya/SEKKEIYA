import type { FirestoreProjectDoc, WorkspacePayload } from '../types';
import { DEFAULT_WORKSPACES } from './projectAdapters';
import type { WorkspaceItemSummary } from './fetchWorkspaceItemsSummary';

/**
 * Resolves logical "Workspaces" dynamically based on board metadata and item distribution.
 * Bridges the gap between raw /boards storage and Desktop App Shell UI expectations.
 */
export const resolveProjectWorkspaces = (
  _projectId: string, 
  _boardData: FirestoreProjectDoc, 
  summary: WorkspaceItemSummary | null
): WorkspacePayload[] => {
  // Always include core operational workspaces
  const resolved: WorkspacePayload[] = [
    DEFAULT_WORKSPACES.find(ws => ws.workspaceId === 'requirements')!,
    DEFAULT_WORKSPACES.find(ws => ws.workspaceId === 'analysis')!
  ];

  // Dynamically resolve other workspaces if item counts indicate presence
  if (summary) {
    if (summary.modelCount > 0) {
      resolved.push(DEFAULT_WORKSPACES.find(ws => ws.workspaceId === 'models')!);
    }
    if (summary.layoutCount > 0) {
      resolved.push(DEFAULT_WORKSPACES.find(ws => ws.workspaceId === 'layout')!);
    }
    // E.g., assume Presents requires models OR layouts
    if (summary.modelCount > 0 || summary.layoutCount > 0) {
      resolved.push(DEFAULT_WORKSPACES.find(ws => ws.workspaceId === 'presents')!);
    }
    return resolved;
  }

  // Fallback: If no summary exists, default to all modules to ensure reachability
  return DEFAULT_WORKSPACES;
};
