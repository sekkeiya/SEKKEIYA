/**
 * ReaderWindow — SEKKEIYA Reader の独立ネイティブウィンドウ（/?readerWindow=true&url=...）。
 * ホームの「記事を読む」から開く。生ページ（広告・ナビ入り）ではなく、
 * SourceArticleReader と同じクリーンなリーダー表示（日本語翻訳＋画像＋動画）を出す。
 *
 * ★タブ方式: ウィンドウは1枚のまま、上部のタブバーで複数記事を切り替える（ブラウザのタブと同じ）。
 *   別記事を開いても新しいウィンドウは作らず、この窓にタブを足すだけ。よって WebView2 レンダラーは
 *   常に1個のまま（プロセスが積み上がらない）。openReader が emit する 'sblog-reader:navigate' を購読して
 *   タブを追加/アクティブ化する。
 *
 * 連続読み上げ: ホームのフィード一覧（localStorage のプレイリスト）を知っているので、
 * 読み上げが最後まで終わると数秒のカウントダウン後に**現在タブを次の記事へ差し替えて読み上げを再開**する
 * （ニュースラジオのように聴き流せる／タブは増やさない）。カウントダウン中にキャンセル可能。
 * 読了後は「AIと議論して書く」でメインウィンドウの議論ファーストへシームレスに遷移する。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { SourceArticleReader } from './SourceArticleReader';
import { ReaderGallery } from './ReaderGallery';
import { requestDiscussWrite } from './lib/discussBridge';
import type { BlogSourceRef } from './types';

const PLAYLIST_KEY = 'sblog-reader-playlist';
const COUNTDOWN_SEC = 5;
/** openReader（メイン窓）から「この記事をタブで開いて」と伝えるイベント名。 */
const NAV_EVENT = 'sblog-reader:navigate';

/** ホーム（BlogNewsFeed）が保存したフィードの並び。1時間で失効。 */
function loadPlaylist(): BlogSourceRef[] {
  try {
    const d = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '');
    if (Array.isArray(d.items) && Date.now() - (d.at || 0) < 60 * 60 * 1000) return d.items;
  } catch { /* なし */ }
  return [];
}

export const ReaderWindow: React.FC = () => {
  const initial = useMemo<BlogSourceRef & { autoRead: boolean }>(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || '';
    return { url, title: params.get('title') || url, source: params.get('source') || '',
      autoRead: params.get('autoRead') === '1' }; // 投稿スケジュール実行など「開いたら読み上げ」用
  }, []);

  const playlistAll = useMemo(loadPlaylist, []);
  // 📰⇄🎬 プレイリストの種別切替（ホームのトグルと対）。←/→・ギャラリー・連続読み上げは
  // 選択中の種別内だけを移動する。初期値は開いた記事の種別に合わせる。
  const isVideoUrl = (u: string) => /(youtube\.com|youtu\.be)\//.test(u);
  const [kind, setKind] = useState<'article' | 'video'>(() =>
    isVideoUrl(initial.url || playlistAll[0]?.url || '') ? 'video' : 'article');
  const playlist = useMemo(
    () => playlistAll.filter((p) => isVideoUrl(p.url) === (kind === 'video')),
    [playlistAll, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const kindCounts = useMemo(() => ({
    article: playlistAll.filter((p) => !isVideoUrl(p.url)).length,
    video: playlistAll.filter((p) => isVideoUrl(p.url)).length,
  }), [playlistAll]); // eslint-disable-line react-hooks/exhaustive-deps
  // URL 指定なしで開いたとき（SEKKEIYA OS からの「リーダーを開く」等）は、読書リストの先頭を表示。
  const firstArticle = initial.url ? initial : (playlist[0] ?? null);
  const [tabs, setTabs] = useState<BlogSourceRef[]>(firstArticle ? [firstArticle] : []);
  const [activeUrl, setActiveUrl] = useState<string>(firstArticle?.url ?? '');
  const [autoRead, setAutoRead] = useState(initial.autoRead); // 自動遷移後は自動で読み上げ開始
  const [nextUp, setNextUp] = useState<{ item: BlogSourceRef; sec: number } | null>(null);

  const current = tabs.find((t) => t.url === activeUrl) || tabs[0] || initial;

  const idx = playlist.findIndex((p) => p.url === current.url);
  const next = idx >= 0 && idx + 1 < playlist.length ? playlist[idx + 1] : null;

  // 📰⇄🎬 種別を切り替え、現在の記事が新種別に合わなければその種別の先頭へ差し替える
  const switchKind = useCallback((k: 'article' | 'video') => {
    setKind((cur) => {
      if (cur === k) return cur;
      if (isVideoUrl(current.url) !== (k === 'video')) {
        const target = playlistAll.find((p) => isVideoUrl(p.url) === (k === 'video'));
        if (target) {
          setNextUp(null);
          setAutoRead(false);
          setTabs((prev) => (prev.some((t) => t.url === target.url) ? prev : prev.map((t) => (t.url === activeUrl ? target : t))));
          setActiveUrl(target.url);
        }
      }
      return k;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.url, activeUrl, playlistAll]);

  // 記事をタブとして開く（既にあればアクティブ化するだけ）。窓は1枚のまま。
  const openArticle = useCallback((a: BlogSourceRef, opts?: { autoRead?: boolean }) => {
    if (!a.url) return;
    setNextUp(null);
    setAutoRead(!!opts?.autoRead);
    setTabs((prev) => (prev.some((t) => t.url === a.url) ? prev : [...prev, a]));
    setActiveUrl(a.url);
  }, []);

  // openReader（メイン窓）からの「タブで開いて」通知を購読
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<BlogSourceRef>(NAV_EVENT, (e) => {
          const a = e.payload;
          if (a?.url) openArticle({ url: a.url, title: a.title || a.url, source: a.source || '' });
        });
      } catch (err) {
        // Web版では Tauri API 自体が無い（正常）。Tauri 上で失敗した場合は権限(capabilities)不足の可能性が高い
        console.warn('[ReaderWindow] タブ追加イベントの購読に失敗:', err);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, [openArticle]);

  // ウィンドウタイトルを現在の記事に追従（best-effort）
  useEffect(() => {
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setTitle(`${current.title} — SEKKEIYA Reader`);
      } catch { /* noop */ }
    })();
  }, [current.title]);

  // タブを閉じる。最後の1枚を閉じたらウィンドウごと閉じる。
  const closeTab = useCallback((url: string) => {
    setTabs((prev) => {
      const at = prev.findIndex((t) => t.url === url);
      const remaining = prev.filter((t) => t.url !== url);
      if (remaining.length === 0) {
        (async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
          } catch { /* noop */ }
        })();
        return prev;
      }
      // 閉じたのがアクティブタブなら隣を選ぶ
      setActiveUrl((cur) => {
        if (cur !== url) return cur;
        setAutoRead(false);
        setNextUp(null);
        const nb = remaining[Math.min(at, remaining.length - 1)];
        return nb?.url || '';
      });
      return remaining;
    });
  }, []);

  // ← / → キーでプレイリストの前後の記事へ移動（現在タブを差し替え・タブは増やさない）
  const [navToast, setNavToast] = useState('');
  useEffect(() => {
    if (!navToast) return;
    const t = setTimeout(() => setNavToast(''), 1600);
    return () => clearTimeout(t);
  }, [navToast]);

  // プレイリストの i 番目の記事を表示（現在タブを差し替え・タブは増やさない）
  const goTo = useCallback((i: number) => {
    const target = playlist[i];
    if (!target) return;
    setNextUp(null);
    setAutoRead(false); // 手動ブラウズでは自動読み上げしない（読み上げ中はアンマウントで停止）
    setTabs((prev) => (prev.some((t) => t.url === target.url) ? prev : prev.map((t) => (t.url === activeUrl ? target : t))));
    setActiveUrl(target.url);
    setNavToast(`${i + 1} / ${playlist.length}`);
  }, [playlist, activeUrl]);

  const goNav = useCallback((dir: -1 | 1) => {
    if (idx < 0 || playlist.length === 0) return; // プレイリスト外の記事（議論経由など）では無効
    if (!playlist[idx + dir]) {
      setNavToast(dir === -1 ? 'これが最初の記事です' : 'これが最後の記事です');
      return;
    }
    goTo(idx + dir);
  }, [idx, playlist, goTo]);

  // ↑↓ 本文スクロール：押している間は requestAnimationFrame で連続的に「スーッと」流し、
  // 離したら慣性で滑らかに減速停止する（1コマずつのカクつきを無くす）。
  useEffect(() => {
    let held = 0;                 // -1=上 / 0=なし / +1=下（押しっぱなしの向き）
    let vel = 0;                  // 現在の速度（px/frame）
    let raf: number | null = null;
    const MAX = 16;               // 押しっぱなし時の到達速度（px/frame ≒ 960px/s @60fps）

    const tick = () => {
      const el = document.querySelector('[data-reader-scroll]') as HTMLElement | null;
      if (!el) { raf = null; vel = 0; return; }
      if (held !== 0) {
        // 目標速度へなめらかに近づける（ソフトな出だし）。
        vel += (MAX * held - vel) * 0.18;
      } else {
        // キーを離した後は慣性で減衰。
        vel *= 0.86;
        if (Math.abs(vel) < 0.35) vel = 0;
      }
      if (vel !== 0) {
        el.scrollBy({ top: vel });
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };
    const ensureLoop = () => { if (raf == null) raf = requestAnimationFrame(tick); };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNav(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goNav(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); held = 1; ensureLoop(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); held = -1; ensureLoop(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && held === 1) held = 0;      // → 慣性減衰へ
      else if (e.key === 'ArrowUp' && held === -1) held = 0;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [goNav]);

  // 🔥 次の動画の先読み解析: プレイリストの次が動画なら、視聴中に CF videoRead を
  // 裏で走らせて全ユーザー共有キャッシュに載せる（次を開いた瞬間に字幕・記事が揃う）。
  // 4秒ディレイ＝←/→で流し見しているときに無駄撃ちしないため。
  useEffect(() => {
    const url = next?.url;
    if (!url || !isVideoUrl(url)) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const [{ httpsCallable }, { functions }] = await Promise.all([
            import('firebase/functions'),
            import('../../lib/firebase/client'),
          ]);
          await httpsCallable(functions, 'blogDialogue')({ mode: 'videoRead', url });
        } catch { /* 先読みは任意 */ }
      })();
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.url]);

  // 読み上げ完了 → 次の記事のカウントダウンを開始
  const handleReadEnd = () => {
    if (next) setNextUp({ item: next, sec: COUNTDOWN_SEC });
  };

  // 連続読み上げの自動遷移はタブを増やさず、現在タブを次の記事へ差し替える
  const goNext = (item: BlogSourceRef) => {
    setNextUp(null);
    setAutoRead(true);
    setTabs((prev) => (prev.some((t) => t.url === item.url) ? prev : prev.map((t) => (t.url === activeUrl ? item : t))));
    setActiveUrl(item.url);
  };

  // カウントダウンの進行
  useEffect(() => {
    if (!nextUp) return;
    if (nextUp.sec <= 0) { goNext(nextUp.item); return; }
    const t = setTimeout(() => setNextUp((n) => (n ? { ...n, sec: n.sec - 1 } : n)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextUp]);

  const showTabs = tabs.length > 1;

  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: 'var(--brand-surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* タブバー（2枚以上のときだけ表示） */}
      {showTabs && (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: 0.5, px: 1, pt: 0.75,
          bgcolor: 'var(--brand-bg)', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 0 } }}>
          {tabs.map((t) => {
            const active = t.url === current.url;
            return (
              <Box
                key={t.url}
                onClick={() => { setActiveUrl(t.url); setAutoRead(false); setNextUp(null); }}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: 220, flexShrink: 0,
                  px: 1.25, py: 0.75, borderTopLeftRadius: 8, borderTopRightRadius: 8, cursor: 'pointer', userSelect: 'none',
                  bgcolor: active ? 'var(--brand-surface)' : 'transparent',
                  borderTop: active ? '2px solid #e57373' : '2px solid transparent',
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: active ? 'var(--brand-surface)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
                  '&:hover .reader-tab-close': { opacity: 1 } }}
              >
                <Typography noWrap sx={{ fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)', flex: 1, minWidth: 0 }}>
                  {t.title}
                </Typography>
                <Box
                  className="reader-tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(t.url); }}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16,
                    borderRadius: '50%', flexShrink: 0, opacity: active ? 0.7 : 0, transition: 'opacity 120ms, background-color 120ms',
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', opacity: 1 } }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 本文（アクティブタブのみマウント） */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        {current.url ? (
          <SourceArticleReader
            key={current.url}
            source={current}
            autoRead={autoRead}
            announceNext={autoRead}
            onReadEnd={handleReadEnd}
            onDiscuss={() => void requestDiscussWrite(current)}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, p: 4, textAlign: 'center' }}>
            <MenuBookRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.25)' }} />
            <Typography sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>読む記事がありません</Typography>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>ニュースフィードやリンクから記事を開くと、ここに表示されます。</Typography>
          </Box>
        )}

        {/* ←/→ ナビのフィードバック（現在位置 n/m・端では案内） */}
        {navToast && (
          <Box sx={{ position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)', zIndex: 11,
            px: 1.75, py: 0.6, borderRadius: 99, bgcolor: 'rgba(18,22,32,0.94)',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
            <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', fontWeight: 700, whiteSpace: 'nowrap' }}>{navToast}</Typography>
          </Box>
        )}

        {/* 連続読み上げ: 次の記事へのカウントダウン */}
        {nextUp && (
          <Box sx={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderRadius: 3, zIndex: 10,
            bgcolor: 'rgba(18,22,32,0.96)', border: '1px solid rgba(229,115,115,0.45)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: 'min(640px, calc(100vw - 40px))' }}>
            <CircularProgress size={16} variant="determinate" value={(nextUp.sec / COUNTDOWN_SEC) * 100}
              sx={{ color: 'light-dark(#921b1b, #e57373)', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.3 }}>
                {nextUp.sec}秒後に次の記事を読み上げます
              </Typography>
              <Typography noWrap sx={{ fontSize: 12.5, color: 'var(--brand-fg)', fontWeight: 700 }}>
                {nextUp.item.title}
              </Typography>
            </Box>
            <Button size="small" startIcon={<SkipNextRoundedIcon sx={{ fontSize: '15px !important' }} />}
              onClick={() => goNext(nextUp.item)}
              sx={{ color: 'light-dark(#921b1b, #e57373)', textTransform: 'none', fontSize: 11.5, px: 1, flexShrink: 0, fontWeight: 700 }}>
              今すぐ
            </Button>
            <Button size="small" startIcon={<CloseRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => setNextUp(null)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: 11.5, px: 1, flexShrink: 0 }}>
              キャンセル
            </Button>
          </Box>
        )}
      </Box>

      {/* 📰⇄🎬 プレイリストの種別トグル（両方あるときだけ表示）。ナビ・ギャラリー・連続読み上げが絞られる */}
      {kindCounts.article > 0 && kindCounts.video > 0 && (
        <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 0.75, py: 0.75,
          bgcolor: 'var(--brand-bg)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
          {([['article', `📰 記事 ${kindCounts.article}`], ['video', `🎬 動画 ${kindCounts.video}`]] as const).map(([key, label]) => (
            <Chip key={key} label={label} size="small"
              onClick={() => switchKind(key)}
              sx={{ cursor: 'pointer', fontWeight: 800, fontSize: 11.5, height: 24,
                bgcolor: kind === key ? '#e57373' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                color: kind === key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                border: `1px solid ${kind === key ? '#e57373' : 'rgb(var(--brand-fg-rgb) / 0.14)'}`,
                '&:hover': { bgcolor: kind === key ? '#e57373' : 'rgb(var(--brand-fg-rgb) / 0.12)' } }} />
          ))}
        </Box>
      )}

      {/* 🎞 表紙ギャラリー（CD選曲風）: ドラッグで流し見・クリックで表示・←/→とも連動 */}
      {playlist.length > 1 && (
        <ReaderGallery items={playlist} activeIndex={idx} onSelect={goTo} />
      )}
    </Box>
  );
};
