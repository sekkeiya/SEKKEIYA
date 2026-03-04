import React from "react";
import { Tooltip, IconButton } from "@mui/material";

export default function BottomIcon({ icon, label, active = false }) {
  return (
    <Tooltip title={label} placement="top">
      <IconButton
        sx={{
          width: 44,
          height: 44,
          color: "rgba(255,255,255,0.85)",
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          border: `1px solid ${
            active ? "rgba(255,255,255,0.16)" : "transparent"
          }`,
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.10)",
          },
        }}
      >
        {React.cloneElement(icon, {
          sx: { color: "rgba(255,255,255,0.88)" },
        })}
      </IconButton>
    </Tooltip>
  );
}
