import React from 'react';
import { Box } from '@mui/material';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';

/**
 * 1枚目スライドを DOM で縮小レンダリングする軽量プレビュー。
 * サムネイル画像(thumbnailUrl)が無いときのフォールバックとして、
 * DspDashboard のカード / 右パネル / テンプレート管理ビューで共有して使う。
 */
export const MiniSlidePreview: React.FC<{
  page: any;                              // PresentationPage | undefined
  canvasSize?: { width: number; height: number } | null;
  containerSize: number;                  // square container side (px)
}> = React.memo(({ page, canvasSize, containerSize }) => {
  const cw = canvasSize?.width  || 1587;
  const ch = canvasSize?.height || 1122;
  const scale    = Math.min(containerSize / cw, containerSize / ch);
  const scaledW  = Math.round(cw * scale);
  const scaledH  = Math.round(ch * scale);

  const elements: any[] = React.useMemo(() => {
    if (!page?.elements?.length) return [];
    return [...page.elements].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [page?.elements]);

  if (!elements.length) return null;

  return (
    <Box sx={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      <Box sx={{
        width: scaledW, height: scaledH,
        position: 'relative',
        bgcolor: '#ffffff',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {elements.map((el: any) => {
          const left    = el.x * scale;
          const top     = el.y * scale;
          const elW     = el.w * scale;
          const elH     = el.h * scale;
          const opacity = el.opacity != null ? el.opacity / 100 : 1;
          const rotate  = el.rotation ? `rotate(${el.rotation}deg)` : undefined;
          return (
            <Box key={el.id} sx={{
              position: 'absolute',
              left, top, width: elW, height: elH,
              transform: rotate,
              opacity,
              zIndex: el.zIndex || 0,
              overflow: 'hidden',
            }}>
              {el.type === 'image' && el.data?.src && (
                <Box component="img" src={el.data.src} draggable={false}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              {el.type === 'shape' && (
                <Box sx={{
                  width: '100%', height: '100%',
                  bgcolor: el.data?.fill || 'rgba(100,100,100,0.5)',
                  borderRadius: el.data?.shapeType === 'circle' ? '50%' : (el.data?.borderRadius || 0),
                  border: el.data?.stroke
                    ? `${Math.max(0.5, (el.data?.strokeWidth || 1) * scale)}px solid ${el.data.stroke}`
                    : undefined,
                }} />
              )}
              {el.type === 'text' && (
                <Box sx={{
                  width: '100%', height: '100%',
                  color: el.data?.color || '#000',
                  fontSize: el.data?.fontSize
                    ? `${parseFloat(el.data.fontSize) * scale}px`
                    : `${12 * scale}px`,
                  fontWeight: el.data?.fontWeight || 'normal',
                  textAlign: el.data?.textAlign || 'left',
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: el.data?.bgcolor || 'transparent',
                  p: el.data?.padding ? `${el.data.padding * scale}px` : 0,
                }}>
                  {el.data?.text || ''}
                </Box>
              )}
              {el.type === 'modelCard' && (
                <Box sx={{
                  width: '100%', height: '100%',
                  bgcolor: 'var(--brand-surface)', borderRadius: Math.max(1, 4 * scale),
                  overflow: 'hidden',
                }}>
                  {el.data?.thumbnailUrl
                    ? <Box component="img" src={el.data.thumbnailUrl}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SlideshowRoundedIcon sx={{ fontSize: elH * 0.35, color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />
                      </Box>
                  }
                </Box>
              )}
              {el.type === 'drawing' && el.data?.pathData && (
                <Box component="svg" viewBox={`0 0 ${elW} ${elH}`}
                  sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <path d={el.data.pathData}
                    stroke={el.data.stroke || '#000'}
                    strokeWidth={(el.data.strokeWidth || 2) * scale}
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});
MiniSlidePreview.displayName = 'MiniSlidePreview';
