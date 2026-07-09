import React from 'react';
import { Box, Typography, CircularProgress, IconButton, Tooltip } from '@mui/material';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { DslLayoutCard } from '../../../DslLayoutCard';

export interface HierarchySection {
  base: any;
  plans: { plan: any; options: any[] }[];
}

interface LayoutHierarchyViewProps {
  sections: HierarchySection[];
  cardSize?: number;
  selectedItemId?: string | null;
  onSelectNode?: (item: any) => void;
  onOpenNode?: (item: any) => void;
  onOpenBase?: (base: any) => void;
  onDeleteNode?: (item: any) => void;
  onDeleteBase?: (base: any) => void;
  onCreatePlan?: (base: any) => void;
  onCreateOption?: (plan: any) => void;
  isInitializing?: boolean;
  emptyMessage?: string;
}

const CardGrid: React.FC<{ cardSize: number; children: React.ReactNode }> = ({ cardSize, children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, ${cardSize}px)`,
      gap: '12px',
      justifyContent: 'start',
    }}
  >
    {children}
  </Box>
);

/**
 * ダッシュボードの階層（ツリー）表示。
 * Base → Plan → Option をセクション分けし、「どの Base の Plan / どの Plan の Option か」を
 * 一画面で俯瞰できるようにする。単一スクロールコンテナで、各セクション内は DslLayoutCard を再利用。
 */
export const LayoutHierarchyView: React.FC<LayoutHierarchyViewProps> = ({
  sections,
  cardSize = 210,
  selectedItemId,
  onSelectNode,
  onOpenNode,
  onOpenBase,
  onDeleteNode,
  onDeleteBase,
  onCreatePlan,
  onCreateOption,
  isInitializing,
  emptyMessage = 'レイアウトがありません',
}) => {
  if (isInitializing && sections.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, height: '100%' }}>
        <CircularProgress sx={{ color: '#00BFFF' }} />
      </Box>
    );
  }

  if (!isInitializing && sections.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', gap: 2, py: 6 }}>
        <ShapeLineRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--slate-ink-rgb) / 0.25)' }} />
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500, fontSize: 13 }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        px: 2,
        py: 2,
        opacity: isInitializing ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'rgb(var(--slate-ink-rgb) / 0.18)', borderRadius: 2 },
      }}
    >
      {sections.map(({ base, plans }) => (
        <Box key={base.id} sx={{ mb: 3 }}>
          {/* ── Base section header ─────────────────────────── */}
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1, py: 0.75, mb: 1.25,
              borderBottom: '1px solid rgba(52,211,153,0.25)',
              '&:hover .open-hint': { opacity: 1 },
              '&:hover .base-delete': { opacity: 1 },
            }}
          >
            <Box
              onClick={() => onOpenBase?.(base)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <Box sx={{ px: 0.85, py: '1px', borderRadius: 999, background: 'rgba(52,211,153,0.16)' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: 0.5 }}>BASE</Typography>
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 760, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {base.title || base.name || 'Untitled Layout'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.6)', flexShrink: 0 }}>
                {plans.length} プラン
              </Typography>
              <Box className="open-hint" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 0.5, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                <LaunchRoundedIcon sx={{ fontSize: 12, color: 'rgba(52,211,153,0.8)' }} />
                <Typography sx={{ fontSize: 10, color: 'rgba(52,211,153,0.8)' }}>開く</Typography>
              </Box>
            </Box>
            {onCreatePlan && (
              <Box
                onClick={(e) => { e.stopPropagation(); onCreatePlan(base); }}
                sx={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.3,
                  px: 1, py: '3px', borderRadius: 999, cursor: 'pointer',
                  border: '1px solid rgba(56,189,248,0.35)', color: 'light-dark(#0676a8, #38bdf8)',
                  '&:hover': { background: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.6)' },
                }}
              >
                <AddRoundedIcon sx={{ fontSize: 14 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 500, color: 'light-dark(#0676a8, #38bdf8)' }}>プラン</Typography>
              </Box>
            )}
            {onDeleteBase && (
              <Tooltip title="Base を削除" placement="top">
                <IconButton
                  size="small"
                  className="base-delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteBase(base); }}
                  sx={{ flexShrink: 0, opacity: 0, transition: 'opacity 0.15s', color: 'rgb(var(--slate-ink-rgb) / 0.7)', '&:hover': { color: '#ff4d4f' } }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {plans.length === 0 ? (
            <Typography sx={{ pl: 1, fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.45)' }}>
              プランがありません
            </Typography>
          ) : (
            plans.map(({ plan, options }) => (
              <Box key={plan.id} sx={{ mb: 1.5, pl: 1 }}>
                {/* ── Plan sub-header ──────────────────────── */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, '&:hover .opt-add': { opacity: 1 } }}>
                  <Box
                    onClick={() => onOpenNode?.(plan)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', '&:hover .plan-name': { color: 'var(--brand-fg)' } }}
                  >
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#00BFFF', letterSpacing: 0.4 }}>PLAN</Typography>
                    <Typography className="plan-name" sx={{ fontSize: 12.5, fontWeight: 600, color: 'light-dark(rgba(31,41,55,0.85), rgba(229,231,235,0.85))', transition: 'color 0.15s' }}>
                      {plan.name || plan.title || 'Plan'}
                    </Typography>
                    {options.length > 0 && (
                      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--slate-ink-rgb) / 0.55)' }}>
                        · {options.length} オプション
                      </Typography>
                    )}
                  </Box>
                  {onCreateOption && (
                    <Box
                      className="opt-add"
                      onClick={(e) => { e.stopPropagation(); onCreateOption(plan); }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.2, px: 0.75, py: '1px', borderRadius: 999,
                        cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s',
                        border: '1px solid rgba(244,114,182,0.35)', color: 'light-dark(#a10d5a, #f472b6)',
                        '&:hover': { background: 'rgba(244,114,182,0.12)', borderColor: 'rgba(244,114,182,0.6)' },
                      }}
                    >
                      <AddRoundedIcon sx={{ fontSize: 13 }} />
                      <Typography sx={{ fontSize: 10.5, fontWeight: 500, color: 'light-dark(#a10d5a, #f472b6)' }}>オプション</Typography>
                    </Box>
                  )}
                </Box>

                <CardGrid cardSize={cardSize}>
                  <DslLayoutCard
                    item={plan}
                    cardSize={cardSize}
                    isSelected={selectedItemId === plan.id}
                    onSelect={onSelectNode}
                    onDoubleClick={onOpenNode}
                    onDelete={onDeleteNode}
                  />
                  {options.map((opt) => (
                    <DslLayoutCard
                      key={opt.id}
                      item={opt}
                      cardSize={cardSize}
                      isSelected={selectedItemId === opt.id}
                      onSelect={onSelectNode}
                      onDoubleClick={onOpenNode}
                      onDelete={onDeleteNode}
                    />
                  ))}
                </CardGrid>
              </Box>
            ))
          )}
        </Box>
      ))}
    </Box>
  );
};
