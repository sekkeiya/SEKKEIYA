import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Chip,
  ToggleButtonGroup, ToggleButton, CircularProgress,
  Menu, MenuItem, Tooltip, Divider,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ImageIcon from '@mui/icons-material/Image';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import VerticalAlignBottomRoundedIcon from '@mui/icons-material/VerticalAlignBottomRounded';
import VerticalAlignTopRoundedIcon from '@mui/icons-material/VerticalAlignTopRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import AlignHorizontalLeftRoundedIcon from '@mui/icons-material/AlignHorizontalLeftRounded';
import AlignHorizontalRightRoundedIcon from '@mui/icons-material/AlignHorizontalRightRounded';
import AlignHorizontalCenterRoundedIcon from '@mui/icons-material/AlignHorizontalCenterRounded';
import AlignVerticalCenterRoundedIcon from '@mui/icons-material/AlignVerticalCenterRounded';
import { SetFurnitureCanvas, SetFurnitureCanvas3D } from './SetFurnitureCanvas';

const CATEGORIES = ['すべて', 'ソファ', 'チェア', 'テーブル', 'ベッド', '収納', 'その他'];

export interface PlacedItem {
  instanceId: string;
  assetId: string;
  title: string;
  thumbnailUrl?: string;
  w: number;        // mm – footprint width
  d: number;        // mm – footprint depth
  x: number;        // mm – X position (left/right)
  y: number;        // mm – Y position (front/back); Firestore field name kept as "y"
  z?: number;       // mm – Z elevation (up/down), default 0 (floor level)
  rotation: number; // degrees – Z-axis rotation (vertical axis in Z-up world)
}

export interface ModelSetWithId {
  id: string;
  title: string;
  ownerId: string;
  projectId?: string | null;
  visibility: 'public' | 'private';
  companionModels: { id: string; title: string; thumbnailUrl?: string }[];
  placedItems: PlacedItem[];
  createdAt: string;
  updatedAt?: string;
}

interface SetFurnitureEditorProps {
  availableModels: any[];
  currentUser: any;
  projectId?: string | null;
  initialTitle?: string;
  initialVisibility?: 'public' | 'private';
  initialPlacedItems?: PlacedItem[];
  existingSetId?: string;
  onBack: () => void;
  onSaved: (set: ModelSetWithId) => void;
}

export const SetFurnitureEditor: React.FC<SetFurnitureEditorProps> = ({
  availableModels,
  currentUser,
  projectId = null,
  initialTitle = '',
  initialVisibility = 'private',
  initialPlacedItems = [],
  existingSetId,
  onBack,
  onSaved,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility);
  const [isSaving, setIsSaving] = useState(false);

  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState('すべて');

  // ── Library tab: ALL | projects ───────────────────────────────────────────
  type LibTab = 'all' | 'projects';
  const [libTab, setLibTab] = useState<LibTab>('all');

  // ALL tab: global public models (fetched lazily on first switch to ALL)
  const [globalModels, setGlobalModels] = useState<any[] | null>(null);
  const [globalModelsLoading, setGlobalModelsLoading] = useState(false);

  // Projects tab: list of user's projects
  const [projects, setProjects] = useState<any[] | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Selected project and its models
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [projectAssetsLoading, setProjectAssetsLoading] = useState(false);

  // Fetch global public models once
  const fetchGlobalModels = useCallback(async () => {
    if (globalModels !== null || globalModelsLoading) return;
    setGlobalModelsLoading(true);
    try {
      const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const q = query(
        collection(db, 'assets'),
        where('type', '==', '3d-model'),
        where('visibility', '==', 'public'),
        limit(200),
      );
      const snap = await getDocs(q);
      setGlobalModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('[SetFurnitureEditor] fetchGlobalModels:', e);
      setGlobalModels(availableModels); // fallback
    } finally {
      setGlobalModelsLoading(false);
    }
  }, [globalModels, globalModelsLoading, availableModels]);

  // Fetch user's projects once
  const fetchProjects = useCallback(async () => {
    if (projects !== null || projectsLoading || !currentUser?.uid) return;
    setProjectsLoading(true);
    try {
      const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const q = query(
        collection(db, 'projects'),
        where('ownerId', '==', currentUser.uid),
        orderBy('updatedAt', 'desc'),
        limit(50),
      );
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('[SetFurnitureEditor] fetchProjects:', e);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [projects, projectsLoading, currentUser?.uid]);

  // Fetch assets for a specific project
  const fetchProjectAssets = useCallback(async (projectId: string) => {
    setProjectAssetsLoading(true);
    setProjectAssets([]);
    try {
      const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const q = query(
        collection(db, `projects/${projectId}/assets`),
        where('status', '!=', 'archived'),
        limit(200),
      );
      const snap = await getDocs(q);
      setProjectAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('[SetFurnitureEditor] fetchProjectAssets:', e);
      setProjectAssets([]);
    } finally {
      setProjectAssetsLoading(false);
    }
  }, []);

  // Lazy-load on tab switch
  useEffect(() => {
    if (libTab === 'all') fetchGlobalModels();
    else fetchProjects();
  }, [libTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active model pool depending on tab/project selection
  const activeModels: any[] = useMemo(() => {
    if (libTab === 'all') return globalModels ?? availableModels;
    if (selectedProject) return projectAssets;
    return [];
  }, [libTab, globalModels, availableModels, selectedProject, projectAssets]);

  // Merged pool for canvas lookup — must include ALL sources so placed items resolve their GLB URLs
  const modelsForCanvas: any[] = useMemo(() => {
    const map = new Map<string, any>();
    availableModels.forEach(m => map.set(m.id, m));
    (globalModels ?? []).forEach(m => map.set(m.id, m));
    projectAssets.forEach(m => map.set(m.id, m));
    return Array.from(map.values());
  }, [availableModels, globalModels, projectAssets]);

  const [placedItems, setPlacedItems] = useState<PlacedItem[]>(initialPlacedItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingModel, setPendingModel] = useState<any>(null);
  const [rotateStepDeg, setRotateStepDeg] = useState(90);

  const selectedItem = useMemo(
    () => placedItems.find(i => i.instanceId === selectedId) ?? null,
    [placedItems, selectedId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingModel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredLibModels = useMemo(() => {
    return activeModels
      .filter(m => m.type !== 'image' && m.type !== 'pdf')
      .filter(m => {
        if (libCategory === 'すべて') return true;
        const catStr = [m.category, m.mainCategory, m.macroCategory].filter(Boolean).join(' ');
        if (libCategory === 'その他') {
          return !['ソファ', 'チェア', 'テーブル', 'ベッド', '収納'].some(k => catStr.includes(k));
        }
        return catStr.includes(libCategory);
      })
      .filter(m => {
        if (!libSearch) return true;
        return (m.title || m.name || '').toLowerCase().includes(libSearch.toLowerCase());
      });
  }, [activeModels, libCategory, libSearch]);

  // ── Canvas callbacks ──────────────────────────────────────────────────────

  const addModelAtPosition = useCallback((model: any, worldX: number, worldZ: number) => {
    const dims = model.dimensions ?? model.dimensionsMm ?? {};
    const w = dims.x ?? dims.width ?? 800;
    const d = dims.y ?? dims.depth ?? dims.z ?? 600;
    setPlacedItems(prev => [...prev, {
      instanceId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      assetId: model.id,
      title: model.title ?? model.name ?? 'Untitled',
      thumbnailUrl: model.thumbnailUrl ?? model.thumbnail ?? undefined,
      w, d, x: worldX, y: worldZ, z: 0, rotation: 0,
    }]);
  }, []);

  const handleLibAdd = useCallback((model: any) => {
    setPendingModel(model);
    setSelectedId(null);
  }, []);

  const handlePlaceAt = useCallback((worldX: number, worldZ: number) => {
    if (!pendingModel) return;
    addModelAtPosition(pendingModel, worldX, worldZ);
    setPendingModel(null);
  }, [pendingModel, addModelAtPosition]);

  const handleMoveItem = useCallback((id: string, x: number, depth: number, elevation?: number) => {
    setPlacedItems(prev => prev.map(item => {
      if (item.instanceId !== id) return item;
      const updates: Partial<PlacedItem> = { x, y: depth };
      if (elevation !== undefined) updates.z = elevation;
      return { ...item, ...updates };
    }));
  }, []);

  const handleRotateItem = useCallback((id: string, rotDeg: number) => {
    setPlacedItems(prev => prev.map(item =>
      item.instanceId === id ? { ...item, rotation: rotDeg } : item,
    ));
  }, []);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // ── Property panel callbacks ──────────────────────────────────────────────

  const handleUpdateProp = useCallback((field: 'x' | 'y' | 'z' | 'rotation', value: number) => {
    if (!selectedId) return;
    setPlacedItems(prev => prev.map(i => i.instanceId === selectedId ? { ...i, [field]: value } : i));
  }, [selectedId]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    setPlacedItems(prev => prev.filter(i => i.instanceId !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // ── Toolbar actions ───────────────────────────────────────────────────────

  /** Snap selected item to the floor (z = 0) */
  const handleSnapFloor = useCallback(() => {
    if (!selectedId) return;
    setPlacedItems(prev => prev.map(i => i.instanceId === selectedId ? { ...i, z: 0 } : i));
  }, [selectedId]);

  /** Place selected item on top of the highest overlapping item below it */
  const handleOnObject = useCallback(() => {
    if (!selectedId) return;
    setPlacedItems(prev => {
      const sel = prev.find(i => i.instanceId === selectedId);
      if (!sel) return prev;
      const others = prev.filter(i => i.instanceId !== selectedId);
      let maxTop = 0;
      for (const other of others) {
        // Axis-aligned footprint overlap check (rotation ignored for speed)
        const overlapX = Math.abs(other.x - sel.x) < (other.w + sel.w) / 2;
        const overlapY = Math.abs(other.y - sel.y) < (other.d + sel.d) / 2;
        if (!overlapX || !overlapY) continue;
        // Try to get actual model height from the merged model pool
        const modelData = modelsForCanvas.find(m => m.id === other.assetId);
        const dims = modelData?.dimensionsMm ?? modelData?.dimensions ?? {};
        const modelH = Number(dims.height ?? dims.z ?? 0);
        const h = modelH > 0 ? modelH : Math.min(other.w, other.d) * 0.5;
        maxTop = Math.max(maxTop, (other.z ?? 0) + h);
      }
      return prev.map(i => i.instanceId === selectedId ? { ...i, z: maxTop } : i);
    });
  }, [selectedId, modelsForCanvas]);

  /** Rotate selected item by the current step amount */
  const handleRotate = useCallback(() => {
    if (!selectedId) return;
    setPlacedItems(prev => prev.map(i =>
      i.instanceId === selectedId ? { ...i, rotation: i.rotation + rotateStepDeg } : i,
    ));
  }, [selectedId, rotateStepDeg]);

  /** Align selected item relative to the bounding box of all placed items */
  const handleAlign = useCallback((key: string) => {
    if (!selectedId || placedItems.length < 2) return;
    setPlacedItems(prev => {
      const sel = prev.find(i => i.instanceId === selectedId);
      if (!sel) return prev;
      let newX = sel.x;
      let newY = sel.y;
      switch (key) {
        case 'AT': { // align to top (max Y edge)
          const maxY = Math.max(...prev.map(i => i.y + i.d / 2));
          newY = maxY - sel.d / 2;
          break;
        }
        case 'AB': { // align to bottom (min Y edge)
          const minY = Math.min(...prev.map(i => i.y - i.d / 2));
          newY = minY + sel.d / 2;
          break;
        }
        case 'AL': { // align to left (min X edge)
          const minX = Math.min(...prev.map(i => i.x - i.w / 2));
          newX = minX + sel.w / 2;
          break;
        }
        case 'AR': { // align to right (max X edge)
          const maxX = Math.max(...prev.map(i => i.x + i.w / 2));
          newX = maxX - sel.w / 2;
          break;
        }
        case 'AH': { // horizontal center (center of X bounding box)
          const minX = Math.min(...prev.map(i => i.x - i.w / 2));
          const maxX = Math.max(...prev.map(i => i.x + i.w / 2));
          newX = (minX + maxX) / 2;
          break;
        }
        case 'AV': { // vertical center (center of Y bounding box)
          const minY = Math.min(...prev.map(i => i.y - i.d / 2));
          const maxY = Math.max(...prev.map(i => i.y + i.d / 2));
          newY = (minY + maxY) / 2;
          break;
        }
      }
      return prev.map(i => i.instanceId === selectedId ? { ...i, x: newX, y: newY } : i);
    });
  }, [selectedId, placedItems]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim() || !currentUser?.uid) return;
    setIsSaving(true);
    try {
      const { collection, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const seen = new Set<string>();
      const companionModels = placedItems
        .filter(i => !seen.has(i.assetId) && seen.add(i.assetId))
        .map(i => ({ id: i.assetId, title: i.title, thumbnailUrl: i.thumbnailUrl ?? null }));
      const docRef = existingSetId
        ? doc(db, 'modelSets', existingSetId)
        : doc(collection(db, 'modelSets'));
      const payload = {
        title: title.trim(),
        ownerId: currentUser.uid,
        projectId: projectId ?? null,
        visibility,
        companionModels,
        placedItems,
        updatedAt: serverTimestamp(),
        ...(existingSetId ? {} : { createdAt: serverTimestamp() }),
      };
      await setDoc(docRef, payload, { merge: true });
      const now = new Date().toISOString();
      onSaved({ id: docRef.id, ...payload, createdAt: now, updatedAt: now });
    } catch (e) {
      console.error('[SetFurnitureEditor] save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0f1117' }}>

      {/* ── Header ── */}
      <Box sx={{
        height: 52, px: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, bgcolor: '#131720',
      }}>
        <IconButton size="small" onClick={onBack} sx={{ color: 'rgba(255,255,255,0.55)', p: 0.75, flexShrink: 0 }}>
          <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <TextField
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="セット名を入力..."
          size="small"
          variant="standard"
          sx={{
            flex: '1 1 200px', maxWidth: 340,
            '& .MuiInputBase-root': { color: '#fff', fontSize: 14, fontWeight: 600 },
            '& .MuiInputBase-input': { '&::placeholder': { color: 'rgba(255,255,255,0.28)', opacity: 1 } },
            '& .MuiInput-underline:before': { borderColor: 'rgba(255,255,255,0.1)' },
            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderColor: 'rgba(255,255,255,0.28)' },
            '& .MuiInput-underline:after': { borderColor: '#a78bfa' },
          }}
        />

        <ToggleButtonGroup
          value={visibility} exclusive
          onChange={(_, v) => v && setVisibility(v)}
          size="small"
          sx={{
            flexShrink: 0,
            '& .MuiToggleButton-root': {
              fontSize: 10, py: 0.35, px: 1.5, textTransform: 'none',
              color: 'rgba(255,255,255,0.38)', borderColor: 'rgba(255,255,255,0.1)',
              '&.Mui-selected': { bgcolor: 'rgba(167,139,250,0.14)', color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' },
            },
          }}
        >
          <ToggleButton value="private">非公開</ToggleButton>
          <ToggleButton value="public">全体公開</ToggleButton>
        </ToggleButtonGroup>

        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', px: 0.5, flexShrink: 0 }}>
          {placedItems.length} モデル
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Button
          variant="contained" size="small"
          startIcon={<SaveRoundedIcon sx={{ fontSize: 14 }} />}
          disabled={!title.trim() || isSaving}
          onClick={handleSave}
          sx={{
            textTransform: 'none', fontSize: 12, height: 32, px: 2, flexShrink: 0,
            bgcolor: '#a78bfa', color: '#000', fontWeight: 600,
            '&:hover': { bgcolor: '#9061f9' },
            '&.Mui-disabled': { bgcolor: 'rgba(167,139,250,0.18)', color: 'rgba(0,0,0,0.3)' },
          }}
        >
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </Box>

      {/* ── Toolbar ── */}
      <SetFurnitureToolbar
        hasSelection={!!selectedItem}
        hasMultiple={placedItems.length >= 2}
        rotateStepDeg={rotateStepDeg}
        onRotateStepChange={setRotateStepDeg}
        onSnapFloor={handleSnapFloor}
        onOnObject={handleOnObject}
        onRotate={handleRotate}
        onAlign={handleAlign}
      />

      {/* ── Body ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Model Library */}
        <Box sx={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', bgcolor: '#0d1018',
        }}>
          {/* ── Tab bar: ALL / プロジェクト ── */}
          <Box sx={{
            display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
          }}>
            {(['all', 'projects'] as const).map(tab => (
              <Box
                key={tab}
                onClick={() => {
                  setLibTab(tab);
                  if (tab === 'all') { setSelectedProject(null); }
                }}
                sx={{
                  flex: 1, py: 0.85, textAlign: 'center', cursor: 'pointer', fontSize: 11,
                  fontWeight: 600, letterSpacing: 0.3,
                  color: libTab === tab ? '#a78bfa' : 'rgba(255,255,255,0.35)',
                  borderBottom: libTab === tab ? '2px solid #a78bfa' : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                  '&:hover': { color: libTab === tab ? '#a78bfa' : 'rgba(255,255,255,0.6)' },
                }}
              >
                {tab === 'all' ? 'ALL' : 'プロジェクト'}
              </Box>
            ))}
          </Box>

          {libTab === 'all' ? (
            /* ─── ALL tab ─────────────────────────────────────────────── */
            <>
              <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
                <Box sx={{ position: 'relative' }}>
                  <SearchRoundedIcon sx={{
                    position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none',
                  }} />
                  <input
                    value={libSearch}
                    onChange={e => setLibSearch(e.target.value)}
                    placeholder="モデルを検索..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, padding: '5px 8px 5px 25px', color: '#fff', fontSize: 11,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ px: 1, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, flexShrink: 0 }}>
                {CATEGORIES.map(cat => (
                  <Chip
                    key={cat} label={cat} size="small"
                    onClick={() => setLibCategory(cat)}
                    sx={{
                      height: 20, fontSize: 10, cursor: 'pointer',
                      bgcolor: libCategory === cat ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                      color: libCategory === cat ? '#a78bfa' : 'rgba(255,255,255,0.42)',
                      border: libCategory === cat ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                ))}
              </Box>

              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                {globalModelsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', pt: 5 }}>
                    <CircularProgress size={20} sx={{ color: '#a78bfa' }} />
                  </Box>
                ) : filteredLibModels.length === 0 ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center', pt: 5 }}>
                    モデルが見つかりません
                  </Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                    {filteredLibModels.slice(0, 120).map(m => (
                      <LibraryCard key={m.id} model={m} isActive={pendingModel?.id === m.id} onAdd={handleLibAdd} />
                    ))}
                  </Box>
                )}
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', textAlign: 'center', mt: 1.5 }}>
                  ホバーして + ボタンでキャンバスに追加
                </Typography>
              </Box>
            </>
          ) : (
            /* ─── Projects tab ────────────────────────────────────────── */
            <>
              {selectedProject ? (
                /* Project selected: show its models */
                <>
                  {/* Back + project name header */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1, pt: 1, pb: 0.5, flexShrink: 0,
                  }}>
                    <IconButton
                      size="small"
                      onClick={() => { setSelectedProject(null); setProjectAssets([]); }}
                      sx={{ color: 'rgba(255,255,255,0.5)', p: 0.5, '&:hover': { color: '#fff' } }}
                    >
                      <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <Typography sx={{
                      fontSize: 11, fontWeight: 600, color: '#e2e8f0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {selectedProject.name}
                    </Typography>
                  </Box>

                  {/* Search */}
                  <Box sx={{ px: 1.5, pb: 0.75, flexShrink: 0 }}>
                    <Box sx={{ position: 'relative' }}>
                      <SearchRoundedIcon sx={{
                        position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 13, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none',
                      }} />
                      <input
                        value={libSearch}
                        onChange={e => setLibSearch(e.target.value)}
                        placeholder="モデルを検索..."
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 6, padding: '5px 8px 5px 25px', color: '#fff', fontSize: 11,
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                    {projectAssetsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 5 }}>
                        <CircularProgress size={20} sx={{ color: '#a78bfa' }} />
                      </Box>
                    ) : filteredLibModels.length === 0 ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center', pt: 5 }}>
                        モデルが見つかりません
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                        {filteredLibModels.slice(0, 120).map(m => (
                          <LibraryCard key={m.id} model={m} isActive={pendingModel?.id === m.id} onAdd={handleLibAdd} />
                        ))}
                      </Box>
                    )}
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', textAlign: 'center', mt: 1.5 }}>
                      ホバーして + ボタンでキャンバスに追加
                    </Typography>
                  </Box>
                </>
              ) : (
                /* Project list */
                <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                  {projectsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 5 }}>
                      <CircularProgress size={20} sx={{ color: '#a78bfa' }} />
                    </Box>
                  ) : !projects || projects.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, textAlign: 'center', pt: 5 }}>
                      プロジェクトが見つかりません
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {projects.map(proj => (
                        <Box
                          key={proj.id}
                          onClick={() => {
                            setSelectedProject({ id: proj.id, name: proj.name ?? proj.title ?? proj.id });
                            fetchProjectAssets(proj.id);
                            setLibSearch('');
                          }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.06)',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            '&:hover': { bgcolor: 'rgba(167,139,250,0.07)', borderColor: 'rgba(167,139,250,0.3)' },
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        >
                          {proj.coverThumbnailUrl ? (
                            <Box
                              component="img"
                              src={proj.coverThumbnailUrl}
                              sx={{ width: 32, height: 32, borderRadius: 0.75, objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <Box sx={{
                              width: 32, height: 32, borderRadius: 0.75, flexShrink: 0,
                              bgcolor: 'rgba(167,139,250,0.12)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <FolderRoundedIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
                            </Box>
                          )}
                          <Typography sx={{
                            fontSize: 11, color: '#e2e8f0', fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {proj.name ?? proj.title ?? proj.id}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Center: Split canvas — Top view (left) + 3D view (right) */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: Top-down orthographic view (interactive) */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            {/* View label */}
            <Box sx={{
              position: 'absolute', top: 8, left: 8, zIndex: 10,
              bgcolor: 'rgba(0,0,0,0.5)', px: 1, py: 0.25, borderRadius: 1,
              pointerEvents: 'none',
            }}>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Top</Typography>
            </Box>

            {/* Placement mode banner (spans top view width) */}
            {pendingModel && (
              <Box sx={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 20, bgcolor: 'rgba(167,139,250,0.92)', px: 2, py: 0.75,
                borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)', pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                <Typography sx={{ fontSize: 12, color: '#000', fontWeight: 600 }}>
                  クリックして「{pendingModel.title ?? pendingModel.name}」を配置
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
                  Esc でキャンセル
                </Typography>
              </Box>
            )}

            {/* Empty state hint */}
            {placedItems.length === 0 && !pendingModel && (
              <Box sx={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', zIndex: 4,
              }}>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.13)', mb: 0.5 }}>
                  ライブラリのモデルをホバーして + をクリック
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.08)' }}>
                  3Dキャンバス上でクリックした位置に配置されます
                </Typography>
              </Box>
            )}

            <SetFurnitureCanvas
              placedItems={placedItems}
              availableModels={modelsForCanvas}
              selectedId={selectedId}
              pendingModel={pendingModel}
              onPlaceAt={handlePlaceAt}
              onSelect={handleSelect}
              onMoveItem={handleMoveItem}
              onRotateItem={handleRotateItem}
            />
          </Box>

          {/* Right: Perspective 3D view (read-only) */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{
              position: 'absolute', top: 8, left: 8, zIndex: 10,
              bgcolor: 'rgba(0,0,0,0.5)', px: 1, py: 0.25, borderRadius: 1,
              pointerEvents: 'none',
            }}>
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>3D</Typography>
            </Box>
            <SetFurnitureCanvas3D
              placedItems={placedItems}
              availableModels={modelsForCanvas}
              selectedId={selectedId}
              onSelect={handleSelect}
              onMoveItem={handleMoveItem}
              onRotateItem={handleRotateItem}
            />
          </Box>

        </Box>

        {/* Right: Properties Panel */}
        <Box sx={{
          width: 220, flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column', bgcolor: '#0d1018',
        }}>
          <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              プロパティ
            </Typography>
          </Box>

          {selectedItem ? (
            <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'auto' }}>
              <Box sx={{ width: '100%', aspectRatio: '4/3', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1, overflow: 'hidden' }}>
                {selectedItem.thumbnailUrl
                  ? <img src={selectedItem.thumbnailUrl} alt={selectedItem.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon sx={{ color: 'rgba(255,255,255,0.12)', fontSize: 28 }} />
                    </Box>
                }
              </Box>

              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {selectedItem.title}
                </Typography>
              </Box>

              {/* Position — XYZ axes matching 3D view (Z-up) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  位置 (mm)
                </Typography>
                <PropFieldAxis
                  key={`x-${selectedId}`}
                  axis="X" axisColor="#ef4444" label="左右"
                  value={Math.round(selectedItem.x)}
                  onChange={v => handleUpdateProp('x', v)}
                />
                <PropFieldAxis
                  key={`y-${selectedId}`}
                  axis="Y" axisColor="#22c55e" label="前後"
                  value={Math.round(selectedItem.y)}
                  onChange={v => handleUpdateProp('y', v)}
                />
                <PropFieldAxis
                  key={`z-${selectedId}`}
                  axis="Z" axisColor="#3b82f6" label="上下"
                  value={Math.round(selectedItem.z ?? 0)}
                  onChange={v => handleUpdateProp('z', v)}
                />
              </Box>

              <PropField
                key={`r-${selectedId}`}
                label="回転 (°)"
                value={Math.round(selectedItem.rotation)}
                onChange={v => handleUpdateProp('rotation', v)}
              />

              <Button
                size="small"
                startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={handleDeleteSelected}
                sx={{
                  textTransform: 'none', fontSize: 11, mt: 0.5,
                  color: '#f87171', borderColor: 'rgba(248,113,113,0.2)',
                  border: '1px solid',
                  '&:hover': { bgcolor: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.4)' },
                }}
              >
                このモデルを削除
              </Button>
            </Box>
          ) : (
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', px: 2, py: 4,
            }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.7 }}>
                配置したモデルを選択すると<br />プロパティを編集できます
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ── PropFieldAxis — axis-colored XYZ input row ─────────────────────────────
const PropFieldAxis: React.FC<{
  axis: string; axisColor: string; label: string;
  value: number; onChange: (v: number) => void;
}> = ({ axis, axisColor, label, value, onChange }) => {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(n);
    else setLocal(String(value));
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {/* Axis badge */}
      <Box sx={{
        width: 18, height: 18, borderRadius: 0.5, flexShrink: 0,
        bgcolor: axisColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{axis}</Typography>
      </Box>
      {/* Label */}
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', width: 22, flexShrink: 0 }}>{label}</Typography>
      {/* Input */}
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        style={{
          flex: 1, minWidth: 0, boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 12,
          outline: 'none', fontFamily: 'inherit',
        }}
      />
    </Box>
  );
};

// ── PropField ──────────────────────────────────────────────────────────────
const PropField: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label, value, onChange,
}) => {
  const [local, setLocal] = useState(String(value));

  useEffect(() => { setLocal(String(value)); }, [value]);

  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(n);
    else setLocal(String(value));
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', mb: 0.3 }}>{label}</Typography>
      <input
        type="number"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4, padding: '5px 8px', color: '#fff', fontSize: 12,
          outline: 'none', fontFamily: 'inherit',
        }}
      />
    </Box>
  );
};

// ── SetFurnitureToolbar ────────────────────────────────────────────────────
const LINE = 'rgba(255,255,255,0.08)';
const BTN_SX = {
  width: 26, height: 26, borderRadius: 1,
  color: 'rgba(255,255,255,0.7)',
  border: `1px solid ${LINE}`,
  '&:hover': { bgcolor: 'rgba(124,58,237,0.28)', borderColor: 'rgba(124,58,237,0.5)' },
  '&.Mui-disabled': { opacity: 0.35, color: 'rgba(255,255,255,0.25)', borderColor: LINE },
  transition: 'all 0.15s ease',
} as const;
const ALIGN_BTN_SX = {
  ...BTN_SX,
  border: 'none',
  '&.Mui-disabled': { opacity: 0.3, color: 'rgba(255,255,255,0.2)' },
} as const;
const ICON_SX = { fontSize: 16 };

interface SetFurnitureToolbarProps {
  hasSelection: boolean;
  hasMultiple: boolean;
  rotateStepDeg: number;
  onRotateStepChange: (v: number) => void;
  onSnapFloor: () => void;
  onOnObject: () => void;
  onRotate: () => void;
  onAlign: (key: string) => void;
}

const SetFurnitureToolbar: React.FC<SetFurnitureToolbarProps> = ({
  hasSelection, hasMultiple,
  rotateStepDeg, onRotateStepChange,
  onSnapFloor, onOnObject, onRotate, onAlign,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const canAlign = hasSelection && hasMultiple;

  return (
    <Box sx={{
      height: 40, px: 2, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 0.5,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      bgcolor: '#131720',
    }}>

      {/* ── Snap / Position tools ── */}
      <Tooltip title="Snap Floor — 床面に配置" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onSnapFloor} sx={BTN_SX}>
            <VerticalAlignBottomRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="On Object — 直下オブジェクトの上面に配置" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onOnObject} sx={BTN_SX}>
            <LayersRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>

      {/* ── Rotate ── */}
      <Tooltip title="Rotate — 選択アイテムを回転" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!hasSelection} onClick={onRotate}
            sx={{ ...BTN_SX, ml: 0.5 }}>
            <RotateRightRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>

      {/* Rotate step dropdown */}
      <Button
        size="small"
        onClick={e => setMenuAnchor(e.currentTarget)}
        sx={{
          minWidth: 0, px: 0.75, height: 26,
          color: 'rgba(255,255,255,0.7)', fontSize: 12,
          border: `1px solid ${LINE}`, borderRadius: 1,
          '&:hover': { bgcolor: 'rgba(124,58,237,0.18)', borderColor: 'rgba(124,58,237,0.4)' },
          transition: 'all 0.15s ease',
        }}
      >
        {rotateStepDeg}°<ArrowDropDownRoundedIcon sx={{ fontSize: 14, ml: -0.25, verticalAlign: 'middle' }} />
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        MenuListProps={{ dense: true }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(22,22,30,0.98)', backgroundImage: 'none',
              border: `1px solid ${LINE}`,
            },
          },
        }}
      >
        {[15, 30, 45, 90].map(step => (
          <MenuItem
            key={step}
            selected={rotateStepDeg === step}
            onClick={() => { onRotateStepChange(step); setMenuAnchor(null); }}
            sx={{ fontSize: 13, minHeight: 'auto', color: '#e2e8f0',
              '&.Mui-selected': { bgcolor: 'rgba(124,58,237,0.2)', color: '#a78bfa' } }}
          >
            {step}°
          </MenuItem>
        ))}
      </Menu>

      <Divider orientation="vertical" flexItem
        sx={{ mx: 0.75, my: 0.75, borderColor: 'rgba(255,255,255,0.15)' }} />

      {/* ── Align tools ── */}
      <Tooltip title="Align Top (AT)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AT')} sx={ALIGN_BTN_SX}>
            <VerticalAlignTopRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Align Bottom (AB)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AB')} sx={ALIGN_BTN_SX}>
            <VerticalAlignBottomRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Align Left (AL)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AL')} sx={ALIGN_BTN_SX}>
            <AlignHorizontalLeftRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Align Right (AR)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AR')} sx={ALIGN_BTN_SX}>
            <AlignHorizontalRightRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Align Horizontal Center (AH)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AH')} sx={ALIGN_BTN_SX}>
            <AlignHorizontalCenterRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Align Vertical Center (AV)" arrow placement="bottom">
        <span>
          <IconButton size="small" disabled={!canAlign} onClick={() => onAlign('AV')} sx={ALIGN_BTN_SX}>
            <AlignVerticalCenterRoundedIcon sx={ICON_SX} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

// ── LibraryCard ────────────────────────────────────────────────────────────
const LibraryCard: React.FC<{
  model: any;
  isActive?: boolean;
  onAdd: (model: any) => void;
}> = ({ model, isActive = false, onAdd }) => {
  const [hovered, setHovered] = useState(false);
  const highlighted = hovered || isActive;
  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        borderRadius: 1, overflow: 'hidden', cursor: 'default',
        border: `1px solid ${isActive ? '#a78bfa' : highlighted ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}`,
        bgcolor: isActive ? 'rgba(167,139,250,0.12)' : highlighted ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
        transition: 'border-color 0.15s, background-color 0.15s',
        position: 'relative',
        boxShadow: isActive ? '0 0 0 2px rgba(167,139,250,0.3)' : 'none',
      }}
    >
      <Box sx={{ width: '100%', aspectRatio: '1', bgcolor: 'rgba(0,0,0,0.3)', position: 'relative' }}>
        {(model.thumbnailUrl ?? model.thumbnail)
          ? <img
              src={model.thumbnailUrl ?? model.thumbnail}
              alt={model.title ?? model.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              draggable={false}
            />
          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon sx={{ color: 'rgba(255,255,255,0.1)', fontSize: 20 }} />
            </Box>
        }
        {hovered && (
          <Box
            onClick={() => onAdd(model)}
            sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(10,10,20,0.45)',
              cursor: 'pointer',
            }}
          >
            <Box sx={{
              width: 32, height: 32, borderRadius: '50%',
              bgcolor: '#a78bfa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'transform 0.1s',
              '&:hover': { transform: 'scale(1.12)' },
            }}>
              <AddRoundedIcon sx={{ fontSize: 18, color: '#000' }} />
            </Box>
          </Box>
        )}
      </Box>
      <Box sx={{ px: 0.75, py: 0.5 }}>
        <Typography sx={{ fontSize: 10, color: '#b0bec5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {model.title ?? model.name ?? 'Untitled'}
        </Typography>
      </Box>
    </Box>
  );
};
