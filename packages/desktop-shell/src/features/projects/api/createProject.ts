import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { RoleMap } from '../types';
import { withMemberSync } from '../roles';

export const createProject = async ({
  userId,
  ownerName,
  projectName,
  isTeam = false,
  teamId,
  teamMemberIds,
}: {
  userId: string;
  ownerName: string;
  projectName: string;
  isTeam?: boolean;
  teamId?: string;
  teamMemberIds?: string[];
}) => {
  if (!userId) throw new Error("userId is required");

  const timestamp = serverTimestamp();
  const batch = writeBatch(db);
  const unifiedRef = doc(collection(db, "projects"));
  const newProjectId = unifiedRef.id;

  // 作成者は owner。チームメンバーが渡された場合は editor として加える（docs/15 §2.1）。
  const roles: RoleMap = {};
  for (const uid of teamMemberIds ?? []) roles[uid] = 'editor';
  roles[userId] = 'owner';

  const unifiedPayload: Record<string, any> = {
      name: projectName,
      visibility: "public",
      ownerId: userId,
      ownerName: ownerName,
      ...withMemberSync(roles),
      isTeam: isTeam,
      ...(teamId ? { teamId } : {}),
      sourceApp: "sekkeiya-desktop",
      schemaVersion: 2,
      itemCount: 0,
      coverThumbnailUrl: null,
      coverItemId: null,
      lastActivityAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
  };

  batch.set(unifiedRef, unifiedPayload);
  
  const standardWorkspaces = [
    { id: 'main', appScope: 'sekkeiya', name: 'Main Workspace', sortOrder: 0 },
    { id: 'models', appScope: '3dss', name: 'S.Model', sortOrder: 1 },
    { id: 'layout', appScope: '3dsl', name: 'S.Layout', sortOrder: 2 },
    { id: 'presents', appScope: '3dsp', name: 'S.Slide', sortOrder: 3 },
    { id: 'create', appScope: '3dsc', name: 'S.Create', sortOrder: 4 },
  ];

  for (const ws of standardWorkspaces) {
    const wsRef = doc(db, "projects", newProjectId, "workspaces", ws.id);
    batch.set(wsRef, {
      ...ws,
      workspaceType: ws.appScope,
      projectId: newProjectId,
      ownerId: userId,
      memberIds: [userId],
      visibility: 'public',
      itemCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  console.log(`[Desktop API] createProject Batch Write -> project ${newProjectId} + 5 workspaces`);
  await batch.commit();

  return { 
    id: newProjectId, 
    ...unifiedPayload,
    workspaces: standardWorkspaces.map(ws => ({
      ...ws,
      workspaceType: ws.appScope,
      projectId: newProjectId,
    }))
  };
};
