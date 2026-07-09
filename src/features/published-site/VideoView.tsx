import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';
import { motion, AnimatePresence } from 'framer-motion';
import type { EditorialTheme } from './editorialThemes';
import type { Slide } from './siteSlides';
import { DATA_SLIDE_TYPES } from './siteSlides';
import { SlideContent } from './SlideContent';

// 動画ビュー：スライドを自動再生（クロスフェード＋Ken Burns）。再生/一時停止・前後・ESC。

const DURATION = 6000; // 1 スライドの表示時間(ms)

export const VideoView: React.FC<{ slides: Slide[]; theme: EditorialTheme; onClose: () => void }> = ({ slides, theme, onClose }) => {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = slides.length - 1;

  const next = useCallback(() => setIdx(i => (i >= last ? i : i + 1)), [last]);
  const prev = useCallback(() => setIdx(i => (i <= 0 ? 0 : i - 1)), []);

  // 自動送り（末尾で停止）
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx(i => i + 1), DURATION);
    return () => clearTimeout(t);
  }, [idx, playing, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') { setPlaying(false); next(); }
      else if (e.key === 'ArrowLeft') { setPlaying(false); prev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const s = slides[idx];
  const isData = DATA_SLIDE_TYPES.includes(s.section.type); // 統計/グラフ/モデル/Works 等
  const hasBg = !!s.image && !isData;                       // 全画面背景画像にするか
  const ctrlSx = { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } };

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: '#000', overflow: 'hidden' }}>
      {/* 背景 */}
      <AnimatePresence mode="sync">
        <motion.div
          key={s.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {hasBg ? (
            <motion.div
              initial={{ scale: 1.04 }}
              animate={{ scale: 1.16 }}
              transition={{ duration: DURATION / 1000 + 1.5, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Box component="img" src={s.image as string} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </motion.div>
          ) : (
            <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 80% at 50% 30%, ${theme.accent}26 0%, #0b0b0c 60%, #050506 100%)` }} />
          )}
          {hasBg && <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.45) 100%)' }} />}
        </motion.div>
      </AnimatePresence>

      {/* 前景 */}
      {isData ? (
        // データ系：中央にタイトル＋実コンテンツ（チャート/統計/モデル/Works）
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 3, md: 8 }, py: { xs: 9, md: 10 } }}>
          <motion.div key={`d-${s.id}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ width: '100%', maxWidth: 1000, textAlign: 'center' }}>
            {s.kicker && <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', mb: 1.25 }}>{s.kicker}</Typography>}
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.1, color: '#fff', fontSize: { xs: '1.9rem', md: '3rem' }, mb: { xs: 3, md: 4 } }}>{s.title}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <SlideContent section={s.section} theme={theme} image={s.image} body={s.body} light={false} />
            </Box>
          </motion.div>
        </Box>
      ) : (
        // 画像系：下部にタイトル＋本文
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: { xs: 96, md: 120 }, px: { xs: 3, md: 10 }, maxWidth: 1100, mx: 'auto' }}>
          <motion.div key={`t-${s.id}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
            {s.kicker && (
              <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', mb: 1.5 }}>{s.kicker}</Typography>
            )}
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.08, color: '#fff', fontSize: { xs: '2.2rem', md: '4rem' }, mb: s.body ? 2 : 0 }}>
              {s.title}
            </Typography>
            {s.body && (
              <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: { xs: '0.92rem', md: '1.1rem' }, lineHeight: 1.8, color: 'rgba(255,255,255,0.85)', maxWidth: 720, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {s.body}
              </Typography>
            )}
          </motion.div>
        </Box>
      )}

      {/* 進行バー（セグメント） */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', gap: 0.75 }}>
        {slides.map((sl, i) => (
          <Box key={sl.id} sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', bgcolor: '#fff',
              width: i < idx ? '100%' : i > idx ? '0%' : '100%',
              transformOrigin: 'left',
              animation: i === idx && playing ? `vidprog ${DURATION}ms linear` : 'none',
              '@keyframes vidprog': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
              transform: i === idx && !playing ? 'scaleX(1)' : undefined,
            }} />
          </Box>
        ))}
      </Box>

      {/* コントロール */}
      <Box sx={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <IconButton onClick={() => { setPlaying(false); prev(); }} aria-label="前へ" sx={ctrlSx}><SkipPreviousRoundedIcon /></IconButton>
        <IconButton onClick={() => setPlaying(p => !p)} aria-label={playing ? '一時停止' : '再生'} sx={{ ...ctrlSx, width: 56, height: 56 }}>
          {playing ? <PauseRoundedIcon fontSize="large" /> : <PlayArrowRoundedIcon fontSize="large" />}
        </IconButton>
        <IconButton onClick={() => { setPlaying(false); next(); }} aria-label="次へ" sx={ctrlSx}><SkipNextRoundedIcon /></IconButton>
      </Box>

      <IconButton onClick={onClose} aria-label="閉じる" sx={{ position: 'absolute', top: 28, right: 16, ...ctrlSx }}>
        <CloseRoundedIcon />
      </IconButton>
    </Box>
  );
};
