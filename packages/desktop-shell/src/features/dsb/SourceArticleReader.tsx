/**
 * SourceArticleReader — 議論ファースト時にエディタのメインエリアへ表示する題材記事リーダー。
 * 「記事を読みながら右パネルでAIと議論する」ための表示。CF(mode:'read')が <article> を抽出し、
 * 段落・見出し・画像を出現順のブロックで返す。**英語記事は既定で日本語翻訳**される。
 * 全文転載を避けるため上限あり。出典リンクと著作権注記を常設。
 * 「議論から記事を生成する」で bodyMarkdown が入ると、親(DsbEditor)が自動でエディタ表示に切り替える。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Chip, CircularProgress, Divider, IconButton, Tooltip } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { speakSentences, splitSentences, stopSpeaking, isTtsAvailable, getTtsSettings } from './lib/tts';
import { isTauri } from '../../lib/platform';
import { saveArticleToLibrary, findLibraryEntryByUrl } from './lib/articleToLibrary';
import { AiTtsPlayer, prepareAiTts } from '../../lib/aiTts';
import { TtsSettingsDialog } from '../../components/tts/TtsSettingsDialog';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import type { BlogSourceRef } from './types';
import { DEFAULT_SOURCE_SITES } from './types';
import { openReaderRaw } from './lib/openReader';

const ACCENT = '#e57373';

export type ReaderBlock = { t: 'p' | 'h'; text: string } | { t: 'img' | 'video'; src: string };

// 🔊 再生中インジケーター: 音楽アプリ風の跳ねるイコライザーバー（読んでいる段落の先頭に表示）
const EqBars: React.FC = () => (
  <Box component="span" sx={{
    display: 'inline-flex', alignItems: 'flex-end', gap: '2.5px', height: 13, mr: 0.9, ml: 0.25,
    verticalAlign: '-1px',
    '& span': { width: '3px', borderRadius: '2px', bgcolor: ACCENT, animation: 'sekkeiyaEq 0.9s ease-in-out infinite' },
    '& span:nth-of-type(2)': { animationDelay: '0.25s', bgcolor: '#ffa726' },
    '& span:nth-of-type(3)': { animationDelay: '0.5s' },
    '@keyframes sekkeiyaEq': { '0%,100%': { height: '4px' }, '50%': { height: '13px' } },
  }}>
    <span /><span /><span />
  </Box>
);

// 読み上げ中ハイライト: 暖色のグラデーションがゆっくり流れる（読んでいて楽しい・でも読みやすい濃度）
const activeHlSx = {
  backgroundImage: 'linear-gradient(90deg, rgba(229,115,115,0.30), rgba(255,167,38,0.26), rgba(229,115,115,0.30))',
  backgroundSize: '200% 100%',
  animation: 'sekkeiyaHl 2.6s linear infinite',
  '@keyframes sekkeiyaHl': { from: { backgroundPosition: '0% 0' }, to: { backgroundPosition: '-200% 0' } },
} as const;

interface SourceArticleReaderProps {
  source: BlogSourceRef;
  /** 「自分で書く」= リーダーを閉じて通常エディタへ（独立ウィンドウでは省略） */
  onSkipToEditor?: () => void;
  /** 「AIと議論して書く」（独立ウィンドウのみ。読了後にメインへシームレス遷移） */
  onDiscuss?: () => void;
  /** 本文の読み込みが終わったら自動で読み上げを開始（連続読み上げモード） */
  autoRead?: boolean;
  /** 冒頭に「次の記事を読み上げます」とアナウンスする（連続読み上げの自動遷移時） */
  announceNext?: boolean;
  /** 読み上げが最後まで完了したとき（手動停止では呼ばれない）。連続読み上げの次記事トリガー */
  onReadEnd?: () => void;
}

// 読み込み・翻訳結果のキャッシュ（Reader→エディタ遷移で再取得・再翻訳しないため）。
// localStorage は同一アプリの全ウィンドウで共有される。
const CACHE_PREFIX = 'sblog-read:';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6時間

function loadReadCache(url: string): { blocks: ReaderBlock[]; translated: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.blocks) || Date.now() - (data.at || 0) > CACHE_TTL) return null;
    return { blocks: data.blocks, translated: !!data.translated };
  } catch { return null; }
}

function saveReadCache(url: string, blocks: ReaderBlock[], translated: boolean): void {
  try {
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ blocks, translated, at: Date.now() }));
  } catch {
    // 容量超過など → 古いリーダーキャッシュを一掃してリトライ
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ blocks, translated, at: Date.now() }));
    } catch { /* 諦める */ }
  }
}

export const SourceArticleReader: React.FC<SourceArticleReaderProps> = ({ source, onSkipToEditor, onDiscuss, autoRead, announceNext, onReadEnd }) => {
  const [blocks, setBlocks] = useState<ReaderBlock[]>([]);
  const [translated, setTranslated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 📚 S.Library へのワンクリック登録（第二の脳）。idle→saving→saved / 失敗は error
  const [libStatus, setLibStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    setLibStatus('idle');
    void findLibraryEntryByUrl(source.url).then((e) => {
      if (alive && e) setLibStatus('saved');
    });
    return () => { alive = false; };
  }, [source.url]);

  const handleSaveToLibrary = async () => {
    if (libStatus === 'saving' || libStatus === 'saved') return;
    setLibStatus('saving');
    try {
      await saveArticleToLibrary({ source, blocks, translated });
      setLibStatus('saved');
    } catch (e) {
      console.error('[SourceArticleReader] S.Library 追加に失敗', e);
      setLibStatus('error');
    }
  };

  // 🔊 記事の読み上げ（日本語訳された本文を再生。読んでいる文をハイライト＋自動スクロール）
  const [reading, setReading] = useState(false);
  const [ttsSettingsOpen, setTtsSettingsOpen] = useState(false);
  const [currentSentence, setCurrentSentence] = useState(-1); // 読み上げ中の文（全体通しの index、0=タイトル）
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  // 手動停止・アンマウントでは onReadEnd（連続読み上げの次記事トリガー）を発火させない
  const manualStopRef = useRef(false);

  // 冒頭で読み上げるタイトル文（連続読み上げの自動遷移時はアナウンスを前置）
  const titleSpoken = announceNext ? `次の記事を読み上げます。${source.title}。` : `${source.title}。`;

  // タイトル＋各テキストブロックを1本の文配列に。ブロックごとの開始 index を保持して
  // 描画時に「この文が全体の何番目か」を対応づけ、ハイライトとスクロールに使う。
  const readModel = React.useMemo(() => {
    const flat: string[] = [titleSpoken];
    const rangeByBlock = new Map<number, { start: number; sentences: string[] }>();
    blocks.forEach((b, bi) => {
      if (b.t === 'p' || b.t === 'h') {
        const ss = splitSentences(b.text);
        rangeByBlock.set(bi, { start: flat.length, sentences: ss });
        ss.forEach((s) => flat.push(s));
      }
    });
    return { flat, rangeByBlock };
  }, [blocks, titleSpoken]);

  // AI音声（ニューラルTTS）: 連続する段落を大きめのまとまり（~1200字）に結合して合成する。
  // 段落ごとに別々に合成すると抑揚・声色が毎回リセットされ「別人が読んでいる」ように
  // 聞こえるため、チャンクを大きくしてつなぎ目を減らす。ハイライトはチャンク内の全段落。
  const aiPlayerRef = useRef<AiTtsPlayer | null>(null);
  const [currentBlocks, setCurrentBlocks] = useState<number[]>([]); // AI再生中の段落群（-1=タイトル, -2-i=画像）
  const [aiSynthesizing, setAiSynthesizing] = useState(false);
  const [aiPrep, setAiPrep] = useState<{ done: number; total: number } | null>(null); // 初回の準備進捗
  const [aiError, setAiError] = useState(''); // 有料プラン未加入・API失敗など
  const aiHadErrorRef = useRef(false); // 全チャンク失敗時に連続読み上げ（次記事）へ暴走しないためのフラグ
  const readSessionRef = useRef(0);   // 準備中に停止/ジャンプされたら旧セッションを破棄

  type AiChunk = { blockIdxs: number[]; text: string; isImage?: boolean };
  const CHUNK_MAX = 1200;

  // 画像ナレーション（AIの説明+感想）のキャッシュ: 記事URL単位で localStorage に保持。
  // テキストが安定していれば音声もサーバーキャッシュに乗るため、2回目以降は完全無料・即時。
  const imgDescCacheKey = `sblog-imgdesc:${source.url}`;
  const loadImgDescs = (): Record<number, string> | null => {
    try {
      const d = JSON.parse(localStorage.getItem(imgDescCacheKey) || '');
      if (d && d.at && Date.now() - d.at < 6 * 60 * 60 * 1000) return d.map || {};
    } catch { /* なし */ }
    return null;
  };
  const saveImgDescs = (map: Record<number, string>) => {
    try { localStorage.setItem(imgDescCacheKey, JSON.stringify({ at: Date.now(), map })); } catch { /* noop */ }
  };

  /** AI用チャンク列を構築。テキスト段落は結合し、画像位置にはナレーションチャンクを挿入。 */
  const buildAiChunks = (imgDescs: Record<number, string>): AiChunk[] => {
    const chunks: AiChunk[] = [{ blockIdxs: [-1], text: titleSpoken }];
    let curIdxs: number[] = [];
    let curText = '';
    const flush = () => {
      if (curText.trim()) chunks.push({ blockIdxs: curIdxs, text: curText.trim() });
      curIdxs = [];
      curText = '';
    };
    blocks.forEach((b, bi) => {
      if (b.t === 'p' || b.t === 'h') {
        const t = (b as any).text as string;
        if (curText && curText.length + t.length > CHUNK_MAX) flush();
        curIdxs.push(bi);
        curText += (curText ? '\n' : '') + t;
      } else if ((b.t === 'img' || b.t === 'video') && imgDescs[bi]) {
        // 画像の位置で一旦区切り、AIナレーション（説明+感想）を挿入
        flush();
        chunks.push({ blockIdxs: [bi], text: `ここで画像です。${imgDescs[bi]}`, isImage: true });
      }
    });
    flush();
    // 端数の併合: 短い残りが単独チャンクになると、その部分だけ声色が変わって聞こえる。
    // 400字未満のテキストチャンクは直前のテキストチャンクへ併合する（TTSの1回上限1800字は超えない）。
    for (let i = chunks.length - 1; i >= 2; i--) {
      const cur = chunks[i];
      const prev = chunks[i - 1];
      if (!cur.isImage && !prev.isImage && prev.blockIdxs[0] !== -1
        && cur.text.length < 400 && prev.text.length + cur.text.length <= 1700) {
        prev.text += `\n${cur.text}`;
        prev.blockIdxs.push(...cur.blockIdxs);
        chunks.splice(i, 1);
      }
    }
    return chunks;
  };

  const stopAll = () => {
    readSessionRef.current += 1; // 準備フェーズ中の停止にも効かせる
    stopSpeaking();
    aiPlayerRef.current?.stop();
    setReading(false);
    setAiSynthesizing(false);
    setAiPrep(null);
    setCurrentSentence(-1);
    setCurrentBlocks([]);
  };

  const readFrom = (startIndex: number) => {
    if (readModel.flat.length <= 1) return;
    manualStopRef.current = false;
    const settings = getTtsSettings();

    if (settings.engine === 'ai') {
      const session = ++readSessionRef.current;
      aiPlayerRef.current?.stop();
      setReading(true);
      setAiSynthesizing(true);
      setAiError('');
      aiHadErrorRef.current = false;

      void (async () => {
        // 1) 画像・グラフのAIナレーション（キャッシュ→無ければ視覚解析）
        let imgDescs = loadImgDescs();
        if (!imgDescs) {
          imgDescs = {};
          const imgEntries = blocks.map((b, bi) => ({ b, bi })).filter(({ b }) => b.t === 'img').slice(0, 6);
          if (imgEntries.length) {
            try {
              const fn = httpsCallable(functions, 'blogDialogue');
              const r: any = await fn({ mode: 'describeImages', title: source.title, images: imgEntries.map(({ b }) => (b as any).src) });
              if (r.data?.success && Array.isArray(r.data.descriptions)) {
                imgEntries.forEach(({ bi }, k) => { const d = r.data.descriptions[k]; if (d) imgDescs![bi] = d; });
              }
            } catch { /* 解説なしで続行 */ }
          }
          saveImgDescs(imgDescs);
        }
        if (session !== readSessionRef.current) return;

        // 2) チャンク構築（段落結合＋画像ナレーション挿入）と開始位置の解決
        const chunks = buildAiChunks(imgDescs);
        let startChunk = 0;
        if (startIndex > 0) {
          let ownerBlock = -1;
          readModel.rangeByBlock.forEach((r, bi) => {
            if (startIndex >= r.start && startIndex < r.start + r.sentences.length) ownerBlock = bi;
          });
          const at = chunks.findIndex((c) => c.blockIdxs.includes(ownerBlock));
          startChunk = at >= 0 ? at : 0;
        }
        const slice = chunks.slice(startChunk);

        // 3) 準備は裏で並列に回し（進捗はチップ表示）、再生は最初のチャンクができ次第すぐ始める。
        //    合成(数秒/チャンク) ≪ 再生(1〜2分/チャンク) なので、以降は常に先回りでき途切れない。
        //    （同一チャンクの同時要求は synthesizeAiTts 側で1本化されるので二重コストなし）
        setAiPrep({ done: 0, total: slice.length });
        void prepareAiTts(
          slice.map((c) => c.text),
          { voice: settings.aiVoice, style: settings.aiStyle },
          {
            onProgress: (done, total) => {
              if (session === readSessionRef.current) setAiPrep(done >= total ? null : { done, total });
            },
            shouldStop: () => session !== readSessionRef.current,
            onError: (msg) => { aiHadErrorRef.current = true; setAiError(msg); },
          },
        );

        // 4) 再生（最初のチャンクの合成完了を待つのは play 内部＝体感の待ちは1チャンク分だけ）
        const player = new AiTtsPlayer();
        aiPlayerRef.current = player;
        void player.play(
          slice.map((c) => c.text),
          { voice: settings.aiVoice, style: settings.aiStyle, rate: settings.rate },
          {
            onChunkStart: (i) => {
              setAiSynthesizing(false); // 音が出始めた
              const c = slice[i];
              setCurrentBlocks(c.blockIdxs);
              const first = c.blockIdxs[0];
              const r = first >= 0 ? readModel.rangeByBlock.get(first) : null;
              setCurrentSentence(r ? r.start : first === -1 ? 0 : -1);
            },
            onEnd: () => {
              setReading(false);
              setCurrentSentence(-1);
              setCurrentBlocks([]);
              // エラー（未加入等）で1音も出ていない場合は次記事へ進まない
              if (!manualStopRef.current && !aiHadErrorRef.current) onReadEnd?.();
            },
            onError: (msg) => {
              aiHadErrorRef.current = true;
              setAiError(msg);
            },
          },
        );
      })();
      return;
    }

    // 標準エンジン（OS音声）: 文単位ハイライト
    setReading(true);
    setCurrentSentence(startIndex);
    speakSentences(readModel.flat, {
      startIndex,
      onSentenceStart: (i) => setCurrentSentence(i),
      onEnd: () => {
        setReading(false);
        setCurrentSentence(-1);
        if (!manualStopRef.current) onReadEnd?.();
      },
    });
  };
  const toggleRead = () => {
    if (reading) { manualStopRef.current = true; stopAll(); return; }
    readFrom(0);
  };
  useEffect(() => () => { manualStopRef.current = true; stopSpeaking(); aiPlayerRef.current?.stop(); }, []); // アンマウント時に停止

  // 読み上げ中の文/画像を画面中央へ自動スクロール
  useEffect(() => {
    if (currentSentence >= 0) {
      const el = bodyScrollRef.current?.querySelector(`[data-sent="${currentSentence}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    // 画像ナレーション中（currentSentence=-1）: 画像ブロックへスクロール
    const imgIdx = currentBlocks.find((b) => b >= 0);
    if (imgIdx !== undefined) {
      const el = bodyScrollRef.current?.querySelector(`[data-block="${imgIdx}"]`);
      if (el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentSentence, currentBlocks]);

  // 📖 言葉の意味を調べる: 本文中の言葉を選択（ドラッグ/ダブルクリック）→「意味を調べる」→ AIが文脈に即して解説
  const [lookup, setLookup] = useState<null | {
    x: number; y: number; term: string; context: string;
    phase: 'ask' | 'loading' | 'done' | 'error';
    reading?: string; definition?: string;
  }>(null);
  const lookupRef = useRef<HTMLDivElement>(null);

  const handleTextMouseUp = () => {
    // selection の確定を待ってから読む（mouseup 直後は未確定のことがある）
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const term = sel.toString().trim();
      if (!term || term.length > 40 || term.includes('\n')) return;
      const anchor = sel.anchorNode;
      if (!anchor || !bodyScrollRef.current?.contains(anchor)) return; // 本文内の選択のみ
      let rect: DOMRect | null = null;
      try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { return; }
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      const context = String(anchor.textContent || '').slice(0, 300); // 出現文脈（同じ文/段落）
      setLookup({ x: rect.left + rect.width / 2, y: rect.bottom, term, context, phase: 'ask' });
    }, 0);
  };

  const runLookup = async () => {
    if (!lookup) return;
    setLookup((l) => (l ? { ...l, phase: 'loading' } : l));
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'define', term: lookup.term, context: lookup.context });
      setLookup((l) => {
        if (!l) return l;
        if (r.data?.success) return { ...l, phase: 'done', reading: r.data.reading || '', definition: r.data.definition || '' };
        return { ...l, phase: 'error', definition: r.data?.reason || '調べられませんでした' };
      });
    } catch (e: any) {
      setLookup((l) => (l ? { ...l, phase: 'error', definition: `調べられませんでした: ${e.message}` } : l));
    }
  };

  // カード外クリックで閉じる
  useEffect(() => {
    if (!lookup) return;
    const onDown = (e: MouseEvent) => {
      if (lookupRef.current && !lookupRef.current.contains(e.target as Node)) setLookup(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [!!lookup]); // eslint-disable-line react-hooks/exhaustive-deps

  // 連続読み上げモード: 本文の読み込みが終わったら自動で読み上げ開始
  const autoReadStartedRef = useRef(false);
  useEffect(() => {
    if (autoRead && !loading && !error && readModel.flat.length > 1 && !autoReadStartedRef.current) {
      autoReadStartedRef.current = true;
      readFrom(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead, loading, error, readModel.flat.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // キャッシュ命中なら即表示（Reader→エディタ遷移時の再取得・再翻訳を回避）
      const cached = loadReadCache(source.url);
      if (cached) {
        setBlocks(cached.blocks);
        setTranslated(cached.translated);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const fn = httpsCallable(functions, 'blogDialogue');
        // 媒体のRSSを渡す: ページがbot拒否(403)や JS描画でも content:encoded から本文を出せる
        const feed = DEFAULT_SOURCE_SITES.find((s) => s.name === source.source)?.feed || '';
        const r: any = await fn({ mode: 'read', url: source.url, fallbackFeed: feed });
        if (!alive) return;
        if (r.data?.success && Array.isArray(r.data.blocks) && r.data.blocks.length) {
          setBlocks(r.data.blocks);
          setTranslated(!!r.data.translated);
          saveReadCache(source.url, r.data.blocks, !!r.data.translated);
        } else if (r.data?.success && r.data.text) {
          // 旧レスポンス互換
          setBlocks(String(r.data.text).split(/(?<=[。！？.!?])\s+/).filter((s: string) => s.trim()).map((s: string) => ({ t: 'p' as const, text: s })));
        } else {
          setError(r.data?.reason || '本文を取得できませんでした');
        }
      } catch (e: any) {
        if (alive) setError(`本文の取得に失敗しました: ${e.message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [source.url]);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* リーダーヘッダ */}
      <Box sx={{ px: 4, pt: 3, pb: 2, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <MenuBookRoundedIcon sx={{ fontSize: 16, color: '#90caf9' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#90caf9', letterSpacing: 0.5 }}>
            題材記事を読む — 右のパネルでAIと議論しながらどうぞ
          </Typography>
          {translated && (
            <Chip icon={<TranslateRoundedIcon sx={{ fontSize: '12px !important' }} />} label="日本語訳" size="small"
              sx={{ height: 19, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(129,199,132,0.12)', color: '#a5d6a7', border: '1px solid rgba(129,199,132,0.35)',
                '& .MuiChip-icon': { color: '#a5d6a7' } }} />
          )}
        </Box>
        <Typography
          onClick={() => readFrom(0)}
          sx={{ color: '#fff', fontWeight: 800, fontSize: 21, lineHeight: 1.45, mb: 1, cursor: 'pointer', borderRadius: '4px',
            transition: 'background-color .2s',
            ...((currentSentence === 0 || currentBlocks.includes(-1)) ? activeHlSx : {}),
            '&:hover': (currentSentence === 0 || currentBlocks.includes(-1)) ? {} : { bgcolor: 'rgba(255,255,255,0.06)' } }}>
          {source.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {source.source && (
            <Chip label={source.source} size="small"
              sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(100,181,246,0.12)', color: '#90caf9', border: '1px solid rgba(100,181,246,0.35)' }} />
          )}
          <Button size="small" startIcon={<LaunchRoundedIcon sx={{ fontSize: '13px !important' }} />}
            onClick={() => void openReaderRaw(source.url, source.title)}
            sx={{ color: '#90caf9', textTransform: 'none', fontSize: 11.5, px: 1, '&:hover': { bgcolor: 'rgba(100,181,246,0.08)' } }}>
            原文をアプリ内ウィンドウで開く
          </Button>
          <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
            onClick={() => { try { window.open(source.url, '_blank'); } catch { /* noop */ } }}
            sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 11.5, px: 1, '&:hover': { color: '#fff' } }}>
            ブラウザで開く
          </Button>
          {isTauri() && !loading && !error && (
            <Tooltip title={libStatus === 'saved'
              ? 'S.Library に登録済みの記事です'
              : '記事（翻訳本文・画像・動画の参照込み）を S.Library に知識として追加します'}>
              <span>
                <Button size="small"
                  disabled={libStatus === 'saving' || libStatus === 'saved'}
                  startIcon={libStatus === 'saving'
                    ? <CircularProgress size={12} sx={{ color: '#ce93d8' }} />
                    : libStatus === 'saved'
                      ? <CheckRoundedIcon sx={{ fontSize: '14px !important' }} />
                      : <BookmarkAddRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => void handleSaveToLibrary()}
                  sx={{ color: libStatus === 'saved' ? '#a5d6a7' : libStatus === 'error' ? '#ef9a9a' : '#ce93d8',
                    textTransform: 'none', fontSize: 11.5, px: 1,
                    '&.Mui-disabled': { color: libStatus === 'saved' ? 'rgba(165,214,167,0.75)' : 'rgba(255,255,255,0.3)' },
                    '&:hover': { bgcolor: 'rgba(206,147,216,0.08)' } }}>
                  {libStatus === 'saved' ? 'S.Libraryに追加済み'
                    : libStatus === 'saving' ? '追加中…'
                    : libStatus === 'error' ? '追加に失敗（再試行）'
                    : 'S.Libraryに追加'}
                </Button>
              </span>
            </Tooltip>
          )}
          {isTtsAvailable() && !loading && !error && (
            <>
              <Button size="small"
                startIcon={reading
                  ? (aiSynthesizing ? <CircularProgress size={12} sx={{ color: '#a5d6a7' }} /> : <StopRoundedIcon sx={{ fontSize: '14px !important' }} />)
                  : <VolumeUpRoundedIcon sx={{ fontSize: '14px !important' }} />}
                onClick={toggleRead}
                sx={{ color: reading ? '#a5d6a7' : 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 11.5, px: 1,
                  bgcolor: reading ? 'rgba(129,199,132,0.1)' : 'transparent', '&:hover': { color: '#a5d6a7' } }}>
                {reading
                  ? (aiSynthesizing ? (aiPrep ? `準備中… ${aiPrep.done}/${aiPrep.total}` : 'AI音声を準備中…') : '停止')
                  : '読み上げ'}
              </Button>
              <Tooltip title="読み上げの設定（速度・声）">
                <IconButton size="small" onClick={() => setTtsSettingsOpen(true)}
                  sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#a5d6a7' } }}>
                  <TuneRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          {onDiscuss && (
            <Button size="small" variant="contained" startIcon={<ForumRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={onDiscuss}
              sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', fontSize: 11.5, px: 1.5, borderRadius: 1.5,
                '&:hover': { bgcolor: '#ef5350' } }}>
              AIと議論して書く
            </Button>
          )}
          {onSkipToEditor && (
            <Button size="small" startIcon={<EditNoteRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={onSkipToEditor}
              sx={{ color: 'rgba(255,255,255,0.45)', textTransform: 'none', fontSize: 11.5, px: 1, '&:hover': { color: ACCENT } }}>
              議論せず自分で書く
            </Button>
          )}
        </Box>
      </Box>

      {/* AI音声のエラー（有料プラン未加入など） */}
      {aiError && (
        <Box sx={{ px: 4, py: 0.75, bgcolor: 'rgba(255,215,64,0.08)', borderBottom: '1px solid rgba(255,215,64,0.25)', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11.5, color: '#ffd740' }}>
            ⚠ {aiError} — 標準音声（無料）は読み上げ設定 ⚙ から選べます
          </Typography>
        </Box>
      )}

      {/* 本文（リーダーモード：段落・見出し・画像を元記事の順で。テキスト選択で「意味を調べる」） */}
      <Box ref={bodyScrollRef} onMouseUp={handleTextMouseUp} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 4, py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, py: 8 }}>
            <CircularProgress size={20} sx={{ color: '#90caf9' }} />
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
              記事を読み込んでいます…（英語記事は日本語に翻訳します）
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', mb: 2 }}>{error}</Typography>
            <Button variant="outlined" size="small" startIcon={<LaunchRoundedIcon />}
              onClick={() => void openReaderRaw(source.url, source.title)}
              sx={{ color: '#90caf9', borderColor: 'rgba(100,181,246,0.4)', textTransform: 'none' }}>
              元記事をアプリ内ウィンドウで開く
            </Button>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 720, mx: 'auto' }}>
            {blocks.map((b, i) => {
              if (b.t === 'img') {
                const imgActive = currentBlocks.includes(i); // AIナレーション中は脈打つハイライト枠
                return (
                  <Box key={i} component="img" src={b.src} alt="" loading="lazy" data-block={i}
                    onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                    sx={{ width: '100%', maxHeight: 460, objectFit: 'cover', borderRadius: 2.5, my: 2.5,
                      border: imgActive ? '2px solid rgba(229,115,115,0.8)' : '1px solid rgba(255,255,255,0.08)',
                      transition: 'border-color .2s, box-shadow .2s', display: 'block',
                      ...(imgActive ? {
                        animation: 'sekkeiyaImgPulse 1.6s ease-in-out infinite',
                        '@keyframes sekkeiyaImgPulse': {
                          '0%,100%': { boxShadow: '0 0 14px rgba(229,115,115,0.2)' },
                          '50%': { boxShadow: '0 0 34px rgba(255,167,38,0.45)' },
                        },
                      } : {}) }} />
                );
              }
              if (b.t === 'video') {
                // 埋め込み動画（YouTube/Vimeo のみ。広告iframeはCF側で除外済み）
                return (
                  <Box key={i} sx={{ position: 'relative', width: '100%', pt: '56.25%', my: 2.5, borderRadius: 2.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Box component="iframe" src={b.src} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen frameBorder={0}
                      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                  </Box>
                );
              }
              // p / h は文単位のスパンで描画（読み上げ中の文をハイライト＋クリックでそこから再生）
              // AI音声は段落単位再生なので、その段落（block）全体をハイライトする
              const range = readModel.rangeByBlock.get(i);
              const blockActive = currentBlocks.includes(i);
              const sentenceNodes = range
                ? range.sentences.map((s, si) => {
                    const gi = range.start + si;
                    const active = gi === currentSentence || blockActive;
                    return (
                      <Box key={si} component="span" data-sent={gi}
                        title="クリックでここから読み上げ／選択で意味を調べる"
                        onClick={() => { if (window.getSelection() && !window.getSelection()!.isCollapsed) return; readFrom(gi); }}
                        sx={{ cursor: 'pointer', borderRadius: '3px',
                          transition: 'background-color .2s',
                          ...(active ? activeHlSx : {}),
                          '&:hover': active ? {} : { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                        {s}
                      </Box>
                    );
                  })
                : b.text;
              if (b.t === 'h') {
                return (
                  <Typography key={i} sx={{ color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.6, mt: 3.5, mb: 1.25 }}>
                    {blockActive && reading && <EqBars />}
                    {sentenceNodes}
                  </Typography>
                );
              }
              return (
                <Typography key={i} sx={{ color: 'rgba(255,255,255,0.82)', fontSize: 14.5, lineHeight: 2.05, mb: 2.25 }}>
                  {blockActive && reading && <EqBars />}
                  {sentenceNodes}
                </Typography>
              );
            })}
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 3 }} />

            {/* 読了 → 議論へのシームレス導線（独立ウィンドウのみ） */}
            {onDiscuss && (
              <Box sx={{ textAlign: 'center', my: 4, p: 3, borderRadius: 3,
                bgcolor: 'rgba(229,115,115,0.06)', border: '1px solid rgba(229,115,115,0.3)' }}>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 15, mb: 0.75 }}>
                  読み終えたら、この記事についてAIと議論しませんか？
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, mb: 2, lineHeight: 1.7 }}>
                  AIが論点を出し、あなたの意見・経験を聞きます。<br />
                  議論を踏まえて、あなたの視点のブログ記事をAIが生成します。
                </Typography>
                <Button variant="contained" size="large" startIcon={<ForumRoundedIcon />}
                  onClick={onDiscuss}
                  sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 800, textTransform: 'none', px: 3, borderRadius: 2,
                    '&:hover': { bgcolor: '#ef5350' } }}>
                  AIと議論して記事を書く
                </Button>
              </Box>
            )}

            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>
              ※ 自動抽出{translated ? '・自動翻訳' : ''}のため、正確な内容・図版・続きは元記事でご覧ください。
              著作権は{source.source || '各メディア'}に帰属します。
            </Typography>
            <Button size="small" startIcon={<LaunchRoundedIcon sx={{ fontSize: '13px !important' }} />}
              onClick={() => void openReaderRaw(source.url, source.title)}
              sx={{ mt: 1, color: '#90caf9', textTransform: 'none', fontSize: 12, px: 1 }}>
              元記事を開く
            </Button>
          </Box>
        )}
      </Box>

      <TtsSettingsDialog open={ttsSettingsOpen} onClose={() => setTtsSettingsOpen(false)} />

      {/* 📖 選択した言葉の意味（フローティングカード） */}
      {lookup && (
        <Box ref={lookupRef}
          sx={{ position: 'fixed', zIndex: 1600,
            left: Math.min(Math.max(lookup.x, 190), (typeof window !== 'undefined' ? window.innerWidth : 800) - 190),
            top: Math.min(lookup.y + 8, (typeof window !== 'undefined' ? window.innerHeight : 600) - 160),
            transform: 'translateX(-50%)',
            bgcolor: '#171c26', border: '1px solid rgba(100,181,246,0.45)', borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)', maxWidth: 360 }}>
          {lookup.phase === 'ask' && (
            <Button size="small" startIcon={<MenuBookRoundedIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => void runLookup()}
              sx={{ color: '#90caf9', textTransform: 'none', fontSize: 12, px: 1.5, py: 0.75, whiteSpace: 'nowrap' }}>
              「{lookup.term.length > 14 ? `${lookup.term.slice(0, 14)}…` : lookup.term}」の意味を調べる
            </Button>
          )}
          {lookup.phase === 'loading' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1 }}>
              <CircularProgress size={13} sx={{ color: '#90caf9' }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>調べています…</Typography>
            </Box>
          )}
          {(lookup.phase === 'done' || lookup.phase === 'error') && (
            <Box sx={{ px: 1.75, py: 1.25 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#90caf9', mb: 0.5 }}>
                {lookup.term}{lookup.reading ? `（${lookup.reading}）` : ''}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 1.75 }}>
                {lookup.definition}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
