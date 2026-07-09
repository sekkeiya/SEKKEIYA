/**
 * BlogStrategyChat — 戦略画面の右サイドバーに常設するAIチャット。
 * AIが状況を踏まえて問いかけ、往復して方向性・戦略を具体化 →「戦略を確定」で要約・保存。
 * 保存した戦略は左のロードマップボードに反映され、planBlogContent（AI投稿計画）の最優先材料になる。
 *
 * 複数チャット対応: 戦略の議論はスレッドとして複数持てる（過去の検討ログを残しつつ、
 * 方向性が変わったら「新しいチャット」で切り替え）。すべて localStorage にスコープ別で永続化。
 * ボードは常に「最後に確定した戦略」を映すので、どのチャットがアクティブかとは独立。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, CircularProgress, Chip, Tooltip, Menu, MenuItem, Divider } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { speak, stopSpeaking, isTtsAvailable } from './lib/tts';
import { TtsSettingsDialog } from '../../components/tts/TtsSettingsDialog';
import { saveBlogStrategy, type BlogScope } from './api/blogStrategyApi';
import type { BlogStrategy } from './types';

interface Msg { role: 'ai' | 'user'; text: string; choices?: string[] }
interface Session { id: string; title: string; msgs: Msg[]; ready: boolean; updatedAt: number }

interface BlogStrategyChatProps {
  scope: BlogScope;
  uid: string;
  accent?: string;
  onSaved: (s: BlogStrategy) => void;
}

const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const NEW_TITLE = '新しいチャット';
const deriveTitle = (m: Msg[]): string => {
  const u = m.find((x) => x.role === 'user');
  const t = (u?.text || '').trim();
  return t ? (t.length > 22 ? `${t.slice(0, 22)}…` : t) : NEW_TITLE;
};

export const BlogStrategyChat: React.FC<BlogStrategyChatProps> = ({ scope, uid, accent = '#c084fc', onSaved }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const chatsKey = `sblog-strategy-chats-${scope}`;
  const legacyKey = `sblog-strategy-chat-${scope}`; // 旧・単一チャットの保存キー（移行用）

  const active = sessions.find((s) => s.id === activeId) || null;
  const msgs = active?.msgs ?? [];
  const ready = active?.ready ?? false;

  // 🔊 読み上げ: ONにするとAIの発言を音声で聞きながら戦略を議論できる。localStorageに記憶して既定維持。
  const VOICE_KEY = 'sblog-strategy-voice';
  const [voiceMode, setVoiceMode] = useState<boolean>(() => { try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; } });
  const voiceModeRef = useRef(voiceMode);
  const toggleVoice = () => setVoiceMode((v) => {
    const next = !v; voiceModeRef.current = next;
    try { localStorage.setItem(VOICE_KEY, next ? '1' : '0'); } catch { /* noop */ }
    if (!next) stopSpeaking();
    return next;
  });
  const [ttsSettingsOpen, setTtsSettingsOpen] = useState(false);
  useEffect(() => () => stopSpeaking(), []); // アンマウント時に停止

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, thinking]);

  // マウント時: 保存済みセッションを復元。無ければ旧・単一チャットを移行、それも無ければ新規＋口火。
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let loaded: Session[] = [];
    let savedActive = '';
    try {
      const raw = localStorage.getItem(chatsKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.sessions)) { loaded = p.sessions; savedActive = p.activeId || ''; }
      }
    } catch { /* ignore */ }
    if (!loaded.length) {
      try {
        const raw = localStorage.getItem(legacyKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && Array.isArray(s.msgs) && s.msgs.length) {
            loaded = [{ id: genId(), title: deriveTitle(s.msgs), msgs: s.msgs, ready: !!s.ready, updatedAt: Date.now() }];
          }
        }
      } catch { /* ignore */ }
    }
    if (loaded.length) {
      setSessions(loaded);
      setActiveId(loaded.some((s) => s.id === savedActive) ? savedActive : loaded[0].id);
      return;
    }
    const id = genId();
    setSessions([{ id, title: NEW_TITLE, msgs: [], ready: false, updatedAt: Date.now() }]);
    setActiveId(id);
    void turn(id, [], '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 永続化（タブ切替・リロードをまたいで残す）
  useEffect(() => {
    try { if (sessions.length) localStorage.setItem(chatsKey, JSON.stringify({ sessions, activeId })); } catch { /* noop */ }
  }, [sessions, activeId, chatsKey]);

  const turn = async (sid: string, history: Msg[], userMessage: string) => {
    setThinking(true);
    try {
      const fn = httpsCallable(functions, 'blogStrategy');
      const r: any = await fn({ mode: 'turn', scope, history: history.map((m) => ({ role: m.role, text: m.text })), userMessage });
      if (r.data?.success) {
        const newMsgs: Msg[] = [...history, ...(userMessage ? [{ role: 'user' as const, text: userMessage }] : []),
          { role: 'ai' as const, text: r.data.reply || '', choices: r.data.choices }];
        setSessions((prev) => prev.map((s) => s.id === sid
          ? { ...s, msgs: newMsgs, ready: !!r.data.ready, title: s.title === NEW_TITLE ? deriveTitle(newMsgs) : s.title, updatedAt: Date.now() }
          : s));
        if (voiceModeRef.current && r.data.reply) speak(r.data.reply); // 読み上げON: AI応答を音声で
      }
    } catch (e) {
      console.error('[BlogStrategyChat] turn failed', e);
    } finally {
      setThinking(false);
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking || !activeId) return;
    setInput('');
    void turn(activeId, msgs, t);
  };

  const newChat = () => {
    if (thinking || saving) return;
    stopSpeaking();
    setMenuAnchor(null);
    const id = genId();
    setSessions((prev) => [{ id, title: NEW_TITLE, msgs: [], ready: false, updatedAt: Date.now() }, ...prev]);
    setActiveId(id);
    setInput('');
    void turn(id, [], '');
  };

  const selectSession = (id: string) => {
    if (id === activeId) { setMenuAnchor(null); return; }
    stopSpeaking();
    setMenuAnchor(null);
    setActiveId(id);
    setInput('');
    // 空のセッション（口火前）を選んだら口火を切る
    const s = sessions.find((x) => x.id === id);
    if (s && s.msgs.length === 0) void turn(id, [], '');
  };

  const deleteSession = (id: string) => {
    stopSpeaking();
    const next = sessions.filter((s) => s.id !== id);
    if (!next.length) {
      const nid = genId();
      setSessions([{ id: nid, title: NEW_TITLE, msgs: [], ready: false, updatedAt: Date.now() }]);
      setActiveId(nid);
      setMenuAnchor(null);
      void turn(nid, [], '');
      return;
    }
    setSessions(next);
    if (id === activeId) setActiveId(next[0].id);
  };

  const confirm = async () => {
    if (saving || thinking || !active) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'blogStrategy');
      const r: any = await fn({ mode: 'save', scope, history: msgs.map((m) => ({ role: m.role, text: m.text })) });
      if (r.data?.success && r.data.strategy?.summary) {
        await saveBlogStrategy(scope, uid, r.data.strategy);
        onSaved(r.data.strategy);
        setSessions((prev) => prev.map((s) => s.id === activeId ? { ...s, ready: false } : s));
      }
    } catch (e) {
      console.error('[BlogStrategyChat] save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const userSpoke = msgs.some((m) => m.role === 'user');
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexShrink: 0 }}>
        <AutoAwesomeRoundedIcon sx={{ color: accent, fontSize: 19, mr: 0.5 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, color: 'var(--brand-fg)', fontSize: '0.9rem', lineHeight: 1.2 }}>AIと戦略を決める</Typography>
          <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{active && active.title !== NEW_TITLE ? active.title : '方向性を話す → 左のボードに反映'}</Typography>
        </Box>
        {isTtsAvailable() && (
          <Tooltip title={voiceMode ? '読み上げOFF' : '読み上げON（AIの発言を音声で聞けます）'}>
            <IconButton size="small" onClick={toggleVoice}
              sx={{ color: voiceMode ? accent : 'rgb(var(--brand-fg-rgb) / 0.45)', bgcolor: voiceMode ? `${accent}1f` : 'transparent' }}>
              {voiceMode ? <VolumeUpRoundedIcon sx={{ fontSize: 18 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="読み上げの設定">
          <IconButton size="small" onClick={() => setTtsSettingsOpen(true)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: accent } }}>
            <TuneRoundedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="チャット一覧・新規作成">
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: accent } }}>
            <ForumRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* チャット一覧メニュー */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2, minWidth: 260, maxWidth: 320 } }}>
        <MenuItem onClick={newChat} disabled={thinking || saving} sx={{ gap: 1, fontWeight: 700, color: accent }}>
          <AddRoundedIcon sx={{ fontSize: 18 }} />新しいチャット
        </MenuItem>
        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
        {sortedSessions.map((s) => (
          <MenuItem key={s.id} onClick={() => selectSession(s.id)} selected={s.id === activeId}
            sx={{ gap: 1, '&.Mui-selected': { bgcolor: `${accent}1a` }, '&.Mui-selected:hover': { bgcolor: `${accent}26` } }}>
            <CheckRoundedIcon sx={{ fontSize: 16, color: s.id === activeId ? accent : 'transparent' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: s.id === activeId ? 700 : 500, color: 'var(--brand-fg)' }}>{s.title}</Typography>
            </Box>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', p: 0.25, '&:hover': { color: '#ef4444' } }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </MenuItem>
        ))}
      </Menu>

      <TtsSettingsDialog open={ttsSettingsOpen} onClose={() => setTtsSettingsOpen(false)} title="読み上げの設定" />

      {/* スレッド */}
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {msgs.map((m, i) => {
          const isLast = i === msgs.length - 1;
          return (
            <React.Fragment key={i}>
              <Box sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', px: 1.5, py: 1, borderRadius: 2,
                bgcolor: m.role === 'user' ? `${accent}22` : 'rgb(var(--brand-fg-rgb) / 0.05)',
                border: `1px solid ${m.role === 'user' ? `${accent}55` : 'rgb(var(--brand-fg-rgb) / 0.08)'}` }}>
                <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
              {isLast && m.role === 'ai' && !thinking && Array.isArray(m.choices) && m.choices.length > 0 && (
                <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '94%' }}>
                  {m.choices.map((c, ci) => (
                    <Chip key={ci} label={c} size="small" onClick={() => send(c)}
                      sx={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 600, height: 26,
                        bgcolor: `${accent}1a`, color: 'light-dark(#742e7f, #ce93d8)', border: `1px solid ${accent}66`,
                        '&:hover': { bgcolor: accent, color: '#2a1233' } }} />
                  ))}
                </Box>
              )}
            </React.Fragment>
          );
        })}
        {thinking && (
          <Box sx={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
            <CircularProgress size={13} sx={{ color: accent }} />
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{msgs.length === 0 ? '状況を分析しています…' : '考え中…'}</Typography>
          </Box>
        )}
        {ready && !thinking && (
          <Box sx={{ alignSelf: 'stretch', px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(129,199,132,0.08)', border: '1px solid rgba(129,199,132,0.35)' }}>
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.75)', lineHeight: 1.7 }}>
              ✅ 方向性がまとまってきました。「戦略を確定」でボードに反映（続けて話してもOK）。
            </Typography>
          </Box>
        )}
      </Box>

      {/* 入力 */}
      <Box sx={{ pt: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 1 }}>
          <TextField fullWidth multiline maxRows={4} size="small" placeholder="考えを話す…（Enterで送信）"
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); send(input); } }}
            disabled={thinking || msgs.length === 0}
            sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 12.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '&.Mui-focused fieldset': { borderColor: accent } } }} />
          <IconButton onClick={() => send(input)} disabled={!input.trim() || thinking}
            sx={{ color: accent, bgcolor: `${accent}1f`, '&:hover': { bgcolor: `${accent}33` } }}>
            <SendRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Button fullWidth onClick={() => void confirm()} disabled={!userSpoke || saving || thinking} variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#2a1233' }} /> : <AutoAwesomeRoundedIcon />}
          sx={{ bgcolor: accent, color: '#2a1233', fontWeight: 800, textTransform: 'none', borderRadius: 2, '&:hover': { opacity: 0.9, bgcolor: accent } }}>
          {saving ? '保存中…' : '戦略を確定してボードに反映'}
        </Button>
      </Box>
    </Box>
  );
};
