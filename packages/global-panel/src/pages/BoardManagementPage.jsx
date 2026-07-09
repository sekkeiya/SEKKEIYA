import React, { useState } from "react";
import { 
  Box, Typography, Button, Card, CardContent, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField 
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";

import useBoards from "../hooks/useBoards";
import { createBoard, updateBoardInfo, deleteBoardAndItems } from "../api/boards/crud";
import { BRAND } from "../theme/constants";

export default function BoardManagementPage({ user }) {
  const { boards } = useBoards(user?.uid);

  // Dialog states
  const [editBoard, setEditBoard] = useState(null);
  const [editName, setEditName] = useState("");

  const handleCreateBoard = async () => {
    if (!user) return;
    const name = prompt("ボード名を入力してください", "New Project Board");
    if (!name) return;
    try {
      await createBoard({ userId: user.uid, data: { name, members: [user.uid] } });
    } catch (e) {
      alert("作成失敗: " + e.message);
    }
  };

  const handleEditClick = (b) => {
    setEditBoard(b);
    setEditName(b.name);
  };

  const handleEditSave = async () => {
    if (!editBoard || !user) return;
    try {
      await updateBoardInfo(editBoard.id, { name: editName });
      setEditBoard(null);
    } catch (e) {
      alert("更新失敗: " + e.message);
    }
  };

  const handleDelete = async (b) => {
    if (!user) return;
    if (!window.confirm(`「${b.name}」を削除しますか？\n元には戻せません。`)) return;
    
    // オーナーチェック
    if (b.ownerId !== user.uid) {
      alert("オーナーのみが削除できます");
      return;
    }

    try {
      await deleteBoardAndItems(user.uid, b.id);
    } catch (e) {
      alert("削除失敗: " + e.message);
    }
  };

  const renderBoardCard = (b) => (
    <Card 
      key={b.id} 
      sx={{ 
        mb: 2, 
        bgcolor: "rgba(255,255,255,0.05)", 
        color: "white",
        border: `1px solid ${BRAND.line || 'rgba(255,255,255,0.1)'}`
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: "16px !important" }}>
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {b.visibility === "public" ? <PublicRoundedIcon fontSize="small" sx={{ color: "#3498db" }}/> : <LockRoundedIcon fontSize="small" sx={{ color: "#9b59b6" }}/>}
            {b.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 3, mt: 1, color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            <Box>更新: {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : "不明"}</Box>
            <Box>アイテム数: {b.itemCount || 0}</Box>
            {b.memberIds && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PeopleAltRoundedIcon fontSize="small" /> {b.memberIds.length} メンバー
              </Box>
            )}
            {b.ownerId !== user?.uid && (
              <Box sx={{ color: "#f39c12" }}>共有ボード</Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={() => handleEditClick(b)} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <EditRoundedIcon />
          </IconButton>
          {b.ownerId === user?.uid && (
            <IconButton onClick={() => handleDelete(b)} sx={{ color: "error.main" }}>
              <DeleteRoundedIcon />
            </IconButton>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4, color: "white", flex: 1, overflowY: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>プロジェクトボード管理</Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)", mb: 4 }}>
        プロジェクトの作成・設定・メンバー管理を行うページです。
      </Typography>

      <Button variant="contained" onClick={handleCreateBoard} sx={{ mb: 4, bgcolor: BRAND.primary || '#007bff' }}>
        ＋ 新規ボードを作成
      </Button>

      <Box>
        {boards.length === 0 ? (
          <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>参加しているプロジェクトボードはありません</Typography>
        ) : (
          boards.map(renderBoardCard)
        )}
      </Box>

      <Dialog open={!!editBoard} onClose={() => setEditBoard(null)} PaperProps={{ sx: { bgcolor: "#1e1e1e", color: "white" } }}>
        <DialogTitle>ボード名を編集</DialogTitle>
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
          <Button onClick={() => setEditBoard(null)} sx={{ color: "rgba(255,255,255,0.7)" }}>キャンセル</Button>
          <Button onClick={handleEditSave} variant="contained" sx={{ bgcolor: BRAND.primary || '#007bff' }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
