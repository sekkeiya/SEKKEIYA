import React, { useState } from 'react';
import { Box } from '@mui/material';
import { AiStudioSidebar } from './AiStudioSidebar';
import { AiStudioOverview } from './Overview/AiStudioOverview';
import { AiStudioSaveData } from './SaveData/AiStudioSaveData';
import { AiStudioDocuments } from './Documents/AiStudioDocuments';
import { AiStudioTraining } from './Training/AiStudioTraining';
import { AiStudioScore } from './Score/AiStudioScore';
import { AiStudioModels } from './AiModels/AiStudioModels';

export type AiStudioView = 'overview' | 'aimodels' | 'save-data' | 'documents' | 'training' | 'score';

export const AiStudioShell: React.FC = () => {
  const [currentView, setCurrentView] = useState<AiStudioView>('overview');

  const renderContent = () => {
    switch (currentView) {
      case 'overview': return <AiStudioOverview />;
      case 'aimodels': return <AiStudioModels />;
      case 'save-data': return <AiStudioSaveData />;
      case 'documents': return <AiStudioDocuments />;
      case 'training': return <AiStudioTraining />;
      case 'score': return <AiStudioScore />;
      default: return <AiStudioOverview />;
    }
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <AiStudioSidebar currentView={currentView} onViewChange={setCurrentView} />
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        {renderContent()}
      </Box>
    </Box>
  );
};
