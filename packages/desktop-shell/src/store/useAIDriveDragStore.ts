import { create } from 'zustand';
import type { AIDriveAsset } from './useAIDriveStore';

interface AIDriveDragState {
  isDragging: boolean;
  draggingAsset: AIDriveAsset | null;
  draggingAssets: AIDriveAsset[];
  isCopyMode: boolean;
  pointerPosition: { x: number, y: number } | null;
  pendingDropAsset: { asset: AIDriveAsset, assets: AIDriveAsset[], clientX: number, clientY: number, target: string, isCopy: boolean } | null;
  
  startDrag: (asset: AIDriveAsset, assets: AIDriveAsset[], x: number, y: number, isCopy?: boolean) => void;
  updateDrag: (x: number, y: number, isCopy?: boolean) => void;
  endDrag: (clientX: number, clientY: number, targetInfo?: string) => void;
  consumeDropAsset: () => void;
}

export const useAIDriveDragStore = create<AIDriveDragState>((set) => ({
  isDragging: false,
  draggingAsset: null,
  draggingAssets: [],
  isCopyMode: false,
  pointerPosition: null,
  pendingDropAsset: null,

  startDrag: (asset, assets, x, y, isCopy = false) => {
    console.log('[AIDriveDragStore] startDrag', asset.name, 'count:', assets.length);
    set({ 
      isDragging: true, 
      draggingAsset: asset, 
      draggingAssets: assets && assets.length > 0 ? assets : [asset],
      isCopyMode: isCopy,
      pointerPosition: { x, y },
      pendingDropAsset: null
    });
  },

  updateDrag: (x, y, isCopy) => set((state) => ({ 
    pointerPosition: { x, y },
    isCopyMode: isCopy !== undefined ? isCopy : state.isCopyMode
  })),

  endDrag: (clientX, clientY, targetInfo) => set((state) => {
    if (!state.isDragging || !state.draggingAsset) {
      return { isDragging: false, draggingAsset: null, draggingAssets: [], pointerPosition: null };
    }
    
    console.log('[AIDriveDragStore] endDrag at', clientX, clientY, 'target:', targetInfo);
    
    let pending = null;
    if (targetInfo) {
      pending = { 
        asset: state.draggingAsset, 
        assets: state.draggingAssets,
        clientX, 
        clientY, 
        target: targetInfo,
        isCopy: state.isCopyMode
      };
    }
    
    return {
      isDragging: false,
      draggingAsset: null,
      draggingAssets: [],
      pointerPosition: null,
      pendingDropAsset: pending
    };
  }),

  consumeDropAsset: () => set({ pendingDropAsset: null }),
}));
