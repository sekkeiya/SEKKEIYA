import { useState } from 'react';
import { Box } from '@mui/material';
import { SettingsSidebar, firstSubOf, type SettingsAppId } from './SettingsSidebar';
import { DssSettingsPanel }        from './panels/DssSettingsPanel';
import { SekkeiyaSettingsPanel }   from './panels/SekkeiyaSettingsPanel';
import { AutosaveSettingsPanel }   from './panels/AutosaveSettingsPanel';
import { ConnectorsSettingsPanel } from './panels/ConnectorsSettingsPanel';
import { DsbSettingsPanel }        from './panels/DsbSettingsPanel';
import { GeneralSettingsPanel }    from './panels/GeneralSettingsPanel';
import { VoiceSettingsPanel }      from './panels/VoiceSettingsPanel';
import { AiSettingsPanel }         from './panels/AiSettingsPanel';
import { AdminSettingsPanel }      from './panels/AdminSettingsPanel';
import { GitHubSyncPanel }         from './panels/GitHubSyncPanel';
import { DevStatusPanel }          from './panels/DevStatusPanel';
import { LearningSettingsPanel }   from './panels/LearningSettingsPanel';
import { ModelStudioPanel }        from './panels/ModelStudioPanel';
import { useAuthStore }            from '../../store/useAuthStore';
import { isBlogAdmin }             from '../dsb/lib/blogAdmin';

export const GlobalSettingsShell = () => {
  const [activeApp, setActiveApp] = useState<SettingsAppId>('general');
  // Lv2 サブ項目。項目切替時に先頭サブへリセットする。
  const [activeSub, setActiveSub] = useState<string>(firstSubOf('general'));
  // Lv2 サブ項目サイドバーの開閉（AI Studio と同じくアイコンレールへ畳める）。
  const [navCollapsed, setNavCollapsed] = useState(false);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const isAdmin = isBlogAdmin(currentUser);

  const selectApp = (id: SettingsAppId) => {
    setActiveApp(id);
    setActiveSub(firstSubOf(id));
  };

  const KNOWN = ['general', '3dss', 'sekkeiya', 'autosave', 'connectors', '3dsb', 'voice', 'ai'];

  return (
    <Box sx={theme => ({ display: 'flex', width: '100%', height: '100%', bgcolor: theme.palette.mode === 'dark' ? 'var(--brand-surface)' : '#f4f5f7', color: 'text.primary', overflow: 'hidden' })}>
      <SettingsSidebar activeApp={activeApp} activeSub={activeSub} onSelectApp={selectApp} onSelectSub={setActiveSub} isAdmin={isAdmin}
        collapsed={navCollapsed} onToggleCollapsed={() => setNavCollapsed(v => !v)} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeApp === 'general'    && <GeneralSettingsPanel />}
        {activeApp === '3dss'       && <DssSettingsPanel />}
        {activeApp === 'sekkeiya'   && <SekkeiyaSettingsPanel />}
        {activeApp === 'autosave'   && <AutosaveSettingsPanel />}
        {activeApp === 'connectors' && <ConnectorsSettingsPanel />}
        {activeApp === '3dsb'       && <DsbSettingsPanel />}
        {activeApp === 'voice'      && <VoiceSettingsPanel />}
        {activeApp === 'ai'         && <AiSettingsPanel section={activeSub as 'models' | 'image'} />}
        {/* 二重ガード: admin 判定を満たす場合のみ描画（サイドバー非表示だけに依存しない） */}
        {activeApp === 'admin'      && isAdmin && <AdminSettingsPanel />}
        {activeApp === 'admin-git'  && isAdmin && <GitHubSyncPanel />}
        {activeApp === 'admin-dev'  && isAdmin && <DevStatusPanel />}
        {activeApp === 'learning'   && isAdmin && <LearningSettingsPanel section={activeSub} onSectionChange={setActiveSub} />}
        {activeApp === 'model-studio' && isAdmin && <ModelStudioPanel section={activeSub} />}
        {!KNOWN.includes(activeApp) && !((activeApp === 'admin' || activeApp === 'admin-git' || activeApp === 'admin-dev' || activeApp === 'learning' || activeApp === 'model-studio') && isAdmin) && (
          <Box sx={{ p: 4, opacity: 0.5 }}>
            このアプリの設定パラメータは現在利用できません。
          </Box>
        )}
      </Box>
    </Box>
  );
};
