import { create } from "zustand";

export interface MaterialPickerState {
  openPanel: "textureLibrary" | "materialLibrary" | null;
  mode: "replacePreviewMaterial" | "replacePreviewTexture" | null;
  onPick: ((payload: any) => void) | null;
  sceneOnPick: ((payload: any) => void) | null;

  openTexturePicker: (onPick: (payload: any) => void) => void;
  openMaterialPicker: (onPick: (payload: any) => void) => void;
  close: () => void;

  commitPick: (payload: any) => void;
  setSceneOnPick: (cb: ((payload: any) => void) | null) => void;
  commitScenePick: (payload: any) => void;
  reset?: () => void;
}

export const useMaterialPickerStore = create<MaterialPickerState>((set, get) => ({
  openPanel: null,
  mode: null,
  onPick: null,
  sceneOnPick: null,

  openTexturePicker: (onPick) =>
    set({ openPanel: "textureLibrary", mode: "replacePreviewTexture", onPick }),

  openMaterialPicker: (onPick) =>
    set({ openPanel: "materialLibrary", mode: "replacePreviewMaterial", onPick }),

  close: () => set({ openPanel: null, mode: null, onPick: null }),

  commitPick: (payload) => {
    const cb = get().onPick;
    if (typeof cb === "function") cb(payload);
    get().close();
  },

  setSceneOnPick: (cb) => set({ sceneOnPick: typeof cb === "function" ? cb : null }),

  commitScenePick: (payload) => {
    const cb = get().sceneOnPick;
    if (typeof cb === "function") cb(payload);
  },
  
  reset: () => set({ openPanel: null, mode: null, onPick: null, sceneOnPick: null })
}));
