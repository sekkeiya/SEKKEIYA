/**
 * ZoneListPanel.jsx
 * Zone モード（ゾーンスコープ）で、個別ゾーン未選択のときに右サイドバーへ出す
 * ゾーン一覧／操作パネル。
 *   - 「自動ゾーニング」: 自動ラベルの床/内壁から部屋＝ゾーンを自動生成（autoZoning）。
 *   - ゾーン一覧: クリックで選択（activeZoneId）→ ZonePropertiesPanel に切り替わる。
 *   - ゾーン未作成時は描画手順のガイドを表示。
 * 個別ゾーン選択中は RightSidebar 側で ZonePropertiesPanel が優先表示される。
 */
import React, { useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import { useLayoutTaskStore } from '../../../../../store/useLayoutTaskStore';
import { useAutoLayoutStore } from '../../../../../store/useAutoLayoutStore';
import { useAutoActionStore } from '../../../../../store/useAutoActionStore';
import { getRoomCategoryMeta, zoneAreaLabel } from '../../../../../constants/roomCategories';
import { autoZoning } from '../../../../../services/autoZoning';

const LABEL_SX = {
  fontSize: 10, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.35)',
  letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.5,
};

export default function ZoneListPanel() {
  const zones = useLayoutTaskStore((s) => s.zones);
  const buildingType = useAutoLayoutStore((s) => s.buildingType) ?? 'residential';

  const handleSelectZone = useCallback((id) => {
    useLayoutTaskStore.getState().setActiveZoneId(id);
  }, []);

  const handleAutoZoning = useCallback(() => {
    const res = autoZoning();
    const { pushToast } = useAutoActionStore.getState();
    if (res.ok) pushToast('success', `自動ゾーニング完了（${res.roomCount}部屋・${res.zoneCount}ゾーンを生成）`);
    else pushToast('warning', res.reason || '自動ゾーニングに失敗しました');
  }, []);

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DashboardRoundedIcon sx={{ fontSize: 16, color: '#2dd4bf' }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>
          ゾーン
        </Typography>
        <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", fontVariantNumeric: 'tabular-nums' }}>
          {zones.length} 件
        </Typography>
      </Box>

      {/* 自動ゾーニング */}
      <Button
        size="small"
        startIcon={<DashboardRoundedIcon sx={{ fontSize: 16 }} />}
        onClick={handleAutoZoning}
        sx={{
          textTransform: 'none', fontSize: 12, fontWeight: 700, py: 0.7,
          color: '#0b1020', bgcolor: '#2dd4bf',
          '&:hover': { bgcolor: '#5eead4' },
        }}
      >
        自動ゾーニング
      </Button>
      <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 28%, transparent)", mt: -0.7 }}>
        自動ラベルの床・内壁から部屋（ゾーン）を自動生成します
      </Typography>

      {/* ゾーン一覧 */}
      <Box>
        <Typography sx={LABEL_SX}>ゾーン一覧</Typography>
        {zones.length === 0 ? (
          <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", lineHeight: 1.6 }}>
            ゾーンがありません。「自動ゾーニング」を実行するか、Top ビューで2点クリックして矩形ゾーンを描画してください。
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {zones.map((z) => {
              const meta = getRoomCategoryMeta(z.category, buildingType);
              const color = z.color || meta?.color || '#94a3b8';
              return (
                <Box
                  key={z.id}
                  onClick={() => handleSelectZone(z.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 0.8, py: 0.5, borderRadius: 1, cursor: 'pointer',
                    bgcolor: alpha('#fff', 0.04), border: `1px solid ${alpha('#fff', 0.08)}`,
                    transition: 'all 0.12s',
                    '&:hover': { bgcolor: `color-mix(in srgb, ${color} 12%, transparent)`, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` },
                  }}
                >
                  <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11.5, color: 'var(--brand-fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {z.name || meta?.label || 'ゾーン'}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {zoneAreaLabel(z.rect)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
