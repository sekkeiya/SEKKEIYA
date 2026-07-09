import { create } from 'zustand';
import type { BlogArticle, BlogStatus, BlogSchedule, ReaderBlockLite } from '../types';
import { listBlogArticles, saveBlogArticle, deleteBlogArticle, loadBlogCategories, saveBlogCategories, syncCommunityMirror } from '../api/blogApi';
import { listBlogSchedules, saveBlogSchedule, deleteBlogSchedule } from '../api/scheduleApi';
import { newBlogDraft, slugify } from '../lib/blogUtils';
import { useAppStore } from '../../../store/useAppStore';
import { syncBlogArticleToKnowledge } from '../lib/blogKnowledgeSync';
import { syncBlogArticleToLibrary } from '../lib/blogLibrarySync';
import { syncBlogArticleToDrive, removeBlogArticleFromDrive } from '../lib/blogDriveSync';

export interface SaveDraftResult {
  published: boolean;
  knowledgeSynced: boolean;
  knowledgeError?: string;
}

type EditorMode = 'list' | 'edit';
// schedule = プロジェクトの Schedules & Tasks 画面 / plan = 投稿計画カレンダー(BlogScheduleView)
type DsbView = 'feed' | 'overview' | 'schedule' | 'plan' | 'list' | 'categories';
type StatusFilter = 'all' | BlogStatus;

interface DsbState {
  articles: BlogArticle[];
  schedules: BlogSchedule[];
  loading: boolean;
  articlesLoaded: boolean;   // 最初の refresh が完了したら true（未ロードと「0件」を区別）
  mode: EditorMode;
  view: DsbView;
  draft: BlogArticle | null;
  search: string;
  statusFilter: StatusFilter;
  categoryFilter: string | null;   // null = 全カテゴリ（ホーム）
  categories: string[];            // ユーザーが作成したカテゴリ（永続化分）
  siteActiveBlogCat: string | null; // アカウントサイト上部バーとブログセクションで共有するカテゴリ絞り込み
  // S.Blog の対象。'account'=自分のアカウント記事(このストア) / 'official'=SEKKEIYA公式(useOfficialBlogStore)。
  // 管理者(hello@sekkeiya.com)のみ 'official' に切替できる。シェル/見た目は共通、データ源だけ切り替える。
  blogScope: 'account' | 'official';

  // 📖 リーダー↔議論パネルの橋渡し（議論ファースト時）。リーダーが抽出した本文・画像を
  // 議論パネルがインタビューの素材として参照し、参照した箇所へリーダーをスクロールできる。
  readerBlocks: ReaderBlockLite[];      // リーダーが公開中の抽出ブロック
  readerArticleUrl: string | null;      // そのブロックがどの記事のものか（取り違え防止）
  focusReaderBlock: { index: number; nonce: number } | null; // スクロール要求（nonceで毎回発火）
  setReaderBlocks: (url: string, blocks: ReaderBlockLite[]) => void;
  focusReaderBlockAt: (index: number) => void;

  // ✍ 「議論から記事を生成」実行中（DsbEditor が執筆モードへ切替え、執筆演出を出す）
  generating: boolean;
  setGenerating: (v: boolean) => void;

  // 🖼 記事画像の生成進捗（null=生成していない）。エディタの生成中アニメーションが購読する
  imageGen: { done: number; total: number } | null;
  setImageGen: (v: { done: number; total: number } | null) => void;

  setBlogScope: (s: 'account' | 'official') => void;
  setView: (v: DsbView) => void;
  setSearch: (s: string) => void;
  setStatusFilter: (s: StatusFilter) => void;
  setCategoryFilter: (c: string | null) => void;
  setSiteActiveBlogCat: (c: string | null) => void;
  goHome: () => void;              // ホーム = 一覧（全カテゴリ・全ステータス）

  refresh: (uid: string) => Promise<void>;
  loadSchedules: (uid: string) => Promise<void>;
  addSchedule: (uid: string, input: { date: string; time?: string | null; title: string; category?: string; note?: string; articleId?: string | null }) => Promise<void>;
  updateSchedule: (uid: string, id: string, patch: Partial<BlogSchedule>) => Promise<void>;
  removeSchedule: (uid: string, id: string) => Promise<void>;
  loadCategories: (uid: string) => Promise<void>;
  addCategory: (uid: string, name: string) => Promise<void>;
  removeCategory: (uid: string, name: string) => Promise<void>;
  renameCategory: (uid: string, oldName: string, newName: string) => Promise<void>;
  reorderCategories: (uid: string, orderedNames: string[]) => Promise<void>;
  startNew: (uid: string, authorName?: string | null, defaultCategory?: string) => void;
  startEdit: (id: string) => void;
  updateDraft: (patch: Partial<BlogArticle>) => void;
  cancelEdit: () => void;
  /** 保存＋（公開なら）dual-publish。既定は一覧へ戻る。keepEditing で編集を維持し、保存後の記事を draft に残す。 */
  saveDraft: (uid: string, opts?: { keepEditing?: boolean }) => Promise<SaveDraftResult>;
  /** 作業中の自動保存。下書き内容をクラウド(正本)へ静かに保存（公開連携はしない）。編集状態は維持。保存したら true。 */
  saveWorkingDraft: (uid: string) => Promise<boolean>;
  /** 一覧のインスペクターから記事の設定を部分更新して保存（フルエディタを開かずに）。公開状態に変わる場合は dual-publish も実施。 */
  patchArticle: (uid: string, id: string, patch: Partial<BlogArticle>) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
}

// 子アプリタブ（scope '3dsb'）の「作業中」ドット制御。
const setBlogDirty = (dirty: boolean) => {
  try { useAppStore.getState().setScopeDirty('3dsb', dirty); } catch { /* noop */ }
};
// 自動保存に値する内容があるか（空の新規ドラフトは作らない）。
// ★AIとの議論ログ・題材記事も「内容」に含める: 議論ファーストで本文が空のまま議論しても
//   下書きとして保存され、リロード/クラッシュで対話が失われない。
const hasContent = (a: BlogArticle | null): boolean =>
  !!a && !!((a.title && a.title.trim()) || (a.bodyMarkdown && a.bodyMarkdown.trim()) || (a.excerpt && a.excerpt.trim())
    || (a.aiDialogue && a.aiDialogue.length > 0) || (a.sourceRefs && a.sourceRefs.length > 0));

export const useDsbStore = create<DsbState>((set, get) => ({
  articles: [],
  schedules: [],
  loading: false,
  articlesLoaded: false,
  mode: 'list',
  view: 'feed', // 初期表示はホーム（おすすめメディアの記事フィード）
  draft: null,
  search: '',
  statusFilter: 'all',
  categoryFilter: null,
  categories: [],
  siteActiveBlogCat: null,
  blogScope: 'account',
  readerBlocks: [],
  readerArticleUrl: null,
  focusReaderBlock: null,

  setReaderBlocks: (url, blocks) => set({ readerArticleUrl: url, readerBlocks: blocks }),
  focusReaderBlockAt: (index) => set((s) => ({ focusReaderBlock: { index, nonce: (s.focusReaderBlock?.nonce ?? 0) + 1 } })),

  generating: false,
  setGenerating: (generating) => set({ generating }),

  imageGen: null,
  setImageGen: (imageGen) => set({ imageGen }),

  setBlogScope: (blogScope) => set({ blogScope }),
  setView: (view) => set({ view }),
  setSearch: (s) => set({ search: s }),
  // ステータス絞り込みを選んだら一覧ビューへ切り替える。
  setStatusFilter: (statusFilter) => set({ statusFilter, view: 'list' }),
  // カテゴリを選んだら一覧ビューへ（ステータス絞り込みは維持）。
  setCategoryFilter: (categoryFilter) => set({ categoryFilter, view: 'list' }),
  setSiteActiveBlogCat: (siteActiveBlogCat) => set({ siteActiveBlogCat }),
  // ホーム = 一覧の全件表示（カテゴリ・ステータスの絞り込みを解除）。
  goHome: () => set({ view: 'list', categoryFilter: null, statusFilter: 'all' }),

  loadCategories: async (uid) => {
    if (!uid) return;
    try {
      const categories = await loadBlogCategories(uid);
      set({ categories });
    } catch (e) {
      console.error('[useDsbStore] loadCategories failed', e);
    }
  },

  addCategory: async (uid, name) => {
    const n = name.trim();
    if (!uid || !n) return;
    const cur = get().categories;
    if (cur.includes(n)) { set({ categoryFilter: n, view: 'list' }); return; }
    const next = [...cur, n];
    set({ categories: next, categoryFilter: n, view: 'list' });
    try { await saveBlogCategories(uid, next); }
    catch (e) { console.error('[useDsbStore] addCategory failed', e); }
  },

  // カテゴリ削除: 配下の記事は「未分類（category='')」へ退避してから一覧から除く。
  removeCategory: async (uid, name) => {
    if (!uid) return;
    const nextCats = get().categories.filter((c) => c !== name);
    const affected = get().articles.filter((a) => a.category === name);
    // 記事のカテゴリを空に更新（本文編集ではないため updatedAt は変えない）。
    const nextArticles = get().articles.map((a) => (a.category === name ? { ...a, category: '' } : a));
    set({ articles: nextArticles, categories: nextCats, ...(get().categoryFilter === name ? { categoryFilter: null } : {}) });
    try {
      await Promise.all(affected.map((a) => saveBlogArticle(uid, { ...a, category: '' })));
      await saveBlogCategories(uid, nextCats);
    } catch (e) { console.error('[useDsbStore] removeCategory failed', e); }
  },

  // カテゴリ改名: 永続リストと、そのカテゴリの全記事の category を一括更新。
  renameCategory: async (uid, oldName, newName) => {
    const n = newName.trim();
    if (!uid || !n || n === oldName) return;
    const curCats = get().categories;
    // 既存名に統合する形（重複排除）。順序は oldName の位置を維持。
    const nextCats = curCats.includes(n)
      ? curCats.filter((c) => c !== oldName)
      : curCats.map((c) => (c === oldName ? n : c));
    const affected = get().articles.filter((a) => a.category === oldName);
    const nextArticles = get().articles.map((a) => (a.category === oldName ? { ...a, category: n } : a));
    set({
      articles: nextArticles, categories: nextCats,
      ...(get().categoryFilter === oldName ? { categoryFilter: n } : {}),
      ...(get().draft?.category === oldName ? { draft: { ...get().draft!, category: n } } : {}),
    });
    try {
      await Promise.all(affected.map((a) => saveBlogArticle(uid, { ...a, category: n })));
      await saveBlogCategories(uid, nextCats);
    } catch (e) { console.error('[useDsbStore] renameCategory failed', e); }
  },

  // カテゴリ並べ替え: 表示順 = categories 配列の順。ドラッグ結果をそのまま永続化。
  reorderCategories: async (uid, orderedNames) => {
    if (!uid) return;
    set({ categories: orderedNames });
    try { await saveBlogCategories(uid, orderedNames); }
    catch (e) { console.error('[useDsbStore] reorderCategories failed', e); }
  },

  refresh: async (uid) => {
    if (!uid) return;
    set({ loading: true });
    try {
      const [articles, schedules] = await Promise.all([
        listBlogArticles(uid),
        listBlogSchedules(uid).catch((e) => { console.warn('[useDsbStore] schedules load failed', e); return [] as BlogSchedule[]; }),
      ]);
      set({ articles, schedules, articlesLoaded: true });
    } catch (e) {
      console.error('[useDsbStore] refresh failed', e);
      set({ articlesLoaded: true }); // エラー時も「ロード試行済み」とみなす
    } finally {
      set({ loading: false });
    }
  },

  loadSchedules: async (uid) => {
    if (!uid) return;
    try {
      const schedules = await listBlogSchedules(uid);
      set({ schedules });
    } catch (e) {
      console.error('[useDsbStore] loadSchedules failed', e);
    }
  },

  addSchedule: async (uid, input) => {
    if (!uid || !input.date || !input.title.trim()) return;
    const now = new Date().toISOString();
    const schedule: BlogSchedule = {
      id: crypto.randomUUID(),
      date: input.date,
      time: input.time ?? null,
      title: input.title.trim(),
      category: input.category,
      note: input.note,
      status: 'planned',
      articleId: input.articleId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ schedules: [...s.schedules, schedule].sort((a, b) => a.date.localeCompare(b.date)) }));
    try { await saveBlogSchedule(uid, schedule); }
    catch (e) { console.error('[useDsbStore] addSchedule failed', e); }
  },

  updateSchedule: async (uid, id, patch) => {
    if (!uid) return;
    const cur = get().schedules.find((s) => s.id === id);
    if (!cur) return;
    const next: BlogSchedule = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    set((s) => ({ schedules: s.schedules.map((x) => (x.id === id ? next : x)).sort((a, b) => a.date.localeCompare(b.date)) }));
    try { await saveBlogSchedule(uid, next); }
    catch (e) { console.error('[useDsbStore] updateSchedule failed', e); }
  },

  removeSchedule: async (uid, id) => {
    if (!uid) return;
    set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) }));
    try { await deleteBlogSchedule(uid, id); }
    catch (e) { console.error('[useDsbStore] removeSchedule failed', e); }
  },

  startNew: (uid, authorName, defaultCategory) => {
    const draft = newBlogDraft({ authorUid: uid, authorName });
    set({ mode: 'edit', draft: defaultCategory ? { ...draft, category: defaultCategory } : draft });
    // 「AIと議論して書く」等では直後（同tick）に updateDraft({sourceRefs}) が入るため、
    // 次tickで即永続化 → その時点で記事一覧に下書きとして現れる。
    // まっさらな新規（title/本文/議論/題材すべて空）は hasContent が弾くので一覧は汚れない。
    setTimeout(() => { void get().saveWorkingDraft(uid).catch(() => { /* best-effort */ }); }, 0);
  },

  startEdit: (id) => {
    const found = get().articles.find((a) => a.id === id);
    if (found) set({ mode: 'edit', draft: { ...found } });
  },

  updateDraft: (patch) => {
    const draft = get().draft;
    if (!draft) return;
    const next = { ...draft, ...patch };
    set({ draft: next });
    if (hasContent(next)) setBlogDirty(true); // 作業中ドット
  },

  cancelEdit: () => { setBlogDirty(false); set({ mode: 'list', draft: null }); },

  saveDraft: async (uid, opts) => {
    const draft = get().draft;
    if (!uid || !draft) return { published: false, knowledgeSynced: false };
    const now = new Date().toISOString();
    let article: BlogArticle = {
      ...draft,
      slug: draft.slug?.trim() || slugify(draft.title),
      updatedAt: now,
      publishedAt:
        draft.status === 'published' ? draft.publishedAt || now : draft.publishedAt ?? null,
    };
    await saveBlogArticle(uid, article);

    // dual-publish: 公開記事は ②S.Library に可視化登録し、①ナレッジ(RAG)へ同期して
    // Chat/SEARCH の対象にする。いずれも失敗しても記事保存は成立させる（ベストエフォート）。
    const published = article.status === 'published';
    // ③ SEKKEIYA /articles「みんなの記事」ミラー（公開=upsert / 下書き=削除）
    try { await syncCommunityMirror(uid, article); } catch (e) { console.warn('[useDsbStore] community mirror failed', e); }
    // ④ SEKKEIYA Drive「記事」資産（公開=upsert / 下書き=削除。公開記事のみ資産化する方針）。
    try { await syncBlogArticleToDrive(uid, article); } catch (e) { console.warn('[useDsbStore] drive sync failed', e); }
    let knowledgeSynced = false;
    let knowledgeError: string | undefined;
    if (published) {
      // ② S.Library（ローカル可視化）。再公開時は libraryEntryId で同一エントリを更新。
      try {
        const libId = await syncBlogArticleToLibrary(article);
        if (libId && libId !== article.libraryEntryId) {
          article = { ...article, libraryEntryId: libId };
          await saveBlogArticle(uid, article); // 紐付けIDを記事に永続化
        }
      } catch (e) {
        console.warn('[useDsbStore] library sync failed', e);
      }
      // ① ナレッジ(RAG)。Chat/SEARCH 連携用。
      try {
        await syncBlogArticleToKnowledge(uid, article);
        knowledgeSynced = true;
      } catch (e: any) {
        knowledgeError = e?.message || 'knowledge sync failed';
        console.warn('[useDsbStore] knowledge sync failed', e);
      }
    }

    setBlogDirty(false);
    // keepEditing: 編集を維持し、保存後の記事（publishedAt/libraryEntryId 反映済み）を draft に残す。
    // 既定: 一覧へ戻る。
    if (opts?.keepEditing) set({ draft: { ...article } });
    else set({ mode: 'list', draft: null });
    await get().refresh(uid);
    return { published, knowledgeSynced, knowledgeError };
  },

  // 作業中の自動保存: 内容があればクラウド(正本)へ静かに保存し、ローカル一覧へ反映。
  // 公開連携(dual-publish)はせず status も変えない。編集状態は維持（保存後も編集継続できる）。
  saveWorkingDraft: async (uid) => {
    const draft = get().draft;
    if (!uid || !hasContent(draft)) return false;
    const now = new Date().toISOString();
    const article: BlogArticle = {
      ...draft!,
      slug: draft!.slug?.trim() || slugify(draft!.title),
      updatedAt: now,
    };
    try {
      await saveBlogArticle(uid, article);
      // ローカル一覧に upsert（サイドバー/一覧へ即反映）。draft も slug 等を同期。
      set((s) => {
        const exists = s.articles.some((a) => a.id === article.id);
        const articles = exists
          ? s.articles.map((a) => (a.id === article.id ? article : a))
          : [article, ...s.articles];
        return { articles, draft: s.draft && s.draft.id === article.id ? article : s.draft };
      });
      setBlogDirty(false);
      return true;
    } catch (e) {
      console.warn('[useDsbStore] saveWorkingDraft failed', e);
      return false;
    }
  },

  patchArticle: async (uid, id, patch) => {
    if (!uid) return;
    const cur = get().articles.find((a) => a.id === id);
    if (!cur) return;
    const now = new Date().toISOString();
    const nextStatus = (patch.status ?? cur.status) as BlogStatus;
    let article: BlogArticle = {
      ...cur, ...patch,
      slug: (patch.slug ?? cur.slug)?.trim() || slugify(patch.title ?? cur.title),
      updatedAt: now,
      publishedAt: nextStatus === 'published' ? (cur.publishedAt || now) : (cur.publishedAt ?? null),
    };
    // ローカル一覧へ即反映。
    set((s) => ({
      articles: s.articles.map((a) => (a.id === id ? article : a)),
      draft: s.draft && s.draft.id === id ? article : s.draft,
    }));
    try {
      await saveBlogArticle(uid, article);
      // ③ /articles「みんなの記事」ミラー（公開=upsert / 下書き=削除。ベストエフォート）
      try { await syncCommunityMirror(uid, article); } catch (e) { console.warn('[useDsbStore] patch community mirror failed', e); }
      // ④ SEKKEIYA Drive「記事」資産（公開=upsert / 下書き=削除。ベストエフォート）。
      try { await syncBlogArticleToDrive(uid, article); } catch (e) { console.warn('[useDsbStore] patch drive sync failed', e); }
      // 公開状態なら S.Library / RAG へ同期（saveDraft と同じ dual-publish。ベストエフォート）。
      if (nextStatus === 'published') {
        try {
          const libId = await syncBlogArticleToLibrary(article);
          if (libId && libId !== article.libraryEntryId) {
            article = { ...article, libraryEntryId: libId };
            set((s) => ({ articles: s.articles.map((a) => (a.id === id ? article : a)) }));
            await saveBlogArticle(uid, article);
          }
        } catch (e) { console.warn('[useDsbStore] patch library sync failed', e); }
        try { await syncBlogArticleToKnowledge(uid, article); }
        catch (e) { console.warn('[useDsbStore] patch knowledge sync failed', e); }
      }
    } catch (e) { console.warn('[useDsbStore] patchArticle failed', e); }
  },

  remove: async (uid, id) => {
    if (!uid) return;
    await deleteBlogArticle(uid, id);
    // Drive の「記事」資産も消す（ベストエフォート）。
    try { await removeBlogArticleFromDrive(id); } catch (e) { console.warn('[useDsbStore] drive remove failed', e); }
    await get().refresh(uid);
  },
}));
