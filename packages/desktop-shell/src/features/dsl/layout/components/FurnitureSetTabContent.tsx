/**
 * FurnitureSetTabContent.tsx
 * LayoutRulesDialog の「セット家具」タブに直接埋め込むコンテンツ。
 * Dialog ラッパーなしで使える 3ペインレイアウト:
 *   左: セット一覧 / 中央: 3D パースビュー / 右: 家具カテゴリ追加
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, IconButton, Typography, Button, TextField,
  Tooltip, Avatar, CircularProgress, Chip, InputAdornment,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChairRoundedIcon from '@mui/icons-material/ChairRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { useAuthStore } from '../../../../store/useAuthStore';
import { useFurnitureSetsStore } from '../store/useFurnitureSetsStore';
import { useFurnitureDefaultsStore } from '../store/useFurnitureDefaultsStore';
import { FURNITURE_CATEGORIES } from '../constants/furnitureCategoryDefaults';
import { SetSceneCanvas } from '../canvas/SetSceneCanvas';
import type { FurnitureSet, FurnitureSetItem } from '../types/furnitureSet';

const ACCENT = '#a78bfa';
const LINE = 'rgba(255,255,255,0.1)';
const BG_SUBTLE = alpha('#fff', 0.015);

interface Props {
  projectId?: string | null;
}

function genId() { return `si_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function getInitialTransform(index: number): FurnitureSetItem['transform'] {
  return { x: (index % 3 - 1) * 1.5, z: Math.floor(index / 3) * 1.5, rotationDeg: 0 };
}

/** グループ別に categories をまとめる */
function groupCategories(categories: typeof FURNITURE_CATEGORIES) {
  const map = new Map<string, typeof FURNITURE_CATEGORIES>();
  for (const cat of categories) {
    if (!map.has(cat.group)) map.set(cat.group, []);
    map.get(cat.group)!.push(cat);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

export function FurnitureSetTabContent({ projectId }: Props) {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const setsStore = useFurnitureSetsStore();
  const defaultsStore = useFurnitureDefaultsStore();

  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<FurnitureSet | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (uid) {
      setsStore.load(uid);
      defaultsStore.load(uid, projectId ?? null);
    }
  }, [uid, projectId]); // eslint-disable-line

  const openSet = (set: FurnitureSet) => {
    setActiveSetId(set.id);
    setEditingSet(JSON.parse(JSON.stringify(set)));
    setSelectedItemId(null);
  };

  const handleCreateSet = async () => {
    if (!uid || !newSetName.trim()) return;
    const { furnitureSetsApi } = await import('../services/furnitureSetsApi');
    const id = furnitureSetsApi.newId(uid);
    const newSet: FurnitureSet = { id, name: newSetName.trim(), items: [] };
    openSet(newSet);
    setNewSetName('');
    setCreatingNew(false);
  };

  const handleSave = async () => {
    if (!uid || !editingSet) return;
    setSaving(true);
    try {
      await setsStore.save(uid, editingSet);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } finally { setSaving(false); }
  };

  const handleDeleteSet = async (id: string) => {
    if (!uid) return;
    await setsStore.remove(uid, id);
    if (activeSetId === id) { setActiveSetId(null); setEditingSet(null); }
  };

  const handleAddItem = (categoryKey: string) => {
    if (!editingSet) return;
    const cat = FURNITURE_CATEGORIES.find(c => c.key === categoryKey);
    if (!cat) return;
    const entry = defaultsStore.getEntry(categoryKey);
    const item: FurnitureSetItem = {
      id: genId(),
      categoryKey,
      entityId: entry?.entityId,
      title: entry?.title || cat.label,
      thumbnailUrl: entry?.thumbnailUrl,
      glbUrl: undefined,
      transform: getInitialTransform(editingSet.items.length),
    };
    setEditingSet(s => s ? { ...s, items: [...s.items, item] } : s);
    setSelectedItemId(item.id);
  };

  const handleRemoveItem = (id: string) => {
    setEditingSet(s => s ? { ...s, items: s.items.filter(i => i.id !== id) } : s);
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const handleTransformChange = (id: string, x: number, z: number) => {
    setEditingSet(s => s ? { ...s, items: s.items.map(i => i.id === id ? { ...i, transform: { ...i.transform, x, z } } : i) } : s);
  };

  const handleRotate = () => {
    if (!selectedItemId) return;
    setEditingSet(s => s ? { ...s, items: s.items.map(i => i.id === selectedItemId ? { ...i, transform: { ...i.transform, rotationDeg: (i.transform.rotationDeg + 90) % 360 } } : i) } : s);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const selectedItem = editingSet?.items.find(i => i.id === selectedItemId);

  /** セット内の categoryKey ごとのカウント */
  const itemCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of editingSet?.items ?? []) {
      map.set(item.categoryKey, (map.get(item.categoryKey) ?? 0) + 1);
    }
    return map;
  }, [editingSet?.items]);

  /** 検索フィルタ後のカテゴリグループ */
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const all = groupCategories(FURNITURE_CATEGORIES);
    if (!q) return all;
    return all
      .map(g => ({ ...g, items: g.items.filter(c => c.label.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [searchQuery]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>

      {/* ── 左: セット一覧 ── */}
      <Box sx={{ width: 200, flexShrink: 0, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, bgcolor: BG_SUBTLE }}>

        {/* ヘッダー */}
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${LINE}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: alpha('#fff', 0.7) }}>セット一覧</Typography>
          {setsStore.sets.length > 0 && (
            <Chip label={setsStore.sets.length} size="small"
              sx={{ height: 16, fontSize: 10, bgcolor: alpha(ACCENT, 0.18), color: alpha(ACCENT, 0.9), '& .MuiChip-label': { px: 0.75 } }} />
          )}
        </Box>

        {/* セットリスト */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, py: 0.5 }}>
          {setsStore.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
              <CircularProgress size={18} sx={{ color: ACCENT }} />
            </Box>
          ) : setsStore.sets.length === 0 && !creatingNew ? (
            <Box sx={{ p: 2, textAlign: 'center', mt: 1 }}>
              <ChairRoundedIcon sx={{ fontSize: 28, color: alpha('#fff', 0.1), mb: 1 }} />
              <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.3), lineHeight: 1.7 }}>
                セットがありません<br />下の「＋セット追加」から作成
              </Typography>
            </Box>
          ) : (
            setsStore.sets.map(set => {
              const isActive = activeSetId === set.id;
              return (
                <Box key={set.id} onClick={() => openSet(set)}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 1.5, py: 1, mx: 0.5,
                    cursor: 'pointer', borderRadius: 1.5,
                    bgcolor: isActive ? alpha(ACCENT, 0.15) : 'transparent',
                    border: `1px solid ${isActive ? alpha(ACCENT, 0.35) : 'transparent'}`,
                    mb: 0.25,
                    '&:hover': { bgcolor: isActive ? alpha(ACCENT, 0.18) : alpha('#fff', 0.04) },
                    transition: 'all 0.12s',
                  }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: isActive ? '#fff' : alpha('#fff', 0.75), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                      {set.name}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: isActive ? alpha(ACCENT, 0.7) : alpha('#fff', 0.3), mt: 0.1 }}>
                      {set.items.length} アイテム
                    </Typography>
                  </Box>
                  <Tooltip title="削除" placement="right">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); handleDeleteSet(set.id); }}
                      sx={{ color: alpha('#fff', 0.2), '&:hover': { color: '#f87171', bgcolor: alpha('#f87171', 0.1) }, borderRadius: 1 }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })
          )}
        </Box>

        {/* 登録エリア（最下部固定） */}
        <Box sx={{ borderTop: `1px solid ${LINE}`, flexShrink: 0 }}>
          {creatingNew ? (
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: 10.5, color: alpha('#fff', 0.45), mb: 0.75 }}>セット名を入力</Typography>
              <TextField
                autoFocus size="small" fullWidth placeholder="例：リビングセット"
                value={newSetName} onChange={e => setNewSetName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSet();
                  if (e.key === 'Escape') { setCreatingNew(false); setNewSetName(''); }
                }}
                sx={{
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    color: '#fff', fontSize: 12,
                    '& fieldset': { borderColor: alpha(ACCENT, 0.5) },
                    '&:hover fieldset': { borderColor: ACCENT },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  },
                  '& input': { py: '7px' },
                }}
              />
              <Box sx={{ display: 'flex', gap: 0.75 }}>
                <Button size="small" fullWidth onClick={handleCreateSet} disabled={!newSetName.trim()}
                  sx={{ bgcolor: ACCENT, color: '#fff', fontWeight: 700, fontSize: 12, '&:hover': { bgcolor: '#8b5cf6' }, '&.Mui-disabled': { bgcolor: alpha(ACCENT, 0.2), color: alpha('#fff', 0.3) }, borderRadius: 1.5, py: 0.75, textTransform: 'none' }}>
                  作成
                </Button>
                <Button size="small" onClick={() => { setCreatingNew(false); setNewSetName(''); }}
                  sx={{ color: alpha('#fff', 0.4), fontSize: 11, '&:hover': { bgcolor: alpha('#fff', 0.05) }, minWidth: 44, textTransform: 'none' }}>
                  取消
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <Button fullWidth size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setCreatingNew(true)}
                sx={{
                  bgcolor: alpha(ACCENT, 0.12), color: alpha(ACCENT, 0.9),
                  border: `1px solid ${alpha(ACCENT, 0.25)}`, fontWeight: 700, fontSize: 11.5,
                  textTransform: 'none', borderRadius: 1.5, py: 0.8,
                  '&:hover': { bgcolor: alpha(ACCENT, 0.25), borderColor: alpha(ACCENT, 0.5) },
                  transition: 'all 0.15s',
                }}>
                セット追加
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── 中央: 3Dビュー ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!editingSet ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <GridViewRoundedIcon sx={{ fontSize: 48, color: alpha('#fff', 0.08) }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: alpha('#fff', 0.35), fontWeight: 600 }}>
                セットを選択してください
              </Typography>
              <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.2), mt: 0.5 }}>
                左パネルから既存セットを選ぶか、新規作成
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {/* ツールバー */}
            <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${LINE}`, flexShrink: 0, minHeight: 44 }}>
              {/* セット名 */}
              <TextField
                size="small" value={editingSet.name}
                onChange={e => setEditingSet(s => s ? { ...s, name: e.target.value } : s)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    '& fieldset': { borderColor: 'transparent' },
                    '&:hover fieldset': { borderColor: LINE },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  },
                  '& input': { py: '4px', px: '6px' },
                  maxWidth: 200,
                }}
              />

              {/* アイテム数バッジ */}
              <Chip
                label={`${editingSet.items.length} 点`}
                size="small"
                sx={{ height: 20, fontSize: 10.5, bgcolor: alpha('#fff', 0.06), color: alpha('#fff', 0.5), '& .MuiChip-label': { px: 1 } }}
              />

              <Box sx={{ flex: 1 }} />

              {/* 選択アイテム操作 */}
              {selectedItem && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: alpha(ACCENT, 0.08), border: `1px solid ${alpha(ACCENT, 0.2)}`, borderRadius: 1.5, px: 1, py: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: alpha(ACCENT, 0.9), fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedItem.title}
                  </Typography>
                  <Tooltip title="90° 回転 (R)">
                    <IconButton size="small" onClick={handleRotate}
                      sx={{ color: alpha('#fff', 0.55), '&:hover': { color: ACCENT, bgcolor: alpha(ACCENT, 0.12) }, borderRadius: 1, p: 0.4 }}>
                      <RotateRightRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="削除 (Del)">
                    <IconButton size="small" onClick={() => handleRemoveItem(selectedItemId!)}
                      sx={{ color: alpha('#fff', 0.35), '&:hover': { color: '#f87171', bgcolor: alpha('#f87171', 0.1) }, borderRadius: 1, p: 0.4 }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* 保存ボタン */}
              <Button
                size="small" onClick={handleSave} disabled={saving}
                startIcon={savedFlash
                  ? <CheckRoundedIcon sx={{ fontSize: 14 }} />
                  : <SaveRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: savedFlash ? alpha('#4ade80', 0.18) : alpha(ACCENT, 0.18),
                  color: savedFlash ? '#4ade80' : ACCENT,
                  fontSize: 11.5, fontWeight: 700,
                  border: `1px solid ${savedFlash ? alpha('#4ade80', 0.3) : alpha(ACCENT, 0.3)}`,
                  '&:hover': { bgcolor: savedFlash ? alpha('#4ade80', 0.28) : alpha(ACCENT, 0.3) },
                  borderRadius: 1.5, px: 1.5, py: 0.5,
                  textTransform: 'none',
                  transition: 'all 0.2s',
                  minWidth: 72,
                }}>
                {saving ? '保存中...' : savedFlash ? '保存済' : '保存'}
              </Button>
            </Box>

            {/* 3Dキャンバス */}
            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <SetSceneCanvas
                items={editingSet.items}
                selectedId={selectedItemId}
                onSelect={setSelectedItemId}
                onTransformChange={handleTransformChange}
              />
              {editingSet.items.length === 0 && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Box sx={{ textAlign: 'center', bgcolor: alpha('#000', 0.55), px: 3.5, py: 2.5, borderRadius: 2, border: `1px solid ${alpha('#fff', 0.07)}` }}>
                    <Typography sx={{ fontSize: 13, color: alpha('#fff', 0.5), fontWeight: 600 }}>
                      家具がありません
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.3), mt: 0.5 }}>
                      右パネルからカテゴリをクリックして追加
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* ── 右: 家具追加パネル ── */}
      <Box sx={{ width: 230, flexShrink: 0, borderLeft: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, bgcolor: BG_SUBTLE }}>

        {/* ヘッダー + 検索 */}
        <Box sx={{ px: 1.5, pt: 1.25, pb: 1, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: alpha('#fff', 0.7) }}>家具を追加</Typography>
            <Typography sx={{ fontSize: 10, color: alpha('#fff', 0.3) }}>クリックで追加</Typography>
          </Box>
          <TextField
            size="small" fullWidth placeholder="検索…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 14, color: alpha('#fff', 0.3) }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff', fontSize: 11.5,
                '& fieldset': { borderColor: alpha('#fff', 0.12) },
                '&:hover fieldset': { borderColor: alpha('#fff', 0.25) },
                '&.Mui-focused fieldset': { borderColor: alpha(ACCENT, 0.5) },
              },
              '& input': { py: '5px' },
            }}
          />
        </Box>

        {/* カテゴリグループ一覧 */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {filteredGroups.map(({ group, items }) => {
            const isCollapsed = collapsedGroups.has(group);
            const groupCount = items.reduce((sum, c) => sum + (itemCountMap.get(c.key) ?? 0), 0);

            return (
              <Box key={group}>
                {/* グループヘッダー */}
                <Box
                  onClick={() => toggleGroup(group)}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 1.5, py: 0.75,
                    cursor: 'pointer', position: 'sticky', top: 0, zIndex: 1,
                    bgcolor: alpha('#1a1a2e', 0.95),
                    borderBottom: `1px solid ${LINE}`,
                    '&:hover': { bgcolor: alpha('#1a1a2e', 1) },
                  }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: alpha('#fff', 0.45), flex: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {group}
                  </Typography>
                  {groupCount > 0 && (
                    <Chip label={`+${groupCount}`} size="small"
                      sx={{ height: 15, fontSize: 9.5, bgcolor: alpha(ACCENT, 0.2), color: alpha(ACCENT, 0.9), mr: 0.5, '& .MuiChip-label': { px: 0.6 } }} />
                  )}
                  <ExpandMoreRoundedIcon
                    sx={{ fontSize: 14, color: alpha('#fff', 0.25), transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                </Box>

                {/* グループ内アイテム */}
                <Collapse in={!isCollapsed}>
                  <Box sx={{ py: 0.5 }}>
                    {items.map(cat => {
                      const entry = defaultsStore.getEntry(cat.key);
                      const count = itemCountMap.get(cat.key) ?? 0;
                      const canAdd = !!editingSet;

                      return (
                        <Box key={cat.key} onClick={() => canAdd && handleAddItem(cat.key)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            px: 1.5, py: 0.65, mx: 0.5, borderRadius: 1.5, mb: 0.15,
                            cursor: canAdd ? 'pointer' : 'not-allowed',
                            opacity: canAdd ? 1 : 0.4,
                            '&:hover': canAdd ? { bgcolor: alpha(ACCENT, 0.1) } : {},
                            transition: 'background 0.1s',
                          }}>
                          <Avatar src={entry?.thumbnailUrl} variant="rounded"
                            sx={{
                              width: 26, height: 26, flexShrink: 0,
                              bgcolor: alpha('#7c3aed', 0.2), fontSize: 9,
                              border: `1px solid ${entry ? alpha(ACCENT, 0.35) : alpha('#fff', 0.08)}`,
                            }}>
                            {!entry && '□'}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: alpha('#fff', 0.82), lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cat.label}
                            </Typography>
                            <Typography sx={{ fontSize: 9.5, color: alpha('#fff', 0.28), lineHeight: 1.2 }}>
                              {cat.widthMm}×{cat.depthMm}mm
                            </Typography>
                          </Box>
                          {/* セット内カウント */}
                          {count > 0 && (
                            <Chip label={count} size="small"
                              sx={{ height: 16, minWidth: 20, fontSize: 10, bgcolor: alpha(ACCENT, 0.22), color: alpha(ACCENT, 0.95), '& .MuiChip-label': { px: 0.6 } }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}

          {filteredGroups.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.25) }}>
                「{searchQuery}」に一致する家具が見つかりません
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
