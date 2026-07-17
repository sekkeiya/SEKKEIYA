// ViewGroupToggle — 「2D 配置 / 3D 演出」の上位グループ切替トグル。
// TopBar Row2 の先頭（SelectionScopeButtons の左）に置く一等地コントロール。
// 副作用（スコープ退避・カメラ tilt）は applyViewGroup に集約。
import React, { useCallback } from "react";
import { Box, Button, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";

import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { applyViewGroup } from "../../../../utils/applyViewGroup";

export default function ViewGroupToggle() {
    const theme = useTheme();
    const viewGroup = useEditorModeStore((s) => s.editorViewGroup);
    const is2D = viewGroup === "2d";

    const handle2D = useCallback(() => applyViewGroup("2d"), []);
    const handle3D = useCallback(() => applyViewGroup("3d"), []);

    const accent = theme.palette.primary.main;

    const wrapSx = {
        display: "flex",
        alignItems: "center",
        gap: "2px",
        p: "2px",
        borderRadius: 1,
        background: alpha("#fff", 0.04),
        border: `1px solid ${alpha("#fff", 0.12)}`,
        flexShrink: 0,
    };

    const btnSx = (active) => ({
        height: 22,
        px: 1.1,
        minWidth: 0,
        borderRadius: 0.75,
        textTransform: "none",
        fontWeight: 850,
        fontSize: 11,
        letterSpacing: 0.2,
        gap: 0.5,
        whiteSpace: "nowrap",
        color: active
            ? "color-mix(in srgb, var(--brand-fg) 96%, transparent)"
            : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
        background: active ? alpha(accent, 0.28) : "transparent",
        boxShadow: active ? `inset 0 0 0 1px ${alpha(accent, 0.4)}` : "none",
        transition: "all 140ms ease",
        "&:hover": {
            background: active ? alpha(accent, 0.34) : alpha("#fff", 0.06),
            color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
        },
        "& .MuiButton-startIcon": { mr: 0.4, ml: 0 },
    });

    return (
        <Box sx={wrapSx}>
            <Tooltip title="2D 配置 — 真上ビューで家具・ゾーン・敷地を配置" arrow>
                <Button
                    size="small"
                    disableRipple
                    startIcon={<GridOnRoundedIcon sx={{ fontSize: 13 }} />}
                    onClick={handle2D}
                    sx={btnSx(is2D)}
                >
                    2D 配置
                </Button>
            </Tooltip>
            <Tooltip title="3D 演出 — パースで材質・照明・面ラベルを調整" arrow>
                <Button
                    size="small"
                    disableRipple
                    startIcon={<ViewInArRoundedIcon sx={{ fontSize: 13 }} />}
                    onClick={handle3D}
                    sx={btnSx(!is2D)}
                >
                    3D 演出
                </Button>
            </Tooltip>
        </Box>
    );
}
