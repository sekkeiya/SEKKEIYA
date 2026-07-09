import React, { useCallback, useState } from "react";
import { Grid, Box, Typography, Stack, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { getItemDisplayLabel } from "../../../../../utils/labels/itemLabelUtils";
import { TYPES } from "../../../../../../../../shared/data/Categories";
import { useUiPropertiesSelectionStore } from "../../../../../store/uiPropertiesSelectionStore";
import { useUiRightSidebarStore } from "../../../../../store/uiRightSidebarStore";
import LibraryAssetCard from "./LibraryAssetCard";

export default function LibraryAssetGrid({ models, modelTitleMap, planIds, tab, path, cardSize }) {
  const theme = useTheme();
  const { selection, setSelection } = useUiPropertiesSelectionStore();
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const [hoveredId, setHoveredId] = useState(null);
  const [loadingCardId, setLoadingCardId] = useState(null);

  const getModelType = (m) => m?.type || m?.categoryType || m?.modelType;
  const getModelSubType = (m) => m?.subType || m?.archSubType;
  const getModelGroupLabel = (m) => m?.group || m?.categoryGroup || m?.category;

  const buildDragPayload = useCallback(
    (m) => {
      const modelId = m?.id;
      const displayName = getItemDisplayLabel(
        { id: modelId, modelId, name: m?.name, title: m?.title },
        modelTitleMap
      );

      let determinedType = getModelType(m);
      let determinedSubType = getModelSubType(m);
      let determinedGroup = getModelGroupLabel(m);

      if (path && path.length > 0) {
        if (!determinedType && path[0].type) determinedType = path[0].type;
        if (!determinedSubType && path[0].subType) determinedSubType = path[0].subType;
      }
      if (path && path.length > 1) {
        if (!determinedGroup) determinedGroup = path[1].label;
      }

      return {
        kind: "model",
        dragId: `drag_${modelId || "unknown"}_${Date.now()}`,
        modelId,
        label: displayName || modelId,
        name: displayName || modelId,
        brand: m?.brand || "",
        ownerHandle: m?.ownerHandle || "",
        source: tab === "project" ? "project" : "public",
        type: determinedType || TYPES.FURNITURE,
        subType: determinedSubType || "",
        group: determinedGroup || "",
        thumbUrl: m?.thumbUrl || m?.thumbnailUrl || null,
        glbUrl: m?.glbUrl || m?.downloadUrl || null,
        dimensionsMm: m?.dimensionsMm || m?.dimensions || null,
        dimensionSource: m?.dimensionSource || null,
        // ウォークスルーのギミック定義（S.Model の extendedMetadata 由来）を引き継ぐ（複数対応）
        gimmicks: m?.extendedMetadata?.gimmicks || m?.gimmicks || null,
        gimmick: m?.extendedMetadata?.gimmick || m?.gimmick || null, // 後方互換
        // 常時アニメ（回転/往復）とアイテム情報（ⓘ）も引き継ぐ
        anim: m?.extendedMetadata?.anim || m?.anim || null,
        info: m?.extendedMetadata?.info || m?.info || null,
        // 家具置き換え候補（同カテゴリの他モデル）も引き継ぐ
        swapModels: m?.extendedMetadata?.swapModels || m?.swapModels || null,
        // マテリアル・パターン（家具まるごとの素材切替）も引き継ぐ
        materialPresets: m?.materialPresets || null,
        materialVariants: m?.materialVariants || null,
      };
    },
    [tab, modelTitleMap, path]
  );

  const handleDragStart = useCallback(
    (e, m) => {
      if (!e?.dataTransfer) return;
      const payload = buildDragPayload(m);
      if (!payload.modelId) return;

      try {
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
        e.dataTransfer.setData("application/sekkeiya-asset", JSON.stringify(m)); // Added for 3DSP compatibility
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", payload.modelId);
        if (e.currentTarget) {
          e.currentTarget.dataset.dragging = "true";
        }
      } catch (err) {
        console.warn("[LibraryAssetGrid] dragStart failed:", err);
      }
    },
    [buildDragPayload]
  );

  const handleDragEnd = useCallback((e) => {
    if (e.currentTarget) {
      e.currentTarget.dataset.dragging = "false";
      e.currentTarget.removeAttribute("data-dragging");
    }
  }, []);

  if (!models || models.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: 200, opacity: 0.3 }}>
        <Inventory2RoundedIcon sx={{ fontSize: 40, mb: 2 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>No Assets Found</Typography>
      </Stack>
    );
  }

  const isFluid = !cardSize;
  const sizeMap = {
    compact: 100,
    default: 160,
    large: 260
  };
  const fixedSize = sizeMap[cardSize] || 160;

  const renderCard = (m, modelId, displayName, thumbUrl, isSelected, inPlan) => {
    // クリック時は選択のみ行い、2回目で配置するロジックは完全削除
    const handleClick = () => {
       setSelection({ kind: "libraryModel", model: m });
       setRightPanel("properties", true);
    };

    // 配置ボタンのクリック
    const handleAddClick = (e) => {
      e.stopPropagation(); // 親の onClick を発火させない
      if (loadingCardId === modelId) return; // ignore if already loading
      
      setLoadingCardId(modelId);
      const payload = buildDragPayload(m);
      if (payload.modelId) {
        console.log("[LibraryAssetGrid] 🔵 Add button triggered:", payload);
        window.dispatchEvent(new CustomEvent("add-model-to-layout", { 
           detail: {
             ...payload,
             _onComplete: () => setLoadingCardId(null)
           } 
        }));
      } else {
        setLoadingCardId(null);
      }
    };

    return (
      <LibraryAssetCard
        model={m}
        modelId={modelId}
        displayName={displayName}
        thumbUrl={thumbUrl}
        isSelected={isSelected}
        inPlan={inPlan}
        isFluid={isFluid}
        fixedSize={fixedSize}
        cardSize={cardSize}
        isAdding={loadingCardId === modelId}
        onClick={handleClick}
        onAddClick={handleAddClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
    );
  };

  return (
    <Box sx={{ px: 1, py: 1, height: '100%' }}>
      {isFluid ? (
        <Grid container spacing={1}>
          {models.map((m) => {
            const modelId = m?.id;
            if (!modelId) return null;
            const inPlan = planIds.has(modelId);
            const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;
            const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);
            const isSelected = selection?.kind === "libraryModel" && selection?.model?.id === modelId;
            
            return (
              <Grid item xs={6} size={6} key={modelId}>
                {renderCard(m, modelId, displayName, thumbUrl, isSelected, inPlan)}
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignContent: 'flex-start' }}>
          {models.map((m) => {
            const modelId = m?.id;
            if (!modelId) return null;
            const inPlan = planIds.has(modelId);
            const thumbUrl = m?.thumbUrl || m?.thumbnailUrl || null;
            const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);
            const isSelected = selection?.kind === "libraryModel" && selection?.model?.id === modelId;
            
            return (
              <React.Fragment key={modelId}>
                {renderCard(m, modelId, displayName, thumbUrl, isSelected, inPlan)}
              </React.Fragment>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
