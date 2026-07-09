// shared/api/blog/categories.js
// 記事カテゴリの一元管理（Firestore: categories）。
// 管理画面(AdminCategoriesPage)・ネタ提案(suggestTopics)・公開一覧(ArticlesListPage) が共通で参照する。
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

const COL = "categories";

const normStr = (v) => (typeof v === "string" ? v.trim() : "");
const slugify = (v) =>
  normStr(v).toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/(^-|-$)/g, "");

/** トップレベル（ハブ）カテゴリ = 公開一覧のフィルタchip。コレクション未整備時のフォールバック。 */
export const DEFAULT_CATEGORIES = [
  { name: "お知らせ・最新情報",       slug: "news",          description: "SEKKEIYA公式のお知らせ・アップデート・AI業界ニュース", order: 1, parent: null },
  { name: "AI × 空間設計",           slug: "ai-design",     description: "AIで建築・インテリアを設計する手法と事例",            order: 2, parent: null },
  { name: "3Dモデル・マテリアル",     slug: "3d-models",     description: "3Dモデルの作成・管理・共有、テクスチャ・PBR素材",     order: 3, parent: null },
  { name: "間取り・空間レイアウト",   slug: "space-planning", description: "間取り作成・家具の自動配置・造作家具・環境ダイアグラム", order: 4, parent: null },
  { name: "設計プレゼン・図面",       slug: "presentation",  description: "3Dプレゼン・図面・ポートフォリオ・動画",              order: 5, parent: null },
  { name: "制作ワークフロー・連携",   slug: "workflow-hub",  description: "Rhino連携・データ変換・Desktopアプリ・チーム制作",     order: 6, parent: null },
  { name: "使い方・学習",             slug: "learn",         description: "チュートリアル・学習コース・ナレッジ",                order: 7, parent: null },
];

/** カテゴリ一覧を order 昇順で取得。activeOnly で有効のみ。 */
export async function fetchCategories({ activeOnly = false } = {}) {
  const snap = await getDocs(collection(db, COL));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (activeOnly) list = list.filter((c) => c.active !== false);
  list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name || "").localeCompare(b.name || ""));
  return list;
}

/** 名前配列だけ欲しいとき（フォールバック付き）。topLevelOnly でハブのみ。 */
export async function fetchCategoryNames({ activeOnly = true, topLevelOnly = false } = {}) {
  try {
    let list = await fetchCategories({ activeOnly });
    if (topLevelOnly) list = list.filter((c) => !c.parent);
    if (list.length) return list.map((c) => c.name);
  } catch (e) { console.warn("[categories] fetch failed, using defaults", e); }
  return DEFAULT_CATEGORIES.filter((c) => !topLevelOnly || !c.parent).map((c) => c.name);
}

/** ハブ→サブの階層で取得（管理UI・グループ表示用） */
export async function fetchCategoryTree({ activeOnly = false } = {}) {
  const list = await fetchCategories({ activeOnly });
  const tops = list.filter((c) => !c.parent);
  return tops.map((t) => ({
    ...t,
    children: list.filter((c) => c.parent === t.slug),
  }));
}

export async function createCategory(data) {
  const name = normStr(data.name);
  const slug = slugify(data.slug || data.name);
  return await addDoc(collection(db, COL), {
    name,
    slug,
    description: normStr(data.description),
    order: Number(data.order) || 999,
    parent: data.parent || null,     // 親カテゴリの slug（トップレベルは null）
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCategory(id, data) {
  const patch = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) patch.name = normStr(data.name);
  if (data.slug !== undefined || data.name !== undefined) patch.slug = slugify(data.slug || data.name);
  if (data.description !== undefined) patch.description = normStr(data.description);
  if (data.order !== undefined) patch.order = Number(data.order) || 999;
  if (data.parent !== undefined) patch.parent = data.parent || null;
  if (data.active !== undefined) patch.active = !!data.active;
  await updateDoc(doc(db, COL, id), patch);
}

export async function deleteCategory(id) {
  await deleteDoc(doc(db, COL, id));
}

/** 既定カテゴリを一括投入（初回導入用）。既存があれば name 重複を避けて追加。 */
export async function seedDefaultCategories() {
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
