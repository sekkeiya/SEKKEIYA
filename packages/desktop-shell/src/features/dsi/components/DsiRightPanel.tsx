import React, { useMemo, useState } from 'react';
import { Box, Typography, Button, Divider, Chip, TextField, MenuItem, ToggleButtonGroup, ToggleButton } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import { DSI_CATEGORIES, type DsiCategory, useDsiStore } from '../store/useDsiStore';
import { TEXTURE_SLOTS, TEXTURE_APPLICATIONS, slotFromFilename, type TextureGroup } from '../textureGrouping';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';

const metaFieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
} as const;

const SOURCE_LABEL: Record<string, string> = {
  'manual-upload': '手動アップロード',
  'layout-render': 'S.Layout レンダー',
  'ai-render': 'AI Render 生成',
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, color: '#fff', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</Typography>
  </Box>
);

interface DsiRightPanelProps {
  item: any | null;
  /** テクスチャグループ選択時：各マップを束ねた情報 */
  textureGroup?: TextureGroup | null;
  /** 手動テクスチャセットの解除（manual グループのみ） */
  onUngroupTexture?: (setId: string) => void;
  /** 部位カテゴリ（床/内壁/外壁/天井）の手動上書き */
  onSetApplications?: (groupId: string, applications: string[]) => void;
  /** 移動先候補のセット一覧 */
  sets?: any[];
  /** フィルタパネル用：現在表示中の全画像（未選択時の絞り込みUI用） */
  allImages?: any[];
  /** フィルタパネル用：テクスチャグループ一覧（タグ収集用） */
  allTextureGroups?: TextureGroup[];
  /** 画像を別セットへ移動（null でセットから外す） */
  onMove?: (item: any, newSetId: string | null) => void;
  /** 公開可視性の切り替え */
  onSetVisibility?: (item: any, visibility: 'public' | 'private') => void;
  /** カテゴリ・タグの更新 */
  onUpdateMeta?: (item: any, fields: { category?: DsiCategory; tags?: string[] }) => void;
}

export const DsiRightPanel: React.FC<DsiRightPanelProps> = ({ item, textureGroup, onUngroupTexture, onSetApplications, sets = [], allImages = [], allTextureGroups = [], onMove, onSetVisibility, onUpdateMeta }) => {
  const [tagInput, setTagInput] = useState('');
  const categoryFilter = useDsiStore((s) => s.categoryFilter);
  const setCategoryFilter = useDsiStore((s) => s.setCategoryFilter);
  const tagFilter = useDsiStore((s) => s.tagFilter);
  const setTagFilter = useDsiStore((s) => s.setTagFilter);

  // 未選択時: フィルタパネルを表示
  if (!item) {
    return <DsiFilterPanel allImages={allImages} allTextureGroups={allTextureGroups} />;
  }

  // テクスチャグループ選択時は各マップを一覧表示する専用ビュー。
  if (textureGroup) {
    return <TextureGroupPanel group={textureGroup} onUngroup={onUngroupTexture} onSetApplications={onSetApplications} />;
  }

  const created = item.createdAt
    ? new Date(typeof item.createdAt === 'number' ? item.createdAt : item.createdAt?.toMillis?.() ?? item.createdAt).toLocaleDateString('ja-JP')
    : undefined;
  const isVideo = item.mediaType === 'video';
  const url = item.downloadUrl;

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mb: 1.5 }}>{isVideo ? '動画情報' : '画像情報'}</Typography>

      {/* Preview */}
      {url && (
        <Box sx={{ borderRadius: 1.5, overflow: 'hidden', mb: 1.5, bgcolor: 'rgba(0,0,0,0.3)', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo ? (
            <Box component="video" src={url} controls sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Box component="img" src={url} alt={item.title} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </Box>
      )}

      {item.category && (
        <Chip size="small" label={item.category} sx={{ alignSelf: 'flex-start', mb: 1.5, height: 20, color: '#fff', bgcolor: `${ACCENT}33`, border: `1px solid ${ACCENT}55` }} />
      )}

      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1, wordBreak: 'break-word' }}>{item.title || item.name}</Typography>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

      <Row label="種別" value={isVideo ? '動画' : '画像'} />
      <Row label="形式" value={item.format ? String(item.format).toUpperCase() : undefined} />
      {item.width && item.height ? <Row label="解像度" value={`${item.width}×${item.height}`} /> : null}
      {item.sizeBytes ? <Row label="サイズ" value={formatBytes(item.sizeBytes)} /> : null}
      <Row label="取得元" value={SOURCE_LABEL[item.sourceType] || '手動アップロード'} />
      <Row label="作成日" value={created} />

      {onMove && (
        <Box sx={{ mt: 1.5 }}>
          <TextField
            select size="small" fullWidth label="セット" variant="outlined"
            value={item.parentSetId ?? ''}
            onChange={(e) => onMove(item, e.target.value || null)}
            InputProps={{ style: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.6)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
            }}
          >
            <MenuItem value="">（セットなし）</MenuItem>
            {sets.map(s => <MenuItem key={s.id} value={s.id}>{s.title || 'セット'}</MenuItem>)}
          </TextField>
        </Box>
      )}

      {onSetVisibility && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>公開設定</Typography>
          <ToggleButtonGroup
            exclusive size="small" fullWidth
            value={item.visibility === 'public' ? 'public' : 'private'}
            onChange={(_, v) => { if (v) onSetVisibility(item, v); }}
            sx={{
              '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', fontSize: 12, textTransform: 'none', py: 0.5 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT} !important` },
            }}
          >
            <ToggleButton value="private"><LockRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />非公開</ToggleButton>
            <ToggleButton value="public"><PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />公開</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* カテゴリ・タグ編集（S.Image の検索に使用） */}
      {onUpdateMeta && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
          <TextField
            select size="small" fullWidth label="カテゴリ" variant="outlined"
            value={(DSI_CATEGORIES as readonly string[]).includes(item.category) ? item.category : ''}
            onChange={(e) => onUpdateMeta(item, { category: e.target.value as DsiCategory })}
            InputProps={{ style: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.6)' } }}
            sx={metaFieldSx}
          >
            {DSI_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 1.75, mb: 0.5 }}>タグ</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            {(Array.isArray(item.tags) ? item.tags : []).map((t: string) => (
              <Chip
                key={t} size="small" label={t}
                onDelete={() => onUpdateMeta(item, { tags: (item.tags || []).filter((x: string) => x !== t) })}
                sx={{ height: 22, fontSize: 10, color: '#fff', bgcolor: `${ACCENT}22`, border: `1px solid ${ACCENT}44` }}
              />
            ))}
            <TextField
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = tagInput.trim();
                  if (t && !(item.tags || []).includes(t)) onUpdateMeta(item, { tags: [...(item.tags || []), t] });
                  setTagInput('');
                }
              }}
              size="small" placeholder="＋タグ" variant="standard"
              sx={{ width: 72, '& input': { fontSize: 11, color: '#fff', py: 0.25 }, '& .MuiInput-underline:before': { borderColor: 'rgba(255,255,255,0.2)' } }}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {url && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          <Button
            fullWidth size="small" variant="contained" startIcon={<OpenInNewRoundedIcon />}
            onClick={() => window.open(url, '_blank')}
            sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: ACCENT_HOVER } }}
          >
            開く
          </Button>
          <Button
            fullWidth size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
            component="a" href={url} download target="_blank"
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: ACCENT } }}
          >
            ダウンロード
          </Button>
        </Box>
      )}
    </Box>
  );
};

// ── 未選択時のフィルタパネル ────────────────────────────────────────────────
const DsiFilterPanel: React.FC<{ allImages: any[]; allTextureGroups: TextureGroup[] }> = ({ allImages, allTextureGroups }) => {
  const categoryFilter = useDsiStore((s) => s.categoryFilter);
  const setCategoryFilter = useDsiStore((s) => s.setCategoryFilter);
  const tagFilter = useDsiStore((s) => s.tagFilter);
  const setTagFilter = useDsiStore((s) => s.setTagFilter);
  const applicationFilter = useDsiStore((s) => s.applicationFilter);
  const setApplicationFilter = useDsiStore((s) => s.setApplicationFilter);

  // データに存在する用途・部位だけを、規定の順（室内/屋外・床/壁/天井）で。
  const availableApps = useMemo(() => {
    const present = new Set<string>();
    for (const g of allTextureGroups) for (const a of g.applications) present.add(a);
    return (TEXTURE_APPLICATIONS as readonly string[]).filter((a) => present.has(a));
  }, [allTextureGroups]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const img of allImages) {
      for (const t of (img.tags || [])) map.set(t, (map.get(t) || 0) + 1);
    }
    for (const g of allTextureGroups) {
      for (const t of g.tags) map.set(t, (map.get(t) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t]) => t);
  }, [allImages, allTextureGroups]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <FilterListRoundedIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8 }}>絞り込み</Typography>
      </Box>

      {/* カテゴリ */}
      <Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mb: 0.75 }}>カテゴリ</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(['all', ...DSI_CATEGORIES] as const).map((c) => {
            const active = categoryFilter === c;
            return (
              <Chip key={c} size="small" label={c === 'all' ? 'すべて' : c}
                onClick={() => setCategoryFilter(c)}
                sx={{
                  height: 22, fontSize: 11, cursor: 'pointer',
                  color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                  bgcolor: active ? ACCENT : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.12)'}`,
                  '&:hover': { bgcolor: active ? ACCENT_HOVER : 'rgba(255,255,255,0.12)' },
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* 用途・部位（テクスチャがどこに使えるか） */}
      {availableApps.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>用途・部位</Typography>
            {applicationFilter && (
              <Typography onClick={() => setApplicationFilter(null)}
                sx={{ fontSize: 10, color: ACCENT, cursor: 'pointer', '&:hover': { color: ACCENT_HOVER } }}>
                解除
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {availableApps.map((a) => {
              const active = applicationFilter === a;
              return (
                <Chip key={a} size="small" label={a}
                  onClick={() => setApplicationFilter(active ? null : a)}
                  sx={{
                    height: 22, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    color: active ? '#fff' : 'rgba(255,255,255,0.8)',
                    bgcolor: active ? 'rgba(102,187,106,0.7)' : 'rgba(102,187,106,0.18)',
                    border: `1px solid ${active ? '#66bb6a' : 'rgba(102,187,106,0.45)'}`,
                    '&:hover': { bgcolor: active ? 'rgba(102,187,106,0.8)' : 'rgba(102,187,106,0.3)' },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* タグ */}
      {topTags.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>タグ</Typography>
            {tagFilter && (
              <Typography onClick={() => setTagFilter(null)}
                sx={{ fontSize: 10, color: ACCENT, cursor: 'pointer', '&:hover': { color: ACCENT_HOVER } }}>
                解除
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {topTags.map((t) => {
              const active = tagFilter === t;
              return (
                <Chip key={t} size="small" label={t}
                  onClick={() => setTagFilter(active ? null : t)}
                  sx={{
                    height: 22, fontSize: 10.5, cursor: 'pointer',
                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                    bgcolor: active ? 'rgba(236,64,122,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? `${ACCENT}88` : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': { bgcolor: active ? 'rgba(236,64,122,0.28)' : 'rgba(255,255,255,0.1)' },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
        画像やテクスチャを選択すると詳細が表示されます
      </Typography>
    </Box>
  );
};

const TEX_ACCENT = '#42a5f5';

/** テクスチャグループ（ベースカラー/ノーマル/ラフネス/AO…）の各マップを一覧表示する右パネル。 */
const TextureGroupPanel: React.FC<{ group: TextureGroup; onUngroup?: (setId: string) => void; onSetApplications?: (groupId: string, apps: string[]) => void }> = ({ group, onUngroup, onSetApplications }) => {
  // 部位カテゴリのトグル（最低1つは残す）。
  const toggleApp = (a: string) => {
    if (!onSetApplications) return;
    const cur = group.applications as string[];
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
    if (next.length === 0) return; // 必ず1つは残す
    // 規定順（床/内壁/外壁/天井）に並べる
    const ordered = (TEXTURE_APPLICATIONS as readonly string[]).filter((x) => next.includes(x));
    onSetApplications(group.id, ordered);
  };

  const cover = group.slots.albedo || group.cover;
  // 既知スロットを順番に。スロット推定できなかった残りも末尾に「その他」として列挙。
  const slotRows = TEXTURE_SLOTS
    .map((s) => ({ label: s.label, item: group.slots[s.key] }))
    .filter((r) => r.item);
  const knownItems = new Set(slotRows.map((r) => r.item));
  const otherRows = group.items
    .filter((it) => !knownItems.has(it) && !slotFromFilename(String(it.name || it.title || '')))
    .map((it) => ({ label: 'その他', item: it }));
  const rows = [...slotRows, ...otherRows];

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mb: 1.5 }}>テクスチャ素材</Typography>

      {/* 表紙＝ベースカラーのプレビュー */}
      {(cover?.downloadUrl || cover?.thumbnailUrl) && (
        <Box sx={{ borderRadius: 1.5, overflow: 'hidden', mb: 1.5, bgcolor: 'rgba(0,0,0,0.3)', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box component="img" src={cover.thumbnailUrl || cover.downloadUrl} alt={group.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={`テクスチャ・${group.items.length} マップ`} sx={{ height: 20, color: '#fff', bgcolor: `${TEX_ACCENT}33`, border: `1px solid ${TEX_ACCENT}55` }} />
        {group.manual && <Chip size="small" label="手動セット" sx={{ height: 20, fontSize: 10, color: '#fff', bgcolor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }} />}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1, wordBreak: 'break-word' }}>{group.title}</Typography>

      {/* 部位（自動ラベルと同じ 床/内壁/外壁/天井）。必ず1つ以上。クリックで上書き編集。 */}
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>
          部位（自動マテリアルの貼付先）{onSetApplications && '・クリックで変更'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(TEXTURE_APPLICATIONS as readonly string[]).map((a) => {
            const active = (group.applications as string[]).includes(a);
            return (
              <Chip
                key={a} size="small" label={a}
                onClick={onSetApplications ? () => toggleApp(a) : undefined}
                sx={{
                  height: 22, fontSize: 11, fontWeight: 600,
                  cursor: onSetApplications ? 'pointer' : 'default',
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  bgcolor: active ? 'rgba(102,187,106,0.32)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(102,187,106,0.65)' : 'rgba(255,255,255,0.14)'}`,
                  '&:hover': onSetApplications ? { borderColor: 'rgba(102,187,106,0.8)' } : undefined,
                }}
              />
            );
          })}
        </Box>
        {group.environments.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {group.environments.map((e) => (
              <Chip key={e} size="small" label={e} sx={{ height: 20, fontSize: 10, color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)' }} />
            ))}
          </Box>
        )}
      </Box>

      {/* 手動セットは解除できる */}
      {group.manual && group.setId && onUngroup && (
        <Button
          size="small" variant="outlined" fullWidth
          onClick={() => onUngroup(group.setId!)}
          sx={{ mb: 1, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.25)', textTransform: 'none', '&:hover': { borderColor: '#ff8a80', color: '#ff8a80' } }}
        >
          セットを解除
        </Button>
      )}

      {/* テクスチャの種類タグ（マテリアル名から自動付与） */}
      {group.tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {group.tags.map((t) => (
            <Chip key={t} size="small" label={t} sx={{ height: 20, fontSize: 10.5, color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }} />
          ))}
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 1 }}>マップ一覧</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, overflowY: 'auto' }}>
        {rows.map(({ label, item }, i) => {
          const url = item.downloadUrl || item.thumbnailUrl;
          return (
            <Box
              key={item.id || i}
              onClick={() => url && window.open(url, '_blank')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1.25, cursor: url ? 'pointer' : 'default',
                bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                transition: 'border-color 0.15s', '&:hover': { borderColor: `${TEX_ACCENT}88` },
              }}
            >
              <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.3)' }}>
                {(item.thumbnailUrl || item.downloadUrl) && (
                  <Box component="img" src={item.thumbnailUrl || item.downloadUrl} alt={label} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{label}</Typography>
                <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{item.name || item.title}</Typography>
              </Box>
              {url && <OpenInNewRoundedIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
