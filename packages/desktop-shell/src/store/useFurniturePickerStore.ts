// S.Model 家具ピッカー（Chat 家具選定フロー § 手動選択パス）
// open_furniture_picker ツールで起動し、ユーザーが S.Model で選択 → confirm() で
// useCoreOrchestrator.resumeWithToolResult を呼んでループを再開する。

import { create } from 'zustand';

interface FurniturePickerState {
  isOpen: boolean;
  toolUseId: string | null;
  /** furniture_catalog_search が返した候補 ID（S.Model でハイライト用）。 */
  candidateIds: string[];
  /** ユーザーが選択した ID 集合。 */
  selectedIds: string[];

  open: (opts: { toolUseId: string; candidateIds: string[] }) => void;
  toggle: (id: string) => void;
  /** 選択を確定してループを再開する。 */
  confirmSelection: () => Promise<void>;
  /** キャンセルしてループを中断（空選択で再開）。 */
  cancelSelection: () => Promise<void>;
}

export const useFurniturePickerStore = create<FurniturePickerState>((set, get) => ({
  isOpen: false,
  toolUseId: null,
  candidateIds: [],
  selectedIds: [],

  open: ({ toolUseId, candidateIds }) =>
    set({ isOpen: true, toolUseId, candidateIds, selectedIds: [] }),

  toggle: (id) =>
    set(s => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter(x => x !== id)
        : [...s.selectedIds, id],
    })),

  confirmSelection: async () => {
    const { toolUseId, selectedIds } = get();
    if (!toolUseId) return;
    set({ isOpen: false, toolUseId: null, candidateIds: [], selectedIds: [] });

    const { useAIChatStore } = await import('./useAIChatStore');
    useAIChatStore.getState().resolveMessageUi(toolUseId, { resolved: { count: selectedIds.length } });

    const { useCoreOrchestrator } = await import('./useCoreOrchestrator');
    const ok = await useCoreOrchestrator.getState().resumeWithToolResult(
      toolUseId,
      JSON.stringify({ selected: selectedIds }),
    );
    if (!ok) {
      const { sendMessageToOrchestrator } = useCoreOrchestrator.getState();
      sendMessageToOrchestrator(`S.Modelで${selectedIds.length}件の家具を選択しました（ID: ${selectedIds.join(', ')}）。プロジェクトに追加してください。`, { source: 'sidebar_chat' });
    }
  },

  cancelSelection: async () => {
    const { toolUseId } = get();
    if (!toolUseId) return;
    set({ isOpen: false, toolUseId: null, candidateIds: [], selectedIds: [] });

    const { useCoreOrchestrator } = await import('./useCoreOrchestrator');
    await useCoreOrchestrator.getState().resumeWithToolResult(
      toolUseId,
      JSON.stringify({ cancelled: true }),
    );
  },
}));
