// src/features/layout/components/RightSidebar/RightSidebar.jsx
import React, { useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Box, Divider, Typography } from "@mui/material";

import PropertiesPanel from "./components/PropertiesPanel";
import SceneOutlinerPanel from "./components/SceneOutlinerPanel";
import { useSceneOutlinerTree } from "./hooks/useSceneOutlinerTree";
import ModelLibraryPanel from "../LeftSidebar/components/ModelLibraryPanel";

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
import ViewportSettingsPanel from "./components/ViewportSettingsPanel";
import AutoLayoutSidePanel from "./components/AutoLayoutSidePanel";
import WalkthroughCharacterPanel from "./components/WalkthroughCharacterPanel";
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

  // Material モードは Scene ツリーを隠し、Properties（面マテリアル設定）のみ表示する
  // Map モードは Map パネルのみを表示する
  // ただし「ビューポート設定」は常設なので、これらの専用モードでも開いていれば末尾に出す
  // （どのモード/画面からでも断面・グリッド等を操作できるように）。
  const visibleSections = useMemo(() => {
    const base =
      mode === "material" ? ["properties"] : mode === "map" ? ["map"] : rawVisibleSections;
    if ((mode === "material" || mode === "map") && rawVisibleSections.includes("viewportSettings") && !base.includes("viewportSettings")) {
      return [...base, "viewportSettings"];
    }
    return base;
  }, [mode, rawVisibleSections]);

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
    // Base（躯体）選択中 → 部屋寸法の編集パネル（roomSpec が無ければ作成 CTA）
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
    if (selectedOptionId) {
      return <OptionDetailPanel optionDoc={optionDoc} optionDocLoading={optionDocLoading} onAddZone={handleAddZone} />;
    }
    return (
      <Box sx={{ p: 2 }}>
        <Typography fontSize={12} sx={{ opacity: 0.7 }}>No Layout selected.</Typography>
      </Box>
    );
  }, [activeZoneForPanel, isBaseOnly, roomSpec, hasBaseGlb, onUpdateRoomSpec, onCreateDefaultRoom, selectedOptionId, optionDoc, optionDocLoading, handleAddZone]);

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
      {visibleSections.map((key, i) => {
        const isLast = i === visibleSections.length - 1;
        const isOnly = visibleSections.length === 1;
        const passExplicitHeight = !isOnly && i === 0; // The first panel gets the explicit height when split

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
                title={hasFaceSelection ? "面ラベル / コリジョン" : showZoneSettings ? "ゾーン" : (selectedItemId || selection?.kind === "light" || selection?.kind === "landscape" || activeZoneForPanel || showMediaSettings || showAutoLayoutSettings || showSelectionSettings || showAiSettings || showAutoSide) ? "Properties" : null}
                minHeight={150}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
                {hasFaceSelection ? (
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
