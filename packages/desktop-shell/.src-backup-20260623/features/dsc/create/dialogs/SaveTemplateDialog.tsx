// @ts-nocheck
/**
 * SaveTemplateDialog
 * 家具をコミュニティテンプレートとして登録するダイアログ
 */
import React, { useState } from 'react';
import {
  Box, Typography, Dialog, DialogContent, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, CircularProgress, Tooltip, Divider, Chip,
} from '@mui/material';
import CloseRoundedIcon      from '@mui/icons-material/CloseRounded';
import LockRoundedIcon       from '@mui/icons-material/LockRounded';
import PublicRoundedIcon     from '@mui/icons-material/PublicRounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import { FurnitureTemplateRepository, TEMPLATE_CATEGORIES_LIST } from '../../repository/furnitureTemplateRepository';
import { useAuthStore } from '../../../../store/useAuthStore';

const ACCENT = '#ffa726';

interface Props {
  open: boolean;
  onClose: () => void;
  furnitureName: string;
  componentsJson: string;
  thumbnailDataUrl?: string | null;
  /** 保存成功時に呼ばれる */
  onSaved?: (templateId: string) => void;
}

export default function SaveTemplateDialog({
  open, onClose, furnitureName, componentsJson, thumbnailDataUrl, onSaved,
}: Props) {
  const { currentUser } = useAuthStore();

  const [name,        setName]        = useState(furnitureName || '');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('テーブル');
  const [tagInput,    setTagInput]    = useState('');
  const [tags,        setTags]        = useState<string[]>([]);
  const [visibility,  setVisibility]  = useState<'public' | 'private'>('private');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // 名前が開く度にリセット
  React.useEffect(() => {
    if (open) {
      setName(furnitureName || '');
      setSaved(false);
      setDescription('');
      setTags([]);
      setTagInput('');
      setVisibility('private');
    }
  }, [open, furnitureName]);

  const addTag = () => {
    const t = tagInput.trim().replace(/,/g, '');
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleSave = async () => {
    if (!currentUser || !name.trim()) return;
    setSaving(true);
    try {
      const id = await FurnitureTemplateRepository.create(
        {
          name:           name.trim(),
          description:    description.trim() || undefined,
          category,
          tags,
          componentsJson,
          visibility,
          createdBy:      currentUser.uid,
          creatorName:    currentUser.displayName || currentUser.email || 'Anonymous',
          creatorPhotoUrl: currentUser.photoURL   || null,
        },
        thumbnailDataUrl ?? undefined,
      );
      setSaved(true);
      onSaved?.(id);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.error('[SaveTemplateDialog] 保存に失敗しました', e);
      alert('テンプレートの保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  // ── Visibility toggle ───────────────────────────────────────────────────────
  const VisBtn = ({ val, icon, label, sub }: any) => {
    const active = visibility === val;
    return (
      <Box
        onClick={() => setVisibility(val)}
        sx={{
          flex: 1, p: 1.25, borderRadius: 2, cursor: 'pointer',
          border: active ? `1.5px solid ${val === 'public' ? '#4caf50' : ACCENT}` : '1.5px solid rgba(255,255,255,0.1)',
          bgcolor: active ? (val === 'public' ? 'rgba(76,175,80,0.1)' : 'rgba(255,167,38,0.1)') : 'rgba(255,255,255,0.03)',
          transition: 'all 0.18s',
          '&:hover': { borderColor: val === 'public' ? '#4caf50' : ACCENT },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.35 }}>
          <Box sx={{ color: active ? (val === 'public' ? '#4caf50' : ACCENT) : 'rgba(255,255,255,0.4)', display: 'flex' }}>
            {icon}
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>{sub}</Typography>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(14,18,30,0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>

        {/* ── ヘッダー ── */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.35 }}>
              <BookmarkAddRoundedIcon sx={{ color: ACCENT, fontSize: 20 }} />
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                テンプレートとして登録
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              作成した家具をテンプレートライブラリに保存します
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── サムネイルプレビュー ── */}
        {thumbnailDataUrl && (
          <Box sx={{ px: 2.5, mb: 1.5 }}>
            <Box sx={{
              width: '100%', height: 130, borderRadius: 2, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)', bgcolor: '#0d1117',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={thumbnailDataUrl} alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

        {/* ── フォーム ── */}
        <Box sx={{ px: 2.5, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* 名前 */}
          <TextField
            label="テンプレート名 *"
            value={name}
            onChange={e => setName(e.target.value)}
            size="small"
            fullWidth
            inputProps={{ maxLength: 60 }}
            sx={{
              '& label': { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
              '& .MuiInputBase-input': { color: '#fff', fontSize: 13 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
              '& label.Mui-focused': { color: ACCENT },
            }}
          />

          {/* カテゴリ */}
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, '&.Mui-focused': { color: ACCENT } }}>
              カテゴリ
            </InputLabel>
            <Select
              value={category}
              label="カテゴリ"
              onChange={e => setCategory(e.target.value)}
              sx={{
                color: '#fff', fontSize: 13,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
              }}
              MenuProps={{ PaperProps: { sx: { bgcolor: 'rgba(18,22,36,0.98)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } } }}
            >
              {TEMPLATE_CATEGORIES_LIST.map(cat => (
                <MenuItem key={cat} value={cat} sx={{ fontSize: 13, '&:hover': { bgcolor: 'rgba(255,167,38,0.1)' } }}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 説明 */}
          <TextField
            label="説明（任意）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            inputProps={{ maxLength: 200 }}
            placeholder="素材・用途・サイズ感など"
            sx={{
              '& label': { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
              '& .MuiInputBase-input': { color: '#fff', fontSize: 12 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
              '& label.Mui-focused': { color: ACCENT },
            }}
          />

          {/* タグ */}
          <Box>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 0.75 }}>
              <TextField
                label="タグを追加（任意）"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                size="small"
                sx={{
                  flex: 1,
                  '& label': { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
                  '& .MuiInputBase-input': { color: '#fff', fontSize: 12 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                  '& label.Mui-focused': { color: ACCENT },
                }}
              />
              <Box
                onClick={addTag}
                sx={{
                  px: 1.2, display: 'flex', alignItems: 'center', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5,
                  color: 'rgba(255,255,255,0.4)',
                  '&:hover': { borderColor: ACCENT, color: ACCENT },
                }}
              >
                <LocalOfferRoundedIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>
            {tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {tags.map(t => (
                  <Chip
                    key={t} label={t} size="small" onDelete={() => removeTag(t)}
                    sx={{
                      bgcolor: 'rgba(255,167,38,0.12)', color: ACCENT, fontSize: 10,
                      border: '1px solid rgba(255,167,38,0.25)',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,167,38,0.5)', '&:hover': { color: ACCENT } },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* 公開設定 */}
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', mb: 0.85, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              公開設定
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <VisBtn
                val="private"
                icon={<LockRoundedIcon sx={{ fontSize: 16 }} />}
                label="非公開"
                sub="自分だけが使用できます"
              />
              <VisBtn
                val="public"
                icon={<PublicRoundedIcon sx={{ fontSize: 16 }} />}
                label="コミュニティに公開"
                sub="全ユーザーがテンプレートを利用できます"
              />
            </Box>
          </Box>

          {/* 保存ボタン */}
          <Box
            onClick={!saving && !saved && name.trim() ? handleSave : undefined}
            sx={{
              py: 1.25, borderRadius: 2, textAlign: 'center', cursor: saved ? 'default' : 'pointer',
              bgcolor: saved ? 'rgba(76,175,80,0.2)' : name.trim() ? ACCENT : 'rgba(255,255,255,0.06)',
              border: saved ? '1px solid #4caf50' : `1px solid ${name.trim() ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.2s',
              '&:hover': !saved && name.trim() ? { filter: 'brightness(1.1)' } : {},
            }}
          >
            {saving ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={14} sx={{ color: '#000' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#000' }}>保存中...</Typography>
              </Box>
            ) : saved ? (
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#4caf50' }}>✓ 保存しました</Typography>
            ) : (
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: name.trim() ? '#000' : 'rgba(255,255,255,0.2)' }}>
                テンプレートを登録する
              </Typography>
            )}
          </Box>

          {/* 注意書き */}
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.6 }}>
            登録後もマイテンプレートから公開設定を変更できます
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
