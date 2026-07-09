// src/store/materialPickerStore.js
import { create } from "zustand";

export const useMaterialPickerStore = create((set, get) => ({
    // bottombar のどのパネルを開くか
    openPanel: null, // "textureLibrary" | "materialLibrary" | null

    // 今どの用途で選んでるか
    mode: null, // "replacePreviewMaterial" | "replacePreviewTexture" | null

    // BottomBar（ライブラリ）での選択結果を返すコールバック（Properties側がセットする）
    onPick: null,

    // ✅ Scene（Canvas）で拾った material を受け取るコールバック（LayoutShell がセットする）
    sceneOnPick: null,

    // open helpers
    openTexturePicker: (onPick) =>
        set({ openPanel: "textureLibrary", mode: "replacePreviewTexture", onPick }),

    openMaterialPicker: (onPick) =>
        set({ openPanel: "materialLibrary", mode: "replacePreviewMaterial", onPick }),

    close: () => set({ openPanel: null, mode: null, onPick: null }),

    // BottomBar側で「これ選ばれたよ」を通知
    commitPick: (payload) => {
        const cb = get().onPick;
        if (typeof cb === "function") cb(payload);
        get().close();
    },

    // ✅ LayoutShell が登録（propsバケツリレー不要）
    setSceneOnPick: (cb) => set({ sceneOnPick: typeof cb === "function" ? cb : null }),

    // ✅ Canvas側が「拾ったよ」を通知
    commitScenePick: (payload) => {
        const cb = get().sceneOnPick;
        if (typeof cb === "function") cb(payload);
    },
}));
