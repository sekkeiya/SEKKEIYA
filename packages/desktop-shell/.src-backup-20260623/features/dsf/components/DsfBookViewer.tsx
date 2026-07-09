import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CropPortraitRoundedIcon from '@mui/icons-material/CropPortraitRounded';
// @ts-ignore — react-pageflip は型同梱だが default export の型が緩いため
import HTMLFlipBook from 'react-pageflip';

type ViewMode = 'spread' | 'single';
import { fetchPdfBuffer, openPdf, renderPdfPage, type OpenedPdf } from '../lib/pdf';

const ACCENT = '#7e57c2';
// 描画解像度（高すぎるとメモリを食うので 1.5 前後が無難）
const RENDER_SCALE = 1.5;
// 現在の見開きから前後何ページ先まで先読みするか
const PRELOAD = 3;
// data URL をキャッシュする最大ページ数（これを超えたら遠いページを破棄）
const MAX_CACHE = 24;

interface DsfBookViewerProps {
  /** 表示する PDF（downloadUrl を fetch して描画する） */
  item: any | null;
  onClose: () => void;
}

// react-pageflip の各ページ。forwardRef が必須（内部で ref を割り当てる）。
// src が未描画（null）の間はプレースホルダ（スピナー）を表示する。
const Page = React.forwardRef<HTMLDivElement, { src: string | null; index: number }>(({ src, index }, ref) => (
  <div ref={ref} style={{ background: '#fff', overflow: 'hidden' }}>
    {src ? (
      <img
        src={src}
        alt={`page ${index + 1}`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        draggable={false}
      />
    ) : (
      <Box
        sx={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: '#f3f1f7',
        }}
      >
        <CircularProgress size={26} sx={{ color: ACCENT }} />
      </Box>
    )}
  </div>
));
Page.displayName = 'DsfBookPage';

export const DsfBookViewer: React.FC<DsfBookViewerProps> = ({ item, onClose }) => {
  const bookRef = useRef<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [aspect, setAspect] = useState(0.707);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [current, setCurrent] = useState(0);
  // 表示モード: spread = 見開き2ページ / single = 単ページ
  const [mode, setMode] = useState<ViewMode>('spread');

  // 開いている PDF 文書。getPage() で個別ページを遅延描画する。
  const pdfRef = useRef<OpenedPdf | null>(null);
  // 描画済みページ（index → data URL）のキャッシュ。LRU 的に遠いページを破棄する。
  const cacheRef = useRef<Map<number, string>>(new Map());
  // 描画中／予約済みページ（二重描画を防ぐ）
  const pendingRef = useRef<Set<number>>(new Set());
  // cacheRef は ref なので、再描画を促すためのバージョンカウンタ
  const [, setVersion] = useState(0);

  // ビューア表示領域（高さ基準でページ寸法を決める）
  const [dims, setDims] = useState({ w: 420, h: 594 });

  // PDF を開く（メタ情報のみ取得し、全ページ一括描画はしない）
  useEffect(() => {
    if (!item?.downloadUrl) return;
    let active = true;
    setLoading(true);
    setError(null);
    setCurrent(0);
    setPageCount(0);
    cacheRef.current = new Map();
    pendingRef.current = new Set();
    setProgress('PDF を読み込み中...');
    (async () => {
      try {
        const buf = await fetchPdfBuffer(item.downloadUrl);
        if (!active) return;
        const opened = await openPdf(buf);
        if (!active) { opened.task.destroy(); return; }
        pdfRef.current = opened;
        setAspect(opened.aspect || 0.707);
        setPageCount(opened.pageCount);
        setLoading(false);
      } catch (e: any) {
        console.error('[DsfBookViewer] open failed', e);
        if (active) { setError(e?.message ?? 'PDF の表示に失敗しました。'); setLoading(false); }
      }
    })();
    return () => {
      active = false;
      // 文書を破棄してメモリを解放
      pdfRef.current?.task?.destroy?.();
      pdfRef.current = null;
      cacheRef.current = new Map();
      pendingRef.current = new Set();
    };
  }, [item?.downloadUrl]);

  // 現在の見開き周辺だけ遅延描画し、遠いページはキャッシュから破棄する。
  // current（react-pageflip の onFlip / onChangeOrientation で更新）に追従。
  useEffect(() => {
    const opened = pdfRef.current;
    if (!opened || pageCount === 0) return;
    let cancelled = false;

    const lo = Math.max(0, current - PRELOAD);
    const hi = Math.min(pageCount - 1, current + 1 + PRELOAD); // +1: 見開き右ページぶん

    // 表示範囲から遠いページをキャッシュから破棄（メモリ上限を抑える）
    const evict = () => {
      const cache = cacheRef.current;
      if (cache.size <= MAX_CACHE) return;
      const far = [...cache.keys()]
        .filter((k) => k < lo || k > hi) // 現在見えている範囲は残す
        .sort((a, b) => Math.abs(b - current) - Math.abs(a - current)); // 遠い順
      for (const k of far) {
        if (cache.size <= MAX_CACHE) break;
        cache.delete(k);
      }
    };

    (async () => {
      // 近い順に描画して体感速度を上げる（current → 外側へ）
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
          console.error('[DsfBookViewer] page render failed', i + 1, e);
        } finally {
          pendingRef.current.delete(i);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [current, pageCount]);

  // ウィンドウサイズ・モードに合わせてページ寸法を再計算。
  // 見開きは 2 ページ横並びになるため、高さだけでなく横幅にも収まるよう制約する
  // （横長ページだと高さ基準のままでは合計幅が画面を超えて両端が見切れる）。
  useEffect(() => {
    const recalc = () => {
      const across = mode === 'spread' ? 2 : 1;
      // ステージで使える領域（左右のナビボタン＋余白ぶんを差し引く）
      const availH = Math.min(window.innerHeight * 0.8, 900);
      const availW = Math.max(280, window.innerWidth - 160);
      // 高さ制約と横幅制約の小さい方をページ幅に採用
      const pageW = Math.min(availH * aspect, availW / across);
      const w = Math.max(200, Math.round(pageW));
      setDims({ w, h: Math.round(w / aspect) });
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [aspect, mode]);

  if (!item) return null;

  const flipPrev = () => bookRef.current?.pageFlip?.()?.flipPrev();
  const flipNext = () => bookRef.current?.pageFlip?.()?.flipNext();

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 1400,
        bgcolor: 'rgba(8,10,16,0.92)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Header */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, flexShrink: 0 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{item.title || item.name || 'ポートフォリオ'}</Typography>
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
            exclusive size="small"
            value={mode}
            onChange={(_, v) => { if (v) setMode(v); }}
            sx={{
              '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', px: 1, py: 0.25 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT} !important` },
            }}
          >
            <ToggleButton value="spread"><Tooltip title="見開き"><AutoStoriesRoundedIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
            <ToggleButton value="single"><Tooltip title="単ページ"><CropPortraitRoundedIcon sx={{ fontSize: 18 }} /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          {item.downloadUrl && (
            <Tooltip title="ダウンロード">
              <IconButton component="a" href={item.downloadUrl} download size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                <DownloadRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="閉じる">
            <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Book stage */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 0, px: 2, pb: 3 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress sx={{ color: ACCENT }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{progress}</Typography>
          </Box>
        ) : error ? (
          <Typography sx={{ color: '#ff6b6b', fontSize: 14 }}>{error}</Typography>
        ) : pageCount > 0 ? (
          <>
            <IconButton onClick={flipPrev} sx={navBtnSx}>
              <ChevronLeftRoundedIcon sx={{ fontSize: 30 }} />
            </IconButton>

            {/* 親要素幅で react-pageflip の向きが決まる（fixed: 親幅 < width×2 かつ usePortrait → 単ページ）。
                モード切替時は key で再マウントして向きを確実に再計算し、startPage で現在ページを維持する。 */}
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

            <IconButton onClick={flipNext} sx={navBtnSx}>
              <ChevronRightRoundedIcon sx={{ fontSize: 30 }} />
            </IconButton>
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
