import { useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { darkDesktopTheme, lightDesktopTheme } from './theme';
import { useAppPreferencesStore } from '../store/useAppPreferencesStore';

/**
 * ユーザー設定（Global Settings > 一般）を反映したMUIテーマを返す。
 * 'system' はOSの prefers-color-scheme に追従。
 * 副作用として <html> の lang / data-theme 属性も同期する（CSS側からの参照用）。
 */
export const useAppTheme = (): Theme => {
  const themeMode = useAppPreferencesStore(s => s.themeMode);
  const language = useAppPreferencesStore(s => s.language);
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');

  const resolved: 'dark' | 'light' =
    themeMode === 'system' ? (prefersLight ? 'light' : 'dark') : themeMode;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = resolved;
  }, [language, resolved]);

  return resolved === 'light' ? lightDesktopTheme : darkDesktopTheme;
};
