import type { MindMapStyle, MindLayoutKey } from '../repositories/ResearchCanvasRepository';

/**
 * マインドマップ（GitMind風）の右パネルが提供するプリセット群。
 * テーマ＝配色、背景＝下地、レイアウト＝展開の形、アイコン＝ノードに付ける印。
 * いずれも「選ぶと MindMapStyle / MindMapNode に落ちる」だけの純データで、描画は MindMapCanvas 側が持つ。
 */

// ─── テーマ（配色） ───────────────────────────────────────────────────────────

export interface MindTheme {
  key: string;
  label: string;
  /** 中心トピックの塗り色 */
  root: string;
  /** 中心トピックの文字色 */
  rootFg: string;
  /** 枝色。第1階層に並び順で割り当て、その子は親から継承する。 */
  palette: string[];
  /** テーマを選んだときにまとめて適用するスタイル既定。 */
  style?: MindMapStyle;
}

export const MIND_THEMES: MindTheme[] = [
  {
    key: 'sekkeiya', label: 'SEKKEIYA',
    root: '#00BFFF', rootFg: '#04222e',
    palette: ['#4FC3F7', '#81C784', '#FFB74D', '#F06292', '#BA68C8', '#4DB6AC', '#FFD54F', '#90A4AE'],
    style: { shape: 'rounded', radius: 10, lineStyle: 'curve', lineWidth: 2 },
  },
  {
    key: 'rainbow', label: 'レインボー',
    root: '#FF7043', rootFg: '#2a0f06',
    palette: ['#EF5350', '#FFA726', '#FDD835', '#66BB6A', '#26C6DA', '#42A5F5', '#7E57C2', '#EC407A'],
    style: { shape: 'rounded', radius: 10, lineStyle: 'curve', lineWidth: 2 },
  },
  {
    key: 'ocean', label: 'オーシャン',
    root: '#0277BD', rootFg: '#e6f4fb',
    palette: ['#4FC3F7', '#4DD0E1', '#4DB6AC', '#5C6BC0', '#7986CB', '#26C6DA', '#29B6F6', '#5E97D0'],
    style: { shape: 'rounded', radius: 10, lineStyle: 'curve', lineWidth: 2 },
  },
  {
    key: 'forest', label: 'フォレスト',
    root: '#2E7D32', rootFg: '#eaf6ea',
    palette: ['#66BB6A', '#9CCC65', '#D4E157', '#26A69A', '#8D6E63', '#AED581', '#4DB6AC', '#7CB342'],
    style: { shape: 'rounded', radius: 10, lineStyle: 'curve', lineWidth: 2 },
  },
  {
    key: 'sunset', label: 'サンセット',
    root: '#D84315', rootFg: '#fdece6',
    palette: ['#FF7043', '#FF8A65', '#FFA726', '#FFB74D', '#F06292', '#BA68C8', '#FF5252', '#FFCA28'],
    style: { shape: 'pill', lineStyle: 'curve', lineWidth: 2.5 },
  },
  {
    key: 'berry', label: 'ベリー',
    root: '#AD1457', rootFg: '#fde8f1',
    palette: ['#EC407A', '#BA68C8', '#7E57C2', '#5C6BC0', '#F06292', '#CE93D8', '#9575CD', '#F48FB1'],
    style: { shape: 'rounded', radius: 14, lineStyle: 'curve', lineWidth: 2 },
  },
  {
    key: 'mono', label: 'モノトーン',
    root: '#455A64', rootFg: '#eceff1',
    palette: ['#90A4AE', '#78909C', '#B0BEC5', '#607D8B', '#9E9E9E', '#BDBDBD', '#546E7A', '#829399'],
    style: { shape: 'rect', lineStyle: 'straight', lineWidth: 1.5 },
  },
  {
    key: 'blueprint', label: 'ブループリント',
    root: '#1565C0', rootFg: '#e8f1fb',
    palette: ['#64B5F6', '#4FC3F7', '#4DD0E1', '#81D4FA', '#90CAF9', '#B3E5FC', '#5C6BC0', '#7986CB'],
    style: { shape: 'rect', lineStyle: 'elbow', lineWidth: 1.5 },
  },
];

export const DEFAULT_THEME_KEY = 'sekkeiya';

export function resolveTheme(key?: string): MindTheme {
  return MIND_THEMES.find(t => t.key === key) ?? MIND_THEMES[0];
}

// ─── 背景 ─────────────────────────────────────────────────────────────────────

export interface MindBackground {
  key: string;
  label: string;
  /** キャンバスに敷くパターン。'none' はパターンなし。 */
  variant: 'dots' | 'lines' | 'cross' | 'none';
  /** 下地色（CSS）。未指定ならアプリの背景をそのまま透かす。 */
  color?: string;
}

export const MIND_BACKGROUNDS: MindBackground[] = [
  { key: 'dots', label: 'ドット', variant: 'dots' },
  { key: 'grid', label: 'グリッド', variant: 'lines' },
  { key: 'cross', label: 'クロス', variant: 'cross' },
  { key: 'plain', label: 'なし', variant: 'none' },
  { key: 'paper', label: '生成り', variant: 'dots', color: 'light-dark(#faf6ee, #191612)' },
  { key: 'navy', label: 'ネイビー', variant: 'dots', color: 'light-dark(#eff4fc, #0c1424)' },
  { key: 'mint', label: 'ミント', variant: 'dots', color: 'light-dark(#eefaf4, #0c1e17)' },
  { key: 'slate', label: 'スレート', variant: 'lines', color: 'light-dark(#f1f4f8, #13171e)' },
];

export const DEFAULT_BACKGROUND_KEY = 'dots';

export function resolveBackground(key?: string): MindBackground {
  return MIND_BACKGROUNDS.find(b => b.key === key) ?? MIND_BACKGROUNDS[0];
}

// ─── レイアウト（展開の形） ───────────────────────────────────────────────────

/**
 * レイアウトの骨組み。座標計算（computeMindLayout）はこの4つのフラグだけで分岐する。
 * axis=主軸（h=横に深くなる / v=縦に深くなる）、dir=主軸の向き、
 * split=ルート直下を左右に振り分ける、columnAligned=同じ深さを同じ列/行に揃える（ロジック図）。
 */
export interface MindLayoutSpec {
  axis: 'h' | 'v';
  dir: 1 | -1;
  split: boolean;
  columnAligned: boolean;
}

export const MIND_LAYOUT_SPEC: Record<MindLayoutKey, MindLayoutSpec> = {
  'right': { axis: 'h', dir: 1, split: false, columnAligned: false },
  'left': { axis: 'h', dir: -1, split: false, columnAligned: false },
  'both': { axis: 'h', dir: 1, split: true, columnAligned: false },
  'logic-right': { axis: 'h', dir: 1, split: false, columnAligned: true },
  'logic-left': { axis: 'h', dir: -1, split: false, columnAligned: true },
  'org-down': { axis: 'v', dir: 1, split: false, columnAligned: true },
  'org-up': { axis: 'v', dir: -1, split: false, columnAligned: true },
};

export interface MindLayoutPreset {
  key: MindLayoutKey;
  label: string;
  group: 'mindmap' | 'logic';
  /** 選んだときにまとめて適用するスタイル既定（形に合う線の種類）。 */
  style?: MindMapStyle;
}

export const MIND_LAYOUTS: MindLayoutPreset[] = [
  { key: 'both', label: '左右', group: 'mindmap', style: { lineStyle: 'curve' } },
  { key: 'right', label: '右へ', group: 'mindmap', style: { lineStyle: 'curve' } },
  { key: 'left', label: '左へ', group: 'mindmap', style: { lineStyle: 'curve' } },
  { key: 'logic-right', label: '右へ', group: 'logic', style: { lineStyle: 'elbow' } },
  { key: 'logic-left', label: '左へ', group: 'logic', style: { lineStyle: 'elbow' } },
  { key: 'org-down', label: '下へ', group: 'logic', style: { lineStyle: 'elbow' } },
  { key: 'org-up', label: '上へ', group: 'logic', style: { lineStyle: 'elbow' } },
];

export function resolveLayoutSpec(key?: MindLayoutKey): MindLayoutSpec {
  return (key && MIND_LAYOUT_SPEC[key]) || MIND_LAYOUT_SPEC.right;
}

// ─── アイコン ─────────────────────────────────────────────────────────────────

export interface MindIcon {
  key: string;
  label: string;
  /** 絵文字で描くアイコン */
  emoji?: string;
  /** 文字バッジで描くアイコン（優先度・番号）。round=丸バッジ。 */
  badge?: { text: string; color: string; round?: boolean };
}

export interface MindIconGroup {
  key: string;
  label: string;
  icons: MindIcon[];
}

const NUMBER_COLOR = '#5E97D0';

export const MIND_ICON_GROUPS: MindIconGroup[] = [
  {
    key: 'priority', label: '優先度',
    icons: [
      { key: 'p0', label: 'P0（最優先）', badge: { text: 'P0', color: '#e53935' } },
      { key: 'p1', label: 'P1', badge: { text: 'P1', color: '#fb8c00' } },
      { key: 'p2', label: 'P2', badge: { text: 'P2', color: '#43a047' } },
      { key: 'p3', label: 'P3', badge: { text: 'P3', color: '#1e88e5' } },
    ],
  },
  {
    key: 'number', label: '番号',
    icons: Array.from({ length: 10 }, (_, i) => {
      const t = String(i + 1).padStart(2, '0');
      return { key: `n${t}`, label: t, badge: { text: t, color: NUMBER_COLOR, round: true } };
    }),
  },
  {
    key: 'progress', label: '進捗',
    icons: [
      { key: 'todo', label: '未着手', emoji: '⬜' },
      { key: 'doing', label: '進行中', emoji: '🔄' },
      { key: 'done', label: '完了', emoji: '✅' },
      { key: 'hold', label: '保留', emoji: '⏸️' },
      { key: 'drop', label: '見送り', emoji: '❌' },
    ],
  },
  {
    key: 'sign', label: '記号',
    icons: [
      { key: 'star', label: '重要', emoji: '⭐' },
      { key: 'fire', label: '急ぎ', emoji: '🔥' },
      { key: 'idea', label: 'アイデア', emoji: '💡' },
      { key: 'warn', label: '注意', emoji: '⚠️' },
      { key: 'question', label: '疑問', emoji: '❓' },
      { key: 'pin', label: 'ピン', emoji: '📌' },
      { key: 'heart', label: 'お気に入り', emoji: '❤️' },
      { key: 'flag', label: '目印', emoji: '🚩' },
    ],
  },
  {
    key: 'business', label: 'ビジネス',
    icons: [
      { key: 'chart', label: 'データ', emoji: '📊' },
      { key: 'target', label: '目標', emoji: '🎯' },
      { key: 'folder', label: '資料', emoji: '📁' },
      { key: 'calendar', label: '日程', emoji: '🗓️' },
      { key: 'money', label: 'コスト', emoji: '💰' },
      { key: 'people', label: '体制', emoji: '👥' },
      { key: 'mail', label: '連絡', emoji: '✉️' },
      { key: 'search', label: '調査', emoji: '🔍' },
    ],
  },
  {
    key: 'design', label: '設計',
    icons: [
      { key: 'building', label: '建物', emoji: '🏠' },
      { key: 'site', label: '敷地', emoji: '🌳' },
      { key: 'ruler', label: '寸法', emoji: '📐' },
      { key: 'plan', label: '図面', emoji: '📄' },
      { key: 'light', label: '採光', emoji: '☀️' },
      { key: 'material', label: '素材', emoji: '🧱' },
      { key: 'camera', label: 'パース', emoji: '📷' },
      { key: 'sketch', label: 'スケッチ', emoji: '✏️' },
    ],
  },
];

/** ノード内に描くアイコンの1辺(px)。ノード幅の実測にも使う。 */
export const MIND_ICON_SIZE = 16;
export const MIND_ICON_GAP = 3;

const ICON_BY_KEY = new Map<string, MindIcon>(
  MIND_ICON_GROUPS.flatMap(g => g.icons.map(i => [i.key, i] as const)),
);

export function findMindIcon(key: string): MindIcon | undefined {
  return ICON_BY_KEY.get(key);
}
