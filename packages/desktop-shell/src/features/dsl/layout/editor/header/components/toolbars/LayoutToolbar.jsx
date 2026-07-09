import React, { useMemo, useCallback, useState } from "react";
import { Box, IconButton, Tooltip, Divider, Button, Menu, MenuItem, Chip, Snackbar, Alert } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import FindReplaceRoundedIcon from "@mui/icons-material/FindReplaceRounded";
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
import SquareFootRoundedIcon from "@mui/icons-material/SquareFootRounded";

import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { useToolsStore } from "../../../../store/toolsStore/useToolsStore";
import { useAutoLayoutStore } from "../../../../store/useAutoLayoutStore";
import { useViewportUiStore } from "../../../../store/viewportUiStore";
import { useAppStore } from "../../../../../../../store/useAppStore";
import { useDscStore } from "../../../../../../dsc/store/useDscStore";
import { unionBaseMeshes, clearBaseUnion } from "../../../../services/unionBase";
import { useBaseUnionStore } from "../../../../store/useBaseUnionStore";

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

  const requestAlign = useViewportUiStore((s) => s.requestAlign);

  const showFurnitureDimensions    = useToolsStore((s) => s.showFurnitureDimensions);
  const toggleFurnitureDimensions  = useToolsStore((s) => s.toggleFurnitureDimensions);
  const showFurnitureGapDimensions = useToolsStore((s) => s.showFurnitureGapDimensions);
  const toggleFurnitureGapDimensions = useToolsStore((s) => s.toggleFurnitureGapDimensions);
  const showItemDimensions = useToolsStore((s) => s.showItemDimensions);
  const toggleItemDimensions = useToolsStore((s) => s.toggleItemDimensions);

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

  // スナックバー（Union 等の通知に使用）。
  // 自動マテリアル/家具/ラベル/ライティングは下部ドックの「自動○○」パネルへ移設済み。
  const [snack, setSnack] = useState(null);

  // === Base の Union（1ソリッド化） ===
  const isUnioned = useBaseUnionStore((s) => !!s.unionMesh);
  const handleUnion = useCallback(() => {
    if (useBaseUnionStore.getState().unionMesh) {
      clearBaseUnion();
      setSnack({ severity: "info", msg: "Union を解除しました（元の躯体に復帰）" });
      return;
    }
    setSnack({ severity: "info", msg: "Union 処理中…（厚み付け→1ソリッドに結合）" });
    window.setTimeout(() => {
      const res = unionBaseMeshes();
      if (res.ok) {
        const solid = res.solidified ? `／厚み付け ${res.solidified} 面` : "";
        setSnack({ severity: "success", msg: `Union 完了（${res.sources} メッシュ${solid}）。自動ラベル/マテリアルの精度が上がります` });
      } else {
        setSnack({ severity: "warning", msg: res.reason || "Union に失敗しました" });
      }
    }, 60);
  }, []);

  const hasPlacedItems = useMemo(() => layoutItems.length > 0, [layoutItems]);


  const line = alpha(theme.palette.common.white, 0.08);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {/* 自動マテリアル/家具/ラベル/ライティングは下部ドックの「自動○○」ランチャーへ移設。
          Union（Solidify→1ソリッド化）は CAD 躯体では CSG が破綻するため非表示。
          ロジック（unionBase.ts / useBaseUnionStore / handleUnion）は温存。 */}

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.severity || "info"} variant="filled" onClose={() => setSnack(null)} sx={{ fontSize: 12.5 }}>
          {snack?.msg}
        </Alert>
      </Snackbar>

      {/* === 2画面ビュー (Top ｜ 3D) === */}
      <Tooltip title={isSplit ? "1画面に戻す" : "2画面表示：左にTop・右に3Dビュー (T / Y で個別切替)"} arrow>
        <IconButton
          size="small"
          onClick={() => setLayoutMode(isSplit ? "single" : "split")}
          sx={{
            width: 28, height: 28, borderRadius: 1,
            color: isSplit ? "light-dark(#0045ad, #6ea8ff)" : "color-mix(in srgb, var(--brand-fg) 70%, transparent)",
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
            color: "light-dark(rgba(173,103,0,0.95), rgba(255,167,38,0.95))",
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
              color: hasPlacedItems ? "light-dark(#2f07a6, #a78bfa)" : "color-mix(in srgb, var(--brand-fg) 30%, transparent)",
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

      {/* === 壁までの距離 === */}
      <Tooltip title={showFurnitureDimensions ? "壁寸法: ON（クリックで OFF）" : "壁寸法: 家具から壁までの距離を表示"} arrow>
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
            color: "light-dark(rgba(169,111,4,0.95), rgba(253,226,176,0.95))",
            "&:hover": { background: alpha("#f59e0b", 0.34) },
            transition: "all 0.15s ease",
          }}
        />
      </Tooltip>

      {/* === 家具間の距離 === */}
      <Tooltip title={showFurnitureGapDimensions ? "間隔寸法: ON（クリックで OFF）" : "間隔寸法: 家具間の距離を表示"} arrow>
        <Chip
          size="small"
          clickable
          onClick={() => toggleFurnitureGapDimensions()}
          icon={<StraightenRoundedIcon sx={{ fontSize: 13, ml: "4px !important", transform: "rotate(90deg)" }} />}
          label="間隔"
          sx={{
            height: 26, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
            background: showFurnitureGapDimensions ? alpha("#fbbf24", 0.28) : alpha("#fbbf24", 0.14),
            border: `1px solid ${alpha("#fbbf24", showFurnitureGapDimensions ? 0.6 : 0.38)}`,
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
            "&:hover": { background: alpha("#fbbf24", 0.34) },
            transition: "all 0.15s ease",
          }}
        />
      </Tooltip>

      {/* === 選択アイテムの W/D/H === */}
      <Tooltip title={showItemDimensions ? "アイテム寸法: ON（クリックで OFF）" : "アイテム寸法: 選択中アイテムの W/D/H を表示"} arrow>
        <Chip
          size="small"
          clickable
          onClick={() => toggleItemDimensions()}
          icon={<SquareFootRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
          label="アイテム寸法"
          sx={{
            height: 26, fontSize: 11.5, fontWeight: 900, borderRadius: 1,
            background: showItemDimensions ? alpha("#4fc3f7", 0.28) : alpha("#4fc3f7", 0.14),
            border: `1px solid ${alpha("#4fc3f7", showItemDimensions ? 0.6 : 0.38)}`,
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
            "&:hover": { background: alpha("#4fc3f7", 0.34) },
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
          sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <VerticalAlignBottomRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Snap Ceiling (PageUp)" arrow>
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))}
          sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <VerticalAlignTopRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="On Object — 直下オブジェクトの上面に配置 (End)" arrow>
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))}
          sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", border: `1px solid ${line}`, borderRadius: 1 }}
        >
          <LayersRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Rotate">
        <IconButton
          size="small"
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))}
          sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", border: `1px solid ${line}`, borderRadius: 1, ml: 0.5 }}
        >
          <RotateRightRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Button
        size="small"
        onClick={(e) => setRotateMenuAnchor(e.currentTarget)}
        sx={{ minWidth: 0, px: 0.5, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: 12, border: `1px solid ${line}`, borderRadius: 1 }}
      >
        {rotateStepDeg}° <ArrowDropDownRoundedIcon sx={{ fontSize: 14, ml: -0.2 }} />
      </Button>
      <Menu
        anchorEl={rotateMenuAnchor}
        open={Boolean(rotateMenuAnchor)}
        onClose={() => setRotateMenuAnchor(null)}
        MenuListProps={{ dense: true }}
        sx={{ '& .MuiPaper-root': { bgcolor: "color-mix(in srgb, var(--brand-surface) 95%, transparent)", backgroundImage: 'none', border: `1px solid ${line}` } }}
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
        <IconButton size="small" onClick={() => requestAlign("AT")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <VerticalAlignTopRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Bottom (AB)">
        <IconButton size="small" onClick={() => requestAlign("AB")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <VerticalAlignBottomRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Left (AL)">
        <IconButton size="small" onClick={() => requestAlign("AL")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <AlignHorizontalLeftRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Right (AR)">
        <IconButton size="small" onClick={() => requestAlign("AR")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <AlignHorizontalRightRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Horizontal Center (AH)">
        <IconButton size="small" onClick={() => requestAlign("AH")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <AlignHorizontalCenterRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Align Vertical Center (AV)">
        <IconButton size="small" onClick={() => requestAlign("AV")} sx={{ width: 26, height: 26, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderRadius: 1 }}>
          <AlignVerticalCenterRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
