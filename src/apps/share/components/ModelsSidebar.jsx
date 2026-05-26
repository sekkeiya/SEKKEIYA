import React, { useState, useMemo } from "react";
import {
  Box, Typography, CardActionArea, IconButton, InputBase, Tooltip,
  Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ShapeLineRoundedIcon from "@mui/icons-material/ShapeLineRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useProjects, createProject, updateProject, deleteProject } from "@sekkeiya/global-panel";
import { useAuth } from "@/features/auth/context/AuthContext";
import { BRAND } from "@/shared/ui/theme";

function ScopeItem({ icon, label, active, onClick, color }) {
  return (
    <Box sx={{ mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex", alignItems: "center",
          px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5, mr: 1,
          bgcolor: color || "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {React.cloneElement(icon, { sx: { fontSize: 14, color: "#fff" } })}
        </Box>
        <Typography sx={{
          color: active ? "#ffffff" : "rgba(255,255,255,0.7)",
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
        }}>
          {label}
        </Typography>
      </CardActionArea>
    </Box>
  );
}

function ProjectItem({ project, active, onClick, onRename, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const hue = [...(project.name || "")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.25 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex", alignItems: "center", px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
          "&:hover": { bgcolor: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)" },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5, mr: 1.25, flexShrink: 0,
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ShapeLineRoundedIcon sx={{ fontSize: 12, color: "#fff" }} />
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
          color: "rgba(255,255,255,0.5)", p: 0.5,
          ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
          "&:hover": { color: "#fff" },
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

function SectionHeader({ label, onAdd }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 0.5, mt: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>
        {label}
      </Typography>
      <Tooltip title="プロジェクト作成" placement="top">
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

export default function ModelsSidebar({ scope, setScope, activeProjectId, setActiveProjectId }) {
  const { user } = useAuth();
  const { projects = [] } = useProjects(user?.uid);

  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen]   = useState(false);
  const [createType, setCreateType]   = useState("my");
  const [newName, setNewName]         = useState("");
  const [isCreating, setIsCreating]   = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue]   = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { myProjects, teamProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = projects.filter((p) => !q || p.name?.toLowerCase().includes(q));
    return {
      myProjects:   filtered.filter((p) => p.ownerId === user?.uid && !p.isTeam),
      teamProjects: filtered.filter((p) => p.ownerId !== user?.uid || p.isTeam),
    };
  }, [projects, searchQuery, user?.uid]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    try {
      setIsCreating(true);
      const proj = await createProject({
        userId: user.uid,
        ownerName: user.email || "User",
        projectName: newName.trim(),
        isTeam: createType === "team",
      });
      setNewName("");
      setCreateOpen(false);
      setActiveProjectId(proj.id);
      setScope(createType === "team" ? "team_project" : "project");
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      setIsProcessing(true);
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
    try {
      setIsProcessing(true);
      await deleteProject(deleteTarget.id);
      if (activeProjectId === deleteTarget.id) {
        setActiveProjectId(null);
        setScope("explore");
      }
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{
      width: 240, height: "100%", flexShrink: 0,
      bgcolor: BRAND.panel,
      borderRight: `1px solid ${BRAND.line}`,
      display: "flex", flexDirection: "column",
      py: 2, overflowY: "auto", overflowX: "hidden",
    }}>
      {/* Header */}
      <Box sx={{ px: 2, mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", mb: 1.5 }}>
          3D Models
        </Typography>
        <Box sx={{
          display: "flex", alignItems: "center",
          bgcolor: "rgba(0,0,0,0.2)", borderRadius: 2, px: 1.5, py: 0.5,
          border: "1px solid rgba(255,255,255,0.05)",
          "&:focus-within": { borderColor: "rgba(255,255,255,0.15)" },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)", mr: 1 }} />
          <InputBase
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: "#fff", fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {/* Global Scopes */}
        <ScopeItem
          icon={<LanguageRoundedIcon />}
          label="Models"
          active={scope === "explore" || scope === "following"}
          onClick={() => setScope("explore")}
          color="#2ecc71"
        />
        <ScopeItem
          icon={<FolderRoundedIcon />}
          label="Public Projects"
          active={false}
          onClick={() => setScope("explore")}
          color="#3498db"
        />

        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        {user && (
          <Box sx={{ mb: 2 }}>
            <ScopeItem
              icon={<PublicRoundedIcon />}
              label="Public Models"
              active={scope === "my_public"}
              onClick={() => setScope("my_public")}
              color="#9b59b6"
            />
            <ScopeItem
              icon={<LockRoundedIcon />}
              label="Private Models"
              active={scope === "my_private"}
              onClick={() => setScope("my_private")}
              color="#e67e22"
            />
          </Box>
        )}

        {/* My Projects */}
        {user && (
          <Box sx={{ mb: 2 }}>
            <SectionHeader label="My Projects" onAdd={() => { setCreateType("my"); setCreateOpen(true); }} />
            {myProjects.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                active={activeProjectId === p.id && (scope === "project")}
                onClick={() => { setActiveProjectId(p.id); setScope("project"); }}
                onRename={(proj) => { setRenameTarget(proj); setRenameValue(proj.name); }}
                onDelete={(proj) => setDeleteTarget(proj)}
              />
            ))}
          </Box>
        )}

        {/* Team Projects */}
        {user && teamProjects.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionHeader label="Team Projects" onAdd={() => { setCreateType("team"); setCreateOpen(true); }} />
            {teamProjects.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                active={activeProjectId === p.id && scope === "team_project"}
                onClick={() => { setActiveProjectId(p.id); setScope("team_project"); }}
                onRename={(proj) => { setRenameTarget(proj); setRenameValue(proj.name); }}
                onDelete={(proj) => setDeleteTarget(proj)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => !isCreating && setCreateOpen(false)}
        PaperProps={{ sx: { bgcolor: "#0f172a", backgroundImage: "none", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {createType === "my" ? "新規マイプロジェクト作成" : "新規チームプロジェクト作成"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={isCreating}
            InputProps={{ style: { color: "#fff" } }}
            InputLabelProps={{ style: { color: "rgba(255,255,255,0.7)" } }}
            sx={{
              mt: 1,
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                "&.Mui-focused fieldset": { borderColor: "#00BFFF" },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={isCreating} sx={{ color: "rgba(255,255,255,0.7)" }}>キャンセル</Button>
          <Button onClick={handleCreate} disabled={isCreating || !newName.trim()} variant="contained" sx={{ bgcolor: "#00BFFF", color: "#000", "&:hover": { bgcolor: "#4facfe" } }}>
            {isCreating ? "作成中..." : "作成"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      {renameTarget && (
        <Box sx={{ position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase
              fullWidth autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              disabled={isProcessing}
              sx={{ bgcolor: "rgba(0,0,0,0.2)", color: "#fff", px: 2, py: 1, borderRadius: 2, border: "1px solid rgba(255,255,255,0.1)", mb: 3 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setRenameTarget(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, "&:hover": { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleRename} sx={{ color: "#00BFFF", fontSize: 13, cursor: isProcessing || !renameValue.trim() ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <Box sx={{ position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              「{deleteTarget.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setDeleteTarget(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, "&:hover": { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleDelete} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
