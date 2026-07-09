import React, { useState } from "react";
import { 
  Box, Typography, Button, Card, CardContent, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Chip, Tooltip, CardActionArea, Divider,
  Tabs, Tab, List, ListItem, ListItemButton, ListItemIcon, ListItemText
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import PublicIcon from "@mui/icons-material/Public";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";

import useProjects from "../hooks/useProjects";
import { createProject, deleteProject } from "../api/projects";
import { useProjectContext } from "../hooks/useProjectContext";
import { BRAND } from "../theme/constants";

export default function ProjectManagementPage({ user }) {
  const { projects } = useProjects(user?.uid);
  const navigate = useNavigate();
  const { setActiveProjectId } = useProjectContext();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [tabIndex, setTabIndex] = useState(0);

  const handleSelectProject = (projectId) => {
    setActiveProjectId(projectId);
    navigate(`/projects/${projectId}`);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user?.uid) return;
    try {
      const createdProject = await createProject({ ownerId: user.uid, name: newProjectName.trim() });
      setCreateDialogOpen(false);
      setNewProjectName("");
      handleSelectProject(createdProject.id);
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("プロジェクトの作成に失敗しました。");
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm("このプロジェクトを削除してもよろしいですか？")) {
      try {
        await deleteProject(projectId);
      } catch (err) {
        console.error("Failed to delete project:", err);
        alert("プロジェクトの削除に失敗しました。");
      }
    }
  };

  const myProjects = projects.filter((p) => !p.boardType || p.boardType === "myBoards");
  const teamProjects = projects.filter((p) => p.boardType === "teamBoards");
  const currentProjects = tabIndex === 0 ? myProjects : teamProjects;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", bgcolor: "rgba(10, 15, 25, 0.4)", overflowY: "auto", boxSizing: "border-box" }}>
      {/* HEADER */}
      <Box sx={{ 
        position: "sticky", top: 0, zIndex: 10, bgcolor: "rgba(15, 22, 35, 0.85)", 
        backdropFilter: "blur(12px)", borderBottom: `1px solid ${BRAND.line}`,
        px: { xs: 3, md: 5 }, py: 3,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            Projects
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 0.5 }}>
            すべてのプロジェクトを管理・横断的にアクセスします
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddRoundedIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ 
            bgcolor: BRAND.primary, color: "#fff",
            borderRadius: 3, px: 3, py: 1,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": { bgcolor: BRAND.primaryHover }
          }}
        >
          New Project
        </Button>
      </Box>

      {/* CONTENT */}
      <Box sx={{ px: { xs: 3, md: 5 }, py: 4, display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(e, v) => setTabIndex(v)}
          sx={{
            minHeight: 40,
            "& .MuiTabs-indicator": { backgroundColor: BRAND.primary },
            "& .MuiTab-root": {
              color: "rgba(255,255,255,0.5)",
              minHeight: 40,
              fontWeight: 600,
              textTransform: "none",
              fontSize: 15,
              "&.Mui-selected": { color: "#fff" }
            }
          }}
        >
          <Tab 
            icon={<LockRoundedIcon sx={{ fontSize: 16, mr: 1, mb: "0 !important" }} />} 
            iconPosition="start" 
            label="マイプロジェクト" 
          />
          <Tab 
            icon={<PublicIcon sx={{ fontSize: 16, mr: 1, mb: "0 !important" }} />} 
            iconPosition="start" 
            label="チームプロジェクト" 
          />
        </Tabs>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", mt: -2, mb: 1 }} />
        
        {currentProjects.length === 0 ? (
           tabIndex === 0 
           ? <EmptyState onCreate={() => setCreateDialogOpen(true)} />
           : <Box sx={{ py: 4, textAlign: "center" }}><Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)" }}>参加中のチームプロジェクトはありません。</Typography></Box>
        ) : (
          <List sx={{ width: "100%", p: 0 }}>
            {currentProjects.map(p => (
              <ProjectListItem key={p.id} project={p} onClick={() => handleSelectProject(p.id)} onDelete={handleDeleteProject} />
            ))}
          </List>
        )}
      </Box>

      {/* CREATE DIALOG */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", width: { xs: "92vw", sm: 480 }, maxWidth: "100%", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>新規プロジェクトの作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateProject();
              }
            }}
            sx={{ 
              mt: 2,
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                bgcolor: "rgba(0,0,0,0.2)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                "&.Mui-focused fieldset": { borderColor: BRAND.primary },
              },
              "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.5)" },
              "& .MuiInputLabel-root.Mui-focused": { color: BRAND.primary }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: "rgba(255,255,255,0.7)", textTransform: "none" }}>
            キャンセル
          </Button>
          <Button 
            onClick={handleCreateProject} 
            variant="contained" 
            disabled={!newProjectName.trim()}
            sx={{ bgcolor: BRAND.primary, color: "#fff", textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: BRAND.primaryHover } }}
          >
            作成する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

export function ProjectCard({ project, onClick, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  
  const handleMenuClick = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  
  const handleMenuClose = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
  };
  
  const handleDelete = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
    if (onDelete) onDelete(project.id);
  };

  const hue = [...project.name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  
  return (
    <Card 
      sx={{ 
        bgcolor: "rgba(255,255,255,0.03)", 
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        height: 200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          borderColor: `hsl(${hue}, 70%, 50%, 0.5)`,
          transform: "translateY(-4px)",
          boxShadow: `0 12px 24px -10px hsl(${hue}, 70%, 50%, 0.3)`
        }
      }}
    >
      <CardActionArea 
        onClick={onClick}
        sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", p: 0 }}
      >
        <Box sx={{ 
          height: 80, 
          background: `linear-gradient(135deg, hsl(${hue}, 40%, 30%), hsl(${(hue + 40) % 360}, 40%, 20%))`,
          position: "relative"
        }}>
          <Box sx={{ 
            position: "absolute", top: "50%", left: 20, transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: 2, bgcolor: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <FolderRoundedIcon sx={{ fontSize: 24, color: "#fff" }} />
          </Box>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column" }}>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 16, mb: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pr: 3 }}>
            {project.name}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            作成: {project.createdAt?.toDate().toLocaleDateString() || "不明"}
          </Typography>
        </Box>
      </CardActionArea>
      <IconButton 
        onClick={handleMenuClick}
        sx={{ 
          position: "absolute", bottom: 12, right: 12, 
          color: "rgba(255,255,255,0.5)",
          "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" }
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }
        }}
      >
        <MenuItem onClick={handleDelete} sx={{ color: "#ff4d4f", fontSize: 14 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>
    </Card>
  );
}

export function EmptyState({ onCreate }) {
  return (
    <Box 
      onClick={onCreate}
      sx={{ 
        border: "1px dashed rgba(255,255,255,0.15)",
        borderRadius: 4,
        p: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        cursor: "pointer",
        transition: "0.2s",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.3)"
        }
      }}
    >
      <FolderRoundedIcon sx={{ fontSize: 40, color: "rgba(255,255,255,0.2)", mb: 1.5 }} />
      <Typography sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>新しいプロジェクトを作成</Typography>
      <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 13, mt: 0.5 }}>ここをクリックして開始</Typography>
    </Box>
  );
}

export function ProjectListItem({ project, onClick, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  
  const handleMenuClick = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  
  const handleMenuClose = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
  };
  
  const handleDelete = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
    if (onDelete) onDelete(project.id);
  };

  const hue = [...project.name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <ListItem 
      disablePadding 
      sx={{ 
        mb: 1.5, 
        bgcolor: "rgba(255,255,255,0.02)", 
        borderRadius: 2, 
        border: "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.2s",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          borderColor: `hsl(${hue}, 70%, 50%, 0.3)`,
        }
      }}
    >
      <ListItemButton onClick={onClick} sx={{ borderRadius: 2, p: 2 }}>
        <ListItemIcon sx={{ minWidth: 56 }}>
          <Box sx={{ 
            width: 40, height: 40, borderRadius: 1.5,
            background: `linear-gradient(135deg, hsl(${hue}, 40%, 30%), hsl(${(hue + 40) % 360}, 40%, 20%))`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <FolderRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
          </Box>
        </ListItemIcon>
        <ListItemText 
          primary={project.name} 
          secondary={`作成: ${project.createdAt?.toDate().toLocaleDateString() || "不明"}`}
          primaryTypographyProps={{ sx: { color: "#fff", fontWeight: 700, fontSize: 15, mb: 0.5 } }}
          secondaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.5)", fontSize: 13 } }}
        />
      </ListItemButton>
      <IconButton onClick={handleMenuClick} sx={{ color: "rgba(255,255,255,0.5)", mr: 1, "&:hover": { color: "#fff" } }}>
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }
        }}
      >
        <MenuItem onClick={handleDelete} sx={{ color: "#ff4d4f", fontSize: 14 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>
    </ListItem>
  );
}
