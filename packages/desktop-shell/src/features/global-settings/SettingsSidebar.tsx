import React from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon, ButtonBase, Tooltip, Divider, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
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
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { BRAND } from '../../styles/theme';
import { CATEGORIES, REGISTRY } from './panels/learningRegistry';

export type SettingsAppId = 'general' | 'ai' | '3dss' | 'sekkeiya' | '3dsl' | '3dsp' | '3dsb' | 'autosave' | 'connectors' | 'voice' | 'admin' | 'admin-git' | 'admin-dev' | 'learning' | 'model-studio';

/** 各項目の Lv2 サブ項目。単一パネルの項目は overview 1件（暫定）。 */
export interface SettingsSubItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** カテゴリ見出し（クリック不可・ネストの区切り） */
  header?: boolean;
  /** 資産名などを等幅で表示 */
  mono?: boolean;
}
export interface SettingsItem {
  id: SettingsAppId;
  label: string;
  icon: React.ReactNode;
  /** 管理者のみ表示（Lv1レールで区切り線の下に配置）。 */
  admin?: boolean;
  subItems: SettingsSubItem[];
}

const OVERVIEW: SettingsSubItem[] = [{ id: 'overview', label: '概要', icon: <InfoOutlinedIcon fontSize="small" /> }];

/** モデル製造ライン: 概要（台帳）＋ 初心者向けの仕組み解説。 */
const MODEL_STUDIO_SUBS: SettingsSubItem[] = [
  { id: 'overview', label: '概要', icon: <InfoOutlinedIcon fontSize="small" /> },
  { id: 'guide', label: 'モデルの仕組み', icon: <MenuBookRoundedIcon fontSize="small" /> },
];

/** AI学習モニター: 「モデル台帳」＋ カテゴリ→資産のネスト。資産IDは REGISTRY の name と一致。 */
const LEARNING_SUBS: SettingsSubItem[] = [
  { id: 'ledger', label: 'モデル台帳', icon: <FactCheckRoundedIcon fontSize="small" /> },
  ...CATEGORIES.flatMap((c): SettingsSubItem[] => [
    { id: `__cat_${c.key}`, label: c.label, header: true },
    ...REGISTRY.filter(a => a.cat === c.key).map((a): SettingsSubItem => ({ id: a.name, label: a.name, mono: true })),
  ]),
];

/**
 * 設定ナビ定義（Lv1 項目 → Lv2 サブ項目）。AI Studio と同じ2段ナビ:
 *   Lv1 = 項目のアイコンレール（畳んだ状態）
 *   Lv2 = 選択項目専用のサブ項目一覧
 * ※ overview 1件の項目は本文パネル全体をそのまま表示（今後サブ分割していく土台）。
 */
export const SETTINGS_NAV: SettingsItem[] = [
  { id: 'general',    label: '一般',      icon: <TuneRoundedIcon />,            subItems: OVERVIEW },
  { id: 'ai',         label: 'AI',        icon: <SmartToyRoundedIcon />,        subItems: [
    { id: 'models', label: '用途別モデル', icon: <TuneRoundedIcon fontSize="small" /> },
    { id: 'image',  label: '画像生成',     icon: <ImageRoundedIcon fontSize="small" /> },
  ] },
  { id: 'sekkeiya',   label: 'SEKKEIYA',  icon: <DashboardRoundedIcon />,       subItems: OVERVIEW },
  { id: 'connectors', label: 'コネクタ',   icon: <LinkRoundedIcon />,            subItems: OVERVIEW },
  { id: 'autosave',   label: '自動保存',   icon: <SaveRoundedIcon />,            subItems: OVERVIEW },
  { id: 'voice',      label: '音声',       icon: <RecordVoiceOverRoundedIcon />, subItems: OVERVIEW },
  { id: '3dss',       label: 'S.Model',   icon: <ViewInArRoundedIcon />,        subItems: OVERVIEW },
  { id: '3dsl',       label: 'S.Layout',  icon: <GridViewRoundedIcon />,        subItems: OVERVIEW },
  { id: '3dsp',       label: 'S.Slide',   icon: <PresentToAllRoundedIcon />,    subItems: OVERVIEW },
  { id: '3dsb',       label: 'S.Blog',    icon: <ArticleRoundedIcon />,         subItems: OVERVIEW },
  // 管理者
  { id: 'admin',        label: 'AI使用量モニター', icon: <InsightsRoundedIcon />,             admin: true, subItems: OVERVIEW },
  { id: 'admin-git',    label: 'GitHub更新',       icon: <GitHubIcon />,                       admin: true, subItems: OVERVIEW },
  { id: 'admin-dev',    label: '開発状況',         icon: <FactCheckRoundedIcon />,             admin: true, subItems: OVERVIEW },
  { id: 'learning',     label: 'AI学習モニター',   icon: <PsychologyRoundedIcon />,            admin: true, subItems: LEARNING_SUBS },
  { id: 'model-studio', label: 'モデル製造ライン', icon: <PrecisionManufacturingRoundedIcon />, admin: true, subItems: MODEL_STUDIO_SUBS },
];

/** 項目の先頭サブ項目ID（項目切替時の既定サブ）。 */
export const firstSubOf = (appId: SettingsAppId): string => {
  const it = SETTINGS_NAV.find(i => i.id === appId);
  return (it?.subItems.find(s => !s.header)?.id) ?? 'overview';
};

interface Props {
  activeApp: SettingsAppId;
  activeSub: string;
  onSelectApp: (app: SettingsAppId) => void;
  onSelectSub: (sub: string) => void;
  /** 管理者のみ、管理者項目を表示する。 */
  isAdmin?: boolean;
  /** Lv2 サブ項目サイドバーを畳む（アイコンレールだけ残す）。 */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

// 青系アクセント（Global Settings のブランドカラー）。
const ACC_BG        = 'rgba(79, 195, 247, 0.16)';
const ACC_BG_HOVER  = 'rgba(79, 195, 247, 0.24)';
const ACC_BORDER    = 'rgba(79, 195, 247, 0.45)';
const ACC_TEXT      = 'light-dark(#0d6ba8, #7fd3fb)';

export const SettingsSidebar: React.FC<Props> = ({ activeApp, activeSub, onSelectApp, onSelectSub, isAdmin = false, collapsed = false, onToggleCollapsed }) => {
  const items = SETTINGS_NAV.filter(i => !i.admin || isAdmin);
  const firstAdminIdx = items.findIndex(i => i.admin);

  const subItemSx = () => ({
    borderRadius: 2,
    mb: 0.5,
    py: 1,
    '&.Mui-selected': { bgcolor: ACC_BG, color: ACC_TEXT },
    '&.Mui-selected:hover': { bgcolor: ACC_BG_HOVER },
    '&:hover': { bgcolor: 'action.hover' },
    color: 'text.secondary',
  });

  // 「概要」1件だけの項目はサブ項目を出さない（本文パネルをそのまま表示）。
  const hasRealSubs = (it: SettingsItem) =>
    !(it.subItems.length === 1 && it.subItems[0].id === 'overview');

  // 畳んだ状態のアイコンボタン共通スタイル
  const railBtnSx = (active: boolean) => ({
    width: 40, height: 40, borderRadius: 2,
    bgcolor: active ? ACC_BG : 'transparent',
    border: `1px solid ${active ? ACC_BORDER : 'transparent'}`,
    color: active ? ACC_TEXT : 'rgb(var(--brand-fg-rgb) / 0.55)',
    transition: 'background-color .15s',
    '&:hover': { bgcolor: active ? ACC_BG_HOVER : 'rgb(var(--brand-fg-rgb) / 0.06)', color: active ? ACC_TEXT : 'var(--brand-fg)' },
  });

  return (
    <Box
      sx={{
        width: collapsed ? 60 : 240,
        flexShrink: 0,
        bgcolor: BRAND.bg,
        borderRight: `1px solid ${BRAND.line}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width .18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ヘッダ: 見出し＋開閉トグル（AI Studio と同じ挙動） */}
      {collapsed ? (
        <Box sx={{ pt: 1.5, pb: 0.5, display: 'flex', justifyContent: 'center' }}>
          {onToggleCollapsed && (
            <Tooltip title="サイドバーを開く" placement="right">
              <IconButton size="small" onClick={onToggleCollapsed}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                <ChevronRightRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ) : (
        <Box sx={{ px: 2.5, pt: 3, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: 'text.disabled', fontWeight: 700 }}>
            Global Settings
          </Typography>
          {onToggleCollapsed && (
            <Tooltip title="サイドバーを畳む" placement="right">
              <IconButton size="small" onClick={onToggleCollapsed}
                sx={{ mr: -0.75, color: 'text.disabled', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}>
                <ChevronLeftRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {collapsed ? (
        /* 畳んだ状態: アイコンのみのレール */
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, pb: 1.5 }}>
          {items.map((item, idx) => {
            const active = item.id === activeApp;
            return (
              <React.Fragment key={item.id}>
                {isAdmin && idx === firstAdminIdx && (
                  <Divider flexItem sx={{ my: 0.75, mx: 1.5, borderColor: BRAND.line }} />
                )}
                <Tooltip title={item.label} placement="right">
                  <ButtonBase onClick={() => onSelectApp(item.id)} sx={railBtnSx(active)}>
                    {item.icon}
                  </ButtonBase>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </Box>
      ) : (
        /* 開いた状態: アイコン＋ラベル。アクティブ項目のサブ項目はその下にネスト表示 */
        <Box sx={{ px: 1.5, pb: 2 }}>
          {items.map((item, idx) => {
            const active = item.id === activeApp;
            return (
              <React.Fragment key={item.id}>
                {isAdmin && idx === firstAdminIdx && (
                  <Divider sx={{ my: 1, borderColor: BRAND.line }} />
                )}
                <ButtonBase
                  onClick={() => onSelectApp(item.id)}
                  sx={{
                    width: '100%', justifyContent: 'flex-start', gap: 1.25,
                    borderRadius: 2, px: 1.25, py: 1, mb: 0.25, textAlign: 'left',
                    bgcolor: active ? ACC_BG : 'transparent',
                    border: `1px solid ${active ? ACC_BORDER : 'transparent'}`,
                    color: active ? ACC_TEXT : 'rgb(var(--brand-fg-rgb) / 0.7)',
                    transition: 'background-color .15s',
                    '&:hover': { bgcolor: active ? ACC_BG_HOVER : 'rgb(var(--brand-fg-rgb) / 0.06)', color: active ? ACC_TEXT : 'var(--brand-fg)' },
                  }}
                >
                  <Box sx={{ display: 'flex', color: 'inherit' }}>{item.icon}</Box>
                  <Typography sx={{ fontSize: 13, fontWeight: active ? 700 : 500, color: 'inherit' }}>
                    {item.label}
                  </Typography>
                </ButtonBase>

                {active && hasRealSubs(item) && (
                  <List dense disablePadding sx={{ mb: 0.5, ml: 1.75, pl: 1, borderLeft: `1px solid ${BRAND.line}` }}>
                    {item.subItems.map(sub => (
                      sub.header ? (
                        <Typography key={sub.id} variant="caption"
                          sx={{ display: 'block', px: 1, mt: 1, mb: 0.25, fontWeight: 700, color: ACC_TEXT, letterSpacing: '0.04em' }}>
                          {sub.label}
                        </Typography>
                      ) : (
                        <ListItemButton key={sub.id} selected={activeSub === sub.id}
                          onClick={() => onSelectSub(sub.id)}
                          sx={{ ...subItemSx(), py: 0.6, pl: sub.mono ? 2 : 1 }}>
                          {sub.icon && <ListItemIcon sx={{ color: 'inherit', minWidth: 30 }}>{sub.icon}</ListItemIcon>}
                          <ListItemText primary={sub.label}
                            primaryTypographyProps={{
                              fontSize: sub.mono ? 12 : 12.5,
                              fontWeight: activeSub === sub.id ? 700 : 500,
                              fontFamily: sub.mono ? 'monospace' : undefined,
                              sx: { wordBreak: 'break-all' },
                            }} />
                        </ListItemButton>
                      )
                    ))}
                  </List>
                )}
              </React.Fragment>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
