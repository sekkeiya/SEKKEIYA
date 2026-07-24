import React, { useState } from 'react';
import {
  Box, Typography, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery,
} from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import SentimentSatisfiedRoundedIcon from '@mui/icons-material/SentimentSatisfiedRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { useAppStore } from '../../store/useAppStore';
import { useDsdStore, type DsdTemplate } from './store/useDsdStore';

import { BRAND } from '../../styles/theme';
import { DsdLibraryGrid, type DsdExportItem } from './library/DsdLibraryGrid';
import { DsdSidebar } from '../../shared/layout/dsd-sidebar/DsdSidebar';
import { DsdRightPanel } from './components/DsdRightPanel';

// ─── Template definitions ─────────────────────────────────────────────────────

interface TemplateDef {
  id: DsdTemplate | null;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
  isMvp?: boolean;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: 'sun',
    icon: <WbSunnyRoundedIcon sx={{ fontSize: 22 }} />,
    label: 'なぜこの環境か？',
    desc: '日照・日影・光の差し込み方をアニメーションで可視化',
    color: 'light-dark(#5a822b, #aed581)',
    isMvp: true,
  },
  {
    id: 'site',
    icon: <PlaceRoundedIcon sx={{ fontSize: 22 }} />,
    label: 'なぜこの場所に？',
    desc: '敷地・周辺環境・アクセスの文脈を図化',
    color: 'light-dark(#198694, #4dd0e1)',
  },
  {
    id: 'layout',
    icon: <RouteRoundedIcon sx={{ fontSize: 22 }} />,
    label: 'なぜこの配置に？',
    desc: '動線・ゾーニング・空間の構成を可視化',
    color: 'light-dark(#ad6700, #ffb74d)',
  },
  {
    id: null,
    icon: <AccessTimeRoundedIcon sx={{ fontSize: 22 }} />,
    label: '時間の流れは？',
    desc: '朝・昼・夜・季節による空間の変化を示す',
    color: 'light-dark(#732e7f, #ba68c8)',
  },
  {
    id: null,
    icon: <SentimentSatisfiedRoundedIcon sx={{ fontSize: 22 }} />,
    label: '人はどう動く？',
    desc: '動線・ペルソナ・生活シナリオを図式化',
    color: 'light-dark(#9e0f40, #f06292)',
  },
  {
    id: null,
    icon: <VisibilityRoundedIcon sx={{ fontSize: 22 }} />,
    label: '何が見えるか？',
    desc: '視線・プライバシー・眺望の関係を描く',
    color: 'light-dark(#0875a6, #4fc3f7)',
  },
  {
    id: 'env',
    icon: <AirRoundedIcon sx={{ fontSize: 22 }} />,
    label: '環境はどうか？',
    desc: '風・音・温熱環境のフローを視覚化',
    color: 'light-dark(#327b74, #80cbc4)',
  },
];

// ─── New Diagram Dialog ───────────────────────────────────────────────────────

const NewDiagramDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (template: DsdTemplate) => void;
}> = ({ open, onClose, onSubmit }) => {
  const [selectedId, setSelectedId] = useState<DsdTemplate>('sun');
  const selectedTpl = TEMPLATES.find(t => t.id === selectedId) ?? TEMPLATES[0];

  React.useEffect(() => {
    if (open) setSelectedId('sun');
  }, [open]);

  const handleSubmit = () => {
    if (!selectedId) return;
    onSubmit(selectedId);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface2)', backgroundImage: 'none',
          borderRadius: 2.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
        },
      }}
    >
      <DialogTitle sx={{ color: 'var(--brand-fg)', fontWeight: 700, pb: 0.5 }}>
        新しいダイアグラムを作成
      </DialogTitle>

      <DialogContent sx={{ pt: '12px !important' }}>
        {/* Template grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2 }}>
          {TEMPLATES.map(t => {
            const isAvailable = t.id !== null;
            const isActive = t.id === selectedId;
            const accent = t.color;
            return (
              <Box
                key={t.label}
                onClick={isAvailable ? () => setSelectedId(t.id as DsdTemplate) : undefined}
                sx={{
                  borderRadius: 2,
                  border: `1.5px solid ${isActive ? accent : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
                  bgcolor: isActive ? `${accent}18` : 'rgb(var(--brand-fg-rgb) / 0.03)',
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.5, py: 1.25,
                  cursor: isAvailable ? 'pointer' : 'default',
                  opacity: isAvailable ? 1 : 0.4,
                  transition: 'all 0.15s',
                  position: 'relative', overflow: 'hidden',
                  '&:hover': isAvailable ? {
                    bgcolor: isActive ? `${accent}22` : 'rgb(var(--brand-fg-rgb) / 0.07)',
                    borderColor: isActive ? accent : 'rgb(var(--brand-fg-rgb) / 0.2)',
                  } : {},
                }}
              >
                {/* Icon */}
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: isActive ? `${accent}30` : 'rgb(var(--brand-fg-rgb) / 0.06)',
                  color: isActive ? accent : (isAvailable ? t.color : 'rgb(var(--brand-fg-rgb) / 0.3)'),
                }}>
                  {t.icon}
                </Box>
                {/* Text */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    color: isActive ? accent : 'rgb(var(--brand-fg-rgb) / 0.85)',
                    fontSize: 12, fontWeight: 700, lineHeight: 1.35,
                  }}>
                    {t.label}
                  </Typography>
                  {!isAvailable && (
                    <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 10, fontWeight: 600, mt: 0.25 }}>
                      近日公開
                    </Typography>
                  )}
                  {t.isMvp && (
                    <Typography sx={{ color: `${accent}cc`, fontSize: 10, fontWeight: 600, mt: 0.25 }}>
                      MVP
                    </Typography>
                  )}
                </Box>
                {/* Active check */}
                {isActive && (
                  <Box sx={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    bgcolor: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#000', fontWeight: 900,
                  }}>✓</Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Selected template description */}
        <Box sx={{
          p: 1.5, borderRadius: 1.5,
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
          display: 'flex', alignItems: 'flex-start', gap: 1,
        }}>
          <Box sx={{ color: selectedTpl.color, mt: 0.25, flexShrink: 0 }}>
            {selectedTpl.icon}
          </Box>
          <Box>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 12, fontWeight: 600, mb: 0.25 }}>
              {selectedTpl.label}
            </Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 12, lineHeight: 1.6 }}>
              {selectedTpl.desc}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>
          キャンセル
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedId}
          sx={{
            bgcolor: '#aed581', color: 'rgba(0,0,0,0.85)',
            fontWeight: 700, textTransform: 'none',
            '&:hover': { bgcolor: '#c5e1a5' },
            px: 3,
          }}
        >
          作成
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

interface DsdDashboardProps {
  items?: DsdExportItem[];
  diagramItems?: any[];
  isInitializing?: boolean;
  onDeleteItem?: (item: DsdExportItem) => void;
  onDeleteDiagram?: (item: any) => void;
  onOpenDiagram?: (item: any) => void;
  onSelectDiagram?: (item: any) => void;
}

export const DsdDashboard: React.FC<DsdDashboardProps> = ({
  items = [],
  diagramItems = [],
  isInitializing = false,
  onDeleteItem,
  onDeleteDiagram,
  onOpenDiagram,
  onSelectDiagram,
}) => {
  const setDsdShellMode = useAppStore(s => s.setDsdShellMode);
  const setActiveDiagramId = useAppStore(s => s.setActiveDiagramId);
  const setCurrentTemplate = useDsdStore(s => s.setCurrentTemplate);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── 全幅ヘッダー化レイアウト用（デスクトップのみ） ──────────────────────────────
  // デスクトップでは MainLayout の左サイドバー / RightPanelHost の右パネルを抑止し、
  // 代わりにここ（ヘッダー下の 3 ゾーン行）へ埋め込む。これによりヘッダーが全幅になる。
  const isMobile = useMediaQuery('(max-width:768px)');
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);

  const handleCreate = (template: DsdTemplate) => {
    setActiveDiagramId(null); // Clear any previously loaded diagram
    setCurrentTemplate(template);
    setDsdShellMode('editor');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* ── Header toolbar ─────────────────────────────────────────────────── */}
      <Box sx={{
        px: 3, height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: `1px solid ${BRAND.line}`,
      }}>
        {/* Title area */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.72rem' }}>
            ダイアグラム
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND.line2 }}>/</Typography>
          <Typography variant="caption" sx={{ color: BRAND.text, fontWeight: 600, fontSize: '0.72rem' }}>
            S.Diagram
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Count badge */}
        {items.length > 0 && (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.7rem' }}>
            {items.length} 件
          </Typography>
        )}

        {/* New diagram button */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddCircleOutlineRoundedIcon />}
          disabled={isInitializing}
          onClick={() => setDialogOpen(true)}
          sx={{
            bgcolor: '#aed581', color: 'rgba(0,0,0,0.8)',
            textTransform: 'none', fontWeight: 600,
            '&:hover': { bgcolor: '#c5e1a5' },
          }}
        >
          新規ダイアグラムを作成
        </Button>
      </Box>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <Box sx={{ px: 3, py: 2, flexShrink: 0, borderBottom: `1px solid ${BRAND.line}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%',
            bgcolor: 'rgba(174,213,129,0.15)',
            border: '1px solid rgba(174,213,129,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <WbSunnyRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#5a822b, #aed581)' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: BRAND.text, lineHeight: 1.2 }}>
              S.Diagram ワークスペース
            </Typography>
            <Typography variant="caption" sx={{ color: BRAND.sub2 }}>
              設計の根拠を、一目で伝わるダイアグラムに
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── 全幅ヘッダー下の 3 ゾーン行: 左プロジェクトサイドバー | ライブラリグリッド | 右プロパティ ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左サイドバー（デスクトップのみ埋め込み。DsdSidebar は width:100% のためラッパーで開閉幅を制御） */}
        {!isMobile && (
          <Box sx={{ width: isProjectSidebarOpen ? 240 : 0, flexShrink: 0, height: '100%', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <DsdSidebar />
          </Box>
        )}

        {/* ── Library grid ───────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, p: 3, overflowY: 'auto' }}>
          <DsdLibraryGrid
            items={items}
            diagramItems={diagramItems}
            isInitializing={isInitializing}
            onDelete={onDeleteItem}
            onDeleteDiagram={onDeleteDiagram}
            onOpenDiagram={onOpenDiagram}
            onSelectDiagram={onSelectDiagram}
            onNew={() => setDialogOpen(true)}
          />
        </Box>

        {/* 右パネル（デスクトップのみ埋め込み。旧 RightPanelHost と同じ 320px ゾーン） */}
        {!isMobile && (
          <Box
            sx={{
              width: 320, flexShrink: 0, height: '100%',
              borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              bgcolor: 'light-dark(rgba(255, 255, 255, 0.85), rgba(10, 15, 25, 0.6))',
              display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
            }}
          >
            {/* パネルヘッダー（旧 RightPanelHost のタイトル行相当） */}
            <Box sx={{ px: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                S.Diagram プロパティ
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
              <DsdRightPanel />
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Dialog ─────────────────────────────────────────────────────────── */}
      <NewDiagramDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </Box>
  );
};
