// 現在 S.Blog で編集中の記事を「LLM / オーケストレーターが読める軽量サマリ」に変換する。
// siteSnapshot.ts と対になる設計。狙いは「ブログ編集中なのにサイトのセクション構造を
// 見て add_asset_to_section / 3D生成フローへ誤爆する」事故の防止。
// ブログ本文は bodyMarkdown（Markdown 1本）であり、サイトのような assetCount 付き
// セクションスロットを持たない。画像はインライン Markdown 画像参照で表現する。

import { useDsbStore } from '../store/useDsbStore';

export interface BlogSnapshot {
  editing: boolean;          // S.Blog でいずれかの記事を編集中なら true
  id: string | null;
  title: string;
  category: string;
  tags: string[];
  status: string;
  headingCount: number;      // 本文中の Markdown 見出し（# 〜 ######）数 ＝「セクション」
  headings: string[];        // 見出しテキスト（最大 20）
  imageCount: number;        // 本文中のインライン画像 ![]() 数
  hasCover: boolean;
  bodyChars: number;
}

const EMPTY: BlogSnapshot = {
  editing: false, id: null, title: '', category: '', tags: [], status: '',
  headingCount: 0, headings: [], imageCount: 0, hasCover: false, bodyChars: 0,
};

/** zustand ストアから現在の編集中ブログ記事スナップショットを生成する（純粋 read）。 */
export function buildBlogSnapshot(): BlogSnapshot {
  const { mode, draft } = useDsbStore.getState();
  if (mode !== 'edit' || !draft) return EMPTY;

  const body = draft.bodyMarkdown || '';
  // 行頭の Markdown 見出しを抽出（コードフェンス内は厳密判定しない簡易版）。
  const headingMatches = [...body.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)];
  const headings = headingMatches.map(m => m[1].trim()).slice(0, 20);
  // インライン画像 ![alt](url)
  const imageCount = (body.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length;

  return {
    editing: true,
    id: draft.id,
    title: draft.title || '無題の記事',
    category: draft.category || '',
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    status: draft.status || 'draft',
    headingCount: headingMatches.length,
    headings,
    imageCount,
    hasCover: !!draft.coverUrl,
    bodyChars: body.length,
  };
}

/**
 * スナップショットを system prompt へ差し込むためのテキストへ整形する。
 * ブログ編集中は、サイトと取り違えないための明示ガードも併せて返す。
 */
export function formatBlogSnapshotForPrompt(snap: BlogSnapshot): string {
  if (!snap.editing) return '';
  const lines: string[] = [];
  lines.push('[現在の編集対象] ユーザーは **S.Blog で記事を編集中** です（プロジェクトサイトではありません）。');
  lines.push(`- 記事: "${snap.title}" / カテゴリ=${snap.category || '-'} / 状態=${snap.status} / タグ=[${snap.tags.join(', ')}] [${snap.id ?? '-'}]`);
  lines.push(`- 本文: ${snap.bodyChars}字 / 見出し(セクション)=${snap.headingCount}個 / 本文中の画像=${snap.imageCount}枚 / カバー画像=${snap.hasCover ? 'あり' : 'なし'}`);
  if (snap.headings.length > 0) {
    lines.push(`- 見出し一覧: ${snap.headings.map(h => `「${h}」`).join(' / ')}`);
  }
  lines.push('');
  lines.push('[S.Blog 編集ルール — 厳守]');
  lines.push('- ブログ記事の本文は Markdown 1本（bodyMarkdown）です。「各セクション」とは記事内の Markdown 見出し（##）を指し、プロジェクトサイトの section（hero/overview/spec/concept 等）とは別物です。両者を混同しないこと。');
  lines.push('- ブログの編集・画像挿入には、サイト用ツール（add_asset_to_section / add_section / open_image_picker / start_3d_generation 等）を使わないこと。これらは「プロジェクトサイト」専用です。');
  lines.push('- 本文に画像を入れる場合は、Markdown のインライン画像参照（![説明](URL)）として本文中に記述し、create_blog_draft で記事を更新する形を基本とする。素材が無ければ「どこに・どんな画像を入れたいか」を確認し、3D生成フローへ自動で誘導しない。');
  lines.push('- 以降の「サイト構成」コンテキストは参考情報であり、今回の編集対象ではない。');
  return lines.join('\n');
}
