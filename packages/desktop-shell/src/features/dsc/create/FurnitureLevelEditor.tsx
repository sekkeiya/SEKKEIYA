// @ts-nocheck
/**
 * FurnitureLevelEditor — 家具タイプ別プロパティエディタ
 * テーブル: 脚スタイル選択 + 全体W/D/H
 * チェア: 座面高・幅・奥行
 * ソファ: 幅
 * ベッド: サイズプリセット + W/D
 * キャビネット: W/H/D
 */
import React, { useMemo } from 'react';
import { Box, Typography, Slider, Divider, Tooltip } from '@mui/material';
import { useDscStore } from '../store/useDscStore';

const ACCENT     = '#ffa726';
const DIM_COLOR  = '#66bb6a';
const LABEL_SX   = { color: 'rgba(255,255,255,0.38)', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3 };
const SECTION_SX = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 700, mb: 0.75 };

// ─── Furniture type detection ─────────────────────────────────────────────────

type FurnitureType = 'table' | 'chair' | 'sofa' | 'bed' | 'cabinet' | 'other';

function detectType(name: string, components: any[]): FurnitureType {
  const n = (name || '').toLowerCase();
  if (/テーブル|デスク|卓/.test(n))              return 'table';
  if (/チェア|スツール|椅子|座椅子/.test(n))      return 'chair';
  if (/ソファ|ベンチ/.test(n))                    return 'sofa';
  if (/ベッド|ベット/.test(n))                    return 'bed';
  if (/棚|キャビネット|ロッカー|シェルフ/.test(n)) return 'cabinet';
  const types = new Set(components.map((c: any) => c.type));
  if (types.has('top_board') && types.has('leg')) return 'table';
  if (types.has('shelf') || types.has('back_panel')) return 'cabinet';
  return 'other';
}

// ─── Leg style SVG icons ──────────────────────────────────────────────────────

const LEG_ICONS: Record<string, React.ReactNode> = {
  square: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <rect x="2"  y="3" width="8" height="20" rx="1" fill="currentColor"/>
      <rect x="26" y="3" width="8" height="20" rx="1" fill="currentColor"/>
      <rect x="2"  y="2" width="32" height="5" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  slim: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <rect x="5"  y="3" width="4" height="21" rx="1" fill="currentColor"/>
      <rect x="27" y="3" width="4" height="21" rx="1" fill="currentColor"/>
      <rect x="2"  y="2" width="32" height="4" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  hairpin: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <line x1="5"  y1="24" x2="8"  y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="11" y1="24" x2="8"  y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="25" y1="24" x2="28" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="31" y1="24" x2="28" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="2"   y="2"  width="32" height="4" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  a_frame: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <line x1="4"  y1="25" x2="11" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="14" y1="25" x2="7"  y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="22" y1="25" x2="29" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="32" y1="25" x2="25" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <rect x="2"   y="2"  width="32" height="4" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  panel_end: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <rect x="2"  y="4" width="10" height="20" rx="1" fill="currentColor"/>
      <rect x="24" y="4" width="10" height="20" rx="1" fill="currentColor"/>
      <rect x="2"  y="2" width="32" height="5" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  trestle: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <rect x="2"  y="3" width="5" height="20" rx="1" fill="currentColor"/>
      <rect x="9"  y="3" width="5" height="20" rx="1" fill="currentColor"/>
      <rect x="22" y="3" width="5" height="20" rx="1" fill="currentColor"/>
      <rect x="29" y="3" width="5" height="20" rx="1" fill="currentColor"/>
      <rect x="2"  y="13" width="32" height="3.5" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="2"  y="2" width="32" height="4" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  bench_h: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <rect x="2"  y="3" width="5" height="21" rx="1" fill="currentColor"/>
      <rect x="9"  y="3" width="5" height="21" rx="1" fill="currentColor"/>
      <rect x="22" y="3" width="5" height="21" rx="1" fill="currentColor"/>
      <rect x="29" y="3" width="5" height="21" rx="1" fill="currentColor"/>
      <rect x="2"  y="14" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="22" y="14" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="2"  y="2"  width="32" height="4"   rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 36 28" width="36" height="28">
      <line x1="4"  y1="24" x2="13" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="13" y1="24" x2="4"  y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="23" y1="24" x2="32" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <line x1="32" y1="24" x2="23" y2="4"  stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <rect x="2"   y="2"  width="32" height="4" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
};

const LEG_STYLES = [
  { key: 'square',    label: 'スクエア'   },
  { key: 'slim',      label: 'スリム'     },
  { key: 'hairpin',   label: 'ヘアピン'   },
  { key: 'a_frame',   label: 'A字脚'      },
  { key: 'panel_end', label: 'パネル脚'   },
  { key: 'trestle',   label: 'トレッスル' },
  { key: 'bench_h',   label: 'H字脚'      },
  { key: 'cross',     label: 'X字脚'      },
];

// ─── Generate leg components for a given style ────────────────────────────────

function generateLegs(style: string, tableW: number, tableD: number, legH: number, color: string) {
  const ix = tableW / 2 * 0.88;  // inset from X edge
  const iz = tableD / 2 * 0.85;  // inset from Z(depth) edge

  const makeLegs = (lw: number, ld: number) => [
    { name: '左前脚', dimensions: { width: lw, height: legH, depth: ld }, position: [-ix, 0, -iz] as [number,number,number], color, type: 'leg' as const },
    { name: '右前脚', dimensions: { width: lw, height: legH, depth: ld }, position: [ ix, 0, -iz] as [number,number,number], color, type: 'leg' as const },
    { name: '左後脚', dimensions: { width: lw, height: legH, depth: ld }, position: [-ix, 0,  iz] as [number,number,number], color, type: 'leg' as const },
    { name: '右後脚', dimensions: { width: lw, height: legH, depth: ld }, position: [ ix, 0,  iz] as [number,number,number], color, type: 'leg' as const },
  ];

  switch (style) {
    case 'square':    return makeLegs(Math.max(40, Math.round(tableW * 0.055)), Math.max(40, Math.round(tableW * 0.055)));
    case 'slim':      return makeLegs(Math.max(20, Math.round(tableW * 0.028)), Math.max(20, Math.round(tableW * 0.028)));
    case 'hairpin':   return makeLegs(14, 14);
    case 'a_frame': {
      const pw = Math.max(18, Math.round(tableW * 0.03));
      return [
        { name: '左A脚', type: 'leg' as const, dimensions: { width: pw, height: legH, depth: Math.round(tableD * 0.72) }, position: [-ix, 0, 0] as [number,number,number], color },
        { name: '右A脚', type: 'leg' as const, dimensions: { width: pw, height: legH, depth: Math.round(tableD * 0.72) }, position: [ ix, 0, 0] as [number,number,number], color },
      ];
    }
    case 'panel_end': {
      const ph = Math.max(12, Math.round(tableD * 0.035));
      return [
        { name: '前パネル脚', type: 'leg' as const, dimensions: { width: Math.round(tableW * 0.88), height: legH, depth: ph }, position: [0, 0, -iz] as [number,number,number], color },
        { name: '後パネル脚', type: 'leg' as const, dimensions: { width: Math.round(tableW * 0.88), height: legH, depth: ph }, position: [0, 0,  iz] as [number,number,number], color },
      ];
    }
    case 'trestle': {
      const lw = Math.max(28, Math.round(tableW * 0.04));
      const barH = Math.max(18, Math.round(legH * 0.04));
      const barY = Math.round(legH * 0.35);
      return [
        ...makeLegs(lw, lw),
        { name: '前貫', type: 'panel' as const, dimensions: { width: Math.round(tableW * 0.82), height: barH, depth: barH }, position: [0, barY, -iz] as [number,number,number], color },
        { name: '後貫', type: 'panel' as const, dimensions: { width: Math.round(tableW * 0.82), height: barH, depth: barH }, position: [0, barY,  iz] as [number,number,number], color },
      ];
    }
    case 'bench_h': {
      const lw = Math.max(28, Math.round(tableW * 0.04));
      const barH = Math.max(18, Math.round(tableD * 0.04));
      const barY = Math.round(legH * 0.4);
      const barD = Math.round(tableD * 0.76);
      return [
        ...makeLegs(lw, lw),
        { name: '左貫', type: 'panel' as const, dimensions: { width: lw, height: barH, depth: barD }, position: [-ix, barY, 0] as [number,number,number], color },
        { name: '右貫', type: 'panel' as const, dimensions: { width: lw, height: barH, depth: barD }, position: [ ix, barY, 0] as [number,number,number], color },
      ];
    }
    case 'cross': {
      const pw = Math.max(18, Math.round(tableD * 0.055));
      const hd = Math.round(tableD * 0.5);
      return [
        { name: '左X前', type: 'leg' as const, dimensions: { width: pw, height: Math.round(legH * 0.82), depth: hd }, position: [-ix, Math.round(legH * 0.09), Math.round(-tableD * 0.13)] as [number,number,number], color },
        { name: '左X後', type: 'leg' as const, dimensions: { width: pw, height: Math.round(legH * 0.82), depth: hd }, position: [-ix, Math.round(legH * 0.09), Math.round( tableD * 0.13)] as [number,number,number], color },
        { name: '右X前', type: 'leg' as const, dimensions: { width: pw, height: Math.round(legH * 0.82), depth: hd }, position: [ ix, Math.round(legH * 0.09), Math.round(-tableD * 0.13)] as [number,number,number], color },
        { name: '右X後', type: 'leg' as const, dimensions: { width: pw, height: Math.round(legH * 0.82), depth: hd }, position: [ ix, Math.round(legH * 0.09), Math.round( tableD * 0.13)] as [number,number,number], color },
      ];
    }
    default: return makeLegs(60, 60);
  }
}

// ─── Prop slider helper ───────────────────────────────────────────────────────

function PropSlider({ label, value, min, max, step = 10, color = DIM_COLOR, unit = 'cm', onChange }: any) {
  const displayVal = unit === 'cm' ? Math.round(value / 10) : value;
  const sliderMin  = unit === 'cm' ? min / 10 : min;
  const sliderMax  = unit === 'cm' ? max / 10 : max;
  return (
    <Box sx={{ mb: 1.2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.2 }}>
        <Typography sx={LABEL_SX}>{label}</Typography>
        <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
          {displayVal}{unit}
        </Typography>
      </Box>
      <Slider
        size="small" min={sliderMin} max={sliderMax} step={unit === 'cm' ? 1 : step}
        value={displayVal}
        onChange={(_, v) => onChange(unit === 'cm' ? (v as number) * 10 : (v as number))}
        sx={{
          color, height: 3, py: '5px',
          '& .MuiSlider-thumb': { width: 11, height: 11, '&:hover': { boxShadow: `0 0 0 6px ${color}28` } },
          '& .MuiSlider-rail': { opacity: 0.18 },
        }}
      />
    </Box>
  );
}

// ─── Table editor ─────────────────────────────────────────────────────────────

function TableEditor() {
  const { components, legStyle, setLegStyle, setComponents } = useDscStore();

  const topBoard = useMemo(() => components.find((c: any) => c.type === 'top_board'), [components]);
  const legs     = useMemo(() => components.filter((c: any) => c.type === 'leg' || c.name?.includes('脚') || c.name?.includes('貫')), [components]);
  const nonLeg   = useMemo(() => components.filter((c: any) => c.type === 'top_board'), [components]);

  const tableW = topBoard?.dimensions.width  ?? 1400;
  const tableD = topBoard?.dimensions.depth  ?? 800;
  const legH   = legs.find((c: any) => c.type === 'leg')?.dimensions.height ?? 690;
  const legColor = legs[0]?.color ?? '#a07850';
  const topThick = topBoard?.dimensions.height ?? 30;

  const applyLegStyle = (style: string) => {
    setLegStyle(style);
    const newLegs = generateLegs(style, tableW, tableD, legH, legColor);
    const topOnly = components.filter((c: any) => c.type === 'top_board');
    let ctr = Date.now();
    const newLegComps = newLegs.map((l: any) => ({
      id: `comp_${ctr++}_ls`,
      rotation: [0, 0, 0],
      ...l,
    }));
    setComponents([...topOnly, ...newLegComps]);
  };

  const applyDimensions = (newW: number, newD: number, newH: number) => {
    const style = legStyle || 'square';
    const newLegs = generateLegs(style, newW, newD, newH, legColor);
    let ctr = Date.now();
    const topOnly: any[] = [];
    if (topBoard) {
      topOnly.push({
        ...topBoard,
        dimensions: { width: newW, height: topThick, depth: newD },
        position: [0, newH, 0] as [number, number, number],
      });
    }
    const newLegComps = newLegs.map((l: any) => ({
      id: `comp_${ctr++}_ls`,
      rotation: [0, 0, 0],
      ...l,
    }));
    setComponents([...topOnly, ...newLegComps]);
  };

  return (
    <>
      {/* 脚の形 */}
      <Typography sx={SECTION_SX}>■ 脚の形を選ぶ</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.6, mb: 1.5 }}>
        {LEG_STYLES.map(({ key, label }) => {
          const active = (legStyle || 'square') === key;
          return (
            <Tooltip title={label} placement="top" key={key}>
              <Box
                onClick={() => applyLegStyle(key)}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  py: 0.6, px: 0.3, borderRadius: 1.5, cursor: 'pointer',
                  border: active ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.1)',
                  bgcolor: active ? 'rgba(255,167,38,0.1)' : 'rgba(255,255,255,0.03)',
                  color: active ? ACCENT : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: active ? ACCENT : 'rgba(255,255,255,0.3)', color: active ? ACCENT : 'rgba(255,255,255,0.8)', bgcolor: active ? 'rgba(255,167,38,0.12)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                {LEG_ICONS[key]}
                <Typography sx={{ fontSize: 8, mt: 0.3, lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      <Divider sx={{ mb: 1.25, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* 天板サイズ */}
      <Typography sx={SECTION_SX}>■ 天板のサイズを選ぶ</Typography>
      <PropSlider label="幅  W" value={tableW} min={500} max={4000} onChange={(v: number) => applyDimensions(v, tableD, legH)} />
      <PropSlider label="奥行 D" value={tableD} min={300} max={2000} onChange={(v: number) => applyDimensions(tableW, v, legH)} />

      <Divider sx={{ mb: 1.25, mt: 0.25, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* 高さ */}
      <Typography sx={SECTION_SX}>■ 高さ</Typography>
      <PropSlider label="高さ H" value={legH} min={300} max={1100} onChange={(v: number) => applyDimensions(tableW, tableD, v)} />
    </>
  );
}

// ─── Chair editor ──────────────────────────────────────────────────────────────

function ChairEditor() {
  const { components, setComponents } = useDscStore();

  const seat    = useMemo(() => components.find((c: any) => c.name?.includes('座面') || c.name?.includes('座クッション')), [components]);
  const legs    = useMemo(() => components.filter((c: any) => c.name?.includes('脚')), [components]);
  const back    = useMemo(() => components.find((c: any) => c.name?.includes('背もたれ')), [components]);
  const armrest = useMemo(() => components.filter((c: any) => c.name?.includes('肘掛け')), [components]);

  const seatH  = (seat?.position[1] ?? 420);
  const seatW  = (seat?.dimensions.width ?? 450);
  const seatD  = (seat?.dimensions.depth ?? 420);
  const hasArm = armrest.length > 0;

  const updateSeatHeight = (newH: number) => {
    const store = useDscStore.getState();
    // update front legs (shorter) and seat position
    const updated = components.map((c: any) => {
      if (c.name === '左前脚' || c.name === '右前脚') {
        return { ...c, dimensions: { ...c.dimensions, height: newH } };
      }
      if (c.name === '座面' || c.name === '座クッション') {
        return { ...c, position: [c.position[0], newH, c.position[2]] as [number,number,number] };
      }
      if (c.name?.includes('肘掛け')) {
        return { ...c, position: [c.position[0], newH + 80, c.position[2]] as [number,number,number] };
      }
      return c;
    });
    setComponents(updated);
  };

  const updateSeatWidth = (newW: number) => {
    const iw = newW / 2 * 0.82;
    const updated = components.map((c: any) => {
      if (c.name === '座面' || c.name === '座クッション') return { ...c, dimensions: { ...c.dimensions, width: newW - 40 } };
      if (c.name === '左前脚' || c.name === '左後脚') return { ...c, position: [-iw, c.position[1], c.position[2]] as [number,number,number] };
      if (c.name === '右前脚' || c.name === '右後脚') return { ...c, position: [ iw, c.position[1], c.position[2]] as [number,number,number] };
      if (c.name === '背もたれ') return { ...c, dimensions: { ...c.dimensions, width: newW - 60 } };
      if (c.name === '左肘掛け') return { ...c, position: [-newW / 2 - 20, c.position[1], c.position[2]] as [number,number,number] };
      if (c.name === '右肘掛け') return { ...c, position: [ newW / 2 + 20, c.position[1], c.position[2]] as [number,number,number] };
      return c;
    });
    setComponents(updated);
  };

  const updateSeatDepth = (newD: number) => {
    const id = newD / 2 * 0.82;
    const updated = components.map((c: any) => {
      if (c.name === '座面' || c.name === '座クッション') return { ...c, dimensions: { ...c.dimensions, depth: newD - 40 } };
      if (c.name === '左前脚' || c.name === '右前脚') return { ...c, position: [c.position[0], c.position[1], -id] as [number,number,number] };
      if (c.name === '左後脚' || c.name === '右後脚') return { ...c, position: [c.position[0], c.position[1],  id] as [number,number,number] };
      return c;
    });
    setComponents(updated);
  };

  const toggleArmrest = () => {
    if (hasArm) {
      setComponents(components.filter((c: any) => !c.name?.includes('肘掛け')));
    } else {
      // Add armrests
      const w = seatW / 2 + 20;
      let ctr = Date.now();
      const arms = [
        { id: `comp_${ctr++}_arm`, type: 'panel' as const, rotation: [0,0,0],
          name: '左肘掛け', dimensions: { width: 20, height: 60, depth: seatD - 40 },
          position: [-w, seatH + 80, 0] as [number,number,number], color: seat?.color ?? '#c8a882' },
        { id: `comp_${ctr++}_arm`, type: 'panel' as const, rotation: [0,0,0],
          name: '右肘掛け', dimensions: { width: 20, height: 60, depth: seatD - 40 },
          position: [ w, seatH + 80, 0] as [number,number,number], color: seat?.color ?? '#c8a882' },
      ];
      setComponents([...components, ...arms]);
    }
  };

  return (
    <>
      <Typography sx={SECTION_SX}>■ 座面の高さ</Typography>
      <PropSlider label="座面高さ H" value={seatH} min={350} max={800} onChange={updateSeatHeight} />

      <Divider sx={{ mb: 1.25, mt: 0.25, borderColor: 'rgba(255,255,255,0.06)' }} />
      <Typography sx={SECTION_SX}>■ サイズ</Typography>
      <PropSlider label="幅  W" value={seatW} min={300} max={800} onChange={updateSeatWidth} />
      <PropSlider label="奥行 D" value={seatD} min={300} max={700} onChange={updateSeatDepth} />

      <Divider sx={{ mb: 1.25, mt: 0.25, borderColor: 'rgba(255,255,255,0.06)' }} />
      <Typography sx={SECTION_SX}>■ 肘掛け</Typography>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {[{ v: true, label: 'あり' }, { v: false, label: 'なし' }].map(({ v, label }) => (
          <Box key={label} onClick={() => { if (v !== hasArm) toggleArmrest(); }}
            sx={{
              flex: 1, py: 0.6, textAlign: 'center', borderRadius: 1.5, cursor: 'pointer', fontSize: 10, fontWeight: 700,
              border: (v === hasArm) ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.1)',
              color:  (v === hasArm) ? ACCENT : 'rgba(255,255,255,0.4)',
              bgcolor:(v === hasArm) ? 'rgba(255,167,38,0.08)' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': { borderColor: (v === hasArm) ? ACCENT : 'rgba(255,255,255,0.25)' },
            }}>{label}</Box>
        ))}
      </Box>
    </>
  );
}

// ─── Sofa editor ──────────────────────────────────────────────────────────────

function SofaEditor() {
  const { components, setComponents } = useDscStore();

  const base = useMemo(() => components.find((c: any) => c.name === 'ベース'), [components]);
  const totalW = base?.dimensions.width ?? 1400;
  const totalD = base?.dimensions.depth ?? 700;

  const updateWidth = (newW: number) => {
    const scale = newW / totalW;
    const updated = components.map((c: any) => ({
      ...c,
      dimensions: c.name === 'ベース' || c.name === '背もたれ'
        ? { ...c.dimensions, width: Math.round(c.dimensions.width * scale) }
        : c.dimensions,
      position: [Math.round(c.position[0] * scale), c.position[1], c.position[2]] as [number,number,number],
    }));
    // update side panel positions exactly
    const finalUpdated = updated.map((c: any) => {
      if (c.name === '左アーム') return { ...c, position: [-Math.round(newW / 2 - 50), c.position[1], c.position[2]] as [number,number,number] };
      if (c.name === '右アーム') return { ...c, position: [ Math.round(newW / 2 - 50), c.position[1], c.position[2]] as [number,number,number] };
      return c;
    });
    setComponents(finalUpdated);
  };

  const updateDepth = (newD: number) => {
    const updated = components.map((c: any) => ({
      ...c,
      dimensions: ['ベース', '背もたれ', '左アーム', '右アーム'].includes(c.name)
        ? { ...c.dimensions, depth: Math.round(c.dimensions.depth * newD / totalD) }
        : c.dimensions,
    }));
    setComponents(updated);
  };

  return (
    <>
      <Typography sx={SECTION_SX}>■ サイズ</Typography>
      <PropSlider label="幅  W" value={totalW} min={600} max={3500} onChange={updateWidth} />
      <PropSlider label="奥行 D" value={totalD} min={500} max={1200} onChange={updateDepth} />
    </>
  );
}

// ─── Bed editor ───────────────────────────────────────────────────────────────

const BED_PRESETS = [
  { key: 'S',   label: 'S',  width: 970  },
  { key: 'SD',  label: 'SD', width: 1220 },
  { key: 'D',   label: 'D',  width: 1400 },
  { key: 'Q',   label: 'Q',  width: 1600 },
  { key: 'K',   label: 'K',  width: 1800 },
];
const BED_LENGTH = 2030;

function BedEditor() {
  const { components, setComponents } = useDscStore();

  const frame = useMemo(() => components.find((c: any) => c.type === 'top_board' || c.name?.includes('フレーム') || c.name?.includes('マットレス')), [components]);
  const frameW = frame?.dimensions.width ?? 1400;
  const activePreset = BED_PRESETS.find(p => Math.abs(p.width - frameW) < 50)?.key ?? null;

  const applyPreset = (width: number) => {
    const scale = width / frameW;
    const updated = components.map((c: any) => ({
      ...c,
      dimensions: { ...c.dimensions, width: Math.round(c.dimensions.width * scale) },
      position: [Math.round(c.position[0] * scale), c.position[1], c.position[2]] as [number,number,number],
    }));
    setComponents(updated);
  };

  const applyWidth = (newW: number) => applyPreset(newW);

  const applyLength = (newL: number) => {
    const curL = frame?.dimensions.depth ?? BED_LENGTH;
    const scale = newL / curL;
    const updated = components.map((c: any) => ({
      ...c,
      dimensions: { ...c.dimensions, depth: Math.round(c.dimensions.depth * scale) },
      position: [c.position[0], c.position[1], Math.round(c.position[2] * scale)] as [number,number,number],
    }));
    setComponents(updated);
  };

  const curL = frame?.dimensions.depth ?? BED_LENGTH;

  return (
    <>
      <Typography sx={SECTION_SX}>■ サイズを選ぶ</Typography>
      <Box sx={{ display: 'flex', gap: 0.6, mb: 1.5 }}>
        {BED_PRESETS.map(({ key, label, width }) => (
          <Tooltip title={`${Math.round(width/10)}cm`} placement="top" key={key}>
            <Box onClick={() => applyPreset(width)}
              sx={{
                flex: 1, py: 0.75, textAlign: 'center', borderRadius: 1.5, cursor: 'pointer',
                fontSize: 10, fontWeight: 700,
                border: activePreset === key ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.12)',
                color:  activePreset === key ? ACCENT : 'rgba(255,255,255,0.45)',
                bgcolor:activePreset === key ? 'rgba(255,167,38,0.09)' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': { borderColor: ACCENT, color: ACCENT },
              }}>{label}</Box>
          </Tooltip>
        ))}
      </Box>

      <PropSlider label="幅  W" value={frameW} min={800} max={2200} onChange={applyWidth} />
      <PropSlider label="長さ L" value={curL}   min={1700} max={2300} onChange={applyLength} />
    </>
  );
}

// ─── Cabinet editor ───────────────────────────────────────────────────────────

function CabinetEditor() {
  const { components, setComponents } = useDscStore();

  const back = useMemo(() => components.find((c: any) => c.type === 'back_panel'), [components]);
  const side = useMemo(() => components.find((c: any) => c.type === 'side_panel'), [components]);

  const cabinetW = back?.dimensions.width  ?? 800;
  const cabinetH = back?.dimensions.height ?? 720;
  const cabinetD = (side ?? back)?.dimensions.depth ?? 400;

  const applyW = (newW: number) => {
    const scale = newW / cabinetW;
    const updated = components.map((c: any) => {
      if (c.type === 'side_panel') return { ...c, position: [Math.round(c.position[0] * scale), c.position[1], c.position[2]] as [number,number,number] };
      if (['back_panel','top_board','bottom_board','shelf','panel'].includes(c.type))
        return { ...c, dimensions: { ...c.dimensions, width: Math.round(c.dimensions.width * scale) } };
      return c;
    });
    setComponents(updated);
  };

  const applyH = (newH: number) => {
    const scale = newH / cabinetH;
    const updated = components.map((c: any) => {
      if (['back_panel','side_panel','frame'].includes(c.type))
        return { ...c, dimensions: { ...c.dimensions, height: Math.round(c.dimensions.height * scale) } };
      if (c.type === 'top_board')
        return { ...c, position: [c.position[0], Math.round(c.position[1] * scale), c.position[2]] as [number,number,number] };
      if (['shelf','panel'].includes(c.type))
        return { ...c, position: [c.position[0], Math.round(c.position[1] * scale), c.position[2]] as [number,number,number] };
      return c;
    });
    setComponents(updated);
  };

  const applyD = (newD: number) => {
    const scale = newD / cabinetD;
    const updated = components.map((c: any) => {
      if (['back_panel','top_board','bottom_board','side_panel','shelf','panel'].includes(c.type))
        return { ...c, dimensions: { ...c.dimensions, depth: Math.round(c.dimensions.depth * scale) } };
      return c;
    });
    setComponents(updated);
  };

  return (
    <>
      <Typography sx={SECTION_SX}>■ サイズ</Typography>
      <PropSlider label="幅  W" value={cabinetW} min={300}  max={3000} onChange={applyW} />
      <PropSlider label="高さ H" value={cabinetH} min={300}  max={3000} onChange={applyH} />
      <PropSlider label="奥行 D" value={cabinetD} min={150}  max={1200} onChange={applyD} />
    </>
  );
}

// ─── Other / generic editor ───────────────────────────────────────────────────

function GenericEditor() {
  return (
    <Box sx={{ py: 2, textAlign: 'center' }}>
      <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
        家具タイプを判別できませんでした。<br/>家具名にテーブル・チェア・ソファ・ベッド・棚などを含めると詳細エディタが表示されます。
      </Typography>
    </Box>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function FurnitureLevelEditor() {
  const { furnitureName, components } = useDscStore();
  const type = useMemo(() => detectType(furnitureName, components), [furnitureName, components]);

  if (components.length === 0) return null;

  const typeLabel: Record<FurnitureType, string> = {
    table:   'テーブル',
    chair:   'チェア',
    sofa:    'ソファ / ベンチ',
    bed:     'ベッド',
    cabinet: 'キャビネット / 棚',
    other:   'その他',
  };

  return (
    <Box sx={{ px: 1.75, pt: 1.5, pb: 1 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
        <Typography sx={{ color: ACCENT, fontSize: 10, fontWeight: 700 }}>
          {typeLabel[type] ?? '家具'}エディタ
        </Typography>
      </Box>

      {type === 'table'   && <TableEditor />}
      {type === 'chair'   && <ChairEditor />}
      {type === 'sofa'    && <SofaEditor />}
      {type === 'bed'     && <BedEditor />}
      {type === 'cabinet' && <CabinetEditor />}
      {type === 'other'   && <GenericEditor />}
    </Box>
  );
}
