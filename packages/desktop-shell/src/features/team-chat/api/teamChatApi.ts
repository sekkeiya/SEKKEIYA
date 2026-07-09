// Project Chat（メンバー間チャット）の Firestore API。
// 会話の保存先は種別ごとに分かれる:
//   - project: /projects/{projectId}/chatMessages   （メンバーのみ・専用ルール）
//   - team:    /chats/team__{teamId}/messages       （既存「チャットMVP版」ルールを利用）
//   - dm:      /chats/dm__{uidA}__{uidB}/messages   （同上。uid はソート順）
// AI（SEKKEIYA Chat オーケストレーター）も kind: 'ai' の参加者として書き込む。

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limitToLast,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { ChatTarget } from '../store/useTeamChatStore';

export type TeamChatMessageKind = 'user' | 'ai' | 'system';

export interface TeamChatMessage {
  id: string;
  senderUid: string;       // kind: 'ai' のときは 'sekkeiya-ai'
  senderName: string;
  senderPhotoURL?: string;
  kind: TeamChatMessageKind;
  text: string;
  /** AI 依頼の発端になったメンバー（kind: 'ai' のとき表示用） */
  requestedByName?: string;
  createdAt: string; // ISO
}

export interface MemberProfile {
  uid: string;
  displayName: string;
  photoURL: string;
}

/** 既存 DM 会話の一覧表示用。 */
export interface DmChatSummary {
  chatId: string;
  otherUid: string;
  lastMessage?: string;
  updatedAt: string;
}

const AI_SENDER_UID = 'sekkeiya-ai';

const toIso = (ts: any): string => {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts.toDate) return ts.toDate().toISOString();
  return new Date().toISOString();
};

// ── 会話ターゲット → メッセージコレクション ─────────────────────────────
// project + topicId → /projects/{id}/chatTopics/{topicId}/messages（複数トピック）
// project（topicId なし）→ /projects/{id}/chatMessages（既定の「一般」・後方互換）
const messagesCol = (target: ChatTarget) => {
  if (target.kind === 'project') {
    return target.topicId
      ? collection(db, 'projects', target.id, 'chatTopics', target.topicId, 'messages')
      : collection(db, 'projects', target.id, 'chatMessages');
  }
  return collection(db, 'chats', target.id, 'messages');
};

// ── プロジェクトの複数トピック（チャット） ─────────────────────────────
export interface ProjectChatTopic {
  id: string;
  name: string;
  lastMessage?: string;
  updatedAt: string;
}

export const subscribeToProjectTopics = (
  projectId: string,
  onUpdate: (topics: ProjectChatTopic[]) => void,
  onError?: (err: Error) => void,
): (() => void) => {
  const q = query(collection(db, 'projects', projectId, 'chatTopics'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name ?? '無題のチャット', lastMessage: data.lastMessage ?? undefined, updatedAt: toIso(data.updatedAt) };
    }));
  }, (err) => onError?.(err));
};

// トピック（チャット）を削除する（ドキュメントのみ。メッセージ subcollection は残るが一覧から消える）。
export const deleteProjectTopic = async (projectId: string, topicId: string): Promise<void> => {
  await deleteDoc(doc(db, 'projects', projectId, 'chatTopics', topicId));
};

export const createProjectTopic = async (projectId: string, name: string, createdBy: string): Promise<string> => {
  const ref = await addDoc(collection(db, 'projects', projectId, 'chatTopics'), {
    name: name.trim() || '新しいチャット',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const dmChatId = (a: string, b: string): string => `dm__${[a, b].sort().join('__')}`;
export const teamChatId = (teamId: string): string => `team__${teamId}`;

/** DM の親ドキュメントを用意する（既存ルール: members に自分が含まれる更新のみ可）。 */
export const ensureDmChat = async (myUid: string, otherUid: string): Promise<string> => {
  const id = dmChatId(myUid, otherUid);
  await setDoc(doc(db, 'chats', id), {
    kind: 'dm',
    members: [myUid, otherUid].sort(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
};

/** チームチャットの親ドキュメントを用意する。 */
export const ensureTeamChat = async (teamId: string, teamName: string, memberIds: string[]): Promise<string> => {
  const id = teamChatId(teamId);
  await setDoc(doc(db, 'chats', id), {
    kind: 'team',
    teamId,
    name: teamName,
    members: memberIds,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
};

/** 自分が参加している DM 会話の一覧。 */
export const listMyDmChats = async (myUid: string): Promise<DmChatSummary[]> => {
  const snap = await getDocs(query(collection(db, 'chats'), where('members', 'array-contains', myUid)));
  return snap.docs
    .filter(d => (d.data().kind ?? 'dm') === 'dm')
    .map(d => {
      const data = d.data();
      const members: string[] = data.members ?? [];
      return {
        chatId: d.id,
        otherUid: members.find(u => u !== myUid) ?? myUid,
        lastMessage: data.lastMessage ?? undefined,
        updatedAt: toIso(data.updatedAt),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

/** 直近 200 件のメッセージを購読する（昇順）。 */
export const subscribeToConversation = (
  target: ChatTarget,
  onUpdate: (messages: TeamChatMessage[]) => void,
  onError?: (err: Error) => void,
): (() => void) => {
  const q = query(messagesCol(target), orderBy('createdAt', 'asc'), limitToLast(200));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        senderUid: data.senderUid ?? '',
        senderName: data.senderName ?? '',
        senderPhotoURL: data.senderPhotoURL ?? '',
        kind: (data.kind ?? 'user') as TeamChatMessageKind,
        text: data.text ?? '',
        requestedByName: data.requestedByName ?? undefined,
        createdAt: toIso(data.createdAt),
      } as TeamChatMessage;
    });
    onUpdate(messages);
  }, (err) => onError?.(err));
};

/** 会話の参加メンバー uid 一覧を取得する。 */
const fetchConversationMemberUids = async (target: ChatTarget): Promise<string[]> => {
  if (target.kind === 'project') {
    const snap = await getDoc(doc(db, 'projects', target.id));
    if (!snap.exists()) return [];
    const d = snap.data();
    return Array.from(new Set([d.ownerId, ...(d.memberIds ?? [])].filter(Boolean))) as string[];
  }
  const snap = await getDoc(doc(db, 'chats', target.id));
  return snap.exists() ? (snap.data().members ?? []) : [];
};

export const sendConversationMessage = async (
  target: ChatTarget,
  msg: {
    senderUid: string;
    senderName: string;
    senderPhotoURL?: string;
    kind?: TeamChatMessageKind;
    text: string;
    requestedByName?: string;
  },
): Promise<void> => {
  const kind = msg.kind ?? 'user';
  await addDoc(messagesCol(target), {
    senderUid: msg.senderUid,
    senderName: msg.senderName,
    senderPhotoURL: msg.senderPhotoURL ?? '',
    kind,
    text: msg.text,
    ...(msg.requestedByName ? { requestedByName: msg.requestedByName } : {}),
    createdAt: serverTimestamp(),
  });

  // 以降はメタ処理（一覧用 lastMessage と通知）。失敗してもメッセージ送信自体には影響させない。
  try {
    const memberUids = await fetchConversationMemberUids(target);

    // dm / team は親ドキュメントに最終メッセージを記録（一覧表示用）。
    // ルール上 update には members（自分含む）が必要なので必ず含める。
    if (target.kind === 'dm' || target.kind === 'team') {
      await setDoc(doc(db, 'chats', target.id), {
        members: memberUids,
        lastMessage: msg.text.slice(0, 80),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    // project の特定トピックは、トピックドキュメントに最終メッセージを記録（トピック一覧表示用）。
    if (target.kind === 'project' && target.topicId) {
      await setDoc(doc(db, 'projects', target.id, 'chatTopics', target.topicId), {
        lastMessage: msg.text.slice(0, 80),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    // ユーザー発言のみ、自分以外の参加メンバーへ通知（system / AI 返答は通知しない）。
    if (kind === 'user') {
      const recipients = memberUids.filter(uid => uid !== msg.senderUid);
      await Promise.all(recipients.map(uid =>
        addDoc(collection(db, 'users', uid, 'notifications'), {
          type: 'chat_message',
          fromUid: msg.senderUid,
          fromName: msg.senderName,
          chatKind: target.kind,
          chatId: target.id,
          chatName: target.kind === 'dm' ? msg.senderName : target.name,
          messagePreview: msg.text.slice(0, 60),
          read: false,
          createdAt: serverTimestamp(),
        }).catch(() => {})
      ));
    }
  } catch { /* メタ処理の失敗は無視 */ }
};

/** AI の発言を会話に投稿する。 */
export const sendAiConversationMessage = (
  target: ChatTarget,
  text: string,
  requestedByName?: string,
): Promise<void> =>
  sendConversationMessage(target, {
    senderUid: AI_SENDER_UID,
    senderName: 'SEKKEIYA AI',
    kind: 'ai',
    text,
    requestedByName,
  });

/** プロフィール（users/{uid}）をまとめて取得する。 */
export const fetchMemberProfiles = async (uids: string[]): Promise<MemberProfile[]> => {
  if (!uids.length) return [];
  const snaps = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid)).catch(() => null)));
  return snaps
    .map((s, i) => {
      if (!s || !s.exists()) {
        return { uid: uids[i], displayName: '名無しユーザー', photoURL: '' };
      }
      const d = s.data() as any;
      return {
        uid: s.id,
        displayName: d.displayName ?? '名無しユーザー',
        photoURL: d.photoURL ?? '',
      };
    });
};
