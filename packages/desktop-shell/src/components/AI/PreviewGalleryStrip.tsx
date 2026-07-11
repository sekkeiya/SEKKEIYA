// PreviewGalleryStrip — プレビュー下部の共通「表紙ギャラリー」（SEKKEIYA Reader の ReaderGallery を汎用化）。
// SEKKEIYA Drive / S.Image のプレビューで UI/UX を統一するために使う。
//  - 横ドラッグを弾くと慣性でスーッと流れて最寄りカードに吸着
//  - ホイールで1枚ずつ送り／カードクリックで選択
//  - 表示中アイテムが変わると中央へ追従（←/→キー処理は親側で onSelect を呼ぶ）
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

export interface StripItem {
  id: string;
  image?: string | null;
  title?: string;
  subtitle?: string;
}

const CARD_W = 136;
const CARD_H = 82;
const GAP = 12;
const STEP = CARD_W + GAP;

const hueOf = (s: string) => [...(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export const PreviewGalleryStrip: React.FC<{
  items: StripItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  accent?: string;
}> = ({ items, activeIndex, onSelect, accent = '#00BFFF' }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(() => Math.max(0, activeIndex) * STEP);
  const [smooth, setSmooth] = useState(true);
  const maxOffset = Math.max(0, (items.length - 1) * STEP);
  const clampOff = (v: number) => Math.min(maxOffset, Math.max(0, v));

  useEffect(() => {
    if (activeIndex >= 0) { setSmooth(true); setOffset(activeIndex * STEP); }
  }, [activeIndex]);

  const drag = useRef({ active: false, startX: 0, startOffset: 0, lastX: 0, lastT: 0, v: 0, moved: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, startX: e.clientX, startOffset: offset, lastX: e.clientX, lastT: performance.now(), v: 0, moved: 0 };
    setSmooth(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    d.v = 0.8 * d.v + 0.2 * (dx / Math.max(1, now - d.lastT));
    d.lastX = e.clientX; d.lastT = now; d.moved += Math.abs(dx);
    setOffset(clampOff(d.startOffset - (e.clientX - d.startX)));
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (d.moved < 6) {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const px = d.lastX - rect.left;
        const i = Math.round((px - rect.width / 2 + offset) / STEP);
        const clamped = Math.min(items.length - 1, Math.max(0, i));
        setSmooth(true); setOffset(clamped * STEP); onSelect(clamped);
      }
      return;
    }
    const projected = clampOff(offset - d.v * 320);
    setSmooth(true);
    setOffset(clampOff(Math.round(projected / STEP) * STEP));
  };
  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    setSmooth(true);
    setOffset((o) => clampOff((Math.round(o / STEP) + Math.sign(delta)) * STEP));
  };

  return (
    <Box
      ref={rootRef}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      sx={{ position: 'relative', height: CARD_H + 40, flexShrink: 0, overflow: 'hidden', userSelect: 'none',
        bgcolor: 'rgba(7,9,14,0.92)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        cursor: 'grab', '&:active': { cursor: 'grabbing' }, touchAction: 'pan-y' }}
    >
      {/* 中央フォーカスの目印 */}
      <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
        width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${accent}` }} />
      {/* 両端のフェード */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(90deg, rgba(7,9,14,0.95) 0%, transparent 12%, transparent 88%, rgba(7,9,14,0.95) 100%)' }} />

      {/* カードの帯 */}
      <Box sx={{ position: 'absolute', top: 13, left: '50%', display: 'flex', gap: `${GAP}px`,
        transform: `translateX(${-CARD_W / 2 - offset}px)`,
        transition: smooth ? 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none', willChange: 'transform' }}>
        {items.map((it, i) => {
          const dist = Math.abs(i * STEP - offset) / STEP;
          const scale = Math.max(0.8, 1 - dist * 0.09);
          const opacity = Math.max(0.4, 1 - dist * 0.16);
          const isActive = i === activeIndex;
          const hue = hueOf(it.subtitle || it.title || it.id);
          return (
            <Box key={it.id}
              sx={{ width: CARD_W, height: CARD_H, flexShrink: 0, borderRadius: 2, overflow: 'hidden', position: 'relative',
                transform: `scale(${scale})`, opacity,
                transition: 'transform 220ms ease, opacity 220ms ease, box-shadow 220ms ease',
                border: isActive ? `2px solid ${accent}` : '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
                boxShadow: isActive ? `0 0 18px ${accent}55` : dist < 0.5 ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
                bgcolor: `hsl(${hue},35%,16%)`, cursor: 'pointer' }}>
              {it.image && (
                <Box component="img" src={it.image} alt="" loading="lazy" draggable={false}
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
              )}
              <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: 0.75, pt: 2, pb: 0.5,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
                <Typography noWrap sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.92)', lineHeight: 1.3 }}>
                  {it.title || '無題'}
                </Typography>
                {it.subtitle && (
                  <Typography noWrap sx={{ fontSize: 8, color: `hsl(${hue},60%,72%)`, fontWeight: 700 }}>
                    {it.subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 操作ヒント */}
      <Typography sx={{ position: 'absolute', right: 12, bottom: 4, zIndex: 3, fontSize: 9.5,
        color: 'rgb(var(--brand-fg-rgb) / 0.3)', pointerEvents: 'none' }}>
        ドラッグ / ← → / クリックで移動{activeIndex >= 0 ? `（${activeIndex + 1}/${items.length}）` : ''}
      </Typography>
    </Box>
  );
};

export default PreviewGalleryStrip;
