// articleTheme.ts — S.Blog 記事の「誌面デザインシステム」。
//
// 設計原則: コンテンツ（Markdown）とデザイン（このテーマ）を分離する。
// 「✨デザイン」CFは意味づけ（リード/要点ボックス/見出し）だけをMarkdownで表現し、
// 見た目はここが一括で決める。BlogStyle（preset+accent）から「紙面パレット＋prose CSS」を
// 生成し、エディタ（tiptap）と記事プレビューの両方に適用する。
//
// 紙面はアプリテーマ（ダーク/ライト）に依存しない —— 公開ページで読者が見る色と
// 執筆中に見る色を一致させる（印刷物の校正紙と同じ考え方）。
// プリセットは有名Webマガジンの誌面設計をベンチマークにしている:
//   magazine = Casa BRUTUS / a+u（白い紙×明朝見出し×キッカーバー）
//   minimal  = Kinfolk（無彩色×軽量サンス×特大余白）
//   tech     = Zenn / Smashing Magazine（ダークスレート×左罫見出し）
//   warm     = 北欧、暮らしの道具店（生成り×角丸×柔らかいカード）
import type { BlogStyle } from './types';

/** 記事本文の最適行長（measure）。全角35〜40字 ≒ 760px。 */
export const ARTICLE_MEASURE = 760;

const SERIF = `'Shippori Mincho', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'Noto Serif JP', serif`;
const SANS = `'Inter', system-ui, -apple-system, 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/** 紙面パレット — 記事エリア全体の色味。プリセットが決め、アプリテーマに追従しない。 */
export interface ArticlePalette {
  bg: string;       // 紙面の背景
  heading: string;  // 見出し・タイトル
  text: string;     // 本文
  sub: string;      // キャプション・補足・placeholder
  line: string;     // 罫線・区切り
  codeBg: string;   // インラインコード背景
  preBg: string;    // コードブロック背景
}

const PALETTES: Record<BlogStyle['preset'], ArticlePalette> = {
  magazine: {
    bg: '#fbfaf8', heading: '#1c1914', text: '#2c271f', sub: '#8a8378',
    line: 'rgba(28,25,20,0.14)', codeBg: 'rgba(28,25,20,0.07)', preBg: '#f2efe9',
  },
  minimal: {
    bg: '#fafafa', heading: '#212328', text: '#383b41', sub: '#8b8f96',
    line: 'rgba(38,40,44,0.12)', codeBg: 'rgba(38,40,44,0.06)', preBg: '#f0f1f3',
  },
  tech: {
    bg: '#14161c', heading: '#f4f5f7', text: 'rgba(233,236,242,0.88)', sub: '#8b919c',
    line: 'rgba(255,255,255,0.10)', codeBg: 'rgba(255,255,255,0.09)', preBg: 'rgba(0,0,0,0.35)',
  },
  warm: {
    bg: '#faf5ee', heading: '#332e26', text: '#3d362c', sub: '#948b7d',
    line: 'rgba(51,46,38,0.14)', codeBg: 'rgba(51,46,38,0.07)', preBg: '#f1eadf',
  },
};

export function getArticlePalette(preset: BlogStyle['preset']): ArticlePalette {
  return PALETTES[preset] ?? PALETTES.magazine;
}

/** プリセットごとの誌面トークン。 */
interface ProseTokens {
  bodySize: number;
  bodyLeading: number;
  headingFamily: string;
  imgRadius: number;
}

const TOKENS: Record<BlogStyle['preset'], ProseTokens> = {
  magazine: { bodySize: 16,   bodyLeading: 2.0,  headingFamily: SERIF, imgRadius: 10 },
  minimal:  { bodySize: 15.5, bodyLeading: 2.1,  headingFamily: SANS,  imgRadius: 8 },
  tech:     { bodySize: 15.5, bodyLeading: 1.9,  headingFamily: SANS,  imgRadius: 8 },
  warm:     { bodySize: 16.5, bodyLeading: 2.15, headingFamily: SANS,  imgRadius: 14 },
};

export function getArticleHeadingFamily(preset: BlogStyle['preset']): string {
  return (TOKENS[preset] ?? TOKENS.magazine).headingFamily;
}

/**
 * 記事本文（prose）のスタイルを生成する。tiptap の `.ProseMirror` 直下と、
 * 公開プレビューの記事コンテナのどちらにも同じものを適用できる。
 * 色は紙面パレット（プリセット固有）＋アクセント色（BlogStyle）で完結する。
 */
export function buildArticleProseSx(style: BlogStyle): Record<string, unknown> {
  const t = TOKENS[style.preset] ?? TOKENS.magazine;
  const pal = getArticlePalette(style.preset);
  const accent = style.accent || '#e57373';

  // 全プリセット共通の骨格 —— 読みやすさの土台（字間・行間・段落リズム・キャプション）。
  const base: Record<string, any> = {
    color: pal.text,
    fontFamily: SANS,
    fontSize: t.bodySize,
    lineHeight: t.bodyLeading,
    letterSpacing: '0.02em',
    fontFeatureSettings: '"palt"',
    '& ::selection': { backgroundColor: `${accent}44` },
    '& > * + *': { marginTop: '1.1em' },
    '& p': { margin: 0 },
    '& strong': { color: pal.heading, fontWeight: 700 },
    '& a': {
      color: accent,
      textDecoration: 'underline',
      textDecorationColor: `${accent}55`,
      textUnderlineOffset: '3px',
      '&:hover': { textDecorationColor: accent },
    },
    '& ul, & ol': { paddingLeft: '1.5em', '& > li + li': { marginTop: '0.45em' } },
    '& li p': { margin: 0 },
    '& li::marker': { color: accent, fontWeight: 700 },
    '& h1': {
      fontFamily: t.headingFamily, fontSize: 27, fontWeight: 700,
      lineHeight: 1.45, color: pal.heading, marginTop: '2.2em', letterSpacing: '0.02em',
    },
    // 画像（図版）は段落より一段強い上下マージンで「図版」として独立させる
    '& img, & video': {
      display: 'block', maxWidth: '100%', height: 'auto',
      borderRadius: `${t.imgRadius}px`, margin: '2em auto 0.6em',
    },
    // 画像直後の「*キャプション*」段落（em のみの段落）をキャプションとして描画
    '& p:has(> em:only-child)': {
      textAlign: 'center', fontSize: 12.5, lineHeight: 1.7,
      color: pal.sub, marginTop: '0.35em',
      '& em': { fontStyle: 'normal' },
    },
    '& code': {
      fontFamily: MONO, fontSize: '0.85em',
      bgcolor: pal.codeBg,
      padding: '0.15em 0.4em', borderRadius: '5px',
    },
    '& pre': {
      bgcolor: pal.preBg,
      border: `1px solid ${pal.line}`,
      borderRadius: '10px', padding: '1em 1.2em', overflowX: 'auto',
      '& code': { bgcolor: 'transparent', padding: 0, fontSize: 13 },
    },
    '& table': {
      width: '100%', borderCollapse: 'collapse', fontSize: '0.92em', margin: '1.6em 0',
      '& th': {
        textAlign: 'left', fontWeight: 700, color: pal.heading,
        bgcolor: `${accent}14`, padding: '0.6em 0.9em',
        borderBottom: `2px solid ${accent}55`,
      },
      '& td': { padding: '0.6em 0.9em', borderBottom: `1px solid ${pal.line}` },
    },
  };

  // プリセットごとの「誌面の人格」—— 見出し・引用（要点ボックス/プルクォート）・区切り。
  const byPreset: Record<BlogStyle['preset'], Record<string, any>> = {
    // Casa BRUTUS / a+u: 明朝の見出しにアクセントのキッカーバー、要点は枠付きボックス
    magazine: {
      '& > p:first-child': { fontSize: '1.08em', lineHeight: 2.1, color: pal.heading },
      '& h2': {
        fontFamily: SERIF, fontSize: 24, fontWeight: 700, lineHeight: 1.55,
        color: pal.heading, letterSpacing: '0.03em',
        marginTop: '2.8em', paddingTop: '0.85em', position: 'relative',
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0,
          width: 44, height: 3, bgcolor: accent,
        },
      },
      '& h3': { fontFamily: SERIF, fontSize: 19, fontWeight: 700, lineHeight: 1.6, color: pal.heading, marginTop: '2.2em' },
      '& blockquote': {
        margin: '1.8em 0', padding: '1.15em 1.4em',
        bgcolor: `${accent}0d`, border: `1px solid ${accent}2e`, borderLeft: `3px solid ${accent}`,
        borderRadius: '4px 12px 12px 4px', fontStyle: 'normal', fontSize: '0.95em',
        color: pal.text,
        '& > * + *': { marginTop: '0.6em' },
        '& strong': { color: accent, letterSpacing: '0.05em' },
        '& ul, & ol': { paddingLeft: '1.3em' },
      },
      '& hr': { border: 'none', textAlign: 'center', margin: '3em 0', '&::before': { content: '"◆"', color: `${accent}88`, fontSize: 10, letterSpacing: '1em' } },
    },
    // Kinfolk: 装飾ゼロ・余白がデザイン。短い中央罫で章を区切る
    minimal: {
      '& h2': {
        fontFamily: SANS, fontSize: 21, fontWeight: 600, lineHeight: 1.6,
        color: pal.heading, letterSpacing: '0.05em', marginTop: '3.2em',
      },
      '& h3': { fontFamily: SANS, fontSize: 17, fontWeight: 600, letterSpacing: '0.04em', color: pal.heading, marginTop: '2.4em' },
      '& blockquote': {
        margin: '2em 0', padding: '0.2em 0 0.2em 1.4em',
        borderLeft: `2px solid ${pal.sub}`,
        fontStyle: 'normal', color: pal.sub,
        '& > * + *': { marginTop: '0.6em' },
      },
      '& li::marker': { color: pal.sub, fontWeight: 400 },
      '& hr': {
        border: 'none', borderTop: `1px solid ${pal.line}`,
        width: 56, margin: '3.4em auto',
      },
    },
    // Zenn / Smashing: 左罫見出し・情報ノート型の引用・コード/表が主役
    tech: {
      '& h2': {
        fontFamily: SANS, fontSize: 22, fontWeight: 700, lineHeight: 1.55,
        color: pal.heading, marginTop: '2.6em',
        paddingLeft: '0.65em', borderLeft: `4px solid ${accent}`,
      },
      '& h3': { fontFamily: SANS, fontSize: 17.5, fontWeight: 700, color: pal.heading, marginTop: '2em' },
      '& blockquote': {
        margin: '1.6em 0', padding: '1em 1.3em',
        bgcolor: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${accent}`,
        borderRadius: '4px 8px 8px 4px', fontStyle: 'normal', fontSize: '0.94em',
        '& > * + *': { marginTop: '0.5em' },
        '& strong': { color: accent },
      },
      '& hr': { border: 'none', borderTop: `1px solid ${pal.line}`, margin: '2.6em 0' },
    },
    // 暮らしの道具店: 柔らかいカード・点線の見出し下線・ゆったりした行間
    warm: {
      '& h2': {
        fontFamily: SANS, fontSize: 22, fontWeight: 700, lineHeight: 1.6,
        color: pal.heading, marginTop: '2.9em',
        paddingBottom: '0.45em', borderBottom: `1px dashed ${accent}66`,
      },
      '& h3': { fontFamily: SANS, fontSize: 17.5, fontWeight: 700, color: pal.heading, marginTop: '2.2em' },
      '& blockquote': {
        margin: '1.8em 0', padding: '1.2em 1.5em',
        bgcolor: `${accent}10`, border: 'none', borderRadius: '16px',
        fontStyle: 'normal', fontSize: '0.95em',
        '& > * + *': { marginTop: '0.6em' },
        '& strong': { color: accent },
      },
      '& hr': { border: 'none', textAlign: 'center', margin: '3em 0', '&::before': { content: '"· · ·"', color: `${accent}99`, letterSpacing: '0.6em', fontSize: 14 } },
    },
  };

  return { ...base, ...(byPreset[style.preset] ?? byPreset.magazine) };
}

/** 記事タイトル入力（エディタ）用のタイポグラフィ。本文と同じ誌面人格に揃える。 */
export function buildArticleTitleSx(style: BlogStyle): Record<string, unknown> {
  const t = TOKENS[style.preset] ?? TOKENS.magazine;
  const pal = getArticlePalette(style.preset);
  return {
    fontFamily: t.headingFamily,
    fontSize: 30,
    fontWeight: style.preset === 'minimal' ? 600 : 700,
    lineHeight: 1.5,
    letterSpacing: '0.02em',
    color: pal.heading,
  };
}

/**
 * 「✨デザイン」CFが返す Markdown の整形ゆらぎを正規化する。
 * LLM が `** 太字 **` のようにマーカー内側へ空白を入れると CommonMark として
 * パースされず生のアスタリスクが見えてしまうため、詰めて有効な強調に直す。
 * 正規表現だと隣接する2つの太字スパンを誤って結合しうるので、行ごとに `**` で
 * 分割し、マーカーが対になっている行だけ内側（奇数セグメント）を trim する。
 */
export function normalizeDesignedMarkdown(md: string): string {
  return md.split('\n').map((line) => {
    const parts = line.split('**');
    if (parts.length < 3 || parts.length % 2 === 0) return line; // 対になっていない行は触らない
    for (let i = 1; i < parts.length; i += 2) parts[i] = parts[i].trim();
    return parts.join('**');
  }).join('\n');
}
