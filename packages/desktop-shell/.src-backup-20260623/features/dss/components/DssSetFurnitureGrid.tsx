import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, CircularProgress, IconButton, Dialog,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ImageIcon from '@mui/icons-material/Image';
import CategoryIcon from '@mui/icons-material/Category';
import { useAuthStore } from '../../../store/useAuthStore';
import { SetFurnitureEditor } from './SetFurnitureEditor';
import type { PlacedItem, ModelSetWithId } from './SetFurnitureEditor';

interface ModelSetDoc {
  title: string;
  ownerId: string;
  projectId?: string | null;
  visibility: 'public' | 'private';
  companionModels: { id: string; title: string; thumbnailUrl?: string }[];
  placedItems?: PlacedItem[];
  createdAt: string;
  updatedAt?: string;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; set: ModelSetWithId };

/** Scopes that indicate the user is browsing a specific project they own/belong to */
const PROJECT_SCOPES = new Set(['project_models', 'team_project_models']);

interface DssSetFurnitureGridProps {
  items: any[];
  payload?: any;
  modelsScope?: string;
  canCreate?: boolean;
}

export const DssSetFurnitureGrid: React.FC<DssSetFurnitureGridProps> = ({
  items,
  payload,
  modelsScope,
  canCreate = false,
}) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const [allSets, setAllSets] = useState<ModelSetWithId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  // Derive projectId from context
  const projectId: string | null = useMemo(
    () => (modelsScope && PROJECT_SCOPES.has(modelsScope) ? (payload?.projectId ?? null) : null),
    [modelsScope, payload?.projectId],
  );

  // Filter sets to match current scope (project vs. personal)
  const sets = useMemo(
    () => allSets.filter(s => (projectId ? s.projectId === projectId : !s.projectId)),
    [allSets, projectId],
  );

  useEffect(() => {
    if (!currentUser?.uid) return;
    fetchSets();
    // Re-fetch when user or project changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const fetchSets = async () => {
    setIsLoading(true);
    try {
      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      // Always fetch all user's sets; scope filtering is done client-side
      const q = query(
        collection(db, 'modelSets'),
        where('ownerId', '==', currentUser!.uid),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      setAllSets(snap.docs.map(d => ({ id: d.id, ...(d.data() as ModelSetDoc) } as ModelSetWithId)));
    } catch (e) {
      console.error('[DssSetFurnitureGrid] fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaved = (saved: ModelSetWithId) => {
    setAllSets(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditorState(null);
  };

  const handleDelete = async (setId: string) => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(db, 'modelSets', setId));
      setAllSets(prev => prev.filter(s => s.id !== setId));
    } catch (e) {
      console.error('[DssSetFurnitureGrid] delete error:', e);
    }
  };

  return (
    <>
    {/* Editor dialog */}
    <Dialog
      open={editorState !== null}
      onClose={() => setEditorState(null)}
      PaperProps={{
        sx: {
          width: '92vw', height: '88vh',
          maxWidth: 'none', maxHeight: 'none',
          bgcolor: '#0f1117', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        },
      }}
    >
      {editorState && (
        <SetFurnitureEditor
          availableModels={items}
          currentUser={currentUser}
          projectId={projectId}
          initialTitle={editorState.mode === 'edit' ? editorState.set.title : ''}
          initialVisibility={editorState.mode === 'edit' ? editorState.set.visibility : 'private'}
          initialPlacedItems={editorState.mode === 'edit' ? (editorState.set.placedItems ?? []) : []}
          existingSetId={editorState.mode === 'edit' ? editorState.set.id : undefined}
          onBack={() => setEditorState(null)}
          onSaved={handleSaved}
        />
      )}
    </Dialog>

    {/* Grid */}
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        px: 2, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            セット家具 {!isLoading && `(${sets.length})`}
          </Typography>
          {projectId && (
            <Typography sx={{
              fontSize: 10, color: 'rgba(167,139,250,0.7)',
              bgcolor: 'rgba(167,139,250,0.1)', px: 0.75, py: 0.2,
              borderRadius: 0.75, border: '1px solid rgba(167,139,250,0.2)',
            }}>
              プロジェクト
            </Typography>
          )}
        </Box>
        {canCreate && (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setEditorState({ mode: 'create' })}
            sx={{
              textTransform: 'none', fontSize: 11, height: 28, px: 1.5,
              bgcolor: '#a78bfa', color: '#000', fontWeight: 600,
              '&:hover': { bgcolor: '#9061f9' },
            }}
          >
            セットを作成
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={24} sx={{ color: '#a78bfa' }} />
          </Box>
        ) : sets.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
            <CategoryIcon sx={{ fontSize: 52, color: 'rgba(255,255,255,0.07)' }} />
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>セット家具が登録されていません</Typography>
            {canCreate && (
              <Button
                variant="outlined" size="small"
                onClick={() => setEditorState({ mode: 'create' })}
                sx={{
                  textTransform: 'none', fontSize: 11,
                  borderColor: 'rgba(167,139,250,0.3)', color: '#a78bfa',
                  '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(167,139,250,0.05)' },
                }}
              >
                最初のセットを作成
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.5 }}>
            {sets.map(set => (
              <SetFurnitureCard
                key={set.id}
                set={set}
                canEdit={canCreate}
                onEdit={() => canCreate && setEditorState({ mode: 'edit', set })}
                onDelete={() => handleDelete(set.id)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
    </>
  );
};

const SetFurnitureCard: React.FC<{
  set: ModelSetWithId;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ set, canEdit, onEdit, onDelete }) => (
  <Box
    onClick={canEdit ? onEdit : undefined}
    sx={{
      bgcolor: 'rgba(167,139,250,0.04)',
      border: '1px solid rgba(167,139,250,0.12)',
      borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: 'rgba(167,139,250,0.35)' },
    }}
  >
    {/* Mosaic thumbnail */}
    <Box sx={{
      width: '100%', aspectRatio: '4/3',
      bgcolor: 'rgba(0,0,0,0.25)', display: 'flex', flexWrap: 'wrap', gap: '2px', p: '4px',
    }}>
      {set.companionModels.length > 0 ? (
        set.companionModels.slice(0, 4).map((cm, i) => (
          <Box key={i} sx={{ width: 'calc(50% - 1px)', height: 'calc(50% - 1px)', borderRadius: '3px', overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.2)' }}>
            {cm.thumbnailUrl
              ? <img src={cm.thumbnailUrl} alt={cm.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.12)' }} />
                </Box>
            }
          </Box>
        ))
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CategoryIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.08)' }} />
        </Box>
      )}
    </Box>

    <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {set.title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
          {set.companionModels.length} モデル
        </Typography>
      </Box>
      {canEdit && (
        <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onEdit(); }}
            sx={{ color: 'rgba(255,255,255,0.25)', p: 0.5, '&:hover': { color: '#a78bfa', bgcolor: 'rgba(167,139,250,0.1)' } }}
          >
            <EditRoundedIcon sx={{ fontSize: 13 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            sx={{ color: 'rgba(255,255,255,0.25)', p: 0.5, '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  </Box>
);
