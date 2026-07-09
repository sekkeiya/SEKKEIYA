import { useAppPreferencesStore } from '../store/useAppPreferencesStore';
import type { AppLanguage } from '../store/useAppPreferencesStore';

/**
 * 軽量i18nヘルパー。翻訳辞書ファイルを持たず、コンポーネント側に
 * `t({ ja: '...', en: '...' })` の形でインラインに両言語を書く方式。
 * 対応画面を増やすときはこのフックを使う。
 */

export type LocalizedText = Partial<Record<AppLanguage, string>> & { ja: string };

/** 現在の表示言語（Global Settings > 一般 で変更）。 */
export const useAppLanguage = (): AppLanguage =>
  useAppPreferencesStore(s => s.language);

/** 現在の言語でテキストを解決する関数を返す。未翻訳は日本語にフォールバック。 */
export const useT = () => {
  const language = useAppLanguage();
  return (text: LocalizedText): string => text[language] ?? text.ja;
};
