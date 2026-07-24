// src/features/layout/store/useEditorModeStore.js
// ✅ 2D 配置 / 3D 演出 のエディターモード管理
// - 2D: TOP 正投影・単一ビューに固定（配置に集中）
// - 3D: パース含む自由ビュー（材質・ライティング・出力）
// - モード別にビューポート状態（layoutMode / activeViewportId）を記憶して復元する
import { create } from "zustand";
import { useViewportUiStore, VIEWPORT_IDS, VIEWPORT_LAYOUT } from "./viewportUiStore";
import { useToolsStore } from "./toolsStore/useToolsStore";

export const EDITOR_MODES = {
    LAYOUT_2D: "2d",
    PRESENT_3D: "3d",
};

const DEFAULT_VIEWPORT_BY_MODE = {
    [EDITOR_MODES.LAYOUT_2D]: {
        layoutMode: VIEWPORT_LAYOUT.SINGLE,
        activeViewportId: VIEWPORT_IDS.TOP,
    },
    [EDITOR_MODES.PRESENT_3D]: {
        layoutMode: VIEWPORT_LAYOUT.SINGLE,
        activeViewportId: VIEWPORT_IDS.PERSP,
    },
};

function normalizeMode(mode) {
    return mode === EDITOR_MODES.PRESENT_3D ? EDITOR_MODES.PRESENT_3D : EDITOR_MODES.LAYOUT_2D;
}

/** モードに応じた viewport 状態を viewportUiStore に適用する */
function applyViewportForMode(mode, saved) {
    const vp = useViewportUiStore.getState();

    if (mode === EDITOR_MODES.LAYOUT_2D) {
        // ✅ 2D は常に TOP 単一ビューへ強制（記憶より優先）
        vp.setLayoutMode(VIEWPORT_LAYOUT.SINGLE);
        vp.setActiveViewportId(VIEWPORT_IDS.TOP);
        return;
    }

    const next = saved?.[mode] || DEFAULT_VIEWPORT_BY_MODE[mode];
    vp.setLayoutMode(next.layoutMode || VIEWPORT_LAYOUT.SINGLE);
    vp.setActiveViewportId(next.activeViewportId || VIEWPORT_IDS.PERSP);
}

export const useEditorModeStore = create((set, get) => ({
    // ✅ 初回は常に 2D（躯体 → 家具 → 3Dで演出、の順路を作る）
    editorMode: EDITOR_MODES.LAYOUT_2D,

    // モード別のビューポート記憶
    savedViewports: { ...DEFAULT_VIEWPORT_BY_MODE },

    is2D: () => get().editorMode === EDITOR_MODES.LAYOUT_2D,

    setEditorMode: (mode) => {
        const next = normalizeMode(mode);
        const prev = get().editorMode;
        if (next === prev) return;

        // ① 現在のビューポート状態を「前のモード」へスナップショット
        const vp = useViewportUiStore.getState();
        const savedViewports = {
            ...get().savedViewports,
            [prev]: {
                layoutMode: vp.layoutMode,
                activeViewportId: vp.activeViewportId,
            },
        };

        // ② 次モードのビューポート状態を復元（2Dは強制TOP）
        applyViewportForMode(next, savedViewports);

        // ③ ツールの整合性
        const tools = useToolsStore.getState();
        if (next === EDITOR_MODES.LAYOUT_2D) {
            // 2D にスポイト・スケールは出さないので状態も戻す
            if (tools.materialPicking) tools.setMaterialPicking(false);
            if (tools.mode === "scale") tools.setMode("translate");
        }

        set({ editorMode: next, savedViewports });
    },

    // =========================
    // ✅ 左ドック（ライブラリ常設）の開閉
    // =========================
    leftDockOpen: true,
    setLeftDockOpen: (v) => set({ leftDockOpen: !!v }),
    toggleLeftDock: () => set((s) => ({ leftDockOpen: !s.leftDockOpen })),

    toggleEditorMode: () => {
        const cur = get().editorMode;
        get().setEditorMode(cur === EDITOR_MODES.LAYOUT_2D ? EDITOR_MODES.PRESENT_3D : EDITOR_MODES.LAYOUT_2D);
    },

    /** マウント時に現在モードの viewport 制約を適用する（初回2D固定用） */
    enforceViewportForCurrentMode: () => {
        applyViewportForMode(get().editorMode, get().savedViewports);
    },
}));
