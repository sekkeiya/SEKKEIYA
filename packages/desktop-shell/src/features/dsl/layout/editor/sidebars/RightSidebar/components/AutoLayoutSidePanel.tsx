/**
 * AutoLayoutSidePanel.tsx
 * 右サイドバー「Auto Layout」パネル — 設定のみ表示。
 * 実行ボタンは RightSidebar の常時下部バー (AutoLayoutBottomBar) に集約済み。
 */

import React from 'react';
import {
  Box, Typography, FormControl, FormLabel, RadioGroup,
  FormControlLabel, Radio, TextField, InputAdornment, Divider,
  Button, CircularProgress, Tooltip, Stack, Select, MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAutoLayoutStore } from '../../../../store/useAutoLayoutStore';
import { useLayoutTaskStore } from '../../../../store/useLayoutTaskStore';
import type { BuildingType } from '../../../../types/layoutRules';

const PURPOSE_OPTIONS: Record<BuildingType, { value: string; label: string }[]> = {
  residential: [
    { value: 'general', label: '汎用' },
    { value: 'living',  label: 'リビング' },
    { value: 'bedroom', label: '寝室' },
    { value: 'study',   label: '書斎' },
  ],
  office: [
    { value: 'general', label: '汎用' },
    { value: 'desk',    label: '執務室' },
    { value: 'meeting', label: '会議室' },
  ],
  cafe:   [{ value: 'general', label: '汎用' }, { value: 'seating', label: '客席' }],
  hotel:  [{ value: 'general', label: '汎用' }],
  custom: [{ value: 'general', label: '汎用' }],
};

const line = 'rgb(var(--brand-fg-rgb) / 0.1)';
const accent = '#a78bfa';

const radioSx = { color: line, '&.Mui-checked': { color: accent }, padding: '4px 8px' };
const headingSx = { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 12, fontWeight: 700, mb: 1, '&.Mui-focused': { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" } };
const sectionSx = { mb: 2.5 };

interface Props { projectId?: string | null }

export default function AutoLayoutSidePanel({ projectId: _projectId }: Props) {
  const autoLayoutMode    = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);
  const buildingType    = useAutoLayoutStore((s) => s.buildingType);
  const setBuildingType = useAutoLayoutStore((s) => s.setBuildingType);
  const zonePurpose    = useAutoLayoutStore((s) => s.zonePurpose);
  const setZonePurpose = useAutoLayoutStore((s) => s.setZonePurpose);
  const roomWidthMm    = useAutoLayoutStore((s) => s.roomWidthMm);
  const roomDepthMm    = useAutoLayoutStore((s) => s.roomDepthMm);
  const setRoomWidthMm = useAutoLayoutStore((s) => s.setRoomWidthMm);
  const setRoomDepthMm = useAutoLayoutStore((s) => s.setRoomDepthMm);
  const isGenerating      = useAutoLayoutStore((s) => s.isGenerating);
  const progressMessage   = useAutoLayoutStore((s) => s.progressMessage);
  const requestAutoLayout = useAutoLayoutStore((s) => s.requestAutoLayout);
  const openRulesDialog   = useAutoLayoutStore((s) => s.openRulesDialog);

  const planPaperSize     = useAutoLayoutStore((s) => s.planPaperSize);
  const planScale         = useAutoLayoutStore((s) => s.planScale);
  const planOrientation   = useAutoLayoutStore((s) => s.planOrientation);
  const setPlanPaperSize  = useAutoLayoutStore((s) => s.setPlanPaperSize);
  const setPlanScale      = useAutoLayoutStore((s) => s.setPlanScale);
  const setPlanOrientation = useAutoLayoutStore((s) => s.setPlanOrientation);

  const zones           = useLayoutTaskStore((s) => s.zones);
  const selectedZoneIds = useLayoutTaskStore((s) => s.selectedZoneIds);
  const hasZones = zones.length > 0;

  const handleExecute = () => {
    const ids = selectedZoneIds.length > 0
      ? selectedZoneIds
      : zones.length > 0
        ? zones.map((z) => z.id)
        : ['__full_room__'];
    requestAutoLayout(ids);
  };

  const hint =
    selectedZoneIds.length > 0
      ? `選択中 ${selectedZoneIds.length} ゾーンを対象にします`
      : zones.length > 0
        ? `全 ${zones.length} ゾーンを対象にします`
        : 'ゾーン未定義 — 部屋全体を対象にします';

  const inputSx = {
    flex: 1,
    '& .MuiOutlinedInput-root': {
      color: 'var(--brand-fg)', fontSize: 13,
      '& fieldset': { borderColor: line },
      '&:hover fieldset': { borderColor: alpha('#fff', 0.35) },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
    '& .MuiInputLabel-root': { color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", fontSize: 12, '&.Mui-focused': { color: accent } },
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 1.5, display: 'flex', flexDirection: 'column' }}>

      {/* ゾーンなし時: 部屋寸法 */}
      {!hasZones && (
        <Box sx={sectionSx}>
          <FormLabel sx={headingSx}>部屋の寸法</FormLabel>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField size="small" label="幅" type="number" value={roomWidthMm}
              onChange={(e) => setRoomWidthMm(Math.max(1000, Number(e.target.value)))}
              InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>mm</Typography></InputAdornment> }}
              inputProps={{ min: 1000, max: 20000, step: 100 }} sx={inputSx} />
            <TextField size="small" label="奥行き" type="number" value={roomDepthMm}
              onChange={(e) => setRoomDepthMm(Math.max(1000, Number(e.target.value)))}
              InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>mm</Typography></InputAdornment> }}
              inputProps={{ min: 1000, max: 20000, step: 100 }} sx={inputSx} />
          </Box>
          <Divider sx={{ borderColor: line, mt: 2 }} />
        </Box>
      )}

      {/* 生成モード */}
      <Box sx={sectionSx}>
        <FormControl>
          <FormLabel sx={headingSx}>生成モード</FormLabel>
          <RadioGroup value={autoLayoutMode} onChange={(e) => setAutoLayoutMode(e.target.value as 'ai' | 'rules-only')}>
            <FormControlLabel value="rules-only" control={<Radio size="small" sx={radioSx} />}
              label={<Typography sx={{ fontSize: 13 }}>ルールベース（高速）</Typography>} />
            <FormControlLabel value="ai" control={<Radio size="small" sx={radioSx} />}
              label={<Typography sx={{ fontSize: 13 }}>AI レイアウト</Typography>} />
          </RadioGroup>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: line, mb: 2 }} />

      {/* 建物タイプ */}
      <Box sx={sectionSx}>
        <FormControl>
          <FormLabel sx={headingSx}>建物タイプ</FormLabel>
          <RadioGroup value={buildingType} row sx={{ gap: 1, flexWrap: 'wrap' }}
            onChange={(e) => { setBuildingType(e.target.value as any); setZonePurpose('general'); }}>
            {(['residential', 'office', 'cafe', 'hotel'] as BuildingType[]).map(bt => (
              <FormControlLabel key={bt} value={bt} control={<Radio size="small" sx={radioSx} />}
                label={<Typography sx={{ fontSize: 12 }}>{{ residential: '住宅', office: 'オフィス', cafe: 'カフェ', hotel: 'ホテル', custom: 'カスタム' }[bt]}</Typography>} />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: line, mb: 2 }} />

      {/* ゾーン用途 */}
      <Box sx={sectionSx}>
        <FormControl>
          <FormLabel sx={headingSx}>ゾーン用途</FormLabel>
          <RadioGroup value={zonePurpose} row sx={{ gap: 1, flexWrap: 'wrap' }}
            onChange={(e) => setZonePurpose(e.target.value as any)}>
            {PURPOSE_OPTIONS[buildingType]?.map(opt => (
              <FormControlLabel key={opt.value} value={opt.value} control={<Radio size="small" sx={radioSx} />}
                label={<Typography sx={{ fontSize: 12 }}>{opt.label}</Typography>} />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: line, mb: 2 }} />

      {/* 図面出力（採用時に Topビュー平面図を生成） */}
      <Box sx={sectionSx}>
        <FormLabel sx={headingSx}>図面出力（採用時に平面図を生成）</FormLabel>
        <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mb: 1 }}>
          採用時に Topビュー（通常モード）の平面図を用紙サイズ・縮尺に合わせて生成し History に保存します。
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {/* 用紙サイズ */}
          <FormControl size="small" sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mb: 0.5 }}>用紙</Typography>
            <Select
              value={planPaperSize}
              onChange={(e) => setPlanPaperSize(e.target.value as 'A3' | 'A4')}
              sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: line }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.35) }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent }, '.MuiSvgIcon-root': { color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" } }}
            >
              <MenuItem value="A3">A3</MenuItem>
              <MenuItem value="A4">A4</MenuItem>
            </Select>
          </FormControl>

          {/* 縮尺 */}
          <FormControl size="small" sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mb: 0.5 }}>縮尺</Typography>
            <Select
              value={planScale === 'auto' ? 'auto' : String(planScale)}
              onChange={(e) => setPlanScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
              sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: line }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.35) }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent }, '.MuiSvgIcon-root': { color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" } }}
            >
              <MenuItem value="auto">自動（用紙に合わせる）</MenuItem>
              {[20, 30, 50, 100, 150, 200, 250, 300, 500].map((s) => (
                <MenuItem key={s} value={String(s)}>1:{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* 向き */}
        <FormControl>
          <RadioGroup row value={planOrientation} sx={{ gap: 1 }}
            onChange={(e) => setPlanOrientation(e.target.value as 'auto' | 'portrait' | 'landscape')}>
            {([['auto', '自動'], ['landscape', '横'], ['portrait', '縦']] as const).map(([v, lbl]) => (
              <FormControlLabel key={v} value={v} control={<Radio size="small" sx={radioSx} />}
                label={<Typography sx={{ fontSize: 12 }}>{lbl}</Typography>} />
            ))}
          </RadioGroup>
        </FormControl>
      </Box>

      {/* ── 実行バー（設定パネル下部に固定） ── */}
      <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${alpha('#fff', 0.08)}` }}>
        {progressMessage && (
          <Typography sx={{ fontSize: 11, color: alpha(accent, 0.9), textAlign: 'center', mb: 0.75 }}>
            {progressMessage}
          </Typography>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="contained"
            disabled={isGenerating}
            onClick={handleExecute}
            startIcon={
              isGenerating
                ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} />
                : <AutoFixHighRoundedIcon sx={{ fontSize: 16 }} />
            }
            sx={{
              py: 0.9, textTransform: 'none', fontWeight: 800, fontSize: 12.5,
              bgcolor: '#7c3aed', color: 'var(--brand-fg)', borderRadius: 2,
              '&:hover': { bgcolor: '#6d28d9' },
              '&.Mui-disabled': { bgcolor: alpha('#7c3aed', 0.3), color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" },
            }}
          >
            {isGenerating ? '生成中…' : 'Auto Layout 実行'}
          </Button>
          <Tooltip title="レイアウトルール設定" placement="top">
            <Button
              variant="outlined"
              onClick={openRulesDialog}
              sx={{
                minWidth: 38, width: 38, height: 38, p: 0, flexShrink: 0, borderRadius: 2,
                borderColor: alpha('#fff', 0.2), color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)",
                '&:hover': { borderColor: accent, color: accent, bgcolor: alpha('#7c3aed', 0.12) },
              }}
            >
              <TuneRoundedIcon sx={{ fontSize: 17 }} />
            </Button>
          </Tooltip>
        </Stack>
        <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", textAlign: 'center', mt: 0.75 }}>
          {hint}
        </Typography>
      </Box>
    </Box>
  );
}
