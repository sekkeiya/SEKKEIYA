import React, { createContext, useContext, useState, useCallback } from "react";

const SelectedCardContext = createContext();

export const SelectedCardProvider = ({ children }) => {
  const [selectedCard, _setSelectedCard] = useState(null);
  const [locked, setLocked] = useState(false); // ★ 追加

  const setSelectedCard = useCallback((next) => {
    // ★ ロック中は null を無視（不要な解除を防ぐ）
    if (locked && next == null) return;
    _setSelectedCard(next);
  }, [locked]);

  const lockSelection = useCallback(() => setLocked(true), []);
  const unlockSelection = useCallback(() => setLocked(false), []);

  return (
    <SelectedCardContext.Provider
      value={{ selectedCard, setSelectedCard, lockSelection, unlockSelection, locked }}
    >
      {children}
    </SelectedCardContext.Provider>
  );
};

export const useSelectedCardContext = () => useContext(SelectedCardContext);
