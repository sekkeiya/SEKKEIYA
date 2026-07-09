/**
 * RegionSelectLayer — 中央画像の上に重ねる編集対象の矩形選択レイヤー。
 * object-fit: contain のレターボックスを考慮し、画像コンテンツ基準の正規化座標(0..1)で
 * 範囲を保持する（将来のマスク編集にそのまま使えるように）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useDsiEditorStore, type DsiRegion } from '../store/useDsiEditorStore';

const REGION_COLOR = '#ff3b6b';

export const RegionSelectLayer: React.FC<{ imageUrl: string; enabled: boolean }> = ({ imageUrl, enabled }) => {
  const region = useDsiEditorStore(s => s.region);
  const setRegion = useDsiEditorStore(s => s.setRegion);

  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<DsiRegion | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // コンテナサイズ
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 画像の実寸（アスペクト計算用）
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  // 画像コンテンツの表示矩形（contain）
  const { w: cw, h: ch } = size;
  const { w: nw, h: nh } = nat;
  const content = (() => {
    if (!cw || !ch || !nw || !nh) return { x: 0, y: 0, w: cw, h: ch };
    const scale = Math.min(cw / nw, ch / nh);
    const dw = nw * scale, dh = nh * scale;
    return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh };
  })();

  const toNorm = useCallback((clientX: number, clientY: number) => {
    const rect = layerRef.current!.getBoundingClientRect();
    const px = clientX - rect.left - content.x;
    const py = clientY - rect.top - content.y;
    return {
      x: Math.max(0, Math.min(1, content.w ? px / content.w : 0)),
      y: Math.max(0, Math.min(1, content.h ? py / content.h : 0)),
    };
  }, [content.x, content.y, content.w, content.h]);

  const onDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    const p = toNorm(e.clientX, e.clientY);
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!enabled || !startRef.current) return;
    const p = toNorm(e.clientX, e.clientY);
    const s = startRef.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => {
    if (!enabled || !startRef.current) return;
    startRef.current = null;
    setDraft((d) => {
      if (d && d.w > 0.01 && d.h > 0.01) setRegion(d);
      return null;
    });
  };

  const box = draft || region;

  return (
    <Box
      ref={layerRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      sx={{ position: 'absolute', inset: 0, cursor: enabled ? 'crosshair' : 'default', pointerEvents: enabled ? 'auto' : 'none', zIndex: 4 }}
    >
      {box && content.w > 0 && (
        <Box sx={{
          position: 'absolute',
          left: content.x + box.x * content.w,
          top: content.y + box.y * content.h,
          width: box.w * content.w,
          height: box.h * content.h,
          border: `2px solid ${REGION_COLOR}`,
          bgcolor: 'rgba(255,59,107,0.10)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.22)',
          pointerEvents: 'none',
        }} />
      )}
    </Box>
  );
};

export default RegionSelectLayer;
