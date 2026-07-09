import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

import { useWorkspaceStructureStore } from "../../../store/useWorkspaceStructureStore";

// 現在 Base / Plan / Option のどれを開いているかを「Base: 01 › Plan 1」の形で表示する。
// 各クラム（最後＝現在地以外）はクリックでその階層へ表示を切り替える。
//  - Base クラム → selectBase（Plan/Option を解除して土台のみ表示＝躯体編集）
//  - Plan クラム → selectPlan（Option を解除して Plan を表示）
// Plan/Option 未選択（=Base のみ開いている）ときは躯体モード相当が自動 ON。
export default function StructureBreadcrumb() {
  const selectedBaseId = useWorkspaceStructureStore((s) => s.selectedBaseId);
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);
  const bases = useWorkspaceStructureStore((s) => s.bases);
  const plans = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const options = useWorkspaceStructureStore((s) => s.options);
  const selectBase = useWorkspaceStructureStore((s) => s.selectBase);
  const selectPlan = useWorkspaceStructureStore((s) => s.selectPlan);

  const baseName =
    (Array.isArray(bases) ? bases : []).find((b) => b?.id === selectedBaseId)?.name || null;
  const planName = selectedPlanId
    ? (Array.isArray(plans) ? plans : []).find((p) => p?.id === selectedPlanId)?.name || "Plan"
    : null;
  const optionName = selectedOptionId
    ? (Array.isArray(options) ? options : []).find((o) => o?.id === selectedOptionId)?.name || "Option"
    : null;

  if (!selectedBaseId) return null;

  const crumbs = [
    { key: "base", label: `Base: ${baseName || "—"}`, onClick: () => selectBase(selectedBaseId) },
  ];
  if (planName) {
    crumbs.push({ key: "plan", label: planName, onClick: () => selectPlan(selectedPlanId) });
  }
  if (optionName) {
    crumbs.push({ key: "option", label: optionName, onClick: null });
  }

  // Plan/Option を開いていない＝Base 編集（躯体モード相当）であることを示すバッジ。
  const isBaseOnly = !planName && !optionName;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, minWidth: 0, overflow: "hidden" }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const clickable = !isLast && typeof crumb.onClick === "function";
        return (
          <React.Fragment key={crumb.key}>
            {i > 0 && (
              <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", flexShrink: 0 }} />
            )}
            <Typography
              noWrap
              onClick={clickable ? crumb.onClick : undefined}
              role={clickable ? "button" : undefined}
              sx={{
                fontSize: 12.5,
                fontWeight: isLast ? 800 : 600,
                color: isLast ? "color-mix(in srgb, var(--brand-fg) 95%, transparent)" : alpha("#fff", 0.6),
                letterSpacing: 0.2,
                cursor: clickable ? "pointer" : "default",
                borderRadius: 0.75,
                px: clickable ? 0.5 : 0,
                transition: "color 0.12s, background 0.12s",
                ...(clickable && {
                  "&:hover": {
                    color: "color-mix(in srgb, var(--brand-fg) 95%, transparent)",
                    background: alpha("#fff", 0.08),
                    textDecoration: "underline",
                  },
                }),
              }}
            >
              {crumb.label}
            </Typography>
          </React.Fragment>
        );
      })}
      {isBaseOnly && (
        <Box
          sx={{
            ml: 0.75,
            px: 0.75,
            height: 18,
            display: "flex",
            alignItems: "center",
            borderRadius: 0.75,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.3,
            color: "light-dark(rgba(12,141,161,0.95), rgba(34,211,238,0.95))",
            background: alpha("#22d3ee", 0.16),
            border: `1px solid ${alpha("#22d3ee", 0.4)}`,
            flexShrink: 0,
          }}
        >
          躯体編集
        </Box>
      )}
    </Box>
  );
}
