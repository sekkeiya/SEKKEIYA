import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ArchitectureRoundedIcon from '@mui/icons-material/ArchitectureRounded';
import ChairRoundedIcon from '@mui/icons-material/ChairRounded';
import LocationCityRoundedIcon from '@mui/icons-material/LocationCityRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
// @ts-ignore
import { convert3dmToGlb } from '../../features/dss/upload/utils/convert3dmToGlb';
import { RightPanelModelViewer } from '../../features/dss/components/RightPanelModelViewer';
import type { RhinoTemplate } from '../../features/projects/types';

interface CategoryStyle {
  gradient: string;
  iconColor: string;
  icon: React.ReactNode;
  label: string;
}

function getCategoryStyle(category: string): CategoryStyle {
  const s = category?.toLowerCase() ?? '';
  if (s.includes('architecture') || s.includes('建築'))
    return {
      gradient: 'linear-gradient(145deg, #0d1b2e 0%, #1a3a5c 100%)',
      iconColor: '#4fc3f7',
      icon: <ArchitectureRoundedIcon sx={{ fontSize: 40 }} />,
      label: '建築',
    };
  if (s.includes('interior') || s.includes('インテリア'))
    return {
      gradient: 'linear-gradient(145deg, #1a1208 0%, #3d2b10 100%)',
      iconColor: '#ffb74d',
      icon: <ChairRoundedIcon sx={{ fontSize: 40 }} />,
      label: 'インテリア',
    };
  if (s.includes('furniture') || s.includes('家具'))
    return {
      gradient: 'linear-gradient(145deg, #0d1f18 0%, #163d2a 100%)',
      iconColor: '#66bb6a',
      icon: <ChairRoundedIcon sx={{ fontSize: 40 }} />,
      label: '家具',
    };
  if (s.includes('urban') || s.includes('都市'))
    return {
      gradient: 'linear-gradient(145deg, #1a0d2e 0%, #3a1a5c 100%)',
      iconColor: '#ce93d8',
      icon: <LocationCityRoundedIcon sx={{ fontSize: 40 }} />,
      label: '都市計画',
    };
  if (s.includes('product') || s.includes('プロダクト'))
    return {
      gradient: 'linear-gradient(145deg, #0d1f2e 0%, #143040 100%)',
      iconColor: '#4dd0e1',
      icon: <CategoryRoundedIcon sx={{ fontSize: 40 }} />,
      label: 'プロダクト',
    };
  if (s.includes('detail') || s.includes('ディテール'))
    return {
      gradient: 'linear-gradient(145deg, #2e0d0d 0%, #4a1a1a 100%)',
      iconColor: '#ef9a9a',
      icon: <GridViewRoundedIcon sx={{ fontSize: 40 }} />,
      label: 'ディテール',
    };
  if (s.includes('drawing') || s.includes('図面'))
    return {
      gradient: 'linear-gradient(145deg, #111318 0%, #1e2332 100%)',
      iconColor: '#90caf9',
      icon: <DescriptionRoundedIcon sx={{ fontSize: 40 }} />,
      label: '図面',
    };
  if (s.includes('residential') || s.includes('住宅'))
    return {
      gradient: 'linear-gradient(145deg, #0d1a14 0%, #1a3528 100%)',
      iconColor: '#a5d6a7',
      icon: <HomeRoundedIcon sx={{ fontSize: 40 }} />,
      label: '住宅',
    };
  if (s.includes('mesh') || s.includes('メッシュ'))
    return {
      gradient: 'linear-gradient(145deg, #0f0f1a 0%, #1a1a30 100%)',
      iconColor: '#b39ddb',
      icon: <BlurOnRoundedIcon sx={{ fontSize: 40 }} />,
      label: 'メッシュ',
    };
  return {
    gradient: 'linear-gradient(145deg, #0d1118 0%, #151e2e 100%)',
    iconColor: 'rgba(255,255,255,0.4)',
    icon: <ViewInArRoundedIcon sx={{ fontSize: 40 }} />,
    label: '3D',
  };
}

interface Props {
  tmpl: RhinoTemplate;
}

type ThumbState = 'placeholder' | 'loading' | 'ready' | 'failed';

export const TemplateThumbnail: React.FC<Props> = ({ tmpl }) => {
  const [state, setState] = useState<ThumbState>('placeholder');
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const catStyle = getCategoryStyle(tmpl.category ?? '');

  const loadGlb = useCallback(async () => {
    if (loadedRef.current) return;
    if (!tmpl.templatePath) { setState('failed'); return; }
    loadedRef.current = true;
    setState('loading');
    try {
      let fetchUrl = tmpl.templatePath;
      if (fetchUrl.match(/^[a-zA-Z]:\\/) || fetchUrl.startsWith('/')) {
        fetchUrl = convertFileSrc(fetchUrl.replace(/\\/g, '/'));
      } else if (fetchUrl.startsWith('http')) {
        const resolved = await invoke<string>('ensure_model_cached', {
          modelId: tmpl.id, model_id: tmpl.id, ext: '3dm', downloadUrl: fetchUrl,
        });
        fetchUrl = convertFileSrc(resolved.replace(/\\/g, '/'));
      } else {
        setState('failed');
        return;
      }
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      // ファイルサイズが 10KB 未満は空テンプレートとみなしプレースホルダーを維持
      if (blob.size < 10_000) { setState('failed'); return; }
      const file = new File([blob], `${tmpl.name}.3dm`);
      const glbFile = await convert3dmToGlb(file);
      // ジオメトリのない空テンプレートはGLBが極小になる → 真っ黒な3D表示を避けてプレースホルダーを維持
      if ((glbFile as File).size < 3_000) { setState('failed'); return; }
      const url = URL.createObjectURL(glbFile as File);
      setGlbUrl(url);
      setState('ready');
    } catch {
      loadedRef.current = false;
      setState('failed');
    }
  }, [tmpl]);

  // thumbnailUrl / glbUrl がある場合は即表示
  useEffect(() => {
    if (tmpl.thumbnailUrl || tmpl.glbUrl) setState('ready');
  }, [tmpl.thumbnailUrl, tmpl.glbUrl]);

  useEffect(() => {
    return () => { if (glbUrl) URL.revokeObjectURL(glbUrl); };
  }, [glbUrl]);

  // thumbnailUrl
  if (tmpl.thumbnailUrl) {
    return <img src={tmpl.thumbnailUrl} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  // pre-generated GLB
  if (tmpl.glbUrl && state === 'ready') {
    return (
      <Box sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <RightPanelModelViewer modelUrl={tmpl.glbUrl} />
      </Box>
    );
  }

  // 動的ロード後の 3D ビュー
  if (state === 'ready' && glbUrl) {
    return (
      <Box sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <RightPanelModelViewer modelUrl={glbUrl} />
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onMouseEnter={state === 'placeholder' ? loadGlb : undefined}
      sx={{
        width: '100%', height: '100%',
        background: catStyle.gradient,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', cursor: 'default',
      }}
    >
      {/* 背景グリッドパターン */}
      <Box sx={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(${catStyle.iconColor}14 1px, transparent 1px),
          linear-gradient(90deg, ${catStyle.iconColor}14 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        opacity: 0.6,
      }} />

      {state === 'loading' ? (
        <CircularProgress size={22} sx={{ color: catStyle.iconColor, opacity: 0.8 }} />
      ) : (
        <>
          <Box sx={{ color: catStyle.iconColor, opacity: state === 'failed' ? 0.25 : 0.55, position: 'relative', zIndex: 1 }}>
            {catStyle.icon}
          </Box>
          {state !== 'failed' && (
            <Typography sx={{
              fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.06em',
              color: catStyle.iconColor, opacity: 0.45, mt: 0.5, textTransform: 'uppercase',
              position: 'relative', zIndex: 1,
            }}>
              {catStyle.label}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};
