/**
 * blogSeo — S.Blog 記事のSEOチェック（洗い出し）とAI自動最適化のクライアント側ロジック。
 *
 * アカウントブログ（Markdown本文）と公式ブログ（HTML本文）の両方から使えるよう、
 * 分析・提案は汎用の SeoFields を入力にとる。
 * ・analyzeSeoFields(): 各SEO要素をローカルのヒューリスティックで採点しチェックリスト化。
 * ・fetchSeoSuggestionsFor(): CF blogDialogue(mode:'seo') で slug/メタ説明/タグ等の提案を得る。
 * SEOの目安: スラッグ=英数字ハイフン / メタ説明=110〜120字 / タグ=3〜6 など。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { BlogArticle } from '../types';

export type SeoStatus = 'ok' | 'warn' | 'bad';

export interface SeoCheck {
  key: string;
  label: string;
  status: SeoStatus;
  detail: string;   // 現状と目安
}

export interface SeoSuggestion {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  focusKeyword: string;
  notes: string;
}

/** 汎用SEO入力。アカウント=Markdown / 公式=HTML の両対応。 */
export interface SeoFields {
  title: string;
  /** 明示SEOタイトル（公式のみ）。採点・提案の基準は seoTitle || title */
  seoTitle?: string;
  slug: string;
  /** meta description（アカウント=excerpt / 公式=seoDescription||excerpt） */
  description: string;
  tags: string[];
  coverUrl?: string | null;
  body: string;
  bodyIsHtml?: boolean;
  category?: string;
  /** 公式ブログの集客向けチェック（製品への内部リンク・CTA）を追加で採点する */
  brand?: boolean;
}

/** 本文に SEKKEIYA 製品LP（/products/…）への内部リンクがあるか（HTML/Markdown両対応）。 */
export function hasProductLink(body: string): boolean {
  return /(href\s*=\s*["']|\]\()\s*\/products\//i.test(String(body || ''));
}

/** 本文末尾に CTA（行動喚起）があるか。「SEKKEIYA で試す」見出し or 末尾付近の製品リンク＋誘導語。 */
export function hasCta(body: string): boolean {
  const b = String(body || '');
  if (/SEKKEIYA\s*で試す/i.test(b)) return true;
  const tail = b.slice(-600);
  return /\/products\//.test(tail) && /(試す|詳しく|始め|使っ|見る)/.test(tail);
}

/** 全角を2、半角を1として概算した表示幅（メタ情報の長さ目安に使う）。 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0xff ? 2 : 1;
  return w;
}

/** 純粋なASCII（英数字・ハイフン）スラッグか。日本語や記号混じりは false。 */
export function isAsciiSlug(slug: string): boolean {
  return !!slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** 文字列を英数字ハイフンのスラッグへ（日本語は除去されるため空になり得る＝AI提案が要る合図）。 */
export function asciiSlugify(input: string): string {
  return (input || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/** HTML→プレーンテキスト（SEO分析・CF送信用の素朴な変換）。 */
export function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const H2_MD_RE = /^##\s+\S/m;
const H2_HTML_RE = /<h2[\s>]/i;
const IMG_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const IMG_HTML_RE = /<img\b[^>]*>/gi;

/**
 * 記事のSEO要素を採点。公開前に「洗い出し」として提示する。
 * 目安: タイトル≤32幅 / スラッグ=ASCII設定済み / メタ説明=80〜120幅 / タグ3〜6 /
 *       カバー(OGP)あり / H2見出しあり / 画像altあり。
 */
export function analyzeSeoFields(f: SeoFields): { checks: SeoCheck[]; score: number; total: number } {
  const checks: SeoCheck[] = [];
  const effTitle = (f.seoTitle || f.title || '').trim();
  const titleW = displayWidth(effTitle);
  checks.push({
    key: 'title',
    label: f.seoTitle !== undefined ? 'SEOタイトル' : 'タイトル',
    status: !effTitle ? 'bad' : titleW > 40 ? 'warn' : titleW < 16 ? 'warn' : 'ok',
    detail: !effTitle ? '未設定' : `${titleW}/64（推奨32前後・主要語を前方に）`,
  });

  const slug = (f.slug || '').trim();
  checks.push({
    key: 'slug',
    label: 'スラッグ (URL)',
    status: !slug ? 'bad' : /^post-/.test(slug) ? 'bad' : !isAsciiSlug(slug) ? 'warn' : slug.length > 60 ? 'warn' : 'ok',
    detail: !slug ? '未設定'
      : /^post-/.test(slug) ? '自動生成のまま（キーワードURL推奨）'
      : !isAsciiSlug(slug) ? '日本語/記号混じり（英数字ハイフン推奨）'
      : slug,
  });

  const descW = displayWidth(f.description || '');
  checks.push({
    key: 'desc',
    label: 'メタディスクリプション',
    status: !f.description?.trim() ? 'bad' : descW < 60 ? 'warn' : descW > 130 ? 'warn' : 'ok',
    detail: !f.description?.trim() ? '未設定' : `${descW}/240（推奨110〜120幅）`,
  });

  const tagN = f.tags?.length ?? 0;
  checks.push({
    key: 'tags',
    label: 'タグ（キーワード）',
    status: tagN === 0 ? 'bad' : tagN < 3 ? 'warn' : tagN > 8 ? 'warn' : 'ok',
    detail: tagN === 0 ? '未設定' : `${tagN}個（推奨3〜6）`,
  });

  checks.push({
    key: 'cover',
    label: 'カバー画像（OGP/サムネイル）',
    status: f.coverUrl ? 'ok' : 'warn',
    detail: f.coverUrl ? '設定済み' : 'SNS共有時のサムネイル。設定推奨',
  });

  const hasH2 = f.bodyIsHtml ? H2_HTML_RE.test(f.body || '') : H2_MD_RE.test(f.body || '');
  checks.push({
    key: 'headings',
    label: '見出し構造（H2）',
    status: hasH2 ? 'ok' : 'warn',
    detail: hasH2 ? '見出しあり' : '見出しで検索語を含めると有利',
  });

  // 画像のalt（画像がある記事のみ判定）
  if (f.bodyIsHtml) {
    const imgs = (f.body || '').match(IMG_HTML_RE) ?? [];
    if (imgs.length > 0) {
      const missing = imgs.filter((tag) => !/\balt\s*=\s*"[^"]+"|\balt\s*=\s*'[^']+'/i.test(tag)).length;
      checks.push({
        key: 'alt',
        label: '画像のalt（代替テキスト）',
        status: missing === 0 ? 'ok' : 'warn',
        detail: missing === 0 ? `全${imgs.length}枚に設定` : `${missing}/${imgs.length}枚が未設定`,
      });
    }
  } else {
    const imgs = [...(f.body || '').matchAll(IMG_MD_RE)];
    if (imgs.length > 0) {
      const missing = imgs.filter((m) => !m[1]?.trim()).length;
      checks.push({
        key: 'alt',
        label: '画像のalt（代替テキスト）',
        status: missing === 0 ? 'ok' : 'warn',
        detail: missing === 0 ? `全${imgs.length}枚に設定` : `${missing}/${imgs.length}枚が未設定`,
      });
    }
  }

  // 公式ブログ（集客記事）向けの追加チェック: 製品への内部リンク・CTA。
  if (f.brand) {
    const linked = hasProductLink(f.body);
    checks.push({
      key: 'productlink',
      label: '製品への内部リンク',
      status: linked ? 'ok' : 'warn',
      detail: linked ? '/products/… へのリンクあり' : '関連製品(/products/…)へのリンクで集客・SEO強化',
    });
    const cta = hasCta(f.body);
    checks.push({
      key: 'cta',
      label: 'CTA（行動喚起）',
      status: cta ? 'ok' : 'warn',
      detail: cta ? '末尾に誘導あり' : '末尾に「SEKKEIYAで試す」等の誘導を推奨',
    });
  }

  const score = checks.filter((c) => c.status === 'ok').length;
  return { checks, score, total: checks.length };
}

/** アカウントブログ（BlogArticle）用の互換ラッパー。 */
export function analyzeSeo(a: BlogArticle): { checks: SeoCheck[]; score: number; total: number } {
  return analyzeSeoFields({
    title: a.title || '',
    slug: a.slug || '',
    description: a.excerpt || '',
    tags: a.tags || [],
    coverUrl: a.coverUrl,
    body: a.bodyMarkdown || '',
  });
}

/** CF blogDialogue(mode:'seo') でSEO提案を取得（汎用）。HTML本文はテキスト化して送る。 */
export async function fetchSeoSuggestionsFor(input: {
  title: string; body: string; bodyIsHtml?: boolean; excerpt?: string; category?: string;
}): Promise<SeoSuggestion> {
  const fn = httpsCallable(functions, 'blogDialogue');
  const r: any = await fn({
    mode: 'seo',
    title: input.title,
    bodyMarkdown: input.bodyIsHtml ? htmlToText(input.body) : input.body,
    excerpt: input.excerpt || '',
    category: input.category || '',
  });
  if (!r.data?.success) throw new Error(r.data?.reason || 'SEO提案の取得に失敗しました');
  return {
    slug: String(r.data.slug || ''),
    metaTitle: String(r.data.metaTitle || ''),
    metaDescription: String(r.data.metaDescription || ''),
    tags: Array.isArray(r.data.tags) ? r.data.tags.map((t: any) => String(t)) : [],
    focusKeyword: String(r.data.focusKeyword || ''),
    notes: String(r.data.notes || ''),
  };
}

/** アカウントブログ（BlogArticle）用の互換ラッパー。 */
export async function fetchSeoSuggestions(a: BlogArticle): Promise<SeoSuggestion> {
  return fetchSeoSuggestionsFor({ title: a.title, body: a.bodyMarkdown, excerpt: a.excerpt, category: a.category });
}
