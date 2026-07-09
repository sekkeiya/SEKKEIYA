/**
 * BlogNewsFeed — S.Blog ホーム。おすすめの建築・インテリアメディアの最新記事フィード。
 *
 * 著作権の取り扱いに配慮し、本文は一切転載しない。S.Library の Web記事一覧と同じく
 * タイトル / 媒体名 / 日付のカードだけを表示し、クリックで元記事（既定ブラウザ）へ。
 * 各カードの「AIと議論して書く」→ 記事を題材にエディタを開き（議論ファースト）、
 * 記事を読みながらAIと議論 → 議論を踏まえてAIが記事を生成する。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, CircularProgress, IconButton, Tooltip, Button, Dialog, DialogContent, TextField } from '@mui/material';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded';
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
import { loadBlogFeedSources, saveBlogFeedSources, loadCustomFeedSources, saveCustomFeedSources, loadBlogNameFilters, saveBlogNameFilters } from './api/blogApi';
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

const GROUPS = ['すべて', '国内・建築/デザイン', '国内・住まい/インテリア', '海外・トレンド'] as const;

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
  const [manageOpen, setManageOpen] = useState(false);
  const categories = useDsbStore((s) => s.categories);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void Promise.all([loadBlogFeedSources(uid), loadCustomFeedSources(uid), loadBlogNameFilters(uid)])
      .then(([s, customs, names]) => { if (alive) { setCustomSources(customs); setSources(s); setCustomNames(names); } })
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
      const r: any = await fn({
        mode: 'feed',
        sites: sites.map((s) => ({ name: s.name, feed: s.feed })),
        perSite: 8,
      });
      if (r.data?.success && Array.isArray(r.data.feeds)) {
        const all: FeedItem[] = r.data.feeds.flatMap((f: any) => (Array.isArray(f.items) ? f.items : []));
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
        setError(r.data?.reason || 'フィードを取得できませんでした');
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

  const dueThisWeek = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(); limit.setDate(limit.getDate() + 7);
    const week = limit.toISOString().slice(0, 10);
    return schedules
      .filter((s) => s.status === 'planned' && s.date <= week)
      .map((s) => ({ ...s, overdue: s.date < today }))
      .slice(0, 3);
  }, [schedules]);

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

  // 予定を「実行」: カテゴリに合う記事があればリーダーで開いて読み上げ開始（→議論へ）、なければそのカテゴリで新規記事
  const startScheduleItem = (s: { title: string; category?: string | null }) => {
    const rec = recommendSourcesForCategories([s.category || ''], allSites);
    const match = items.find((it) => rec.has(it.source));
    if (match) {
      try {
        localStorage.setItem('sblog-reader-playlist', JSON.stringify({
          at: Date.now(),
          items: items.filter((f) => rec.has(f.source)).map((f) => ({ title: f.title, url: f.url, source: f.source, image: f.image || '' })),
        }));
      } catch { /* noop */ }
      void openReader(match.url, match.title, match.source, { autoRead: true });
    } else if (uid) {
      startNew(uid, displayName, s.category || undefined);
    }
  };

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

  // グループタブ（カスタムメディアを購読していれば「カスタム」タブも出す）
  const groupTabs = useMemo(
    () => (subscribedSites.some((s) => s.group === 'カスタム') ? [...GROUPS, 'カスタム'] : [...GROUPS]),
    [subscribedSites],
  );

  const groupSites = useMemo(
    () => subscribedSites.filter((s) => group === 'すべて' || s.group === group),
    [group, subscribedSites],
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

  const filtered = useMemo(() => items.filter((it) => {
    const meta = siteMeta.get(it.source);
    if (group !== 'すべて' && meta?.group !== group) return false;
    if (siteFilter && it.source !== siteFilter) return false;
    if (nameFilter) {
      const aliases = nameChips.find((c) => c.label === nameFilter)?.aliases ?? [nameFilter];
      if (!aliases.some((a) => titleMatchesAlias(it.title, a))) return false;
    }
    return true;
  }), [items, group, siteFilter, siteMeta, nameFilter, nameChips]);

  // 記事を SEKKEIYA Reader で開く。開く前に表示中の並びをプレイリストとして保存し、
  // Reader 側の連続読み上げ（読了→次の記事へ自動遷移）に使う。
  const openArticle = (it: FeedItem) => {
    try {
      localStorage.setItem('sblog-reader-playlist', JSON.stringify({
        at: Date.now(),
        items: filtered.map((f) => ({ title: f.title, url: f.url, source: f.source, image: f.image || '' })),
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
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${ACCENT}22`, border: `1px solid ${ACCENT}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NewspaperRoundedIcon sx={{ fontSize: 19, color: ACCENT }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.2 }}>ホーム</Typography>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            建築・インテリアの気になる記事から、AIと議論してあなたの記事を書けます
          </Typography>
        </Box>
        <Tooltip title="表示するメディアを選ぶ（紐づけの追加・解除）">
          <span>
            <IconButton onClick={() => setManageOpen(true)} disabled={!uid || sources === undefined}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: ACCENT } }}>
              <RssFeedRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="フィードを更新">
          <span>
            <IconButton onClick={() => void load(true)} disabled={loading} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: ACCENT } }}>
              <RefreshRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

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
      {/* 今週書くもの（投稿スケジュール連携。実行で 記事表示→読み上げ→AI議論 が始まる） */}
      {!official && dueThisWeek.length > 0 && (
        <Box sx={{ mt: 1.5, px: 1.5, py: 1.25, borderRadius: 2, bgcolor: 'rgba(229,115,115,0.06)', border: `1px solid ${ACCENT}44` }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, mb: 0.75 }}>
            ✍ 今週書くもの
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {dueThisWeek.map((s) => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 10.5, color: s.overdue ? 'light-dark(#961818, #ef9a9a)' : 'rgb(var(--brand-fg-rgb) / 0.45)', width: 96, flexShrink: 0 }}>
                  {s.overdue ? '期限超過' : `${s.date.slice(5).replace('-', '/')}${s.time ? ` ${s.time}` : ''}`}
                </Typography>
                <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)', flex: 1, minWidth: 0 }}>{s.title}</Typography>
                {s.category && (
                  <Chip label={s.category} size="small" sx={{ height: 18, fontSize: 10, bgcolor: `${ACCENT}22`, color: 'var(--brand-fg)', flexShrink: 0 }} />
                )}
                <Button size="small" variant="outlined" onClick={() => startScheduleItem(s)}
                  sx={{ color: ACCENT, borderColor: `${ACCENT}55`, textTransform: 'none', fontSize: 11, px: 1.25, py: 0, flexShrink: 0,
                    '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}14` } }}>
                  実行
                </Button>
              </Box>
            ))}
          </Box>
        </Box>
      )}

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
      <Box sx={{ display: 'flex', gap: 0.75, mt: 2, mb: 1, flexWrap: 'wrap' }}>
        {groupTabs.map((g) => (
          <Chip key={g} label={g} size="small"
            onClick={() => { setGroup(g); setSiteFilter(''); }}
            sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5,
              bgcolor: group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.05)',
              color: group === g ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
              border: `1px solid ${group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
              '&:hover': { bgcolor: group === g ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
        ))}
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
          {filtered.map((it, i) => {
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
          {filtered.length === 0 && (
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

      {/* ソース管理ダイアログ（紐づけの追加・解除） */}
      <Dialog open={manageOpen} onClose={() => !sourcesSaving && setManageOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3 } }}>
        <DialogContent sx={{ p: 3 }}>
          <FeedSourcePicker categories={categories} current={sources ?? []} customSources={customSources} saving={sourcesSaving}
            onSave={(n) => void handleSaveSources(n)} onCancel={() => setManageOpen(false)}
            onAddCustom={handleAddCustom} onRemoveCustom={(n) => void handleRemoveCustom(n)} />
        </DialogContent>
      </Dialog>
    </Box>
  );
};
