/**
 * initialContentBuilders.ts
 *
 * 「新規プレゼンテーション作成」ダイアログで選ばれたテンプレート種別に応じた
 * 初期コンテンツを生成する関数群。
 * 各テンプレートは A3横 (1587×1122) をデフォルトキャンバスとして使用する。
 */
import type {
  PresentationContent,
  PresentationPage,
  PresentationElement,
  TextElementData,
  ImageElementData,
  ShapeElementData,
  LineElementData,
} from '../types/dsp.types';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT   = '#29b6f6';
const DARK_BG  = '#0d1b2a';
const DARK_BG2 = '#16213e';
const WARM_BG  = '#faf8f5';
const GRAY_BG  = '#f5f5f7';
const TEXT_DK  = '#1d1d1f';
const TEXT_MD  = '#3a3a3c';
const TEXT_DIM = 'rgba(255,255,255,0.45)';
const LINE_LT  = 'rgba(255,255,255,0.18)';
const LINE_DK  = '#d2d2d7';

// ─── Default canvas ───────────────────────────────────────────────────────────
export const DEFAULT_CANVAS = { width: 1587, height: 1122 };
export const PORTRAIT_CANVAS = { width: 1122, height: 1587 };
export const WIDE_CANVAS = { width: 1920, height: 1080 };

// ─── Type alias ───────────────────────────────────────────────────────────────
type El = Omit<PresentationElement, 'id'>;

// ─── Element helpers ─────────────────────────────────────────────────────────
let _seq = 0;
function uid(): string {
  return `init-${Date.now()}-${++_seq}-${Math.random().toString(36).slice(2, 5)}`;
}

function pg(name: string, els: El[]): PresentationPage {
  const base = uid();
  return {
    id:       `p-${base}`,
    name,
    elements: els.map((e, i) => ({ ...e, id: `e-${base}-${i}` })) as PresentationElement[],
  };
}

function rct(x: number, y: number, w: number, h: number, fill: string, opts: Partial<ShapeElementData & { zIndex?: number; borderRadius?: string }> = {}): El {
  const { zIndex = 0, ...rest } = opts as any;
  // Remove undefined fields so Firestore doesn't reject them
  const data: any = { shapeType: 'rect', fill };
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) data[k] = v; });
  return { type: 'shape', x, y, w, h, zIndex, rotation: 0, opacity: 100, data };
}

function txt(
  x: number, y: number, w: number, h: number,
  text: string, fontSize: string, color: string,
  opts: Partial<TextElementData & { zIndex?: number }> = {},
): El {
  const { zIndex = 2, ...rest } = opts as any;
  const data: any = { text, fontSize, color, textAlign: 'left' };
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) data[k] = v; });
  return { type: 'text', x, y, w, h, zIndex, rotation: 0, opacity: 100, data };
}

function img(x: number, y: number, w: number, h: number, alt = '画像をドロップ', opts: any = {}): El {
  return {
    type: 'image', x, y, w, h, zIndex: 1, rotation: 0, opacity: 100,
    data: { src: '', alt, ...opts } as ImageElementData,
  };
}

function ln(x: number, y: number, w: number, h = 0, stroke = LINE_DK, sw = '1'): El {
  return {
    type: 'line', x, y, w, h, zIndex: 2, rotation: 0, opacity: 100,
    data: { stroke, fill: stroke, strokeWidth: sw } as LineElementData,
  };
}

// ─── Individual builders ──────────────────────────────────────────────────────

/**
 * blank — 1枚の空白スライド
 */
function buildBlank(): PresentationContent {
  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      pg('スライド 1', []),
    ],
  };
}

/**
 * client_proposal — クライアント提案書
 * 表紙 / 目次 / コンセプト / プラン / 概算費用 の5枚構成
 */
function buildClientProposal(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  const pages: PresentationPage[] = [];

  // ── 表紙 ──────────────────────────────────────────────────────────────────
  pages.push(pg('表紙', [
    rct(0, 0, cW, cH, DARK_BG),
    rct(0, cH * 0.62, cW, cH * 0.38, DARK_BG2),
    ln(cW * 0.08, cH * 0.48, cW * 0.1, 0, ACCENT, '4'),
    txt(cW * 0.08, cH * 0.15, cW * 0.8, cH * 0.28,
      'プロジェクト名\nProject Title', '72px', '#fff',
      { fontWeight: '700', lineHeight: 1.25 }),
    txt(cW * 0.08, cH * 0.55, cW * 0.6, cH * 0.1,
      'クライアント様名　／　2026', '26px', TEXT_DIM),
    txt(cW * 0.08, cH * 0.7, cW * 0.5, cH * 0.08,
      '株式会社 設計や', '22px', TEXT_DIM, { fontWeight: '600' }),
    txt(cW * 0.08, cH * 0.8, cW * 0.5, cH * 0.08,
      'https://sekkeiya.com', '18px', TEXT_DIM),
  ]));

  // ── 目次 ──────────────────────────────────────────────────────────────────
  const tocItems = ['01  コンセプト', '02  プランニング', '03  デザインイメージ', '04  概算費用', '05  スケジュール'];
  pages.push(pg('目次', [
    rct(0, 0, cW, cH, WARM_BG),
    rct(0, 0, cW * 0.04, cH, ACCENT, { zIndex: 0 }),
    txt(cW * 0.1, cH * 0.07, cW * 0.8, cH * 0.1,
      'INDEX', '14px', ACCENT, { fontWeight: '700', letterSpacing: 8 as any }),
    txt(cW * 0.1, cH * 0.15, cW * 0.8, cH * 0.12,
      '目次', '52px', TEXT_DK, { fontWeight: '700' }),
    ln(cW * 0.1, cH * 0.31, cW * 0.8, 0, LINE_DK),
    ...tocItems.map((label, i) => [
      txt(cW * 0.1, cH * 0.35 + i * cH * 0.1, cW * 0.72, cH * 0.08,
        label, '28px', TEXT_MD, { fontWeight: i === 0 ? '700' : '400' }),
      ln(cW * 0.1, cH * 0.43 + i * cH * 0.1, cW * 0.8, 0, LINE_DK, '1'),
    ]).flat(),
  ]));

  // ── コンセプト ────────────────────────────────────────────────────────────
  pages.push(pg('コンセプト', [
    rct(0, 0, cW, cH, '#ffffff'),
    rct(0, 0, cW, cH * 0.14, GRAY_BG),
    txt(cW * 0.05, cH * 0.03, cW * 0.15, cH * 0.06, '01', '36px', ACCENT, { fontWeight: '700' }),
    txt(cW * 0.14, cH * 0.03, cW * 0.7, cH * 0.08, 'コンセプト', '42px', TEXT_DK, { fontWeight: '700' }),
    ln(cW * 0.05, cH * 0.14, cW * 0.9, 0, LINE_DK),
    img(cW * 0.05, cH * 0.18, cW * 0.52, cH * 0.72),
    txt(cW * 0.63, cH * 0.18, cW * 0.32, cH * 0.12,
      'コンセプトタイトル', '30px', TEXT_DK, { fontWeight: '700' }),
    txt(cW * 0.63, cH * 0.34, cW * 0.32, cH * 0.54,
      'ここにコンセプトの説明文を入力します。\n\nプロジェクトの理念や方向性、\nデザインの意図などを\n簡潔にまとめてください。',
      '22px', TEXT_MD),
  ]));

  // ── プラン ────────────────────────────────────────────────────────────────
  pages.push(pg('プラン', [
    rct(0, 0, cW, cH, '#ffffff'),
    rct(0, 0, cW, cH * 0.14, GRAY_BG),
    txt(cW * 0.05, cH * 0.03, cW * 0.15, cH * 0.06, '02', '36px', ACCENT, { fontWeight: '700' }),
    txt(cW * 0.14, cH * 0.03, cW * 0.7, cH * 0.08, 'プランニング', '42px', TEXT_DK, { fontWeight: '700' }),
    ln(cW * 0.05, cH * 0.14, cW * 0.9, 0, LINE_DK),
    img(cW * 0.05, cH * 0.18, cW * 0.9, cH * 0.72),
    txt(cW * 0.05, cH * 0.92, cW * 0.9, cH * 0.07,
      '平面図・プラン図をここにドロップしてください', '18px', 'rgba(150,150,150,0.6)',
      { textAlign: 'center' }),
  ]));

  // ── 概算費用 ──────────────────────────────────────────────────────────────
  const costRows = ['設計費', '工事費', '家具・インテリア', '諸経費'];
  pages.push(pg('概算費用', [
    rct(0, 0, cW, cH, '#ffffff'),
    rct(0, 0, cW, cH * 0.14, DARK_BG),
    txt(cW * 0.05, cH * 0.03, cW * 0.15, cH * 0.06, '04', '36px', ACCENT, { fontWeight: '700' }),
    txt(cW * 0.14, cH * 0.03, cW * 0.7, cH * 0.08, '概算費用', '42px', '#fff', { fontWeight: '700' }),
    // table header
    rct(cW * 0.05, cH * 0.18, cW * 0.9, cH * 0.07, DARK_BG),
    txt(cW * 0.07, cH * 0.2, cW * 0.5, cH * 0.05, '項目', '20px', '#fff', { fontWeight: '700' }),
    txt(cW * 0.65, cH * 0.2, cW * 0.25, cH * 0.05, '概算金額（税込）', '20px', '#fff', { fontWeight: '700' }),
    // rows
    ...costRows.map((label, i) => [
      rct(cW * 0.05, cH * 0.25 + i * cH * 0.1, cW * 0.9, cH * 0.1,
        i % 2 === 0 ? GRAY_BG : '#fff'),
      txt(cW * 0.07, cH * 0.27 + i * cH * 0.1, cW * 0.5, cH * 0.06,
        label, '22px', TEXT_DK),
      txt(cW * 0.65, cH * 0.27 + i * cH * 0.1, cW * 0.25, cH * 0.06,
        '¥ ─────', '22px', TEXT_MD, { fontWeight: '600' }),
    ]).flat(),
    // total
    rct(cW * 0.05, cH * 0.65, cW * 0.9, cH * 0.1, DARK_BG),
    txt(cW * 0.07, cH * 0.67, cW * 0.5, cH * 0.06, '合計', '24px', '#fff', { fontWeight: '700' }),
    txt(cW * 0.65, cH * 0.67, cW * 0.25, cH * 0.06, '¥ ─────', '24px', ACCENT, { fontWeight: '700' }),
    txt(cW * 0.05, cH * 0.78, cW * 0.9, cH * 0.1,
      '※ 上記はあくまで概算であり、詳細設計後に確定金額を提示いたします。',
      '18px', 'rgba(100,100,100,0.8)', { textAlign: 'left' }),
  ]));

  return { canvasSize: DEFAULT_CANVAS, pages };
}

/**
 * design_review — デザインレビュー
 * 表紙 / ビフォーアフター比較 / 課題整理 の3枚
 */
function buildDesignReview(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      // 表紙
      pg('表紙', [
        rct(0, 0, cW, cH, DARK_BG),
        rct(cW * 0.5, 0, cW * 0.5, cH, DARK_BG2),
        ln(cW * 0.5, 0, 0, cH, ACCENT, '3'),
        img(cW * 0.52, 0, cW * 0.48, cH),
        txt(cW * 0.04, cH * 0.1, cW * 0.42, cH * 0.1,
          'DESIGN REVIEW', '14px', ACCENT, { fontWeight: '700', letterSpacing: 6 as any }),
        txt(cW * 0.04, cH * 0.22, cW * 0.42, cH * 0.25,
          'レビュー\nタイトル', '60px', '#fff', { fontWeight: '700', lineHeight: 1.2 as any }),
        txt(cW * 0.04, cH * 0.55, cW * 0.42, cH * 0.08,
          '対象スペース / プロジェクト', '22px', TEXT_DIM),
        txt(cW * 0.04, cH * 0.65, cW * 0.42, cH * 0.08,
          '2026年 5月', '20px', TEXT_DIM, { fontWeight: '600' }),
      ]),
      // ビフォーアフター
      pg('ビフォーアフター', [
        rct(0, 0, cW, cH, '#fff'),
        rct(0, 0, cW, cH * 0.12, GRAY_BG),
        txt(cW * 0.05, cH * 0.03, cW * 0.6, cH * 0.08, 'ビフォーアフター比較', '38px', TEXT_DK, { fontWeight: '700' }),
        // Before
        rct(cW * 0.04, cH * 0.15, cW * 0.44, cH * 0.08, '#f0f0f0'),
        txt(cW * 0.04, cH * 0.16, cW * 0.44, cH * 0.06, '現状 / BEFORE', '18px', TEXT_MD, { fontWeight: '700', textAlign: 'center' as any }),
        img(cW * 0.04, cH * 0.23, cW * 0.44, cH * 0.56, 'ビフォー画像'),
        txt(cW * 0.04, cH * 0.82, cW * 0.44, cH * 0.1, '課題・改善前の状況を記載', '18px', TEXT_MD),
        // After
        rct(cW * 0.52, cH * 0.15, cW * 0.44, cH * 0.08, ACCENT),
        txt(cW * 0.52, cH * 0.16, cW * 0.44, cH * 0.06, '提案 / AFTER', '18px', '#fff', { fontWeight: '700', textAlign: 'center' as any }),
        img(cW * 0.52, cH * 0.23, cW * 0.44, cH * 0.56, 'アフター画像'),
        txt(cW * 0.52, cH * 0.82, cW * 0.44, cH * 0.1, '改善後のポイントを記載', '18px', TEXT_MD),
      ]),
      // フィードバック
      pg('フィードバック整理', [
        rct(0, 0, cW, cH, '#fff'),
        rct(0, 0, cW, cH * 0.12, DARK_BG),
        txt(cW * 0.05, cH * 0.03, cW * 0.8, cH * 0.08, 'フィードバック整理', '38px', '#fff', { fontWeight: '700' }),
        // 3 feedback cards
        ...(['課題 / ISSUE', '提案 / PROPOSAL', '次のステップ / NEXT'].map((label, i) => [
          rct(cW * (0.04 + i * 0.32), cH * 0.16, cW * 0.29, cH * 0.72,
            i === 2 ? DARK_BG : GRAY_BG, { borderRadius: '12px' }),
          rct(cW * (0.04 + i * 0.32), cH * 0.16, cW * 0.29, cH * 0.08,
            i === 0 ? '#ff3b30' : i === 1 ? ACCENT : '#30d158',
            { zIndex: 2, borderRadius: '12px' }),
          txt(cW * (0.06 + i * 0.32), cH * 0.175, cW * 0.25, cH * 0.06,
            label, '16px', '#fff', { fontWeight: '700' }),
          txt(cW * (0.06 + i * 0.32), cH * 0.28, cW * 0.25, cH * 0.56,
            '・ フィードバック項目1\n・ フィードバック項目2\n・ フィードバック項目3',
            '20px', i === 2 ? '#fff' : TEXT_MD, { zIndex: 3 }),
        ])).flat(),
      ]),
    ],
  };
}

/**
 * mood_board — ムードボード
 * 1ページ: 6枚の画像グリッド + カラーパレット
 */
function buildMoodBoard(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      pg('ムードボード', [
        rct(0, 0, cW, cH, '#f9f9f7'),
        // Title
        txt(cW * 0.04, cH * 0.03, cW * 0.5, cH * 0.07,
          'MOOD BOARD', '13px', '#999', { fontWeight: '700', letterSpacing: 8 as any }),
        txt(cW * 0.04, cH * 0.08, cW * 0.5, cH * 0.08,
          'プロジェクト名', '42px', TEXT_DK, { fontWeight: '700' }),
        // 6-image masonry grid
        img(cW * 0.04, cH * 0.18, cW * 0.38, cH * 0.5, 'メイン画像 1'),
        img(cW * 0.44, cH * 0.18, cW * 0.24, cH * 0.23, '画像 2'),
        img(cW * 0.7,  cH * 0.18, cW * 0.26, cH * 0.23, '画像 3'),
        img(cW * 0.44, cH * 0.43, cW * 0.26, cH * 0.25, '画像 4'),
        img(cW * 0.72, cH * 0.43, cW * 0.24, cH * 0.25, '画像 5'),
        img(cW * 0.04, cH * 0.7,  cW * 0.56, cH * 0.22, '横長画像 6'),
        img(cW * 0.62, cH * 0.7,  cW * 0.34, cH * 0.22, '画像 7'),
        // Color palette strip
        ...(['#c9b49a', '#8b7355', '#3d2b1f', '#f5f0e8', '#2a3a2a'].map((c, i) =>
          rct(cW * (0.04 + i * 0.092), cH * 0.94, cW * 0.082, cH * 0.04, c)
        )),
        txt(cW * 0.55, cH * 0.94, cW * 0.4, cH * 0.04,
          'カラーパレット / Color Palette', '14px', '#999', { textAlign: 'right' as any }),
      ]),
    ],
  };
}

/**
 * material_board — マテリアルボード
 * 素材・仕上げ・カラーを整理した提案ボード (2ページ)
 */
function buildMaterialBoard(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      // ── マテリアルボード ──────────────────────────────────────────────────
      pg('マテリアルボード', [
        rct(0, 0, cW, cH, WARM_BG),
        rct(0, 0, cW, cH * 0.12, '#1a1a1a'),
        txt(cW * 0.04, cH * 0.03, cW * 0.5, cH * 0.06,
          'MATERIAL BOARD', '13px', TEXT_DIM, { fontWeight: '700', letterSpacing: 6 as any }),
        txt(cW * 0.04, cH * 0.065, cW * 0.6, cH * 0.06,
          'マテリアル提案', '32px', '#fff', { fontWeight: '700' }),
        // 6 material cards (2 rows × 3)
        ...([
          { label: 'フローリング', sub: 'オーク材 / ナチュラル', color: '#c8a882' },
          { label: '壁仕上げ',    sub: '珪藻土 / オフホワイト',  color: '#ede8e0' },
          { label: 'タイル',      sub: 'テラコッタ / マット',    color: '#c87941' },
          { label: '天井',        sub: 'クロス / アイボリー',    color: '#f5f2ec' },
          { label: 'キッチン扉',  sub: 'メラミン / ダークグレー',color: '#3a3a3a' },
          { label: '金物',        sub: 'アイアン / ブラック',    color: '#1a1a1a' },
        ].map((m, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = cW * (0.04 + col * 0.32);
          const y = cH * (0.16 + row * 0.39);
          return [
            img(x, y, cW * 0.29, cH * 0.26, m.label),
            rct(x, y + cH * 0.26, cW * 0.29, cH * 0.09, '#fff'),
            txt(x + cW * 0.015, y + cH * 0.27, cW * 0.26, cH * 0.04,
              m.label, '18px', TEXT_DK, { fontWeight: '700', zIndex: 3 }),
            txt(x + cW * 0.015, y + cH * 0.31, cW * 0.26, cH * 0.04,
              m.sub, '14px', TEXT_MD, { zIndex: 3 }),
            rct(x, y + cH * 0.26, cW * 0.025, cH * 0.09, m.color),
          ];
        })).flat(),
      ]),
      // ── カラースキーム ────────────────────────────────────────────────────
      pg('カラースキーム', [
        rct(0, 0, cW, cH, '#1a1a1a'),
        txt(cW * 0.06, cH * 0.06, cW * 0.6, cH * 0.08,
          'COLOR SCHEME', '14px', TEXT_DIM, { fontWeight: '700', letterSpacing: 6 as any }),
        txt(cW * 0.06, cH * 0.12, cW * 0.6, cH * 0.1,
          'カラースキーム', '44px', '#fff', { fontWeight: '700' }),
        ln(cW * 0.06, cH * 0.25, cW * 0.88, 0, LINE_LT),
        // Large color swatches
        ...(['#c8a882','#8b6342','#3d2b1f','#ede8e0','#f5f2ec'].map((c, i) => {
          const x = cW * (0.06 + i * 0.18);
          return [
            rct(x, cH * 0.29, cW * 0.16, cH * 0.35, c),
            txt(x, cH * 0.66, cW * 0.16, cH * 0.05,
              c.toUpperCase(), '14px', TEXT_DIM, { textAlign: 'center' as any }),
          ];
        })).flat(),
        txt(cW * 0.06, cH * 0.75, cW * 0.88, cH * 0.18,
          'メインカラー / サブカラー / アクセントカラーを設定してください。\n全体のトーン & マナーを統一するために活用します。',
          '20px', 'rgba(255,255,255,0.4)'),
      ]),
    ],
  };
}

/**
 * diagram — ダイアグラム
 * 動線・ゾーニング・フロー図のスターター (2ページ)
 */
function buildDiagram(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  const COLORS = ['#29b6f6', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2'];

  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      // ── ゾーニング図 ──────────────────────────────────────────────────────
      pg('ゾーニング', [
        rct(0, 0, cW, cH, '#fff'),
        rct(0, 0, cW, cH * 0.1, GRAY_BG),
        txt(cW * 0.04, cH * 0.02, cW * 0.7, cH * 0.08,
          'ゾーニング / ZONING', '36px', TEXT_DK, { fontWeight: '700' }),
        // Zone placeholders
        rct(cW * 0.04, cH * 0.14, cW * 0.42, cH * 0.36, 'rgba(41,182,246,0.12)',
          { borderRadius: '8px', zIndex: 1 }),
        txt(cW * 0.05, cH * 0.15, cW * 0.4, cH * 0.05,
          'LDK', '22px', '#29b6f6', { fontWeight: '700', zIndex: 2 }),
        rct(cW * 0.48, cH * 0.14, cW * 0.22, cH * 0.36, 'rgba(48,209,88,0.12)',
          { borderRadius: '8px', zIndex: 1 }),
        txt(cW * 0.49, cH * 0.15, cW * 0.2, cH * 0.05,
          '寝室', '22px', '#30d158', { fontWeight: '700', zIndex: 2 }),
        rct(cW * 0.72, cH * 0.14, cW * 0.24, cH * 0.36, 'rgba(255,159,10,0.12)',
          { borderRadius: '8px', zIndex: 1 }),
        txt(cW * 0.73, cH * 0.15, cW * 0.22, cH * 0.05,
          '水廻り', '22px', '#ff9f0a', { fontWeight: '700', zIndex: 2 }),
        rct(cW * 0.04, cH * 0.52, cW * 0.92, cH * 0.36, 'rgba(191,90,242,0.08)',
          { borderRadius: '8px', zIndex: 1 }),
        txt(cW * 0.05, cH * 0.53, cW * 0.4, cH * 0.05,
          '共用部・動線', '22px', '#bf5af2', { fontWeight: '700', zIndex: 2 }),
        // Legend
        ...COLORS.slice(0, 4).map((c, i) => [
          rct(cW * 0.78, cH * (0.14 + i * 0.045), cW * 0.016, cH * 0.03, c),
          txt(cW * 0.81, cH * (0.14 + i * 0.045), cW * 0.14, cH * 0.03,
            ['LDK', '寝室', '水廻り', '共用部'][i], '16px', TEXT_MD),
        ]).flat(),
        txt(cW * 0.04, cH * 0.91, cW * 0.9, cH * 0.07,
          '※ ゾーン境界・動線・開口部はここに上書きして調整してください',
          '16px', 'rgba(150,150,150,0.6)'),
      ]),
      // ── フロー図 ──────────────────────────────────────────────────────────
      pg('プロセスフロー', [
        rct(0, 0, cW, cH, DARK_BG),
        txt(cW * 0.04, cH * 0.04, cW * 0.8, cH * 0.08,
          'プロセス / PROCESS FLOW', '36px', '#fff', { fontWeight: '700' }),
        ln(cW * 0.04, cH * 0.14, cW * 0.92, 0, LINE_LT),
        // 5 step boxes with arrows
        ...([
          { label: '01\nヒアリング', color: COLORS[0] },
          { label: '02\n基本設計',   color: COLORS[1] },
          { label: '03\n実施設計',   color: COLORS[2] },
          { label: '04\n施工',       color: COLORS[3] },
          { label: '05\n竣工',       color: COLORS[4] },
        ].map((step, i) => {
          const x = cW * (0.04 + i * 0.188);
          return [
            rct(x, cH * 0.25, cW * 0.15, cH * 0.22, step.color, { borderRadius: '12px' }),
            txt(x, cH * 0.29, cW * 0.15, cH * 0.14, step.label,
              '22px', '#fff', { fontWeight: '700', textAlign: 'center' as any, lineHeight: 1.5 as any }),
            // Arrow (except last)
            ...(i < 4 ? [ln(x + cW * 0.15, cH * 0.36, cW * 0.036, 0, 'rgba(255,255,255,0.3)', '2')] : []),
          ];
        })).flat(),
        // Duration row
        txt(cW * 0.04, cH * 0.54, cW * 0.92, cH * 0.06,
          '期間目安：ヒアリング（2週間） → 基本設計（1ヶ月） → 実施設計（1ヶ月） → 施工（3〜6ヶ月） → 竣工',
          '18px', TEXT_DIM),
        txt(cW * 0.04, cH * 0.65, cW * 0.92, cH * 0.28,
          '補足メモ・注意事項をここに入力してください。\n各フェーズの詳細や依頼事項などを記載します。',
          '22px', 'rgba(255,255,255,0.3)'),
      ]),
    ],
  };
}

/**
 * spec_sheet — 仕様書・スペック表
 * A3横: 家具・建材のスペックを整理するシート (2ページ)
 */
function buildSpecSheet(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  const headers = ['品名', 'メーカー', '品番', 'サイズ', '数量', '単価', '備考'];
  const colRatios = [0.18, 0.12, 0.12, 0.12, 0.06, 0.1, 0.2];
  const colX = colRatios.reduce<number[]>((acc, _r, i) => [...acc, (acc[i - 1] ?? 0) + (colRatios[i - 1] ?? 0)], []);

  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      pg('家具リスト', [
        rct(0, 0, cW, cH, '#fff'),
        // Header
        rct(0, 0, cW, cH * 0.1, DARK_BG),
        txt(cW * 0.03, cH * 0.02, cW * 0.5, cH * 0.07,
          '家具・インテリア スペック表', '34px', '#fff', { fontWeight: '700' }),
        txt(cW * 0.7, cH * 0.04, cW * 0.25, cH * 0.04,
          'プロジェクト名 / 2026', '18px', TEXT_DIM, { textAlign: 'right' as any }),
        // Table header row
        rct(cW * 0.02, cH * 0.12, cW * 0.96, cH * 0.07, ACCENT),
        ...headers.map((h, i) =>
          txt(cW * (0.03 + colX[i] * 0.96), cH * 0.135, cW * (colRatios[i] * 0.96 - 0.01), cH * 0.05,
            h, '17px', '#fff', { fontWeight: '700' })
        ),
        // 8 data rows
        ...(Array.from({ length: 8 }).map((_, ri) => [
          rct(cW * 0.02, cH * (0.19 + ri * 0.08), cW * 0.96, cH * 0.08,
            ri % 2 === 0 ? GRAY_BG : '#fff'),
          ...headers.map((_, ci) =>
            txt(cW * (0.03 + colX[ci] * 0.96), cH * (0.2 + ri * 0.08),
              cW * (colRatios[ci] * 0.96 - 0.01), cH * 0.06,
              '─', '18px', 'rgba(200,200,200,0.5)')
          ),
        ])).flat(),
        // Footer
        ln(cW * 0.02, cH * 0.87, cW * 0.96, 0, LINE_DK),
        txt(cW * 0.03, cH * 0.9, cW * 0.5, cH * 0.06,
          '※ 品番・数量・単価は確認後に記載してください', '16px', '#aaa'),
        txt(cW * 0.65, cH * 0.9, cW * 0.3, cH * 0.06,
          '合計: ¥ ─────', '20px', TEXT_DK, { fontWeight: '700', textAlign: 'right' as any }),
      ]),
      pg('建材・仕上げリスト', [
        rct(0, 0, cW, cH, '#fff'),
        rct(0, 0, cW, cH * 0.1, '#1a1a1a'),
        txt(cW * 0.03, cH * 0.02, cW * 0.6, cH * 0.07,
          '建材・仕上げ材 スペック表', '34px', '#fff', { fontWeight: '700' }),
        rct(cW * 0.02, cH * 0.12, cW * 0.96, cH * 0.07, '#1a1a1a'),
        ...(['部位', 'メーカー', '品番・品名', '仕上げ色', '施工範囲', '備考'].map((h, i) => {
          const ratios = [0.1, 0.14, 0.22, 0.14, 0.14, 0.22];
          const xs = ratios.reduce<number[]>((acc, _r, idx) => [...acc, (acc[idx-1] ?? 0) + (ratios[idx-1] ?? 0)], []);
          return txt(cW * (0.03 + xs[i] * 0.96), cH * 0.135, cW * (ratios[i] * 0.96 - 0.01), cH * 0.05,
            h, '17px', '#fff', { fontWeight: '700' });
        })),
        ...(Array.from({ length: 8 }).map((_, ri) =>
          rct(cW * 0.02, cH * (0.19 + ri * 0.08), cW * 0.96, cH * 0.08,
            ri % 2 === 0 ? GRAY_BG : '#fff')
        )),
      ]),
    ],
  };
}

/**
 * interior_pres — インテリアプレゼン
 * ビジュアル重視のインテリア提案書 (3ページ)
 */
function buildInteriorPres(cW = DEFAULT_CANVAS.width, cH = DEFAULT_CANVAS.height): PresentationContent {
  return {
    canvasSize: DEFAULT_CANVAS,
    pages: [
      // ── 表紙 ──────────────────────────────────────────────────────────────
      pg('表紙', [
        img(0, 0, cW, cH, 'メイン画像 (フルブリード)'),
        rct(0, cH * 0.5, cW, cH * 0.5, 'rgba(10,10,20,0.65)'),
        txt(cW * 0.06, cH * 0.55, cW * 0.8, cH * 0.14,
          'プロジェクト名', '64px', '#fff', { fontWeight: '700' }),
        ln(cW * 0.06, cH * 0.73, cW * 0.1, 0, '#fff', '3'),
        txt(cW * 0.06, cH * 0.78, cW * 0.7, cH * 0.08,
          'Interior Design Proposal  ／  2026', '24px', 'rgba(255,255,255,0.65)'),
      ]),
      // ── リビングダイニング ────────────────────────────────────────────────
      pg('リビング・ダイニング', [
        rct(0, 0, cW, cH, '#fff'),
        img(0, 0, cW * 0.58, cH),
        // Right side
        rct(cW * 0.58, 0, cW * 0.42, cH, WARM_BG),
        txt(cW * 0.62, cH * 0.08, cW * 0.34, cH * 0.06,
          'LIVING / DINING', '12px', ACCENT, { fontWeight: '700', letterSpacing: 6 as any }),
        txt(cW * 0.62, cH * 0.15, cW * 0.34, cH * 0.12,
          'リビング・\nダイニング', '40px', TEXT_DK, { fontWeight: '700', lineHeight: 1.3 as any }),
        ln(cW * 0.62, cH * 0.31, cW * 0.08, 0, ACCENT, '3'),
        txt(cW * 0.62, cH * 0.37, cW * 0.34, cH * 0.45,
          'デザインコンセプトや素材感、インテリアの方向性について記載してください。\n\n・ フローリング: オーク材 ナチュラル\n・ 壁面: 珪藻土 オフホワイト\n・ ソファ: ファブリック グレー系',
          '20px', TEXT_MD),
        // 3 small images at bottom right
        img(cW * 0.62, cH * 0.68, cW * 0.12, cH * 0.2, '素材1'),
        img(cW * 0.76, cH * 0.68, cW * 0.12, cH * 0.2, '素材2'),
        img(cW * 0.9,  cH * 0.68, cW * 0.07, cH * 0.2, '素材3'),
      ]),
      // ── キッチン・水廻り ──────────────────────────────────────────────────
      pg('キッチン・水廻り', [
        rct(0, 0, cW, cH, DARK_BG),
        txt(cW * 0.04, cH * 0.04, cW * 0.8, cH * 0.06,
          'KITCHEN & WET AREA', '12px', ACCENT, { fontWeight: '700', letterSpacing: 5 as any }),
        txt(cW * 0.04, cH * 0.1, cW * 0.8, cH * 0.1,
          'キッチン・水廻り', '48px', '#fff', { fontWeight: '700' }),
        ln(cW * 0.04, cH * 0.23, cW * 0.92, 0, LINE_LT),
        // 2 large images
        img(cW * 0.04, cH * 0.27, cW * 0.44, cH * 0.56, 'キッチン画像'),
        img(cW * 0.52, cH * 0.27, cW * 0.44, cH * 0.56, '水廻り画像'),
        txt(cW * 0.04, cH * 0.86, cW * 0.92, cH * 0.1,
          'キッチン・バス・トイレなどの水廻りのデザイン提案内容を記載してください。',
          '20px', TEXT_DIM),
      ]),
    ],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type TemplateId =
  | 'blank'
  | 'client_proposal'
  | 'design_review'
  | 'mood_board'
  | 'material_board'
  | 'diagram'
  | 'spec_sheet'
  | 'interior_pres'
  | 'infinite_board';

export function buildInitialContent(templateId: TemplateId): PresentationContent {
  const cW = DEFAULT_CANVAS.width;
  const cH = DEFAULT_CANVAS.height;

  switch (templateId) {
    case 'client_proposal':  return buildClientProposal(cW, cH);
    case 'design_review':    return buildDesignReview(cW, cH);
    case 'mood_board':       return buildMoodBoard(cW, cH);
    case 'material_board':   return buildMaterialBoard(cW, cH);
    case 'diagram':          return buildDiagram(cW, cH);
    case 'spec_sheet':       return buildSpecSheet(cW, cH);
    case 'interior_pres':    return buildInteriorPres(cW, cH);
    case 'blank':
    case 'infinite_board':
    default:
      return buildBlank();
  }
}
