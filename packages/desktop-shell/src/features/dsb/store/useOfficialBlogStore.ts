// 公式ブログ(officialArticles)の一覧・エディタ状態。
// アカウントブログの useDsbStore とは別ストア（データモデルも保存経路も別のため）。
// S.Blog のシェル/見た目は共通だが、公式モードのデータはこのストアが担う。
import { create } from 'zustand';
import type { OfficialArticle, OfficialDraft, OfficialAuthor, OfficialStatus } from '../officialTypes';
import { newOfficialDraft, articleToDraft } from '../officialTypes';
import {
  listOfficialArticles, getOfficialArticle, createOfficialArticle, updateOfficialArticle, deleteOfficialArticle,
} from '../api/officialBlogApi';

type OfficialMode = 'list' | 'edit';
// 公式モードのナビ（アカウントブログとサイドバー項目を揃える）。
// feed=ホーム / overview=概要・分析 / schedule=スケジュール(Schedules & Tasks) /
// strategy=コンテンツ戦略(Content Strategy) / articles=記事一覧 / categories=カテゴリ管理。
type OfficialView = 'feed' | 'overview' | 'schedule' | 'strategy' | 'articles' | 'categories';

interface OfficialBlogState {
  articles: OfficialArticle[];
  loading: boolean;
  loaded: boolean;
  mode: OfficialMode;
  view: OfficialView;
  draft: OfficialDraft | null;
  /** 記事一覧のカテゴリ絞り込み（サイドバーのカテゴリ行から。null=全件） */
  categoryFilter: string | null;

  setView: (v: OfficialView) => void;
  setCategoryFilter: (c: string | null) => void;
  refresh: () => Promise<void>;
  startNew: () => void;
  startEdit: (id: string) => Promise<void>;
  updateDraft: (patch: Partial<OfficialDraft>) => void;
  cancelEdit: () => void;
  /** 下書きを保存/公開。新規なら作成して edit を継続、既存なら更新。成功したら true。 */
  save: (author: OfficialAuthor) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export const useOfficialBlogStore = create<OfficialBlogState>((set, get) => ({
  articles: [],
  loading: false,
  loaded: false,
  mode: 'list',
  view: 'articles',
  draft: null,
  categoryFilter: null,

  // ビュー切替は編集を抜けてから（未保存の下書きは破棄される点は呼び出し側で配慮）。
  // ナビからのビュー切替は常にカテゴリ絞り込みを解除する（「記事一覧」= 全件）。
  // カテゴリでの絞り込みは setCategoryFilter が別途 view='articles' + filter を立てる。
  setView: (view) => set({ view, mode: 'list', draft: null, categoryFilter: null }),
  // カテゴリを選んだら記事一覧ビューへ（アカウント側 setCategoryFilter と同じ挙動）。
  setCategoryFilter: (categoryFilter) => set({ categoryFilter, view: 'articles', mode: 'list', draft: null }),

  refresh: async () => {
    set({ loading: true });
    try {
      const articles = await listOfficialArticles();
      set({ articles, loaded: true });
    } catch (e) {
      console.error('[useOfficialBlogStore] refresh failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  startNew: () => set({ mode: 'edit', draft: newOfficialDraft() }),

  startEdit: async (id) => {
    // 一覧に本文まで持っているのでまずローカルから開き、最新を取り直して差し替える。
    const local = get().articles.find((a) => a.id === id);
    if (local) set({ mode: 'edit', draft: articleToDraft(local) });
    try {
      const fresh = await getOfficialArticle(id);
      if (fresh) set({ mode: 'edit', draft: articleToDraft(fresh) });
    } catch (e) {
      console.warn('[useOfficialBlogStore] startEdit reload failed', e);
    }
  },

  updateDraft: (patch) => {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, ...patch } });
  },

  cancelEdit: () => set({ mode: 'list', draft: null }),

  save: async (author) => {
    const draft = get().draft;
    if (!draft || !draft.title.trim()) return false;
    try {
      if (draft.id) {
        await updateOfficialArticle(draft.id, draft);
      } else {
        const newId = await createOfficialArticle(draft, author);
        // 作成後も編集を継続できるよう id を確定させる。
        set({ draft: { ...draft, id: newId } });
      }
      await get().refresh();
      return true;
    } catch (e) {
      console.error('[useOfficialBlogStore] save failed', e);
      return false;
    }
  },

  remove: async (id) => {
    await deleteOfficialArticle(id);
    set((s) => ({ articles: s.articles.filter((a) => a.id !== id) }));
  },
}));

export type { OfficialMode, OfficialStatus };
