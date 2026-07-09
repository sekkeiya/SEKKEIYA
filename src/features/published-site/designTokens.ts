// エディトリアル品質のデザイントークン（デスクトップから移植）。
import type { MotionMode } from './siteTypes';

export const SECTION_PY = { xs: 8, md: 16 };
export const HERO_PY = { xs: 10, md: 20 };
export const HERO_MINH = { xs: '80vh', md: '92vh' };
export const MEASURE = { text: 640, wide: 1180, hero: 1240 };
export const PAGE_PX = { xs: 3, md: 8, lg: 12 };
export const TYPE = {
  displayXL: { xs: '2.9rem', md: '5.2rem' },
  display:   { xs: '2.2rem', md: '3.4rem' },
  h2:        { xs: '1.45rem', md: '2.1rem' },
  bodyLg:    '1.18rem',
  body:      '1.0rem',
  caption:   '0.76rem',
  kicker:    '0.68rem',
};
export const LEADING = { display: 1.05, heading: 1.14, body: 1.95 };
export const TRACK = { kickerWide: '0.22em', kickerNarrow: '0.06em' };
export const RATIO = { hero: '16/9', feature: '16/9', wide: '21/9', portrait: '3/4', card: '4/3', film: '3/2' };

type CubicBezier = [number, number, number, number];

export interface MotionFields {
  smooth: boolean;
  reveal: number;
  durMs: number;
  ease: CubicBezier;
  parallax: number;
  clip: boolean;
  extra: boolean;
}

export const MOTION: Record<MotionMode, MotionFields> = {
  still:        { smooth: false, reveal: 0,  durMs: 0,    ease: [0, 0, 1, 1],        parallax: 0,    clip: false, extra: false },
  subtle:       { smooth: true,  reveal: 22, durMs: 760,  ease: [0.22, 1, 0.36, 1],  parallax: 0.06, clip: false, extra: false },
  bold:         { smooth: true,  reveal: 46, durMs: 880,  ease: [0.16, 1, 0.30, 1],  parallax: 0.12, clip: false, extra: false },
  cinematic:    { smooth: true,  reveal: 60, durMs: 1050, ease: [0.16, 1, 0.30, 1],  parallax: 0.18, clip: true,  extra: false },
  experimental: { smooth: true,  reveal: 78, durMs: 980,  ease: [0.65, 0, 0.35, 1],  parallax: 0.22, clip: true,  extra: true  },
};

export interface MotionConfig {
  mode: MotionMode;
  enabled: boolean;
  smooth: boolean;
  reveal: number;
  durMs: number;
  ease: CubicBezier;
  parallax: number;
  clip: boolean;
  extra: boolean;
}

export function resolveMotionConfig(
  baseMode: MotionMode,
  override: MotionMode | undefined,
  opts: { preview: boolean; reduced: boolean },
): MotionConfig {
  const mode = override ?? baseMode;
  const f = MOTION[mode];
  const enabled = opts.preview && !opts.reduced && mode !== 'still';
  return {
    mode,
    enabled,
    smooth: enabled && f.smooth,
    reveal: enabled ? f.reveal : 0,
    durMs: enabled ? f.durMs : 0,
    ease: f.ease,
    parallax: enabled ? f.parallax : 0,
    clip: enabled && f.clip,
    extra: enabled && f.extra,
  };
}
