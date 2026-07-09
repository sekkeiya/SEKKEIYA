/**
 * blogImageGen — 「議論から記事を生成/反映」で得た画像プラン（セクション見出し + 生成プロンプト）を
 * AI画像生成（generateBlogImage CF）にかけ、完成し次第 該当セクションの見出し直後に差し込む。
 *
 * 配置は heading アンカー方式（本文の ## 見出しを目印に挿入）。LLM がインライントークンを
 * 出し忘れても配置が崩れない。見出しが一致しなければ i 番目の見出し→末尾の順にフォールバック。
 *
 * 著作権的に安全: 元記事の写真は使わず、記事テーマの生成画像だけを配置（プロンプト側でも
 * 実在建築物・人物・ロゴを描かせない指示をCFで付与済み）。
 * コスト: 3D生成のような都度クレジットではなく「利用枠」でカバー（generateBlogImage が
 * クレジット非消費＋週次利用枠を担保）。上限/未加入時は degrade（記事本文は成立する）。
 */
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../../lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';

export interface BlogImagePlan { heading: string; caption: string; prompt: string }
export interface BlogCoverPlan { caption: string; prompt: string }

/**
 * 本文の ## セクションのうち、画像（![...]）が入っていないセクションの見出しを返す。
 * 「参考記事」（出典リンク集）は対象外。エディタの「🖼 画像生成」ボタンの補完対象を決める。
 */
export function sectionsWithoutImages(body: string): string[] {
  const lines = body.split('\n');
  const sections: { text: string; start: number }[] = [];
  lines.forEach((ln, idx) => {
    const m = /^##\s+(.*\S)\s*$/.exec(ln);
    if (m) sections.push({ text: m[1].trim(), start: idx });
  });
  const out: string[] = [];
  sections.forEach((sec, i) => {
    if (/参考記事/.test(sec.text)) return;
    const end = i + 1 < sections.length ? sections[i + 1].start : lines.length;
    const content = lines.slice(sec.start + 1, end).join('\n');
    if (!/!\[[^\]]*\]\(/.test(content) && !/画像を生成中/.test(content)) out.push(sec.text);
  });
  return out;
}

const GEN_LINE = (caption: string) => `*🖼 画像を生成中…（${caption || 'イメージ'}）*`;
const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 本文中の全 ## / ### 見出し行（テキストと行番号）を拾う。 */
function listHeadings(lines: string[]): { idx: number; text: string }[] {
  const out: { idx: number; text: string }[] = [];
  lines.forEach((ln, idx) => {
    const m = /^#{2,3}\s+(.*\S)\s*$/.exec(ln);
    if (m) out.push({ idx, text: m[1].trim() });
  });
  return out;
}

/**
 * 各画像プランに対応する見出しの直後へ「生成中」プレースホルダ行を挿入する。
 * heading 完全一致 → 部分一致 → i番目の見出し → 末尾 の順で配置先を決める。
 * 返り値: 挿入後の本文と、各画像が実際に使ったプレースホルダ文字列。
 */
export function insertPlaceholdersByHeading(
  body: string,
  images: BlogImagePlan[],
): { body: string; placeholders: string[] } {
  let lines = body.split('\n');
  const usedHeadingIdx = new Set<number>();
  const placeholders: string[] = [];

  images.forEach((im, i) => {
    const headings = listHeadings(lines);
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    let target =
      headings.find((h) => !usedHeadingIdx.has(h.idx) && norm(h.text) === norm(im.heading)) ||
      headings.find((h) => !usedHeadingIdx.has(h.idx) && im.heading && (norm(h.text).includes(norm(im.heading)) || norm(im.heading).includes(norm(h.text)))) ||
      headings.filter((h) => !usedHeadingIdx.has(h.idx))[0];

    const ph = GEN_LINE(im.caption);
    placeholders.push(ph);
    if (target) {
      usedHeadingIdx.add(target.idx);
      lines.splice(target.idx + 1, 0, '', ph);
    } else {
      // 見出しが見つからない → 末尾に追記
      lines.push('', ph);
    }
  });
  return { body: lines.join('\n'), placeholders };
}

/** プレースホルダ（またはキャプション行）を、完成画像 or 空へ1箇所だけ置換する。 */
function replaceOne(body: string, placeholder: string, replacement: string): string {
  const re = new RegExp(`[ \\t]*${escapeReg(placeholder)}[ \\t]*`);
  return body.replace(re, replacement);
}

/** 1枚だけ生成してURLを返す（generateBlogImage→aiJobs購読）。失敗系は code を返す。
 *  画像クリックパネルの「再生成」やカバー生成からも使う。 */
export function generateBlogImageOnce(uid: string, prompt: string, projectId: string | null):
  Promise<{ url: string } | { code: 'PLAN_REQUIRED' | 'BLOG_IMAGE_LIMITED' | 'ERROR'; resetAt?: number }> {
  return new Promise(async (resolve) => {
    try {
      const gen = httpsCallable(functions, 'generateBlogImage');
      const res: any = await gen({ prompt, projectId });
      if (!res.data?.success) {
        const code = res.data?.code === 'PLAN_REQUIRED' || res.data?.code === 'BLOG_IMAGE_LIMITED' ? res.data.code : 'ERROR';
        return resolve({ code, resetAt: res.data?.resetAt });
      }
      const jobId = res.data.jobId;
      const jobRef = doc(db, 'users', uid, 'aiJobs', jobId);
      let done = false;
      const finish = (v: { url: string } | { code: 'ERROR' }) => {
        if (!done) { done = true; try { unsub(); } catch { /* noop */ } resolve(v); }
      };
      const unsub = onSnapshot(jobRef, (snap) => {
        const j: any = snap.data();
        if (!j) return;
        if (j.status === 'completed' && j.resultStorageUrl) finish({ url: j.resultStorageUrl });
        else if (j.status === 'failed') finish({ code: 'ERROR' });
      });
      setTimeout(() => finish({ code: 'ERROR' }), 180_000); // 3分でタイムアウト
    } catch {
      resolve({ code: 'ERROR' });
    }
  });
}

/**
 * 画像プランを順に生成し、完成するたびに本文を更新する（非同期・非ブロッキング）。
 * placeholders は insertPlaceholdersByHeading が返したもの（images と同順）。
 */
export async function generateAndPlaceBlogImages(opts: {
  uid: string;
  images: BlogImagePlan[];
  placeholders: string[];
  projectId: string | null;
  getBody: () => string;
  setBody: (md: string) => void;
  /** カバー（サムネイル）のプラン。あれば本文とは別に生成して onCover へ渡す */
  cover?: BlogCoverPlan | null;
  onCover?: (url: string) => void;
  /** 進捗（done/total。カバーも1枚として数える）。生成中アニメーションの表示用 */
  onProgress?: (done: number, total: number) => void;
}): Promise<{ placed: number; limited?: 'PLAN_REQUIRED' | 'BLOG_IMAGE_LIMITED' }> {
  const { uid, images, placeholders, projectId, getBody, setBody, cover, onCover, onProgress } = opts;
  const total = images.length + (cover ? 1 : 0);
  if (!uid || total === 0) return { placed: 0 };

  let placed = 0;
  let done = 0;
  let limited: 'PLAN_REQUIRED' | 'BLOG_IMAGE_LIMITED' | undefined;
  onProgress?.(0, total);

  // 🖼 カバー（サムネイル）を最初に生成（記事の顔なので優先）
  if (cover) {
    const r = await generateBlogImageOnce(uid, cover.prompt, projectId);
    if ('url' in r) { onCover?.(r.url); placed++; }
    else if (r.code === 'PLAN_REQUIRED' || r.code === 'BLOG_IMAGE_LIMITED') limited = r.code;
    done++;
    onProgress?.(done, total);
  }

  for (const [i, im] of images.entries()) {
    const ph = placeholders[i];
    // 既に枠上限/未加入と判明していれば、残りは生成せずプレースホルダを外す
    if (limited) { setBody(replaceOne(getBody(), ph, '')); done++; onProgress?.(done, total); continue; }

    const r = await generateBlogImageOnce(uid, im.prompt, projectId);
    if ('url' in r) {
      setBody(replaceOne(getBody(), ph, `![${im.caption}](${r.url})`));
      placed++;
      if (!cover && placed === 1) onCover?.(r.url); // カバープラン無しなら1枚目を流用
    } else {
      if (r.code === 'PLAN_REQUIRED' || r.code === 'BLOG_IMAGE_LIMITED') limited = r.code;
      setBody(replaceOne(getBody(), ph, '')); // 失敗/上限の枠は静かに外す
    }
    done++;
    onProgress?.(done, total);
  }
  return { placed, limited };
}
