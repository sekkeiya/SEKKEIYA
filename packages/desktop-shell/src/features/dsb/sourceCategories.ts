// S.Blog「ソース記事」ビューの右サイドバー用カテゴリ分類（タクソノミー）。
// サイドバーの絞り込みチップと、メディア一覧のフィルタ判定の両方がこの1ファイルを参照する（SSOT）。
//
// マッチはルールベースの軽量判定:
//  - カテゴリに lang があれば site.lang 一致でヒット（例: 海外・トレンド=en / 国内=ja）
//  - もしくは cat.tokens のいずれかが、サイトの [keywords, note, name, group] を連結した文字列に含まれればヒット
// AIおまかせ検索（今後追加）で拾えないメディアも、ここのトークンで拾える範囲は拾う。

import type { BlogSourceSite } from './types';

/** カテゴリ配下のサブトピック（さらに絞り込むチップ）。 */
export interface SourceSubTopic {
  key: string;
  label: string;
  tokens: string[];
}

/** 右サイドバーの1カテゴリ。lang を持つカテゴリは言語一致でもヒットする。 */
export interface SourceCategory {
  key: string;
  label: string;
  tokens: string[];
  lang?: 'ja' | 'en';
  subs: SourceSubTopic[];
}

export const SOURCE_CATEGORIES: SourceCategory[] = [
  {
    key: 'architecture',
    label: '建築',
    tokens: ['建築', 'architecture', 'archi', 'コンペ'],
    subs: [
      { key: 'house', label: '住宅', tokens: ['住宅', 'house', 'residential'] },
      { key: 'commercial', label: '商業・オフィス', tokens: ['商業', '店舗', 'オフィス', 'commercial'] },
      { key: 'public', label: '公共・文化', tokens: ['公共', '美術館', '文化', 'museum'] },
      { key: 'competition', label: 'コンペ・受賞', tokens: ['コンペ', '受賞', 'award'] },
    ],
  },
  {
    key: 'interior',
    label: 'インテリア',
    tokens: ['インテリア', 'interior', '家具', '暮らし', '収納'],
    subs: [
      { key: 'furniture', label: '家具', tokens: ['家具', 'furniture'] },
      { key: 'storage', label: '収納・整理', tokens: ['収納', '整理'] },
      { key: 'diy', label: 'DIY・リノベ', tokens: ['diy', 'リノベ', 'renovation'] },
      { key: 'lighting', label: '照明・小物', tokens: ['照明', 'lighting', '小物'] },
    ],
  },
  {
    key: 'design',
    label: 'デザイン',
    tokens: ['デザイン', 'design', 'プロダクト', 'グラフィック'],
    subs: [
      { key: 'product', label: 'プロダクト', tokens: ['プロダクト', 'product'] },
      { key: 'graphic', label: 'グラフィック', tokens: ['グラフィック', 'graphic'] },
      { key: 'webui', label: 'Web・UI', tokens: ['web', 'ui', 'ux'] },
    ],
  },
  {
    key: 'living',
    label: '住まい・暮らし',
    tokens: ['住まい', '住宅', '暮らし', 'リノベ', 'リフォーム'],
    subs: [
      { key: 'newbuild', label: '新築', tokens: ['新築'] },
      { key: 'reno', label: 'リノベ・リフォーム', tokens: ['リノベ', 'リフォーム'] },
      { key: 'realestate', label: '賃貸・不動産', tokens: ['賃貸', '不動産', 'suumo'] },
    ],
  },
  {
    key: 'overseas',
    label: '海外・トレンド',
    tokens: [],
    lang: 'en',
    subs: [
      { key: 'architecture', label: '建築', tokens: ['architecture'] },
      { key: 'design', label: 'デザイン', tokens: ['design'] },
      { key: 'interior', label: 'インテリア', tokens: ['interior'] },
    ],
  },
  {
    key: 'domestic',
    label: '国内',
    tokens: [],
    lang: 'ja',
    subs: [
      { key: 'architecture', label: '建築', tokens: ['建築', 'architecture'] },
      { key: 'interior', label: 'インテリア', tokens: ['インテリア', '家具'] },
      { key: 'design', label: 'デザイン', tokens: ['デザイン', 'design'] },
      { key: 'living', label: '住まい・暮らし', tokens: ['住まい', '住宅', '暮らし'] },
      { key: 'tech', label: 'テック・AI', tokens: ['テック', 'tech', 'ai'] },
    ],
  },
  {
    key: 'aitech',
    label: 'AI・テック',
    tokens: ['ai', 'テック', 'tech', 'テクノロジー', 'ux'],
    subs: [
      { key: 'genai', label: '生成AI・LLM', tokens: ['openai', 'deepmind', 'huggingface', 'google', 'ml', 'llm', 'gemini', 'claude'] },
      { key: 'gadget', label: 'ガジェット', tokens: ['ガジェット', 'gadget'] },
      { key: 'startup', label: 'スタートアップ', tokens: ['スタートアップ', 'startup', 'venture'] },
      { key: 'itinfra', label: 'IT・インフラ', tokens: ['it', 'クラウド', 'インフラ'] },
      { key: 'science', label: '科学・研究', tokens: ['科学', '研究', '論文'] },
    ],
  },
];

/** サイトのマッチ判定用の検索対象文字列（keywords / note / name / group を連結・小文字化）。 */
function siteHaystack(site: BlogSourceSite): string {
  return [...(site.keywords || []), site.note, site.name, site.group].join(' ').toLowerCase();
}

/**
 * サイトがカテゴリに合致するか。
 * lang 指定カテゴリは言語一致でヒット、または tokens のいずれかが検索文字列に含まれればヒット。
 */
export function siteMatchesCategory(site: BlogSourceSite, cat: SourceCategory): boolean {
  if (cat.lang && site.lang === cat.lang) return true;
  if (cat.tokens.length === 0) return false;
  const hay = siteHaystack(site);
  return cat.tokens.some((t) => hay.includes(t.toLowerCase()));
}

/** サイトがサブトピックに合致するか（tokens のいずれかが検索文字列に含まれる）。 */
export function siteMatchesSub(site: BlogSourceSite, sub: SourceSubTopic): boolean {
  if (sub.tokens.length === 0) return false;
  const hay = siteHaystack(site);
  return sub.tokens.some((t) => hay.includes(t.toLowerCase()));
}

/**
 * 関心ワードをカテゴリへ自動分類（セマンティックグラフのグルーピング用）。
 * カテゴリ本体と配下サブトピックの tokens に対して双方向部分一致で判定し、
 * 最初に合致したカテゴリを返す（どれにも合致しなければ null = その他）。
 */
export function categorizeKeyword(word: string): SourceCategory | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  for (const cat of SOURCE_CATEGORIES) {
    const tokens = [...cat.tokens, ...cat.subs.flatMap((s) => s.tokens)]
      .map((t) => t.toLowerCase()).filter((t) => t.length >= 2);
    if (tokens.some((t) => w === t || w.includes(t) || t.includes(w))) return cat;
  }
  return null;
}
