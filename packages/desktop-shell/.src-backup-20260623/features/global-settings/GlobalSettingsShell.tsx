import React, { useState } from 'react';
import { Box } from '@mui/material';
import { SettingsSidebar, type SettingsAppId } from './SettingsSidebar';
import { DssSettingsPanel } from './panels/DssSettingsPanel';
import { SekkeiyaSettingsPanel } from './panels/SekkeiyaSettingsPanel';
import { AutosaveSettingsPanel } from './panels/AutosaveSettingsPanel';

export const GlobalSettingsShell = () => {
  const [activeApp, setActiveApp] = useState<SettingsAppId>('sekkeiya');

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', bgcolor: '#141414', color: '#fff', overflow: 'hidden' }}>
      <SettingsSidebar activeApp={activeApp} onSelectApp={setActiveApp} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeApp === '3dss' && <DssSettingsPanel />}
        {activeApp === 'sekkeiya' && <SekkeiyaSettingsPanel />}
        {activeApp === 'autosave' && <AutosaveSettingsPanel />}
        {activeApp !== '3dss' && activeApp !== 'sekkeiya' && activeApp !== 'autosave' && (
          <Box sx={{ p: 4, opacity: 0.5 }}>
            このアプリの設定パラメータは現在利用できません。
          </Box>
        )}
      </Box>
    </Box>
  );
};
