import React from 'react';
import { useGlobalPanelStore } from '../store/useGlobalPanelStore';
import GlobalPanelOverlay from './GlobalPanelOverlay';

import DriveWorkspace from './drive/DriveWorkspace';
import ChatWorkspace from './chat/ChatWorkspace';

export default function GlobalPanelHost() {
  const activePanel = useGlobalPanelStore((state) => state.activePanel);
  
  if (!activePanel) return null;

  return (
    <>
      <GlobalPanelOverlay panelName="drive" width="90vw" maxWidth={1200}>
        <DriveWorkspace />
      </GlobalPanelOverlay>

      <GlobalPanelOverlay panelName="chat" width="800px" maxWidth={1000}>
        <ChatWorkspace />
      </GlobalPanelOverlay>
    </>
  );
}
