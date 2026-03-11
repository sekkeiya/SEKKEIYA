import React, { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";
import ProjectBoardPage from "@/features/projectBoard/pages/ProjectBoardPage";
import { SelectedBoardProvider, useSelectedBoardContext } from "@/shared/contexts/SelectedBoardContext";
import { CircularProgress } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { normalizeToUnifiedBoard } from "@/shared/api/adapters/boardAdapters";

function IframePageInner() {
  const { boardId } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "myBoards";
  const userId = searchParams.get("userId") || null;
  
  const { selectedBoard, setSelectedBoard } = useSelectedBoardContext();

  useEffect(() => {
    let active = true;

    const fetchBoard = async () => {
      // If we already have a rich board object in context, just use it
      if (selectedBoard && selectedBoard.id === boardId && selectedBoard.name) {
        return;
      }

      try {
        let boardData = {
          id: boardId,
          boardId: boardId,
          boardType: type,
          owner: userId,
          ownerId: userId,
          userId: userId
        };

        // Try to fetch the actual board document to get the name
        const snap = await getDoc(doc(db, "boards", boardId));
        if (snap.exists()) {
          boardData = normalizeToUnifiedBoard(snap.data(), boardId, snap.data().boardType === "teamBoards");
        }

        if (active) {
          setSelectedBoard(boardData);
        }
      } catch (err) {
        console.error("Failed to fetch immersed board data:", err);
        if (active) {
          setSelectedBoard({
            id: boardId,
            boardId: boardId,
            boardType: type,
            owner: userId,
            ownerId: userId,
            userId: userId
          });
        }
      }
    };

    fetchBoard();

    return () => { active = false; };
  }, [boardId, type, userId, selectedBoard, setSelectedBoard]);

  if (!selectedBoard || selectedBoard.id !== boardId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#111' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100vh", overflow: "hidden", bgcolor: "#111" }}>
      <ProjectBoardPage board={selectedBoard} />
    </Box>
  );
}

export default function ProjectBoardIframePage() {
  return (
    <SelectedBoardProvider>
      <IframePageInner />
    </SelectedBoardProvider>
  );
}
