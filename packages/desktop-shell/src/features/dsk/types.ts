// S.Library — 知識エントリの型。
// Rust 側 LibraryEntry（src-tauri/src/knowledge.rs）と camelCase で一致させる。
// 仕様: docs/11_s_library_spec.md

export type KnowledgeKind = 'book' | 'pdf' | 'url' | 'note';

export interface LibraryEntry {
  localId: string;
  kind: KnowledgeKind;
  title: string;
  author?: string | null;

  // ソース実体（すべてローカルパス or URL）
  filePath?: string | null;
  sourceUrl?: string | null;
  snapshotHtmlPath?: string | null;
  snapshotPdfPath?: string | null;
  bodyMarkdown?: string | null;

  category: string;
  tags: string[];

  // AI生成（全kind共通の核）
  summary?: string | null;
  keyPoints: string[];
  embeddingStatus: 'none' | 'pending' | 'done';

  linkedProjectIds: string[];

  // 閲覧状態（book/pdf）
  lastReadPage?: number | null;
  totalPages?: number | null;
  bookmarks: number[];

  status: 'local';
  thumbnailPath?: string | null;
  folderPath: string;
  createdAt: string;
  updatedAt: string;

  /** LocalAssets/Documents から読み取った実ファイル（インデックス未登録の読み取り専用）。 */
  isLocalFile?: boolean;
  /** LocalAssets/ からの相対パス（isLocalFile のときのみ）。 */
  relPath?: string;
  /** S.Library の保存先ローカルフォルダ（Accounts 配下・S.Library\Local）由来のファイル＝ローカル層。 */
  isConfidential?: boolean;
}

/**
 * 知識カテゴリのシード（既定の選択肢）。建築・インテリア設計のドメイン想定。
 * これは「固定の正典」ではなく初期値であり、ルール分類・AI・ユーザーが付けた
 * 新カテゴリは {@link listKnownCategories} 経由で自動的に選択肢へ合流する。
 */
export const DSK_CATEGORIES = ['法規', '構造', '意匠', '設備', '環境', '積算', '素材・建材', 'その他'] as const;
/** カテゴリは自由文字列（動的拡張）。シードは {@link DSK_CATEGORIES}。 */
export type DskCategory = string;

/** 一覧UIでのみ使う合成カテゴリ（実エントリの category ではない）。選択肢からは除外する。 */
const SYNTHETIC_CATEGORIES = new Set<string>(['ローカルファイル']);

/** AI/ルールに上書きさせてよい「弱い」カテゴリ（未分類相当）か。 */
export function isWeakCategory(c?: string | null): boolean {
  return !c || c === 'その他' || c === '未分類';
}

/**
 * 既知カテゴリの並び（ドロップダウン・サイドバー共通）。
 * シード（'その他' を除く）→ エントリ中に出現した非シードカテゴリ → 末尾に 'その他'。
 * これによりデータ投入に応じてカテゴリが自動で柔軟に増えていく。
 */
export function listKnownCategories(entries: { category?: string | null }[]): string[] {
  const seen = new Set<string>(DSK_CATEGORIES);
  const extra: string[] = [];
  for (const e of entries) {
    const c = e.category;
    if (!c || seen.has(c) || SYNTHETIC_CATEGORIES.has(c)) continue;
    seen.add(c);
    extra.push(c);
  }
  const seeds = (DSK_CATEGORIES as readonly string[]).filter((c) => c !== 'その他');
  return [...seeds, ...extra, 'その他'];
}

export const KIND_LABELS: Record<KnowledgeKind, string> = {
  book: '書籍',
  pdf: 'PDF',
  url: 'Web',
  note: 'メモ',
};
