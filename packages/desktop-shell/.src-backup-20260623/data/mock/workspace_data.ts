export interface Workspace {
  id: string;
  name: string;
  type: string;
  appScope: string;
  description: string;
}

export const MOCK_WORKSPACES: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Requirements',
    type: 'document',
    appScope: 'SEKKEIYA',
    description: 'Project requirements and specification documents',
  },
  {
    id: 'ws-2',
    name: 'Models',
    type: '3d-viewer',
    appScope: '3DSS',
    description: '3D Shape Share environment',
  },
  {
    id: 'ws-3',
    name: 'Layout',
    type: 'editor',
    appScope: '3DSL',
    description: '3D Shape Layout workspace',
  },
  {
    id: 'ws-4',
    name: 'Presents',
    type: 'presentation',
    appScope: '3DSP',
    description: 'Presentation builder',
  },
  {
    id: 'ws-5',
    name: 'Analysis',
    type: 'dashboard',
    appScope: 'SEKKEIYA',
    description: 'Project metrics and analysis',
  }
];

export interface Project {
  id: string;
  name: string;
  description: string;
  lastModified?: string;
  workspaces: Workspace[];
}

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Cyberpunk City Block',
    description: 'Main level layout and 3D assets for the new cyberpunk city game project.',
    lastModified: '2026-03-28T07:00:00Z',
    workspaces: MOCK_WORKSPACES,
  },
  {
    id: 'proj-2',
    name: 'Fantasy Castle UI',
    description: 'UI exploration for fantasy castle presentation.',
    lastModified: '2026-03-27T12:00:00Z',
    workspaces: [MOCK_WORKSPACES[1], MOCK_WORKSPACES[3]],
  }
];
