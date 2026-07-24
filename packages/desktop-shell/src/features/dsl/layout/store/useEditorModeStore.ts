import { create } from "zustand";
import { createContext, useContext } from "react";

type EditorMode = "normal" | "layout" | "zoning" | "material" | "walkthrough" | "map" | "label";

// ✅ 2D 配置 / 3D 演出 の上位グループ。
// - 2D: 平面での配置作業（Item / Zone / Map）
// - 3D: 見え方の演出（Lighting / Material / Label / Walkthrough）
// 切替の副作用（スコープ退避・カメラ tilt）は utils/applyViewGroup.ts に集約。
export type EditorViewGroup = "2d" | "3d";

export interface WalkthroughCharacterDescriptor {
  source: "preset" | "model";
  id: string;
  label: string;
  short: string;
  eyeM: number;
  heightM: number;
  shoulderM: number;
  color: string;
  glbUrl: string | null;
  thumbUrl?: string;
}

// 既定キャラ（成人男性プリセット）。walkthroughCharacters.js の male と一致させる。
const DEFAULT_WALKTHROUGH_CHARACTER: WalkthroughCharacterDescriptor = {
  source: "preset",
  id: "male",
  label: "成人男性",
  short: "男性",
  eyeM: 1.70,
  heightM: 1.75,
  shoulderM: 0.46,
  color: "light-dark(#0f409e, #5b8def)",
  glbUrl: null,
};

interface EditorModeState {
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  toggleEditorMode: () => void;

  // ✅ 2D 配置 / 3D 演出 の上位グループ（UI からは applyViewGroup 経由で切替える）
  editorViewGroup: EditorViewGroup;
  setEditorViewGroup: (group: EditorViewGroup) => void;

  // Walkthrough (一人称ウォークスルー) — 入る前のモードを覚えておき exit で復帰
  preWalkthroughMode: EditorMode;
  enterWalkthrough: () => void;
  exitWalkthrough: () => void;

  // スタートピン — null = 部屋中心に自動配置
  walkthroughStartPin: { x: number; z: number; yawDeg: number } | null;
  setWalkthroughStartPin: (pin: { x: number; z: number; yawDeg: number } | null) => void;

  // 視点モード
  walkthroughViewMode: "first" | "third" | "fly";
  setWalkthroughViewMode: (mode: "first" | "third" | "fly") => void;

  // 視点モードごとのレンズ長（焦点距離 mm・フルフレーム換算）。FOV に変換して適用。
  walkthroughLens: { first: number; third: number; fly: number };
  setWalkthroughLens: (mode: "first" | "third" | "fly", focalMm: number) => void;

  // キャラクター記述子（プリセット or S.Model モデル）。定義は walkthroughCharacters.js
  walkthroughCharacter: WalkthroughCharacterDescriptor;
  setWalkthroughCharacter: (c: WalkthroughCharacterDescriptor) => void;

  // ピンドラッグ中フラグ（OrbitControls を無効化するため）
  isWalkthroughPinDragging: boolean;
  setIsWalkthroughPinDragging: (v: boolean) => void;

  // 躯体の面ラベル＆コリジョン「躯体」モード（上部スコープトグルで入る）。
  structureTagging: boolean;
  setStructureTagging: (v: boolean) => void;

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
  /**
   * Y クリップの向き。false = 通常（切断高さより上を消す＝平面図の見下ろし）、
   * true = 反転（切断高さより下を消す＝天井伏図の見上げ）。
   */
  sectionClipYInvert: boolean;
  /** 平面図で他階の壁・床を薄く重ねるか（トレース用のマスタースイッチ）。 */
  showOtherFloorsGhost: boolean;
  setShowOtherFloorsGhost: (v: boolean) => void;
  setShowOtherFloorsGhost: (v: boolean) => void;
  /** 他階のうち、透過（ゴースト）表示する階の index。既定は空＝表示中の階以外はすべて非表示。
   *  右ドックの階の目アイコンをONにした階だけここに入り、薄く重ねて表示する。 */
  ghostFloors: number[];
  toggleFloorGhost: (index: number) => void;
  setSectionClipYInvert: (v: boolean) => void;
  sectionClipXEnabled: boolean;
  setSectionClipXEnabled: (v: boolean) => void;
  sectionClipX: number;               // Three.js world units (same scale as sectionClipHeight)
  setSectionClipX: (v: number) => void;
  sectionClipZEnabled: boolean;
  setSectionClipZEnabled: (v: boolean) => void;
  sectionClipZ: number;
  setSectionClipZ: (v: number) => void;
  /** 断面ビューの向き反転（A-A' の矢印を＋軸向きに）。
   *  true: クリップは pos 以上側を残し、正面/側面カメラは −Z/−X 側から見る。 */
  sectionViewFlip: boolean;
  setSectionViewFlip: (v: boolean) => void;
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
  // 断面 Clipping は editorMode では強制せず、選択スコープ(applySelectionScope)と
  // 手動トグルで制御する（ALL=OFF / Zone・Item=ON）。
  setEditorMode: (editorMode) => set({ editorMode }),
  toggleEditorMode: () => set((state) => {
    // Basic toggle logic (mostly for legacy shortcuts)
    const nextMode = state.editorMode === "normal" ? "layout" : "normal";
    return { editorMode: nextMode };
  }),

  // ✅ 初期は 2D 配置グループ（主作業＝家具配置）。
  // 起動直後の俯瞰ビューは維持したいので、カメラの強制はここでは行わず
  // ユーザーがトグルを操作したとき（applyViewGroup）にのみ tilt を切替える。
  editorViewGroup: "2d",
  setEditorViewGroup: (editorViewGroup) => set({ editorViewGroup }),

  preWalkthroughMode: "layout",
  enterWalkthrough: () => set((state) => {
    if (state.editorMode === "walkthrough") return {};
    // Preview 押下時はデフォルトで三人称モードを表示する
    // ✅ ウォークスルーは「3D 演出」の機能なので、2D 配置から入った場合はグループも 3D へ揃える
    //    （終了後も 3D 演出に留まる＝歩いて確認→材質/照明の調整、という流れに自然に繋がる）
    return {
      preWalkthroughMode: state.editorMode,
      editorMode: "walkthrough",
      walkthroughViewMode: "third",
      editorViewGroup: "3d",
    };
  }),
  exitWalkthrough: () => set((state) => {
    if (state.editorMode !== "walkthrough") return {};
    const back = state.preWalkthroughMode || "layout";
    const updates: Partial<EditorModeState> = { editorMode: back };
    if (back === "layout") updates.isSectionClipEnabled = true;
    return updates;
  }),

  walkthroughStartPin: null,
  setWalkthroughStartPin: (pin) => set({ walkthroughStartPin: pin }),

  walkthroughViewMode: "first",
  setWalkthroughViewMode: (walkthroughViewMode) => set({ walkthroughViewMode }),

  // 既定：一人称=超広角（没入）/ 三人称=広角 / フライ=超広角
  walkthroughLens: { first: 18, third: 24, fly: 18 },
  setWalkthroughLens: (mode, focalMm) =>
    set((state) => ({
      walkthroughLens: {
        ...state.walkthroughLens,
        [mode]: Math.max(12, Math.min(120, Math.round(focalMm))),
      },
    })),

  walkthroughCharacter: DEFAULT_WALKTHROUGH_CHARACTER,
  setWalkthroughCharacter: (walkthroughCharacter) => set({ walkthroughCharacter }),

  isWalkthroughPinDragging: false,
  setIsWalkthroughPinDragging: (isWalkthroughPinDragging) => set({ isWalkthroughPinDragging }),

  structureTagging: false,
  setStructureTagging: (structureTagging) => set({ structureTagging }),

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

  // 既定は "default"（斜め上からの俯瞰パース）。ALL スコープ初期表示で建物全体を
  // 3/4 アイソメで見渡せるようにする（Top 見下ろしにしたい場合は各モードが明示的に "top" を設定）。
  layoutCameraTilt: "default",
  setLayoutCameraTilt: (layoutCameraTilt) => set({ layoutCameraTilt }),

  // 既定 OFF。初回(ALL スコープ)は断面なしで全体を見せる。
  // ON にするのは Zone / Item スコープと手動トグル（applySelectionScope で制御）。
  isSectionClipEnabled: false,
  setIsSectionClipEnabled: (isSectionClipEnabled) => set({ isSectionClipEnabled }),

  sectionClipYEnabled: true,
  setSectionClipYEnabled: (sectionClipYEnabled) => set({ sectionClipYEnabled }),
  sectionClipYInvert: false,
  // 平面図で「アクティブ階以外の壁・床」を薄く重ねて見せる（トレース用）。
  showOtherFloorsGhost: true,
  setShowOtherFloorsGhost: (showOtherFloorsGhost) => set({ showOtherFloorsGhost }),
  // 透過表示する他階。既定は空＝表示中の階以外は非表示。目アイコンONで薄く重ねる。
  ghostFloors: [],
  toggleFloorGhost: (index) => set((s) => ({
    ghostFloors: s.ghostFloors.includes(index)
      ? s.ghostFloors.filter((i) => i !== index)
      : [...s.ghostFloors, index],
  })),
  setSectionClipYInvert: (sectionClipYInvert) => set({ sectionClipYInvert }),
  sectionClipXEnabled: false,
  setSectionClipXEnabled: (sectionClipXEnabled) => set({ sectionClipXEnabled }),
  sectionClipX: 0,
  setSectionClipX: (sectionClipX) => set({ sectionClipX }),
  sectionClipZEnabled: false,
  setSectionClipZEnabled: (sectionClipZEnabled) => set({ sectionClipZEnabled }),
  sectionClipZ: 0,
  setSectionClipZ: (sectionClipZ) => set({ sectionClipZ }),
  sectionViewFlip: false,
  setSectionViewFlip: (sectionViewFlip) => set({ sectionViewFlip }),
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

  sectionClipHeight: 1.5, // Default 1.5m (meters scale); corrected to 1500mm on mm-scale scene load
  setSectionClipHeight: (sectionClipHeight) => set({ sectionClipHeight }),

  sceneMaxY: 10,
  setSceneMaxY: (sceneMaxY) => set((state) => {
    const isMmScale = sceneMaxY > 100;
    // mm スケールシーンなのに高さがメートル単位のまま（<10）なら 1500mm に補正
    if (isMmScale && state.sectionClipHeight < 10) {
      return { sceneMaxY, sectionClipHeight: 1500 };
    }
    return { sceneMaxY };
  }),

  rotateStepDeg: 90,
  setRotateStepDeg: (rotateStepDeg) => set({ rotateStepDeg }),

  dslBaseGlbUrl: null,
  setDslBaseGlbUrl: (url) => set({ dslBaseGlbUrl: url }),
  dslPlanContext: null,
  setDslPlanContext: (ctx) => set({ dslPlanContext: ctx }),
}));
