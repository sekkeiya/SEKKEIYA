// チャットヘッダーに並べる「このチャットの文脈（プロジェクト／アカウントサイト）のページを開く」
// 横並びのアイコン・リモコン。子アプリ・リモコン（WindowTopBar）と対になる、メイン領域ビュー版。
//
// ・プロジェクトのチャット → Home / Schedules & Tasks / CAD Files / Work Files / Research & Memo。
// ・プロジェクト非依存（アカウントサイトのチャット）→ アカウントサイトを開くボタン1つ。
//
// クリックで openMainViewFromHere() を呼ぶ。ポップアウト窓なら本体へ emit、本体/Web ならその場で適用。
import React from 'react';
import { Box, Tooltip } from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ArchitectureRoundedIcon from '@mui/icons-material/ArchitectureRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { useAppStore } from '../../store/useAppStore';
import { openMainViewFromHere, type ProjectViewTab } from './openMainView';

// プロジェクト直下で開けるページ（ProjectHome の topNavItems と一致）。
const PROJECT_VIEWS: { tab: ProjectViewTab; label: string; Icon: typeof HomeRoundedIcon }[] = [
  { tab: 'home', label: 'Home', Icon: HomeRoundedIcon },
  { tab: 'schedule', label: 'Schedules & Tasks', Icon: EventNoteRoundedIcon },
  { tab: 'cadfiles', label: 'CAD Files', Icon: ArchitectureRoundedIcon },
  { tab: 'workfiles', label: 'Work Files', Icon: DescriptionRoundedIcon },
  { tab: 'memo', label: 'Research & Memo', Icon: ScienceRoundedIcon },
];

// ポップアウト窓ではストアが本体のビューを反映しないため、アクティブ表示は本体ウィンドウのみ。
const IS_CHAT_WINDOW = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('chatWindow');

const StripButton: React.FC<{ label: string; active: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, active, onClick, children }) => (
  <Tooltip title={label} placement="bottom">
    <Box
      onClick={onClick}
      sx={{
        width: 26, height: 26, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? 'light-dark(#0a45a4, #8ab4f8)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
        bgcolor: active ? 'rgba(138,180,248,0.16)' : 'transparent',
        border: active ? '1px solid rgba(138,180,248,0.35)' : '1px solid transparent',
        transition: 'color 0.15s, background-color 0.15s, transform 0.15s',
        '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', transform: 'translateY(-1px)' },
      }}
    >
      {children}
    </Box>
  </Tooltip>
);

export const ProjectViewStrip: React.FC = () => {
  const projects = useAppStore(s => s.projects);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const currentMainView = useAppStore(s => s.currentMainView);
  const activeProjectTab = useAppStore(s => s.activeProjectTab);
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const iconSx = { fontSize: '1rem' } as const;

  // プロジェクトのチャットも、アカウントサイト（プロジェクト非依存）のチャットも、同じ5ページを並べる。
  // どちらもクリックで対応するビュー（Home/Schedules/CAD/Work/Research）を開く。
  const isViewActive = (tab: ProjectViewTab) => {
    if (IS_CHAT_WINDOW) return false; // ポップアウト窓はストアが本体ビューを反映しないので抑止。
    if (activeProject) return currentMainView === 'workspace' && activeWorkspaceId === null && activeProjectTab === tab;
    return currentMainView === 'my-site' && activeProjectTab === tab;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
      {PROJECT_VIEWS.map(v => (
        <StripButton
          key={v.tab}
          label={v.label}
          active={isViewActive(v.tab)}
          onClick={() => openMainViewFromHere(
            activeProject
              ? { target: 'project', projectId: activeProject.id, tab: v.tab }
              : { target: 'account', tab: v.tab }
          )}
        >
          <v.Icon sx={iconSx} />
        </StripButton>
      ))}
    </Box>
  );
};
