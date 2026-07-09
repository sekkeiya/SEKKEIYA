import React, { useState, useEffect } from "react";
import { 
  Box, Typography, Button, Card, CardContent, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField 
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import { useAuth } from "@layout/features/auth/AuthContext";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";
import { createWorkspace, updateWorkspaceInfo, deleteWorkspace } from "@layout/shared/api/workspaces/workspaces";
import { BRAND } from "@layout/shared/ui/theme";

export default function BoardManagementPage({ projectId }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  
  // Dialog states
  const [editWorkspace, setEditWorkspace] = useState(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!projectId) return;
    
    const q = query(collection(db, "projects", projectId, "workspaces"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by updatedAt descending
      data.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setWorkspaces(data);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleCreateWorkspace = async () => {
    if (!user || !projectId) return;
    const name = prompt("ワークスペース名を入力してください", "New Workspace");
    if (!name) return;
    try {
      await createWorkspace({ projectId, userId: user.uid, name, visibility: "private" });
    } catch (e) {
      alert("作成失敗: " + e.message);
    }
  };

  const handleEditClick = (w) => {
    setEditWorkspace(w);
    setEditName(w.name);
  };

  const handleEditSave = async () => {
    if (!editWorkspace || !projectId) return;
    try {
      await updateWorkspaceInfo(projectId, editWorkspace.id, { name: editName });
      setEditWorkspace(null);
    } catch (e) {
      alert("更新失敗: " + e.message);
    }
  };

  const handleDelete = async (w) => {
    if (!projectId) return;
    if (!window.confirm(`「${w.name}」を削除しますか？\n元には戻せません。`)) return;
    try {
      await deleteWorkspace(projectId, w.id);
    } catch (e) {
      alert("削除失敗: " + e.message);
    }
  };

  const renderWorkspaceCard = (w) => (
    <Card 
      key={w.id} 
      sx={{ 
        mb: 2, 
        bgcolor: "rgba(255,255,255,0.05)", 
        color: "white",
        border: `1px solid ${BRAND.line}`
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: "16px !important" }}>
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {w.visibility === "public" ? <PublicRoundedIcon fontSize="small" sx={{ color: "#3498db" }}/> : <LockRoundedIcon fontSize="small" sx={{ color: "#9b59b6" }}/>}
            {w.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 3, mt: 1, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            <Box>更新: {w.updatedAt?.toDate() ? w.updatedAt.toDate().toLocaleDateString() : "不明"}</Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={() => handleEditClick(w)} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <EditRoundedIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(w)} sx={{ color: "error.main" }}>
            <DeleteRoundedIcon />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4, color: "white", flex: 1, overflowY: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>ワークスペース管理</Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)", mb: 4 }}>
        このプロジェクト内のワークスペースを作成・設定・管理します。
      </Typography>

      <Box>
        <Button variant="contained" onClick={handleCreateWorkspace} sx={{ mb: 3, bgcolor: BRAND.primary }}>
          ＋ ワークスペースを作成
        </Button>
        {workspaces.length === 0 ? (
          <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>ワークスペースはありません</Typography>
        ) : (
          workspaces.map(renderWorkspaceCard)
        )}
      </Box>

      <Dialog open={!!editWorkspace} onClose={() => setEditWorkspace(null)} PaperProps={{ sx: { bgcolor: "#1e1e1e", color: "white" } }}>
        <DialogTitle>ワークスペース名を編集</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            fullWidth 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            sx={{ 
              mt: 1,
              input: { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                "&:hover fieldset": { borderColor: "white" }
              }
            }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditWorkspace(null)} sx={{ color: "rgba(255,255,255,0.7)" }}>キャンセル</Button>
          <Button onClick={handleEditSave} variant="contained" sx={{ bgcolor: BRAND.primary }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
