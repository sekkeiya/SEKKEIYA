import React, { useMemo, useCallback, useState } from "react";
import { Box, IconButton, Tooltip, Divider, Button, Menu, MenuItem, CircularProgress, Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import FindReplaceRoundedIcon from "@mui/icons-material/FindReplaceRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import VerticalAlignBottomRoundedIcon from "@mui/icons-material/VerticalAlignBottomRounded";
import VerticalAlignTopRoundedIcon from "@mui/icons-material/VerticalAlignTopRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import AlignHorizontalLeftRoundedIcon from "@mui/icons-material/AlignHorizontalLeftRounded";
import AlignHorizontalRightRoundedIcon from "@mui/icons-material/AlignHorizontalRightRounded";
import AlignHorizontalCenterRoundedIcon from "@mui/icons-material/AlignHorizontalCenterRounded";
import AlignVerticalCenterRoundedIcon from "@mui/icons-material/AlignVerticalCenterRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";

import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useAutoLayoutStore } from "@desktop/features/dsl/layout/store/useAutoLayoutStore";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useAppStore } from "@desktop/store/useAppStore";
import { useDscStore } from "@desktop/features/dsc/store/useDscStore";

export default function LayoutToolbar({ layoutItems = [] }) {
  const theme = useTheme();

  // ── 2画面 (Top + 3D split) ──────────────────────────────────
  const layoutMode    = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);
  const isSplit       = layoutMode === "split";

  const rotateStepDeg = useEditorModeStore((s) => s.rotateStepDeg);
  const setRotateStepDeg = useEditorModeStore((s) => s.setRotateStepDeg);
  const dslBaseGlbUrl  = useEditorModeStore((s) => s.dslBaseGlbUrl);
  const dslPlanContext = useEditorModeStore((s) => s.dslPlanContext);

  const openSwapDialog = useAutoLayoutStore((s) => s.openSwapDialog);
  const openConfigDialog = useAutoLayoutStore((s) => s.openConfigDialog);
  const isGenerating = useAutoLayoutStore((s) => s.isGenerating);

  const zones = useLayoutTaskStore((s) => s.zones);
  const hasZones = zones.length > 0;

  const requestAlign = useViewportUiStore((s) => s.requestAlign);

  const showFurnitureDimensions = useToolsStore((s) => s.showFurnitureDimensions);
  const toggleFurnitureDimensions = useToolsStore((s) => s.toggleFurnitureDimensions);

  const setDscShellMode      = useAppStore((s) => s.setDscShellMode);
  const setActiveWorkspaceId = useAppStore((s) => s.setActiveWorkspaceId);

  const handleOpenDsc = useCallback(() => {
    const serializedItems = (layoutItems || [])
      .filter(item => item?.transform?.position)
      .map(item => ({
        id: item.id || item.itemId || item.modelId || Math.random().toString(36).slice(2),
        position: item.transform?.position ?? [0, 0, 0],
        rotation: item.transform?.rotation ?? [0, 0, 0],
        dimensions: {
          width:  item.dimensionsMm?.width  ?? item.dimensionsMm?.x ?? 500,
          height: item.dimensionsMm?.height ?? item.dimensionsMm?.z ?? 500,
          depth:  item.dimensionsMm?.depth  ?? item.dimensionsMm?.y ?? 500,
        },
        glbUrl: item.glbUrl || null,
      }));
    useDscStore.getState().setOriginContext({
      projectId:   dslPlanContext?.projectId,
      workspaceId: dslPlanContext?.workspaceId,
      planId:      dslPlanContext?.planId,
      baseGlbUrl:  dslBaseGlbUrl || undefined,
      layoutItems: serializedItems,
    });
    setDscShellMode('studio');
    setActiveWorkspaceId('create');
  }, [dslBaseGlbUrl, dslPlanContext, layoutItems, setDscShellMode, setActiveWorkspaceId]);

  const [rotateMenuAnchor, setRotateMenuAnchor] = useState(null);

  const hasPlacedItems = useMemo(() => layoutItems.length > 0, [layoutItems]);


  const line = alpha(theme.palette.common.white, 0.08);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {/* === 2画面ビュー (Top ｜ 3D) === */}
      <Tooltip title={isSplit ? "1画面に戻す" : "2画面表示：左にTop・右に3Dビュー (T / Y で個別切替)"} arrow>
        <IconButton
          size="small"
          onClick={() => setLayoutMode(isSplit ? "single" : "split")}
          sx={{
            width: 28, height: 28, borderRadius: 1,
            color: isSplit ? "#6ea8ff" : alpha("#fff", 0.7),
            background: isSplit ? alpha("#6ea8ff", 0.14) : "transparent",
            border: `1px solid ${isSplit ? alpha("#6ea8ff", 0.45) : alpha("#fff", 0.15)}`,
            "&:hover": {
              background: isSplit ? alpha("#6ea8ff", 0.22) : alpha("#fff", 0.08),
              borderColor: isSplit ? alpha("#6ea8ff", 0.6) : alpha("#fff", 0.25),
            },
            transition: "all 0.15s ease",
          }}
        >
          <ViewColumnRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

      {/* === Auto Layout Button === */}
      <Tooltip
        title={
          isGenerating ? "AI がレイアウト生成中..."
          : !hasZones ? "ゾーンがありません"
          : "AI が全ゾーンに家具を自動配置"
        }
        arrow
      >
        <span>
          <Chip
            size="small"
            clickable={!isGenerating && hasZones}
            disabled={isGenerating || !hasZones}
            onClick={() => openConfigDialog(zones.map((z) => z.id))}
            icon={
              isGenerating
                ? <CircularProgress size={11} sx={{ color: "inherit", ml: "4px !important" }} />
                : <AutoFixHighRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />
            }
            label={isGenerating ? "Generating…" : "Auto Layout"}
            sx={{
              height: 26, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
              background: isGenerating ? alpha("#7c3aed", 0.12) : alpha("#7c3aed", 0.20),
              border: `1px solid ${alpha("#7c3aed", isGenerating ? 0.22 : 0.42)}`,
              color: alpha("#c4b5fd", isGenerating ? 0.55 : 0.95),
              "&:hover": { background: alpha("#7c3aed", 0.30) },
              "&.Mui-disabled": { opacity: 0.4 },
              transition: "all 0.15s ease",
            }}
          />
        </span>
      </Tooltip>

      {/* === 造作家具を作成 (3DSC) === */}
      <Tooltip title="造作家具を作成・編集 (3DSC)" arrow>
        <Chip
          size="small"
          clickable
          onClick={handleOpenDsc}
          icon={<HandymanRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
          label="造作家具"
          sx={{
            height: 26, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
            background: alpha("#ffa726", 0.15),
            border: `1px solid ${alpha("#ffa726", 0.4)}`,
            color: alpha("#ffa726", 0.95),
            "&:hover": { background: alpha("#ffa726", 0.28) },
            transition: "all 0.15s ease",
          }}
        />
      </Tooltip>

      {/* === Furniture Swap Button === */}
      <Tooltip
        title={
          !hasPlacedItems ? "配置された家具がありません"
          : "家具を変える"
        }
        arrow
      >
        <span>
          <IconButton
            size="small"
            disabled={!hasPlacedItems}
            onClick={openSwapDialog}
            sx={{
              width: 28, height: 28, borderRadius: 1,
              color: hasPlacedItems ? "#a78bfa" : alpha("#fff", 0.3),
              background: "transparent",
              border: `1px solid ${hasPlacedItems ? alpha("#7c3aed", 0.4) : alpha("#fff", 0.1)}`,
              "&:hover": { background: alpha("#7c3aed", 0.28) },
              "&.Mui-disabled": { opacity: 0.45 },
              transition: "all 0.15s ease",
            }}
          >
            <FindReplaceRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      {/* === 家具位置プロット寸法（壁までの距離を表示） === */}
      <Tooltip title={showFurnitureDimensions ? "家具位置プロット寸法: ON" : "家具位置プロット寸法（壁までの距離）"} arrow>
        <Chip
          size="small"
          clickable
          onClick={() => toggleFurnitureDimensions()}
          icon={<StraightenRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
          label="壁寸法"
          sx={{
            height: 26, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
            background: showFurnitureDimensions ? alpha("#f59e0b", 0.28) : alpha("#f59e0b", 0.14),
            border: `1px solid ${alpha("#f59e0b", showFurnitureDimensions ? 0.6 : 0.38)}`,
            color: alpha("#fde2b0", 0.95),
            "&:hover": { background: alpha("#f59e0b", 0.34) },
            transition: "all 0.15s ease",
          }}
        />
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

      {/* Snap Tools */}
      <Tooltip title="Snap Floor (PageDown)" arrow>
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }))}
          sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <VerticalAlignBottomRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Snap Ceiling (PageUp)" arrow>
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))}
          sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <VerticalAlignTopRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="On Object — 直下オブジェクトの上面に配置 (End)" arrow>
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))}
          sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <LayersRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Rotate (R)">
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))}
          sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), border: `1px solid ${line}`, borderRadius: 1, ml: 0.5 }}
        >
          <RotateRightRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Button
        size="small"
        onClick={(e) => setRotateMenuAnchor(e.currentTarget)}
        sx={{ minWidth: 0, px: 0.5, height: 26, color: alpha("#fff", 0.7), fontSize: 12, border: `1px solid ${line}`, borderRadius: 1 }}
      >
        {rotateStepDeg}° <ArrowDropDownRoundedIcon sx={{ fontSize: 14, ml: -0.2 }} />
      </Button>
      <Menu
        anchorEl={rotateMenuAnchor}
        open={Boolean(rotateMenuAnchor)}
        onClose={() => setRotateMenuAnchor(null)}
        MenuListProps={{ dense: true }}
        sx={{ '& .MuiPaper-root': { bgcolor: alpha('#1a1a1a', 0.95), backgroundImage: 'none', border: `1px solid ${line}` } }}
      >
        {[15, 30, 45, 90].map((step) => (
          <MenuItem 
            key={step} 
            selected={rotateStepDeg === step}
            onClick={() => {
              setRotateStepDeg(step);
              setRotateMenuAnchor(null);
            }}
            sx={{ fontSize: 13, minHeight: 'auto' }}
          >
            {step}°
          </MenuItem>
        ))}
      </Menu>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

      {/* Alignment Tools */}
      <Tooltip title="Align Top (AT)">
        <IconButton size="small" onClick={() => requestAlign("AT")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <VerticalAlignTopRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Bottom (AB)">
        <IconButton size="small" onClick={() => requestAlign("AB")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <VerticalAlignBottomRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Left (AL)">
        <IconButton size="small" onClick={() => requestAlign("AL")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <AlignHorizontalLeftRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Right (AR)">
        <IconButton size="small" onClick={() => requestAlign("AR")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <AlignHorizontalRightRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Horizontal Center (AH)">
        <IconButton size="small" onClick={() => requestAlign("AH")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <AlignHorizontalCenterRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Vertical Center (AV)">
        <IconButton size="small" onClick={() => requestAlign("AV")} sx={{ width: 26, height: 26, color: alpha("#fff", 0.7), borderRadius: 1 }}>
          <AlignVerticalCenterRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
