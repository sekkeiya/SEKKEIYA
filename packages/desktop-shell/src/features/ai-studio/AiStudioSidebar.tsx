import React from 'react';
import { Box, Typography, ButtonBase, Tooltip, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { BRAND } from '../../styles/theme';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import type { AiStudioView } from './AiStudioShell';

interface AiStudioSidebarProps {
  currentView: AiStudioView;
  onViewChange: (view: AiStudioView) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface MenuItemDef {
  id: AiStudioView;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

interface MenuSection {
  heading: string;
  items: MenuItemDef[];
}

const SECTIONS: MenuSection[] = [
  {
    heading: '',
    items: [
      { id: 'overview', label: 'ダッシュボード', desc: 'AI群とRAGの状況', icon: <DashboardRoundedIcon fontSize="small" /> },
    ],
  },
  {
    heading: 'AI モデル',
    items: [
      { id: 'aimodels', label: 'AI モデル', desc: '推論エンジン・プロンプト設定', icon: <SmartToyRoundedIcon fontSize="small" /> },
      { id: 'api', label: 'API・利用状況', desc: 'モデル・コスト・使用量の一覧', icon: <BoltRoundedIcon fontSize="small" /> },
    ],
  },
  {
    heading: '自動化',
    items: [
      { id: 'automation', label: '自動化作業リスト', desc: 'チャットで走るワークフロー設定', icon: <AutoAwesomeRoundedIcon fontSize="small" /> },
    ],
  },
  {
    heading: 'メモリー',
    items: [
      { id: 'memory', label: 'メモリー', desc: '長期記憶（ユーザー/プロジェクト）', icon: <PsychologyRoundedIcon fontSize="small" /> },
    ],
  },
  {
    heading: 'ナレッジ & RAG',
    items: [
      { id: 'documents', label: 'ナレッジ (RAG)', desc: '資料・知識ソースの管理', icon: <AutoStoriesRoundedIcon fontSize="small" /> },
      { id: 'training', label: '評価ルール', desc: '判断基準・ペナルティ', icon: <RuleRoundedIcon fontSize="small" /> },
    ],
  },
  {
    heading: '学習 & 評価',
    items: [
      { id: 'save-data', label: 'セーブデータ', desc: '操作からの学習履歴', icon: <SaveRoundedIcon fontSize="small" /> },
      { id: 'score', label: 'スコア (採点)', desc: 'プロジェクト自動評価', icon: <AssignmentTurnedInRoundedIcon fontSize="small" /> },
    ],
  },
];

export const AiStudioSidebar: React.FC<AiStudioSidebarProps> = ({ currentView, onViewChange, collapsed = false, onToggleCollapsed }) => {
  const aiProfiles = useAiProfileStore((s) => s.aiProfiles);
  const activeProfile = aiProfiles.find((p) => p.status === 'Active');
  const allItems = SECTIONS.flatMap((s) => s.items);

  return (
    <Box
      sx={{
        width: collapsed ? 56 : 248,
        height: '100%',
        bgcolor: BRAND.panel,
        borderRight: `1px solid ${BRAND.line}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        transition: 'width .18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <Box sx={{ px: collapsed ? 0 : 2.5, pt: collapsed ? 1.5 : 3, pb: collapsed ? 1 : 2, display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch', gap: collapsed ? 1 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.5, background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SmartToyRoundedIcon sx={{ fontSize: 18, color: 'var(--brand-fg)' }} />
          </Box>
          {!collapsed && (
            <>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-fg)', lineHeight: 1.1 }}>AI Studio</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>AI & RAG コントロール</Typography>
              </Box>
              {onToggleCollapsed && (
                <Tooltip title="サイドバーを畳む" placement="right">
                  <IconButton size="small" onClick={onToggleCollapsed} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                    <ChevronLeftRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
        {collapsed && onToggleCollapsed && (
          <Tooltip title="サイドバーを開く" placement="right">
            <IconButton size="small" onClick={onToggleCollapsed} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Sections */}
      {collapsed ? (
        <Box sx={{ flex: 1, px: 0.75, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          {allItems.map((item) => {
            const active = currentView === item.id;
            return (
              <Tooltip key={item.id} title={item.label} placement="right">
                <ButtonBase
                  onClick={() => onViewChange(item.id)}
                  sx={{
                    width: 40, height: 40, borderRadius: 2,
                    bgcolor: active ? 'rgba(168,85,247,0.16)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(168,85,247,0.45)' : 'transparent'}`,
                    color: active ? 'light-dark(#470ea0, #c4a3f7)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
                    '&:hover': { bgcolor: active ? 'rgba(168,85,247,0.22)' : 'rgb(var(--brand-fg-rgb) / 0.06)', color: active ? 'light-dark(#470ea0, #c4a3f7)' : 'var(--brand-fg)' },
                  }}
                >
                  {item.icon}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ flex: 1, px: 1.5 }}>
          {SECTIONS.map((section, si) => (
            <Box key={si} sx={{ mb: 1.5 }}>
              {section.heading && (
                <Typography sx={{ px: 1.5, mt: 1.5, mb: 0.75, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.32)', textTransform: 'uppercase' }}>
                  {section.heading}
                </Typography>
              )}
              {section.items.map((item) => {
                const active = currentView === item.id;
                return (
                  <ButtonBase
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    sx={{
                      width: '100%', justifyContent: 'flex-start',
                      borderRadius: 2, px: 1.5, py: 1, mb: 0.5, gap: 1.25, textAlign: 'left',
                      bgcolor: active ? 'rgba(168,85,247,0.14)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(168,85,247,0.45)' : 'transparent'}`,
                      transition: 'background-color .15s',
                      '&:hover': { bgcolor: active ? 'rgba(168,85,247,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
                    }}
                  >
                    <Box sx={{ color: active ? 'light-dark(#470ea0, #c4a3f7)' : 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'flex', mt: '1px' }}>{item.icon}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.78)', lineHeight: 1.2 }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', lineHeight: 1.2, mt: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
          ))}
        </Box>
      )}

      {/* Active AI footer */}
      <Box sx={{ p: collapsed ? 1 : 1.5, borderTop: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'center' }}>
        {collapsed ? (
          <Tooltip title={`使用中のAI: ${activeProfile ? activeProfile.name : '未選択'}`} placement="right">
            <ButtonBase onClick={() => onViewChange('aimodels')} sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
              <FiberManualRecordIcon sx={{ fontSize: 12, color: activeProfile ? '#4ade80' : 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
            </ButtonBase>
          </Tooltip>
        ) : (
          <ButtonBase
            onClick={() => onViewChange('aimodels')}
            sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, p: 1.25, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
          >
            <FiberManualRecordIcon sx={{ fontSize: 10, color: activeProfile ? '#4ade80' : 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
            <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>使用中のAI</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProfile ? activeProfile.name : '未選択'}</Typography>
            </Box>
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
};
