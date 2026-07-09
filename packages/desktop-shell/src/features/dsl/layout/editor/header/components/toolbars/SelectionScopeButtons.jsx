import React, { useCallback, useEffect } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import TextureRoundedIcon from "@mui/icons-material/TextureRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import LabelRoundedIcon from "@mui/icons-material/LabelRounded";

import { useSelectionScopeStore } from "../../../../store/useSelectionScopeStore";
import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import { applySelectionScope } from "../../../../utils/applySelectionScope";

const OPTIONS = [
  { value: "all",      label: "ALL",      icon: <SelectAllRoundedIcon sx={{ fontSize: 13 }} />, tooltip: "すべて選択可" },
  { value: "label",    label: "Label",    icon: <LabelRoundedIcon sx={{ fontSize: 13 }} />,     tooltip: "面ラベルを確認（ゴースト表示＋断面無視で全体を見やすく）" },
  { value: "item",     label: "Item",     icon: <ChairRoundedIcon sx={{ fontSize: 13 }} />,     tooltip: "家具（Item）のみ選択", disabledOnBase: true },
  { value: "lighting", label: "Lighting", icon: <LightbulbRoundedIcon sx={{ fontSize: 13 }} />, tooltip: "照明（Lighting）のみ選択" },
  { value: "zone",     label: "Zone",     icon: <CropFreeRoundedIcon sx={{ fontSize: 13 }} />,  tooltip: "ゾーン（Zone）のみ選択" },
  { value: "material", label: "Material", icon: <TextureRoundedIcon sx={{ fontSize: 13 }} />,   tooltip: "躯体（床・壁・天井）にマテリアル設定。家具は非表示" },
  { value: "map",      label: "Map",      icon: <MapRoundedIcon sx={{ fontSize: 13 }} />,       tooltip: "敷地に航空写真を貼り、Base（建物）に位置・縮尺を合わせる。照明/ゾーン等は非表示" },
];

export default function SelectionScopeButtons() {
  const theme = useTheme();
  const scope = useSelectionScopeStore((s) => s.scope);
  const setScope = useSelectionScopeStore((s) => s.setScope);

  // structureTagging は「Base のみ表示中（躯体編集）」と一致する自動シグナル。
  // この間は家具が無いため Item スコープは無効化する。
  const isBaseOnly = useEditorModeStore((s) => s.structureTagging);

  // Base に切り替わったとき Item を選んだままなら ALL に戻す（無効スコープを保持しない）。
  useEffect(() => {
    if (isBaseOnly && scope === "item") setScope("all");
  }, [isBaseOnly, scope, setScope]);

  const handleChange = useCallback((_e, next) => {
    if (!next) return;
    // スコープ切替の副作用は共有関数に集約（自動アクションからも同じ挙動で呼ぶ）。
    applySelectionScope(next);
  }, []);

  const accent = theme.palette.primary.main;
  const line = alpha(theme.palette.common.white, 0.12);

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={scope}
        onChange={handleChange}
        sx={{
          height: 26,
          borderRadius: 1,
          background: alpha("#fff", 0.04),
          border: `1px solid ${line}`,
          "& .MuiToggleButton-root": {
            height: 24,
            px: 1,
            border: "none",
            borderRadius: 0.75,
            color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "none",
            letterSpacing: 0.2,
            gap: 0.4,
            minWidth: 0,
            "&:hover": {
              background: alpha("#fff", 0.06),
              color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
            },
            "&.Mui-selected": {
              background: alpha(accent, 0.22),
              color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
              "&:hover": {
                background: alpha(accent, 0.3),
              },
            },
            "&.Mui-disabled": {
              color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)",
              background: alpha("#fff", 0.02),
              cursor: "not-allowed",
              pointerEvents: "auto", // not-allowed カーソルとツールチップを出すため
              "& svg": { opacity: 0.4 },
              "&:hover": {
                background: alpha("#fff", 0.02),
                color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)",
              },
            },
          },
        }}
      >
        {OPTIONS.map((opt) => {
          const disabled = !!opt.disabledOnBase && isBaseOnly;
          return (
            <ToggleButton key={opt.value} value={opt.value} disabled={disabled} disableRipple>
              <Tooltip title={disabled ? "Base 表示中は家具がないため選択できません" : opt.tooltip} arrow>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                  {opt.icon}
                  {opt.label}
                </Box>
              </Tooltip>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
