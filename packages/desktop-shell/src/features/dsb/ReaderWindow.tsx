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
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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

  const playlist = useMemo(loadPlaylist, []);
  const [tabs, setTabs] = useState<BlogSourceRef[]>(initial.url ? [initial] : []);
  const [activeUrl, setActiveUrl] = useState<string>(initial.url);
  const [autoRead, setAutoRead] = useState(initial.autoRead); // 自動遷移後は自動で読み上げ開始
  const [nextUp, setNextUp] = useState<{ item: BlogSourceRef; sec: number } | null>(null);

  const current = tabs.find((t) => t.url === activeUrl) || tabs[0] || initial;

  const idx = playlist.findIndex((p) => p.url === current.url);
  const next = idx >= 0 && idx + 1 < playlist.length ? playlist[idx + 1] : null;

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNav(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goNav(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNav]);

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
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#0e1119', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* タブバー（2枚以上のときだけ表示） */}
      {showTabs && (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: 0.5, px: 1, pt: 0.75,
          bgcolor: '#0b0e15', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 0 } }}>
          {tabs.map((t) => {
            const active = t.url === current.url;
            return (
              <Box
                key={t.url}
                onClick={() => { setActiveUrl(t.url); setAutoRead(false); setNextUp(null); }}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: 220, flexShrink: 0,
                  px: 1.25, py: 0.75, borderTopLeftRadius: 8, borderTopRightRadius: 8, cursor: 'pointer', userSelect: 'none',
                  bgcolor: active ? '#0e1119' : 'transparent',
                  borderTop: active ? '2px solid #e57373' : '2px solid transparent',
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: active ? '#0e1119' : 'rgba(255,255,255,0.05)' },
                  '&:hover .reader-tab-close': { opacity: 1 } }}
              >
                <Typography noWrap sx={{ fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'rgba(255,255,255,0.6)', flex: 1, minWidth: 0 }}>
                  {t.title}
                </Typography>
                <Box
                  className="reader-tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(t.url); }}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16,
                    borderRadius: '50%', flexShrink: 0, opacity: active ? 0.7 : 0, transition: 'opacity 120ms, background-color 120ms',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', opacity: 1 } }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 本文（アクティブタブのみマウント） */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        <SourceArticleReader
          key={current.url}
          source={current}
          autoRead={autoRead}
          announceNext={autoRead}
          onReadEnd={handleReadEnd}
          onDiscuss={() => void requestDiscussWrite(current)}
        />

        {/* ←/→ ナビのフィードバック（現在位置 n/m・端では案内） */}
        {navToast && (
          <Box sx={{ position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)', zIndex: 11,
            px: 1.75, py: 0.6, borderRadius: 99, bgcolor: 'rgba(18,22,32,0.94)',
            border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
            <Typography sx={{ fontSize: 12, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{navToast}</Typography>
          </Box>
        )}

        {/* 連続読み上げ: 次の記事へのカウントダウン */}
        {nextUp && (
          <Box sx={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderRadius: 3, zIndex: 10,
            bgcolor: 'rgba(18,22,32,0.96)', border: '1px solid rgba(229,115,115,0.45)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: 'min(640px, calc(100vw - 40px))' }}>
            <CircularProgress size={16} variant="determinate" value={(nextUp.sec / COUNTDOWN_SEC) * 100}
              sx={{ color: '#e57373', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                {nextUp.sec}秒後に次の記事を読み上げます
              </Typography>
              <Typography noWrap sx={{ fontSize: 12.5, color: '#fff', fontWeight: 700 }}>
                {nextUp.item.title}
              </Typography>
            </Box>
            <Button size="small" startIcon={<SkipNextRoundedIcon sx={{ fontSize: '15px !important' }} />}
              onClick={() => goNext(nextUp.item)}
              sx={{ color: '#e57373', textTransform: 'none', fontSize: 11.5, px: 1, flexShrink: 0, fontWeight: 700 }}>
              今すぐ
            </Button>
            <Button size="small" startIcon={<CloseRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => setNextUp(null)}
              sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 11.5, px: 1, flexShrink: 0 }}>
              キャンセル
            </Button>
          </Box>
        )}
      </Box>

      {/* 🎞 表紙ギャラリー（CD選曲風）: ドラッグで流し見・クリックで表示・←/→とも連動 */}
      {playlist.length > 1 && (
        <ReaderGallery items={playlist} activeIndex={idx} onSelect={goTo} />
      )}
    </Box>
  );
};
