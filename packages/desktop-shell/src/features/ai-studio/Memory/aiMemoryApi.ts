/**
 * aiMemoryApi — AIメモリー（長期記憶）の Firestore CRUD とダイジェスト再生成。docs/21。
 *
 * 2スコープ:
 *  - user:    users/{uid}/aiMemory/{id}     … 人物像（本人のみ）
 *  - project: projects/{pid}/aiMemory/{id}  … 案件の決定・制約（メンバー共有）
 *
 * ダイジェスト: 同コレクション内の予約ID `_digest` に active メモリーの行配列を保持。
 * （users/{uid} 直下にドキュメントは置けないため、コレクション内予約IDを正とする）
 * 注入側（agentTurn / blogDialogue = Webリポ CF）はこの1ドキュメントを読むだけでよい。
 * 書き込み系はすべて保存後にダイジェストを再生成する。
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export type MemoryScope = 'user' | 'project';
export type AiMemoryType =
  | 'opinion' | 'preference' | 'profile' | 'feedback'      // user スコープ
  | 'decision' | 'constraint' | 'context' | 'direction';   // project スコープ

export const USER_MEMORY_TYPES: { value: AiMemoryType; label: string }[] = [
  { value: 'opinion', label: '考え方' },
  { value: 'preference', label: '好み' },
  { value: 'profile', label: 'プロフィール' },
  { value: 'feedback', label: 'AIへの指示' },
];
export const PROJECT_MEMORY_TYPES: { value: AiMemoryType; label: string }[] = [
  { value: 'decision', label: '決定' },
  { value: 'constraint', label: '制約' },
  { value: 'context', label: '経緯' },
  { value: 'direction', label: '方針' },
];

export const memoryTypeLabel = (t: string): string =>
  [...USER_MEMORY_TYPES, ...PROJECT_MEMORY_TYPES].find((x) => x.value === t)?.label || t;

export interface AiMemory {
  id: string;
  text: string;
  type: AiMemoryType;
  /** 概念タグ（抽出AIが付与。グラフビューのエッジ材料）。手動追加は空。 */
  topics: string[];
  source: { kind: 'blogDiscussion' | 'chat' | 'manual'; refId?: string; by?: string };
  status: 'active' | 'archived';
  createdAt: number; // millis（表示用に正規化）
  updatedAt: number;
}

const DIGEST_ID = '_digest';
/** 1メモリーの上限（docs/21）。 */
export const MEMORY_TEXT_MAX = 120;
/** activeメモリー件数の上限。 */
export const ACTIVE_LIMIT: Record<MemoryScope, number> = { user: 60, project: 40 };
const DIGEST_LIMIT: Record<MemoryScope, { lines: number; chars: number }> = {
  user: { lines: 40, chars: 1200 },
  project: { lines: 30, chars: 1000 },
};

const colPath = (scope: MemoryScope, ownerId: string) =>
  scope === 'user' ? `users/${ownerId}/aiMemory` : `projects/${ownerId}/aiMemory`;

const toMillis = (v: any): number => {
  try { return typeof v?.toMillis === 'function' ? v.toMillis() : Number(v) || 0; } catch { return 0; }
};

/** メモリー一覧（_digest を除く。更新順）。 */
export async function listAiMemories(scope: MemoryScope, ownerId: string): Promise<AiMemory[]> {
  const snap = await getDocs(collection(db, colPath(scope, ownerId)));
  return snap.docs
    .filter((d) => d.id !== DIGEST_ID)
    .map((d) => {
      const a = d.data() as any;
      return {
        id: d.id,
        text: String(a.text || ''),
        type: (a.type || 'profile') as AiMemoryType,
        topics: Array.isArray(a.topics) ? a.topics.map((t: any) => String(t)).filter(Boolean) : [],
        source: a.source || { kind: 'manual' },
        status: a.status === 'archived' ? 'archived' : 'active',
        createdAt: toMillis(a.createdAt),
        updatedAt: toMillis(a.updatedAt),
      } as AiMemory;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** AIに注入されるダイジェスト（行配列）。 */
export async function getAiMemoryDigest(scope: MemoryScope, ownerId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, colPath(scope, ownerId), DIGEST_ID));
  const d = snap.exists() ? (snap.data() as any) : null;
  return Array.isArray(d?.lines) ? d.lines.map((l: any) => String(l)) : [];
}

/** active メモリーからダイジェストを再生成して保存。 */
export async function regenerateAiMemoryDigest(scope: MemoryScope, ownerId: string): Promise<string[]> {
  const all = await listAiMemories(scope, ownerId);
  const order = (scope === 'user' ? USER_MEMORY_TYPES : PROJECT_MEMORY_TYPES).map((t) => t.value);
  const active = all
    .filter((m) => m.status === 'active' && m.text.trim())
    .sort((a, b) => {
      const ta = order.indexOf(a.type); const tb = order.indexOf(b.type);
      if (ta !== tb) return ta - tb;
      return b.updatedAt - a.updatedAt; // 同タイプ内は新しい順
    });
  const limit = DIGEST_LIMIT[scope];
  const lines: string[] = [];
  let chars = 0;
  for (const m of active) {
    if (lines.length >= limit.lines) break;
    const line = `（${memoryTypeLabel(m.type)}）${m.text.trim()}`;
    if (chars + line.length > limit.chars) break;
    lines.push(line);
    chars += line.length;
  }
  await setDoc(doc(db, colPath(scope, ownerId), DIGEST_ID), { lines, updatedAt: serverTimestamp() });
  return lines;
}

export async function addAiMemory(
  scope: MemoryScope, ownerId: string,
  input: { text: string; type: AiMemoryType; topics?: string[]; sourceKind?: 'manual' | 'chat' | 'blogDiscussion' },
  byUid?: string,
): Promise<void> {
  const text = input.text.trim().slice(0, MEMORY_TEXT_MAX);
  if (!text) throw new Error('メモリーの内容が空です');
  await addDoc(collection(db, colPath(scope, ownerId)), {
    text,
    type: input.type,
    topics: Array.isArray(input.topics) ? input.topics.map((t) => String(t).slice(0, 20)).filter(Boolean).slice(0, 3) : [],
    source: { kind: input.sourceKind || 'manual', ...(byUid ? { by: byUid } : {}) },
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await regenerateAiMemoryDigest(scope, ownerId);
}

export async function updateAiMemory(
  scope: MemoryScope, ownerId: string, memId: string,
  patch: Partial<Pick<AiMemory, 'text' | 'type' | 'status'>>,
): Promise<void> {
  const p: any = { updatedAt: serverTimestamp() };
  if (patch.text !== undefined) p.text = patch.text.trim().slice(0, MEMORY_TEXT_MAX);
  if (patch.type !== undefined) p.type = patch.type;
  if (patch.status !== undefined) p.status = patch.status;
  await updateDoc(doc(db, colPath(scope, ownerId), memId), p);
  await regenerateAiMemoryDigest(scope, ownerId);
}

export async function deleteAiMemory(scope: MemoryScope, ownerId: string, memId: string): Promise<void> {
  await deleteDoc(doc(db, colPath(scope, ownerId), memId));
  await regenerateAiMemoryDigest(scope, ownerId);
}
