import React from 'react';
import { useSearchParams } from "react-router-dom";
import GlobalPanelOverlay from './GlobalPanelOverlay';
import { useAuth } from '@/features/auth/context/AuthContext';
import { db, functions } from '@/shared/config/firebase';

// Future Workspaces
import DriveWorkspace from '@/features/drive/DriveWorkspace';
import { ChatWorkspace } from 'sekkeiya-global-panel';

export default function GlobalPanelHost() {
  const [searchParams] = useSearchParams();
  const activePanel = searchParams.get("panel");
  const { user } = useAuth();
  
  console.log("GlobalPanelHost activePanel:", activePanel);
  console.log("GlobalPanelHost render target:", activePanel === "drive" ? "DriveWorkspace" : activePanel === "chat" ? "ChatWorkspace" : null);
  console.log("GlobalPanelHost returning overlay:", !!activePanel);

  if (!activePanel) return null;

  return (
    <>
      <GlobalPanelOverlay panelName="drive" isOpen={activePanel === "drive"} width="90vw" maxWidth={1200}>
        <DriveWorkspace uid={user?.uid} />
      </GlobalPanelOverlay>

      <GlobalPanelOverlay panelName="chat" isOpen={activePanel === "chat"} width="800px" maxWidth={1000}>
        <ChatWorkspace uid={user?.uid} db={db} functions={functions} />
      </GlobalPanelOverlay>
      
      {/* <GlobalPanelOverlay panelName="notifications" width="350px" maxWidth={400}> ... </GlobalPanelOverlay> */}
    </>
  );
}
