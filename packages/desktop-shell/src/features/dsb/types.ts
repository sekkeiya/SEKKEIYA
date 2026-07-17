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
  /** AIが取り上げた記事内の箇所（リーダーの抽出ブロックの index）。クリックでその箇所へスクロール。 */
  refs?: number[];
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

/**
 * 「AIと議論して書く」のインタビュー往復回数の目安。記事ごとに設定できる。
 * 0 = 無制限（AIは収束を急がない）。未設定は DEFAULT_DIALOGUE_ROUNDS。
 * AIへのガイドであり厳密な打ち切りではない（目安到達後も続けられる）。
 */
export const DIALOGUE_ROUND_OPTIONS: { value: number; label: string; desc: string }[] = [
  { value: 5,  label: '5往復',  desc: 'サクッと（要点だけ聞いて生成）' },
  { value: 10, label: '10往復', desc: 'しっかり（論点を複数掘り下げ）' },
  { value: 18, label: '18往復', desc: '標準（経験談まで引き出す・おすすめ）' },
  { value: 25, label: '25往復', desc: '深掘り（長編・特集向け）' },
  { value: 0,  label: '無制限', desc: '目安なし（納得いくまで議論）' },
];
export const DEFAULT_DIALOGUE_ROUNDS = 18;

/**
 * 「AIと議論して書く」のインタビュアー人格。記事ごとに選べる（BlogArticle.interviewerId）。
 * prompt はそのまま CF `blogDialogue`（mode:'turn'）のシステムプロンプトへ注入される。
 */
export interface BlogInterviewer {
  id: string;
  emoji: string;
  label: string;
  desc: string;    // 選択UI用の一言
  prompt: string;  // CFへ送る人格指示
}

export const INTERVIEWER_PRESETS: BlogInterviewer[] = [
  {
    id: 'listener',
    emoji: '🎤',
    label: '聞き手',
    desc: '質問多め。相づちと深掘りであなたの経験・考えをとことん引き出す',
    prompt: 'あなたは聞き上手なインタビュアーです。自分の意見は控えめにし、短い相づちと質問を中心に進めてください。1ターンの質問は1つに絞ること。抽象的な答えには「具体的には？」「例えば実際の案件では？」と踏み込み、ユーザー自身の経験・エピソード・数字を引き出すことを最優先にしてください。',
  },
  {
    id: 'editor',
    emoji: '🧭',
    label: '編集者',
    desc: '自分の考えや仮説も出しながら、記事の完成形へリードしてくれる',
    prompt: 'あなたは経験豊富な編集者型のインタビュアーです。記事の完成形（結論・根拠・事例）を常に意識し、自分の考え・仮説・業界の文脈も適度に提示しながら議論をリードしてください。「私はこの記事を○○と読みましたが、あなたの現場感覚ではどうですか？」のように、先に視点を出してからユーザーの立場を確認し、足りない要素（結論の一言・根拠・具体例）を順に埋めるよう導いてください。',
  },
  {
    id: 'debater',
    emoji: '⚔️',
    label: '論客',
    desc: 'あえて異論・別視点をぶつけて、主張の説得力を鍛える壁打ち相手',
    prompt: 'あなたは知的で誠実な論客です。ユーザーの主張に対して、あえて反対意見・別の視点・読者から想定される批判をぶつけてください。ただし攻撃的にはならず、敬意とユーモアを保つこと。「その見方には○○という反論がありそうです。どう答えますか？」のように主張の弱点を突き、ユーザー自身の言葉で補強させることで、記事の説得力を鍛えるのが目的です。相手が答えに詰まったら助け舟（反論への答え方の例）を出してください。',
  },
];
export const DEFAULT_INTERVIEWER_ID = 'editor';

/**
 * リーダー（題材記事）と議論パネルの橋渡し用の軽量ブロック。
 * リーダーが抽出した本文段落・見出し・画像を、議論パネルがインタビューの素材として
 * 参照できるよう共有する（本体の ReaderBlock を議論側でも扱える最小形にしたもの）。
 */
export interface ReaderBlockLite {
  t: 'p' | 'h' | 'img' | 'video';
  text?: string;   // p / h の本文
  src?: string;    // img / video のURL
}

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
  group: '国内・建築/デザイン' | '国内・住まい/インテリア' | '海外・トレンド' | 'テック・AI' | '動画（YouTube）' | 'カスタム';
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
  { name: 'Architizer',        feed: 'https://architizer.com/blog/feed/',   group: '海外・トレンド', note: '建築の作品・特集・素材', lang: 'en',
    keywords: ['建築', 'architecture', 'デザイン', '海外', '事例'] },
  { name: 'Yanko Design',      feed: 'https://www.yankodesign.com/feed/',   group: '海外・トレンド', note: 'プロダクト/工業デザイン', lang: 'en',
    keywords: ['デザイン', 'design', 'プロダクト', 'product', '海外'] },
  { name: 'Core77',            feed: 'https://www.core77.com/feed',         group: '海外・トレンド', note: 'インダストリアルデザイン総合', lang: 'en',
    keywords: ['デザイン', 'design', 'プロダクト', '海外'] },
  { name: 'Design Milk',       feed: 'https://design-milk.com/feed/',       group: '海外・トレンド', note: 'インテリア・プロダクトのデザイン', lang: 'en',
    keywords: ['デザイン', 'design', 'インテリア', 'interior', '海外', '家具'] },
  { name: 'Apartment Therapy', feed: 'https://www.apartmenttherapy.com/main.rss', group: '海外・トレンド', note: '住まい・インテリア実例', lang: 'en',
    keywords: ['インテリア', 'interior', '住まい', '暮らし', '海外', '収納'] },
  // 国内・建築/デザイン（追加）
  { name: 'TECTURE MAG',       feed: 'https://mag.tecture.jp/feed',         group: '国内・建築/デザイン', note: '建築・空間・プロダクト', lang: 'ja',
    keywords: ['建築', 'デザイン', 'プロダクト', '空間', '素材'] },
  { name: 'Pen Online',        feed: 'https://www.pen-online.com/feed',     group: '国内・建築/デザイン', note: 'デザイン・カルチャー誌', lang: 'ja',
    keywords: ['デザイン', 'カルチャー', 'アート', 'ライフスタイル'] },
  // 国内・住まい/インテリア（追加）
  { name: 'roomie',            feed: 'https://www.roomie.jp/feed',          group: '国内・住まい/インテリア', note: '暮らしの道具・インテリア', lang: 'ja',
    keywords: ['インテリア', '暮らし', '住まい', '雑貨', '家具'] },
  // テック・AI（AI/テクノロジーの公式ブログ・専門メディア）
  { name: 'The Verge',         feed: 'https://www.theverge.com/rss/index.xml', group: 'テック・AI', note: 'テック・ガジェット・AI全般', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'テクノロジー', 'ガジェット'] },
  { name: 'Ars Technica',      feed: 'https://arstechnica.com/feed/',       group: 'テック・AI', note: '技術・科学の深掘り', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'テクノロジー', '科学'] },
  { name: 'TechCrunch',        feed: 'https://techcrunch.com/feed/',        group: 'テック・AI', note: 'スタートアップ・テック最新', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'スタートアップ'] },
  { name: 'MIT Technology Review', feed: 'https://www.technologyreview.com/feed/', group: 'テック・AI', note: '先端技術・AIの分析', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'テクノロジー'] },
  { name: 'VentureBeat',       feed: 'https://venturebeat.com/feed/',       group: 'テック・AI', note: 'AI・エンタープライズ技術', lang: 'en',
    keywords: ['ai', 'テック', 'tech'] },
  { name: 'WIRED',             feed: 'https://www.wired.com/feed/rss',      group: 'テック・AI', note: 'テクノロジーとカルチャー', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'テクノロジー', 'カルチャー'] },
  { name: 'Engadget',          feed: 'https://www.engadget.com/rss.xml',    group: 'テック・AI', note: 'ガジェット・テック', lang: 'en',
    keywords: ['テック', 'tech', 'ガジェット', 'ai'] },
  { name: 'OpenAI',            feed: 'https://openai.com/blog/rss.xml',     group: 'テック・AI', note: 'OpenAI 公式ブログ', lang: 'en',
    keywords: ['ai', 'openai', 'テック', 'tech'] },
  { name: 'Google DeepMind',   feed: 'https://deepmind.google/blog/rss.xml', group: 'テック・AI', note: 'DeepMind 公式ブログ', lang: 'en',
    keywords: ['ai', 'deepmind', 'google', 'テック'] },
  { name: 'Google AI',         feed: 'https://blog.google/technology/ai/rss/', group: 'テック・AI', note: 'Google の AI 公式ブログ', lang: 'en',
    keywords: ['ai', 'google', 'テック', 'tech'] },
  { name: 'Hugging Face',      feed: 'https://huggingface.co/blog/feed.xml', group: 'テック・AI', note: 'AI/MLコミュニティのブログ', lang: 'en',
    keywords: ['ai', 'ml', 'テック', 'huggingface'] },
  { name: 'ITmedia AIプラス',   feed: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml', group: 'テック・AI', note: 'AI関連ニュース（日本語）', lang: 'ja',
    keywords: ['ai', 'テック', 'tech', 'テクノロジー'] },
  { name: 'ITmedia NEWS',      feed: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml', group: 'テック・AI', note: 'ITニュース（日本語）', lang: 'ja',
    keywords: ['テック', 'tech', 'it', 'ai'] },
  { name: 'GIGAZINE',          feed: 'https://gigazine.net/news/rss_2.0/',  group: 'テック・AI', note: 'テック・ガジェット・話題（日本語）', lang: 'ja',
    keywords: ['テック', 'tech', 'ガジェット', 'ai'] },
  { name: 'Gizmodo Japan',     feed: 'https://www.gizmodo.jp/atom.xml',     group: 'テック・AI', note: 'ガジェット・サイエンス（日本語）', lang: 'ja',
    keywords: ['テック', 'tech', 'ガジェット', 'ai', '科学'] },
  { name: 'ライフハッカー・ジャパン', feed: 'https://www.lifehacker.jp/feed/index.xml', group: 'テック・AI', note: '仕事術・ツール・テック（日本語）', lang: 'ja',
    keywords: ['テック', 'tech', '仕事術', 'ツール'] },
  { name: 'Publickey',         feed: 'https://www.publickey1.jp/atom.xml',  group: 'テック・AI', note: 'ITインフラ・技術ニュース（日本語）', lang: 'ja',
    keywords: ['テック', 'tech', 'it', 'クラウド'] },
  { name: 'The Next Web',      feed: 'https://thenextweb.com/feed/',        group: 'テック・AI', note: 'テック・スタートアップ・AI', lang: 'en',
    keywords: ['ai', 'テック', 'tech', 'スタートアップ', 'startup'] },

  // ── 動画（YouTube）: チャンネルの公式Atomフィードを購読。Readerで再生＋AI日本語字幕・記事化できる。
  //    channel_id は @ハンドルのページから externalId で実解決・フィード疎通確認済み（2026-07-15）。
  { name: 'The B1M',           feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6n8I1UDTKP1IWjQMg6_TwA', group: '動画（YouTube）', note: '世界最大の建築・建設ドキュメンタリー', lang: 'en',
    keywords: ['建築', 'architecture', '建設', 'インフラ', '都市'] },
  { name: 'NEVER TOO SMALL',   feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_zQ777U6YTyatP3P1wi3xw', group: '動画（YouTube）', note: '小さな住まいの名作リノベーション', lang: 'en',
    keywords: ['インテリア', '狭小住宅', 'リノベーション', '住まい', 'デザイン'] },
  // ⚠️ 同名の別クリエイターが存在。建築家は @DamiLeeArch（externalIdで実解決・内容確認済み）
  { name: 'Dami Lee',          feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCJ_2hNMxOzNjviJBiLWHMqg', group: '動画（YouTube）', note: '建築家による名建築・都市の解説', lang: 'en',
    keywords: ['建築', 'architecture', '設計', '建築家', '解説'] },
  { name: 'Living Big In A Tiny House', feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCoNTMWgGuXtGPLv9UeJZwBw', group: '動画（YouTube）', note: 'タイニーハウス・小さな暮らしの訪問記', lang: 'en',
    keywords: ['タイニーハウス', '住まい', '暮らし', 'オフグリッド'] },
  { name: 'Kirsten Dirksen',   feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCDsElQQt_gCZ9LgnW-7v-cQ', group: '動画（YouTube）', note: 'ユニークな住まい・セルフビルドの記録', lang: 'en',
    keywords: ['住まい', 'セルフビルド', '暮らし', 'サステナブル'] },
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
  dialogueRounds?: number | null;        // インタビュー往復回数の目安（記事ごと。0=無制限 / 未設定=既定値）
  interviewerId?: string | null;         // インタビュアー人格（INTERVIEWER_PRESETS の id。記事ごと）
  sourceRefs?: BlogSourceRef[] | null;   // 題材にしたWeb記事（出典。議論・仕上げの文脈にも使用）
  audioUrl?: string | null;              // 🎙 記事の音声版（AI音声で全文合成したMP3。公開ページでも再生）
  audioDurationSec?: number | null;      // 音声版の長さ（秒）
  /** 「✨デザイン」適用前のスナップショット。存在する間は「元に戻す」で復元できる（永続化されリロード後も有効）。 */
  designBackup?: { bodyMarkdown: string; excerpt: string; ts: string } | null;
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

/**
 * ホーム絞り込み用: 著名な設計者・デザイナー・企業の辞書（日英エイリアス）。
 * フィードのタイトルと照合し、記事が存在する人物・会社だけをチップとして表示する。
 * ユーザーは自分のウォッチ名（カスタム）も追加できる（blogSettings.nameFilters）。
 */
export interface NotableName {
  label: string;                          // 表示名（チップ）
  aliases: string[];                      // タイトル照合用（label 自身も含める）
  kind: '設計者' | 'デザイナー' | '企業';
}

export const NOTABLE_NAMES: NotableName[] = [
  // 設計者・建築家
  { label: '隈研吾',    aliases: ['隈研吾', 'Kengo Kuma'],            kind: '設計者' },
  { label: '安藤忠雄',  aliases: ['安藤忠雄', 'Tadao Ando'],          kind: '設計者' },
  { label: '坂茂',      aliases: ['坂茂', 'Shigeru Ban'],             kind: '設計者' },
  { label: '藤本壮介',  aliases: ['藤本壮介', 'Sou Fujimoto'],        kind: '設計者' },
  { label: 'SANAA',     aliases: ['SANAA', '妹島和世', 'Kazuyo Sejima', '西沢立衛', 'Ryue Nishizawa'], kind: '設計者' },
  { label: '伊東豊雄',  aliases: ['伊東豊雄', 'Toyo Ito'],            kind: '設計者' },
  { label: '石上純也',  aliases: ['石上純也', 'Junya Ishigami'],      kind: '設計者' },
  { label: '田根剛',    aliases: ['田根剛', 'Tsuyoshi Tane'],         kind: '設計者' },
  { label: 'Zaha Hadid', aliases: ['Zaha Hadid', 'ザハ・ハディド', 'ザハ'], kind: '設計者' },
  { label: 'BIG',       aliases: ['BIG', 'Bjarke Ingels', 'ビャルケ・インゲルス'], kind: '設計者' },
  { label: 'OMA',       aliases: ['OMA', 'Rem Koolhaas', 'レム・コールハース'],   kind: '設計者' },
  { label: 'Foster + Partners', aliases: ['Foster + Partners', 'Norman Foster', 'ノーマン・フォスター'], kind: '設計者' },
  { label: 'Herzog & de Meuron', aliases: ['Herzog', 'ヘルツォーク'], kind: '設計者' },
  { label: 'MVRDV',     aliases: ['MVRDV'],                           kind: '設計者' },
  { label: 'Snøhetta',  aliases: ['Snøhetta', 'Snohetta', 'スノヘッタ'], kind: '設計者' },
  { label: 'Heatherwick', aliases: ['Heatherwick', 'ヘザウィック'],   kind: '設計者' },
  { label: 'David Chipperfield', aliases: ['Chipperfield', 'チッパーフィールド'], kind: '設計者' },
  { label: 'Renzo Piano', aliases: ['Renzo Piano', 'レンゾ・ピアノ'], kind: '設計者' },
  { label: 'Jean Nouvel', aliases: ['Jean Nouvel', 'ジャン・ヌーヴェル'], kind: '設計者' },
  // デザイナー
  { label: 'nendo',     aliases: ['nendo', '佐藤オオキ', 'Oki Sato'], kind: 'デザイナー' },
  { label: '深澤直人',  aliases: ['深澤直人', 'Naoto Fukasawa'],      kind: 'デザイナー' },
  { label: '原研哉',    aliases: ['原研哉', 'Kenya Hara'],            kind: 'デザイナー' },
  { label: '吉岡徳仁',  aliases: ['吉岡徳仁', 'Tokujin Yoshioka'],    kind: 'デザイナー' },
  { label: '倉俣史朗',  aliases: ['倉俣史朗', 'Shiro Kuramata'],      kind: 'デザイナー' },
  { label: 'Philippe Starck', aliases: ['Starck', 'スタルク'],        kind: 'デザイナー' },
  { label: 'Patricia Urquiola', aliases: ['Urquiola', 'ウルキオラ'],  kind: 'デザイナー' },
  { label: 'Dieter Rams', aliases: ['Dieter Rams', 'ディーター・ラムス'], kind: 'デザイナー' },
  // 企業・組織
  { label: '日建設計',  aliases: ['日建設計', 'Nikken Sekkei'],       kind: '企業' },
  { label: '竹中工務店', aliases: ['竹中工務店', 'Takenaka'],         kind: '企業' },
  { label: '鹿島建設',  aliases: ['鹿島建設', 'Kajima'],              kind: '企業' },
  { label: '大林組',    aliases: ['大林組', 'Obayashi'],              kind: '企業' },
  { label: '清水建設',  aliases: ['清水建設'],                        kind: '企業' },
  { label: '無印良品',  aliases: ['無印良品', 'MUJI'],                kind: '企業' },
  { label: 'IKEA',      aliases: ['IKEA', 'イケア'],                  kind: '企業' },
  { label: 'ニトリ',    aliases: ['ニトリ', 'Nitori'],                kind: '企業' },
  { label: 'Vitra',     aliases: ['Vitra', 'ヴィトラ'],               kind: '企業' },
  { label: 'Herman Miller', aliases: ['Herman Miller', 'ハーマンミラー'], kind: '企業' },
  { label: 'カリモク',  aliases: ['カリモク', 'Karimoku'],            kind: '企業' },
  { label: 'LIXIL',     aliases: ['LIXIL', 'リクシル'],               kind: '企業' },
  { label: 'Panasonic', aliases: ['Panasonic', 'パナソニック'],       kind: '企業' },
];

/**
 * タイトルにエイリアスが含まれるか。
 * - 日本語（CJK含む）: 単純な部分一致
 * - 英字: 単語境界つき一致（"Roma" が "OMA" に誤ヒットしない）。
 *   さらに 2〜4文字の全大文字略称（BIG/OMA等）は大文字小文字を区別（一般語 "big" を除外）。
 */
export function titleMatchesAlias(title: string, alias: string): boolean {
  if (!alias) return false;
  if (/[　-ヿ一-鿿]/.test(alias)) return title.includes(alias);
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = /^[A-Z]{2,4}$/.test(alias) ? '' : 'i';
  return new RegExp(`(^|[^A-Za-z])${esc}([^A-Za-z]|$)`, flags).test(title);
}

/**
 * ブログの運営戦略・目標（AIと議論して決める）。planBlogContent（投稿計画）が最優先材料に使う。
 * account=users/{uid}/blogSettings/main.strategy / official=config/official.strategy。
 */
export interface BlogStrategy {
  summary: string;        // 戦略の要約（誰に何を届け、どう差別化し、何を優先するか）
  audience?: string;      // 主な読者像
  goals?: string;         // 達成したい目標
  focus?: string[];       // 重視するテーマ
  tone?: string;          // 文体・トーン
  updatedAt?: string;     // ISO
}

export const BLOG_CATEGORIES = [
  'お知らせ',
  '設計',
  'インテリア',
  '施工事例',
  'コラム',
  'その他',
] as const;
