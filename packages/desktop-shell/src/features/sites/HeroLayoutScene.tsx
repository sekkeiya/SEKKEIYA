// ヒーロー「レイアウト没入」演出。プロジェクトの S.Layout レンダー画像を
// シネマティックなクロスフェード＋Ken Burns スライドショーで全面背景表示する。
// レンダーが無い（またはアカウントサイト）の場合はプロシージャル 3D シーンへフォールバック。
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { getProjectLayoutRenders } from './projectAssetsApi';
import { Hero3DScene } from './Hero3DScene';

interface Props {
  projectId?: string;
  accent: string;
  scrollerRef: React.RefObject<HTMLElement | null>;
}

export const HeroLayoutScene: React.FC<Props> = ({ projectId, accent, scrollerRef }) => {
  const [urls, setUrls] = useState<string[] | null>(null); // null = ロード中
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let active = true;
    if (!projectId) { setUrls([]); return; }
    getProjectLayoutRenders(projectId)
      .then(u => { if (active) setUrls(u.slice(0, 8)); })
      .catch(() => { if (active) setUrls([]); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!urls || urls.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % urls.length), 5000);
    return () => clearInterval(t);
  }, [urls]);

  // レンダーが取得できない → プロシージャル 3D にフォールバック
  if (urls !== null && urls.length === 0) {
    return <Hero3DScene accent={accent} scrollerRef={scrollerRef} />;
  }

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', bgcolor: '#000' }}>
      {(urls ?? []).map((u, i) => (
        <Box
          key={u + i}
          component="img"
          src={u}
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: i === idx ? 1 : 0, transition: 'opacity 1.4s ease',
            transform: i === idx ? 'scale(1.12)' : 'scale(1.04)',
            transitionProperty: 'opacity, transform',
            transitionDuration: '1.4s, 7s',
            transitionTimingFunction: 'ease, ease-out',
          }}
        />
      ))}
      {/* テキスト可読性のためのオーバーレイ */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.05))' }} />
    </Box>
  );
};
