// src/features/layout/components/RightSidebar/RightSidebar.jsx
import React, { useCallback, useEffect, useMemo } from "react";
import { Box, Divider, Typography } from "@mui/material";

import PropertiesPanel from "./components/PropertiesPanel";
import SceneOutlinerPanel from "./components/SceneOutlinerPanel";
import { useSceneOutlinerTree } from "./hooks/useSceneOutlinerTree";
import ModelLibraryPanel from "../LeftSidebar/components/ModelLibraryPanel";

import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";
import { useUiPropertiesSelectionStore } from "@desktop/features/dsl/layout/store/uiPropertiesSelectionStore";
import { useUiSceneOutlinerStore } from "@desktop/features/dsl/layout/store/uiSceneOutlinerStore";
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { useWorkspaceStructureStore } from "@desktop/features/dsl/layout/store/useWorkspaceStructureStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

import OptionDetailPanel from "./components/ContextPanels/OptionDetailPanel";
import HistoryPanel from "./components/HistoryPanel";

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
            borderBottom: "1px solid rgba(255,255,255,0.05)",
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
      <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", position: "absolute", top: 4, left: 0, right: 0, pointerEvents: 'none' }} />
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
}) => {
  // =========================
  // 笨・RightSidebar縺ｮ陦ｨ遉ｺ迥ｶ諷具ｼ・ustand・・
  // =========================
  const rawVisibleSections = useUiRightSidebarStore((s) => s.visibleSections);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const mode = useEditorModeStore((s) => s.editorMode);

  const visibleSections = rawVisibleSections;

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

  const renderContextPanel = useCallback(() => {
    if (selectedOptionId) {
      return <OptionDetailPanel optionDoc={optionDoc} optionDocLoading={optionDocLoading} onAddZone={handleAddZone} />;
    }
    return (
      <Box sx={{ p: 2 }}>
        <Typography fontSize={12} sx={{ opacity: 0.7 }}>No Layout selected.</Typography>
      </Box>
    );
  }, [selectedOptionId, optionDoc, optionDocLoading, handleAddZone]);

  return (
    <Box
      ref={containerRef}
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
                title={(selectedItemId || selection?.kind === "light" || selection?.kind === "landscape") ? "Properties" : null}
                minHeight={150}
                explicitHeight={passExplicitHeight ? topSectionHeight : null}
              >
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

        // Remove board logic
        return null;
      })}
    </Box>
  );
};

export default RightSidebar;
