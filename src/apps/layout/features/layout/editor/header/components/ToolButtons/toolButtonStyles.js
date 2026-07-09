// src/features/layout/components/Header/components/ToolButtons/toolButtonStyles.js
import { alpha } from "@mui/material/styles";

export function getToolIconButtonSx(theme, { active = false } = {}) {
    const fg = alpha("#fff", 0.92);

    const base = {
        width: 34,
        height: 34,
        borderRadius: 2.2,
        color: fg,
        background: alpha("#fff", 0.06),
        border: `1px solid ${alpha("#fff", 0.12)}`,
        "&:hover": { background: alpha("#fff", 0.1), borderColor: alpha("#fff", 0.18) },
    };

    const activeSx = active
        ? {
            background: alpha(theme.palette.primary.main, 0.22),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
            "&:hover": {
                background: alpha(theme.palette.primary.main, 0.28),
                borderColor: alpha(theme.palette.primary.main, 0.42),
            },
        }
        : null;

    return { ...base, ...(activeSx || {}) };
}

export function getToolDividerSx(theme) {
    return { height: 24, borderColor: alpha(theme.palette.common.white, 0.08) };
}
