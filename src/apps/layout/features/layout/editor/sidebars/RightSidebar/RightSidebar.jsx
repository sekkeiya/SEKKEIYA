// src/features/layout/components/RightSidebar/RightSidebar.jsx
import React, { useCallback, useEffect, useMemo } from "react";
import { Box, Divider, Typography } from "@mui/material";

import PropertiesPanel from "./components/PropertiesPanel";
import SceneOutlinerPanel from "./components/SceneOutlinerPanel";
import { useSceneOutlinerTree } from "./hooks/useSceneOutlinerTree";
import BoardPanel from "./components/BoardPanel";
import ModelLibraryPanel from "../LeftSidebar/components/ModelLibraryPanel";

import { useUiRightSidebarStore } from "@layout/features/layout/store/uiRightSidebarStore";
import { useUiPropertiesSelectionStore } from "@layout/features/layout/store/uiPropertiesSelectionStore";
import { useUiSceneOutlinerStore } from "@layout/features/layout/store/uiSceneOutlinerStore";
import { useUiSelectionStore } from "@layout/features/layout/store/uiSelectionStore";

const Section = ({ title, children, grow = true, minHeight = 180 }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: grow ? "1 1 auto" : "0 0 auto",
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: 12, opacity: 0.86, fontWeight: 600 }}>{title}</Typography>
      </Box>

      <Box sx={{ minHeight, minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>{children}</Box>
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
}) => {
  // =========================
  // 笨・RightSidebar縺ｮ陦ｨ遉ｺ迥ｶ諷具ｼ・ustand・・
  // =========================
  const visibleSections = useUiRightSidebarStore((s) => s.visibleSections);

  // 笨・Properties 縺ｮ selection・・ustand・・
  const selection = useUiPropertiesSelectionStore((s) => s.selection);
  const selectItem = useUiPropertiesSelectionStore((s) => s.selectItem);
  const selectMaterial = useUiPropertiesSelectionStore((s) => s.selectMaterial);

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
      selectItem(null);
      return;
    }
    selectItem(selectedItemId);
  }, [selectedItemId, selectItem]);

  // TopBar / MaterialPicker 縺九ｉ materialSelection 縺梧擂縺溘ｉ material 陦ｨ遉ｺ縺ｫ蛻・崛
  useEffect(() => {
    if (!materialSelection) return;
    selectMaterial(materialSelection);
  }, [materialSelectionTick, materialSelection, selectMaterial]);

  // Outliner 縺ｧ item 繧帝∈繧薙□繧・store 繧呈峩譁ｰ
  const handleSelectNode = useCallback(
    (nodeId) => {
      if (typeof nodeId === "string" && nodeId.startsWith("item:")) {
        const id = nodeId.slice("item:".length) || null;

        // 笨・Outliner繧ｯ繝ｪ繝・け縺ｯ縲悟腰菴馴∈謚槭阪↓縺吶ｋ・域里蟄篭X・・
        setSelectedItemId(id);

        // 笨・Properties 縺ｯ item 縺ｫ謌ｻ縺・
        selectItem(id);
      }
    },
    [setSelectedItemId, selectItem]
  );

  // PropertiesPanel 蛛ｴ・・aterials縺ｮChip繧ｯ繝ｪ繝・け・峨°繧・material 蛻・崛
  const handleSelectMaterial = useCallback(
    (payload) => {
      if (!payload) return;
      selectMaterial(payload);
    },
    [selectMaterial]
  );

  // Outliner ID
  const selectedNodeId = selectedItemId ? `item:${selectedItemId}` : null;

  return (
    <Box
      sx={{
        width: 340,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
        bgcolor: "rgba(20, 20, 24, 0.92)",
        backdropFilter: "blur(10px)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {visibleSections.map((key, i) => {
        const isLast = i === visibleSections.length - 1;

        if (key === "scene") {
          return (
            <React.Fragment key={key}>
              <Section title="Scene" minHeight={220} grow>
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
              {!isLast && <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}
            </React.Fragment>
          );
        }

        if (key === "properties") {
          return (
            <React.Fragment key={key}>
              <Section title="Properties" minHeight={220} grow>
                <PropertiesPanel
                  selection={selection}
                  items={items}
                  onChangeItems={(nextItems) => {
                    onChangeLayoutDraft?.((prev) => ({
                      ...(prev || optionDoc?.layout || { items: [] }),
                      items: nextItems,
                    }));
                  }}
                  onSelectMaterial={handleSelectMaterial}
                />
              </Section>
              {!isLast && <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}
            </React.Fragment>
          );
        }

        if (key === "library") {
           return (
             <React.Fragment key={key}>
               <Section title="Library (Models)" minHeight={220} grow>
                  <ModelLibraryPanel
                    projectId={projectId}
                    workspaceId={workspaceId}
                    planId={selectedPlanId}
                  />
               </Section>
               {!isLast && <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}
             </React.Fragment>
           );
        }

        // key === "board" 想定
        return (
          <React.Fragment key={key}>
            <Section title="Board" minHeight={200} grow>
              <BoardPanel />
            </Section>
            {!isLast && <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default RightSidebar;
