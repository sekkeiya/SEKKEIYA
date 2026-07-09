import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Chip, Divider, InputAdornment,
  ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, CircularProgress,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { useAuthStore } from '../../store/useAuthStore';
import { OfficialBodyEditor } from './OfficialBodyEditor';
import type { OfficialStatus } from './officialTypes';

const ACCENT = '#38bdf8'; // 公式モードは水色（アカウントブログの赤 #e57373 と区別）

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
} as const;

const slugify = (s: string) =>
  (s || '').trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '');

interface OfficialBlogEditorProps {
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const OfficialBlogEditor: React.FC<OfficialBlogEditorProps> = ({ onToast }) => {
  const { draft, updateDraft, cancelEdit, save } = useOfficialBlogStore();
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  if (!draft) return null;

  const handleSave = async () => {
    if (!draft.title.trim()) { onToast?.('タイトルを入力してください', 'info'); return; }
    setSaving(true);
    try {
      const ok = await save({ uid: currentUser?.uid ?? null, displayName: currentUser?.displayName || currentUser?.email || 'Admin' });
      if (ok) onToast?.(draft.status === 'published' ? '公開しました' : '保存しました', 'success');
      else onToast?.('保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!draft.tags.includes(t)) updateDraft({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* ツールバー */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.5, bgcolor: 'rgba(20,22,27,0.92)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={cancelEdit} startIcon={<ArrowBackRoundedIcon />} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>
          一覧へ
        </Button>
        <Chip label="公式ブログ" size="small" sx={{ height: 22, fontWeight: 700, fontSize: '0.68rem', color: ACCENT, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55` }} />
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          size="small" exclusive value={draft.status}
          onChange={(_e, v: OfficialStatus | null) => v && updateDraft({ status: v })}
          sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', fontSize: 12, px: 1.25 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` } }}
        >
          <ToggleButton value="draft">下書き</ToggleButton>
          <ToggleButton value="interview">🎤 取材待ち</ToggleButton>
          <ToggleButton value="review">🤖 レビュー</ToggleButton>
          <ToggleButton value="published">公開</ToggleButton>
        </ToggleButtonGroup>
        <Button onClick={() => void handleSave()} disabled={saving || !draft.title.trim()} variant="contained" startIcon={saving ? <CircularProgress size={15} sx={{ color: '#000' }} /> : <SaveRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0ea5e9' } }}>
          {saving ? '保存中...' : (draft.status === 'published' ? '保存・公開' : '保存')}
        </Button>
      </Box>

      {/* 本文 ＋ 右設定 */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', px: 4, py: 3, gap: 2, overflow: 'hidden' }}>
          <TextField
            value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="タイトルを入力" variant="standard" fullWidth InputProps={{ disableUnderline: true }}
            sx={{ flexShrink: 0, '& .MuiInputBase-input': { color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.3, '&::placeholder': { color: 'rgba(255,255,255,0.3)', opacity: 1 } } }}
          />
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
          {draft.contentFormat === 'markdown' ? (
            // 旧 Markdown 記事はプレーンテキストで編集（HTML変換で壊さない）。
            <TextField
              value={draft.body} onChange={(e) => updateDraft({ body: e.target.value })}
              multiline minRows={18} fullWidth placeholder="本文（Markdown・旧互換）"
              sx={{ ...fieldSx, '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], fontFamily: 'monospace', color: '#a3e635', bgcolor: 'rgba(0,0,0,0.3)' } }}
            />
          ) : (
            <OfficialBodyEditor value={draft.body} onChange={(html) => updateDraft({ body: html, contentFormat: 'html' })} />
          )}
        </Box>

        {/* 右：公開設定 */}
        <Box sx={{ width: 340, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(10,15,25,0.4)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, px: 2.5, py: 3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>公開設定</Typography>

          <TextField
            label="スラッグ (URL)" value={draft.slug} onChange={(e) => updateDraft({ slug: e.target.value })}
            placeholder={slugify(draft.title) || 'my-first-post'} fullWidth size="small" sx={fieldSx}
            InputProps={{ startAdornment: <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.4)', '& p': { fontSize: 13 } }}>/articles/</InputAdornment> }}
          />

          <FormControlLabel
            sx={{ ml: 0 }}
            control={<Switch checked={draft.featured} onChange={(e) => updateDraft({ featured: e.target.checked })} sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />}
            label={<Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>おすすめ記事に設定</Typography>}
          />

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>カテゴリ・タグ</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="カテゴリ名" value={draft.categoryName} onChange={(e) => updateDraft({ categoryName: e.target.value })} fullWidth size="small" sx={fieldSx} />
            <TextField label="スラッグ" value={draft.categorySlug} onChange={(e) => updateDraft({ categorySlug: e.target.value })} placeholder={slugify(draft.categoryName)} fullWidth size="small" sx={fieldSx} />
          </Box>

          <Box>
            <TextField
              label="タグを追加（Enter）" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              fullWidth size="small" sx={fieldSx}
            />
            {draft.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {draft.tags.map((t) => (
                  <Chip key={t} label={t} size="small" onDelete={() => updateDraft({ tags: draft.tags.filter((x) => x !== t) })}
                    sx={{ bgcolor: `${ACCENT}33`, color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.6)' } }} />
                ))}
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>メディア & SEO</Typography>

          <TextField label="カバー画像 URL" value={draft.coverUrl} onChange={(e) => updateDraft({ coverUrl: e.target.value })} fullWidth size="small" sx={fieldSx} />
          {draft.coverUrl && (
            <Box sx={{ width: '100%', height: 120, backgroundImage: `url(${draft.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }} />
          )}
          <TextField label="抜粋 (meta description / OGP)" value={draft.excerpt} onChange={(e) => updateDraft({ excerpt: e.target.value })} fullWidth multiline minRows={3} size="small" sx={fieldSx} />
          <TextField label="SEO タイトル (任意)" value={draft.seoTitle} onChange={(e) => updateDraft({ seoTitle: e.target.value })} fullWidth size="small" sx={fieldSx} />
          <TextField label="SEO ディスクリプション (任意)" value={draft.seoDescription} onChange={(e) => updateDraft({ seoDescription: e.target.value })} fullWidth multiline rows={2} size="small" sx={fieldSx} />

          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, mt: 'auto' }}>
            ※ AI記者の取材・図解/AI画像の挿入・仕上げは Content Strategy（後続フェーズ）で連携します。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
