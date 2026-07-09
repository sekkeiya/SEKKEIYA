import React, { useState, useEffect } from 'react';
import { Box, Typography, Menu, MenuItem, Tooltip, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import iconSekkeiya from '../../../../src-tauri/src/assets/icons/sekkeiya.png';
import iconShare    from '../../../../src-tauri/src/assets/icons/share.png';
import iconLayout   from '../../../../src-tauri/src/assets/icons/layout.png';
import iconPresents from '../../../../src-tauri/src/assets/icons/presents.png';
import iconCreate   from '../../../../src-tauri/src/assets/icons/create.png';
import iconDiagram  from '../../../../src-tauri/src/assets/icons/diagram.png';
import iconDrawing  from '../../../../src-tauri/src/assets/icons/drawing.png';
import iconImage    from '../../../../src-tauri/src/assets/icons/image.png';
import iconQuest    from '../../../../src-tauri/src/assets/icons/quest.png';
import iconBooks    from '../../../../src-tauri/src/assets/icons/books.png';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../../store/useAppStore';
import { useDssSyncStore } from '../../../store/useDssSyncStore';
import { BRAND } from '../../../styles/theme';
import { openChildWindow } from '../../../utils/openChildWindow';
import { UnsavedFilesIndicator } from './UnsavedFilesIndicator';

type TabDef = { scope: string; id: string | null; label: string; color: string; icon?: string };

const SEKKEIYA_TAB: TabDef = { scope: 'sekkeiya', id: null, label: 'SEKKEIYA', color: '#64b5f6', icon: iconSekkeiya };

const ALL_CHILD_TABS: TabDef[] = [
  { scope: '3dss', id: 'models',   label: 'S.Models',        color: '#ff5252',  icon: iconShare    },
  { scope: '3dsl', id: 'layout',   label: 'S.Layout',        color: '#ffb74d',  icon: iconLayout   },
  { scope: '3dsp', id: 'presents', label: 'S.Presentations', color: '#ba68c8',  icon: iconPresents },
  { scope: '3dsc', id: 'create',   label: 'S.Create',        color: '#ffa726',  icon: iconCreate   },
  { scope: '3dsd', id: 'diagram',  label: 'S.Diagram',       color: '#aed581',  icon: iconDiagram  },
  { scope: '3dsr', id: 'drawing',  label: 'S.Drawing',       color: '#4db6ac',  icon: iconDrawing  },
  { scope: '3dsi', id: 'image',    label: 'S.Image',         color: '#ec407a',  icon: iconImage    },
  { scope: '3dsq', id: 'quest',    label: 'S.Quest',         color: '#5c6bc0',  icon: iconQuest    },
  { scope: '3dsf', id: 'portfolio', label: 'S.Portfolio',    color: '#7e57c2',  icon: iconBooks    },
];

const TabIcon: React.FC<{ src?: string; color?: string }> = ({ src, color }) => {
  const [err, setErr] = React.useState(false);
  if (!src || err) return null;
  return (
    <Box
      className="tab-icon-badge"
      sx={{
        width: 22, height: 22,
        borderRadius: '5px',
        bgcolor: color ? `${color}33` : 'rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, mr: 0.75,
        border: color ? `1px solid ${color}77` : '1px solid rgba(255,255,255,0.15)',
        boxShadow: color ? `0 0 6px ${color}44` : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <img
        src={src}
        onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
        alt=""
      />
    </Box>
  );
};

const TAB_WIDTH = 148;

const TAB_BASE_SX = (isActive: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  width: TAB_WIDTH,
  flexShrink: 0,
  px: 1.5,
  pl: 2,
  borderRight: `1px solid ${BRAND.line}`,
  bgcolor: isActive ? BRAND.bg : 'transparent',
  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
  position: 'relative' as const,
  transition: 'background-color 0.2s, color 0.2s',
  '&:before': isActive ? {
    content: '""',
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    bgcolor: '#90caf9',
    boxShadow: '0 0 8px rgba(144,202,249,0.5)',
  } : {},
  '&:hover': {
    bgcolor: isActive ? BRAND.bg : 'rgba(255,255,255,0.03)',
    color: '#fff',
    '& .tab-dot':      { opacity: 0 },
    '& .tab-actions':  { opacity: 1, pointerEvents: 'auto' },
    '& .tab-icon-badge': {
      transform: 'translateY(-2px) scale(1.12)',
      boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
    },
  },
});

// 未保存（作業中）を示すドットの色 — タブ色とは別色で目立たせる
const DIRTY_DOT_COLOR = '#ffb300';

interface SortableTabProps {
  tab: TabDef;
  isActive: boolean;
  isDirty: boolean;
  onActivate: () => void;
  onClose: () => void;
  onOpenNew: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({
  tab, isActive, isDirty, onActivate, onClose, onOpenNew, onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.scope });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      sx={{
        ...TAB_BASE_SX(isActive),
        pr: 0.5,
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : (transition ?? 'background-color 0.2s, color 0.2s'),
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'pointer',
        zIndex: isDragging ? 10 : 'auto',
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 2, bgcolor: tab.color }} />
      <TabIcon src={tab.icon} color={tab.color} />
      <Typography
        variant="caption"
        fontWeight={isActive ? 600 : 400}
        noWrap
        sx={{ flex: 1, userSelect: 'none', fontSize: '0.75rem' }}
      >
        {tab.label}
      </Typography>

      {/* Right: active / dirty dot (default) / action buttons (on hover) */}
      <Box sx={{ position: 'relative', width: 28, height: 16, flexShrink: 0, ml: 0.5 }}>
        {/* 未保存ドット（作業中）— アクティブ/非アクティブを問わず表示。タブ色とは別色。 */}
        {isDirty && (
          <Box
            className="tab-dot"
            sx={{
              position: 'absolute', top: '50%', right: 8,
              transform: 'translateY(-50%)',
              width: 7, height: 7, borderRadius: '50%',
              bgcolor: DIRTY_DOT_COLOR,
              boxShadow: `0 0 6px ${DIRTY_DOT_COLOR}, 0 0 2px ${DIRTY_DOT_COLOR}`,
              transition: 'opacity 0.15s', opacity: 1,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* VSCode-style work-in-progress dot — visible when active, hidden on hover */}
        {isActive && !isDirty && (
          <Box
            className="tab-dot"
            sx={{
              position: 'absolute', top: '50%', right: 8,
              transform: 'translateY(-50%)',
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: tab.color, boxShadow: `0 0 5px ${tab.color}99`,
              transition: 'opacity 0.15s', opacity: 1,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Action buttons — appear on hover */}
        <Box
          className="tab-actions"
          sx={{
            opacity: 0, pointerEvents: 'none',
            position: 'absolute', top: '50%', right: 0,
            transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', gap: 0.25,
            transition: 'opacity 0.15s',
          }}
        >
          <Box
            onClick={(e) => { e.stopPropagation(); onOpenNew(); }}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: '3px',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 10 }} />
          </Box>
          <Box
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: '50%',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 10 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export const WorkspaceTabBar: React.FC = () => {
  const activeWorkspaceId   = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId     = useAppStore(s => s.activeProjectId);
  const setActiveWorkspaceId  = useAppStore(s => s.setActiveWorkspaceId);
  const setLastActiveAppScope = useAppStore(s => s.setLastActiveAppScope);
  const pinnedTabIds        = useAppStore(s => s.pinnedTabIds);
  const togglePinnedTab     = useAppStore(s => s.togglePinnedTab);
  const setPinnedTabIds     = useAppStore(s => s.setPinnedTabIds);
  const dirtyScopes         = useAppStore(s => s.dirtyScopes);

  // S.Models(3dss): ローカルモデルファイルが未アップロード（編集後）なら未保存扱い。
  // ファイル監視ストアは常駐するため、常時マウントされるタブバーで registry に同期する。
  const dssStatuses = useDssSyncStore(s => s.statuses);
  useEffect(() => {
    const dirty = Object.values(dssStatuses).some((st: any) => st?.isDirty);
    useAppStore.getState().setScopeDirty('3dss', dirty);
  }, [dssStatuses]);

  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: TabDef } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visibleTabs = pinnedTabIds
    .map(id => ALL_CHILD_TABS.find(t => t.scope === id))
    .filter((t): t is TabDef => !!t);

  const hiddenTabs = ALL_CHILD_TABS.filter(t => !pinnedTabIds.includes(t.scope));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pinnedTabIds.indexOf(active.id as string);
    const newIdx = pinnedTabIds.indexOf(over.id as string);
    setPinnedTabIds(arrayMove(pinnedTabIds, oldIdx, newIdx));
  };

  const activateTab = (tab: TabDef) => {
    const store = useAppStore.getState();

    // No project selected → switch sub-app to its global browse scope
    // so it never shows "No Workspace Selected"
    if (!store.activeProjectId && tab.id !== null) {
      switch (tab.scope) {
        case '3dss': store.setModelsScope('global_models');          break;
        case '3dsl': store.setDslScope('global_layouts');            break;
        case '3dsp': store.setDspScope('global_presentations');      break;
        case '3dsd': store.setDsdScope('global_diagrams');           break;
        case '3dsr': store.setDsrScope('global_drawings');           break;
      }
    }

    setActiveWorkspaceId(tab.id);
    setLastActiveAppScope(tab.scope as any);
    if (tab.id === null) {
      if (!store.activeProjectId) store.setCurrentMainView('app-hub');
      else if (store.currentMainView !== 'workspace') store.setCurrentMainView('workspace');
    } else if (store.currentMainView !== 'workspace') {
      store.setCurrentMainView('workspace');
    }
  };

  const handleOpenNew = (tab: TabDef) => {
    openChildWindow(tab.scope, activeProjectId);
  };

  const isSekkeiyaActive = activeWorkspaceId === null;

  const menuPaperSx = {
    bgcolor: '#1a1c22',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    minWidth: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        bgcolor: '#14161B',
        borderBottom: `1px solid ${BRAND.line}`,
        height: 32,
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {/* SEKKEIYA tab — always fixed */}
      <Box onClick={() => activateTab(SEKKEIYA_TAB)} sx={{ ...TAB_BASE_SX(isSekkeiyaActive), pr: 0.5 }}>
        <Box sx={{ position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 2, bgcolor: SEKKEIYA_TAB.color }} />
        <TabIcon src={SEKKEIYA_TAB.icon} color={SEKKEIYA_TAB.color} />
        <Typography
          variant="caption"
          fontWeight={isSekkeiyaActive ? 600 : 400}
          noWrap
          sx={{ flex: 1, userSelect: 'none', fontSize: '0.75rem' }}
        >
          {SEKKEIYA_TAB.label}
        </Typography>
        <Box sx={{ position: 'relative', width: 14, height: 16, flexShrink: 0, ml: 0.5 }}>
          {isSekkeiyaActive && (
            <Box
              className="tab-dot"
              sx={{
                position: 'absolute', top: '50%', right: 2,
                transform: 'translateY(-50%)',
                width: 6, height: 6, borderRadius: '50%',
                bgcolor: SEKKEIYA_TAB.color, boxShadow: `0 0 5px ${SEKKEIYA_TAB.color}99`,
                transition: 'opacity 0.15s', opacity: 1, pointerEvents: 'none',
              }}
            />
          )}
        </Box>
      </Box>

      {/* Sortable child tabs */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleTabs.map(t => t.scope)} strategy={horizontalListSortingStrategy}>
          {visibleTabs.map(tab => (
            <SortableTab
              key={tab.scope}
              tab={tab}
              isActive={tab.id === activeWorkspaceId}
              isDirty={Boolean(dirtyScopes[tab.scope])}
              onActivate={() => activateTab(tab)}
              onClose={() => togglePinnedTab(tab.scope)}
              onOpenNew={() => handleOpenNew(tab)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, tab });
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* + button */}
      <Tooltip title="アプリを追加" placement="bottom">
        <Box
          onClick={(e) => setAddMenuAnchor(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: 32,
            flexShrink: 0,
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </Box>
      </Tooltip>

      {/* 右寄せスペーサ + 未保存ファイル一覧インジケータ */}
      <Box sx={{ flex: 1, minWidth: 8 }} />
      <UnsavedFilesIndicator />

      {/* + dropdown */}
      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={() => setAddMenuAnchor(null)}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        {hiddenTabs.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
            すべて表示中
          </MenuItem>
        ) : (
          hiddenTabs.map(tab => (
            <MenuItem
              key={tab.scope}
              onClick={() => { togglePinnedTab(tab.scope); setAddMenuAnchor(null); }}
              sx={{ fontSize: '0.8rem', gap: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tab.color, flexShrink: 0 }} />
              {tab.label}
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Right-click context menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
        slotProps={{ paper: { sx: menuPaperSx } }}
      >
        <MenuItem
          onClick={() => {
            if (contextMenu) handleOpenNew(contextMenu.tab);
            setContextMenu(null);
          }}
          sx={{ fontSize: '0.85rem', gap: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          <OpenInNewIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }} />
          新しいウィンドウで開く
        </MenuItem>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 0.5 }} />
        <MenuItem
          onClick={() => {
            if (contextMenu) togglePinnedTab(contextMenu.tab.scope);
            setContextMenu(null);
          }}
          sx={{ fontSize: '0.85rem', gap: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          <CloseIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }} />
          タブを閉じる
        </MenuItem>
      </Menu>
    </Box>
  );
};
