// @ts-nocheck
/**
 * CommunityTemplatesTab
 * マイテンプレート / コミュニティテンプレートの一覧・読み込みタブ
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, CircularProgress, TextField, Tooltip, Avatar, IconButton, Chip,
} from '@mui/material';
import SearchRoundedIcon        from '@mui/icons-material/SearchRounded';
import PublicRoundedIcon        from '@mui/icons-material/PublicRounded';
import LockRoundedIcon          from '@mui/icons-material/LockRounded';
import PersonRoundedIcon        from '@mui/icons-material/PersonRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon      from '@mui/icons-material/DownloadRounded';
import RefreshRoundedIcon       from '@mui/icons-material/RefreshRounded';
import { useDscStore } from '../../store/useDscStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { FurnitureTemplateRepository, TEMPLATE_CATEGORIES_LIST } from '../../repository/furnitureTemplateRepository';

const ACCENT = '#ffa726';

function freshId() {
  return `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  tmpl, isOwn, onLoad, onDelete, onToggleVisibility,
}: {
  tmpl: FurnitureTemplate;
  isOwn: boolean;
  onLoad: (tmpl: FurnitureTemplate) => void;
  onDelete?: (tmpl: FurnitureTemplate) => void;
  onToggleVisibility?: (tmpl: FurnitureTemplate) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(255,255,255,0.07)',
        bgcolor: hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
        transition: 'all 0.15s',
        cursor: 'default',
      }}
    >
      {/* サムネイル */}
      <Box
        onClick={() => onLoad(tmpl)}
        sx={{
          width: '100%', height: 90, bgcolor: '#0d1117',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
      >
        {tmpl.thumbnailUrl ? (
          <img
            src={tmpl.thumbnailUrl} alt={tmpl.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'rgba(255,167,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 20 }}>🪑</Typography>
          </Box>
        )}
        {/* Hover overlay */}
        {hovered && (
          <Box sx={{
            position: 'absolute', inset: 0,
            bgcolor: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 0.5,
          }}>
            <Box sx={{
              px: 1.5, py: 0.6, borderRadius: 1.5,
              bgcolor: ACCENT, color: '#000',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 0.5,
            }}>
              <DownloadRoundedIcon sx={{ fontSize: 13 }} />
              読み込む
            </Box>
          </Box>
        )}
      </Box>

      {/* メタ情報 */}
      <Box sx={{ px: 1.25, py: 0.9 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {tmpl.name}
          </Typography>
          {/* 自分のテンプレートのアクション */}
          {isOwn && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
              <Tooltip title={tmpl.visibility === 'public' ? '非公開にする' : 'コミュニティに公開'} placement="top">
                <IconButton size="small" onClick={() => onToggleVisibility?.(tmpl)}
                  sx={{ p: 0.3, color: tmpl.visibility === 'public' ? '#4caf50' : 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}>
                  {tmpl.visibility === 'public'
                    ? <PublicRoundedIcon sx={{ fontSize: 12 }} />
                    : <LockRoundedIcon  sx={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="削除" placement="top">
                <IconButton size="small" onClick={() => onDelete?.(tmpl)}
                  sx={{ p: 0.3, color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#ff4d4f' } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* カテゴリ + パーツ数 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', lineHeight: 1 }}>{tmpl.category}</Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>·</Typography>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            {(() => { try { return JSON.parse(tmpl.componentsJson).length; } catch { return '?'; } })()}P
          </Typography>
        </Box>

        {/* クリエイター（他ユーザーのみ表示） */}
        {!isOwn && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.6 }}>
            <Avatar
              src={tmpl.creatorPhotoUrl || undefined}
              sx={{ width: 14, height: 14, fontSize: 8, bgcolor: 'rgba(255,255,255,0.15)' }}
            >
              <PersonRoundedIcon sx={{ fontSize: 10 }} />
            </Avatar>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
              {tmpl.creatorName || '---'}
            </Typography>
            {tmpl.useCount > 0 && (
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', ml: 'auto', flexShrink: 0 }}>
                {tmpl.useCount}回使用
              </Typography>
            )}
          </Box>
        )}

        {/* タグ */}
        {tmpl.tags?.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 0.5 }}>
            {tmpl.tags.slice(0, 3).map(t => (
              <Typography key={t} sx={{
                fontSize: 8.5, px: 0.6, py: 0.1, borderRadius: 0.75,
                bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
              }}>{t}</Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const CommunityTemplatesTab: React.FC = () => {
  const { setComponents, setFurnitureName, components: currentComps } = useDscStore();
  const { currentUser } = useAuthStore();

  type ViewMode = 'my' | 'community';
  const [viewMode,    setViewMode]    = useState<ViewMode>('my');
  const [myTemplates, setMyTemplates] = useState<FurnitureTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<FurnitureTemplate[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [searchText,  setSearchText]  = useState('');
  const [activeCat,   setActiveCat]   = useState<string>('すべて');

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // allSettled で片方が失敗してももう片方を確実に反映する
      const [mineResult, pubResult] = await Promise.allSettled([
        FurnitureTemplateRepository.getMyTemplates(currentUser.uid),
        FurnitureTemplateRepository.getPublicTemplates(60),
      ]);
      if (mineResult.status === 'fulfilled') {
        setMyTemplates(mineResult.value);
      }
      if (pubResult.status === 'fulfilled') {
        setCommunityTemplates(pubResult.value.filter((t: any) => t.createdBy !== currentUser.uid));
      }
      // どちらかが失敗してもエラーは出さない（権限不足はよくあるケース）
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const handleLoad = useCallback((tmpl: FurnitureTemplate) => {
    if (currentComps.length > 0) {
      if (!window.confirm(`「${tmpl.name}」を読み込みます。\n現在のパーツはすべて置き換えられます。`)) return;
    }
    try {
      const comps = JSON.parse(tmpl.componentsJson).map((c: any) => ({
        ...c,
        id: freshId(),
        rotation: c.rotation ?? [0, 0, 0],
      }));
      setComponents(comps);
      setFurnitureName(tmpl.name);
      // 使用回数をインクリメント（非同期、エラー無視）
      if (tmpl.id) FurnitureTemplateRepository.incrementUseCount(tmpl.id).catch(() => {});
    } catch (e) {
      alert('テンプレートの読み込みに失敗しました。');
    }
  }, [currentComps, setComponents, setFurnitureName]);

  const handleDelete = useCallback(async (tmpl: FurnitureTemplate) => {
    if (!window.confirm(`「${tmpl.name}」を削除しますか？`)) return;
    try {
      await FurnitureTemplateRepository.delete(tmpl.id!);
      setMyTemplates(prev => prev.filter(t => t.id !== tmpl.id));
    } catch {
      alert('削除に失敗しました。');
    }
  }, []);

  const handleToggleVisibility = useCallback(async (tmpl: FurnitureTemplate) => {
    const next = tmpl.visibility === 'public' ? 'private' : 'public';
    try {
      await FurnitureTemplateRepository.update(tmpl.id!, { visibility: next });
      setMyTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, visibility: next } : t));
    } catch {
      alert('公開設定の変更に失敗しました。');
    }
  }, []);

  // フィルタリング
  const sourceList = viewMode === 'my' ? myTemplates : communityTemplates;
  const filtered = useMemo(() => {
    let list = sourceList;
    if (activeCat !== 'すべて') list = list.filter(t => t.category === activeCat);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [sourceList, activeCat, searchText]);

  // カテゴリ一覧（実在するもの）
  const availableCats = useMemo(() => {
    const cats = new Set(sourceList.map(t => t.category));
    return ['すべて', ...TEMPLATE_CATEGORIES_LIST.filter(c => cats.has(c))];
  }, [sourceList]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* ── タブ切り替え（マイ / コミュニティ） ── */}
      <Box sx={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {([
          { key: 'my' as ViewMode,        label: 'マイ',         icon: <LockRoundedIcon sx={{ fontSize: 12 }} /> },
          { key: 'community' as ViewMode, label: 'コミュニティ', icon: <PublicRoundedIcon sx={{ fontSize: 12 }} /> },
        ] as const).map(({ key, label, icon }) => (
          <Box
            key={key}
            onClick={() => setViewMode(key)}
            sx={{
              flex: 1, py: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              cursor: 'pointer',
              borderBottom: viewMode === key ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: viewMode === key ? ACCENT : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
              '&:hover': { color: viewMode === key ? ACCENT : 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.03)' },
            }}
          >
            {icon}
            <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{label}</Typography>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
              ({(viewMode === key ? filtered : (key === 'my' ? myTemplates : communityTemplates)).length})
            </Typography>
          </Box>
        ))}
        {/* リフレッシュ — disabled 時も Tooltip が動作するよう span でラップ */}
        <Tooltip title="再読み込み" placement="left">
          <span>
            <IconButton size="small" onClick={load} disabled={loading}
              sx={{ m: 0.5, color: 'rgba(255,255,255,0.3)', '&:hover': { color: ACCENT } }}>
              <RefreshRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── 検索 ── */}
      <Box sx={{ px: 1.25, pt: 1, pb: 0.5, flexShrink: 0 }}>
        <TextField
          size="small" fullWidth
          placeholder="テンプレートを検索..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          InputProps={{ startAdornment: <SearchRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', mr: 0.5 }} /> }}
          sx={{
            '& .MuiInputBase-input': { color: '#fff', fontSize: 11, py: '5px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
          }}
        />
      </Box>

      {/* ── カテゴリフィルター ── */}
      {availableCats.length > 1 && (
        <Box sx={{ px: 1.25, pb: 0.75, flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
          {availableCats.map(cat => (
            <Box
              key={cat}
              onClick={() => setActiveCat(cat)}
              sx={{
                px: 0.85, py: 0.25, borderRadius: 1, cursor: 'pointer', flexShrink: 0,
                fontSize: 9.5, fontWeight: 600,
                bgcolor: activeCat === cat ? 'rgba(255,167,38,0.18)' : 'transparent',
                color:   activeCat === cat ? ACCENT : 'rgba(255,255,255,0.38)',
                border:  `1px solid ${activeCat === cat ? ACCENT : 'rgba(255,255,255,0.09)'}`,
                transition: 'all 0.12s',
                '&:hover': { color: ACCENT, borderColor: ACCENT },
              }}
            >{cat === 'すべて' ? 'ALL' : cat}</Box>
          ))}
        </Box>
      )}

      {/* ── コンテンツ ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={24} sx={{ color: ACCENT }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 4 }}>
            <Typography sx={{ fontSize: 24, mb: 1 }}>
              {viewMode === 'my' ? '📦' : '🌐'}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
              {viewMode === 'my'
                ? 'テンプレートがまだありません\nツールバーの「テンプレート登録」から\n家具を保存してみましょう'
                : searchText || activeCat !== 'すべて'
                  ? '検索条件に一致するテンプレートがありません'
                  : '公開テンプレートはまだありません\nあなたが最初に公開しましょう！'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pt: 0.5 }}>
            {filtered.map(tmpl => (
              <TemplateCard
                key={tmpl.id}
                tmpl={tmpl}
                isOwn={viewMode === 'my'}
                onLoad={handleLoad}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
