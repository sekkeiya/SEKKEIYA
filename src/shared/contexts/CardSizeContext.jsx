import { createContext, useContext, useState } from 'react';

const CardSizeContext = createContext();

export const CardSizeProvider = ({ children }) => {
  // viewMode: "grid" | "list"
  const [viewMode, setViewMode] = useState("grid");
  // gridCols: 3 | 4 | 5
  const [gridCols, setGridCols] = useState(4);
  
  // Legacy / fallback for components that still rely on cardSize directly
  const [cardSize, setCardSize] = useState(210);

  return (
    <CardSizeContext.Provider value={{ 
      cardSize, setCardSize,
      viewMode, setViewMode,
      gridCols, setGridCols
    }}>
      {children}
    </CardSizeContext.Provider>
  );
};

export const useCardSizeContext = () => useContext(CardSizeContext);

export { CardSizeContext };