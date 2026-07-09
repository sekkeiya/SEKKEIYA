import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import StraightenIcon from '@mui/icons-material/Straighten';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { RightPanelModelViewer } from './RightPanelModelViewer';
import { DssMaterialPresets } from './DssMaterialPresets';
import WalkthroughMetadataEditor from './WalkthroughMetadataEditor';
import { DssWalkthroughViewer } from './DssWalkthroughViewer';
import { normalizeGimmicks } from '../../shared/walkthrough/gimmicks';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { ToggleButton, ToggleButtonGroup, Tabs, Tab } from '@mui/material';
import { DssFurnitureSwap } from './DssFurnitureSwap';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDssLiveDimensionsStore } from '../../../store/useDssLiveDimensionsStore';
import { getDownloadUrlForModel, getCanonicalModelId } from '../utils/modelUtils';
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
}

export const DssModelDetailView: React.FC<Props> = ({ model, allItems, onBack, onSelectRelated, usageMap, prevModel, nextModel, onNavigate, searchQuery, onSearchChange, onSearchSubmit, canImageSearch, imgSearchBusy, onCameraClick }) => {
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
  
  // Default to 3D if GLB is available, otherwise 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>(glbUrl ? '3D' : '2D');

  // 寸法線の表示ON/OFF
  const [showDimensions, setShowDimensions] = useState(false);

  const [walkthroughChar, setWalkthroughChar] = useState<any>(model.extendedMetadata?.character || null);
  const [walkthroughGimmicks, setWalkthroughGimmicks] = useState<any[]>(() => normalizeGimmicks(model.extendedMetadata));
  const [walkthroughAnim, setWalkthroughAnim] = useState<any>(model.extendedMetadata?.anim || null);
  const [walkthroughInfo, setWalkthroughInfo] = useState<any>(model.extendedMetadata?.info || null);
  const [isSavingWalkthrough, setIsSavingWalkthrough] = useState(false);
  const [walkthroughDirty, setWalkthroughDirty] = useState(false);
  // ページ全体の表示モード（編集 / プレビュー）＋ 設定タブ（マテリアル/ウォークスルー/情報）
  const [walkthroughMode, setWalkthroughMode] = useState<'edit' | 'preview'>('edit');
  const [detailTab, setDetailTab] = useState<'material' | 'swap' | 'walkthrough' | 'info'>('material');
  // 保存済みのウォークスルー設定（ギミック/アニメ/情報のいずれか）があるか（閲覧者へのセクション表示判定）
  const hasWalkthrough = !!(model.extendedMetadata?.gimmick || (model.extendedMetadata?.gimmicks?.length) || model.extendedMetadata?.anim || model.extendedMetadata?.info);

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
      {/* Top Bar */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{
            bgcolor: 'rgba(15,23,42,0.6)',
            color: '#fff',
            borderRadius: 999,
            textTransform: 'none',
            flexShrink: 0,
            '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' }
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
                InputProps={{ startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(148,163,184,0.8)', mr: 1 }} /> }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(15,23,42,0.55)', color: '#e5e7eb', borderRadius: 999 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.25)' }, '& input': { fontSize: 13, py: 0.85 } }}
              />
              <Tooltip title={canImageSearch ? 'この3Dモデルを画像検索（実在する商品を探す）' : 'モデルを表示中のみ'} arrow>
                <span>
                  <IconButton
                    size="small"
                    disabled={!canImageSearch || imgSearchBusy}
                    onClick={(e) => onCameraClick?.(e.currentTarget)}
                    sx={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgba(148,163,184,0.30)', background: 'rgba(15,23,42,0.62)', color: canImageSearch ? '#93c5fd' : 'rgba(148,163,184,0.5)', flexShrink: 0, '&:hover': { background: 'rgba(96,165,250,0.18)', borderColor: 'rgba(96,165,250,0.6)' } }}
                  >
                    {imgSearchBusy ? <CircularProgress size={18} sx={{ color: '#93c5fd' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: 20 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* 前/次のモデルナビ（クリック or ←/→キー） */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, maxWidth: '34%', minWidth: 0 }}>
          {prevModel && (
            <Box
              onClick={() => onNavigate?.(-1)}
              title="前のモデル（←）"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 180, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: '#fff' } }}
            >
              <ChevronLeftRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{prevModel.title || prevModel.name || 'Untitled'}</Typography>
            </Box>
          )}
          {nextModel && (
            <Box
              onClick={() => onNavigate?.(1)}
              title="次のモデル（→）"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 180, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: '#fff' } }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{nextModel.title || nextModel.name || 'Untitled'}</Typography>
              <ChevronRightRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', flexShrink: 0, p: 2, pt: 0, gap: 2 }}>
        
        {/* Left Side: Media Viewer */}
        <Box sx={{ flex: '1 1 400px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <Box sx={{ 
            width: '100%',
            aspectRatio: '16/9',
            maxHeight: '70vh', 
            bgcolor: '#000', 
            borderRadius: '12px', 
            position: 'relative', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* 2D/3D Toggle Floating Button */}
            <Paper 
              sx={{ 
                position: 'absolute', 
                top: 16, 
                left: 16, 
                display: 'flex', 
                background: 'rgba(255,255,255,0.9)', 
                borderRadius: '8px',
                overflow: 'hidden',
                zIndex: 10
              }}
            >
              <Button
                variant={viewMode === '2D' ? 'contained' : 'text'}
                size="small"
                startIcon={<ImageIcon fontSize="small" />}
                onClick={() => setViewMode('2D')}
                sx={{ 
                  textTransform: 'none', 
                  color: viewMode === '2D' ? '#fff' : '#000',
                  bgcolor: viewMode === '2D' ? '#000' : 'transparent',
                  borderRadius: 0,
                  px: 2,
                  '&:hover': { bgcolor: viewMode === '2D' ? '#333' : 'rgba(0,0,0,0.05)' }
                }}
              >
                2D
              </Button>
              <Button
                variant={viewMode === '3D' ? 'contained' : 'text'}
                size="small"
                startIcon={<ViewInArIcon fontSize="small" />}
                onClick={() => setViewMode('3D')}
                sx={{ 
                  textTransform: 'none', 
                  color: viewMode === '3D' ? '#fff' : '#000',
                  bgcolor: viewMode === '3D' ? '#000' : 'transparent',
                  borderRadius: 0,
                  px: 2,
                  '&:hover': { bgcolor: viewMode === '3D' ? '#333' : 'rgba(0,0,0,0.05)' }
                }}
              >
                3D
              </Button>
            </Paper>

            {/* 寸法表示トグル */}
            {viewMode === '3D' && glbUrl && (
              <Paper
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(255,255,255,0.9)',
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
                    color: showDimensions ? '#fff' : '#000',
                    bgcolor: showDimensions ? '#000' : 'transparent',
                    borderRadius: 0,
                    px: 2,
                    '&:hover': { bgcolor: showDimensions ? '#333' : 'rgba(0,0,0,0.05)' }
                  }}
                >
                  寸法
                </Button>
              </Paper>
            )}

            {viewMode === '2D' ? (
              thumbnailUrl ? (
                 <Box 
                   component="img" 
                   src={thumbnailUrl} 
                   alt={title}
                   sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
              ) : (
                <Typography color="text.secondary">No Image Available</Typography>
              )
            ) : (
              glbUrl ? (
                <ErrorBoundary>
                   <RightPanelModelViewer
                     modelUrl={glbUrl as string}
                     targetDimensions={targetDimensions}
                     showDimensions={showDimensions}
                   />
                </ErrorBoundary>
              ) : (
                <Typography color="text.secondary">No GLB format available for 3D preview.</Typography>
              )
            )}
            
            {/* View trigger placeholder (like in the screenshot "3D VIEWERを読み込む") */}
            {viewMode === '3D' && !glbUrl && (
               <Button 
                 variant="contained" 
                 startIcon={<ViewInArIcon />}
                 sx={{ 
                   position: 'absolute', 
                   bottom: 16, 
                   right: 16, 
                   bgcolor: 'rgba(255,255,255,0.9)', 
                   color: '#000', 
                   borderRadius: 999 
                 }}
               >
                 3D VIEWERを読み込む
               </Button>
            )}
          </Box>
          
          {/* Bottom Thumbnails */}
          <Box sx={{ height: 60, display: 'flex', gap: 1 }}>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                bgcolor: '#000', 
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
                <ImageIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 24 }} />
              )}
            </Box>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                border: '1px dashed rgba(255,255,255,0.2)',
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

        {/* Right Side: Details Pane */}
        <Paper sx={{ 
          flex: '1 1 300px',
          maxWidth: { xs: '100%', md: 320 },
          alignSelf: 'flex-start',
          bgcolor: 'rgba(15,23,42,0.4)', 
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
           <Box>
             <Typography variant="h6" fontWeight="bold" color="#fff" mb={0.5}>
               {title}
             </Typography>
             {(() => {
               const raw = usageMap?.[model.id];
               if (!raw) return null;
               const totalCount = typeof raw === 'object' ? raw.totalCount : raw;
               const locations: UsageLocation[] = typeof raw === 'object' ? raw.locations : [];
               const layoutCount = locations.length || (totalCount > 0 ? 1 : 0);
               if (!totalCount || totalCount <= 0) return null;
               return (
                 <Box sx={{ mt: 1.5 }}>
                   <Divider sx={{ borderColor: 'rgba(234,179,8,0.3)', mb: 1 }} />
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                     <PlaceRoundedIcon sx={{ fontSize: 13, color: '#facc15' }} />
                     <Typography variant="caption" sx={{ color: '#facc15', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                       Used in Layouts
                     </Typography>
                     <Chip
                       size="small"
                       label={`${layoutCount} layout${layoutCount !== 1 ? 's' : ''} / ${totalCount} item${totalCount !== 1 ? 's' : ''}`}
                       sx={{
                         height: 18,
                         fontSize: 10,
                         fontWeight: 700,
                         bgcolor: 'rgba(234,179,8,0.15)',
                         color: '#facc15',
                         border: '1px solid rgba(234,179,8,0.3)',
                       }}
                     />
                   </Box>
                   {locations.length > 0 && (
                     <List dense disablePadding>
                       {locations.map((loc) => (
                         <ListItem key={loc.optionId} disableGutters sx={{ py: 0.3, alignItems: 'flex-start' }}>
                           <ListItemText
                             primary={
                               <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.8)', fontSize: 10.5, lineHeight: 1.4 }}>
                                 {loc.pathName}
                               </Typography>
                             }
                             secondary={
                               <Typography variant="caption" sx={{ color: 'rgba(253,224,71,0.7)', fontSize: 10, fontWeight: 600 }}>
                                 {loc.count}個
                               </Typography>
                             }
                           />
                         </ListItem>
                       ))}
                     </List>
                   )}
                   <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 1 }} />
                 </Box>
               );
             })()}
           </Box>

           <Box sx={{ display: 'flex', gap: 1 }}>
             <Button 
               variant="contained" 
               fullWidth 
               startIcon={<ExpandMoreIcon />} // Note: In the screenshot it's a download icon, but using ExpandMore for dropdown look
               sx={{ 
                 bgcolor: '#3b82f6', 
                 color: '#fff', 
                 textTransform: 'none', 
                 justifyContent: 'space-between',
                 px: 2
               }}
             >
               Download
             </Button>
             <IconButton sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
               <BookmarkBorderIcon />
             </IconButton>
             <IconButton sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
               <FavoriteBorderIcon />
             </IconButton>
           </Box>

           {/* 詳細サマリー: 余白を埋め、要点（仕様・素材・タグ・説明・関連URL）を一望できるようにする。 */}
           {(() => {
             const cat = [model.macroCategory, model.mainCategory, model.subCategory || model.userCategory].filter(Boolean).join(' / ');
             const dm = model.dimensions || {};
             const dim = (dm.width || dm.depth || dm.height) ? `W ${dm.width ?? '—'} × D ${dm.depth ?? '—'} × H ${dm.height ?? '—'} mm` : null;
             const price = model.price ? `¥${Number(model.price).toLocaleString()}` : null;
             const materials: string[] = Array.isArray(model.materials) ? model.materials.filter((m: any) => typeof m === 'string' && m.trim()) : [];
             const tags: string[] = Array.isArray(model.tags) ? model.tags.filter((t: any) => typeof t === 'string' && t.trim()) : [];
             const info = (isAuthor ? walkthroughInfo : model.extendedMetadata?.info) || model.extendedMetadata?.info || null;
             const description: string = (info?.description || '').trim();
             const rl: any[] = Array.isArray(model.relatedLinks)
               ? model.relatedLinks.filter((l: any) => l && l.url)
               : (model.sourceUrl ? [{ title: '関連リンク', url: model.sourceUrl }] : []);
             const cl: any[] = Array.isArray(model.catalogLinks) ? model.catalogLinks.filter((l: any) => l && l.url) : [];
             const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
               <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(148,163,184,0.9)', textTransform: 'uppercase', mb: 0.75 }}>{children}</Typography>
             );
             const specs = [
               ['カテゴリ', cat || '—'],
               ['寸法', dim || '—'],
               ['価格', price || '—'],
             ];
             return (
               <>
                 <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                 <Box>
                   <SectionLabel>仕様</SectionLabel>
                   <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                     {specs.map(([k, v]) => (
                       <Box key={k} sx={{ display: 'flex', gap: 1 }}>
                         <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', width: 56, flexShrink: 0 }}>{k}</Typography>
                         <Typography sx={{ fontSize: 11.5, color: '#e5e7eb', fontWeight: 600, wordBreak: 'break-all' }}>{v}</Typography>
                       </Box>
                     ))}
                   </Box>
                 </Box>

                 {materials.length > 0 && (
                   <Box>
                     <SectionLabel>素材</SectionLabel>
                     <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                       {materials.map((m) => (
                         <Chip key={m} size="small" label={m} sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)' }} />
                       ))}
                     </Box>
                   </Box>
                 )}

                 {tags.length > 0 && (
                   <Box>
                     <SectionLabel>タグ</SectionLabel>
                     <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                       {tags.slice(0, 10).map((t) => (
                         <Chip key={t} size="small" label={t} sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(56,189,248,0.1)', color: 'rgba(186,230,253,0.95)', border: '1px solid rgba(56,189,248,0.25)' }} />
                       ))}
                       {tags.length > 10 && (
                         <Typography sx={{ fontSize: 10.5, color: 'rgba(148,163,184,0.8)', alignSelf: 'center' }}>+{tags.length - 10}</Typography>
                       )}
                     </Box>
                   </Box>
                 )}

                 {description && (
                   <Box>
                     <SectionLabel>説明</SectionLabel>
                     <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{description}</Typography>
                   </Box>
                 )}

                 {(cl.length > 0 || rl.length > 0) && (
                   <Box
                     onClick={() => scrollContainerRef.current?.querySelector('[data-section="similar"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                     sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer', bgcolor: 'rgba(134,239,172,0.08)', border: '1px solid rgba(134,239,172,0.25)', '&:hover': { bgcolor: 'rgba(134,239,172,0.15)' } }}
                   >
                     <StorefrontRoundedIcon sx={{ fontSize: 18, color: '#86efac', flexShrink: 0 }} />
                     <Box sx={{ minWidth: 0, flex: 1 }}>
                       <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>似ている商品・購入先</Typography>
                       <Typography sx={{ fontSize: 10.5, color: 'rgba(148,163,184,0.95)' }}>
                         カタログ {cl.length} 件{rl.length > 0 ? ` ・ 関連リンク ${rl.length} 件` : ''} — 下に一覧
                       </Typography>
                     </Box>
                     <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: '#86efac', flexShrink: 0 }} />
                   </Box>
                 )}
               </>
             );
           })()}

        </Paper>
      </Box>

      {/* 詳細スタジオ：ページ全体の 編集/プレビュー トグル ＋ タブ（マテリアル/ウォークスルー/情報） */}
      <Box sx={{ px: 2, mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Tabs value={detailTab} onChange={(_e, v) => setDetailTab(v)}
            sx={{ minHeight: 38, '& .MuiTab-root': { minHeight: 38, fontSize: 13, fontWeight: 700, textTransform: 'none', color: 'rgba(255,255,255,0.6)' }, '& .Mui-selected': { color: '#fff !important' }, '& .MuiTabs-indicator': { bgcolor: '#4fc3f7' } }}>
            <Tab value="material" icon={<TextureRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="マテリアル" />
            <Tab value="swap" icon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="家具置き換え" />
            <Tab value="walkthrough" icon={<AnimationRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="アニメーション" />
            <Tab value="info" icon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="情報" />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          {isAuthor && (
            <ToggleButtonGroup
              size="small" exclusive value={walkthroughMode}
              onChange={(_e, v) => { if (v) setWalkthroughMode(v); }}
              sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, fontSize: 11, textTransform: 'none', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', '&.Mui-selected': { bgcolor: 'rgba(79,140,255,0.28)', color: '#fff', borderColor: 'rgba(79,140,255,0.55)' } } }}
            >
              <ToggleButton value="edit"><EditRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />編集</ToggleButton>
              <ToggleButton value="preview"><VisibilityRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />プレビュー</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        <Box sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(15,23,42,0.4)' }}>
          {/* === マテリアル（部位ごとの素材＋現在の見た目を保存＝パターン複数保存） === */}
          {detailTab === 'material' && (
            <DssMaterialPresets model={model} isAuthor={isAuthor} projectId={activeProjectId || undefined} mode={walkthroughMode} hideToggle section="both" />
          )}

          {/* === 家具置き換え（同カテゴリの他モデルを登録して差し替え） === */}
          {detailTab === 'swap' && (
            <DssFurnitureSwap model={model} isAuthor={isAuthor} mode={walkthroughMode} />
          )}

          {/* === ウォークスルー === */}
          {detailTab === 'walkthrough' && (
            <Box sx={{ p: 1.5 }}>
              {isAuthor && walkthroughMode === 'edit' ? (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: '1 1 340px', minWidth: 280 }}>
                    <DssWalkthroughViewer glbUrl={glbUrl || null} gimmicks={walkthroughGimmicks} anim={walkthroughAnim} info={walkthroughInfo} swapModels={model.extendedMetadata?.swapModels || null} />
                    {(() => {
                      const gms = Array.isArray(walkthroughGimmicks) ? walkthroughGimmicks : [];
                      const animLabel = walkthroughAnim?.type === 'rotate' ? '常時回転' : walkthroughAnim?.type === 'move' ? '常時往復' : null;
                      const typeJa = (t: string) => t === 'hinge' ? 'ヒンジ' : t === 'slide' ? 'スライド' : t === 'clip' ? 'アニメ' : t;
                      return (
                        <Box sx={{ mt: 1, px: 2 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', mb: 1 }}>アニメーションで表示されるアクション</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {gms.map((g: any) => (
                              <Chip key={g.id} size="small" label={`${g.label || typeJa(g.type)}（${typeJa(g.type)}）`}
                                sx={{ bgcolor: 'rgba(79,140,255,0.18)', color: '#cbeafe', border: '1px solid rgba(79,140,255,0.4)', fontWeight: 700 }} />
                            ))}
                            {gms.length === 0 && (
                              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>アクション未設定（右で追加）</Typography>
                            )}
                          </Box>
                          {animLabel && (
                            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', mt: 1 }}>自動：{animLabel}（ボタン操作なしで動作）</Typography>
                          )}
                          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 1 }}>※ 上の3Dでモデルをクリックすると、これらのボタンが実際に表示されます。</Typography>
                        </Box>
                      );
                    })()}
                  </Box>
                  <Box sx={{ flex: '1 1 300px', minWidth: 280 }}>
                    <WalkthroughMetadataEditor
                      glbUrl={glbUrl || null}
                      macroCategory={model.macroCategory || model.category}
                      character={walkthroughChar}
                      gimmicks={walkthroughGimmicks}
                      anim={walkthroughAnim}
                      showInfo={false}
                      disabled={false}
                      onChange={({ character, gimmicks, anim }) => {
                        setWalkthroughChar(character);
                        setWalkthroughGimmicks(gimmicks);
                        setWalkthroughAnim(anim);
                        setWalkthroughDirty(true);
                      }}
                    />
                    {walkthroughDirty && (
                      <Button size="small" startIcon={isSavingWalkthrough ? null : <SaveRoundedIcon />} onClick={saveWalkthroughSettings} disabled={isSavingWalkthrough}
                        sx={{ mt: 1, textTransform: 'none', fontSize: 12, bgcolor: 'rgba(79,140,255,0.2)', color: '#9ec1ff', border: '1px solid rgba(79,140,255,0.4)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(79,140,255,0.3)' } }}>
                        {isSavingWalkthrough ? '保存中…' : '保存'}
                      </Button>
                    )}
                  </Box>
                </Box>
              ) : (
                <DssWalkthroughViewer
                  glbUrl={glbUrl || null}
                  gimmicks={isAuthor ? walkthroughGimmicks : normalizeGimmicks(model.extendedMetadata)}
                  anim={isAuthor ? walkthroughAnim : (model.extendedMetadata?.anim || null)}
                  info={isAuthor ? walkthroughInfo : (model.extendedMetadata?.info || null)}
                  swapModels={model.extendedMetadata?.swapModels || null}
                />
              )}
            </Box>
          )}

          {/* === 情報（作成者のみ編集可） === */}
          {detailTab === 'info' && (
            <Box sx={{ p: 2 }}>
              {/* 基本情報のまとめ（右サイドバーの内容を集約・読み取り専用） */}
              {(() => {
                const cat = [model.macroCategory, model.mainCategory, model.subCategory || model.userCategory].filter(Boolean).join(' / ');
                const dm = model.dimensions || {};
                const dim = (dm.width || dm.depth || dm.height) ? `W ${dm.width ?? '—'} × D ${dm.depth ?? '—'} × H ${dm.height ?? '—'} mm` : '—';
                const price = model.price ? `¥${Number(model.price).toLocaleString()}` : '—';
                const rows = [
                  ['タイトル', title],
                  ['カテゴリ', cat || '—'],
                  ['寸法', dim],
                  ['価格', price],
                ];
                return (
                  <Box sx={{ mb: 2, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    {rows.map(([k, v], i) => (
                      <Box key={k} sx={{ display: 'flex', px: 1.5, py: 0.9, bgcolor: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', width: 88, flexShrink: 0 }}>{k}</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#fff', fontWeight: 600, wordBreak: 'break-all' }}>{v}</Typography>
                      </Box>
                    ))}
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', px: 1.5, py: 0.75 }}>
                      ※ タイトル・カテゴリ・寸法・価格は右の Model Info パネルで編集します。
                    </Typography>
                  </Box>
                );
              })()}

              {/* 関連URL/カタログの一覧はページ下部の「似ている商品・購入先」セクションに集約。
                  ここ（情報タブ）はアイテム情報＝ウォークスルー用の説明/リンク編集に専念する。 */}

              {isAuthor && walkthroughMode === 'edit' ? (
                <>
                  <WalkthroughMetadataEditor
                    glbUrl={glbUrl || null}
                    macroCategory={model.macroCategory || model.category}
                    info={walkthroughInfo}
                    infoOnly
                    onChange={({ info }) => { setWalkthroughInfo(info); setWalkthroughDirty(true); }}
                  />
                  {walkthroughDirty && (
                    <Button size="small" startIcon={isSavingWalkthrough ? null : <SaveRoundedIcon />} onClick={saveWalkthroughSettings} disabled={isSavingWalkthrough}
                      sx={{ mt: 1, textTransform: 'none', fontSize: 12, bgcolor: 'rgba(79,140,255,0.2)', color: '#9ec1ff', border: '1px solid rgba(79,140,255,0.4)', borderRadius: 1, '&:hover': { bgcolor: 'rgba(79,140,255,0.3)' } }}>
                      {isSavingWalkthrough ? '保存中…' : '保存'}
                    </Button>
                  )}
                </>
              ) : (
                (() => {
                  const info = isAuthor ? walkthroughInfo : (model.extendedMetadata?.info || null);
                  const links = Array.isArray(info?.links) ? info.links.filter((l: any) => l && l.url) : [];
                  const hasInfo = !!(info && ((info.description && info.description.trim()) || links.length));
                  if (!hasInfo) return <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>情報は未設定です。</Typography>;
                  const openUrl = (raw: string) => {
                    let u = raw; if (!/^https?:\/\//.test(u)) u = 'https://' + u;
                    import('@tauri-apps/plugin-opener').then((m: any) => (m.openUrl ? m.openUrl(u) : window.open(u, '_blank'))).catch(() => window.open(u, '_blank'));
                  };
                  return (
                    <Box>
                      {info.description && (
                        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', mb: 1.5 }}>{info.description}</Typography>
                      )}
                      {links.map((l: any, i: number) => (
                        <Box key={i} onClick={() => openUrl(l.url)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, mb: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', '&:hover': { bgcolor: 'rgba(56,189,248,0.2)' } }}>
                          <LaunchRoundedIcon sx={{ color: '#38bdf8', fontSize: 16 }} />
                          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff', flex: 1 }} noWrap>{l.title || l.url}</Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                })()
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* 似ている商品・購入先（カタログ商品 + Web関連リンク を統合表示） */}
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
              <StorefrontRoundedIcon sx={{ fontSize: 20, color: '#86efac' }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>似ている商品・購入先</Typography>
            </Box>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(148,163,184,0.85)', mb: 2 }}>
              S.Library カタログで照合した商品と、画像検索で見つかった関連リンクです。
            </Typography>

            {cl.length > 0 && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#86efac', mb: 1 }}>
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
                    bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(134,239,172,0.25)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgba(134,239,172,0.7)', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumb
                      ? <Box component="img" src={thumb} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <LaunchRoundedIcon sx={{ fontSize: 36, color: 'rgba(134,239,172,0.5)' }} />}
                    <Box sx={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LaunchRoundedIcon sx={{ fontSize: 14, color: '#86efac' }} />
                    </Box>
                  </Box>
                  <Box sx={{ p: 1.25 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }} noWrap>{l.title || 'カタログ商品'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mt: 0.25 }}>
                      <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.9)' }} noWrap>{l.source || ''}</Typography>
                      {l.price && <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#86efac', flexShrink: 0 }}>{l.price}</Typography>}
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
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#7dd3fc', mb: 1 }}>
                  Web検索の関連リンク（Google レンズ）
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {rl.map((l: any, i: number) => (
                    <Box
                      key={i}
                      onClick={() => openUrl(l.url)}
                      sx={{
                        width: 180, flexShrink: 0, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                        bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,189,248,0.25)',
                        transition: 'border-color 0.15s, transform 0.15s',
                        '&:hover': { borderColor: 'rgba(56,189,248,0.7)', transform: 'translateY(-2px)' },
                      }}
                    >
                      <Box sx={{ position: 'relative', aspectRatio: '1/1', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {l.thumbnail
                          ? <Box component="img" src={l.thumbnail} alt={l.title} referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <LaunchRoundedIcon sx={{ fontSize: 36, color: 'rgba(56,189,248,0.5)' }} />}
                        <Box sx={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LaunchRoundedIcon sx={{ fontSize: 14, color: '#38bdf8' }} />
                        </Box>
                      </Box>
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }} noWrap>{l.title || l.url}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(56,189,248,0.85)', mt: 0.25 }} noWrap>{l.source || hostOf(l.url)}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        );
      })()}

      {/* Related Models section */}
      {relatedModels.length > 0 && (
        <Box sx={{ p: 2, mt: 2, mb: 4, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2, fontWeight: 700 }}>関連モデル / Other related items</Typography>
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

    </Box>
  );
};
