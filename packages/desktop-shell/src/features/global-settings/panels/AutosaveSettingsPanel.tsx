import React from 'react';
import { Box, Typography, Switch, FormControlLabel, Slider, Paper, Stack } from '@mui/material';
import { useUserSettingsStore } from '../../../store/useUserSettingsStore';

/**
 * 自動保存の設定パネル。
 * 自動保存はローカル下書き（…/WorkFiles/<3DSx>/）にのみ書き込み、クラウド(Firestore)
 * への書き込みは増やさない。クラウド保存は手動 or 終了時ダイアログ経由。
 */
export const AutosaveSettingsPanel: React.FC = () => {
  const autosaveEnabled = useUserSettingsStore(s => s.autosaveEnabled);
  const autosaveDebounceMs = useUserSettingsStore(s => s.autosaveDebounceMs);
  const setAutosave = useUserSettingsStore(s => s.setAutosave);

  const seconds = Math.round(autosaveDebounceMs / 100) / 10;

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>自動保存</Typography>
      <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 3 }}>
        編集を止めると、各アプリの作業内容をお使いの PC のローカルフォルダ
        （…/SEKKEIYA/Projects/&lt;プロジェクト&gt;/WorkFiles/3DSL・3DSP・3DSC・3DSD）に自動で下書き保存します。
        クラウドへの公開・保存は行わないため、通信量・コストは増えません。
      </Typography>

      <Paper sx={{ p: 3, bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={autosaveEnabled}
                onChange={(e) => setAutosave({ enabled: e.target.checked })}
              />
            }
            label="自動保存を有効にする"
          />

          <Box sx={{ opacity: autosaveEnabled ? 1 : 0.4, pointerEvents: autosaveEnabled ? 'auto' : 'none' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              保存タイミング（編集停止後）: <strong>{seconds.toFixed(1)} 秒</strong>
            </Typography>
            <Slider
              value={autosaveDebounceMs}
              min={1000}
              max={10000}
              step={500}
              marks={[
                { value: 1000, label: '1s' },
                { value: 2000, label: '2s' },
                { value: 5000, label: '5s' },
                { value: 10000, label: '10s' },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${(v / 1000).toFixed(1)}s`}
              onChange={(_, v) => setAutosave({ debounceMs: Array.isArray(v) ? v[0] : v })}
              sx={{ maxWidth: 420 }}
            />
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};
