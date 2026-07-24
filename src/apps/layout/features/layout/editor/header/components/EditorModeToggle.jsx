// src/features/layout/editor/header/components/EditorModeToggle.jsx
// ✅ 「2D 配置 / 3D 演出」のモード切替セグメントトグル（TopBar中央の一等地）
import React, { useCallback } from "react";
import { Box, Button, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";

import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

export default function EditorModeToggle() {
    const theme = useTheme();
    const editorMode = useEditorModeStore((s) => s.editorMode);
    const setEditorMode = useEditorModeStore((s) => s.setEditorMode);

    const handle2D = useCallback(() => setEditorMode(EDITOR_MODES.LAYOUT_2D), [setEditorMode]);
    const handle3D = useCallback(() => setEditorMode(EDITOR_MODES.PRESENT_3D), [setEditorMode]);

    const is2D = editorMode === EDITOR_MODES.LAYOUT_2D;

    const wrapSx = {
        display: "flex",
        alignItems: "center",
        gap: "3px",
        p: "3px",
        borderRadius: 999,
        background: alpha("#fff", 0.05),
        border: `1px solid ${alpha("#fff", 0.14)}`,
    };

    const btnSx = (active) => ({
        height: 30,
        px: 1.8,
        minWidth: 0,
        borderRadius: 999,
        textTransform: "none",
        fontWeight: 900,
        fontSize: 12.5,
        letterSpacing: 0.2,
        gap: 0.7,
        color: active ? "#fff" : alpha("#fff", 0.62),
        background: active
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 1)}, ${alpha(theme.palette.primary.dark || theme.palette.primary.main, 0.92)})`
            : "transparent",
        boxShadow: active ? `0 3px 12px ${alpha(theme.palette.primary.main, 0.4)}` : "none",
        transition: "all 160ms ease",
        "&:hover": {
            background: active
                ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 1)}, ${alpha(theme.palette.primary.dark || theme.palette.primary.main, 1)})`
                : alpha("#fff", 0.07),
            color: "#fff",
        },
        "& .MuiButton-startIcon": { mr: 0.5, ml: 0 },
    });

    return (
        <Box sx={wrapSx}>
            <Tooltip title="平面図で家具を配置（TOPビュー固定）" arrow>
                <Button size="small" startIcon={<GridOnRoundedIcon sx={{ fontSize: 15 }} />} onClick={handle2D} sx={btnSx(is2D)}>
                    2D 配置
                </Button>
            </Tooltip>
            <Tooltip title="パースで材質・見え方を調整" arrow>
                <Button size="small" startIcon={<ViewInArRoundedIcon sx={{ fontSize: 15 }} />} onClick={handle3D} sx={btnSx(!is2D)}>
                    3D 演出
                </Button>
            </Tooltip>
        </Box>
    );
}
