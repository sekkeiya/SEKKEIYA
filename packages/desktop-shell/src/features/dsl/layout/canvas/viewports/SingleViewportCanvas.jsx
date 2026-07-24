// src/features/layout/components/MainArea/components/viewports/SingleViewportCanvas.jsx
import React, { useMemo, useCallback, useRef, useEffect, useState, Suspense } from "react";
import { layoutSceneRef } from "../../services/layoutSceneRef";
import { Box, Chip, Menu, MenuItem, Divider, ListItemIcon, ListItemText, IconButton, Slider, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { alpha, useTheme } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";

import {
  VIEW_TYPES,
  getOrthoPreset,
  optimizeTopPlacement,
} from "../../utils/viewportUtils.js";

import Lights from "../scene/Lights.jsx";
import SceneGrid from "../scene/SceneGrid.jsx";
import MapGroundPlane from "../scene/MapGroundPlane.jsx";
import MapDrawController from "../scene/MapDrawController.jsx";
import MapZoomController from "../scene/MapZoomController.jsx";
import UnderlayPlane from "../scene/UnderlayPlane.jsx";
import UnderlayDrawController from "../scene/UnderlayDrawController.jsx";
import BaseGlb from "../scene/BaseGlb.jsx";
import ParametricRoom from "../scene/ParametricRoom.jsx";
import { scanFloors } from "../tools/walkthrough/floorScan";
import StructureTagController from "../tools/structure/StructureTagController.jsx";
import StructureTagOverlay from "../tools/structure/StructureTagOverlay.jsx";
import LevelLinesOverlay from "../scene/LevelLinesOverlay.jsx";
import SectionLinesPlanOverlay from "../scene/SectionLinesPlanOverlay.jsx";
import ElevationMarkerPlanOverlay from "../scene/ElevationMarkerPlanOverlay.jsx";
import ElevationDimensionsOverlay from "../scene/ElevationDimensionsOverlay.jsx";
import { useElevationMarkerStore } from "../../store/useElevationMarkerStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useRoomElevationsStore } from "../../store/useRoomElevationsStore";
import ManualDimensionController from "../scene/ManualDimensionController.jsx";
import GridAxisOverlay from "../scene/GridAxisOverlay.jsx";
import { useGridAxisStore } from "../../store/useGridAxisStore";
import { useDimChainStore } from "../../store/useDimChainStore";
import DimensionChainsOverlay from "../scene/DimensionChainsOverlay.jsx";

/** アクティブなビューポートの viewKey を寸法列パネルへ伝える（パネルはこれを編集対象にする）。 */
function DimViewKeyReporter({ viewKey, active }) {
  React.useEffect(() => {
    if (!active || !viewKey) return;
    useViewportUiStore.getState().setActiveDimViewKey?.(viewKey);
  }, [viewKey, active]);
  return null;
}
import { buildLabelColliders } from "../tools/structure/structureColliders";
import { useStructureLabelStore } from "../../store/useStructureLabelStore";
import { useBaseUnionStore } from "../../store/useBaseUnionStore";
import LandscapeBackdrop from "../scene/LandscapeBackdrop.jsx";
import FurnitureItem from "../scene/FurnitureItem.jsx";
import FurnitureDimensionOverlay from "../scene/FurnitureDimensionOverlay.jsx";
import FurnitureGapOverlay from "../scene/FurnitureGapOverlay.jsx";
import ItemDimensionOverlay from "../scene/ItemDimensionOverlay.jsx";
import AiPlaceholderItem from "../scene/AiPlaceholderItem.jsx";
import ZoneDrawController, { roomInnerBounds } from "../scene/ZoneDrawController.jsx";
import WallsRenderer from "../scene/WallsRenderer.jsx";
import WallDrawController from "../scene/WallDrawController.jsx";
import WallEditController from "../scene/WallEditController.jsx";
import FloorSlabsRenderer from "../scene/FloorSlabsRenderer.jsx";
import FloorSlabDrawController from "../scene/FloorSlabDrawController.jsx";
import RoomCreateController from "../scene/RoomCreateController.jsx";
import SlabEditController from "../scene/SlabEditController.jsx";
import ZoneCirculationController from "../scene/ZoneCirculationController.jsx";

import TransformGizmo from "../tools/gizmo/TransformGizmo.jsx";
import LayoutModeInteractionController from "../tools/layout/LayoutModeInteractionController.jsx";
import WalkthroughController from "../tools/walkthrough/WalkthroughController.jsx";
import WalkthroughInteractionController from "../tools/walkthrough/WalkthroughInteractionController.jsx";
import WalkthroughStartPin from "../tools/walkthrough/WalkthroughStartPin.jsx";
import WalkthroughItemInfoBadge from "../tools/walkthrough/WalkthroughItemInfoBadge.jsx";
import WalkthroughMinimap from "../tools/walkthrough/WalkthroughMinimap.jsx";
import WalkthroughGalleryBar from "../tools/walkthrough/WalkthroughGalleryBar.jsx";
import { useAppStore } from "../../../../../store/useAppStore";
import { useItemInfoRegistryStore } from "../../store/itemInfoRegistryStore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ImageSearchRoundedIcon from "@mui/icons-material/ImageSearchRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { useAuthStore } from "../../../../../store/useAuthStore";
import { useWalkthroughCatalogStore } from "../../store/walkthroughCatalogStore";
import { useItemReplaceStore } from "../../store/useItemReplaceStore";
import WalkthroughProductActions from "../tools/walkthrough/WalkthroughProductActions";
import { runProductSearch, openExternalUrl } from "../../../../dss/utils/productImageSearch";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import CameraRoundedIcon from "@mui/icons-material/CameraRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import { autoApplyMaterials, AUTO_MATERIAL_STYLES } from "../../services/autoMaterialPipeline";
import { FURNITURE_MATERIAL_STYLES, applyFurnitureMaterialStyleFromRegistry } from "../../services/autoFurnitureMaterialPipeline";
import { autoApplyLightingAnimated, AUTO_LIGHTING_MOODS } from "../../services/autoLightingPipeline";
import { subscribeProjectMaterials } from "../../../../dsmt/api/dsmtQueries";
import { useToolsStore } from "../../store/toolsStore/useToolsStore";
import WalkthroughActionMenu from "../tools/walkthrough/WalkthroughActionMenu";
import { useWalkthroughToggle } from "../tools/walkthrough/useWalkthroughToggle";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useGimmickRegistryStore } from "../../store/gimmickRegistryStore";
import ZoneVisualizer from "../scene/ZoneVisualizer.jsx";

import { PerspectiveControlsBinder, OrthoControlsBinder } from "../controls/controlsBinders.jsx";
import ViewportFramingController from "../controls/ViewportFramingController.jsx";

import { useMarqueeSelection } from "../../hooks/useMarqueeSelection.js";


// ✁EObject3D registryE唯一のObject管琁EE
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";

import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useZoningStore } from "../../store/useZoningStore";
import { useViewportDisplayStore } from "../../store/useViewportDisplayStore";
import { useSelectionScopeStore, canSelectItem } from "../../store/useSelectionScopeStore";

// ✁Eviewport ui storeEElign / Command / layout etcEE
import { useViewportUiStore } from "../../store/viewportUiStore";
import { useSectionLinesStore } from "../../store/useSectionLinesStore";
import { useWallStore } from "../../store/useWallStore";
import { useSlabStore } from "../../store/useSlabStore";
import { pickStructureInRect } from "../../utils/marqueeStructurePick";

// ✁ESnap Engine
import SnapGuide from "../tools/align/SnapGuide.jsx";

import AlignCursorBinder from "./controllers/AlignCursorBinder.jsx";
import AlignPointerController from "./controllers/AlignPointerController.jsx";
import SmoothAlignFollower from "./controllers/SmoothAlignFollower.jsx";
import MaterialPickController from "./controllers/MaterialPickController.jsx";
import MaterialCursorBinder from "./controllers/MaterialCursorBinder.jsx";
import FacePickController from "./controllers/FacePickController.jsx";
import SelectedFaceHighlight from "../scene/SelectedFaceHighlight.jsx";
import SurfaceFinishOverlays from "../scene/SurfaceFinishOverlays.jsx";
import MaterialSweepFx from "../scene/MaterialSweepFx.jsx";
import ScanFx from "../scene/ScanFx.jsx";
import MaterialLookController from "../tools/material/MaterialLookController.jsx";
import AimFaceHighlight from "../tools/material/AimFaceHighlight.jsx";
import MaterialPins from "../tools/material/MaterialPins.jsx";
import { useMaterialViewStore } from "../../store/useMaterialViewStore";

import { useViewportSelection } from "./hooks/useViewportSelection";
import { useRmbNav } from "./hooks/useRmbNav";
import { useSnapEngine } from "./hooks/useSnapEngine";
import { useEditorModeStore, ViewportOverrideContext } from "../../store/useEditorModeStore";
import { useViewportEnvStore, threeToneMapping, focalLengthToFov } from "../../store/useViewportEnvStore";

import { useThree } from "@react-three/fiber";
import LayoutCameraRig from "../tools/layout/LayoutCameraRig.jsx";
import SectionClipManager from "../SectionClipManager.jsx";
import PaneClipPlanes from "../PaneClipPlanes.jsx";
import PaneSectionCap from "../PaneSectionCap.jsx";
import SectionCapFill from "../scene/SectionCapFill.jsx";
import SectionWarmup from "../scene/SectionWarmup.jsx";
import { useHeightSetupStore } from "../../store/useHeightSetupStore";
import GridPickController from "./controllers/GridPickController.jsx";

/**
 * このクリックのレイ上に「作図した壁・床（およびその編集ハンドル）」が含まれるか。
 *
 * 躯体(BaseGlb)や背景キャッチャーの onClick は「余白を押した＝選択解除」を担うが、
 * 上から見ると躯体の屋根などが壁より手前にあるため、R3F の交差順で
 *   壁の pointerdown（選択） → 躯体の click（解除） → 壁の click（stopPropagation）
 * となり、壁側の stopPropagation が間に合わずに選択が即解除されてしまう。
 * そこで解除側がこの判定を見て、作図躯体に当たっているクリックでは解除をスキップする。
 */
const hitsDrawnStructure = (e) => {
  for (const hit of e?.intersections || []) {
    for (let o = hit.object; o; o = o.parent) {
      if (o.userData?.isDrawnStructure) return true;
    }
  }
  return false;
};

/**
 * 天井伏図（反射天井伏図）用: 直交投影の X を反転して、平面図と同じ向きで描く。
 *
 * 天井は下から見上げるので、そのままだと左右が鏡像になる。建築図面の天井伏図は
 * 「床に鏡を置いて見下ろした図」＝平面図と同じ向きで描くのが規約なので、投影行列で反転する。
 *
 * カメラの投影だけを反転する（シーンやワールド座標は触らない）理由:
 *   ・クリック判定は projectionMatrixInverse 経由なので反転が自動で反映され、正しく当たる
 *   ・寸法/ゾーンのラベル(Html)は投影で位置が決まるので位置は反転・文字は正立のまま
 *   ・壁/床の編集ハンドルのワールド座標計算（床平面へのレイキャスト）もそのまま成立する
 * 反面、three.js は「オブジェクト行列」の反転しか面の裏表を自動補正しないため、
 * 画面上の巻き方向が反転する。影響を受けるステンシル（断面の黒塗り）は SectionCapFill 側で
 * mirrored を見て表裏を入れ替えている。
 */
function MirrorXProjection({ active }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!active || !camera) return;
    const orig = camera.updateProjectionMatrix.bind(camera);
    const patched = () => {
      orig();
      const e = camera.projectionMatrix.elements;
      e[0] = -e[0];   // X スケール
      e[12] = -e[12]; // 左右非対称フラスタム時の平行移動分
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    };
    camera.updateProjectionMatrix = patched;
    patched();
    return () => {
      camera.updateProjectionMatrix = orig;
      orig();
    };
  }, [camera, active]);
  return null;
}

function ContextDisposer() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      // 共有参照は「この gl が所有している場合のみ」クリアする。
      // ウォークスルー⇔通常ビューの入替では、終了側のアンマウント cleanup が
      // 新しくマウントされたビューの参照を上書きで消してしまい（競合）、
      // 画面が真っ暗になることがあったため所有者チェックを入れる。
      if (layoutSceneRef.gl === gl) {
        layoutSceneRef.gl = null;
        layoutSceneRef.scene = null;
        layoutSceneRef.baseRoot = null;
        layoutSceneRef.getCameraState = null;
        layoutSceneRef.setCameraPose = null;
      }

      // 解放は次フレームへ遅延する。ウォークスルー⇔通常ビューの入替では、
      // アンマウントと同フレームで再マウントが起きるため、同期的に
      // forceContextLoss/dispose すると再マウント側のレンダリングが壊れて
      // 真っ暗になることがある。1 フレーム遅らせて確実にコミット後に解放する。
      setTimeout(() => {
        try {
          const ctx = typeof gl?.getContext === "function" ? gl.getContext() : null;
          const alreadyLost = !!ctx && typeof ctx.isContextLost === "function" && ctx.isContextLost();
          if (gl && !alreadyLost && typeof gl.forceContextLoss === "function") {
            gl.forceContextLoss();
          }
          if (gl && typeof gl.dispose === "function") {
            gl.dispose();
          }
        } catch (e) {
          console.warn("[ContextDisposer] WebGL context loss error:", e);
        }
      }, 0);
    };
  }, [gl]);
  return null;
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error("[SingleViewportCanvas] Render failed inside Canvas:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/* =========================================================
 * ViewportDisplayController
 * Applies display modes to the Three.js scene
 * ======================================================= */
function ViewportDisplayController({ mode, ghostOpacity = 0.45, renderSubMode = "standard" }) {
  const { scene, gl } = useThree();
  // Ambience の Camera/Render タブからの設定を購読
  const envToneMapping = useViewportEnvStore((s) => s.toneMapping);
  const envExposure = useViewportEnvStore((s) => s.exposure);

  useEffect(() => {
    if (!scene || !gl) return;

    // 影の表示は「通常 / Lighting」トグルに連動させる。
    //   通常 (standard) → 影なし / Lighting (lighting) → 影あり
    // （レンダリング系モードでのみ意味を持つ）
    const needsShadow = (mode === "rendered" || mode === "shaded") && renderSubMode === "lighting";
    if (gl.shadowMap) {
      if (gl.shadowMap.enabled !== needsShadow) {
        gl.shadowMap.enabled = needsShadow;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.shadowMap.needsUpdate = true;
        // shadowMap.enabled をランタイムで切り替えた場合、影の受け取りは
        // シェーダーにコンパイルされているため、全マテリアルを再コンパイルする必要がある。
        scene.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => { if (m) m.needsUpdate = true; });
          }
        });
      }
    }

    // ── GL-level: tone mapping & exposure
    // 「レンダリング」モード時のみ Ambience > Camera/Render タブの設定を適用。
    // 他モード (outline / shaded / ghosted) では忠実な色再現のためトーンマッピング無効。
    if (mode === "rendered") {
      gl.toneMapping = threeToneMapping(envToneMapping);
      gl.toneMappingExposure = envExposure;
    } else {
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1.0;
    }

    // A helper to recursively update materials
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        // Clone materials for this viewport to avoid affecting other viewports
        if (!obj.userData.hasViewportClonedMaterial) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(m => m.clone());
          } else {
            obj.material = obj.material.clone();
          }
          obj.userData.hasViewportClonedMaterial = true;
        }

        // Outline Edges handling
        if (mode === "outline" || mode === "shaded") {
          if (!obj.userData.outlineMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
            try {
              const edges = new THREE.EdgesGeometry(obj.geometry, 15); // angle threshold
              const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
              const outlineMesh = new THREE.LineSegments(edges, lineMat);
              // Render order helps but polygonOffset is better to prevent z-fighting
              lineMat.polygonOffset = true;
              lineMat.polygonOffsetFactor = -1;
              lineMat.polygonOffsetUnits = -1;
              
              obj.add(outlineMesh);
              obj.userData.outlineMesh = outlineMesh;
            } catch (err) {
              console.warn("Failed to create edges geometry for mesh", err);
            }
          }
          if (obj.userData.outlineMesh) {
            obj.userData.outlineMesh.visible = true;
            if (mode === "outline") {
              obj.userData.outlineMesh.material.color.setHex(0xffffff); // White outline on transparent faces
            } else if (mode === "shaded") {
              obj.userData.outlineMesh.material.color.setHex(0x000000); // Black edges on shaded mode
            }
          }
        } else {
          if (obj.userData.outlineMesh) {
            obj.userData.outlineMesh.visible = false;
          }
        }

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        
        mats.forEach(mat => {
          // Backup original settings if not already backed up
          if (mat.userData.originalWireframe === undefined) {
             mat.userData.originalWireframe = mat.wireframe || false;
             mat.userData.originalTransparent = mat.transparent || false;
             mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
             mat.userData.originalDepthTest = mat.depthTest !== undefined ? mat.depthTest : true;
             mat.userData.originalDepthWrite = mat.depthWrite !== undefined ? mat.depthWrite : true;
             mat.userData.originalColor = mat.color ? mat.color.getHex() : 0xffffff;
             mat.userData.originalRoughness = mat.roughness !== undefined ? mat.roughness : 0.5;
             mat.userData.originalMetalness = mat.metalness !== undefined ? mat.metalness : 0.5;
          }

          // Apply mode
          switch (mode) {
            case "ghosted":
              // 躯体のみ透過、家具は通常表示を維持
              mat.wireframe = false;
              if (obj.userData.isStructuralBase) {
                mat.transparent = true;
                mat.opacity = ghostOpacity;
                mat.depthTest = true;
                mat.depthWrite = false;
              } else {
                mat.transparent = mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity;
                mat.depthTest = mat.userData.originalDepthTest;
                mat.depthWrite = mat.userData.originalDepthWrite;
              }
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              break;
            case "outline":
              mat.wireframe = false;
              mat.transparent = true;
              mat.opacity = 0.0; // Completely transparent faces
              mat.depthTest = true;
              mat.depthWrite = false;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              break;
            case "rendered":
              mat.wireframe = false;
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.depthTest = mat.userData.originalDepthTest;
              mat.depthWrite = mat.userData.originalDepthWrite;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              if (renderSubMode === "lighting") {
                // Lighting プレビュー: 元の PBR 値を尊重（Cycles シミュレート）
                if (mat.userData.originalRoughness !== undefined) mat.roughness = mat.userData.originalRoughness;
                if (mat.userData.originalMetalness !== undefined) mat.metalness = mat.userData.originalMetalness;
              } else {
                // 通常: ソフトでクリーンな見た目
                mat.roughness = 0.8;
                mat.metalness = 0.1;
              }
              break;
            case "shaded":
            default:
              // Restore
              mat.wireframe = mat.userData.originalWireframe;
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.depthTest = mat.userData.originalDepthTest;
              mat.depthWrite = mat.userData.originalDepthWrite;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              if (mat.userData.originalRoughness !== undefined) mat.roughness = mat.userData.originalRoughness;
              if (mat.userData.originalMetalness !== undefined) mat.metalness = mat.userData.originalMetalness;
              break;
          }
          
          mat.needsUpdate = true;
        });
      }
    });

  }, [scene, gl, mode, ghostOpacity, renderSubMode, envToneMapping, envExposure]);

  return null;
}


// ベースが実際に切り替わったときだけスタートピンを初期化するための、
// インスタンスをまたいで共有するシグネチャ（モジュールスコープ）。
// ウォークスルー専用画面のマウントで同じベースを再ロードしても、
// ピン位置が消えないようにするためのガード。
let lastWalkthroughBaseSig = null;

/* =========================================================
 * SingleViewportCanvas
 * ======================================================= */
export default function SingleViewportCanvas({
  viewportId,
  type,
  active = false,
  overrideSubMode,
  overrideRotOffset,
  onActivate,

  onToggleMaximize,

  isBaseReady,
  displayBaseUrl,
  roomSpec = null,
  pendingBaseUrl,
  onPendingLoaded,

  items = [],

  onCanvasDrop,
  onCanvasDragOver,
  allowDrop = true,
  onDeleteItems,

  lockToGround = true,
  axisConstraint = "none",
  snapEnabled = false,
  snapStep = 0.5,
  groundY = 0,

  showGizmo = false,
  gizmoMode = "translate",
  gizmoSpace = "local",

  onCommitTransform,
  onCommitTransforms,

  onChangeTransform,
  onChangeTransforms,

  onRequestNumericOpen,
  onRequestNumericClose,
  numericCloseTick = 0,

  focusTick = 0,
  frameAllTick = 0,

  speedMode = "walk",
  speedMul = 1,
  onChangeSpeedMode,
  onSpeedMulChange,

  onNavActiveChange,

  registerViewportApi,

  materialPicking = false,
  onPickMaterial,
  onGizmoHoverAxisChange,
  onRequestCopy,
  onBeginHistoryBatch,
  onEndHistoryBatch,
  onCancelHistoryBatch,

  // 図面グリッド（分割図面ビュー）のペイン設定。非 null のときこのペインは
  // { flip, clipPlanes, frameBox } をグローバル状態より優先する（viewportUiStore.DrawingGridPane 参照）。
  paneDrawing = null,
}) {
  const theme = useTheme();
  const editorMode = useEditorModeStore(state => state.editorMode);
  // ✅ 2D 配置 / 3D 演出 グループ（通常/Lighting プレビュー切替は 3D のみ表示）
  const editorViewGroup = useEditorModeStore(state => state.editorViewGroup);
  const is3DGroup = editorViewGroup === "3d";
  const structureTagging = useEditorModeStore(state => state.structureTagging);
  // 高さ断面（天井カット）が有効なときは、抜けた天井から採光する（Top が真っ暗になるのを防ぐ）。
  const sectionClipEnabledForLight = useEditorModeStore(state => state.isSectionClipEnabled);
  const sectionClipYEnabledForLight = useEditorModeStore(state => state.sectionClipYEnabled);
  // 断面ビューの向き反転（A-A' 矢印＋側）。FRONT/RIGHT 正射のカメラ側を −Z/−X に切り替える。
  // 図面グリッドのペインはペイン固有の flip を優先（北と南を同時に出すため）。
  const sectionViewFlipGlobal = useEditorModeStore(state => state.sectionViewFlip);
  const sectionViewFlip = paneDrawing ? !!paneDrawing.flip : sectionViewFlipGlobal;
  // 2画面表示か（クリップ書き込み役を図面ペインに一本化するため）
  const isSplitLayout = useViewportUiStore(state => state.layoutMode === "split");
  const globalLayoutSubMode = useEditorModeStore(state => state.layoutSubMode);
  const layoutCameraTilt = useEditorModeStore(state => state.layoutCameraTilt);
  // Ambience > Camera タブから focal length (mm) を購読し、垂直 FOV (度) に変換
  const envFocalLength = useViewportEnvStore((s) => s.focalLength);
  const setEnvFocalLength = useViewportEnvStore((s) => s.setFocalLength);
  const envFov = useMemo(() => focalLengthToFov(envFocalLength), [envFocalLength]);
  // ウォークスルー時は視点モードごとのレンズ長（焦点距離 mm）を FOV に変換して適用
  const walkthroughLens = useEditorModeStore((s) => s.walkthroughLens);

  const currentSubMode = overrideSubMode || globalLayoutSubMode;
  let effectiveSubMode = currentSubMode;
  // overrideSubMode が指定されている場合（2画面表示など）はその指定を尊重し、
  // グローバルな layoutCameraTilt による上書きを適用しない
  if (!overrideSubMode && currentSubMode === "furniture_iso") {
      if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
      else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
  }

  // ビュー種別（Top/Perspective）は editorMode から独立。カメラはビューポート設定
  // （layoutCameraTilt）だけで決まり、どのモードでも統一される（モード切替で勝手に変わらない）。
  // 真上 Top は tilt="top"/"ceiling"（furniture_top/ceiling_top）または明示の zone_2d のとき。
  const isZone2D =
    effectiveSubMode === "zone_2d" ||
    effectiveSubMode === "furniture_top" ||
    effectiveSubMode === "ceiling_top";
  const effectiveType = isZone2D ? VIEW_TYPES.TOP : type;
  // 側面正射ビュー（＝立面図/断面図）。図面表示なので Sun・ゾーン・スタートピン等の
  // 平面/3D向けラベルは隠す。
  const isSideOrtho = effectiveType === VIEW_TYPES.FRONT || effectiveType === VIEW_TYPES.RIGHT;
  // ゾーン編集（描画/ギズモ）はビュー種別ではなく「ゾーンモードか」で判定（俯瞰パースでも編集可）。
  const isZoning = editorMode === "zoning";

  // 図面記号（断面線 / ゾーン / 展開記号）の一括表示トグル（TopBar の「記号」ボタン）。
  // ゾーン編集中は、描いている当人が見えないと作業にならないので記号 OFF でも出す。
  const showSymbols = useViewportDisplayStore((s) => s.showSymbols);
  // 記号は「マスター × 項目別」の AND。項目は TopBar の記号ボタンの ▾ から切替える。
  const symbolFlags = useViewportDisplayStore((s) => s.symbolFlags);
  const symOn = (kind) => showSymbols && !!symbolFlags?.[kind];
  const showZoneSymbols = symOn("zone") || isZoning;

  // 余白クリック／Esc で、図面注記（通り芯・寸法列）の選択とパネルを畳む。
  //   通り芯は線・記号側で stopPropagation しているので、ここに来るのは本当の余白だけ。
  const clearDrawingAnnotationSelection = React.useCallback(() => {
    const gx = useGridAxisStore.getState();
    if (gx.selectedId || gx.panelOpen) { gx.setSelectedId(null); gx.setPanelOpen(false); }
    const dc = useDimChainStore.getState();
    if (dc.panelOpen) dc.setPanelOpen(false);
    // 展開記号（目のマーク）の部屋選択も、余白クリック / ESC で解除する。
    const re = useRoomElevationsStore.getState();
    if (re.selectedRoomId) re.selectRoom(null);
  }, []);

  // 図面ビューの補助光トグル（TopBar の「ライト」ボタン）。
  const drawingLight = useViewportDisplayStore((s) => s.drawingLight);

  // ウォークスルーはパース viewport のみ。OrbitControls/Gizmo を無効化する。
  const isWalkthrough = editorMode === "walkthrough" && effectiveType === VIEW_TYPES.PERSPECTIVE;
  const { enter: enterWalkthroughMode, exit: exitWalkthrough } = useWalkthroughToggle();

  // Material モード：躯体（床/壁/天井）の面をクリック選択。家具は FurnitureItem 側でゴースト表示。
  const isMaterialMode = editorMode === "material";
  // Map モード：敷地に航空写真を合わせる作業。寸法/ゾーン/照明等のオーバーレイを隠す。
  const isMapMode = editorMode === "map";
  // Label モード：面ラベルを見やすく確認。ゴースト表示＋面ラベル表示＋断面CLIPPING無視（全体表示）。
  const isLabelMode = editorMode === "label";
  // 高さ設定（断面）モード：側面/正面のエレベーションをゆとりをもってフレーミングする。
  const heightSetupActive = useHeightSetupStore((s) => s.active);
  // 躯体の面ラベル＆コリジョン：「躯体」モード（structureTagging）中のパース表示でのみ有効。
  // 家具レイアウト中に壁クリックで面パネルが暴発しないよう、専用モードに閉じ込める。
  // 面クリックで右サイドバー Properties に設定を開く。
  const structureFacePicking =
    structureTagging &&
    !isWalkthrough && !isMaterialMode && !materialPicking &&
    (editorMode === "layout" || editorMode === "normal") &&
    effectiveType === VIEW_TYPES.PERSPECTIVE;
  // 一人称で見渡す（展開図ピン視点）。パース viewport のみ。
  const materialFirstPerson = useMaterialViewStore((s) => s.firstPerson);
  const exitMaterialFirstPerson = useMaterialViewStore((s) => s.exitFirstPerson);
  const addMaterialPin = useMaterialViewStore((s) => s.addPin);
  const materialLensMm = useMaterialViewStore((s) => s.lensMm);
  const setMaterialLensMm = useMaterialViewStore((s) => s.setLensMm);
  const isMaterialLook = isMaterialMode && materialFirstPerson && effectiveType === VIEW_TYPES.PERSPECTIVE;

  // 展開図ピンを部屋中心付近に追加（複数配置に対応。既存数だけ少しずらす）。
  const addMaterialPinAtRoom = useCallback(() => {
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    let cx = 0, cz = 0;
    if (colliders.length) {
      const box = new THREE.Box3();
      colliders.forEach((c) => box.expandByObject(c));
      if (!box.isEmpty()) { const c = box.getCenter(new THREE.Vector3()); cx = c.x; cz = c.z; }
    }
    const n = useMaterialViewStore.getState().pins.length;
    const mmScale = (useEditorModeStore.getState().sceneMaxY || 0) > 100;
    const off = n * (mmScale ? 800 : 0.8);
    addMaterialPin({ id: `mpin_${Date.now()}_${n}`, x: cx + off, z: cz + off, yawDeg: 0 });
  }, [addMaterialPin]);
  // Material モードを抜けたら一人称をリセット
  useEffect(() => {
    if (!isMaterialMode && materialFirstPerson) exitMaterialFirstPerson();
  }, [isMaterialMode, materialFirstPerson, exitMaterialFirstPerson]);

  const walkthroughViewMode    = useEditorModeStore((s) => s.walkthroughViewMode);
  const setWalkthroughViewMode = useEditorModeStore((s) => s.setWalkthroughViewMode);
  const setWalkthroughLens     = useEditorModeStore((s) => s.setWalkthroughLens);
  const walkthroughCharacter    = useEditorModeStore((s) => s.walkthroughCharacter);
  const isWalkthroughPinDragging = useEditorModeStore((s) => s.isWalkthroughPinDragging);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const gimmickHoverLabel = useGimmickRegistryStore((s) => s.hoverLabel);
  const infoHoverId = useItemInfoRegistryStore((s) => s.hoverInfoId);
  const infoOpenId = useItemInfoRegistryStore((s) => s.openInfoId);
  const closeInfo = useItemInfoRegistryStore((s) => s.openInfo);
  const infoOpenEntry = infoOpenId ? useItemInfoRegistryStore.getState().get(infoOpenId) : null;
  const infoTab = useItemInfoRegistryStore((s) => s.openTab);
  const setInfoTab = useItemInfoRegistryStore((s) => s.setOpenTab);
  const currentUid = useAuthStore((s) => s.currentUser?.uid || null);
  const catBusy = useWalkthroughCatalogStore((s) => s.busy);
  const catError = useWalkthroughCatalogStore((s) => s.error);
  const catMatches = useWalkthroughCatalogStore((s) => s.matches);
  const catForItemId = useWalkthroughCatalogStore((s) => s.forItemId);
  const runCatalogSearch = useWalkthroughCatalogStore((s) => s.run);
  const catThumbMap = useWalkthroughCatalogStore((s) => s.thumbMap);
  const catThumbsLoaded = useWalkthroughCatalogStore((s) => s.thumbsLoaded);
  const loadCatThumbs = useWalkthroughCatalogStore((s) => s.loadThumbs);
  useEffect(() => {
    if (infoOpenId && infoTab === "similar") loadCatThumbs();
  }, [infoOpenId, infoTab, loadCatThumbs]);
  // 置換フロー（CLIP類似候補）の状態
  const replaceSearchItemId = useItemReplaceStore((s) => s.searchItemId);
  const replaceSearchBusy = useItemReplaceStore((s) => s.searchBusy);
  const replaceSearchError = useItemReplaceStore((s) => s.searchError);
  const replaceCandidates = useItemReplaceStore((s) => s.candidates);
  const setReplaceOverride = useItemReplaceStore((s) => s.setOverride);
  const clearReplaceOverride = useItemReplaceStore((s) => s.clearOverride);
  const clearReplaceSearch = useItemReplaceStore((s) => s.clearSearch);
  const activeOverride = useItemReplaceStore((s) => (infoOpenId ? s.overrides[String(infoOpenId)] : null));
  // 三人称: クリックでピン留めされた操作対象アイテム（ギミックボタン群）
  const activeGimmickItemId = useGimmickRegistryStore((s) => s.activeItemId);
  const setActiveGimmickItem = useGimmickRegistryStore((s) => s.setActiveItemId);

  // ── ウォークスルー：フルスクリーン切替 ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);
  // ウォークスルー終了時はフルスクリーンも解除する
  useEffect(() => {
    if (!isWalkthrough && document.fullscreenElement === rootRef.current) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [isWalkthrough]);

  // ウォークスルー内「自動マテリアル」：スタイルを順に切替えて躯体に一括適用。
  // 直前に追加した縦ワイプで床/壁/天井がグラデーションで貼り替わる。
  const autoMatStyleIdxRef = useRef(0);
  const handleWalkthroughAutoMaterial = useCallback(() => {
    const keys = Object.keys(AUTO_MATERIAL_STYLES);
    if (!keys.length) return;
    const styleKey = keys[autoMatStyleIdxRef.current % keys.length];
    autoMatStyleIdxRef.current += 1;
    const projectId = useAppStore.getState().activeProjectId;
    if (!projectId) { try { autoApplyMaterials(styleKey); } catch {} return; }
    // プロジェクト素材（テクスチャ）を一度だけ取得して適用
    let done = false;
    let unsub = null;
    unsub = subscribeProjectMaterials(projectId, (mats) => {
      if (done) return;
      done = true;
      try { autoApplyMaterials(styleKey, mats || []); } catch {}
      setTimeout(() => { try { unsub?.(); } catch {} }, 0);
    });
  }, []);

  // ウォークスルー内「自動家具マテリアル」：スタイルを順に切替えて家具のバリアントを一括適用。
  // useItemMaterialRegistryStore から直接 apply() を呼ぶため Firestore 不要・即時反映。
  const autoFurMatStyleIdxRef = useRef(0);
  const handleWalkthroughAutoFurnitureMaterial = useCallback(() => {
    const keys = Object.keys(FURNITURE_MATERIAL_STYLES);
    if (!keys.length) return;
    const styleKey = keys[autoFurMatStyleIdxRef.current % keys.length];
    autoFurMatStyleIdxRef.current += 1;
    try { applyFurnitureMaterialStyleFromRegistry(styleKey); } catch {}
  }, []);

  // ウォークスルー内「自動ライティング」：ムードを順に切替えて室内照明を一括生成。
  // 室内ジオメトリ（天井高/広さ）から配置を決め、ピン留め以外のライトを置換する。
  const autoLightMoodIdxRef = useRef(0);
  const handleWalkthroughAutoLighting = useCallback(() => {
    const keys = Object.keys(AUTO_LIGHTING_MOODS);
    if (!keys.length) return;
    const moodKey = keys[autoLightMoodIdxRef.current % keys.length];
    autoLightMoodIdxRef.current += 1;
    try { autoApplyLightingAnimated(moodKey); } catch {}
  }, []);

  // ゾーンのクランプ先となる部屋内側境界（mm）。roomSpec が無ければ null（クランプなし）
  const zoneRoomBounds = useMemo(() => roomInnerBounds(roomSpec), [roomSpec]);

// ============================================================
  // ✁EHistory batch�E�Endo 1回＝操佁E回！E
  // - drag開始で begin
  // - commit or drag終亁E�� end�E�E重end防止�E�E
  // ============================================================
  const historyRef = useRef({ open: false, token: 0 });
  const pendingEndRef = useRef(false);

  const beginHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onBeginHistoryBatch) return;
      if (historyRef.current.open) return;
      historyRef.current.open = true;
      historyRef.current.token += 1;
      const token = historyRef.current.token;
      onBeginHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onBeginHistoryBatch, viewportId]
  );

  const endHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onEndHistoryBatch) return;
      if (!historyRef.current.open) return;
      historyRef.current.open = false;
      const token = historyRef.current.token;
      onEndHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onEndHistoryBatch, viewportId]
  );

  const cancelHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onCancelHistoryBatch) return;
      if (!historyRef.current.open) return;
      historyRef.current.open = false;
      const token = historyRef.current.token;
      onCancelHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onCancelHistoryBatch, viewportId]
  );

  // ============================================================
  // ✁ECommandBar focus condition
  // ============================================================
  const commandAxis = useViewportUiStore((s) => s.commandAxis);

  // ============================================================
  // ✁EAlign tool state from store�E�Ewner/session方式！E
  // ============================================================
  const alignTick = useViewportUiStore((s) => s.alignTick);
  const alignKey = useViewportUiStore((s) => s.alignKey);
  const alignPhase = useViewportUiStore((s) => s.alignPhase);
  const alignOwnerViewportId = useViewportUiStore((s) => s.alignOwnerViewportId);
  const beginAlignSession = useViewportUiStore((s) => s.beginAlignSession);
  const endAlignSession = useViewportUiStore((s) => s.endAlignSession);
  const isAlignOwnerFn = useViewportUiStore((s) => s.isAlignOwner);

  const isAlignOwner = isAlignOwnerFn?.(viewportId) && alignPhase !== "idle";
  const setActiveViewportId = useViewportUiStore((s) => s.setActiveViewportId);
  const gizmoDraggingStore = useViewportUiStore((s) => s.gizmoDragging);
  const setGizmoHotAxisStore = useViewportUiStore((s) => s.setGizmoHotAxis);

  const suppressMarqueePointerIdRef = useRef(null);
  const gizmoDraggingRef = useRef(false);

  const { 
    selectedItemIds,
    selectedItemId,
    selectedSet,
    applySelectionIds,
    clearSelection
  } = useViewportSelection({ materialPicking });

  const { 
    rmbRef, 
    isNavActive, 
    setRmb 
  } = useRmbNav({ active, onNavActiveChange });

  const {
    shiftSnap,
    shiftSnapRef,
    getSnapActive,
    snapEngineRef,
    clearSnapLocks,
    lastSnapUiRef,
    snapAxisValue,
  } = useSnapEngine({ snapEnabled });


  // ============================================================
  // ✁EDisplay Mode
  const viewportDisplayModes = useViewportUiStore((s) => s.viewportDisplayModes);
  const setViewportDisplayMode = useViewportUiStore((s) => s.setViewportDisplayMode);
  const currentDisplayMode = viewportDisplayModes?.[viewportId] || "rendered";
  
  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);

  // ✁EMenu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const handleMenuClose = () => setMenuAnchorEl(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.45);
  // "standard" = 通常レンダリング / "lighting" = Lighting設定反映プレビュー
  const [renderSubMode, setRenderSubMode] = useState("standard");

  const displayModes = [
    { value: "outline", label: "ワイヤーフレーム" },
    { value: "shaded", label: "シェーディング" },
    { value: "rendered", label: "レンダリング" },
    { value: "ghosted", label: "ゴースト" },
  ];

  // ============================================================
  // ✁EregistryMap を購読
  // ============================================================
  const registryMap = useSceneObjectRegistryStore((s) => s.map);

  const objectsRef = useRef(new Map());
  useEffect(() => {
    if (registryMap && registryMap instanceof Map) objectsRef.current = registryMap;
    else objectsRef.current = new Map();
  }, [registryMap]);

  const selectedObject = useMemo(() => {
    if (!selectedItemId) return null;
    const obj = registryMap?.get(selectedItemId) || null;
    return obj;
  }, [selectedItemId, registryMap, viewportId]);

  const [alignMode, setAlignMode] = useState(null);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const isGizmoUiActiveRef = useRef(false);


  // ✁Esuppress めE“確実に解除 Eする�E�Eointerupがrootに来なぁE��ース対策！E
  useEffect(() => {
    const clear = () => {
      suppressMarqueePointerIdRef.current = null;
    };
    window.addEventListener("pointerup", clear, true);
    window.addEventListener("pointercancel", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("pointerup", clear, true);
      window.removeEventListener("pointercancel", clear, true);
      window.removeEventListener("blur", clear);
    };
  }, []);


  // ============================================================
  // ✁ESnap candidates builder�E�※Baseはinsetではなく、他オブジェクト中忁E��寁E��る！E
  // - Baseは壁厚/床�E作りが多様なので bbox候補�E誤誘導しめE��ぁE
  // - 壁制紁E�E follower 側の Raycast(法線フィルタ)で行う
  // ============================================================
  const rootRef = useRef(null);
  const orbitRef = useRef(null);
  const baseRootRef = useRef(null);
  const baseCollidersRef = useRef([]);
  const baseMeshesRef = useRef([]);   // 実躯体メッシュ（スキャン床/ラベル板を含まない）
  const scanPlanesRef = useRef([]);   // 自動床スキャンで生成した不可視床板

  // ── layoutSceneRef をアクティブな viewport に向け直す ──────────
  // MultiViewportTiled は全 viewport を同時マウント（CSS display:none）するため
  // 最後にマウントされた canvas が onCreated を上書きしてしまう。
  // active prop が true になったタイミングで再登録することで正しい viewport を参照させる。
  const glRef    = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    layoutSceneRef.getCameraState = () => {
      const controls = orbitRef.current;
      if (!controls) return null;
      const cam = controls.object;
      if (!cam) return null;
      const fov = cam.isPerspectiveCamera ? cam.fov : 50;
      return {
        position: [cam.position.x, cam.position.y, cam.position.z],
        target:   [controls.target.x, controls.target.y, controls.target.z],
        fov,
      };
    };
    layoutSceneRef.setCameraPose = (pose) => {
      const controls = orbitRef.current;
      if (!controls) return;
      const cam = controls.object;
      if (!cam) return;
      cam.position.set(pose.position[0], pose.position[1], pose.position[2]);
      controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
      if (cam.isPerspectiveCamera && Number.isFinite(pose.fov)) {
        cam.fov = pose.fov;
        cam.updateProjectionMatrix();
      }
      controls.update();
    };
    // 平面図で矩形が収まるようにパン＋ズーム（部屋ラベルのダブルクリック＝フォーカス用）。
    //   平面(Top)は正射カメラ。drei の OrthographicCamera は既定でキャンバスの CSS ピクセルを
    //   フラスタムに使う（zoom=1 で 1px=1world）。可視幅 = canvasW/zoom なので、
    //   矩形(mm)＋余白が収まる zoom を採る。正射でないビュー（パース/立面）では何もしない。
    layoutSceneRef.focusRect = (cx, cz, width, depth, pad = 1.3) => {
      const controls = orbitRef.current;
      if (!controls) return;
      const cam = controls.object;
      if (!cam || !cam.isOrthographicCamera) return;
      const ty = controls.target.y;
      const dy = cam.position.y - ty;
      controls.target.set(cx, ty, cz);
      cam.position.set(cx, ty + dy, cz); // 真上から見る（高さ・向きは保つ）
      const size = glRef.current?.getSize?.(new THREE.Vector2());
      const dom = glRef.current?.domElement;
      const cw = size?.x || dom?.clientWidth || 1000;
      const ch = size?.y || dom?.clientHeight || 800;
      const zx = cw / (Math.max(1, width) * pad);
      const zz = ch / (Math.max(1, depth) * pad);
      cam.zoom = Math.max(1e-4, Math.min(zx, zz));
      cam.updateProjectionMatrix();
      controls.update();
    };
    if (glRef.current)    layoutSceneRef.gl    = glRef.current;
    if (sceneRef.current) layoutSceneRef.scene = sceneRef.current;
  }, [active]);

  const baseBoundsRef = useRef(null);
  const didInitCameraRef = useRef(false);
  

  useEffect(() => {
    didInitCameraRef.current = false;
    baseBoundsRef.current = null;
  }, [displayBaseUrl, effectiveType]);

  // 図面グリッドのペインは指定の範囲（部屋ボックス等）にフレーミングする。
  const paneFrameBox = useMemo(() => {
    const fb = paneDrawing?.frameBox;
    if (!fb || !Array.isArray(fb.center) || !(fb.maxDim > 0)) return null;
    return { center: new THREE.Vector3(...fb.center), maxDim: fb.maxDim };
  }, [paneDrawing?.frameBox]);

  const frameCameraToBase = useCallback(
    ({ force = false } = {}) => {
      const b = paneFrameBox || baseBoundsRef.current;
      const controls = orbitRef.current;
      if (!b || !controls) return;
      if (!force && didInitCameraRef.current) return;

      const cam = controls.object;
      if (!cam) return;

      const center = b.center;
      const maxDim = b.maxDim;
      const dir = new THREE.Vector3(1, 0.85, 1).normalize();
      // 初回表示はモデル周囲にしっかり余白ができる距離まで引く（俯瞰で全体を眺める）。
      const dist = Math.max(12, maxDim * 2.4);

      controls.target.copy(center);

      if (effectiveType === VIEW_TYPES.PERSPECTIVE) {
        cam.position.copy(center).addScaledVector(dir, dist);
        cam.near = Math.max(0.01, dist / 200);
        cam.far = Math.max(2000, dist * 50);
        cam.updateProjectionMatrix();
        controls.update();
        didInitCameraRef.current = true;
        return;
      }

      // 高さ設定（断面）中はゆとりをもって全体＋レベル線/ラベルが収まるよう引きで構える。
      const hsActive = useHeightSetupStore.getState().active;
      const orthoDist = Math.max(20, maxDim * (hsActive ? 1.8 : 1.2));
      if (effectiveType === VIEW_TYPES.TOP) {
        // 天井伏図（ceiling_top）は建物の下から見上げる。up は同じ（北=画面上、左右は鏡像）。
        const lookFromBelow = effectiveSubMode === "ceiling_top";
        cam.position.set(center.x, center.y + (lookFromBelow ? -orthoDist : orthoDist), center.z);
        cam.up.set(0, 0, -1);
      } else if (effectiveType === VIEW_TYPES.FRONT) {
        // 向き反転時は背面（−Z）側から見る（断面 A-A' の矢印向きに追従）
        cam.position.set(center.x, center.y, center.z + (sectionViewFlip ? -orthoDist : orthoDist));
        cam.up.set(0, 1, 0);
      } else if (effectiveType === VIEW_TYPES.RIGHT) {
        // 向き反転時は左（−X）側から見る
        cam.position.set(center.x + (sectionViewFlip ? -orthoDist : orthoDist), center.y, center.z);
        cam.up.set(0, 1, 0);
      }

      const frustumW = Math.abs(cam.right - cam.left);
      const frustumH = Math.abs(cam.top - cam.bottom);
      // 高さ設定中は左右にレベル線ラベルが出るため、余白を多めにとる。
      const pad = hsActive ? 1.7 : 1.15;

      // If frustum is ready (not 0), update zoom to frame the object
      if (frustumW > 0 && frustumH > 0 && maxDim > 0) {
        const nextZoom = Math.max(0.01, Math.min(frustumW, frustumH) / (maxDim * pad));
        cam.zoom = nextZoom;
      }

      cam.lookAt(center);
      cam.updateProjectionMatrix();
      controls.update();
      didInitCameraRef.current = true;
    },
    [effectiveType, effectiveSubMode, sectionViewFlip, paneFrameBox]
  );

  const previousEffectiveTypeRef = useRef(effectiveType);
  const previousSectionFlipRef = useRef(sectionViewFlip);
  useEffect(() => {
    if (previousEffectiveTypeRef.current !== effectiveType || previousSectionFlipRef.current !== sectionViewFlip) {
      previousEffectiveTypeRef.current = effectiveType;
      previousSectionFlipRef.current = sectionViewFlip;
      // Reset initialization when switching camera types (or section flip) so it forces framing
      didInitCameraRef.current = false;
      requestAnimationFrame(() => frameCameraToBase({ force: true }));
    }
  }, [effectiveType, sectionViewFlip, frameCameraToBase]);

  // Map / Label モードに入ったら Base を画面中央へフレーミングする。
  // Map: 以降パン/回転をロックして中央固定。Label: 回転の基点を中心(=注視点)に合わせる。
  useEffect(() => {
    if ((isMapMode || isLabelMode) && active) {
      requestAnimationFrame(() => frameCameraToBase({ force: true }));
    }
  }, [isMapMode, isLabelMode, active, frameCameraToBase]);


  // baseColliders = 実躯体メッシュ + 自動床スキャン板 + ラベル由来コリジョン板 を合成。
  // 面ラベルが変わるたびに再構築する（下の effect で購読）。
  const rebuildColliders = useCallback(() => {
    let labelColliders = [];
    try { labelColliders = buildLabelColliders(useStructureLabelStore.getState().labels); } catch { /* noop */ }
    // Union(1ソリッド化)済みなら、実躯体メッシュの代わりに結合メッシュを当たり判定に使う。
    const union = useBaseUnionStore.getState().unionMesh;
    const baseMeshes = union ? [union] : (baseMeshesRef.current || []);
    const colliders = [
      ...baseMeshes,
      ...(scanPlanesRef.current || []),
      ...labelColliders,
    ];
    baseCollidersRef.current = colliders;
    useSceneObjectRegistryStore.getState().setBaseColliders(colliders);
  }, []);

  // 面ラベルの変更（rev）でコリジョンを再構築
  useEffect(() => useStructureLabelStore.subscribe((s, prev) => {
    if (s.rev !== prev.rev) rebuildColliders();
  }), [rebuildColliders]);

  // Union の適用/解除でもコリジョンを再構築
  useEffect(() => useBaseUnionStore.subscribe((s, prev) => {
    if (s.rev !== prev.rev) rebuildColliders();
  }), [rebuildColliders]);

  const handleBaseLoaded = useCallback(
    (payload) => {
      // Base が変わったら Union 結果は破棄（旧 Base 固有・セッション内のみ）
      useBaseUnionStore.getState().clear();

      if (!payload) {
        baseRootRef.current = null;
        baseMeshesRef.current = [];
        scanPlanesRef.current = [];
        baseCollidersRef.current = [];
        useSceneObjectRegistryStore.getState().setBaseColliders([]);
        baseBoundsRef.current = null;
        didInitCameraRef.current = false;
        return;
      }

      // 面ラベルは Base ごとに独立。アクティブ Base を切り替える（別 Base のラベルは出さない）。
      useStructureLabelStore.getState().setActiveBase(displayBaseUrl || null);

      const rootGroup = payload.root || null;
      baseRootRef.current = rootGroup;
      layoutSceneRef.baseRoot = rootGroup; // サムネイルフレーミング用

      const baseMeshes = Array.isArray(payload?.snap?.baseMeshes) ? payload.snap.baseMeshes : [];
      baseMeshesRef.current = baseMeshes;
      // 3Dスキャンで床を自動検出し、不可視コリジョン平面を足す（床メッシュ欠落/法線崩れ対策）。
      let scanPlanes = [];
      try {
        const { planes, levels } = scanFloors({ colliders: baseMeshes });
        scanPlanes = planes;
        if (import.meta?.env?.DEV && planes.length) console.log("[floorScan] detected floor levels:", levels);
      } catch (e) {
        console.warn("[SingleViewportCanvas] floor scan failed", e);
      }
      scanPlanesRef.current = scanPlanes;
      // 実躯体 + スキャン床 + ラベル由来コリジョンを合成して登録
      rebuildColliders();
      // ベースが「実際に」変わったときだけスタートピンを初期化する。
      // （同じベースの再ロード＝ウォークスルー専用画面のマウントでは消さない）
      const baseSig = displayBaseUrl || null;
      if (baseSig !== lastWalkthroughBaseSig) {
        lastWalkthroughBaseSig = baseSig;
        useEditorModeStore.getState().setWalkthroughStartPin(null);
      }

      if (!rootGroup) return;

      const box = new THREE.Box3().setFromObject(rootGroup);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      if (Number.isFinite(maxDim) && maxDim > 0) {
        baseBoundsRef.current = { box, center, size, maxDim };
        requestAnimationFrame(() => frameCameraToBase());
      }
    },
    [frameCameraToBase, displayBaseUrl]
  );

  const normalizedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((it, idx) => ({
      ...it,
      id: it?.id || it?.itemId || it?.modelId || `${it?.modelId || "item"}_${idx}`,
    }));
  }, [items]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return normalizedItems.find((x) => x.id === selectedItemId) || null;
  }, [normalizedItems, selectedItemId]);

  const currentPos = useMemo(() => {
    const p = selectedItem?.transform?.position || [0, 0.3, 0];
    return [p[0] ?? 0, p[1] ?? 0.3, p[2] ?? 0];
  }, [selectedItem]);

  const alignSelectedIds = useMemo(() => {
    const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
    if (ids.length > 0) return ids;
    return selectedItemId ? [selectedItemId] : [];
  }, [selectedItemIds, selectedItemId]);

  const alignSelectedObjects = useMemo(() => {
    const out = [];
    const map = registryMap;
    if (!map) return out;
    for (const id of alignSelectedIds) {
      const obj = map.get(id);
      if (obj) out.push({ itemId: id, object: obj });
    }
    return out;
  }, [alignSelectedIds, registryMap]);

  const stopAlignLocal = useCallback(() => {
    setAlignMode(null);
    clearSnapLocks();
  }, [clearSnapLocks]);

  const endAlign = useCallback(() => {
    stopAlignLocal();
    endAlignSession?.();
  }, [stopAlignLocal, endAlignSession]);

  // ✁EAlignキャンセル用�E�開始時点のTransformスナップショチE��
  const alignSnapshotRef = useRef(null);

  // ✁EAlignキャンセル中�E�Followerを止めるフラグ
  const alignAbortRef = useRef(false);

  const takeAlignSnapshot = useCallback(() => {
    const snap = {};
    const list = Array.isArray(alignSelectedObjects) ? alignSelectedObjects : [];
    for (const it of list) {
      const obj = it?.object;
      if (!obj) continue;
      obj.updateMatrixWorld?.(true);
      snap[it.itemId] = {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      };
    }
    alignSnapshotRef.current = snap;
  }, [alignSelectedObjects]);

  const clearAlignSnapshot = useCallback(() => {
    alignSnapshotRef.current = null;
  }, []);

  const cancelAlign = useCallback(() => {
    alignAbortRef.current = true;

    stopAlignLocal();
    endAlignSession?.();
    cancelHistoryBatch({ kind: "align-cancel" });

    requestAnimationFrame(() => {
      const snap = alignSnapshotRef.current;

      if (!snap) {
        alignAbortRef.current = false;
        return;
      }

      for (const [itemId, t] of Object.entries(snap)) {
        const obj = registryMap?.get(itemId);
        if (!obj) continue;
        obj.position.set(...t.position);
        obj.rotation.set(...t.rotation);
        obj.scale.set(...t.scale);
        obj.updateMatrixWorld?.(true);
      }

      const updates = Object.entries(snap).map(([itemId, t]) => ({
        itemId,
        transform: { position: t.position, rotation: t.rotation, scale: t.scale },
      }));

      if (updates.length > 1 && typeof onChangeTransforms === "function") onChangeTransforms(updates);
      else if (updates.length === 1 && typeof onChangeTransform === "function") onChangeTransform(updates[0]);

      alignSnapshotRef.current = null;
      alignAbortRef.current = false;
    });
  }, [stopAlignLocal, endAlignSession, registryMap, onChangeTransform, onChangeTransforms, cancelHistoryBatch]);

  const commitAlign = useCallback(() => {
    if (!isAlignOwner) return;
    if (!selectedItemId || !selectedObject) return;
    if (!alignMode) return;

    // ✁Eこれが重要E��確定クリチE��した瞬間に follower を止める
    // �E�EetAlignMode(null) は非同期なので、Eフレームでも動くとズレの原因になる！E
    alignAbortRef.current = true;

    // ============================================================
    // ✁EクリチE��時にズレなぁE��ぁE��最終アンカーへ強制確定」してから commit
    // - SmoothAlignFollower ぁEclamp後�E targetAnchor めEsnapFinalAnchorRef に保存してぁE��前提
    // - ここでは damping を無視して“一発確定”させる
    // ============================================================
    const fin = snapFinalAnchorRef.current;
    const axis = fin?.axis;
    const anchor = fin?.anchor;
    const snapOn = !!fin?.snapActive;

    const canForce =
      snapOn &&
      (axis === "x" || axis === "y" || axis === "z") &&
      Number.isFinite(anchor);

    if (canForce) {
      const offsets = alignMode?.itemOffsets || {};
      const baseOff = Number.isFinite(alignMode?.offset) ? alignMode.offset : 0;

      for (const it of alignSelectedObjects) {
        const obj = it?.object;
        if (!obj) continue;

        const off = Number.isFinite(offsets[it.itemId]) ? offsets[it.itemId] : baseOff;
        const pos = anchor + off;

        if (axis === "x") obj.position.x = pos;
        if (axis === "y") obj.position.y = pos;
        if (axis === "z") obj.position.z = pos;

        obj.updateMatrixWorld?.(true);
      }
    } else {
      // snapOff の場合でも最新にしておく
      for (const it of alignSelectedObjects) it?.object?.updateMatrixWorld?.(true);
    }

    // ============================================================
    // ✁EMulti commit
    // ============================================================
    if (alignSelectedObjects.length > 1 && typeof onCommitTransforms === "function") {
      const updates = alignSelectedObjects.map((it) => {
        const obj = it.object;
        return {
          itemId: it.itemId,
          transform: {
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          },
        };
      });

      onCommitTransforms(updates);
      endHistoryBatch({ kind: "align" });
      clearAlignSnapshot();
      endAlign();
      return;
    }

    // ============================================================
    // ✁ESingle commit
    // - 回転/スケールは items の値を保持�E�Elignは移動だけ！E
    // ============================================================
    const p = selectedObject.position;

    onCommitTransform?.({
      itemId: selectedItemId,
      transform: {
        position: [p.x, p.y, p.z],
        rotation: selectedItem?.transform?.rotation,
        scale: selectedItem?.transform?.scale,
      },
    });

    endHistoryBatch({ kind: "align" });
    clearAlignSnapshot();
    endAlign();
    // ✁E次フレームで解除�E�Eommit後�E Align セチE��ョン自体が終わってる�Eで安�E�E�E
    requestAnimationFrame(() => {
      alignAbortRef.current = false;
    });
    
  }, [
    isAlignOwner,
    selectedItemId,
    selectedObject,
    alignMode,
    alignSelectedObjects,
    onCommitTransforms,
    onCommitTransform,
    clearAlignSnapshot,
    endAlign,
    selectedItem?.transform?.rotation,
    selectedItem?.transform?.scale,
    endHistoryBatch,
  ]);



  // ============================================================
  // ✁Ecandidates�E�他オブジェクト�E min/max/center は残す�E�E
  // - Base由来の「�E側bbox」候補�E廁E���E�壁厚・床形状の差で誤誘導するためE��E
  // - 壁�E“�E側/外�E”�E follower の Raycast(法緁E で解決
  // ============================================================
  const buildSnapCandidatesAllAxes = useCallback(() => {
    const out = { x: [], y: [], z: [], walls: { x: [], y: [], z: [] } };

    const pushFromBoxTo = (box, dst) => {
      if (!box || box.isEmpty()) return;
      const center = new THREE.Vector3();
      box.getCenter(center);

      dst.x.push(box.min.x, box.max.x, center.x);
      dst.y.push(box.min.y, box.max.y, center.y);
      dst.z.push(box.min.z, box.max.z, center.z);
    };

    // ✁Ebase は walls bucket へ
    if (baseRootRef.current) {
      const outer = new THREE.Box3().setFromObject(baseRootRef.current);
      pushFromBoxTo(outer, out.walls);
    }

    // ✁E他オブジェクト�E通常 bucket
    const map = objectsRef.current;
    map?.forEach?.((obj, id) => {
      if (!obj) return;
      if (id === selectedItemId) return;
      const b = new THREE.Box3().setFromObject(obj);
      pushFromBoxTo(b, out);
    });

    const uniqAxis = (arr) => {
      const uniq = [];
      const eps = 1e-4;
      for (const v of arr) {
        if (!Number.isFinite(v)) continue;
        if (!uniq.some((u) => Math.abs(u - v) < eps)) uniq.push(v);
      }
      return uniq;
    };

    out.x = uniqAxis(out.x);
    out.y = uniqAxis(out.y);
    out.z = uniqAxis(out.z);

    out.walls.x = uniqAxis(out.walls.x);
    out.walls.y = uniqAxis(out.walls.y);
    out.walls.z = uniqAxis(out.walls.z);

    return out;
  }, [selectedItemId]);



  // ============================================================
  // ✁EAlign: 軸決宁E
  // ============================================================
  const getAxisByKeyForView = useCallback(
    (key) => {
      const isTopLike = type === VIEW_TYPES.TOP || type === VIEW_TYPES.PERSPECTIVE;

      if (isTopLike) {
        if (key === "left" || key === "right" || key === "vcenter") return "x";
        return "z";
      }

      if (type === VIEW_TYPES.FRONT) {
        if (key === "left" || key === "right" || key === "vcenter") return "x";
        return "y";
      }

      if (type === VIEW_TYPES.RIGHT) {
        if (key === "left" || key === "right" || key === "vcenter") return "z";
        return "y";
      }

      return null;
    },
    [type]
  );

  const getAnchorKind = useCallback((key) => {
    if (key === "left" || key === "top") return "min";
    if (key === "right" || key === "bottom") return "max";
    return "center";
  }, []);

  const beginAlignLocal = useCallback(
    (key) => {
      if (!selectedItemId || !selectedObject) return false;

      alignAbortRef.current = false;

      const axis = getAxisByKeyForView(key);
      if (axis !== "x" && axis !== "y" && axis !== "z") return false;

      const anchorKind = getAnchorKind(key);

      selectedObject.updateMatrixWorld?.(true);

      const box = new THREE.Box3().setFromObject(selectedObject);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const p = selectedObject.position;
      const posAxis = axis === "x" ? p.x : axis === "y" ? p.y : p.z;

      const anchorAxis =
        anchorKind === "min"
          ? axis === "x"
            ? box.min.x
            : axis === "y"
              ? box.min.y
              : box.min.z
          : anchorKind === "max"
            ? axis === "x"
              ? box.max.x
              : axis === "y"
                ? box.max.y
                : box.max.z
            : axis === "x"
              ? center.x
              : axis === "y"
                ? center.y
                : center.z;

      const offset = posAxis - anchorAxis;

      let groupBoundsOffsets = null;
      if (alignSelectedObjects.length > 1 && (axis === "x" || axis === "z")) {
        const groupBox = new THREE.Box3();
        for (const it of alignSelectedObjects) {
          const obj = it.object;
          if (!obj) continue;
          obj.updateMatrixWorld?.(true);
          groupBox.union(new THREE.Box3().setFromObject(obj));
        }
        if (!groupBox.isEmpty()) {
          if (axis === "x") {
            groupBoundsOffsets = {
              minX: p.x - groupBox.min.x,
              maxX: p.x - groupBox.max.x,
              minZ: 0,
              maxZ: 0,
            };
          } else {
            groupBoundsOffsets = {
              minX: 0,
              maxX: 0,
              minZ: p.z - groupBox.min.z,
              maxZ: p.z - groupBox.max.z,
            };
          }
        }
      }

      let planeNormal = new THREE.Vector3(0, 1, 0);
      let planeConstant = -groundY;

      if (type === VIEW_TYPES.FRONT) {
        const planeZ = p.z;
        planeNormal = new THREE.Vector3(0, 0, 1);
        planeConstant = -planeZ;
      } else if (type === VIEW_TYPES.RIGHT) {
        const planeX = p.x;
        planeNormal = new THREE.Vector3(1, 0, 0);
        planeConstant = -planeX;
      } else {
        planeNormal = new THREE.Vector3(0, 1, 0);
        planeConstant = -groundY;
      }

      // ✁ESnap reset + candidates set
      clearSnapLocks();

      if (getSnapActive()) {
        const cands = buildSnapCandidatesAllAxes();
        snapEngineRef.current?.setCandidatesAll?.(cands);
        console.log("[snap candidates]", cands);
      } else {
        snapEngineRef.current?.setCandidatesAll?.({ x: [], y: [], z: [] });
      }

      const itemOffsets = {};
      for (const it of alignSelectedObjects) {
        const obj = it.object;
        if (!obj) continue;

        obj.updateMatrixWorld?.(true);
        const box = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const p2 = obj.position;
        const posAxis2 = axis === "x" ? p2.x : axis === "y" ? p2.y : p2.z;
        const anchorAxis2 =
          anchorKind === "min"
            ? axis === "x"
              ? box.min.x
              : axis === "y"
                ? box.min.y
                : box.min.z
            : anchorKind === "max"
              ? axis === "x"
                ? box.max.x
                : axis === "y"
                  ? box.max.y
                  : box.max.z
              : axis === "x"
                ? center.x
                : axis === "y"
                  ? center.y
                  : center.z;

        itemOffsets[it.itemId] = posAxis2 - anchorAxis2;
      }

      takeAlignSnapshot();

      setAlignMode({
        key,
        axis,
        offset,
        planeNormal,
        planeConstant,
        groupBoundsOffsets,
        itemOffsets,
      });

      beginHistoryBatch({ kind: "align" });
      
      return true;
    },
    [
      selectedItemId,
      selectedObject,
      type,
      groundY,
      getAxisByKeyForView,
      getAnchorKind,
      clearSnapLocks,
      getSnapActive,
      buildSnapCandidatesAllAxes,
      alignSelectedObjects,
      takeAlignSnapshot,
      beginHistoryBatch,
    ]
  );

  // ✁EAlignイベント消費�E�owner canvas だけが開始すめE
  const lastAlignTickRef = useRef(0);
  useEffect(() => {
    if (!alignTick || alignTick === lastAlignTickRef.current) return;
    lastAlignTickRef.current = alignTick;

    if (!alignKey) return;
    if (alignOwnerViewportId !== viewportId) return;

    if (materialPicking || isGizmoDragging) {
      endAlignSession?.();
      stopAlignLocal();
      return;
    }

    if (!selectedItemId || !selectedObject) {
      endAlignSession?.();
      stopAlignLocal();
      return;
    }

    beginAlignSession?.({ viewportId });
    setActiveViewportId?.(viewportId);
    if (!active) onActivate?.(viewportId);

    const ok = beginAlignLocal(alignKey);
    if (!ok) {
      endAlignSession?.();
      stopAlignLocal();
    }
  }, [
    alignTick,
    alignKey,
    alignOwnerViewportId,
    viewportId,
    beginAlignSession,
    endAlignSession,
    materialPicking,
    isGizmoDragging,
    active,
    onActivate,
    beginAlignLocal,
    selectedItemId,
    selectedObject,
    stopAlignLocal,
    setActiveViewportId,
  ]);

  const requestCopy = useCallback(() => {
    onRequestCopy?.({ offset: [0.2, 0, 0.2] });
  }, [onRequestCopy]);

  const requestMirror = useCallback(({ axis }) => {
    console.log("[mirror]", axis);
  }, []);

  // ============================================================
  // ✁EregisterViewportApi: 登録は1回だけ。中身はrefで最新匁E
  // ============================================================
  const activeRef = useRef(active);
  const onActivateRef = useRef(onActivate);
  const beginAlignLocalRef = useRef(beginAlignLocal);
  const requestCopyRef = useRef(requestCopy);
  const requestMirrorRef = useRef(requestMirror);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);
  useEffect(() => {
    beginAlignLocalRef.current = beginAlignLocal;
  }, [beginAlignLocal]);
  useEffect(() => {
    requestCopyRef.current = requestCopy;
  }, [requestCopy]);
  useEffect(() => {
    requestMirrorRef.current = requestMirror;
  }, [requestMirror]);

  useEffect(() => {
    if (!registerViewportApi) return;

    const api = {
      align: (key) => {
        if (!activeRef.current) onActivateRef.current?.(viewportId);
        beginAlignLocalRef.current?.(key);
      },
      requestCopy: (...args) => requestCopyRef.current?.(...args),
      requestMirror: (...args) => requestMirrorRef.current?.(...args),
    };

    registerViewportApi(viewportId, api);
    return () => registerViewportApi(viewportId, null);
  }, [registerViewportApi, viewportId]);

  const speedPreset = useMemo(() => {
    const presets = {
      inspect: { move: 300.0, vertical: 300.0 }, // 1.2 -> 50 -> 300
      walk: { move: 1200.0, vertical: 1200.0 }, // 3.0 -> 200 -> 1200
      cycle: { move: 4800.0, vertical: 3600.0 }, // 7.0 -> 800 -> 4800
      drive: { move: 12000.0, vertical: 9000.0 }, // 14.0 -> 2000 -> 12000
      fly: { move: 30000.0, vertical: 18000.0 }, // 28.0 -> 5000 -> 30000
    };
    return presets[speedMode] || presets.walk;
  }, [speedMode]);

  const isOrtho = effectiveType !== VIEW_TYPES.PERSPECTIVE;
  const selectionScope = useSelectionScopeStore((s) => s.scope);
  // 壁/床の作図中は左ドラッグを作図に譲る（範囲選択と競合させない）
  const wallDrawKind = useWallStore((s) => s.drawKind);
  const slabDrawActive = useSlabStore((s) => s.drawActive);
  const marqueeEnabled =
    active &&
    !alignMode &&
    !isGizmoDragging &&
    !gizmoDraggingStore &&
    !materialPicking &&
    !isWalkthrough &&   // ウォークスルー（Preview）中は範囲選択しない（HUDスライダー誤作動防止）
    !isMaterialMode &&  // Material モード中も同様（面選択が主で、アイテム範囲選択は不要）
    !wallDrawKind &&
    !slabDrawActive &&
    canSelectItem(selectionScope);

  // 範囲選択の結果を作図壁・スラブにも適用する（ALL スコープのみ。
  // Item スコープは「家具のみ選択」の約束なので対象外）。
  // Shift+ドラッグは既存選択への追加、それ以外は置換（家具側の流儀に合わせる）。
  const applyStructureMarquee = useCallback((ctx, e) => {
    if (!ctx) return;
    if (useSelectionScopeStore.getState().scope !== "all") return;
    const { wallIds, slabIds } = pickStructureInRect(ctx);
    const additive = !!e?.shiftKey;
    const wallSt = useWallStore.getState();
    const slabSt = useSlabStore.getState();
    wallSt.setSelectedWallIds(
      additive ? [...new Set([...wallSt.selectedWallIds, ...wallIds])] : wallIds
    );
    slabSt.setSelectedSlabIds(
      additive ? [...new Set([...slabSt.selectedSlabIds, ...slabIds])] : slabIds
    );
    // クリック選択と同様、掛かったらプロパティパネルを開く
    if (wallIds.length || slabIds.length) {
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
    }
  }, []);

  const { handlers, marqueeRect, isMarqueeActive, cancel: cancelMarquee } = useMarqueeSelection({
    enabled: marqueeEnabled,
    rootRef,
    orbitRef,
    objectsRef,
    
    getIsBlocked: () => {
      const st = useViewportUiStore.getState?.();
      return !!(
        suppressMarqueePointerIdRef.current != null ||
        st?.gizmoInteracting ||
        st?.gizmoDragging ||
        gizmoDraggingRef.current ||
        isGizmoDragging
      );
    },

    onPickIds: (ids, e, ctx) => {
      if (!active) return;
      applySelectionIds(ids, e, "marquee");
      applyStructureMarquee(ctx, e);
    },
    onPickId: (id, e, ctx) => {
      if (!active) return;
      applySelectionIds(id ? [id] : [], e, "marquee");
      applyStructureMarquee(ctx, e);
    },
  });

  useEffect(() => {
    if (isGizmoDragging || isGizmoUiActiveRef.current || materialPicking) cancelMarquee?.();
  }, [isGizmoDragging, materialPicking, cancelMarquee]);

  const ortho = useMemo(() => (isOrtho ? getOrthoPreset(effectiveType, sectionViewFlip) : null), [isOrtho, effectiveType, sectionViewFlip]);

  const label =
    type === VIEW_TYPES.TOP
      ? "Top"
      : type === VIEW_TYPES.FRONT
        ? "Front"
        : type === VIEW_TYPES.RIGHT
          ? "Right"
          : "Perspective";

  // =========================
  // Numeric apply / Gizmo / etc…
  // =========================
  const readTransformFromObj = useCallback((obj) => {
    if (!obj) return null;
    obj.updateMatrixWorld?.(true);
    return {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
  }, []);

  const getAxisVec = useCallback((axis) => {
    if (axis === "X") return new THREE.Vector3(1, 0, 0);
    if (axis === "Y") return new THREE.Vector3(0, 1, 0);
    if (axis === "Z") return new THREE.Vector3(0, 0, 1);
    return null;
  }, []);

  const getSelectedIds = useCallback(() => {
    const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
    if (ids.length > 0) return ids;
    return selectedItemId ? [selectedItemId] : [];
  }, [selectedItemIds, selectedItemId]);

  const gizmoMultiSnapshotRef = useRef(null);
  const lastStateUpdateTimeRef = useRef(0);

  const emitTransformUpdates = useCallback(
    (updates, { commit = false } = {}) => {
      if (!Array.isArray(updates) || updates.length === 0) return;

      if (updates.length > 1) {
        if (commit) {
          if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          else updates.forEach((u) => onCommitTransform?.(u));
        } else {
          // Optimization: React state is NOT synchronized during dragging (commit=false).
          // TransformGizmo mutates the three.js mesh directly. Doing full React updates
          // per-frame on large layouts causes severe lag.
        }
        return;
      }

      if (commit) {
        onCommitTransform?.(updates[0]);
      } else {
        // Same optimization for single object dragging.
      }
    },
    [onCommitTransform, onCommitTransforms, onChangeTransform, onChangeTransforms]
  );

  const beginGizmoMultiSnapshot = useCallback(() => {
    const ids = getSelectedIds();
    if (ids.length < 2) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    const snapMap = new Map();
    ids.forEach((id) => {
      const obj = objectsRef.current.get(id);
      if (!obj) return;
      snapMap.set(id, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
        scale: obj.scale.clone(),
      });
    });

    if (snapMap.size < 2) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    // Gizmoが実際に掴んでぁE�� selectedObject から基準IDを解決する
    let primaryId = null;
    if (selectedObject) {
      for (const id of ids) {
        const obj = objectsRef.current.get(id);
        if (obj && obj === selectedObject) {
          primaryId = id;
          break;
        }
      }
    }
    if (!primaryId && selectedItemId && snapMap.has(selectedItemId)) {
      primaryId = selectedItemId;
    }
    if (!primaryId) {
      primaryId = snapMap.keys().next().value || null;
    }

    const primaryBase = primaryId ? snapMap.get(primaryId) : null;
    if (!primaryBase) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    gizmoMultiSnapshotRef.current = {
      primaryId,
      mode: gizmoMode,
      map: snapMap,
      primaryBasePos: primaryBase.position.clone(),
      primaryBaseQuat: primaryBase.quaternion.clone(),
      primaryBaseScale: primaryBase.scale.clone(),
    };
  }, [getSelectedIds, selectedItemId, selectedObject, gizmoMode]);

  const applyGizmoMultiDelta = useCallback(
    ({ commit = false } = {}) => {
      const snap = gizmoMultiSnapshotRef.current;
      if (!snap || !snap.map || snap.map.size < 2) return false;

      const primaryObj = objectsRef.current.get(snap.primaryId);
      if (!primaryObj) return false;

      const mode = snap.mode || gizmoMode;

      if (mode === "translate") {
        const delta = primaryObj.position.clone().sub(snap.primaryBasePos);
        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.position.copy(base.position).add(delta);
          obj.updateMatrixWorld?.(true);
        });
      } else if (mode === "rotate") {
        const qDelta = snap.primaryBaseQuat.clone().invert().multiply(primaryObj.quaternion);
        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.quaternion.copy(base.quaternion).multiply(qDelta);
          obj.updateMatrixWorld?.(true);
        });
      } else if (mode === "scale") {
        const ratioX =
          Math.abs(snap.primaryBaseScale.x) > 1e-8 ? primaryObj.scale.x / snap.primaryBaseScale.x : 1;
        const ratioY =
          Math.abs(snap.primaryBaseScale.y) > 1e-8 ? primaryObj.scale.y / snap.primaryBaseScale.y : 1;
        const ratioZ =
          Math.abs(snap.primaryBaseScale.z) > 1e-8 ? primaryObj.scale.z / snap.primaryBaseScale.z : 1;

        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.scale.set(base.scale.x * ratioX, base.scale.y * ratioY, base.scale.z * ratioZ);
          obj.updateMatrixWorld?.(true);
        });
      }

      const updates = [];
      snap.map.forEach((_, id) => {
        const obj = objectsRef.current.get(id);
        const t = readTransformFromObj(obj);
        if (!t) return;
        updates.push({ itemId: id, transform: t });
      });

      emitTransformUpdates(updates, { commit });
      return true;
    },
    [gizmoMode, readTransformFromObj, emitTransformUpdates]
  );

  const handleSelectFurniture = useCallback(
    (id, e) => {
      if (!active) onActivate?.(viewportId);
      if (materialPicking) return;
      // ゾーン選択中は Item を選択しない（1クリック目でゾーン選択解除）
      if (useLayoutTaskStore.getState().activeZoneId) {
        useLayoutTaskStore.getState().setActiveZoneId(null);
        return;
      }
      applySelectionIds(id ? [id] : [], e?.nativeEvent ?? e, "click");
    },
    [active, materialPicking, applySelectionIds, onActivate, viewportId]
  );

  const handleGizmoPreview = useCallback(
    (t) => {
      if (applyGizmoMultiDelta({ commit: false })) return;
      if (!selectedItemId || !t) return;
      // Optimization: React state is NOT synchronized during dragging.
      // onChangeTransform?.({ itemId: selectedItemId, transform: t });
    },
    [applyGizmoMultiDelta, onChangeTransform, selectedItemId]
  );

  const handleGizmoCommit = useCallback(
    (t) => {
      const handledMulti = applyGizmoMultiDelta({ commit: true });
      gizmoMultiSnapshotRef.current = null;
      if (handledMulti) return;
      if (!selectedItemId || !t) return;
      onCommitTransform?.({ itemId: selectedItemId, transform: t });
    },
    [applyGizmoMultiDelta, onCommitTransform, selectedItemId]
  );

  const applyNumericToObjects = useCallback(
    ({ axis, mode, space, raw }) => {
      let s = String(raw ?? "").trim();
      // 全角数字を半角に変換
      s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      // 全角マイナス/ハイフンを半角マイナスに変換
      s = s.replace(/[ー－−-]/g, "-");
      
      const n = Number(s);
      
      console.log("[applyNumericToObjects] Extracted:", { axis, mode, space, raw, parsedNumber: n });
      
      if (!Number.isFinite(n)) return;

      const ids = getSelectedIds();
      if (ids.length === 0) return;

      const targets = ids.map((id) => ({ id, obj: objectsRef.current.get(id) })).filter((x) => !!x.obj);
      if (targets.length === 0) return;

      const ax = getAxisVec(axis);
      const isXYZ = axis === "XYZ";

      if (mode === "translate") {
        if (!ax) return;
        const dist = n / 1000; // MM -> M
        targets.forEach(({ obj }) => {
          const axisWorld = ax.clone();
          const deltaWorld = axisWorld.clone().multiplyScalar(dist);
          
          if (space === "local") {
            const objWorldQuat = new THREE.Quaternion();
            obj.getWorldQuaternion(objWorldQuat);
            deltaWorld.copy(axisWorld).applyQuaternion(objWorldQuat).multiplyScalar(dist);
          }
          
          const parent = obj.parent;
          const parentWorldQuat = new THREE.Quaternion();
          if (parent) parent.getWorldQuaternion(parentWorldQuat);
          else parentWorldQuat.identity();
          
          const deltaLocal = deltaWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
          obj.position.add(deltaLocal);
          obj.updateMatrixWorld?.(true);
        });
      }

      if (mode === "rotate") {
        if (!ax) return;
        const rad = THREE.MathUtils.degToRad(n);
        targets.forEach(({ obj }) => {
          const axisN = ax.clone().normalize();
          if (space === "world") obj.rotateOnWorldAxis(axisN, rad);
          else obj.rotateOnAxis(axisN, rad);
          obj.updateMatrixWorld?.(true);
        });
      }

      if (mode === "scale") {
        const f = n;
        if (!Number.isFinite(f) || f === 0) return;
        targets.forEach(({ obj }) => {
          if (isXYZ) obj.scale.multiplyScalar(f);
          else {
            if (axis === "X") obj.scale.x *= f;
            if (axis === "Y") obj.scale.y *= f;
            if (axis === "Z") obj.scale.z *= f;
          }
        });
      }

      const updates = targets
        .map(({ id, obj }) => {
          const t = readTransformFromObj(obj);
          if (!t) return null;

          let nextT = t;
          if (type === VIEW_TYPES.TOP) {
            nextT = optimizeTopPlacement({
              transform: nextT,
              currentPos,
              lockToGround,
              groundY,
              axisConstraint,
              snapEnabled,
              snapStep,
            });
            obj.position.fromArray(nextT.position);
            obj.rotation.set(...nextT.rotation);
            obj.scale.fromArray(nextT.scale);
          }
          return { itemId: id, transform: nextT };
        })
        .filter(Boolean);

      if (updates.length === 0) return;

      if (updates.length > 1 && typeof onCommitTransforms === "function") onCommitTransforms(updates);
      else onCommitTransform?.(updates[0]);
    },
    [
      getSelectedIds,
      getAxisVec,
      readTransformFromObj,
      type,
      currentPos,
      lockToGround,
      groundY,
      axisConstraint,
      snapEnabled,
      snapStep,
      onCommitTransform,
      onCommitTransforms,
    ]
  );

  const handleNumericOpenFromGizmo = useCallback(
    ({ axis, mode, space }) => {
      // ギズモの軸クリックで開く数値入力ボックス（"TRANSLATE XYZ / world（例: 300）"）は
      // 不要との要望により無効化。ギズモのドラッグ移動はそのまま使える。
      return;
      // eslint-disable-next-line no-unreachable
      isGizmoUiActiveRef.current = !!axis;

      onRequestNumericOpen?.({
        axis,
        mode,
        space,
        autoFocus: true,

        applyNumeric: ({ axis: a, raw }) => {
          // ✁ENumeric も、E操作＝Undo1回、E
          beginHistoryBatch({ kind: "numeric", mode: mode || gizmoMode });
          // ✁E数値入力も、E操作」として扱ぁE��Eulti snapshot / marquee抑止�E�E
          // 1) suppress + marquee cancel
          suppressMarqueePointerIdRef.current = "gizmo";
          cancelMarquee?.();

          // 2) multi snapshot begin�E�褁E��選択時だけ有効�E�E
          beginGizmoMultiSnapshot();

          // 3) apply
          applyNumericToObjects({
            axis: a || axis,
            mode: mode || gizmoMode,
            space: space || gizmoSpace,
            raw,
          });

          // 4) snapshot end
          gizmoMultiSnapshotRef.current = null;

          endHistoryBatch({ kind: "numeric", mode: mode || gizmoMode });

          // ✁Enumeric入力直後に抑止を即解除すると、直後�EクリチE��で marquee が誤作動しやすいので
          // 1フレーム遁E��せて解除
          requestAnimationFrame(() => {
            if (suppressMarqueePointerIdRef.current === "gizmo") {
              suppressMarqueePointerIdRef.current = null;
            }
          });
        },
      });

      // Hover直後に即入力できるよう、CommandBarへフォーカスを強制
      try {
        const api = useViewportUiStore.getState?.().toolbarApi;
        api?.focusCommand?.({ select: true });
        queueMicrotask(() => api?.focusCommand?.({ select: true }));
        requestAnimationFrame(() => api?.focusCommand?.({ select: true }));
      } catch {}
    },
    [
      onRequestNumericOpen,
      applyNumericToObjects,
      gizmoMode,
      gizmoSpace,
      beginGizmoMultiSnapshot,
      cancelMarquee,
      beginHistoryBatch,
      endHistoryBatch,
    ]
  );

  const handleNumericCloseFromGizmo = useCallback(() => {
    isGizmoUiActiveRef.current = false;
    onRequestNumericClose?.();

    // Gizmoのnumeric終亁E���E入力フォーカスを外し、WASDQE系のNavを復帰させめE
    try {
      useViewportUiStore.getState?.().blurCommandBar?.();
    } catch {}
  }, [onRequestNumericClose]);

  // ✁EESC でコマンドキャンセル�E�Elign / Gizmo UI / Marquee / RMB nav�E�E
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (alignMode || (alignPhase && alignPhase !== "idle")) {
        e.preventDefault();
        e.stopPropagation();
        cancelAlign();
        return;
      }

      if (isGizmoUiActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();
        handleNumericCloseFromGizmo?.();
        return;
      }

      if (isMarqueeActive) {
        e.preventDefault();
        e.stopPropagation();
        cancelMarquee?.();
        return;
      }

      if (rmbRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setRmb(false);
        return;
      }

      const activeZoneId = useLayoutTaskStore.getState().activeZoneId;
      if (selectedItemIds.length > 0 || activeZoneId) {
        e.preventDefault();
        e.stopPropagation();
        clearSelection();
        useLayoutTaskStore.getState().setActiveZoneId(null);
        return;
      }

      // ここまでで何も消すものが無ければ、図面注記（通り芯・寸法列・断面線）の
      // 選択とパネルを畳む。作図中の Esc は各コントローラが先に処理する。
      {
        const gx = useGridAxisStore.getState();
        const dc = useDimChainStore.getState();
        const sl = useSectionLinesStore.getState();
        const had = gx.selectedId || gx.panelOpen || dc.panelOpen || sl.activeLineId;
        if (had) {
          e.preventDefault();
          e.stopPropagation();
          if (gx.selectedId || gx.panelOpen) { gx.setSelectedId(null); gx.setPanelOpen(false); }
          if (dc.panelOpen) dc.setPanelOpen(false);
          if (sl.activeLineId) sl.setActiveLine(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    active,
    alignMode,
    alignPhase,
    handleNumericCloseFromGizmo,
    isMarqueeActive,
    cancelMarquee,
    setRmb,
    cancelAlign,
    selectedItemIds,
    clearSelection,
  ]);

  useEffect(() => {
    isGizmoUiActiveRef.current = false;
  }, [numericCloseTick]);

  const showGizmoSafe = showGizmo && !alignMode && !materialPicking && !isWalkthrough;
  const allowDropSafe = allowDrop && !materialPicking;
  const pointerMissedEnabled = !materialPicking;

  // Track right-click position to distinguish between click and drag
  const rightClickStartRef = useRef(null);

  // ✁EAlign用E最後EガイチEドット表示位置Eワールド座標！E
  const snapDotRef = useRef(null);
  const snapGuideValueRef = useRef(null);

  // ✁EAlign用E最後Eマウス位置EEDCEE
  const lastAlignNdcRef = useRef({ x: 0, y: 0, t: 0 });

  // 展開図ビューのラベル（「展開A ・ LDK」= どの部屋のどの面か）
  const elevChipOn = useElevationMarkerStore((s) => s.viewActive);
  const elevChipDir = useElevationMarkerStore((s) => s.activeDir);
  const elevChipRoom = useElevationMarkerStore((s) => s.roomName);
  // 断面図ビューのラベル用: 表示中の断面ライン名（"A-A'" など）とその軸。
  // 軸も見るのは、別経路（保存ビュー等）で断面を開いたときに古い選択が残っていても
  // 食い違った名前を出さないため（不一致なら総称の「断面」にフォールバックする）。
  // どちらもプリミティブを返すセレクタにして getSnapshot 警告を避ける。
  const activeSectionName = useSectionLinesStore(
    (s) => s.lines.find((l) => l.id === s.activeLineId)?.name || null
  );
  const activeSectionAxis = useSectionLinesStore(
    (s) => s.lines.find((l) => l.id === s.activeLineId)?.axis || null
  );
  // 手動寸法（ヘッダー「寸法」ツール）の viewKey 用: どのビューで作図した寸法かを一意にする。
  const manualDimFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const manualDimSectionId = useSectionLinesStore((s) => s.activeLineId);
  const manualDimElevationId = useRoomElevationsStore((s) => s.activeElevationId);

  const chipLabel = useMemo(() => {
    let label = String(type).charAt(0).toUpperCase() + String(type).slice(1);
    // ウォークスルー専用画面ではビュー名を "Walkthrough" と表示する
    if (isWalkthrough) return "Walkthrough";
    // 図面グリッドのペインは、そのペインが何の図面かを名乗る（例「2D / 断面 A-A'」）。
    // グリッドのペインは furniture_iso 扱いなので、これが無いと下の分岐で
    // 「Layout / Perspective」になってしまう。
    if (paneDrawing?.label) return `2D / ${paneDrawing.label}`;
    // 展開図: 何の部屋のどの面かを明示（部屋名はマーカーが入っているゾーン名）
    if (elevChipOn && (type === VIEW_TYPES.FRONT || type === VIEW_TYPES.RIGHT)) {
      return `2D / 展開 ${elevChipDir || ""}${elevChipRoom ? ` ・ ${elevChipRoom}` : ""}`;
    }
    // 2D 図面の単体ビュー（正射の側面＝立面図/断面図）は、図面グリッドのペインと同じ
    // 「2D / ◯◯」形式で何の図面かを名乗る。これが無いと下の分岐で
    // 「Layout / Perspective」になってしまう。
    //   断面 = クリップON（高さ断面ではない）/ 立面 = クリップOFF（建物の外形）
    if (effectiveType === VIEW_TYPES.FRONT || effectiveType === VIEW_TYPES.RIGHT) {
      const viewAxis = effectiveType === VIEW_TYPES.FRONT ? "z" : "x";
      const isSectionView = sectionClipEnabledForLight && !sectionClipYEnabledForLight;
      if (isSectionView) {
        // 断面ラインから開いていて軸も一致していれば名前を出す（それ以外は総称）。
        return activeSectionName && activeSectionAxis === viewAxis
          ? `2D / 断面 ${activeSectionName}`
          : "2D / 断面";
      }
      // 立面: 平面(TOP)の上=−Z=北 の約束に合わせる
      //   FRONT(z軸): flip=北(−Z) / 通常=南(+Z)　RIGHT(x軸): 通常=東(+X) / flip=西(−X)
      const dir = effectiveType === VIEW_TYPES.FRONT
        ? (sectionViewFlip ? "北" : "南")
        : (sectionViewFlip ? "西" : "東");
      return `2D / 立面 ${dir}`;
    }
    if (editorMode === "layout" || editorMode === "zoning") {
      if (effectiveSubMode === "furniture_top") label = "Layout / Top";
      else if (effectiveSubMode === "furniture_iso") label = "Layout / Perspective";
      else if (effectiveSubMode === "zone_2d") label = "2D Plan";
    }
    if (materialPicking) return `${label} • Material Pick`;


    if (isAlignOwner && alignMode) {
      const ax = String(alignMode.axis || "").toLowerCase();
      const shown = lastSnapUiRef.current?.[ax] ?? null;
      const txt =
        Number.isFinite(shown)
          ? ` • Snap ${ax.toUpperCase()}=${shown.toFixed(3)}`
          : getSnapActive?.()
            ? " • Snap ON"
            : "";

      return `${label} • Align (${alignMode.key})${txt}`;
    }

    return label;
  }, [materialPicking, type, isAlignOwner, alignMode, getSnapActive, editorMode, overrideSubMode, globalLayoutSubMode, overrideRotOffset, isWalkthrough, elevChipOn, elevChipDir, elevChipRoom, paneDrawing?.label,
      effectiveType, sectionClipEnabledForLight, sectionClipYEnabledForLight, sectionViewFlip, activeSectionName, activeSectionAxis]);

  // ✁EAlign中に Snap ON/OFF がEり替わったら candidates をE構篁E
  useEffect(() => {
    if (!alignMode) return;

    const activeNow = getSnapActive();
    clearSnapLocks();

    if (activeNow) {
      const cands = buildSnapCandidatesAllAxes();
      snapEngineRef.current?.setCandidatesAll?.(cands);
    } else {
      snapEngineRef.current?.setCandidatesAll?.({ x: [], y: [], z: [] });
    }
  }, [
    alignMode?.key,
    alignMode?.axis,
    snapEnabled,
    shiftSnap,
    getSnapActive,
    clearSnapLocks,
    buildSnapCandidatesAllAxes,
  ]);

  // ✁EAlign用E確定用の最終アンカー
  const snapFinalAnchorRef = useRef({ axis: null, anchor: null, snapActive: false, t: 0 });

  // ✁EAlign 中だぁEOrbitControls を制御EEizmoはTransformGizmoに一本化！E
  const savedMouseButtonsRef = useRef(null);

  useEffect(() => {
    const c = orbitRef.current;
    if (!c) return;

    if (!savedMouseButtonsRef.current) {
      savedMouseButtonsRef.current = { ...c.mouseButtons };
    }

    const alignActive = !!alignMode;
    const shouldKillLeft = type === VIEW_TYPES.PERSPECTIVE && alignActive;

    if (shouldKillLeft) {
      c.enableRotate = false;
      c.enableZoom = true;
      c.enablePan = true;
    } else {
      const saved = savedMouseButtonsRef.current;
      if (saved) c.mouseButtons = { ...saved };
      c.enableRotate = (type === VIEW_TYPES.PERSPECTIVE);
    }

    c.update?.();
  }, [type, alignMode]);

  useEffect(() => {
    if (!isGizmoDragging) return;

    // ✁Epending が残ってぁE��も強制キャンセル
    cancelMarquee?.();

    // suppressも確実に立てめE
    suppressMarqueePointerIdRef.current = "gizmo";
  }, [isGizmoDragging, cancelMarquee]);





return (
  <Box
    className="ViewportCanvasRoot"
    ref={rootRef}
    sx={{
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      border: active
        ? `1px solid ${alpha(theme.palette.primary.main, 0.65)}`
        : `1px solid ${alpha("#fff", 0.08)}`,
      background: alpha("#050815", 0.55),
      userSelect: "none",
    }}
    onPointerDownCapture={(e) => {
      if (e.button === 2) {
        rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      }
      setTimeout(() => setActiveViewportId?.(viewportId), 0);
      setTimeout(() => onActivate?.(viewportId), 0);
      // if (e.button === 2) setRmb(true); // Removed to prevent interrupting native pointerdown

      // Gizmo操作に入った�Eインタでは marquee を開始させなぁE
      if (e.button === 0) {
        const st = useViewportUiStore.getState?.();
        if (st?.gizmoInteracting || st?.gizmoDragging) {
          suppressMarqueePointerIdRef.current = e.pointerId ?? "gizmo";
        }
      }
    }}

    onContextMenu={(e) => {
      e.preventDefault();
      
      const start = rightClickStartRef.current;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          return; // It was a drag (e.g. panning), do not rotate
        }
      }

      const ids = getSelectedIds();
      if (ids.length > 0) {
        e.stopPropagation();
        
        let deg = 15;
        if (e.ctrlKey) deg = 90;
        if (!e.shiftKey) deg = -deg; // default is right rotation (clockwise -> negative Y)

        beginHistoryBatch({ kind: 'numeric', mode: 'rotate' });
        beginGizmoMultiSnapshot();
        
        applyNumericToObjects({
          axis: 'Y',
          mode: 'rotate',
          space: 'world',
          raw: deg,
        });
        
        gizmoMultiSnapshotRef.current = null;
        endHistoryBatch({ kind: 'numeric', mode: 'rotate' });
      }
    }}

    onPointerDown={(e) => {
      if (materialPicking) return;
      if (!marqueeEnabled) return;
      if (suppressMarqueePointerIdRef.current != null) return;

      // ✁Ehook側の getIsBlocked ぁEtrue なめEpending すら作られなぁE
      handlers?.onPointerDown?.(e);
    }}

    onPointerMove={(e) => {
      if (materialPicking) return;
      if (!marqueeEnabled) return;

      handlers?.onPointerMove?.(e);
    }}

    onPointerUp={(e) => {
      // if (e.button === 2) setRmb(false);
      if (materialPicking) return;
      if (!marqueeEnabled) return;

      handlers?.onPointerUp?.(e);
    }}

    onPointerCancel={(e) => {
      handlers?.onPointerCancel?.(e);
    }}

    onPointerLeave={() => {
      // ✁Eleave 時�E cancel�E�Eindow追跡がある�Eで無くてもいぁE��ど保険�E�E
      if (marqueeEnabled && isMarqueeActive) cancelMarquee?.();
    }}

    onDragOver={(e) => allowDropSafe && onCanvasDragOver?.(e)}
    onDrop={(e) => allowDropSafe && onCanvasDrop?.(e)}
  >
    {marqueeEnabled && marqueeRect && (
      <Box
        sx={{
          position: "absolute",
          left: marqueeRect.x,
          top: marqueeRect.y,
          width: marqueeRect.w,
          height: marqueeRect.h,
          zIndex: 20,
          pointerEvents: "none",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.9)}`,
          background: alpha(theme.palette.primary.main, 0.12),
          boxShadow: `0 0 0 1px ${alpha("#000", 0.35)} inset`,
        }}
      />
    )}

    {/* Layout / Perspective：ウォークスルー入口 ＋ カメラのレンズ長スライダー（右上） */}
    {active && effectiveType === VIEW_TYPES.PERSPECTIVE && !isWalkthrough && !isMaterialMode && (
      <Box
        onPointerDown={(e) => e.stopPropagation()}
        sx={{
          position: "absolute", top: 12, right: 12, zIndex: 30,
          display: "flex", alignItems: "center", gap: 0.75,
        }}
      >
        {/* 編集中のクイック確認用ウォークスルー（客先向けはトップバーの「プレビュー」） */}
        <Box
          onClick={enterWalkthroughMode}
          title="ウォークスルー（編集中のクイック確認）"
          sx={{
            display: "flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.55, borderRadius: 1.5,
            cursor: "pointer", color: alpha("#fff", 0.85), fontSize: "0.72rem", fontWeight: 700,
            userSelect: "none",
            background: alpha("#050815", 0.72), backdropFilter: "blur(8px)",
            border: `1px solid ${alpha("#fff", 0.1)}`,
            "&:hover": { background: alpha("#1a2540", 0.85), color: "#fff" },
          }}
        >
          <DirectionsWalkRoundedIcon sx={{ fontSize: 15 }} />
          ウォークスルー
        </Box>
        <Box
          title="カメラのレンズ長（焦点距離）"
          sx={{
            display: "flex", alignItems: "center", gap: 0.9, px: 1.1, py: 0.5, borderRadius: 1.5,
            background: alpha("#050815", 0.72), backdropFilter: "blur(8px)",
            border: `1px solid ${alpha("#fff", 0.1)}`,
          }}
        >
          <CameraRoundedIcon sx={{ color: alpha("#fff", 0.7), fontSize: 15 }} />
          <Slider
            size="small"
            value={envFocalLength}
            min={15}
            max={135}
            step={1}
            onChange={(_, v) => setEnvFocalLength(Array.isArray(v) ? v[0] : v)}
            sx={{ width: 96, color: "#4f8cff", "& .MuiSlider-thumb": { width: 12, height: 12 }, "& .MuiSlider-rail": { opacity: 0.3 } }}
          />
          <Typography sx={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap", minWidth: 34, textAlign: "right" }}>
            {envFocalLength}mm
          </Typography>
        </Box>
      </Box>
    )}

    {/* Material モード（俯瞰）：展開図ピンを追加（複数配置可。各ピンのバッジから一人称へ） */}
    {active && isMaterialMode && effectiveType === VIEW_TYPES.PERSPECTIVE && !materialFirstPerson && (
      <Box
        onClick={() => addMaterialPinAtRoom()}
        sx={{
          // 上部中央は EditorAngleBar（全体/内観タブ）が占有するため右上に置く
          position: "absolute", top: 12, right: 12, zIndex: 30,
          display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.75, borderRadius: 999,
          cursor: "pointer", color: "#fff", fontSize: 12.5, fontWeight: 700, userSelect: "none",
          background: "rgba(236,64,122,0.9)", border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.4)", "&:hover": { filter: "brightness(1.08)" },
        }}
      >
        ＋ 見渡しピンを配置（部屋ごとに置けます）
      </Box>
    )}
    {active && isMaterialLook && (
      <>
        {/* 中央クロスヘア */}
        <Box sx={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 18, height: 18, zIndex: 30, pointerEvents: "none",
        }}>
          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", border: "1.5px solid #fff", boxShadow: "0 0 2px rgba(0,0,0,0.7)" }} />
        </Box>
        {/* 退出 + 操作ヒント + レンズ長（上部にまとめて常時表示） */}
        <Box sx={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              onClick={() => exitMaterialFirstPerson()}
              sx={{
                display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.6, borderRadius: 999,
                cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, userSelect: "none",
                background: "rgba(8,12,22,0.9)", border: "1px solid rgba(255,255,255,0.3)",
                "&:hover": { background: "rgba(8,12,22,1)" },
              }}
            >
              ← 俯瞰に戻る
            </Box>
            <Box sx={{ px: 1.25, py: 0.6, borderRadius: 999, color: "rgba(255,255,255,0.85)", fontSize: 11, background: "rgba(8,12,22,0.7)", border: "1px solid rgba(255,255,255,0.15)", pointerEvents: "none" }}>
              右ドラッグ＝見回す／矢印←→＝90°回転／左クリック＝中央の面を選択
            </Box>
          </Box>
          {/* レンズ長コントロール（既定18mm。広角ほど見渡しやすい） */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.5, borderRadius: 999,
            background: "rgba(8,12,22,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
          }}>
            <Box component="span" sx={{ fontSize: 11, opacity: 0.7 }}>レンズ長</Box>
            <Box onClick={() => setMaterialLensMm(materialLensMm - 2)}
              sx={{ cursor: "pointer", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", "&:hover": { background: "rgba(255,255,255,0.2)" } }}>−</Box>
            <Box component="input" type="range" min={8} max={50} step={1}
              value={materialLensMm}
              onChange={(e) => setMaterialLensMm(Number(e.target.value))}
              sx={{ width: 150, accentColor: "#ec407a", cursor: "pointer" }}
            />
            <Box onClick={() => setMaterialLensMm(materialLensMm + 2)}
              sx={{ cursor: "pointer", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", "&:hover": { background: "rgba(255,255,255,0.2)" } }}>＋</Box>
            <Box component="span" sx={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: "right" }}>{materialLensMm}mm</Box>
          </Box>
        </Box>
      </>
    )}

    {active && isWalkthrough && (
      <>
        {/* ミニマップ（右上） */}
        <WalkthroughMinimap />

        {/* 操作ボタンのホバーで開く下部ギャラリー */}
        <WalkthroughGalleryBar />

        {/* クロスヘア（一人称のみ）。ギミックにポイント時は強調 */}
        {walkthroughViewMode === "first" && (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: gimmickHoverLabel ? 10 : 6,
              height: gimmickHoverLabel ? 10 : 6,
              borderRadius: "50%",
              border: `1px solid ${gimmickHoverLabel ? "#4f8cff" : alpha("#fff", 0.9)}`,
              boxShadow: `0 0 2px ${alpha("#000", 0.6)}`,
              transition: "all 0.1s",
              zIndex: 30,
              pointerEvents: "none",
            }}
          />
        )}

        {/* ホバーヒント / クリック後の操作・情報ボタン群は、アイテム頭上に
            3D アンカーで表示する（WalkthroughItemInfoBadge）。
            クリックでフォーカスし、ふわっとアニメーションでボタンが現れる。
            一人称・三人称・フライ 共通。 */}

        {/* インフォメーション フローティングパネル（右側にドック・モーダルなし） */}
        {infoOpenId && infoOpenEntry && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              // ミニマップを閉じている分、上方向（ミニマップがあった位置）まで拡張する。
              position: "absolute",
              top: 52,
              right: 10,
              bottom: 44,
              width: 332,
              maxWidth: "calc(100% - 20px)",
              zIndex: 41,
              display: "flex",
              flexDirection: "column",
              p: 1.75,
              borderRadius: 2,
              background: alpha("#0b1020", 0.94),
              border: `1px solid ${alpha("#38bdf8", 0.45)}`,
              boxShadow: `0 12px 36px ${alpha("#000", 0.5)}`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              pointerEvents: "auto",
              animation: "wtPanelIn 0.28s cubic-bezier(0.22,1,0.36,1)",
              "@keyframes wtPanelIn": {
                "0%": { opacity: 0, transform: "translateX(16px) scale(0.97)" },
                "100%": { opacity: 1, transform: "translateX(0) scale(1)" },
              },
            }}
          >
            {(() => {
              const openUrl = (raw) => {
                let u = raw;
                if (!/^https?:\/\//.test(u)) u = "https://" + u;
                openExternalUrl(u);
              };
              const hostOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : "https://" + u).host; } catch { return ""; } };
              const faviconOf = (u) => { const h = hostOf(u); return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=128` : null; };
              const cl = Array.isArray(infoOpenEntry.catalogLinks) ? infoOpenEntry.catalogLinks.filter((l) => l && l.url) : [];
              const rl = Array.isArray(infoOpenEntry.links) ? infoOpenEntry.links.filter((l) => l && l.url) : [];
              const hasSimilar = cl.length > 0 || !!infoOpenEntry.model;
              const hasLinks = rl.length > 0 || !!infoOpenEntry.model;
              const tabs = [{ key: "info", label: "情報", icon: <InfoOutlinedIcon sx={{ fontSize: 14 }} /> }];
              if (hasSimilar) tabs.push({ key: "similar", label: "似た商品", icon: <StorefrontRoundedIcon sx={{ fontSize: 14 }} /> });
              if (hasLinks) tabs.push({ key: "links", label: "リンク", icon: <ImageSearchRoundedIcon sx={{ fontSize: 14 }} /> });
              const tab = tabs.some((t) => t.key === infoTab) ? infoTab : "info";
              // このアイテムに属する照合結果のみ表示。
              const matches = (catForItemId && infoOpenId && String(catForItemId) === String(infoOpenId)) ? catMatches : [];
              const accent = tab === "similar" ? "#86efac" : tab === "links" ? "#38bdf8" : "#38bdf8";

              return (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <InfoOutlinedIcon sx={{ color: accent, fontSize: 18 }} />
                    <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "0.9rem", flex: 1 }} noWrap>
                      {infoOpenEntry.title}
                    </Typography>
                    <Box onClick={() => closeInfo(null)} sx={{ cursor: "pointer", color: alpha("#fff", 0.6), fontSize: 18, lineHeight: 1, "&:hover": { color: "#fff" } }}>✕</Box>
                  </Box>

                  {/* 上部の切替タブ（情報 / 似た商品 / リンク） */}
                  {tabs.length > 1 && (
                    <Box sx={{ display: "flex", gap: 0.5, mb: 1.25, p: 0.4, borderRadius: 999, background: alpha("#fff", 0.05) }}>
                      {tabs.map((t) => (
                        <Box
                          key={t.key}
                          onClick={() => setInfoTab(t.key)}
                          sx={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4,
                            py: 0.5, borderRadius: 999, cursor: "pointer", fontSize: "0.72rem", fontWeight: 800,
                            color: tab === t.key ? "#fff" : alpha("#fff", 0.55),
                            background: tab === t.key ? alpha(accent, 0.28) : "transparent",
                            transition: "background 0.15s, color 0.15s",
                            "&:hover": { color: "#fff" },
                          }}
                        >
                          {t.icon}{t.label}
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                    {/* ── 情報タブ ── */}
                    {tab === "info" && (
                      <>
                        {infoOpenEntry.thumbUrl && (
                          <Box sx={{ width: "100%", height: 170, mb: 1.5, borderRadius: 1.5, overflow: "hidden", background: alpha("#000", 0.35), border: `1px solid ${alpha("#fff", 0.08)}`, backgroundImage: `url(${infoOpenEntry.thumbUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
                        )}
                        {(infoOpenEntry.categoryPath || infoOpenEntry.dimsLabel || infoOpenEntry.priceLabel) && (
                          <Box sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", color: alpha("#fff", 0.55), textTransform: "uppercase", mb: 0.5 }}>仕様</Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                              {[["カテゴリ", infoOpenEntry.categoryPath], ["寸法", infoOpenEntry.dimsLabel], ["価格", infoOpenEntry.priceLabel]]
                                .filter(([, v]) => v)
                                .map(([k, v]) => (
                                  <Box key={k} sx={{ display: "flex", gap: 1 }}>
                                    <Typography sx={{ fontSize: "0.72rem", color: alpha("#fff", 0.5), width: 44, flexShrink: 0 }}>{k}</Typography>
                                    <Typography sx={{ fontSize: "0.72rem", color: alpha("#fff", 0.9), fontWeight: 600, wordBreak: "break-all" }}>{v}</Typography>
                                  </Box>
                                ))}
                            </Box>
                          </Box>
                        )}
                        {Array.isArray(infoOpenEntry.materials) && infoOpenEntry.materials.length > 0 && (
                          <Box sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", color: alpha("#fff", 0.55), textTransform: "uppercase", mb: 0.5 }}>素材</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {infoOpenEntry.materials.map((m) => (
                                <Box key={m} sx={{ px: 0.85, py: 0.2, borderRadius: 999, fontSize: "0.68rem", color: alpha("#fff", 0.85), background: alpha("#fff", 0.08) }}>{m}</Box>
                              ))}
                            </Box>
                          </Box>
                        )}
                        {Array.isArray(infoOpenEntry.tags) && infoOpenEntry.tags.length > 0 && (
                          <Box sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", color: alpha("#fff", 0.55), textTransform: "uppercase", mb: 0.5 }}>タグ</Typography>
                            <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 0.5, overflow: "hidden", maskImage: "linear-gradient(to right, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to right, #000 88%, transparent)" }}>
                              {infoOpenEntry.tags.map((t) => (
                                <Box key={t} sx={{ flexShrink: 0, px: 0.85, py: 0.2, borderRadius: 999, fontSize: "0.68rem", color: alpha("#bae6fd", 0.95), background: alpha("#38bdf8", 0.12), border: `1px solid ${alpha("#38bdf8", 0.3)}` }}>{t}</Box>
                              ))}
                            </Box>
                          </Box>
                        )}
                        {infoOpenEntry.description && (
                          <Typography sx={{ color: alpha("#fff", 0.85), fontSize: "0.8rem", whiteSpace: "pre-wrap", mb: 1.5 }}>
                            {infoOpenEntry.description}
                          </Typography>
                        )}
                      </>
                    )}

                    {/* ── 似た商品タブ（置換候補／カタログで探す ＋ 登録済みカタログ） ── */}
                    {tab === "similar" && (
                      <>
                        {/* 置換中のときは元に戻すボタン */}
                        {activeOverride && (
                          <Box
                            onClick={() => clearReplaceOverride(String(infoOpenId))}
                            sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mb: 1, px: 1.25, py: 0.6, borderRadius: 1.5, cursor: "pointer", fontSize: "0.74rem", fontWeight: 700, color: "#fff", background: alpha("#fff", 0.08), border: `1px solid ${alpha("#fff", 0.2)}`, "&:hover": { background: alpha("#fff", 0.14) } }}
                          >
                            <ReplayRoundedIcon sx={{ fontSize: 15 }} /> 元のモデルに戻す
                          </Box>
                        )}

                        {/* 置換候補（CLIP類似検索の結果） */}
                        {replaceSearchItemId && String(replaceSearchItemId) === String(infoOpenId) && (replaceSearchBusy || replaceCandidates.length > 0 || replaceSearchError) && (
                          <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.5, background: alpha("#7c4dff", 0.1), border: `1px solid ${alpha("#7c4dff", 0.35)}` }}>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 0.75 }}>
                              <Typography sx={{ flex: 1, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.04em", color: alpha("#c4b5fd", 0.95), textTransform: "uppercase" }}>置換候補（似た家具）</Typography>
                              <Box onClick={() => clearReplaceSearch()} sx={{ cursor: "pointer", color: alpha("#fff", 0.6), fontSize: 14, "&:hover": { color: "#fff" } }}>✕</Box>
                            </Box>
                            {replaceSearchBusy && (
                              <Box sx={{ position: "relative", width: "100%", height: 4, borderRadius: 2, background: alpha("#fff", 0.16), overflow: "hidden", "&::after": { content: '""', position: "absolute", top: 0, height: "100%", width: "45%", borderRadius: 2, background: "#7c4dff", animation: "wtLoadBar 1.05s ease-in-out infinite" }, "@keyframes wtLoadBar": { "0%": { left: "-45%" }, "100%": { left: "100%" } } }} />
                            )}
                            {replaceSearchError && !replaceSearchBusy && (
                              <Typography sx={{ fontSize: "0.7rem", color: "#fca5a5" }}>{replaceSearchError}</Typography>
                            )}
                            {replaceCandidates.length > 0 && (
                              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0.75 }}>
                                {replaceCandidates.map((c) => (
                                  <Box key={c.id} onClick={() => { setReplaceOverride(String(infoOpenId), { id: c.id, glbUrl: c.glbUrl, title: c.title, thumbUrl: c.thumbUrl, dimensions: c.dimensions }); clearReplaceSearch(); }}
                                    sx={{ borderRadius: 1, overflow: "hidden", cursor: "pointer", background: alpha("#000", 0.4), border: `1px solid ${alpha("#7c4dff", 0.4)}`, "&:hover": { borderColor: "#7c4dff", transform: "translateY(-2px)" }, transition: "transform 0.12s, border-color 0.12s" }}>
                                    <Box sx={{ position: "relative", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {c.thumbUrl
                                        ? <Box component="img" src={c.thumbUrl} alt={c.title} referrerPolicy="no-referrer" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                        : <SwapHorizRoundedIcon sx={{ fontSize: 22, color: alpha("#c4b5fd", 0.6) }} />}
                                      <Box sx={{ position: "absolute", top: 2, left: 2, px: 0.4, borderRadius: 0.5, fontSize: "0.54rem", fontWeight: 800, color: "#fff", background: alpha("#7c4dff", 0.9) }}>{Math.round((c.similarity || 0) * 100)}%</Box>
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        )}

                        {infoOpenEntry.model && (
                          <Box
                            onClick={() => { if (!catBusy) runCatalogSearch(String(infoOpenId), infoOpenEntry.model); }}
                            sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mb: 1.25, px: 1.5, py: 0.85, borderRadius: 1.5, cursor: catBusy ? "default" : "pointer", color: "#062", fontWeight: 800, fontSize: "0.8rem", background: `linear-gradient(180deg, ${alpha("#86efac", 0.95)} 0%, ${alpha("#4ade80", 0.92)} 100%)`, border: `1px solid ${alpha("#86efac", 0.7)}`, opacity: catBusy ? 0.7 : 1, transition: "filter 0.15s, transform 0.12s", "&:hover": { filter: catBusy ? "none" : "brightness(1.05)", transform: catBusy ? "none" : "translateY(-1px)" } }}
                          >
                            <SearchRoundedIcon sx={{ fontSize: 16 }} />
                            {catBusy ? "照合中…" : "カタログで探す（S.Library）"}
                          </Box>
                        )}
                        {catBusy && (
                          <Typography sx={{ fontSize: "0.72rem", color: alpha("#fff", 0.6), mb: 1 }}>
                            S.Library カタログと照合中…（初回はモデル読込で数秒かかります）
                          </Typography>
                        )}
                        {catError && !catBusy && (
                          <Typography sx={{ fontSize: "0.72rem", color: "#fca5a5", mb: 1 }}>{catError}</Typography>
                        )}

                        {matches.length > 0 && (
                          <Box sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", color: alpha("#86efac", 0.95), textTransform: "uppercase", mb: 0.75 }}>照合結果</Typography>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                              {matches.filter((m) => m && m.productUrl).map((m, i) => (
                                <Box key={i} onClick={() => openUrl(m.productUrl)} sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden", cursor: "pointer", background: alpha("#fff", 0.03), border: `1px solid ${alpha("#86efac", 0.25)}`, transition: "border-color 0.15s, transform 0.15s", "&:hover": { borderColor: alpha("#86efac", 0.7), transform: "translateY(-2px)" }, "&:hover .wt-prod-actions": { opacity: 1, transform: "translateY(0)", pointerEvents: "auto" } }}>
                                  <Box sx={{ position: "relative", aspectRatio: "1/1", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {m.cropDataUrl
                                      ? <Box component="img" src={m.cropDataUrl} alt={m.label} referrerPolicy="no-referrer" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                      : <LaunchRoundedIcon sx={{ fontSize: 26, color: alpha("#86efac", 0.5) }} />}
                                    {typeof m.similarity === "number" && (
                                      <Box sx={{ position: "absolute", top: 4, left: 4, px: 0.5, py: 0.1, borderRadius: 0.75, fontSize: "0.58rem", fontWeight: 800, color: "#062", background: alpha("#86efac", 0.9) }}>{Math.round(m.similarity * 100)}%</Box>
                                    )}
                                    <WalkthroughProductActions itemId={infoOpenId} productImage={m.cropDataUrl} productUrl={m.productUrl} model={infoOpenEntry.model} />
                                  </Box>
                                  <Box sx={{ p: 0.75 }}>
                                    <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: "#fff" }} noWrap>{m.label || m.catalogTitle || "カタログ商品"}</Typography>
                                    {m.price && <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#86efac" }} noWrap>{m.price}</Typography>}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        )}

                        {cl.length > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", color: alpha("#fff", 0.55), textTransform: "uppercase", mb: 0.75 }}>登録済みカタログ</Typography>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                              {cl.map((l, i) => {
                                const realThumb = l.thumbnail || catThumbMap[l.url]; // S.Library 索引から補完
                                return (
                                <Box key={i} onClick={() => openUrl(l.url)} sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden", cursor: "pointer", background: alpha("#fff", 0.03), border: `1px solid ${alpha("#86efac", 0.25)}`, transition: "border-color 0.15s, transform 0.15s", "&:hover": { borderColor: alpha("#86efac", 0.7), transform: "translateY(-2px)" }, "&:hover .wt-prod-actions": { opacity: 1, transform: "translateY(0)", pointerEvents: "auto" } }}>
                                  <Box sx={{ position: "relative", aspectRatio: "1/1", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {realThumb
                                      ? <Box component="img" src={realThumb} alt={l.title} referrerPolicy="no-referrer" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                      // 補完待ち（索引読込中）はローディングバー。
                                      : !catThumbsLoaded
                                        ? <Box sx={{ position: "relative", width: "72%", height: 4, borderRadius: 2, background: alpha("#fff", 0.16), overflow: "hidden", "&::after": { content: '""', position: "absolute", top: 0, height: "100%", width: "45%", borderRadius: 2, background: "#86efac", animation: "wtLoadBar 1.05s ease-in-out infinite" }, "@keyframes wtLoadBar": { "0%": { left: "-45%" }, "100%": { left: "100%" } } }} />
                                        : faviconOf(l.url)
                                          ? <Box component="img" src={faviconOf(l.url)} alt={l.title} referrerPolicy="no-referrer" sx={{ width: "44%", height: "44%", objectFit: "contain" }} />
                                          : <LaunchRoundedIcon sx={{ fontSize: 26, color: alpha("#86efac", 0.5) }} />}
                                    {realThumb && <WalkthroughProductActions itemId={infoOpenId} productImage={realThumb} productUrl={l.url} model={infoOpenEntry.model} />}
                                  </Box>
                                  <Box sx={{ p: 0.75 }}>
                                    <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: "#fff" }} noWrap>{l.title || "カタログ商品"}</Typography>
                                    {l.price && <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#86efac" }} noWrap>{l.price}</Typography>}
                                  </Box>
                                </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        )}

                        {!catBusy && !matches.length && !cl.length && !catError && (
                          <Typography sx={{ fontSize: "0.74rem", color: alpha("#fff", 0.55) }}>
                            登録済みのカタログ商品はありません。「カタログで探す」で S.Library カタログから似た商品を検索できます。
                          </Typography>
                        )}
                      </>
                    )}

                    {/* ── リンクタブ（関連URL ＋ 画像で検索） ── */}
                    {tab === "links" && (
                      <>
                        {infoOpenEntry.model && (
                          <Box
                            onClick={() => runProductSearch("lens", infoOpenEntry.model, currentUid).catch((e) => console.warn("[walkthrough] image search failed", e))}
                            sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mb: 1.25, px: 1.5, py: 0.85, borderRadius: 1.5, cursor: "pointer", color: "#fff", fontWeight: 800, fontSize: "0.8rem", background: `linear-gradient(180deg, ${alpha("#38bdf8", 0.95)} 0%, ${alpha("#0ea5e9", 0.92)} 100%)`, border: `1px solid ${alpha("#38bdf8", 0.7)}`, transition: "filter 0.15s, transform 0.12s", "&:hover": { filter: "brightness(1.08)", transform: "translateY(-1px)" } }}
                          >
                            <ImageSearchRoundedIcon sx={{ fontSize: 16 }} />
                            画像で検索（Google Lens）
                          </Box>
                        )}
                        {rl.length > 0 ? (
                          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            {rl.map((l, i) => {
                              const realThumb = l.thumbnail; // Lens 由来の商品サムネ
                              return (
                                <Box key={i} onClick={() => openUrl(l.url)} sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden", cursor: "pointer", background: alpha("#fff", 0.03), border: `1px solid ${alpha("#38bdf8", 0.25)}`, transition: "border-color 0.15s, transform 0.15s", "&:hover": { borderColor: alpha("#38bdf8", 0.7), transform: "translateY(-2px)" }, "&:hover .wt-prod-actions": { opacity: 1, transform: "translateY(0)", pointerEvents: "auto" } }}>
                                  <Box sx={{ position: "relative", aspectRatio: "1/1", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {realThumb
                                      ? <Box component="img" src={realThumb} alt={l.title} referrerPolicy="no-referrer" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                      : faviconOf(l.url)
                                        ? <Box component="img" src={faviconOf(l.url)} alt={l.title} referrerPolicy="no-referrer" sx={{ width: "44%", height: "44%", objectFit: "contain" }} />
                                        : <LaunchRoundedIcon sx={{ fontSize: 26, color: alpha("#38bdf8", 0.5) }} />}
                                    <Box sx={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: alpha("#000", 0.5), display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <LaunchRoundedIcon sx={{ fontSize: 12, color: "#38bdf8" }} />
                                    </Box>
                                    {realThumb && <WalkthroughProductActions itemId={infoOpenId} productImage={realThumb} productUrl={l.url} model={infoOpenEntry.model} />}
                                  </Box>
                                  <Box sx={{ p: 0.75 }}>
                                    <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: "#fff" }} noWrap>{l.title || l.url}</Typography>
                                    <Typography sx={{ fontSize: "0.62rem", color: alpha("#38bdf8", 0.85) }} noWrap>{hostOf(l.url)}</Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: "0.74rem", color: alpha("#fff", 0.55) }}>
                            登録済みの関連リンクはありません。「画像で検索」で似た商品を探せます。
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                </>
              );
            })()}
          </Box>
        )}
        {/* 右上クラスタ: 視点切替 ・ キャラ選択 ・ 終了 */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 31,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          {/* 一人称 / 三人称 */}
          <Box
            sx={{
              display: "flex",
              gap: "2px",
              background: alpha("#050815", 0.72),
              backdropFilter: "blur(8px)",
              border: `1px solid ${alpha("#fff", 0.1)}`,
              borderRadius: 1.5,
              p: "3px",
            }}
          >
            {[["first", "一人称"], ["third", "三人称"], ["fly", "フライ"]].map(([mode, label]) => (
              <Box
                key={mode}
                onClick={() => setWalkthroughViewMode(mode)}
                sx={{
                  px: 1.1,
                  py: 0.4,
                  borderRadius: 1,
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontWeight: walkthroughViewMode === mode ? 700 : 400,
                  color: walkthroughViewMode === mode ? "#fff" : alpha("#fff", 0.55),
                  background: walkthroughViewMode === mode ? alpha("#4f8cff", 0.55) : "transparent",
                  transition: "all 0.15s",
                  userSelect: "none",
                }}
              >
                {label}
              </Box>
            ))}
          </Box>

          {/* レンズ長（焦点距離 mm）— 視点モードごとに調整 */}
          <Box
            title="レンズ長（焦点距離）"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.9,
              px: 1.1,
              py: 0.5,
              borderRadius: 1.5,
              background: alpha("#050815", 0.72),
              backdropFilter: "blur(8px)",
              border: `1px solid ${alpha("#fff", 0.1)}`,
            }}
          >
            <CameraRoundedIcon sx={{ color: alpha("#fff", 0.7), fontSize: 15 }} />
            <Slider
              size="small"
              value={walkthroughLens?.[walkthroughViewMode] ?? 35}
              min={14}
              max={85}
              step={1}
              onChange={(_, v) => setWalkthroughLens(walkthroughViewMode, Array.isArray(v) ? v[0] : v)}
              sx={{
                width: 86,
                color: "#4f8cff",
                "& .MuiSlider-thumb": { width: 12, height: 12 },
                "& .MuiSlider-rail": { opacity: 0.3 },
              }}
            />
            <Typography sx={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap", minWidth: 34, textAlign: "right" }}>
              {walkthroughLens?.[walkthroughViewMode] ?? 35}mm
            </Typography>
          </Box>

          {/* キャラクター（クリックで右サイドバーを開く） */}
          <Box
            onClick={() => setRightPanel("characters", true)}
            title="キャラクターを選択"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              cursor: "pointer",
              px: 1.1,
              py: 0.6,
              borderRadius: 1.5,
              background: alpha("#050815", 0.72),
              backdropFilter: "blur(8px)",
              border: `1px solid ${alpha("#fff", 0.1)}`,
              "&:hover": { background: alpha("#1a2540", 0.85) },
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: walkthroughCharacter?.color || "#5b8def",
              }}
            />
            <Typography sx={{ color: "#fff", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              {walkthroughCharacter?.short || "キャラ"}
            </Typography>
          </Box>

          {/* フルスクリーン切替 */}
          <Box
            onClick={toggleFullscreen}
            title={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 1.5,
              cursor: "pointer",
              background: alpha("#050815", 0.72),
              backdropFilter: "blur(8px)",
              border: `1px solid ${alpha("#fff", 0.1)}`,
              "&:hover": { background: alpha("#1a2540", 0.85) },
            }}
          >
            {isFullscreen
              ? <FullscreenExitRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />
              : <FullscreenRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />}
          </Box>

          {/* ウォークスルー終了（元の俯瞰カメラへ復帰） */}
          <Box
            onClick={exitWalkthrough}
            title="ウォークスルー終了"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.2,
              py: 0.6,
              borderRadius: 1.5,
              cursor: "pointer",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: 700,
              userSelect: "none",
              background: alpha("#4f8cff", 0.55),
              backdropFilter: "blur(8px)",
              border: `1px solid ${alpha("#7eaaff", 0.5)}`,
              "&:hover": { background: alpha("#4f8cff", 0.75) },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 15 }} />
            終了
          </Box>

        </Box>

        {/* 操作ヒント */}
        <Box
          sx={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            background: alpha("#050815", 0.66),
            backdropFilter: "blur(8px)",
            border: `1px solid ${alpha("#fff", 0.08)}`,
            pointerEvents: "none",
          }}
        >
          <Typography sx={{ color: alpha("#fff", 0.8), fontSize: "0.7rem", whiteSpace: "nowrap" }}>
            {walkthroughViewMode === "first"
              ? "WASD 移動 ・ Shift 走る ・ Space ジャンプ ・ 右ドラッグで見渡す ・ アイテムにホバー/クリックで情報"
              : walkthroughViewMode === "fly"
              ? "WASD 飛行 ・ Space/Q 上昇 ・ C/E 下降 ・ Shift 加速 ・ 右ドラッグで見渡す"
              : "WASD 移動 ・ Shift 走る ・ Space ジャンプ ・ 右ドラッグでカメラ旋回 ・ アイテムにホバー/クリックで情報"}
          </Typography>
        </Box>

        {/* 左上フローティングメニュー（クリックでアクションがふわっと展開）。
            ビューポートが画面下端を超えて伸びると bottom 固定は見切れるため top 固定。
            将来のウォークスルー内ツール（自動レイアウト等）はここに追加する。 */}
        <WalkthroughActionMenu
          anchor="top-left"
          actions={[
            { key: "auto-material", label: "自動マテリアル", icon: <PaletteRoundedIcon />, color: "#ec407a", onClick: handleWalkthroughAutoMaterial },
            { key: "auto-furniture-material", label: "自動家具マテリアル", icon: <AutoFixHighRoundedIcon />, color: "#a78bfa", onClick: handleWalkthroughAutoFurnitureMaterial },
            { key: "auto-lighting", label: "自動ライティング", icon: <LightbulbRoundedIcon />, color: "#fbbf24", onClick: handleWalkthroughAutoLighting },
            { key: "auto-layout", label: "自動レイアウト", icon: <AutoFixHighRoundedIcon />, color: "#a78bfa", soon: true },
            { key: "auto-swap", label: "家具を自動差し替え", icon: <SwapHorizRoundedIcon />, color: "#f472b6", soon: true },
            { key: "characters", label: "キャラクター", icon: <PersonRoundedIcon />, color: "#4f8cff", onClick: () => setRightPanel("characters", true) },
          ]}
        />
      </>
    )}

    <Box sx={{ position: "absolute", top: 10, left: 10, zIndex: 25, display: "flex", alignItems: "center", gap: 0.5 }}>
      <Chip
      size="small"
      label={chipLabel}

      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveViewportId?.(viewportId);
        onActivate?.(viewportId);
        // ダブルクリック: 1画面 ↔ 2画面(Top+Perspective)トグル
        if (layoutMode === "single") {
          setLayoutMode("split");
        } else {
          // 2画面 → 1画面: ダブルクリックされたチップのビューを表示する
          const es = useEditorModeStore.getState();
          if (overrideSubMode === "furniture_top") {
            es.setLayoutSubMode("furniture_top");
          } else if (overrideSubMode === "furniture_iso") {
            es.setLayoutSubMode("furniture_iso");
            es.setLayoutCameraTilt("default");
          }
          setLayoutMode("single");
          onActivate?.("vp_persp");
        }
      }}
      sx={{




        bgcolor: alpha("#000", 0.42),
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
      }}
    />
    <IconButton
      size="small"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAnchorEl(e.currentTarget);
      }}
      sx={{
        bgcolor: alpha("#000", 0.42),
        color: "#fff",
        width: 24,
        height: 24,
        "&:hover": {
          bgcolor: alpha("#000", 0.6),
        }
      }}
    >
      <PlayArrowIcon sx={{ fontSize: "1rem" }} />
    </IconButton>

    {/* レンダリングモード: 通常 / Lighting プレビュー切り替え（上部行＝Layout/Perspective の右に並べる）
        ✅ 3D 演出グループのみ表示（2D 配置では見え方の演出は行わないためノイズを消す） */}
    {currentDisplayMode === "rendered" && is3DGroup && (
      <Box
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          ml: 0.5,
          bgcolor: "rgba(20, 20, 20, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 1,
          p: 0.4,
          backdropFilter: "blur(8px)",
          display: "flex",
          gap: 0.5,
        }}
      >
        {[
          { value: "standard", label: "通常" },
          { value: "lighting", label: "Lighting" },
        ].map(({ value, label }) => (
          <Box
            key={value}
            onClick={() => setRenderSubMode(value)}
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 0.5,
              fontSize: "0.65rem",
              cursor: "pointer",
              bgcolor: renderSubMode === value ? "rgba(255,255,255,0.18)" : "transparent",
              color: renderSubMode === value ? "#fff" : "rgba(255,255,255,0.45)",
              border: renderSubMode === value
                ? "1px solid rgba(255,255,255,0.25)"
                : "1px solid transparent",
              "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" },
              transition: "all 0.12s",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    )}
  </Box>

    <Menu
      anchorEl={menuAnchorEl}
      open={Boolean(menuAnchorEl)}
      onClose={handleMenuClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      MenuListProps={{
        dense: true,
      }}
      PaperProps={{
        sx: {
          mt: 0.5,
          minWidth: 160,
          bgcolor: "rgba(20, 20, 20, 0.95)",
          color: "rgba(255, 255, 255, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          "& .MuiMenuItem-root": {
            fontSize: "0.7rem",
            fontWeight: 300,
            py: 0.25,
            px: 1.5,
            minHeight: "26px",
            "&:hover": {
              bgcolor: "rgba(255, 255, 255, 0.1)",
            }
          },
          "& .MuiListItemText-primary": {
            fontSize: "inherit",
            fontWeight: "inherit",
          },
          "& .MuiListItemIcon-root": {
            minWidth: "24px",
            color: "inherit",
          }
        }
      }}
    >
      {displayModes.map((mode) => (
        <MenuItem
          key={mode.value}
          onClick={() => {
            setViewportDisplayMode(viewportId, mode.value);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            {currentDisplayMode === mode.value ? <CheckIcon fontSize="small" /> : null}
          </ListItemIcon>
          <ListItemText>{mode.label}</ListItemText>
        </MenuItem>
      ))}
    </Menu>

    {/* ゴーストモード: 躯体透過率スライダー */}
    {currentDisplayMode === "ghosted" && (
      <Box
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 44,
          left: 10,
          zIndex: 25,
          bgcolor: "rgba(20, 20, 20, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 1,
          px: 1.5,
          py: 0.75,
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 190,
        }}
      >
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem", whiteSpace: "nowrap" }}>
          躯体透過率
        </Typography>
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.01}
          value={ghostOpacity}
          onChange={(_, val) => setGhostOpacity(val)}
          sx={{
            color: "rgba(255,255,255,0.75)",
            "& .MuiSlider-thumb": { width: 10, height: 10 },
            "& .MuiSlider-rail": { opacity: 0.3 },
            py: 0,
            flex: 1,
          }}
        />
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem", minWidth: 30, textAlign: "right" }}>
          {Math.round(ghostOpacity * 100)}%
        </Typography>
      </Box>
    )}









    <Canvas
      // アクティブ(=画面に表示中)のビューポートだけ毎フレーム描画する。
      // SINGLE モードでは vp_top/persp/front/right の4枚が常にマウントされており
      // (display:none で隠れているだけ)、"always" だと見えない3シーンも毎フレーム
      // 描画・影計算・useFrame を走らせ続けて CPU/メモリを浪費していた。
      // 非アクティブは "demand" にして、プロップ変化やコントロール操作時だけ描く。
      frameloop={active ? "always" : "demand"}
      dpr={[1, 2]}
      shadows="soft"
      gl={{ powerPreference: "high-performance", antialias: true, stencil: true }}
      onCreated={({ gl, scene }) => {
        // ローカル ref に保存（active 変化時に layoutSceneRef へ反映する）
        glRef.current    = gl;
        sceneRef.current = scene;
        // ★ active な viewport だけ即時登録する。
        //   React の effect 発火順は depth-first post-order のため、
        //   vp_persp(active) の useEffect([active]) が登録しても、
        //   その後に続く vp_front/vp_right の onCreated が上書きしてしまう。
        //   inactive 分は登録せず、active 変化時に useEffect で再登録する。
        if (active) {
          layoutSceneRef.gl    = gl;
          layoutSceneRef.scene = scene;
          layoutSceneRef.getCameraState = () => {
            const controls = orbitRef.current;
            if (!controls) return null;
            const cam = controls.object;
            if (!cam) return null;
            // OrthographicCamera の場合も position/target は使える。fov は 50 で固定。
            const fov = cam.isPerspectiveCamera ? cam.fov : 50;
            return {
              position: [cam.position.x, cam.position.y, cam.position.z],
              target: [controls.target.x, controls.target.y, controls.target.z],
              fov,
            };
          };
          layoutSceneRef.setCameraPose = (pose) => {
            const controls = orbitRef.current;
            if (!controls) return;
            const cam = controls.object;
            if (!cam) return;
            cam.position.set(pose.position[0], pose.position[1], pose.position[2]);
            controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
            if (cam.isPerspectiveCamera && Number.isFinite(pose.fov)) {
              cam.fov = pose.fov;
              cam.updateProjectionMatrix();
            }
            controls.update();
          };
        }
      }}

      onPointerMissed={(e) => {
        if (e.type === "pointerdown" && e.button !== 0) return;
        if (e.type === "click" && e.button !== 0) return;
        if (!active) return;
        // 寸法・記号などの DOM 注記（drei の Html オーバーレイ）の上でのクリックは
        // 「余白クリック」ではない。R3F は 3D オブジェクトに当たらなかった時点で
        // onPointerMissed を投げるので、当たり先がキャンバス自身かどうかで見分ける。
        if (e.target && !(e.target instanceof HTMLCanvasElement)) return;
        if (!pointerMissedEnabled) return;
        if (isMarqueeActive) return;
        if (alignMode) return;
        if (isGizmoDragging) return;
        clearSelection();
        useLayoutTaskStore.getState().setActiveZoneId(null);
        // 余白クリックで断面線の選択も解除する（ギズモを閉じる）。
        useSectionLinesStore.getState().setActiveLine(null);
        clearDrawingAnnotationSelection();
        useWallStore.getState().setSelectedWallId(null);
        useSlabStore.getState().setSelectedSlabId(null);
        
        if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
          useZoningStore.getState().setSelectedCirculationId(null);
          useZoningStore.getState().setSelectedCirculationNodeIndex(null);
        }
      }}
    >
      <ViewportOverrideContext.Provider value={{ layoutSubMode: overrideSubMode, layoutCameraRotationIndexOffset: overrideRotOffset }}>
      <ContextDisposer />
      <ViewportDisplayController mode={isLabelMode ? "rendered" : currentDisplayMode} ghostOpacity={ghostOpacity} renderSubMode={renderSubMode} />
      {/* 2画面表示ではマテリアルが左右のシーンで共有されるため、クリップ面の書き込み役は
          図面ペイン（右）に一本化する。平面ペイン（左＝Top）は passive で受け取るだけ。
          図面グリッドのペインはレンダラー単位クリップ（PaneClipPlanes）を使うので常に passive。 */}
      <SectionClipManager
        isTopView={effectiveType === VIEW_TYPES.TOP}
        passive={(isSplitLayout && effectiveType === VIEW_TYPES.TOP) || !!paneDrawing}
      />
      {paneDrawing && <PaneClipPlanes planes={paneDrawing.clipPlanes || null} />}
      {/* 断面ペインは切り口の黒塗り（ポシェ）＋切断面フレームを単体ビューと同様に出す */}
      {paneDrawing?.cap && <PaneSectionCap axis={paneDrawing.cap.axis} pos={paneDrawing.cap.pos} />}
      {/* 天井伏図は投影を X 反転しているので、画面上の巻き方向が逆になる。
          ステンシルの表裏を入れ替えるため mirrored を渡す。 */}
      <MirrorXProjection active={effectiveSubMode === "ceiling_top"} />
      <SectionCapFill mirrored={effectiveSubMode === "ceiling_top"} />
      <SectionWarmup />

      <SmoothAlignFollower
        active={!!isAlignOwner && !!alignMode && !materialPicking}
        primaryObject={selectedObject}
        selectedObjects={alignSelectedObjects}
        alignMode={alignMode}
        groundY={groundY}
        snapAxisValue={snapAxisValue}
        baseCollidersRef={baseCollidersRef}
        baseBoundsRef={baseBoundsRef}
        wallEps={0.02}
        wallMaxDist={200}
        lastNdcRef={lastAlignNdcRef}
        damping={32}
        getSnapActive={getSnapActive}
        getAbortAlign={() => alignAbortRef.current}
        onPreviewTransform={onChangeTransform}
        onPreviewTransforms={onChangeTransforms}
        previewItemId={selectedItemId}
        previewThrottleMs={33}
        snapEngineRef={snapEngineRef}
        snapDotRef={snapDotRef}
        snapGuideValueRef={snapGuideValueRef}
        snapFinalAnchorRef={snapFinalAnchorRef}
      />

      {isAlignOwner && alignMode && (
        <SnapGuide axis={alignMode.axis} valueRef={snapGuideValueRef} pointRef={snapDotRef} />
      )}

      <AlignPointerController
        enabled={!!isAlignOwner && !!alignMode && !materialPicking}
        onConfirm={commitAlign}
        lastNdcRef={lastAlignNdcRef}
        isNavActive={isNavActive}
        getSnapActive={getSnapActive}
      />

      <GridPickController baseCollidersRef={baseCollidersRef} />

      {/* Material モード：躯体の面クリック選択 + 選択ハイライト。
          一人称ルック中は MaterialLookController が選択を担うので FacePick は無効化。 */}
      <FacePickController active={!!active && isMaterialMode && !materialFirstPerson} baseCollidersRef={baseCollidersRef} isTopView={effectiveType === VIEW_TYPES.TOP} />
      <MaterialLookController active={!!active && isMaterialLook} />
      {isMaterialMode && <SelectedFaceHighlight />}
      {isMaterialLook && <AimFaceHighlight />}

      {/* 躯体の面ラベル＆コリジョン：面クリックで選択→右サイドバー Properties に設定を開く */}
      <StructureTagController active={!!active && (structureFacePicking || isLabelMode)} baseCollidersRef={baseCollidersRef} ignoreItemOcclusion={structureTagging || isLabelMode} isTopView={effectiveType === VIEW_TYPES.TOP} />
      {/* ラベルバッジは面ラベルツール／Label モードでのみ表示。Material モードでは表示しない。 */}
      {(structureFacePicking || isLabelMode) && <StructureTagOverlay />}
      {/* GL/FL レベル線。高さ設定モード中はドラッグ編集可、それ以外は俯瞰トグルON時に表示専用で重ねる。
          ウォークスルー/マテリアル/マップ/Top など俯瞰でないビューでは表示専用を抑制する。 */}
      {/* 断面図(=正射側面ビュー＋水平以外の断面クリップON)では GL/各階FL を表示＆編集可。
          立面図(=正射側面ビュー＋クリップOFF)では FL/GL は不要なので抑制する。 */}
      {(() => {
        const isSideOrtho = effectiveType === VIEW_TYPES.FRONT || effectiveType === VIEW_TYPES.RIGHT;
        // 図面グリッドの断面ペイン（paneDrawing.cap あり）は、グローバルの断面状態に
        // 依らず断面図として扱う（FL/GL レベル線を単体断面ビューと同様に出す）。
        const isSectionView = isSideOrtho &&
          (paneDrawing ? !!paneDrawing.cap : (sectionClipEnabledForLight && !sectionClipYEnabledForLight));
        // 展開図ビューでは GL/FL 線・紫の CL 寸法とも出さない。
        // 寸法は ElevationDimensionsOverlay（スレート基調）に統一し、CL はそのラベルの
        // ダブルクリックか右パネルで編集する（GL・階高・FL は断面図で扱う）。
        if (elevChipOn && isSideOrtho) return null;
        return (
          <LevelLinesOverlay
            overviewSuppressed={isWalkthrough || isMaterialMode || isMapMode || effectiveType === VIEW_TYPES.TOP || (isSideOrtho && !isSectionView)}
            sectionEditable={isSectionView}
            sectionAxis={isSectionView ? (effectiveType === VIEW_TYPES.FRONT ? "z" : "x") : null}
            sectionFlip={isSectionView ? sectionViewFlip : false}
            elevationMode={isSectionView && elevChipOn}
          />
        );
      })()}
      {/* 断面線（A-A' / B-B'…）: 平面図(Top)に切断線＋矢印＋ラベルで表示。
          線ドラッグで位置移動、ラベルクリックで選択。 */}
      {symOn("section") && effectiveType === VIEW_TYPES.TOP && !isMaterialMode && !isMapMode && !isWalkthrough && (
        <SectionLinesPlanOverlay />
      )}
      {/* 通り芯（構造グリッド）: 平面では両方向を編集可能に、断面/立面では画面横方向の通りを縦線で。
          寸法列の刻み元になる基準線なので、記号トグル ON のときに図面へ重ねる。 */}
      {symOn("grid") && effectiveType === VIEW_TYPES.TOP && !isMaterialMode && !isMapMode && !isWalkthrough && (
        <GridAxisOverlay mode="plan" />
      )}
      {symOn("grid") && isSideOrtho && !isMaterialMode && !isMapMode && !isWalkthrough && (
        <GridAxisOverlay mode="side" hAxis={effectiveType === VIEW_TYPES.FRONT ? "x" : "z"} />
      )}
      {/* 展開記号: どこから見た展開図かを図示（中心=目 / 四方=展開A〜D）。
          矢印クリックでその向きの展開図（Material 一人称）を開く。中心ドラッグで移動。 */}
      {symOn("elevation") && effectiveType === VIEW_TYPES.TOP && !isMaterialMode && !isMapMode && !isWalkthrough && (
        <ElevationMarkerPlanOverlay />
      )}
      {/* 展開図の図面注記: セグメント寸法列・全幅・高さ寸法/レベル・断面ポシェ。
          表示条件（展開ビュー中か）はコンポーネント内で判定する。 */}
      {isSideOrtho && <ElevationDimensionsOverlay />}
      {/* 躯体面に貼った仕上げ（オーバーレイ板）。マテリアルはどのモードでも常に反映（統一）。 */}
      <SurfaceFinishOverlays />
      {/* 自動付与時の青いスキャンライン演出 */}
      <MaterialSweepFx />
      {/* 自動ラベリングの 3Dスキャン演出（X→Y→Z 断面スイープ） */}
      <ScanFx />

      {effectiveType === VIEW_TYPES.PERSPECTIVE && (
        <PerspectiveCamera
            makeDefault
            fov={isWalkthrough ? focalLengthToFov(walkthroughLens?.[walkthroughViewMode] || 35) : isMaterialLook ? focalLengthToFov(materialLensMm) : envFov} near={0.1} far={100000}
            onUpdate={(c) => {
                console.log("[Canvas-PerspectiveCamera] activeCamUUID:", c.uuid);
                if (!c.userData.initialized) {
                    c.position.set(24, 18, 24);
                    c.lookAt(0, 0, 0);
                    c.userData.initialized = true;
                }
            }}
        />
      )}

      {effectiveType !== VIEW_TYPES.PERSPECTIVE && (
        <OrthographicCamera
          makeDefault
          position={ortho.position}
          up={ortho.up}
          zoom={ortho.zoom}
          near={0.1}
          far={100000}
        />
      )}

      {/* 太陽（SUN）ギズモは 3D 向けの内容。Perspective のみ表示し、平面図（Top＝2D配置/1F 等）
          や立面図・断面図（側面正射）などの図面表示では出さない。 */}
      <Lights hasBase={!!displayBaseUrl || !!roomSpec} hideGizmo={effectiveType !== VIEW_TYPES.PERSPECTIVE} />
      {/* 図面ライト（TopBar「ライト」トグル・既定ON）：展開/立面/断面の側面正射ビューでは
          シーンの太陽光がカメラ正対の壁面をほぼ照らさず、貼ったマテリアルが黒く沈む。
          カメラと同じ方向からのフィルライト＋無指向の環境光で図面として見やすい明るさにする。
          陰影（日当たり）を確認したいときはトグルで OFF。影は落とさない（既存の影表現を壊さない）。 */}
      {isSideOrtho && drawingLight && ortho && (
        <>
          <ambientLight intensity={0.9} color={"#ffffff"} />
          <directionalLight position={ortho.position} intensity={1.6} color={"#ffffff"} />
        </>
      )}
      {/* 天井カット時の採光：抜けた天井から太陽光が差し込むイメージの補助光。
          室内が真っ暗になるのを防ぐ。オクルージョンの無い hemisphere で確実に床まで届かせる。 */}
      {sectionClipEnabledForLight && sectionClipYEnabledForLight && editorMode !== "walkthrough" && (
        <>
          <hemisphereLight intensity={1.0} color={"#ffffff"} groundColor={"#bcc4cc"} />
          <directionalLight position={[0.2, 1, 0.15]} intensity={0.9} />
        </>
      )}
      {/* グリッドは水平の板ヘルパーなので、側面正射（展開/立面/断面）では
          真横から見た1本の灰色線として写ってしまう。図面ビューでは出さない。 */}
      {/* 床グリッド。記号メニューの「グリッド」で表示だけ切れる（スナップには影響しない）。 */}
      {!isSideOrtho && symOn("sceneGrid") && <SceneGrid />}
      <MapGroundPlane />
      {isMapMode && <MapDrawController />}
      {isMapMode && active && <MapZoomController orbitRef={orbitRef} />}

      {/* 下絵（PDF/画像）。自身で imageUrl/visible を見て出し分けるので常時マウント。 */}
      <UnderlayPlane />
      <UnderlayDrawController />
      <Suspense fallback={null}>
        <LandscapeBackdrop renderSubMode={renderSubMode} />
      </Suspense>

    <OrbitControls
          ref={orbitRef}
          enabled={!isWalkthrough && !isWalkthroughPinDragging && !isMaterialLook}
          enableDamping={false}
          // 高さ設定（断面）中は回転禁止（左ドラッグはレベル線/断面線の操作に使うため）。
          enableRotate={!isZone2D && !isWalkthrough && !isMaterialLook && !isMapMode && !heightSetupActive}
          // Map モードは Base を常に画面中央へ固定するためパンを無効化。
          enablePan={!isMapMode}
          // Map モードのズームは MapZoomController が担う（OrbitControls 側は無効化して二重処理を防ぐ）。
          enableZoom={!isMapMode}
          // ホイールズームはカーソル位置を基準にする（CAD 系の挙動）。
          // 既定の false だと controls.target＝画面中央が基準になり、見たい所へ寄るのにパンが要る。
          zoomToCursor
          // 1 ノッチあたりの拡大縮小量。既定(1)だと寄り引きに何度も回す必要があるため強めにする。
          zoomSpeed={2.0}
          panSpeed={isZone2D ? 100.0 : 1.0}
          mouseButtons={{
            // Map モードは中ボタンパン・右回転とも無効（右ドラッグ=地図移動 / Ctrl+右=ズームは別処理）。
            // Label モードは左ドラッグで中心基点に回転（左クリックは面選択のまま＝ドラッグ量で区別）。
            // ただし高さ設定（断面）中は左ドラッグ回転を無効（null）にする。
            LEFT: (isLabelMode && !heightSetupActive) ? THREE.MOUSE.ROTATE : null,
            MIDDLE: isMapMode ? null : THREE.MOUSE.PAN,
            RIGHT: isMapMode ? null : (isZone2D ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE),
          }}
        />
        <WalkthroughController active={active && isWalkthrough} />
        <WalkthroughInteractionController active={active && isWalkthrough} viewMode={walkthroughViewMode} />
        {active && isWalkthrough && <WalkthroughItemInfoBadge />}
        <PerspectiveControlsBinder
          mouseEnabled={!alignMode && !isGizmoDragging && !isWalkthrough && !isMapMode}
          keyboardEnabled={active && !alignMode && !isGizmoDragging && !isWalkthrough && !isMapMode}
          enabled={active && !alignMode && !isGizmoDragging && !isWalkthrough && !isMapMode}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          moveSpeed={speedPreset.move}
          verticalSpeed={speedPreset.vertical}
          onSpeedChange={onSpeedMulChange}
          forcePanOnRmb={isZone2D}
          // パン量はフックが px→ワールドを厳密に計算する（＝カーソル完全追従）ので等倍。
          panMultiplier={1.0}
          rmbOrbit={false}
        />

        <ViewportFramingController
          active={active}
          type={type}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          objectsRef={objectsRef}
          baseRootRef={baseRootRef}
          focusTick={focusTick}
          frameAllTick={frameAllTick}
          isUserInteracting={isGizmoDragging}
        />

        {isBaseReady && (displayBaseUrl || roomSpec) && (
          <CanvasErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              {/* Background Click Catcher */}
      <mesh 
        position={[0, groundY - 0.05, 0]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        visible={true}
        onClick={(e) => {
          if (!active) return;
          if (isMarqueeActive || isGizmoDragging || alignMode) return;
          clearSelection();
          useLayoutTaskStore.getState().setActiveZoneId(null);
          // 余白（床/背景）クリックで断面線の選択も解除する。
          useSectionLinesStore.getState().setActiveLine(null);
          // 通り芯・寸法列は常に畳む。通り芯そのものをクリックした場合は
          // 通り芯側が stopPropagation するのでここには届かない。
          clearDrawingAnnotationSelection();
          // 作図した壁・床に当たっているクリックでは、それらの選択は解除しない
          if (!hitsDrawnStructure(e)) {
            useWallStore.getState().setSelectedWallId(null);
            useSlabStore.getState().setSelectedSlabId(null);
          }

          if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
            useZoningStore.getState().setSelectedCirculationId(null);
            useZoningStore.getState().setSelectedCirculationNodeIndex(null);
          }
          // e.stopPropagation() is optional here because nothing is below this
        }}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      <group
        onClick={(e) => {
          if (!active) return;
          if (isMarqueeActive || isGizmoDragging || alignMode) return;

          // Clear selection when clicking the BaseGlb (floor/walls)
          clearSelection();
          useLayoutTaskStore.getState().setActiveZoneId(null);
          // 余白（床/壁）クリックで断面線の選択も解除する。
          useSectionLinesStore.getState().setActiveLine(null);
          // 通り芯・寸法列は常に畳む。通り芯そのものをクリックした場合は
          // 通り芯側が stopPropagation するのでここには届かない。
          clearDrawingAnnotationSelection();
          // 作図した壁・床に当たっているクリックでは、それらの選択は解除しない
          if (!hitsDrawnStructure(e)) {
            useWallStore.getState().setSelectedWallId(null);
            useSlabStore.getState().setSelectedSlabId(null);
          }

          if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
            useZoningStore.getState().setSelectedCirculationId(null);
            useZoningStore.getState().setSelectedCirculationNodeIndex(null);
          }
        }}
      >
        {displayBaseUrl
          ? <BaseGlb url={displayBaseUrl} onLoaded={handleBaseLoaded} />
          : roomSpec
            ? <ParametricRoom spec={roomSpec} onLoaded={handleBaseLoaded} isTopView={effectiveType === VIEW_TYPES.TOP} />
            : null}
      </group>
            </Suspense>
          </CanvasErrorBoundary>
        )}

        {isBaseReady && pendingBaseUrl && pendingBaseUrl !== displayBaseUrl && (
          <CanvasErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <group visible={false}>
                <BaseGlb url={pendingBaseUrl} onLoaded={onPendingLoaded} />
              </group>
            </Suspense>
          </CanvasErrorBoundary>
        )}

        {normalizedItems.map((it) =>
          it.kind === "ai_placeholder" ? (
            <AiPlaceholderItem
              key={it.id}
              item={it}
              selected={!isWalkthrough && selectedSet.has(it.id)}
              onSelect={handleSelectFurniture}
            />
          ) : (
            <FurnitureItem
              key={it.id}
              item={it}
              selected={!isWalkthrough && selectedSet.has(it.id)}
              freezeTransform={isGizmoDragging && selectedSet.has(it.id)}
              onSelect={handleSelectFurniture}
            />
          )
        )}
        {/* Map モード・側面正射（立面/断面）では合わせ込み/図面に不要なオーバーレイ（寸法/ゾーン）を隠す。 */}
        {!isMapMode && !isSideOrtho && (
          <>
            <FurnitureDimensionOverlay />
            <FurnitureGapOverlay />
            <ItemDimensionOverlay />
            {showZoneSymbols && (
              <ZoneVisualizer
                items={normalizedItems}
                orbitRef={orbitRef}
                editable={isZoning}
                roomBounds={zoneRoomBounds}
                isTopView={effectiveType === VIEW_TYPES.TOP}
              />
            )}
            <ZoneDrawController enabled={isZoning} roomSpec={roomSpec} />
            <ZoneCirculationController />
          </>
        )}

        {/* 作図した壁（内壁/外壁）・床（スラブ）。躯体なのでパース/平面/断面/立面すべてで表示する。 */}
        <FloorSlabsRenderer
          isTopView={effectiveType === VIEW_TYPES.TOP}
          isCeilingView={effectiveSubMode === "ceiling_top"}
        />
        <WallsRenderer isTopView={effectiveType === VIEW_TYPES.TOP} />

        {/* 壁・床の作図/編集。マップ・ウォークスルー・マテリアルでは出さない。
            平面(Top)/パース: 作図とハンドル操作（床平面へのレイキャストが成立する）。
            立面/断面（側面正射）: 視線が水平で床平面と交わらないためハンドル操作は不可。
              移動ギズモ（PivotControls）は床平面に依存しないので、画面に見えている2軸
              （横＝視線に直交する水平軸 / 縦＝上下）に絞って表示だけ出す（sideAxis）。
              FRONT は Z 方向を見るので横＝X、RIGHT は X 方向を見るので横＝Z。 */}
        {(effectiveType === VIEW_TYPES.TOP || effectiveType === VIEW_TYPES.PERSPECTIVE || isSideOrtho) &&
          !isMapMode && !isWalkthrough && !isMaterialMode && (
          <>
            {!isSideOrtho && <WallDrawController enabled />}
            {/* 選択中の壁の編集ハンドル（端点/中点。クリックで選択＝移動ギズモ、ドラッグで直接移動） */}
            <WallEditController
              enabled
              orbitRef={orbitRef}
              sideAxis={isSideOrtho ? (effectiveType === VIEW_TYPES.FRONT ? "x" : "z") : null}
            />
            {!isSideOrtho && <FloorSlabDrawController enabled />}
            {/* 自動部屋作成: クリック地点から壁で囲われた範囲を検出して部屋を作る
                （床スラブの有無・GLB躯体かどうかに依存しない。ツールを構えたときだけ出る） */}
            {!isSideOrtho && <RoomCreateController enabled />}
            {/* 選択中の床の編集ハンドル（頂点／辺に頂点挿入／全体移動。頂点クリックで移動ギズモ） */}
            <SlabEditController
              enabled
              orbitRef={orbitRef}
              sideAxis={isSideOrtho ? (effectiveType === VIEW_TYPES.FRONT ? "x" : "z") : null}
            />
            {/* 手動寸法（ヘッダー「寸法」ツール）: 2点クリックで作図し、
                作図したビュー（平面/天井/断面/立面/展開）でのみ表示・編集する。 */}
            {(() => {
              const isSectView = isSideOrtho &&
                (paneDrawing ? !!paneDrawing.cap : (sectionClipEnabledForLight && !sectionClipYEnabledForLight));
              let dimViewKey = null;
              if (effectiveType === VIEW_TYPES.TOP) {
                dimViewKey = `${effectiveSubMode === "ceiling_top" ? "ceil" : "plan"}:${manualDimFloorIndex || 0}`;
              } else if (isSideOrtho) {
                if (elevChipOn) dimViewKey = `elev:${manualDimElevationId || elevChipDir || "elev"}`;
                // 図面グリッドの断面ペインはラベル（"断面 A-A'" 等）から断面ラインを引き当てる
                // （グローバルの activeLineId は全ペイン共通なので使えない）。単体断面ビューと
                // 同じ sect:{lineId} キーに揃え、どちらで作図しても同じ断面に表示されるようにする。
                else if (paneDrawing?.cap) {
                  const paneLine = useSectionLinesStore.getState().lines.find((l) => (paneDrawing.label || "").includes(l.name));
                  dimViewKey = `sect:${paneLine?.id || paneDrawing.label || "pane"}`;
                }
                else if (isSectView) dimViewKey = `sect:${manualDimSectionId || (effectiveType === VIEW_TYPES.FRONT ? "z" : "x")}`;
                else dimViewKey = `facade:${effectiveType === VIEW_TYPES.FRONT ? "front" : "right"}`;
              }
              return (
                <>
                  <ManualDimensionController
                    enabled
                    viewKey={dimViewKey}
                    hAxis={isSideOrtho ? (effectiveType === VIEW_TYPES.FRONT ? "x" : "z") : null}
                  />
                  {/* 図面の4辺の寸法列（通り芯間・壁面・階レベル・総寸法）。
                      展開図は既存の ElevationDimensionsOverlay が担当するので出さない。 */}
                  {dimViewKey && !elevChipOn && symOn("dimension") && (
                    <DimensionChainsOverlay
                      viewKey={dimViewKey}
                      view={effectiveType === VIEW_TYPES.TOP ? "plan"
                        : effectiveType === VIEW_TYPES.FRONT ? "front" : "right"}
                    />
                  )}
                  <DimViewKeyReporter viewKey={dimViewKey} active={!!active} />
                </>
              );
            })()}
          </>
        )}

        {showGizmoSafe && !isMapMode && (
          <TransformGizmo
            orbitRef={orbitRef}
            selectedObject={selectedObject}
            mode={gizmoMode}
            // 側面正射（立面/断面/展開）では画面に平行な2軸だけを world 基準で動かす。
            //   FRONT（Z を見る）→ 画面横=X・縦=Y / RIGHT（X を見る）→ 画面横=Z・縦=Y
            space={isSideOrtho ? "world" : gizmoSpace}
            axes={isSideOrtho
              ? (effectiveType === VIEW_TYPES.FRONT ? [true, true, false] : [false, true, true])
              : null}
            disableRotations={isSideOrtho}
            disableScaling={isSideOrtho}
            snapEnabled={snapEnabled}
            isTopView={effectiveSubMode === "furniture_top" || effectiveSubMode === "ceiling_top"}
            onChangeTransform={handleGizmoPreview}
            onCommitTransform={handleGizmoCommit}
            onHoverAxisChange={(axis) => {
              onGizmoHoverAxisChange?.(axis ?? null);

              const next = axis || null;
              setGizmoHotAxisStore?.(next);

              // UI state only
              isGizmoUiActiveRef.current = !!next;
            }}
            onRequestNumericOpen={handleNumericOpenFromGizmo}
            onRequestNumericClose={handleNumericCloseFromGizmo}
            onDraggingChange={(payload) => {
              if (typeof payload === "boolean") {
                const isDragging = payload;

                // ✁Estateより先にref更新�E�これが効く！E
                gizmoDraggingRef.current = isDragging;

                setIsGizmoDragging(isDragging);
                
                useViewportUiStore.getState().setGizmoDragging(isDragging);

                if (isDragging) {
                  beginGizmoMultiSnapshot();

                  // ✁EGizmo操作開始したら篁E��選択を即停止 & 抑止を立てめE
                  suppressMarqueePointerIdRef.current = "gizmo";
                  cancelMarquee?.();
                } else {
                  suppressMarqueePointerIdRef.current = null;
                  requestAnimationFrame(() => {
                    gizmoMultiSnapshotRef.current = null;
                  });
                }
                return;
              }

              const kind = payload?.kind;
              const value = !!payload?.value;
              if (kind === "input" || kind === "hover") isGizmoUiActiveRef.current = value;
            }}
          />
        )}
        <LayoutModeInteractionController
          active={active}
          selectedItemIds={alignSelectedIds}
          onChangeTransforms={onChangeTransforms}
          onCommitTransforms={onCommitTransforms}
          onDeleteItems={onDeleteItems}
          snapGridSize={0.5}
          orbitRef={orbitRef}
          items={normalizedItems}
        />
        {/* スタートピン: Perspective ビューのみ表示。平面図（Top＝2D配置/1F 等）は
            図面表示なのでスタートピンは出さない（ウォークスルー中・Material・Zoning中も非表示）。 */}
        {!isWalkthrough && !isMaterialMode && !isMapMode && !isLabelMode && editorMode !== "zoning" && effectiveType === VIEW_TYPES.PERSPECTIVE && (
          <WalkthroughStartPin />
        )}
        {/* 展開図ピン（複数）: Material モードの俯瞰時のみ配置・移動・削除できる */}
        {isMaterialMode && !materialFirstPerson && effectiveType === VIEW_TYPES.PERSPECTIVE && (
          <MaterialPins />
        )}

        <LayoutCameraRig
          orbitRef={orbitRef}
          layoutSubMode={overrideSubMode || globalLayoutSubMode}
          baseBoundsRef={baseBoundsRef}
        />
      </ViewportOverrideContext.Provider>
      </Canvas>
    </Box>
  );
}
