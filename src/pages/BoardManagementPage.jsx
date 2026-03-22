import React, { useState } from "react";
import { 
  Box, Typography, Tabs, Tab, Button, Card, CardContent, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField 
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";

import useBoards from "@/shared/hooks/useBoards";
import { useAuth } from "@/features/auth/context/AuthContext";
import { createMyBoard, updateMyBoardInfo, deleteMyBoardAndModels } from "@/shared/api/boards/myBoards";
import { createTeamBoard, updateTeamBoardName, deleteTeamBoardIfOwner } from "@/shared/api/boards/teamBoards";
import { BRAND } from "@/shared/ui/theme";

export default function BoardManagementPage() {
  const { user } = useAuth();
  const { myBoards, teamBoards } = useBoards();
  const [tabIndex, setTabIndex] = useState(0);

  // Dialog states
  const [editBoard, setEditBoard] = useState(null);
  const [editName, setEditName] = useState("");

  const handleTabChange = (e, val) => setTabIndex(val);

  const handleCreateMyBoard = async () => {
    if (!user) return;
    const name = prompt("マイボード名を入力してください", "New My Board");
    if (!name) return;
    try {
      await createMyBoard({ userId: user.uid, data: { name } });
    } catch (e) {
      alert("作成失敗: " + e.message);
    }
  };

  const handleCreateTeamBoard = async () => {
    if (!user) return;
    const name = prompt("チームボード名を入力してください", "New Team Board");
    if (!name) return;
    try {
      await createTeamBoard({ userId: user.uid, name, members: [user.uid] });
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
      if (editBoard.boardType === "myBoards" || editBoard.boardType === "personal") {
        await updateMyBoardInfo(user.uid, editBoard.id, { name: editName });
      } else {
        await updateTeamBoardName(user.uid, editBoard.id, editName);
      }
      setEditBoard(null);
    } catch (e) {
      alert("更新失敗: " + e.message);
    }
  };

  const handleDelete = async (b) => {
    if (!user) return;
    if (!window.confirm(`「${b.name}」を削除しますか？\n元には戻せません。`)) return;
    try {
      if (b.boardType === "myBoards" || b.boardType === "personal") {
        await deleteMyBoardAndModels(user.uid, b.id);
      } else {
        await deleteTeamBoardIfOwner(user.uid, b.id);
      }
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
        border: `1px solid ${BRAND.line}`
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
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={() => handleEditClick(b)} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <EditRoundedIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(b)} sx={{ color: "error.main" }}>
            <DeleteRoundedIcon />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4, color: "white", flex: 1, overflowY: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>ボード管理</Typography>
      <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.7)", mb: 4 }}>
        公開・非公開・チームごとのプロジェクトボードを作成・設定・メンバー管理するページです。
      </Typography>

      <Tabs 
        value={tabIndex} 
        onChange={handleTabChange} 
        sx={{ 
          mb: 3, 
          ".MuiTab-root": { color: "rgba(255,255,255,0.5)" },
          ".Mui-selected": { color: "#fff !important" },
          ".MuiTabs-indicator": { bgcolor: BRAND.primary }
        }}
      >
        <Tab label="My Boards" />
        <Tab label="Team Boards" />
      </Tabs>

      {tabIndex === 0 && (
        <Box>
          <Button variant="contained" onClick={handleCreateMyBoard} sx={{ mb: 3, bgcolor: BRAND.primary }}>
            ＋ マイボードを作成
          </Button>
          {myBoards.length === 0 ? (
            <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>マイボードはありません</Typography>
          ) : (
            myBoards.map(renderBoardCard)
          )}
        </Box>
      )}

      {tabIndex === 1 && (
        <Box>
          <Button variant="contained" onClick={handleCreateTeamBoard} sx={{ mb: 3, bgcolor: BRAND.primary }}>
            ＋ チームボードを作成
          </Button>
          {teamBoards.length === 0 ? (
            <Typography sx={{ color: "rgba(255,255,255,0.5)" }}>チームボードはありません</Typography>
          ) : (
            teamBoards.map(renderBoardCard)
          )}
        </Box>
      )}

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
          <Button onClick={handleEditSave} variant="contained" sx={{ bgcolor: BRAND.primary }}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
