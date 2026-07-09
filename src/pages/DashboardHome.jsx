import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress,
} from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useProjects, createProject, resolveDefaultBoard } from "@sekkeiya/global-panel";
import { BRAND } from "@/shared/ui/theme";

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, loading } = useProjects(user?.uid);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;
    try {
      setIsCreating(true);
      await createProject({ name: newProjectName.trim(), ownerId: user.uid });
      setNewProjectName("");
      setIsDialogOpen(false);
    } catch (e) {
      console.error("Failed to create project:", e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectProject = async (projectId) => {
    try {
      const defaultBoardId = await resolveDefaultBoard(projectId, "requirements");
      navigate(`/projects/${projectId}/${defaultBoardId || ""}`);
    } catch {
      navigate(`/projects/${projectId}`);
    }
  };

  return (
    <Box
      sx={{
        flex: 1,
        p: { xs: 3, md: 6 },
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        "&::-webkit-scrollbar": { width: 8 },
        "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.02)" },
        "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.1)", borderRadius: 4 },
        "&::-webkit-scrollbar-thumb:hover": { background: "rgba(255,255,255,0.2)" },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          maxWidth: 1000,
          mx: "auto",
          width: "100%",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
          最近のプロジェクト
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setIsDialogOpen(true)}
          sx={{
            bgcolor: "rgba(255,255,255,0.1)",
            color: "#fff",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: 2,
            px: 2,
            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
          }}
        >
          新規手動作成
        </Button>
      </Box>

      {/* Project Grid */}
      <Box sx={{ maxWidth: 1000, mx: "auto", width: "100%" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
            <CircularProgress size={32} sx={{ color: "rgba(255,255,255,0.3)" }} />
          </Box>
        ) : projects.length === 0 ? (
          <Box
            sx={{
              p: 8,
              textAlign: "center",
              border: `1px dashed ${BRAND.line}`,
              borderRadius: 4,
              bgcolor: "rgba(255,255,255,0.01)",
            }}
          >
            <FolderRoundedIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.2)", mb: 2 }} />
            <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.8)", mb: 1, fontWeight: 700 }}>
              プロジェクトがありません
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.5)", mb: 4 }}>
              以下のボタンから最初のプロジェクトを作成してください。
            </Typography>
            <Button
              variant="contained"
              onClick={() => setIsDialogOpen(true)}
              startIcon={<AddRoundedIcon />}
              sx={{
                bgcolor: "#00BFFF",
                color: "#000",
                textTransform: "none",
                borderRadius: 2,
                fontWeight: 800,
                "&:hover": { bgcolor: "#4facfe" },
              }}
            >
              最初のプロジェクトを作成
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 3,
            }}
          >
            {projects.map((project) => {
              const hue =
                [...(project.name || "")].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
              return (
                <Paper
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  sx={{
                    p: 3,
                    bgcolor: BRAND.panel,
                    borderRadius: 3,
                    border: `1px solid ${BRAND.line}`,
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: "rgba(255,255,255,0.2)",
                      bgcolor: "rgba(255,255,255,0.03)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      color: "rgba(255,255,255,0.3)",
                      "&:hover": { color: "#fff" },
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>

                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: `hsl(${hue}, 50%, 20%)`,
                      border: `1px solid hsl(${hue}, 50%, 30%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                    }}
                  >
                    <FolderRoundedIcon sx={{ fontSize: 20, color: `hsl(${hue}, 80%, 70%)` }} />
                  </Box>

                  <Typography
                    variant="subtitle1"
                    noWrap
                    sx={{ fontWeight: 700, color: "#fff", mb: 0.5 }}
                  >
                    {project.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.4)", display: "block", fontWeight: 500 }}
                  >
                    Last updated recently
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Create Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={() => !isCreating && setIsDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: BRAND.panel,
            color: "#fff",
            border: `1px solid ${BRAND.line}`,
            width: { xs: "92vw", sm: 480 },
            maxWidth: "100%",
          },
        }}
      >
        <DialogTitle>新規プロジェクト作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            type="text"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
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
          <Button
            onClick={() => setIsDialogOpen(false)}
            disabled={isCreating}
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCreateProject}
            disabled={isCreating || !newProjectName.trim()}
            variant="contained"
            sx={{ bgcolor: "#00BFFF", color: "#000", "&:hover": { bgcolor: "#4facfe" } }}
          >
            {isCreating ? "作成中..." : "作成"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
