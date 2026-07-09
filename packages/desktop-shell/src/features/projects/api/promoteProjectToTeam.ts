/**
 * MY PROJECT → TEAM PROJECT 昇格（docs/15 §3.1 / §7.1）。
 *
 *   - 一方向（昇格のみ）。降格は提供しない（duplicateAsMyProject で代替）。
 *   - 昇格先は「既存チームを選択」または「新規チームを作成」の両方を許可。
 *   - 元 Owner は owner を維持。チームメンバーは既定ロール editor で参加。
 *   - チームサイトは ProjectSiteCanvas が遅延生成するため、ここでは作らない
 *     （アカウントサイトと同じ lazy 方式）。
 */

import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { RoleMap } from '../types';
import { deriveRoles, isOwner, withMemberSync } from '../roles';
import { createTeam } from '../../teams/api/teamsApi';

export type PromoteTarget =
  | { kind: 'existing'; teamId: string }
  | { kind: 'new'; name: string; visibility?: 'public' | 'private' };

export interface PromoteResult {
  projectId: string;
  teamId: string;
}

export const promoteProjectToTeam = async (params: {
  projectId: string;
  actingUserId: string;
  ownerName?: string;
  target: PromoteTarget;
}): Promise<PromoteResult> => {
  const { projectId, actingUserId, target } = params;
  if (!actingUserId) throw new Error('actingUserId is required');

  // ── Step 1: プロジェクトを読み、acting user が owner であることを検証
  const projRef = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) throw new Error('プロジェクトが見つかりません。');
  const proj = projSnap.data();
  if (proj.isTeam) throw new Error('このプロジェクトは既にチームプロジェクトです。');

  const currentRoles = deriveRoles({ roles: proj.roles, ownerId: proj.ownerId, memberIds: proj.memberIds });
  if (!isOwner(currentRoles, actingUserId)) {
    throw new Error('チームへの昇格はオーナーのみが実行できます。');
  }

  // ── Step 2: 昇格先チームを解決（既存 or 新規作成）
  let teamId: string;
  let teamMemberIds: string[];
  if (target.kind === 'existing') {
    teamId = target.teamId;
    const teamSnap = await getDoc(doc(db, 'teams', teamId));
    if (!teamSnap.exists()) throw new Error('指定されたチームが見つかりません。');
    teamMemberIds = (teamSnap.data().memberIds as string[]) ?? [actingUserId];
  } else {
    const team = await createTeam({
      ownerId: actingUserId,
      name: target.name,
      description: '',
      visibility: target.visibility ?? 'private',
    });
    teamId = team.id;
    teamMemberIds = team.memberIds;
  }

  // ── Step 3: ロールをマージ（元 Owner 維持、チームメンバーは未所属なら editor で追加）
  const mergedRoles: RoleMap = { ...currentRoles };
  for (const uid of teamMemberIds) {
    if (!mergedRoles[uid]) mergedRoles[uid] = 'editor';
  }
  mergedRoles[actingUserId] = 'owner';

  // ── Step 4: プロジェクトを TEAM 化（原子的バッチ）
  const batch = writeBatch(db);
  batch.update(projRef, {
    isTeam: true,
    teamId,
    ...withMemberSync(mergedRoles),
    promotedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  // ── Step 5: チームメンバーへ通知（自分以外・非クリティカル）
  try {
    const notifBatch = writeBatch(db);
    for (const uid of teamMemberIds) {
      if (uid === actingUserId) continue;
      const notifRef = doc(collection(db, 'users', uid, 'notifications'));
      notifBatch.set(notifRef, {
        type: 'project_assigned',
        projectId,
        projectName: proj.name ?? '',
        fromUid: actingUserId,
        fromName: params.ownerName ?? '',
        teamId,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
    await notifBatch.commit();
  } catch (e) {
    console.warn('[promoteProjectToTeam] notification failed (non-critical):', e);
  }

  return { projectId, teamId };
};
