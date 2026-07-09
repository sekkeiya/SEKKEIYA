import React from 'react';
import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton, Switch, FormControlLabel } from '@mui/material';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import { useAppPreferencesStore } from '../../../store/useAppPreferencesStore';
import type { AppLanguage, AppThemeMode } from '../../../store/useAppPreferencesStore';
import { useT } from '../../../lib/i18n';
import { isTauri } from '../../../lib/platform';

/** Global Settings > 一般。アプリ全体の言語・テーマ設定。 */
export const GeneralSettingsPanel = () => {
  const t = useT();
  const language = useAppPreferencesStore(s => s.language);
  const themeMode = useAppPreferencesStore(s => s.themeMode);
  const autoOpenOsWindow = useAppPreferencesStore(s => s.autoOpenOsWindow);
  const setLanguage = useAppPreferencesStore(s => s.setLanguage);
  const setThemeMode = useAppPreferencesStore(s => s.setThemeMode);
  const setAutoOpenOsWindow = useAppPreferencesStore(s => s.setAutoOpenOsWindow);

  const sectionSx = {
    p: 3,
    borderRadius: 3,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
  } as const;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t({ ja: '一般設定', en: 'General' })}
      </Typography>

      {/* ── 言語 ── */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
          {t({ ja: '言語', en: 'Language' })}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t({
            ja: 'UIの表示言語です。対応済みの画面から順次適用されます。',
            en: 'Display language of the UI. Applied progressively as screens are localized.',
          })}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={language}
          onChange={(_, v: AppLanguage | null) => { if (v) setLanguage(v); }}
          size="small"
        >
          <ToggleButton value="ja" sx={{ px: 3, textTransform: 'none' }}>日本語</ToggleButton>
          <ToggleButton value="en" sx={{ px: 3, textTransform: 'none' }}>English</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* ── テーマ ── */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
          {t({ ja: 'テーマ', en: 'Theme' })}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t({
            ja: 'アプリ全体の基本配色です。「システム」はOSの設定に追従します。ライトモードは対応画面から順次拡大中です。',
            en: 'Base color scheme of the app. "System" follows your OS preference. Light mode is being rolled out screen by screen.',
          })}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={themeMode}
          onChange={(_, v: AppThemeMode | null) => { if (v) setThemeMode(v); }}
          size="small"
        >
          <ToggleButton value="dark" sx={{ px: 2.5, textTransform: 'none', gap: 0.75 }}>
            <DarkModeRoundedIcon sx={{ fontSize: 18 }} />
            {t({ ja: 'ダーク', en: 'Dark' })}
          </ToggleButton>
          <ToggleButton value="light" sx={{ px: 2.5, textTransform: 'none', gap: 0.75 }}>
            <LightModeRoundedIcon sx={{ fontSize: 18 }} />
            {t({ ja: 'ライト', en: 'Light' })}
          </ToggleButton>
          <ToggleButton value="system" sx={{ px: 2.5, textTransform: 'none', gap: 0.75 }}>
            <SettingsBrightnessRoundedIcon sx={{ fontSize: 18 }} />
            {t({ ja: 'システム', en: 'System' })}
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* ── SEKKEIYA OS ウィンドウ（デスクトップのみ） ── */}
      {isTauri() && (
        <Paper elevation={0} sx={sectionSx}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
            {t({ ja: 'SEKKEIYA OS ウィンドウ', en: 'SEKKEIYA OS window' })}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {t({
              ja: '起動時に SEKKEIYA OS（対話）を独立したウィンドウで自動的に開きます。SEKKEIYA の操作は、この別ウィンドウのチャットを中心に行う想定です。',
              en: 'Automatically open SEKKEIYA OS (chat) in its own window at startup. SEKKEIYA is designed to be operated primarily from this separate chat window.',
            })}
          </Typography>
          <FormControlLabel
            control={<Switch checked={autoOpenOsWindow} onChange={(_, v) => setAutoOpenOsWindow(v)} />}
            label={t({ ja: '起動時に別ウィンドウで自動的に開く', en: 'Open in a separate window at startup' })}
          />
        </Paper>
      )}
    </Box>
  );
};
