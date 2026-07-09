/**
 * ReaderGallery — SEKKEIYA Reader 下部の「表紙ギャラリー」（CD選曲風の Cover Flow）。
 *
 * フィードの記事の表紙が横一列に並び、中央の1枚が大きくフォーカスされる。
 * - マウスの横ドラッグを「スッ」と弾くと、慣性でスーッと流れて最寄りのカードに吸着（iOS風の投影スナップ）
 * - ホイールでも1枚ずつ送れる
 * - カードをクリックするとその記事を表示（ドラッグと区別するため移動量6px未満のみクリック扱い）
 * - ←/→キーやクリックで記事が変わると、ギャラリーも中央へスーッと追従する
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { BlogSourceRef } from './types';

const ACCENT = '#e57373';
const CARD_W = 136;
const CARD_H = 82;
const GAP = 12;
const STEP = CARD_W + GAP;

// 媒体名から安定した色相（表紙なしカードの背景用。ホームのバッジと同じ流儀）
const hueOf = (s: string) => [...(s || 'web')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

interface ReaderGalleryProps {
  items: BlogSourceRef[];
  /** 表示中の記事の index（プレイリスト外なら -1） */
  activeIndex: number;
  onSelect: (index: number) => void;
}

export const ReaderGallery: React.FC<ReaderGalleryProps> = ({ items, activeIndex, onSelect }) => {
  const [offset, setOffset] = useState(() => Math.max(0, activeIndex) * STEP);
  const [smooth, setSmooth] = useState(true); // CSSトランジションで滑らかに動かすか（ドラッグ中はOFF）
  const maxOffset = Math.max(0, (items.length - 1) * STEP);
  const clampOff = (v: number) => Math.min(maxOffset, Math.max(0, v));

  // ←/→キーやカードクリックで記事が変わったら、その表紙を中央へスーッと寄せる
  useEffect(() => {
    if (activeIndex >= 0) {
      setSmooth(true);
      setOffset(activeIndex * STEP);
    }
  }, [activeIndex]);

  // ドラッグ＋慣性（投影スナップ）: 速度を平滑化し、離した瞬間の勢いで先のカードまで滑る
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
    d.v = 0.8 * d.v + 0.2 * (dx / Math.max(1, now - d.lastT)); // px/ms（平滑化）
    d.lastX = e.clientX;
    d.lastT = now;
    d.moved += Math.abs(dx);
    setOffset(clampOff(d.startOffset - (e.clientX - d.startX)));
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    // 慣性の投影距離（離した速度 × 320ms ぶん先）→ 最寄りのカードへ吸着
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

  const handleCardClick = (i: number) => {
    if (drag.current.moved >= 6) return; // ドラッグはクリック扱いしない
    setSmooth(true);
    setOffset(i * STEP);
    onSelect(i);
  };

  return (
    <Box
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      sx={{ position: 'relative', height: CARD_H + 40, flexShrink: 0, overflow: 'hidden', userSelect: 'none',
        bgcolor: 'rgba(7,9,14,0.92)', borderTop: '1px solid rgba(255,255,255,0.08)',
        cursor: 'grab', '&:active': { cursor: 'grabbing' }, touchAction: 'pan-y' }}
    >
      {/* 中央フォーカスの目印（下向きの小さな三角） */}
      <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
        width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: `5px solid ${ACCENT}` }} />
      {/* 両端のフェード */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(90deg, rgba(7,9,14,0.95) 0%, transparent 12%, transparent 88%, rgba(7,9,14,0.95) 100%)' }} />

      {/* カードの帯 */}
      <Box sx={{ position: 'absolute', top: 13, left: '50%', display: 'flex', gap: `${GAP}px`,
        transform: `translateX(${-CARD_W / 2 - offset}px)`,
        transition: smooth ? 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
        willChange: 'transform' }}>
        {items.map((it, i) => {
          const dist = Math.abs(i * STEP - offset) / STEP; // 中央からの距離（枚数）
          const scale = Math.max(0.8, 1 - dist * 0.09);
          const opacity = Math.max(0.4, 1 - dist * 0.16);
          const isActive = i === activeIndex;
          return (
            <Box key={`${it.url}-${i}`} onClick={() => handleCardClick(i)}
              sx={{ width: CARD_W, height: CARD_H, flexShrink: 0, borderRadius: 2, overflow: 'hidden', position: 'relative',
                transform: `scale(${scale})`, opacity,
                transition: 'transform 220ms ease, opacity 220ms ease, box-shadow 220ms ease',
                border: isActive ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)',
                boxShadow: isActive ? '0 0 18px rgba(229,115,115,0.35)' : dist < 0.5 ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
                bgcolor: `hsl(${hueOf(it.source || '')},35%,16%)`, cursor: 'pointer' }}>
              {it.image && (
                <Box component="img" src={it.image} alt="" loading="lazy" draggable={false}
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
              )}
              {/* タイトル帯（下部グラデーション） */}
              <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: 0.75, pt: 2, pb: 0.5,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
                <Typography noWrap sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3 }}>
                  {it.title}
                </Typography>
                <Typography noWrap sx={{ fontSize: 8, color: `hsl(${hueOf(it.source || '')},60%,72%)`, fontWeight: 700 }}>
                  {it.source || 'Web'}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 操作ヒント */}
      <Typography sx={{ position: 'absolute', right: 12, bottom: 4, zIndex: 3, fontSize: 9.5,
        color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>
        ドラッグ / ← → / クリックで移動{activeIndex >= 0 ? `（${activeIndex + 1}/${items.length}）` : ''}
      </Typography>
    </Box>
  );
};
