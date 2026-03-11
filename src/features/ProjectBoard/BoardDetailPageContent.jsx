import React from "react";
import { Box, Toolbar, Typography, Button } from "@mui/material";
import BoardDetailInformation from "./BoardDetailInformation";
import { useSelectedBoardContext } from "@/shared/contexts/SelectedBoardContext";
import { useAuth } from "@/features/auth/context/AuthContext";

const EmptyState = ({ onBack }) => (
  <Box sx={{ p: 3 }}>
    <Typography variant="h6" sx={{ mb: 1 }}>
      ボードが選択されていません
    </Typography>
    <Typography variant="body2" sx={{ color: "grey.400", mb: 2 }}>
      左サイドバーの「Edit」からボードを選択してください。
    </Typography>
    {onBack && (
      <Button variant="outlined" size="small" onClick={onBack}>
        一覧に戻る
      </Button>
    )}
  </Box>
);

const BoardDetailPageContent = () => {
  const { user } = useAuth();
  const { selectedBoard, setIsBoardEditMode } = useSelectedBoardContext();

  // --- 汎用に拾う ---
  const boardType = selectedBoard?.boardType ?? "myBoards";
  const boardId =
    selectedBoard?.id ??
    selectedBoard?.boardId ??
    null;

  const resolvedUserId =
    selectedBoard?.owner ??
    selectedBoard?.ownerId ??
    selectedBoard?.userId ??
    (boardType === "myBoards" ? user?.uid : null);

  // 必須チェック（teamBoards は userId不要）
  const hasEnoughIds =
    boardType === "teamBoards" ? !!boardId : !!(resolvedUserId && boardId);

  if (!selectedBoard || !hasEnoughIds) {
    return (
      <Box sx={{ backgroundColor: "#1e1e1e", minHeight: "100%", color: "#fff" }}>
        <Toolbar />
        <EmptyState />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: "#1e1e1e", minHeight: "100%", color: "#fff" }}>
      <BoardDetailInformation
        boardType={boardType}
        userId={resolvedUserId}
        boardId={boardId}
        selectedBoard={selectedBoard}
        setIsBoardEditMode={setIsBoardEditMode}
      />
    </Box>
  );
};

export default BoardDetailPageContent;
