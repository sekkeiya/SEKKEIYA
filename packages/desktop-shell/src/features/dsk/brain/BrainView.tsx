// S.Library「外付け脳（RAG）」ビュー。
// AIが回答の根拠に使う知識（RAG索引済み）を、カテゴリ別に俯瞰する“脳の地図”。
// 実体は S.Library の LibraryEntry のうち RAG 取り込み済みのもの。追加はライブラリで
// 「RAGソースを選択」、ここでは状態の可視化と追加導線を担う。
import React, { useEffect, useMemo } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import { useDskStore } from '../store/useDskStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { isEntryIngested } from '../lib/ragIngest';

const PURPLE = '#a855f7';

export const BrainView: React.FC = () => {
  const { entries, setView, setRagSelectMode, setSelectedId } = useDskStore();
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const knowledgeSources = useAiProfileStore((s) => s.knowledgeSources);
  const loadKnowledgeSources = useAiProfileStore((s) => s.loadKnowledgeSources);

  useEffect(() => { if (uid) loadKnowledgeSources(uid); }, [uid, loadKnowledgeSources]);

  // RAG 取り込み済みのエントリ＝「脳に入っている知識」。
  const inBrain = useMemo(
    () => entries.filter((e) => isEntryIngested(e, knowledgeSources)),
    [entries, knowledgeSources],
  );

  // カテゴリ別にグルーピング（脳の地図）。
  const byCategory = useMemo(() => {
    const map = new Map<string, typeof inBrain>();
    for (const e of inBrain) {
      const c = e.category || 'その他';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [inBrain]);

  const addToBrain = () => { setRagSelectMode(true); setView('library'); };
  const openEntry = (id: string) => { setSelectedId(id); setView('library'); };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', px: 4, py: 3, bgcolor: 'background.default' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${PURPLE}22`, border: `1px solid ${PURPLE}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PsychologyRoundedIcon sx={{ color: PURPLE }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>外付け脳（RAG）</Typography>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 12.5, mt: 0.5 }}>
            ここに入っている知識を、SEKKEIYA OS が回答の<b style={{ color: 'var(--brand-fg)' }}>根拠</b>として使います。S.Library の資料を「脳」に取り込むと有効になります。
          </Typography>
        </Box>
        <Button
          onClick={addToBrain}
          variant="contained" startIcon={<AddRoundedIcon />}
          sx={{ bgcolor: PURPLE, color: 'var(--brand-fg)', fontWeight: 700, textTransform: 'none', flexShrink: 0, '&:hover': { bgcolor: '#9333ea' } }}
        >
          知識を脳に追加
        </Button>
      </Box>

      {/* サマリー */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>脳に入っている知識</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>{inBrain.length}</Typography>
        </Box>
        <Box sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>カテゴリ数</Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>{byCategory.length}</Typography>
        </Box>
      </Box>

      {/* 空状態 */}
      {inBrain.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'rgb(var(--brand-fg-rgb) / 0.4)', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2 }}>
          <PsychologyRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ mb: 2 }}>まだ脳に知識が入っていません。</Typography>
          <Button onClick={addToBrain} variant="outlined" startIcon={<AutoStoriesRoundedIcon />} sx={{ color: PURPLE, borderColor: `${PURPLE}77`, textTransform: 'none' }}>
            S.Library から知識を取り込む
          </Button>
        </Box>
      ) : (
        // カテゴリ別の地図
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {byCategory.map(([cat, items]) => (
            <Box key={cat}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ color: 'var(--brand-fg)', fontSize: 14, fontWeight: 700 }}>{cat}</Typography>
                <Chip size="small" label={items.length} sx={{ height: 18, fontSize: 10, bgcolor: `${PURPLE}33`, color: 'var(--brand-fg)' }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {items.map((e) => (
                  <Box
                    key={e.localId}
                    onClick={() => openEntry(e.localId)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: 1.5,
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
                      cursor: 'pointer', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
                    }}
                  >
                    <PsychologyRoundedIcon sx={{ fontSize: 16, color: PURPLE, flexShrink: 0 }} />
                    <Typography noWrap sx={{ flex: 1, color: 'var(--brand-fg)', fontSize: 13 }}>{e.title}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', flexShrink: 0 }}>{e.kind}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
