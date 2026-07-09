import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CropPortraitRoundedIcon from '@mui/icons-material/CropPortraitRounded';
// @ts-ignore — react-pageflip は型同梱だが default export の型が緩いため
import HTMLFlipBook from 'react-pageflip';
import { openPdf, renderPdfPage, type OpenedPdf } from '../../dsf/lib/pdf';
import { readLocalBinaryFile } from '../api/knowledgeApi';
import type { LibraryEntry } from '../types';
import { useDskStore } from '../store/useDskStore';

type ViewMode = 'spread' | 'single';

const ACCENT = '#26a69a';
const RENDER_SCALE = 1.5;
const PRELOAD = 3;
const MAX_CACHE = 24;

interface DskBookViewerProps {
  /** 表示する書籍/PDF エントリ（ローカルの filePath を読み込む） */
  entry: LibraryEntry | null;
  onClose: () => void;
}

const Page = React.forwardRef<HTMLDivElement, { src: string | null; index: number }>(({ src, index }, ref) => (
  <div ref={ref} style={{ background: '#fff', overflow: 'hidden' }}>
    {src ? (
      <img src={src} alt={`page ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
    ) : (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eef3f2' }}>
        <CircularProgress size={26} sx={{ color: ACCENT }} />
      </Box>
    )}
  </div>
));
Page.displayName = 'DskBookPage';

export const DskBookViewer: React.FC<DskBookViewerProps> = ({ entry, onClose }) => {
  const bookRef = useRef<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [aspect, setAspect] = useState(0.707);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<ViewMode>('spread');

  const pdfRef = useRef<OpenedPdf | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const [, setVersion] = useState(0);
  const [dims, setDims] = useState({ w: 420, h: 594 });

  const patch = useDskStore(s => s.patch);

  // ローカル PDF を開く（バイナリ読込 → ArrayBuffer → メタ取得）
  useEffect(() => {
    if (!entry?.filePath) return;
    let active = true;
    setLoading(true);
    setError(null);
    setCurrent(entry.lastReadPage ?? 0);
    setPageCount(0);
    cacheRef.current = new Map();
    pendingRef.current = new Set();
    (async () => {
      try {
        const bytes = await readLocalBinaryFile(entry.filePath as string);
        if (!active) return;
        const buf = new Uint8Array(bytes).buffer;
        const opened = await openPdf(buf);
        if (!active) { opened.task.destroy(); return; }
        pdfRef.current = opened;
        setAspect(opened.aspect || 0.707);
        setPageCount(opened.pageCount);
        setLoading(false);
      } catch (e: any) {
        console.error('[DskBookViewer] open failed', e);
        if (active) { setError(e?.message ?? 'PDF の表示に失敗しました。'); setLoading(false); }
      }
    })();
    return () => {
      active = false;
      pdfRef.current?.task?.destroy?.();
      pdfRef.current = null;
      cacheRef.current = new Map();
      pendingRef.current = new Set();
    };
  }, [entry?.filePath]);

  // 周辺ページの遅延描画 + 遠いページのキャッシュ破棄
  useEffect(() => {
    const opened = pdfRef.current;
    if (!opened || pageCount === 0) return;
    let cancelled = false;
    const lo = Math.max(0, current - PRELOAD);
    const hi = Math.min(pageCount - 1, current + 1 + PRELOAD);

    const evict = () => {
      const cache = cacheRef.current;
      if (cache.size <= MAX_CACHE) return;
      const far = [...cache.keys()]
        .filter((k) => k < lo || k > hi)
        .sort((a, b) => Math.abs(b - current) - Math.abs(a - current));
      for (const k of far) {
        if (cache.size <= MAX_CACHE) break;
        cache.delete(k);
      }
    };

    (async () => {
      const order: number[] = [];
      for (let d = 0; d <= PRELOAD + 1; d++) {
        if (current + d <= hi) order.push(current + d);
        if (d > 0 && current - d >= lo) order.push(current - d);
      }
      for (const i of order) {
        if (cancelled) return;
        const cache = cacheRef.current;
        if (cache.has(i) || pendingRef.current.has(i)) continue;
        pendingRef.current.add(i);
        try {
          const url = await renderPdfPage(opened.pdf, i + 1, RENDER_SCALE);
          if (cancelled) return;
          cache.set(i, url);
          evict();
          setVersion((v) => v + 1);
        } catch (e) {
          console.error('[DskBookViewer] page render failed', i + 1, e);
        } finally {
          pendingRef.current.delete(i);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [current, pageCount]);

  useEffect(() => {
    const recalc = () => {
      const across = mode === 'spread' ? 2 : 1;
      const availH = Math.min(window.innerHeight * 0.8, 900);
      const availW = Math.max(280, window.innerWidth - 160);
      const pageW = Math.min(availH * aspect, availW / across);
      const w = Math.max(200, Math.round(pageW));
      setDims({ w, h: Math.round(w / aspect) });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [aspect, mode]);

  // 閉じる時に読書進捗（lastReadPage / totalPages）を保存
  const handleClose = () => {
    if (entry && pageCount > 0 && (entry.lastReadPage ?? 0) !== current) {
      patch({ ...entry, lastReadPage: current, totalPages: pageCount }).catch((e) =>
        console.error('[DskBookViewer] save progress failed', e),
      );
    }
    onClose();
  };

  if (!entry) return null;

  const flipPrev = () => bookRef.current?.pageFlip?.()?.flipPrev();
  const flipNext = () => bookRef.current?.pageFlip?.()?.flipNext();

  return (
    <Box
      sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(8,12,12,0.93)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column' }}
      onClick={handleClose}
    >
      <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{entry.title || '書籍'}</Typography>
          {pageCount > 0 && (
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {mode === 'single' || current + 1 >= pageCount
                ? `${Math.min(current + 1, pageCount)} / ${pageCount} ページ`
                : `${current + 1} – ${Math.min(current + 2, pageCount)} / ${pageCount} ページ`}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            exclusive size="small" value={mode}
            onChange={(_, v) => { if (v) setMode(v); }}
            sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', px: 1, py: 0.25 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT} !important` } }}
          >
            <ToggleButton value="spread"><Tooltip title="見開き"><AutoStoriesRoundedIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
            <ToggleButton value="single"><Tooltip title="単ページ"><CropPortraitRoundedIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="閉じる">
            <IconButton onClick={handleClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box onClick={(e) => e.stopPropagation()} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 0, px: 2, pb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress sx={{ color: ACCENT }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>PDF を読み込み中...</Typography>
          </Box>
        ) : error ? (
          <Typography sx={{ color: '#ff6b6b', fontSize: 14 }}>{error}</Typography>
        ) : pageCount > 0 ? (
          <>
            <IconButton onClick={flipPrev} sx={navBtnSx}><ChevronLeftRoundedIcon sx={{ fontSize: 30 }} /></IconButton>
            <Box sx={{ width: mode === 'single' ? dims.w : dims.w * 2, filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.55))' }}>
              {/* @ts-ignore react-pageflip の props 型は緩いため */}
              <HTMLFlipBook
                key={mode}
                ref={bookRef}
                width={dims.w}
                height={dims.h}
                size="fixed"
                minWidth={260}
                maxWidth={1000}
                minHeight={350}
                maxHeight={1400}
                showCover={mode === 'spread'}
                maxShadowOpacity={0.5}
                mobileScrollSupport={false}
                drawShadow
                useMouseEvents
                flippingTime={700}
                onFlip={(e: any) => setCurrent(e.data)}
                onChangeOrientation={() => setVersion((v) => v + 1)}
                className=""
                style={{}}
                startPage={current}
                clickEventForward
                usePortrait={mode === 'single'}
                autoSize={false}
              >
                {Array.from({ length: pageCount }).map((_, i) => (
                  <Page key={i} src={cacheRef.current.get(i) ?? null} index={i} />
                ))}
              </HTMLFlipBook>
            </Box>
            <IconButton onClick={flipNext} sx={navBtnSx}><ChevronRightRoundedIcon sx={{ fontSize: 30 }} /></IconButton>
          </>
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>表示できるページがありません</Typography>
        )}
      </Box>
    </Box>
  );
};

const navBtnSx = {
  color: 'rgba(255,255,255,0.55)',
  bgcolor: 'rgba(255,255,255,0.06)',
  '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.14)' },
  flexShrink: 0,
} as const;
