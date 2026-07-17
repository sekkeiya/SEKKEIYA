import React, { useState, useMemo } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';

import { useDspStore } from '../../store/useDspStore';
import { resolveAssetPreviewUrl } from '../../../../store/useAIDriveStore';
import { useDriveAssets, PICKER_LAYERS } from '../../../drive/driveAccess';
import { BRAND } from '../../../../styles/theme';
import type { PresentationElement, PresentationPage } from '../../types/dsp.types';

const ACCENT = '#29b6f6';
const THUMB_W = 196;

// ─── Thumbnail helpers ────────────────────────────────────────────────────────

const MiniElement: React.FC<{ el: PresentationElement; scale: number }> = ({ el, scale }) => {
  const data = el.data as any;
  if (el.type === 'line') {
    return (
      <svg width={1} height={1} style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, overflow: 'visible', pointerEvents: 'none' }}>
        <line x1={0} y1={0} x2={el.w * scale} y2={el.h * scale} stroke={data.stroke || '#86868b'} strokeWidth={Math.max(1, parseInt(data.strokeWidth || '3') * scale)} strokeLinecap="round" />
      </svg>
    );
  }
  if (el.type === 'drawing') {
    const sp = data.pathData.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_: string, cmd: string, x: string, y: string) =>
      `${cmd} ${(parseFloat(x) * scale).toFixed(1)} ${(parseFloat(y) * scale).toFixed(1)}`
    );
    return (
      <svg width={1} height={1} style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, overflow: 'visible', pointerEvents: 'none' }}>
        <path d={sp} stroke={data.stroke || '#1d1d1f'} strokeWidth={Math.max(1, data.strokeWidth * scale)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <Box sx={{ position: 'absolute', left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale, overflow: 'hidden', backgroundColor: data.bgcolor || (el.type === 'shape' ? data.fill : 'transparent'), borderRadius: data.borderRadius ? `calc(${data.borderRadius} * ${scale})` : 0, display: 'flex', alignItems: 'flex-start', pointerEvents: 'none' }}>
      {el.type === 'text' && <Box sx={{ fontSize: `${Math.max(4, parseInt(data.fontSize || '16') * scale)}px`, color: data.color || '#1d1d1f', fontWeight: data.fontWeight || 'normal', overflow: 'hidden', p: `${(data.padding || 0) * scale}px`, width: '100%', lineHeight: 1.3 }}>{data.text}</Box>}
      {el.type === 'image' && data.src && <Box component="img" src={data.src} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      {el.type === 'modelCard' && data.thumbnailUrl && <Box component="img" src={data.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </Box>
  );
};

const SlideThumbnail: React.FC<{ page: PresentationPage; canvasW: number; canvasH: number }> = ({ page, canvasW, canvasH }) => {
  const scale = THUMB_W / canvasW;
  const thumbH = Math.round(canvasH * scale);
  return (
    <Box sx={{ width: THUMB_W, height: thumbH, position: 'relative', overflow: 'hidden', bgcolor: '#ffffff', flexShrink: 0 }}>
      {page.elements.map(el => <MiniElement key={el.id} el={el} scale={scale} />)}
    </Box>
  );
};

// ─── Slides Tab ───────────────────────────────────────────────────────────────

const SlidesTab: React.FC<{ canvasW: number; canvasH: number }> = ({ canvasW, canvasH }) => {
  const { presentation, selectedPageId, setSelectedPageId, addPage, duplicatePage, deletePage } = useDspStore();
  if (!presentation) return null;

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {presentation.pages.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mt: 4 }}>スライドがありません</Typography>
      )}
      {presentation.pages.map((page, idx) => (
        <Box key={page.id} onClick={() => setSelectedPageId(page.id)} sx={{ cursor: 'pointer' }}>
          <Box sx={{ borderRadius: 1.5, border: selectedPageId === page.id ? `2px solid ${ACCENT}` : `1px solid ${BRAND.line}`, boxShadow: selectedPageId === page.id ? `0 0 8px rgba(41,182,246,0.4)` : 'none', overflow: 'hidden', mb: 0.5, transition: 'all 0.2s', '&:hover': { borderColor: ACCENT } }}>
            <SlideThumbnail page={page} canvasW={canvasW} canvasH={canvasH} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
            <Typography variant="caption" color={selectedPageId === page.id ? 'white' : 'text.secondary'} noWrap sx={{ maxWidth: '60%' }}>
              {idx + 1}. {page.name}
            </Typography>
            {selectedPageId === page.id && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="複製">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'var(--brand-fg)' } }}>
                    <ContentCopyRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="削除">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); if (presentation.pages.length > 1) deletePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Box>
      ))}
      <Box
        onClick={() => addPage()}
        sx={{ borderRadius: 1.5, border: `1px dashed rgb(var(--brand-fg-rgb) / 0.15)`, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 1, color: 'text.secondary', '&:hover': { borderColor: ACCENT, color: ACCENT }, transition: 'all 0.15s' }}
      >
        <AddRoundedIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>スライドを追加</Typography>
      </Box>
    </Box>
  );
};

// ─── Assets Tab ───────────────────────────────────────────────────────────────

const AssetCard: React.FC<{ asset: any; onAdd: () => void; isModel?: boolean }> = ({ asset, onAdd, isModel }) => {
  const url = resolveAssetPreviewUrl(asset) || '';
  const [hover, setHover] = useState(false);
  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${BRAND.line}`, bgcolor: 'var(--brand-surface)', cursor: 'pointer', '&:hover': { borderColor: ACCENT } }}
    >
      <Box sx={{ height: 72, bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {url
          ? <Box component="img" src={url} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Box sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 28 }}>{isModel ? '🧊' : '🖼'}</Box>
        }
      </Box>
      <Box sx={{ p: 0.75 }}>
        <Typography sx={{ color: 'var(--brand-fg)', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.name || asset.title || 'Untitled'}
        </Typography>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10 }}>
          {isModel ? (asset.toolType || 'model') : 'image'}
        </Typography>
      </Box>
      {hover && (
        <Box
          onClick={onAdd}
          sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(41,182,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
        >
          <Box sx={{ bgcolor: ACCENT, borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(41,182,246,0.5)' }}>
            <AddRoundedIcon sx={{ color: '#000', fontSize: 18 }} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

const AssetsTab: React.FC = () => {
  const { projectId, selectedPageId, addElement, presentation } = useDspStore();
  // SEKKEIYA Drive の資産（driveAccess = 決定的プール・単一の読み取り窓口）。
  const { assets: allAssets } = useDriveAssets({ layers: PICKER_LAYERS });
  const [search, setSearch] = useState('');

  const cW = presentation?.canvasSize?.width || 1587;
  const cH = presentation?.canvasSize?.height || 1122;

  const images = useMemo(() => allAssets.filter(a =>
    (!projectId || (a as any).projectId === projectId || !(a as any).projectId) &&
    !(a as any).isDeleted &&
    ((a as any).itemType === 'image' || (a as any).category === 'image' || a.type === 'image' || (a.name || '').match(/\.(png|jpg|jpeg|gif|webp|svg)/i))
  ), [allAssets, projectId]);

  const models = useMemo(() => allAssets.filter(a =>
    (!projectId || (a as any).projectId === projectId || !(a as any).projectId) &&
    !(a as any).isDeleted &&
    ((a as any).itemType === 'model' || (a as any).category === 'model' || (a as any).toolType || a.type === 'model' || (a as any).appScope)
  ), [allAssets, projectId]);

  const filteredImages = useMemo(() => {
    if (!search) return images;
    const q = search.toLowerCase();
    return images.filter(a => (a.name || '').toLowerCase().includes(q));
  }, [images, search]);

  const filteredModels = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter(a => (a.name || (a as any).title || '').toLowerCase().includes(q));
  }, [models, search]);

  const handleAddImage = (asset: any) => {
    if (!selectedPageId) return;
    const url = resolveAssetPreviewUrl(asset) || '';
    addElement(selectedPageId, { type: 'image', x: cW * 0.1, y: cH * 0.1, w: 400, h: 300, zIndex: 10, rotation: 0, opacity: 100, data: { src: url, alt: asset.name || '', assetId: asset.id, name: asset.name || '' } });
  };

  const handleAddModel = (asset: any) => {
    if (!selectedPageId) return;
    const url = resolveAssetPreviewUrl(asset) || '';
    addElement(selectedPageId, { type: 'modelCard', x: cW * 0.1, y: cH * 0.1, w: 280, h: 280, zIndex: 10, rotation: 0, opacity: 100, data: { title: asset.name || (asset as any).title || 'Model', subtitle: (asset as any).toolType || '', thumbnailUrl: url } });
  };

  const isEmpty = images.length === 0 && models.length === 0;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', borderRadius: 1.5, px: 1.5, height: 32, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', '&:focus-within': { borderColor: ACCENT } }}>
          <input
            type="text"
            placeholder="素材を検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--brand-fg)', fontSize: 12, fontFamily: 'inherit' }}
          />
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
        {isEmpty && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <AddPhotoAlternateRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.15)', mb: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
              SEKKEIYA Drive に画像や3Dモデルを<br />追加するとここに表示されます
            </Typography>
          </Box>
        )}
        {filteredImages.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ImageRoundedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.6rem', fontWeight: 700 }}>
                画像 ({filteredImages.length})
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {filteredImages.map(a => <AssetCard key={a.id} asset={a} onAdd={() => handleAddImage(a)} />)}
            </Box>
          </Box>
        )}
        {filteredModels.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ViewInArIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.6rem', fontWeight: 700 }}>
                3Dモデル ({filteredModels.length})
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {filteredModels.map(a => <AssetCard key={a.id} asset={a} onAdd={() => handleAddModel(a)} isModel />)}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Outline Tab ──────────────────────────────────────────────────────────────

const OutlineTab: React.FC = () => {
  const { presentation, selectedPageId, setSelectedPageId } = useDspStore();
  if (!presentation) return null;

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {presentation.pages.map((page, idx) => {
        const textEls = page.elements
          .filter(el => el.type === 'text')
          .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        const titleEl = textEls.find(el => parseInt((el.data as any).fontSize || '0') >= 40) || textEls[0];
        const bodyEls = textEls.filter(el => el !== titleEl).slice(0, 2);
        const isActive = selectedPageId === page.id;

        return (
          <Box
            key={page.id}
            onClick={() => setSelectedPageId(page.id)}
            sx={{
              p: 1.5, borderRadius: 1.5, cursor: 'pointer',
              bgcolor: isActive ? 'rgba(41,182,246,0.1)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
              border: `1px solid ${isActive ? ACCENT : 'transparent'}`,
              '&:hover': { bgcolor: isActive ? 'rgba(41,182,246,0.15)' : 'rgb(var(--brand-fg-rgb) / 0.06)' },
              transition: 'all 0.15s',
            }}
          >
            <Typography sx={{ color: isActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, mb: 0.5 }}>
              SLIDE {idx + 1}
            </Typography>
            {titleEl ? (
              <Typography sx={{ color: isActive ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.85)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, mb: 0.5 }}>
                {(titleEl.data as any).text?.split('\n')[0] || '（タイトルなし）'}
              </Typography>
            ) : (
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 12, fontStyle: 'italic' }}>テキストなし</Typography>
            )}
            {bodyEls.map((el, i) => (
              <Typography key={i} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {(el.data as any).text?.split('\n')[0]}
              </Typography>
            ))}
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
              {page.elements.length > 0 && (
                <Box sx={{ px: 1, py: 0.25, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', borderRadius: 4 }}>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10 }}>{page.elements.length}要素</Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_LABELS: Record<'slides' | 'assets' | 'outline', string> = {
  slides:  'スライド',
  assets:  '素材',
  outline: 'アウトライン',
};

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * DspEditorSidebar — MainLayout の左サイドバー枠（240px）に入るエディター専用コンテンツ。
 * ファイルが開かれたとき DspSidebar（プロジェクトブラウザ）と入れ替わる（3DSL の LeftSidebar 相当）。
 * タブ切り替えはキャンバス内のフローティングドック（DspEditorDock）が行う。
 */
export const DspEditorSidebar: React.FC = () => {
  const { presentation, leftPanelActiveTab } = useDspStore();
  const canvasW = presentation?.canvasSize?.width || 1587;
  const canvasH = presentation?.canvasSize?.height || 1122;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg, overflow: 'hidden' }}>
      {/* ── ヘッダー ──────────────────────────────────────────────────── */}
      <Box sx={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', px: 2, borderBottom: `1px solid ${BRAND.line}` }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {TAB_LABELS[leftPanelActiveTab]}
        </Typography>
      </Box>

      {/* ── コンテンツ ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {leftPanelActiveTab === 'slides'  && <SlidesTab  canvasW={canvasW} canvasH={canvasH} />}
        {leftPanelActiveTab === 'assets'  && <AssetsTab />}
        {leftPanelActiveTab === 'outline' && <OutlineTab />}
      </Box>
    </Box>
  );
};
