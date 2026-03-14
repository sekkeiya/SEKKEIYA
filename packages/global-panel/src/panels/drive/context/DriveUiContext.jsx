import React, { createContext, useContext } from 'react';

export const DriveUiContext = createContext({
  // State
  folders: [],
  assets: [],
  currentFolderId: null,
  selectedAsset: null,
  isLoading: false,
  error: null,
  
  // Actions
  navigateToFolder: () => {},
  navigateUp: () => {},
  openPreview: () => {},
  closePreview: () => {},
});

export const useDriveUi = () => {
  const context = useContext(DriveUiContext);
  if (!context) {
    throw new Error('useDriveUi must be used within a DriveUiProvider');
  }
  return context;
};

export const DriveUiProvider = ({ children, adapterState }) => {
  return (
    <DriveUiContext.Provider value={adapterState}>
      {children}
    </DriveUiContext.Provider>
  );
};
