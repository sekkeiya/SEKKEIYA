import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';

import { useDspStore } from '../store/useDspStore';
import { BRAND } from '../../../styles/theme';
import type { PresentationElement, PresentationPage } from '../types/dsp.types';

const ACCENT = '#29b6f6';
const PANEL_W = 236;

type TabKey = 'slides' | 'outline';

// ─── Mini slide thumbnail ─────────────────────────────────────────────────────

const THUMB_W = 196;

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
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'var(--brand-fg)' } }}>
                  <ContentCopyRoundedIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); if (presentation.pages.length > 1) deletePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
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

// ─── Tab label map ────────────────────────────────────────────────────────────

const TAB_LABELS: Record<TabKey, string> = {
  slides:  'スライド',
  outline: 'アウトライン',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DspLeftPanel: React.FC = () => {
  const {
    presentation,
    isSlidesPanelOpen,
    setSlidesPanelOpen,
    leftPanelActiveTab,
  } = useDspStore();

  const canvasW = presentation?.canvasSize?.width || 1587;
  const canvasH = presentation?.canvasSize?.height || 1122;

  return (
    <Box
      sx={{
        width: isSlidesPanelOpen ? PANEL_W : 0,
        flexShrink: 0,
        borderRight: isSlidesPanelOpen ? `1px solid ${BRAND.line}` : 'none',
        bgcolor: BRAND.panel,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* ── Panel header ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          borderBottom: `1px solid ${BRAND.line}`,
        }}
      >
        <Typography
          sx={{
            color: 'rgb(var(--brand-fg-rgb) / 0.6)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {TAB_LABELS[leftPanelActiveTab]}
        </Typography>

        {/* パネル内から折りたたむボタン */}
        <Tooltip title="パネルを閉じる" placement="right">
          <IconButton
            size="small"
            onClick={() => setSlidesPanelOpen(false)}
            sx={{
              p: 0.5,
              color: 'rgb(var(--brand-fg-rgb) / 0.25)',
              '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.7)' },
            }}
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Panel content ───────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {leftPanelActiveTab === 'slides'  && <SlidesTab  canvasW={canvasW} canvasH={canvasH} />}
        {leftPanelActiveTab === 'outline' && <OutlineTab />}
      </Box>
    </Box>
  );
};
