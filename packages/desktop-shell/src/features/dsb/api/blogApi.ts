// S.Blog — Firestore CRUD（正本: users/{uid}/blogArticles/{id}）。
// Phase 1 は記事プールの読み書きのみ。Phase 2 で saveBlogArticle に
// ①knowledgeSources 同期 ②publishedSites 反映（dual-publish）を足す。
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { BlogArticle, BlogStyle, BlogSourceSite } from '../types';
import { DEFAULT_BLOG_STYLE } from '../types';

const articlesCol = (uid: string) => collection(db, 'users', uid, 'blogArticles');
// ブログの設定（ユーザーが作成したカテゴリ等）。記事プールとは別ドキュメントで管理。
const settingsDoc = (uid: string) => doc(db, 'users', uid, 'blogSettings', 'main');

/** ユーザーが作成したカテゴリ一覧を取得（未設定なら空配列）。 */
export async function loadBlogCategories(uid: string): Promise<string[]> {
  const snap = await getDoc(settingsDoc(uid));
  const data = snap.exists() ? (snap.data() as { categories?: unknown }) : null;
  return Array.isArray(data?.categories) ? (data!.categories as unknown[]).filter((c): c is string => typeof c === 'string') : [];
}

/** ユーザーが作成したカテゴリ一覧を保存（merge）。 */
export async function saveBlogCategories(uid: string, categories: string[]): Promise<void> {
  await setDoc(settingsDoc(uid), { categories }, { merge: true });
}

/**
 * ホームに紐づけたフィードソース（媒体名の配列）を取得。
 * null = まだ一度も選択していない（初回はユーザー自身に選んでもらう。SEKKEIYAはおすすめ提示まで）。
 */
export async function loadBlogFeedSources(uid: string): Promise<string[] | null> {
  const snap = await getDoc(settingsDoc(uid));
  const data = snap.exists() ? (snap.data() as { feedSources?: unknown }) : null;
  return Array.isArray(data?.feedSources)
    ? (data!.feedSources as unknown[]).filter((s): s is string => typeof s === 'string')
    : null;
}

/** ホームに紐づけたフィードソースを保存（merge）。空配列=何も紐づけない、も有効な選択。 */
export async function saveBlogFeedSources(uid: string, sources: string[]): Promise<void> {
  await setDoc(settingsDoc(uid), { feedSources: sources }, { merge: true });
}

/** ユーザーが自分で追加したカスタムメディア（RSSソース）一覧を取得。 */
export async function loadCustomFeedSources(uid: string): Promise<BlogSourceSite[]> {
  const snap = await getDoc(settingsDoc(uid));
  const data = snap.exists() ? (snap.data() as { customFeedSources?: unknown }) : null;
  if (!Array.isArray(data?.customFeedSources)) return [];
  return (data!.customFeedSources as any[])
    .filter((s) => s && typeof s.name === 'string' && typeof s.feed === 'string')
    .map((s) => ({ name: s.name, feed: s.feed, group: 'カスタム' as const, note: s.note || 'ユーザー追加', lang: s.lang }));
}

/** S.Blog の動作設定（Global Settings > S.Blog）。blogSettings/main に保存。 */
export interface BlogPrefs {
  notifyDue: boolean;      // 投稿予定の期日デスクトップ通知
  planWeekdays: number[];  // 投稿計画の既定曜日（0=日〜6=土）
  planTime: string;        // 投稿計画の既定時刻 HH:mm
}
export const DEFAULT_BLOG_PREFS: BlogPrefs = { notifyDue: true, planWeekdays: [2, 5], planTime: '20:00' };

export async function loadBlogPrefs(uid: string): Promise<BlogPrefs> {
  const snap = await getDoc(settingsDoc(uid));
  const d = snap.exists() ? (snap.data() as any) : {};
  return {
    notifyDue: typeof d.notifyDue === 'boolean' ? d.notifyDue : DEFAULT_BLOG_PREFS.notifyDue,
    planWeekdays: Array.isArray(d.planWeekdays) ? d.planWeekdays.filter((n: any) => Number.isInteger(n)) : DEFAULT_BLOG_PREFS.planWeekdays,
    planTime: typeof d.planTime === 'string' && d.planTime ? d.planTime : DEFAULT_BLOG_PREFS.planTime,
  };
}

export async function saveBlogPrefs(uid: string, prefs: Partial<BlogPrefs>): Promise<void> {
  await setDoc(settingsDoc(uid), { ...prefs }, { merge: true });
}

/** ホームの人物・会社ウォッチ名（絞り込みチップのカスタム分）を取得。 */
export async function loadBlogNameFilters(uid: string): Promise<string[]> {
  const snap = await getDoc(settingsDoc(uid));
  const data = snap.exists() ? (snap.data() as { nameFilters?: unknown }) : null;
  return Array.isArray(data?.nameFilters)
    ? (data!.nameFilters as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
}

/** ホームの人物・会社ウォッチ名を保存（merge）。 */
export async function saveBlogNameFilters(uid: string, names: string[]): Promise<void> {
  await setDoc(settingsDoc(uid), { nameFilters: names }, { merge: true });
}

/** カスタムメディア一覧を保存（merge）。 */
export async function saveCustomFeedSources(uid: string, sources: BlogSourceSite[]): Promise<void> {
  await setDoc(settingsDoc(uid), {
    customFeedSources: sources.map((s) => ({ name: s.name, feed: s.feed, note: s.note, lang: s.lang ?? null })),
  }, { merge: true });
}

// ブログ全体のデザインスタイル（「✨デザイン」が参照。全記事に統一感を持たせる）。
const styleDoc = (uid: string) => doc(db, 'users', uid, 'blogSettings', 'style');

/** デザインスタイルを取得（未設定なら既定=マガジン）。 */
export async function loadBlogStyle(uid: string): Promise<BlogStyle> {
  const snap = await getDoc(styleDoc(uid));
  return snap.exists() ? { ...DEFAULT_BLOG_STYLE, ...(snap.data() as Partial<BlogStyle>) } : { ...DEFAULT_BLOG_STYLE };
}

/** デザインスタイルを保存（merge）。 */
export async function saveBlogStyle(uid: string, style: BlogStyle): Promise<void> {
  await setDoc(styleDoc(uid), { ...style }, { merge: true });
}

/** 自分のブログ記事一覧（更新日時の降順）。 */
export async function listBlogArticles(uid: string): Promise<BlogArticle[]> {
  const q = query(articlesCol(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogArticle, 'id'>) }));
}

/** 記事の作成/更新（merge 保存）。 */
export async function saveBlogArticle(uid: string, article: BlogArticle): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'blogArticles', article.id), { ...article }, { merge: true });
}

/** 記事の削除（公開ミラーも除去）。 */
export async function deleteBlogArticle(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'blogArticles', id));
  try { await deleteDoc(doc(db, 'communityArticles', id)); } catch { /* 未公開なら無い */ }
}

/**
 * SEKKEIYA 公式サイト /articles「みんなの記事」への公開ミラー。
 * 公開中 → communityArticles/{articleId} にサマリーを upsert（本文は正本を参照）。
 * 下書きに戻した → ミラーを削除。失敗しても記事保存は成立させる（呼び出し側でベストエフォート）。
 */
export async function syncCommunityMirror(uid: string, article: BlogArticle): Promise<void> {
  const mirror = doc(db, 'communityArticles', article.id);
  if (article.status === 'published') {
    await setDoc(mirror, {
      articleId: article.id,
      authorUid: uid,
      authorName: article.authorName || '',
      title: article.title,
      excerpt: article.excerpt || '',
      coverUrl: article.coverUrl || null,
      tags: article.tags || [],
      category: article.category || '',
      slug: article.slug,
      audioUrl: article.audioUrl || null,               // 🎙 音声版（公開ページで再生可能に）
      audioDurationSec: article.audioDurationSec || null,
      publishedAt: article.publishedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } else {
    try { await deleteDoc(mirror); } catch { /* 無ければ何もしない */ }
  }
}
