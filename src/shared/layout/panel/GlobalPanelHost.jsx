import React from 'react';
import { useSearchParams } from "react-router-dom";
import GlobalPanelOverlay from './GlobalPanelOverlay';
import { useAuth } from '@/features/auth/context/AuthContext';
import { db, functions } from '@/shared/config/firebase';
import { useProjectContext } from '@/app/providers/ProjectProvider';

// Future Workspaces
import DriveWorkspace from '@/features/drive/DriveWorkspace';

export default function GlobalPanelHost() {
  const [searchParams] = useSearchParams();
  const activePanel = searchParams.get("panel");
  const { user } = useAuth();
  const { activeProjectId } = useProjectContext();

  if (!activePanel) return null;

  return (
    <>
      <GlobalPanelOverlay panelName="drive" isOpen={activePanel === "drive"} width="90vw" maxWidth={1200}>
        <DriveWorkspace uid={user?.uid} activeProjectId={activeProjectId} />
      </GlobalPanelOverlay>

    </>
  );
}
