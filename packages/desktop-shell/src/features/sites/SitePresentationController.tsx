// プロジェクトサイトの「プレゼンモード」。
// AIナレーション（generateSiteNarration・キャッシュ付）をセクション順に読み上げながら、
// 読んでいるセクションへ自動スクロールする。提案の場（画面共有・プロジェクター）で
// サイト自体が「自動で語るプレゼン」になる。
// 音声は TtsSettings に従い、標準エンジン（Web Speech）と AI音声（Gemini TTS）を切替。

import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import type { SiteSection } from '../projects/types';
import { getSiteNarration, presentableSections, serializeSectionText } from './siteNarration';
import { speakSentences, splitSentences, stopSpeaking, pauseSpeaking, resumeSpeaking, getTtsSettings } from '../../lib/tts';
import { AiTtsPlayer, synthesizeAiTts } from '../../lib/aiTts';

interface Props {
  open: boolean;
  onClose: () => void;
  sections: SiteSection[];          // 表示中ページのセクション（未フィルタ）
  projectName: string;
  cacheId: string;                  // `${source.kind}-${source.id}:${pageId}`
  scrollToSection: (sectionId: string) => void;
  accent: string;
}

type Phase = 'preparing' | 'playing' | 'paused' | 'done';

export const SitePresentationController: React.FC<Props> = ({
  open, onClose, sections, projectName, cacheId, scrollToSection, accent,
}) => {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);

  // 表示中ページのプレゼン対象と原稿（narration 無しは本文直列化にフォールバック）
  const targetsRef = useRef<SiteSection[]>([]);
  const scriptsRef = useRef<string[]>([]);
  // 再生セッション世代（セクション送り/停止後に古いコールバックを無効化）
  const sessionRef = useRef(0);
  const playerRef = useRef<AiTtsPlayer | null>(null);
  // AI音声がプラン等で使えない場合、以降は標準エンジンに切り替える
  const aiFailedRef = useRef(false);

  const stopAllAudio = () => {
    sessionRef.current += 1;
    stopSpeaking();
    playerRef.current?.stop();
    playerRef.current = null;
  };

  const playSection = (idx: number) => {
    const targets = targetsRef.current;
    const scripts = scriptsRef.current;
    if (idx < 0) idx = 0;
    if (idx >= targets.length) {
      stopAllAudio();
      setPhase('done');
      return;
    }
    stopAllAudio();
    const my = sessionRef.current;
    setCurrentIdx(idx);
    setPhase('playing');
    scrollToSection(targets[idx].id);

    const settings = getTtsSettings();
    const useAi = settings.engine === 'ai' && !aiFailedRef.current;
    const script = scripts[idx];
    const next = () => { if (my === sessionRef.current) playSection(idx + 1); };

    if (useAi) {
      const player = new AiTtsPlayer();
      playerRef.current = player;
      player.play(
        [script],
        { voice: settings.aiVoice, style: settings.aiStyle, rate: settings.rate },
        {
          onEnd: next,
          onError: () => {
            // AI音声が使えない（プラン外・失敗）→ このセクションから標準エンジンで続行
            if (my !== sessionRef.current || aiFailedRef.current) return;
            aiFailedRef.current = true;
            player.stop();
            playSection(idx);
          },
        },
      );
      // 次セクションを先読み合成して切れ目を短くする（失敗は無視）
      if (idx + 1 < scripts.length) {
        synthesizeAiTts(scripts[idx + 1], { voice: settings.aiVoice, style: settings.aiStyle }).catch(() => { /* noop */ });
      }
    } else {
      speakSentences(splitSentences(script), { onEnd: next });
    }
  };

  const togglePause = () => {
    if (phase === 'playing') {
      if (playerRef.current) playerRef.current.pause();
      else pauseSpeaking();
      setPhase('paused');
    } else if (phase === 'paused') {
      if (playerRef.current) playerRef.current.resume();
      else resumeSpeaking();
      setPhase('playing');
    } else if (phase === 'done') {
      playSection(0);
    }
  };

  const handleClose = () => {
    stopAllAudio();
    onClose();
  };

  // 開始: 原稿を準備（キャッシュ即時 or CF生成）→ 先頭から自動再生
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPhase('preparing');
    setCurrentIdx(0);
    aiFailedRef.current = false;
    const targets = presentableSections(sections);
    targetsRef.current = targets;
    getSiteNarration(cacheId, projectName, sections).then((narrations) => {
      if (!alive) return;
      const byId = new Map((narrations ?? []).map((n) => [n.id, n.narration]));
      scriptsRef.current = targets.map((s) => byId.get(s.id) || serializeSectionText(s));
      setUsingFallback(!narrations);
      playSection(0);
    });
    return () => {
      alive = false;
      stopAllAudio();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const targets = targetsRef.current;
  const current = targets[currentIdx];

  return (
    <Box sx={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, display: 'flex', alignItems: 'center', gap: 0.5,
      bgcolor: 'rgba(15,18,26,0.92)', backdropFilter: 'blur(8px)',
      border: `1px solid ${accent}55`, borderRadius: 6,
      px: 1.5, py: 0.5, boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
      maxWidth: 'min(92%, 640px)',
    }}>
      {phase === 'preparing' ? (
        <>
          <CircularProgress size={14} sx={{ color: accent, mx: 0.5 }} />
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', px: 0.5, whiteSpace: 'nowrap' }}>
            プレゼン原稿を準備しています…
          </Typography>
        </>
      ) : (
        <>
          <Tooltip title="前のセクション">
            <span>
              <IconButton size="small" disabled={currentIdx <= 0 || phase === 'done'} onClick={() => playSection(currentIdx - 1)}
                sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: '#fff' } }}>
                <SkipPreviousRoundedIcon sx={{ fontSize: '1.15rem' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={phase === 'playing' ? '一時停止' : phase === 'done' ? '最初から再生' : '再開'}>
            <IconButton size="small" onClick={togglePause}
              sx={{ color: '#000', bgcolor: accent, '&:hover': { bgcolor: accent, opacity: 0.85 } }}>
              {phase === 'playing' ? <PauseRoundedIcon sx={{ fontSize: '1.2rem' }} />
                : phase === 'done' ? <ReplayRoundedIcon sx={{ fontSize: '1.2rem' }} />
                : <PlayArrowRoundedIcon sx={{ fontSize: '1.2rem' }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="次のセクション">
            <span>
              <IconButton size="small" disabled={currentIdx >= targets.length - 1 || phase === 'done'} onClick={() => playSection(currentIdx + 1)}
                sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: '#fff' } }}>
                <SkipNextRoundedIcon sx={{ fontSize: '1.15rem' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Typography sx={{
            fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', px: 0.75,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
          }}>
            {phase === 'done'
              ? 'プレゼン終了'
              : `${currentIdx + 1} / ${targets.length}${current?.title ? `・${current.title}` : ''}`}
            {usingFallback && phase !== 'done' && (
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.4)', ml: 0.75, fontSize: '0.62rem' }}>
                （本文をそのまま読み上げ中）
              </Box>
            )}
          </Typography>
        </>
      )}
      <Tooltip title="プレゼンを終了">
        <IconButton size="small" onClick={handleClose}
          sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#f87171' } }}>
          <StopRoundedIcon sx={{ fontSize: '1.15rem' }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
