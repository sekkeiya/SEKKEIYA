/**
 * BlogAiDialogue — S.Blog「AIと議論して書く」右パネル
 *
 * 記事（下書き）を挟んで AI と対話し、あなたの考え・経験を引き出す。
 * 最後に「議論を記事に反映」すると、あなたの発言が記事の主張として織り込まれる。
 * 対話ログは draft.aiDialogue に保存（自動保存に乗って永続化・途中再開可）。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, CircularProgress, Tooltip, Chip, Collapse } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { speak, stopSpeaking, isTtsAvailable } from './lib/tts';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { useDsbStore } from './store/useDsbStore';
import type { BlogDialogueMsg } from './types';

// 出典リンクを開く（Tauriは既定ブラウザ、Webは新規タブ）
async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

const ACCENT = '#e57373';

interface BlogAiDialogueProps {
  onToast: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const BlogAiDialogue: React.FC<BlogAiDialogueProps> = ({ onToast }) => {
  const { draft, updateDraft } = useDsbStore();
  const messages: BlogDialogueMsg[] = draft?.aiDialogue ?? [];
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);   // AIの応答待ち
  const [reflecting, setReflecting] = useState(false); // 記事へ反映中
  const [sourcesOpen, setSourcesOpen] = useState(true); // 題材記事の折りたたみ
  const scrollRef = useRef<HTMLDivElement>(null);

  const userSpoke = messages.some((m) => m.role === 'user' && m.text.trim());
  const sourceRefs = draft?.sourceRefs ?? [];
  // 議論ファースト（ホームのフィード発）: 下書きが無く、題材記事だけがある状態。
  // 議論→「議論から記事を生成」の順で書く。
  const discussFirst = !draft?.bodyMarkdown?.trim() && sourceRefs.length > 0;
  // 題材記事の本文キャッシュ（サーバーが初回取得して返す。以後のターンは送り返して再取得を回避）
  const sourceTextRef = useRef<string>('');

  // 🔊 音声モード: ONにするとAIの応答を読み上げる（本文を書きながら耳で議論できる）
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const toggleVoice = () => {
    setVoiceMode((v) => {
      voiceModeRef.current = !v;
      if (v) stopSpeaking();
      return !v;
    });
  };
  useEffect(() => () => stopSpeaking(), []); // アンマウント時に停止

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking]);

  // 議論ファーストは自動開始: フィードから来たら即「記事を読んで要約→最初の質問」まで進める。
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (discussFirst && messages.length === 0 && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void callTurn([], '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushMessages = (next: BlogDialogueMsg[]) => updateDraft({ aiDialogue: next });

  /** AIの1ターン（history 空 + 発言なし = 口火） */
  const callTurn = async (history: BlogDialogueMsg[], userMessage: string) => {
    if (!draft) return;
    setThinking(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({
        mode: 'turn',
        title: draft.title,
        bodyMarkdown: draft.bodyMarkdown,
        history: history.map((m) => ({ role: m.role, text: m.text })),
        userMessage,
        sourceRefs: (draft.sourceRefs ?? []).map((s) => ({ title: s.title, url: s.url, source: s.source, summary: s.summary })),
        sourceText: sourceTextRef.current, // 2ターン目以降は再取得を回避
      });
      if (r.data?.success && r.data.reply) {
        if (r.data.sourceText) sourceTextRef.current = r.data.sourceText;
        if (voiceModeRef.current) speak(r.data.reply); // 音声モード: AI応答を読み上げ
        const now = new Date().toISOString();
        // 初回は記事の日本語要約カードを先に挟む（英語記事は翻訳済み）
        const summaryMsgs: BlogDialogueMsg[] = r.data.summary && (r.data.summary.overview || r.data.summary.points?.length)
          ? [{
              role: 'ai' as const,
              kind: 'summary' as const,
              text: [r.data.summary.overview, ...(r.data.summary.points || []).map((p: string) => `・${p}`)].filter(Boolean).join('\n'),
              ts: now,
            }]
          : [];
        pushMessages([...history, ...(userMessage ? [{ role: 'user' as const, text: userMessage, ts: now }] : []),
          ...summaryMsgs,
          { role: 'ai' as const, text: r.data.reply, ts: now,
            ...(Array.isArray(r.data.choices) && r.data.choices.length ? { choices: r.data.choices } : {}) }]);
      } else {
        onToast(`AIの応答に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast(`AIの応答に失敗しました: ${e.message}`, 'error');
    } finally {
      setThinking(false);
    }
  };

  const handleStart = () => callTurn([], '');

  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    callTurn(messages, text);
  };

  /** 議論ログを記事へ反映（synthesize） */
  const handleReflect = async () => {
    if (!draft || reflecting) return;
    setReflecting(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({
        mode: 'synthesize',
        title: draft.title,
        bodyMarkdown: draft.bodyMarkdown,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
        sourceRefs: (draft.sourceRefs ?? []).map((s) => ({ title: s.title, url: s.url, source: s.source, summary: s.summary })),
        sourceText: sourceTextRef.current,
      });
      if (r.data?.success) {
        updateDraft({
          title: r.data.title || draft.title,
          excerpt: r.data.excerpt || draft.excerpt,
          bodyMarkdown: r.data.bodyMarkdown || draft.bodyMarkdown,
          ...(r.data.generated && Array.isArray(r.data.tags) && r.data.tags.length && !(draft.tags?.length) ? { tags: r.data.tags } : {}),
        });
        onToast(r.data.generated
          ? '議論を踏まえて記事を生成しました。本文を確認・編集してください。'
          : '議論の内容を記事に反映しました。本文を確認してください。', 'success');
      } else {
        onToast(`反映に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast(`反映に失敗しました: ${e.message}`, 'error');
    } finally {
      setReflecting(false);
    }
  };

  const handleReset = () => pushMessages([]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダー */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ForumRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>AIと議論して書く</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>あなたの考えを話すほど、記事に反映されます</Typography>
        </Box>
        {isTtsAvailable() && (
          <Tooltip title={voiceMode ? '読み上げOFF' : '読み上げON（AIの発言を音声で聞きながら書けます）'}>
            <IconButton size="small" onClick={toggleVoice}
              sx={{ color: voiceMode ? ACCENT : 'rgba(255,255,255,0.4)', bgcolor: voiceMode ? `${ACCENT}1f` : 'transparent' }}>
              {voiceMode ? <VolumeUpRoundedIcon sx={{ fontSize: 16 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
        {messages.length > 0 && (
          <Tooltip title="議論をリセット">
            <IconButton size="small" onClick={handleReset} sx={{ color: 'rgba(255,255,255,0.4)' }}>
              <RestartAltRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 題材にしたWeb記事（出典）。リンクで原文を確認しながら議論できる */}
      {sourceRefs.length > 0 && (
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <Box onClick={() => setSourcesOpen((v) => !v)}
            sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
            <LinkRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', flex: 1 }}>
              題材にした記事（{sourceRefs.length}）
            </Typography>
            <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', transform: sourcesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </Box>
          <Collapse in={sourcesOpen}>
            <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sourceRefs.slice(0, 5).map((s, i) => (
                <Box key={i} onClick={() => void openExternal(s.url)}
                  sx={{ px: 1, py: 0.6, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    '&:hover': { borderColor: 'rgba(229,115,115,0.5)' } }}>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {s.source || 'Web'}{s.summary ? ` — ${s.summary}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* スレッド */}
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {messages.length === 0 && !thinking && (
          <Box sx={{ m: 'auto', textAlign: 'center', px: 2 }}>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, mb: 2 }}>
              {discussFirst ? (
                <>この記事を読みながらAIと議論しませんか？<br />
                AIが記事の要点と論点を出し、あなたの意見・経験を聞きます。<br />
                議論を踏まえて、あなたの視点の記事をAIが生成します。</>
              ) : (
                <>この記事についてAIと議論しませんか？<br />
                AIが論点を出し、あなたの意見・経験を聞きます。<br />
                議論した内容は「あなたの主張」として記事に反映できます。</>
              )}
            </Typography>
            <Button variant="contained" startIcon={<ForumRoundedIcon />} onClick={handleStart}
              disabled={!draft?.bodyMarkdown?.trim() && sourceRefs.length === 0}
              sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef5350' } }}>
              議論を始める
            </Button>
            {!draft?.bodyMarkdown?.trim() && sourceRefs.length === 0 && (
              <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', mt: 1 }}>まず本文（下書き）を用意してください</Typography>
            )}
          </Box>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const showChoices = isLast && m.role === 'ai' && !thinking && Array.isArray(m.choices) && m.choices.length > 0;
          // 📄 記事の日本語要約カード（議論ファーストの冒頭）
          if (m.kind === 'summary') {
            return (
              <Box key={i} sx={{ alignSelf: 'stretch', px: 1.5, py: 1.25, borderRadius: 2,
                bgcolor: 'rgba(100,181,246,0.07)', border: '1px solid rgba(100,181,246,0.3)' }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#90caf9', letterSpacing: 0.5, mb: 0.5 }}>
                  📄 記事の要約{sourceRefs.some((s) => /[a-zA-Z]/.test(s.title) && !/[ぁ-んァ-ン一-龯]/.test(s.title)) ? '（日本語訳）' : ''}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
            );
          }
          return (
            <React.Fragment key={i}>
              <Box sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                px: 1.5, py: 1, borderRadius: 2,
                bgcolor: m.role === 'user' ? 'rgba(229,115,115,0.16)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(229,115,115,0.35)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
              {/* タップだけで答えられる選択肢（最新のAI発言にのみ表示） */}
              {showChoices && (
                <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '92%' }}>
                  {m.choices!.map((c, ci) => (
                    <Chip key={ci} label={c} size="small"
                      onClick={() => callTurn(messages, c)}
                      sx={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 600, height: 26,
                        bgcolor: 'rgba(229,115,115,0.1)', color: '#ffb4a9', border: '1px solid rgba(229,115,115,0.4)',
                        '&:hover': { bgcolor: '#e57373', color: '#000' } }} />
                  ))}
                </Box>
              )}
            </React.Fragment>
          );
        })}
        {thinking && (
          <Box sx={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
            <CircularProgress size={13} sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
              {messages.length === 0 && discussFirst ? '記事を読んで要約しています…' : '考え中…'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 入力 */}
      <Box sx={{ p: 1.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth multiline maxRows={4} size="small"
            placeholder="あなたの考えを話す…（Enterで送信）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={thinking || messages.length === 0}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff', fontSize: 12.5, bgcolor: 'rgba(255,255,255,0.04)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
            }}
          />
          <IconButton onClick={handleSend} disabled={!input.trim() || thinking || messages.length === 0}
            sx={{ color: ACCENT, bgcolor: 'rgba(229,115,115,0.12)', '&:hover': { bgcolor: 'rgba(229,115,115,0.22)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' } }}>
            <SendRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Button
          fullWidth variant="contained" onClick={handleReflect}
          disabled={!userSpoke || reflecting || thinking}
          startIcon={reflecting ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <AutoFixHighRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 1, bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, fontSize: 12.5,
            '&:hover': { bgcolor: '#ef5350' }, '&.Mui-disabled': { bgcolor: 'rgba(229,115,115,0.25)', color: 'rgba(0,0,0,0.5)' } }}>
          {reflecting ? (discussFirst ? '生成中…' : '反映中…') : (discussFirst ? '✨ 議論から記事を生成する' : '議論を記事に反映する')}
        </Button>
        {!userSpoke && messages.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', mt: 0.5, textAlign: 'center' }}>
            あなたの発言が1つ以上あると反映できます
          </Typography>
        )}
      </Box>
    </Box>
  );
};
