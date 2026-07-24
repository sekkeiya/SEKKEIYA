import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, IconButton, Paper, Divider, TextField, Chip, List, ListItem, ListItemText, Tooltip, CircularProgress } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import StraightenIcon from '@mui/icons-material/Straighten';
import { RightPanelModelViewer, type MaterialPreviewState } from './RightPanelModelViewer';
import type { EnumeratedSlot } from '../../shared/material/applyMaterial';
import { DssWalkthroughViewer } from './DssWalkthroughViewer';
import { DssDetailStudio, DssStudioTabs, type DetailTab } from './DssDetailStudio';
import { DssModelInfoPanel } from './DssRightPanel';
import { normalizeGimmicks } from '../../shared/walkthrough/gimmicks';
import { readMaterialPresets, readMaterialVariants, expandVariantSelection, type MaterialVariant } from '../../shared/material/materialPresets';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { DssVariantGallery } from './DssVariantGallery';
import { DeferUntilVisible } from './DeferUntilVisible';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import ImageSearchRoundedIcon from '@mui/icons-material/ImageSearchRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded';
import ThreeDRotationRoundedIcon from '@mui/icons-material/ThreeDRotationRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDssLiveDimensionsStore } from '../../../store/useDssLiveDimensionsStore';
import { getDownloadUrlForModel, getCanonicalModelId } from '../utils/modelUtils';
import { prefetchModelGlb } from '../utils/prefetchModelGlb';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { DssModelCard } from '../DssModelCard';

interface UsageLocation {
  optionId: string;
  pathName: string;
  count: number;
}

interface UsageInfo {
  totalCount: number;
  locations: UsageLocation[];
}

interface Props {
  model: any;
  allItems?: any[];
  onBack: () => void;
  onSelectRelated?: (model: any) => void;
  usageMap?: Record<string, UsageInfo | number>;
  prevModel?: any | null;
  nextModel?: any | null;
  onNavigate?: (dir: 1 | -1) => void;
  // 上部の検索バー＋カメラ（機能はダッシュボードと同じ。ダッシュボード側から配線）
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  canImageSearch?: boolean;
  imgSearchBusy?: boolean;
  onCameraClick?: (el: HTMLElement) => void;
  // 表示中の 1 モデルに対するアクション（関連URL/カタログ/AI入力/Rhino/Blender）。
  // これまで画面下のフロートバーにあったものを右ペインへ移設するために配線する。
  detailActions?: {
    canRegister: boolean;
    canRhino: boolean;
    canBlender: boolean;
    dccBusy: 'rhino' | 'blender' | null;
    onRegisterLinks: () => void;
    onCatalog: () => void;
    onAutoFill: () => void;
    onRhino: () => void;
    onBlender: () => void;
  };
}

/**
 * 詳細画面のヘッダー内容（戻る / 検索＋カメラ / 前後モデルナビ）。
 * 一覧画面と同じく「全幅ヘッダー（右サイドバーの上まで届く）」にするため、
 * 詳細ビュー本体ではなく DssDashboard 側のヘッダー枠で描画する。
 * flex コンテナ（styles.topBar）の直接の子になる前提でフラグメントを返す。
 */
export const DssDetailHeader: React.FC<{
  onBack: () => void;
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  canImageSearch?: boolean;
  imgSearchBusy?: boolean;
  onCameraClick?: (el: HTMLElement) => void;
  prevModel?: any | null;
  nextModel?: any | null;
  onNavigate?: (dir: 1 | -1) => void;
}> = ({ onBack, searchQuery, onSearchChange, onSearchSubmit, canImageSearch, imgSearchBusy, onCameraClick, prevModel, nextModel, onNavigate }) => (
  <>
    <Button
      variant="contained"
      startIcon={<ArrowBackIcon />}
      onClick={onBack}
      sx={{
        bgcolor: 'rgb(var(--slate-panel-rgb) / 0.6)',
        color: 'var(--brand-fg)',
        borderRadius: 999,
        textTransform: 'none',
        flexShrink: 0,
        '&:hover': { bgcolor: 'rgb(var(--slate-panel-rgb) / 0.8)' }
      }}
    >
      Back
    </Button>

    {/* 検索バー＋カメラ（機能はダッシュボードと同じ。中央配置） */}
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
      {onSearchChange && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', maxWidth: 620 }}>
          <TextField
            fullWidth
            size="small"
            value={searchQuery ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchSubmit?.(); } }}
            placeholder="Search models..."
            InputProps={{ startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--slate-ink-rgb) / 0.8)', mr: 1 }} /> }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgb(var(--slate-panel-rgb) / 0.55)', color: 'var(--brand-fg)', borderRadius: 999 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--slate-ink-rgb) / 0.25)' }, '& input': { fontSize: 13, py: 0.85 } }}
          />
          <Tooltip title={canImageSearch ? 'この3Dモデルを画像検索（実在する商品を探す）' : 'モデルを表示中のみ'} arrow>
            <span>
              <IconButton
                size="small"
                disabled={!canImageSearch || imgSearchBusy}
                onClick={(e) => onCameraClick?.(e.currentTarget)}
                sx={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)', background: 'rgb(var(--slate-panel-rgb) / 0.62)', color: canImageSearch ? 'light-dark(#0352aa, #93c5fd)' : 'rgb(var(--slate-ink-rgb) / 0.5)', flexShrink: 0, '&:hover': { background: 'rgba(96,165,250,0.18)', borderColor: 'rgba(96,165,250,0.6)' } }}
              >
                {imgSearchBusy ? <CircularProgress size={18} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </Box>

    {/* 前/次のモデルナビ（クリック or ←/→キー） */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 1, maxWidth: '24%', minWidth: 0 }}>
      {prevModel && (
        <Box
          onClick={() => onNavigate?.(-1)}
          title="前のモデル（←）"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.5)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: 'var(--brand-fg)' } }}
        >
          <ChevronLeftRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{prevModel.title || prevModel.name || 'Untitled'}</Typography>
        </Box>
      )}
      {nextModel && (
        <Box
          onClick={() => onNavigate?.(1)}
          title="次のモデル（→）"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.5)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: 'var(--brand-fg)' } }}
        >
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{nextModel.title || nextModel.name || 'Untitled'}</Typography>
          <ChevronRightRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
        </Box>
      )}
    </Box>
  </>
);

// 検索/カメラ/前後ナビはヘッダー（DssDetailHeader）へ移したため、ここでは受け取らない。
export const DssModelDetailView: React.FC<Props> = ({ model, allItems, onBack, onSelectRelated, usageMap, prevModel, nextModel, onNavigate, detailActions }) => {
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 矢印キー ←/→ で前後のモデルへ。入力欄にフォーカス中は無効。
  useEffect(() => {
    if (!onNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && prevModel) { e.preventDefault(); onNavigate(-1); }
      else if (e.key === 'ArrowRight' && nextModel) { e.preventDefault(); onNavigate(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, prevModel, nextModel]);
  
  // 2D/3D の手動切替は廃止。GLB があれば常に3D、無ければサムネイルで代替する。

  // 前後モデルのGLBを先読みして ←/→ ナビ時の3D表示を即時にする。
  // 表示中モデルのダウンロードを妨げないよう少し遅らせて開始する。
  useEffect(() => {
    if (!prevModel && !nextModel) return;
    const t = setTimeout(() => {
      if (nextModel) prefetchModelGlb(nextModel);
      if (prevModel) prefetchModelGlb(prevModel);
    }, 2000);
    return () => clearTimeout(t);
  }, [prevModel, nextModel]);

  // 寸法線の表示ON/OFF
  const [showDimensions, setShowDimensions] = useState(false);

  // 旧サムネイル（800x450・カメラを引き過ぎ）を3Dビューと同じ見え方に寄せる拡大率。
  // 旧生成はモデル外接球の約1.74倍の距離から撮っていたため、その分だけ拡大して打ち消す。
  const [thumbIsLegacy, setThumbIsLegacy] = useState(true);

  // ── マテリアルタブの3Dプレビューをメインビューアへ集約するための配線 ──
  // DssMaterialPresets が Canvas を持たず、選択状態をメインビューアに反映し、
  // メインビューアでのパーツクリック/スロット列挙を ref 経由でタブ側へ返す。
  const [matPreview, setMatPreview] = useState<MaterialPreviewState | null>(null);
  const matPickRef = useRef<((meshName: string) => void) | null>(null);
  const matSlotsRef = useRef<((slots: EnumeratedSlot[]) => void) | null>(null);
  const handleMaterialPick = useCallback((meshName: string) => { matPickRef.current?.(meshName); }, []);
  const handleMaterialSlots = useCallback((slots: EnumeratedSlot[]) => { matSlotsRef.current?.(slots); }, []);
  // 家具置き換えタブで選択された差し替え先（メインビューアに表示）。null=元モデル。
  const [swapSel, setSwapSel] = useState<{ url: string; dims: any } | null>(null);

  // 素材バリエーション・ギャラリーで選択中のパターン（null=元の見た目）。
  const [galleryVariantId, setGalleryVariantId] = useState<string | null>(null);
  const galleryPreview = useMemo<MaterialPreviewState | null>(() => {
    if (!galleryVariantId) return null;
    const presets = readMaterialPresets(model);
    const variant = readMaterialVariants(model).find((v) => v.id === galleryVariantId);
    if (!variant || presets.length === 0) return null;
    return { presets, selection: expandVariantSelection(presets, variant), highlight: [], pickable: false };
  }, [galleryVariantId, model]);
  const handleGallerySelect = useCallback((variant: MaterialVariant | null) => {
    setGalleryVariantId(variant?.id ?? null);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // パターンのサムネイル生成用：メインビューアの描画を取り出す
  const viewerCaptureRef = useRef<(() => string | null) | null>(null);
  const captureThumb = useCallback(() => viewerCaptureRef.current?.() ?? null, []);

  // 今見えている3Dビューをこのモデルのサムネイルとして保存する。
  // 角度をユーザーが決められるので、一括再生成より狙った絵にしやすい。
  const [thumbSaving, setThumbSaving] = useState(false);
  const [thumbMsg, setThumbMsg] = useState<string | null>(null);
  const handleSaveViewAsThumbnail = useCallback(async () => {
    const canonicalId = getCanonicalModelId(model) || model?.id;
    if (!canonicalId) return;
    setThumbSaving(true);
    setThumbMsg(null);
    try {
      const dataUrl = captureThumb();
      if (!dataUrl) throw new Error('3Dビューの取得に失敗しました');
      const { uploadModelThumbFromView } = await import('../utils/variantThumb');
      const url = await uploadModelThumbFromView(canonicalId, dataUrl);
      if (!url) throw new Error('画像の保存に失敗しました');
      const { WorkspaceItemRepository } = await import('../../workspace/WorkspaceItemRepository');
      await WorkspaceItemRepository.updateGlobalAsset(canonicalId, { thumbnailUrl: url });
      // 画面上のモデルにも反映して、2D表示や一覧へ戻ったときに新しい絵が出るようにする。
      model.thumbnailUrl = url;
      setThumbMsg('サムネイルを更新しました');
    } catch (e: any) {
      console.error('[DssModelDetailView] save view as thumbnail failed', e);
      setThumbMsg(e?.message || 'サムネイルの更新に失敗しました');
    } finally {
      setThumbSaving(false);
    }
  }, [model, captureThumb]);

  const [walkthroughChar, setWalkthroughChar] = useState<any>(model.extendedMetadata?.character || null);
  const [walkthroughGimmicks, setWalkthroughGimmicks] = useState<any[]>(() => normalizeGimmicks(model.extendedMetadata));
  const [walkthroughAnim, setWalkthroughAnim] = useState<any>(model.extendedMetadata?.anim || null);
  const [walkthroughInfo, setWalkthroughInfo] = useState<any>(model.extendedMetadata?.info || null);
  const [isSavingWalkthrough, setIsSavingWalkthrough] = useState(false);
  const [walkthroughDirty, setWalkthroughDirty] = useState(false);
  // ページ全体の表示モード（編集 / プレビュー）＋ 設定タブ（マテリアル/ウォークスルー/情報）
  const [walkthroughMode, setWalkthroughMode] = useState<'edit' | 'preview'>('edit');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');


  // 変更は自動保存する（設計原則 State Synchronization）。連続操作をまとめるため少し待つ。
  useEffect(() => {
    if (!walkthroughDirty || isSavingWalkthrough) return;
    const t = setTimeout(() => { saveWalkthroughSettings(); }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkthroughDirty, isSavingWalkthrough]);
  const saveWalkthroughSettings = async () => {
    setIsSavingWalkthrough(true);
    try {
      const { db } = await import('../../../lib/firebase/client');
      const { doc, updateDoc } = await import('firebase/firestore');
      const canonicalId = getCanonicalModelId(model) || model.id;
      // 情報リンクの空行を保存時に除去
      const cleanedInfo = walkthroughInfo
        ? {
            description: walkthroughInfo.description || '',
            links: Array.isArray(walkthroughInfo.links)
              ? walkthroughInfo.links.filter((l: any) => l && (l.title || l.url))
              : [],
          }
        : null;
      const cleanedInfoFinal = cleanedInfo && (cleanedInfo.description.trim() || cleanedInfo.links.length) ? cleanedInfo : null;
      await updateDoc(doc(db, 'assets', canonicalId), {
        extendedMetadata: {
          ...(model.extendedMetadata || {}),
          character: walkthroughChar || null,
          gimmicks: walkthroughGimmicks || [],
          gimmick: (walkthroughGimmicks && walkthroughGimmicks[0]) || null, // 後方互換
          anim: walkthroughAnim || null,
          info: cleanedInfoFinal,
        },
      });
      setWalkthroughDirty(false);
    } catch (e) {
      console.error('[WalkthroughSettings] save failed', e);
    } finally {
      setIsSavingWalkthrough(false);
    }
  };

  const activeProjectId = useAppStore((s) => s.activeProjectId);

  // 作成者判定（編集UI vs 閲覧UIの分岐）
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthor = !!currentUser && (
    model?.authorId === currentUser.uid ||
    model?.ownerId === currentUser.uid ||
    model?.createdBy === currentUser.uid
  );

  // 表示するタブ。作成者には常に4つ、閲覧者には中身のあるタブだけを出す（空タブを見せない）。
  // isAuthor を参照するため、必ずその宣言より後に置くこと（useMemo は描画中に実行されるため）。
  const visibleTabs = useMemo<DetailTab[]>(() => {
    if (isAuthor) return ['overview', 'material', 'swap', 'walkthrough'];
    const tabs: DetailTab[] = ['overview'];
    const hasMaterial = readMaterialVariants(model).length > 0 || readMaterialPresets(model).length > 0;
    if (hasMaterial) tabs.push('material');
    if ((model.extendedMetadata?.swapModels?.length ?? 0) > 0) tabs.push('swap');
    const hasAnim = normalizeGimmicks(model.extendedMetadata).length > 0 || !!model.extendedMetadata?.anim;
    if (hasAnim) tabs.push('walkthrough');
    return tabs;
  }, [isAuthor, model]);

  // 表示できないタブが選ばれた状態（モデル切替直後など）は概要へ戻す
  useEffect(() => {
    if (!visibleTabs.includes(detailTab)) setDetailTab('overview');
  }, [visibleTabs, detailTab]);

  // Model Info パネルで編集中の寸法があれば即時反映、なければ保存済み寸法を使う
  const liveDims = useDssLiveDimensionsStore(s => s.liveDimensions[model.id]);
  const targetDimensions = useMemo(() => {
    const src = liveDims || model.dimensions;
    if (!src) return null;
    return {
      width: Number(src.width) || 0,
      depth: Number(src.depth) || 0,
      height: Number(src.height) || 0,
    };
  }, [liveDims, model.dimensions]);

  const relatedModels = useMemo(() => {
    if (!allItems) return [];
    return allItems
      .filter(item => item.id !== model.id && (item.category === model.category || item.ownerId === model.ownerId))
      .slice(0, 10);
  }, [allItems, model]);

  const title = model.title || model.name || 'Untitled';
  const thumbnailUrl = model.thumbnailUrl || model.thumbnail || '';

  // サムネイルが差し替わったら、いったん旧方式とみなして onLoad で判定し直す。
  // （この useEffect は thumbnailUrl の宣言より後に置くこと。前に置くと TDZ になる）
  useEffect(() => { setThumbIsLegacy(true); }, [thumbnailUrl]);

  // カタログ登録のサムネ補完: 保存済み thumbnail が無いものは、ローカルの S.Library
  // カタログ索引（cropDataUrl）から商品URLをキーに引く（ダイアログと同じ画像を表示）。
  const [catalogThumbMap, setCatalogThumbMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const cl = Array.isArray(model.catalogLinks) ? model.catalogLinks : [];
    if (cl.length === 0 || !cl.some((l: any) => l && l.url && !l.thumbnail)) return;
    let mounted = true;
    import('../../dsk/catalog/catalogVisionStore')
      .then(async (mod) => {
        try {
          const items = await mod.getAllItems();
          if (!mounted) return;
          const map: Record<string, string> = {};
          for (const it of items) { if (it.productUrl && it.cropDataUrl) map[it.productUrl] = it.cropDataUrl; }
          setCatalogThumbMap(map);
        } catch { /* noop */ }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [model.catalogLinks]);

  return (
    <Box ref={scrollContainerRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Main Content Area（高さ固定：ビューアを広く、右パネルは固定高さで内部スクロール） */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', flexShrink: 0, p: 2, gap: 2, alignItems: 'stretch', height: { xs: 'auto', md: '80vh' } }}>

        {/* Left Side: Media Viewer（全タブの3Dはこの1枚に集約） */}
        <Box sx={{ flex: '1 1 520px', minWidth: 280, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <Box sx={{
            width: '100%',
            flex: 1,
            minHeight: 0,
            bgcolor: 'var(--brand-bg)',
            borderRadius: '12px', 
            position: 'relative', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* 寸法表示トグル（アニメーションタブでは対象外なので隠す） */}
            {glbUrl && detailTab !== 'walkthrough' && (
              <Paper
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgb(var(--brand-fg-rgb) / 0.9)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  zIndex: 10
                }}
              >
                <Button
                  variant={showDimensions ? 'contained' : 'text'}
                  size="small"
                  startIcon={<StraightenIcon fontSize="small" />}
                  onClick={() => setShowDimensions(v => !v)}
                  sx={{
                    textTransform: 'none',
                    color: showDimensions ? 'var(--brand-fg)' : '#000',
                    bgcolor: showDimensions ? 'var(--brand-bg)' : 'transparent',
                    borderRadius: 0,
                    px: 2,
                    '&:hover': { bgcolor: showDimensions ? '#333' : 'light-dark(rgba(15,23,42,0.02), rgba(0,0,0,0.05))' }
                  }}
                >
                  寸法
                </Button>
              </Paper>
            )}

            {/* 常に3D表示。GLBが無いモデルだけサムネイルで代替する（2D/3Dの手動切替は廃止）。
                3Dの読み込み中はサムネイルをつなぎとして出すのでビューアが空白にならない。 */}
            {glbUrl ? (
              <ErrorBoundary>
                 {detailTab === 'walkthrough' ? (
                   /* アニメーションタブ：実績あるウォークスルービューアをメイン枠いっぱいに表示 */
                   <DssWalkthroughViewer
                     fill
                     glbUrl={glbUrl}
                     gimmicks={isAuthor ? walkthroughGimmicks : normalizeGimmicks(model.extendedMetadata)}
                     anim={isAuthor ? walkthroughAnim : (model.extendedMetadata?.anim || null)}
                     info={isAuthor ? walkthroughInfo : (model.extendedMetadata?.info || null)}
                     swapModels={model.extendedMetadata?.swapModels || null}
                   />
                 ) : (
                   <RightPanelModelViewer
                     modelUrl={detailTab === 'swap' && swapSel ? swapSel.url : (glbUrl as string)}
                     targetDimensions={detailTab === 'swap' && swapSel ? swapSel.dims : targetDimensions}
                     showDimensions={showDimensions}
                     materialPreview={detailTab === 'material' ? matPreview : galleryPreview}
                     onMaterialPick={handleMaterialPick}
                     onMaterialSlots={handleMaterialSlots}
                     captureRef={viewerCaptureRef}
                     placeholderImageUrl={thumbnailUrl || undefined}
                   />
                 )}
              </ErrorBoundary>
            ) : thumbnailUrl ? (
              <Box
                component="img"
                src={thumbnailUrl}
                alt={title}
                onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  const el = e.currentTarget;
                  // 正方形＝新方式（適正フレーミング済み）。16:9＝旧方式で被写体が小さく写っている。
                  setThumbIsLegacy(Math.abs(el.naturalWidth / el.naturalHeight - 1) > 0.1);
                }}
                sx={{
                  width: '100%', height: '100%', objectFit: 'contain',
                  transform: thumbIsLegacy ? 'scale(1.75)' : 'none',
                  transformOrigin: 'center center',
                }}
              />
            ) : (
              <Typography color="text.secondary">プレビューがありません</Typography>
            )}
          </Box>
          
          {/* Bottom Thumbnails */}
          <Box sx={{ height: 60, display: 'flex', gap: 1 }}>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                bgcolor: 'var(--brand-bg)', 
                border: '2px solid #3b82f6',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {thumbnailUrl ? (
                <Box 
                   component="img" 
                   src={thumbnailUrl} 
                   sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ImageIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 24 }} />
              )}
            </Box>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: 10,
                flexDirection: 'column'
              }}
            >
               <ImageIcon fontSize="small" sx={{ mb: 0.5 }} />
               ADD
            </Box>
          </Box>
        </Box>

        {/* Right Side: Details Pane（タブUIをここに集約） */}
        <Paper sx={{
          flex: { xs: '1 1 320px', md: '0 0 380px' },
          maxWidth: { xs: '100%', md: 380 },
          minWidth: 300,
          minHeight: 0,
          height: { xs: 'auto', md: '100%' },
          bgcolor: 'rgb(var(--slate-panel-rgb) / 0.4)',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          borderRadius: '12px',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          overflow: 'hidden',
        }}>
           {/* アクションバー（常用操作・タブに依らず常時表示） */}
           <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
             <Button
               variant="contained"
               startIcon={<ExpandMoreIcon />}
               sx={{ flex: 1, minWidth: 0, bgcolor: '#3b82f6', color: 'var(--brand-fg)', textTransform: 'none', fontSize: 12.5, fontWeight: 700, justifyContent: 'space-between', px: 1.5, '&:hover': { bgcolor: '#2563eb' } }}
             >
               Download
             </Button>
             {detailActions && (
               <>
                 <Tooltip title="Rhino へ配置（開いて取り込み）" arrow>
                   <span>
                     <Button size="small" variant="contained" disabled={!detailActions.canRhino || detailActions.dccBusy !== null}
                       startIcon={detailActions.dccBusy === 'rhino' ? <CircularProgress size={13} sx={{ color: 'var(--brand-fg)' }} /> : <AutoAwesomeMotionRoundedIcon sx={{ fontSize: 15 }} />}
                       onClick={detailActions.onRhino}
                       sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 0, px: 1.1, bgcolor: '#0d9488', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#0f766e' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                       Rhino
                     </Button>
                   </span>
                 </Tooltip>
                 <Tooltip title="Blender へ配置（開いて取り込み）" arrow>
                   <span>
                     <Button size="small" variant="contained" disabled={!detailActions.canBlender || detailActions.dccBusy !== null}
                       startIcon={detailActions.dccBusy === 'blender' ? <CircularProgress size={13} sx={{ color: 'var(--brand-fg)' }} /> : <ThreeDRotationRoundedIcon sx={{ fontSize: 15 }} />}
                       onClick={detailActions.onBlender}
                       sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 0, px: 1.1, bgcolor: '#ea7317', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#c2620f' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                       Blender
                     </Button>
                   </span>
                 </Tooltip>
               </>
             )}
             <IconButton size="small" sx={{ border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', color: 'var(--brand-fg)', borderRadius: '8px', flexShrink: 0 }}>
               <BookmarkBorderIcon sx={{ fontSize: 18 }} />
             </IconButton>
             <IconButton size="small" sx={{ border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', color: 'var(--brand-fg)', borderRadius: '8px', flexShrink: 0 }}>
               <FavoriteBorderIcon sx={{ fontSize: 18 }} />
             </IconButton>
             {/* 常設だった「編集/プレビュー」トグルは廃止（作成者は常時編集＋自動保存）。
                 閲覧者にどう見えるかの確認だけを、控えめな切り替えとして残す。 */}
             {isAuthor && (
               <Tooltip title={walkthroughMode === 'preview' ? '編集に戻る' : '閲覧者の見え方を確認'} arrow>
                 <IconButton
                   size="small"
                   onClick={() => setWalkthroughMode(walkthroughMode === 'preview' ? 'edit' : 'preview')}
                   sx={{
                     border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: '8px', flexShrink: 0,
                     color: walkthroughMode === 'preview' ? 'light-dark(#003fad, #9ec1ff)' : 'var(--brand-fg)',
                     bgcolor: walkthroughMode === 'preview' ? 'rgba(79,140,255,0.22)' : 'transparent',
                     borderColor: walkthroughMode === 'preview' ? 'rgba(79,140,255,0.55)' : undefined,
                   }}
                 >
                   <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                 </IconButton>
               </Tooltip>
             )}
           </Box>

           {/* タブ（パネル上部・固定）：下の詳細内容を切り替える */}
           <DssStudioTabs detailTab={detailTab} setDetailTab={setDetailTab} visibleTabs={visibleTabs} />

           {/* タブ内容（この部分だけ内部スクロール。アクションバーとタブは上に固定） */}
           <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 2, pr: 0.5 }}>
           {detailTab === 'overview' && (<>
             {/* レイアウトでの使用状況（Model Info には無い情報なので残す） */}
             {(() => {
               const raw = usageMap?.[model.id];
               if (!raw) return null;
               const totalCount = typeof raw === 'object' ? raw.totalCount : raw;
               const locations: UsageLocation[] = typeof raw === 'object' ? raw.locations : [];
               const layoutCount = locations.length || (totalCount > 0 ? 1 : 0);
               if (!totalCount || totalCount <= 0) return null;
               return (
                 <Box>
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                     <PlaceRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#aa8804, #facc15)' }} />
                     <Typography variant="caption" sx={{ color: 'light-dark(#aa8804, #facc15)', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                       Used in Layouts
                     </Typography>
                     <Chip size="small" label={`${layoutCount} layout${layoutCount !== 1 ? 's' : ''} / ${totalCount} item${totalCount !== 1 ? 's' : ''}`}
                       sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(234,179,8,0.15)', color: 'light-dark(#aa8804, #facc15)', border: '1px solid rgba(234,179,8,0.3)' }} />
                   </Box>
                   {locations.length > 0 && (
                     <List dense disablePadding>
                       {locations.map((loc) => (
                         <ListItem key={loc.optionId} disableGutters sx={{ py: 0.3, alignItems: 'flex-start' }}>
                           <ListItemText
                             primary={<Typography variant="caption" sx={{ color: 'light-dark(rgba(31,41,55,0.8), rgba(226,232,240,0.8))', fontSize: 10.5, lineHeight: 1.4 }}>{loc.pathName}</Typography>}
                             secondary={<Typography variant="caption" sx={{ color: 'light-dark(rgba(172,144,2,0.7), rgba(253,224,71,0.7))', fontSize: 10, fontWeight: 600 }}>{loc.count}個</Typography>}
                           />
                         </ListItem>
                       ))}
                     </List>
                   )}
                   <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.06)', mt: 1 }} />
                 </Box>
               );
             })()}

             {/* 整備アクション（作成者のみ）：情報を充実させる操作 */}
             {detailActions && detailActions.canRegister && (
               <Box>
                 <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 0.75 }}>
                   情報を充実させる
                 </Typography>
                 <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                   <Tooltip title="実在する商品リンク（関連URL）を自動登録" arrow>
                     <Button size="small" variant="contained" startIcon={<ImageSearchRoundedIcon sx={{ fontSize: 15 }} />}
                       onClick={detailActions.onRegisterLinks}
                       sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 600, px: 1, bgcolor: '#2563eb', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#1d4ed8' } }}>
                       関連URL
                     </Button>
                   </Tooltip>
                   <Tooltip title="S.Library カタログの似た商品を自動登録" arrow>
                     <Button size="small" variant="contained" startIcon={<MenuBookRoundedIcon sx={{ fontSize: 15 }} />}
                       onClick={detailActions.onCatalog}
                       sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 600, px: 1, bgcolor: '#16a34a', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#15803d' } }}>
                       カタログ
                     </Button>
                   </Tooltip>
                 </Box>
                 {/* 今見えている3Dビューをそのままサムネイルにする。角度は自分で決められる。 */}
                 <Tooltip
                   title={!glbUrl
                     ? '3Dモデル（GLB）が無いため使えません'
                     : '今の向き・見た目をこのモデルのサムネイルとして保存します'}
                   arrow
                 >
                   <span style={{ display: 'block', width: '100%' }}>
                     <Button
                       fullWidth size="small" variant="outlined"
                       disabled={!glbUrl || thumbSaving}
                       startIcon={thumbSaving
                         ? <CircularProgress size={13} sx={{ color: 'inherit' }} />
                         : <PhotoCameraRoundedIcon sx={{ fontSize: 15 }} />}
                       onClick={handleSaveViewAsThumbnail}
                       sx={{
                         mt: 0.75, textTransform: 'none', fontSize: 11.5, fontWeight: 600,
                         color: 'light-dark(#0352aa, #93c5fd)', borderColor: 'rgba(96,165,250,0.5)',
                         '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
                       }}
                     >
                       {thumbSaving ? '保存中…' : 'この表示をサムネイルにする'}
                     </Button>
                   </span>
                 </Tooltip>
                 {thumbMsg && (
                   <Typography sx={{ mt: 0.5, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{thumbMsg}</Typography>
                 )}
               </Box>
             )}

             {/* モデル情報（旧・最右 Model Info パネル）をここに一本化。
                 仕様/素材/タグ/説明/タイトルはこのパネルが持つため、重複表示は廃止した。 */}
             <DssModelInfoPanel selectedItem={model} hideViewer />
           </>)}
           {/* 概要以外のタブ内容（マテリアル/家具置き換え/アニメーション）— 3Dは左のメインビューアに集約 */}
           <DssDetailStudio
             model={model} isAuthor={isAuthor} projectId={activeProjectId || undefined}
             glbUrl={glbUrl || null} title={title}
             detailTab={detailTab} setDetailTab={setDetailTab}
             walkthroughMode={walkthroughMode} setWalkthroughMode={setWalkthroughMode}
             setMatPreview={setMatPreview} matPickRef={matPickRef} matSlotsRef={matSlotsRef}
             onSelectSwap={setSwapSel}
             walkthroughChar={walkthroughChar} setWalkthroughChar={setWalkthroughChar}
             walkthroughGimmicks={walkthroughGimmicks} setWalkthroughGimmicks={setWalkthroughGimmicks}
             walkthroughAnim={walkthroughAnim} setWalkthroughAnim={setWalkthroughAnim}
             walkthroughInfo={walkthroughInfo} setWalkthroughInfo={setWalkthroughInfo}
             walkthroughDirty={walkthroughDirty} setWalkthroughDirty={setWalkthroughDirty}
             isSavingWalkthrough={isSavingWalkthrough} saveWalkthroughSettings={saveWalkthroughSettings}
             captureThumb={captureThumb}
           />
           </Box>

        </Paper>
      </Box>

      {/* ここから下は初期表示では画面外。スクロールで近づいてから描画する（開いた直後に
          最大70枚のカードを作らないようにするため）。 */}

      {/* 素材バリエーション（同じ家具の素材違い。クリックで上部ビューアへ適用） */}
      <DeferUntilVisible minHeight={120}>
        <DssVariantGallery model={model} onSelect={handleGallerySelect} selectedVariantId={galleryVariantId} />
      </DeferUntilVisible>

      {/* 似ている商品・購入先（カタログ商品 + Web関連リンク を統合表示） */}
      <DeferUntilVisible minHeight={120}>
      {(() => {
        const cl: any[] = Array.isArray(model.catalogLinks) ? model.catalogLinks.filter((l: any) => l && l.url) : [];
        const rl: any[] = Array.isArray(model.relatedLinks)
          ? model.relatedLinks.filter((l: any) => l && l.url)
          : (model.sourceUrl ? [{ title: '関連リンク', url: model.sourceUrl }] : []);
        if (cl.length === 0 && rl.length === 0) return null;
        const openUrl = (raw: string) => {
          let u = raw; if (!/^https?:\/\//.test(u)) u = 'https://' + u;
          import('@tauri-apps/plugin-opener').then((m: any) => (m.openUrl ? m.openUrl(u) : window.open(u, '_blank'))).catch(() => window.open(u, '_blank'));
        };
        const hostOf = (u: string) => { try { return new URL(/^https?:\/\//.test(u) ? u : 'https://' + u).host; } catch { return ''; } };
        return (
          <Box data-section="similar" sx={{ p: 2, mt: 2, display: 'flex', flexDirection: 'column', scrollMarginTop: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <StorefrontRoundedIcon sx={{ fontSize: 20, color: 'light-dark(#149944, #86efac)' }} />
              <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>似ている商品・購入先</Typography>
            </Box>
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.85)', mb: 2 }}>
              S.Library カタログで照合した商品と、画像検索で見つかった関連リンクです。
            </Typography>

            {cl.length > 0 && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'light-dark(#149944, #86efac)', mb: 1 }}>
                  カタログ商品（S.Library 照合）
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: rl.length > 0 ? 3 : 0 }}>
              {cl.map((l: any, i: number) => {
                const thumb = l.thumbnail || catalogThumbMap[l.url] || '';
                return (
                <Box
                  key={i}
                  onClick={() => openUrl(l.url)}
                  sx={{
                    width: 180, flexShrink: 0, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgba(134,239,172,0.25)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgba(134,239,172,0.7)', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumb
                      ? <Box component="img" src={thumb} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <LaunchRoundedIcon sx={{ fontSize: 36, color: 'light-dark(rgba(20,153,68,0.5), rgba(134,239,172,0.5))' }} />}
                    <Box sx={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LaunchRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#149944, #86efac)' }} />
                    </Box>
                  </Box>
                  <Box sx={{ p: 1.25 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)' }} noWrap>{l.title || 'カタログ商品'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mt: 0.25 }}>
                      <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }} noWrap>{l.source || ''}</Typography>
                      {l.price && <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'light-dark(#149944, #86efac)', flexShrink: 0 }}>{l.price}</Typography>}
                    </Box>
                  </Box>
                </Box>
                );
              })}
                </Box>
              </>
            )}

            {rl.length > 0 && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'light-dark(#0474a9, #7dd3fc)', mb: 1 }}>
                  Web検索の関連リンク（Google レンズ）
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {rl.map((l: any, i: number) => (
                    <Box
                      key={i}
                      onClick={() => openUrl(l.url)}
                      sx={{
                        width: 180, flexShrink: 0, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgba(56,189,248,0.25)',
                        transition: 'border-color 0.15s, transform 0.15s',
                        '&:hover': { borderColor: 'rgba(56,189,248,0.7)', transform: 'translateY(-2px)' },
                      }}
                    >
                      <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {l.thumbnail
                          ? <Box component="img" src={l.thumbnail} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <LaunchRoundedIcon sx={{ fontSize: 36, color: 'light-dark(rgba(6,118,168,0.5), rgba(56,189,248,0.5))' }} />}
                        <Box sx={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LaunchRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#0676a8, #38bdf8)' }} />
                        </Box>
                      </Box>
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)' }} noWrap>{l.title || l.url}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'light-dark(rgba(6,118,168,0.85), rgba(56,189,248,0.85))', mt: 0.25 }} noWrap>{l.source || hostOf(l.url)}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        );
      })()}
      </DeferUntilVisible>

      {/* Related Models section */}
      <DeferUntilVisible minHeight={260}>
      {relatedModels.length > 0 && (
        <Box sx={{ p: 2, mt: 2, mb: 4, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>関連モデル / Other related items</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', overflowX: 'auto', pb: 2 }}>
            {relatedModels.map(rm => (
              <Box 
                key={rm.id} 
                sx={{ 
                  width: 180, 
                  flexShrink: 0, 
                }}
              >
                <DssModelCard 
                   model={rm}
                   onClick={() => {
                     scrollContainerRef.current?.scrollTo(0, 0);
                     onSelectRelated?.(rm);
                   }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
      </DeferUntilVisible>

      {/* ── ギャラリー（このリストの他モデル・Drive プレビュー風カードグリッド） ──
          メイングリッドは仮想化だがここは非仮想化のため、表示中モデルを中心に上限件数へ絞る。 */}
      <DeferUntilVisible minHeight={320}>
      {(() => {
        const list = Array.isArray(allItems) ? allItems : [];
        if (list.length <= 1) return null;
        const CAP = 60;
        let shown = list;
        if (list.length > CAP) {
          const idx = list.findIndex((m) => m.id === model.id);
          if (idx < 0) shown = list.slice(0, CAP);
          else {
            const start = Math.max(0, Math.min(idx - Math.floor(CAP / 2), list.length - CAP));
            shown = list.slice(start, start + CAP);
          }
        }
        return (
          <Box sx={{ p: 2, pt: 0, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5, gap: 2 }}>
              <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 16 }}>
                ギャラリー
                <Typography component="span" sx={{ ml: 1, fontSize: 12, fontWeight: 500, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                  このリストのモデル（{list.length}）
                </Typography>
              </Typography>
              {list.length > CAP && (
                <Typography
                  onClick={onBack}
                  sx={{ fontSize: 12, fontWeight: 600, color: 'light-dark(#0352aa, #93c5fd)', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                >
                  グリッドで全 {list.length} 件を見る →
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
              {shown.map((gm) => (
                <Box
                  key={gm.id || gm.entityId}
                  sx={{ borderRadius: '10px', outline: gm.id === model.id ? '2px solid #3b82f6' : 'none', outlineOffset: '2px' }}
                >
                  <DssModelCard
                    model={gm}
                    onClick={() => {
                      if (gm.id === model.id) return;
                      scrollContainerRef.current?.scrollTo(0, 0);
                      onSelectRelated?.(gm);
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })()}
      </DeferUntilVisible>

    </Box>
  );
};
