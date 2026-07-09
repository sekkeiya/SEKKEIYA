import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { RoleMap } from '../../projects/types';
import { withMemberSync } from '../../projects/roles';

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  roles?: RoleMap;   // チーム既定ロール（新規 TEAM Pj / 自動追加時のデフォルト・docs/15 §2.2）
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  invitedBy: string;
  invitedByName: string;
  inviteeUid: string | null;
  inviteeEmail: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'team_invite' | 'member_joined' | 'project_assigned' | 'update_available' | 'task_assigned' | 'followed' | 'chat_message' | 'interview_request';
  teamId?: string;
  teamName?: string;
  fromUid?: string;
  fromName?: string;
  invitationId?: string;
  read: boolean;
  createdAt: string;
  // interview_request specific（AI記者からの取材依頼）
  title?: string;
  message?: string;
  articleId?: string;
  url?: string;
  // update_available specific
  latestVersion?: string;
  releaseNotes?: string;
  // task_assigned specific
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  // chat_message specific（Project Chat を開くための情報）
  chatKind?: 'project' | 'team' | 'dm';
  chatId?: string;       // project: projectId / team・dm: chats/{chatId}
  chatName?: string;
  messagePreview?: string;
}

export interface MutualFollowUser {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
}

const toIso = (ts: any): string => {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts.toDate) return ts.toDate().toISOString();
  return new Date().toISOString();
};

// ────────────────────────────────────────────
// Teams CRUD
// ────────────────────────────────────────────

export const createTeam = async (params: {
  ownerId: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
}): Promise<Team> => {
  const ref = await addDoc(collection(db, 'teams'), {
    name: params.name,
    description: params.description,
    ownerId: params.ownerId,
    ...withMemberSync({ [params.ownerId]: 'owner' }),
    visibility: params.visibility,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  const d = snap.data()!;
  return {
    id: snap.id,
    name: d.name,
    description: d.description,
    ownerId: d.ownerId,
    memberIds: d.memberIds ?? [params.ownerId],
    roles: d.roles ?? { [params.ownerId]: 'owner' },
    visibility: d.visibility,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
};

export const fetchMyTeams = async (userId: string): Promise<Team[]> => {
  const q = query(
    collection(db, 'teams'),
    where('memberIds', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? '',
      description: data.description ?? '',
      ownerId: data.ownerId ?? '',
      memberIds: data.memberIds ?? [],
      roles: data.roles,
      visibility: data.visibility ?? 'private',
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    };
  });
};

export const fetchTeam = async (teamId: string): Promise<Team | null> => {
  const snap = await getDoc(doc(db, 'teams', teamId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name ?? '',
    description: d.description ?? '',
    ownerId: d.ownerId ?? '',
    memberIds: d.memberIds ?? [],
    roles: d.roles,
    visibility: d.visibility ?? 'private',
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
};

export const updateTeam = async (
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'description' | 'visibility'>>
): Promise<void> => {
  await updateDoc(doc(db, 'teams', teamId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  const batch = writeBatch(db);
  // Delete all invitations sub-collection
  const invSnap = await getDocs(collection(db, 'teams', teamId, 'invitations'));
  invSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'teams', teamId));
  await batch.commit();
};

export const removeMember = async (teamId: string, memberUid: string): Promise<void> => {
  await updateDoc(doc(db, 'teams', teamId), {
    memberIds: arrayRemove(memberUid),
    [`roles.${memberUid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
};

export const leaveTeam = async (teamId: string, userId: string): Promise<void> => {
  await updateDoc(doc(db, 'teams', teamId), {
    memberIds: arrayRemove(userId),
    [`roles.${userId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
};

// ────────────────────────────────────────────
// Invitations
// ────────────────────────────────────────────

export const sendInvitation = async (params: {
  teamId: string;
  teamName: string;
  invitedBy: string;
  invitedByName: string;
  inviteeUid: string | null;
  inviteeEmail: string | null;
}): Promise<void> => {
  const batch = writeBatch(db);

  const invRef = doc(collection(db, 'teams', params.teamId, 'invitations'));
  const payload = {
    teamId: params.teamId,
    teamName: params.teamName,
    invitedBy: params.invitedBy,
    invitedByName: params.invitedByName,
    inviteeUid: params.inviteeUid,
    inviteeEmail: params.inviteeEmail,
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  batch.set(invRef, payload);

  // Mirror notification to invitee's sub-collection
  if (params.inviteeUid) {
    const notifRef = doc(collection(db, 'users', params.inviteeUid, 'notifications'));
    batch.set(notifRef, {
      type: 'team_invite',
      teamId: params.teamId,
      teamName: params.teamName,
      fromUid: params.invitedBy,
      fromName: params.invitedByName,
      invitationId: invRef.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
};

export const fetchPendingInvitations = async (teamId: string): Promise<TeamInvitation[]> => {
  const q = query(
    collection(db, 'teams', teamId, 'invitations'),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      teamId: data.teamId,
      teamName: data.teamName ?? '',
      invitedBy: data.invitedBy,
      invitedByName: data.invitedByName ?? '',
      inviteeUid: data.inviteeUid ?? null,
      inviteeEmail: data.inviteeEmail ?? null,
      status: data.status,
      createdAt: toIso(data.createdAt),
    };
  });
};

export const cancelInvitation = async (teamId: string, invitationId: string): Promise<void> => {
  await deleteDoc(doc(db, 'teams', teamId, 'invitations', invitationId));
};

// ────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────

export const fetchMyNotifications = async (userId: string): Promise<AppNotification[]> => {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      teamId: data.teamId ?? '',
      teamName: data.teamName ?? '',
      fromUid: data.fromUid ?? '',
      fromName: data.fromName ?? '',
      invitationId: data.invitationId ?? undefined,
      read: data.read ?? false,
      createdAt: toIso(data.createdAt),
      projectId: data.projectId ?? undefined,
      projectName: data.projectName ?? undefined,
      taskId: data.taskId ?? undefined,
      taskTitle: data.taskTitle ?? undefined,
      chatKind: data.chatKind ?? undefined,
      chatId: data.chatId ?? undefined,
      chatName: data.chatName ?? undefined,
      messagePreview: data.messagePreview ?? undefined,
    };
  });
};

export const subscribeToNotifications = (
  userId: string,
  onUpdate: (notifs: AppNotification[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        teamId: data.teamId ?? '',
        teamName: data.teamName ?? '',
        fromUid: data.fromUid ?? '',
        fromName: data.fromName ?? '',
        invitationId: data.invitationId ?? undefined,
        read: data.read ?? false,
        createdAt: toIso(data.createdAt),
        projectId: data.projectId ?? undefined,
        projectName: data.projectName ?? undefined,
        taskId: data.taskId ?? undefined,
        taskTitle: data.taskTitle ?? undefined,
        chatKind: data.chatKind ?? undefined,
        chatId: data.chatId ?? undefined,
        chatName: data.chatName ?? undefined,
        messagePreview: data.messagePreview ?? undefined,
        // interview_request 用（取材通知）
        title: data.title ?? undefined,
        message: data.message ?? undefined,
        articleId: data.articleId ?? undefined,
        url: data.url ?? undefined,
      } as AppNotification;
    });
    onUpdate(notifs);
  });
};

/** フォローされたことを相手に通知する（フォロー実行側から呼ぶ・fire-and-forget想定）。 */
export const notifyFollowed = async (params: {
  targetUid: string;
  fromUid: string;
  fromName: string;
}): Promise<void> => {
  await addDoc(collection(db, 'users', params.targetUid, 'notifications'), {
    type: 'followed',
    fromUid: params.fromUid,
    fromName: params.fromName,
    read: false,
    createdAt: serverTimestamp(),
  });
};

export const markNotificationRead = async (userId: string, notifId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId, 'notifications', notifId), { read: true });
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

export const acceptInvitation = async (params: {
  userId: string;
  notifId: string;
  teamId: string;
  invitationId: string;
}): Promise<void> => {
  console.log('[acceptInvitation] start', params);

  // ── Step 1: チームに自分を追加（non-member が自分を追加する専用ルールで許可）
  //   新規参加メンバーはチーム既定ロール = editor（docs/15 §2.2）。
  try {
    await updateDoc(doc(db, 'teams', params.teamId), {
      memberIds: arrayUnion(params.userId),
      [`roles.${params.userId}`]: 'editor',
      updatedAt: serverTimestamp(),
    });
    console.log('[acceptInvitation] team memberIds updated');
  } catch (e) {
    console.error('[acceptInvitation] FAILED: team update', e);
    throw e;
  }

  // ── Step 2: 招待ステータスを accepted に変更（inviteeUid == userId で許可）
  try {
    await updateDoc(doc(db, 'teams', params.teamId, 'invitations', params.invitationId), {
      status: 'accepted',
    });
    console.log('[acceptInvitation] invitation status updated');
  } catch (e) {
    // 招待 doc の更新は失敗してもチーム参加は完了しているので warning のみ
    console.warn('[acceptInvitation] invitation status update failed (non-critical):', e);
  }

  // ── Step 3: 通知を既読に変更
  try {
    await updateDoc(doc(db, 'users', params.userId, 'notifications', params.notifId), {
      read: true,
    });
    console.log('[acceptInvitation] notification marked read');
  } catch (e) {
    console.warn('[acceptInvitation] notification read mark failed (non-critical):', e);
  }

  // ── Step 4: チームプロジェクトに新メンバーを同期
  try {
    const projectsSnap = await getDocs(
      query(collection(db, 'projects'), where('teamId', '==', params.teamId))
    );
    if (!projectsSnap.empty) {
      const syncBatch = writeBatch(db);
      projectsSnap.docs.forEach(d => {
        syncBatch.update(d.ref, {
          memberIds: arrayUnion(params.userId),
          [`roles.${params.userId}`]: 'editor',
          updatedAt: serverTimestamp(),
        });
      });
      await syncBatch.commit();
      console.log('[acceptInvitation] team projects synced');
    }
  } catch (e) {
    console.warn('[acceptInvitation] team projects sync failed (non-critical):', e);
  }
};

export const declineInvitation = async (params: {
  userId: string;
  notifId: string;
  teamId: string;
  invitationId: string;
}): Promise<void> => {
  const batch = writeBatch(db);

  batch.update(doc(db, 'teams', params.teamId, 'invitations', params.invitationId), {
    status: 'declined',
  });

  batch.update(doc(db, 'users', params.userId, 'notifications', params.notifId), {
    read: true,
  });

  await batch.commit();
};

// ────────────────────────────────────────────
// Team Projects
// ────────────────────────────────────────────

export interface TeamProject {
  id: string;
  name: string;
  ownerId: string;
  teamId: string;
  memberIds: string[];
  createdAt: string;
}

// memberIds array-contains クエリを使うことでFirestoreルールを満たす
// (where teamId == x だけでは「他ユーザーのドキュメントを返す可能性」を
//  Firestoreが拒否するため、ユーザーが必ずメンバーであることをクエリで保証する)
export const fetchTeamProjects = async (teamId: string, userId: string): Promise<TeamProject[]> => {
  const q = query(
    collection(db, 'projects'),
    where('memberIds', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter(d => d.data().teamId === teamId)
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? '',
        ownerId: data.ownerId ?? '',
        teamId: data.teamId ?? teamId,
        memberIds: data.memberIds ?? [],
        createdAt: toIso(data.createdAt),
      };
    });
};

// サイドバー用: ユーザーが属する全チームプロジェクトを1クエリで取得し teamId でグループ化
export const fetchAllTeamProjectsForUser = async (userId: string): Promise<Record<string, TeamProject[]>> => {
  const q = query(
    collection(db, 'projects'),
    where('memberIds', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  const result: Record<string, TeamProject[]> = {};
  snap.docs
    .filter(d => d.data().isTeam === true && d.data().teamId)
    .forEach(d => {
      const data = d.data();
      const tid = data.teamId as string;
      if (!result[tid]) result[tid] = [];
      result[tid].push({
        id: d.id,
        name: data.name ?? '',
        ownerId: data.ownerId ?? '',
        teamId: tid,
        memberIds: data.memberIds ?? [],
        createdAt: toIso(data.createdAt),
      });
    });
  return result;
};

// ────────────────────────────────────────────
// Social: mutual follows
// ────────────────────────────────────────────

export const fetchMutualFollows = async (userId: string): Promise<MutualFollowUser[]> => {
  const followingSnap = await getDocs(collection(db, 'users', userId, 'following'));
  const followingUids = new Set(followingSnap.docs.map(d => d.id));

  const followersSnap = await getDocs(collection(db, 'users', userId, 'followers'));
  const mutualUids = followersSnap.docs.map(d => d.id).filter(uid => followingUids.has(uid));

  if (mutualUids.length === 0) return [];

  const profiles = await Promise.all(
    mutualUids.map(uid => getDoc(doc(db, 'users', uid)))
  );

  return profiles
    .filter(s => s.exists())
    .map(s => {
      const d = s.data()!;
      return {
        uid: s.id,
        displayName: d.displayName ?? '名無しユーザー',
        photoURL: d.photoURL ?? '',
        bio: d.bio ?? '',
      };
    });
};
