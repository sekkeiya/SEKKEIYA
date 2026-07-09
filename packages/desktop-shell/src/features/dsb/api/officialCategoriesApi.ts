// 記事カテゴリ（Firestore: categories）。Web 側 src/shared/api/blog/categories.js の TS 移植。
// 公式ブログの Content Strategy / 公開一覧のフィルタが参照する一元管理。
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

const COL = 'categories';

const normStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const slugify = (v: unknown): string =>
  normStr(v).toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '');

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order?: number;
  parent?: string | null;   // 親カテゴリの slug（トップレベルは null）
  active?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  order?: number | string;
  parent?: string | null;
  active?: boolean;
}

/** トップレベル（ハブ）カテゴリの既定セット。コレクション未整備時のフォールバック。 */
export const DEFAULT_CATEGORIES: CategoryInput[] = [
  { name: 'お知らせ・最新情報',     slug: 'news',           description: 'SEKKEIYA公式のお知らせ・アップデート・AI業界ニュース', order: 1, parent: null },
  { name: 'AI × 空間設計',          slug: 'ai-design',      description: 'AIで建築・インテリアを設計する手法と事例',           order: 2, parent: null },
  { name: '3Dモデル・マテリアル',    slug: '3d-models',      description: '3Dモデルの作成・管理・共有、テクスチャ・PBR素材',    order: 3, parent: null },
  { name: '間取り・空間レイアウト',  slug: 'space-planning', description: '間取り作成・家具の自動配置・造作家具・環境ダイアグラム', order: 4, parent: null },
  { name: '設計プレゼン・図面',      slug: 'presentation',   description: '3Dプレゼン・図面・ポートフォリオ・動画',             order: 5, parent: null },
  { name: '制作ワークフロー・連携',  slug: 'workflow-hub',   description: 'Rhino連携・データ変換・Desktopアプリ・チーム制作',    order: 6, parent: null },
  { name: '使い方・学習',           slug: 'learn',          description: 'チュートリアル・学習コース・ナレッジ',               order: 7, parent: null },
];

/** カテゴリ一覧を order 昇順で取得。activeOnly で有効のみ。 */
export async function fetchCategories({ activeOnly = false }: { activeOnly?: boolean } = {}): Promise<BlogCategory[]> {
  const snap = await getDocs(collection(db, COL));
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogCategory, 'id'>) }));
  if (activeOnly) list = list.filter((c) => c.active !== false);
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name || '').localeCompare(b.name || ''));
  return list;
}

/** 名前配列だけ欲しいとき（フォールバック付き）。topLevelOnly でハブのみ。 */
export async function fetchCategoryNames({ activeOnly = true, topLevelOnly = false }: { activeOnly?: boolean; topLevelOnly?: boolean } = {}): Promise<string[]> {
  try {
    let list = await fetchCategories({ activeOnly });
    if (topLevelOnly) list = list.filter((c) => !c.parent);
    if (list.length) return list.map((c) => c.name);
  } catch (e) { console.warn('[categories] fetch failed, using defaults', e); }
  return DEFAULT_CATEGORIES.filter((c) => !topLevelOnly || !c.parent).map((c) => c.name);
}

export async function createCategory(data: CategoryInput): Promise<void> {
  await addDoc(collection(db, COL), {
    name: normStr(data.name),
    slug: slugify(data.slug || data.name),
    description: normStr(data.description),
    order: Number(data.order) || 999,
    parent: data.parent || null,
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCategory(id: string, data: Partial<CategoryInput>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) patch.name = normStr(data.name);
  if (data.slug !== undefined || data.name !== undefined) patch.slug = slugify(data.slug || data.name);
  if (data.description !== undefined) patch.description = normStr(data.description);
  if (data.order !== undefined) patch.order = Number(data.order) || 999;
  if (data.parent !== undefined) patch.parent = data.parent || null;
  if (data.active !== undefined) patch.active = !!data.active;
  await updateDoc(doc(db, COL, id), patch);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/** 既定カテゴリを一括投入（name 重複はスキップ）。追加件数を返す。 */
export async function seedDefaultCategories(): Promise<number> {
  const existing = await fetchCategories();
  const names = new Set(existing.map((c) => c.name));
  let n = 0;
  for (const c of DEFAULT_CATEGORIES) {
    if (names.has(c.name)) continue;
    await createCategory(c);
    n++;
  }
  return n;
}
