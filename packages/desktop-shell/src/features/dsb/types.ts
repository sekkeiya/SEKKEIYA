// S.Blog (dsb / 3dsb) — ブログ記事のデータモデル。
// 記事は「執筆ハブ」で書き、保存時に①S.Libraryナレッジ(Chat/SEARCH)②公開サイト(SEO)へ
// dual-publish する設計。正本は Firestore `users/{uid}/blogArticles/{id}`（公開SEOが必須のため
// 通常 S.Library のローカル先とは逆にクラウド先）。

export type BlogStatus = 'draft' | 'published';

/** 「AIと対話して書く」の対話1件。記事docに保存して途中再開できるようにする。 */
export interface BlogDialogueMsg {
  role: 'ai' | 'user';
  text: string;
  ts: string; // ISO
  /** AIの問いにタップだけで答えるための選択肢（最新のAI発言でのみ表示） */
  choices?: string[];
  /** 'summary' = 題材記事の日本語要約カード（議論ファーストの冒頭に表示） */
  kind?: 'summary';
}

/**
 * ブログ全体のデザインスタイル（users/{uid}/blogSettings/style）。
 * 全記事に統一感を持たせつつ（preset）、独自性も出せる（accent/brandLabel/customNote）。
 * エディタの「✨デザイン」がこの設定を読んで記事全体を整形する。
 */
export interface BlogStyle {
  preset: 'minimal' | 'magazine' | 'tech' | 'warm';
  accent: string;              // 図解・装飾のアクセント色（例 #e57373）
  brandLabel?: string;         // 図解の署名（未設定なら著者名）
  visuals: 'none' | 'slides' | 'slides+images'; // デザイン適用時に挿入するビジュアル
  customNote?: string;         // 文体・トーンの独自指示（例: 絵文字は使わない・専門用語には注釈）
}

export const BLOG_STYLE_PRESETS: Record<BlogStyle['preset'], { label: string; desc: string; accent: string }> = {
  minimal:  { label: 'ミニマル',   desc: '余白と短い段落。装飾は最小限', accent: '#8b919c' },
  magazine: { label: 'マガジン',   desc: 'リード文+要点ボックス。雑誌的な読み口', accent: '#e57373' },
  tech:     { label: 'テック',     desc: '手順・箇条書き中心。図解多め', accent: '#64b5f6' },
  warm:     { label: 'ウォーム',   desc: '語りかける文体。体験談を前に', accent: '#e6a06f' },
};

export const DEFAULT_BLOG_STYLE: BlogStyle = {
  preset: 'magazine', accent: '#e57373', brandLabel: '', visuals: 'slides', customNote: '',
};

/** 記事の題材にしたWeb記事（出典）。 */
export interface BlogSourceRef {
  title: string;
  url: string;
  source?: string;   // 媒体名
  date?: string;
  summary?: string;  // 1行の紹介
  image?: string;    // サムネイル（Readerの表紙ギャラリー用）
}

/** おすすめソースサイト（建築・インテリアの良質メディア）。RSSは検証済みで稼働するもののみ収録。 */
export interface BlogSourceSite {
  name: string;
  feed: string;      // RSS/Atom フィードURL
  group: '国内・建築/デザイン' | '国内・住まい/インテリア' | '海外・トレンド' | 'カスタム';
  note: string;      // 一言説明
  lang?: 'ja' | 'en';
  /** ユーザーのブログカテゴリと照合するための興味キーワード（おすすめ提案用） */
  keywords?: string[];
}

export const DEFAULT_SOURCE_SITES: BlogSourceSite[] = [
  // 国内・建築/デザイン
  { name: 'architecturephoto', feed: 'https://architecturephoto.net/feed/', group: '国内・建築/デザイン', note: '建築作品・コンペ・業界ニュース', lang: 'ja',
    keywords: ['建築', '設計', 'コンペ', 'デザイン', '住宅', '事例'] },
  { name: 'Casa BRUTUS',       feed: 'https://casabrutus.com/feed',         group: '国内・建築/デザイン', note: '建築・デザイン・暮らしの名企画', lang: 'ja',
    keywords: ['建築', 'デザイン', '暮らし', 'インテリア', 'アート', '家具'] },
  { name: 'AXIS',              feed: 'https://www.axismag.jp/feed/',        group: '国内・建築/デザイン', note: 'デザインの専門誌', lang: 'ja',
    keywords: ['デザイン', 'プロダクト', 'テクノロジー', 'AI', 'クリエイティブ'] },
  { name: 'JDN',               feed: 'https://www.japandesign.ne.jp/feed/', group: '国内・建築/デザイン', note: 'Japan Design Net・デザイン全般', lang: 'ja',
    keywords: ['デザイン', 'クリエイティブ', 'アート', 'グラフィック'] },
  // 国内・住まい/インテリア
  { name: 'RoomClip mag',      feed: 'https://roomclip.jp/mag/feed',        group: '国内・住まい/インテリア', note: 'インテリア実例・暮らしの道具', lang: 'ja',
    keywords: ['インテリア', '暮らし', '家具', '収納', '住まい', '雑貨'] },
  { name: 'SUUMOジャーナル',    feed: 'https://suumo.jp/journal/feed/',      group: '国内・住まい/インテリア', note: '住まい・暮らし・リノベ', lang: 'ja',
    keywords: ['住まい', '暮らし', 'リノベ', '不動産', 'インテリア', '住宅', '家づくり'] },
  // 海外・トレンド（英語・高品質。インスピレーション用）
  { name: 'dezeen',            feed: 'https://www.dezeen.com/feed/',        group: '海外・トレンド', note: '世界の建築・デザイン最前線', lang: 'en',
    keywords: ['建築', 'デザイン', '海外', 'インテリア', 'テクノロジー', 'AI', 'トレンド', '素材'] },
  { name: 'ArchDaily',         feed: 'https://www.archdaily.com/rss/',      group: '海外・トレンド', note: '世界最大の建築作品データベース', lang: 'en',
    keywords: ['建築', '設計', '海外', '事例', '住宅'] },
  { name: 'designboom',        feed: 'https://www.designboom.com/feed/',    group: '海外・トレンド', note: 'デザイン・建築・アート', lang: 'en',
    keywords: ['デザイン', '建築', 'アート', '海外', 'テクノロジー', 'プロダクト', '素材', '家具'] },
];

/**
 * ユーザーのブログカテゴリ（例:「インテリア」「建築×AI」）を興味トークンに分解し、
 * 各ソースの keywords / note / name と照合して「カテゴリに合うソース」を返す。
 * ルールベースの軽量マッチ（AI提案は後段で拡張予定）。
 */
export function recommendSourcesForCategories(
  categories: string[],
  sites: BlogSourceSite[] = DEFAULT_SOURCE_SITES,
): Map<string, string[]> {
  // カテゴリ→トークン（区切り: × ・ / 空白 ＆ + 、）
  const tokens = categories.flatMap((c) => c.split(/[×・/＆&+、,\s]+/)).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
  const hits = new Map<string, string[]>(); // site name → マッチしたトークン
  if (tokens.length === 0) return hits;
  for (const site of sites) {
    const hay = [...(site.keywords || []), site.note, site.name].join(' ').toLowerCase();
    const kws = (site.keywords || []).map((k) => k.toLowerCase()).filter((k) => k.length >= 2);
    // 双方向照合: トークンがサイト情報に含まれる or サイトのキーワードが複合カテゴリ名（例:「施工事例」「インテリアのコツ」）に含まれる
    const matched = tokens.filter((t) => hay.includes(t) || kws.some((k) => t.includes(k)));
    if (matched.length > 0) hits.set(site.name, [...new Set(matched)]);
  }
  return hits;
}

/**
 * 公開先。アカウント記事/プロジェクト記事の「意味」はこのフィールド1つで表現する。
 * 既定はアカウントサイト（ランディング）。canonical は常にこの1箇所を指す（SEO重複回避）。
 */
export type BlogPublishTarget =
  | { scope: 'account' }
  | { scope: 'project'; projectId: string; projectName?: string };

export interface BlogArticle {
  id: string;
  slug: string;            // 公開URL用スラッグ（一意・自動生成、編集可）
  title: string;
  excerpt: string;         // 抜粋（meta description / OGP に使用）
  bodyMarkdown: string;    // 本文（Markdown）
  coverUrl?: string | null; // OGP / カバー画像
  tags: string[];
  category: string;
  status: BlogStatus;
  publishTarget: BlogPublishTarget;
  authorUid: string;
  authorName?: string | null;
  knowledgeSourceId?: string | null; // ①ナレッジ(RAG)同期先ID（Phase 2 で使用）
  libraryEntryId?: string | null;    // S.Library に登録した LibraryEntry の localId（再公開時の更新・重複防止）
  views?: number | null;             // 累計閲覧数（公開サイトの計測連携で更新／未計測は null）
  aiDialogue?: BlogDialogueMsg[] | null; // 「AIと対話して書く」の議論ログ（途中再開・反映に使用）
  sourceRefs?: BlogSourceRef[] | null;   // 題材にしたWeb記事（出典。議論・仕上げの文脈にも使用）
  audioUrl?: string | null;              // 🎙 記事の音声版（AI音声で全文合成したMP3。公開ページでも再生）
  audioDurationSec?: number | null;      // 音声版の長さ（秒）
  publishedAt?: string | null;       // ISO（公開時に確定）
  createdAt: string;                 // ISO
  updatedAt: string;                 // ISO
}

/**
 * 投稿スケジュール（コンテンツカレンダー）。記事本体とは別管理で、
 * 「いつ・どんなテーマを出すか」を計画する。任意で下書き記事に紐付けできる。
 * 正本: users/{uid}/blogSchedules/{id}
 */
export interface BlogSchedule {
  id: string;
  date: string;                  // 投稿予定日（YYYY-MM-DD）
  time?: string | null;          // 投稿予定時刻（HH:mm、任意）
  title: string;                 // 予定タイトル / テーマ
  category?: string;
  note?: string;                 // メモ（狙い・構成案など）
  status: 'planned' | 'done';    // planned=予定 / done=公開済み
  articleId?: string | null;     // 紐付けた記事（任意）
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
}

export const BLOG_CATEGORIES = [
  'お知らせ',
  '設計',
  'インテリア',
  '施工事例',
  'コラム',
  'その他',
] as const;
