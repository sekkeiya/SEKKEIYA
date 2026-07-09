import type { MotionMode, SiteMotionLib } from '../projects/types';

// 演出の意図別 20 カテゴリ。実エンジンは少数の effect を共有し、パラメータと
// 使用ライブラリで多彩に展開する（GSAP/ScrollTrigger・Lenis・Three.js/R3F/drei・
// Framer Motion・Anime.js・Motion One といった現場標準ライブラリで構成）。
export type MotionCategory =
  | 'still' | 'fade' | 'reveal' | 'stagger' | 'smooth' | 'rise' | 'snap'
  | 'parallax' | 'scrub' | 'pin' | 'clip' | 'text' | 'kinetic' | 'marquee'
  | 'magnetic' | 'cursor' | 'particles' | 'fluid' | 'geometry' | 'glitch';

/** 実装済みの演出挙動 ID。複数プリセットが同じ effect を共有して挙動を再利用する。 */
export type MotionEffect = 'none' | 'fade' | 'smooth' | 'reveal' | 'rise' | 'parallax' | 'clip' | 'pin' | 'text' | 'marquee' | 'glitch' | 'stagger' | 'magnetic' | 'snap' | 'particles' | 'fluid' | 'geometry';

export interface MotionPreset {
  id: string;
  name: string;       // 英語名
  nameJa: string;     // 日本語名
  category: MotionCategory;
  intensity: MotionMode;       // 解決される強度（still/subtle/bold/cinematic/experimental）
  libs: SiteMotionLib[];       // 使用ライブラリ（複数可）
  description: string;
  effect: MotionEffect;        // 実装済み挙動の ID（レンダラが参照）
}

export const MOTION_CATEGORY_LABEL: Record<MotionCategory, string> = {
  still: '静止', fade: 'フェード', reveal: 'リビール', stagger: 'スタガー', smooth: 'スムーズ',
  rise: 'ライズ', snap: 'スナップ', parallax: 'パララックス', scrub: 'スクラブ', pin: 'ピン',
  clip: 'クリップ／マスク', text: 'テキスト', kinetic: 'キネティック', marquee: 'マーキー',
  magnetic: 'マグネティック', cursor: 'カーソル', particles: 'パーティクル', fluid: 'フルイド',
  geometry: 'ジオメトリ', glitch: 'グリッチ',
};
export const MOTION_CATEGORY_ORDER: MotionCategory[] = [
  'still', 'fade', 'reveal', 'stagger', 'smooth', 'rise', 'snap',
  'parallax', 'scrub', 'pin', 'clip', 'text', 'kinetic', 'marquee',
  'magnetic', 'cursor', 'particles', 'fluid', 'geometry', 'glitch',
];

/** ライブラリの表示名（カード上のチップ用）。 */
export const LIB_LABEL: Record<SiteMotionLib, string> = {
  css: 'CSS', gsap: 'GSAP', lenis: 'Lenis', threejs: 'Three.js', r3f: 'R3F', drei: 'drei', framer: 'Framer', animejs: 'Anime.js', motionone: 'Motion One',
};

// 既存18プリセット（id は保存済みサイト互換のため変更不可）。effect 付き。
const BASE_PRESETS: MotionPreset[] = [
  { id: 'mo-none',        name: 'None',            nameJa: '静止',             category: 'still', intensity: 'still',  libs: ['css'], description: 'アニメーションなし。最速・アクセシブル。', effect: 'none' },
  { id: 'mo-fade',        name: 'Quiet Fade',      nameJa: '静かなフェード',    category: 'fade', intensity: 'subtle', libs: ['css'], description: '控えめなフェードインのみ。', effect: 'fade' },
  { id: 'mo-smooth',      name: 'Smooth Scroll',   nameJa: 'スムーズスクロール', category: 'smooth', intensity: 'subtle', libs: ['lenis'], description: '慣性のある滑らかなスクロール。', effect: 'smooth' },
  { id: 'mo-smooth-reveal', name: 'Smooth Reveal', nameJa: 'スムーズ＋リビール', category: 'reveal', intensity: 'subtle', libs: ['lenis', 'gsap'], description: '慣性スクロール＋要素フェードスライド。', effect: 'reveal' },
  { id: 'mo-soft-stagger', name: 'Soft Stagger',  nameJa: 'ソフトスタガー',    category: 'stagger', intensity: 'subtle', libs: ['motionone'], description: '順次フェードイン（軽量）。', effect: 'stagger' },
  { id: 'mo-rise',        name: 'Rise',            nameJa: 'ライズ',           category: 'rise', intensity: 'bold',   libs: ['gsap'], description: '下からの大きめの立ち上がり。', effect: 'rise' },
  { id: 'mo-snap',        name: 'Snap Scroll',     nameJa: 'スナップスクロール', category: 'snap', intensity: 'subtle', libs: ['lenis'], description: '1画面1セクションでスナップ切替する没入スクロール。', effect: 'snap' },
  { id: 'mo-parallax',    name: 'Parallax',        nameJa: 'パララックス',      category: 'parallax', intensity: 'cinematic', libs: ['gsap', 'lenis'], description: 'ヒーロー強パララックス＋慣性。', effect: 'parallax' },
  { id: 'mo-clip-reveal', name: 'Clip Reveal',     nameJa: 'クリップリビール',  category: 'clip', intensity: 'cinematic', libs: ['gsap'], description: '画像が clip-path で開く演出。', effect: 'clip' },
  { id: 'mo-pin-scroll',  name: 'Pinned Sections', nameJa: 'セクションピン',    category: 'pin', intensity: 'cinematic', libs: ['gsap'], description: 'セクション固定＋スクラブ進行。', effect: 'pin' },
  { id: 'mo-text-reveal', name: 'Text Reveal',     nameJa: 'テキストリビール',  category: 'text', intensity: 'bold',   libs: ['gsap'], description: '見出しの文字単位アニメ。', effect: 'text' },
  { id: 'mo-particles',   name: 'Particles',       nameJa: 'パーティクル背景',  category: 'particles', intensity: 'cinematic', libs: ['threejs'], description: 'WebGL パーティクルの背景。', effect: 'particles' },
  { id: 'mo-fluid',       name: 'Fluid Morph',     nameJa: 'フルイドモーフ',    category: 'fluid', intensity: 'experimental', libs: ['threejs', 'gsap'], description: '流体的なモーフィング背景。', effect: 'fluid' },
  { id: 'mo-3d-type',     name: '3D Typography',   nameJa: '3Dタイポグラフィ',  category: 'geometry', intensity: 'experimental', libs: ['r3f', 'drei'], description: '立体的な見出し（React Three Fiber）。', effect: 'geometry' },
  { id: 'mo-geometry',    name: 'Geometry',        nameJa: 'ジオメトリ',       category: 'geometry', intensity: 'cinematic', libs: ['threejs', 'gsap'], description: '幾何形状のスクロール連動。', effect: 'geometry' },
  { id: 'mo-glitch',      name: 'Glitch',          nameJa: 'グリッチ',         category: 'glitch', intensity: 'experimental', libs: ['css', 'animejs'], description: '攻めたグリッチ演出。', effect: 'glitch' },
  { id: 'mo-marquee',     name: 'Marquee',         nameJa: 'マーキー',         category: 'marquee', intensity: 'bold',   libs: ['gsap'], description: '横スクロールするテキスト帯。', effect: 'marquee' },
  { id: 'mo-magnetic',    name: 'Magnetic',        nameJa: 'マグネティック',    category: 'magnetic', intensity: 'experimental', libs: ['gsap', 'motionone'], description: 'カーソル追従のマグネット効果。', effect: 'magnetic' },
];

// ── ジェネレータで追加プリセットを生成し合計約100に ──
// 生成分の id は `mo-<effect>-v<i>` 形式で既存18の id と衝突しない。
function buildMore(): MotionPreset[] {
  // 20 カテゴリ＝20ファミリ。各カテゴリは実装済み effect を共有し、現場標準の
  // ライブラリ構成（GSAP/Lenis/Three.js/R3F/drei/Framer/Anime.js/Motion One）で展開。
  const families: { category: MotionCategory; effect: MotionEffect; libs: SiteMotionLib[]; intensity: MotionMode; base: string; baseJa: string; }[] = [
    { category: 'still',     effect: 'none',      libs: ['css'],                  intensity: 'still',        base: 'Still',     baseJa: '静止' },
    { category: 'fade',      effect: 'fade',      libs: ['css', 'framer'],        intensity: 'subtle',       base: 'Fade',      baseJa: 'フェード' },
    { category: 'reveal',    effect: 'reveal',    libs: ['lenis', 'gsap'],        intensity: 'subtle',       base: 'Reveal',    baseJa: 'リビール' },
    { category: 'stagger',   effect: 'stagger',   libs: ['motionone', 'framer'],  intensity: 'subtle',       base: 'Stagger',   baseJa: 'スタガー' },
    { category: 'smooth',    effect: 'smooth',    libs: ['lenis'],                intensity: 'subtle',       base: 'Smooth',    baseJa: 'スムーズ' },
    { category: 'rise',      effect: 'rise',      libs: ['gsap'],                 intensity: 'bold',         base: 'Rise',      baseJa: 'ライズ' },
    { category: 'snap',      effect: 'snap',      libs: ['lenis'],                intensity: 'subtle',       base: 'Snap',      baseJa: 'スナップ' },
    { category: 'parallax',  effect: 'parallax',  libs: ['gsap', 'lenis'],        intensity: 'cinematic',    base: 'Parallax',  baseJa: 'パララックス' },
    { category: 'scrub',     effect: 'pin',       libs: ['gsap'],                 intensity: 'cinematic',    base: 'Scrub',     baseJa: 'スクラブ' },
    { category: 'pin',       effect: 'pin',       libs: ['gsap'],                 intensity: 'cinematic',    base: 'Pin',       baseJa: 'ピン' },
    { category: 'clip',      effect: 'clip',      libs: ['gsap'],                 intensity: 'cinematic',    base: 'Clip',      baseJa: 'クリップ' },
    { category: 'text',      effect: 'text',      libs: ['gsap'],                 intensity: 'bold',         base: 'Text',      baseJa: 'テキスト' },
    { category: 'kinetic',   effect: 'text',      libs: ['gsap'],                 intensity: 'bold',         base: 'Kinetic',   baseJa: 'キネティック' },
    { category: 'marquee',   effect: 'marquee',   libs: ['gsap'],                 intensity: 'bold',         base: 'Marquee',   baseJa: 'マーキー' },
    { category: 'magnetic',  effect: 'magnetic',  libs: ['gsap', 'motionone'],    intensity: 'experimental', base: 'Magnetic',  baseJa: 'マグネティック' },
    { category: 'cursor',    effect: 'magnetic',  libs: ['motionone', 'framer'],  intensity: 'experimental', base: 'Cursor',    baseJa: 'カーソル' },
    { category: 'particles', effect: 'particles', libs: ['threejs'],              intensity: 'cinematic',    base: 'Particles', baseJa: 'パーティクル' },
    { category: 'fluid',     effect: 'fluid',     libs: ['threejs', 'gsap'],      intensity: 'experimental', base: 'Fluid',     baseJa: 'フルイド' },
    { category: 'geometry',  effect: 'geometry',  libs: ['threejs', 'r3f', 'drei'], intensity: 'cinematic',  base: 'Geometry',  baseJa: 'ジオメトリ' },
    { category: 'glitch',    effect: 'glitch',    libs: ['css', 'animejs'],       intensity: 'experimental', base: 'Glitch',    baseJa: 'グリッチ' },
  ];
  const flavors = ['Soft', 'Slow', 'Quick', 'Deep', 'Wide', 'Subtle', 'Bold', 'Long', 'Short', 'Drift']; // 10
  const flavorsJa = ['ソフト', 'スロー', 'クイック', 'ディープ', 'ワイド', 'サトル', 'ボールド', 'ロング', 'ショート', 'ドリフト'];
  const out: MotionPreset[] = [];
  families.forEach(f => {
    for (let i = 0; i < 6; i++) { // 20×6 = 120 追加
      out.push({
        id: `mo-${f.category}-v${i + 1}`,
        name: `${f.base} ${flavors[i]}`,
        nameJa: `${f.baseJa}・${flavorsJa[i]}`,
        category: f.category, intensity: f.intensity, libs: f.libs, effect: f.effect,
        description: `${f.baseJa}系の演出（${flavorsJa[i]}）。`,
      });
    }
  });
  return out;
}

export const MOTION_PRESETS: MotionPreset[] = [...BASE_PRESETS, ...buildMore()];

export function findMotionPreset(id: string | undefined): MotionPreset | undefined {
  return id ? MOTION_PRESETS.find(p => p.id === id) : undefined;
}

/** 厳選モーション（パネルで提示する3種：静止 / スムーズ / シネマ）。 */
export interface CuratedMotion { id: string; label: string; description: string; }
export const CURATED_MOTIONS: CuratedMotion[] = ([
  { id: 'mo-none',          label: '静止',     description: 'アニメーションなし。最速で上質な静けさ。' },
  { id: 'mo-smooth-reveal', label: 'スムーズ', description: '慣性スクロール＋要素がふわりと現れる演出。' },
  { id: 'mo-parallax',      label: 'シネマ',   description: 'ヒーローの強パララックスで奥行きを演出。' },
] as CuratedMotion[]).filter(c => !!findMotionPreset(c.id));

/**
 * スタイル（人格の既定強度）に対する推奨モーションプリセット ID。
 * スタイル適用時に自動で設定される（ユーザーはあとから変更可）。
 */
export function recommendedMotionForIntensity(intensity: MotionMode): string {
  switch (intensity) {
    case 'still':        return 'mo-fade';
    case 'subtle':       return 'mo-smooth';
    case 'bold':         return 'mo-rise';
    case 'cinematic':    return 'mo-parallax';
    case 'experimental': return 'mo-magnetic';
    default:             return 'mo-smooth';
  }
}

/**
 * レイアウトモードに対する推奨モーションプリセット ID。
 * レイアウト適用時、モーション未設定なら自動で設定される。
 */
export function recommendedMotionForLayout(mode: string): string {
  switch (mode) {
    case 'immersive':
    case 'portfolio':  return 'mo-parallax';   // 没入系はシネマ寄り
    case 'magazine':
    case 'studio':
    case 'grid':       return 'mo-rise';       // 全幅系は大胆な立ち上がり
    case 'minimal':    return 'mo-fade';       // ミニマルは静か
    case 'editorial':
    case 'split':
    default:           return 'mo-smooth';     // 既定はスムーズ
  }
}
