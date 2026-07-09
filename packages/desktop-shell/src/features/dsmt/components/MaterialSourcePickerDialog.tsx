import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Checkbox, FormControlLabel, FormControl,
  RadioGroup, Radio, Box, Typography, CircularProgress, Divider,
} from '@mui/material';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';

const ACCENT = '#ec407a';

export type SourceKey = 'current_project' | 'local' | 'other_project';

export type SaveDestination =
  | { type: 'current_project'; visibility: 'private' | 'public' }
  | { type: 'other_project'; projectId: string; visibility: 'private' | 'public' };

export interface PickedSources {
  types: SourceKey[];
  otherProjectIds: string[];
  destination: SaveDestination;
}

interface MaterialSourcePickerDialogProps {
  open: boolean;
  currentProjectId?: string;
  onClose: () => void;
  onConfirm: (sources: PickedSources) => void;
  /** チャット経由で開かれたとき、確認後にオーケストレーターループを再開する toolUseId。 */
  toolUseId?: string;
}

interface ProjectLite {
  id: string;
  name: string;
}

type DestRadioValue = 'current_private' | 'current_public' | 'other_project';

export const MaterialSourcePickerDialog: React.FC<MaterialSourcePickerDialogProps> = ({
  open,
  currentProjectId,
  onClose,
  onConfirm,
  toolUseId,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<SourceKey>>(new Set(['current_project']));
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  const [destRadio, setDestRadio] = useState<DestRadioValue>('current_private');
  const [destProjects, setDestProjects] = useState<ProjectLite[]>([]);
  const [destProjectId, setDestProjectId] = useState<string>('');
  const [loadingDestProjects, setLoadingDestProjects] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        setIsTauriEnv(isTauri());
      } catch {
        setIsTauriEnv(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !selectedTypes.has('other_project')) return;
    setLoadingProjects(true);
    const uid = useAuthStore.getState().currentUser?.uid;
    if (!uid) { setLoadingProjects(false); return; }
    (async () => {
      try {
        const [ownerSnap, memberSnap] = await Promise.all([
          getDocs(query(collection(db, 'projects'), where('ownerId', '==', uid), limit(30))),
          getDocs(query(collection(db, 'projects'), where('memberIds', 'array-contains', uid), limit(30))),
        ]);
        const seen = new Set<string>();
        const list: ProjectLite[] = [];
        for (const d of [...ownerSnap.docs, ...memberSnap.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const data = d.data() as any;
          list.push({ id: d.id, name: data.name || data.title || '無題のプロジェクト' });
        }
        setProjects(list);
      } catch (e) {
        console.error('[MaterialSourcePickerDialog] fetch src projects failed', e);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [open, selectedTypes.has('other_project')]);

  useEffect(() => {
    if (!open || destRadio !== 'other_project') return;
    setLoadingDestProjects(true);
    const uid = useAuthStore.getState().currentUser?.uid;
    if (!uid) { setLoadingDestProjects(false); return; }
    (async () => {
      try {
        const [ownerSnap, memberSnap] = await Promise.all([
          getDocs(query(collection(db, 'projects'), where('ownerId', '==', uid), limit(30))),
          getDocs(query(collection(db, 'projects'), where('memberIds', 'array-contains', uid), limit(30))),
        ]);
        const seen = new Set<string>();
        const list: ProjectLite[] = [];
        for (const d of [...ownerSnap.docs, ...memberSnap.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const data = d.data() as any;
          list.push({ id: d.id, name: data.name || data.title || '無題のプロジェクト' });
        }
        setDestProjects(list);
        if (list.length > 0 && !destProjectId) setDestProjectId(list[0].id);
      } catch (e) {
        console.error('[MaterialSourcePickerDialog] fetch dest projects failed', e);
      } finally {
        setLoadingDestProjects(false);
      }
    })();
  }, [open, destRadio]);

  const toggleType = (key: SourceKey) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (key === 'other_project') setSelectedProjectIds(new Set());
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasValidSourceSelection =
    selectedTypes.has('current_project') ||
    selectedTypes.has('local') ||
    (selectedTypes.has('other_project') && selectedProjectIds.size > 0);

  const hasValidDestination =
    destRadio === 'current_private' ||
    destRadio === 'current_public' ||
    (destRadio === 'other_project' && !!destProjectId);

  const hasValid = hasValidSourceSelection && hasValidDestination;

  const buildDestination = (): SaveDestination => {
    if (destRadio === 'current_public') return { type: 'current_project', visibility: 'public' };
    if (destRadio === 'other_project') return { type: 'other_project', projectId: destProjectId, visibility: 'private' };
    return { type: 'current_project', visibility: 'private' };
  };

  const handleConfirm = () => {
    const sources: PickedSources = {
      types: Array.from(selectedTypes),
      otherProjectIds: Array.from(selectedProjectIds),
      destination: buildDestination(),
    };
    if (toolUseId) {
      import('../../../store/useCoreOrchestrator').then(({ useCoreOrchestrator }) => {
        useCoreOrchestrator.getState().resumeWithToolResult(toolUseId, JSON.stringify(sources));
      });
      onClose();
    } else {
      onConfirm(sources);
    }
  };

  const sectionLabel = (text: string) => (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, mb: 0.5, mt: 1.5, textTransform: 'uppercase' }}>
      {text}
    </Typography>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 440, maxWidth: 580 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16, color: '#fff', pb: 0.5 }}>
        テクスチャのソースと保存先を選択
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5 }}>

        {/* ── テクスチャ取得元 ── */}
        {sectionLabel('テクスチャの取得元')}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <FormControlLabel
            control={<Checkbox checked={selectedTypes.has('current_project')} onChange={() => toggleType('current_project')}
              sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
            label={<Typography sx={{ fontSize: 14 }}>このプロジェクトのS.Image</Typography>}
          />
          <FormControlLabel
            disabled={!isTauriEnv}
            control={<Checkbox checked={selectedTypes.has('local')} onChange={() => toggleType('local')} disabled={!isTauriEnv}
              sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
            label={
              <Typography sx={{ fontSize: 14, color: isTauriEnv ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                ローカル素材 (LocalAssets/Images/テクスチャ/)
                {!isTauriEnv && <Typography component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', ml: 1 }}>デスクトップ専用</Typography>}
              </Typography>
            }
          />
          <FormControlLabel
            control={<Checkbox checked={selectedTypes.has('other_project')} onChange={() => toggleType('other_project')}
              sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
            label={<Typography sx={{ fontSize: 14 }}>別のプロジェクトのS.Image</Typography>}
          />
          {selectedTypes.has('other_project') && (
            <Box sx={{ ml: 4, maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
              {loadingProjects ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
              ) : projects.filter(p => p.id !== currentProjectId).length === 0 ? (
                <Typography sx={{ p: 1.5, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>他にプロジェクトが見つかりません</Typography>
              ) : (
                projects.filter(p => p.id !== currentProjectId).map((p) => {
                  const isSel = selectedProjectIds.has(p.id);
                  return (
                    <Box key={p.id} onClick={() => toggleProject(p.id)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.75, cursor: 'pointer',
                        bgcolor: isSel ? 'rgba(236,64,122,0.12)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none' },
                        '&:hover': { bgcolor: isSel ? 'rgba(236,64,122,0.18)' : 'rgba(255,255,255,0.05)' } }}>
                      <Checkbox checked={isSel} size="small" readOnly
                        sx={{ p: 0, color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />
                      <Typography sx={{ fontSize: 12 }}>{p.name}</Typography>
                    </Box>
                  );
                })
              )}
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1.5 }} />

        {/* ── 保存先 ── */}
        {sectionLabel('保存先')}
        <FormControl>
          <RadioGroup value={destRadio} onChange={(e) => setDestRadio(e.target.value as DestRadioValue)}>
            <FormControlLabel value="current_private"
              control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
              label={
                <Box>
                  <Typography sx={{ fontSize: 14 }}>Private Material</Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>現在のプロジェクト・非公開</Typography>
                </Box>
              }
            />
            <FormControlLabel value="current_public"
              control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
              label={
                <Box>
                  <Typography sx={{ fontSize: 14 }}>Public Material</Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>現在のプロジェクト・公開</Typography>
                </Box>
              }
            />
            <FormControlLabel value="other_project"
              control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
              label={<Typography sx={{ fontSize: 14 }}>別のプロジェクトに保存（非公開）</Typography>}
            />
          </RadioGroup>
        </FormControl>

        {destRadio === 'other_project' && (
          <Box sx={{ ml: 4, mt: 0.5, maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1 }}>
            {loadingDestProjects ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
            ) : destProjects.length === 0 ? (
              <Typography sx={{ p: 1.5, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>プロジェクトが見つかりません</Typography>
            ) : (
              destProjects.map((p) => (
                <Box key={p.id} onClick={() => setDestProjectId(p.id)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.75, cursor: 'pointer',
                    bgcolor: destProjectId === p.id ? 'rgba(236,64,122,0.12)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: destProjectId === p.id ? 'rgba(236,64,122,0.18)' : 'rgba(255,255,255,0.05)' } }}>
                  <Radio checked={destProjectId === p.id} size="small" readOnly
                    sx={{ p: 0, color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />
                  <Typography sx={{ fontSize: 12 }}>{p.name}</Typography>
                </Box>
              ))
            )}
          </Box>
        )}

        <Typography sx={{ mt: 1.5, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          既存マテリアルと重複するテクスチャはスキップします
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
        <Button variant="contained" disabled={!hasValid} onClick={handleConfirm}
          sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' },
            '&.Mui-disabled': { bgcolor: 'rgba(236,64,122,0.3)', color: 'rgba(255,255,255,0.4)' } }}>
          生成
        </Button>
      </DialogActions>
    </Dialog>
  );
};
