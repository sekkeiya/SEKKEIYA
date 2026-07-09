import React from "react";
import { Box, Toolbar, Typography, Button } from "@mui/material";
import BoardDetailInformation from "./BoardDetailInformation";
import { useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";
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
  const { selectedProject, setIsProjectEditMode } = useSelectedProjectContext();

  // --- 汎用に拾う ---
  const boardType = selectedProject?.boardType ?? "myBoards";
  const projectId =
    selectedProject?.id ??
    selectedProject?.projectId ??
    null;

  const resolvedUserId =
    selectedProject?.owner ??
    selectedProject?.ownerId ??
    selectedProject?.userId ??
    (boardType === "myBoards" ? user?.uid : null);

  // 必須チェック（teamBoards は userId不要）
  const hasEnoughIds =
    boardType === "teamBoards" ? !!projectId : !!(resolvedUserId && projectId);

  if (!selectedProject || !hasEnoughIds) {
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
        projectId={projectId}
        selectedProject={selectedProject}
        setIsProjectEditMode={setIsProjectEditMode}
      />
    </Box>
  );
};

export default BoardDetailPageContent;
