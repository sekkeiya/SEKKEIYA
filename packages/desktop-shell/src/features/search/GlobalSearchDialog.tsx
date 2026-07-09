// SEKKEIYA 全体検索フローティングパネル。
// - 非モーダル（バックドロップなし）＝パネルを開いたまま作業可能
// - ヘッダーをドラッグして自由に配置可能
// - 折り畳みボタンで検索バーだけに最小化
// - 初期表示：最近のプロジェクト（カード）・公開サイト・メモをGoogle風に表示
// - 入力時：Private（自分データ）/ Public（全ユーザー公開）横断検索

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton, Avatar,
  CircularProgress, Chip, Tooltip, Button,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import WeekendRoundedIcon from '@mui/icons-material/WeekendRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { ProductResultGrid, type ProductResultItem } from './ProductResultGrid';
import { searchCatalogByText, searchCatalogByImage, getCatalogIndexCount } from '../dss/catalog/searchCatalog';
import { PRODUCT_SEARCH_MODES, catalogItemMatchesKind, type SourceKind } from '../dsk/data/sourceRegistry';
import { isTauri } from '../../lib/platform';
import { openSearchWindow } from '../../utils/openSearchWindow';

import {
  collection, getDocs, query, where, orderBy, startAt, endAt, limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { publicUrl } from '../sites/publishService';
import { BRAND } from '../../styles/theme';

type SearchScope = 'private' | 'public' | 'all';
// 検索モード（縦軸）。docs/16: 横断(all) ＋ S.Library の種類(SourceKind=家具/テクスチャ・素材/
// イメージ・パース/建材・仕上げ)に揃えた商品索引フィルタ。タブ定義は PRODUCT_SEARCH_MODES が正典。
type SearchMode = 'all' | SourceKind;

// 商品モードのタブアイコン（S.Library の種類に対応）。
const MODE_ICON: Record<SourceKind, React.ReactNode> = {
  furniture: <WeekendRoundedIcon sx={{ fontSize: 13 }} />,
  texture: <TextureRoundedIcon sx={{ fontSize: 13 }} />,
  render: <ImageRoundedIcon sx={{ fontSize: 13 }} />,
  material: <LayersRoundedIcon sx={{ fontSize: 13 }} />,
};

interface SearchHit {
  id: string;
  section: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  external?: boolean;
  onOpen: () => void;
}

interface RecentItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tag?: string;
  onOpen: () => void;
}

const contains = (text: string | undefined | null, kw: string): boolean =>
  !!text && text.toLowerCase().includes(kw.toLowerCase());

const PANEL_W = 680;
const PANEL_H_FULL = 620;

export const GlobalSearchDialog: React.FC<{ open: boolean; onClose: () => void; embedded?: boolean }> = ({ open, onClose, embedded = false }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);

  const [scope, setScope] = useState<SearchScope>('private');
  // ポップアウト(embedded)は別JSコンテキストで認証/プロジェクトを持たないため家具モード主体。
  const [mode, setMode] = useState<SearchMode>(embedded ? 'furniture' : 'all');
  const [queryText, setQueryText] = useState('');
  // 家具モード（retrieval: searchCatalogByText → 共有グリッド）
  const [products, setProducts] = useState<ProductResultItem[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [indexCount, setIndexCount] = useState<number | null>(null);
  // 家具モードの画像クエリ（dataURL）。設定中はテキストより画像類似検索を優先。
  const [queryImage, setQueryImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // ピン留め中は「マウスがパネル外に出たら折りたたむ」自動挙動を無効化し常時展開。
  const [pinned, setPinned] = useState(false);
  const [recentSites, setRecentSites] = useState<RecentItem[]>([]);
  const [recentJournals, setRecentJournals] = useState<RecentItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // ── ドラッグ状態 ──
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const myUid = currentUser?.uid ?? null;

  // ── パネル初期位置（ビューポート中央） ──
  const getInitialPos = useCallback(() => ({
    x: Math.max(0, Math.round((window.innerWidth - PANEL_W) / 2)),
    y: 60,
  }), []);

  // ── ドラッグ開始 ──
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const current = pos ?? getInitialPos();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: current.x, startPosY: current.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - PANEL_W, dragRef.current.startPosX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + dy));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos, getInitialPos]);

  // ── ナビゲーション ──
  const openProject = useCallback((projectId: string, tab?: string) => {
    const app = useAppStore.getState();
    app.setActiveProjectId(projectId);
    app.setActiveWorkspaceId(null);
    if (tab) app.setPendingProjectTab(tab);
    app.setCurrentMainView('workspace');
  }, []);

  const openProfile = useCallback((uid: string) => {
    const app = useAppStore.getState();
    const prevView = app.currentMainView;
    if (prevView !== 'creator-profile') app.setCreatorProfileReturnView(prevView);
    app.setViewingCreatorId(uid);
    app.setCurrentMainView('creator-profile');
  }, []);

  // ── 初期コンテンツ（最近のサイト・ジャーナル）をロード ──
  useEffect(() => {
    if (!open || !myUid) return;
    let alive = true;
    setRecentLoading(true);
    (async () => {
      try {
        const results = await Promise.all([
          getDocs(query(
            collection(db, 'publishedSites'),
            where('ownerUid', '==', myUid),
            orderBy('updatedAt', 'desc'),
            limit(5),
          )).catch(() => null),
          ...projects.slice(0, 5).map(p =>
            getDocs(query(
              collection(db, 'projects', p.id, 'journals'),
              orderBy('createdAt', 'desc'),
              limit(3),
            )).then(s => ({ project: p, snap: s })).catch(() => null)
          ),
        ]);
        if (!alive) return;

        const [sitesSnap, ...journalResults] = results;

        const sites: RecentItem[] = [];
        (sitesSnap as any)?.docs?.forEach((d: any) => {
          const x = d.data();
          sites.push({
            id: d.id,
            icon: <LanguageRoundedIcon sx={{ fontSize: 14, color: '#43e97b' }} />,
            title: x.site?.title || x.slug || '無題のサイト',
            subtitle: publicUrl(x.slug),
            tag: x.kind === 'project' ? 'プロジェクト' : 'アカウント',
            onOpen: () => {
              if (x.kind === 'project' && x.projectId) openProject(x.projectId);
              else window.open(publicUrl(x.slug), '_blank');
            },
          });
        });

        const journals: RecentItem[] = [];
        (journalResults as any[]).filter(Boolean).forEach((item: any) => {
          item.snap.docs.slice(0, 2).forEach((d: any) => {
            const x = d.data();
            journals.push({
              id: d.id,
              icon: <ArticleRoundedIcon sx={{ fontSize: 14, color: '#ffd740' }} />,
              title: x.title || (x.content ?? '').slice(0, 40) || '無題のメモ',
              subtitle: item.project.name,
              onOpen: () => openProject(item.project.id, 'memo'),
            });
          });
        });

        setRecentSites(sites);
        setRecentJournals(journals.slice(0, 5));
      } catch {
        /* ignore */
      } finally {
        if (alive) setRecentLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, myUid, projects, openProject]);

  // ── 検索本体 ──
  const runSearch = useCallback(async (kw: string, currentScope: SearchScope) => {
    const keyword = kw.trim();
    if (!keyword || !myUid) { setHits([]); setSearched(false); return; }
    const seq = ++searchSeq.current;
    setLoading(true);

    const results: SearchHit[] = [];
    const push = (h: SearchHit) => results.push(h);

    try {
      if (currentScope === 'private' || currentScope === 'all') {
        const allProjects = useAppStore.getState().projects;
        allProjects
          .filter(p => contains(p.name, keyword) || contains(p.description, keyword))
          .slice(0, 10)
          .forEach(p => push({
            id: `proj-${p.id}`, section: 'プロジェクト',
            icon: <FolderRoundedIcon sx={{ fontSize: 16, color: '#8ab4f8' }} />,
            title: p.name,
            subtitle: p.description || 'プロジェクトを開く',
            onOpen: () => openProject(p.id),
          }));

        const [knowledgeSnap, driveSnap, mySitesSnap, journalsPerProject] = await Promise.all([
          getDocs(query(collection(db, 'users', myUid, 'knowledgeSources'), orderBy('createdAt', 'desc'), limit(100))).catch(() => null),
          getDocs(query(collection(db, 'users', myUid, 'driveAssets'), limit(150))).catch(() => null),
          getDocs(query(collection(db, 'publishedSites'), where('ownerUid', '==', myUid))).catch(() => null),
          Promise.all(allProjects.slice(0, 10).map(p =>
            getDocs(query(collection(db, 'projects', p.id, 'journals'), orderBy('createdAt', 'desc'), limit(20)))
              .then(s => ({ project: p, snap: s })).catch(() => null)
          )),
        ]);

        knowledgeSnap?.docs
          .filter(d => { const x = d.data() as any; return contains(x.title, keyword) || contains(x.summary, keyword) || contains(x.content?.slice(0, 500), keyword); })
          .slice(0, 10)
          .forEach(d => {
            const x = d.data() as any;
            push({
              id: `rag-${d.id}`, section: 'ナレッジ (RAG)',
              icon: <MenuBookRoundedIcon sx={{ fontSize: 16, color: '#e2a6ff' }} />,
              title: x.title || '無題のナレッジ',
              subtitle: x.summary?.slice(0, 60) || x.sourceFile || 'AI Studio のナレッジ',
              onOpen: () => { useAppStore.getState().setCurrentMainView('ai-studio'); },
            });
          });

        driveSnap?.docs
          .filter(d => { const x = d.data() as any; return !x.isDeleted && (contains(x.name, keyword) || (Array.isArray(x.tags) && x.tags.some((t: string) => contains(t, keyword)))); })
          .slice(0, 10)
          .forEach(d => {
            const x = d.data() as any;
            push({
              id: `drive-${d.id}`, section: 'AI Drive',
              icon: <CloudRoundedIcon sx={{ fontSize: 16, color: '#4fc3f7' }} />,
              title: x.name || '無題のファイル',
              subtitle: [x.type, x.memo].filter(Boolean).join(' ・ ') || 'AI Drive の資産',
              onOpen: () => { useAppStore.getState().setAIDriveOpen(true); },
            });
          });

        journalsPerProject?.filter(Boolean).forEach(item => {
          item!.snap.docs
            .filter(d => { const x = d.data() as any; return !x.isDeleted && (contains(x.title, keyword) || contains(x.content?.slice(0, 800), keyword)); })
            .slice(0, 5)
            .forEach(d => {
              const x = d.data() as any;
              push({
                id: `journal-${item!.project.id}-${d.id}`, section: 'ジャーナル・メモ',
                icon: <ArticleRoundedIcon sx={{ fontSize: 16, color: '#ffd740' }} />,
                title: x.title || (x.content ?? '').slice(0, 30) || '無題のメモ',
                subtitle: `${item!.project.name} の Memo`,
                onOpen: () => openProject(item!.project.id, 'memo'),
              });
            });
        });

        mySitesSnap?.docs
          .filter(d => { const x = d.data() as any; return contains(x.slug, keyword) || contains(x.username, keyword) || contains(x.site?.title, keyword); })
          .slice(0, 10)
          .forEach(d => {
            const x = d.data() as any;
            push({
              id: `mysite-${d.id}`, section: '自分の公開サイト',
              icon: <LanguageRoundedIcon sx={{ fontSize: 16, color: '#43e97b' }} />,
              title: x.site?.title || x.slug,
              subtitle: x.kind === 'project' ? 'プロジェクトサイト' : 'アカウントサイト',
              external: x.kind !== 'project' || !x.projectId,
              onOpen: () => {
                if (x.kind === 'project' && x.projectId) openProject(x.projectId);
                else window.open(publicUrl(x.slug), '_blank');
              },
            });
          });

      }

      if (currentScope === 'public' || currentScope === 'all') {
        const [usersSnap, sitesSnap, assetsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), orderBy('displayName'), startAt(keyword), endAt(keyword + ''), limit(15))).catch(() => null),
          getDocs(query(collection(db, 'publishedSites'), orderBy('updatedAt', 'desc'), limit(150))).catch(() => null),
          getDocs(query(collection(db, 'assets'), where('visibility', '==', 'public'), limit(150))).catch(() => null),
        ]);

        usersSnap?.docs.filter(d => (d.data() as any).displayName).forEach(d => {
          const x = d.data() as any;
          push({
            id: `user-${d.id}`, section: 'ユーザー',
            icon: x.photoURL
              ? <Avatar src={x.photoURL} sx={{ width: 18, height: 18 }} />
              : <PersonRoundedIcon sx={{ fontSize: 16, color: '#3498db' }} />,
            title: x.displayName,
            subtitle: x.bio?.slice(0, 60) || 'プロフィールを表示',
            onOpen: () => openProfile(d.id),
          });
        });

        sitesSnap?.docs
          .filter(d => { const x = d.data() as any; return contains(x.slug, keyword) || contains(x.username, keyword) || contains(x.site?.title, keyword); })
          .slice(0, 15)
          .forEach(d => {
            const x = d.data() as any;
            push({
              id: `site-${d.id}`, section: '公開サイト',
              icon: <LanguageRoundedIcon sx={{ fontSize: 16, color: '#43e97b' }} />,
              title: x.site?.title || x.slug,
              subtitle: `${x.kind === 'project' ? 'プロジェクトサイト' : 'アカウントサイト'} ・ ${x.username}`,
              external: true,
              onOpen: () => { window.open(publicUrl(x.slug), '_blank'); },
            });
          });

        assetsSnap?.docs
          .filter(d => { const x = d.data() as any; return contains(x.name, keyword) || (Array.isArray(x.tags) && x.tags.some((t: string) => contains(t, keyword))); })
          .slice(0, 15)
          .forEach(d => {
            const x = d.data() as any;
            push({
              id: `asset-${d.id}`, section: '公開アセット',
              icon: <CollectionsRoundedIcon sx={{ fontSize: 16, color: '#fa709a' }} />,
              title: x.name || '無題のアセット',
              subtitle: x.type || 'Gallery で表示',
              onOpen: () => { useAppStore.getState().setCurrentMainView('gallery'); },
            });
          });
      }
    } catch (e) {
      console.error('[global-search]', e);
    }

    if (seq === searchSeq.current) {
      setHits(results);
      setSearched(true);
      setLoading(false);
    }
  }, [myUid, openProject, openProfile]);

  useEffect(() => {
    if (!open || mode !== 'all') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(queryText, scope), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [queryText, scope, open, mode, runSearch]);

  // ── 商品モード：索引済み商品を検索（retrieval層）。画像クエリがあれば CLIP 類似、無ければテキスト。
  //    取得後に現在の種類(SourceKind)で絞り込み、S.Library の種類タブと一致させる ──
  useEffect(() => {
    if (!open || mode === 'all') return;
    const kind = mode; // ここでは mode は SourceKind
    let alive = true;
    void getCatalogIndexCount().then((n) => { if (alive) setIndexCount(n); }).catch(() => {});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setProductLoading(true);
    const run = queryImage
      ? () => searchCatalogByImage(queryImage, 200)
      : () => searchCatalogByText(queryText, 200);
    // 画像検索は初回モデル読込が重いのでデバウンス短め。テキストは通常のデバウンス。
    debounceRef.current = setTimeout(() => {
      void run()
        .then((items) => { if (alive) setProducts(items.filter((it) => catalogItemMatchesKind(it, kind)).slice(0, 80)); })
        .catch(() => { if (alive) setProducts([]); })
        .finally(() => { if (alive) setProductLoading(false); });
    }, queryImage ? 50 : 300);
    return () => { alive = false; if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [queryText, queryImage, open, mode]);

  useEffect(() => {
    if (!open) {
      setQueryText(''); setHits([]); setSearched(false); setCollapsed(false); setPos(null);
      setMode('all'); setProducts([]); setPinned(false); setQueryImage(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // 画像クエリ受け取り（ファイル選択 / ドロップ / 貼り付け）。dataURL にして state へ。
  const acceptImageBlob = useCallback((blob: Blob) => {
    const reader = new FileReader();
    // すでに商品モードならその種類を維持。横断(all)からの投入は家具に寄せる。
    reader.onload = () => { setMode(m => (m === 'all' ? 'furniture' : m)); setQueryImage(reader.result as string); };
    reader.readAsDataURL(blob);
  }, []);

  const onDropImage = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (f) acceptImageBlob(f);
  }, [acceptImageBlob]);

  // 商品モード中はクリップボード画像の貼り付けで検索できる。
  useEffect(() => {
    if (!open || mode === 'all') return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      const blob = item?.getAsFile();
      if (blob) acceptImageBlob(blob);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, mode, acceptImageBlob]);

  // S.Library（dsk）へ遷移して索引を増やす導線。embedded(別窓)では遷移不可なので非表示。
  const goToLibrary = useCallback(() => {
    const s = useAppStore.getState() as any;
    try {
      if (s.pinnedTabIds && !s.pinnedTabIds.includes('3dsk')) s.togglePinnedTab?.('3dsk');
      s.setActiveWorkspaceId?.('library');
      s.setLastActiveAppScope?.('3dsk');
      s.setCurrentMainView?.('workspace');
    } catch (e) { console.error('[search] goToLibrary failed', e); }
    onClose();
  }, [onClose]);

  const sections: { name: string; items: SearchHit[] }[] = [];
  hits.forEach(h => {
    const sec = sections.find(s => s.name === h.section);
    if (sec) sec.items.push(h);
    else sections.push({ name: h.section, items: [h] });
  });

  if (!open) return null;

  const isSearching = !!queryText.trim();
  const recentProjects = projects.slice(0, 6);
  const resolvedPos = pos ?? getInitialPos();

  return (
    <Box
      onMouseEnter={embedded ? undefined : () => setCollapsed(false)}
      onMouseLeave={embedded ? undefined : () => { if (!pinned) setCollapsed(true); }}
      sx={embedded ? {
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        bgcolor: 'rgba(10,13,22,1)',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      } : {
        position: 'fixed',
        left: resolvedPos.x,
        top: resolvedPos.y,
        width: PANEL_W,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 1400,
        bgcolor: 'rgba(10,13,22,0.97)',
        backdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 3,
        boxShadow: '0 28px 72px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: collapsed ? 'none' : PANEL_H_FULL,
        userSelect: 'none',
      }}
    >
      {/* ── アクセントバー ── */}
      <Box sx={{ height: 2, flexShrink: 0, background: 'linear-gradient(90deg, #8ab4f8 0%, #e2a6ff 33%, #43e97b 66%, #ffd740 100%)' }} />

      {/* ── ドラッグ可能ヘッダー（embedded時はOS枠が移動を担うのでDOMドラッグ無効） ── */}
      <Box
        onMouseDown={embedded ? undefined : handleDragStart}
        sx={{
          px: 1.5, py: 0.85,
          display: 'flex', alignItems: 'center', gap: 1,
          flexShrink: 0,
          cursor: embedded ? 'default' : 'grab',
          bgcolor: 'rgba(255,255,255,0.02)',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          '&:active': embedded ? undefined : { cursor: 'grabbing' },
        }}
      >
        {/* ドラッグハンドル */}
        {!embedded && <DragIndicatorRoundedIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}

        {/* タイトル */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.8px', flex: 1, lineHeight: 1 }}>
          SEKKEIYA SEARCH
        </Typography>

        {/* Private / Public / All スコープピル（embedded＝家具主体のため非表示） */}
        {!embedded && (
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
          {(['all', 'private', 'public'] as const).map(s => {
            const accent = s === 'all' ? '#e2a6ff' : s === 'private' ? '#8ab4f8' : '#43e97b';
            const label = s === 'all' ? 'All' : s === 'private' ? 'Private' : 'Public';
            return (
            <Box
              key={s}
              onClick={() => setScope(s)}
              sx={{
                px: 1, py: 0.25, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                border: '1px solid',
                borderColor: scope === s ? `${accent}73` : 'rgba(255,255,255,0.1)',
                bgcolor: scope === s ? `${accent}24` : 'transparent',
                '&:hover': { bgcolor: scope === s ? undefined : 'rgba(255,255,255,0.06)' },
              }}
            >
              <Typography sx={{
                fontSize: 10, fontWeight: 700, lineHeight: 1,
                color: scope === s ? accent : 'rgba(255,255,255,0.4)',
              }}>
                {label}
              </Typography>
            </Box>
            );
          })}
        </Box>
        )}

        {/* ピン留め / 折り畳み / ポップアウト / 閉じる */}
        <Box sx={{ display: 'flex', gap: 0.25 }} onMouseDown={e => e.stopPropagation()}>
          {!embedded && isTauri() && (
            <Tooltip title="別ウィンドウで開く（外に出す）">
              <IconButton size="small" onClick={() => { try { openSearchWindow(); onClose(); } catch (e) { console.error(e); } }}
                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#8ab4f8' }, p: 0.4 }}>
                <OpenInFullRoundedIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
          {!embedded && (
            <Tooltip title={pinned ? 'ピン留め解除（マウスが外れると折りたたむ）' : 'ピン留め（常に開いたまま）'}>
              <IconButton size="small" onClick={() => { setPinned(v => { const next = !v; if (next) setCollapsed(false); return next; }); }}
                sx={{ color: pinned ? '#ffd740' : 'rgba(255,255,255,0.3)', '&:hover': { color: pinned ? '#ffd740' : '#fff' }, p: 0.4 }}>
                {pinned ? <PushPinRoundedIcon sx={{ fontSize: 13 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>
          )}
          {!embedded && (
            <Tooltip title={collapsed ? '展開' : '最小化'}>
              <IconButton size="small" onClick={() => setCollapsed(v => !v)}
                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' }, p: 0.4 }}>
                {collapsed
                  ? <UnfoldMoreRoundedIcon sx={{ fontSize: 14 }} />
                  : <RemoveRoundedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="閉じる (Esc)">
            <IconButton size="small" onClick={onClose}
              sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#f87171' }, p: 0.4 }}>
              <CloseRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── コンテンツエリア（折り畳み時は非表示）── */}
      {!collapsed && (
        <>
          {/* 検索バー */}
          <Box sx={{
            px: 2, py: 1.1, display: 'flex', alignItems: 'center', gap: 1.25,
            flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {loading
              ? <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
              : <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.38)', flexShrink: 0 }} />
            }
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { if (queryText) setQueryText(''); else onClose(); } }}
              placeholder={mode !== 'all' ? `${PRODUCT_SEARCH_MODES.find(m => m.kind === mode)?.label ?? '商品'}を検索（商品名・ブランド・カテゴリ…）` : (scope === 'private' ? '自分のプロジェクト・ナレッジ・ファイルを検索…' : 'ユーザー・公開サイト・アセットを検索…')}
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{
                '& .MuiInputBase-input': {
                  color: '#fff', fontSize: 14, fontWeight: 400, py: 0,
                  '&::placeholder': { color: 'rgba(255,255,255,0.26)', opacity: 1 },
                },
              }}
            />
            {queryText && (
              <IconButton size="small" onClick={() => setQueryText('')}
                sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' }, p: 0.4, flexShrink: 0 }}>
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>

          {/* モード切替（縦軸）: すべて ＋ S.Library の種類（家具/テクスチャ・素材/イメージ・パース/建材・仕上げ）。docs/16 */}
          <Box sx={{ px: 2, py: 0.85, display: 'flex', alignItems: 'center', gap: 0.75, rowGap: 0.75, flexWrap: 'wrap', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              ...(embedded ? [] : [{ id: 'all' as SearchMode, label: 'すべて', icon: <SearchRoundedIcon sx={{ fontSize: 13 }} /> }]),
              ...PRODUCT_SEARCH_MODES.map(m => ({ id: m.kind as SearchMode, label: m.label, icon: MODE_ICON[m.kind] })),
            ].map(m => (
              <Box
                key={m.id}
                onClick={() => setMode(m.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.4, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  border: '1px solid',
                  borderColor: mode === m.id ? 'rgba(138,180,248,0.45)' : 'rgba(255,255,255,0.1)',
                  bgcolor: mode === m.id ? 'rgba(138,180,248,0.14)' : 'transparent',
                  color: mode === m.id ? '#8ab4f8' : 'rgba(255,255,255,0.45)',
                  '&:hover': { bgcolor: mode === m.id ? undefined : 'rgba(255,255,255,0.06)' },
                }}
              >
                {m.icon}
                <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{m.label}</Typography>
              </Box>
            ))}
            {mode !== 'all' && (
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="画像で似た商品を探す（画像をドロップ / 貼り付けも可）">
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 10,
                      cursor: 'pointer', border: '1px solid rgba(226,166,255,0.4)', color: '#e2a6ff',
                      '&:hover': { bgcolor: 'rgba(226,166,255,0.12)' },
                    }}
                  >
                    <AddPhotoAlternateRoundedIcon sx={{ fontSize: 13 }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>画像で検索</Typography>
                  </Box>
                </Tooltip>
                {indexCount != null && (
                  <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>
                    索引済み {indexCount.toLocaleString()} 件
                  </Typography>
                )}
                {!embedded && (
                  <Tooltip title="S.Library で索引を増やす">
                    <Box onClick={goToLibrary} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#7dd3fc' } }}>
                      <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    </Box>
                  </Tooltip>
                )}
              </Box>
            )}
            <input
              ref={fileInputRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptImageBlob(f); e.currentTarget.value = ''; }}
            />
          </Box>

          {/* スクロール可能なコンテンツ */}
          <Box sx={{ overflowY: 'auto', flex: 1, pb: 2 }}>

            {/* ── 商品モード：索引済み商品の検索（共有結果サーフェス） ── */}
            {mode !== 'all' ? (
              <Box
                sx={{ px: 2, pt: 1.75, minHeight: 120 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropImage}
              >
                {/* 画像クエリのプレビュー（設定中は CLIP 類似順） */}
                {queryImage && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5, p: 1, borderRadius: 1.5, bgcolor: 'rgba(226,166,255,0.08)', border: '1px solid rgba(226,166,255,0.25)' }}>
                    <img src={queryImage} alt="クエリ画像" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                    <Typography sx={{ flex: 1, fontSize: 11.5, color: '#e2a6ff', fontWeight: 600 }}>この画像に近い順</Typography>
                    <IconButton size="small" onClick={() => setQueryImage(null)} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
                      <CloseRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                )}
                {productLoading && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 3 }}>
                    <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.25)' }} />
                    {queryImage && (
                      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>画像を解析中…（初回はモデル読込に時間がかかります）</Typography>
                    )}
                  </Box>
                )}
                {!productLoading && indexCount === 0 && (
                  <Box sx={{ textAlign: 'center', py: 5 }}>
                    <WeekendRoundedIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.3)', mb: 0.75 }} />
                    <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>まだ商品が索引されていません</Typography>
                    <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.5, mb: 1.5 }}>
                      S.Library で「おすすめソースを追加」すると、ここで商品を検索できます
                    </Typography>
                    {!embedded && (
                      <Button size="small" variant="outlined" startIcon={<WeekendRoundedIcon sx={{ fontSize: 16 }} />} onClick={goToLibrary}
                        sx={{ color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}>
                        S.Library で索引を増やす
                      </Button>
                    )}
                  </Box>
                )}
                {!productLoading && indexCount !== 0 && products.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 5, opacity: 0.5 }}>
                    <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>
                      {queryImage
                        ? 'この画像に近い商品が見つかりませんでした'
                        : queryText.trim()
                          ? `「${queryText.trim()}」に一致する商品が見つかりませんでした`
                          : `「${PRODUCT_SEARCH_MODES.find(m => m.kind === mode)?.label ?? 'この種類'}」の商品はまだ索引されていません`}
                    </Typography>
                  </Box>
                )}
                {!productLoading && products.length > 0 && (
                  <ProductResultGrid items={products} />
                )}
              </Box>
            ) : (
            <>
            {/* ローディング */}
            {(loading || recentLoading) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.25)' }} />
              </Box>
            )}

            {/* ── 初期表示（未入力）：最近のコンテンツカード ── */}
            {!isSearching && !loading && !recentLoading && (
              <>
                {/* 最近のプロジェクト ─ カードグリッド */}
                {recentProjects.length > 0 && (
                  <Box sx={{ px: 2, pt: 1.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.1 }}>
                      <AccessTimeRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }} />
                      <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 700 }}>
                        最近のプロジェクト
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                      {recentProjects.map(p => (
                        <Box
                          key={p.id}
                          onClick={() => openProject(p.id)}
                          sx={{
                            p: 1.5, borderRadius: 2, cursor: 'pointer',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            transition: 'all 0.15s',
                            '&:hover': {
                              bgcolor: 'rgba(138,180,248,0.07)',
                              borderColor: 'rgba(138,180,248,0.22)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            },
                            display: 'flex', flexDirection: 'column', gap: 1,
                          }}
                        >
                          <Box sx={{
                            width: 34, height: 34, borderRadius: 1.5,
                            bgcolor: 'rgba(138,180,248,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                          }}>
                            {p.iconUrl
                              ? <Avatar src={p.iconUrl} sx={{ width: 34, height: 34, borderRadius: 1.5 }} />
                              : p.iconEmoji
                                ? <Typography sx={{ fontSize: 19, lineHeight: 1 }}>{p.iconEmoji}</Typography>
                                : <FolderRoundedIcon sx={{ fontSize: 18, color: '#8ab4f8' }} />}
                          </Box>
                          <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>
                            {p.name}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', lineHeight: 1 }}>
                            {p.isTeam ? 'チーム' : `${(p.memberIds as string[] | undefined)?.length ?? 1}人 + AI`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* 最近の公開サイト */}
                {recentSites.length > 0 && (
                  <Box sx={{ px: 2, pt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.85 }}>
                      <LanguageRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }} />
                      <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 700 }}>
                        公開サイト
                      </Typography>
                    </Box>
                    {recentSites.map(item => (
                      <Box
                        key={item.id}
                        onClick={item.onOpen}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          py: 0.85, px: 1, borderRadius: 1.5, cursor: 'pointer', mx: -1,
                          transition: 'background 0.12s',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                        }}
                      >
                        <Box sx={{
                          width: 26, height: 26, borderRadius: 1, flexShrink: 0,
                          bgcolor: 'rgba(67,233,123,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.icon}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                            {item.title}
                          </Typography>
                          {item.subtitle && (
                            <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>
                              {item.subtitle}
                            </Typography>
                          )}
                        </Box>
                        {item.tag && (
                          <Chip label={item.tag} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, color: '#43e97b', bgcolor: 'rgba(67,233,123,0.1)', border: '1px solid rgba(67,233,123,0.2)' }} />
                        )}
                        <OpenInNewRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 最近のジャーナル・メモ */}
                {recentJournals.length > 0 && (
                  <Box sx={{ px: 2, pt: 1.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.85 }}>
                      <ArticleRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }} />
                      <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 700 }}>
                        最近のメモ
                      </Typography>
                    </Box>
                    {recentJournals.map(item => (
                      <Box
                        key={item.id}
                        onClick={item.onOpen}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          py: 0.85, px: 1, borderRadius: 1.5, cursor: 'pointer', mx: -1,
                          transition: 'background 0.12s',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                        }}
                      >
                        <Box sx={{
                          width: 26, height: 26, borderRadius: 1, flexShrink: 0,
                          bgcolor: 'rgba(255,215,64,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.icon}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                            {item.title}
                          </Typography>
                          {item.subtitle && (
                            <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)' }}>
                              {item.subtitle}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 完全に空の場合 */}
                {recentProjects.length === 0 && recentSites.length === 0 && recentJournals.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 5, opacity: 0.4 }}>
                    <SearchRoundedIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.3)', mb: 0.75 }} />
                    <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>
                      「あのファイルどこだっけ？」をここで解決
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.5 }}>
                      Private = 自分のデータ　Public = 全ユーザー公開情報
                    </Typography>
                  </Box>
                )}
              </>
            )}

            {/* ── 検索結果 ── */}
            {isSearching && !loading && searched && hits.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 5, opacity: 0.5 }}>
                <Typography sx={{ fontSize: 12.5, color: BRAND.sub }}>
                  「{queryText.trim()}」に一致する{scope === 'private' ? '自分のデータ' : scope === 'public' ? '公開情報' : 'データ'}が見つかりませんでした
                </Typography>
              </Box>
            )}

            {isSearching && !loading && sections.map(sec => (
              <Box key={sec.name}>
                <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.58rem', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', fontWeight: 700 }}>
                    {sec.name}
                  </Typography>
                  <Chip label={sec.items.length} size="small" sx={{ height: 14, fontSize: 9, color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.06)' }} />
                </Box>
                {sec.items.map(h => (
                  <Box
                    key={h.id}
                    onClick={h.onOpen}
                    sx={{
                      px: 2, py: 1,
                      display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                      transition: 'background 0.12s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    }}
                  >
                    <Box sx={{
                      width: 28, height: 28, borderRadius: 1.5, flexShrink: 0,
                      bgcolor: 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {h.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
                        {h.title}
                      </Typography>
                      {h.subtitle && (
                        <Typography noWrap sx={{ fontSize: 11, color: BRAND.sub2 }}>
                          {h.subtitle}
                        </Typography>
                      )}
                    </Box>
                    {h.external && (
                      <OpenInNewRoundedIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
                    )}
                  </Box>
                ))}
              </Box>
            ))}
            </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
