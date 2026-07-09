/**
 * Desktop UI Representation of a Project Workspace Launch Context
 */
export interface WorkspaceLaunchPayload {
  appScope: string;
  projectId: string; // The Project ID
  workspaceId: string; // e.g., 'models', 'layout'
  workspaceName?: string; // The display name of the workspace for the tab
}

export interface WorkspacePayload {
  workspaceId: string; // Identifier for the workspace (e.g. 'models', 'layout')
  name: string;        // Localized/Display name
  type: string;        // Visual type/icon mapping
  appScope: string;    // Target child application (e.g. '3DSS', '3DSL')
  description: string;
}

/**
 * Desktop UI Representation of a Project
 */
export interface DesktopProject {
  id: string;          // Project ID
  name: string;        // Display Name
  description: string; // Additional context
  ownerId: string;     // Primary owner UID
  lastModifiedAt: string; // ISO string for sorting
  coverThumbnailUrl?: string;
  projectType?: string;
  visibility?: string;
  phase?: string;
  memberIds?: string[];
  updatedAt?: any;
  requirements?: string;
  workspaces: WorkspacePayload[]; // List of available child-app entry points
  recentActivities?: ActivityItem[];
  isTeam?: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'document' | '3d-viewer' | 'editor';
  title: string;
  description: string;
  timestamp: string;
  workFileId?: string;
}

/**
 * Raw Firestore representation conforming to the Unified Schema
 * Based on /projects/{projectId}
 */
export interface FirestoreProjectDoc {
  name?: string;
  projectType?: string;
  ownerId?: string;
  memberIds?: string[];
  visibility?: string;
  phase?: string;
  requirements?: string;
  coverThumbnailUrl?: string;
  lastActivityAt?: string | { toDate: () => Date }; 
  updatedAt?: string | { toDate: () => Date };
  sourceApp?: string;
  schemaVersion?: number;
  isTeam?: boolean;
}

export type TemplateSourceType = 'official' | 'user' | 'public';

export interface RhinoTemplate {
  id: string;
  name: string;
  description: string;
  sourceType: TemplateSourceType;
  ownerId?: string;
  ownerName?: string;
  rhinoVersion?: number;
  unitSystem?: 'mm' | 'm' | 'inch';
  category: 'Default' | 'Architecture' | 'Large Objects' | 'Small Objects' | string;
  tags: string[];
  isPublic: boolean;
  templatePath: string;
  storagePath?: string;
  thumbnailUrl?: string;
  glbUrl?: string;
  createdAt?: string;
  isMock?: boolean;
  usageCount?: number;
  updatedAt?: string;
  toolType?: WorkFileToolType;
}

export type UploadStatus = 'idle' | 'uploading' | 'saving' | 'success' | 'error';

/* ==========================================================
 * Work File Architecture Types (Phase 1 - Unified Shared Assets)
 * =========================================================*/

export type WorkFileToolType = 'rhino' | 'blender' | 'sketchup' | 'revit' | 'other';

export interface WorkFile {
  id: string;
  projectId: string;         // Project ID
  name: string;              // e.g., 01_BaseModel.3dm
  toolType?: WorkFileToolType;
  currentVersionId?: string | null;
  latestVersionNumber?: number;
  updatedAt: string;
  updatedBy: string;
  status?: 'active' | 'archived';
  thumbnailUrl?: string | null;
  glbUrl?: string | null;
  storagePath?: string | null;
  lastOpenedAt?: string | null;
  createdAt: string;
  createdBy: string;
  appScope?: string;         // E.g., '3dsp', '3dss' etc
  type?: string;             // E.g., 'presentation', 'document'
  localPath?: string;        // Local filesystem path tracking
  isDeleted?: boolean;       // Soft delete flag
  size?: number;             // File size in bytes (of the latest version)
}

export interface WorkFileVersion {
  id: string; // versionId
  workFileId: string;
  versionNumber: number;
  comment?: string;
  storagePath?: string;
  createdAt: string;
  createdBy: string;
  size?: number;             // File size in bytes
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: 'work_file_created' | 'work_file_opened' | 'work_file_version_created' | 'work_file_updated';
  targetType: 'workFile' | 'project' | 'workspace' | 'document';
  targetId: string;
  userId: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface JournalEntry {
  id: string;
  projectId: string;
  authorId: string;
  content: string; // Markdown text
  title?: string;
  excerpt?: string;
  aiContextSnapshot: {
    contextLevel: string;
    watchedScopes: string[];
    activeProfileId?: string;
    activeProfileName?: string;
    workspaceId?: string | null;
    workspaceName?: string | null;
    promptLength?: number;
    contextSummaryHash?: string;
  };
  tags?: string[];
  embeddingState?: "none" | "pending" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface JournalEntryDoc {
  projectId: string;
  authorId: string;
  content: string;
  title?: string;
  excerpt?: string;
  aiContextSnapshot: {
    contextLevel: string;
    watchedScopes: string[];
    activeProfileId?: string;
    activeProfileName?: string;
    workspaceId?: string | null;
    workspaceName?: string | null;
    promptLength?: number;
    contextSummaryHash?: string;
  };
  tags?: string[];
  embeddingState?: "none" | "pending" | "completed" | "failed";
  createdAt: string | { toDate: () => Date };
  updatedAt: string | { toDate: () => Date };
  isDeleted?: boolean;
  deletedAt?: string | { toDate: () => Date };
  deletedBy?: string;
}

export interface WorkFileLocalBinding {
  workFileId: string;
  localPath: string; // The fully resolved path at the time of opening
  projectId?: string; // Stored to prevent brittle path parsing
  machineId?: string;
  lastOpenedAt?: string;
  existsLocally: boolean;
  localModifiedAt?: number | null;
  openedVersionId?: string;
}

/* ==========================================================
 * Phase 12 Ecosystem Architecture (Unified Projects SSOT)
 * =========================================================*/

/**
 * 3DSS Asset (Project Library)
 * Exists at /projects/{projectId}/assets/{assetId}
 */
export interface ProjectAssetDoc {
  itemType: string; // 'furniture', 'material', etc.
  name: string;
  modelUrl?: string; // Original or derived GLB url
  thumbnailUrl?: string;
  entityId?: string; // Reference to global master if applicable
  dimensions?: { x: number; y: number; z: number };
  materials?: any; // Configurable materials
  tags?: string[];
  addedBy: string;
  createdAt: string;
  updatedAt?: string;
  status?: 'active' | 'archived'; // For soft deletes
  usageCount?: number;
  isDeleted?: boolean; // Soft delete flag
}

/**
 * 3DSL Layout Node
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/plans/{planId}
 */
export interface LayoutPlanDoc {
  type: 'base' | 'plan' | 'option';
  name: string;
  parentId?: string | null; // Null for root nodes
  description?: string;
  thumbnailUrl?: string;    // Representative render or viewport capture
  rendersCount?: number;    // Denormalized count for display
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 3DSL Render — a saved still image produced from a Layout
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/layouts/{planId}/renders/{renderId}
 */
export interface DslRenderDoc {
  type: 'image' | 'video';
  shotName?: string;         // Name of the shot this was rendered from
  quality: 'standard' | 'cycles';
  url: string;               // Firebase Storage download URL
  thumbnailUrl?: string;     // Downscaled thumbnail (optional)
  width: number;
  height: number;
  durationSec?: number;      // For video renders
  samples?: number;          // Cycles samples count
  isHero?: boolean;          // If true this is used as the plan's thumbnailUrl
  createdBy: string;
  createdAt: string;
}

/**
 * 3DSL Layout Instance
 * Exists at /projects/{projectId}/workspaces/{workspaceId}/plans/{planId}/items/{itemId}
 */
export interface LayoutItemDoc {
  itemType: string;
  assetId: string; // Reference to a ProjectAssetDoc
  transform: {
    position: [number, number, number];
    rotation: [number, number, number]; // Euler angles (radians, standard order)
    scale: [number, number, number];
  };
  visible?: boolean;
  overrides?: Record<string, any>; // Instance specific color/material overrides
  addedBy: string;
  createdAt: string;
}
