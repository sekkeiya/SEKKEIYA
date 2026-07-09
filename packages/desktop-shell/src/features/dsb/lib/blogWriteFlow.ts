// スケジュールの予定（テーマ）から記事の下書き＋議論の口火を生成する（個人ブログの「予定を実行」）。
// blogDialogue(mode:'draft') を叩き、エディタに載せる draft フィールドを返す。呼び出し側が
// startNew + updateDraft で反映し、右の「AIと議論」で仕上げる。
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { BlogDialogueMsg } from '../types';

export interface DraftFromThemeResult {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  tags: string[];
  category?: string;
  aiDialogue: BlogDialogueMsg[]; // 議論の口火（AIの最初の発言）
}

export async function draftFromTheme(
  theme: string,
  opts: { authorName?: string; categories?: string[] } = {},
): Promise<DraftFromThemeResult> {
  const fn = httpsCallable(functions, 'blogDialogue');
  const r: any = await fn({ mode: 'draft', theme, authorName: opts.authorName || '', categories: opts.categories || [], sourceRefs: [] });
  if (!r.data?.success) throw new Error(r.data?.reason || '下書きの生成に失敗しました');
  const opener = r.data.opener;
  const openerText: string | undefined = opener?.text
    ? (Array.isArray(opener.points) && opener.points.length
        ? `${opener.text}\n\n論点の候補:\n${opener.points.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
        : opener.text)
    : undefined;
  return {
    title: r.data.title || theme,
    excerpt: r.data.excerpt || '',
    bodyMarkdown: r.data.bodyMarkdown || '',
    tags: Array.isArray(r.data.tags) ? r.data.tags : [],
    category: r.data.category || undefined,
    aiDialogue: openerText ? [{ role: 'ai', text: openerText, ts: new Date().toISOString() }] : [],
  };
}
