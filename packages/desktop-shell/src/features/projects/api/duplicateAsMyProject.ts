/**
 * TEAM PROJECT → 新規 MY PROJECT として複製（docs/15 §3.1）。
 * 降格（TEAM→MY 変換）は破壊的なため提供せず、この複製で代替する。
 *
 * 複製範囲（Phase 1）: プロジェクト本体 + workspaces + site/main。
 * workFiles / assets / activities などの大型サブコレクションは複製しない
 * （重量・参照整合のため。必要になった時点で拡張する）。
 */

import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { withMemberSync } from '../roles';

export const duplicateAsMyProject = async (params: {
  sourceProjectId: string;
  userId: string;
  ownerName?: string;
  newName?: string;
}): Promise<{ id: string }> => {
  const { sourceProjectId, userId } = params;
  if (!userId) throw new Error('userId is required');

  const srcSnap = await getDoc(doc(db, 'projects', sourceProjectId));
  if (!srcSnap.exists()) throw new Error('複製元プロジェクトが見つかりません。');
  const src = srcSnap.data();

  const batch = writeBatch(db);
  const newRef = doc(collection(db, 'projects'));
  const newId = newRef.id;
  const timestamp = serverTimestamp();

  batch.set(newRef, {
    name: params.newName ?? `${src.name ?? 'Untitled'} (コピー)`,
    projectType: src.projectType ?? 'Project',
    visibility: 'public',
    ownerId: userId,
    ownerName: params.ownerName ?? src.ownerName ?? '',
    ...withMemberSync({ [userId]: 'owner' }),
    isTeam: false,                 // MY プロジェクトとして作成
    phase: src.phase ?? null,
    requirements: src.requirements ?? null,
    iconEmoji: src.iconEmoji ?? null,
    iconUrl: src.iconUrl ?? null,
    coverThumbnailUrl: src.coverThumbnailUrl ?? null,
    sourceApp: 'sekkeiya-desktop',
    schemaVersion: 2,
    duplicatedFrom: sourceProjectId,
    itemCount: 0,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // workspaces を複製（owner=新ユーザー）
  const wsSnap = await getDocs(collection(db, 'projects', sourceProjectId, 'workspaces'));
  wsSnap.docs.forEach(ws => {
    const w = ws.data();
    batch.set(doc(db, 'projects', newId, 'workspaces', ws.id), {
      ...w,
      projectId: newId,
      ownerId: userId,
      ...withMemberSync({ [userId]: 'owner' }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  // site/main を複製（あれば。下書き状態にリセットして公開は引き継がない）
  const siteSnap = await getDoc(doc(db, 'projects', sourceProjectId, 'site', 'main'));
  if (siteSnap.exists()) {
    const site = siteSnap.data();
    batch.set(doc(db, 'projects', newId, 'site', 'main'), {
      ...site,
      projectId: newId,
      publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await batch.commit();
  return { id: newId };
};
