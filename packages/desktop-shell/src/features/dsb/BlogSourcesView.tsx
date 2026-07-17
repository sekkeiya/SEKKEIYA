/**
 * BlogSourcesView — 「ソース記事」ビュー。
 * ホーム(feed)に表示するメディア（RSSソース）をユーザー自身が選んで紐づける全画面。
 * これまで BlogNewsFeed の「表示するメディアを選ぶ」ダイアログにあった中身を、
 * 左サイドバー「ソース記事」から開くメインエリアの独立ビューへ格上げしたもの。
 *
 * 右サイドバー: カテゴリ（建築/インテリア/デザイン/…）で表示メディアを絞り込む。
 * さらに常時表示のヘッダー検索（feedSearch）でもメディアを絞る。
 * 新しいメディアは増やさない（RSS破損リスク回避）— 既存プールに対する絞り込みのみ。
 *
 * ソースの永続化はバックエンド（uid キー）が真実。保存したら feed へ戻り、
 * feed 側は再マウント時に最新ソースを読み直してフィードを更新する。
 */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Box, Typography, CircularProgress, Button, Checkbox, InputBase, IconButton, Tooltip, Dialog, DialogContent, Chip } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEFAULT_SOURCE_SITES, recommendSourcesForCategories, type BlogSourceSite } from './types';
import { SOURCE_CATEGORIES, siteMatchesCategory, siteMatchesSub, categorizeKeyword, type SourceCategory } from './sourceCategories';
import {
  loadBlogFeedSources, saveBlogFeedSources,
  loadCustomFeedSources, saveCustomFeedSources,
  loadBlogInterestKeywords, saveBlogInterestKeywords,
  discoverBlogMedia, type DiscoveredMedia,
  suggestInterestKeywords, analyzeMediaContent, type MediaAnalysis,
  interestChat, type InterestChatOp,
  loadMediaMeta,
} from './api/blogApi';
import { openReader } from './lib/openReader';
import { FeedSourcePicker } from './FeedSourcePicker';

const ACCENT = '#e57373';
const AI_PURPLE = '#ce93d8';
// カード用 AI メタ（内容タグ）のローカルキャッシュ。媒体は共通なので端末内で使い回す。
const META_KEY = 'sblog-media-meta-v1';
const META_TTL = 14 * 24 * 3600 * 1000;

export const BlogSourcesView: React.FC = () => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const categories = useDsbStore((s) => s.categories);
  const setView = useDsbStore((s) => s.setView);
  const feedSearch = useDsbStore((s) => s.feedSearch);

  // undefined=読込中 / null=未選択（おすすめ提示） / string[]=選択済み
  const [sources, setSources] = useState<string[] | null | undefined>(undefined);
  const [customSources, setCustomSources] = useState<BlogSourceSite[]>([]);
  const [saving, setSaving] = useState(false);

  // 右サイドバーの絞り込み状態（複数選択）
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  // サブトピックは `${catKey}:${subKey}` で名前空間化して保持
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

  // Phase 2: AI によるメディア候補検索
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DiscoveredMedia[]>([]);
  const [pickedCand, setPickedCand] = useState<Set<string>>(new Set());

  // 関心ワードランキング（並び＝順位）。おすすめ記事の並び替えと AI メディア検索の両方に効く。
  const [interestKeywords, setInterestKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  // メインエリアの表示切替: メディア選択 ⇄ セマンティックグラフ（関心ワードのカテゴリ別バブルマップ）
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void Promise.all([loadBlogFeedSources(uid), loadCustomFeedSources(uid), loadBlogInterestKeywords(uid)])
      .then(([s, customs, kws]) => { if (alive) { setCustomSources(customs); setSources(s); setInterestKeywords(kws); } })
      .catch(() => { if (alive) setSources(null); });
    return () => { alive = false; };
  }, [uid]);

  // 関心ワードの更新（並び替え/追加/削除）。楽観更新＋バックエンド保存（失敗はログのみ）。
  const updateKeywords = (next: string[]) => {
    setInterestKeywords(next);
    if (uid) void saveBlogInterestKeywords(uid, next).catch((e) => console.error('[BlogSourcesView] save interest keywords failed', e));
  };
  const addKeyword = () => {
    const w = kwInput.trim();
    if (!w) return;
    if (interestKeywords.some((k) => k.toLowerCase() === w.toLowerCase())) { setKwInput(''); return; }
    updateKeywords([...interestKeywords, w].slice(0, 20));
    setKwInput('');
  };
  // 手動の微調整: グラフのバブルにホバーで ✕ 削除（順位変更はチャット経由）。
  const removeKeywordByWord = (word: string) => {
    updateKeywords(interestKeywords.filter((k) => k !== word));
  };

  // ── 関心を深めるチャット（グラフ表示時の右サイドバー） ───────────────────
  // AI の返答に含まれる ops（追加/削除/順位変更）をランキングへ適用し、グラフへ即時反映する。
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'ai'; text: string; note?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const applyChatOps = (ops: InterestChatOp[]): string | undefined => {
    if (!ops.length) return undefined;
    let next = [...interestKeywords];
    const notes: string[] = [];
    for (const o of ops) {
      const idx = next.findIndex((k) => k.toLowerCase() === o.word.toLowerCase());
      if (o.op === 'add' && idx < 0) {
        const at = o.rank && o.rank >= 1 ? Math.min(o.rank - 1, next.length) : next.length;
        next.splice(at, 0, o.word);
        notes.push(`＋${o.word}（${at + 1}位）`);
      } else if (o.op === 'remove' && idx >= 0) {
        next.splice(idx, 1);
        notes.push(`−${o.word}`);
      } else if (o.op === 'move' && idx >= 0 && o.to && o.to >= 1) {
        const [w] = next.splice(idx, 1);
        const at = Math.min(o.to - 1, next.length);
        next.splice(at, 0, w);
        notes.push(`${o.word}→${at + 1}位`);
      }
    }
    next = next.slice(0, 20);
    if (notes.length) { updateKeywords(next); return notes.join(' / '); }
    return undefined;
  };
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const nextMsgs = [...chatMsgs, { role: 'user' as const, text }];
    setChatMsgs(nextMsgs);
    setChatInput('');
    setChatBusy(true);
    try {
      const { reply, ops } = await interestChat(
        nextMsgs.map((m) => ({ role: m.role, text: m.text })),
        interestKeywords, categories,
      );
      const note = applyChatOps(ops);
      setChatMsgs((prev) => [...prev, { role: 'ai', text: reply, note }]);
    } catch (e: any) {
      setChatMsgs((prev) => [...prev, { role: 'ai', text: e?.message || '応答に失敗しました。時間をおいて再試行してください。' }]);
    } finally {
      setChatBusy(false);
    }
  };

  // AIで関心ワードを自動生成: ブログのカテゴリ＋購読メディアの最近タイトルから抽出し、
  // 既存ランキングに無いものを追記（手動で最終調整できるよう既存の順位は保持）。
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const runSuggestKeywords = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const subscribed = pool
        .filter((s) => (sources || []).includes(s.name))
        .map((s) => ({ name: s.name, feed: s.feed }));
      const kws = await suggestInterestKeywords(categories, subscribed);
      const lower = new Set(interestKeywords.map((k) => k.toLowerCase()));
      const merged = [...interestKeywords, ...kws.filter((k) => !lower.has(k.toLowerCase()))].slice(0, 20);
      updateKeywords(merged);
      if (kws.length === 0) setSuggestError('候補を生成できませんでした。');
    } catch (e: any) {
      setSuggestError(e?.message || 'AI生成に失敗しました');
    } finally {
      setSuggesting(false);
    }
  };

  // メディア内容傾向ダイアログ（FeedSourcePicker の情報アイコンから開く）
  const [analyzeSite, setAnalyzeSite] = useState<{ name: string; feed: string } | null>(null);
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [mediaMeta, setMediaMeta] = useState<Record<string, { keywords: string[]; tone: string; at: number }>>(() => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
  });
  const openAnalyze = async (site: BlogSourceSite) => {
    setAnalyzeSite({ name: site.name, feed: site.feed });
    setAnalysis(null);
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const a = await analyzeMediaContent(site.name, site.feed);
      setAnalysis(a);
      // カード用メタも更新・キャッシュ（詳細を開いたら即カードに反映）
      setMediaMeta((prev) => {
        const next = { ...prev, [site.feed]: { keywords: a.keywords, tone: a.tone, at: Date.now() } };
        try { localStorage.setItem(META_KEY, JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
    } catch (e: any) {
      setAnalyzeError(e?.message || '分析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  // カードに出す内容タグ用の AI メタ（トーン＋キーワード）。localStorage に永続化し、
  // 未取得のものはバックグラウンドで analyzeMedia を呼んで順次埋める（媒体ごと1回・14日キャッシュ）。
  const metaOf = useCallback((site: BlogSourceSite) => {
    const m = mediaMeta[site.feed];
    return m ? { keywords: m.keywords, tone: m.tone } : undefined;
  }, [mediaMeta]);
  const analyzingRef = useRef<Set<string>>(new Set());

  const handleSave = async (names: string[]) => {
    if (!uid) return;
    setSaving(true);
    try {
      await saveBlogFeedSources(uid, names);
      setSources(names);
      // 保存したらホームへ戻る（feed が再マウントされ最新ソースで再取得）。
      setView('feed');
    } catch (e) {
      console.error('[BlogSourcesView] save feed sources failed', e);
    } finally {
      setSaving(false);
    }
  };

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
      if (sources?.includes(name)) {
        const nextSources = sources.filter((n) => n !== name);
        await saveBlogFeedSources(uid, nextSources);
        setSources(nextSources);
      }
    } catch (e) {
      console.error('[BlogSourcesView] remove custom source failed', e);
    }
  };

  // 絞り込み対象の全プール（既存メディア＋カスタム）。空カテゴリ判定にも使う。
  const pool = useMemo(() => [...DEFAULT_SOURCE_SITES, ...customSources], [customSources]);

  // バックエンドの共有キャッシュ（Firestore・媒体ごと1回だけ分析）からバッチ取得。
  // 端末に無い/古いものだけを要求し、未処理は pending が 0 になるまで数回に分けて埋める。
  useEffect(() => {
    if (sources === undefined || showGraph) return;
    const now = Date.now();
    const stale = pool.filter((s) =>
      /^https?:\/\//.test(s.feed) &&
      !analyzingRef.current.has(s.feed) &&
      (!mediaMeta[s.feed] || now - mediaMeta[s.feed].at > META_TTL));
    if (stale.length === 0) return;
    stale.forEach((t) => analyzingRef.current.add(t.feed));
    let cancelled = false;
    void (async () => {
      let remaining = stale;
      let iter = 0;
      while (remaining.length && iter < 6 && !cancelled) {
        let res;
        try { res = await loadMediaMeta(remaining.map((s) => ({ name: s.name, feed: s.feed }))); }
        catch { return; }
        if (cancelled) return;
        const gotFeeds = Object.keys(res.meta);
        if (gotFeeds.length) {
          setMediaMeta((prev) => {
            const next = { ...prev };
            for (const feed of gotFeeds) next[feed] = { keywords: res.meta[feed].keywords, tone: res.meta[feed].tone, at: Date.now() };
            try { localStorage.setItem(META_KEY, JSON.stringify(next)); } catch { /* noop */ }
            return next;
          });
        }
        remaining = remaining.filter((s) => !res.meta[s.feed]);
        if (res.pending === 0 && (remaining.length === 0 || gotFeeds.length === 0)) break;
        iter++;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, sources, showGraph]);

  // どのカテゴリが現在のプールで0件か（＝準備中として淡色表示）
  const emptyCats = useMemo(() => {
    const empty = new Set<string>();
    for (const cat of SOURCE_CATEGORIES) {
      if (!pool.some((s) => siteMatchesCategory(s, cat))) empty.add(cat.key);
    }
    return empty;
  }, [pool]);

  const toggleCat = (key: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // カテゴリを外したら、その配下サブ選択も解除
        setSelectedSubs((subs) => {
          const ns = new Set(subs);
          for (const s of ns) if (s.startsWith(`${key}:`)) ns.delete(s);
          return ns;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSub = (catKey: string, subKey: string) => {
    const ns = `${catKey}:${subKey}`;
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns); else next.add(ns);
      return next;
    });
  };

  const resetFilter = () => { setSelectedCats(new Set()); setSelectedSubs(new Set()); };

  // AIにおまかせで紐づける（FeedSourcePicker から右サイドバーへ移設）:
  // ブログのカテゴリに合うおすすめメディアを自動選択して即保存（合致が無ければおすすめ全件）。
  const handleAutoLink = () => {
    const all = [...DEFAULT_SOURCE_SITES, ...customSources];
    const rec = recommendSourcesForCategories(categories, all);
    const names = rec.size > 0 ? [...rec.keys()] : DEFAULT_SOURCE_SITES.map((s) => s.name);
    void handleSave(names);
  };

  // メディア絞り込み: (カテゴリ未選択→全通過) OR (選択カテゴリのいずれかに合致 かつ、
  // そのカテゴリでサブが選択されていれば、そのカテゴリの選択サブに1つ以上合致)。
  // さらに常時検索 feedSearch（name/note/keywords）にも合致すること。
  // 📰/🎬 情報源の種別トグル: 記事メディアと YouTube（動画）チャンネルを同じ画面で切り替える
  const [sourceKind, setSourceKind] = useState<'article' | 'video'>('article');
  const isVideoSite = (site: BlogSourceSite): boolean =>
    site.group === '動画（YouTube）' || site.feed.includes('youtube.com/feeds');

  const siteFilter = useMemo(() => {
    const search = feedSearch.trim().toLowerCase();
    const cats = SOURCE_CATEGORIES.filter((c) => selectedCats.has(c.key));
    return (site: BlogSourceSite): boolean => {
      // 種別トグル（記事 ⇄ 動画）
      if (isVideoSite(site) !== (sourceKind === 'video')) return false;
      // ヘッダー検索
      if (search) {
        const hay = [site.name, site.note, ...(site.keywords || [])].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      // カテゴリ未選択なら検索のみで判定
      if (cats.length === 0) return true;
      // いずれかの選択カテゴリを満たすか
      return cats.some((cat) => {
        if (!siteMatchesCategory(site, cat)) return false;
        const selSubs = cat.subs.filter((sub) => selectedSubs.has(`${cat.key}:${sub.key}`));
        if (selSubs.length === 0) return true; // このカテゴリでサブ未選択→カテゴリ一致でOK
        return selSubs.some((sub) => siteMatchesSub(site, sub));
      });
    };
  }, [feedSearch, selectedCats, selectedSubs, sourceKind]);

  // ヘッダー検索語に一致する用意済みメディア数（AI検索導線バナーの表示判断に使う）
  const searchMatchCount = useMemo(
    () => (feedSearch.trim() ? pool.filter(siteFilter).length : 0),
    [feedSearch, pool, siteFilter]);

  // 選択中カテゴリ/サブのラベルを「関心」に。未選択なら関心ワードランキング上位、
  // それも無ければブログのカテゴリを使う（優先順: 明示選択 > 関心ワード > カテゴリ）。
  const interests = useMemo(() => {
    const cats = SOURCE_CATEGORIES.filter((c) => selectedCats.has(c.key));
    const labels: string[] = [];
    for (const c of cats) {
      labels.push(c.label);
      for (const sub of c.subs) if (selectedSubs.has(`${c.key}:${sub.key}`)) labels.push(sub.label);
    }
    if (labels.length > 0) return labels;
    if (interestKeywords.length > 0) return interestKeywords.slice(0, 8);
    return categories;
  }, [selectedCats, selectedSubs, categories, interestKeywords]);

  // セマンティックグラフ用: 関心ワードをカテゴリごとにクラスタリング（taxonomy=SSOTで自動分類）。
  // 各クラスタに「購読中の関連メディア件数」も添えて、関心→ソースの繋がりを可視化する。
  const graphClusters = useMemo(() => {
    const groups = new Map<string, { label: string; cat: SourceCategory | null; words: { word: string; rank: number }[] }>();
    interestKeywords.forEach((w, i) => {
      const cat = categorizeKeyword(w);
      const key = cat?.key ?? 'other';
      if (!groups.has(key)) groups.set(key, { label: cat?.label ?? 'その他', cat, words: [] });
      groups.get(key)!.words.push({ word: w, rank: i });
    });
    const order = [...SOURCE_CATEGORIES.map((c) => c.key), 'other'];
    return order.filter((k) => groups.has(k)).map((k, idx) => {
      const g = groups.get(k)!;
      const mediaCount = g.cat
        ? pool.filter((s) => (sources || []).includes(s.name) && siteMatchesCategory(s, g.cat!)).length
        : 0;
      return { key: k, ...g, mediaCount, hue: (idx * 47 + 8) % 360 };
    });
  }, [interestKeywords, pool, sources]);


  // AIメディア検索。explicitInterests を渡すとそれを優先（ヘッダー検索語での指名検索用）。
  const runDiscover = async (explicitInterests?: string[]) => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const exclude = pool.map((s) => s.name);
      const found = await discoverBlogMedia(explicitInterests?.length ? explicitInterests : interests, exclude);
      setCandidates(found);
      setPickedCand(new Set());
      if (found.length === 0) setDiscoverError('候補が見つかりませんでした。関心を変えて再検索してください。');
    } catch (e: any) {
      setDiscoverError(e?.message || 'AI検索に失敗しました');
    } finally {
      setDiscovering(false);
    }
  };

  // 候補を「カスタムメディア」として追加＋購読に紐づけ（手動選択 or 全部おまかせ）。
  const linkCandidates = async (list: DiscoveredMedia[]) => {
    if (!uid || list.length === 0) return;
    const existing = new Set(customSources.map((s) => s.name.toLowerCase()));
    const toAdd: BlogSourceSite[] = list
      .filter((c) => !existing.has(c.name.toLowerCase()))
      .map((c) => ({ name: c.name, feed: c.feed, group: 'カスタム' as const, note: c.note, lang: c.lang, keywords: c.category ? [c.category] : [] }));
    const nextCustom = [...customSources, ...toAdd];
    const nextSources = [...new Set([...(sources || []), ...list.map((c) => c.name)])];
    try {
      await saveCustomFeedSources(uid, nextCustom);
      await saveBlogFeedSources(uid, nextSources);
      setCustomSources(nextCustom);
      setSources(nextSources);
      const added = new Set(list.map((c) => c.name));
      setCandidates((prev) => prev.filter((c) => !added.has(c.name)));
      setPickedCand(new Set());
    } catch (e) {
      console.error('[BlogSourcesView] link candidates failed', e);
    }
  };

  const renderCategoryRow = (cat: SourceCategory) => {
    const on = selectedCats.has(cat.key);
    const empty = emptyCats.has(cat.key);
    return (
      <Box key={cat.key} sx={{ mb: 0.25 }}>
        <Box onClick={() => toggleCat(cat.key)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.6, borderRadius: 1.5, cursor: 'pointer',
            opacity: empty ? 0.4 : 1,
            bgcolor: on ? 'rgba(229,115,115,0.12)' : 'transparent',
            border: `1px solid ${on ? `${ACCENT}66` : 'transparent'}`,
            transition: 'background-color .12s, border-color .12s',
            '&:hover': { bgcolor: on ? 'rgba(229,115,115,0.16)' : 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: on ? 800 : 600,
            color: on ? ACCENT : 'var(--brand-fg)', flex: 1 }}>
            {cat.label}
          </Typography>
          {empty && (
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)', px: 0.5, borderRadius: 0.75, flexShrink: 0 }}>
              準備中
            </Typography>
          )}
        </Box>
        {on && cat.subs.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 1.25, pr: 0.5, py: 0.5 }}>
            {cat.subs.map((sub) => {
              const subOn = selectedSubs.has(`${cat.key}:${sub.key}`);
              return (
                <Box key={sub.key} onClick={() => toggleSub(cat.key, sub.key)}
                  sx={{ px: 0.9, py: 0.3, borderRadius: 3, cursor: 'pointer', fontSize: 11, lineHeight: 1.4,
                    fontWeight: subOn ? 800 : 600,
                    color: subOn ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                    bgcolor: subOn ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.06)',
                    border: `1px solid ${subOn ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                    transition: 'background-color .12s, border-color .12s',
                    '&:hover': { borderColor: subOn ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.28)' } }}>
                  {sub.label}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', bgcolor: 'background.default' }}>
      {/* メイン: メディア選択（絞り込み適用後） */}
      <Box sx={{ flex: 1, height: '100%', overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
          {sources === undefined ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : showGraph ? (
            /* ── セマンティックグラフ: 関心ワードをカテゴリ別クラスタで大きく可視化 ── */
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BubbleChartRoundedIcon sx={{ color: ACCENT }} /> 関心ワードのセマンティックグラフ
                </Typography>
                <Button size="small" variant="outlined" startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => setShowGraph(false)}
                  sx={{ textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.7)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}>
                  メディア選択に戻る
                </Button>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 3, lineHeight: 1.7 }}>
                円が大きいほど順位が高い関心ワードです。カテゴリごとにまとまり、各カテゴリの購読メディア数も表示します。
                この分布がホームの「おすすめ順」とAIメディア検索の精度を決めます。
              </Typography>
              {interestKeywords.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 1.5 }}>
                  <BubbleChartRoundedIcon sx={{ fontSize: 56, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    まだ関心ワードがありません
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    右のチャットでAIと話すか、「AIで関心ワードを自動生成」を押すと、ここに分布グラフが育っていきます。
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
                  {graphClusters.map((cl) => {
                    const n = interestKeywords.length;
                    return (
                      <Box key={cl.key} sx={{ flex: '1 1 280px', minWidth: 260, p: 2.5, borderRadius: 3,
                        border: `1px solid hsl(${cl.hue}, 55%, 55%, 0.45)`, bgcolor: `hsl(${cl.hue}, 55%, 55%, 0.06)` }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: `hsl(${cl.hue}, 62%, 68%)` }}>
                            {cl.label}
                          </Typography>
                          {cl.cat && (
                            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', whiteSpace: 'nowrap' }}>
                              購読メディア {cl.mediaCount} 件
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                          {cl.words.map(({ word, rank }) => {
                            const t = (n - rank) / n; // 1位=1.0
                            const size = Math.round(56 + 84 * t);
                            return (
                              <Box key={word} title={`${rank + 1}位: ${word}`}
                                sx={{ width: size, height: size, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                  position: 'relative',
                                  bgcolor: `hsl(${cl.hue}, 60%, 60%, ${(0.16 + 0.5 * t).toFixed(2)})`,
                                  border: `1px solid hsl(${cl.hue}, 60%, 60%, 0.6)`, overflow: 'hidden',
                                  '&:hover .kw-remove': { opacity: 1 } }}>
                                {/* 手動の微調整: ホバーで ✕（このワードをランキングから削除） */}
                                <IconButton className="kw-remove" size="small"
                                  onClick={(e) => { e.stopPropagation(); removeKeywordByWord(word); }}
                                  sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, opacity: 0, transition: 'opacity .12s',
                                    color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgba(0,0,0,0.25)',
                                    '&:hover': { color: '#fff', bgcolor: 'rgba(0,0,0,0.45)' } }}>
                                  <CloseRoundedIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                                <Typography noWrap sx={{ fontSize: Math.max(10, Math.min(20, size * 0.2)), fontWeight: 800, color: 'var(--brand-fg)', px: 0.75, maxWidth: '92%' }}>
                                  {word}
                                </Typography>
                                <Typography sx={{ fontSize: Math.max(8, size * 0.11), fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                                  {rank + 1}位
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          ) : (
            <>
              {/* ヘッダー検索語での AI メディア検索導線: 用意済みメディアの絞り込みに加えて、
                  「Claude」等の検索語でプール外の実在メディアを AI が探して候補提示できる。 */}
              {feedSearch.trim() && (
                <Box sx={{ mb: 2, px: 1.5, py: 1.25, borderRadius: 2,
                  border: `1px dashed ${ACCENT}55`, bgcolor: 'rgba(229,115,115,0.04)',
                  display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.7)', flex: 1, minWidth: 200 }}>
                    「{feedSearch.trim()}」に一致する用意済みメディア: <b>{searchMatchCount}件</b>
                    {searchMatchCount === 0 ? '。見つからないときは AI が実在メディアを探せます。' : '。他にも AI で新しいメディアを探せます。'}
                  </Typography>
                  <Button size="small" variant={searchMatchCount === 0 ? 'contained' : 'outlined'} disabled={discovering}
                    startIcon={discovering ? <CircularProgress size={13} sx={{ color: searchMatchCount === 0 ? '#fff' : ACCENT }} /> : <AutoAwesomeRoundedIcon />}
                    onClick={() => void runDiscover([feedSearch.trim()])}
                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 1.5,
                      ...(searchMatchCount === 0
                        ? { bgcolor: ACCENT, '&:hover': { bgcolor: '#d75d5d' } }
                        : { color: ACCENT, borderColor: `${ACCENT}66`, '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(229,115,115,0.08)' } }) }}>
                    {discovering ? 'AIが検索中…' : `「${feedSearch.trim()}」をAIで探す`}
                  </Button>
                  {discoverError && (
                    <Typography sx={{ fontSize: 10, color: ACCENT, width: '100%' }}>{discoverError}</Typography>
                  )}
                </Box>
              )}
              {/* AIが見つけたメディア候補（手動選択 or 全部おまかせで紐づけ） */}
              {candidates.length > 0 && (
                <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: `1px solid ${ACCENT}44`, bgcolor: 'rgba(229,115,115,0.05)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: ACCENT }} /> AIが見つけたメディア候補（{candidates.length}）
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" disabled={pickedCand.size === 0}
                        onClick={() => void linkCandidates(candidates.filter((c) => pickedCand.has(c.name)))}
                        sx={{ textTransform: 'none', color: ACCENT, borderColor: `${ACCENT}66`, '&:hover': { borderColor: ACCENT } }}>
                        選んだ{pickedCand.size > 0 ? `（${pickedCand.size}）` : ''}を追加
                      </Button>
                      <Button size="small" variant="contained"
                        onClick={() => void linkCandidates(candidates)}
                        sx={{ textTransform: 'none', bgcolor: ACCENT, '&:hover': { bgcolor: '#d75d5d' } }}>
                        全部おまかせで紐づける
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1 }}>
                    {candidates.map((c) => {
                      const on = pickedCand.has(c.name);
                      return (
                        <Box key={c.name}
                          onClick={() => setPickedCand((prev) => { const n = new Set(prev); if (n.has(c.name)) n.delete(c.name); else n.add(c.name); return n; })}
                          sx={{ display: 'flex', gap: 0.5, p: 1, borderRadius: 1.5, cursor: 'pointer',
                            border: `1px solid ${on ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                            bgcolor: on ? 'rgba(229,115,115,0.1)' : 'rgb(var(--brand-fg-rgb) / 0.02)' }}>
                          <Checkbox checked={on} size="small" sx={{ p: 0, mt: '-1px', color: ACCENT, '&.Mui-checked': { color: ACCENT } }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)' }}>
                              {c.name}
                              <Box component="span" sx={{ ml: 0.5, fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{c.lang.toUpperCase()}{c.category ? `・${c.category}` : ''}</Box>
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.4 }}>{c.note}</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
              {/* 📰⇄🎬 情報源の種別トグル（同じ購読リストを種別で表示切替） */}
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
                {([['article', '📰 記事メディア'], ['video', '🎬 YouTube（動画）']] as const).map(([key, label]) => (
                  <Chip key={key} label={label} size="small"
                    onClick={() => setSourceKind(key)}
                    sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 12, height: 26, px: 0.5,
                      bgcolor: sourceKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
                      color: sourceKind === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                      border: `1px solid ${sourceKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
                      '&:hover': { bgcolor: sourceKind === key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
                ))}
                {sourceKind === 'video' && (
                  <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)', alignSelf: 'center' }}>
                    チャンネルURL（@ハンドル可）を下の「自分で追加」に貼ると購読できます。動画はReaderでAI日本語字幕付きで観られます
                  </Typography>
                )}
              </Box>
              <FeedSourcePicker
                categories={categories}
                current={sources}
                customSources={customSources}
                saving={saving}
                onSave={(n) => void handleSave(n)}
                onAddCustom={handleAddCustom}
                onRemoveCustom={(n) => void handleRemoveCustom(n)}
                onCancel={() => setView('feed')}
                siteFilter={siteFilter}
                onAnalyze={(site) => void openAnalyze(site)}
                metaOf={metaOf}
                headerAction={
                  <Tooltip title="関心ワードのセマンティックグラフを表示">
                    <Button size="small" variant="outlined"
                      startIcon={<BubbleChartRoundedIcon sx={{ fontSize: '16px !important' }} />}
                      onClick={() => setShowGraph(true)}
                      sx={{ textTransform: 'none', fontWeight: 800, color: ACCENT, borderColor: `${ACCENT}66`, borderRadius: 1.5, px: 1.5,
                        '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(229,115,115,0.08)' } }}>
                      関心グラフ
                    </Button>
                  </Tooltip>
                }
              />
            </>
          )}
        </Box>
      </Box>

      {/* 右サイドバー: 通常=カテゴリ絞り込み / グラフ表示中=関心を深めるチャット */}
      <Box sx={{ width: showGraph ? 320 : 260, flexShrink: 0, height: '100%', overflowY: 'auto',
        borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.015)', px: 1.5, py: 2,
        display: 'flex', flexDirection: 'column' }}>
        {showGraph ? (
          /* グラフ表示中: AIと対話しながら関心を深める専用チャット。
             返答の ops（追加/削除/順位変更）がランキングへ適用され、左のグラフが育つ。
             関心度はバブルの大きさで一目瞭然なため、ランキング一覧は出さない。 */
          <>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', px: 1, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ForumRoundedIcon sx={{ fontSize: 15, color: ACCENT }} /> 関心を深めるチャット
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', px: 1, mb: 1, lineHeight: 1.6 }}>
              気になるテーマをAIと話すと、関心ワードが追加・並び替えされて左のグラフが育ちます。
            </Typography>

            {/* クイック操作: 自動生成（カテゴリ＋購読メディアから一括抽出） */}
            <Box sx={{ px: 1, mb: 1 }}>
              <Button fullWidth size="small" variant="contained" disabled={suggesting}
                startIcon={suggesting ? <CircularProgress size={13} sx={{ color: '#2a1233' }} /> : <AutoFixHighRoundedIcon />}
                onClick={() => void runSuggestKeywords()}
                sx={{ textTransform: 'none', fontWeight: 800, bgcolor: AI_PURPLE, color: '#2a1233', '&:hover': { bgcolor: '#ba68c8' } }}>
                {suggesting ? 'AIが生成中…' : 'AIで関心ワードを自動生成'}
              </Button>
              {suggestError && <Typography sx={{ fontSize: 10, color: ACCENT, mt: 0.5 }}>{suggestError}</Typography>}
            </Box>

            {/* メッセージ一覧 */}
            <Box sx={{ flex: 1, minHeight: 120, overflowY: 'auto', px: 1, py: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {chatMsgs.length === 0 && (
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textAlign: 'center', mt: 3, lineHeight: 1.8 }}>
                  例:「最近ClaudeのMCPが気になる」<br />「木造建築とAIの接点って？」
                </Typography>
              )}
              {chatMsgs.map((m, i) => (
                <Box key={i} sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                  <Box sx={{ px: 1.25, py: 0.75, borderRadius: 2,
                    bgcolor: m.role === 'user' ? 'rgba(229,115,115,0.14)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                    border: `1px solid ${m.role === 'user' ? `${ACCENT}44` : 'rgb(var(--brand-fg-rgb) / 0.08)'}` }}>
                    <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                  </Box>
                  {m.note && (
                    <Typography sx={{ fontSize: 10, color: AI_PURPLE, mt: 0.4, px: 0.5 }}>
                      ✨ ランキング更新: {m.note}
                    </Typography>
                  )}
                </Box>
              ))}
              {chatBusy && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                  <CircularProgress size={13} sx={{ color: ACCENT }} />
                  <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>考えています…</Typography>
                </Box>
              )}
            </Box>

            {/* 入力行 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, mt: 1 }}>
              <InputBase
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                placeholder="関心のあるテーマを話す…"
                multiline maxRows={4}
                sx={{ flex: 1, fontSize: 12, color: 'var(--brand-fg)', px: 1.25, py: 0.6, borderRadius: 2,
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' }}
              />
              <Tooltip title="送信（Enter）">
                <span>
                  <IconButton size="small" disabled={!chatInput.trim() || chatBusy} onClick={() => void sendChat()}
                    sx={{ color: '#fff', bgcolor: ACCENT, borderRadius: 2, p: 0.75, '&:hover': { bgcolor: '#d75d5d' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}>
                    <SendRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* 手動の微追加（最後の仕上げ用。削除はグラフのバブルにホバーで ✕） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, mt: 1 }}>
              <InputBase
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="ワードを手動で追加"
                sx={{ flex: 1, fontSize: 11, color: 'var(--brand-fg)', px: 1, py: 0.35, borderRadius: 1.5,
                  bgcolor: 'transparent', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.15)' }}
              />
              <Tooltip title="関心ワードを追加">
                <span>
                  <IconButton size="small" disabled={!kwInput.trim()} onClick={addKeyword}
                    sx={{ color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 1.5, p: 0.4 }}>
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </>
        ) : (
          /* メディア選択中: 絞り込み＋AIボタン群（関心ワードランキングは関心グラフ側へ移設） */
          <>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', px: 1, mb: 1 }}>
              絞り込み
            </Typography>

            <Box onClick={resetFilter}
              sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.4, mb: 1, mx: 1, borderRadius: 3, cursor: 'pointer',
                fontSize: 11.5, fontWeight: selectedCats.size === 0 ? 800 : 600,
                color: selectedCats.size === 0 ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                bgcolor: selectedCats.size === 0 ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.06)',
                border: `1px solid ${selectedCats.size === 0 ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                '&:hover': { borderColor: ACCENT } }}>
              すべて
            </Box>

            <Box>
              {SOURCE_CATEGORIES.map(renderCategoryRow)}
            </Box>

            {/* AIおまかせ検索: 選んだカテゴリ（未選択なら関心ワード/ブログのカテゴリ）に沿って実在メディアを探す */}
            <Box sx={{ px: 1, mt: 2.5 }}>
              <Button fullWidth variant="contained" size="small" disabled={discovering}
                startIcon={discovering ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeRoundedIcon />}
                onClick={() => void runDiscover()}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: ACCENT, '&:hover': { bgcolor: '#d75d5d' } }}>
                {discovering ? 'AIが検索中…' : 'AIでメディアを探す'}
              </Button>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.75, lineHeight: 1.6 }}>
                {selectedCats.size > 0 ? '選んだカテゴリ' : interestKeywords.length > 0 ? '関心ワードランキング' : 'あなたのカテゴリ'}に沿って、AIが実在するメディア候補を探して提示します。
              </Typography>
              {discoverError && (
                <Typography sx={{ fontSize: 10, color: ACCENT, mt: 0.5 }}>{discoverError}</Typography>
              )}

              {/* おまかせ紐づけ（旧・メイン右上から移設）: おすすめメディアを自動選択して即紐づけ */}
              <Button fullWidth variant="contained" size="small" disabled={saving}
                startIcon={<AutoAwesomeRoundedIcon />}
                onClick={handleAutoLink}
                sx={{ mt: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: AI_PURPLE, color: '#2a1233', '&:hover': { bgcolor: '#ba68c8' } }}>
                AIにおまかせで紐づける
              </Button>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.75, lineHeight: 1.6 }}>
                あなたのカテゴリに合うおすすめメディアを自動で選んで紐づけます。
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* メディア内容傾向ダイアログ（情報アイコンから開く） */}
      <Dialog open={!!analyzeSite} onClose={() => setAnalyzeSite(null)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3 } } }}>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <RssFeedRoundedIcon sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-fg)' }}>{analyzeSite?.name}</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 2, wordBreak: 'break-all' }}>{analyzeSite?.feed}</Typography>

          {analyzing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 4, justifyContent: 'center' }}>
              <CircularProgress size={20} sx={{ color: ACCENT }} />
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>最近の記事を分析しています…</Typography>
            </Box>
          ) : analyzeError ? (
            <Typography sx={{ fontSize: 13, color: ACCENT, py: 2 }}>{analyzeError}</Typography>
          ) : analysis ? (
            <>
              {analysis.summary && (
                <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)', lineHeight: 1.8, mb: 2 }}>{analysis.summary}</Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mb: 2 }}>
                {analysis.tone && (
                  <Chip label={analysis.tone} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(206,147,216,0.14)', color: AI_PURPLE, border: '1px solid rgba(206,147,216,0.4)' }} />
                )}
                {analysis.keywords.map((k) => (
                  <Chip key={k} label={k} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(229,115,115,0.12)', color: ACCENT, border: `1px solid ${ACCENT}44` }} />
                ))}
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.75 }}>最近の記事</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 260, overflowY: 'auto' }}>
                {analysis.items.map((it, i) => (
                  <Box key={i} onClick={() => void openReader(it.url, it.title, analyzeSite?.name || '')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer',
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
                      '&:hover': { borderColor: `${ACCENT}55`, bgcolor: 'rgba(229,115,115,0.05)' } }}>
                    <Typography noWrap sx={{ fontSize: 12, color: 'var(--brand-fg)', flex: 1, minWidth: 0 }}>{it.title}</Typography>
                    <OpenInNewRoundedIcon sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.35)', flexShrink: 0 }} />
                  </Box>
                ))}
              </Box>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};
