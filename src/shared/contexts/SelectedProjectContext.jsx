import { createContext, useContext, useState, useEffect } from "react";

export const SelectedProjectContext = createContext();

export const SelectedProjectProvider = ({ children }) => {
  useEffect(() => {
    console.log("[MOUNT-TEST] SelectedProjectProvider mounted");
  }, []);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isProjectEditMode, setIsProjectEditMode] = useState(false);

  return (
    <SelectedProjectContext.Provider
      value={{
        selectedProject,
        setSelectedProject,
        isProjectEditMode,
        setIsProjectEditMode,
      }}
    >
      {children}
    </SelectedProjectContext.Provider>
  );
};

export const useSelectedProjectContext = () => useContext(SelectedProjectContext);
