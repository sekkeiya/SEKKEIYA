// チャット（SEKKEIYA Chat）と S.Image（別ビュー）をつなぐ画像ピッカーの橋渡しストア。
//   - orchestrator が open_image_picker（UI-yield ツール）を実行 → openPicker でピッカー起動＋S.Imageへ遷移。
//   - ユーザーが S.Image で複数選択し確定 → confirm で選択結果を orchestrator に tool_result として返し、ループ再開。
//   - キャンセル時は cancel で {cancelled:true} を返す。
// 循環参照を避けるため orchestrator は動的 import で参照する。

import { create } from 'zustand';
import { useDsiStore } from '../features/dsi/store/useDsiStore';
import { useAppStore } from './useAppStore';
import { useAIChatStore } from './useAIChatStore';

export interface PickerImage {
  id: string;
  downloadUrl: string;
  title?: string;
  tags?: string[];
}

interface ImagePickerRequest {
  toolUseId: string;
  purpose: string; // '3d' | 'material' など
  max: number;
}

interface ImagePickerState {
  /** 非 null = ピッカー起動中 */
  request: ImagePickerRequest | null;
  /** 直近に確定した選択（start_3d_generation が id→url 解決に使う） */
  lastConfirmed: PickerImage[];
  /** チャット非経由（UIボタン直接起動）のとき確定後に呼ぶコールバック */
  onConfirmCallback: ((items: PickerImage[]) => void) | null;
  /** S.Material から起動時：既存マテリアルIDセット（生成済みバッジ表示用） */
  existingMaterialIds: Set<string>;

  openPicker: (req: ImagePickerRequest) => void;
  /** チャットオーケストレーターを経由せずにピッカーを起動する（UIボタン用）。 */
  openPickerWithCallback: (purpose: string, max: number, onConfirm: (items: PickerImage[]) => void, existingMaterialIds?: Set<string>) => void;
  confirm: (items: PickerImage[]) => void;
  cancel: () => void;
  /** id 配列を直近確定キャッシュから url 付きに解決（見つからない分は除外）。 */
  resolveUrls: (ids: string[]) => PickerImage[];
}

export const useImagePickerStore = create<ImagePickerState>((set, get) => ({
  request: null,
  lastConfirmed: [],
  onConfirmCallback: null,
  existingMaterialIds: new Set<string>(),

  openPicker: (req) => {
    set({ request: req });
    // S.Image を複数選択モードにして遷移する。
    useDsiStore.getState().setPickMode(true, req.max);
    const app = useAppStore.getState();
    app.setCurrentMainView('workspace');
    app.setLastActiveAppScope('3dsi');
    app.setActiveWorkspaceId('image');
  },

  openPickerWithCallback: (purpose, max, onConfirm, existingMaterialIds) => {
    const dummyId = `ui_picker_${Date.now()}`;
    set({ onConfirmCallback: onConfirm, existingMaterialIds: existingMaterialIds ?? new Set() });
    get().openPicker({ toolUseId: dummyId, purpose, max });
  },

  confirm: (items) => {
    const req = get().request;
    if (!req) return;
    const cb = get().onConfirmCallback;
    set({ request: null, lastConfirmed: items, onConfirmCallback: null, existingMaterialIds: new Set() });
    useDsiStore.getState().setPickMode(false);

    // UIボタン直接起動（コールバックあり）→ コールバックを呼ぶだけ。オーケストレーター不要。
    if (cb) {
      cb(items);
      return;
    }

    // チャットの該当メッセージを解決済みに（チップ無効化＆「N枚選択済み」表示）。
    useAIChatStore.getState().resolveMessageUi(req.toolUseId, { resolved: { count: items.length } });
    // チャットを再表示してエージェントの続きを見せる。
    useAppStore.getState().setAIChatOpen(true);
    // orchestrator のループを再開（選択画像を tool_result として返す）。
    import('./useCoreOrchestrator').then(async ({ useCoreOrchestrator }) => {
      const ok = await useCoreOrchestrator.getState().resumeWithToolResult(
        req.toolUseId,
        JSON.stringify({ images: items, count: items.length }),
      );
      // pending がロスト（リロード等）→ エージェントを介さず直接バッチ生成を開始。
      if (!ok && items.length > 0 && req.purpose !== 'material') {
        const { useBatchGenStore } = await import('./useBatchGenStore');
        const projectId = useAppStore.getState().getActiveProject()?.id ?? null;
        const { batchId, total, skipped } = await useBatchGenStore.getState().startBatch(items, { projectId });
        const chat = useAIChatStore.getState();
        if (chat.activeSessionId) {
          chat.addMessage({
            sessionId: chat.activeSessionId, role: 'ai', source: 'sidebar_chat', text: '',
            ui: { kind: 'batch_started', batchId, total, skipped },
          });
        }
      }
    });
  },

  cancel: () => {
    const req = get().request;
    if (!req) return;
    const cb = get().onConfirmCallback;
    set({ request: null, onConfirmCallback: null, existingMaterialIds: new Set() });
    useDsiStore.getState().setPickMode(false);

    if (cb) return; // UIボタン起動はキャンセルだけで完了

    useAppStore.getState().setAIChatOpen(true);
    import('./useCoreOrchestrator').then(({ useCoreOrchestrator }) => {
      useCoreOrchestrator.getState().resumeWithToolResult(
        req.toolUseId,
        JSON.stringify({ cancelled: true }),
      );
    });
  },

  resolveUrls: (ids) => {
    const map = new Map(get().lastConfirmed.map((i) => [i.id, i]));
    return ids.map((id) => map.get(id)).filter((x): x is PickerImage => !!x);
  },
}));
