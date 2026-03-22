import React from 'react';
import { useGlobalPanelStore } from '../store/useGlobalPanelStore';
import GlobalPanelOverlay from './GlobalPanelOverlay';

import DriveWorkspace from './drive/DriveWorkspace';
import ChatWorkspace from './chat/ChatWorkspace';

export default function GlobalPanelHost({ activePanelState, onClosePanel }) {
  const storeActivePanel = useGlobalPanelStore((state) => state.activePanel);
  const activePanel = activePanelState !== undefined ? activePanelState : storeActivePanel;
  
  if (!activePanel) return null;

  const handleClose = () => {
    if (onClosePanel) onClosePanel();
    else useGlobalPanelStore.getState().setActivePanel(null);
  };

  return (
    <>
      <GlobalPanelOverlay panelName="drive" isOpen={activePanel === "drive"} onClose={handleClose} width="90vw" maxWidth={1200}>
        <DriveWorkspace />
      </GlobalPanelOverlay>

      <GlobalPanelOverlay panelName="chat" isOpen={activePanel === "chat"} onClose={handleClose} width="800px" maxWidth={1000}>
        <ChatWorkspace />
      </GlobalPanelOverlay>
    </>
  );
}
