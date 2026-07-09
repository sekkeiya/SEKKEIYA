import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, ToggleButton, ToggleButtonGroup,
  CircularProgress, Tooltip, Chip, Fade, IconButton, useMediaQuery,
  Menu, MenuItem, Snackbar, Alert,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import LayoutTemplateIcon from '@mui/icons-material/DashboardCustomizeRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { SitePresentationController } from './SitePresentationController';

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';

import type { DesktopProject, SiteAssetRef, SiteSectionType } from '../projects/types';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { useScrollSpyStore } from '../../store/useScrollSpyStore';
import { SiteSectionView } from './SiteSectionView';
import { SiteAssetPickerDock } from './SiteAssetPickerDock';
import { TEMPLATE_FAMILIES, SECTION_META, ADDABLE_SECTION_TYPES } from './siteTemplates';
import { SiteOnboardingChat } from './SiteOnboardingChat';
import { SiteNavSidebar } from './SiteNavSidebar';
import { resolveEditorialTheme } from './editorialThemes';
import { resolveMotionConfig } from './designTokens';
import { useSiteMotion } from './useSiteMotion';
import { useMotionPresetEffects } from './useMotionPresetEffects';
import { MotionWebGLBackground, type WebGLVariant } from './MotionWebGLBackground';
import { findMotionPreset } from './motionPresets';
import { findLayoutPreset, resolveLayout, type LayoutHeader, type LayoutSidebar, type LayoutAlign } from './layoutPresets';
import type { SiteSource } from './siteRepository';
import { buildAccountSite, type AccountProjectLite } from './accountSite';
import { buildTeamSite } from './teamSite';

import { PublishDialog } from './PublishDialog';
import { SiteSettingsDialog } from './SiteSettingsDialog';
import { WorksGrid } from './WorksGrid';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDsbStore } from '../dsb/store/useDsbStore';
import { BlogIndex } from './BlogIndex';
import { MEASURE, PAGE_PX, SECTION_PY } from './designTokens';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAccountProfileStore } from '../../store/useAccountProfileStore';
import { renameProject } from '../projects/api/updateProject';


interface Props {
  /** サイトソース（project | account）。 */
  source: SiteSource;
  /** サイト名（プロジェクト名 or ユーザー名）。 */
  displayName: string;
  /** project 種別のとき: オンボーディング/素材ドックに使用。 */
  project?: DesktopProject;
  /** account 種別のとき: サイドバーの My / Team プロジェクトナビ。 */
  accountProjects?: { my: AccountProjectLite[]; team: AccountProjectLite[] };
  /** account 種別のとき: My/Team の ＋ でプロジェクト作成。 */
  onCreateProject?: (scope: 'my' | 'team') => void;
  /** ツールバー左端に差し込む要素（ProjectHome のページタブを 1 行に統合するため）。 */
  tabsSlot?: React.ReactNode;
}

/** セクション間のインライン挿入ゾーン。ホバー時に「＋ セクションを追加」ボタンを表示。 */
const SectionInsertZone: React.FC<{
  afterSectionId: string | null;
  onInsert: (type: SiteSectionType, afterId: string | null) => void;
  accentColor: string;
}> = ({ afterSectionId, onInsert, accentColor }) => {
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchor(e.currentTarget);
  };
  const handleClose = () => {
    setAnchor(null);
    setHovered(false);
  };
  const handleSelect = (type: SiteSectionType) => {
    onInsert(type, afterSectionId);
    handleClose();
  };

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!anchor) setHovered(false); }}
      sx={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
    >
      <Fade in={hovered || !!anchor}>
        <Box sx={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, height: '1px', width: 60, bgcolor: `${accentColor}55` }} />
          <Button
            size="small"
            onClick={handleOpen}
            sx={{
              minWidth: 0, px: 1.5, py: 0.25, fontSize: '0.72rem', fontWeight: 800,
              color: accentColor, border: `1px dashed ${accentColor}88`,
              borderRadius: 1, textTransform: 'none', bgcolor: 'rgba(10,15,25,0.85)',
              backdropFilter: 'blur(6px)',
              '&:hover': { bgcolor: `${accentColor}18` },
            }}
          >
            ＋ セクションを追加
          </Button>
          <Box sx={{ flex: 1, height: '1px', width: 60, bgcolor: `${accentColor}55` }} />
        </Box>
      </Fade>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={handleClose}
        PaperProps={{ sx: { bgcolor: 'rgba(15,20,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', maxHeight: 420 } }}
      >
        {ADDABLE_SECTION_TYPES.map(type => (
          <MenuItem
            key={type}
            onClick={() => handleSelect(type)}
            sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', gap: 1.5, '&:hover': { bgcolor: 'rgba(0,191,255,0.12)' } }}
          >
            <Typography component="span" sx={{ fontWeight: 700, minWidth: 110 }}>{SECTION_META[type].label}</Typography>
            <Typography component="span" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{SECTION_META[type].description}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

const SortableSection: React.FC<{
  sectionId: string;
  children: (dragHandleProps: Record<string, any>) => React.ReactNode;
}> = ({ sectionId, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    zIndex: isDragging ? 20 : 'auto',
  };
  return <div ref={setNodeRef} style={style}>{children({ ...attributes, ...listeners })}</div>;
};

/**
 * レイアウトモードごとの構造設定。
 *   sidebar : 左 ToC サイドバーを表示するか
 *   header  : 上部ナビ（'bar'=固定ヘッダー / 'float'=フローティング / 'none'=なし）
 *   maxWidth: コンテンツの最大幅（数値=センタリング, null=フル幅）
 */
type LayoutConfig = { sidebar: boolean; header: 'none' | 'bar' | 'float'; maxWidth: number | null };
const LAYOUT_CONFIG: Record<import('../projects/types').SiteLayoutMode, LayoutConfig> = {
  editorial: { sidebar: true,  header: 'none',  maxWidth: null },
  split:     { sidebar: true,  header: 'none',  maxWidth: null },
  minimal:   { sidebar: false, header: 'none',  maxWidth: 880 },
  magazine:  { sidebar: false, header: 'bar',   maxWidth: null },
  studio:    { sidebar: false, header: 'bar',   maxWidth: null },
  grid:      { sidebar: false, header: 'bar',   maxWidth: null },
  portfolio: { sidebar: false, header: 'float', maxWidth: null },
  immersive: { sidebar: false, header: 'none',  maxWidth: null },
};

/** 上部固定ヘッダー（magazine / studio / grid / portfolio）。サイト名＋ページ＋セクション目次を水平ナビで表示。 */
const SiteTopHeader: React.FC<{
  title: string;
  theme: ReturnType<typeof resolveEditorialTheme>;
  pages: { id: string; title: string }[];
  activePageId: string | null;
  sections: { id: string; title?: string; type: string }[];
  logoUrl?: string;
  onSelectPage: (id: string) => void;
  onTocClick: (sectionId: string) => void;
  variant: Exclude<LayoutHeader, 'none'>;
  /** true のとき本文セクション目次をヘッダーに表示しない（サイドバーが担う場合）。 */
  hideSections?: boolean;
}> = ({ title, theme, pages, activePageId, sections, logoUrl, onSelectPage, onTocClick, variant, hideSections }) => {
  const navSections = hideSections ? [] : sections.filter(s => s.type !== 'hero').slice(0, 8);
  const floating = variant === 'float';
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--site-header-h', el.getBoundingClientRect().height + 'px');
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--site-header-h'); };
  }, []);

  return (
    <Box ref={headerRef} sx={{
      position: floating ? 'absolute' : 'sticky',
      top: 0, left: 0, right: 0, zIndex: 20,
      height: 52, display: 'flex', alignItems: 'center',
      px: { xs: 3, md: 5 },
      bgcolor: floating ? 'transparent' : `${theme.bg}ec`,
      backdropFilter: floating ? 'none' : 'saturate(200%) blur(20px)',
      borderBottom: floating ? 'none' : `0.5px solid ${theme.border}`,
    }}>
      {/* Wordmark */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, mr: 'auto' }}>
        {logoUrl ? (
          <Box component="img" src={logoUrl} alt="" sx={{ width: 20, height: 20, objectFit: 'cover' }} />
        ) : (
          <Box sx={{ width: 7, height: 7, border: `1.5px solid ${theme.accent}`, transform: 'rotate(45deg)', flexShrink: 0 }} />
        )}
        <Typography sx={{
          fontFamily: theme.headingFamily, fontWeight: theme.headingWeight,
          letterSpacing: '0.09em', textTransform: 'uppercase',
          color: theme.text, fontSize: '0.76rem',
        }}>
          {title}
        </Typography>
      </Box>

      {/* Nav items — thin underline expands from center on hover */}
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {pages.length > 1 && pages.map(p => (
          <Box key={p.id} onClick={() => onSelectPage(p.id)} sx={{
            px: 1.75, height: '100%', display: 'flex', alignItems: 'center',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            '&::after': {
              content: '""', position: 'absolute', bottom: 0, left: '50%', right: '50%',
              height: '1.5px', bgcolor: theme.accent, transition: 'left 0.2s, right 0.2s',
            },
            '&:hover::after': { left: '1rem', right: '1rem' },
            '&:hover .hdr-label': { color: theme.text },
          }}>
            <Typography className="hdr-label" sx={{
              fontFamily: theme.kickerFamily, fontSize: '0.68rem', fontWeight: 600,
              letterSpacing: '0.05em', color: p.id === activePageId ? theme.text : theme.subtext,
              transition: 'color 0.2s', whiteSpace: 'nowrap',
            }}>{p.title}</Typography>
          </Box>
        ))}
        {navSections.map(s => {
          const label = s.title?.trim() || SECTION_META[s.type as keyof typeof SECTION_META]?.label || s.type;
          return (
            <Box key={s.id} onClick={() => onTocClick(s.id)} sx={{
              px: 1.75, height: '100%', display: 'flex', alignItems: 'center',
              cursor: 'pointer', position: 'relative', flexShrink: 0,
              '&::after': {
                content: '""', position: 'absolute', bottom: 0, left: '50%', right: '50%',
                height: '1.5px', bgcolor: theme.accent, transition: 'left 0.2s, right 0.2s',
              },
              '&:hover::after': { left: '1rem', right: '1rem' },
              '&:hover .hdr-label': { color: theme.text },
            }}>
              <Typography className="hdr-label" sx={{
                fontFamily: theme.kickerFamily, fontSize: '0.68rem', fontWeight: 600,
                letterSpacing: '0.05em', color: theme.subtext,
                transition: 'color 0.2s', whiteSpace: 'nowrap',
              }}>{label}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/** 両サイドバーレイアウト時の右サイドバー。現在ページのセクション目次のみを表示。 */
const SiteRightToc: React.FC<{
  sections: import('../projects/types').SiteSection[];
  theme: ReturnType<typeof resolveEditorialTheme>;
  selectedSectionId: string | null;
  onTocClick: (id: string) => void;
}> = ({ sections, theme, selectedSectionId, onTocClick }) => {
  const activeSectionId = useScrollSpyStore((s: any) => s.activeSectionId);
  if (sections.length === 0) return null;
  return (
    <Box sx={{
      width: 176, flexShrink: 0, height: '100%', overflowY: 'auto',
      bgcolor: theme.surface, borderLeft: `0.5px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column', pt: 4, pb: 3,
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {/* Header "このページ" with thin extending line */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, mb: 2.5 }}>
        <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.subtext, flexShrink: 0 }}>
          このページ
        </Typography>
        <Box sx={{ flex: 1, height: '0.5px', bgcolor: theme.border }} />
      </Box>
      {/* Numbered section items */}
      {sections.map((s, i) => {
        const label = s.type === 'hero' ? 'トップ' : (s.title?.trim() || SECTION_META[s.type as keyof typeof SECTION_META]?.label || s.type);
        const current = activeSectionId === s.id;
        const highlight = current || selectedSectionId === s.id;
        const num = String(i + 1).padStart(2, '0');
        return (
          <Box key={s.id} onClick={() => onTocClick(s.id)} sx={{
            display: 'flex', alignItems: 'baseline', gap: 1, px: 2, py: 0.6, cursor: 'pointer',
            borderLeft: `2px solid ${current ? theme.accent : 'transparent'}`,
            transition: 'border-color 0.2s',
            '&:hover': { '& .toc-label': { color: theme.text } },
          }}>
            <Typography sx={{
              fontFamily: theme.kickerFamily, fontSize: '0.55rem', fontWeight: 700,
              color: highlight ? theme.accent : `${theme.subtext}66`, letterSpacing: '0.04em',
              flexShrink: 0, transition: 'color 0.2s',
            }}>{num}</Typography>
            <Typography className="toc-label" noWrap sx={{
              fontFamily: theme.bodyFamily, fontSize: '0.72rem',
              color: highlight ? theme.accent : theme.subtext,
              fontWeight: highlight ? 700 : 400, transition: 'color 0.2s',
            }}>{label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/** アカウントサイト上部に固定表示するブログカテゴリナビバー。
 *  カテゴリをクリックするとブログ一覧ページへ遷移する。
 *  inBlogView=true のときは戻るボタンを左端に表示し、カテゴリ切り替えのみ行う。 */
const SiteBlogCategoryBar: React.FC<{
  theme: ReturnType<typeof resolveEditorialTheme>;
  inBlogView: boolean;
  onPick: (cat: string | null) => void;
  onBack: () => void;
}> = ({ theme, inBlogView, onPick, onBack }) => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const categories = useDsbStore((s) => s.categories);
  const articles = useDsbStore((s) => s.articles);
  const articlesLoaded = useDsbStore((s) => s.articlesLoaded);
  const siteActiveBlogCat = useDsbStore((s) => s.siteActiveBlogCat);
  const refresh = useDsbStore((s) => s.refresh);
  const loadCategories = useDsbStore((s) => s.loadCategories);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (uid && !articlesLoaded) { refresh(uid); loadCategories(uid); }
  }, [uid, articlesLoaded, refresh, loadCategories]);

  // バーの高さを CSS 変数に書き出す（handleTocClick のスクロールオフセット計算に使用）。
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--site-cat-bar-h', el.getBoundingClientRect().height + 'px');
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--site-cat-bar-h'); };
  }, []);

  const { cats, total } = useMemo(() => {
    const pub = articles.filter((a) => a.status === 'published');
    const counts = new Map<string, number>();
    for (const a of pub) { const c = (a.category || '').trim(); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
    const all = [...categories, ...[...counts.keys()].filter((c) => !categories.includes(c))];
    return { cats: all.map((name) => ({ name, count: counts.get(name) ?? 0 })), total: pub.length };
  }, [categories, articles]);

  if (!articlesLoaded || total === 0) return null;

  const entries = [{ key: null, label: 'すべて', count: total }, ...cats.map((c) => ({ key: c.name, label: c.name, count: c.count }))];

  return (
    <Box ref={barRef} sx={{
      position: 'sticky', top: 'var(--site-header-h, 0px)', zIndex: 15,
      display: 'flex', alignItems: 'center', height: 40,
      px: { xs: 2, md: 4 }, borderBottom: `0.5px solid ${theme.border}`,
      bgcolor: `${theme.bg}f2`, backdropFilter: 'saturate(160%) blur(10px)',
      overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {/* ブログ一覧ページ内では戻るボタンを表示 */}
      {inBlogView && (
        <Box onClick={onBack} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 2, cursor: 'pointer', flexShrink: 0, color: theme.subtext, '&:hover': { color: theme.text } }}>
          <ArrowBackRoundedIcon sx={{ fontSize: '0.9rem' }} />
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em' }}>戻る</Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, flex: 1, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {entries.map((e) => {
          const on = siteActiveBlogCat === e.key;
          return (
            <Box key={e.label} onClick={() => onPick(e.key)} sx={{
              flexShrink: 0, height: 40, display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: 'pointer', position: 'relative',
              borderBottom: `1.5px solid ${on ? theme.accent : 'transparent'}`,
              mb: '-0.5px',
              transition: 'border-color 0.2s',
              '&:hover .cat-label': { color: theme.text },
            }}>
              <Typography className="cat-label" sx={{
                fontFamily: theme.kickerFamily, fontWeight: on ? 700 : 500,
                fontSize: '0.72rem', color: on ? theme.text : theme.subtext,
                letterSpacing: '0.03em', transition: 'color 0.2s',
              }}>{e.label}</Typography>
              <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.56rem', color: theme.subtext, opacity: 0.6 }}>{e.count}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export const ProjectSiteCanvas: React.FC<Props> = ({ source, displayName, project, accountProjects, onCreateProject, tabsSlot }) => {
  const {
    site, activePageId, loading, saving, saveError, dirty, mode, selectedSectionId,
    load, setMode, selectSection, createFromTemplate, applyAssembledSite, clearSaveError,
    selectPage, addPage, removePage, renamePage,
    addSection, insertSection, removeSection, updateSection, changeSectionType, reorderSections,
    addAssetToSection, addSectionWithAsset, removeAssetFromSection, setPersonality, setMotionOverride, fillSampleAssets, save,
    setLayoutMode, applyLayoutPreset, applyMotionPreset, applyBundle,
  } = useProjectSiteStore();
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const projects = useAppStore(s => s.projects);
  const setProjects = useAppStore(s => s.setProjects);
  const currentUser = useAuthStore(s => s.currentUser);
  const isAccount = source.kind === 'account';
  // モバイル（iOS等）：左サイドバーは常時表示せず、ドロワーとして開閉する。
  const isMobile = useMediaQuery('(max-width:768px)');
  const [navOpen, setNavOpen] = useState(false);
  const closeNavOnMobile = () => { if (isMobile) setNavOpen(false); };
  const isTeam = source.kind === 'team';
  // アカウント/チームサイトはどちらも「SiteOwner サイト」＝自動生成・ダッシュボード寄りの扱い。
  const isAccountLike = isAccount || isTeam;
  // プロジェクトサイトのとき、サイドバー上部に表示するアカウントサイト名（クリックでダッシュボードへ）
  const accountName = (currentUser?.displayName || 'マイサイト').toUpperCase();
  const [projectsListScope, setProjectsListScope] = useState<'my' | 'team' | null>(null);
  // ブログカテゴリ一覧ページ表示モード（true のとき通常セクションの代わりに BlogIndex を全画面表示）。
  const [inBlogView, setInBlogView] = useState(false);
  const setSiteActiveBlogCat = useDsbStore((s) => s.setSiteActiveBlogCat);
  const openProjectInApp = (id: string) => { setActiveProjectId(id, 'home'); setCurrentMainView('workspace'); };

  // 右サイドバー（素材/テンプレ/メモ ドック）。編集は主に SEKKEIYA Chat で行うため既定で閉じる。
  const [dockOpen, setDockOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // プレゼンモード（AIナレーション読み上げ＋自動スクロール）
  const [presentOpen, setPresentOpen] = useState(false);
  // 編集モードへの切替・ページ切替・サイト切替でプレゼンは終了する
  useEffect(() => { if (mode !== 'preview') setPresentOpen(false); }, [mode]);
  useEffect(() => { setPresentOpen(false); }, [activePageId, source.kind, source.id]);

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);  // プレビュー時の Lenis content（単一ラッパ）

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // サイトソース切替時にロード
  useEffect(() => {
    load(source, displayName);
  }, [source.kind, source.id, displayName, load]);

  // アカウントサイトは初回に自動生成（Firestoreドキュメントが存在しない場合のみ）
  // ※ クロージャの loading/site は load() が set() を呼んでもレンダリングが起きるまで
  //   更新されない（stale closure 問題）。ここでは Zustand ストアを直接参照して
  //   load() の set({ loading: true }) 後の最新値を確認することで誤発火を防ぐ。
  const autoCreatedRef = useRef(false);
  useEffect(() => { autoCreatedRef.current = false; }, [source.kind, source.id]);
  useEffect(() => {
    const s = useProjectSiteStore.getState();
    if (isAccountLike && !s.loading && !s.site && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      applyAssembledSite(
        isTeam
          ? buildTeamSite({ teamId: source.id, name: displayName })
          : buildAccountSite({ userId: source.id, displayName }),
      );
    }
  }, [isAccountLike, isTeam, loading, site, source.id, displayName, applyAssembledSite]);

  // iOS（モバイル）はまず「見る」のが目的なので、サイトを開いたら既定でプレビュー表示にする。
  // （store は load 時に mode:'edit' にするため、ロード完了後にソースごと一度だけ preview へ切替。
  //   トグルで手動編集は引き続き可能。別のサイトを開くと再びプレビュー既定に戻る。）
  const previewForcedRef = useRef<string | null>(null);
  useEffect(() => { previewForcedRef.current = null; }, [source.kind, source.id]);
  useEffect(() => {
    if (isMobile && !loading && site && previewForcedRef.current !== source.id) {
      previewForcedRef.current = source.id;
      setMode('preview');
    }
  }, [isMobile, loading, site, source.id, setMode]);

  // ページリロード（F5 等）時に未保存変更をフラッシュ
  useEffect(() => {
    const flush = () => {
      const s = useProjectSiteStore.getState();
      if (s.dirty && s.site && s.source) s.save();
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  // フォーカス中テキストを確定してから保存（onBlur → commitTitle/Body → onUpdate → save）
  const handleSave = async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    // onBlur → onCommit → updateSection の Zustand set() が React のバッチ処理を経由して
    // 完了するのを待つ。これがないと直前まで編集中のテキストが save() 時に store に未反映の
    // ケースが生じ、リロードで戻る原因になる。
    await new Promise(r => setTimeout(r, 0));
    await save();
    const { site: savedSite, source: savedSource } = useProjectSiteStore.getState();
    if (!savedSite || !savedSource) return;

    const heroSection = savedSite.pages.flatMap(p => p.sections).find(s => s.type === 'hero');
    const heroTitle = heroSection?.title?.trim();
    if (!heroTitle) return;

    if (savedSource.kind === 'account') {
      // アカウントサイト: ヒーロータイトル → users/{uid}.displayName に同期
      await setDoc(doc(db, 'users', savedSource.id), { displayName: heroTitle }, { merge: true });
      useAccountProfileStore.getState().setDisplayName?.(heroTitle);
    } else if (savedSource.kind === 'project') {
      const currentProject = projects.find(p => p.id === savedSource.id);
      const updates: Record<string, unknown> = {};
      let storeUpdate = { ...currentProject };

      // ① ヒーロータイトル → プロジェクト名に同期
      if (currentProject && heroTitle && currentProject.name !== heroTitle) {
        try {
          await renameProject(savedSource.id, heroTitle);
          storeUpdate = { ...storeUpdate, name: heroTitle };
          updates.name = heroTitle; // renameProject が書くので重複になるが問題なし
        } catch (e) {
          console.error('[handleSave] renameProject failed', e);
        }
      }

      // ② ヒーロー画像 / バナー → coverThumbnailUrl に同期（Works グリッドのサムネ）
      const heroAssetUrl = heroSection?.assetRefs?.find(a => a.thumbnailUrl && !a.placeholder)?.thumbnailUrl ?? null;
      const newCover = heroAssetUrl || savedSite.bannerUrl || null;
      if (newCover && newCover !== currentProject?.coverThumbnailUrl) {
        updates.coverThumbnailUrl = newCover;
        storeUpdate = { ...storeUpdate, coverThumbnailUrl: newCover };
      }

      // ③ ロゴ URL → プロジェクトdocに同期（カードのフォールバックサムネとして使用）
      const newLogoUrl = savedSite.logoUrl ?? null;
      if (newLogoUrl !== (currentProject as any)?.logoUrl) {
        updates.logoUrl = newLogoUrl;
        storeUpdate = { ...storeUpdate, logoUrl: newLogoUrl };
      }

      if (Object.keys(updates).length > 0 && currentProject) {
        const docUpdates: Record<string, any> = {};
        if (updates.coverThumbnailUrl) docUpdates.coverThumbnailUrl = updates.coverThumbnailUrl;
        if ('logoUrl' in updates) docUpdates.logoUrl = updates.logoUrl ?? null;
        if (Object.keys(docUpdates).length > 0) {
          await setDoc(doc(db, 'projects', savedSource.id), docUpdates, { merge: true });
        }
        setProjects(projects.map(p => p.id === savedSource.id ? { ...p, ...storeUpdate } : p));
      }
    }
  };

  // Ctrl+S / Cmd+S キーボードショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]); // eslint-disable-line react-hooks/exhaustive-deps

  const theme = resolveEditorialTheme(site?.theme.personality, site?.theme.accent, site?.theme.overrides);
  const accent = theme.accent;
  const isEdit = mode === 'edit';

  // レイアウトモード（サイドバー/ヘッダー/幅の構造）。プレビュー時のみフル適用、
  // 編集時もヘッダーは出すがサイドバーは編集利便のため editorial/split 同様に扱う。
  const currentLayoutMode = site?.theme.layoutMode ?? 'editorial';
  // レイアウトプリセット優先。未設定なら旧 LAYOUT_CONFIG をフォールバックで解決。
  const activeLayoutPreset = findLayoutPreset(site?.theme.layoutPresetId);
  const resolved = activeLayoutPreset
    ? resolveLayout(activeLayoutPreset)
    : {
        sidebar: (LAYOUT_CONFIG[currentLayoutMode]?.sidebar ? 'left' : 'none') as LayoutSidebar,
        header: (LAYOUT_CONFIG[currentLayoutMode]?.header ?? 'none') as LayoutHeader,
        maxWidth: LAYOUT_CONFIG[currentLayoutMode]?.maxWidth ?? null,
        align: 'left' as LayoutAlign,
        mode: currentLayoutMode,
      };

  // OS の「視差効果を減らす」設定を尊重（初回のみ判定）
  const reducedMotion = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false),
    [],
  );
  // 人格の既定モーション × オーバーライド × 実行コンテキストを解決
  const motionCfg = resolveMotionConfig(
    theme.motion,
    site?.theme.motionOverride,
    { preview: mode === 'preview', reduced: reducedMotion },
  );

  // モーションプリセットが Three.js を要求するとき、WebGL 背景を実描画。
  // 背景は pointer-events:none で編集を妨げないため、編集・プレビュー両方で表示する
  // （DOM/スクロールを書き換える他の演出はプレビュー時のみ）。
  const motionPreset = findMotionPreset(site?.theme.motionPresetId);
  const eff = motionPreset?.effect;
  const snapOn = mode === 'preview' && eff === 'snap' && !reducedMotion;
  const usesWebGL = eff === 'particles' || eff === 'fluid' || eff === 'geometry';
  const webglVariant: WebGLVariant | null = (!reducedMotion && usesWebGL)
    ? (eff === 'fluid' ? 'fluid' : eff === 'geometry' ? 'geometry' : 'particles')
    : null;

  // モーションプリセット適用。スクロール/DOM 演出（編集中は出さない種類）を選んだら
  // 直感的に確認できるよう自動でプレビューへ切り替える。WebGL 背景・静止は編集中でも
  // 分かるので編集モードのまま。
  const handleApplyMotionPreset = (presetId: string) => {
    applyMotionPreset(presetId);
    const p = findMotionPreset(presetId);
    if (!p) return;
    const isWebGL = ['particles', 'fluid', 'geometry'].includes(p.effect);
    const isStill = p.effect === 'none';
    if (!isWebGL && !isStill && mode === 'edit') setMode('preview');
  };

  const handlePick = (ref: SiteAssetRef) => {
    if (selectedSectionId) addAssetToSection(selectedSectionId, ref);
    else addSectionWithAsset('gallery', ref);
  };

  const page = site?.pages.find(p => p.id === activePageId) ?? site?.pages[0];
  const pageSections = page?.sections ?? [];
  const sectionIdsKey = pageSections.map(s => s.id).join(',');

  // スクロールスパイ: 表示中のセクションを目次でハイライト（IntersectionObserver＝測定不要で軽量）
  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const ids = sectionIdsKey ? sectionIdsKey.split(',') : [];
    if (ids.length === 0) return;
    const setActive = useScrollSpyStore.getState().setActiveSectionId;
    setActive(ids[0] ?? null);
    const tops = new Map<string, number>(); // バンド内に見えているセクションの top
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id.replace(/^sec-/, '');
        if (e.isIntersecting) tops.set(id, e.boundingClientRect.top);
        else tops.delete(id);
      }
      if (tops.size === 0) return;
      let best: string | null = null;
      let bestTop = Infinity;
      tops.forEach((top, id) => { if (top < bestTop) { bestTop = top; best = id; } });
      if (best) setActive(best); // ストア更新はサイドバーのみ再レンダー（キャンバスは購読しない）
    }, { root: el, rootMargin: '-8% 0px -68% 0px', threshold: 0 });
    ids.forEach(id => { const node = document.getElementById(`sec-${id}`); if (node) io.observe(node); });
    return () => io.disconnect();
  }, [sectionIdsKey, activePageId, mode]);

  // スクロール演出（Lenis 慣性スクロール＋ヒーローパララックス）。プレビュー時のみ有効。
  useSiteMotion({
    scrollerRef: contentScrollRef,
    contentRef: contentWrapRef,
    config: motionCfg,
    reinitKey: `${activePageId}|${sectionIdsKey}|${mode}|${motionCfg.mode}|${projectsListScope ?? ''}`,
  });

  // モーションプリセット固有の演出（GSAP テキストリビール/ピン、Anime.js グリッチ、Motion One スタッガー/磁着）
  useMotionPresetEffects({
    scrollerRef: contentScrollRef,
    contentRef: contentWrapRef,
    presetId: site?.theme.motionPresetId,
    enabled: mode === 'preview' && !reducedMotion,
    reinitKey: `${activePageId}|${sectionIdsKey}|${mode}|${site?.theme.motionPresetId ?? ''}|${projectsListScope ?? ''}`,
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = pageSections.map(s => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderSections(arrayMove(ids, from, to));
  };

  const handleTocClick = (sectionId: string) => {
    if (isEdit) selectSection(sectionId);
    // ブログ一覧ページ中はメインサイトに戻ってからスクロール。
    setInBlogView(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(`sec-${sectionId}`);
      const container = contentScrollRef.current;
      if (!el || !container) return;
      // スティッキーバー（サイトヘッダー + ブログカテゴリバー）の合計高さを差し引く。
      const headerH = parseFloat(document.documentElement.style.getPropertyValue('--site-header-h') || '0');
      const catBarH = parseFloat(document.documentElement.style.getPropertyValue('--site-cat-bar-h') || '0');
      const target = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top - headerH - catBarH;
      container.scrollTo({ top: target, behavior: 'smooth' });
    });
  };

  /* ---------------- ロード中 ---------------- */
  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <CircularProgress sx={{ color: '#00BFFF' }} />
      </Box>
    );
  }

  /* ---------------- 未作成 ---------------- */
  if (!site) {
    // アカウント/チームサイト: 自動生成中（デフォルトで用意）
    if (isAccountLike) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          <CircularProgress sx={{ color: '#00BFFF' }} />
        </Box>
      );
    }
    // プロジェクトサイト: 対話オンボーディング or テンプレ選択
    if (!showTemplates) {
      return project
        ? <SiteOnboardingChat project={project} onSkipToTemplates={() => setShowTemplates(true)} />
        : <Box />;
    }
    return (
      <Fade in>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, gap: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <LayoutTemplateIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.25)', mb: 1 }} />
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>テンプレートから作成</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 560 }}>
              出発点となるテンプレートを選んでください。
            </Typography>
            <Button onClick={() => setShowTemplates(false)} size="small" sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', textTransform: 'none', '&:hover': { color: '#fff' } }}>
              ← 対話で作成に戻る
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
            {TEMPLATE_FAMILIES.map(t => (
              <Box
                key={t.family}
                onClick={() => createFromTemplate(t.family)}
                sx={{
                  width: 280, p: 3, borderRadius: 3, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.02)',
                  transition: 'all 0.18s',
                  '&:hover': { borderColor: `${t.accent}aa`, bgcolor: 'rgba(255,255,255,0.04)', transform: 'translateY(-3px)' },
                }}
              >
                <Box sx={{ width: 40, height: 6, borderRadius: 3, bgcolor: t.accent, mb: 2 }} />
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', mb: 0.75 }}>{t.label}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', lineHeight: 1.6, mb: 2 }}>{t.description}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {t.sectionTypes.filter(s => s !== 'hero').map(s => (
                    <Chip key={s} label={SECTION_META[s].label} size="small" sx={{ height: 18, fontSize: '0.58rem', bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Fade>
    );
  }

  /* ---------------- サイト本体 ---------------- */
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>

      {/* ツールバー（ページタブを左端に統合して 1 行に） */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, px: { xs: 1, md: 3 }, py: 0.5,
        borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(10,15,25,0.6)', flexShrink: 0,
        overflowX: 'hidden',
      }}>
        {/* モバイル：ページ／目次ドロワーを開くメニューボタン */}
        {isMobile && (
          <Tooltip title="ページ・目次">
            <IconButton
              size="small"
              onClick={() => setNavOpen(o => !o)}
              sx={{
                color: navOpen ? accent : 'rgba(255,255,255,0.85)', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5,
                bgcolor: navOpen ? `${accent}22` : 'transparent',
              }}
            >
              <MenuRoundedIcon sx={{ fontSize: '1.2rem' }} />
            </IconButton>
          </Tooltip>
        )}

        {tabsSlot && <Box sx={{ minWidth: 0 }}>{tabsSlot}</Box>}
        {tabsSlot && !isMobile && <Box sx={{ width: '1px', alignSelf: 'stretch', my: 0.75, bgcolor: 'rgba(255,255,255,0.12)' }} />}

        <Box sx={{ flex: 1, minWidth: 0 }} />

        {/* 手動保存ボタン（Ctrl+S 相当）。モバイルでは省略。 */}
        {!isMobile && (
          <Tooltip title="保存 (Ctrl+S)">
            <span>
              <Button
                size="small"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving
                  ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                  : <CloudSyncRoundedIcon sx={{ fontSize: '0.95rem !important' }} />}
                sx={{
                  fontSize: '0.68rem', fontWeight: 700, textTransform: 'none', color: '#fff',
                  bgcolor: 'rgba(0,191,255,0.18)', border: '1px solid rgba(0,191,255,0.4)',
                  borderRadius: 1.5, px: 1.2, py: 0.3, minWidth: 0,
                  '&:hover': { bgcolor: 'rgba(0,191,255,0.28)' },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'transparent' },
                }}
              >
                {saving ? '保存中…' : '保存'}
              </Button>
            </span>
          </Tooltip>
        )}

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_e, v) => v && setMode(v)}
          sx={{
            flexShrink: 0,
            '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.12)', textTransform: 'none', fontWeight: 700, px: { xs: 0.9, md: 1.5 }, py: 0.4, fontSize: '0.78rem' },
            '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgba(0,191,255,0.2) !important' },
          }}
        >
          <ToggleButton value="edit"><EditRoundedIcon sx={{ fontSize: '1rem', mr: isMobile ? 0 : 0.5 }} />{!isMobile && '編集'}</ToggleButton>
          <ToggleButton value="preview"><VisibilityRoundedIcon sx={{ fontSize: '1rem', mr: isMobile ? 0 : 0.5 }} />{!isMobile && 'プレビュー'}</ToggleButton>
        </ToggleButtonGroup>

        {/* プレゼンモード: AIがナレーションを読み上げながらセクションを自動スクロール */}
        <Tooltip title="プレゼンモード（AIナレーション＋自動スクロール）">
          <Button
            size="small"
            startIcon={<PlayArrowRoundedIcon sx={{ mr: isMobile ? '-4px' : 0 }} />}
            onClick={() => { setInBlogView(false); if (mode !== 'preview') setMode('preview'); setPresentOpen(true); }}
            sx={{
              flexShrink: 0, minWidth: isMobile ? 0 : undefined, px: isMobile ? 1 : 1.2, py: 0.3,
              color: presentOpen ? '#000' : 'rgba(255,255,255,0.75)',
              bgcolor: presentOpen ? accent : 'transparent',
              border: `1px solid ${presentOpen ? accent : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 1.5, textTransform: 'none', fontWeight: 700,
              '&:hover': { bgcolor: presentOpen ? accent : 'rgba(255,255,255,0.06)', color: presentOpen ? '#000' : '#fff' },
            }}
          >
            {!isMobile && 'プレゼン'}
          </Button>
        </Tooltip>

        {/* サイト設定 */}
        <Tooltip title="サイト設定">
          <IconButton
            size="small"
            onClick={() => setSettingsOpen(true)}
            sx={{
              color: settingsOpen ? '#00BFFF' : 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5,
              bgcolor: settingsOpen ? 'rgba(0,191,255,0.12)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' },
            }}
          >
            {isAccount
              ? <TuneRoundedIcon sx={{ fontSize: '1.1rem' }} />
              : <SettingsRoundedIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
        </Tooltip>

        <Button
          size="small"
          variant="contained"
          startIcon={<PublicRoundedIcon sx={{ mr: isMobile ? '-4px' : 0 }} />}
          onClick={() => setPublishOpen(true)}
          sx={{ flexShrink: 0, minWidth: isMobile ? 0 : undefined, px: isMobile ? 1 : undefined, bgcolor: accent, color: '#000', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: accent, opacity: 0.9 } }}
        >
          {!isMobile && (
            site.publish?.status !== 'published' ? '公開'
              : site.publish?.visibility === 'private' ? '非公開'
              : '公開中'
          )}
        </Button>

        {/* デザインパネル（スタイル/レイアウト/モーション/セクション/素材）の開閉。
            プレビュー中も開けるようにし、演出を見比べながら切り替えられる。モバイルでは省略。 */}
        {!isMobile && (
          <Tooltip title={dockOpen ? 'デザインパネルを閉じる' : 'デザインパネルを開く'}>
            <IconButton
              size="small"
              onClick={() => setDockOpen(o => !o)}
              sx={{
                color: dockOpen ? '#00BFFF' : 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5,
                bgcolor: dockOpen ? 'rgba(0,191,255,0.12)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' },
              }}
            >
              <ViewSidebarRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 本体: サイドバーナビ + キャンバス + ドック */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* プレゼンモードの再生コントロールバー（プレビュー上に重ねる） */}
        <SitePresentationController
          open={presentOpen}
          onClose={() => setPresentOpen(false)}
          sections={pageSections}
          projectName={displayName}
          cacheId={`${source.kind}-${source.id}:${page?.id ?? 'p0'}`}
          scrollToSection={handleTocClick}
          accent={accent}
        />
        {/* モバイル：ドロワーの背景スクリム（タップで閉じる） */}
        {isMobile && navOpen && (
          <Box
            onClick={() => setNavOpen(false)}
            sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 30 }}
          />
        )}

        {isMobile ? (
          /* モバイル：左サイドバー（ページ + 目次）をスライドインのドロワーとして表示 */
          <Box
            sx={{
              position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 31,
              maxWidth: '85%', display: 'flex',
              transform: navOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: navOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
            }}
          >
            {/* モバイル：ドロワーを閉じるボタン */}
            <IconButton
              onClick={() => setNavOpen(false)}
              sx={{
                position: 'absolute', top: 6, right: 6, zIndex: 1,
                color: theme.subtext, bgcolor: `${theme.text}0d`,
                '&:hover': { bgcolor: `${theme.text}1a`, color: theme.text },
              }}
              size="small"
            >
              <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
            <SiteNavSidebar
              site={site}
              activePageId={activePageId}
              activeSections={pageSections}
              mode={mode}
              theme={theme}
              projectName={displayName}
              selectedSectionId={selectedSectionId}
              onSelectPage={(id) => { setProjectsListScope(null); selectPage(id); closeNavOnMobile(); }}
              onAddPage={addPage}
              onRemovePage={removePage}
              onRenamePage={renamePage}
              onTocClick={(id) => { handleTocClick(id); closeNavOnMobile(); }}
              accountName={isAccountLike ? undefined : accountName}
              onGoToAccount={isAccountLike ? undefined : () => setCurrentMainView('my-site')}
              accountGroups={accountProjects ? {
                my: accountProjects.my.map(p => ({ id: p.id, name: p.name })),
                team: accountProjects.team.map(p => ({ id: p.id, name: p.name })),
              } : null}
              activeProjectsList={projectsListScope}
              onShowProjectsList={(s) => { setProjectsListScope(s); selectSection(null); closeNavOnMobile(); }}
              onOpenProject={openProjectInApp}
              onCreateProject={onCreateProject}
            />
          </Box>
        ) : (
          <>
            {/* 左サイドバー（ページ + 目次）。sidebar が left か both のとき表示。 */}
            {(resolved.sidebar === 'left' || resolved.sidebar === 'both') && (
            <Box sx={{ order: 0, display: 'flex' }}>
            <SiteNavSidebar
              site={site}
              activePageId={activePageId}
              activeSections={pageSections}
              mode={mode}
              theme={theme}
              projectName={displayName}
              selectedSectionId={selectedSectionId}
              hideSectionToc={resolved.sidebar === 'both'}
              onSelectPage={(id) => { setProjectsListScope(null); selectPage(id); }}
              onAddPage={addPage}
              onRemovePage={removePage}
              onRenamePage={renamePage}
              onTocClick={handleTocClick}
              accountName={isAccountLike ? undefined : accountName}
              onGoToAccount={isAccountLike ? undefined : () => setCurrentMainView('my-site')}
              accountGroups={accountProjects ? {
                my: accountProjects.my.map(p => ({ id: p.id, name: p.name })),
                team: accountProjects.team.map(p => ({ id: p.id, name: p.name })),
              } : null}
              activeProjectsList={projectsListScope}
              onShowProjectsList={(s) => { setProjectsListScope(s); selectSection(null); }}
              onOpenProject={openProjectInApp}
              onCreateProject={onCreateProject}
            />
            </Box>
            )}
            {/* 右サイドバー（右ナビ or 両サイドバー時の右 TOC）。 */}
            {resolved.sidebar === 'right' && (
            <Box sx={{ order: 2, display: 'flex' }}>
            <SiteNavSidebar
              site={site}
              activePageId={activePageId}
              activeSections={pageSections}
              mode={mode}
              theme={theme}
              projectName={displayName}
              selectedSectionId={selectedSectionId}
              onSelectPage={(id) => { setProjectsListScope(null); selectPage(id); }}
              onAddPage={addPage}
              onRemovePage={removePage}
              onRenamePage={renamePage}
              onTocClick={handleTocClick}
              accountName={isAccountLike ? undefined : accountName}
              onGoToAccount={isAccountLike ? undefined : () => setCurrentMainView('my-site')}
              accountGroups={accountProjects ? {
                my: accountProjects.my.map(p => ({ id: p.id, name: p.name })),
                team: accountProjects.team.map(p => ({ id: p.id, name: p.name })),
              } : null}
              activeProjectsList={projectsListScope}
              onShowProjectsList={(s) => { setProjectsListScope(s); selectSection(null); }}
              onOpenProject={openProjectInApp}
              onCreateProject={onCreateProject}
            />
            </Box>
            )}
            {resolved.sidebar === 'both' && (
            <Box sx={{ order: 2, display: 'flex' }}>
              <SiteRightToc sections={pageSections} theme={theme} selectedSectionId={selectedSectionId} onTocClick={handleTocClick} />
            </Box>
            )}
          </>
        )}

        {/* サイトプレビュー / 編集キャンバス（テーマ背景を適用＝公開後の見た目） */}
        <Box ref={contentScrollRef} sx={{ flex: 1, order: 1, overflowY: 'auto', bgcolor: theme.bg, position: 'relative', ...(snapOn ? { scrollSnapType: 'y mandatory' } : {}) }}>
          {/* WebGL 背景（Three.js）：モーションプリセットが webgl を要求するとき */}
          {webglVariant && (
            <MotionWebGLBackground variant={webglVariant} accent={accent} scrollerRef={contentScrollRef} />
          )}
          {/* 上部ヘッダー（バー / 中央ロゴ / 分割ナビ / フローティング） */}
          {resolved.header !== 'none' && !projectsListScope && (
            <SiteTopHeader
              title={displayName}
              theme={theme}
              pages={site.pages.map(p => ({ id: p.id, title: p.title }))}
              activePageId={activePageId}
              sections={pageSections}
              logoUrl={site.logoUrl}
              onSelectPage={(id) => { setProjectsListScope(null); selectPage(id); }}
              onTocClick={handleTocClick}
              variant={resolved.header}
              hideSections={resolved.sidebar === 'left' || resolved.sidebar === 'both'}
            />
          )}
          {/* ブログカテゴリ固定ナビバー（ブログ記事がある場合のみ表示） */}
          {source.kind === 'account' && !projectsListScope && pageSections.some(s => s.type === 'blog') && (
            <SiteBlogCategoryBar
              theme={theme}
              inBlogView={inBlogView}
              onPick={(cat) => { setSiteActiveBlogCat(cat); setInBlogView(true); }}
              onBack={() => { setInBlogView(false); setSiteActiveBlogCat(null); }}
            />
          )}
          {/* サイト切り替え時、本文だけが下からスッと収まる（ヘッダー/ツールバーは不動・
              背景は theme.bg なので暗転しない）。key=ソースで切り替えのたびに再生。 */}
          <motion.div
            key={`${source.kind}:${source.id}`}
            initial={{ y: 18 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform' }}
          >
          {/* maxWidth センタリング＋整列ラッパ。WebGL 背景の上に重ねる。 */}
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: resolved.maxWidth ?? 'none', mx: resolved.maxWidth ? 'auto' : 0, textAlign: resolved.align }}>
          {projectsListScope ? (
            <Box sx={{ px: { xs: 3, md: 8 }, py: { xs: 6, md: 10 }, maxWidth: 1200, mx: 'auto' }}>
              <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, color: theme.text, fontSize: { xs: '1.8rem', md: '2.6rem' }, mb: { xs: 3, md: 5 } }}>
                {projectsListScope === 'my' ? 'My Projects' : 'Team Projects'}
              </Typography>
              <WorksGrid theme={theme} scope={projectsListScope} />
            </Box>
          ) : inBlogView ? (
            /* ブログカテゴリ一覧ページ: カテゴリバーで絞り込みつつ記事を全表示 */
            <Box sx={{ px: PAGE_PX, py: SECTION_PY, maxWidth: MEASURE.wide, mx: 'auto', minHeight: '60vh' }}>
              <BlogIndex theme={theme} hideCats />
            </Box>
          ) : isEdit ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pageSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {pageSections.length === 0 ? (
                  <Box sx={{ p: 8, textAlign: 'center', color: theme.subtext }}>
                    <Typography sx={{ fontFamily: theme.bodyFamily }}>このページにはまだセクションがありません。SEKKEIYA Chat で「〜セクションを追加して」と頼むか、右上の素材パネルから追加できます。</Typography>
                  </Box>
                ) : (
                <>
                  {/* 先頭セクションの前にも挿入ゾーン */}
                  {pageSections.length > 0 && (
                    <SectionInsertZone afterSectionId={null} onInsert={insertSection} accentColor={accent} />
                  )}
                  {pageSections.map((section, idx) => (
                    <React.Fragment key={section.id}>
                      <SortableSection sectionId={section.id}>
                        {(dragHandleProps) => (
                          <SiteSectionView
                            section={section}
                            mode="edit"
                            selected={selectedSectionId === section.id}
                            theme={theme}
                            projectName={displayName}
                            onSelect={() => selectSection(section.id)}
                            onUpdate={(patch) => updateSection(section.id, patch)}
                            onRemove={() => removeSection(section.id)}
                            onRemoveAsset={(refId) => removeAssetFromSection(section.id, refId)}
                            onFillSample={() => fillSampleAssets(section.id)}
                            scrollRootRef={contentScrollRef}
                            motion={motionCfg}
                            dragHandleProps={dragHandleProps}
                            bannerUrl={site?.bannerUrl}
                            projectId={source.kind === 'project' ? source.id : undefined}
                          />
                        )}
                      </SortableSection>
                      {/* 各セクションの後に挿入ゾーン */}
                      <SectionInsertZone afterSectionId={section.id} onInsert={insertSection} accentColor={accent} />
                    </React.Fragment>
                  ))}
                </>
              )}
              </SortableContext>
            </DndContext>
          ) : (
            <Box ref={contentWrapRef}>
              {pageSections.filter(s => !s.hidden).map(section => {
                const view = (
                  <SiteSectionView
                    key={section.id}
                    section={section}
                    mode="preview"
                    selected={false}
                    theme={theme}
                    projectName={displayName}
                    scrollRootRef={contentScrollRef}
                    motion={motionCfg}
                    onSelect={() => {}}
                    onUpdate={() => {}}
                    onRemove={() => {}}
                    onRemoveAsset={() => {}}
                    bannerUrl={site?.bannerUrl}
                    projectId={source.kind === 'project' ? source.id : undefined}
                  />
                );
                return snapOn ? (
                  <Box key={section.id} sx={{ scrollSnapAlign: 'start', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {view}
                  </Box>
                ) : view;
              })}
            </Box>
          )}
          </Box>{/* /maxWidth ラッパ */}
          </motion.div>
        </Box>

        {/* 右ドック（編集・プレビュー両対応・トグルで開閉。既定は閉） */}
        {dockOpen && (
          <Box sx={{ order: 3, display: 'flex' }}>
          <SiteAssetPickerDock
            projectId={project?.id ?? ''}
            selectedSectionId={selectedSectionId}
            selectedSection={pageSections.find(s => s.id === selectedSectionId)}
            personality={site.theme.personality ?? 'journal'}
            motionOverride={site.theme.motionOverride ?? null}
            onPick={handlePick}
            onSelectPersonality={setPersonality}
            onSelectMotion={setMotionOverride}
            onSetVariant={(v) => { if (selectedSectionId) updateSection(selectedSectionId, { variant: v }); }}
            onSelectLayoutMode={setLayoutMode}
            onApplyLayoutPreset={applyLayoutPreset}
            currentLayoutPresetId={site.theme.layoutPresetId}
            onApplyMotionPreset={handleApplyMotionPreset}
            onApplyBundle={applyBundle}
            currentMotionPresetId={site.theme.motionPresetId}
            sections={pageSections}
            onSelectSection={handleTocClick}
            onToggleHidden={(id, hidden) => updateSection(id, { hidden })}
            onRemoveSection={removeSection}
            onReorder={reorderSections}
            onInsertSection={insertSection}
            onChangeSectionType={changeSectionType}
            currentLayoutMode={currentLayoutMode}
          />
          </Box>
        )}
      </Box>


      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} source={source} site={site} displayName={displayName} />

      <SiteSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} source={source} displayName={displayName} />

      {/* 保存エラー通知 */}
      <Snackbar
        open={!!saveError}
        autoHideDuration={6000}
        onClose={clearSaveError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={clearSaveError} sx={{ fontSize: '0.8rem' }}>
          保存に失敗しました。ネットワーク接続や認証状態を確認してください。
          {saveError && <Box component="span" sx={{ display: 'block', fontSize: '0.7rem', opacity: 0.75, mt: 0.25 }}>{saveError}</Box>}
        </Alert>
      </Snackbar>
    </Box>
  );
};
