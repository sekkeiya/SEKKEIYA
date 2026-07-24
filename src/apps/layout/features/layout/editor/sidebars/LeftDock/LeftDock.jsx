// src/features/layout/editor/sidebars/LeftDock/LeftDock.jsx
// ✅ 左ドック =「持ち込むもの」の常設置き場
// - 2D 配置モード: 家具・モデル（S.Model）/ 一括配置
// - 3D 演出モード: マテリアル / テクスチャ
// 開閉状態は useEditorModeStore.leftDockOpen（Bottombar の位置計算と共有）
import React, { useState, useCallback } from "react";
import { Box, Tabs, Tab, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import WeekendRoundedIcon from "@mui/icons-material/WeekendRounded";
import TextureRoundedIcon from "@mui/icons-material/TextureRounded";

import ModelLibraryPanel from "../LeftSidebar/components/ModelLibraryPanel";
import PopulatePanel from "../../dock/panels/PopulatePanel";
import MaterialLibraryPanel from "../../dock/panels/MaterialLibraryPanel";
import TextureLibraryPanel from "../../dock/panels/TextureLibraryPanel";

import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

const TABS_2D = [
    { key: "models", label: "家具・モデル" },
    { key: "populate", label: "一括配置" },
];

const TABS_3D = [
    { key: "materials", label: "マテリアル" },
    { key: "textures", label: "テクスチャ" },
];

export default function LeftDock({
    projectId,
    workspaceId,
    planId,
    layoutItems = [],
    canContext = false,
}) {
    const theme = useTheme();

    const editorMode = useEditorModeStore((s) => s.editorMode);
    const leftDockOpen = useEditorModeStore((s) => s.leftDockOpen);
    const toggleLeftDock = useEditorModeStore((s) => s.toggleLeftDock);

    const is2D = editorMode === EDITOR_MODES.LAYOUT_2D;
    const tabs = is2D ? TABS_2D : TABS_3D;

    // ✅ モード別にタブ選択を保持
    const [tab2D, setTab2D] = useState("models");
    const [tab3D, setTab3D] = useState("materials");

    const activeTab = is2D ? tab2D : tab3D;
    const setActiveTab = is2D ? setTab2D : setTab3D;

    const handleChangeTab = useCallback(
        (_e, v) => {
            if (v) setActiveTab(v);
        },
        [setActiveTab]
    );

    const line = alpha("#fff", 0.08);

    // =========================
    // ✅ 折りたたみ時：スリムレール
    // =========================
    if (!leftDockOpen) {
        return (
            <Box
                sx={{
                    width: 30,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    pt: 1,
                    gap: 1,
                    borderRight: `1px solid ${line}`,
                    background: alpha("#0a0f1e", 0.8),
                }}
            >
                <Tooltip title="ライブラリを開く" placement="right" arrow>
                    <IconButton size="small" onClick={toggleLeftDock} sx={{ color: alpha("#fff", 0.75) }}>
                        <ChevronRightRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                {is2D ? (
                    <WeekendRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.4) }} />
                ) : (
                    <TextureRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.4) }} />
                )}
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                borderRight: `1px solid ${line}`,
                background: alpha("#0b101f", 0.9),
                backdropFilter: "blur(10px)",
                overflow: "hidden",
            }}
        >
            {/* header: tabs + collapse */}
            <Box
                sx={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    borderBottom: `1px solid ${line}`,
                    pr: 0.5,
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={handleChangeTab}
                    variant="fullWidth"
                    sx={{
                        flex: 1,
                        minHeight: 34,
                        "& .MuiTabs-indicator": { backgroundColor: theme.palette.primary.main, height: 2 },
                        "& .MuiTab-root": {
                            minHeight: 34,
                            py: 0.4,
                            fontSize: 11.5,
                            fontWeight: 800,
                            textTransform: "none",
                            color: alpha("#fff", 0.6),
                            "&.Mui-selected": { color: "#fff" },
                        },
                    }}
                >
                    {tabs.map((t) => (
                        <Tab key={t.key} value={t.key} label={t.label} />
                    ))}
                </Tabs>

                <Tooltip title="ライブラリをたたむ" arrow>
                    <IconButton size="small" onClick={toggleLeftDock} sx={{ color: alpha("#fff", 0.6) }}>
                        <ChevronLeftRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* body */}
            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {is2D && activeTab === "models" ? (
                    <ModelLibraryPanel projectId={projectId} workspaceId={workspaceId} planId={planId} />
                ) : null}

                {is2D && activeTab === "populate" ? (
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <PopulatePanel disabled={!canContext} placedItems={layoutItems} />
                    </Box>
                ) : null}

                {!is2D && activeTab === "materials" ? (
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <MaterialLibraryPanel materials={[]} />
                    </Box>
                ) : null}

                {!is2D && activeTab === "textures" ? (
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <TextureLibraryPanel textures={[]} />
                    </Box>
                ) : null}
            </Box>

            {/* hint footer（2Dのみ） */}
            {is2D && activeTab === "models" ? (
                <Box sx={{ flex: "0 0 auto", px: 1.25, py: 0.6, borderTop: `1px solid ${line}` }}>
                    <Typography sx={{ fontSize: 10.5, color: alpha("#fff", 0.45), fontWeight: 700 }}>
                        ↑ カードをビューポートへドラッグして配置
                    </Typography>
                </Box>
            ) : null}
        </Box>
    );
}
