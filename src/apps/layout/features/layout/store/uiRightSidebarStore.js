import { create } from "zustand";

// ✅ Library(Models) は左ドック常設に移動したため既定OFF（右= Scene + Properties）
const DEFAULT_RIGHT_PANELS = {
    scene: true,
    properties: true,
    board: false,
    library: false,
};

function calcVisibleSections(rightPanels) {
    const arr = [];
    if (rightPanels?.scene) arr.push("scene");
    if (rightPanels?.properties) arr.push("properties");
    if (rightPanels?.library) arr.push("library");
    if (rightPanels?.board) arr.push("board");
    return arr;
}

export const useUiRightSidebarStore = create((set) => ({
    rightPanels: DEFAULT_RIGHT_PANELS,
    visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),

    setRightPanel: (key, value) =>
        set((s) => {
            const nextPanels = { ...s.rightPanels, [key]: Boolean(value) };
            return {
                rightPanels: nextPanels,
                visibleSections: calcVisibleSections(nextPanels),
            };
        }),

    toggleRightPanel: (key) =>
        set((s) => {
            const nextPanels = { ...s.rightPanels, [key]: !s.rightPanels?.[key] };
            return {
                rightPanels: nextPanels,
                visibleSections: calcVisibleSections(nextPanels),
            };
        }),

    setRightPanels: (next) =>
        set(() => {
            const nextPanels = { ...DEFAULT_RIGHT_PANELS, ...(next || {}) };
            return {
                rightPanels: nextPanels,
                visibleSections: calcVisibleSections(nextPanels),
            };
        }),

    resetRightPanels: () =>
        set(() => ({
            rightPanels: DEFAULT_RIGHT_PANELS,
            visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),
        })),
}));
