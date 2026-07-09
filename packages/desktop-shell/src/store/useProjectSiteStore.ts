// ProjectSite の編集状態を保持する zustand ストア（複数ページ対応）。
// 仕様: docs/09_project_site_spec.md
// 役割: サイトのロード / 編集・プレビュー / アクティブページ / section 操作 / ページ操作 / 保存。

import { create } from 'zustand';
import type {
  ProjectSite, SitePage, SiteSection, SiteSectionType, SiteAssetRef, SiteTemplateFamily, SiteThemePersonality, MotionMode,
  SiteLayoutMode,
} from '../features/projects/types';
import { SiteRepository, type SiteSource } from '../features/sites/siteRepository';
import { createSection, createSiteFromTemplate, createPage } from '../features/sites/siteTemplates';
import { stripProjectPages } from '../features/sites/accountSite';
import { resolveEditorialTheme } from '../features/sites/editorialThemes';
import { findPreset } from '../features/sites/templatePresets';
import { findMotionPreset, recommendedMotionForIntensity, recommendedMotionForLayout } from '../features/sites/motionPresets';
import { findLayoutPreset } from '../features/sites/layoutPresets';
import { sampleFill } from '../features/sites/sampleAssets';
import { findBundle } from '../features/sites/siteBundles';
import { useAuthStore } from './useAuthStore';

export type SiteMode = 'edit' | 'preview';

interface ProjectSiteState {
  source: SiteSource | null;      // project | account
  displayName: string;            // サイト名（プロジェクト名 or ユーザー名）
  site: ProjectSite | null;
  activePageId: string | null;
  loading: boolean;
  saving: boolean;
  saveError: string | null;
  dirty: boolean;
  mode: SiteMode;
  selectedSectionId: string | null;

  load: (source: SiteSource, displayName: string) => Promise<void>;
  reset: () => void;
  setMode: (mode: SiteMode) => void;
  selectSection: (sectionId: string | null) => void;

  createFromTemplate: (family: SiteTemplateFamily) => Promise<void>;
  applyAssembledSite: (site: ProjectSite) => Promise<void>;
  /** アカウントサイト: プロフィール編集をヒーロー/概要へ反映。 */
  applyProfileToSite: (p: { displayName?: string; role?: string; bio?: string }) => void;
  /** 公開状態を保存（公開/停止後）。 */
  applyPublishState: (publish: ProjectSite['publish']) => Promise<void>;

  // ページ操作
  selectPage: (pageId: string) => void;
  addPage: () => void;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, title: string) => void;
  reorderPages: (orderedIds: string[]) => void;

  // セクション操作（アクティブページに対して）
  addSection: (type: SiteSectionType) => void;
  /** afterSectionId の後ろに挿入。null の場合は先頭に追加。 */
  insertSection: (type: SiteSectionType, afterSectionId: string | null) => void;
  removeSection: (sectionId: string) => void;
  updateSection: (sectionId: string, patch: Partial<SiteSection>) => void;
  /** セクションの種類を変更（新しい種類の初期状態で作り直す。id・位置・hidden は維持）。 */
  changeSectionType: (sectionId: string, type: SiteSectionType) => void;
  reorderSections: (orderedIds: string[]) => void;
  setPersonality: (personality: SiteThemePersonality) => void;
  /** スクロールモーションのオーバーライド（null＝人格の既定に従う）。 */
  setMotionOverride: (mode: MotionMode | null) => void;
  /** プリセットを適用する（personality + accent + motion + theme overrides を一括設定）。 */
  applyPreset: (presetId: string) => void;
  /** サイト全体の構造レイアウトを設定（サイドバー/ヘッダーの有無・幅）。 */
  setLayoutMode: (mode: SiteLayoutMode) => void;
  /** レイアウトプリセット（ヘッダー様式・サイドバー位置・幅・整列）を適用。 */
  applyLayoutPreset: (presetId: string) => void;
  /** アニメーションライブラリ（none / gsap / threejs）を設定。 */
  applyMotionPreset: (presetId: string) => void;
  /** おすすめ構成（スタイル＋レイアウト＋モーション）を一括適用。 */
  applyBundle: (bundleId: string) => void;
  addAssetToSection: (sectionId: string, ref: SiteAssetRef) => void;
  removeAssetFromSection: (sectionId: string, refId: string) => void;
  fillSampleAssets: (sectionId: string) => void;
  addSectionWithAsset: (type: SiteSectionType, ref: SiteAssetRef) => string;
  /** ロゴ / バナー画像 URL を更新（保存は呼び出し元で save() する）。 */
  setSiteMeta: (patch: { logoUrl?: string | null; bannerUrl?: string | null }) => void;
  /** テキスト入力中に保存ボタンをアクティブにするための軽量な dirty フラグ設定。site は変更しない。 */
  markDirty: () => void;
  clearSaveError: () => void;

  save: () => Promise<void>;
}

/** アクティブページの sections を写像する共通ヘルパー。 */
function mapActiveSections(
  site: ProjectSite, activePageId: string | null, fn: (sections: SiteSection[]) => SiteSection[],
): ProjectSite {
  return { ...site, pages: site.pages.map(p => p.id === activePageId ? { ...p, sections: fn(p.sections) } : p) };
}

function activePage(site: ProjectSite | null, activePageId: string | null): SitePage | undefined {
  return site?.pages.find(p => p.id === activePageId);
}

export const useProjectSiteStore = create<ProjectSiteState>((set, get) => ({
  source: null,
  displayName: '',
  site: null,
  activePageId: null,
  loading: false,
  saving: false,
  saveError: null,
  dirty: false,
  mode: 'edit',
  selectedSectionId: null,

  load: async (source, displayName) => {
    const cur = get().source;
    if (cur && cur.kind === source.kind && cur.id === source.id && get().site) return;
    // ソース切替前に未保存の変更をフラッシュ（dirty のまま site: null に上書きされると消える）
    if (get().dirty) await get().save();
    set({ loading: true, source, displayName, site: null, activePageId: null, dirty: false, selectedSectionId: null });
    try {
      let site = await SiteRepository.get(source);
      const now = get().source;
      if (!now || now.kind !== source.kind || now.id !== source.id) return; // 別ソースへ切替済み
      // 旧構成（アカウントサイトの proj-* ページ）を除去：My/Team は home の works セクションへ移行済み
      let mutated = false;
      if (site && source.kind === 'account') {
        const next = stripProjectPages(site);
        if (next) { site = { ...site, pages: next }; mutated = true; }
        // ブログの公開記事があれば「ブログ」セクションを既定で用意する。
        // → どのスタイル/レイアウトでも、セクション由来のナビに「ブログ」が自動で出る。
        const hasBlogSection = site.pages.some(p => p.sections.some(s => s.type === 'blog'));
        if (!hasBlogSection) {
          try {
            const { listBlogArticles } = await import('../features/dsb/api/blogApi');
            const arts = await listBlogArticles(source.id); // account: source.id === uid
            // 別ソースへ切替されていないか（await 中の変化）を確認
            const mid = get().source;
            if (mid && mid.kind === source.kind && mid.id === source.id && arts.some(a => a.status === 'published')) {
              const blog: SiteSection = { ...createSection('blog'), title: 'ブログ', variant: 'blog-bar', body: '記事をカテゴリごとにご覧いただけます。' };
              // 末尾(Contact 等)の手前に挿入＝ヘッダーの先頭ナビ項目内に収まり、確実にナビ表示される。
              site = { ...site, pages: site.pages.map((p, i) => {
                if (i !== 0) return p;
                const secs = [...p.sections];
                secs.splice(Math.max(0, secs.length - 1), 0, blog);
                return { ...p, sections: secs };
              }) };
              mutated = true;
            }
          } catch { /* ブログ未取得でもサイト表示は継続 */ }
        }
      }
      const after = get().source;
      if (!after || after.kind !== source.kind || after.id !== source.id) return; // 切替済み
      set({ site, activePageId: site?.pages[0]?.id ?? null, loading: false, mode: 'edit', dirty: mutated });
      if (mutated) get().save();
    } catch (e) {
      console.error('[Site] load failed', e);
      const now = get().source;
      if (now && now.kind === source.kind && now.id === source.id) set({ loading: false });
    }
  },

  reset: () => set({
    source: null, displayName: '', site: null, activePageId: null, loading: false,
    saving: false, dirty: false, mode: 'edit', selectedSectionId: null,
  }),

  setMode: (mode) => set({ mode, selectedSectionId: mode === 'preview' ? null : get().selectedSectionId }),
  selectSection: (sectionId) => set({ selectedSectionId: sectionId }),

  createFromTemplate: async (family) => {
    const { source, displayName } = get();
    if (!source) return;
    const site = createSiteFromTemplate(source.id, family, displayName || 'Untitled');
    set({ site, activePageId: site.pages[0]?.id ?? null, dirty: true, mode: 'edit' });
    await get().save();
  },

  applyAssembledSite: async (site) => {
    set({ site, activePageId: site.pages[0]?.id ?? null, dirty: true, mode: 'edit', selectedSectionId: null });
    await get().save();
  },

  applyProfileToSite: ({ displayName, role, bio }) => {
    const { source, site } = get();
    if (!source || source.kind !== 'account' || !site) return;
    let heroDone = false, overviewDone = false;
    const pages = site.pages.map(pg => ({
      ...pg,
      sections: pg.sections.map(s => {
        if (s.type === 'hero' && !heroDone) {
          heroDone = true;
          return { ...s, title: displayName ?? s.title, body: role ?? s.body };
        }
        if (s.type === 'overview' && !overviewDone && bio) {
          overviewDone = true;
          return { ...s, body: bio };
        }
        return s;
      }),
    }));
    set({ site: { ...site, pages }, displayName: displayName ?? get().displayName, dirty: true });
  },

  applyPublishState: async (publish) => {
    const { site } = get();
    if (!site) return;
    set({ site: { ...site, publish }, dirty: true });
    await get().save();
  },

  /* ---------------- ページ操作 ---------------- */

  selectPage: (pageId) => set({ activePageId: pageId, selectedSectionId: null }),

  addPage: () => {
    const { site } = get();
    if (!site) return;
    const page = createPage('新しいページ', []);
    set({ site: { ...site, pages: [...site.pages, page] }, activePageId: page.id, selectedSectionId: null, dirty: true });
  },

  removePage: (pageId) => {
    const { site, activePageId } = get();
    if (!site || site.pages.length <= 1) return;
    const pages = site.pages.filter(p => p.id !== pageId);
    const nextActive = activePageId === pageId ? (pages[0]?.id ?? null) : activePageId;
    set({ site: { ...site, pages }, activePageId: nextActive, selectedSectionId: null, dirty: true });
  },

  renamePage: (pageId, title) => {
    const { site } = get();
    if (!site) return;
    set({ site: { ...site, pages: site.pages.map(p => p.id === pageId ? { ...p, title } : p) }, dirty: true });
  },

  reorderPages: (orderedIds) => {
    const { site } = get();
    if (!site) return;
    const byId = new Map(site.pages.map(p => [p.id, p]));
    const next = orderedIds.map(id => byId.get(id)).filter(Boolean) as SitePage[];
    site.pages.forEach(p => { if (!orderedIds.includes(p.id)) next.push(p); });
    set({ site: { ...site, pages: next }, dirty: true });
  },

  /* ---------------- セクション操作（アクティブページ） ---------------- */

  addSection: (type) => {
    const { site, activePageId } = get();
    if (!site) return;
    const section = createSection(type);
    set({ site: mapActiveSections(site, activePageId, secs => [...secs, section]), dirty: true, selectedSectionId: section.id });
  },

  insertSection: (type, afterSectionId) => {
    const { site, activePageId } = get();
    if (!site) return;
    const section = createSection(type);
    set({
      site: mapActiveSections(site, activePageId, secs => {
        if (afterSectionId === null) return [section, ...secs];
        const idx = secs.findIndex(s => s.id === afterSectionId);
        if (idx < 0) return [...secs, section];
        return [...secs.slice(0, idx + 1), section, ...secs.slice(idx + 1)];
      }),
      dirty: true,
      selectedSectionId: section.id,
    });
  },

  removeSection: (sectionId) => {
    const { site, activePageId, selectedSectionId } = get();
    if (!site) return;
    set({
      site: mapActiveSections(site, activePageId, secs => secs.filter(s => s.id !== sectionId)),
      dirty: true,
      selectedSectionId: selectedSectionId === sectionId ? null : selectedSectionId,
    });
  },

  updateSection: (sectionId, patch) => {
    const { site, activePageId } = get();
    if (!site) return;
    set({ site: mapActiveSections(site, activePageId, secs => secs.map(s => s.id === sectionId ? { ...s, ...patch } : s)), dirty: true });
  },

  changeSectionType: (sectionId, type) => {
    const { site, activePageId } = get();
    if (!site) return;
    // 種類変更＝そのセクションを新しい種類の初期状態で作り直す（id・位置は維持）。
    // 旧タイトル/旧データ（chartData 等）が残らないよう全面置換する。
    set({
      site: mapActiveSections(site, activePageId, secs => secs.map(s => {
        if (s.id !== sectionId) return s;
        const fresh = createSection(type);
        return { ...fresh, id: s.id, hidden: s.hidden };
      })),
      dirty: true,
    });
  },

  reorderSections: (orderedIds) => {
    const { site, activePageId } = get();
    if (!site) return;
    set({
      site: mapActiveSections(site, activePageId, secs => {
        const byId = new Map(secs.map(s => [s.id, s]));
        const next = orderedIds.map(id => byId.get(id)).filter(Boolean) as SiteSection[];
        secs.forEach(s => { if (!orderedIds.includes(s.id)) next.push(s); });
        return next;
      }),
      dirty: true,
    });
  },

  setPersonality: (personality) => {
    const { site } = get();
    if (!site) return;
    const resolved = resolveEditorialTheme(personality);
    const theme = { ...site.theme, personality, accent: resolved.accent };
    delete theme.presetId;
    delete theme.overrides;
    // スタイルの既定モーションを推奨モーションプリセットとして自動適用（あとから変更可）
    const motionPreset = findMotionPreset(recommendedMotionForIntensity(resolved.motion));
    if (motionPreset) {
      theme.motionOverride = motionPreset.intensity;
      theme.motionPresetId = motionPreset.id;
      theme.motionLibs = motionPreset.libs;
    }
    set({ site: { ...site, theme }, dirty: true });
  },

  setMotionOverride: (mode) => {
    const { site } = get();
    if (!site) return;
    const theme = { ...site.theme };
    if (mode === null) delete theme.motionOverride;
    else theme.motionOverride = mode;
    set({ site: { ...site, theme }, dirty: true });
  },

  setLayoutMode: (mode) => {
    const { site } = get();
    if (!site) return;
    const theme = { ...site.theme, layoutMode: mode };
    // モーション未設定のときのみ、レイアウトの推奨モーションを既定として補完（ユーザー選択は尊重）
    if (!theme.motionPresetId) {
      const motionPreset = findMotionPreset(recommendedMotionForLayout(mode));
      if (motionPreset) {
        theme.motionOverride = motionPreset.intensity;
        theme.motionPresetId = motionPreset.id;
        theme.motionLibs = motionPreset.libs;
      }
    }
    set({ site: { ...site, theme }, dirty: true });
  },

  applyLayoutPreset: (presetId) => {
    const { site } = get();
    if (!site) return;
    const p = findLayoutPreset(presetId);
    if (!p) return;
    const theme = { ...site.theme, layoutMode: p.mode, layoutPresetId: p.id };
    // モーション未設定ならレイアウト推奨モーションを補完
    if (!theme.motionPresetId) {
      const mp = findMotionPreset(recommendedMotionForLayout(p.mode));
      if (mp) { theme.motionOverride = mp.intensity; theme.motionPresetId = mp.id; theme.motionLibs = mp.libs; }
    }
    set({ site: { ...site, theme }, dirty: true });
  },

  applyMotionPreset: (presetId) => {
    const { site } = get();
    if (!site) return;
    const preset = findMotionPreset(presetId);
    if (!preset) return;
    set({
      site: {
        ...site,
        theme: {
          ...site.theme,
          motionOverride: preset.intensity,
          motionPresetId: preset.id,
          motionLibs: preset.libs,
        },
      },
      dirty: true,
    });
  },

  applyBundle: (bundleId) => {
    const { site } = get();
    if (!site) return;
    const b = findBundle(bundleId);
    if (!b) return;
    const resolved = resolveEditorialTheme(b.personality);
    const motion = findMotionPreset(b.motionPresetId);
    const theme = {
      ...site.theme,
      personality: b.personality,
      accent: resolved.accent,
      layoutMode: b.layoutMode,
    } as typeof site.theme;
    delete theme.presetId;
    delete theme.overrides;
    if (motion) { theme.motionOverride = motion.intensity; theme.motionPresetId = motion.id; theme.motionLibs = motion.libs; }
    set({ site: { ...site, theme }, dirty: true });
  },

  applyPreset: (presetId) => {
    const { site } = get();
    if (!site) return;
    const preset = findPreset(presetId);
    if (!preset) return;
    const theme = {
      ...site.theme,
      personality: preset.personality,
      accent: preset.accent,
      motionOverride: preset.motion,
      presetId: preset.id,
      overrides: preset.overrides ?? undefined,
    };
    // スタイルプリセットの既定強度に対応する推奨モーションを自動適用（あとから変更可）
    const motionPreset = findMotionPreset(recommendedMotionForIntensity(preset.motion));
    if (motionPreset) {
      theme.motionOverride = motionPreset.intensity;
      theme.motionPresetId = motionPreset.id;
      theme.motionLibs = motionPreset.libs;
    }
    set({ site: { ...site, theme }, dirty: true });
  },

  addAssetToSection: (sectionId, ref) => {
    const { site, activePageId } = get();
    if (!site) return;
    set({
      site: mapActiveSections(site, activePageId, secs => secs.map(s => {
        if (s.id !== sectionId) return s;
        if (s.assetRefs.some(a => a.id === ref.id)) return s;
        return { ...s, assetRefs: [...s.assetRefs, ref] };
      })),
      dirty: true,
    });
  },

  removeAssetFromSection: (sectionId, refId) => {
    const { site, activePageId } = get();
    if (!site) return;
    set({
      site: mapActiveSections(site, activePageId, secs => secs.map(s =>
        s.id === sectionId ? { ...s, assetRefs: s.assetRefs.filter(a => a.id !== refId) } : s)),
      dirty: true,
    });
  },

  fillSampleAssets: (sectionId) => {
    const { site, activePageId } = get();
    if (!site) return;
    set({
      site: mapActiveSections(site, activePageId, secs => secs.map(s =>
        s.id === sectionId ? { ...s, assetRefs: sampleFill(s.type, 3, s.id) } : s)),
      dirty: true,
    });
  },

  addSectionWithAsset: (type, ref) => {
    const { site, activePageId } = get();
    if (!site) return '';
    const section = { ...createSection(type), assetRefs: [ref] };
    set({ site: mapActiveSections(site, activePageId, secs => [...secs, section]), dirty: true, selectedSectionId: section.id });
    return section.id;
  },

  setSiteMeta: (patch) => {
    const { site } = get();
    if (!site) return;
    const next: typeof site = { ...site };
    if ('logoUrl' in patch) { if (patch.logoUrl == null) delete next.logoUrl; else next.logoUrl = patch.logoUrl; }
    if ('bannerUrl' in patch) { if (patch.bannerUrl == null) delete next.bannerUrl; else next.bannerUrl = patch.bannerUrl; }
    set({ site: next, dirty: true });
  },

  markDirty: () => { if (!get().dirty) set({ dirty: true }); },
  clearSaveError: () => set({ saveError: null }),

  save: async () => {
    const { site, dirty, source } = get();
    if (!site || !dirty || !source) return;
    set({ saving: true, saveError: null });
    try {
      const uid = useAuthStore.getState().currentUser?.uid;
      await SiteRepository.save(source, { ...site, updatedBy: uid });
      set({ saving: false, dirty: false });
    } catch (e) {
      console.error('[Site] save failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      set({ saving: false, saveError: msg });
    }
  },
}));

// 外部から現在のアクティブページを取得するためのセレクタ補助
export const selectActivePage = (s: ProjectSiteState): SitePage | undefined =>
  activePage(s.site, s.activePageId);
