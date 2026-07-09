// src/features/layout/components/Header/components/OpenProjectDialog.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../../../../../lib/firebase/client";
import { useAuth } from "../../../hooks/useAuthProxy";
import { useNavigate, useParams } from "react-router-dom";


function shortId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s || "-";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function pickWorkspaceName(docId, data) {
  const n =
    typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : typeof data?.title === "string" && data.title.trim()
      ? data.title.trim()
      : "";
  return n || `Workspace-${shortId(docId)}`;
}

/**
 * OpenProjectDialog (Workspace Version)
 * - + ボタンで開く「ワークスペース選択ダイアログ」
 * - projects/{projectId}/workspaces を購読して一覧表示
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onPick: ({ workspaceId, name, path }) => void
 */
export default function OpenProjectDialog({ open, onClose, onPick }) {
  const theme = useTheme();
  const { user } = useAuth();
  const uid = user?.uid || null;

  const navigate = useNavigate();
  const { projectId } = useParams();

  const [search, setSearch] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // openした瞬間に検索をクリアしたい（好み）
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // ---------------------------
  // fetch workspaces for dialog
  // ---------------------------
  useEffect(() => {
    if (!open) return;
    if (!uid || !projectId) {
      setWorkspaces([]);
      return;
    }

    setLoadingWorkspaces(true);

    const wsQ = query(collection(db, "projects", projectId, "workspaces"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      wsQ,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            name: pickWorkspaceName(d.id, data),
          };
        });
        setWorkspaces(list);
        setLoadingWorkspaces(false);
      },
      (err) => {
        console.warn("[OpenProjectDialog] workspaces snapshot error:", err);
        setWorkspaces([]);
        setLoadingWorkspaces(false);
      }
    );

    return () => unsub();
  }, [open, uid, projectId]);

  const allWorkspaces = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) => w.name.toLowerCase().includes(q) || String(w.id || "").toLowerCase().includes(q)
    );
  }, [workspaces, search]);

  const handlePickWorkspace = useCallback(
    (ws) => {
      if (!ws?.id || !projectId) return;

      const path = `/app/layout/projects/${projectId}/workspaces/${ws.id}`;

      onPick?.({
        workspaceId: ws.id,
        name: ws.name,
        path,
      });
      
      navigate(path);
      onClose?.();
    },
    [projectId, navigate, onClose, onPick]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 1,
          background: "linear-gradient(180deg, rgba(14,18,40,0.95), rgba(7,10,24,0.92))",
          border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
          boxShadow: "0 18px 80px rgba(0,0,0,0.55)",
          width: 520,
          maxWidth: "92vw",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FolderRoundedIcon sx={{ opacity: 0.85 }} />
          <Typography sx={{ fontWeight: 900 }}>Open Project</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, pb: 2.25 }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ opacity: 0.7 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              background: alpha(theme.palette.common.white, 0.04),
            },
          }}
        />

        <Divider sx={{ mb: 1.25, borderColor: alpha(theme.palette.common.white, 0.08) }} />

        {loadingWorkspaces && (
          <Typography sx={{ opacity: 0.7, fontSize: 13, py: 2 }}>Loading...</Typography>
        )}

        {!loadingWorkspaces && allWorkspaces.length === 0 && (
          <Typography sx={{ opacity: 0.7, fontSize: 13, py: 2 }}>No workspaces found.</Typography>
        )}

        {!loadingWorkspaces && allWorkspaces.length > 0 && (
          <List dense sx={{ maxHeight: 320, overflow: "auto", pr: 0.5 }}>
            {allWorkspaces.map((w) => (
              <ListItemButton
                key={w.id}
                onClick={() => handlePickWorkspace(w)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                  background: alpha(theme.palette.common.white, 0.02),
                  "&:hover": { background: alpha(theme.palette.common.white, 0.05) },
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {w.name}
                      </Typography>
                    </Box>
                  }
                  secondary={<Typography sx={{ opacity: 0.55, fontSize: 11.5 }}>{w.id}</Typography>}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
