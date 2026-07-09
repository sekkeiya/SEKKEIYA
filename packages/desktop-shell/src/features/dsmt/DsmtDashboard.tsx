import React, { useMemo, useState } from 'react';
import { Box, Typography, InputBase, Chip, CircularProgress, Button, Tooltip, IconButton, ToggleButtonGroup, ToggleButton, Switch, Divider, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, RadioGroup, FormControlLabel, Radio, List, ListItem, ListItemText, Slider } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TextureRoundedIcon from '@mui/icons-material/TextureRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import { useAppStore } from '../../store/useAppStore';
import { useImagePickerStore, type PickerImage } from '../../store/useImagePickerStore';
import { useDsmtStore } from './store/useDsmtStore';
import { DsmtMaterialDialog } from './components/DsmtMaterialDialog';
import { DsmtMaterialDetail } from './components/DsmtMaterialDetail';
import { dsmtUploadService } from './api/dsmtUploadService';
import { seedStarterMaterials } from './data/starterCatalog';
import { FINISH_SUBTYPES } from './data/finishTaxonomy';
import { generateMaterialsFromSelectedImages, baseNameOf, safeIdPart } from './data/imageMaterialGen';
import { useMaterialGenStore } from './store/useMaterialGenStore';
import { DssProjectsGrid } from '../dss/DssProjectsGrid';
import { DSMT_CATEGORY_META, type DsmtMaterial, type DsmtCategory } from './types';

const ACCENT = '#ec407a';

/** タイトルがローカルファイルのフルパスになっている場合、ファイル名部分だけ返す。 */
function displayTitle(title: string | undefined | null, fallback = '無題の素材'): string {
  if (!title) return fallback;
  const slashIdx = Math.max(title.lastIndexOf('/'), title.lastIndexOf('\\'));
  const name = slashIdx >= 0 ? title.slice(slashIdx + 1) : title;
  // 拡張子を除く
  return name.replace(/\.[a-z0-9]+$/i, '') || fallback;
}

interface DsmtDashboardProps {
  payload?: { projectId?: string; workspaceId?: string; workspaceName?: string; appScope?: string };
  materials?: DsmtMaterial[];
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
}

/** 素材の球プレビュー（テクスチャがあれば貼り、上から球の陰影グラデを重ねて立体的に見せる）。 */
const MaterialSpherePreview: React.FC<{ material: DsmtMaterial; size?: number }> = ({ material, size = 96 }) => {
  const base = material.params?.baseColor || DSMT_CATEGORY_META[material.category]?.color || '#888';
  // テクスチャ設定後は baseColor が白に正規化されるため、陰影は控えめ寄りに固定
  const hasTex = !!material.thumbnailUrl;
  const rough = material.params?.roughness ?? 0.6;
  const hi = hasTex ? 0.5 : (1 - rough) * 0.85 + 0.1;
  const sphereShade = `radial-gradient(circle at 32% 28%, rgba(255,255,255,${hi}) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 72% 82%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 58%)`;
  return (
    <Box sx={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundImage: hasTex
        ? `${sphereShade}, url("${material.thumbnailUrl}")`
        : `${sphereShade}, radial-gradient(circle, ${base} 0%, ${base} 100%)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      boxShadow: 'inset 0 -6px 14px rgba(0,0,0,0.45), inset 0 4px 10px rgba(255,255,255,0.08)',
    }} />
  );
};

const MaterialCard: React.FC<{
  material: DsmtMaterial; onClick: (e: React.MouseEvent) => void; onDoubleClick: () => void; onDelete?: () => void; selected: boolean; multiSelected?: boolean;
}> = ({ material, onClick, onDoubleClick, onDelete, selected, multiSelected }) => {
  const meta = DSMT_CATEGORY_META[material.category] || DSMT_CATEGORY_META.other;
  return (
    <Box
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        p: 1.5, borderRadius: 2, cursor: 'pointer',
        bgcolor: multiSelected ? 'rgba(66,165,245,0.1)' : selected ? 'rgba(236,64,122,0.14)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${multiSelected ? '#42a5f5' : selected ? 'rgba(236,64,122,0.6)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: multiSelected ? '0 0 0 2px rgba(66,165,245,0.45)' : 'none',
        transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        '&:hover': { bgcolor: multiSelected ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.07)', transform: 'translateY(-2px)', '& .dsmt-del': { opacity: 1 } },
      }}
    >
      {/* 複数選択チェックバッジ */}
      {multiSelected && (
        <Box sx={{
          position: 'absolute', top: 4, left: 4, zIndex: 2,
          width: 20, height: 20, borderRadius: '50%',
          bgcolor: '#42a5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}>
          <CheckCircleOutlineRoundedIcon sx={{ fontSize: 14, color: '#fff' }} />
        </Box>
      )}
      {onDelete && !multiSelected && (
        <IconButton className="dsmt-del" size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.15s', color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { color: '#ff6b6b', bgcolor: 'rgba(0,0,0,0.6)' } }}>
          <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      )}
      <MaterialSpherePreview material={material} />
      <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: '#fff', textAlign: 'center', lineHeight: 1.3, width: '100%' }}>
        {displayTitle(material.title)}
      </Typography>
      <Chip label={meta.label} size="small" sx={{ height: 18, fontSize: 9, bgcolor: `${meta.color}22`, color: meta.color, borderRadius: 1 }} />
    </Box>
  );
};

/** 右の素材情報パネル（クリック選択時）。 */
const DsmtInfoPanel: React.FC<{
  material: DsmtMaterial; onEdit: () => void; onDelete: () => void; onToggleVisibility: () => void; canManage: boolean;
}> = ({ material, onEdit, onDelete, onToggleVisibility, canManage }) => {
  const meta = DSMT_CATEGORY_META[material.category] || DSMT_CATEGORY_META.other;
  const p = material.params || ({} as any);
  const bar = (label: string, v: number, color: string) => (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</Typography>
        <Typography sx={{ fontSize: 11, color: '#fff' }}>{Number(v ?? 0).toFixed(2)}</Typography>
      </Box>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)' }}>
        <Box sx={{ width: `${Math.min(1, Math.max(0, v ?? 0)) * 100}%`, height: '100%', borderRadius: 2, bgcolor: color }} />
      </Box>
    </Box>
  );
  return (
    <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflowY: 'auto', bgcolor: 'rgba(10,15,25,0.4)' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>素材情報</Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <MaterialSpherePreview material={material} size={120} />
        </Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', mb: 0.5 }}>{displayTitle(material.title)}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Chip label={meta.label} size="small" sx={{ height: 20, fontSize: 10, bgcolor: `${meta.color}22`, color: meta.color }} />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: '4px', bgcolor: p.baseColor || '#888', border: '1px solid rgba(255,255,255,0.2)' }} />
          <Typography sx={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>{p.baseColor || '-'}</Typography>
        </Box>
        {bar('ラフネス', p.roughness, '#90caf9')}
        {bar('メタルネス', p.metalness, '#ffb74d')}
        {bar('不透明度', p.opacity ?? 1, '#81c784')}

        {Array.isArray(material.tags) && material.tags.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>タグ</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {material.tags.map((t) => <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }} />)}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography sx={{ fontSize: 12, color: material.visibility === 'public' ? ACCENT : 'rgba(255,255,255,0.4)' }}>
            {material.visibility === 'public' ? '公開中' : '非公開'}
          </Typography>
          <Switch size="small" checked={material.visibility === 'public'} disabled={!canManage} onChange={onToggleVisibility}
            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(236,64,122,0.5)' } }} />
        </Box>

        {canManage && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            <Button variant="contained" size="small" startIcon={<EditRoundedIcon />} onClick={onEdit}
              sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }}>詳細・編集</Button>
            <Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={onDelete} sx={{ textTransform: 'none' }}>削除</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

/** 重複（同一素材が複数プロジェクトに存在）を1つにまとめる署名 */
const dedupeMaterials = (list: DsmtMaterial[]): DsmtMaterial[] => {
  const seen = new Set<string>();
  const out: DsmtMaterial[] = [];
  for (const m of list) {
    const sig = `${m.title || ''}|${m.category || ''}|${m.params?.baseColor || ''}|${m.maps?.albedo || ''}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(m);
  }
  return out;
};

export const DsmtDashboard: React.FC<DsmtDashboardProps> = ({ payload, materials = [], projects = null, isInitializing = false, isGlobal = false }) => {
  const { search, setSearch, categoryFilter, setCategoryFilter, selectedId, setSelectedId } = useDsmtStore();
  const dsmtScope = useAppStore((s) => s.dsmtScope);
  const dsmtGlobalFilter = useAppStore((s) => s.dsmtGlobalFilter);
  const setDsmtGlobalFilter = useAppStore((s) => s.setDsmtGlobalFilter);
  const setDsmtScope = useAppStore((s) => s.setDsmtScope);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveWorkspaceId = useAppStore((s) => s.setActiveWorkspaceId);
  const allProjects = useAppStore((s) => s.projects);
  const myProjects = useMemo(() => allProjects.filter((p) => !p.isTeam), [allProjects]);
  const teamProjects = useMemo(() => allProjects.filter((p) => !!p.isTeam), [allProjects]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<DsmtMaterial | null>(null);
  const [detail, setDetail] = useState<DsmtMaterial | null>(null);
  const [seeding, setSeeding] = useState(false);
  // Shift+クリック複数選択
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<DsmtMaterial[] | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  // 類似検出しきい値ダイアログ
  const [simThresholdDialog, setSimThresholdDialog] = useState(false);
  const [simThresholdBits, setSimThresholdBits] = useState(8);
  // S.Image で確定された画像を保持し、保存先ダイアログを表示する
  const [pendingImages, setPendingImages] = useState<PickerImage[] | null>(null);
  const [destVisibility, setDestVisibility] = useState<'private' | 'public'>('private');
  // 'auto' = Private/Public Material（自動プロジェクト選択）, 'specific' = プロジェクト指定
  const [destMode, setDestMode] = useState<'auto' | 'specific'>('auto');
  const [destSelectedProjectId, setDestSelectedProjectId] = useState<string | null>(null);
  const [allDupDialog, setAllDupDialog] = useState<{ count: number } | null>(null);
  const [genResultDialog, setGenResultDialog] = useState<{
    created: number;
    skipped: number;
    createdItems: { id: string; title: string }[];
  } | null>(null);
  const { isGenerating, progress: genProgress, setGenerating, setProgress } = useMaterialGenStore();

  const projectId = payload?.projectId || undefined;
  const isProjectsScope = dsmtScope === 'global_projects';

  const openCreate = () => { setDialogOpen(true); };
  const openDetail = (m: DsmtMaterial) => { setDetail(m); };

  // Shift+クリック複数選択ハンドラ
  const handleCardClick = (m: DsmtMaterial, e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      setMultiSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(m.id)) next.delete(m.id);
        else next.add(m.id);
        return next;
      });
      return;
    }
    if (multiSelectedIds.size > 0) setMultiSelectedIds(new Set());
    setSelectedId(m.id);
    setSelected(m);
  };

  // 一括削除
  const handleBulkDeleteOpen = () => {
    const toDelete = filtered.filter((m) => multiSelectedIds.has(m.id) && canManage(m));
    if (toDelete.length) setBulkDeleteConfirm(toDelete);
  };

  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteConfirm || deletingBulk) return;
    const items = bulkDeleteConfirm;
    setDeletingBulk(true);
    setBulkDeleteConfirm(null);
    try {
      for (const m of items) {
        const pid = m.projectId || projectId;
        if (!pid) continue;
        try { await dsmtUploadService.deleteMaterial(pid, m); } catch (e) { console.warn('[DsmtDashboard] bulk delete skipped', m.id, e); }
      }
      setMultiSelectedIds(new Set());
      if (items.some((m) => m.id === selected?.id)) setSelected(null);
    } finally { setDeletingBulk(false); }
  };

  const handleDelete = async (m: DsmtMaterial) => {
    const pid = m.projectId || projectId;
    if (!pid) return;
    if (!window.confirm(`「${m.title || '無題の素材'}」を削除しますか？`)) return;
    try { await dsmtUploadService.deleteMaterial(pid, m); if (selected?.id === m.id) setSelected(null); }
    catch (e) { console.error('[DsmtDashboard] delete failed', e); }
  };

  const handleToggleVisibility = async (m: DsmtMaterial) => {
    const pid = m.projectId || projectId;
    if (!pid) return;
    const next = m.visibility === 'public' ? 'private' : 'public';
    try {
      await dsmtUploadService.setMaterialVisibility(pid, m.id, next);
      setSelected((prev) => (prev && prev.id === m.id ? { ...prev, visibility: next } : prev));
    } catch (e) { console.error('[DsmtDashboard] visibility toggle failed', e); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = materials.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (q && !(m.title?.toLowerCase().includes(q) || m.tags?.some((t) => t.toLowerCase().includes(q)))) return false;
      return true;
    });
    // Public / Private Material は重複を 1 つにまとめる
    if (dsmtScope === 'my_public_materials' || dsmtScope === 'my_private_materials') {
      list = dedupeMaterials(list);
    }
    return list;
  }, [materials, search, categoryFilter, dsmtScope]);

  const categories = Object.keys(DSMT_CATEGORY_META) as DsmtCategory[];
  const hasSeeds = materials.some((m) => m.id?.startsWith('dsmt_seed_') && m.projectId);
  // 管理操作は「自分のプロジェクト由来 or プロジェクトスコープ」で可能。グローバル閲覧では読み取りのみ。
  const canManage = (m: DsmtMaterial) => !!(m.projectId || projectId);

  const seedDefaults = async () => {
    if (!projectId) return;
    setSeeding(true);
    try { await dsmtUploadService.seedDefaultMaterials(projectId); }
    catch (e) { console.error('[DsmtDashboard] seed defaults failed', e); }
    finally { setSeeding(false); }
  };

  // 視覚的類似素材を検出してダイアログ表示（dHash ベース）
  const [simDeleteDialog, setSimDeleteDialog] = useState<{
    groups: { keep: DsmtMaterial; remove: DsmtMaterial[]; minDist: number }[];
    totalDelete: number;
  } | null>(null);
  const [simDetectProgress, setSimDetectProgress] = useState<{ done: number; total: number } | null>(null);

  const detectSimilarMaterials = async (threshold = 8) => {
    const manageable = materials.filter((m) => m.projectId || projectId);
    if (!manageable.length) return;
    setSimDetectProgress({ done: 0, total: manageable.length });
    try {
      const { detectSimilarByHash } = await import('../dsi/utils/imageHash');

      // 画像あり素材と画像なし素材を分離
      const withImg  = manageable.filter((m) => m.maps?.albedo || m.thumbnailUrl);
      const noImg    = manageable.filter((m) => !m.maps?.albedo && !m.thumbnailUrl);

      // ①「画像あり」: カテゴリごとに dHash 比較（カテゴリ跨ぎの誤検知を防ぐ）
      const categories = [...new Set(withImg.map((m) => m.category || 'other'))];
      type SimGroup = { keep: DsmtMaterial; remove: DsmtMaterial[]; minDist: number };
      const allHashGroups: SimGroup[] = [];
      let hashDone = 0;
      for (const cat of categories) {
        const catMaterials = withImg.filter((m) => (m.category || 'other') === cat);
        if (catMaterials.length <= 1) { hashDone += catMaterials.length; continue; }
        const groups = await detectSimilarByHash(
          catMaterials,
          (m) => m.id || m.title || '',
          (m) => m.maps?.albedo || m.thumbnailUrl,
          (m) => (m.thumbnailUrl ? 4 : 0) + (m.maps?.albedo ? 2 : 0) + (m.id?.startsWith('dsmt_imggen_') ? 1 : 0),
          threshold,
          (done) => setSimDetectProgress({ done: hashDone + done, total: manageable.length }),
        );
        allHashGroups.push(...groups);
        hashDone += catMaterials.length;
        setSimDetectProgress({ done: hashDone, total: manageable.length });
      }

      // ②「画像なし」: 同カテゴリ内で黒球（視覚的に区別不能）としてグループ化
      const noImgGroups: SimGroup[] = [];
      const byNoImgCat = new Map<string, DsmtMaterial[]>();
      noImg.forEach((m) => {
        const k = m.category || 'other';
        const arr = byNoImgCat.get(k) || [];
        arr.push(m);
        byNoImgCat.set(k, arr);
      });
      byNoImgCat.forEach((grp) => {
        if (grp.length <= 1) return;
        const sorted = [...grp].sort((a, b) =>
          (b.id?.startsWith('dsmt_imggen_') ? 1 : 0) - (a.id?.startsWith('dsmt_imggen_') ? 1 : 0) ||
          (a.title || '').localeCompare(b.title || ''),
        );
        noImgGroups.push({ keep: sorted[0], remove: sorted.slice(1), minDist: 0 });
      });

      setSimDetectProgress(null);
      const allGroups = [...allHashGroups, ...noImgGroups];
      if (!allGroups.length) { window.alert('視覚的に類似するマテリアルは見つかりませんでした。'); return; }
      const totalDelete = allGroups.reduce((s, g) => s + g.remove.length, 0);
      setSimDeleteDialog({ groups: allGroups, totalDelete });
    } catch (e) {
      setSimDetectProgress(null);
      console.error('[DsmtDashboard] sim detect failed', e);
      window.alert('解析に失敗しました: ' + String(e));
    }
  };

  const handleSimDeleteConfirm = async () => {
    if (!simDeleteDialog) return;
    const toDelete = simDeleteDialog.groups.flatMap((g) => g.remove);
    setSimDeleteDialog(null);
    setSeeding(true);
    try {
      for (const m of toDelete) {
        const pid = m.projectId || projectId;
        if (!pid) continue;
        try { await dsmtUploadService.deleteMaterial(pid, m); } catch (e) { console.warn('[DsmtDashboard] sim delete skipped', m.id, e); }
      }
    } finally { setSeeding(false); }
  };

  // スターター素材の重複を削除：種別名が一致するものを1つ（固定ID dsmt_starter_* を優先）残して他を削除。
  // ユーザーが作った他の素材には触れない（種別正典のタイトルに一致するもののみ対象）。
  const removeStarterDuplicates = async () => {
    const starterLabels = new Set(FINISH_SUBTYPES.map((s) => s.label));
    const pool = materials.filter((m) => (m.projectId || projectId) && starterLabels.has(m.title || ''));
    const byTitle = new Map<string, DsmtMaterial[]>();
    pool.forEach((m) => {
      const k = m.title || '';
      const arr = byTitle.get(k) || [];
      arr.push(m);
      byTitle.set(k, arr);
    });
    const toDelete: DsmtMaterial[] = [];
    byTitle.forEach((group) => {
      if (group.length <= 1) return;
      const canonical = group.find((m) => m.id?.startsWith('dsmt_starter_')) || group[0];
      group.forEach((m) => { if (m.id !== canonical.id) toDelete.push(m); });
    });
    if (!toDelete.length) { window.alert('重複したスターター素材は見つかりませんでした。'); return; }
    if (!window.confirm(`重複したスターター素材 ${toDelete.length} 件を削除します（各種別1つは残します）。よろしいですか？`)) return;
    setSeeding(true);
    try {
      for (const m of toDelete) {
        const pid = m.projectId || projectId;
        if (!pid) continue;
        try { await dsmtUploadService.deleteMaterial(pid, m); } catch (e) { console.warn('[DsmtDashboard] dup delete skipped', m.id, e); }
      }
    } finally { setSeeding(false); }
  };

  // 値がローカル参照（asset://, C:\…, LocalAssets 等）か判定。Firebase Storage の https URL は対象外。
  const isLocalRef = (u?: string | null): boolean =>
    !!u && (/^(asset|file|blob):/i.test(u) || /asset\.localhost|tauri\.localhost/.test(u)
      || /^[A-Za-z]:[\\/]/.test(u) || u.includes('LocalAssets') || u.includes('SEKKEIYA'));

  // 壊れた参照のクリーンアップ：thumbnailUrl / maps がローカルパスのマテリアルを削除する。
  // 元ファイルが消えた自動生成テクスチャ（…/generated_finishes_pbr_100/…）等で 404 を出す原因を一掃。
  const pruneBrokenLocalRefs = async () => {
    const broken = materials.filter((m) => (m.projectId || projectId) && (
      isLocalRef(m.thumbnailUrl) ||
      Object.values((m.maps || {}) as Record<string, string | undefined>).some((v) => isLocalRef(v))
    ));
    if (!broken.length) { window.alert('ローカルパス参照で表示できないマテリアルは見つかりませんでした。'); return; }
    if (!window.confirm(`表示できない（ローカルパス参照の）マテリアル ${broken.length} 件を削除します。\n元ファイルが無いため復元はできません。よろしいですか？`)) return;
    setSeeding(true);
    try {
      for (const m of broken) {
        const pid = m.projectId || projectId;
        if (!pid) continue;
        try { await dsmtUploadService.deleteMaterial(pid, m); if (selected?.id === m.id) setSelected(null); }
        catch (e) { console.warn('[DsmtDashboard] prune skipped', m.id, e); }
      }
      window.alert(`${broken.length} 件を削除しました。`);
    } finally { setSeeding(false); }
  };

  // S.Image でテクスチャを選択して確定したときに呼ばれる（S.Material に自動遷移）
  const handleImagesSelected = (images: PickerImage[]) => {
    if (!images.length) return;
    setDestVisibility('private');
    setDestMode('auto');
    const defaultPid = projectId
      || useAppStore.getState().getActiveProject()?.id
      || allProjects[0]?.id
      || null;
    setDestSelectedProjectId(defaultPid);
    setPendingImages(images);
    // S.Image → S.Material に戻る
    const app = useAppStore.getState();
    app.setLastActiveAppScope('3dsmt');
    app.setActiveWorkspaceId('material');
  };

  // 保存先ダイアログで「生成」を押したとき
  const handleDestConfirm = async () => {
    if (!pendingImages) return;
    // autoモード: アクティブPJ → 先頭PJ の順で自動選択。プロジェクトが1件も無ければエラー。
    const destProjectId = destMode === 'specific'
      ? destSelectedProjectId
      : (projectId || useAppStore.getState().getActiveProject()?.id || allProjects[0]?.id || null);
    if (!destProjectId) {
      window.alert('マテリアルの保存にはプロジェクトが必要です。左サイドバーの「＋」からプロジェクトを作成してください。');
      return;
    }
    const imgs = pendingImages;
    setPendingImages(null);
    setSeeding(true);
    setGenerating(true);
    setProgress({ current: 0, total: 0, label: '初期化中...' });
    try {
      const res = await generateMaterialsFromSelectedImages(
        imgs,
        destProjectId,
        destVisibility,
        materials,
        (current, total, label) => setProgress({ current, total, label }),
      );
      if (res.reason === 'allDuplicate') {
        setAllDupDialog({ count: res.skipped });
      } else if (!res.ok) {
        window.alert(res.reason || '生成に失敗しました');
      } else {
        setGenResultDialog({
          created: res.created,
          skipped: res.skipped,
          createdItems: res.createdItems ?? [],
        });
      }
    } catch (e) {
      console.error('[DsmtDashboard] gen failed', e);
      window.alert('生成中にエラーが発生しました。');
    } finally {
      setSeeding(false);
      setGenerating(false);
      setProgress(null);
    }
  };

  // 内装/外装の代表的な仕上げ材を「部位タグ付きの単色素材」として一括生成（自動マテリアル用の土台）。
  const seedStarter = async () => {
    if (!projectId) return;
    if (!window.confirm('床/内壁/外壁/天井の代表的な仕上げ材を単色素材として一括生成します。よろしいですか？')) return;
    setSeeding(true);
    try {
      const res = await seedStarterMaterials(projectId);
      if (!res.ok) console.warn('[DsmtDashboard] seed starter failed', res.reason);
    } catch (e) { console.error('[DsmtDashboard] seed starter failed', e); }
    finally { setSeeding(false); }
  };

  const openProjectMaterials = (project: any) => {
    setActiveProjectId(project.id);
    setDsmtScope('project_materials');
    setActiveWorkspaceId('material');
  };

  // アクションボタン（全画面共通）
  const actionButtons = (
    <>
      {!isProjectsScope && (
        <Tooltip title={allProjects.length > 0 ? 'S.Image でテクスチャを選択してマテリアルを一括生成' : 'プロジェクトを作成すると生成できます'}>
          <span>
            <Button variant="outlined" size="small" startIcon={seeding ? <CircularProgress size={14} /> : <AutoAwesomeRoundedIcon />}
              disabled={seeding || allProjects.length === 0}
              onClick={() => {
                const existingIds = new Set(materials.map((m) => m.id));
                useImagePickerStore.getState().openPickerWithCallback('material', 500, handleImagesSelected, existingIds);
              }}
              sx={{ textTransform: 'none', color: 'rgba(110,231,255,0.95)', borderColor: 'rgba(110,231,255,0.4)' }}>
              {seeding ? '生成中...' : 'S.Imageから生成'}
            </Button>
          </span>
        </Tooltip>
      )}
      {!isProjectsScope && (
        <Tooltip title={projectId ? '床/内壁/外壁/天井の代表的な仕上げ材を一括生成（部位タグ付き）' : 'プロジェクトを選択すると生成できます'}>
          <span>
            <Button variant="outlined" size="small" startIcon={seeding ? <CircularProgress size={14} /> : <CategoryRoundedIcon />}
              disabled={!projectId || seeding} onClick={seedStarter}
              sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.3)' }}>
              スターター素材を生成
            </Button>
          </span>
        </Tooltip>
      )}
      {!isProjectsScope && (
        <Tooltip title="テクスチャ画像を解析して人の目で見分けがつかないマテリアルを自動検出・削除">
          <span>
            <Button variant="outlined" color="warning" size="small"
              startIcon={simDetectProgress ? <CircularProgress size={14} color="inherit" /> : <DeleteSweepRoundedIcon />}
              disabled={seeding || !!simDetectProgress || materials.length === 0}
              onClick={() => setSimThresholdDialog(true)}
              sx={{ textTransform: 'none' }}>
              {simDetectProgress
                ? `解析中 ${simDetectProgress.done}/${simDetectProgress.total}…`
                : '類似を削除'}
            </Button>
          </span>
        </Tooltip>
      )}
      {!isProjectsScope && (
        <Tooltip title={projectId ? 'スターター素材の重複を削除（各種別1つは残す）' : 'プロジェクトを選択すると実行できます'}>
          <span>
            <Button variant="outlined" color="warning" size="small" startIcon={seeding ? <CircularProgress size={14} /> : <DeleteSweepRoundedIcon />}
              disabled={!projectId || seeding} onClick={removeStarterDuplicates}
              sx={{ textTransform: 'none', display: 'none' }}>
              重複を削除
            </Button>
          </span>
        </Tooltip>
      )}
      {!isProjectsScope && (
        <Tooltip title={projectId ? 'ローカルパス参照で表示できない（404になる）マテリアルを一括削除' : 'プロジェクトを選択すると実行できます'}>
          <span>
            <Button variant="outlined" color="warning" size="small" startIcon={seeding ? <CircularProgress size={14} /> : <DeleteSweepRoundedIcon />}
              disabled={!projectId || seeding} onClick={pruneBrokenLocalRefs}
              sx={{ textTransform: 'none' }}>
              壊れた参照を掃除
            </Button>
          </span>
        </Tooltip>
      )}
      {!isProjectsScope && (
        <Tooltip title={projectId ? '' : 'プロジェクトを選択すると素材を作成できます'}>
          <span>
            <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} disabled={!projectId} onClick={openCreate}
              sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }}>新規マテリアル</Button>
          </span>
        </Tooltip>
      )}
    </>
  );

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default', position: 'relative' }}>
      {/* ヘッダー */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <TextureRoundedIcon sx={{ color: ACCENT, fontSize: 24 }} />
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>S.Material</Typography>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {isProjectsScope ? `Public Projects · ${projects?.length ?? 0} 件` : `マテリアル管理 · ${filtered.length} 件`}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {/* Material: 全公開 / フォロー中 切替 */}
          {dsmtScope === 'global_materials' && (
            <ToggleButtonGroup exclusive size="small" value={dsmtGlobalFilter} onChange={(_, v) => v && setDsmtGlobalFilter(v)}>
              <ToggleButton value="all" sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: 12, py: 0.25 }}>
                <PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> すべて
              </ToggleButton>
              <ToggleButton value="following" sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: 12, py: 0.25 }}>
                <GroupRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> フォロー中
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {actionButtons}
        </Box>

        {!isProjectsScope && !detail && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 240, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 2, px: 1.5, py: 0.5, border: '1px solid rgba(255,255,255,0.06)' }}>
              <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 1 }} />
              <InputBase placeholder="素材を検索..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ color: '#fff', fontSize: 13, flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label="すべて" size="small" onClick={() => setCategoryFilter('all')}
                sx={{ height: 24, fontSize: 11, bgcolor: categoryFilter === 'all' ? ACCENT : 'rgba(255,255,255,0.06)', color: categoryFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.7)' }} />
              {categories.map((c) => (
                <Chip key={c} label={DSMT_CATEGORY_META[c].label} size="small" onClick={() => setCategoryFilter(c)}
                  sx={{ height: 24, fontSize: 11, bgcolor: categoryFilter === c ? DSMT_CATEGORY_META[c].color : 'rgba(255,255,255,0.06)', color: categoryFilter === c ? '#fff' : 'rgba(255,255,255,0.7)' }} />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* 本体 */}
      {detail ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DsmtMaterialDetail material={detail} onBack={() => setDetail(null)} />
        </Box>
      ) : isProjectsScope ? (
        <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>
          <DssProjectsGrid
            items={projects || []}
            cardSize={240}
            onSelectProject={() => { /* 単一選択はカード側ハイライトのみ */ }}
            onDoubleClickProject={openProjectMaterials}
            isInitializing={isInitializing}
            badgeColor={ACCENT}
          />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {isInitializing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                <CircularProgress sx={{ color: ACCENT }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>素材を読み込み中...</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'rgba(255,255,255,0.4)' }}>
                <TextureRoundedIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                <Typography sx={{ fontSize: 14 }}>素材がまだありません</Typography>
                <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                  {isGlobal ? '公開されている素材がここに表示されます。' : 'このスコープに素材を追加すると、ここに並びます。'}
                </Typography>
                {projectId && (
                  <Button variant="outlined" size="small" startIcon={seeding ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <TextureRoundedIcon />}
                    disabled={seeding} onClick={seedDefaults}
                    sx={{ mt: 1, color: ACCENT, borderColor: ACCENT, textTransform: 'none', '&:hover': { borderColor: '#f06292', bgcolor: 'rgba(236,64,122,0.08)' } }}>
                    {seeding ? '追加中...' : 'デフォルト素材を追加（公開）'}
                  </Button>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2, alignContent: 'start' }}>
                {filtered.map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    selected={selectedId === m.id}
                    multiSelected={multiSelectedIds.has(m.id)}
                    onClick={(e) => handleCardClick(m, e)}
                    onDoubleClick={() => openDetail(m)}
                    onDelete={canManage(m) ? () => handleDelete(m) : undefined}
                  />
                ))}
              </Box>
            )}
          </Box>

          {selected && (
            <DsmtInfoPanel
              material={selected}
              canManage={canManage(selected)}
              onEdit={() => openDetail(selected)}
              onDelete={() => handleDelete(selected)}
              onToggleVisibility={() => handleToggleVisibility(selected)}
            />
          )}
        </Box>
      )}

      {/* 複数選択フローティングバー */}
      {multiSelectedIds.size > 0 && !isProjectsScope && !detail && (
        <Box sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: '#1a1d24', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 3, px: 2.5, py: 1.25,
          boxShadow: '0 6px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
        }}>
          <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
            {multiSelectedIds.size} 件選択中
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Shift+クリックで追加／解除
          </Typography>
          <Button size="small" onClick={() => setMultiSelectedIds(new Set())}
            sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', minWidth: 0, ml: 0.5 }}>
            解除
          </Button>
          <Button size="small" variant="contained" color="error"
            startIcon={deletingBulk ? <CircularProgress size={13} color="inherit" /> : <DeleteOutlineRoundedIcon />}
            onClick={handleBulkDeleteOpen} disabled={deletingBulk}
            sx={{ textTransform: 'none' }}>
            {deletingBulk ? '削除中...' : '削除'}
          </Button>
        </Box>
      )}

      <DsmtMaterialDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={projectId}
        material={null}
        onSaved={() => { /* onSnapshot がリストを自動更新 */ }}
      />

      {/* 保存先選択ダイアログ（S.Imageで画像選択確定後に表示） */}
      <Dialog open={!!pendingImages} onClose={() => setPendingImages(null)}
        PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 460, maxWidth: 520 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>マテリアルの保存先</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', mb: 2 }}>
            {pendingImages?.length ?? 0} 枚のテクスチャを選択しました。保存先を選んでください。
          </Typography>

          <FormControl sx={{ width: '100%' }}>
            <RadioGroup value={`${destMode}_${destVisibility}`} onChange={(e) => {
              const [mode, vis] = e.target.value.split('_') as ['auto' | 'specific', 'private' | 'public'];
              setDestMode(mode);
              if (vis) setDestVisibility(vis);
            }}>
              {/* Private Material */}
              <FormControlLabel value="auto_private"
                control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
                sx={{ mb: 0.5, '& .MuiFormControlLabel-label': { width: '100%' } }}
                label={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Private Material</Typography>
                      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>自分のみ閲覧可・自動プロジェクト割り当て</Typography>
                    </Box>
                  </Box>
                }
              />
              {/* Public Material */}
              <FormControlLabel value="auto_public"
                control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
                sx={{ mb: 1, '& .MuiFormControlLabel-label': { width: '100%' } }}
                label={
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Public Material</Typography>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>全員が閲覧可・自動プロジェクト割り当て</Typography>
                  </Box>
                }
              />
              {/* 特定プロジェクト */}
              <FormControlLabel value={`specific_${destVisibility}`}
                control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
                sx={{ '& .MuiFormControlLabel-label': { width: '100%' } }}
                label={
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>特定のプロジェクトへ保存</Typography>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* 特定プロジェクトを選んだときだけプロジェクト一覧表示 */}
          {destMode === 'specific' && (
            <Box sx={{ mt: 1.5 }}>
              {/* 公開設定 */}
              <FormControl sx={{ mb: 1.5 }}>
                <RadioGroup row value={destVisibility} onChange={(e) => setDestVisibility(e.target.value as 'private' | 'public')}>
                  <FormControlLabel value="private"
                    control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
                    label={<Typography sx={{ fontSize: 12 }}>非公開（Private）</Typography>} sx={{ mr: 2 }} />
                  <FormControlLabel value="public"
                    control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: ACCENT } }} />}
                    label={<Typography sx={{ fontSize: 12 }}>公開（Public）</Typography>} />
                </RadioGroup>
              </FormControl>
              {/* プロジェクト一覧 */}
              <Box sx={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                {myProjects.length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', px: 1.5, pt: 1, pb: 0.25, textTransform: 'uppercase', letterSpacing: 0.8 }}>My Projects</Typography>
                    {myProjects.map((p) => (
                      <Box key={p.id} onClick={() => setDestSelectedProjectId(p.id)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 0.875, cursor: 'pointer',
                          bgcolor: destSelectedProjectId === p.id ? 'rgba(236,64,122,0.12)' : 'transparent',
                          borderLeft: `2px solid ${destSelectedProjectId === p.id ? ACCENT : 'transparent'}`,
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: destSelectedProjectId === p.id ? ACCENT : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 13, color: destSelectedProjectId === p.id ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: destSelectedProjectId === p.id ? 600 : 400 }}>{p.name}</Typography>
                        {destSelectedProjectId === p.id && <CheckCircleOutlineRoundedIcon sx={{ fontSize: 15, color: ACCENT, ml: 'auto' }} />}
                      </Box>
                    ))}
                  </>
                )}
                {teamProjects.length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', px: 1.5, pt: 1, pb: 0.25, textTransform: 'uppercase', letterSpacing: 0.8 }}>Team Projects</Typography>
                    {teamProjects.map((p) => (
                      <Box key={p.id} onClick={() => setDestSelectedProjectId(p.id)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 0.875, cursor: 'pointer',
                          bgcolor: destSelectedProjectId === p.id ? 'rgba(236,64,122,0.12)' : 'transparent',
                          borderLeft: `2px solid ${destSelectedProjectId === p.id ? ACCENT : 'transparent'}`,
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: destSelectedProjectId === p.id ? ACCENT : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 13, color: destSelectedProjectId === p.id ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: destSelectedProjectId === p.id ? 600 : 400 }}>{p.name}</Typography>
                        {destSelectedProjectId === p.id && <CheckCircleOutlineRoundedIcon sx={{ fontSize: 15, color: ACCENT, ml: 'auto' }} />}
                      </Box>
                    ))}
                  </>
                )}
                {allProjects.length === 0 && (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
                    プロジェクトがありません
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          <Typography sx={{ mt: 1.5, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            既存マテリアルと重複するテクスチャはスキップします
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setPendingImages(null)} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" onClick={handleDestConfirm}
            disabled={destMode === 'specific' && !destSelectedProjectId}
            sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
            生成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 全重複ダイアログ */}
      <Dialog open={!!allDupDialog} onClose={() => setAllDupDialog(null)}
        PaperProps={{ sx: { bgcolor: '#1a1d24', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>生成をスキップしました</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            全 {allDupDialog?.count} 件が既存マテリアルと重複しているため、生成できませんでした。
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mt: 1 }}>
            別のソースを選択するか、既存マテリアルを削除してから再実行してください。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAllDupDialog(null)}
            sx={{ bgcolor: ACCENT, color: '#fff', textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      {/* 生成完了ダイアログ */}
      <Dialog open={!!genResultDialog} onClose={() => setGenResultDialog(null)}
        PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 420, maxWidth: 520 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlineRoundedIcon sx={{ color: '#4caf50', fontSize: 22 }} />
          マテリアルを生成しました
        </DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          {/* 生成件数サマリ */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1, bgcolor: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 2, px: 2, py: 1.25, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#4caf50', lineHeight: 1 }}>{genResultDialog?.created ?? 0}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>生成</Typography>
            </Box>
            {(genResultDialog?.skipped ?? 0) > 0 && (
              <Box sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, px: 2, py: 1.25, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>{genResultDialog?.skipped ?? 0}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                  <SkipNextRoundedIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }} />
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>重複スキップ</Typography>
                </Box>
              </Box>
            )}
          </Box>
          {/* スキップ説明 */}
          {(genResultDialog?.skipped ?? 0) > 0 && (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mb: 1.5, lineHeight: 1.6 }}>
              重複スキップとは、選択したテクスチャグループのうち同名のマテリアルがすでに存在していたためスキップ（再生成しなかった）ものです。
            </Typography>
          )}
          {/* 生成済み一覧 */}
          {(genResultDialog?.createdItems?.length ?? 0) > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', mb: 0.75 }}>生成されたマテリアル</Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.07)' }}>
                <List dense disablePadding>
                  {genResultDialog?.createdItems.map((item, i) => (
                    <ListItem key={item.id} divider={i < (genResultDialog.createdItems.length - 1)}
                      sx={{ px: 2, py: 0.75, '& .MuiDivider-root': { borderColor: 'rgba(255,255,255,0.05)' } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4caf50', mr: 1.5, flexShrink: 0 }} />
                      <ListItemText
                        primary={item.title}
                        primaryTypographyProps={{ sx: { fontSize: 13, color: '#fff', fontWeight: 500 } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setGenResultDialog(null)}
            sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>
            閉じる
          </Button>
          <Button variant="contained" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => { setGenResultDialog(null); setDetail(null); }}
            sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }}>
            S.Materialで確認
          </Button>
        </DialogActions>
      </Dialog>

      {/* 類似検出しきい値ダイアログ */}
      <Dialog open={simThresholdDialog} onClose={() => setSimThresholdDialog(false)}
        PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 420 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>類似検出の設定</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', mb: 2.5, lineHeight: 1.6 }}>
            テクスチャ画像の 64 ビットハッシュを比較して、何ビット以内の差異なら「類似」とみなすか設定します。
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 1 }}>
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography sx={{ fontSize: 28, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
                {simThresholdBits}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>ビット</Typography>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>
                ({(simThresholdBits / 64 * 100).toFixed(1)}%)
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Slider
                value={simThresholdBits}
                onChange={(_, v) => setSimThresholdBits(v as number)}
                min={1} max={20} step={1}
                marks={[
                  { value: 2, label: '3%' },
                  { value: 8, label: '12.5%' },
                  { value: 16, label: '25%' },
                ]}
                sx={{
                  color: ACCENT,
                  '& .MuiSlider-markLabel': { color: 'rgba(255,255,255,0.35)', fontSize: 10 },
                  '& .MuiSlider-mark': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>厳格（ほぼ完全一致のみ）</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>緩い（多少の差も類似と判定）</Typography>
          </Box>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1.5, px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              推奨: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>8 ビット（12.5%）</strong> — 人の目では区別しにくいもの<br />
              3 ビット以下: ほぼ同一画像のみ / 16 ビット以上: 色調が似ているものも含む
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSimThresholdDialog(false)} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="warning"
            startIcon={simDetectProgress ? <CircularProgress size={14} color="inherit" /> : <DeleteSweepRoundedIcon />}
            disabled={!!simDetectProgress}
            onClick={() => { setSimThresholdDialog(false); detectSimilarMaterials(simThresholdBits); }}
            sx={{ textTransform: 'none' }}>
            検出開始
          </Button>
        </DialogActions>
      </Dialog>

      {/* 一括削除確認ダイアログ */}
      <Dialog open={!!bulkDeleteConfirm} onClose={() => !deletingBulk && setBulkDeleteConfirm(null)}
        PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 380 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
          {bulkDeleteConfirm?.length ?? 0} 件のマテリアルを削除
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>
            選択したマテリアルを削除します。この操作は元に戻せません。
          </Typography>
          <Box sx={{ maxHeight: 220, overflowY: 'auto', bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 1.5, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {(bulkDeleteConfirm || []).map((m) => {
              const meta = DSMT_CATEGORY_META[m.category] || DSMT_CATEGORY_META.other;
              return (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef5350', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1 }} noWrap>{displayTitle(m.title)}</Typography>
                  <Chip label={meta.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: `${meta.color}22`, color: meta.color, borderRadius: 0.75 }} />
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBulkDeleteConfirm(null)} disabled={deletingBulk} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="error" disabled={deletingBulk} onClick={handleBulkDeleteConfirm}
            sx={{ textTransform: 'none' }}>
            {deletingBulk ? '削除中...' : `${bulkDeleteConfirm?.length ?? 0} 件を削除する`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 類似素材削除確認ダイアログ */}
      <Dialog open={!!simDeleteDialog} onClose={() => setSimDeleteDialog(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0f1115', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15 }}>
          視覚的に類似するマテリアルを検出 — {simDeleteDialog?.groups.length ?? 0} グループ / {simDeleteDialog?.totalDelete ?? 0} 件削除
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 1.5 }}>
            テクスチャ画像の模様・明暗を 64 ビットで比較し、差異 12.5% 以内（人の目では区別困難）のマテリアルを検出しました。各グループから 1 件残して削除します。
          </Typography>
          <Box sx={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {simDeleteDialog?.groups.map((g, i) => (
              <Box key={i} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1.5, px: 1.5, py: 1.25, border: '1px solid rgba(255,255,255,0.07)' }}>
                {/* サムネイル比較行 */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
                  {[g.keep, ...g.remove].slice(0, 5).map((m, j) => {
                    const imgUrl = m.maps?.albedo || m.thumbnailUrl;
                    return (
                      <Box key={m.id} sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                        <Box sx={{ position: 'relative', width: 52, height: 52 }}>
                          {imgUrl ? (
                            <Box component="img" src={imgUrl} alt={m.title || ''}
                              sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 1,
                                border: `2px solid ${j === 0 ? '#4caf50' : '#ef5350'}`,
                                opacity: j === 0 ? 1 : 0.7 }}
                            />
                          ) : (
                            <Box sx={{ width: 52, height: 52, borderRadius: 1, bgcolor: m.params?.baseColor || '#555',
                              border: `2px solid ${j === 0 ? '#4caf50' : '#ef5350'}`, opacity: j === 0 ? 1 : 0.7 }} />
                          )}
                          <Box sx={{ position: 'absolute', bottom: 1, left: 1, right: 1, fontSize: 8, fontWeight: 700,
                            color: '#fff', bgcolor: j === 0 ? 'rgba(76,175,80,0.9)' : 'rgba(239,83,80,0.9)',
                            textAlign: 'center', borderRadius: 0.5, lineHeight: 1.6 }}>
                            {j === 0 ? '残す' : '削除'}
                          </Box>
                        </Box>
                        <Typography noWrap sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', maxWidth: 52 }}>
                          {displayTitle(m.title)}
                        </Typography>
                      </Box>
                    );
                  })}
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', ml: 0.5, pt: 0.5 }}>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      類似度: {64 - g.minDist}/64 ビット一致
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                      ({Math.round((1 - g.minDist / 64) * 100)}% 同一)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSimDeleteDialog(null)} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" color="error" onClick={handleSimDeleteConfirm}
            sx={{ textTransform: 'none' }}>
            削除する ({simDeleteDialog?.totalDelete ?? 0} 件)
          </Button>
        </DialogActions>
      </Dialog>

      {/* 生成中プログレスバー */}
      {(isGenerating || seeding) && genProgress && (
        <Box sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1400,
          bgcolor: '#1a1d24', borderTop: '1px solid rgba(255,255,255,0.1)',
          px: 3, py: 1.25,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              マテリアルを生成中: {genProgress.label}
            </Typography>
            <Typography sx={{ fontSize: 12, color: ACCENT, fontWeight: 700, flexShrink: 0 }}>
              {genProgress.total > 0 ? Math.round((genProgress.current / genProgress.total) * 100) : 0}%
              &nbsp;({genProgress.current} / {genProgress.total})
            </Typography>
          </Box>
          <LinearProgress
            variant={genProgress.total > 0 ? 'determinate' : 'indeterminate'}
            value={genProgress.total > 0 ? (genProgress.current / genProgress.total) * 100 : undefined}
            sx={{
              borderRadius: 2, height: 6,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 2 },
            }}
          />
        </Box>
      )}
    </Box>
  );
};
