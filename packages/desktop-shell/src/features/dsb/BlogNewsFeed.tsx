/**
 * BlogNewsFeed — S.Blog ホーム。おすすめの建築・インテリアメディアの最新記事フィード。
 *
 * 著作権の取り扱いに配慮し、本文は一切転載しない。S.Library の Web記事一覧と同じく
 * タイトル / 媒体名 / 日付のカードだけを表示し、クリックで元記事（既定ブラウザ）へ。
 * 各カードの「AIと議論して書く」→ 記事を題材にエディタを開き（議論ファースト）、
 * 記事を読みながらAIと議論 → 議論を踏まえてAIが記事を生成する。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, CircularProgress, Tooltip, Button, TextField } from '@mui/material';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import BookmarkAddedRoundedIcon from '@mui/icons-material/BookmarkAddedRounded';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEFAULT_SOURCE_SITES, recommendSourcesForCategories, NOTABLE_NAMES, titleMatchesAlias, type BlogSourceSite } from './types';
import { openReader } from './lib/openReader';
import { LIBRARY_ADDED_EVENT } from './lib/articleToLibrary';
import { isTauri } from '../../lib/platform';
import { getLocalKnowledge } from '../dsk/api/knowledgeApi';
import { loadBlogFeedSources, saveBlogFeedSources, loadCustomFeedSources, saveCustomFeedSources, loadBlogNameFilters, saveBlogNameFilters, loadBlogInterestKeywords } from './api/blogApi';
import { getLocalRatings, syncRatingsFromCloud, buildRatingProfile, type ArticleRating } from './lib/articleRatings';
import { getYouTubeId } from './lib/youtube';
import { FeedSourcePicker } from './FeedSourcePicker';
import { BRAND } from '../../styles/theme';

const ACCENT = '#e57373';

interface FeedItem {
  title: string;
  url: string;
  source: string;
  date?: string;
  image?: string; // RSSの media:content / enclosure 等から取得したサムネイル
}

// セッション内キャッシュ（ビューを離れて戻っても再取得しない。更新ボタンで明示リロード）
let feedCache: FeedItem[] | null = null;
let feedCacheAt = 0;
let feedCacheKey = ''; // 購読ソースの署名（変わったらキャッシュ無効）
const CACHE_TTL = 30 * 60 * 1000; // 30分

const fmtDate = (v?: string) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'たった今';
    if (h < 24) return `${h}時間前`;
    const days = Math.floor(h / 24);
    if (days < 8) return `${days}日前`;
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  } catch { return ''; }
};

const GROUPS = ['すべて', '国内・建築/デザイン', '国内・住まい/インテリア', '海外・トレンド', 'テック・AI'] as const;

// 📰⇄🎬 種別判定（情報源ビューと同じ基準。カスタム追加のYouTubeチャンネルも拾う）
const isVideoSite = (s: BlogSourceSite): boolean => s.group === '動画（YouTube）' || s.feed.includes('youtube.com/feeds');
const isVideoUrl = (u: string): boolean => /(youtube\.com|youtu\.be)\//.test(u);

// 一覧表示の直後に、上位記事をバックエンドで先回り処理（抽出＋英語記事の日本語翻訳）。
// 結果は全ユーザー共有の readerCache に載るため、記事を開いた瞬間に翻訳済みで表示される。
// fire-and-forget（失敗しても一覧表示には影響しない）。サーバー側で処理済みはスキップされる。
let prewarmedKey = ''; // 同じフィード内容で二重に呼ばない
function prewarmArticles(list: FeedItem[], sites: BlogSourceSite[]) {
  try {
    const top = list.slice(0, 10);
    const key = top.map((t) => t.url).join('|');
    if (!key || key === prewarmedKey) return;
    prewarmedKey = key;
    const feedOf = new Map(sites.map((s) => [s.name, s.feed]));
    const urls = top.map((it) => ({ url: it.url, feed: feedOf.get(it.source) || '' }));
    void httpsCallable(functions, 'blogDialogue')({ mode: 'prewarm', urls }).catch(() => { /* 温めは任意 */ });
  } catch { /* noop */ }
}

interface BlogNewsFeedProps {
  /** 公式ブログモード: アカウント固有の導線（投稿予定ウィジェット・「AIと議論して書く」）を隠し、
   *  ニュースの閲覧/インスピレーション用サーフェスとして使う。 */
  official?: boolean;
}

export const BlogNewsFeed: React.FC<BlogNewsFeedProps> = ({ official = false }) => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const displayName = useAuthStore((s: any) => s.currentUser?.displayName as string | undefined);
  const { startNew, updateDraft } = useDsbStore();

  const [items, setItems] = useState<FeedItem[]>(feedCache ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [group, setGroup] = useState<string>('すべて');
  const [siteFilter, setSiteFilter] = useState<string>(''); // 媒体名（空=グループ内すべて）
  // 📰⇄🎬 記事メディアと YouTube（動画）の表示切替（情報源ビューと対）
  const [feedKind, setFeedKind] = useState<'article' | 'video'>('article');
  // 🌐 動画の言語絞り込み: 「日本語で聴ける」= 日本語チャンネル or 日本語音声トラック（吹替）あり
  const [videoLang, setVideoLang] = useState<'all' | 'ja' | 'original'>('all');
  const [jaAudioMap, setJaAudioMap] = useState<Record<string, boolean>>({}); // videoId → 日本語トラック有無

  // 👤 人物・会社フィルタ: 著名辞書(NOTABLE_NAMES)の自動検出チップ＋ユーザー追加のウォッチ名
  const [nameFilter, setNameFilter] = useState<string>('');       // 選択中のラベル（空=絞り込みなし）
  const [customNames, setCustomNames] = useState<string[]>([]);   // ユーザー追加分（Firestore永続化）
  const [addingName, setAddingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // 📡 ユーザーが紐づけたソース（SEKKEIYAはおすすめ提示まで・購読はユーザーの選択）。
  // undefined=読込中 / null=未選択（初回はソース選択画面を出す） / []以上=選択済み
  const [sources, setSources] = useState<string[] | null | undefined>(undefined);
  const [customSources, setCustomSources] = useState<BlogSourceSite[]>([]);
  const [sourcesSaving, setSourcesSaving] = useState(false);
  const categories = useDsbStore((s) => s.categories);
  // 全幅ヘッダーの検索・更新と連携（媒体選択は左サイドバー「ソース記事」へ移設済み）。
  const feedSearch = useDsbStore((s) => s.feedSearch);
  const feedRefreshNonce = useDsbStore((s) => s.feedRefreshNonce);
  // 関心ワードランキング（ソース記事の右サイドバーで設定）とおすすめ順の切替
  const [interestKeywords, setInterestKeywords] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'new' | 'reco'>('new');
  const setView = useDsbStore((s) => s.setView);

  // ⭐ 記事への関心度評価（Reader で付けた★）。おすすめ順の学習材料。
  // Reader は独立ウィンドウなので、フォーカス復帰・storage イベントで再読込して即時反映する。
  const [ratedMap, setRatedMap] = useState<Map<string, ArticleRating>>(new Map());
  useEffect(() => {
    const refresh = () => setRatedMap(new Map(getLocalRatings().map((r) => [r.url, r])));
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void syncRatingsFromCloud(uid).then((list) => {
      if (!alive) return;
      setRatedMap(new Map(list.map((r) => [r.url, r])));
      if (list.length > 0) setSortMode('reco'); // 評価があれば初期表示はおすすめ順
    });
    return () => { alive = false; };
  }, [uid]);
  const ratingProfile = useMemo(
    () => buildRatingProfile([...ratedMap.values()].sort((a, b) => b.at - a.at)),
    [ratedMap],
  );

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void Promise.all([loadBlogFeedSources(uid), loadCustomFeedSources(uid), loadBlogNameFilters(uid), loadBlogInterestKeywords(uid)])
      .then(([s, customs, names, kws]) => {
        if (!alive) return;
        setCustomSources(customs); setSources(s); setCustomNames(names); setInterestKeywords(kws);
        // 関心ワードが設定済みなら初期表示は「おすすめ順」（設定はソース記事の右サイドバー）。
        if (kws.length > 0) setSortMode('reco');
      })
      .catch(() => { if (alive) setSources(null); });
    return () => { alive = false; };
  }, [uid]);

  // おすすめ＋ユーザー追加カスタムの全ソース定義
  const allSites = useMemo(() => [...DEFAULT_SOURCE_SITES, ...customSources], [customSources]);

  // 購読中のソース定義（フィード取得・媒体フィルタは常にこの範囲）
  const subscribedSites = useMemo(
    () => (sources ? allSites.filter((s) => sources.includes(s.name)) : []),
    [sources, allSites],
  );

  // カスタムメディアの追加/削除（永続化込み）
  const handleAddCustom = async (site: BlogSourceSite) => {
    if (!uid) return;
    const next = [...customSources, site];
    await saveCustomFeedSources(uid, next);
    setCustomSources(next);
  };
  const handleRemoveCustom = async (name: string) => {
    if (!uid) return;
    const next = customSources.filter((s) => s.name !== name);
    try {
      await saveCustomFeedSources(uid, next);
      setCustomSources(next);
      // 購読中だったら購読からも外す
      if (sources?.includes(name)) {
        const nextSources = sources.filter((n) => n !== name);
        await saveBlogFeedSources(uid, nextSources);
        setSources(nextSources);
      }
    } catch (e) {
      console.error('[BlogNewsFeed] remove custom source failed', e);
    }
  };

  const load = async (force = false, sitesArg?: BlogSourceSite[]) => {
    const sites = sitesArg ?? subscribedSites;
    if (loading) return;
    if (sites.length === 0) { setItems([]); return; }
    const key = sites.map((s) => s.name).sort().join('|');
    if (!force && feedCache && feedCacheKey === key && Date.now() - feedCacheAt < CACHE_TTL) { setItems(feedCache); return; }
    setLoading(true);
    setError('');
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      // サーバー側は1回の呼び出しで12媒体まで（超過分は切り捨てられる）
      // → 12件ずつに分割して並列取得し、結果を結合する。
      const chunks: BlogSourceSite[][] = [];
      for (let i = 0; i < sites.length; i += 12) chunks.push(sites.slice(i, i + 12));
      const rs = await Promise.all(chunks.map((chunk) =>
        fn({
          mode: 'feed',
          sites: chunk.map((s) => ({ name: s.name, feed: s.feed })),
          perSite: 8,
        }).catch(() => null)));
      const okRes: any[] = rs.filter((r: any) => r?.data?.success && Array.isArray(r.data.feeds));
      if (okRes.length > 0) {
        const all: FeedItem[] = okRes
          .flatMap((r: any) => r.data.feeds)
          .flatMap((f: any) => (Array.isArray(f.items) ? f.items : []));
        // 日付降順（日付なしは末尾）
        all.sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0;
          const tb = b.date ? new Date(b.date).getTime() : 0;
          return tb - ta;
        });
        feedCache = all;
        feedCacheAt = Date.now();
        feedCacheKey = key;
        setItems(all);
        prewarmArticles(all, sites);
      } else {
        const reason = rs.map((r: any) => r?.data?.reason).find(Boolean);
        setError(reason || 'フィードを取得できませんでした');
      }
    } catch (e: any) {
      setError(`フィードの取得に失敗しました: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 購読が確定/変更されたらフィードを読み込む
  useEffect(() => {
    if (sources && sources.length > 0) void load();
    if (sources && sources.length === 0) setItems([]);
  }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  // 全幅ヘッダーの「フィード更新」ボタン（feedRefreshNonce の変化）で強制再取得。
  useEffect(() => {
    if (feedRefreshNonce > 0) void load(true);
  }, [feedRefreshNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // ソース選択の保存（初回オンボーディング / 管理ダイアログ共通）
  const handleSaveSources = async (names: string[]) => {
    if (!uid) return;
    setSourcesSaving(true);
    try {
      await saveBlogFeedSources(uid, names);
      setSources(names);
      setManageOpen(false);
    } catch (e) {
      console.error('[BlogNewsFeed] save feed sources failed', e);
    } finally {
      setSourcesSaving(false);
    }
  };

  // 📅 投稿スケジュール連携: 「今週書くもの」を常時提示し、実行で 記事表示→読み上げ→AI議論 へ
  const schedules = useDsbStore((s) => s.schedules);
  const loadSchedules = useDsbStore((s) => s.loadSchedules);
  useEffect(() => { if (uid) void loadSchedules(uid); }, [uid, loadSchedules]);


  // 今日が期日の予定をデスクトップ通知（1日1回・best-effort。Global Settings > S.Blog でOFFにできる）
  useEffect(() => {
    if (!isTauri() || !uid || schedules.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `sblog-sched-notified:${today}`;
    if (localStorage.getItem(key)) return;
    const due = schedules.filter((s) => s.status === 'planned' && s.date <= today);
    if (due.length === 0) return;
    void import('./api/blogApi').then(async ({ loadBlogPrefs }) => {
      const prefs = await loadBlogPrefs(uid);
      if (!prefs.notifyDue) return;
      localStorage.setItem(key, '1');
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('send_rhino_local_notification', {
        title: '今日の投稿予定',
        body: due.map((s) => s.title).slice(0, 3).join(' / '),
      });
    }).catch(() => { /* 非対応環境は無視 */ });
  }, [schedules, uid]);

  // カテゴリに合うのにまだ紐づけていないソース（ワンクリック追加の提案チップ）
  const suggestions = useMemo(() => {
    if (!sources) return [];
    const rec = recommendSourcesForCategories(categories, allSites);
    return [...rec.entries()].filter(([name]) => !sources.includes(name));
  }, [categories, sources, allSites]);

  // 📚 S.Library に追加済みの記事URL（カードに「追加済み」バッジを出す）。
  // リーダーウィンドウ側で追加された場合もイベントで即時反映する。
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    void getLocalKnowledge()
      .then((entries) => {
        if (!alive) return;
        setSavedUrls(new Set(entries.map((e) => (e.sourceUrl || '').trim()).filter(Boolean)));
      })
      .catch(() => { /* 取得できなくてもフィード表示は可能 */ });
    void import('@tauri-apps/api/event')
      .then(({ listen }) => listen<{ url: string }>(LIBRARY_ADDED_EVENT, (e) => {
        const url = (e.payload?.url || '').trim();
        if (url) setSavedUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
      }))
      .then((un) => { if (alive) unlisten = un; else un(); })
      .catch(() => { /* noop */ });
    return () => { alive = false; if (unlisten) unlisten(); };
  }, []);

  const siteMeta = useMemo(() => {
    const m = new Map<string, BlogSourceSite>();
    allSites.forEach((s) => m.set(s.name, s));
    return m;
  }, [allSites]);

  // 表示種別（記事⇄動画）に合う購読ソースだけを対象にする
  const kindSites = useMemo(
    () => subscribedSites.filter((s) => isVideoSite(s) === (feedKind === 'video')),
    [subscribedSites, feedKind],
  );

  // グループタブ（カスタムメディアを購読していれば「カスタム」タブも出す）。動画表示では使わない
  const groupTabs = useMemo(
    () => (kindSites.some((s) => s.group === 'カスタム') ? [...GROUPS, 'カスタム'] : [...GROUPS]),
    [kindSites],
  );

  const groupSites = useMemo(
    () => kindSites.filter((s) => feedKind === 'video' || group === 'すべて' || s.group === group),
    [group, kindSites, feedKind],
  );

  // 👤 人物・会社チップ: カスタム（常に表示）＋著名辞書のうち現在のフィードに記事がある人物・会社
  const nameChips = useMemo(() => {
    const custom = customNames.map((n) => ({ label: n, aliases: [n], kind: 'ウォッチ' as const, custom: true }));
    const detected = NOTABLE_NAMES
      .filter((n) => !customNames.includes(n.label))
      .filter((n) => items.some((it) => n.aliases.some((a) => titleMatchesAlias(it.title, a))))
      .map((n) => ({ label: n.label, aliases: n.aliases, kind: n.kind, custom: false }));
    return [...custom, ...detected];
  }, [items, customNames]);

  // ウォッチ名の追加/削除（Firestore永続化）
  const handleAddName = async (raw: string) => {
    const n = raw.trim();
    setAddingName(false);
    setNameInput('');
    if (!n || !uid || customNames.includes(n)) return;
    const next = [...customNames, n];
    setCustomNames(next);
    setNameFilter(n);
    try { await saveBlogNameFilters(uid, next); }
    catch (e) { console.error('[BlogNewsFeed] save name filters failed', e); }
  };
  const handleRemoveName = async (n: string) => {
    if (!uid) return;
    const next = customNames.filter((x) => x !== n);
    setCustomNames(next);
    if (nameFilter === n) setNameFilter('');
    try { await saveBlogNameFilters(uid, next); }
    catch (e) { console.error('[BlogNewsFeed] save name filters failed', e); }
  };

  // 🌐 表示中の動画の「日本語音声トラック（吹替）」有無を CF でバッチ判定（Firestore永続キャッシュ）。
  // pending が返る間は繰り返し呼んで全件を埋める（1回8件ずつの新規判定）。
  useEffect(() => {
    if (feedKind !== 'video') return;
    const urls = items.filter((it) => isVideoUrl(it.url)).slice(0, 40).map((it) => it.url);
    if (!urls.length) return;
    let alive = true;
    void (async () => {
      try {
        const fn = httpsCallable(functions, 'blogDialogue');
        for (let i = 0; i < 5; i++) {
          const r: any = await fn({ mode: 'videoLangs', urls });
          if (!alive || !r.data?.success) return;
          setJaAudioMap((prev) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(r.data.map || {}).map(([id, v]: [string, any]) => [id, !!v?.jaAudio])),
          }));
          if (!r.data.pending) break;
        }
      } catch { /* 判定できなくても一覧表示は可能 */ }
    })();
    return () => { alive = false; };
  }, [feedKind, items]);

  // 「日本語で聴ける」判定: 日本語チャンネル or 日本語音声トラックあり（トラック機能への柔軟対応）
  const jaWatchable = (it: FeedItem): boolean =>
    siteMeta.get(it.source)?.lang === 'ja' || !!jaAudioMap[getYouTubeId(it.url)];

  const filtered = useMemo(() => {
    const q = feedSearch.trim().toLowerCase();
    return items.filter((it) => {
      const meta = siteMeta.get(it.source);
      // 種別トグル: 動画（YouTube URL）⇄ 記事。グループタブは記事表示のみ有効
      if (isVideoUrl(it.url) !== (feedKind === 'video')) return false;
      if (feedKind === 'article' && group !== 'すべて' && meta?.group !== group) return false;
      // 🌐 動画の言語絞り込み（日本語で聴ける ⇄ 原語のみ）
      if (feedKind === 'video' && videoLang !== 'all') {
        const ja = jaWatchable(it);
        if (videoLang === 'ja' ? !ja : ja) return false;
      }
      if (siteFilter && it.source !== siteFilter) return false;
      if (nameFilter) {
        const aliases = nameChips.find((c) => c.label === nameFilter)?.aliases ?? [nameFilter];
        if (!aliases.some((a) => titleMatchesAlias(it.title, a))) return false;
      }
      // 全幅ヘッダーの検索: タイトル or 媒体名にマッチ。
      if (q && !(it.title?.toLowerCase().includes(q) || it.source?.toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, group, siteFilter, siteMeta, nameFilter, nameChips, feedSearch, feedKind, videoLang, jaAudioMap]);

  // おすすめ順のスコア = 関心ワードランキング（手動設定）＋ ⭐関心度評価（Readerで付けた★からの学習）。
  // 関心ワードは 1位が最重・タイトル一致を最重視、媒体キーワード一致は弱め。
  // ★評価は「高評価に似たタイトルを押し上げ・低評価に似たタイトルを押し下げ」（articleRatings.ts）。
  const displayed = useMemo(() => {
    if (sortMode !== 'reco' || (interestKeywords.length === 0 && ratingProfile.count === 0)) return filtered;
    const n = interestKeywords.length;
    const scoreOf = (it: FeedItem): number => {
      const title = (it.title || '').toLowerCase();
      const siteKw = (siteMeta.get(it.source)?.keywords || []).join(' ').toLowerCase();
      let s = 0;
      interestKeywords.forEach((w, i) => {
        const lw = w.toLowerCase();
        const weight = n - i; // 1位 = n, 最下位 = 1
        if (title.includes(lw)) s += weight * 2;
        else if (siteKw.includes(lw)) s += weight * 0.5;
      });
      s += ratingProfile.scoreOf(it.title || '', it.source || '');
      return s;
    };
    const dateOf = (it: FeedItem) => (it.date ? new Date(it.date).getTime() : 0);
    return [...filtered].sort((a, b) => scoreOf(b) - scoreOf(a) || dateOf(b) - dateOf(a));
  }, [filtered, sortMode, interestKeywords, siteMeta, ratingProfile]);

  // 記事を SEKKEIYA Reader で開く。開く前に表示中の並びをプレイリストとして保存し、
  // Reader 側の連続読み上げ（読了→次の記事へ自動遷移）に使う。
  const openArticle = (it: FeedItem) => {
    try {
      localStorage.setItem('sblog-reader-playlist', JSON.stringify({
        at: Date.now(),
        items: displayed.map((f) => ({ title: f.title, url: f.url, source: f.source, image: f.image || '' })),
      }));
    } catch { /* 保存できなくても単記事表示は可能 */ }
    void openReader(it.url, it.title, it.source);
  };

  // 「AIと議論して書く」— 記事を題材にエディタを開く（議論ファースト）。
  const discussAndWrite = (it: FeedItem) => {
    if (!uid) return;
    startNew(uid, displayName, undefined);
    updateDraft({
      sourceRefs: [{ title: it.title, url: it.url, source: it.source, date: it.date || '' }],
      aiDialogue: [],
    });
  };

  // 媒体名から安定した色相（バッジ用）
  const hueOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      {/* メディア選択は左サイドバー「ソース記事」へ、フィード更新は全幅ヘッダーへ移設した。 */}

      {sources === undefined ? (
        // 購読設定の読込中
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={24} sx={{ color: ACCENT }} />
        </Box>
      ) : sources === null ? (
        // 初回: SEKKEIYAはおすすめの提示まで。ユーザーが自分で選んで紐づける
        <Box sx={{ maxWidth: 900, mt: 2 }}>
          <FeedSourcePicker categories={categories} current={null} customSources={customSources} saving={sourcesSaving}
            onSave={(n) => void handleSaveSources(n)}
            onAddCustom={handleAddCustom} onRemoveCustom={(n) => void handleRemoveCustom(n)} />
        </Box>
      ) : (
      <>
      {/* 「今週書くもの」パネルは撤去。締切の予定はサイドバー「スケジュール」の通知バッジで示す。 */}

      {/* カテゴリ連動のおすすめ（未紐づけ分をワンクリック追加） */}
      {suggestions.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, flexWrap: 'wrap',
          px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(206,147,216,0.07)', border: '1px solid rgba(206,147,216,0.25)' }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: 'light-dark(#742e7f, #ce93d8)' }} />
          <Typography sx={{ fontSize: 11.5, color: 'light-dark(#742e7f, #ce93d8)', fontWeight: 700 }}>
            あなたのカテゴリに合いそうなメディア:
          </Typography>
          {suggestions.map(([name, matched]) => (
            <Tooltip key={name} title={`カテゴリ「${matched.join('・')}」に関連。クリックで紐づけ`}>
              <Chip label={`＋ ${name}`} size="small" onClick={() => void handleSaveSources([...(sources || []), name])}
                sx={{ cursor: 'pointer', height: 21, fontSize: 10.5, fontWeight: 700,
                  bgcolor: 'transparent', color: 'light-dark(#742e7f, #ce93d8)', border: '1px solid rgba(206,147,216,0.5)',
                  '&:hover': { bgcolor: 'rgba(206,147,216,0.15)' } }} />
            </Tooltip>
          ))}
        </Box>
      )}

      {/* グループタブ */}
      <Box sx={{ display: 'flex', gap: 0.75, mt: 2, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 📰⇄🎬 種別トグル（情報源ビューと対）: 記事メディア / YouTube（動画） */}
        {([['article', '📰 記事'], ['video', '🎬 動画']] as const).map(([key, label]) => (
          <Chip key={key} label={label} size="small"
            onClick={() => { setFeedKind(key); setGroup('すべて'); setSiteFilter(''); }}
            sx={{ cursor: 'pointer', fontWeight: 800, fontSize: 12, height: 26,
              bgcolor: feedKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
              color: feedKind === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.6)',
              border: `1px solid ${feedKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
              '&:hover': { bgcolor: feedKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
        ))}
        <Box sx={{ width: 6 }} />
        {/* 🌐 動画の言語絞り込み。「日本語」は日本語チャンネル＋日本語音声トラック（吹替）ありを含む */}
        {feedKind === 'video' && ([['all', 'すべて'], ['ja', '🇯🇵 日本語で聴ける'], ['original', '原語のみ']] as const).map(([key, label]) => (
          <Chip key={key} label={label} size="small"
            onClick={() => setVideoLang(key)}
            sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5,
              bgcolor: videoLang === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.05)',
              color: videoLang === key ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
              border: `1px solid ${videoLang === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
              '&:hover': { bgcolor: videoLang === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
        ))}
        {feedKind === 'article' && groupTabs.map((g) => (
          <Chip key={g} label={g} size="small"
            onClick={() => { setGroup(g); setSiteFilter(''); }}
            sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5,
              bgcolor: group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.05)',
              color: group === g ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
              border: `1px solid ${group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
              '&:hover': { bgcolor: group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
        ))}
        <Box sx={{ flex: 1, minWidth: 8 }} />
        {/* 並び順: 関心ワードランキング or ⭐関心度評価があれば「おすすめ順」を選べる。どちらも無ければ導線を出す */}
        {(interestKeywords.length > 0 || ratingProfile.count > 0) ? (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {([['reco', '★ おすすめ順'], ['new', '新着順']] as const).map(([key, label]) => (
              <Chip key={key} label={label} size="small"
                onClick={() => setSortMode(key)}
                sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11,
                  bgcolor: sortMode === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
                  color: sortMode === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                  border: `1px solid ${sortMode === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
                  '&:hover': { bgcolor: sortMode === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
            ))}
          </Box>
        ) : (
          <Chip label="★ 関心ワード設定 or 記事に★評価でおすすめ順に" size="small"
            onClick={() => setView('sources')}
            sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 10.5,
              bgcolor: 'transparent', color: `${ACCENT}`, border: `1px dashed ${ACCENT}66`,
              '&:hover': { bgcolor: 'rgba(229,115,115,0.1)' } }} />
        )}
      </Box>

      {/* 媒体フィルタ */}
      <Box sx={{ display: 'flex', gap: 0.6, mb: 1, flexWrap: 'wrap' }}>
        {groupSites.map((s) => {
          const on = siteFilter === s.name;
          return (
            <Tooltip key={s.name} title={s.note} arrow>
              <Chip label={s.name} size="small"
                onClick={() => setSiteFilter(on ? '' : s.name)}
                sx={{ cursor: 'pointer', fontSize: 10.5, height: 22,
                  bgcolor: on ? `hsl(${hueOf(s.name)},60%,55%)` : 'transparent',
                  color: on ? '#000' : `hsl(${hueOf(s.name)},60%,72%)`,
                  fontWeight: on ? 800 : 600,
                  border: `1px solid hsl(${hueOf(s.name)},60%,55%)`,
                  '&:hover': { bgcolor: on ? `hsl(${hueOf(s.name)},60%,55%)` : `hsl(${hueOf(s.name)},60%,55%,0.15)` } }} />
            </Tooltip>
          );
        })}
      </Box>

      {/* 👤 人物・会社フィルタ（設計者/デザイナー/企業名。辞書検出＋ユーザー追加のウォッチ名） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 2.5, flexWrap: 'wrap' }}>
        <Tooltip title="設計者・デザイナー・会社名で絞り込み。フィードのタイトルに登場する人物・会社を自動検出します">
          <PersonSearchRoundedIcon sx={{ fontSize: 15, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
        </Tooltip>
        {nameChips.map((c) => {
          const on = nameFilter === c.label;
          return (
            <Tooltip key={c.label} title={c.custom ? 'あなたのウォッチ名（クリックで絞り込み）' : `${c.kind}名で絞り込み`} arrow>
              <Chip label={c.label} size="small"
                onClick={() => setNameFilter(on ? '' : c.label)}
                onDelete={c.custom ? () => void handleRemoveName(c.label) : undefined}
                sx={{ cursor: 'pointer', fontSize: 10.5, height: 22,
                  bgcolor: on ? `hsl(${hueOf(c.label)},45%,60%)` : 'transparent',
                  color: on ? '#000' : `hsl(${hueOf(c.label)},45%,72%)`,
                  fontWeight: on ? 800 : 600,
                  border: `1px ${c.custom ? 'dashed' : 'solid'} hsl(${hueOf(c.label)},45%,60%)`,
                  '& .MuiChip-deleteIcon': { fontSize: 14, color: on ? '#000' : `hsl(${hueOf(c.label)},45%,72%)` },
                  '&:hover': { bgcolor: on ? `hsl(${hueOf(c.label)},45%,60%)` : `hsl(${hueOf(c.label)},45%,60%,0.15)` } }} />
            </Tooltip>
          );
        })}
        {addingName ? (
          <TextField autoFocus size="small" value={nameInput} placeholder="人物・会社名"
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing) { e.preventDefault(); void handleAddName(nameInput); }
              if (e.key === 'Escape') { setAddingName(false); setNameInput(''); }
            }}
            onBlur={() => void handleAddName(nameInput)}
            sx={{ width: 150, '& .MuiOutlinedInput-root': { height: 24, fontSize: 11, color: 'var(--brand-fg)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }} />
        ) : (
          <Tooltip title="気になる設計者・デザイナー・会社名を追加（保存され、次回以降も使えます）">
            <Chip label="＋人物・会社を追加" size="small" onClick={() => setAddingName(true)}
              sx={{ cursor: 'pointer', fontSize: 10.5, height: 22, fontWeight: 600,
                bgcolor: 'transparent', color: 'rgb(var(--brand-fg-rgb) / 0.45)',
                border: '1px dashed rgb(var(--brand-fg-rgb) / 0.25)',
                '&:hover': { color: ACCENT, borderColor: `${ACCENT}88` } }} />
          </Tooltip>
        )}
      </Box>

      {/* フィード */}
      {sources.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <RssFeedRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.2)', mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 2 }}>
            メディアが紐づけられていません。おすすめから選んで記事を表示しましょう。
          </Typography>
          <Button variant="outlined" size="small" startIcon={<RssFeedRoundedIcon />}
            onClick={() => setManageOpen(true)}
            sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none' }}>
            メディアを選んで紐づける
          </Button>
        </Box>
      ) : loading && items.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 1.5 }}>
          <CircularProgress size={26} sx={{ color: ACCENT }} />
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>各メディアの最新記事を取得中…</Typography>
        </Box>
      ) : error && items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 2 }}>{error}</Typography>
          <Button onClick={() => void load(true)} variant="outlined" size="small"
            sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none' }}>再試行</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
          {displayed.map((it, i) => {
            const meta = siteMeta.get(it.source);
            return (
              <Box key={`${it.url}-${i}`}
                sx={{ borderRadius: 2.5, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', transition: 'border-color .15s, transform .15s',
                  '&:hover': { borderColor: `${ACCENT}66`, transform: 'translateY(-2px)' },
                  '&:hover .feed-actions': { opacity: 1 } }}>
                {/* サムネイル（RSSから取得できた媒体のみ。クリックで記事へ） */}
                {it.image && (
                  <Box component="img" src={it.image} alt="" loading="lazy"
                    onClick={() => openArticle(it)}
                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                    sx={{ width: '100%', height: 150, objectFit: 'cover', cursor: 'pointer', display: 'block',
                      borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }} />
                )}
                <Box sx={{ p: 1.75, pt: 1.25, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                {/* 媒体バッジ + 日付 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={it.source || 'Web'} size="small"
                    sx={{ height: 18, fontSize: 10, fontWeight: 800,
                      bgcolor: `hsl(${hueOf(it.source)},60%,55%,0.16)`,
                      color: `hsl(${hueOf(it.source)},60%,72%)`,
                      border: `1px solid hsl(${hueOf(it.source)},60%,55%,0.4)` }} />
                  {meta?.lang === 'en' && (
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.35)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', px: 0.5, borderRadius: 0.75 }}>EN</Typography>
                  )}
                  {/(youtube\.com|youtu\.be)\//.test(it.url) && (
                    <Tooltip title="YouTube動画。Readerで再生しながら日本語字幕で観られます（記事表示・読み上げ・AI議論も可）">
                      <Chip label="🎬 動画" size="small"
                        sx={{ height: 18, fontSize: 10, fontWeight: 800,
                          bgcolor: 'rgba(229,115,115,0.12)', color: 'light-dark(#921b1b, #ef9a9a)',
                          border: '1px solid rgba(229,115,115,0.4)' }} />
                    </Tooltip>
                  )}
                  {feedKind === 'video' && meta?.lang !== 'ja' && jaAudioMap[getYouTubeId(it.url)] && (
                    <Tooltip title="日本語音声トラック（吹替）あり。プレイヤーが自動で日本語音声を選びます">
                      <Chip label="🇯🇵 日本語音声" size="small"
                        sx={{ height: 18, fontSize: 10, fontWeight: 800,
                          bgcolor: 'rgba(129,199,132,0.14)', color: 'light-dark(#2e7d32, #a5d6a7)',
                          border: '1px solid rgba(129,199,132,0.4)' }} />
                    </Tooltip>
                  )}
                  {ratedMap.has(it.url) && (
                    <Tooltip title={`あなたの関心度評価 ★${ratedMap.get(it.url)!.rating}（Readerで変更できます）。おすすめ順に反映されます`}>
                      <Chip label={`★${ratedMap.get(it.url)!.rating}`} size="small"
                        sx={{ height: 18, fontSize: 10, fontWeight: 800,
                          bgcolor: 'rgba(255,215,64,0.12)', color: 'light-dark(#ad8900, #ffd740)',
                          border: '1px solid rgba(255,215,64,0.4)' }} />
                    </Tooltip>
                  )}
                  {savedUrls.has(it.url) && (
                    <Tooltip title="S.Library に知識として追加済みの記事です">
                      <Chip icon={<BookmarkAddedRoundedIcon sx={{ fontSize: '12px !important' }} />} label="追加済み" size="small"
                        sx={{ height: 18, fontSize: 10, fontWeight: 800,
                          bgcolor: 'rgba(129,199,132,0.14)', color: 'rgb(var(--brand-fg-rgb) / 0.65)',
                          border: '1px solid rgba(129,199,132,0.4)',
                          '& .MuiChip-icon': { color: 'rgb(var(--brand-fg-rgb) / 0.65)' } }} />
                    </Tooltip>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{fmtDate(it.date)}</Typography>
                </Box>
                {/* タイトル（クリックで元記事へ） */}
                <Typography onClick={() => openArticle(it)}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.88)', fontWeight: 700, fontSize: 13, lineHeight: 1.55, cursor: 'pointer', flex: 1,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    '&:hover': { color: 'var(--brand-fg)', textDecoration: 'underline', textDecorationColor: `${ACCENT}88` } }}>
                  {it.title}
                </Typography>
                {/* アクション */}
                <Box className="feed-actions" sx={{ display: 'flex', gap: 0.75, opacity: { xs: 1, md: 0.55 }, transition: 'opacity .15s' }}>
                  <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
                    onClick={() => openArticle(it)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', fontSize: 11, px: 1, minWidth: 0, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                    記事を読む
                  </Button>
                  {!official && (
                    <Button size="small" startIcon={<ForumRoundedIcon sx={{ fontSize: '13px !important' }} />}
                      onClick={() => discussAndWrite(it)}
                      sx={{ color: ACCENT, textTransform: 'none', fontSize: 11, px: 1, minWidth: 0, fontWeight: 700,
                        '&:hover': { bgcolor: `${ACCENT}1a` } }}>
                      AIと議論して書く
                    </Button>
                  )}
                </Box>
                </Box>
              </Box>
            );
          })}
          {displayed.length === 0 && (
            <Typography sx={{ gridColumn: '1/-1', textAlign: 'center', py: 6, fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              この条件の記事はありません。
            </Typography>
          )}
        </Box>
      )}

      {/* 取り扱い注意の明記 */}
      <Typography sx={{ mt: 3, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.3)', textAlign: 'center', lineHeight: 1.7 }}>
        表示はあなたが紐づけたメディアの RSS 公開情報（タイトル・リンク・サムネイル）に基づきます。記事の著作権は各メディアに帰属します。<br />
        記事を書く際は要約・引用の範囲で、出典リンクが自動で付きます。
      </Typography>
      </>
      )}

      {/* ソース管理は左サイドバー「ソース記事」ビュー（BlogSourcesView）へ移設したためダイアログは廃止。 */}
    </Box>
  );
};
