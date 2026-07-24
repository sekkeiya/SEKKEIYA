import React, { useRef, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import DragHandleRoundedIcon from '@mui/icons-material/DragHandleRounded';
import { useDspStore } from '../store/useDspStore';

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 480;
const DEFAULT_HEIGHT = 140;

/**
 * SpeakerNotesPanel — キャンバス下部に表示するスピーカーノートパネル。
 * ドラッグハンドルで高さを調整可能。
 * 各スライドごとにメモを保存し、プレゼン時に参照できる。
 */
export const SpeakerNotesPanel: React.FC = () => {
  const { presentation, selectedPageId, updatePageNotes } = useDspStore();
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const dragStartRef = useRef<{ y: number; startHeight: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const page = presentation?.pages.find(p => p.id === selectedPageId);
  const notes = page?.notes ?? '';

  // ── Drag-to-resize ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartRef.current = { y: e.clientY, startHeight: panelHeight };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelHeight]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dy = dragStartRef.current.y - e.clientY; // upward = increase height
    const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartRef.current.startHeight + dy));
    setPanelHeight(newH);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  // ── Notes change ───────────────────────────────────────────────────────────
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedPageId) {
      updatePageNotes(selectedPageId, e.target.value);
    }
  };

  if (!presentation) return null;

  const pageIndex = presentation.pages.findIndex(p => p.id === selectedPageId);
  const pageLabel = page ? `スライド ${pageIndex + 1}${page.name ? ` — ${page.name}` : ''} のノート` : 'ノート';

  return (
    <Box
      ref={panelRef}
      sx={{
        flexShrink: 0,
        height: panelHeight,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'light-dark(rgba(255, 255, 255, 0.95), rgba(10, 14, 24, 0.92))',
        borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Drag handle ── */}
      <Box
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerLeave={handleDragEnd}
        sx={{
          flexShrink: 0,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ns-resize',
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
          userSelect: 'none',
          gap: 1,
          '&:hover': { bgcolor: 'rgba(41,182,246,0.06)' },
          transition: 'background 0.15s',
        }}
      >
        <DragHandleRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <NotesRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', userSelect: 'none' }}>
            {pageLabel}
          </Typography>
        </Box>
      </Box>

      {/* ── Notes textarea ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="スライドのメモをここに入力してください。プレゼン中にスピーカーノートとして表示されます。"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'rgb(var(--brand-fg-rgb) / 0.75)',
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: 'inherit',
            padding: '10px 16px',
            boxSizing: 'border-box',
          }}
        />
      </Box>
    </Box>
  );
};
