import { create } from "zustand";

export const VIEWPORT_LAYOUT = {
    SINGLE: "single",
    SPLIT: "split",
    TRIPLE: "triple",
    QUAD: "quad",
};

export const VIEWPORT_IDS = {
    PERSP: "vp_persp",
    TOP: "vp_top",
    FRONT: "vp_front",
    RIGHT: "vp_right",
};

const normalizeAlignKey = (k: any): string | null => {
    if (k == null) return null;

    const raw = String(k).trim();
    if (!raw) return null;

    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();

    const shorthand: Record<string, string> = {
        AT: "top",
        AB: "bottom",
        AL: "left",
        AR: "right",
        AH: "hcenter",
        AV: "vcenter",
    };
    if (shorthand[upper]) return shorthand[upper];

    const verbose: Record<string, string> = {
        top: "top",
        bottom: "bottom",
        left: "left",
        right: "right",
        hcenter: "hcenter",
        vcenter: "vcenter",
    };
    if (verbose[lower]) return verbose[lower];

    return null;
};

const safeCall = (fn: any, ...args: any[]) => {
    try {
        fn?.(...args);
    } catch (e) {
        console.warn("[viewportUiStore] call failed:", e);
    }
};

/** 図面グリッド（立面4面/断面/展開の分割ビュー）の1ペイン。
 *  clipPlanes はレンダラー単位クリップ（gl.clippingPlanes）として適用する。
 *  material.clippingPlanes だとマテリアルがペイン間で共有され「ペインごとに別の断面」を
 *  持てないため（PaneClipPlanes.jsx 参照）。 */
export interface DrawingGridPane {
    label: string;
    /** 見る向き: front=Z軸（北南） / right=X軸（東西） */
    viewType: "front" | "right";
    /** 反転（北⇄南 / 東⇄西）。ペイン単位で持つ（グローバル sectionViewFlip は使わない） */
    flip: boolean;
    /** レンダラー単位クリップ面（無し=立面のような外形ビュー） */
    clipPlanes?: Array<{ normal: [number, number, number]; constant: number }> | null;
    /** カメラのフレーミング対象（無し=建物全体） */
    frameBox?: { center: [number, number, number]; maxDim: number } | null;
    /** 断面ペインの切断情報。指定すると切り口の黒塗り（ポシェ）＋切断面フレーム＋
     *  FL/GL レベル線が単体断面ビューと同じように出る（立面/展開ペインは無し）。 */
    cap?: { axis: "x" | "z"; pos: number } | null;
}

export interface DrawingGrid {
    kind: "elevation" | "section" | "developed";
    /** どのグループから開いたか（EditorAngleBar のハイライト用。例 "elevation" / "room:xxx"） */
    key: string;
    panes: DrawingGridPane[];
}

export interface ViewportUiState {
    layoutMode: string;
    activeViewportId: string;
    setLayoutMode: (mode: string) => void;
    setActiveViewportId: (id: string) => void;
    /** 図面グリッド。非 null の間は SINGLE/SPLIT の代わりに N ペインの図面分割を表示する。 */
    drawingGrid: DrawingGrid | null;
    setDrawingGrid: (g: DrawingGrid | null) => void;
    /** 2画面（SPLIT）の右ペインに出すビュー。左ペインは常に Top（平面）。
     *  2画面に入るときは「その時に表示していたビュー」が入り、以後ドックの
     *  立面/断面/展開/パースの切替でここが差し替わる（＝2画面のまま切り替わる）。 */
    splitRightViewId: string;
    setSplitRightViewId: (id: string) => void;

    focusTick: number;
    frameAllTick: number;
    requestFocus: () => void;
    requestFrameAll: () => void;

    // ビュー切替（平面/立面/断面/展開）時の一瞬のカクつき（クリップ即適用→リフレーム遅延）を
    // 覆い隠すディゾルブ用のシグナル。切替の起点で bump する。
    viewTransitionTick: number;
    beginViewTransition: () => void;

    lockToGround: boolean;
    axisConstraint: string;
    setLockToGround: (v: boolean) => void;
    setAxisConstraint: (v: string | null) => void;

    speedMode: string;
    speedMul: number;
    setSpeedMode: (m: string) => void;
    setSpeedMul: (v: number) => void;

    viewportApis: Record<string, any>;
    registerViewportApi: (viewportId: string | null | undefined, api: any) => void;
    getViewportApi: (viewportId: string | null | undefined) => any | null;
    getActiveViewportApi: () => any | null;

    toolbarApi: any | null;
    registerToolbarApi: (api: any) => void;

    alignPhase: "idle" | "pending" | "active";
    alignTick: number;
    alignKey: string | null;
    alignViewportId: string | null;
    alignOwnerViewportId: string | null;
    alignSessionId: number;

    startAlignSession: (viewportId?: string | null) => void;
    requestAlignTool: (key: string, viewportId?: string | null) => void;
    beginAlignSession: (payload?: { viewportId?: string | null }) => void;
    endAlignSession: () => void;
    clearAlignTool: () => void;
    isAlignOwner: (viewportId?: string | null) => boolean;

    requestAlign: (key: string, viewportId?: string | null) => void;
    requestGroup: () => void;
    requestUngroup: () => void;
    requestFocusCommand: () => void;
    requestFrameAllCommand: () => void;
    requestCopy: () => void;
    requestMirror: (axis?: string) => void;

    focusCommandBar: (options?: { select?: boolean }) => void;
    blurCommandBar: () => void;
    switchToCommandInput: (options?: { select?: boolean }) => void;

    commandOpen: boolean;
    commandAxis: string | null;
    commandLabel: string;
    commandValue: string;
    applyNumeric: ((payload: { axis: string | null; raw: string }) => void) | null;

    openCommand: (payload: { axis?: string | null; label?: string; applyNumeric?: any }) => void;
    closeCommand: () => void;
    setCommandValue: (v: string | null | undefined) => void;
    runCommandString: (raw: string | null | undefined) => boolean;
    commitCommand: () => void;
    cancelCommand: () => void;

    gizmoDragging: boolean;
    /** 寸法列パネルが編集対象にするビュー（最後に描画された図面ビューの viewKey）。 */
    activeDimViewKey: string | null;
    gizmoHotAxis: string | null;
    gizmoInteracting: boolean;

    setGizmoDragging: (v: boolean) => void;
    setActiveDimViewKey: (v: string | null) => void;
    setGizmoHotAxis: (axis: string | null) => void;
    setGizmoInteracting: (v: boolean) => void;
    isGizmoActive: () => boolean;

    helpModalOpen: boolean;
    shortcutsOverlayVisible: boolean;
    setHelpModalOpen: (v: boolean) => void;
    setShortcutsOverlayVisible: (v: boolean) => void;

    // Viewport display modes (e.g. Wireframe, Shaded, Rendered)
    viewportDisplayModes: Record<string, string>;
    // Viewport Quick Menu
    quickMenuOpen: boolean;
    setQuickMenuOpen: (v: boolean) => void;

    reset: () => void;
}

export const useViewportUiStore = create<ViewportUiState>((set, get) => ({
    // ============================================================
    // layout / active viewport
    // ============================================================
    layoutMode: VIEWPORT_LAYOUT.SINGLE,
    activeViewportId: VIEWPORT_IDS.PERSP,
    splitRightViewId: VIEWPORT_IDS.PERSP,
    drawingGrid: null,
    setDrawingGrid: (g) => set({ drawingGrid: g }),
    // 2画面へ入るときは「その時に表示していたビュー」を右ペインへ引き継ぐ。
    // 直前が Top（＝左ペインと同じ）だった場合だけ Perspective にフォールバックする。
    // ※ SINGLE/SPLIT への切替は図面グリッドからの離脱でもあるので drawingGrid を必ず畳む。
    setLayoutMode: (mode) => {
        if (mode === VIEWPORT_LAYOUT.SPLIT && get().layoutMode !== VIEWPORT_LAYOUT.SPLIT) {
            const cur = get().activeViewportId;
            const right = cur && cur !== VIEWPORT_IDS.TOP ? cur : VIEWPORT_IDS.PERSP;
            set({ layoutMode: mode, splitRightViewId: right, activeViewportId: right, drawingGrid: null });
            return;
        }
        set({ layoutMode: mode, drawingGrid: null });
    },
    // SPLIT 維持のままビュー差し替え（ドックの立面/断面等）も図面グリッドからの離脱。
    setSplitRightViewId: (id) => set({ splitRightViewId: id, drawingGrid: null }),
    setActiveViewportId: (id) => set({ activeViewportId: id }),

    // ============================================================
    // view commands (tick based)
    // ============================================================
    focusTick: 0,
    frameAllTick: 0,
    requestFocus: () => set((s) => ({ focusTick: s.focusTick + 1 })),
    requestFrameAll: () => set((s) => ({ frameAllTick: s.frameAllTick + 1 })),

    viewTransitionTick: 0,
    beginViewTransition: () => set((s) => ({ viewTransitionTick: s.viewTransitionTick + 1 })),

    // ============================================================
    // movement / constraints
    // ============================================================
    lockToGround: true,
    axisConstraint: "none",
    setLockToGround: (v) => set({ lockToGround: !!v }),
    setAxisConstraint: (v) => set({ axisConstraint: v ?? "none" }),

    // ============================================================
    // speed
    // ============================================================
    speedMode: "cycle",
    speedMul: 1,
    setSpeedMode: (m) => set({ speedMode: m }),
    setSpeedMul: (v) => set({ speedMul: v }),

    // ============================================================
    // external API register
    // ============================================================
    viewportApis: {},

    registerViewportApi: (viewportId, api) =>
        set((s) => {
            const id = String(viewportId ?? "").trim();
            if (!id) return s;

            const next = { ...(s.viewportApis || {}) };
            if (api) next[id] = api;
            else delete next[id];
            return { viewportApis: next };
        }),

    getViewportApi: (viewportId) => {
        const id = String(viewportId ?? "").trim();
        if (!id) return null;
        return get().viewportApis?.[id] || null;
    },

    getActiveViewportApi: () => {
        const id = get().activeViewportId;
        return get().viewportApis?.[id] || null;
    },

    toolbarApi: null,
    registerToolbarApi: (api) => set({ toolbarApi: api || null }),

    // ============================================================
    // Align tool
    // ============================================================
    alignPhase: "idle",

    alignTick: 0,
    alignKey: null,
    alignViewportId: null,
    alignOwnerViewportId: null,
    alignSessionId: 0,

    startAlignSession: (viewportId) => {
        const owner = viewportId ?? get().activeViewportId ?? null;
        if (!owner) return;

        set(() => ({
            alignOwnerViewportId: owner,
            alignViewportId: owner,
            alignPhase: "pending",
        }));
    },

    requestAlignTool: (key, viewportId) => {
        const norm = normalizeAlignKey(key);
        if (!norm) return;

        const owner = get().alignOwnerViewportId ?? viewportId ?? get().activeViewportId ?? null;
        if (!owner) return;

        set((s) => ({
            alignTick: s.alignTick + 1,
            alignKey: norm,
            alignViewportId: owner,
            alignOwnerViewportId: owner,
            alignPhase: "pending",
        }));
    },

    beginAlignSession: ({ viewportId } = {}) => {
        const owner = get().alignOwnerViewportId;
        if (!owner) return;
        if (viewportId && viewportId !== owner) return;

        set((s) => ({
            alignPhase: "active",
            alignSessionId: s.alignSessionId + 1,
        }));
    },

    endAlignSession: () =>
        set({
            alignPhase: "idle",
            alignKey: null,
            alignViewportId: null,
            alignOwnerViewportId: null,
        }),

    clearAlignTool: () => get().endAlignSession(),

    isAlignOwner: (viewportId) => {
        const owner = get().alignOwnerViewportId;
        return !!viewportId && !!owner && viewportId === owner;
    },

    // ============================================================
    // tool commands (Toolbar -> Viewport)
    // ============================================================
    requestAlign: (key, viewportId) => {
        const norm = normalizeAlignKey(key);
        if (!norm) return;

        if (viewportId) get().startAlignSession(viewportId);
        get().requestAlignTool(norm, viewportId);
    },

    requestGroup: () => {
        const api = get().getActiveViewportApi?.();
        if (!api?.requestGroup) {
            console.warn("[viewportUiStore] active viewport api.requestGroup is not registered yet.");
            return;
        }
        safeCall(api.requestGroup);
    },

    requestUngroup: () => {
        const api = get().getActiveViewportApi?.();
        if (!api?.requestUngroup) {
            console.warn("[viewportUiStore] active viewport api.requestUngroup is not registered yet.");
            return;
        }
        safeCall(api.requestUngroup);
    },

    requestFocusCommand: () => get().requestFocus(),
    requestFrameAllCommand: () => get().requestFrameAll(),

    requestCopy: () => {
        const api = get().getActiveViewportApi?.();
        if (!api?.requestCopy) {
            console.warn("[viewportUiStore] active viewport api.requestCopy is not registered yet.");
            return;
        }
        safeCall(api.requestCopy);
    },

    requestMirror: (axis = "x") => {
        const api = get().getActiveViewportApi?.();
        if (!api?.requestMirror) {
            console.warn("[viewportUiStore] active viewport api.requestMirror is not registered yet.");
            return;
        }
        safeCall(api.requestMirror, { axis });
    },

    // ============================================================
    // CommandBar
    // ============================================================
    focusCommandBar: ({ select = true } = {}) => {
        safeCall(get().toolbarApi?.focusCommand, { select });
    },
    blurCommandBar: () => {
        safeCall(get().toolbarApi?.blurCommand);
    },

    switchToCommandInput: ({ select = true } = {}) => {
        get().closeCommand();
        get().focusCommandBar({ select });
    },

    // ============================================================
    // command bar (numeric input + command input)
    // ============================================================
    commandOpen: false,
    commandAxis: null,
    commandLabel: "",
    commandValue: "",
    applyNumeric: null,

    openCommand: ({ axis, label, applyNumeric }) => {
        set({
            commandOpen: true,
            commandAxis: axis ?? null,
            commandLabel: label ?? "",
            commandValue: "",
            applyNumeric: typeof applyNumeric === "function" ? applyNumeric : null,
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                safeCall(get().toolbarApi?.focusCommand, { select: true });
            });
        });
    },

    closeCommand: () => {
        set({
            commandOpen: false,
            commandAxis: null,
            commandLabel: "",
            applyNumeric: null,
        });
    },

    setCommandValue: (v) => set({ commandValue: String(v ?? "") }),

    runCommandString: (raw) => {
        const s = String(raw ?? "").trim();
        if (!s) return false;

        const align = normalizeAlignKey(s);
        if (align) {
            get().requestAlign(align, get().activeViewportId);
            return true;
        }

        const upper = s.toUpperCase();
        if (upper === "F") {
            get().requestFocusCommand();
            return true;
        }
        if (upper === "FA" || upper === "FRAMEALL") {
            get().requestFrameAllCommand();
            return true;
        }
        if (upper === "G") {
            get().requestGroup();
            return true;
        }
        if (upper === "UG" || upper === "UNGROUP") {
            get().requestUngroup();
            return true;
        }
        if (upper === "C" || upper === "COPY") {
            get().requestCopy();
            return true;
        }
        if (upper === "MI" || upper === "MIRRORX") {
            get().requestMirror("x");
            return true;
        }

        return false;
    },

    commitCommand: () => {
        const { commandOpen, commandValue, commandAxis, applyNumeric } = get();
        const raw = String(commandValue ?? "").trim();
        if (!raw) return;

        if (commandOpen) {
            safeCall(applyNumeric, { axis: commandAxis, raw });
            set({ commandValue: "" });
            get().closeCommand();
            return;
        }

        const ok = get().runCommandString(raw);
        if (ok) {
            set({ commandValue: "" });
            return;
        }
    },

    cancelCommand: () => {
        const { commandOpen } = get();
        if (commandOpen) {
            get().closeCommand();
            return;
        }
        set({ commandValue: "" });
    },

    // ============================================================
    // Gizmo priority flags
    // ============================================================
    gizmoDragging: false,
    activeDimViewKey: null,
    gizmoHotAxis: null,
    gizmoInteracting: false,

    setGizmoDragging: (v) => set({ gizmoDragging: !!v }),
    setActiveDimViewKey: (v) => set((s) => (s.activeDimViewKey === v ? {} : { activeDimViewKey: v })),
    setGizmoHotAxis: (axis) => set({ gizmoHotAxis: axis ?? null }),
    setGizmoInteracting: (v) => set({ gizmoInteracting: !!v }),

    isGizmoActive: () => {
        const s = get();
        return !!s.gizmoInteracting || !!s.gizmoDragging || !!s.gizmoHotAxis;
    },

    // ============================================================
    // Help & Overlays
    // ============================================================
    helpModalOpen: false,
    shortcutsOverlayVisible: true, // Show by default initially
    setHelpModalOpen: (v) => set({ helpModalOpen: !!v }),
    setShortcutsOverlayVisible: (v) => set({ shortcutsOverlayVisible: !!v }),

    // ============================================================
    // Viewport Display Modes
    // ============================================================
    viewportDisplayModes: {},
    setViewportDisplayMode: (viewportId: string, mode: string) => set((s) => ({
        viewportDisplayModes: {
            ...s.viewportDisplayModes,
            [viewportId]: mode
        }
    })),

    quickMenuOpen: false,
    setQuickMenuOpen: (v) => set({ quickMenuOpen: !!v }),

    reset: () => set({
        layoutMode: VIEWPORT_LAYOUT.SINGLE,
        activeViewportId: VIEWPORT_IDS.PERSP,
        splitRightViewId: VIEWPORT_IDS.PERSP,
        drawingGrid: null,
        focusTick: 0,
        frameAllTick: 0,
        lockToGround: true,
        axisConstraint: "none",
        speedMode: "walk",
        speedMul: 1,
        alignPhase: "idle",
        alignTick: 0,
        alignKey: null,
        alignViewportId: null,
        alignOwnerViewportId: null,
        alignSessionId: 0,
        commandOpen: false,
        commandAxis: null,
        commandLabel: "",
        commandValue: "",
        gizmoDragging: false,
        gizmoHotAxis: null,
        gizmoInteracting: false,
        helpModalOpen: false,
        shortcutsOverlayVisible: true,
        viewportDisplayModes: {},
        quickMenuOpen: false,
    })
}));
