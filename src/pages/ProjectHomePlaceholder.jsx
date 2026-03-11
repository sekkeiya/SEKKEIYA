import React, { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useParams, useLocation } from "react-router-dom";
import ProjectBoardPage from "@/features/projectBoard/pages/ProjectBoardPage";
import { SelectedBoardProvider, useSelectedBoardContext } from "@/shared/contexts/SelectedBoardContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { normalizeToUnifiedBoard } from "@/shared/api/adapters/boardAdapters";

function NativeBoardInner() {
  const { id } = useParams();
  const location = useLocation();
  const { selectedBoard, setSelectedBoard } = useSelectedBoardContext();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    
    const fetchBoard = async () => {
      if (selectedBoard && selectedBoard.id === id && selectedBoard.name) {
        return;
      }

      const boardFromState = location.state?.board;
      if (boardFromState) {
        if (active) {
          setSelectedBoard({
            ...boardFromState,
            boardId: boardFromState.id,
            boardType: boardFromState.boardType || "personal",
            userId: boardFromState.ownerId
          });
        }
        return;
      }

      // No state, fetch from Firestore
      try {
        let boardData = {
          id: id,
          boardId: id,
          boardType: "myBoards",
        };
        
        const snap = await getDoc(doc(db, "boards", id));
        if (snap.exists()) {
          boardData = normalizeToUnifiedBoard(snap.data(), id, snap.data().boardType === "teamBoards");
        }

        if (active) {
          setSelectedBoard(boardData);
        }
      } catch (err) {
        console.error("Failed to fetch native board data:", err);
        if (active) {
          setSelectedBoard({ id: id, boardId: id, boardType: "myBoards" });
        }
      }
    };

    fetchBoard();
    return () => { active = false; };
  }, [id, location.state, selectedBoard, setSelectedBoard, user?.uid]);

  if (!selectedBoard || selectedBoard.id !== id) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#111' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%", overflowY: "auto", bgcolor: "#111" }}>
      <ProjectBoardPage board={selectedBoard} />
    </Box>
  );
}

export default function ProjectHomePlaceholder() {
  const { id } = useParams();
  
  return (
    <SelectedBoardProvider key={id}>
      <NativeBoardInner />
    </SelectedBoardProvider>
  );
}
