// src/store/viewportUiStore.js
import { create } from "zustand";

export const VIEWPORT_LAYOUT = {
    SINGLE: "single",
    SPLIT: "split",
};

export const VIEWPORT_IDS = {
    PERSP: "vp_persp",
    TOP: "vp_top",
    FRONT: "vp_front",
    RIGHT: "vp_right",
};

// ✅ Align コマンド正規化：最終的に Canvas が理解できる verbose に揃える
// - 入力は AT/AB/AL/AR/AH/AV でも top/bottom/... でもOK
// - store 内 alignKey は verbose（top/bottom/left/right/hcenter/vcenter）で統一
const normalizeAlignKey = (k) => {
    if (k == null) return null;

    const raw = String(k).trim();
    if (!raw) return null;

    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();

    // ✅ 2文字コマンド（AT/AB/...）→ verbose
    const shorthand = {
        AT: "top",
        AB: "bottom",
        AL: "left",
        AR: "right",
        AH: "hcenter",
        AV: "vcenter",
    };
    if (shorthand[upper]) return shorthand[upper];

    // ✅ verbose（大小混在OK）→ verbose
    const verbose = {
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

// 外部APIが未登録のときでも落とさない安全呼び出し
const safeCall = (fn, ...args) => {
    try {
        fn?.(...args);
    } catch (e) {
        console.warn("[viewportUiStore] call failed:", e);
    }
};

export const useViewportUiStore = create((set, get) => ({
    // ============================================================
    // layout / active viewport
    // ============================================================
    layoutMode: VIEWPORT_LAYOUT.SINGLE,
    activeViewportId: VIEWPORT_IDS.PERSP,
    setLayoutMode: (mode) => set({ layoutMode: mode }),
    setActiveViewportId: (id) => set({ activeViewportId: id }),

    // ============================================================
    // view commands (tick based)
    // - SingleViewportCanvas の ViewportFramingController が処理
    // ============================================================
    focusTick: 0,
    frameAllTick: 0,
    requestFocus: () => set((s) => ({ focusTick: s.focusTick + 1 })),
    requestFrameAll: () => set((s) => ({ frameAllTick: s.frameAllTick + 1 })),

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
    speedMode: "walk",
    speedMul: 1,
    setSpeedMode: (m) => set({ speedMode: m }),
    setSpeedMul: (v) => set({ speedMul: v }),

    // ============================================================
    // external API register (imperative bridge)
    // ✅ viewportId -> api のマップで保持（Splitでも安定）
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
    // ✅ Align tool (owner を一意化して “どのViewportが動くか” を固定する)
    // ============================================================
    alignPhase: "idle",

    alignTick: 0,
    alignKey: null, // ✅ verbose: top/bottom/left/right/hcenter/vcenter
    alignViewportId: null, // target(owner)
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
        const norm = normalizeAlignKey(key); // ✅ verbose に揃う
        if (!norm) return;

        const owner = get().alignOwnerViewportId ?? viewportId ?? get().activeViewportId ?? null;
        if (!owner) return;

        set((s) => ({
            alignTick: s.alignTick + 1,
            alignKey: norm, // ✅ verbose を入れる（Canvasと一致）
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
        const norm = normalizeAlignKey(key); // ✅ verbose
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
    // ✅ CommandBar: focus/blur を “即時” で叩けるようにする
    // ============================================================
    focusCommandBar: ({ select = true } = {}) => {
        safeCall(get().toolbarApi?.focusCommand, { select });
    },
    blurCommandBar: () => {
        safeCall(get().toolbarApi?.blurCommand);
    },

    // ✅ 追加：numeric を閉じて “コマンド入力に切替” を1発でやる
    switchToCommandInput: ({ select = true } = {}) => {
        get().closeCommand();
        get().focusCommandBar({ select });
    },

    // ============================================================
    // command bar (numeric input + command input)
    // ============================================================
    commandOpen: false, // ✅ numeric input の時だけ true
    commandAxis: null,
    commandLabel: "",
    commandValue: "",
    applyNumeric: null, // fn({axis, raw})

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

        // ✅ Align：AT/AB/AL/AR でも top/bottom/... でもOK → verboseへ
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
    // ✅ Gizmo priority flags（Marquee/Orbitより優先）
    // ============================================================
    gizmoDragging: false, // 左ドラッグで掴んでる最中
    gizmoHotAxis: null, // "X"|"Y"|"Z"|"XYZ"|null（Gizmo上にいる/軸ホバー）

    // ✅ NEW: “触った瞬間” に立つ最優先フラグ（dragging-changedより早い）
    gizmoInteracting: false,

    setGizmoDragging: (v) => set({ gizmoDragging: !!v }),
    setGizmoHotAxis: (axis) => set({ gizmoHotAxis: axis ?? null }),
    setGizmoInteracting: (v) => set({ gizmoInteracting: !!v }),

    isGizmoActive: () => {
        const s = get();
        // ✅ Interacting を最優先で見る（mouseDown瞬間に抑止できる）
        return !!s.gizmoInteracting || !!s.gizmoDragging || !!s.gizmoHotAxis;
    },
}));