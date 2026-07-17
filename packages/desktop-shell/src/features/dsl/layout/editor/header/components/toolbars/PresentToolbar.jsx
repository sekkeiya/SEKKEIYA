// PresentToolbar — 「3D 演出」グループ用の Row2 ツールバー。
// 配置系ツール（造作家具/寸法/整列/回転…）は 2D 配置側（LayoutToolbar）に集約し、
// こちらは演出・確認系のクイックコントロールだけを置く。
import React, { useCallback } from "react";
import { Box, IconButton, Tooltip, Divider, Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import ViewColumnRoundedIcon from "@mui/icons-material/ViewColumnRounded";
import ContentCutRoundedIcon from "@mui/icons-material/ContentCutRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";

import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { useViewportUiStore } from "../../../../store/viewportUiStore";
import { useWalkthroughToggle } from "../../../../canvas/tools/walkthrough/useWalkthroughToggle";

export default function PresentToolbar() {
    const theme = useTheme();
    const line = alpha(theme.palette.common.white, 0.08);

    // ── 2画面 (Top + 3D split) — LayoutToolbar と共通の機能 ──
    const layoutMode = useViewportUiStore((s) => s.layoutMode);
    const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);
    const isSplit = layoutMode === "split";

    // ── ウォークスルー ──
    const { isWalkthrough, toggle: toggleWalkthrough } = useWalkthroughToggle();

    // ── 断面クリップ / グリッド ──
    const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
    const setIsSectionClipEnabled = useEditorModeStore((s) => s.setIsSectionClipEnabled);
    const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
    const setIsGridVisible = useEditorModeStore((s) => s.setIsGridVisible);

    const handleToggleSection = useCallback(
        () => setIsSectionClipEnabled(!isSectionClipEnabled),
        [isSectionClipEnabled, setIsSectionClipEnabled]
    );
    const handleToggleGrid = useCallback(
        () => setIsGridVisible(!isGridVisible),
        [isGridVisible, setIsGridVisible]
    );

    const chipSx = (active, color) => ({
        height: 26,
        fontSize: 11.5,
        fontWeight: 900,
        borderRadius: 1,
        background: active ? alpha(color, 0.28) : alpha(color, 0.12),
        border: `1px solid ${alpha(color, active ? 0.6 : 0.35)}`,
        color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
        "&:hover": { background: alpha(color, 0.34) },
        transition: "all 0.15s ease",
    });

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {/* === 2画面ビュー (Top ｜ 3D) — 配置と見比べたいとき用 === */}
            <Tooltip title={isSplit ? "1画面に戻す" : "2画面表示：左にTop・右に3Dビュー"} arrow>
                <IconButton
                    size="small"
                    onClick={() => setLayoutMode(isSplit ? "single" : "split")}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        color: isSplit ? "light-dark(#0045ad, #6ea8ff)" : "color-mix(in srgb, var(--brand-fg) 70%, transparent)",
                        background: isSplit ? alpha("#6ea8ff", 0.14) : "transparent",
                        border: `1px solid ${isSplit ? alpha("#6ea8ff", 0.45) : alpha("#fff", 0.15)}`,
                        "&:hover": {
                            background: isSplit ? alpha("#6ea8ff", 0.22) : alpha("#fff", 0.08),
                        },
                        transition: "all 0.15s ease",
                    }}
                >
                    <ViewColumnRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.8, borderColor: alpha("#fff", 0.15) }} />

            {/* === ウォークスルー（3D 演出の主役） === */}
            <Tooltip title={isWalkthrough ? "ウォークスルー終了" : "ウォークスルーで室内を歩いて確認"} arrow>
                <Chip
                    size="small"
                    clickable
                    onClick={toggleWalkthrough}
                    icon={<DirectionsWalkIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
                    label="ウォークスルー"
                    sx={chipSx(isWalkthrough, "#4f8cff")}
                />
            </Tooltip>

            {/* === 断面クリップ === */}
            <Tooltip title={isSectionClipEnabled ? "断面: ON（クリックで OFF）" : "断面: 壁・天井をカットして室内を見る"} arrow>
                <Chip
                    size="small"
                    clickable
                    onClick={handleToggleSection}
                    icon={<ContentCutRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
                    label="断面"
                    sx={chipSx(isSectionClipEnabled, "#f59e0b")}
                />
            </Tooltip>

            {/* === グリッド表示 === */}
            <Tooltip title={isGridVisible ? "グリッド: ON（クリックで OFF）" : "グリッド: 床グリッドを表示"} arrow>
                <Chip
                    size="small"
                    clickable
                    onClick={handleToggleGrid}
                    icon={<GridOnRoundedIcon sx={{ fontSize: 13, ml: "4px !important" }} />}
                    label="グリッド"
                    sx={chipSx(isGridVisible, "#4fc3f7")}
                />
            </Tooltip>
        </Box>
    );
}
