import type { DesktopProject, FirestoreProjectDoc, WorkspacePayload } from '../types';

export const DEFAULT_WORKSPACES: WorkspacePayload[] = [
  { workspaceId: 'requirements', name: 'Requirements', type: 'document', appScope: 'SEKKEIYA', description: 'Project requirements and specifications' },
  { workspaceId: 'models', name: 'Models', type: '3d-viewer', appScope: '3DSS', description: '3D Shape Share environment' },
  { workspaceId: 'layout', name: 'Layout', type: 'editor', appScope: '3DSL', description: '3D Shape Layout workspace' },
  { workspaceId: 'presents', name: 'Presents', type: 'presentation', appScope: '3DSP', description: 'Presentation builder' },
  { workspaceId: 'analysis', name: 'Analysis', type: 'dashboard', appScope: 'SEKKEIYA', description: 'Project metrics' }
];

export const convertFirestoreProjectToDesktopProject = (docId: string, data: FirestoreProjectDoc): DesktopProject => {
  let lastModified = new Date().toISOString();
  if (data.lastActivityAt) {
    if (typeof data.lastActivityAt === 'string') {
      lastModified = data.lastActivityAt;
    } else if (typeof data.lastActivityAt.toDate === 'function') {
      lastModified = data.lastActivityAt.toDate().toISOString();
    }
  }

  return {
    id: docId,
    name: data.name || 'Untitled Project',
    description: `Visibility: ${data.visibility || 'private'}`,
    ownerId: data.ownerId || '',
    lastModifiedAt: lastModified,
    coverThumbnailUrl: data.coverThumbnailUrl,
    projectType: data.projectType || 'Project',
    visibility: data.visibility || 'private',
    phase: data.phase,
    memberIds: data.memberIds,
    updatedAt: data.updatedAt,
    requirements: data.requirements,
    isTeam: data.isTeam || false,
    workspaces: DEFAULT_WORKSPACES,
  };
};
