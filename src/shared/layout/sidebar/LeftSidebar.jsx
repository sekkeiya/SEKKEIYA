import React, { useState, useMemo } from "react";
import {
  Box, Typography, CardActionArea, IconButton, InputBase,
  Tooltip, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, CircularProgress, Divider,
} from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { useNavigate, useLocation } from "react-router-dom";
import { BRAND } from "@/shared/ui/theme";
import { useProjects, createProject, updateProject, deleteProject } from "@sekkeiya/global-panel";
import { useAuth } from "@/features/auth/context/AuthContext";

const projectHue = (name = "") =>
  [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

function SectionHeader({ label, onAdd, addTitle }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 0.5, mt: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>
        {label}
      </Typography>
      <Tooltip title={addTitle} placement="top">
        <IconButton
          size="small"
          onClick={onAdd}
          sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" }, width: 20, height: 20 }}
        >
          <AddRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function ProjectItem({ project, active, onClick, onRename, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const hue = projectHue(project.name);

  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.25 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          "&:hover": { bgcolor: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)" },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5, mr: 1.25, flexShrink: 0,
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FolderRoundedIcon sx={{ fontSize: 13, color: "#fff" }} />
        </Box>
        <Typography sx={{
          color: active ? "#fff" : "rgba(255,255,255,0.7)",
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, pr: 1,
        }}>
          {project.name}
        </Typography>
      </CardActionArea>

      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        sx={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          opacity: 0, transition: "opacity 0.15s",
          color: "rgba(255,255,255,0.5)",
          ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
          "&:hover": { color: "#fff" },
          p: 0.5,
        }}
      >
        <MoreVertIcon sx={{ fontSize: 16 }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, minWidth: 140 } }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); onRename(project); }} sx={{ fontSize: 13, py: 1 }}>
          名前を変更
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDelete(project); }} sx={{ fontSize: 13, py: 1, color: "#ff4d4f" }}>
          削除
        </MenuItem>
      </Menu>
    </Box>
  );
}

function TeamSection({ projects, activeProjectId, onProjectClick }) {
  const teamProjects = projects.filter((p) => p.ownerId === undefined || p.boardType === "teamBoards");
  if (teamProjects.length === 0) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 2, py: 0.5, mt: 1 }}>
        <GroupRoundedIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }} />
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8 }}>
          Team Projects
        </Typography>
      </Box>
      {teamProjects.map((p) => {
        const hue = projectHue(p.name);
        const isActive = activeProjectId === p.id;
        return (
          <Box key={p.id} sx={{ mx: 1.5, my: 0.25, pl: 0.5 }}>
            <CardActionArea
              onClick={() => onProjectClick(p.id)}
              sx={{
                display: "flex", alignItems: "center", px: 1.25, py: 0.6, borderRadius: 2,
                bgcolor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                "&:hover": { bgcolor: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)" },
              }}
            >
              <Box sx={{
                width: 16, height: 16, borderRadius: 1, mr: 1.25, flexShrink: 0,
                bgcolor: `hsl(${hue}, 50%, 35%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FolderRoundedIcon sx={{ fontSize: 10, color: "#fff" }} />
              </Box>
              <Typography sx={{
                color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                fontSize: 12, fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
              }}>
                {p.name}
              </Typography>
            </CardActionArea>
          </Box>
        );
      })}
    </Box>
  );
}

export default function LeftSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { projects = [], loading } = useProjects(user?.uid);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeProjectId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;

  const myProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects
      .filter((p) => p.ownerId === user?.uid && (!q || p.name?.toLowerCase().includes(q)));
  }, [projects, searchQuery, user?.uid]);

  const teamProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects
      .filter((p) => p.ownerId !== user?.uid && (!q || p.name?.toLowerCase().includes(q)));
  }, [projects, searchQuery, user?.uid]);

  const handleCreate = async () => {
    if (!newProjectName.trim() || !user?.uid) return;
    setIsCreating(true);
    try {
      const created = await createProject({ ownerId: user.uid, name: newProjectName.trim() });
      setCreateOpen(false);
      setNewProjectName("");
      navigate(`/projects/${created.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsProcessing(true);
    try {
      await updateProject(renameTarget.id, { name: renameValue.trim() });
      setRenameTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      await deleteProject(deleteTarget.id);
      if (activeProjectId === deleteTarget.id) navigate("/projects");
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          width: 240,
          height: "100vh",
          bgcolor: BRAND.panel,
          borderRight: `1px solid rgba(255,255,255,0.05)`,
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
          overflowY: "hidden",
          flexShrink: 0,
          animation: "slideInLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          "@keyframes slideInLeft": {
            "0%": { transform: "translateX(-100%)", opacity: 0 },
            "100%": { transform: "translateX(0)", opacity: 1 },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", flex: 1 }}>
              Projects
            </Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff" }, p: 0.5 }}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Search */}
          <Box sx={{
            display: "flex", alignItems: "center", bgcolor: "rgba(0,0,0,0.2)",
            borderRadius: 2, px: 1.25, py: 0.5, border: "1px solid rgba(255,255,255,0.06)",
            "&:focus-within": { borderColor: "rgba(255,255,255,0.15)" }, mb: 1.5,
          }}>
            <SearchRoundedIcon sx={{ fontSize: 15, color: "rgba(255,255,255,0.35)", mr: 0.75 }} />
            <InputBase
              placeholder="プロジェクトを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ color: "#fff", fontSize: 12, flex: 1 }}
            />
          </Box>

          {/* Dashboard link */}
          <CardActionArea
            onClick={() => navigate("/dashboard")}
            sx={{
              display: "flex", alignItems: "center",
              px: 1.25, py: 0.75, borderRadius: 2,
              bgcolor: location.pathname === "/dashboard" ? "rgba(255,255,255,0.08)" : "transparent",
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            <Box sx={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", mr: 1.25 }}>
              <DashboardRoundedIcon sx={{ fontSize: 16, color: location.pathname === "/dashboard" ? "#3498db" : "rgba(255,255,255,0.5)" }} />
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: location.pathname === "/dashboard" ? "#fff" : "rgba(255,255,255,0.7)" }}>
              ダッシュボード
            </Typography>
          </CardActionArea>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />

        {/* Scrollable project list */}
        <Box sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
          {/* My Projects */}
          <SectionHeader label="My Projects" addTitle="プロジェクトを作成" onAdd={() => setCreateOpen(true)} />
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={16} sx={{ color: "rgba(255,255,255,0.3)" }} />
            </Box>
          ) : myProjects.length === 0 ? (
            <Typography sx={{ px: 3, py: 1, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              {searchQuery ? "一致するプロジェクトなし" : "プロジェクトがありません"}
            </Typography>
          ) : (
            myProjects.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                active={activeProjectId === p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                onRename={(proj) => { setRenameTarget(proj); setRenameValue(proj.name); }}
                onDelete={(proj) => setDeleteTarget(proj)}
              />
            ))
          )}

          {/* Team Projects */}
          {teamProjects.length > 0 && (
            <>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", my: 1, mx: 2 }} />
              <TeamSection
                projects={teamProjects}
                activeProjectId={activeProjectId}
                onProjectClick={(id) => navigate(`/projects/${id}`)}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Create project dialog */}
      <Dialog
        open={createOpen}
        onClose={() => !isCreating && setCreateOpen(false)}
        PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", width: { xs: "92vw", sm: 400 }, maxWidth: "100%", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, fontSize: 15, fontWeight: 700 }}>
          <FolderRoundedIcon sx={{ color: "#90caf9" }} />
          新規プロジェクトを作成
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <TextField
            autoFocus margin="dense" label="プロジェクト名" fullWidth variant="outlined"
            value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
            disabled={isCreating}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            InputProps={{ sx: { color: "#fff", fontSize: 14, borderRadius: 2 } }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
            sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "rgba(255,255,255,0.1)" }, "&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" }, "&.Mui-focused fieldset": { borderColor: "#90caf9" } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={isCreating} sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none" }}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newProjectName.trim() || isCreating}
            variant="contained"
            sx={{ bgcolor: "#90caf9", color: "#000", fontWeight: 600, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "#64b5f6" } }}
          >
            {isCreating ? <CircularProgress size={16} color="inherit" /> : "作成"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      {renameTarget && (
        <Dialog
          open
          onClose={() => !isProcessing && setRenameTarget(null)}
          PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", width: { xs: "92vw", sm: 380 }, maxWidth: "100%", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" } }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: 15, pb: 1 }}>プロジェクト名を変更</DialogTitle>
          <DialogContent sx={{ pb: 1 }}>
            <InputBase
              autoFocus fullWidth value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              disabled={isProcessing}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              sx={{ bgcolor: "rgba(0,0,0,0.2)", color: "#fff", px: 2, py: 1, borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)", fontSize: 14 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setRenameTarget(null)} disabled={isProcessing} sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none" }}>
              キャンセル
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || isProcessing}
              variant="contained"
              sx={{ bgcolor: "#3498db", color: "#fff", fontWeight: 600, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "#2980b9" } }}
            >
              {isProcessing ? <CircularProgress size={16} color="inherit" /> : "保存"}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog
          open
          onClose={() => !isProcessing && setDeleteTarget(null)}
          PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", width: { xs: "92vw", sm: 380 }, maxWidth: "100%", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" } }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>プロジェクトを削除</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              「{deleteTarget.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDeleteTarget(null)} disabled={isProcessing} sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none" }}>
              キャンセル
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isProcessing}
              variant="contained"
              sx={{ bgcolor: "#ef4444", color: "#fff", fontWeight: 600, textTransform: "none", borderRadius: 2, "&:hover": { bgcolor: "#dc2626" } }}
            >
              {isProcessing ? <CircularProgress size={16} color="inherit" /> : "削除"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
