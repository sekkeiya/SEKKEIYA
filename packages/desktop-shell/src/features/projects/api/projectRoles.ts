/**
 * プロジェクトのメンバーロール操作（docs/15 §3.3 / §7.2）。
 *
 * いずれも acting user が owner であることを前提とする（UI と Firestore ルールの双方でガード）。
 * 「最低 1 owner」は roles.ts の純粋関数が保証し、違反する変更は書き込み前に Error を投げる。
 * roles を更新する際は withMemberSync で memberIds を必ず同期する。
 */

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { ProjectRole, RoleMap } from '../types';
import {
  deriveRoles,
  isOwner,
  applyRoleChange,
  applyMemberRemoval,
  applyOwnershipTransfer,
  withMemberSync,
} from '../roles';

async function loadRolesOrThrow(projectId: string, actingUserId: string): Promise<RoleMap> {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) throw new Error('プロジェクトが見つかりません。');
  const d = snap.data();
  const roles = deriveRoles({ roles: d.roles, ownerId: d.ownerId, memberIds: d.memberIds });
  if (!isOwner(roles, actingUserId)) {
    throw new Error('メンバー管理はオーナーのみが実行できます。');
  }
  return roles;
}

/** メンバーのロールを変更する。owner を降格して owner が 0 名になる変更はブロックされる。 */
export const setProjectRole = async (params: {
  projectId: string;
  actingUserId: string;
  targetUid: string;
  role: ProjectRole;
}): Promise<void> => {
  const roles = await loadRolesOrThrow(params.projectId, params.actingUserId);
  const next = applyRoleChange(roles, params.targetUid, params.role); // 最低 1 owner を検証
  await updateDoc(doc(db, 'projects', params.projectId), {
    ...withMemberSync(next),
    updatedAt: serverTimestamp(),
  });
};

/**
 * オーナー権限を譲渡する。新 owner を owner に昇格し、旧 owner は editor へ降格（削除しない）。
 * 最後の owner を失うことはない（applyOwnershipTransfer が保証）。
 */
export const transferOwnership = async (params: {
  projectId: string;
  actingUserId: string;  // 現 owner
  toUid: string;         // 新 owner
}): Promise<void> => {
  const roles = await loadRolesOrThrow(params.projectId, params.actingUserId);
  const next = applyOwnershipTransfer(roles, params.actingUserId, params.toUid);
  await updateDoc(doc(db, 'projects', params.projectId), {
    ...withMemberSync(next),
    ownerId: params.toUid, // 代表 owner を更新（後方互換フィールド）
    updatedAt: serverTimestamp(),
  });
};

/** メンバーをプロジェクトから除外する。最後の owner は除外できない。 */
export const removeProjectMember = async (params: {
  projectId: string;
  actingUserId: string;
  targetUid: string;
}): Promise<void> => {
  const roles = await loadRolesOrThrow(params.projectId, params.actingUserId);
  const next = applyMemberRemoval(roles, params.targetUid); // 最低 1 owner を検証
  await updateDoc(doc(db, 'projects', params.projectId), {
    ...withMemberSync(next),
    updatedAt: serverTimestamp(),
  });
};
