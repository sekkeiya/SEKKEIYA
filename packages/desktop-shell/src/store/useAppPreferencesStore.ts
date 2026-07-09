import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** アプリ全体のユーザー環境設定（言語・テーマ）。Global Settings > 一般 から変更する。 */

export type AppLanguage = 'ja' | 'en';
export type AppThemeMode = 'dark' | 'light' | 'system';

interface AppPreferencesState {
  /** UI表示言語。i18n対応済みの画面から順次適用される。 */
  language: AppLanguage;
  /** カラーテーマ。'system' はOSの設定（prefers-color-scheme）に追従。 */
  themeMode: AppThemeMode;
  /** 起動時に SEKKEIYA OS（対話）を独立ウィンドウで自動的に開く（デスクトップのみ）。既定ON。
   *  SEKKEIYA の操作の中心＝別ウィンドウのチャットという方針の既定挙動。 */
  autoOpenOsWindow: boolean;
  setLanguage: (language: AppLanguage) => void;
  setThemeMode: (themeMode: AppThemeMode) => void;
  setAutoOpenOsWindow: (autoOpenOsWindow: boolean) => void;
}

export const useAppPreferencesStore = create<AppPreferencesState>()(
  persist(
    (set) => ({
      language: 'ja',
      themeMode: 'dark',
      autoOpenOsWindow: true,
      setLanguage: (language) => set({ language }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setAutoOpenOsWindow: (autoOpenOsWindow) => set({ autoOpenOsWindow }),
    }),
    { name: 'sekkeiya-app-preferences' },
  ),
);
