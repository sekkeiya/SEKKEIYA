/**
 * articleRatings — 記事への関心度評価（★1〜5）と、それを使ったフィードのパーソナライズ。
 *
 * SEKKEIYA Reader のヘッダで付けた★を保存し、S.Blog ホーム（BlogNewsFeed）の
 * 「おすすめ順」が学習材料として使う。関心ワードランキング（手動設定）と違い、
 * こちらは「読んだ記事への反応」から暗黙的に好みを学ぶ。
 *
 * 保存先:
 *  - localStorage（正本・全ウィンドウ共有・即時反映。Reader は独立ウィンドウなので必須）
 *  - Firestore users/{uid}/blogSettings/articleRatings（端末間同期・ベストエフォート）
 *
 * スコアリング: タイトルの文字バイグラム Dice 係数 × (★-3) の総和 ＋ 媒体ごとの平均評価。
 * 形態素解析なしで日英どちらのタイトルにも効く、軽くて説明可能な類似度。
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export interface ArticleRating {
  url: string;
  title: string;
  source: string;   // 媒体名
  rating: number;   // 1〜5
  at: number;       // 評価時刻（新しい評価が古い評価を上書き）
}

const LS_KEY = 'sblog-article-ratings';
const MAX_ENTRIES = 400; // localStorage/Firestore 1ドキュメントに収まる上限（古い順に間引く）

const ratingsDoc = (uid: string) => doc(db, 'users', uid, 'blogSettings', 'articleRatings');

function loadLocal(): Record<string, ArticleRating> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : {};
  } catch { return {}; }
}

function saveLocal(map: Record<string, ArticleRating>): void {
  // 上限超過は古い評価から間引く（好みは変わるもの＝新しい評価の方が価値が高い）
  const entries = Object.values(map).sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
  const trimmed: Record<string, ArticleRating> = {};
  entries.forEach((r) => { trimmed[r.url] = r; });
  try { localStorage.setItem(LS_KEY, JSON.stringify(trimmed)); } catch { /* noop */ }
}

/** 全評価（新しい順）。 */
export function getLocalRatings(): ArticleRating[] {
  return Object.values(loadLocal()).sort((a, b) => b.at - a.at);
}

/** この記事に付けた★（未評価なら 0）。 */
export function getRatingFor(url: string): number {
  return loadLocal()[url]?.rating || 0;
}

/**
 * ★を保存する（rating=0 で評価取り消し）。ローカルへ即時保存し、
 * uid があれば Firestore へも書く（失敗しても体験は変えない）。
 */
export function setArticleRating(
  uid: string | null | undefined,
  entry: { url: string; title: string; source: string; rating: number },
): void {
  const map = loadLocal();
  if (entry.rating <= 0) delete map[entry.url];
  else map[entry.url] = { ...entry, rating: Math.min(5, Math.max(1, Math.round(entry.rating))), at: Date.now() };
  saveLocal(map);
  if (uid) {
    // 全量書き（削除も反映するため merge しない）。件数は MAX_ENTRIES で抑制済み
    void setDoc(ratingsDoc(uid), { ratings: loadLocal() }).catch(() => { /* オフライン等は次回に */ });
  }
}

/**
 * Firestore の評価をローカルへマージして返す（新しい at が勝ち）。
 * ログイン直後・ホーム表示時に呼ぶ。失敗時はローカルのみ返す。
 */
export async function syncRatingsFromCloud(uid: string): Promise<ArticleRating[]> {
  try {
    const snap = await getDoc(ratingsDoc(uid));
    const cloud = (snap.exists() ? (snap.data() as any).ratings : null) as Record<string, ArticleRating> | null;
    if (cloud && typeof cloud === 'object') {
      const local = loadLocal();
      Object.values(cloud).forEach((r) => {
        if (r && typeof r.url === 'string' && typeof r.rating === 'number') {
          const cur = local[r.url];
          if (!cur || (r.at || 0) > cur.at) local[r.url] = r;
        }
      });
      saveLocal(local);
    }
  } catch { /* オフライン等: ローカルで続行 */ }
  return getLocalRatings();
}

/* ─────────── パーソナライズ・スコアリング（BlogNewsFeed のおすすめ順で使用） ─────────── */

/** タイトルを文字バイグラム集合へ（記号・空白を除去。日英どちらにも効く）。 */
function bigrams(s: string): Set<string> {
  const t = (s || '').toLowerCase().replace(/[\s　、。・:：;；,.\-–—~〜「」『』()（）[\]!！?？"'’|｜]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((g) => { if (b.has(g)) inter += 1; });
  return (2 * inter) / (a.size + b.size);
}

export interface RatingProfile {
  /** 評価数（0 ならおすすめ順への寄与なし） */
  count: number;
  scoreOf: (title: string, source: string) => number;
}

/**
 * 評価履歴から「この記事はどれくらい好みに合うか」を返すスコアラーを作る。
 * ★4-5 に似たタイトルを押し上げ、★1-2 に似たタイトルを押し下げる。
 * 同じ媒体への平均評価も弱く効かせる。直近 120 件のみ使用（好みの変化に追従）。
 */
export function buildRatingProfile(ratings: ArticleRating[]): RatingProfile {
  const recent = ratings.slice(0, 120);
  if (recent.length === 0) return { count: 0, scoreOf: () => 0 };

  const rated = recent.map((r) => ({ bg: bigrams(r.title), w: r.rating - 3 })); // -2〜+2
  const bySource = new Map<string, { sum: number; n: number }>();
  recent.forEach((r) => {
    const e = bySource.get(r.source) || { sum: 0, n: 0 };
    e.sum += r.rating - 3;
    e.n += 1;
    bySource.set(r.source, e);
  });

  const scoreOf = (title: string, source: string): number => {
    const bg = bigrams(title);
    let sim = 0;
    rated.forEach((r) => { sim += dice(bg, r.bg) * r.w; });
    const src = bySource.get(source);
    const srcAvg = src ? src.sum / src.n : 0; // -2〜+2
    // 類似度は 1件あたり最大 ±2×dice。×8 で関心ワード(最大~40)と同じ土俵に乗せる
    return sim * 8 + srcAvg * 2;
  };
  return { count: recent.length, scoreOf };
}
