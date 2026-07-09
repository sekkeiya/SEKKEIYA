import React, { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";
import ProjectBoardPage from "@/features/projectBoard/pages/ProjectBoardPage";
import { SelectedProjectProvider, useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";
import { CircularProgress } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

function IframePageInner() {
  const { boardId } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "myBoards";
  const userId = searchParams.get("userId") || null;
  
  const { selectedProject, setSelectedProject } = useSelectedProjectContext();

  useEffect(() => {
    let active = true;

    const fetchBoard = async () => {
      // If we already have a rich board object in context, just use it
      if (selectedProject && selectedProject.id === boardId && selectedProject.name) {
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

        const snap = await getDoc(doc(db, "boards", boardId));
        if (snap.exists()) {
          boardData = { id: boardId, ...snap.data() };
        }

        if (active) {
          setSelectedProject(boardData);
        }
      } catch (err) {
        console.error("Failed to fetch immersed board data:", err);
        if (active) {
          setSelectedProject({
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
  }, [boardId, type, userId, selectedProject, setSelectedProject]);

  if (!selectedProject || selectedProject.id !== boardId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#111' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100vh", overflow: "hidden", bgcolor: "#111" }}>
      <ProjectBoardPage board={selectedProject} />
    </Box>
  );
}

export default function ProjectBoardIframePage() {
  return (
    <SelectedProjectProvider>
      <IframePageInner />
    </SelectedProjectProvider>
  );
}
