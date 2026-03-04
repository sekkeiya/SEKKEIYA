import React from "react";
import { Tooltip, IconButton } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NavIcon({ icon, label, active = false, href, onClick }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (href) {
      if (e.ctrlKey || e.metaKey) {
        window.open(href, "_blank");
      } else {
        if (href.startsWith("http") || href.startsWith("/app/")) {
          window.location.assign(href);
        } else {
          navigate(href);
        }
      }
    }
  };

  return (
    <Tooltip title={label} placement="right">
      <IconButton
        onClick={handleClick}
        sx={{
          width: 42,
          height: 42,
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
        {React.isValidElement(icon)
          ? React.cloneElement(icon, {
              sx: { color: "rgba(255,255,255,0.86)", ...icon.props?.sx },
            })
          : icon}
      </IconButton>
    </Tooltip>
  );
}
