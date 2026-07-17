/**
 * VideoSourcePane — SEKKEIYA Reader の「動画モード」表示。
 * YouTube 埋め込みプレイヤー＋現在位置に同期した日本語字幕＋クリックでシークできる字幕リスト。
 *
 * 再生位置の取得は YouTube IFrame の postMessage プロトコルを直接使う
 * （enablejsapi=1 の iframe へ {"event":"listening"} を送ると infoDelivery が返る方式。
 *   外部スクリプト（iframe_api）を読み込まないので Tauri WebView でも安全）。
 * 取得できない環境でも、埋め込み再生と字幕リストのクリックシークは機能する。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import SubtitlesRoundedIcon from '@mui/icons-material/SubtitlesRounded';
import { fmtVideoTime, type VideoSegment } from './lib/youtube';

const ACCENT = '#e57373';

interface Props {
  videoId: string;
  segments: VideoSegment[];
  /** 動画の要約（字幕が空のときの説明表示に使う） */
  summary?: string;
  /** AI解析（字幕・記事生成）が進行中。動画は先に再生でき、字幕は完了次第表示される */
  analyzing?: boolean;
}

export const VideoSourcePane: React.FC<Props> = ({ videoId, segments, summary, analyzing = false }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [gotTime, setGotTime] = useState(false); // postMessage 同期が効いているか

  // 再生位置の購読: listening を定期送信し、返ってくる infoDelivery の currentTime を拾う
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test((() => { try { return new URL(e.origin).hostname; } catch { return ''; } })())) return;
      if (typeof e.data !== 'string') return;
      try {
        const d = JSON.parse(e.data);
        const t = d?.info?.currentTime;
        if (typeof t === 'number' && Number.isFinite(t)) { setTime(t); setGotTime(true); }
      } catch { /* YouTube 以外のメッセージは無視 */ }
    };
    window.addEventListener('message', onMsg);
    const iv = setInterval(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: 'sekkeiya-reader', channel: 'widget' }), '*');
      } catch { /* noop */ }
    }, 700);
    return () => { window.removeEventListener('message', onMsg); clearInterval(iv); };
  }, [videoId]);

  const seek = (sec: number) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try {
      w.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [sec, true] }), '*');
      w.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    } catch { /* noop */ }
  };

  // 現在の字幕（区間外は直前の字幕を保持して「無音の空白」を減らす）
  const currentIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (time >= segments[i].s) idx = i; else break;
    }
    return idx;
  }, [segments, time]);
  const current = currentIdx >= 0 && time < (segments[currentIdx]?.e ?? 0) + 2 ? segments[currentIdx] : null;

  // アクティブ字幕をリスト内で追従スクロール（再生同期が効いているときのみ）。
  // ⚠️ scrollIntoView は親スクロール（本文全体）まで動かし、再生につれてページが
  // じわじわ流れて動画が画面外へ押し出される。リストの内側だけを scrollTo する。
  useEffect(() => {
    if (!gotTime || currentIdx < 0) return;
    const list = listRef.current;
    const el = list?.querySelector(`[data-seg="${currentIdx}"]`) as HTMLElement | null;
    if (!list || !el) return;
    const rel = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    list.scrollTo({ top: rel - list.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [currentIdx, gotTime]);

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* プレイヤー（16:9） */}
      <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 2.5, overflow: 'hidden',
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: '#000' }}>
        {/* hl=ja: プレイヤー言語を日本語に。多言語音声トラック（自動吹替含む）を持つ動画は
            視聴者の言語設定で既定トラックが決まるため、これが「日本語音声を既定にする」シグナルになる。
            cc_lang_pref=ja: CCを付けた場合の優先言語も日本語。 */}
        <Box component="iframe" ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&hl=ja&cc_lang_pref=ja&autoplay=1&playsinline=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen frameBorder={0}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
      </Box>

      {/* 現在の字幕（大きめ表示。同期が取れない環境では案内のみ） */}
      <Box sx={{ minHeight: 58, px: 2.5, py: 1.5, borderRadius: 2.5,
        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SubtitlesRoundedIcon sx={{ fontSize: 18, color: current ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.3)', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 15, lineHeight: 1.8, color: current ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: current ? 600 : 400 }}>
          {current ? current.text
            : segments.length === 0
              ? (analyzing
                ? '⏳ AIが日本語字幕と記事を生成しています…（この動画の初回のみ。動画はこのまま視聴できます）'
                : (summary || '字幕を生成できませんでした'))
            : gotTime ? '（再生中の発話がここに表示されます）'
            : '再生すると、ここに日本語字幕が表示されます'}
        </Typography>
      </Box>

      {/* 字幕リスト（クリックでその位置から再生） */}
      {segments.length > 0 && (
        <Box ref={listRef} sx={{ maxHeight: 340, overflowY: 'auto', borderRadius: 2.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', p: 1 }}>
          {segments.map((g, i) => {
            const active = i === currentIdx && gotTime;
            return (
              <Box key={i} data-seg={i} onClick={() => seek(g.s)}
                sx={{ display: 'flex', gap: 1.5, px: 1.25, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                  bgcolor: active ? 'rgba(229,115,115,0.12)' : 'transparent',
                  '&:hover': { bgcolor: active ? 'rgba(229,115,115,0.16)' : 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: active ? ACCENT : 'light-dark(#095fa5, #90caf9)',
                  fontVariantNumeric: 'tabular-nums', minWidth: 38, pt: '2px' }}>
                  {fmtVideoTime(g.s)}
                </Typography>
                <Typography sx={{ fontSize: 13, lineHeight: 1.75, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.75)' }}>
                  {g.text}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.7 }}>
        ※ 字幕・記事はAIによる自動生成（英語音声は日本語訳）です。正確な内容は動画本編でご確認ください。
        「記事」表示に切り替えると、動画の内容を日本語記事として読め、読み上げ（日本語音声）もできます。
      </Typography>
    </Box>
  );
};
