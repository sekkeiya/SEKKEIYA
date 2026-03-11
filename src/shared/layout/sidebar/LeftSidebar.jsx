import React, { useState } from "react";
import { Box, Divider, IconButton } from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useNavigate, useLocation } from "react-router-dom";
import { BRAND } from "@/shared/ui/theme";
import useBoards from "@/shared/hooks/useBoards";

const ExpandedSidebarItem = ({ icon, label, href, onClick, onDelete, active }) => {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (!href) return;
    if (e.ctrlKey || e.metaKey) {
      window.open(href, "_blank");
    } else {
      window.location.assign(href);
    }
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.25,
        cursor: "pointer",
        borderRadius: 1.5,
        mx: 1.5,
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
        bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          color: "#fff",
        },
        "&:hover .delete-btn": {
          opacity: 1,
        }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
        {icon}
      </Box>
      <Box sx={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      {href && <OpenInNewRoundedIcon sx={{ fontSize: 14, opacity: 0.3 }} />}
      {onDelete && (
        <IconButton 
          className="delete-btn"
          size="small" 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          sx={{ opacity: 0, transition: "opacity 0.2s", color: "error.main", p: 0.5 }}
        >
          <DeleteRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
};

export default function LeftSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { myBoards, teamBoards } = useBoards();

  const isDrive = location.pathname.startsWith("/dashboard/drive");

  return (
    <Box
      sx={{
        width: 240,
        height: "100vh",
        bgcolor: "rgba(10, 12, 16, 0.95)",
        borderRight: `1px solid ${BRAND.line}`,
        display: "flex",
        flexDirection: "column",
        py: 1.5,
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        overflowY: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, mb: 1, pl: 3 }}>
        <Box sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.9)" }}>MENU</Box>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon sx={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }} />
        </IconButton>
      </Box>

      <Divider sx={{ opacity: 0.1, my: 1, mx: 2 }} />

      <ExpandedSidebarItem 
        icon={<FolderRoundedIcon sx={{ fontSize: 20 }} />} 
        label="AIドライブ" 
        active={isDrive}
        onClick={() => navigate("/dashboard/drive")} 
      />

      <Divider sx={{ opacity: 0.1, my: 1.5, mx: 2 }} />
      
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mb: 0.5 }}>
        <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>My Boards</Box>
      </Box>
      {myBoards.map(p => (
        <ExpandedSidebarItem 
          key={p.id} 
          icon={<PersonRoundedIcon sx={{ fontSize: 18, color: "#3498db" }} />} 
          label={p.name} 
          active={location.pathname === `/dashboard/projects/${p.id}`}
          onClick={() => { navigate(`/dashboard/projects/${p.id}`, { state: { board: p } }); }} 
        />
      ))}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mt: 2, mb: 0.5 }}>
        <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>Team Boards</Box>
      </Box>
      {teamBoards.map(p => (
        <ExpandedSidebarItem 
          key={p.id} 
          icon={<GroupRoundedIcon sx={{ fontSize: 18, color: "#9b59b6" }} />} 
          label={p.name} 
          active={location.pathname === `/dashboard/projects/${p.id}`}
          onClick={() => { navigate(`/dashboard/projects/${p.id}`, { state: { board: p } }); }} 
        />
      ))}
    </Box>
  );
}
