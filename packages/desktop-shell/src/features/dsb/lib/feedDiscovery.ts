/**
 * feedDiscovery — ユーザーが入力したサイトURL/フィードURLから、実際に配信されている
 * RSS/Atom フィードを探し当てる。既存の Cloud Function `blogDialogue`(mode:'feed') を
 * 検証プローブとして使う（記事が1件でも取れたら有効なフィードとみなす）。
 * WordPress系の /feed/ をはじめ一般的なフィードパスを順に試す。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { BlogSourceSite } from '../types';

/** 候補フィードURLを生成（入力がフィードらしければそれのみ、サイトURLなら一般的なパスを試す）。 */
function feedCandidates(url: URL): string[] {
  const cands: string[] = [];
  const push = (u: string) => { if (!cands.includes(u)) cands.push(u); };
  const isFeedish = /feed|rss|atom|\.xml($|\?)/i.test(url.pathname + url.search);
  push(url.href);
  if (isFeedish) return cands;
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  if (base !== url.origin) { push(`${base}/feed/`); push(`${base}/rss`); }
  push(`${url.origin}/feed/`);
  push(`${url.origin}/rss`);
  push(`${url.origin}/rss.xml`);
  push(`${url.origin}/atom.xml`);
  push(`${url.origin}/feed.xml`);
  push(`${url.origin}/index.xml`);
  return cands.slice(0, 8);
}

/**
 * URL から購読可能なメディアを探索して返す。見つからなければ throw。
 * name はドメイン名から自動命名（例: casabrutus.com）。
 */
export async function discoverFeedSource(input: string): Promise<BlogSourceSite> {
  const raw = input.trim();
  if (!raw) throw new Error('URLを入力してください');
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error('URLの形式が正しくありません');
  }
  const name = url.hostname.replace(/^www\./, '');
  const fn = httpsCallable(functions, 'blogDialogue');

  // 🎬 YouTube チャンネル: @ハンドル等のURLから CF が channelId を解決し、
  // 公式の Atom フィード（feeds/videos.xml）を購読する。動画はReaderで再生+字幕表示できる。
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(url.hostname)) {
    // /channel/UC... はクライアントで直接フィードURL化できる
    const chm = /\/channel\/(UC[\w-]{10,})/.exec(url.pathname);
    let feed = chm ? `https://www.youtube.com/feeds/videos.xml?channel_id=${chm[1]}` : '';
    let ytName = '';
    if (!feed) {
      const r: any = await fn({ mode: 'youtubeChannelFeed', url: url.href });
      if (r.data?.success && r.data.feed) { feed = r.data.feed; ytName = String(r.data.name || ''); }
      else throw new Error(r.data?.reason || 'YouTubeチャンネルを特定できませんでした');
    }
    // 実際に動画が取れるか検証してから返す
    const probe: any = await fn({ mode: 'feed', sites: [{ name: 'yt', feed }], perSite: 2 });
    const items = probe.data?.success && Array.isArray(probe.data.feeds) ? (probe.data.feeds[0]?.items || []) : [];
    if (!items.length) throw new Error('このチャンネルの動画フィードを取得できませんでした');
    const handle = (/\/@([\w.-]+)/.exec(url.pathname) || [])[1];
    return { name: ytName || (handle ? `@${handle}` : 'YouTubeチャンネル'), feed, group: 'カスタム', note: 'YouTubeチャンネル（動画）' };
  }

  for (const feed of feedCandidates(url)) {
    try {
      const r: any = await fn({ mode: 'feed', sites: [{ name, feed }], perSite: 2 });
      const items = r.data?.success && Array.isArray(r.data.feeds) ? (r.data.feeds[0]?.items || []) : [];
      if (Array.isArray(items) && items.length > 0) {
        return { name, feed, group: 'カスタム', note: 'ユーザー追加' };
      }
    } catch { /* 次の候補へ */ }
  }
  throw new Error('RSSフィードが見つかりませんでした。フィードURL（例: https://example.com/feed/）を直接入力してみてください。');
}
