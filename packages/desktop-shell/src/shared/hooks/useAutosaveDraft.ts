import { useEffect, useRef } from 'react';
import { useUserSettingsStore } from '../../store/useUserSettingsStore';

interface UseAutosaveDraftOptions {
  /** 保存対象を一意に識別するキー（ドキュメント切替で変わる）。null の場合は保存しない。 */
  key: string | null;
  /** 未保存（編集あり）のときだけ保存する。 */
  dirty: boolean;
  /**
   * 内容が変わると値が変わる文字列など（これが変わるたびにデバウンスをリセット）。
   * シリアライズ済みスナップショットや updatedAt 相当を渡す。
   */
  signal: unknown;
  /** 実際のローカル下書き保存処理。 */
  save: () => void | Promise<void>;
}

/**
 * 編集停止後（デバウンス）にローカル下書きを自動保存する汎用フック。
 * - 保存先はローカルのみ（クラウド書き込みは増やさない）。
 * - 自動保存のオン/オフ・間隔は useUserSettingsStore（設定画面）に従う。
 */
export function useAutosaveDraft({ key, dirty, signal, save }: UseAutosaveDraftOptions): void {
  const enabled = useUserSettingsStore(s => s.autosaveEnabled);
  const debounceMs = useUserSettingsStore(s => s.autosaveDebounceMs);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!enabled || !dirty || !key) return;
    const t = setTimeout(() => {
      Promise.resolve(saveRef.current()).catch(err =>
        console.warn('[autosave] local draft save failed:', err),
      );
    }, debounceMs);
    return () => clearTimeout(t);
    // signal が変わるたびにタイマーをリセット＝編集停止後に1回だけ保存
  }, [enabled, dirty, key, signal, debounceMs]);
}
