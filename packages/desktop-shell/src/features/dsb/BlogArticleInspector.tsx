/**
 * BlogArticleInspector — 一覧で記事を選択したときに右側へ出す設定インスペクター。
 * フルエディタ（本文）を開かずに、その記事の設定（タイトル/スラッグ/カテゴリ/公開先/
 * 抜粋/タグ/状況）をその場で編集する。
 * 保存はグローバルの自動保存設定に依存させず、テキストは blur 時・選択/トグル/タグは即時に
 * クラウドへ確実に保存する（行を切り替える/閉じるときも focus が外れて保存される）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, MenuItem, Chip, InputAdornment, IconButton, Tooltip,
  ToggleButton, ToggleButtonGroup, Divider, Button,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useAppStore } from '../../store/useAppStore';
import { useDsbStore } from './store/useDsbStore';
import { BLOG_CATEGORIES, type BlogArticle, type BlogPublishTarget, type BlogStatus } from './types';
import { slugify } from './lib/blogUtils';

const ACCENT = '#e57373';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

const selectMenuProps = {
  MenuProps: {
    PaperProps: {
      sx: {
        bgcolor: '#1a1c22', backgroundImage: 'none', color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        '& .MuiMenuItem-root': {
          fontSize: 14,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
          '&.Mui-selected': { bgcolor: `${ACCENT}44` },
          '&.Mui-selected:hover': { bgcolor: `${ACCENT}55` },
        },
      },
    },
  },
} as const;

const settingsOf = (a: BlogArticle): Partial<BlogArticle> => ({
  title: a.title, slug: a.slug, category: a.category,
  publishTarget: a.publishTarget, excerpt: a.excerpt, tags: a.tags, status: a.status,
});

interface Props {
  article: BlogArticle;
  uid?: string;
  onClose: () => void;
  onOpenEditor: (id: string) => void;
}

export const BlogArticleInspector: React.FC<Props> = ({ article, uid, onClose, onOpenEditor }) => {
  const projects = useAppStore((s) => s.projects);
  const categories = useDsbStore((s) => s.categories);
  const patchArticle = useDsbStore((s) => s.patchArticle);

  // 編集対象のローカルコピー（記事が切り替わったら作り直す）。
  const [local, setLocal] = useState<BlogArticle>(article);
  const [tagInput, setTagInput] = useState('');
  useEffect(() => { setLocal(article); setTagInput(''); }, [article.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // テキスト入力中は state のみ更新（保存は blur 時）。
  const patch = (p: Partial<BlogArticle>) => setLocal((prev) => ({ ...prev, ...p }));
  // 即時保存（選択/トグル/タグ/blur）。最新値を組み立ててクラウドへ。
  const commit = (p: Partial<BlogArticle>) => {
    const next = { ...local, ...p };
    setLocal(next);
    if (uid) patchArticle(uid, next.id, settingsOf(next));
  };
  const flushText = () => { if (uid) patchArticle(uid, local.id, settingsOf(local)); };

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...BLOG_CATEGORIES, ...categories]);
    if (local.category) set.add(local.category);
    return [...set];
  }, [categories, local.category]);

  const targetValue = local.publishTarget.scope === 'account' ? 'account' : local.publishTarget.projectId;
  const handleTargetChange = (val: string) => {
    if (val === 'account') commit({ publishTarget: { scope: 'account' } });
    else {
      const p = projects.find((pr) => pr.id === val);
      const next: BlogPublishTarget = { scope: 'project', projectId: val, projectName: p?.name };
      commit({ publishTarget: next });
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !local.tags.includes(t)) commit({ tags: [...local.tags, t] });
    setTagInput('');
  };

  return (
    <Box sx={{
      width: 340, flexShrink: 0, height: '100%',
      borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(10,15,25,0.6)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, px: 2.5, py: 2.5,
    }}>
      {/* ヘッダ */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          記事の設定
        </Typography>
        <Tooltip title="閉じる"><IconButton size="small" onClick={() => { flushText(); onClose(); }} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      </Box>

      {/* タイトル */}
      <TextField
        label="タイトル" value={local.title}
        onChange={(e) => patch({ title: e.target.value })}
        onBlur={flushText}
        fullWidth size="small" sx={fieldSx}
      />

      {/* 状況 */}
      <Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, mb: 0.75 }}>状況</Typography>
        <ToggleButtonGroup
          size="small" exclusive value={local.status}
          onChange={(_e, v) => v && commit({ status: v as BlogStatus })}
          sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', fontSize: 12, px: 1.75 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` } }}
        >
          <ToggleButton value="draft">下書き</ToggleButton>
          <ToggleButton value="published">公開</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <TextField
        label="スラッグ (URL)" value={local.slug}
        onChange={(e) => patch({ slug: e.target.value })}
        onBlur={flushText}
        placeholder={slugify(local.title) || 'my-first-post'}
        fullWidth size="small" sx={fieldSx}
        InputProps={{ startAdornment: <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.4)', '& p': { fontSize: 13 } }}>/blog/</InputAdornment> }}
      />

      <TextField
        select label="カテゴリ" value={local.category}
        onChange={(e) => commit({ category: e.target.value })}
        fullWidth size="small" sx={fieldSx} SelectProps={selectMenuProps}
      >
        {categoryOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </TextField>

      <TextField
        select label="公開先" value={targetValue}
        onChange={(e) => handleTargetChange(e.target.value)}
        fullWidth size="small" sx={fieldSx}
        helperText="既定はアカウントサイト（記事のホーム）"
        FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)', mx: 0 } }}
        SelectProps={selectMenuProps}
      >
        <MenuItem value="account">アカウントサイト</MenuItem>
        {projects.map((p) => <MenuItem key={p.id} value={p.id}>プロジェクト: {p.name}</MenuItem>)}
      </TextField>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <TextField
        label="抜粋 (meta description / OGP)" value={local.excerpt}
        onChange={(e) => patch({ excerpt: e.target.value })}
        onBlur={flushText}
        fullWidth multiline minRows={3} size="small" sx={fieldSx}
      />

      {/* タグ */}
      <Box>
        <TextField
          label="タグを追加（Enter）" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          fullWidth size="small" sx={fieldSx}
        />
        {local.tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {local.tags.map((t) => (
              <Chip key={t} label={t} size="small"
                onDelete={() => commit({ tags: local.tags.filter((x) => x !== t) })}
                sx={{ bgcolor: `${ACCENT}33`, color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.6)' } }} />
            ))}
          </Box>
        )}
      </Box>

      <Button
        onClick={() => { flushText(); onOpenEditor(local.id); }}
        startIcon={<EditRoundedIcon />}
        variant="outlined" fullWidth
        sx={{ mt: 'auto', color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}14` } }}
      >
        本文を編集
      </Button>
      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
        変更は自動保存されます。本文の執筆は「本文を編集」から。
      </Typography>
    </Box>
  );
};
