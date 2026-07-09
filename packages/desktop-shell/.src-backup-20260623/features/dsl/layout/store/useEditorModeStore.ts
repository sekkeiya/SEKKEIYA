import { create } from "zustand";
import { createContext, useContext } from "react";

interface EditorModeState {
  editorMode: "normal" | "layout" | "zoning" | "material";
  setEditorMode: (mode: "normal" | "layout" | "zoning" | "material") => void;
  toggleEditorMode: () => void;

  layoutSubMode: "furniture_top" | "furniture_iso" | "ceiling_top" | "zone_2d";
  setLayoutSubMode: (mode: "furniture_top" | "furniture_iso" | "ceiling_top" | "zone_2d") => void;

  layoutCameraRotationIndex: number;
  setLayoutCameraRotationIndex: (inc: 1 | -1) => void;
  setLayoutCameraRotationIndexExact: (index: number) => void;

  layoutCameraTilt: "default" | "top" | "ceiling";
  setLayoutCameraTilt: (tilt: "default" | "top" | "ceiling") => void;

  isSectionClipEnabled: boolean;
  setIsSectionClipEnabled: (enabled: boolean) => void;

  // Per-axis section clip (X=left-right, Y=height, Z=front-back in Three.js coords)
  sectionClipYEnabled: boolean;       // height clip (maps to existing sectionClipHeight)
  setSectionClipYEnabled: (v: boolean) => void;
  sectionClipXEnabled: boolean;
  setSectionClipXEnabled: (v: boolean) => void;
  sectionClipX: number;               // Three.js world units (same scale as sectionClipHeight)
  setSectionClipX: (v: number) => void;
  sectionClipZEnabled: boolean;
  setSectionClipZEnabled: (v: boolean) => void;
  sectionClipZ: number;
  setSectionClipZ: (v: number) => void;
  sceneExtentXZ: number;              // half-extent of scene on X/Z axes for slider range
  setSceneExtentXZ: (v: number) => void;

  isGridVisible: boolean;
  setIsGridVisible: (visible: boolean) => void;

  gridHeightMm: number; // in mm
  setGridHeightMm: (height: number) => void;

  gridCellSizeMm: number; // in mm
  setGridCellSizeMm: (size: number) => void;

  isGridPickingMode: boolean;
  setIsGridPickingMode: (active: boolean) => void;

  sectionClipHeight: number;
  setSectionClipHeight: (height: number) => void;

  sceneMaxY: number;
  setSceneMaxY: (y: number) => void;

  rotateStepDeg: number;
  setRotateStepDeg: (deg: number) => void;

  // 3DSC context — set by LayoutShell so VerticalEditToolbar can pass room context to 3DSC
  dslBaseGlbUrl: string | null;
  setDslBaseGlbUrl: (url: string | null) => void;
  dslPlanContext: { projectId: string; workspaceId: string; planId: string } | null;
  setDslPlanContext: (ctx: { projectId: string; workspaceId: string; planId: string } | null) => void;
}

export const ViewportOverrideContext = createContext<{
  layoutSubMode?: "furniture_top" | "furniture_iso" | "ceiling_top";
  layoutCameraRotationIndexOffset?: number;
} | null>(null);

export function useViewportEditorMode() {
  const store = useEditorModeStore();
  const override = useContext(ViewportOverrideContext);

  let finalRotIndex = store.layoutCameraRotationIndex;
  if (override?.layoutCameraRotationIndexOffset !== undefined) {
    finalRotIndex = (finalRotIndex + override.layoutCameraRotationIndexOffset) % 4;
  }

  return {
    ...store,
    layoutSubMode: override?.layoutSubMode ?? store.layoutSubMode,
    layoutCameraRotationIndex: finalRotIndex,
    layoutCameraTilt: store.layoutCameraTilt,
  };
}

export const useEditorModeStore = create<EditorModeState>((set) => ({
  editorMode: "layout",
  setEditorMode: (editorMode) => set((state) => {
    const updates: Partial<EditorModeState> = { editorMode };
    if (editorMode === "layout" && state.editorMode !== "layout") {
      updates.isSectionClipEnabled = true;
    }
    return updates;
  }),
  toggleEditorMode: () => set((state) => {
    // Basic toggle logic (mostly for legacy shortcuts)
    const nextMode = state.editorMode === "normal" ? "layout" : "normal";
    const updates: Partial<EditorModeState> = { editorMode: nextMode };
    if (nextMode === "layout") updates.isSectionClipEnabled = true;
    return updates;
  }),

  layoutSubMode: "furniture_iso",
  setLayoutSubMode: (layoutSubMode) => set({ layoutSubMode }),

  layoutCameraRotationIndex: 0,
  setLayoutCameraRotationIndex: (inc) => 
    set((state) => {
      let next = state.layoutCameraRotationIndex + inc;
      if (next > 3) next = 0;
      if (next < 0) next = 3;
      return { layoutCameraRotationIndex: next };
    }),
  setLayoutCameraRotationIndexExact: (index) => set({ layoutCameraRotationIndex: index % 4 }),

  layoutCameraTilt: "top",
  setLayoutCameraTilt: (layoutCameraTilt) => set({ layoutCameraTilt }),

  isSectionClipEnabled: true,
  setIsSectionClipEnabled: (isSectionClipEnabled) => set({ isSectionClipEnabled }),

  sectionClipYEnabled: true,
  setSectionClipYEnabled: (sectionClipYEnabled) => set({ sectionClipYEnabled }),
  sectionClipXEnabled: false,
  setSectionClipXEnabled: (sectionClipXEnabled) => set({ sectionClipXEnabled }),
  sectionClipX: 0,
  setSectionClipX: (sectionClipX) => set({ sectionClipX }),
  sectionClipZEnabled: false,
  setSectionClipZEnabled: (sectionClipZEnabled) => set({ sectionClipZEnabled }),
  sectionClipZ: 0,
  setSectionClipZ: (sectionClipZ) => set({ sectionClipZ }),
  sceneExtentXZ: 10,
  setSceneExtentXZ: (sceneExtentXZ) => set({ sceneExtentXZ }),

  isGridVisible: true,
  setIsGridVisible: (isGridVisible) => set({ isGridVisible }),

  gridHeightMm: 0,
  setGridHeightMm: (h) => set({ gridHeightMm: Math.round(h) }), // enforce integer

  gridCellSizeMm: 1000,
  setGridCellSizeMm: (s) => set({ gridCellSizeMm: Math.round(s) }),

  isGridPickingMode: false,
  setIsGridPickingMode: (isGridPickingMode) => set({ isGridPickingMode }),

  sectionClipHeight: 1.5, // Default 1.5m
  setSectionClipHeight: (sectionClipHeight) => set({ sectionClipHeight }),

  sceneMaxY: 10,
  setSceneMaxY: (sceneMaxY) => set({ sceneMaxY }),

  rotateStepDeg: 90,
  setRotateStepDeg: (rotateStepDeg) => set({ rotateStepDeg }),

  dslBaseGlbUrl: null,
  setDslBaseGlbUrl: (url) => set({ dslBaseGlbUrl: url }),
  dslPlanContext: null,
  setDslPlanContext: (ctx) => set({ dslPlanContext: ctx }),
}));
