import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  TextField,
  InputAdornment,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useAutoLayoutStore } from '../store/useAutoLayoutStore';

import type { BuildingType } from '../types/layoutRules';

interface AutoLayoutConfigDialogProps {
  projectId: string | null;
}

const PURPOSE_OPTIONS: Record<BuildingType, { value: string, label: string }[]> = {
  residential: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'living', label: 'リビング (Living)' },
    { value: 'bedroom', label: '寝室 (Bedroom)' },
    { value: 'study', label: '書斎 (Study)' },
  ],
  office: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'desk', label: '執務室 (Desk)' },
    { value: 'meeting', label: '会議室 (Meeting)' },
  ],
  cafe: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'seating', label: '客席 (Seating)' },
  ],
  hotel: [{ value: 'general', label: '汎用 (General)' }],
  custom: [{ value: 'general', label: '汎用 (General)' }],
};

export function AutoLayoutConfigDialog({ projectId }: AutoLayoutConfigDialogProps) {
  const theme = useTheme();
  
  const configDialogOpen = useAutoLayoutStore((s) => s.configDialogOpen);
  const closeConfigDialog = useAutoLayoutStore((s) => s.closeConfigDialog);
  const autoLayoutMode = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);

  const selectedZoneIdsForConfig = useAutoLayoutStore((s) => s.selectedZoneIdsForConfig);
  const requestAutoLayout = useAutoLayoutStore((s) => s.requestAutoLayout);

  const buildingType = useAutoLayoutStore((s) => s.buildingType);
  const setBuildingType = useAutoLayoutStore((s) => s.setBuildingType);
  const zonePurpose = useAutoLayoutStore((s) => s.zonePurpose);
  const setZonePurpose = useAutoLayoutStore((s) => s.setZonePurpose);
  const roomWidthMm = useAutoLayoutStore((s) => s.roomWidthMm);
  const roomDepthMm = useAutoLayoutStore((s) => s.roomDepthMm);
  const setRoomWidthMm = useAutoLayoutStore((s) => s.setRoomWidthMm);
  const setRoomDepthMm = useAutoLayoutStore((s) => s.setRoomDepthMm);

  const noZones = selectedZoneIdsForConfig.length === 0;

  const handleExecute = () => {
    // ゾーンなしの場合は __full_room__ という特殊IDを使い、部屋全体をゾーンとして扱う
    const ids = noZones ? ['__full_room__'] : selectedZoneIdsForConfig;
    requestAutoLayout(ids);
  };

  const line = alpha(theme.palette.common.white, 0.15);

  return (
    <Dialog
      open={configDialogOpen}
      onClose={closeConfigDialog}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "var(--brand-surface2)",
          border: `1px solid ${line}`,
          color: "var(--brand-fg)",
          minWidth: 380,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontSize: 18, borderBottom: `1px solid ${line}`, pb: 2 }}>
        Auto Layout の設定
        {noZones && (
          <Typography sx={{ fontSize: 12, color: 'light-dark(rgba(47,7,166,0.9), rgba(167,139,250,0.9))', mt: 0.5, fontWeight: 400 }}>
            ゾーン未定義のため、部屋全体を配置エリアとして使用します
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 部屋寸法（ゾーン未定義時のみ表示） */}
          {noZones && (
            <FormControl>
              <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 14, mb: 1.5, '&.Mui-focused': { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" } }}>
                部屋の寸法
              </FormLabel>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  size="small"
                  label="幅"
                  type="number"
                  value={roomWidthMm}
                  onChange={(e) => setRoomWidthMm(Math.max(1000, Number(e.target.value)))}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>mm</Typography></InputAdornment> }}
                  inputProps={{ min: 1000, max: 20000, step: 100 }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: line }, '&:hover fieldset': { borderColor: alpha('#fff', 0.4) }, '&.Mui-focused fieldset': { borderColor: '#a78bfa' } },
                    '& .MuiInputLabel-root': { color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", '&.Mui-focused': { color: 'light-dark(#2f07a6, #a78bfa)' } },
                  }}
                />
                <TextField
                  size="small"
                  label="奥行き"
                  type="number"
                  value={roomDepthMm}
                  onChange={(e) => setRoomDepthMm(Math.max(1000, Number(e.target.value)))}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>mm</Typography></InputAdornment> }}
                  inputProps={{ min: 1000, max: 20000, step: 100 }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: line }, '&:hover fieldset': { borderColor: alpha('#fff', 0.4) }, '&.Mui-focused fieldset': { borderColor: '#a78bfa' } },
                    '& .MuiInputLabel-root': { color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", '&.Mui-focused': { color: 'light-dark(#2f07a6, #a78bfa)' } },
                  }}
                />
              </Box>
            </FormControl>
          )}
          <FormControl>
            <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 14, mb: 1, '&.Mui-focused': { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" } }}>
              生成モード
            </FormLabel>
            <RadioGroup
              value={autoLayoutMode}
              onChange={(e) => setAutoLayoutMode(e.target.value as 'ai' | 'rules-only')}
            >
              <FormControlLabel 
                value="rules-only" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>ルールベースのみ（高速）</Typography>} 
              />
              <FormControlLabel 
                value="ai" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>AI レイアウト</Typography>} 
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 14, mb: 1, '&.Mui-focused': { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" } }}>
              建物タイプ（配置ルールの基準）
            </FormLabel>
            <RadioGroup
              value={buildingType}
              onChange={(e) => {
                setBuildingType(e.target.value as any);
                setZonePurpose('general'); // Reset purpose when building type changes
              }}
              row
              sx={{ gap: 2 }}
            >
              <FormControlLabel 
                value="residential" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>住宅 (Residential)</Typography>} 
              />
              <FormControlLabel 
                value="office" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>オフィス (Office)</Typography>} 
              />
              <FormControlLabel 
                value="cafe" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>カフェ (Cafe)</Typography>} 
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 14, mb: 1, '&.Mui-focused': { color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" } }}>
              ゾーン用途（配置ルールの基準）
            </FormLabel>
            <RadioGroup
              value={zonePurpose}
              onChange={(e) => setZonePurpose(e.target.value as any)}
              row
              sx={{ gap: 2, flexWrap: 'wrap' }}
            >
              {PURPOSE_OPTIONS[buildingType]?.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: 'light-dark(#2f07a6, #a78bfa)' } }} />}
                  label={<Typography sx={{ fontSize: 15 }}>{opt.label}</Typography>}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: `1px solid ${line}`, mt: 'auto', gap: 1 }}>
        <Button
          onClick={closeConfigDialog}
          sx={{
            color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)",
            "&:hover": { background: alpha("#fff", 0.05) },
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={false}
          sx={{
            borderRadius: 1,
            fontWeight: 800,
            background: "#7c3aed",
            "&:hover": { background: "#6d28d9" },
            "&.Mui-disabled": { background: alpha("#7c3aed", 0.3), color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }
          }}
        >
          実行
        </Button>
      </DialogActions>
    </Dialog>
  );
}
