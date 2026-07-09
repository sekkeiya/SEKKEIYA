import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MiniSidebar as GlobalMiniSidebar, usePanelUrlSync } from '@sekkeiya/global-panel';

export const MiniSidebar = ({ isExpanded, onToggle = () => {} }) => {
  const navigate = useNavigate();

  // 3DSP-specific mock boards or fetch from a hook when implemented
  const boards = []; // Ensure boards feature uses SEKKEIYA Global Data

  // Sync URL to panel state
  usePanelUrlSync();

  return (
    <GlobalMiniSidebar
      currentApp="presents"
      currentBoardId={null} // 3DSP routing has no board ID yet
      boards={boards}
      user={null}
      onNavigate={(path) => navigate(path)}
      onNavigateExternal={(url) => window.location.assign(url)}
      onOpenChat={() => console.log('Open Chat')}
      onOpenDrive={() => console.log('Open Drive')}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onLogout={() => window.location.assign('/login?return_to=/app/presents/')}
    />
  );
};
