/**
 * FurnitureSetEditorDialog.tsx
 * デフォルトセット家具エディター。
 * 左：セット一覧 / 中央：3Dパースビュー / 右：家具カテゴリ追加パネル
 */

import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent,
  Box, IconButton, Typography, Button, TextField,
  Divider, Tooltip, Avatar, CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';

import { useAuthStore } from '../../../../store/useAuthStore';
import { useFurnitureSetsStore } from '../store/useFurnitureSetsStore';
import { useFurnitureDefaultsStore } from '../store/useFurnitureDefaultsStore';
import { FURNITURE_CATEGORIES } from '../constants/furnitureCategoryDefaults';
import { SetSceneCanvas } from '../canvas/SetSceneCanvas';
import type { FurnitureSet, FurnitureSetItem } from '../types/furnitureSet';

const ACCENT = '#a78bfa';
const LINE = 'rgb(var(--brand-fg-rgb) / 0.1)';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
}

function genId() { return `si_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

/** カテゴリの初期配置位置（単純なグリッド） */
function getInitialTransform(index: number): FurnitureSetItem['transform'] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return { x: (col - 1) * 1.5, z: row * 1.5, rotationDeg: 0 };
}

export function FurnitureSetEditorDialog({ open, onClose, projectId }: Props) {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const setsStore = useFurnitureSetsStore();
  const defaultsStore = useFurnitureDefaultsStore();

  // 選択中のセット
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<FurnitureSet | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    if (open && uid) {
      setsStore.load(uid);
      defaultsStore.load(uid, projectId ?? null);
    }
  }, [open, uid]); // eslint-disable-line

  useEffect(() => {
    if (!open) { setActiveSetId(null); setEditingSet(null); setSelectedItemId(null); }
  }, [open]);

  // セットを選択して編集バッファへ
  const openSet = (set: FurnitureSet) => {
    setActiveSetId(set.id);
    setEditingSet(JSON.parse(JSON.stringify(set)));
    setSelectedItemId(null);
  };

  // 新規セット作成
  const handleCreateSet = () => {
    if (!uid || !newSetName.trim()) return;
    const { furnitureSetsApi } = require('../services/furnitureSetsApi') as any;
    const id = furnitureSetsApi.newId(uid);
    const newSet: FurnitureSet = { id, name: newSetName.trim(), items: [] };
    openSet(newSet);
    setNewSetName('');
    setCreatingNew(false);
  };

  // セットを保存
  const handleSave = async () => {
    if (!uid || !editingSet) return;
    await setsStore.save(uid, editingSet);
  };

  // セットを削除
  const handleDeleteSet = async (id: string) => {
    if (!uid) return;
    await setsStore.remove(uid, id);
    if (activeSetId === id) { setActiveSetId(null); setEditingSet(null); }
  };

  // 家具カテゴリを追加
  const handleAddItem = (categoryKey: string) => {
    if (!editingSet) return;
    const cat = FURNITURE_CATEGORIES.find(c => c.key === categoryKey);
    if (!cat) return;
    const entry = defaultsStore.getEntry(categoryKey);
    const newItem: FurnitureSetItem = {
      id: genId(),
      categoryKey,
      entityId: entry?.entityId,
      title: entry?.title || cat.label,
      thumbnailUrl: entry?.thumbnailUrl,
      glbUrl: undefined, // 実際の GLB URL は別途解決
      transform: getInitialTransform(editingSet.items.length),
    };
    setEditingSet(s => s ? { ...s, items: [...s.items, newItem] } : s);
    setSelectedItemId(newItem.id);
  };

  // アイテム削除
  const handleRemoveItem = (id: string) => {
    setEditingSet(s => s ? { ...s, items: s.items.filter(i => i.id !== id) } : s);
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // ドラッグ移動
  const handleTransformChange = (id: string, x: number, z: number) => {
    setEditingSet(s => {
      if (!s) return s;
      return { ...s, items: s.items.map(i => i.id === id ? { ...i, transform: { ...i.transform, x, z } } : i) };
    });
  };

  // 選択アイテムを90度回転
  const handleRotate = () => {
    if (!selectedItemId) return;
    setEditingSet(s => {
      if (!s) return s;
      return {
        ...s,
        items: s.items.map(i =>
          i.id === selectedItemId
            ? { ...i, transform: { ...i.transform, rotationDeg: (i.transform.rotationDeg + 90) % 360 } }
            : i
        ),
      };
    });
  };

  const selectedItem = editingSet?.items.find(i => i.id === selectedItemId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '95vw', maxWidth: 1400,
          height: '90vh',
          borderRadius: 3,
          background: 'var(--brand-surface)',
          border: `1px solid ${LINE}`,
          color: 'var(--brand-fg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* ヘッダー */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${LINE}`, py: 1.5, px: 2.5, flexShrink: 0 }}>
        <GridViewRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
        <Typography sx={{ fontWeight: 800, fontSize: 16, flex: 1 }}>デフォルトセット家具</Typography>
        <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mr: 1 }}>
          よく使う家具の組み合わせを登録して自動レイアウトで活用する
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        {/* ── 左: セット一覧 ── */}
        <Box sx={{ width: 220, flexShrink: 0, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: alpha('#fff', 0.015) }}>
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, flex: 1, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>セット一覧</Typography>
            <Tooltip title="新規セット">
              <IconButton size="small" onClick={() => setCreatingNew(true)} sx={{ color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", '&:hover': { color: ACCENT } }}>
                <AddRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* 新規名前入力 */}
          {creatingNew && (
            <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${LINE}` }}>
              <TextField
                autoFocus
                size="small"
                fullWidth
                placeholder="セット名を入力..."
                value={newSetName}
                onChange={e => setNewSetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateSet(); if (e.key === 'Escape') setCreatingNew(false); }}
                sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 12, '& fieldset': { borderColor: ACCENT }, }, '& input': { py: '6px' } }}
              />
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                <Button size="small" onClick={handleCreateSet} disabled={!newSetName.trim()}
                  sx={{ flex: 1, fontSize: 11, bgcolor: alpha(ACCENT, 0.2), color: ACCENT, '&:hover': { bgcolor: alpha(ACCENT, 0.3) } }}>作成</Button>
                <Button size="small" onClick={() => setCreatingNew(false)}
                  sx={{ flex: 1, fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>キャンセル</Button>
              </Box>
            </Box>
          )}

          {/* セットリスト */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {setsStore.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box>
            ) : setsStore.sets.length === 0 && !creatingNew ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 11.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", lineHeight: 1.6 }}>
                  セットがありません<br />「+」で新規作成
                </Typography>
              </Box>
            ) : (
              setsStore.sets.map(set => (
                <Box
                  key={set.id}
                  onClick={() => openSet(set)}
                  sx={{
                    display: 'flex', alignItems: 'center', px: 1.5, py: 1,
                    cursor: 'pointer',
                    bgcolor: activeSetId === set.id ? alpha(ACCENT, 0.12) : 'transparent',
                    borderLeft: `2px solid ${activeSetId === set.id ? ACCENT : 'transparent'}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.04) },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: activeSetId === set.id ? 'var(--brand-fg)' : "color-mix(in srgb, var(--brand-fg) 80%, transparent)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {set.name}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" }}>
                      {set.items.length} アイテム
                    </Typography>
                  </Box>
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); handleDeleteSet(set.id); }}
                      sx={{ color: "color-mix(in srgb, var(--brand-fg) 25%, transparent)", '&:hover': { color: 'light-dark(#a50808, #f87171)' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* ── 中央: 3Dビュー ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!editingSet ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5 }}>
              <GridViewRoundedIcon sx={{ fontSize: 48, color: "color-mix(in srgb, var(--brand-fg) 12%, transparent)" }} />
              <Typography sx={{ fontSize: 13, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" }}>
                左のセット一覧からセットを選択するか、新規作成してください
              </Typography>
            </Box>
          ) : (
            <>
              {/* ビューツールバー */}
              <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
                <TextField
                  size="small"
                  value={editingSet.name}
                  onChange={e => setEditingSet(s => s ? { ...s, name: e.target.value } : s)}
                  sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 13, fontWeight: 700, '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: LINE }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '4px' } }}
                />
                <Box sx={{ flex: 1 }} />
                {selectedItem && (
                  <>
                    <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
                      選択: {selectedItem.title}
                    </Typography>
                    <Tooltip title="90° 回転">
                      <IconButton size="small" onClick={handleRotate} sx={{ color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)", '&:hover': { color: ACCENT } }}>
                        <RotateRightRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton size="small" onClick={() => handleRemoveItem(selectedItemId!)} sx={{ color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", '&:hover': { color: 'light-dark(#a50808, #f87171)' } }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: LINE, mx: 0.5 }} />
                  </>
                )}
                <Button
                  size="small"
                  onClick={handleSave}
                  sx={{ bgcolor: alpha(ACCENT, 0.2), color: ACCENT, fontSize: 11.5, fontWeight: 700, '&:hover': { bgcolor: alpha(ACCENT, 0.35) }, borderRadius: 1 }}
                >
                  保存
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
                  <Box sx={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <Box sx={{ textAlign: 'center', bgcolor: "color-mix(in srgb, var(--brand-bg) 50%, transparent)", px: 3, py: 2, borderRadius: 2 }}>
                      <Typography sx={{ fontSize: 13, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
                        右のパネルから家具カテゴリを追加してください
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* ── 右: カテゴリ追加パネル ── */}
        <Box sx={{ width: 240, flexShrink: 0, borderLeft: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: alpha('#fff', 0.015) }}>
          <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>
              家具を追加
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", mt: 0.25 }}>
              クリックしてセットに追加
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {FURNITURE_CATEGORIES.map(cat => {
              const entry = defaultsStore.getEntry(cat.key);
              return (
                <Box
                  key={cat.key}
                  onClick={() => editingSet && handleAddItem(cat.key)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.75, borderRadius: 1.5, mb: 0.25,
                    cursor: editingSet ? 'pointer' : 'not-allowed',
                    opacity: editingSet ? 1 : 0.4,
                    '&:hover': editingSet ? { bgcolor: alpha(ACCENT, 0.1) } : {},
                    transition: 'background 0.1s',
                  }}
                >
                  <Avatar
                    src={entry?.thumbnailUrl}
                    variant="rounded"
                    sx={{ width: 28, height: 28, flexShrink: 0, bgcolor: alpha('#7c3aed', 0.2), fontSize: 9, border: `1px solid ${entry ? alpha(ACCENT, 0.4) : alpha('#fff', 0.1)}` }}
                  >
                    {!entry && '□'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)", lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.label}
                    </Typography>
                    <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", lineHeight: 1.2 }}>
                      {cat.widthMm}×{cat.depthMm}mm
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
