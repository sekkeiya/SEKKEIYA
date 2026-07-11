import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon, ButtonBase, Tooltip } from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import GitHubIcon from '@mui/icons-material/GitHub';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SaveRoundedIcon     from '@mui/icons-material/SaveRounded';
import LinkRoundedIcon     from '@mui/icons-material/LinkRounded';
import ArticleRoundedIcon  from '@mui/icons-material/ArticleRounded';
import TuneRoundedIcon     from '@mui/icons-material/TuneRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import { BRAND } from '../../styles/theme';

export type SettingsAppId = 'general' | 'ai' | '3dss' | 'sekkeiya' | '3dsl' | '3dsp' | '3dsb' | 'autosave' | 'connectors' | 'voice' | 'admin' | 'admin-git' | 'admin-dev' | 'learning';

/** カテゴリID（Lv1アイコンレールの単位）。 */
type SettingsCategoryId = 'basic' | 'apps' | 'admin';

interface PageDef { id: SettingsAppId; label: string; icon: React.ReactNode; }
interface CategoryDef { id: SettingsCategoryId; label: string; icon: React.ReactNode; adminOnly?: boolean; pages: PageDef[]; }

/**
 * 2段ナビ構成（AI Studio 準拠）:
 *   Lv1 = カテゴリのアイコンレール（畳んだ状態）
 *   Lv2 = 選択中カテゴリ専用のページ一覧サイドバー
 * 各カテゴリの pages がそのまま Lv2 に並ぶ。
 */
const CATEGORIES: CategoryDef[] = [
  {
    id: 'basic', label: '基本', icon: <TuneRoundedIcon />,
    pages: [
      { id: 'general',    label: '一般',       icon: <TuneRoundedIcon /> },
      { id: 'ai',         label: 'AI',         icon: <SmartToyRoundedIcon /> },
      { id: 'sekkeiya',   label: 'SEKKEIYA',   icon: <DashboardRoundedIcon /> },
      { id: 'connectors', label: 'コネクタ',    icon: <LinkRoundedIcon /> },
      { id: 'autosave',   label: '自動保存',    icon: <SaveRoundedIcon /> },
      { id: 'voice',      label: '音声',        icon: <RecordVoiceOverRoundedIcon /> },
    ],
  },
  {
    id: 'apps', label: 'アプリ', icon: <AppsRoundedIcon />,
    pages: [
      { id: '3dss', label: 'S.Model',  icon: <ViewInArRoundedIcon /> },
      { id: '3dsl', label: 'S.Layout', icon: <GridViewRoundedIcon /> },
      { id: '3dsp', label: 'S.Slide',  icon: <PresentToAllRoundedIcon /> },
      { id: '3dsb', label: 'S.Blog',   icon: <ArticleRoundedIcon /> },
    ],
  },
  {
    id: 'admin', label: '管理者', icon: <AdminPanelSettingsRoundedIcon />, adminOnly: true,
    pages: [
      { id: 'admin',     label: 'AI使用量モニター', icon: <InsightsRoundedIcon /> },
      { id: 'admin-git', label: 'GitHub更新',       icon: <GitHubIcon /> },
      { id: 'admin-dev', label: '開発状況',         icon: <FactCheckRoundedIcon /> },
      { id: 'learning',  label: 'AI学習モニター',   icon: <PsychologyRoundedIcon /> },
    ],
  },
];

interface Props {
  activeApp: SettingsAppId;
  onSelectApp: (app: SettingsAppId) => void;
  /** 管理者のみ、「管理者」カテゴリを表示する。 */
  isAdmin?: boolean;
}

// 青系アクセント（Global Settings のブランドカラー）。
const ACC_BG        = 'rgba(79, 195, 247, 0.16)';
const ACC_BG_HOVER  = 'rgba(79, 195, 247, 0.24)';
const ACC_BORDER    = 'rgba(79, 195, 247, 0.45)';
const ACC_TEXT      = 'light-dark(#0d6ba8, #7fd3fb)';

export const SettingsSidebar: React.FC<Props> = ({ activeApp, onSelectApp, isAdmin = false }) => {
  const categories = CATEGORIES.filter(c => !c.adminOnly || isAdmin);
  // activeApp が属するカテゴリを導出（唯一の真実は activeApp、カテゴリはそこから求める）。
  const activeCategory = categories.find(c => c.pages.some(p => p.id === activeApp)) ?? categories[0];

  const selectCategory = (cat: CategoryDef) => {
    // 別カテゴリへ切替時のみ先頭ページへ。同カテゴリの再クリックは現在ページを維持。
    if (cat.id !== activeCategory.id) onSelectApp(cat.pages[0].id);
  };

  const itemSx = () => ({
    borderRadius: 2,
    mb: 0.5,
    py: 1,
    '&.Mui-selected': { bgcolor: ACC_BG, color: ACC_TEXT },
    '&.Mui-selected:hover': { bgcolor: ACC_BG_HOVER },
    '&:hover': { bgcolor: 'action.hover' },
    color: 'text.secondary',
  });

  return (
    <>
      {/* Lv1: カテゴリのアイコンレール（畳んだ状態） */}
      <Box
        sx={{
          width: 72,
          flexShrink: 0,
          bgcolor: BRAND.bg,
          borderRight: `1px solid ${BRAND.line}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 2,
          gap: 0.5,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {categories.map(cat => {
          const active = cat.id === activeCategory.id;
          return (
            <Tooltip key={cat.id} title={cat.label} placement="right">
              <ButtonBase
                onClick={() => selectCategory(cat)}
                sx={{
                  width: 56,
                  py: 1,
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: active ? ACC_BG : 'transparent',
                  border: `1px solid ${active ? ACC_BORDER : 'transparent'}`,
                  color: active ? ACC_TEXT : 'rgb(var(--brand-fg-rgb) / 0.55)',
                  transition: 'background-color .15s',
                  '&:hover': {
                    bgcolor: active ? ACC_BG_HOVER : 'rgb(var(--brand-fg-rgb) / 0.06)',
                    color: active ? ACC_TEXT : 'var(--brand-fg)',
                  },
                }}
              >
                {cat.icon}
                <Typography sx={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{cat.label}</Typography>
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>

      {/* Lv2: 選択中カテゴリ専用のページ一覧サイドバー */}
      <Box
        sx={theme => ({
          width: 224,
          flexShrink: 0,
          bgcolor: theme.palette.mode === 'dark' ? 'var(--brand-surface2)' : '#e9ebef',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        })}
      >
        <Box sx={{ px: 2.5, pt: 3, pb: 1.5 }}>
          <Typography sx={{ fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: 'text.disabled', fontWeight: 700 }}>
            Global Settings
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 17, color: 'text.primary', mt: 0.25 }}>
            {activeCategory.label}
          </Typography>
        </Box>
        <List sx={{ px: 1.5 }}>
          {activeCategory.pages.map(page => (
            <ListItemButton
              key={page.id}
              selected={activeApp === page.id}
              onClick={() => onSelectApp(page.id)}
              sx={itemSx()}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>{page.icon}</ListItemIcon>
              <ListItemText primary={page.label} primaryTypographyProps={{ fontSize: 13, fontWeight: activeApp === page.id ? 600 : 500 }} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </>
  );
};
