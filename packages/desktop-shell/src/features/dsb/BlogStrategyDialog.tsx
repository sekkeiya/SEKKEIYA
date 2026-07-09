/**
 * BlogStrategyDialog — AIとブログ運営戦略・目標を議論して決めるチャットダイアログ。
 * AIが状況を踏まえて問いかけ、往復して戦略を具体化 →「戦略を確定」で要約・保存。
 * 保存した戦略は planBlogContent（AI投稿計画）が最優先の材料として使う。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, CircularProgress, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { saveBlogStrategy, type BlogScope } from './api/blogStrategyApi';
import type { BlogStrategy } from './types';

interface Msg { role: 'ai' | 'user'; text: string; choices?: string[] }

interface BlogStrategyDialogProps {
  open: boolean;
  scope: BlogScope;
  uid: string;
  accent?: string;
  onClose: () => void;
  onSaved: (s: BlogStrategy) => void;
}

export const BlogStrategyDialog: React.FC<BlogStrategyDialogProps> = ({ open, scope, uid, accent = '#ce93d8', onClose, onSaved }) => {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, thinking]);

  // 開いたら口火（状況を踏まえた最初の問い）
  useEffect(() => {
    if (!open) { startedRef.current = false; setMsgs([]); setReady(false); setInput(''); return; }
    if (startedRef.current) return;
    startedRef.current = true;
    void turn([], '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const turn = async (history: Msg[], userMessage: string) => {
    setThinking(true);
    try {
      const fn = httpsCallable(functions, 'blogStrategy');
      const r: any = await fn({ mode: 'turn', scope, history: history.map((m) => ({ role: m.role, text: m.text })), userMessage });
      if (r.data?.success) {
        setReady(!!r.data.ready);
        setMsgs([...history, ...(userMessage ? [{ role: 'user' as const, text: userMessage }] : []),
          { role: 'ai' as const, text: r.data.reply || '', choices: r.data.choices }]);
      }
    } catch (e) {
      console.error('[BlogStrategyDialog] turn failed', e);
    } finally {
      setThinking(false);
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    void turn(msgs, t);
  };

  const confirm = async () => {
    if (saving || thinking) return;
    setSaving(true);
    try {
      const fn = httpsCallable(functions, 'blogStrategy');
      const r: any = await fn({ mode: 'save', scope, history: msgs.map((m) => ({ role: m.role, text: m.text })) });
      if (r.data?.success && r.data.strategy?.summary) {
        await saveBlogStrategy(scope, uid, r.data.strategy);
        onSaved(r.data.strategy);
        onClose();
      }
    } catch (e) {
      console.error('[BlogStrategyDialog] save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const userSpoke = msgs.some((m) => m.role === 'user');

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, height: '76vh' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <AutoAwesomeRoundedIcon sx={{ color: accent, fontSize: 20 }} />
        AIと戦略・目標を決める
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} disabled={saving} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, p: 0 }}>
        <Typography sx={{ px: 3, pb: 1, fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.6 }}>
          どんな読者に何を届けたいか、どう宣伝したいかをAIと話して戦略を固めます。決めた戦略はAI投稿計画に反映されます。
        </Typography>
        {/* スレッド */}
        <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            return (
              <React.Fragment key={i}>
                <Box sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', px: 1.5, py: 1, borderRadius: 2,
                  bgcolor: m.role === 'user' ? `${accent}22` : 'rgb(var(--brand-fg-rgb) / 0.05)',
                  border: `1px solid ${m.role === 'user' ? `${accent}55` : 'rgb(var(--brand-fg-rgb) / 0.08)'}` }}>
                  <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                </Box>
                {isLast && m.role === 'ai' && !thinking && Array.isArray(m.choices) && m.choices.length > 0 && (
                  <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '92%' }}>
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
                ✅ 戦略がまとまってきました。下の「戦略を確定」で保存できます（続けて話してもOK）。
              </Typography>
            </Box>
          )}
        </Box>
        {/* 入力 */}
        <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>閉じる</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => void confirm()} disabled={!userSpoke || saving || thinking} variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#2a1233' }} /> : <AutoAwesomeRoundedIcon />}
          sx={{ bgcolor: accent, color: '#2a1233', fontWeight: 800, textTransform: 'none', '&:hover': { opacity: 0.9, bgcolor: accent } }}>
          {saving ? '保存中…' : '戦略を確定'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
