import { createContext, useContext } from "react";
import { useSearchParams } from "react-router-dom";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeProjectId = searchParams.get("projectId") || null;

  const setActiveProjectId = (newId) => {
    setSearchParams(prev => {
      if (newId) {
        prev.set("projectId", newId);
      } else {
        prev.delete("projectId");
      }
      return prev;
    }, { replace: true });
  };

  const value = {
    activeProjectId,
    setActiveProjectId,
    // 将来拡張用
    activeApp: null,
    activeItemId: null,
    selectedItemIds: [],
    permissions: {}
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return context;
}
