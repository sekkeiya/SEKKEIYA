import React, { createContext, useContext } from 'react';
import { useModelMetaState } from "@/shared/hooks/useModelMetaState";

const ModelMetaContext = createContext();

export const ModelMetaProvider = ({ children }) => {
  const { meta, setMeta, setters, resetMeta } = useModelMetaState();

  return (
    <ModelMetaContext.Provider value={{ meta, setMeta, setters, resetMeta }}>
      {children}
    </ModelMetaContext.Provider>
  );
};

export const useModelMetaContext = () => {
  const context = useContext(ModelMetaContext);
  if (!context) {
    throw new Error('useModelMetaContext must be used within a ModelMetaProvider');
  }
  return context;
};
