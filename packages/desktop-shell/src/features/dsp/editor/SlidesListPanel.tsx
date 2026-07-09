import React from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import { useDspStore } from '../store/useDspStore';
import { BRAND } from '../../../styles/theme';
import type { PresentationElement, PresentationPage } from '../types/dsp.types';

const THUMB_W = 196;

const MiniElement: React.FC<{ el: PresentationElement; scale: number }> = ({ el, scale }) => {
  const data = el.data as any;
  if (el.type === 'line') {
    const angle = Math.atan2(el.h * scale, el.w * scale) * (180 / Math.PI);
    return (
      <svg width={1} height={1} style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, overflow: 'visible', pointerEvents: 'none' }}>
        <line x1={0} y1={0} x2={el.w * scale} y2={el.h * scale} stroke={data.stroke || '#86868b'} strokeWidth={Math.max(1, (parseInt(data.strokeWidth || '3')) * scale)} strokeLinecap="round" />
      </svg>
    );
  }
  if (el.type === 'drawing') {
    const scaleVal = scale;
    const scaledPath = data.pathData.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_: string, cmd: string, x: string, y: string) =>
      `${cmd} ${(parseFloat(x) * scaleVal).toFixed(1)} ${(parseFloat(y) * scaleVal).toFixed(1)}`
    );
    return (
      <svg width={1} height={1} style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, overflow: 'visible', pointerEvents: 'none' }}>
        <path d={scaledPath} stroke={data.stroke || '#1d1d1f'} strokeWidth={Math.max(1, data.strokeWidth * scale)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <Box
      sx={{
        position: 'absolute',
        left: el.x * scale,
        top: el.y * scale,
        width: el.w * scale,
        height: el.h * scale,
        overflow: 'hidden',
        backgroundColor:
          data.bgcolor ||
          (el.type === 'shape' ? data.fill : undefined) ||
          (el.type === 'text' ? 'transparent' : 'rgba(0,0,0,0.06)'),
        borderRadius: data.borderRadius ? `calc(${data.borderRadius} * ${scale})` : undefined,
        display: 'flex',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      {el.type === 'text' && (
        <Box
          sx={{
            fontSize: `${Math.max(4, parseInt(data.fontSize || '16') * scale)}px`,
            color: data.color || '#1d1d1f',
            fontWeight: data.fontWeight || 'normal',
            lineHeight: 1.3,
            overflow: 'hidden',
            p: `${(data.padding || 0) * scale}px`,
            width: '100%',
          }}
        >
          {data.text}
        </Box>
      )}
      {el.type === 'image' && data.src && (
        <Box component="img" src={data.src} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {el.type === 'modelCard' && (
        <Box sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.8)', display: 'flex', flexDirection: 'column' }}>
          {data.thumbnailUrl && <Box component="img" src={data.thumbnailUrl} sx={{ flex: 1, objectFit: 'cover' }} />}
        </Box>
      )}
    </Box>
  );
};

const SlideThumbnail: React.FC<{ page: PresentationPage; canvasW: number; canvasH: number }> = ({ page, canvasW, canvasH }) => {
  const scale = THUMB_W / canvasW;
  const thumbH = Math.round(canvasH * scale);
  return (
    <Box sx={{ width: THUMB_W, height: thumbH, position: 'relative', overflow: 'hidden', bgcolor: '#ffffff', flexShrink: 0 }}>
      {page.elements.map(el => (
        <MiniElement key={el.id} el={el} scale={scale} />
      ))}
    </Box>
  );
};

export const SlidesListPanel: React.FC = () => {
  const {
    presentation,
    selectedPageId,
    setSelectedPageId,
    addPage,
    duplicatePage,
    deletePage,
    isSlidesPanelOpen,
    toggleSlidesPanel
  } = useDspStore();

  if (!presentation) return null;

  const canvasW = presentation.canvasSize?.width || 1587;
  const canvasH = presentation.canvasSize?.height || 1122;

  return (
    <Box sx={{
      width: isSlidesPanelOpen ? 240 : 48,
      borderRight: `1px solid ${BRAND.line}`,
      bgcolor: BRAND.panel,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      overflow: 'hidden'
    }}>
      <Box sx={{
        p: isSlidesPanelOpen ? 2 : 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${BRAND.line}`,
        height: 52,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => toggleSlidesPanel()}
            sx={{ color: isSlidesPanelOpen ? '#29b6f6' : 'text.secondary', '&:hover': { color: 'white' }, p: 0.5 }}
          >
            <ViewSidebarRoundedIcon fontSize="small" />
          </IconButton>
          {isSlidesPanelOpen && (
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, lineHeight: 1 }}>Slides</Typography>
          )}
        </Box>
        {isSlidesPanelOpen && (
          <Button size="small" onClick={() => addPage()} sx={{ color: '#29b6f6', fontSize: '0.75rem', p: 0, minWidth: 'auto' }}>
            <AddRoundedIcon fontSize="small" />
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: isSlidesPanelOpen ? 1.5 : 1, display: 'flex', flexDirection: 'column', gap: 2, opacity: isSlidesPanelOpen ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        {presentation.pages.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mt: 4 }}>
            No slides found.
          </Typography>
        )}

        {presentation.pages.map((page, idx) => (
          <Box key={page.id} onClick={() => setSelectedPageId(page.id)} sx={{ cursor: 'pointer' }}>
            <Box sx={{
              borderRadius: 1.5,
              border: selectedPageId === page.id ? '2px solid #29b6f6' : `1px solid ${BRAND.line}`,
              boxShadow: selectedPageId === page.id ? '0 0 8px rgba(41,182,246,0.4)' : 'none',
              overflow: 'hidden',
              mb: 0.5,
              transition: 'all 0.2s',
              '&:hover': { borderColor: '#29b6f6' }
            }}>
              <SlideThumbnail page={page} canvasW={canvasW} canvasH={canvasH} />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
              <Typography variant="caption" color={selectedPageId === page.id ? 'white' : 'text.secondary'} noWrap sx={{ maxWidth: '60%' }}>
                {idx + 1}. {page.name}
              </Typography>
              {selectedPageId === page.id && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'white' } }}>
                    <ContentCopyRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePage(page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
