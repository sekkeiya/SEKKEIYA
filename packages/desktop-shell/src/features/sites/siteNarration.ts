// プロジェクトサイトの「プレゼンモード」ナレーション。
//
// サイトをクライアントに提案する際、AIがナレーションを読み上げながら
// 該当セクションへ自動スクロールする。原稿はCF generateSiteNarration（Haiku）で
// 話し言葉として生成し、サイト内容が変わらない限り localStorage キャッシュを再利用する。
// 生成失敗・未生成時はセクションの本文をそのまま読むフォールバック用テキストも提供する。

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import type { SiteSection } from '../projects/types';

export interface SectionNarration { id: string; narration: string }

const CACHE_PREFIX = 'sekkeiya-site-narration:';

/** セクション内容を読み上げ/原稿生成に使える平文へ直列化する。 */
export function serializeSectionText(s: SiteSection): string {
  const parts: string[] = [];
  if (s.kicker) parts.push(s.kicker);
  if (s.title) parts.push(s.title);
  if (s.body) parts.push(s.body);
  if (s.keywords?.length) parts.push(`キーワード: ${s.keywords.join('、')}`);
  if (s.specRows?.length) parts.push(s.specRows.map((r) => `${r.label}: ${r.value}`).join(' / '));
  if (s.items?.length) parts.push(s.items.map((i) => [i.name, i.spec, i.qty].filter(Boolean).join(' ')).join(' / '));
  if (s.callouts?.length) parts.push(s.callouts.map((c) => `${c.no}. ${c.title}: ${c.body}`).join(' / '));
  if (s.steps?.length) parts.push(s.steps.map((p) => [p.phase, p.title, p.body].filter(Boolean).join(' ')).join(' / '));
  if (s.columns?.length) parts.push(s.columns.map((c) => `${c.title}（${c.rows.join('、')}）`).join(' / '));
  if (s.serviceCards?.length) parts.push(s.serviceCards.map((c) => `${c.title}: ${c.body}`).join(' / '));
  if (parts.length === 0 && s.assetRefs?.length) parts.push(`（${s.type} の画像・アセット ${s.assetRefs.length}点）`);
  return parts.join('\n').trim();
}

/** プレゼン対象のセクション（非表示を除外し、読める内容があるもの）。 */
export function presentableSections(sections: SiteSection[]): SiteSection[] {
  return sections.filter((s) => !s.hidden && serializeSectionText(s).length > 0);
}

// FNV-1a: サイト内容の変更検知用の軽量ハッシュ
function contentHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

interface CacheEntry { contentKey: string; narrations: SectionNarration[] }

function readCache(cacheId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cacheId);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.contentKey === 'string' && Array.isArray(p?.narrations)) return p;
  } catch { /* 破損は無視 */ }
  return null;
}

const inflight = new Map<string, Promise<SectionNarration[] | null>>();

/**
 * ナレーション原稿を取得する。キャッシュ有効なら即時、内容が変わっていればCFで生成。
 * 失敗時は null（呼び出し側は serializeSectionText をそのまま読むフォールバックへ）。
 */
export function getSiteNarration(
  cacheId: string,               // `${siteKey}:${pageId}`
  projectName: string,
  sections: SiteSection[],
): Promise<SectionNarration[] | null> {
  const targets = presentableSections(sections);
  if (targets.length === 0) return Promise.resolve(null);
  const payload = targets.map((s) => ({ id: s.id, text: serializeSectionText(s).slice(0, 2000) }));
  const contentKey = contentHash(JSON.stringify(payload) + projectName);

  const cached = readCache(cacheId);
  if (cached && cached.contentKey === contentKey) return Promise.resolve(cached.narrations);

  const flightKey = `${cacheId}:${contentKey}`;
  const existing = inflight.get(flightKey);
  if (existing) return existing;

  const p = (async () => {
    try {
      const fn = httpsCallable(functions, 'generateSiteNarration');
      const res = await fn({ projectName, sections: payload });
      const narrations = (res.data as any)?.result?.narrations as SectionNarration[] | undefined;
      if (!Array.isArray(narrations) || narrations.length === 0) return null;
      try { localStorage.setItem(CACHE_PREFIX + cacheId, JSON.stringify({ contentKey, narrations })); } catch { /* noop */ }
      return narrations;
    } catch (e) {
      console.warn('[siteNarration] 原稿生成に失敗（本文読み上げにフォールバック）', e);
      return null;
    } finally {
      inflight.delete(flightKey);
    }
  })();
  inflight.set(flightKey, p);
  return p;
}
