/**
 * バッチ生成完了済みモデルを S.Model のアップロードダイアログへ渡す共有ユーティリティ。
 * FloatingBatchGenPanel とデスクトップ通知ハンドラの両方から呼ぶ。
 */
import type { BatchItem } from './useBatchGenStore';

export type DoneItem = Pick<BatchItem, 'imageId' | 'glbUrl'>;

export async function saveBatchDoneItemsToSModels(doneItems: DoneItem[]): Promise<void> {
  if (doneItems.length === 0) return;

  const [{ useAppStore }, { useDssUploadBridge }] = await Promise.all([
    import('./useAppStore'),
    import('./useDssUploadBridge'),
  ]);

  const app = useAppStore.getState();
  app.setCurrentMainView('workspace');
  app.setLastActiveAppScope('3dss');
  app.setActiveWorkspaceId('models');
  useDssUploadBridge.getState().setPreparing(true);

  const files: File[] = [];
  for (const it of doneItems) {
    if (!it.glbUrl) continue;
    try {
      const res = await fetch(it.glbUrl, { cache: 'no-store' });
      const blob = await res.blob();
      files.push(new File([blob], `AI_Model_${it.imageId}.glb`, { type: 'model/gltf-binary' }));
    } catch (e) {
      console.error('[saveBatchToModels] glb fetch failed:', e);
    }
  }

  if (files.length > 0) {
    useDssUploadBridge.getState().openWith(files);
  } else {
    useDssUploadBridge.getState().setPreparing(false);
  }
}
