import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress, IconButton, Dialog,
  TextField, Chip, Avatar, Divider, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import ImageIcon from '@mui/icons-material/Image';
import CategoryIcon from '@mui/icons-material/Category';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  SetFurnitureEditor,
  DEFAULT_SET_PLACEMENT_RULE,
  SET_RELATION_OPTIONS,
  SET_FRONT_DIRECTIONS,
  SET_ROTATION_OPTIONS,
} from './SetFurnitureEditor';
import type { PlacedItem, ModelSetWithId, SetPlacementRule } from './SetFurnitureEditor';
import {
  LAYOUT_CATEGORIES,
} from '../../dsl/layout/constants/furnitureCategoryDefaults';

const ACCENT = '#a78bfa';
const LINE = 'rgb(var(--brand-fg-rgb) / 0.08)';
const BG_SIDEBAR = '#111118';

const OFFICIAL_EMAILS = ['s.sekkeiya@gmail.com'];

type SubTab = 'official' | 'my';

interface ModelSetDoc {
  title: string;
  ownerId: string;
  projectId?: string | null;
  visibility: 'public' | 'private';
  companionModels: { id: string; title: string; thumbnailUrl?: string }[];
  placedItems?: PlacedItem[];
  isOfficial?: boolean;
  adoptionCount?: number;
  rejectionCount?: number;
  buildingType?: string;
  zonePurposes?: string[];
  styleTags?: string[];
  minAreaSqm?: number;
  maxAreaSqm?: number;
  priority?: number;
  createdAt: string;
  updatedAt?: string;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; set: ModelSetWithId };

interface DssSetFurnitureGridProps {
  items?: any[];
  canCreate?: boolean;
}

// ── ゾーン用途 & スタイルタグ定義 ────────────────────────────────────────────

export const ZONE_PURPOSES = [
  { key: 'living',   label: 'リビング',    icon: '🛋️' },
  { key: 'bedroom',  label: '寝室',        icon: '🛏️' },
  { key: 'dining',   label: 'ダイニング',  icon: '🍽️' },
  { key: 'study',    label: '書斎',        icon: '💻' },
  { key: 'kitchen',  label: 'キッチン',    icon: '🍳' },
  { key: 'entrance', label: '玄関',        icon: '🚪' },
  { key: 'seating',  label: '客席',        icon: '🪑' },
  { key: 'meeting',  label: '会議室',      icon: '📋' },
  { key: 'desk',     label: '執務エリア',  icon: '🖥️' },
  { key: 'outdoor',  label: '屋外・テラス', icon: '☀️' },
  { key: 'general',  label: '汎用',        icon: '📐' },
] as const;

export const STYLE_TAGS = [
  { key: 'modern',     label: 'モダン' },
  { key: 'nordic',     label: '北欧' },
  { key: 'japandi',    label: 'ジャパンディ' },
  { key: 'industrial', label: 'インダストリアル' },
  { key: 'minimal',    label: 'ミニマル' },
  { key: 'luxury',     label: 'ラグジュアリー' },
  { key: 'natural',    label: 'ナチュラル' },
  { key: 'retro',      label: 'レトロ' },
  { key: 'bohemian',   label: 'ボヘミアン' },
  { key: 'classical',  label: 'クラシック' },
] as const;

const BUILDING_TYPE_OPTIONS = [
  { key: 'residential', label: '住宅' },
  { key: 'office',      label: 'オフィス' },
  { key: 'cafe',        label: 'カフェ' },
  { key: 'hotel',       label: 'ホテル' },
] as const;

// ── 採用率ヘルパー ────────────────────────────────────────────────────────────

function adoptionRate(set: ModelSetWithId): number | null {
  const total = (set.adoptionCount ?? 0) + (set.rejectionCount ?? 0);
  if (total === 0) return null;
  return Math.round(((set.adoptionCount ?? 0) / total) * 100);
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export const DssSetFurnitureGrid: React.FC<DssSetFurnitureGridProps> = ({
  items = [],
  canCreate = false,
}) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const isOfficialAccount = OFFICIAL_EMAILS.includes(currentUser?.email ?? '');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('official');
  const [mySets, setMySets] = useState<ModelSetWithId[]>([]);
  const [officialSets, setOfficialSets] = useState<ModelSetWithId[]>([]);
  const [isLoadingMy, setIsLoadingMy] = useState(false);
  const [isLoadingOfficial, setIsLoadingOfficial] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const displaySets = activeSubTab === 'official' ? officialSets : mySets;
  const isLoading = activeSubTab === 'official' ? isLoadingOfficial : isLoadingMy;
  const selectedSet = useMemo(() => displaySets.find(s => s.id === selectedSetId) ?? null, [displaySets, selectedSetId]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    fetchMySets();
    fetchOfficialSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  useEffect(() => {
    if (selectedSetId && !displaySets.find(s => s.id === selectedSetId)) {
      setSelectedSetId(null);
    }
  }, [displaySets, selectedSetId]);

  const fetchMySets = async () => {
    setIsLoadingMy(true);
    try {
      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const q = query(
        collection(db, 'modelSets'),
        where('ownerId', '==', currentUser!.uid),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as ModelSetDoc) } as ModelSetWithId));
      setMySets(all.filter(s => !s.isOfficial));
    } catch (e) {
      console.error('[DssSetFurnitureGrid] fetchMySets error:', e);
    } finally {
      setIsLoadingMy(false);
    }
  };

  const fetchOfficialSets = async () => {
    setIsLoadingOfficial(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      // Firestore ルールは「public または自分がオーナー」の読み取りのみ許可しているため、
      // isOfficial 単独のクエリは権限エラーになる。ルール準拠の2クエリに分割してマージする。
      const publicQ = query(
        collection(db, 'modelSets'),
        where('isOfficial', '==', true),
        where('visibility', '==', 'public'),
      );
      const queries = [getDocs(publicQ)];
      if (currentUser?.uid) {
        // 自分がオーナーの公式セット（非公開ドラフト含む）
        const ownQ = query(
          collection(db, 'modelSets'),
          where('isOfficial', '==', true),
          where('ownerId', '==', currentUser.uid),
        );
        queries.push(getDocs(ownQ));
      }
      const snaps = await Promise.all(queries);
      const byId = new Map<string, ModelSetWithId>();
      for (const snap of snaps) {
        snap.docs.forEach(d => byId.set(d.id, { id: d.id, ...(d.data() as ModelSetDoc) } as ModelSetWithId));
      }
      const sets = Array.from(byId.values());
      sets.sort((a, b) => (b.adoptionCount ?? 0) - (a.adoptionCount ?? 0));
      setOfficialSets(sets);
    } catch (e) {
      console.error('[DssSetFurnitureGrid] fetchOfficialSets error:', e);
    } finally {
      setIsLoadingOfficial(false);
    }
  };

  const handleSaved = (saved: ModelSetWithId) => {
    if (saved.isOfficial) {
      setOfficialSets(prev => {
        const idx = prev.findIndex(s => s.id === saved.id);
        const next = idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev];
        return next.sort((a, b) => (b.adoptionCount ?? 0) - (a.adoptionCount ?? 0));
      });
    } else {
      setMySets(prev => {
        const idx = prev.findIndex(s => s.id === saved.id);
        return idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev];
      });
    }
    setEditorState(null);
    setSelectedSetId(saved.id);
  };

  const handleSidebarSaved = (saved: ModelSetWithId) => {
    setMySets(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : prev;
    });
  };

  const handleDelete = async (setId: string) => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(db, 'modelSets', setId));
      if (activeSubTab === 'official') {
        setOfficialSets(prev => prev.filter(s => s.id !== setId));
      } else {
        setMySets(prev => prev.filter(s => s.id !== setId));
      }
    } catch (e) {
      console.error('[DssSetFurnitureGrid] delete error:', e);
    }
  };

  const handleSubTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    setSelectedSetId(null);
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
            bgcolor: 'var(--brand-surface)', overflow: 'hidden',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            borderRadius: 2,
          },
        }}
      >
        {editorState && (
          <SetFurnitureEditor
            availableModels={items}
            currentUser={currentUser}
            projectId={null}
            initialTitle={editorState.mode === 'edit' ? editorState.set.title : ''}
            initialVisibility={editorState.mode === 'edit' ? editorState.set.visibility : (activeSubTab === 'official' ? 'public' : 'private')}
            initialBuildingType={editorState.mode === 'edit' ? (editorState.set.buildingType ?? 'residential') : 'residential'}
            initialPlacedItems={editorState.mode === 'edit' ? (editorState.set.placedItems ?? []) : []}
            initialPlacementRule={editorState.mode === 'edit' ? editorState.set.placementRule : undefined}
            existingSetId={editorState.mode === 'edit' ? editorState.set.id : undefined}
            initialIsOfficial={editorState.mode === 'edit'
              ? (editorState.set.isOfficial ?? false)
              : (activeSubTab === 'official' && isOfficialAccount)}
            onBack={() => setEditorState(null)}
            onSaved={handleSaved}
          />
        )}
      </Dialog>

      {/* Main layout: grid + sidebar */}
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── 左: グリッドエリア ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

          {/* ── サブタブヘッダー ── */}
          <Box sx={{
            px: 1.5, pt: 1.25, pb: 0,
            borderBottom: `1px solid ${LINE}`, flexShrink: 0,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', gap: 0 }}>
              {([
                { key: 'official', label: '公式セット', icon: <StarRoundedIcon sx={{ fontSize: 12 }} /> },
                { key: 'my',       label: 'マイセット',  icon: <LayersRoundedIcon sx={{ fontSize: 12 }} /> },
              ] as const).map(t => (
                <Box
                  key={t.key}
                  onClick={() => handleSubTabChange(t.key)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.5, pb: 0.85, pt: 0.5,
                    cursor: 'pointer', userSelect: 'none',
                    borderBottom: activeSubTab === t.key
                      ? `2px solid ${ACCENT}`
                      : '2px solid transparent',
                    color: activeSubTab === t.key ? 'var(--brand-fg)' : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                    fontSize: 12, fontWeight: activeSubTab === t.key ? 700 : 500,
                    transition: 'color 0.15s, border-color 0.15s',
                    '&:hover': { color: activeSubTab === t.key ? 'var(--brand-fg)' : "color-mix(in srgb, var(--brand-fg) 70%, transparent)" },
                  }}
                >
                  {t.icon}
                  {t.label}
                  <Box sx={{
                    ml: 0.25, px: 0.6, py: 0.1, borderRadius: 10, fontSize: 9.5,
                    bgcolor: activeSubTab === t.key ? alpha(ACCENT, 0.2) : alpha('#fff', 0.06),
                    color: activeSubTab === t.key ? alpha(ACCENT, 0.9) : alpha('#fff', 0.3),
                  }}>
                    {t.key === 'official' ? officialSets.length : mySets.length}
                  </Box>
                </Box>
              ))}
            </Box>

            {((activeSubTab === 'my' && canCreate) || (activeSubTab === 'official' && isOfficialAccount)) && (
              <Box sx={{ pb: 0.75 }}>
                <Button
                  size="small" variant="contained"
                  startIcon={<AddRoundedIcon sx={{ fontSize: 13 }} />}
                  onClick={() => setEditorState({ mode: 'create' })}
                  sx={{
                    textTransform: 'none', fontSize: 11, height: 26, px: 1.25,
                    bgcolor: activeSubTab === 'official' ? '#fbbf24' : ACCENT,
                    color: '#000', fontWeight: 700,
                    '&:hover': { bgcolor: activeSubTab === 'official' ? '#f59e0b' : '#9061f9' },
                  }}
                >
                  {activeSubTab === 'official' ? '公式セットを作成' : 'セットを作成'}
                </Button>
              </Box>
            )}
          </Box>

          {/* サブタブ説明 */}
          <Box sx={{ px: 1.75, py: 0.75, bgcolor: alpha('#fff', 0.02), borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
            {activeSubTab === 'official' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <TrendingUpRoundedIcon sx={{ fontSize: 12, color: 'light-dark(rgba(170,124,3,0.7), rgba(251,191,36,0.7))' }} />
                <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.4 }}>
                  採用回数順に表示。Auto Layout が自動選択します。
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.4 }}>
                自分が登録したセット。建物タイプ・ゾーン用途を設定すると Auto Layout の精度が上がります。
              </Typography>
            )}
          </Box>

          {/* Card grid */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={22} sx={{ color: ACCENT }} />
              </Box>
            ) : displaySets.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
                {activeSubTab === 'official' ? (
                  <>
                    <StarRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>公式セットはまだありません</Typography>
                  </>
                ) : (
                  <>
                    <CategoryIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.06)' }} />
                    <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>マイセットが登録されていません</Typography>
                    {canCreate && (
                      <Button
                        variant="outlined" size="small"
                        onClick={() => setEditorState({ mode: 'create' })}
                        sx={{
                          textTransform: 'none', fontSize: 11,
                          borderColor: alpha(ACCENT, 0.3), color: ACCENT,
                          '&:hover': { borderColor: ACCENT, bgcolor: alpha(ACCENT, 0.05) },
                        }}
                      >
                        最初のセットを作成
                      </Button>
                    )}
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.25 }}>
                {displaySets.map(set => (
                  <SetFurnitureCard
                    key={set.id}
                    set={set}
                    isOfficial={activeSubTab === 'official'}
                    canEdit={(activeSubTab === 'my' && canCreate) || (activeSubTab === 'official' && isOfficialAccount)}
                    isSelected={selectedSetId === set.id}
                    onClick={() => setSelectedSetId(prev => prev === set.id ? null : set.id)}
                    onEdit={() => setEditorState({ mode: 'edit', set })}
                    onDelete={() => handleDelete(set.id)}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* ── 右: 詳細サイドバー ── */}
        {selectedSet && (
          <>
            <Divider orientation="vertical" flexItem sx={{ borderColor: LINE }} />
            <SetDetailSidebar
              set={selectedSet}
              canEdit={(activeSubTab === 'my' && canCreate) || (activeSubTab === 'official' && isOfficialAccount)}
              isOfficial={activeSubTab === 'official'}
              onClose={() => setSelectedSetId(null)}
              onOpenEditor={() => setEditorState({ mode: 'edit', set: selectedSet })}
              onSaved={handleSidebarSaved}
              onDelete={() => { handleDelete(selectedSet.id); setSelectedSetId(null); }}
            />
          </>
        )}
      </Box>
    </>
  );
};

// ── SetFurnitureCard ────────────────────────────────────────────────────────────

const SetFurnitureCard: React.FC<{
  set: ModelSetWithId;
  isOfficial: boolean;
  canEdit: boolean;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ set, isOfficial, canEdit, isSelected, onClick, onEdit, onDelete }) => {
  const rate = adoptionRate(set);
  const zonePurposeIcons = (set.zonePurposes ?? [])
    .map(k => ZONE_PURPOSES.find(z => z.key === k))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: isSelected ? alpha(ACCENT, 0.1) : alpha(ACCENT, 0.03),
        border: `1.5px solid ${isSelected ? alpha(ACCENT, 0.55) : alpha(ACCENT, 0.1)}`,
        borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        boxShadow: isSelected ? `0 0 0 1px ${alpha(ACCENT, 0.2)}` : 'none',
        '&:hover': { borderColor: alpha(ACCENT, 0.35), bgcolor: alpha(ACCENT, 0.06) },
      }}
    >
      {/* Mosaic thumbnail */}
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', bgcolor: 'light-dark(rgba(15,23,42,0.09), rgba(0,0,0,0.28))', display: 'flex', flexWrap: 'wrap', gap: '2px', p: '4px' }}>
        {set.companionModels.length > 0 ? (
          set.companionModels.slice(0, 4).map((cm, i) => (
            <Box key={i} sx={{ width: 'calc(50% - 1px)', height: 'calc(50% - 1px)', borderRadius: '3px', overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))' }}>
              {cm.thumbnailUrl
                ? <img src={cm.thumbnailUrl} alt={cm.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                  </Box>
              }
            </Box>
          ))
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CategoryIcon sx={{ fontSize: 30, color: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />
          </Box>
        )}

        {/* 採用率バッジ（公式セット） */}
        {isOfficial && rate !== null && (
          <Box sx={{
            position: 'absolute', top: 5, right: 5,
            display: 'flex', alignItems: 'center', gap: 0.3,
            px: 0.6, py: 0.2, borderRadius: 1,
            bgcolor: rate >= 70 ? alpha('#4ade80', 0.85) : rate >= 40 ? alpha('#fbbf24', 0.85) : alpha('#f87171', 0.85),
            backdropFilter: 'blur(4px)',
          }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 9, color: '#000' }} />
            <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#000', lineHeight: 1 }}>{rate}%</Typography>
          </Box>
        )}

        {/* 公式バッジ */}
        {isOfficial && (
          <Box sx={{
            position: 'absolute', top: 5, left: 5,
            display: 'flex', alignItems: 'center', gap: 0.25,
            px: 0.55, py: 0.2, borderRadius: 0.75,
            bgcolor: alpha('#fbbf24', 0.9),
          }}>
            <StarRoundedIcon sx={{ fontSize: 9, color: '#000' }} />
            <Typography sx={{ fontSize: 8.5, fontWeight: 800, color: '#000', lineHeight: 1 }}>公式</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.1, py: 0.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: isSelected ? 'var(--brand-fg)' : 'var(--brand-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
              {set.title}
            </Typography>
            <Typography sx={{ fontSize: 10, color: isSelected ? alpha(ACCENT, 0.7) : 'text.secondary', mt: 0.15, lineHeight: 1.2 }}>
              {set.companionModels.length} モデル
              {set.buildingType && ` · ${buildingTypeLabel(set.buildingType)}`}
            </Typography>
          </Box>
          {canEdit && (
            <Box sx={{ display: 'flex', gap: 0.15, flexShrink: 0 }}>
              <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(); }} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.22)', p: 0.35, '&:hover': { color: ACCENT, bgcolor: alpha(ACCENT, 0.1) } }}>
                <EditRoundedIcon sx={{ fontSize: 11 }} />
              </IconButton>
              <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(); }} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.22)', p: 0.35, '&:hover': { color: '#ef4444', bgcolor: alpha('#ef4444', 0.1) } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* ゾーン用途アイコン */}
        {zonePurposeIcons.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.3, mt: 0.6, flexWrap: 'wrap' }}>
            {zonePurposeIcons.map(z => z && (
              <Box key={z.key} sx={{
                display: 'flex', alignItems: 'center', gap: 0.25,
                px: 0.5, py: 0.15, borderRadius: 0.75, fontSize: 9.5,
                bgcolor: alpha('#3b82f6', 0.12),
                color: 'light-dark(rgba(3,82,170,0.85), rgba(147,197,253,0.85))',
                border: `1px solid ${alpha('#3b82f6', 0.2)}`,
              }}>
                <span style={{ fontSize: 9 }}>{z.icon}</span>
                <span>{z.label}</span>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ── SetDetailSidebar ────────────────────────────────────────────────────────────

interface SetDetailSidebarProps {
  set: ModelSetWithId;
  canEdit: boolean;
  isOfficial: boolean;
  onClose: () => void;
  onOpenEditor: () => void;
  onSaved: (saved: ModelSetWithId) => void;
  onDelete: () => void;
}

const SetDetailSidebar: React.FC<SetDetailSidebarProps> = ({
  set, canEdit, isOfficial, onClose, onOpenEditor, onSaved, onDelete,
}) => {
  const [editTitle,     setEditTitle]     = useState(set.title);
  const [companions,    setCompanions]    = useState(set.companionModels);
  const [buildingType,  setBuildingType]  = useState(set.buildingType ?? '');
  const [zonePurposes,  setZonePurposes]  = useState<string[]>(set.zonePurposes ?? []);
  const [minAreaSqm,    setMinAreaSqm]    = useState<string>(set.minAreaSqm != null ? String(set.minAreaSqm) : '');
  const [maxAreaSqm,    setMaxAreaSqm]    = useState<string>(set.maxAreaSqm != null ? String(set.maxAreaSqm) : '');
  const [priority,      setPriority]      = useState<string>(String(set.priority ?? 50));
  const [styleTags,     setStyleTags]     = useState<string[]>(set.styleTags ?? []);
  const [placementRule, setPlacementRule] = useState<SetPlacementRule>(set.placementRule ?? { ...DEFAULT_SET_PLACEMENT_RULE });
  const [saving,        setSaving]        = useState(false);
  const [savedFlash,    setSavedFlash]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandSection, setExpandSection] = useState<Record<string, boolean>>({
    matching: true, placement: true, style: false, models: true,
  });

  useEffect(() => {
    setEditTitle(set.title);
    setCompanions(set.companionModels);
    setBuildingType(set.buildingType ?? '');
    setZonePurposes(set.zonePurposes ?? []);
    setMinAreaSqm(set.minAreaSqm != null ? String(set.minAreaSqm) : '');
    setMaxAreaSqm(set.maxAreaSqm != null ? String(set.maxAreaSqm) : '');
    setPriority(String(set.priority ?? 50));
    setStyleTags(set.styleTags ?? []);
    setPlacementRule(set.placementRule ?? { ...DEFAULT_SET_PLACEMENT_RULE });
    setSavedFlash(false);
    setConfirmDelete(false);
  }, [set.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRule = <K extends keyof SetPlacementRule>(key: K, value: SetPlacementRule[K]) =>
    setPlacementRule(prev => ({ ...prev, [key]: value }));

  const isDirty = (
    editTitle     !== set.title ||
    buildingType  !== (set.buildingType ?? '') ||
    JSON.stringify(zonePurposes) !== JSON.stringify(set.zonePurposes ?? []) ||
    minAreaSqm    !== (set.minAreaSqm != null ? String(set.minAreaSqm) : '') ||
    maxAreaSqm    !== (set.maxAreaSqm != null ? String(set.maxAreaSqm) : '') ||
    priority      !== String(set.priority ?? 50) ||
    JSON.stringify(styleTags) !== JSON.stringify(set.styleTags ?? []) ||
    JSON.stringify(placementRule) !== JSON.stringify(set.placementRule ?? DEFAULT_SET_PLACEMENT_RULE) ||
    companions.length !== set.companionModels.length
  );

  const toggleZonePurpose = (key: string) =>
    setZonePurposes(prev => prev.includes(key) ? prev.filter(z => z !== key) : [...prev, key]);

  const toggleStyleTag = (key: string) =>
    setStyleTags(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]);

  const handleRemoveCompanion = useCallback((id: string) =>
    setCompanions(prev => prev.filter(c => c.id !== id)), []);

  const handleCompanionLayoutCategory = useCallback((id: string, lc: string) =>
    setCompanions(prev => prev.map(c => c.id === id ? { ...c, layoutCategory: lc || undefined } : c)), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');

      const updated: ModelSetWithId = {
        ...set,
        title:        editTitle.trim() || set.title,
        companionModels: companions,
        buildingType: buildingType || undefined,
        zonePurposes: zonePurposes.length > 0 ? zonePurposes : undefined,
        minAreaSqm:   minAreaSqm ? Number(minAreaSqm) : undefined,
        maxAreaSqm:   maxAreaSqm ? Number(maxAreaSqm) : undefined,
        priority:     Number(priority),
        styleTags:    styleTags.length > 0 ? styleTags : undefined,
        placementRule,
        updatedAt:    new Date().toISOString(),
      };

      await updateDoc(doc(db, 'modelSets', set.id), {
        title:           updated.title,
        companionModels: updated.companionModels,
        buildingType:    updated.buildingType  ?? null,
        zonePurposes:    updated.zonePurposes  ?? [],
        minAreaSqm:      updated.minAreaSqm    ?? null,
        maxAreaSqm:      updated.maxAreaSqm    ?? null,
        priority:        updated.priority,
        styleTags:       updated.styleTags     ?? [],
        placementRule:   { ...placementRule, maxCount: placementRule.maxCount ?? null },
        updatedAt:       serverTimestamp(),
      });
      onSaved(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      console.error('[SetDetailSidebar] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const SIDEBAR_WIDTH = 300;

  const SectionHeader = ({ id, label, hint }: { id: string; label: string; hint?: string }) => (
    <Box
      onClick={() => setExpandSection(prev => ({ ...prev, [id]: !prev[id] }))}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.5, py: 0.8, cursor: 'pointer',
        borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`,
        bgcolor: alpha('#fff', 0.02),
        '&:hover': { bgcolor: alpha('#fff', 0.04) },
      }}
    >
      <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: alpha(ACCENT, 0.75), flex: 1, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      {hint && <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 28%, transparent)" }}>{hint}</Typography>}
      <Box sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", transform: expandSection[id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', lineHeight: 1 }}>▼</Box>
    </Box>
  );

  const rate = adoptionRate(set);

  return (
    <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', bgcolor: BG_SIDEBAR, overflow: 'hidden' }}>
      {/* ── ヘッダー ── */}
      <Box sx={{ px: 1.5, py: 1.1, flexShrink: 0, borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        {isOfficial
          ? <StarRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#aa7c03, #fbbf24)', flexShrink: 0 }} />
          : <LayersRoundedIcon sx={{ fontSize: 14, color: alpha(ACCENT, 0.7), flexShrink: 0 }} />
        }
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)", flex: 1 }}>
          {isOfficial ? '公式セット詳細' : 'セット詳細'}
        </Typography>
        {isOfficial && rate !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.2, borderRadius: 1, bgcolor: alpha('#4ade80', 0.12), border: `1px solid ${alpha('#4ade80', 0.25)}` }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 10, color: '#4ade80' }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>採用率 {rate}%</Typography>
          </Box>
        )}
        <Tooltip title="閉じる">
          <IconButton size="small" onClick={onClose} sx={{ color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", '&:hover': { color: 'var(--brand-fg)' }, p: 0.4 }}>
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── 採用統計（公式セットのみ） ── */}
      {isOfficial && (set.adoptionCount || set.rejectionCount) && (
        <Box sx={{ px: 1.5, py: 0.9, borderBottom: `1px solid ${LINE}`, display: 'flex', gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{set.adoptionCount ?? 0}</Typography>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", mt: 0.2 }}>採用</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'light-dark(#a50808, #f87171)', lineHeight: 1 }}>{set.rejectionCount ?? 0}</Typography>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", mt: 0.2 }}>却下</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          {rate !== null && (
            <Box sx={{ alignSelf: 'center' }}>
              <Box sx={{ width: 80, height: 4, bgcolor: alpha('#fff', 0.08), borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${rate}%`, bgcolor: rate >= 70 ? '#4ade80' : rate >= 40 ? '#fbbf24' : '#f87171', borderRadius: 2 }} />
              </Box>
              <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", mt: 0.3, textAlign: 'right' }}>採用率</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── スクロールエリア ── */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {/* セット名 */}
        <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
          <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            セット名
          </Typography>
          <TextField
            fullWidth size="small"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            disabled={!canEdit}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600,
                '& fieldset': { borderColor: alpha('#fff', 0.12) },
                '&:hover fieldset': { borderColor: canEdit ? alpha('#fff', 0.28) : alpha('#fff', 0.12) },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
              '& input': { py: '6px' },
            }}
          />
        </Box>

        {/* ══ マッチング条件 ══ */}
        <SectionHeader id="matching" label="マッチング条件" hint="Auto Layout で使用" />
        {expandSection.matching && (
          <Box sx={{ px: 1.5, py: 1.1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* 建物タイプ */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>建物タイプ</Typography>
              <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                {[{ key: '', label: 'すべて' }, ...BUILDING_TYPE_OPTIONS].map(bt => (
                  <Box key={bt.key} onClick={() => canEdit && setBuildingType(buildingType === bt.key ? '' : bt.key)}
                    sx={{
                      px: 0.85, py: 0.3, borderRadius: 1, cursor: canEdit ? 'pointer' : 'default',
                      fontSize: 10.5, fontWeight: 600,
                      bgcolor: buildingType === bt.key ? alpha(ACCENT, 0.18) : alpha('#fff', 0.05),
                      color: buildingType === bt.key ? ACCENT : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                      border: `1px solid ${buildingType === bt.key ? alpha(ACCENT, 0.35) : alpha('#fff', 0.08)}`,
                      transition: 'all 0.12s',
                    }}
                  >{bt.label}</Box>
                ))}
              </Box>
            </Box>

            {/* ゾーン用途 */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>ゾーン用途</Typography>
              <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                {ZONE_PURPOSES.map(zp => {
                  const active = zonePurposes.includes(zp.key);
                  return (
                    <Box key={zp.key} onClick={() => canEdit && toggleZonePurpose(zp.key)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.3,
                        px: 0.7, py: 0.3, borderRadius: 1, cursor: canEdit ? 'pointer' : 'default',
                        fontSize: 10, fontWeight: active ? 700 : 400,
                        bgcolor: active ? alpha('#3b82f6', 0.18) : alpha('#fff', 0.04),
                        color: active ? 'light-dark(#0352aa, #93c5fd)' : "color-mix(in srgb, var(--brand-fg) 38%, transparent)",
                        border: `1px solid ${active ? alpha('#3b82f6', 0.35) : alpha('#fff', 0.07)}`,
                        transition: 'all 0.12s', userSelect: 'none',
                      }}
                    >
                      <span style={{ fontSize: 10 }}>{zp.icon}</span>{zp.label}
                    </Box>
                  );
                })}
              </Box>
              <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)", mt: 0.4 }}>未選択 = 用途不問</Typography>
            </Box>

            {/* 面積レンジ */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>適用面積（㎡）</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <TextField size="small" placeholder="最小" value={minAreaSqm}
                  onChange={e => setMinAreaSqm(e.target.value.replace(/[^0-9.]/g, ''))}
                  disabled={!canEdit} inputProps={{ type: 'number', min: 0 }}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '4px', textAlign: 'center' } }}
                />
                <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }}>〜</Typography>
                <TextField size="small" placeholder="最大" value={maxAreaSqm}
                  onChange={e => setMaxAreaSqm(e.target.value.replace(/[^0-9.]/g, ''))}
                  disabled={!canEdit} inputProps={{ type: 'number', min: 0 }}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '4px', textAlign: 'center' } }}
                />
                <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }}>㎡</Typography>
              </Box>
            </Box>

            {/* 優先度 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", letterSpacing: '0.04em', textTransform: 'uppercase' }}>優先度</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <TextField size="small" value={priority}
                    onChange={e => setPriority(String(Math.max(0, Math.min(100, Number(e.target.value.replace(/[^0-9]/g, '') || '50')))))}
                    disabled={!canEdit} inputProps={{ type: 'number', min: 0, max: 100 }}
                    sx={{ width: 52, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '3px', textAlign: 'center' } }}
                  />
                  <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 28%, transparent)" }}>/100</Typography>
                </Box>
              </Box>
              <Box sx={{ height: 3, bgcolor: alpha('#fff', 0.07), borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, Number(priority) || 0))}%`, bgcolor: ACCENT, transition: 'width 0.2s' }} />
              </Box>
              <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)", mt: 0.35 }}>複数マッチ時、高い順に選択（0〜100）</Typography>
            </Box>
          </Box>
        )}

        {/* ══ 配置ルール ══ */}
        <SectionHeader id="placement" label="配置ルール" hint="セットの置き方を定義" />
        {expandSection.placement && (
          <Box sx={{ px: 1.5, py: 1.1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* 配置関係 */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>配置関係</Typography>
              <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                {SET_RELATION_OPTIONS.map(opt => {
                  const active = placementRule.relation === opt.key;
                  return (
                    <Tooltip key={opt.key} title={opt.hint} arrow placement="top">
                      <Box onClick={() => canEdit && updateRule('relation', opt.key)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.3,
                          px: 0.75, py: 0.3, borderRadius: 1, cursor: canEdit ? 'pointer' : 'default',
                          fontSize: 10.5, fontWeight: active ? 700 : 400, userSelect: 'none',
                          bgcolor: active ? alpha(ACCENT, 0.18) : alpha('#fff', 0.05),
                          color: active ? ACCENT : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                          border: `1px solid ${active ? alpha(ACCENT, 0.35) : alpha('#fff', 0.08)}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        <span style={{ fontSize: 10 }}>{opt.icon}</span>{opt.label}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>

            {/* 正面方向 */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>正面方向（TOPビュー基準）</Typography>
              <Box sx={{ display: 'flex', gap: 0.4 }}>
                {SET_FRONT_DIRECTIONS.map(dir => {
                  const active = placementRule.frontDirectionDeg === dir.deg;
                  return (
                    <Box key={dir.deg} onClick={() => canEdit && updateRule('frontDirectionDeg', dir.deg)}
                      sx={{
                        flex: 1, textAlign: 'center', py: 0.45, borderRadius: 1,
                        cursor: canEdit ? 'pointer' : 'default', userSelect: 'none',
                        bgcolor: active ? alpha('#38bdf8', 0.18) : alpha('#fff', 0.04),
                        color: active ? 'light-dark(#0676a8, #38bdf8)' : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                        border: `1px solid ${active ? alpha('#38bdf8', 0.4) : alpha('#fff', 0.07)}`,
                        transition: 'all 0.12s',
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{dir.arrow}</Typography>
                      <Typography sx={{ fontSize: 8, lineHeight: 1.3 }}>{dir.label}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* クリアランス */}
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>前方スペース</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <TextField size="small" value={String(placementRule.frontClearanceMm)}
                    onChange={e => canEdit && updateRule('frontClearanceMm', Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '') || '0')))}
                    disabled={!canEdit} inputProps={{ type: 'number', min: 0 }}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '4px', textAlign: 'center' } }}
                  />
                  <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }}>mm</Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1, opacity: (placementRule.relation === 'against_wall' || placementRule.relation === 'corner') ? 1 : 0.4 }}>
                <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>壁マージン</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <TextField size="small" value={String(placementRule.marginFromWallMm)}
                    onChange={e => canEdit && updateRule('marginFromWallMm', Math.max(0, Number(e.target.value.replace(/[^0-9]/g, '') || '0')))}
                    disabled={!canEdit || !(placementRule.relation === 'against_wall' || placementRule.relation === 'corner')}
                    inputProps={{ type: 'number', min: 0 }}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '4px', textAlign: 'center' } }}
                  />
                  <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }}>mm</Typography>
                </Box>
              </Box>
            </Box>

            {/* 回転 + 繰り返し */}
            <Box>
              <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", mb: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>配置時の回転</Typography>
              <Box sx={{ display: 'flex', gap: 0.4 }}>
                {SET_ROTATION_OPTIONS.map(opt => {
                  const active = placementRule.rotationPolicy === opt.key;
                  return (
                    <Box key={opt.key} onClick={() => canEdit && updateRule('rotationPolicy', opt.key)}
                      sx={{
                        flex: 1, textAlign: 'center', py: 0.4, borderRadius: 1,
                        fontSize: 10, fontWeight: active ? 700 : 400,
                        cursor: canEdit ? 'pointer' : 'default', userSelect: 'none',
                        bgcolor: active ? alpha(ACCENT, 0.18) : alpha('#fff', 0.04),
                        color: active ? ACCENT : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                        border: `1px solid ${active ? alpha(ACCENT, 0.35) : alpha('#fff', 0.07)}`,
                        transition: 'all 0.12s',
                      }}
                    >{opt.label}</Box>
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box onClick={() => canEdit && updateRule('repeatable', !placementRule.repeatable)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, flex: 1,
                  px: 0.7, py: 0.4, borderRadius: 1, cursor: canEdit ? 'pointer' : 'default', userSelect: 'none',
                  fontSize: 10.5, fontWeight: placementRule.repeatable ? 700 : 400,
                  bgcolor: placementRule.repeatable ? alpha('#4ade80', 0.14) : alpha('#fff', 0.04),
                  color: placementRule.repeatable ? '#4ade80' : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                  border: `1px solid ${placementRule.repeatable ? alpha('#4ade80', 0.35) : alpha('#fff', 0.07)}`,
                  transition: 'all 0.12s',
                }}
              >
                {placementRule.repeatable ? '✓ ' : ''}繰り返し配置
              </Box>
              {placementRule.repeatable && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)" }}>最大</Typography>
                  <TextField size="small" value={String(placementRule.maxCount ?? 0)}
                    onChange={e => canEdit && updateRule('maxCount', (() => { const n = Number(e.target.value.replace(/[^0-9]/g, '') || '0'); return n > 0 ? n : undefined; })())}
                    disabled={!canEdit} inputProps={{ type: 'number', min: 0 }}
                    sx={{ width: 48, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 11, '& fieldset': { borderColor: alpha('#fff', 0.12) }, '&.Mui-focused fieldset': { borderColor: ACCENT } }, '& input': { py: '3px', textAlign: 'center' } }}
                  />
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)", mt: -0.5 }}>
              正面方向・クリアランスはフルエディタで視覚的に確認できます
            </Typography>
          </Box>
        )}

        {/* ══ スタイルタグ ══ */}
        <SectionHeader id="style" label="スタイルタグ" hint="AIスタイル一致に使用" />
        {expandSection.style && (
          <Box sx={{ px: 1.5, py: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
              {STYLE_TAGS.map(st => {
                const active = styleTags.includes(st.key);
                return (
                  <Box key={st.key} onClick={() => canEdit && toggleStyleTag(st.key)}
                    sx={{
                      px: 0.85, py: 0.3, borderRadius: 10, cursor: canEdit ? 'pointer' : 'default',
                      fontSize: 10, fontWeight: active ? 700 : 400,
                      bgcolor: active ? alpha('#ec4899', 0.18) : alpha('#fff', 0.04),
                      color: active ? 'light-dark(#a20b5d, #f9a8d4)' : "color-mix(in srgb, var(--brand-fg) 38%, transparent)",
                      border: `1px solid ${active ? alpha('#ec4899', 0.35) : alpha('#fff', 0.07)}`,
                      transition: 'all 0.12s', userSelect: 'none',
                    }}
                  >{st.label}</Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* ══ モデル構成 ══ */}
        <SectionHeader id="models" label={`モデル構成 (${companions.length})`} />
        {expandSection.models && (
          <Box sx={{ px: 1.5, py: 0.85, display: 'flex', flexDirection: 'column', gap: 0.45 }}>
            {companions.length === 0 ? (
              <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)", py: 1.5, textAlign: 'center' }}>モデルなし</Typography>
            ) : companions.map(cm => (
              <Box key={cm.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.65, px: 0.75, py: 0.55, borderRadius: 1.25, bgcolor: alpha('#fff', 0.03), border: `1px solid ${alpha('#fff', 0.06)}` }}>
                <Avatar src={cm.thumbnailUrl} variant="rounded" sx={{ width: 26, height: 26, flexShrink: 0, bgcolor: alpha('#7c3aed', 0.2), border: `1px solid ${alpha(ACCENT, 0.2)}` }}>
                  {!cm.thumbnailUrl && <ImageIcon sx={{ fontSize: 12 }} />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 78%, transparent)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                    {cm.title}
                  </Typography>
                  {canEdit ? (
                    <Box component="select" value={cm.layoutCategory ?? ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCompanionLayoutCategory(cm.id, e.target.value)}
                      sx={{ mt: 0.2, bgcolor: "color-mix(in srgb, var(--brand-bg) 30%, transparent)", color: cm.layoutCategory ? alpha(ACCENT, 0.85) : alpha('#fff', 0.28), border: `1px solid ${cm.layoutCategory ? alpha(ACCENT, 0.3) : alpha('#fff', 0.1)}`, borderRadius: '3px', fontSize: 9, px: 0.4, py: '2px', width: '100%', cursor: 'pointer', outline: 'none', '&:focus': { borderColor: ACCENT } }}>
                      <option value="">カテゴリ未設定</option>
                      {LAYOUT_CATEGORIES.map(lc => <option key={lc.key} value={lc.key}>{lc.icon} {lc.label}</option>)}
                    </Box>
                  ) : cm.layoutCategory ? (
                    <Typography sx={{ fontSize: 9, color: alpha(ACCENT, 0.65), lineHeight: 1.2 }}>
                      {LAYOUT_CATEGORIES.find(l => l.key === cm.layoutCategory)?.label ?? cm.layoutCategory}
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 22%, transparent)", lineHeight: 1.2 }}>カテゴリ未設定</Typography>
                  )}
                </Box>
                {canEdit && (
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => handleRemoveCompanion(cm.id)} sx={{ color: "color-mix(in srgb, var(--brand-fg) 18%, transparent)", p: 0.3, flexShrink: 0, '&:hover': { color: 'light-dark(#a50808, #f87171)', bgcolor: alpha('#f87171', 0.1) } }}>
                      <CloseRoundedIcon sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* フットプリント */}
        {set.footprintMm && (
          <Box sx={{ px: 1.5, py: 0.85, borderTop: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.4 }}>フットプリント</Typography>
            <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)", fontVariantNumeric: 'tabular-nums' }}>
              {set.footprintMm.w.toLocaleString()} × {set.footprintMm.d.toLocaleString()} mm
              <Typography component="span" sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 25%, transparent)", ml: 0.75 }}>
                ≈ {((set.footprintMm.w * set.footprintMm.d) / 1_000_000).toFixed(1)} ㎡
              </Typography>
            </Typography>
          </Box>
        )}

        {/* カテゴリ構成 */}
        {set.categoryComposition && Object.keys(set.categoryComposition).length > 0 && (
          <Box sx={{ px: 1.5, py: 0.75, borderTop: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)", letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.4 }}>カテゴリ構成</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.35 }}>
              {Object.entries(set.categoryComposition).map(([key, count]) => (
                <Chip key={key} label={`${key} ×${count}`} size="small"
                  sx={{ height: 17, fontSize: 9, bgcolor: alpha('#fff', 0.05), color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", '& .MuiChip-label': { px: 0.5 } }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── アクションエリア ── */}
      <Box sx={{ flexShrink: 0, borderTop: `1px solid ${LINE}`, px: 1.5, py: 1.1, display: 'flex', flexDirection: 'column', gap: 0.65 }}>
        {canEdit && (
          <Button fullWidth size="small" disabled={!isDirty || saving} onClick={handleSave}
            startIcon={savedFlash ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <SaveRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{
              textTransform: 'none', fontSize: 11, fontWeight: 700,
              bgcolor: savedFlash ? alpha('#4ade80', 0.15) : alpha(ACCENT, 0.15),
              color: savedFlash ? '#4ade80' : ACCENT,
              border: `1px solid ${savedFlash ? alpha('#4ade80', 0.28) : alpha(ACCENT, 0.28)}`,
              '&:hover': { bgcolor: savedFlash ? alpha('#4ade80', 0.25) : alpha(ACCENT, 0.25) },
              '&.Mui-disabled': { bgcolor: alpha('#fff', 0.03), color: "color-mix(in srgb, var(--brand-fg) 18%, transparent)", border: `1px solid ${alpha('#fff', 0.07)}` },
              borderRadius: 1.5, py: 0.55, transition: 'all 0.2s',
            }}
          >
            {saving ? '保存中...' : savedFlash ? '保存済み' : '変更を保存'}
          </Button>
        )}
        {canEdit && (
          <Button fullWidth size="small" onClick={onOpenEditor}
            startIcon={<OpenInFullRoundedIcon sx={{ fontSize: 12 }} />}
            sx={{ textTransform: 'none', fontSize: 11, bgcolor: alpha('#fff', 0.04), color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)", border: `1px solid ${alpha('#fff', 0.09)}`, '&:hover': { bgcolor: alpha('#fff', 0.08), color: 'var(--brand-fg)' }, borderRadius: 1.5, py: 0.5 }}
          >
            フルエディタで開く
          </Button>
        )}
        {canEdit && (
          confirmDelete ? (
            <Box sx={{ display: 'flex', gap: 0.65 }}>
              <Button fullWidth size="small" onClick={onDelete}
                sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, bgcolor: alpha('#ef4444', 0.15), color: 'light-dark(#a50808, #f87171)', border: `1px solid ${alpha('#ef4444', 0.3)}`, '&:hover': { bgcolor: alpha('#ef4444', 0.25) }, borderRadius: 1.5, py: 0.5 }}>
                本当に削除
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}
                sx={{ textTransform: 'none', fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", '&:hover': { bgcolor: alpha('#fff', 0.05) }, minWidth: 48, borderRadius: 1.5 }}>
                取消
              </Button>
            </Box>
          ) : (
            <Button fullWidth size="small" onClick={() => setConfirmDelete(true)}
              startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />}
              sx={{ textTransform: 'none', fontSize: 11, color: 'light-dark(rgba(165,8,8,0.55), rgba(248,113,113,0.55))', '&:hover': { bgcolor: alpha('#ef4444', 0.07), color: 'light-dark(#a50808, #f87171)' }, borderRadius: 1.5, py: 0.5 }}>
              セットを削除
            </Button>
          )
        )}
      </Box>
    </Box>
  );
};

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function buildingTypeLabel(bt: string): string {
  const map: Record<string, string> = { residential: '住宅', office: 'オフィス', cafe: 'カフェ', hotel: 'ホテル' };
  return map[bt] ?? bt;
}
