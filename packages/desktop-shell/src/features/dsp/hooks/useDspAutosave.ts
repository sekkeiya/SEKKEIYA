import { useEffect, useRef } from 'react';
import { useDspStore } from '../store/useDspStore';
import { dspFsHelpers } from '../utils/dspFsHelpers';
import { dspRepository } from '../api/dspRepository';
import { renderPresentationThumbnail } from '../utils/dspThumbnailService';
import { useAuthStore } from '../../../store/useAuthStore';

/**
 * Ctrl+S でローカルファイルとFirestoreの両方に保存するフック。
 * ローカル保存と同時にFirestoreにもcontentを同期することで、
 * ダッシュボードのサムネイル表示が正しく機能する。
 */
export const useDspLocalSave = () => {
  const store = useDspStore;
  const { currentUser } = useAuthStore();

  // 最新の store 値を ref で保持（イベントリスナーがクロージャに古い値を持たないように）
  const storeRef = useRef(store.getState());
  useEffect(() => {
    return store.subscribe(state => { storeRef.current = state; });
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 's')) return;
      e.preventDefault();

      const { projectId, projectName, workFileId, workFileName, presentation, saveStatus, setSaveStatus } = storeRef.current;

      if (!projectId || !workFileId || !presentation || !currentUser) return;
      if (saveStatus === 'saving') return;

      try {
        setSaveStatus('saving');

        // ローカルファイルとFirestoreに並行して保存
        await Promise.all([
          dspFsHelpers.saveLocalDraft(
            projectId,
            projectName || 'UnnamedProject',
            workFileId,
            workFileName || 'untitled',
            presentation,
          ),
          dspRepository.savePresentationContent(
            projectId,
            workFileId,
            presentation,
            currentUser.uid,
          ),
        ]);

        setSaveStatus('saved');

        // サムネイルをバックグラウンドで生成・アップロード（失敗してもセーブ自体は成功扱い）
        renderPresentationThumbnail(presentation).then((blob) => {
          if (blob) {
            dspRepository.uploadAndSaveThumbnail(projectId, workFileId, blob).catch(() => {});
          }
        }).catch(() => {});
      } catch (e) {
        console.error('[DSP] Save failed:', e);
        setSaveStatus('error');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);
};

/** @deprecated useDspLocalSave に移行済み。後方互換のためエイリアスとして残す。 */
export const useDspAutosave = useDspLocalSave;
