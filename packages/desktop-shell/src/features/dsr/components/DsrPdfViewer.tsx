import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress, Tooltip, Button } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { openPdf, fetchPdfBuffer, renderPdfPage, type OpenedPdf } from '../../dsf/lib/pdf';

const ACCENT = '#4db6ac';
const RENDER_SCALE = 2; // 高解像度で描画し、表示倍率は CSS 幅で調整（ズーム時の再描画を避ける）
const BASE_WIDTH = 820; // ズーム 1.0 のときのページ表示幅(px)

const isPdfItem = (item: any) => {
  const fmt = String(item?.format || '').toLowerCase();
  if (fmt === 'pdf') return true;
  const url = String(item?.downloadUrl || '');
  return /\.pdf(\?|$)/i.test(url);
};

/** スクロールで可視範囲に入ったときだけ該当ページを描画する遅延ページ */
const PdfPage: React.FC<{ pdf: any; pageNumber: number; aspect: number; width: number }> = ({ pdf, pageNumber, aspect, width }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || src) return;
    let cancelled = false;
    renderPdfPage(pdf, pageNumber, RENDER_SCALE)
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible, src, pdf, pageNumber]);

  return (
    <Box ref={ref} sx={{ width, mx: 'auto', mb: 2.5, position: 'relative' }}>
      {src ? (
        <img src={src} alt={`page ${pageNumber}`} style={{ width: '100%', display: 'block', borderRadius: 4, boxShadow: '0 6px 28px rgba(0,0,0,0.55)' }} />
      ) : (
        <Box sx={{ width: '100%', aspectRatio: String(aspect || 0.707), bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={22} sx={{ color: ACCENT }} />
        </Box>
      )}
      <Typography sx={{ position: 'absolute', bottom: 6, right: 10, fontSize: 11, color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(0,0,0,0.4)', px: 0.75, borderRadius: 1 }}>{pageNumber}</Typography>
    </Box>
  );
};

interface DsrPdfViewerProps {
  item: any;
  onClose: () => void;
  onOpenExternal?: (url?: string) => void;
}

export const DsrPdfViewer: React.FC<DsrPdfViewerProps> = ({ item, onClose, onOpenExternal }) => {
  const [opened, setOpened] = useState<OpenedPdf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const pdf = isPdfItem(item);

  useEffect(() => {
    if (!pdf) { setLoading(false); return; }
    let task: any = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOpened(null);
    (async () => {
      try {
        const buf = await fetchPdfBuffer(item.downloadUrl);
        const res = await openPdf(buf);
        task = res.task;
        if (cancelled) { res.task.destroy(); return; }
        setOpened(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'PDF を開けませんでした');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; try { task?.destroy(); } catch { /* noop */ } };
  }, [item?.id, item?.downloadUrl, pdf]);

  const width = Math.round(BASE_WIDTH * zoom);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Viewer toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <Tooltip title="一覧へ戻る">
          <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}><ArrowBackRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Typography noWrap sx={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#fff', minWidth: 0 }}>
          {item.title || item.name || '図面'}
        </Typography>
        {pdf && opened && (
          <>
            <Tooltip title="縮小"><span><IconButton size="small" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} sx={{ color: '#fff' }}><ZoomOutRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
            <Tooltip title="拡大"><span><IconButton size="small" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} sx={{ color: '#fff' }}><ZoomInRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
          </>
        )}
        <Tooltip title="外部ブラウザで開く">
          <IconButton size="small" onClick={() => onOpenExternal?.(item.downloadUrl)} sx={{ color: 'rgba(255,255,255,0.7)' }}><OpenInNewRoundedIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Box>

      {/* Viewer body */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: 'rgba(0,0,0,0.25)', p: 2 }}>
        {!pdf ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
            <img src={item.downloadUrl} alt={item.title || item.name || ''} style={{ width, maxWidth: '100%', borderRadius: 4, boxShadow: '0 6px 28px rgba(0,0,0,0.55)' }} />
          </Box>
        ) : loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5 }}>
            <CircularProgress sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>PDF を読み込み中…</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{error}</Typography>
            <Button variant="outlined" startIcon={<OpenInNewRoundedIcon />} onClick={() => onOpenExternal?.(item.downloadUrl)}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', '&:hover': { borderColor: ACCENT } }}>
              外部ブラウザで開く
            </Button>
          </Box>
        ) : opened ? (
          Array.from({ length: opened.pageCount }, (_, i) => (
            <PdfPage key={i + 1} pdf={opened.pdf} pageNumber={i + 1} aspect={opened.aspect} width={width} />
          ))
        ) : null}
      </Box>
    </Box>
  );
};
