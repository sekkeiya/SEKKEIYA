import React, { useState } from "react";
import { Box, Tooltip, IconButton, Divider } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import { useAuth } from "@/features/auth/context/AuthContext";
import sharePng from "@/assets/icons/share.png";
import sekkeiyaPng from "@/assets/icons/sekkeiya.png";
import layoutPng from "@/assets/icons/layout.png";
import presentsPng from "@/assets/icons/presents.png";
import questPng from "@/assets/icons/quest.png";

import { BRAND } from "../ui/theme";
import NavIcon from "../ui/NavIcon";
import { useGlobalPanelStore } from "sekkeiya-global-panel";

const AppImageIcon = ({ src, alt }) => (
  <Box
    component="img"
    src={src}
    alt={alt}
    sx={{
      width: 28,
      height: 28,
      borderRadius: "50%",
      objectFit: "cover",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    }}
  />
);

const SekkeiyaIcon = () => <AppImageIcon src={sekkeiyaPng} alt="SEKKEIYA" />;
const ShareIcon = () => <AppImageIcon src={sharePng} alt="3DSS" />;
const LayoutIcon = () => <AppImageIcon src={layoutPng} alt="3DSL" />;
const PresentsIcon = () => <AppImageIcon src={presentsPng} alt="3DSP" />;
const QuestIcon = () => <AppImageIcon src={questPng} alt="3DSQ" />;

const MiniSidebar = ({ onToggle, isExpanded, activeTab, onSelectTab, sekkeiyaHref, shareHref, layoutHref, presentsHref, questHref }) => (
  <Box
    sx={{
      width: 72,
      borderRight: `1px solid ${BRAND.line}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      py: 1.75,
      gap: 1,
      height: "100vh",
      bgcolor: BRAND.bg,
      position: "relative",
      zIndex: 20,
    }}
  >
    <Tooltip title={isExpanded ? "メニューを閉じる" : "メニューを開く"} placement="right">
      <IconButton 
        onClick={onToggle} 
        sx={{ 
          mb: 1, 
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
          transform: isExpanded ? "rotate(180deg) scale(0.9)" : "rotate(0deg) scale(1)",
        }}
      >
        {isExpanded ? <MenuOpenRoundedIcon sx={{ color: BRAND.text }} /> : <MenuRoundedIcon sx={{ color: BRAND.text }} />}
      </IconButton>
    </Tooltip>

    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: 1.5,
        bgcolor: BRAND.panel2,
        border: `1px solid ${BRAND.line}`,
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        letterSpacing: 0.3,
        fontSize: 14,
      }}
    >
      S
    </Box>

    <Tooltip title="New" placement="right">
      <IconButton
        sx={{
          mt: 0.25,
          width: 42,
          height: 42,
          bgcolor: BRAND.panel,
          border: `1px solid ${BRAND.line}`,
          "&:hover": { bgcolor: "rgba(255,255,255,0.11)" },
        }}
      >
        <AddRoundedIcon sx={{ color: BRAND.text }} />
      </IconButton>
    </Tooltip>

    <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

    <NavIcon icon={<HomeRoundedIcon />} label="ホーム" active={activeTab === "home"} onClick={() => onSelectTab("home")} />
    <NavIcon icon={<HubRoundedIcon />} label="ハブ" active={activeTab === "hub"} onClick={() => onSelectTab("hub")} />
    <NavIcon icon={<FolderRoundedIcon />} label="AIドライブ" active={activeTab === "drive"} onClick={() => onSelectTab("drive")} />

    <Divider sx={{ width: "60%", opacity: 0.25, my: 0.5 }} />

    {/* app tools */}
    <NavIcon icon={<SekkeiyaIcon />} label="SEKKEIYA" href={sekkeiyaHref} />
    <NavIcon icon={<ShareIcon />} label="3DSS" href={shareHref} />
    <NavIcon icon={<LayoutIcon />} label="3DSL" href={layoutHref} />
    <NavIcon icon={<PresentsIcon />} label="3DSP" href={presentsHref} />
    <NavIcon icon={<QuestIcon />} label="3DSQ" href={questHref} />

    <Box sx={{ flex: 1 }} />

    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        bgcolor: "rgba(0, 180, 255, 0.18)",
        border: `1px solid rgba(0, 180, 255, 0.32)`,
        mb: 1,
      }}
    />
  </Box>
);

const ExpandedSidebarItem = ({ icon, label, href, onClick, onDelete }) => {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (!href) return;
    if (e.ctrlKey || e.metaKey) {
      window.open(href, "_blank");
    } else {
      if (href.startsWith("http") || href.startsWith("/app/")) {
        window.location.assign(href);
      } else {
        window.location.assign(href); // using window location since no React Router here
      }
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
        color: "rgba(255,255,255,0.7)",
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
      <Box sx={{ fontSize: 13, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
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

const ExpandedSidebar = ({ onClose, projects, onCreateProject, onDeleteProject, onSelectProject, activeTab, onSelectTab }) => (
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

    <ExpandedSidebarItem icon={<HomeRoundedIcon sx={{ fontSize: 20 }} />} label="ホーム" onClick={() => onSelectTab("home")} />
    <ExpandedSidebarItem icon={<HubRoundedIcon sx={{ fontSize: 20 }} />} label="ハブ" onClick={() => onSelectTab("hub")} />

    <Divider sx={{ opacity: 0.1, my: 1.5, mx: 2 }} />
    
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mb: 0.5 }}>
      <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>公開プロジェクト</Box>
      <IconButton size="small" onClick={() => onCreateProject("public")} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}>
        <AddRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
    {projects.filter(p => p.type === "public").map(p => (
      <ExpandedSidebarItem 
        key={p.id} 
        icon={<FolderSharedRoundedIcon sx={{ fontSize: 18, color: "#3498db" }} />} 
        label={p.name} 
        onClick={() => onSelectProject?.(p)} 
        onDelete={() => onDeleteProject(p.id)} 
      />
    ))}

    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mt: 2, mb: 0.5 }}>
      <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>非公開プロジェクト</Box>
      <IconButton size="small" onClick={() => onCreateProject("private")} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}>
        <AddRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
    {projects.filter(p => p.type === "private").map(p => (
      <ExpandedSidebarItem 
        key={p.id} 
        icon={<LockRoundedIcon sx={{ fontSize: 18, color: "#9b59b6" }} />} 
        label={p.name} 
        onClick={() => onSelectProject?.(p)} 
        onDelete={() => onDeleteProject(p.id)} 
      />
    ))}
  </Box>
);

export default function LeftSidebar({ onSelectProject, activeTab, onSelectTab }) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [projects, setProjects] = useState([
    { id: "1", name: "Sample House 3D", type: "public" },
    { id: "2", name: "Tokyo Office Layout", type: "public" },
    { id: "3", name: "Personal Concept A", type: "private" },
  ]);

  const setSidebarExpanded = useGlobalPanelStore(state => state.setSidebarExpanded);

  React.useEffect(() => {
    setSidebarExpanded(isExpanded);
  }, [isExpanded, setSidebarExpanded]);

  const handleCreateProject = (type) => {
    const title = prompt(`${type === "public" ? "公開" : "非公開"}プロジェクト名を入力してください`);
    if (title && title.trim()) {
      const newProject = { id: Date.now().toString(), name: title.trim(), type };
      setProjects([...projects, newProject]);
    }
  };

  const handleDeleteProject = (id) => {
    if (window.confirm("このプロジェクトを削除しますか？")) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const sekkeiyaHref = "/";
  const shareHref = user ? "/app/share/dashboard" : "/app/share/";
  const layoutHref = user ? "/app/layout/dashboard" : "/app/layout/";
  const presentsHref = "/app/presents/";
  const questHref = "/app/quest/";

  return (
    <Box
      sx={{
        display: "flex",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 50,
      }}
    >
      <MiniSidebar
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        sekkeiyaHref={sekkeiyaHref}
        shareHref={shareHref}
        layoutHref={layoutHref}
        presentsHref={presentsHref}
        questHref={questHref}
      />
      
      {isExpanded && (
        <ExpandedSidebar
          onClose={() => setIsExpanded(false)}
          projects={projects}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onSelectProject={onSelectProject}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />
      )}
    </Box>
  );
}
