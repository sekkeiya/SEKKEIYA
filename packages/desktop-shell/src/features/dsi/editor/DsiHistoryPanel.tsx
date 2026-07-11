/**
 * DsiHistoryPanel — S.Image エディター右パネル「生成履歴」タブ。
 * 選択中チャット（useDsiEditorStore）の生成画像を新しい順にサムネイル一覧表示する。
 * クリックで中央プレビューに反映（setSelectedImage）。
 */
import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useDsiEditorStore } from '../store/useDsiEditorStore';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';

export const DsiHistoryPanel: React.FC = () => {
  const branches = useDsiEditorStore((s) => s.branches);
  const selectedImageUrl = useDsiEditorStore((s) => s.selectedImageUrl);
  const setSelectedImage = useDsiEditorStore((s) => s.setSelectedImage);

  // 全系統の完了画像を新しい順に。直前のユーザー発話をプロンプトとして添える。
  const items = useMemo(() => {
    const out: { id: string; url: string; prompt: string }[] = [];
    for (const b of branches) {
      for (let i = 0; i < b.messages.length; i++) {
        const m = b.messages[i];
        if (m.role === 'assistant' && m.status === 'done' && m.imageUrl) {
          let prompt = '';
          for (let j = i - 1; j >= 0; j--) {
            if (b.messages[j].role === 'user' && b.messages[j].text) { prompt = b.messages[j].text!; break; }
          }
          out.push({ id: m.id, url: m.imageUrl, prompt });
        }
      }
    }
    return out.reverse();
  }, [branches]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'uppercase' }}>
          生成履歴
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{items.length} 枚</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {items.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', px: 1, py: 3, textAlign: 'center' }}>
            このチャットの生成画像はまだありません。<br />「チャット」タブで生成してください。
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {items.map((it) => {
              const active = selectedImageUrl === it.url;
              return (
                <Box key={it.id} onClick={() => setSelectedImage(it.url)}
                  sx={{
                    borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                    border: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                    bgcolor: 'var(--brand-bg)',
                    '&:hover': { borderColor: active ? ACCENT : `${ACCENT}66` },
                  }}>
                  <Box sx={{ width: '100%', aspectRatio: '4 / 3', bgcolor: 'var(--brand-bg)' }}>
                    <img src={it.url} alt={it.prompt} loading="lazy" title={it.prompt}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </Box>
                  {it.prompt && (
                    <Typography noWrap sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', px: 0.5, py: 0.25 }}>
                      {it.prompt}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DsiHistoryPanel;
