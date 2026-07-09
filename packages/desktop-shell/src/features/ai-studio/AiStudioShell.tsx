import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { AiStudioSidebar } from './AiStudioSidebar';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { AiStudioOverview } from './Overview/AiStudioOverview';
import { AiStudioSaveData } from './SaveData/AiStudioSaveData';
import { AiStudioDocuments } from './Documents/AiStudioDocuments';
import { AiStudioTraining } from './Training/AiStudioTraining';
import { AiStudioScore } from './Score/AiStudioScore';
import { AiStudioModels } from './AiModels/AiStudioModels';
import { AiStudioAutomation } from './Automation/AiStudioAutomation';

export type AiStudioView = 'overview' | 'aimodels' | 'automation' | 'save-data' | 'documents' | 'training' | 'score';

export const AiStudioShell: React.FC = () => {
  const [currentView, setCurrentView] = useState<AiStudioView>('overview');
  const [focusProfileId, setFocusProfileId] = useState<string | null>(null);
  // ダッシュボード以外は各ビューが独自の一覧／詳細を持つため、ナビはアイコンレールに自動で畳んで
  // コンテンツに幅を割く。ダッシュボード（overview）だけ展開。
  // （手動トグルは可能。ビューを切り替えると既定に戻る）
  const [navCollapsed, setNavCollapsed] = useState(false);
  useEffect(() => { setNavCollapsed(currentView !== 'overview'); }, [currentView]);
  const loadKnowledgeSources = useAiProfileStore((s) => s.loadKnowledgeSources);
  const uid = useAuthStore((s: any) => s.currentUser?.uid);

  useEffect(() => {
    if (uid) loadKnowledgeSources(uid);
  }, [uid, loadKnowledgeSources]);

  const openModel = (id: string) => {
    setFocusProfileId(id);
    setCurrentView('aimodels');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'overview': return <AiStudioOverview onNavigate={setCurrentView} onOpenModel={openModel} />;
      case 'aimodels': return <AiStudioModels initialProfileId={focusProfileId} />;
      case 'automation': return <AiStudioAutomation />;
      case 'save-data': return <AiStudioSaveData />;
      case 'documents': return <AiStudioDocuments />;
      case 'training': return <AiStudioTraining />;
      case 'score': return <AiStudioScore />;
      default: return <AiStudioOverview onNavigate={setCurrentView} onOpenModel={openModel} />;
    }
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <AiStudioSidebar currentView={currentView} onViewChange={setCurrentView} collapsed={navCollapsed} onToggleCollapsed={() => setNavCollapsed((v) => !v)} />
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        {renderContent()}
      </Box>
    </Box>
  );
};
