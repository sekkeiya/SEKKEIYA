import React from 'react';
import { Box, Typography } from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { useAppStore } from '../../store/useAppStore';
import { ProjectActivityFeed } from './ProjectActivityFeed';
import { ResearchBoardWorkspace } from './ResearchBoardWorkspace';
import { ResearchDetachedNotice } from './ResearchDetachedNotice';
import { useResearchWindowState } from '../../features/projects/chat/researchWindowPresence';
import { resolveResearchTabView } from '../../features/projects/research/researchScope';

/**
 * Research & Memo タブ本体（複数ボード対応）。
 * メイン = リサーチボード群（プロジェクト単位）、右サイドバー = 従来のメモフィード。
 * 独立ウィンドウが開いている間はワークスペースをマウントせず、窓へ誘導する（デタッチ方式）。
 */
export const ResearchMemoTab: React.FC = () => {
  const activeProject = useAppStore(s => s.getActiveProject());
  const windowState = useResearchWindowState();
  const tabView = resolveResearchTabView(windowState);

  if (tabView === 'detached') return <ResearchDetachedNotice />;

  // 'pending'（開閉確認前）はワークスペースを一瞬たりともマウントしない。
  // 「常に1インスタンスのみ」の不変条件を守るため、確定するまでは何も描画しない。
  if (tabView === 'pending') return null;

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
      showPopOut
    />
  );
};

export default ResearchMemoTab;
