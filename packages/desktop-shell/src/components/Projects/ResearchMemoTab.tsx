import React from 'react';
import { Box, Typography } from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { useAppStore } from '../../store/useAppStore';
import { ProjectActivityFeed } from './ProjectActivityFeed';
import { ResearchBoardWorkspace } from './ResearchBoardWorkspace';

/**
 * Research & Memo タブ本体（複数ボード対応）。
 * メイン = リサーチボード群（プロジェクト単位）、右サイドバー = 従来のメモフィード。
 */
export const ResearchMemoTab: React.FC = () => {
  const activeProject = useAppStore(s => s.getActiveProject());

  if (!activeProject) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <Box sx={{ textAlign: 'center' }}>
          <TravelExploreRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.12)', mb: 1.5 }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.875rem' }}>
            プロジェクトを選択すると<br />リサーチボードが表示されます
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <ResearchBoardWorkspace
      key={activeProject.id}
      scope={activeProject.id}
      sidebar={<ProjectActivityFeed compact />}
      sidebarWidth={400}
    />
  );
};

export default ResearchMemoTab;
