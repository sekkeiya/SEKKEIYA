/**
 * ZonePropertiesPanel.jsx
 * 選択中ゾーンのプロパティ編集パネル（右サイドバー）。
 * カテゴリ（部屋）選択・名前・寸法・位置・面積・削除を提供する。
 * 変更は LayoutShell:UpdateZone / DeleteZone イベント経由で永続化される。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, Button, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useLayoutTaskStore } from '../../../../../store/useLayoutTaskStore';
import { useAutoLayoutStore } from '../../../../../store/useAutoLayoutStore';
import {
  getRoomCategories,
  getRoomCategoryMeta,
  zoneAreaLabel,
} from '../../../../../constants/roomCategories';

const LABEL_SX = {
  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
  letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.5,
};

const NumField = ({ label, value, onCommit, suffix = 'mm' }) => {
  const [local, setLocal] = useState(String(Math.round(value ?? 0)));
  useEffect(() => { setLocal(String(Math.round(value ?? 0))); }, [value]);
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onCommit(n);
    else setLocal(String(Math.round(value ?? 0)));
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', width: 30, flexShrink: 0 }}>{label}</Typography>
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        style={{
          flex: 1, minWidth: 0, boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 11.5,
          outline: 'none', fontFamily: 'inherit', textAlign: 'right',
        }}
      />
      <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', width: 20, flexShrink: 0 }}>{suffix}</Typography>
    </Box>
  );
};

export default function ZonePropertiesPanel({ zone }) {
  const buildingType = useAutoLayoutStore((s) => s.buildingType) ?? 'residential';
  const categories = getRoomCategories(buildingType);
  const catMeta = getRoomCategoryMeta(zone.category, buildingType);

  const [name, setName] = useState(zone.name ?? '');
  useEffect(() => { setName(zone.name ?? ''); }, [zone.id, zone.name]);

  const updateZone = useCallback((patch) => {
    window.dispatchEvent(new CustomEvent('LayoutShell:UpdateZone', {
      detail: { id: zone.id, __merge: true, ...patch },
    }));
  }, [zone.id]);

  const handleSelectCategory = useCallback((cat) => {
    // カテゴリ変更時: 名前が未編集（旧カテゴリ名 or 既定値）なら新カテゴリ名へ自動更新。色も連動。
    const oldMeta = getRoomCategoryMeta(zone.category, buildingType);
    const isAutoName = !zone.name || zone.name === oldMeta?.label || zone.name === 'New Zone' || zone.name === '汎用';
    updateZone({
      category: cat.key,
      color: cat.color,
      ...(isAutoName ? { name: cat.label } : {}),
    });
  }, [zone.category, zone.name, buildingType, updateZone]);

  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== zone.name) updateZone({ name: trimmed });
  }, [name, zone.name, updateZone]);

  const handleRect = useCallback((field, v) => {
    if (!zone.rect) return;
    const rect = { ...zone.rect };
    if (field === 'width') rect.width = Math.max(300, v);
    if (field === 'depth') rect.depth = Math.max(300, v);
    if (field === 'x') rect.x = v;
    if (field === 'z') rect.z = v;
    updateZone({ rect });
  }, [zone.rect, updateZone]);

  const handleDelete = useCallback(() => {
    window.dispatchEvent(new CustomEvent('LayoutShell:DeleteZone', { detail: { id: zone.id } }));
  }, [zone.id]);

  const handleClose = useCallback(() => {
    useLayoutTaskStore.getState().setActiveZoneId(null);
  }, []);

  const color = zone.color || catMeta?.color || '#94a3b8';

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>
          ゾーン設定
        </Typography>
        <Typography sx={{ fontSize: 11, color: alpha('#fff', 0.45), fontVariantNumeric: 'tabular-nums' }}>
          {zoneAreaLabel(zone.rect)}
        </Typography>
        <Tooltip title="選択解除">
          <Box onClick={handleClose} sx={{ cursor: 'pointer', display: 'flex', color: alpha('#fff', 0.35), '&:hover': { color: '#fff' } }}>
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        </Tooltip>
      </Box>

      {/* カテゴリ（部屋） */}
      <Box>
        <Typography sx={LABEL_SX}>カテゴリ（部屋）</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
          {categories.map(cat => {
            const active = zone.category === cat.key;
            return (
              <Box
                key={cat.key}
                onClick={() => handleSelectCategory(cat)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.35,
                  px: 0.7, py: 0.3, borderRadius: 1, cursor: 'pointer', userSelect: 'none',
                  fontSize: 10.5, fontWeight: active ? 700 : 400,
                  bgcolor: active ? alpha(cat.color, 0.22) : alpha('#fff', 0.04),
                  color: active ? cat.color : alpha('#fff', 0.45),
                  border: `1px solid ${active ? alpha(cat.color, 0.5) : alpha('#fff', 0.08)}`,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: alpha(cat.color, 0.12) },
                }}
              >
                <span style={{ fontSize: 10 }}>{cat.icon}</span>{cat.label}
              </Box>
            );
          })}
        </Box>
        <Typography sx={{ fontSize: 9, color: alpha('#fff', 0.25), mt: 0.4 }}>
          Auto Layout はカテゴリに対応する用途のセット家具を選択します
        </Typography>
      </Box>

      {/* 名前 */}
      <Box>
        <Typography sx={LABEL_SX}>名前</Typography>
        <TextField
          fullWidth size="small"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); }}
          placeholder={catMeta?.label ?? 'ゾーン名'}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#fff', fontSize: 12,
              '& fieldset': { borderColor: alpha('#fff', 0.12) },
              '&:hover fieldset': { borderColor: alpha('#fff', 0.25) },
              '&.Mui-focused fieldset': { borderColor: color },
            },
            '& input': { py: '6px' },
          }}
        />
      </Box>

      {/* 寸法・位置 */}
      {zone.rect && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          <Typography sx={LABEL_SX}>寸法・位置</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 0.6, minWidth: 0 }}>
            <NumField label="幅" value={zone.rect.width} onCommit={v => handleRect('width', v)} />
            <NumField label="奥行" value={zone.rect.depth} onCommit={v => handleRect('depth', v)} />
            <NumField label="X" value={zone.rect.x} onCommit={v => handleRect('x', v)} />
            <NumField label="Y" value={zone.rect.z} onCommit={v => handleRect('z', v)} />
          </Box>
        </Box>
      )}

      {/* 削除 */}
      <Button
        size="small"
        startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={handleDelete}
        sx={{
          textTransform: 'none', fontSize: 11, mt: 0.5,
          color: '#f87171', border: '1px solid rgba(248,113,113,0.2)',
          '&:hover': { bgcolor: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.4)' },
        }}
      >
        このゾーンを削除
      </Button>
      <Typography sx={{ fontSize: 9, color: alpha('#fff', 0.22), textAlign: 'center' }}>
        Delete キーでも削除できます（Topビュー）
      </Typography>
    </Box>
  );
}
