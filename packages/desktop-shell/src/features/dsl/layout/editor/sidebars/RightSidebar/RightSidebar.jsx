// src/features/layout/components/RightSidebar/RightSidebar.jsx
import React, { useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Box, Divider, Typography, Tooltip, IconButton } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
// 右サイドバー上部の切替タブ用アイコン（旧・右ドックの各ボタン）
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import { toggleMapMode } from "../../../utils/mapMode";

import PropertiesPanel from "./components/PropertiesPanel";
import SceneOutlinerPanel from "./components/SceneOutlinerPanel";
import { useSceneOutlinerTree } from "./hooks/useSceneOutlinerTree";
import ModelLibraryPanel from "../LeftSidebar/components/ModelLibraryPanel";
// 全幅ヘッダー化: 左サイドバー廃止に伴い、Project 階層（Base/Plan/Option ツリー）も右サイドバーへ移設
import EditorBasePlanOptionTree from "../LeftSidebar/components/EditorBasePlanOptionTree";
// 全幅ヘッダー化: 左サイドバー廃止に伴い、Library は右サイドバーのパネルとして表示する
import LibraryPanelShell from "../LeftSidebar/components/Library/LibraryPanelShell";
import { useAIChatStore } from "../../../../../../store/useAIChatStore";
import { useCoreOrchestrator } from "../../../../../../store/useCoreOrchestrator";

import { useUiRightSidebarStore } from "../../../store/uiRightSidebarStore";
import { useUiPropertiesSelectionStore } from "../../../store/uiPropertiesSelectionStore";
import { useUiSceneOutlinerStore } from "../../../store/uiSceneOutlinerStore";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";

import OptionDetailPanel from "./components/ContextPanels/OptionDetailPanel";
import BaseRoomPanel from "./components/ContextPanels/BaseRoomPanel";
import ZonePropertiesPanel from "./components/ContextPanels/ZonePropertiesPanel";
import ZoneListPanel from "./components/ContextPanels/ZoneListPanel";
import MediaSettingsPanel from "./components/ContextPanels/MediaSettingsPanel";
import MediaStillSettingsPanel from "./components/ContextPanels/MediaStillSettingsPanel";
import AutoActionSidePanel from "./components/ContextPanels/AutoActionSidePanel";
import AutoAiSidePanel from "./components/ContextPanels/AutoAiSidePanel";
import FurnitureSelectionPanel from "./components/ContextPanels/FurnitureSelectionPanel";
import { useMediaSettingsStore } from "../../../store/useMediaSettingsStore";
import { useAutoActionStore } from "../../../store/useAutoActionStore";
import HistoryPanel from "./components/HistoryPanel";
import MapPanel from "./components/MapPanel";
import UnderlayPanel from "./components/UnderlayPanel";
import ViewportSettingsPanel from "./components/ViewportSettingsPanel";
import AutoLayoutSidePanel from "./components/AutoLayoutSidePanel";
import WalkthroughCharacterPanel from "./components/WalkthroughCharacterPanel";
// S.Layout 埋め込み AI チャット（選択中の Base/Plan/Option にスコープ固定）
import LayoutChatPanel from "./components/LayoutChatPanel";
// 断面図表示中の Properties 専用パネル（断面位置＋階/レベル設定）
import SectionPropertiesPanel from "./components/SectionPropertiesPanel.jsx";
// 展開図表示中の Properties 専用パネル（部屋・向き・天井高）
import ElevationPropertiesPanel from "./components/ElevationPropertiesPanel.jsx";
// 壁（内壁/外壁）を選択中の Properties
import WallPropertiesPanel from "./components/WallPropertiesPanel.jsx";
import { useWallStore } from "../../../store/useWallStore";
// 床（スラブ）を選択中の Properties
import SlabPropertiesPanel from "./components/SlabPropertiesPanel.jsx";
import { useSlabStore } from "../../../store/useSlabStore";
import { useSectionLinesStore } from "../../../store/useSectionLinesStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";
import { useElevationMarkerStore } from "../../../store/useElevationMarkerStore";
import { useRoomElevationsStore } from "../../../store/useRoomElevationsStore";
import StructureFacePanel from "./components/StructureFacePanel";
import { useStructureLabelStore } from "../../../store/useStructureLabelStore";
import { useAutoLayoutStore } from "../../../store/useAutoLayoutStore";
import { useLayoutTaskStore } from "../../../store/useLayoutTaskStore";
import { useAppStore } from "../../../../../../store/useAppStore";

const Section = React.forwardRef(({ title, children, explicitHeight, minHeight = 150 }, ref) => {
  return (
    <Box
      ref={ref}
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: explicitHeight ? `0 0 ${explicitHeight}px` : "1 1 0px",
      }}
    >
      {title && (
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontSize: 12, opacity: 0.86, fontWeight: 600 }}>{title}</Typography>
        </Box>
      )}

      <Box sx={{ minHeight, minWidth: 0, flex: "1 1 0px", overflow: "hidden" }}>{children}</Box>
    </Box>
  );
});

const Resizer = ({ onResize }) => {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent) => {
      onResize(moveEvent.clientY);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
  }, [onResize]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        height: 8,
        mt: "-4px",
        mb: "-4px",
        zIndex: 10,
        position: "relative",
        cursor: "ns-resize",
        "&:hover > .hover-bar": {
          backgroundColor: "#38bdf8",
        }
      }}
    >
      <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.05)", position: "absolute", top: 4, left: 0, right: 0, pointerEvents: 'none' }} />
      <Box className="hover-bar" sx={{ position: "absolute", top: 3, left: 0, right: 0, height: 2, transition: "background-color 0.2s", pointerEvents: 'none' }} />
    </Box>
  );
};

const RightSidebar = ({
  // 笨・驟咲ｽｮ繧｢繧､繝・Β・・utliner/Properties逕ｨ・・
  items = [],

  // 笨・LayoutDraft 繧呈峩譁ｰ縺励◆縺・�ｴ蜷・
  onChangeLayoutDraft,

  optionDoc,
  optionDocLoading,
  baseDoc,
  baseDocLoading,
  meta,

  // 笨・TopBar / MaterialPicker 蛛ｴ縺九ｉ貂｡縺・
  materialSelection = null,
  materialSelectionTick = 0,

  // context for ModelLibraryPanel
  projectId,
  workspaceId,
  selectedPlanId,
  selectedOptionId,

  // Base（パラメトリックルーム）編集
  isBaseOnly = false,
  /** 下絵を取り込み・調整できるノードか（Base か Plan。Option は継承表示のみ）。 */
  canUnderlay = false,
  roomSpec = null,
  hasBaseGlb = false,
  onUpdateRoomSpec,
  onCreateDefaultRoom,
}) => {
  // =========================
  // 笨・RightSidebar縺ｮ陦ｨ遉ｺ迥ｶ諷具ｼ・ustand・・
  // =========================
  const rawVisibleSections = useUiRightSidebarStore((s) => s.visibleSections);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const mode = useEditorModeStore((s) => s.editorMode);

  // 断面図表示中か（正射側面ビュー＋縦の断面クリップON）。Properties を断面専用内容に切替える。
  // 展開図（マーカー位置から壁面を見る姿図）も同じクリップ機構を使うが、断面図ではないので除外。
  const rsActiveViewportId = useViewportUiStore((s) => s.activeViewportId);
  const rsSectionClipOn = useEditorModeStore((s) => s.isSectionClipEnabled);
  const rsSectionClipY = useEditorModeStore((s) => s.sectionClipYEnabled);
  const rsElevationView = useElevationMarkerStore((s) => s.viewActive);
  const isSectionView =
    (rsActiveViewportId === "vp_front" || rsActiveViewportId === "vp_right") &&
    rsSectionClipOn && !rsSectionClipY && !rsElevationView;
  // 平面図（Top）で断面線を選択中 → Properties に断面線の設定（同じ専用パネル）を出す。
  const rsActiveSectionLineId = useSectionLinesStore((s) => s.activeLineId);
  const isSectionLineSelected = !!rsActiveSectionLineId && rsActiveViewportId === "vp_top";
  const showSectionProps = isSectionView || isSectionLineSelected;
  // 平面図（Top）で展開記号を選択中 → Properties にその部屋の展開一覧を出す。
  // 展開図を表示中（rsElevationView）も同じパネル（そちらは天井高も出る）。
  const rsElevRoomId = useRoomElevationsStore((s) => s.selectedRoomId);
  const isElevMarkerSelected = !!rsElevRoomId && rsActiveViewportId === "vp_top";
  const showElevationProps = rsElevationView || isElevMarkerSelected;
  // 壁を選択中 → Properties に壁の設定を出す（断面/展開の専用表示より優先）。
  const rsSelectedWallId = useWallStore((s) => s.selectedWallId);
  const showWallProps = !!rsSelectedWallId;
  // 床（スラブ）を選択中 → Properties に床の設定を出す。
  const rsSelectedSlabId = useSlabStore((s) => s.selectedSlabId);
  const showSlabProps = !showWallProps && !!rsSelectedSlabId;

  // ── 右サイドバー上部の切替タブ（旧・右ドックのボタン群を移設。1枚ずつ排他切替） ──
  const rightPanels = useUiRightSidebarStore((s) => s.rightPanels);
  const toggleExclusive = useUiRightSidebarStore((s) => s.toggleRightPanelExclusive);
  const editorViewGroup = useEditorModeStore((s) => s.editorViewGroup);
  const isViewGroup2D = editorViewGroup === "2d";
  const switcherTabs = useMemo(() => {
    const tabs = [
      { key: "projectHierarchy", label: "Project 階層（Base/Plan/Option）", Icon: DashboardCustomizeRoundedIcon },
      { key: "scene", label: "Scene（アウトライナー）", Icon: AccountTreeRoundedIcon },
      { key: "properties", label: "Properties", Icon: TuneRoundedIcon },
      { key: "library", label: "ライブラリ", Icon: FolderOpenRoundedIcon },
      { key: "chat", label: "AI チャット（選択中の Base/Plan/Option と議論）", Icon: ForumRoundedIcon },
    ];
    // History は 3D 演出グループのみ / Map は 2D 配置グループのみ
    if (!isViewGroup2D) tabs.push({ key: "history", label: "History（生成履歴）", Icon: PhotoLibraryRoundedIcon });
    if (isViewGroup2D) tabs.push({ key: "map", label: "マップ（敷地に航空写真）", Icon: MapRoundedIcon, isMode: true });
    // 下絵は Base か Plan に紐づく（Option は継承して表示するだけなので調整させない）。
    if (canUnderlay) tabs.push({ key: "underlay", label: "下絵（PDF/画像をトレース）", Icon: ImageRoundedIcon });
    tabs.push({ key: "viewportSettings", label: "ビューポート設定", Icon: SettingsRoundedIcon });
    return tabs;
  }, [isViewGroup2D, canUnderlay]);

  // 下絵を扱えないノード（Option）へ移ったらパネルを閉じる
  // （タブが消えて閉じられなくなるのを防ぐ）。
  useEffect(() => {
    if (!canUnderlay) setRightPanel("underlay", false);
  }, [canUnderlay, setRightPanel]);

  // Material モードは Scene ツリーを隠し、Properties（面マテリアル設定）のみ表示する
  // Map モードは Map パネルのみを表示する
  // ただし「ビューポート設定」は常設なので、これらの専用モードでも開いていれば末尾に出す
  // （どのモード/画面からでも断面・グリッド等を操作できるように）。
  const visibleSections = useMemo(() => {
    // Material モードでは Library（マテリアル/家具の選択元）も開いていれば表示する
    const base =
      mode === "material"
        ? ["properties", ...(rawVisibleSections.includes("library") ? ["library"] : [])]
        : mode === "map" ? ["map"] : rawVisibleSections;
    if ((mode === "material" || mode === "map") && rawVisibleSections.includes("viewportSettings") && !base.includes("viewportSettings")) {
      return [...base, "viewportSettings"];
    }
    return base;
  }, [mode, rawVisibleSections]);

  // AI 家具選定（旧・左サイドバー Library ヘッダーの機能を移設）:
  // SEKKEIYA Chat を開き、選択中の Plan のための家具選定メッセージを送信する。
  const handleSelectFurniture = useCallback(() => {
    const aiChat = useAIChatStore.getState();
    let sessionId = aiChat.activeSessionId;
    const activeProjectId = useAppStore.getState().activeProjectId;
    if (!sessionId) sessionId = aiChat.createSession(activeProjectId || "default");
    useAppStore.getState().setAIChatOpen(true);

    const st = useWorkspaceStructureStore.getState();
    const baseName = (st.bases || []).find((b) => b?.id === st.selectedBaseId)?.name || "";
    const planName = (st.plansOfSelectedBase || []).find((p) => p?.id === st.selectedPlanId)?.name || "";
    const target = [baseName, planName].filter(Boolean).join(" / ");
    const msg = planName
      ? `現在開いているプラン「${target}」のための家具を選定し、このプロジェクトに追加してください。部屋の用途・スタイルに合った最適な家具を提案してください。`
      : `現在開いている躯体${baseName ? `「${baseName}」` : ""}のプランのための家具を選定し、このプロジェクトに追加してください。まずプランを選択するか、最適な家具を提案してください。`;
    useCoreOrchestrator.getState().sendMessageToOrchestrator(msg, { source: "sidebar_chat", sessionId });
  }, []);

  // 躯体の面ラベル選択（床/壁/天井）。選択中は Properties に面ラベル設定を表示する。
  const faceSelectionCount = useStructureLabelStore((s) => Object.keys(s.selection).length);
  const hasFaceSelection = faceSelectionCount > 0;

  // 笨・Properties 縺ｮ selection・・ustand・・
  const selection = useUiPropertiesSelectionStore((s) => s.selection);
  const selectItem = useUiPropertiesSelectionStore((s) => s.selectItem);
  const selectMaterial = useUiPropertiesSelectionStore((s) => s.selectMaterial);
  const selectLight = useUiPropertiesSelectionStore((s) => s.selectLight);
  const selectLandscape = useUiPropertiesSelectionStore((s) => s.selectLandscape);

  // 笨・Outliner expanded・・ustand・・
  const expanded = useUiSceneOutlinerStore((s) => s.expanded);
  const setExpanded = useUiSceneOutlinerStore((s) => s.setExpanded);
  const resetExpanded = useUiSceneOutlinerStore((s) => s.resetExpanded);

  // 笨・驕ｸ謚槭い繧､繝・Β・・ustand・俄ｻ 逵溷ｮ溘・驟榊・
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const setSelectedItemId = useUiSelectionStore((s) => s.setSelectedItemId);

  // 笨・莠呈鋤(primary)
  const selectedItemId = useMemo(() => selectedItemIds?.[0] ?? null, [selectedItemIds]);

  // =========================
  // 笨・Outliner逕ｨ繝・・繧ｿ・・桃菴・
  // =========================
  const { tree, isVisible, toggleVisible } = useSceneOutlinerTree({
    items,
    optionDoc,
    optionDocLoading,
    baseDoc,
    baseDocLoading,
    meta,
  });

  // =========================
  // 笨・辟｡髯先峩譁ｰ縺ｮ豁｢陦・啼xpanded 縺悟酔縺倥↑繧・setExpanded 縺励↑縺・
  // =========================
  const handleExpandedChange = useCallback(
    (nextExpanded) => {
      const curr = useUiSceneOutlinerStore.getState().expanded;

      // 縺ｩ縺｡繧峨ｂ驟榊・縺ｧ蜷御ｸ蜀・ｮｹ縺ｪ繧画峩譁ｰ縺励↑縺・ｼ域怙螟ｧ譖ｴ譁ｰ豺ｱ蠎ｦ縺ｮ蜴溷屏繧帝・譁ｭ・・
      if (Array.isArray(curr) && Array.isArray(nextExpanded)) {
        if (curr.length === nextExpanded.length && curr.every((v, i) => v === nextExpanded[i])) {
          return;
        }
      }

      setExpanded(nextExpanded);
    },
    [setExpanded]
  );

  // option 縺悟､峨ｏ縺｣縺溘ｉ蛻･繧ｷ繝ｼ繝ｳ縺ｨ縺ｿ縺ｪ縺励※髢矩哩迥ｶ諷九ｒ蛻晄悄蛹・
  useEffect(() => {
    resetExpanded();
  }, [optionDoc?.id, resetExpanded]);

  // item 驕ｸ謚槭′螟峨ｏ縺｣縺溘ｉ Properties 繧・item 陦ｨ遉ｺ縺ｫ謌ｻ縺呻ｼ・aterial陦ｨ遉ｺ繧定ｧ｣髯､・・
  useEffect(() => {
    if (!selectedItemId) {
      const currentSelection = useUiPropertiesSelectionStore.getState().selection;
      if (currentSelection?.kind === "item") {
        selectItem(null);
      }
      return;
    }
    selectItem(selectedItemId);
    setRightPanel("properties", true);
    // アイテムを選んだら面ラベル選択・自動○○専用パネルは解除（Properties をアイテムに切り替える）
    useStructureLabelStore.getState().clearSelection();
    useAutoActionStore.getState().setActiveSide(null);
    useAutoActionStore.getState().setSelectedAuto(null);
  }, [selectedItemId, selectItem, setRightPanel]);

  // TopBar / MaterialPicker 縺九ｉ materialSelection 縺梧擂縺溘ｉ material 陦ｨ遉ｺ縺ｫ蛻・崛
  useEffect(() => {
    if (!materialSelection) return;
    selectMaterial(materialSelection);
    setRightPanel("properties", true);
  }, [materialSelectionTick, materialSelection, selectMaterial, setRightPanel]);

  // Outliner 縺ｧ item 繧帝∈繧薙□繧・store 繧呈峩譁ｰ
  const handleSelectNode = useCallback(
    (nodeId) => {
      if (typeof nodeId === "string" && nodeId.startsWith("item:")) {
        const id = nodeId.slice("item:".length) || null;
        setSelectedItemId(id);
        selectItem(id);
      } else if (nodeId === "scene:ambience") {
        // Ambience = hemisphere light (id: "ambience")
        setSelectedItemId(null);
        selectLight("ambience");
        setRightPanel("properties", true);
      } else if (typeof nodeId === "string" && nodeId.startsWith("light:")) {
        const lightId = nodeId.slice("light:".length) || null;
        setSelectedItemId(null);
        selectLight(lightId);
        setRightPanel("properties", true);
      } else if (nodeId === "scene:landscape-flat") {
        setSelectedItemId(null);
        selectLandscape("flat");
        setRightPanel("properties", true);
      } else if (nodeId === "scene:landscape-sky") {
        setSelectedItemId(null);
        selectLandscape("sky");
        setRightPanel("properties", true);
      }
    },
    [setSelectedItemId, selectItem, selectLight, selectLandscape, setRightPanel]
  );

  // PropertiesPanel 蛛ｴ・・aterials縺ｮChip繧ｯ繝ｪ繝・け・峨°繧・material 蛻・崛
  const handleSelectMaterial = useCallback(
    (payload) => {
      if (!payload) return;
      selectMaterial(payload);
    },
    [selectMaterial]
  );

  // Outliner ID — item OR light OR landscape
  const selectedNodeId = useMemo(() => {
    if (selectedItemId) return `item:${selectedItemId}`;
    if (selection?.kind === "light") {
      const lId = selection.lightId;
      if (lId === "ambience") return "scene:ambience";
      return `light:${lId}`;
    }
    if (selection?.kind === "landscape") {
      return selection.target === "sky" ? "scene:landscape-sky" : "scene:landscape-flat";
    }
    return null;
  }, [selectedItemId, selection]);

  // =========================
  // Resize logic
  // =========================
  const containerRef = React.useRef(null);
  const [topSectionHeight, setTopSectionHeight] = React.useState(null);

  const handleResize = useCallback((clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newHeight = clientY - rect.top;
    const minHeight = 150;
    const maxHeight = rect.height - 150;
    setTopSectionHeight(Math.max(minHeight, Math.min(newHeight, maxHeight)));
  }, []);

  const handleAddZone = useCallback((newZone) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("LayoutShell:AddZone", { detail: newZone }));
    }
  }, []);

  // 選択中ゾーン（ゾーンの Properties 表示に使用）
  const activeZoneIdForPanel = useLayoutTaskStore((s) => s.activeZoneId);
  const zonesForPanel = useLayoutTaskStore((s) => s.zones);
  const activeZoneForPanel = useMemo(
    () => zonesForPanel.find((z) => z.id === activeZoneIdForPanel) ?? null,
    [zonesForPanel, activeZoneIdForPanel],
  );

  // ボトムの Media パネルが開いている間は Properties を Media 設定として使う
  const mediaDockOpen      = useMediaSettingsStore((s) => s.mediaDockOpen);
  const autoLayoutDockOpen = useAutoLayoutStore((s) => s.autoLayoutDockOpen);
  // 自動マテリアル/家具/ラベル/ライティングのクリックで開く専用パネルの種別
  const autoSide           = useAutoActionStore((s) => s.activeSide);
  // Label モード中は、ビューポートクリックで selectedAuto/activeSide がクリアされても
  // 右サイドバーは常に「自動ラベル」パネルを出す（面解除後も Label の内容に戻す）。
  const effectiveAutoSide  = mode === "label" ? "autoLabel" : autoSide;
  // ★メニューで選択中の自動アクション（autoLayout は AutoLayoutSidePanel を出す）
  const selectedAuto       = useAutoActionStore((s) => s.selectedAuto);

  const renderContextPanel = useCallback(() => {
    // ゾーン選択中 → ゾーン設定パネル（最優先）
    if (activeZoneForPanel) {
      return <ZonePropertiesPanel zone={activeZoneForPanel} />;
    }
    // レイアウトを開いていれば（Base のみでも）「用途 / 部屋・ゾーン / 導線」ツリーを既定表示。
    // 躯体編集（Base のみ表示）中は、その下に面ラベル表示・部屋寸法の Base パネルを続けて出す。
    if (optionDoc || optionDocLoading) {
      return (
        <>
          <OptionDetailPanel optionDoc={optionDoc} optionDocLoading={optionDocLoading} onAddZone={handleAddZone} />
          {isBaseOnly && (
            <BaseRoomPanel
              roomSpec={roomSpec}
              hasBaseGlb={hasBaseGlb}
              onUpdateRoomSpec={onUpdateRoomSpec}
              onCreateDefaultRoom={onCreateDefaultRoom}
            />
          )}
        </>
      );
    }
    // レイアウト未オープンで躯体編集だけしている場合（通常は起きない）
    if (isBaseOnly) {
      return (
        <BaseRoomPanel
          roomSpec={roomSpec}
          hasBaseGlb={hasBaseGlb}
          onUpdateRoomSpec={onUpdateRoomSpec}
          onCreateDefaultRoom={onCreateDefaultRoom}
        />
      );
    }
    return (
      <Box sx={{ p: 2 }}>
        <Typography fontSize={12} sx={{ opacity: 0.7 }}>No Layout selected.</Typography>
      </Box>
    );
  }, [activeZoneForPanel, isBaseOnly, roomSpec, hasBaseGlb, onUpdateRoomSpec, onCreateDefaultRoom, optionDoc, optionDocLoading, handleAddZone]);

  const noItemSelected =
    !selectedItemId &&
    selection?.kind !== "libraryModel" &&
    selection?.kind !== "material" &&
    selection?.kind !== "light" &&
    selection?.kind !== "landscape";

  // Media（自動パース/動画）選択中またはパネル展開中、かつアイテム未選択なら
  // Properties 全体を Media 用設定パネルとして使う
  const showMediaSettings = (mediaDockOpen || selectedAuto === "autoRender" || selectedAuto === "autoMovie") && noItemSelected;

  // Auto Layout 選択中（★メニュー）またはパネル展開中、かつアイテム未選択なら
  // Properties 全体を Auto Layout 設定パネルとして使う
  const showAutoLayoutSettings = (autoLayoutDockOpen || selectedAuto === "autoLayout") && noItemSelected;

  // 自動家具選定（★メニュー）選択中、かつアイテム未選択なら選定レビューパネルを使う
  const showSelectionSettings = selectedAuto === "autoSelect" && noItemSelected;

  // AI実行（おまかせ）選択中、かつアイテム未選択なら AI 設定パネルを使う
  const showAiSettings = selectedAuto === "autoAI" && noItemSelected;

  // 自動マテリアル/家具/ラベル/ライティングの専用パネル表示
  const showAutoSide = !!effectiveAutoSide && noItemSelected && !hasFaceSelection;

  // Zone モード（editorMode="zoning"）かつ個別ゾーン未選択なら、ゾーン一覧／操作パネルを出す。
  // 個別ゾーン選択中（activeZoneForPanel）は renderContextPanel の ZonePropertiesPanel が優先。
  const showZoneSettings = mode === "zoning" && noItemSelected && !hasFaceSelection && !activeZoneForPanel;

  return (
    <Box
      ref={containerRef}
      data-auto-keep="1"
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* ── 上部の切替タブ（旧・右ドック）。クリックで1枚ずつ排他切替 ── */}
      <Box
        sx={{
          display: "flex", alignItems: "center", gap: 0.25,
          px: 0.75, py: 0.5, flexShrink: 0,
          borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.08)",
        }}
      >
        {switcherTabs.map(({ key, label, Icon, isMode }) => {
          const active = isMode ? mode === "map" : !!rightPanels?.[key];
          return (
            <Tooltip key={key} title={label} placement="bottom" arrow>
              <IconButton
                size="small"
                onClick={() => (isMode ? toggleMapMode() : toggleExclusive(key))}
                sx={{
                  width: 30, height: 30, borderRadius: 1.5,
                  color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.55)",
                  bgcolor: active ? "rgba(56,189,248,0.22)" : "transparent",
                  border: active ? "1px solid rgba(56,189,248,0.5)" : "1px solid transparent",
                  "&:hover": { bgcolor: active ? "rgba(56,189,248,0.3)" : "rgb(var(--brand-fg-rgb) / 0.08)" },
                }}
              >
                <Icon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {visibleSections.length === 0 && (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", px: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: 12, color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
            上のタブからパネルを開いてください
          </Typography>
        </Box>
      )}

      {visibleSections.map((key, i) => {
        const isLast = i === visibleSections.length - 1;
        const isOnly = visibleSections.length === 1;
        const passExplicitHeight = !isOnly && i === 0; // The first panel gets the explicit height when split

        if (key === "projectHierarchy") {
          return (
            <React.Fragment key={key}>
              <Section
                title="Project"
                minHeight={150}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <EditorBasePlanOptionTree />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "scene") {
          return (
            <React.Fragment key={key}>
              <Section 
                title="Scene" 
                minHeight={150} 
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <SceneOutlinerPanel
                  tree={tree}
                  expanded={expanded}
                  onExpandedChange={handleExpandedChange}
                  isVisible={isVisible}
                  onToggleVisible={toggleVisible}
                  selectedId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                  onFocusNode={(id) => console.log("Focus", id)}
                  onRenameNode={(id) => console.log("Rename", id)}
                  onDuplicateNode={(id) => console.log("Duplicate", id)}
                  onGroupSelected={(id) => console.log("Group selection target:", id)}
                  onUngroupNode={(id) => console.log("Ungroup", id)}
                  onDeleteNode={(id) => console.log("Delete", id)}
                />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "properties") {
          return (
            <React.Fragment key={key}>
              <Section
                title={showWallProps ? "壁" : showSlabProps ? "床" : rsElevationView ? "展開図" : showSectionProps ? (isSectionView ? "断面図" : "断面線") : hasFaceSelection ? "面ラベル / コリジョン" : showZoneSettings ? "ゾーン" : (selectedItemId || selection?.kind === "light" || selection?.kind === "landscape" || activeZoneForPanel || showMediaSettings || showAutoLayoutSettings || showSelectionSettings || showAiSettings || showAutoSide) ? "Properties" : null}
                minHeight={150}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                {showWallProps ? (
                  <WallPropertiesPanel />
                ) : showSlabProps ? (
                  <SlabPropertiesPanel />
                ) : showElevationProps ? (
                  <ElevationPropertiesPanel />
                ) : showSectionProps ? (
                  <SectionPropertiesPanel />
                ) : hasFaceSelection ? (
                  <StructureFacePanel />
                ) : showZoneSettings ? (
                  <ZoneListPanel />
                ) : showAiSettings ? (
                  <AutoAiSidePanel />
                ) : showAutoSide ? (
                  <AutoActionSidePanel kind={effectiveAutoSide} />
                ) : showSelectionSettings ? (
                  <FurnitureSelectionPanel />
                ) : showAutoLayoutSettings ? (
                  <AutoLayoutSidePanel />
                ) : showMediaSettings ? (
                  selectedAuto === "autoRender" ? <MediaStillSettingsPanel /> : <MediaSettingsPanel />
                ) : (
                  <PropertiesPanel
                    selection={selection}
                    selectedItemIds={selectedItemIds}
                    items={items}
                    onChangeItems={(nextItems) => {
                      onChangeLayoutDraft?.((prev) => ({
                        ...(prev || optionDoc?.layout || { items: [] }),
                        items: nextItems,
                      }));
                    }}
                    onSelectMaterial={handleSelectMaterial}
                    contextPanel={(!selectedItemId && selection?.kind !== "libraryModel" && selection?.kind !== "material" && selection?.kind !== "light" && selection?.kind !== "landscape") ? renderContextPanel() : null}
                  />
                )}
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "library") {
          return (
            <React.Fragment key={key}>
              <Section
                title="Library"
                minHeight={200}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {/* AI 家具選定（旧・左サイドバー Library ヘッダーの機能を移設） */}
                  <Box sx={{ px: 1.25, py: 0.5, display: "flex", justifyContent: "flex-end", borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.05)", flexShrink: 0 }}>
                    <Tooltip title="AI で家具を選定（選択中のプランに追加）" placement="top">
                      <IconButton
                        size="small"
                        onClick={handleSelectFurniture}
                        sx={{
                          color: "light-dark(#2705a9, #c4b5fd)", padding: "2px", borderRadius: 1,
                          bgcolor: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)",
                          "&:hover": { bgcolor: "rgba(124,58,237,0.3)" },
                        }}
                      >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <LibraryPanelShell
                      projectId={projectId}
                      workspaceId={workspaceId}
                      planId={selectedPlanId}
                    />
                  </Box>
                </Box>
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }


        if (key === "history") {
          return (
            <React.Fragment key={key}>
              <Section
                title="History"
                minHeight={150}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <HistoryPanel />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "map") {
          return (
            <React.Fragment key={key}>
              <Section
                title="マップ（敷地に航空写真）"
                minHeight={200}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <MapPanel />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "underlay") {
          return (
            <React.Fragment key={key}>
              <Section
                title="下絵（PDF/画像をトレース）"
                minHeight={200}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <UnderlayPanel />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "autoLayout") {
          return (
            <React.Fragment key={key}>
              <Section
                title="Auto Layout"
                minHeight={200}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <AutoLayoutSidePanel projectId={projectId} />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "characters") {
          return (
            <React.Fragment key={key}>
              <Section
                title="Character"
                minHeight={180}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <WalkthroughCharacterPanel />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "chat") {
          return (
            <React.Fragment key={key}>
              <Section
                title="AI チャット"
                minHeight={260}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <LayoutChatPanel projectId={projectId} />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        if (key === "viewportSettings") {
          return (
            <React.Fragment key={key}>
              <Section
                title="ビューポート設定"
                minHeight={220}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                <ViewportSettingsPanel />
              </Section>
              {!isLast && <Resizer onResize={handleResize} />}
            </React.Fragment>
          );
        }

        // Remove board logic
        return null;
      })}

    </Box>
  );
};

export default RightSidebar;
