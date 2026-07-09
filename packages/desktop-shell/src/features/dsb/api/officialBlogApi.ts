// 公式ブログ(officialArticles)の Firestore CRUD。
// Web 側 src/shared/api/blog/officialArticles.js を desktop(TS)へ移植したもの。
// スキーマ・正規化(slug/tags/category)は Web と一致させ、公開サイトの描画/AI記者パイプラインと
// 互換を保つ（本文は HTML の contentFormat を維持）。
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { OfficialArticle, OfficialDraft, OfficialAuthor, OfficialCategory } from '../officialTypes';

const COL = 'officialArticles';

const normStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const normSlug = (v: unknown): string =>
  normStr(v).toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '');

const normTags = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const t = normStr(raw);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
};

const toLowerArray = (arr: string[]): string[] =>
  Array.isArray(arr) ? arr.map((s) => String(s).toLowerCase()).filter(Boolean) : [];

const normCategory = (cat: { slug?: string; name?: string } | null | undefined): OfficialCategory | null => {
  if (!cat) return null;
  const slug = normSlug(cat.slug || '');
  const name = normStr(cat.name || '');
  if (!slug && !name) return null;
  return { slug, name: name || slug };
};

/** 全件（下書き含む）を更新日の新しい順で取得（管理者一覧用）。 */
export async function listOfficialArticles(): Promise<OfficialArticle[]> {
  const q = query(collection(db, COL), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OfficialArticle, 'id'>) }));
}

export async function getOfficialArticle(id: string): Promise<OfficialArticle | null> {
  const s = await getDoc(doc(db, COL, id));
  return s.exists() ? ({ id: s.id, ...(s.data() as Omit<OfficialArticle, 'id'>) }) : null;
}

/** 下書きから Firestore へ書き込む payload を作る（正規化込み）。status はそのまま保持。 */
function toPayload(draft: OfficialDraft) {
  const tags = normTags(draft.tags);
  return {
    title: normStr(draft.title),
    slug: normSlug(draft.slug || draft.title),
    excerpt: normStr(draft.excerpt),
    coverUrl: normStr(draft.coverUrl),
    body: normStr(draft.body),
    contentFormat: draft.contentFormat || 'html',
    featured: !!draft.featured,
    seoTitle: normStr(draft.seoTitle),
    seoDescription: normStr(draft.seoDescription),
    tags,
    tagsLower: toLowerArray(tags),
    status: draft.status,
    category: normCategory(draft.categorySlug ? { slug: draft.categorySlug, name: draft.categoryName } : null),
  };
}

/** 新規作成（返り値は新しいドキュメントID）。公開状態のときのみ publishedAt を付与。 */
export async function createOfficialArticle(draft: OfficialDraft, author: OfficialAuthor): Promise<string> {
  const now = serverTimestamp();
  const base = {
    ...toPayload(draft),
    createdAt: now,
    updatedAt: now,
    publishedAt: draft.status === 'published' ? now : null,
    author: { uid: author.uid || null, displayName: normStr(author.displayName) },
  };
  const ref = await addDoc(collection(db, COL), base);
  return ref.id;
}

/** 更新。初めて公開状態になるタイミングで publishedAt を付与（既存があれば保持）。 */
export async function updateOfficialArticle(id: string, draft: OfficialDraft): Promise<void> {
  const ref = doc(db, COL, id);
  const currentSnap = await getDoc(ref);
  const current = currentSnap.exists() ? (currentSnap.data() as { publishedAt?: unknown }) : {};
  const patch: Record<string, unknown> = { ...toPayload(draft), updatedAt: serverTimestamp() };
  if (draft.status === 'published' && !current.publishedAt) {
    patch.publishedAt = serverTimestamp();
  }
  await updateDoc(ref, patch);
}

export async function deleteOfficialArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
