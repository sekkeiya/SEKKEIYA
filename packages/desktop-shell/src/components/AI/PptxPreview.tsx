// SEKKEIYA Drive の Quick Look 用 pptx スライドビューア。
// Storage 上の pptx を取得し、端末内で全スライドを描画（renderAllPptxSlideUrls）して表示する。
//  - 横モード: 1枚ずつ ←/→ でめくる（下にサムネのギャラリー）
//  - 縦モード: 全スライドを縦スクロールで一覧
//  - 「S.Slideで開く」: 編集可能プレゼンにインポートしてエディタで開く（本体窓へ遷移）
import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Typography, CircularProgress, Button } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';
import ViewCarouselRoundedIcon from '@mui/icons-material/ViewCarouselRounded';
import ViewDayRoundedIcon from '@mui/icons-material/ViewDayRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

type Mode = 'horizontal' | 'vertical';

const navBtnSx = {
  color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.4)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
  '&.Mui-disabled': { opacity: 0.25, color: 'var(--brand-fg)' },
};

export const PptxPreview: React.FC<{ url: string; name?: string }> = ({ url }) => {
  const [slides, setSlides] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('vertical'); // 縦スクロールが見慣れている人が多いため既定
  const [srcFile, setSrcFile] = useState<File | null>(null);
  const [opening, setOpening] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setSlides(null); setErr(false); setIdx(0); setSrcFile(null);
    (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], 'deck.pptx', {
          type: blob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
        if (active) setSrcFile(file);
        const { renderAllPptxSlideUrls } = await import('../../features/drive/pptxThumbnail');
        const urls = await renderAllPptxSlideUrls(file, 1400);
        if (!active) return;
        if (urls.length) setSlides(urls); else setErr(true);
      } catch (e) {
        console.warn('[PptxPreview] failed:', e);
        if (active) setErr(true);
      }
    })();
    return () => { active = false; };
  }, [url]);

  // ←/→ でスライド移動（横モードのみ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!slides || slides.length < 2 || mode !== 'horizontal') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIdx((i) => Math.min(slides.length - 1, i + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides, mode]);

  // アクティブなサムネをギャラリーの可視域へ
  useEffect(() => {
    const el = galleryRef.current?.querySelector(`[data-slide-idx="${idx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [idx]);

  const openInSlide = async () => {
    if (!srcFile || opening) return;
    setOpening(true);
    try {
      const { importAndOpenPptx } = await import('../../features/dsp/lib/openPresentation');
      await importAndOpenPptx(srcFile);
    } catch (e: any) {
      console.warn('[PptxPreview] open in S.Slide failed:', e);
      alert('S.Slideで開けませんでした: ' + (e?.message || ''));
    } finally {
      setOpening(false);
    }
  };

  if (err) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} onClick={(e) => e.stopPropagation()}>
        <SlideshowRoundedIcon sx={{ fontSize: 56, color: 'light-dark(#c2410c, #fdba74)' }} />
        <Typography sx={{ fontSize: 14 }}>スライドのプレビューを生成できませんでした</Typography>
      </Box>
    );
  }

  if (!slides) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
        <CircularProgress size={28} sx={{ color: '#00BFFF' }} />
        <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>スライドを描画中…</Typography>
      </Box>
    );
  }

  const modes: [Mode, React.ReactNode, string][] = [
    ['horizontal', <ViewCarouselRoundedIcon sx={{ fontSize: '1rem' }} />, '横'],
    ['vertical', <ViewDayRoundedIcon sx={{ fontSize: '1rem' }} />, '縦'],
  ];

  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%', height: '100%', maxWidth: 1300, mx: 'auto' }}>
      {/* 上部コントロール: 横/縦トグル ＋ S.Slideで開く */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', px: 0.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 0.5, p: '3px', borderRadius: '9px', bgcolor: 'rgba(255,255,255,0.08)' }}>
          {modes.map(([m, icon, label]) => (
            <Box key={m} onClick={() => setMode(m)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: '7px', cursor: 'pointer', fontSize: 12, fontWeight: 700, userSelect: 'none',
                color: mode === m ? '#03121b' : 'var(--brand-fg)', bgcolor: mode === m ? '#00BFFF' : 'transparent' }}>
              {icon}{label}
            </Box>
          ))}
        </Box>
        <Button onClick={openInSlide} disabled={opening || !srcFile}
          startIcon={opening ? <CircularProgress size={14} sx={{ color: '#03121b' }} /> : <EditRoundedIcon />}
          variant="contained"
          sx={{ textTransform: 'none', bgcolor: '#00BFFF', color: '#03121b', fontWeight: 700, '&:hover': { bgcolor: '#33ccff' }, '&.Mui-disabled': { bgcolor: 'rgba(0,191,255,0.4)', color: 'rgba(3,18,27,0.6)' } }}>
          {opening ? 'S.Slideで開いています…' : 'S.Slideで開く'}
        </Button>
      </Box>

      {mode === 'horizontal' ? (
        <>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <IconButton onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} sx={navBtnSx}><ChevronLeftRoundedIcon /></IconButton>
            <img src={slides[idx]} alt={`slide ${idx + 1}`}
              style={{ maxWidth: 'min(1100px, 70vw)', maxHeight: '58vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', background: '#fff' }} />
            <IconButton onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={idx >= slides.length - 1} sx={navBtnSx}><ChevronRightRoundedIcon /></IconButton>
          </Box>
          {/* ギャラリー（サムネ一覧・クリックでジャンプ） */}
          <Box ref={galleryRef} sx={{ display: 'flex', gap: 1, overflowX: 'auto', px: 1, py: 0.5, flexShrink: 0,
            '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3 } }}>
            {slides.map((s, i) => (
              <Box key={i} data-slide-idx={i} onClick={() => setIdx(i)}
                sx={{ position: 'relative', flexShrink: 0, width: 132, aspectRatio: '4 / 3', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
                  border: i === idx ? '2px solid #00BFFF' : '2px solid transparent', opacity: i === idx ? 1 : 0.55, transition: 'opacity 120ms', '&:hover': { opacity: 1 } }}>
                <img src={s} alt={`thumb ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#fff' }} />
                <Box sx={{ position: 'absolute', bottom: 2, right: 4, fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>{i + 1}</Box>
              </Box>
            ))}
          </Box>
          <Typography sx={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.7)', flexShrink: 0 }}>{idx + 1} / {slides.length}</Typography>
        </>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1,
          '&::-webkit-scrollbar': { width: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 4 } }}>
          {slides.map((s, i) => (
            <Box key={i} sx={{ position: 'relative', width: '100%', maxWidth: 1000, flexShrink: 0 }}>
              <img src={s} alt={`slide ${i + 1}`} style={{ width: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', background: '#fff' }} />
              <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: 700, color: '#fff' }}>{i + 1}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PptxPreview;
