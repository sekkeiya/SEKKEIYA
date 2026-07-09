// 購読中のニュースフィードを取得する共有ヘルパー。
// BlogNewsFeed（S.Blog ホーム）の取得ロジックと同じ（購読ソース＋blogDialogue feed）を、
// SEKKEIYA OS からの「リーダーを開く」等、BlogNewsFeed をマウントしていない文脈でも使えるよう切り出したもの。
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import { loadBlogFeedSources, loadCustomFeedSources } from '../api/blogApi';
import { DEFAULT_SOURCE_SITES } from '../types';

export interface NewsFeedItem {
  title: string;
  url: string;
  source: string;
  date?: string;
  image?: string;
}

/** リーダーのプレイリストとして localStorage に保存するキー（ReaderWindow と共有）。 */
export const READER_PLAYLIST_KEY = 'sblog-reader-playlist';

/** 購読フィードを取得し、日付降順の記事一覧を返す（S.Blog ホームと同じ内容）。 */
export async function fetchBlogNewsPlaylist(uid: string): Promise<NewsFeedItem[]> {
  const [sourceNames, customs] = await Promise.all([
    loadBlogFeedSources(uid),
    loadCustomFeedSources(uid),
  ]);
  const allSites = [...DEFAULT_SOURCE_SITES, ...customs];
  const subscribed = sourceNames ? allSites.filter((s) => sourceNames.includes(s.name)) : [];
  if (subscribed.length === 0) return [];

  const fn = httpsCallable(functions, 'blogDialogue');
  const r: any = await fn({
    mode: 'feed',
    sites: subscribed.map((s) => ({ name: s.name, feed: s.feed })),
    perSite: 8,
  });
  if (!r.data?.success || !Array.isArray(r.data.feeds)) return [];
  const all: NewsFeedItem[] = r.data.feeds.flatMap((f: any) => (Array.isArray(f.items) ? f.items : []));
  all.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });
  return all;
}

/** 取得したフィードを ReaderWindow が読むプレイリスト形式で localStorage に保存する。 */
export function saveReaderPlaylist(items: NewsFeedItem[]): void {
  try {
    localStorage.setItem(READER_PLAYLIST_KEY, JSON.stringify({
      at: Date.now(),
      items: items.map((f) => ({ title: f.title, url: f.url, source: f.source, image: f.image || '' })),
    }));
  } catch { /* 保存できなくても単記事表示は可能 */ }
}
