import { createContext, useContext } from "react";
import { useSearchParams } from "react-router-dom";

const BoardContext = createContext(null);

export function BoardProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeBoardId = searchParams.get("boardId") || null;

  const setActiveBoardId = (newId) => {
    setSearchParams(prev => {
      if (newId) {
        prev.set("boardId", newId);
      } else {
        prev.delete("boardId");
      }
      return prev;
    }, { replace: true });
  };

  const value = {
    activeBoardId,
    setActiveBoardId,
    // 将来拡張用
    activeProjectId: null,
    activeApp: null,
    activeItemId: null,
    selectedItemIds: [],
    permissions: {}
  };

  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error("useBoardContext must be used within a BoardProvider");
  }
  return context;
}
