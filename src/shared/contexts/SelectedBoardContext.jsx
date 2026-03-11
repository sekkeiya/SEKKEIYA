import { createContext, useContext, useState } from "react";

export const SelectedBoardContext = createContext();

export const SelectedBoardProvider = ({ children }) => {
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [isBoardEditMode, setIsBoardEditMode] = useState(false);

  return (
    <SelectedBoardContext.Provider
      value={{
        selectedBoard,
        setSelectedBoard,
        isBoardEditMode,
        setIsBoardEditMode,
      }}
    >
      {children}
    </SelectedBoardContext.Provider>
  );
};

export const useSelectedBoardContext = () => useContext(SelectedBoardContext);
