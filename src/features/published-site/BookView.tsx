import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
// @ts-ignore -- react-pageflip は型定義なし
import HTMLFlipBook from 'react-pageflip';
import type { EditorialTheme } from './editorialThemes';
import type { Slide } from './siteSlides';
import { SlideContent } from './SlideContent';

// ブックビュー：スライドを本のようにめくって閲覧（react-pageflip）。

interface PageProps { slide: Slide; theme: EditorialTheme; index: number; total: number; }

const Page = React.forwardRef<HTMLDivElement, PageProps>(({ slide, theme, index, total }, ref) => {
  const isImage = !!slide.image && !['profilestats', 'usergenres', 'usermodels', 'target', 'works', 'spec', 'regulation'].includes(slide.section.type);
  return (
    <div ref={ref} style={{ background: theme.surface, overflow: 'hidden' }}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${theme.border}`, p: { xs: 2.5, md: 3.5 }, bgcolor: theme.surface }}>
        {/* 見出し */}
        {slide.kicker && (
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.accent, mb: 1 }}>{slide.kicker}</Typography>
        )}
        <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.12, color: theme.text, fontSize: { xs: '1.4rem', md: '1.9rem' }, mb: 2 }}>
          {slide.title}
        </Typography>
        {/* 中身：データ系はチャート/統計/グリッド、その他は画像 or 本文 */}
        <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: isImage ? 'stretch' : 'flex-start', justifyContent: 'center' }}>
          <SlideContent section={slide.section} theme={theme} image={slide.image} body={slide.body} light compact />
        </Box>
        <Typography sx={{ mt: 1.25, fontFamily: theme.kickerFamily, fontSize: '0.6rem', letterSpacing: '0.1em', color: theme.subtext, opacity: 0.6 }}>{index + 1} / {total}</Typography>
      </Box>
    </div>
  );
});
Page.displayName = 'BookPage';

export const BookView: React.FC<{ slides: Slide[]; theme: EditorialTheme; onClose: () => void }> = ({ slides, theme, onClose }) => {
  const bookRef = useRef<any>(null);
  const [size, setSize] = useState(() => calc());

  function calc() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const single = vw < 760; // モバイルは単ページ表示
    const h = Math.min(Math.round(vh * 0.78), 720);
    const w = single ? Math.min(Math.round(vw * 0.86), 460) : Math.round(h * 0.72);
    return { w, h, single };
  }

  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') bookRef.current?.pageFlip()?.flipNext();
      else if (e.key === 'ArrowLeft') bookRef.current?.pageFlip()?.flipPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: theme.mode === 'dark' ? '#08080a' : '#2b2926', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: theme.mode === 'dark' ? 'radial-gradient(70% 70% at 50% 40%, #15151a 0%, #050506 100%)' : 'radial-gradient(70% 70% at 50% 40%, #3a3733 0%, #1c1c19 100%)' }}>
      <IconButton onClick={onClose} aria-label="閉じる" sx={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.8)', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' } }}>
        <CloseRoundedIcon />
      </IconButton>

      <IconButton onClick={() => bookRef.current?.pageFlip()?.flipPrev()} aria-label="前へ" sx={{ position: 'absolute', left: { xs: 6, md: 28 }, color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.06)', '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' } }}>
        <ChevronLeftRoundedIcon fontSize="large" />
      </IconButton>
      <IconButton onClick={() => bookRef.current?.pageFlip()?.flipNext()} aria-label="次へ" sx={{ position: 'absolute', right: { xs: 6, md: 28 }, color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.06)', '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' } }}>
        <ChevronRightRoundedIcon fontSize="large" />
      </IconButton>

      <Box sx={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))' }}>
        <HTMLFlipBook
          key={`${size.w}x${size.h}-${size.single}`}
          ref={bookRef}
          width={size.w}
          height={size.h}
          size="fixed"
          minWidth={200} maxWidth={1000} minHeight={300} maxHeight={1000}
          showCover
          usePortrait={size.single}
          mobileScrollSupport
          maxShadowOpacity={0.5}
          drawShadow
          flippingTime={700}
        >
          {slides.map((s, i) => (
            <Page key={s.id} slide={s} theme={theme} index={i} total={slides.length} />
          ))}
        </HTMLFlipBook>
      </Box>

      <Typography sx={{ position: 'absolute', bottom: 18, color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
        ドラッグ / ← → でめくる
      </Typography>
    </Box>
  );
};
