import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CropRoundedIcon from '@mui/icons-material/CropRounded';
type ImageCrop = { x: number; y: number; w: number; h: number };

interface DragState {
  type: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  startX: number;
  startY: number;
  startBox: ImageCrop;
}

const MIN_CROP = 0.04;

const HANDLES: { type: DragState['type']; pos: React.CSSProperties; cursor: string }[] = [
  { type: 'nw', pos: { top: -5, left:   -5 }, cursor: 'nw-resize' },
  { type: 'n',  pos: { top: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'n-resize' },
  { type: 'ne', pos: { top: -5, right:  -5 }, cursor: 'ne-resize' },
  { type: 'e',  pos: { top: '50%', right: -5, transform: 'translateY(-50%)' }, cursor: 'e-resize' },
  { type: 'se', pos: { bottom: -5, right: -5 }, cursor: 'se-resize' },
  { type: 's',  pos: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 's-resize' },
  { type: 'sw', pos: { bottom: -5, left:  -5 }, cursor: 'sw-resize' },
  { type: 'w',  pos: { top: '50%', left:  -5, transform: 'translateY(-50%)' }, cursor: 'w-resize' },
];

interface Props {
  src: string;
  initialCrop?: ImageCrop;
  onApply: (crop: ImageCrop) => void;
  onCancel: () => void;
}

export const CropOverlay: React.FC<Props> = ({ src, initialCrop, onApply, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const imgSizeRef = useRef({ w: 0, h: 0 });

  const [box, setBox] = useState<ImageCrop>(initialCrop ?? { x: 0, y: 0, w: 1, h: 1 });
  const boxRef = useRef(box);
  useEffect(() => { boxRef.current = box; }, [box]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter')  { e.preventDefault(); onApply(boxRef.current); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onApply, onCancel]);

  const syncImgSize = () => {
    if (imgRef.current) {
      imgSizeRef.current = { w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight };
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { w: imgW, h: imgH } = imgSizeRef.current;
    if (!imgW || !imgH) return;

    const dx = (e.clientX - drag.startX) / imgW;
    const dy = (e.clientY - drag.startY) / imgH;
    let { x, y, w, h } = drag.startBox;

    if (drag.type === 'move') {
      x = Math.max(0, Math.min(1 - w, x + dx));
      y = Math.max(0, Math.min(1 - h, y + dy));
    } else {
      if (drag.type.includes('w')) {
        const nx = Math.max(0, Math.min(x + w - MIN_CROP, x + dx));
        w = w - (nx - x); x = nx;
      }
      if (drag.type.includes('e')) { w = Math.max(MIN_CROP, Math.min(1 - x, w + dx)); }
      if (drag.type.includes('n')) {
        const ny = Math.max(0, Math.min(y + h - MIN_CROP, y + dy));
        h = h - (ny - y); y = ny;
      }
      if (drag.type.includes('s')) { h = Math.max(MIN_CROP, Math.min(1 - y, h + dy)); }
    }
    setBox({ x, y, w, h });
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = (type: DragState['type'], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    syncImgSize();
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...boxRef.current } };
  };

  // Pixel positions relative to the displayed image
  const { w: imgW, h: imgH } = imgSizeRef.current;
  const px = {
    left:   box.x * imgW,
    top:    box.y * imgH,
    width:  box.w * imgW,
    height: box.h * imgH,
  };

  const [, forceRender] = useState(0);
  const handleImgLoad = () => { syncImgSize(); forceRender(n => n + 1); };

  return (
    <Box
      sx={{
        position: 'absolute', inset: 0, zIndex: 500,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.82)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header hint */}
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CropRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          ドラッグしてトリミング範囲を調整 — Enter で適用 / Esc でキャンセル
        </Typography>
      </Box>

      {/* Image + crop box */}
      <Box sx={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
        <Box
          component="img"
          ref={imgRef}
          src={src}
          onLoad={handleImgLoad}
          draggable={false}
          sx={{ display: 'block', maxWidth: '72vw', maxHeight: '62vh', objectFit: 'contain', userSelect: 'none' }}
        />

        {/* Dark mask outside crop area */}
        {imgW > 0 && (
          <svg
            style={{ position: 'absolute', inset: 0, width: imgW, height: imgH, pointerEvents: 'none', display: 'block' }}
          >
            <defs>
              <mask id="crop-cutout">
                <rect width={imgW} height={imgH} fill="white" />
                <rect x={px.left} y={px.top} width={px.width} height={px.height} fill="black" />
              </mask>
            </defs>
            <rect width={imgW} height={imgH} fill="rgba(0,0,0,0.55)" mask="url(#crop-cutout)" />
            {/* Crop border */}
            <rect x={px.left} y={px.top} width={px.width} height={px.height} fill="none" stroke="white" strokeWidth={1.5} />
            {/* Rule-of-thirds grid */}
            <line x1={px.left + px.width / 3} y1={px.top} x2={px.left + px.width / 3} y2={px.top + px.height} stroke="rgb(var(--brand-fg-rgb) / 0.35)" strokeWidth={1} />
            <line x1={px.left + px.width * 2 / 3} y1={px.top} x2={px.left + px.width * 2 / 3} y2={px.top + px.height} stroke="rgb(var(--brand-fg-rgb) / 0.35)" strokeWidth={1} />
            <line x1={px.left} y1={px.top + px.height / 3} x2={px.left + px.width} y2={px.top + px.height / 3} stroke="rgb(var(--brand-fg-rgb) / 0.35)" strokeWidth={1} />
            <line x1={px.left} y1={px.top + px.height * 2 / 3} x2={px.left + px.width} y2={px.top + px.height * 2 / 3} stroke="rgb(var(--brand-fg-rgb) / 0.35)" strokeWidth={1} />
          </svg>
        )}

        {/* Draggable crop area */}
        {imgW > 0 && (
          <Box
            onMouseDown={(e) => startDrag('move', e)}
            sx={{
              position: 'absolute',
              left: px.left, top: px.top, width: px.width, height: px.height,
              cursor: 'move',
            }}
          >
            {/* 8 resize handles */}
            {HANDLES.map(({ type, pos, cursor }) => (
              <Box
                key={type}
                onMouseDown={(e) => startDrag(type, e)}
                sx={{
                  position: 'absolute',
                  width: 10, height: 10,
                  bgcolor: '#fff', border: '1.5px solid rgba(0,0,0,0.4)',
                  borderRadius: '2px', cursor,
                  ...pos,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Buttons */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1.5 }}>
        <Button
          variant="outlined" size="small"
          onClick={onCancel}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { borderColor: '#fff' } }}
        >
          キャンセル
        </Button>
        <Button
          variant="contained" size="small"
          onClick={() => onApply(boxRef.current)}
          sx={{ bgcolor: '#007aff', '&:hover': { bgcolor: '#0066cc' }, fontWeight: 700 }}
        >
          適用
        </Button>
      </Box>
    </Box>
  );
};
