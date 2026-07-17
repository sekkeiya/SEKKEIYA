import React, { useState, useMemo } from 'react';
import { Box, Typography, CardActionArea, IconButton, InputBase, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Divider } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAppStore, type DslScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Menu, MenuItem, Collapse, CircularProgress } from '@mui/material';
import { useWorkspaceLayouts } from '../../../features/dsl/layout/hooks/useWorkspaces';
import { useDslFilterStore } from '../../../features/dsl/store/useDslFilterStore';
import { useDslWorkspaceContextStore, dslWorkspaceContextKey } from '../../../features/dsl/layout/store/useDslWorkspaceContextStore';
import { useWorkspaceStructureStore } from '../../../features/dsl/layout/store/useWorkspaceStructureStore';
import { CreateLayoutDialog } from '../../../features/dsl/layout/components/CreateLayoutDialog';

// ダッシュボード(DslFilterPanel の SORT)と並び順を一致させるための共通ユーティリティ。
function dslToMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val?.seconds) return val.seconds * 1000;
  if (val?.toMillis) return (val as any).toMillis();
  return 0;
}
function makeDslSorter(sortBy: 'newest' | 'oldest' | 'name') {
  return (a: any, b: any) => {
    if (sortBy === 'name') return String(a?.name ?? a?.title ?? '').localeCompare(String(b?.name ?? b?.title ?? ''));
    if (sortBy === 'oldest') return dslToMs(a?.createdAt) - dslToMs(b?.createdAt);
    return dslToMs(b?.createdAt) - dslToMs(a?.createdAt);
  };
}

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (e?: React.MouseEvent) => void;
  color?: string;
  onRenameClick?: () => void;
  onDeleteClick?: () => void;
  rightIcon?: React.ReactNode;
  renderActions?: React.ReactNode;
  hasToggle?: boolean;
  expanded?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
}

function ScopeItem({ 
  icon, label, active, onClick, color, onRenameClick, onDeleteClick, rightIcon, renderActions, hasToggle, expanded, onToggle,
  isRenaming = false, renameValue = "", onRenameChange, onRenameSubmit, onRenameCancel
}: ScopeItemProps & { isRenaming?: boolean; renameValue?: string; onRenameChange?: (v: string) => void; onRenameSubmit?: () => void; onRenameCancel?: () => void; }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  return (
    <Box 
      sx={{ 
        position: "relative", mx: 1.5, my: 0.5,
        "&:hover .scope-actions": { opacity: 1 }
      }}
    >
      <Box
        onClick={!isRenaming ? onClick : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          cursor: isRenaming ? "default" : "pointer",
          bgcolor: active ? (color ? `color-mix(in srgb, ${color} 15%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.12)") : "transparent",
          border: active ? `1px solid ${color ? `color-mix(in srgb, ${color} 25%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.2)"}` : "1px solid transparent",
          "&:hover": { bgcolor: active ? (color ? `color-mix(in srgb, ${color} 20%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.18)") : "rgb(var(--brand-fg-rgb) / 0.06)" },
        }}
      >
        {/* Toggle Button */}
        {hasToggle !== undefined && (
          hasToggle && !isRenaming ? (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggle?.(e); }}
              sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", p: 0.25, mr: 0.5, "&:hover": { color: "var(--brand-fg)" } }}
            >
              <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </IconButton>
          ) : (
            <Box sx={{ width: 24, height: 24, mr: 0.5 }} />
          )
        )}

        <Box sx={{ 
          width: 20, height: 20, borderRadius: 1.5, 
          bgcolor: color || "rgb(var(--brand-fg-rgb) / 0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" } })}
        </Box>
        
        {isRenaming ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange && onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit && onRenameSubmit();
                if (e.key === "Escape") onRenameCancel && onRenameCancel();
              }}
              onBlur={() => onRenameSubmit && onRenameSubmit()}
              style={{
                width: "100%",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #00BFFF",
                backgroundColor: "rgba(0,0,0,0.4)",
                color: "var(--brand-fg)",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </Box>
        ) : (
          <Typography sx={{ 
            color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", 
            fontSize: 12, fontWeight: active ? 600 : 500,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
          }}>
            {label}
          </Typography>
        )}
        {!isRenaming && rightIcon}
      </Box>

      {!isRenaming && (onRenameClick || onDeleteClick) && (
        <>
          <IconButton 
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            size="small"
            sx={{ 
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              opacity: 0, transition: "opacity 0.2s",
              ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
              color: "rgb(var(--brand-fg-rgb) / 0.5)", "&:hover": { color: "var(--brand-fg)" }
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
            PaperProps={{ sx: { bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", borderRadius: 2 } }}
          >
            {onRenameClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(); }} sx={{ color: "var(--brand-fg)", fontSize: 13 }}>
                名前を変更
              </MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(); }} sx={{ color: "#ff4d4f", fontSize: 13 }}>
                プロジェクトを削除
              </MenuItem>
            )}
          </Menu>
        </>
      )}

      {!isRenaming && renderActions && (
        <Box
            className="scope-actions"
            sx={{ 
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              opacity: 0, transition: "opacity 0.2s",
              display: "flex", gap: 0.5,
              "&:hover": { opacity: 1 },
            }}
            onClick={(e) => { e.stopPropagation(); }}
        >
          {renderActions}
        </Box>
      )}
    </Box>
  );
}

type HierKind = 'project' | 'base' | 'plan' | 'option';
const HIER_META: Record<HierKind, { color: string; Icon: typeof ShapeLineRoundedIcon }> = {
  project: { color: 'var(--brand-fg)', Icon: ShapeLineRoundedIcon },
  base: { color: '#34d399', Icon: ViewInArRoundedIcon },
  plan: { color: 'light-dark(#0676a8, #38bdf8)', Icon: GridViewRoundedIcon },
  option: { color: 'light-dark(#a10d5a, #f472b6)', Icon: TuneRoundedIcon },
};

// Compact, left-packed row for the unified Project→Base→Plan→Option tree.
// A small colored icon carries the level (cheaper on width than a text tag),
// and indentation is kept tight so even Option labels stay readable.
function HierRow({
  depth, kind, label, active, hasChildren, expanded, onToggle, onClick,
  isRenaming = false, renameValue = '', onRenameChange, onRenameSubmit, onRenameCancel, actions,
}: {
  depth: number;
  kind: HierKind;
  label: string;
  active?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
  onClick?: (e?: React.MouseEvent) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  actions?: React.ReactNode;
}) {
  const meta = HIER_META[kind];
  const Icon = meta.Icon;
  return (
    <Box sx={{ position: 'relative', '&:hover .hier-actions': { opacity: 1 } }}>
      <Box
        onClick={!isRenaming ? onClick : undefined}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: `${10 + depth * 11}px`, pr: 0.5, py: '3px', borderRadius: 1.5,
          cursor: isRenaming ? 'default' : 'pointer',
          bgcolor: active ? `color-mix(in srgb, ${meta.color} 15%, transparent)` : 'transparent',
          '&:hover': { bgcolor: active ? `color-mix(in srgb, ${meta.color} 20%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.05)' },
        }}
      >
        {/* chevron / leaf spacer */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onToggle?.(e); }}
            sx={{ p: 0, width: 14, height: 14, flexShrink: 0, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
          >
            <KeyboardArrowRightRoundedIcon sx={{ fontSize: 14, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 14, height: 14, flexShrink: 0 }} />
        )}

        {/* type icon */}
        <Box sx={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 14, color: active ? meta.color : `color-mix(in srgb, ${meta.color} 80%, transparent)` }} />
        </Box>

        {/* label / rename input */}
        {isRenaming ? (
          <Box sx={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSubmit?.();
                if (e.key === 'Escape') onRenameCancel?.();
              }}
              onBlur={() => onRenameSubmit?.()}
              style={{ width: '100%', padding: '1px 5px', borderRadius: '4px', border: '1px solid #00BFFF', backgroundColor: 'rgba(0,0,0,0.4)', color: 'var(--brand-fg)', fontSize: '12px', outline: 'none' }}
            />
          </Box>
        ) : (
          <Typography
            sx={{
              flex: 1, minWidth: 0,
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.82)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        )}
      </Box>

      {!isRenaming && actions && (
        <Box
          className="hier-actions"
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s',
            bgcolor: 'rgba(15,18,26,0.9)', borderRadius: 1, px: 0.25,
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}

function ProjectLayoutAccordion({
  project, 
  active, 
  expanded,
  onSelect,
  onRenameClick,
  onDeleteClick,
  onLayoutSelect,
  onNavigate,
  isRenaming = false,
  renameValue = "",
  onRenameChange,
  onRenameSubmit,
  onRenameCancel
}: {
  project: any, active: boolean, expanded: boolean, onSelect: () => void,
  onRenameClick: () => void, onDeleteClick: () => void,
  onLayoutSelect: (layoutId: string) => void,
  onNavigate: (target: { baseId: string, planId?: string | null, optionId?: string | null, baseName?: string | null, planName?: string | null, optionName?: string | null }) => void,
  isRenaming?: boolean, renameValue?: string, onRenameChange?: (v: string) => void, onRenameSubmit?: () => void, onRenameCancel?: () => void
}) {
  const { currentUser } = useAuthStore();
  const { panelSelections } = useAppStore();
  const activeDslLayoutId = panelSelections?.layout?.selectedLayoutId || panelSelections?.layout?.optionId || panelSelections?.layout?.planId;
  // 作業中コンテキスト（このプロジェクトの layout ワークスペース）
  const workCtx = useDslWorkspaceContextStore((s) => s.byWorkspace[dslWorkspaceContextKey(project.id, 'layout')]);
  const workingBaseId = workCtx?.baseId ?? null;
  const workingPlanId = workCtx?.planId ?? null;
  const workingOptionId = workCtx?.optionId ?? null;

  const [isProjectExpanded, setIsProjectExpanded] = useState(expanded);
  // Base→Plan→Option をプロジェクト階層と同じように遅延展開する。
  // 追加の Firestore 読み取りは発生しない（useWorkspaceLayouts が Plan/Option も含めて取得済み）。
  const [expandedBaseIds, setExpandedBaseIds] = useState<Record<string, boolean>>({});
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});
  const toggleBaseExpanded = (id: string, e?: any) => { e?.stopPropagation(); setExpandedBaseIds((p) => ({ ...p, [id]: !p[id] })); };
  const togglePlanExpanded = (id: string, e?: any) => { e?.stopPropagation(); setExpandedPlanIds((p) => ({ ...p, [id]: !p[id] })); };

  const toggleProject = (e?: any) => {
    e?.stopPropagation();
    setIsProjectExpanded(prev => !prev);
  }

  // Fetch only if expanded to save Firestore reads
  const { layouts: allLayouts, loading } = useWorkspaceLayouts(isProjectExpanded ? project.id : null, isProjectExpanded ? 'layout' : null);

  // ダッシュボードの SORT パネルと並び順を一致させる。
  const sortBy = useDslFilterStore((s) => s.sortBy);

  // The flat `layouts` collection also contains Plan/Option docs. We surface the
  // full Base→Plan→Option hierarchy here (lazy-expanded) so users can jump straight
  // to a Plan/Option, mirroring the in-editor Project Hierarchy.
  const layouts = useMemo(
    () => (allLayouts || [])
      .filter((l: any) => {
        const t = l?.planType;
        return !t || t === 'base' || t === 'layout';
      })
      .sort(makeDslSorter(sortBy)),
    [allLayouts, sortBy]
  );
  // baseId -> Plan[]
  const plansByBase = useMemo(() => {
    const m = new Map<string, any[]>();
    (allLayouts || []).forEach((l: any) => {
      if (l?.planType === 'plan' && l?.rootBaseId) {
        const arr = m.get(l.rootBaseId);
        if (arr) arr.push(l); else m.set(l.rootBaseId, [l]);
      }
    });
    const sorter = makeDslSorter(sortBy);
    for (const arr of m.values()) arr.sort(sorter);
    return m;
  }, [allLayouts, sortBy]);
  // planId -> Option[]
  const optionsByPlan = useMemo(() => {
    const m = new Map<string, any[]>();
    (allLayouts || []).forEach((l: any) => {
      if (l?.planType === 'option' && l?.parentPlanId) {
        const arr = m.get(l.parentPlanId);
        if (arr) arr.push(l); else m.set(l.parentPlanId, [l]);
      }
    });
    const sorter = makeDslSorter(sortBy);
    for (const arr of m.values()) arr.sort(sorter);
    return m;
  }, [allLayouts, sortBy]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // States for rename/delete dialogs
  const [renamePlanId, setRenamePlanId] = useState<string | null>(null);
  const [renamePlanValue, setRenamePlanValue] = useState("");
  // 削除対象（Base/Plan/Option 共通）。カスケード件数も保持して確認文に出す。
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: 'base' | 'plan' | 'option'; planCount: number; optionCount: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 指定ノードの子孫件数（確認ダイアログ用）。
  const countDescendants = (id: string, kind: 'base' | 'plan' | 'option') => {
    if (kind === 'base') {
      const plans = plansByBase.get(id) || [];
      let optionCount = 0;
      for (const p of plans) optionCount += (optionsByPlan.get(p.id) || []).length;
      return { planCount: plans.length, optionCount };
    }
    if (kind === 'plan') {
      return { planCount: 0, optionCount: (optionsByPlan.get(id) || []).length };
    }
    return { planCount: 0, optionCount: 0 };
  };

  const requestDelete = (id: string, name: string, kind: 'base' | 'plan' | 'option') => {
    const counts = countDescendants(id, kind);
    setDeleteTarget({ id, name: name || (kind === 'base' ? 'Base' : kind === 'plan' ? 'Plan' : 'Option'), kind, ...counts });
  };

  const handleCreateLayout = (e: any) => {
    e?.stopPropagation();
    if (!currentUser || isProcessing) return;
    setShowCreateDialog(true);
  };

  const handleCreateCancel = () => setShowCreateDialog(false);

  // 既存の "Plan N" / "Option N" 連番から次の名前を決める。
  const nextName = (list: any[], prefix: string) => {
    const nums = (list || [])
      .map((o) => String(o?.name || ''))
      .map((s) => { const m = s.match(new RegExp(`^${prefix}\\s*(\\d+)$`, 'i')); return m ? Number(m[1]) : NaN; })
      .filter((n) => Number.isFinite(n));
    return `${prefix} ${(nums.length ? Math.max(...nums) : 0) + 1}`;
  };

  // Base にプランを追加（即時作成し、親を展開して見せる）。
  const handleCreatePlan = async (baseId: string) => {
    if (!currentUser?.uid || isProcessing) return;
    setIsProcessing(true);
    try {
      const { createStructureNode } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await createStructureNode({
        projectId: project.id,
        workspaceId: 'layout',
        userId: currentUser.uid,
        name: nextName(plansByBase.get(baseId) || [], 'Plan'),
        planType: 'plan',
        rootBaseId: baseId,
      });
      setExpandedBaseIds((p) => ({ ...p, [baseId]: true }));
    } catch (e) {
      console.error('create plan failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Plan にオプションを追加（親 Plan を複製して material-study バリエーションにする）。
  const handleCreateOption = async (baseId: string, planId: string) => {
    if (!currentUser?.uid || isProcessing) return;
    setIsProcessing(true);
    try {
      const { cloneStructureNode } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await cloneStructureNode({
        projectId: project.id,
        workspaceId: 'layout',
        sourceId: planId,
        userId: currentUser.uid,
        newName: nextName(optionsByPlan.get(planId) || [], 'Option'),
        overrides: { planType: 'option', rootBaseId: baseId, parentPlanId: planId },
      });
      setExpandedPlanIds((p) => ({ ...p, [planId]: true }));
    } catch (e) {
      console.error('create option failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenamePlanSubmit = async () => {
    if (!renamePlanId || !renamePlanValue.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const { updateLayoutInfo } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await updateLayoutInfo(project.id, 'layout', renamePlanId, { name: renamePlanValue.trim() });
      setRenamePlanId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget || isProcessing) return;
    setIsProcessing(true);
    try {
      // 子孫（Base→Plan/Option、Plan→Option）も含めてまとめて削除する。
      const { deleteStructureCascade } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await deleteStructureCascade(project.id, 'layout', deleteTarget.id, deleteTarget.kind);

      // 削除したノード（または現在の選択）がアクティブなら選択を解除する。
      if (activeDslLayoutId === deleteTarget.id || workingBaseId === deleteTarget.id) {
        useAppStore.getState().setPanelSelection("layout", null);
        try {
          const { useWorkspaceStructureStore } = await import('../../../features/dsl/layout/store/useWorkspaceStructureStore');
          useWorkspaceStructureStore.getState().setSelectedPlanId?.(null);

          const { useUiSelectionStore } = await import('../../../features/dsl/layout/store/uiSelectionStore');
          useUiSelectionStore.getState().setSelectedItemIds([]);
          useUiSelectionStore.getState().setSelectedItemId(null);
        } catch (e) {
          console.warn("Failed to clear legacy store:", e);
        }
      }

      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{ mb: isProjectExpanded ? 0.5 : 0 }}>
      <HierRow
        depth={0}
        kind="project"
        label={project.name}
        active={active}
        hasChildren={true}
        expanded={isProjectExpanded}
        onToggle={toggleProject}
        onClick={() => onSelect()}
        isRenaming={isRenaming}
        renameValue={renameValue}
        onRenameChange={onRenameChange}
        onRenameSubmit={onRenameSubmit}
        onRenameCancel={onRenameCancel}
        actions={
          <>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onRenameClick(); }}
              sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
            >
              <EditRoundedIcon sx={{ fontSize: 13 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
              sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff4d4f' } }}
            >
              <DeleteRoundedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </>
        }
      />
      <Collapse in={isProjectExpanded}>
        <Box sx={{ pr: 1, position: 'relative' }}>
          {loading ? (
             <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5, pl: '21px' }}>
               {[1, 2].map(i => (
                 <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: '3px' }}>
                   <Box sx={{ width: 14, height: 14 }} />
                   <Box sx={{ width: 16, height: 16, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />
                   <Box sx={{ height: 11, width: '55%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 1 }} />
                 </Box>
               ))}
             </Box>
          ) : (
            <>
              {layouts.map((layout: any) => {
                const isWorkingBase = workingBaseId === layout.id;
                const isBaseActive = activeDslLayoutId === layout.id || (isWorkingBase && !workingPlanId && !workingOptionId);
                const basePlans = plansByBase.get(layout.id) || [];
                const baseExpanded = !!expandedBaseIds[layout.id];

                return (
                  <Box key={layout.id} sx={{ mb: 0.25 }}>
                    <HierRow
                      depth={1}
                      kind="base"
                      label={layout.name || 'Untitled Layout'}
                      active={isBaseActive}
                      hasChildren={basePlans.length > 0}
                      expanded={baseExpanded}
                      onToggle={(e) => toggleBaseExpanded(layout.id, e)}
                      onClick={() => onLayoutSelect(layout.id)}
                      isRenaming={renamePlanId === layout.id}
                      renameValue={renamePlanValue}
                      onRenameChange={setRenamePlanValue}
                      onRenameSubmit={handleRenamePlanSubmit}
                      onRenameCancel={() => setRenamePlanId(null)}
                      actions={
                        <>
                          <Tooltip title="プランを追加" placement="top">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleCreatePlan(layout.id); }}
                              sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'light-dark(#0676a8, #38bdf8)' } }}
                            >
                              <AddRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setRenamePlanValue(layout.name || ''); setRenamePlanId(layout.id); }}
                            sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); requestDelete(layout.id, layout.name, 'base'); }}
                            sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff4d4f' } }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </>
                      }
                    />

                    {/* 作業中の Plan / Option（折りたたみ時のみヒント表示） */}
                    {!baseExpanded && isWorkingBase && (workCtx?.planName || workCtx?.optionName) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: '40px', mt: 0.25 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#38bdf8', flexShrink: 0 }} />
                        <Typography
                          sx={{ fontSize: 10, color: 'light-dark(rgba(6,118,168,0.85), rgba(56,189,248,0.85))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          作業中: {workCtx?.planName || 'Plan'}{workCtx?.optionName ? ` ▸ ${workCtx.optionName}` : ''}
                        </Typography>
                      </Box>
                    )}

                    {/* === Plans / Options（遅延展開） === */}
                    {basePlans.length > 0 && (
                      <Collapse in={baseExpanded} timeout="auto" unmountOnExit>
                        {basePlans.map((plan: any) => {
                          const planOptions = optionsByPlan.get(plan.id) || [];
                          const planExpanded = !!expandedPlanIds[plan.id];
                          const isPlanActive = (workingPlanId === plan.id && !workingOptionId) || activeDslLayoutId === plan.id;

                          return (
                            <Box key={plan.id}>
                              <HierRow
                                depth={2}
                                kind="plan"
                                label={plan.name || 'Plan'}
                                active={isPlanActive}
                                hasChildren={planOptions.length > 0}
                                expanded={planExpanded}
                                onToggle={(e) => togglePlanExpanded(plan.id, e)}
                                onClick={() => onNavigate({ baseId: layout.id, planId: plan.id, baseName: layout.name, planName: plan.name })}
                                actions={
                                  <>
                                    <Tooltip title="オプションを追加" placement="top">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); handleCreateOption(layout.id, plan.id); }}
                                        sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'light-dark(#a10d5a, #f472b6)' } }}
                                      >
                                        <AddRoundedIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); requestDelete(plan.id, plan.name, 'plan'); }}
                                      sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff4d4f' } }}
                                    >
                                      <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </>
                                }
                              />
                              {planOptions.length > 0 && (
                                <Collapse in={planExpanded} timeout="auto" unmountOnExit>
                                  {planOptions.map((opt: any) => {
                                    const isOptActive = workingOptionId === opt.id || activeDslLayoutId === opt.id;
                                    return (
                                      <HierRow
                                        key={opt.id}
                                        depth={3}
                                        kind="option"
                                        label={opt.name || 'Option'}
                                        active={isOptActive}
                                        onClick={() => onNavigate({ baseId: layout.id, planId: plan.id, optionId: opt.id, baseName: layout.name, planName: plan.name, optionName: opt.name })}
                                        actions={
                                          <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); requestDelete(opt.id, opt.name, 'option'); }}
                                            sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff4d4f' } }}
                                          >
                                            <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                                          </IconButton>
                                        }
                                      />
                                    );
                                  })}
                                </Collapse>
                              )}
                            </Box>
                          );
                        })}
                      </Collapse>
                    )}
                  </Box>
                );
              })}
              <CardActionArea
                onClick={handleCreateLayout}
                disabled={isProcessing}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, pl: '21px', pr: 1, mt: 0.25, borderRadius: 1.5,
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, opacity: isProcessing ? 0.5 : 1
                }}
              >
                <Box sx={{ width: 14, height: 14, flexShrink: 0 }} />
                <Box sx={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AddRoundedIcon sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
                </Box>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 500 }}>
                  新規レイアウト追加
                </Typography>
              </CardActionArea>
            </>
          )}
        </Box>
      </Collapse>

      {/* 新規レイアウト作成ダイアログ */}
      <CreateLayoutDialog
        open={showCreateDialog}
        projectId={project.id}
        currentUser={currentUser}
        onClose={handleCreateCancel}
        onCreated={(baseId, planId, name, baseSetup) => {
          setShowCreateDialog(false);
          onLayoutSelect(baseId);
          useWorkspaceStructureStore.getState().selectBase(baseId);
          useDslWorkspaceContextStore.getState().setContext(project.id, 'layout', {
            baseId,
            planId,
            optionId: null,
            baseName: name,
            planName: 'Plan 1',
            optionName: null,
            pendingBaseSetup: baseSetup,
          });
        }}
      />

      {/* Delete Dialog */}
      {deleteTarget && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => !isProcessing && setDeleteTarget(null)}>
          <Box onClick={(e) => e.stopPropagation()} sx={{ width: 420, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>
              {deleteTarget.kind === 'base' ? 'Base を削除' : deleteTarget.kind === 'plan' ? 'Plan を削除' : 'Option を削除'}
            </Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: deleteTarget.planCount + deleteTarget.optionCount > 0 ? 1.5 : 3, fontSize: 14 }}>
              「{deleteTarget.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            {(deleteTarget.planCount > 0 || deleteTarget.optionCount > 0) && (
              <Box sx={{ mb: 3, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,77,79,0.08)", border: "1px solid rgba(255,77,79,0.25)" }}>
                <Typography sx={{ color: "light-dark(#ad0003, #ff8a8c)", fontSize: 13 }}>
                  紐づく
                  {deleteTarget.planCount > 0 ? ` ${deleteTarget.planCount} 件の Plan` : ''}
                  {deleteTarget.planCount > 0 && deleteTarget.optionCount > 0 ? ' と' : ''}
                  {deleteTarget.optionCount > 0 ? ` ${deleteTarget.optionCount} 件の Option` : ''}
                  も同時に削除されます。
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => !isProcessing && setDeleteTarget(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>
                {isProcessing ? '削除中…' : '削除'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const DslSidebar: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const { currentUser } = useAuthStore();
  const { 
    projects, 
    setProjects,
    activeProjectId, 
    setActiveProjectId, 
    isProjectSidebarOpen,
    dslScope,
    setDslScope,
    setGlobalDslHub,
    setPanelSelection
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim()) return;
    try {
      setIsProcessing(true);
      await renameProject(activeRenameProject.id, renameValue);
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (e) {
      console.error("Failed to rename project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeleteProject) return;
    try {
      setIsProcessing(true);
      await deleteProject(activeDeleteProject.id);
      setProjects(projects.filter(p => p.id !== activeDeleteProject.id));
      if (activeProjectId === activeDeleteProject.id) setActiveProjectId(null);
      setActiveDeleteProject(null);
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
        isTeam: createProjectType === 'team',
      });
      // Update global store
      setProjects([newProject as any, ...projects]);
      
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      
      // Select the new project immediately
      setActiveProjectId(newProject.id);
      setDslScope('project_layouts');

      // Refresh from server to sync 
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const { myProjects, teamProjects } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !query || p.name?.toLowerCase().includes(query));
    
    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter(p => p.ownerId !== currentUser?.uid || p.isTeam)
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const handleScopeSelect = (scope: DslScope) => {
    setDslScope(scope);
    setGlobalDslHub(); // Switch to Hub view without kicking user to Project Home
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDslScope(isTeam ? 'team_project_layouts' : 'project_layouts');
    setActiveProjectId(projectId);
    // プロジェクトを選んだら、その Layout Dashboard を表示する。
    // アクティブレイアウト選択を解除し、作業中コンテキストもクリアして
    // エディターではなくダッシュボードが開くようにする。
    setPanelSelection('layout', null);
    try {
      useDslWorkspaceContextStore.getState().clearContext(projectId, 'layout');
      // 同一プロジェクトを再選択した場合（ワークスペースが remount されない）でも
      // エディターを閉じてダッシュボードへ戻す。
      useWorkspaceStructureStore.getState().goToDashboard();
    } catch (e) {
      console.warn('[DslSidebar] project select reset failed', e);
    }
  };

  const handleLayoutSelect = (projectId: string, layoutId: string, isTeam: boolean) => {
    setDslScope(isTeam ? 'team_project_layouts' : 'project_layouts');
    setActiveProjectId(projectId);
    // Base をクリック → エディターを開く。
    // LayoutShell 側の openLayout が「最後に開いた Plan / 先頭 Plan」を解決して開く。
    useWorkspaceStructureStore.getState().openLayout(layoutId);
  };

  // Plan / Option を直接クリック → そのノードを開く。
  // - 永続コンテキスト（setContext）を書いておき、エディタが新規マウントされる場合
  //   （ホーム画面からの遷移）に initialBaseId/PlanId/OptionId として復元させる。
  // - すでに LayoutShell がマウント済み（ダッシュボードトグル時）の場合は
  //   構造ストアのライブ選択（openLayout → selectPlan → selectOption）で切り替える。
  const handleHierarchyNavigate = (
    projectId: string,
    isTeam: boolean,
    target: { baseId: string; planId?: string | null; optionId?: string | null; baseName?: string | null; planName?: string | null; optionName?: string | null },
  ) => {
    const { baseId, planId, optionId } = target;
    if (!baseId) return;
    setDslScope(isTeam ? 'team_project_layouts' : 'project_layouts');
    setActiveProjectId(projectId);

    const ctxStore = useDslWorkspaceContextStore.getState();
    ctxStore.setContext(projectId, 'layout', {
      baseId,
      planId: planId ?? null,
      optionId: optionId ?? null,
      baseName: target.baseName ?? null,
      planName: target.planName ?? null,
      optionName: target.optionName ?? null,
    });
    if (planId) ctxStore.setLastPlanForBase(baseId, planId);

    const structure = useWorkspaceStructureStore.getState();
    structure.openLayout(baseId);
    if (planId) structure.selectPlan(planId);
    if (optionId) structure.selectOption(optionId);
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid rgb(var(--brand-fg-rgb) / 0.05)` : 'none',
        display: "flex",
        flexDirection: "column",
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s",
      }}
    >
      <Box sx={{ px: 2, mb: 1 }}>
        {/* Search Input */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mr: 1 }} />
          <InputBase 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Global Scopes */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Layouts"
            active={dslScope === 'global_layouts' || dslScope === 'global_following_layouts'}
            onClick={() => handleScopeSelect('global_following_layouts')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dslScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem 
            icon={<PublicRoundedIcon />} 
            label="Public Layouts" 
            active={dslScope === 'my_public_layouts'} 
            onClick={() => handleScopeSelect('my_public_layouts')} 
            color="#9b59b6"
          />
          <ScopeItem 
            icon={<LockRoundedIcon />} 
            label="Private Layouts" 
            active={dslScope === 'my_private_layouts'} 
            onClick={() => handleScopeSelect('my_private_layouts')} 
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map(p => (
            <ProjectLayoutAccordion 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId && dslScope === 'project_layouts'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, false)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onLayoutSelect={(layoutId) => handleLayoutSelect(p.id, layoutId, false)}
              onNavigate={(target) => handleHierarchyNavigate(p.id, false, target)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <ProjectLayoutAccordion 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId && dslScope === 'team_project_layouts'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, true)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onLayoutSelect={(layoutId) => handleLayoutSelect(p.id, layoutId, true)}
              onNavigate={(target) => handleHierarchyNavigate(p.id, true, target)}
            />
          ))}
        </Box>

      </Box>

      {/* Create Project Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {createProjectType === 'my' ? '新規マイプロジェクト作成' : '新規チームプロジェクト作成'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {createProjectType === 'my' 
              ? '個人用の新しいプロジェクトを作成します。' 
              : 'チームのメンバーと共有するための新しいプロジェクトを作成します。'}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            type="text"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            disabled={isCreating}
            InputProps={{ style: { color: 'var(--brand-fg)' } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
