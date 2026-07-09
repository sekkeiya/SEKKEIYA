import type {
  PresentationElement,
  PresentationPage,
  PresentationContent,
  TextElementData,
  ImageElementData,
  ShapeElementData,
  LineElementData,
} from '../types/dsp.types';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const ACCENT = '#29b6f6';
const DARK_BG = '#0d1b2a';
const LIGHT_BG = '#f7f9fc';
const GREEN = '#30d158';

// ─── Types ─────────────────────────────────────────────────────────────────────
type El = Omit<PresentationElement, 'id'>;

// ─── Element helpers ───────────────────────────────────────────────────────────
function rct(x: number, y: number, w: number, h: number, fill: string, opts?: Partial<ShapeElementData & { zIndex?: number; rotation?: number }>): El {
  const { zIndex = 1, rotation = 0, ...rest } = opts || {};
  return {
    type: 'shape',
    x, y, w, h,
    zIndex,
    rotation,
    opacity: 100,
    data: { shapeType: 'rect', fill, ...rest } as ShapeElementData,
  };
}

function txt(x: number, y: number, w: number, h: number, text: string, fontSize: string, color: string, opts?: Partial<TextElementData & { zIndex?: number; rotation?: number }>): El {
  const { zIndex = 3, rotation = 0, ...rest } = opts || {};
  return {
    type: 'text',
    x, y, w, h,
    zIndex,
    rotation,
    opacity: 100,
    data: { text, fontSize, color, textAlign: 'left', ...rest } as TextElementData,
  };
}

function btxt(x: number, y: number, w: number, h: number, text: string, fontSize: string, color: string, opts?: Partial<TextElementData & { zIndex?: number; rotation?: number }>): El {
  return txt(x, y, w, h, text, fontSize, color, { fontWeight: '700', ...opts });
}

function imgEl(x: number, y: number, w: number, h: number, alt?: string): El {
  return {
    type: 'image',
    x, y, w, h,
    zIndex: 2,
    rotation: 0,
    opacity: 100,
    data: { src: '', alt: alt || '画像をドロップ' } as ImageElementData,
  };
}

function lineEl(x: number, y: number, w: number, stroke?: string, strokeWidth?: string): El {
  const c = stroke || 'rgba(255,255,255,0.2)';
  return {
    type: 'line',
    x, y, w, h: 0,
    zIndex: 2,
    rotation: 0,
    opacity: 100,
    data: { fill: c, stroke: c, strokeWidth: strokeWidth || '2' } as LineElementData,
  };
}

// ─── Page builder ──────────────────────────────────────────────────────────────
function pg(name: string, els: El[]): PresentationPage {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `p-${uid}`,
    name,
    elements: els.map((el, i) => ({ ...el, id: `e-${uid}-${i}` })) as PresentationElement[],
  };
}

// ─── Slide builder helpers ──────────────────────────────────────────────────────

/** ダーク系タイトルスライド */
function titleDark(cW: number, cH: number, title: string, sub: string): PresentationPage {
  return pg('表紙', [
    rct(0, 0, cW, cH, DARK_BG, { zIndex: 0 }),
    rct(0, 0, cW * 0.04, cH, ACCENT, { zIndex: 1 }),
    rct(0, cH * 0.6, cW, cH * 0.4, '#0a1520', { zIndex: 1 }),
    lineEl(cW * 0.08, cH * 0.46, cW * 0.1, ACCENT, '5'),
    btxt(cW * 0.08, cH * 0.15, cW * 0.84, cH * 0.28, title, '72px', '#ffffff', { zIndex: 3 }),
    txt(cW * 0.08, cH * 0.5, cW * 0.6, cH * 0.1, sub, '26px', 'rgba(255,255,255,0.6)', { zIndex: 3 }),
  ]);
}

/** ライト系タイトルスライド */
function titleLight(cW: number, cH: number, title: string, sub: string): PresentationPage {
  return pg('表紙', [
    rct(0, 0, cW, cH, LIGHT_BG, { zIndex: 0 }),
    rct(0, 0, cW, cH * 0.08, ACCENT, { zIndex: 1 }),
    lineEl(cW * 0.08, cH * 0.46, cW * 0.1, ACCENT, '5'),
    btxt(cW * 0.08, cH * 0.2, cW * 0.84, cH * 0.3, title, '72px', '#1d1d1f', { zIndex: 3 }),
    txt(cW * 0.08, cH * 0.54, cW * 0.6, cH * 0.1, sub, '26px', '#6e6e73', { zIndex: 3 }),
  ]);
}

/** セクション区切りスライド */
function sectionDivider(cW: number, cH: number, num: string, title: string, bg?: string): PresentationPage {
  const bgColor = bg || ACCENT;
  return pg(`Section: ${title}`, [
    rct(0, 0, cW, cH, bgColor, { zIndex: 0 }),
    rct(0, 0, cW * 0.04, cH, 'rgba(0,0,0,0.2)', { zIndex: 1 }),
    txt(cW * 0.1, cH * 0.3, cW * 0.8, cH * 0.15, num, '28px', 'rgba(255,255,255,0.65)', { zIndex: 2, fontWeight: '500' }),
    btxt(cW * 0.1, cH * 0.44, cW * 0.8, cH * 0.24, title, '68px', '#ffffff', { zIndex: 2 }),
  ]);
}

/** タイトル＋コンテンツスライド */
function titleContent(cW: number, cH: number, title: string, body: string, pageName?: string): PresentationPage {
  return pg(pageName || title, [
    rct(0, 0, cW, cH, LIGHT_BG, { zIndex: 0 }),
    rct(0, 0, cW, cH * 0.16, '#ffffff', { zIndex: 1 }),
    btxt(cW * 0.05, cH * 0.03, cW * 0.9, cH * 0.12, title, '44px', '#1d1d1f', { zIndex: 2 }),
    lineEl(cW * 0.05, cH * 0.17, cW * 0.9, '#d2d2d7', '1'),
    txt(cW * 0.05, cH * 0.22, cW * 0.9, cH * 0.7, body, '26px', '#3a3a3c', { zIndex: 2 }),
  ]);
}

/** 全面画像スライド */
function fullImage(cW: number, cH: number, name: string, caption?: string): PresentationPage {
  return pg(name, [
    imgEl(0, 0, cW, cH, '画像をドロップ'),
    rct(0, cH * 0.65, cW, cH * 0.35, 'rgba(0,0,0,0.55)', { zIndex: 3 }),
    ...(caption ? [btxt(cW * 0.06, cH * 0.7, cW * 0.88, cH * 0.15, caption, '44px', '#ffffff', { zIndex: 4 })] : []),
  ]);
}

/** 2カラムスライド */
function twoCol(cW: number, cH: number, name: string, leftBody: string, rightBody: string): PresentationPage {
  return pg(name, [
    rct(0, 0, cW, cH, LIGHT_BG, { zIndex: 0 }),
    btxt(cW * 0.05, cH * 0.04, cW * 0.9, cH * 0.1, name, '40px', '#1d1d1f', { zIndex: 2 }),
    lineEl(cW * 0.05, cH * 0.155, cW * 0.9, '#d2d2d7', '1'),
    // Left column
    rct(cW * 0.05, cH * 0.18, cW * 0.42, cH * 0.75, '#ffffff', { zIndex: 2, borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }),
    btxt(cW * 0.07, cH * 0.21, cW * 0.38, cH * 0.08, '左エリア', '26px', '#1d1d1f', { zIndex: 3 }),
    txt(cW * 0.07, cH * 0.31, cW * 0.38, cH * 0.58, leftBody, '22px', '#3a3a3c', { zIndex: 3 }),
    // Right column
    rct(cW * 0.53, cH * 0.18, cW * 0.42, cH * 0.75, '#ffffff', { zIndex: 2, borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }),
    btxt(cW * 0.55, cH * 0.21, cW * 0.38, cH * 0.08, '右エリア', '26px', '#1d1d1f', { zIndex: 3 }),
    txt(cW * 0.55, cH * 0.31, cW * 0.38, cH * 0.58, rightBody, '22px', '#3a3a3c', { zIndex: 3 }),
  ]);
}

/** 4グリッドカードスライド */
function grid4(cW: number, cH: number, name: string, items: { label: string; icon: string }[]): PresentationPage {
  const pad = cW * 0.04;
  const cellW = (cW - pad * 3) / 2;
  const cellH = (cH * 0.78 - pad) / 2;
  const cells = items.slice(0, 4);
  const cellEls: El[] = cells.flatMap((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cellW + pad);
    const y = cH * 0.17 + row * (cellH + pad);
    return [
      rct(x, y, cellW, cellH, '#ffffff', { zIndex: 2, borderRadius: '16px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }),
      txt(x + cellW * 0.1, y + cellH * 0.1, cellW * 0.8, cellH * 0.35, c.icon, '52px', '#1d1d1f', { zIndex: 3, textAlign: 'center' }),
      btxt(x + cellW * 0.05, y + cellH * 0.5, cellW * 0.9, cellH * 0.2, c.label, '24px', '#1d1d1f', { zIndex: 3, textAlign: 'center' }),
    ];
  });
  return pg(name, [
    rct(0, 0, cW, cH, LIGHT_BG, { zIndex: 0 }),
    btxt(pad, cH * 0.04, cW - pad * 2, cH * 0.1, name, '40px', '#1d1d1f', { zIndex: 2, textAlign: 'center' }),
    ...cellEls,
  ]);
}

/** KPI数値スライド */
function kpiSlide(cW: number, cH: number, name: string, metrics: { val: string; label: string; color: string }[]): PresentationPage {
  const items = metrics.slice(0, 3);
  const colW = cW * 0.28;
  const spacing = (cW - colW * items.length) / (items.length + 1);
  const metricEls: El[] = items.flatMap((m, i) => {
    const x = spacing + i * (colW + spacing);
    return [
      rct(x, cH * 0.2, colW, cH * 0.6, 'rgba(255,255,255,0.06)', { zIndex: 2, borderRadius: '20px' }),
      btxt(x, cH * 0.32, colW, cH * 0.2, m.val, '62px', m.color, { zIndex: 3, textAlign: 'center' }),
      txt(x, cH * 0.57, colW, cH * 0.1, m.label, '20px', 'rgba(255,255,255,0.6)', { zIndex: 3, textAlign: 'center' }),
    ];
  });
  return pg(name, [
    rct(0, 0, cW, cH, DARK_BG, { zIndex: 0 }),
    rct(0, 0, cW * 0.04, cH, GREEN, { zIndex: 1 }),
    btxt(cW * 0.08, cH * 0.06, cW * 0.84, cH * 0.1, name, '40px', '#ffffff', { zIndex: 2 }),
    lineEl(cW * 0.08, cH * 0.17, cW * 0.84, GREEN, '2'),
    ...metricEls,
  ]);
}

/** 結びスライド（ダーク） */
function closingDark(cW: number, cH: number, message: string): PresentationPage {
  return pg('結び', [
    rct(0, 0, cW, cH, DARK_BG, { zIndex: 0 }),
    rct(cW * 0.35, 0, cW * 0.04, cH, ACCENT, { zIndex: 1 }),
    btxt(cW * 0.08, cH * 0.35, cW * 0.84, cH * 0.3, message, '56px', '#ffffff', { zIndex: 2, textAlign: 'center' }),
  ]);
}

// ─── Public template interface ──────────────────────────────────────────────────
export interface BuiltInDeckTemplate {
  id: string;
  name: string;
  description: string;
  category: 'proposal' | 'list' | 'report' | 'portfolio' | 'other';
  slideCount: number;
  previewBg: string;
  emoji: string;
  buildContent: (cW: number, cH: number) => PresentationContent;
}

// ─── Built-in templates ────────────────────────────────────────────────────────
export const BUILT_IN_DECK_TEMPLATES: BuiltInDeckTemplate[] = [
  // ── 1. コンペ提案書 ────────────────────────────────────────────────────────
  {
    id: 'builtin_competition',
    name: 'コンペ提案書',
    description: '建築コンペ向けの本格的な提案書。コンセプト・サイト分析・図面・素材仕上げを8スライドで構成。',
    category: 'proposal',
    slideCount: 8,
    previewBg: '#0d1b2a',
    emoji: '🏛️',
    buildContent: (cW, cH) => ({
      pages: [
        titleDark(cW, cH, 'コンペ提案書', '建築設計競技 提出書類'),
        sectionDivider(cW, cH, 'SECTION 01', '設計コンセプト'),
        titleContent(
          cW, cH,
          '設計コンセプト',
          '自然と建築が対話する空間を目指し、\n敷地固有の地形・光・風を読み解いた\nオーガニックな設計提案です。\n\n・周辺環境との調和\n・光と影の演出\n・持続可能な素材選択',
          '設計コンセプト'
        ),
        twoCol(
          cW, cH,
          'サイト分析',
          '【敷地条件】\n・敷地面積: 850㎡\n・北側道路 幅員6m\n・南側隣地との日照確保\n・前面道路との高低差 1.5m',
          '【法規制】\n・用途地域: 第1種低層\n・建蔽率: 40%\n・容積率: 80%\n・高さ制限: 10m\n・北側斜線制限あり'
        ),
        pg('1F 平面図', [
          rct(0, 0, cW, cH, '#f0f0f0', { zIndex: 0 }),
          imgEl(cW * 0.05, cH * 0.05, cW * 0.9, cH * 0.8, '1F 平面図'),
          rct(0, cH * 0.88, cW, cH * 0.12, 'rgba(0,0,0,0.85)', { zIndex: 3 }),
          btxt(cW * 0.05, cH * 0.9, cW * 0.5, cH * 0.08, '1F PLAN  1:100', '22px', '#ffffff', { zIndex: 4 }),
        ]),
        fullImage(cW, cH, '外観パース', '外観パース'),
        grid4(cW, cH, '素材・仕上げ', [
          { label: '外壁', icon: '🧱' },
          { label: '床材', icon: '🪵' },
          { label: '開口部', icon: '🪟' },
          { label: '屋根', icon: '🏠' },
        ]),
        closingDark(cW, cH, 'ご審査よろしく\nお願いいたします'),
      ],
    }),
  },

  // ── 2. 設計提案書 ─────────────────────────────────────────────────────────
  {
    id: 'builtin_proposal',
    name: '設計提案書',
    description: 'クライアント向けの設計提案書。要望整理・設計方針・ゾーニング・スケジュールを7スライドで整理。',
    category: 'proposal',
    slideCount: 7,
    previewBg: '#f7f9fc',
    emoji: '📋',
    buildContent: (cW, cH) => ({
      pages: [
        titleLight(cW, cH, '設計提案書', '株式会社〇〇  御中'),
        titleContent(
          cW, cH,
          'お客様のご要望',
          '・開放的なLDKと家族の繋がりを大切にした間取り\n・在宅ワーク対応の書斎スペース\n・収納を充実させたシンプルな生活動線\n・将来的な二世帯対応を視野に入れた設計\n・省エネ性能と自然素材へのこだわり',
          '要望整理'
        ),
        titleContent(
          cW, cH,
          '設計方針',
          '【コンセプト: 「つながりと余白」】\n\n1. 可変性のある大空間LDKを中心に配置\n2. 光庭を設けて各室に自然光を届ける\n3. ウッドデッキで内外をシームレスに繋ぐ\n4. 蔵収納による生活感のないすっきり空間',
          '設計方針'
        ),
        twoCol(
          cW, cH,
          'ゾーニング提案',
          '【1F ゾーン】\n・玄関・土間続き収納\n・LDK（30帖）+ 和室\n・水廻り（洗面・浴室）\n・ガレージ直結の動線',
          '【2F ゾーン】\n・主寝室（WIC付き）\n・子ども室×2\n・在宅ワーク書斎\n・書斎横のバルコニー'
        ),
        titleContent(
          cW, cH,
          'スケジュール',
          '■ 基本設計  2025年 6月〜 9月（4ヶ月）\n■ 実施設計  2025年10月〜12月（3ヶ月）\n■ 確認申請  2026年 1月〜 2月\n■ 着　工    2026年 3月\n■ 竣　工    2026年12月（予定）',
          'スケジュール'
        ),
        fullImage(cW, cH, '完成イメージ', '完成イメージパース'),
        grid4(cW, cH, '素材・カラー提案', [
          { label: '外壁', icon: '⬜' },
          { label: '床材', icon: '🟫' },
          { label: 'キッチン', icon: '🍳' },
          { label: '建具', icon: '🚪' },
        ]),
      ],
    }),
  },

  // ── 3. インテリアプレゼン ──────────────────────────────────────────────────
  {
    id: 'builtin_interior',
    name: 'インテリアプレゼン',
    description: 'ウォームトーンのインテリア提案書。コンセプト・カラー&マテリアル・各室提案を6スライドで構成。',
    category: 'proposal',
    slideCount: 6,
    previewBg: '#f5ede3',
    emoji: '🛋️',
    buildContent: (cW, cH) => {
      const WARM = '#f5ede3';
      const WARM_DARK = '#3b2f27';
      const WARM_ACCENT = '#c8956c';
      return {
        pages: [
          // 表紙: 左半分画像、右半分テキスト
          pg('表紙', [
            rct(0, 0, cW, cH, WARM, { zIndex: 0 }),
            imgEl(0, 0, cW * 0.5, cH, 'インテリアイメージ'),
            rct(cW * 0.5, 0, cW * 0.5, cH, WARM, { zIndex: 1 }),
            rct(cW * 0.5, 0, cW * 0.5, cH * 0.06, WARM_ACCENT, { zIndex: 2 }),
            btxt(cW * 0.56, cH * 0.25, cW * 0.38, cH * 0.22, 'インテリア\nデザイン提案', '52px', WARM_DARK, { zIndex: 3 }),
            lineEl(cW * 0.56, cH * 0.5, cW * 0.1, WARM_ACCENT, '4'),
            txt(cW * 0.56, cH * 0.55, cW * 0.38, cH * 0.1, '〇〇邸 リノベーション計画', '22px', WARM_ACCENT, { zIndex: 3 }),
          ]),
          // コンセプト
          pg('コンセプト', [
            rct(0, 0, cW, cH, WARM, { zIndex: 0 }),
            btxt(cW * 0.06, cH * 0.06, cW * 0.88, cH * 0.12, 'CONCEPT', '14px', WARM_ACCENT, { zIndex: 2, fontWeight: '600' }),
            btxt(cW * 0.06, cH * 0.14, cW * 0.88, cH * 0.18, '温もりと洗練、\n自然素材が紡ぐ住まい。', '52px', WARM_DARK, { zIndex: 2 }),
            lineEl(cW * 0.06, cH * 0.35, cW * 0.12, WARM_ACCENT, '4'),
            txt(cW * 0.06, cH * 0.4, cW * 0.55, cH * 0.48, '天然木・漆喰・麻布など自然素材を中心に、\n時間とともに風合いが増すインテリアを提案します。\n\n無駄を削ぎ落としたシンプルな空間に、\n温かみのある質感と柔らかい光を取り込み、\n日常を特別にする住まいを実現します。', '24px', WARM_DARK, { zIndex: 2 }),
            imgEl(cW * 0.65, cH * 0.08, cW * 0.3, cH * 0.84, 'コンセプト画像'),
          ]),
          // カラー&マテリアル
          pg('カラー&マテリアル', [
            rct(0, 0, cW, cH, WARM, { zIndex: 0 }),
            btxt(cW * 0.06, cH * 0.04, cW * 0.88, cH * 0.1, 'COLOR & MATERIAL', '40px', WARM_DARK, { zIndex: 2 }),
            lineEl(cW * 0.06, cH * 0.155, cW * 0.88, WARM_ACCENT, '2'),
            // Color swatches
            ...(['#f5ede3', '#3b2f27', '#c8956c', '#e8ddd0'].map((color, i) => (
              rct(cW * (0.06 + i * 0.22), cH * 0.2, cW * 0.18, cH * 0.28, color, { zIndex: 3, borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' })
            ))),
            // Material labels
            ...(['ウォームベージュ', 'ウォルナット', 'テラコッタ', 'リネン'].map((label, i) => (
              txt(cW * (0.06 + i * 0.22), cH * 0.5, cW * 0.18, cH * 0.06, label, '16px', WARM_DARK, { zIndex: 3, textAlign: 'center' })
            ))),
            btxt(cW * 0.06, cH * 0.6, cW * 0.44, cH * 0.1, '使用素材', '22px', WARM_DARK, { zIndex: 2 }),
            txt(cW * 0.06, cH * 0.72, cW * 0.44, cH * 0.22, '・床材: 無垢オークフローリング\n・壁面: 漆喰塗り仕上げ\n・天井: 無垢杉板張り', '20px', WARM_DARK, { zIndex: 2 }),
            imgEl(cW * 0.55, cH * 0.6, cW * 0.4, cH * 0.34, '素材サンプル'),
          ]),
          // リビング提案
          pg('リビング', [
            rct(0, 0, cW, cH, '#2a2220', { zIndex: 0 }),
            imgEl(0, 0, cW * 0.6, cH, 'リビングイメージ'),
            rct(cW * 0.6, 0, cW * 0.4, cH, '#1c1a18', { zIndex: 1 }),
            btxt(cW * 0.64, cH * 0.12, cW * 0.32, cH * 0.08, 'LIVING ROOM', '14px', WARM_ACCENT, { zIndex: 3, fontWeight: '600' }),
            btxt(cW * 0.64, cH * 0.22, cW * 0.32, cH * 0.16, 'ファミリー\nリビング', '42px', '#fff8f3', { zIndex: 3 }),
            lineEl(cW * 0.64, cH * 0.4, cW * 0.08, WARM_ACCENT, '3'),
            txt(cW * 0.64, cH * 0.45, cW * 0.32, cH * 0.4, '大きな開口から光が降り注ぐ\n30帖のオープンリビング。\n天然木の梁を活かした\n高天井空間が、家族の\n日常を豊かに包みます。', '20px', '#e8d8cc', { zIndex: 3 }),
          ]),
          // 各室提案
          twoCol(
            cW, cH,
            '各室提案',
            '【主寝室】\n落ち着いたグレーとウォールナットで\n統一した大人の寝室。\nヘッドボード壁のエコカラットが\n湿度を調整しながら表情を添える。',
            '【子ども室】\n白を基調とした明るい空間に、\n遊び心のある差し色を取り入れた\n子ども部屋。成長に合わせて\n模様替えできる可変レイアウト。'
          ),
          // 家具提案
          grid4(cW, cH, '家具・照明提案', [
            { label: 'ソファ', icon: '🛋️' },
            { label: 'ダイニング', icon: '🍽️' },
            { label: '照明', icon: '💡' },
            { label: '観葉植物', icon: '🌿' },
          ]),
        ],
      };
    },
  },

  // ── 4. 家具・製品カタログ ──────────────────────────────────────────────────
  {
    id: 'builtin_catalog',
    name: '家具・製品カタログ',
    description: '家具・製品の調達リスト。部屋別グリッドと仕様・価格一覧を5スライドで整理したカタログ形式。',
    category: 'list',
    slideCount: 5,
    previewBg: '#fafafa',
    emoji: '📦',
    buildContent: (cW, cH) => ({
      pages: [
        titleLight(cW, cH, '家具・製品\n調達リスト', '〇〇邸 インテリア選定'),
        grid4(cW, cH, 'リビング', [
          { label: 'ソファ', icon: '🛋️' },
          { label: 'センターテーブル', icon: '🪑' },
          { label: 'TVボード', icon: '📺' },
          { label: 'ラグ', icon: '🟫' },
        ]),
        grid4(cW, cH, 'ダイニング・キッチン', [
          { label: 'ダイニングテーブル', icon: '🍽️' },
          { label: 'チェア', icon: '🪑' },
          { label: '食器棚', icon: '🫙' },
          { label: 'キッチン雑貨', icon: '🍳' },
        ]),
        grid4(cW, cH, '寝室', [
          { label: 'ベッドフレーム', icon: '🛏️' },
          { label: 'ナイトテーブル', icon: '💡' },
          { label: 'ドレッサー', icon: '🪞' },
          { label: 'クローゼット', icon: '🚪' },
        ]),
        // 仕様・価格一覧（テーブル形式）
        pg('仕様・価格一覧', [
          rct(0, 0, cW, cH, LIGHT_BG, { zIndex: 0 }),
          btxt(cW * 0.05, cH * 0.04, cW * 0.9, cH * 0.1, '仕様・価格一覧', '40px', '#1d1d1f', { zIndex: 2 }),
          lineEl(cW * 0.05, cH * 0.155, cW * 0.9, '#d2d2d7', '1'),
          // Header row
          rct(cW * 0.05, cH * 0.17, cW * 0.9, cH * 0.07, ACCENT, { zIndex: 2, borderRadius: '8px 8px 0 0' }),
          txt(cW * 0.06, cH * 0.185, cW * 0.28, cH * 0.05, '品目', '18px', '#ffffff', { zIndex: 3, fontWeight: '600' }),
          txt(cW * 0.34, cH * 0.185, cW * 0.2, cH * 0.05, 'メーカー', '18px', '#ffffff', { zIndex: 3, fontWeight: '600' }),
          txt(cW * 0.54, cH * 0.185, cW * 0.15, cH * 0.05, '数量', '18px', '#ffffff', { zIndex: 3, fontWeight: '600', textAlign: 'center' }),
          txt(cW * 0.69, cH * 0.185, cW * 0.26, cH * 0.05, '金額（税込）', '18px', '#ffffff', { zIndex: 3, fontWeight: '600', textAlign: 'right' }),
          // Data rows
          ...[
            ['ソファ（3人掛け）', '〇〇ブランド', '1脚', '¥280,000'],
            ['ダイニングテーブル', '△△ファニチャー', '1台', '¥145,000'],
            ['ダイニングチェア', '△△ファニチャー', '4脚', '¥180,000'],
            ['ベッドフレーム（Q）', '□□インテリア', '1台', '¥220,000'],
            ['照明セット', '各種', '一式', '¥380,000'],
          ].flatMap(([item, maker, qty, price], idx) => {
            const rowY = cH * (0.24 + idx * 0.11);
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f5f5f7';
            return [
              rct(cW * 0.05, rowY, cW * 0.9, cH * 0.1, rowBg, { zIndex: 2 }),
              txt(cW * 0.06, rowY + cH * 0.025, cW * 0.28, cH * 0.06, item, '18px', '#1d1d1f', { zIndex: 3 }),
              txt(cW * 0.34, rowY + cH * 0.025, cW * 0.2, cH * 0.06, maker, '18px', '#6e6e73', { zIndex: 3 }),
              txt(cW * 0.54, rowY + cH * 0.025, cW * 0.15, cH * 0.06, qty, '18px', '#3a3a3c', { zIndex: 3, textAlign: 'center' }),
              txt(cW * 0.69, rowY + cH * 0.025, cW * 0.26, cH * 0.06, price, '18px', '#1d1d1f', { zIndex: 3, textAlign: 'right', fontWeight: '600' }),
            ];
          }),
          // Total row
          rct(cW * 0.05, cH * 0.79, cW * 0.9, cH * 0.1, DARK_BG, { zIndex: 2, borderRadius: '0 0 8px 8px' }),
          btxt(cW * 0.06, cH * 0.815, cW * 0.6, cH * 0.06, '合計（税込）', '20px', '#ffffff', { zIndex: 3 }),
          btxt(cW * 0.69, cH * 0.815, cW * 0.26, cH * 0.06, '¥1,205,000', '22px', ACCENT, { zIndex: 3, textAlign: 'right' }),
        ]),
      ],
    }),
  },

  // ── 5. 進捗報告書 ─────────────────────────────────────────────────────────
  {
    id: 'builtin_progress',
    name: '進捗報告書',
    description: 'ダーク濃紺＋グリーンアクセントの進捗報告書。KPI・完了項目・課題・次回予定を6スライドで構成。',
    category: 'report',
    slideCount: 6,
    previewBg: '#0f2535',
    emoji: '📊',
    buildContent: (cW, cH) => {
      const NAVY = '#0f2535';
      return {
        pages: [
          // 表紙（ダーク＋グリーン縦帯）
          pg('表紙', [
            rct(0, 0, cW, cH, NAVY, { zIndex: 0 }),
            rct(0, 0, cW * 0.06, cH, GREEN, { zIndex: 1 }),
            rct(cW * 0.06, 0, cW * 0.02, cH, 'rgba(48,209,88,0.25)', { zIndex: 1 }),
            btxt(cW * 0.12, cH * 0.18, cW * 0.8, cH * 0.28, '工事進捗\n報告書', '68px', '#ffffff', { zIndex: 3 }),
            lineEl(cW * 0.12, cH * 0.5, cW * 0.15, GREEN, '4'),
            txt(cW * 0.12, cH * 0.56, cW * 0.7, cH * 0.08, '報告日: 2025年12月01日', '24px', 'rgba(255,255,255,0.65)', { zIndex: 3 }),
            txt(cW * 0.12, cH * 0.65, cW * 0.7, cH * 0.08, '現場: 〇〇邸 新築工事', '24px', 'rgba(255,255,255,0.65)', { zIndex: 3 }),
          ]),
          // KPIスライド
          kpiSlide(cW, cH, '全体進捗', [
            { val: '68%', label: '進捗率', color: GREEN },
            { val: '42', label: '完了タスク数', color: ACCENT },
            { val: '3', label: '未解決課題数', color: '#ff9f0a' },
          ]),
          // 完了項目
          titleContent(
            cW, cH,
            '今月の完了項目',
            '✅ 基礎工事（捨コン・配筋・生コン打設）\n✅ 型枠解体・養生期間終了\n✅ 土台・大引き敷設完了\n✅ 1F床下地合板貼り完了\n✅ 柱・梁の建方作業開始\n⏳ 上棟（今月末予定）',
            '完了項目'
          ),
          // 現場写真（2カラム）
          pg('現場写真', [
            rct(0, 0, cW, cH, NAVY, { zIndex: 0 }),
            btxt(cW * 0.05, cH * 0.04, cW * 0.9, cH * 0.1, '現場写真', '40px', '#ffffff', { zIndex: 2 }),
            lineEl(cW * 0.05, cH * 0.155, cW * 0.9, GREEN, '2'),
            imgEl(cW * 0.05, cH * 0.18, cW * 0.42, cH * 0.55, '現場写真①'),
            txt(cW * 0.05, cH * 0.745, cW * 0.42, cH * 0.06, '基礎工事完了状況', '18px', 'rgba(255,255,255,0.7)', { zIndex: 3 }),
            imgEl(cW * 0.53, cH * 0.18, cW * 0.42, cH * 0.55, '現場写真②'),
            txt(cW * 0.53, cH * 0.745, cW * 0.42, cH * 0.06, '土台・大引き敷設完了', '18px', 'rgba(255,255,255,0.7)', { zIndex: 3 }),
          ]),
          // 課題・懸念事項
          pg('課題・懸念事項', [
            rct(0, 0, cW, cH, NAVY, { zIndex: 0 }),
            rct(0, 0, cW * 0.04, cH, '#ff453a', { zIndex: 1 }),
            btxt(cW * 0.08, cH * 0.06, cW * 0.84, cH * 0.1, '課題・懸念事項', '40px', '#ffffff', { zIndex: 2 }),
            lineEl(cW * 0.08, cH * 0.17, cW * 0.84, '#ff453a', '2'),
            ...[
              { num: '1', title: '資材納期遅延', body: 'サッシ類の納期が1週間遅延の見込み。\n→ 工程の見直しで吸収予定（上棟後工程に影響なし）' },
              { num: '2', title: '隣地境界確認', body: 'GL近傍の境界杭が確認できず。\n→ 土地家屋調査士と現地確認を12/10に設定済み' },
              { num: '3', title: '天候リスク', body: '12月後半の降雪・凍結リスクに備え、\n上棟後の養生計画を強化する。' },
            ].flatMap((item, i) => [
              rct(cW * 0.08, cH * (0.22 + i * 0.24), cW * 0.84, cH * 0.21, 'rgba(255,255,255,0.05)', { zIndex: 2, borderRadius: '12px' }),
              rct(cW * 0.08, cH * (0.22 + i * 0.24), cW * 0.006, cH * 0.21, '#ff453a', { zIndex: 3, borderRadius: '12px 0 0 12px' }),
              btxt(cW * 0.1, cH * (0.24 + i * 0.24), cW * 0.7, cH * 0.07, `#${item.num}  ${item.title}`, '22px', '#ffffff', { zIndex: 3 }),
              txt(cW * 0.1, cH * (0.3 + i * 0.24), cW * 0.76, cH * 0.1, item.body, '18px', 'rgba(255,255,255,0.65)', { zIndex: 3 }),
            ]),
          ]),
          // 次回予定
          pg('次回予定', [
            rct(0, 0, cW, cH, NAVY, { zIndex: 0 }),
            rct(0, 0, cW * 0.04, cH, GREEN, { zIndex: 1 }),
            btxt(cW * 0.08, cH * 0.06, cW * 0.84, cH * 0.1, '次回作業予定', '40px', '#ffffff', { zIndex: 2 }),
            lineEl(cW * 0.08, cH * 0.17, cW * 0.84, GREEN, '2'),
            ...[
              ['12/08', '上棟作業（予定）', GREEN],
              ['12/10', '境界確認立会い', '#ffcc00'],
              ['12/15', '屋根下地・防水シート工事', GREEN],
              ['12/20', '第2回現場確認（施主同席）', ACCENT],
              ['01/10', '次回進捗報告書提出', 'rgba(255,255,255,0.5)'],
            ].map(([date, label, color], i) => ([
              rct(cW * 0.08, cH * (0.22 + i * 0.13), cW * 0.84, cH * 0.11, 'rgba(255,255,255,0.04)', { zIndex: 2, borderRadius: '8px' }),
              txt(cW * 0.09, cH * (0.245 + i * 0.13), cW * 0.16, cH * 0.07, date, '20px', color as string, { zIndex: 3, fontWeight: '700' }),
              txt(cW * 0.26, cH * (0.245 + i * 0.13), cW * 0.65, cH * 0.07, label, '20px', '#ffffff', { zIndex: 3 }),
            ])).flat(),
          ]),
        ],
      };
    },
  },

  // ── 6. プロジェクトポートフォリオ ─────────────────────────────────────────
  {
    id: 'builtin_portfolio',
    name: 'プロジェクトポートフォリオ',
    description: 'ダーク系のプロジェクトポートフォリオ。プロフィール・理念・作品2点・お問い合わせを5スライドで構成。',
    category: 'portfolio',
    slideCount: 5,
    previewBg: '#1d1d1f',
    emoji: '🎨',
    buildContent: (cW, cH) => {
      const PF_DARK = '#1d1d1f';
      const PF_ACCENT = '#f5f5f5';
      return {
        pages: [
          // 表紙: 左半分画像、右半分タイトル
          pg('表紙', [
            rct(0, 0, cW, cH, PF_DARK, { zIndex: 0 }),
            imgEl(0, 0, cW * 0.52, cH, 'ポートフォリオ表紙画像'),
            rct(cW * 0.52, 0, cW * 0.48, cH, PF_DARK, { zIndex: 1 }),
            rct(cW * 0.52, 0, cW * 0.48, cH * 0.04, ACCENT, { zIndex: 2 }),
            btxt(cW * 0.58, cH * 0.18, cW * 0.36, cH * 0.2, 'PORTFOLIO', '52px', PF_ACCENT, { zIndex: 3 }),
            lineEl(cW * 0.58, cH * 0.42, cW * 0.12, ACCENT, '4'),
            txt(cW * 0.58, cH * 0.48, cW * 0.36, cH * 0.1, '〇〇 建築設計事務所', '24px', 'rgba(255,255,255,0.65)', { zIndex: 3 }),
            txt(cW * 0.58, cH * 0.58, cW * 0.36, cH * 0.08, '2020 – 2025 Selected Works', '18px', 'rgba(255,255,255,0.4)', { zIndex: 3 }),
          ]),
          // プロフィール・理念
          pg('プロフィール・理念', [
            rct(0, 0, cW, cH, PF_DARK, { zIndex: 0 }),
            rct(0, 0, cW * 0.04, cH, ACCENT, { zIndex: 1 }),
            btxt(cW * 0.08, cH * 0.08, cW * 0.84, cH * 0.1, 'ABOUT', '40px', PF_ACCENT, { zIndex: 2 }),
            lineEl(cW * 0.08, cH * 0.19, cW * 0.84, 'rgba(255,255,255,0.15)', '1'),
            btxt(cW * 0.08, cH * 0.24, cW * 0.5, cH * 0.08, '〇〇 建築設計事務所', '28px', PF_ACCENT, { zIndex: 2 }),
            txt(cW * 0.08, cH * 0.34, cW * 0.5, cH * 0.48, '2010年設立。\n「日常を超える建築」をテーマに、\n住宅・商業施設・文化施設の設計を手掛ける。\n\nクライアントの想いを丁寧に読み解き、\n土地と時間を超えて愛される建築を追求する。\n\n国内外のコンペ受賞実績多数。', '20px', 'rgba(255,255,255,0.7)', { zIndex: 2 }),
            imgEl(cW * 0.65, cH * 0.22, cW * 0.3, cH * 0.55, '事務所写真'),
          ]),
          // Project 01
          fullImage(cW, cH, 'Project 01', 'Project 01 — 〇〇の家 / 2023'),
          // Project 02
          fullImage(cW, cH, 'Project 02', 'Project 02 — △△複合施設 / 2024'),
          // お問い合わせ
          pg('お問い合わせ', [
            rct(0, 0, cW, cH, PF_DARK, { zIndex: 0 }),
            rct(0, 0, cW, cH * 0.06, ACCENT, { zIndex: 1 }),
            btxt(cW * 0.08, cH * 0.2, cW * 0.84, cH * 0.12, 'CONTACT', '52px', PF_ACCENT, { zIndex: 2, textAlign: 'center' }),
            lineEl(cW * 0.38, cH * 0.35, cW * 0.24, ACCENT, '3'),
            ...[
              ['📍', '東京都渋谷区〇〇 1-2-3'],
              ['📞', '03-xxxx-xxxx'],
              ['✉️', 'info@example-arch.jp'],
              ['🌐', 'www.example-arch.jp'],
            ].map(([icon, text], i) => (
              txt(cW * 0.2, cH * (0.42 + i * 0.1), cW * 0.6, cH * 0.08, `${icon}  ${text}`, '22px', 'rgba(255,255,255,0.75)', { zIndex: 3 })
            )),
          ]),
        ],
      };
    },
  },
];
