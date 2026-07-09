/**
 * DsmDashboard — S.Movie シーケンスエディタ
 *
 * レイアウトは S.Presents（DspEditor）の構造に統一:
 *   ヘッダー（48px・タイトル＋保存/書き出しステータス）
 *   → リボンツールバー（素材 / トランジション / テロップ / 音声 / 表示 / 書き出し）
 *   → 中央プレビュー ＋ 下部「カットシーケンス」ドック（ドラッグでリサイズ）
 *   → 右プロパティパネル（プロパティ）
 *
 * 左サイドバー（プロジェクトナビ）は DsmSidebar が担う。
 * ビジュアルシグネチャ: カット尺・全体尺を建築図面の「寸法線」で表示（青図ブルー）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Button, Slider, InputBase, Stack,
  CircularProgress, LinearProgress, Divider,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AspectRatioRoundedIcon from '@mui/icons-material/AspectRatioRounded';
import StayCurrentPortraitRoundedIcon from '@mui/icons-material/StayCurrentPortraitRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import GradientRoundedIcon from '@mui/icons-material/GradientRounded';
import TonalityRoundedIcon from '@mui/icons-material/TonalityRounded';
import DragHandleRoundedIcon from '@mui/icons-material/DragHandleRounded';
import ViewCarouselRoundedIcon from '@mui/icons-material/ViewCarouselRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BRAND } from '../../styles/theme';
import { useAppStore } from '../../store/useAppStore';
import { useDsmStore, type DsmDraftClip, type DsmAspect } from './store/useDsmStore';
import { needsFfmpegSetup, downloadFfmpeg } from './services/ffmpegService';
import { totalSequenceDuration, effectiveClipDuration } from './services/movieComposeArgs';
import type { MovieTransitionType } from './types';
import { MaterialPickerDialog } from './components/MaterialPickerDialog';

// デザイントークン（docs/14 §4 — S.Movie アクセント）
const ACCENT = '#C98A4B';        // 木材アンバー = アクション
const BLUEPRINT = '#7FA6C9';     // 青図ブルー = 技術情報・寸法線
const MONO = '"JetBrains Mono", "Roboto Mono", Consolas, monospace';

const fmtSec = (s: number) => `${s.toFixed(1)}s`;

// ── リボン UI（DspToolbar と同じ作法）─────────────────────────────────────────
const RibbonGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Stack spacing={0.5} alignItems="center" sx={{ px: 1.5, height: '100%', borderRight: `1px solid ${BRAND.line}`, minWidth: 60, flexShrink: 0 }}>
    <Stack direction="row" spacing={0} sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Stack>
    <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.6rem', mb: 0.5 }}>{label}</Typography>
  </Stack>
);

const RibbonButton: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; color?: string; bgcolor?: string;
}> = ({ icon, label, onClick, disabled, color, bgcolor }) => (
  <Button
    disabled={disabled}
    onClick={onClick}
    sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minWidth: 44, height: 48, p: 0.5, borderRadius: 1, flexShrink: 0,
      color: disabled ? BRAND.sub2 : (color || BRAND.text),
      bgcolor: bgcolor || 'transparent',
      '&:hover': { bgcolor: bgcolor ? `${bgcolor}dd` : 'rgba(255,255,255,0.05)' },
      '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
    }}
  >
    {icon}
    <Typography variant="caption" sx={{ fontSize: '0.55rem', mt: 0.5, lineHeight: 1, textTransform: 'none' }}>{label}</Typography>
  </Button>
);

// ── 寸法線（dimension line）─────────────────────────────────────────────────
const DimensionLine: React.FC<{ label: string; emphasized?: boolean }> = ({ label, emphasized }) => (
  <Box sx={{ position: 'relative', height: 16, mt: 0.5, mx: 0.25, opacity: emphasized ? 1 : 0.85 }}>
    <Box sx={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: '1px', bgcolor: BLUEPRINT }} />
    <Box sx={{ position: 'absolute', right: 0, top: 2, bottom: 2, width: '1px', bgcolor: BLUEPRINT }} />
    <Box sx={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', bgcolor: BLUEPRINT }} />
    <Typography sx={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      px: 0.6, fontSize: emphasized ? 11 : 10, fontFamily: MONO, lineHeight: 1,
      color: BLUEPRINT, bgcolor: BRAND.bg, whiteSpace: 'nowrap', fontWeight: emphasized ? 700 : 500,
    }}>
      {label}
    </Typography>
  </Box>
);

// ── トランジションノード（カット間の ◇）────────────────────────────────────
const TRANSITION_CYCLE: MovieTransitionType[] = ['cut', 'xfade', 'fade'];
const TRANSITION_LABEL: Record<MovieTransitionType, string> = {
  cut: 'カット', xfade: 'Xフェード', fade: '黒フェード',
};

const TransitionNode: React.FC<{ clip: DsmDraftClip }> = ({ clip }) => {
  const setTransition = useDsmStore(s => s.setTransition);
  const type = clip.transitionAfter?.type ?? 'cut';
  const dur = clip.transitionAfter?.durationSec ?? 1.0;
  const next = TRANSITION_CYCLE[(TRANSITION_CYCLE.indexOf(type) + 1) % TRANSITION_CYCLE.length];
  return (
    <Tooltip title={`${TRANSITION_LABEL[type]}${type !== 'cut' ? ` ${dur}s` : ''} — クリックで切替`} placement="top">
      <Box
        onClick={() => setTransition(clip.id, { type: next, durationSec: dur })}
        sx={{
          alignSelf: 'center', mx: 0.5, cursor: 'pointer', flexShrink: 0,
          width: 22, height: 22, transform: 'rotate(45deg)', borderRadius: '4px',
          border: `1.5px solid ${type === 'cut' ? 'rgba(255,255,255,0.25)' : ACCENT}`,
          bgcolor: type === 'cut' ? 'transparent' : `${ACCENT}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}22` },
        }}
      >
        <Typography sx={{
          transform: 'rotate(-45deg)', fontSize: 9, fontFamily: MONO, lineHeight: 1,
          color: type === 'cut' ? 'rgba(255,255,255,0.5)' : ACCENT, fontWeight: 700,
        }}>
          {type === 'cut' ? '|' : type === 'xfade' ? 'X' : 'F'}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// ── シーケンスのカットカード（ドラッグ並び替え対応）──────────────────────────
const CutCard: React.FC<{ clip: DsmDraftClip; index: number; assetSrc?: string }> = ({ clip, index, assetSrc }) => {
  const selectedClipId = useDsmStore(s => s.selectedClipId);
  const setSelectedClipId = useDsmStore(s => s.setSelectedClipId);
  const selected = selectedClipId === clip.id;
  const dur = effectiveClipDuration(clip);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedClipId(clip.id)}
      sx={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : 1,
        width: 150, flexShrink: 0, cursor: 'grab', userSelect: 'none',
      }}
    >
      <Box sx={{
        borderRadius: 2, overflow: 'hidden', position: 'relative',
        border: `1.5px solid ${selected ? ACCENT : 'rgba(255,255,255,0.12)'}`,
        boxShadow: selected ? `0 0 10px ${ACCENT}55` : 'none',
        bgcolor: 'rgba(0,0,0,0.35)', transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: selected ? ACCENT : 'rgba(255,255,255,0.3)' },
      }}>
        <Box sx={{ height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0d0c0b' }}>
          {assetSrc ? (
            <video src={assetSrc} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          ) : (
            <MovieRoundedIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 30 }} />
          )}
          <Typography sx={{
            position: 'absolute', top: 4, left: 6, fontSize: 10, fontFamily: MONO,
            color: '#fff', bgcolor: 'rgba(0,0,0,0.6)', px: 0.6, borderRadius: 1, lineHeight: 1.6,
          }}>
            {String(index + 1).padStart(2, '0')}
          </Typography>
          {clip.trim && (
            <Typography sx={{
              position: 'absolute', top: 4, right: 6, fontSize: 9, fontFamily: MONO,
              color: ACCENT, bgcolor: 'rgba(0,0,0,0.6)', px: 0.5, borderRadius: 1, lineHeight: 1.7,
            }}>
              TRIM
            </Typography>
          )}
        </Box>
        <Typography noWrap sx={{ px: 1, py: 0.5, fontSize: 11, color: selected ? '#fff' : 'rgba(255,255,255,0.75)', fontWeight: selected ? 600 : 400 }}>
          {clip.label || clip.path.split(/[\\/]/).pop()}
        </Typography>
      </Box>
      <DimensionLine label={clip.durationSec > 0 || clip.trim ? fmtSec(dur) : '--'} />
    </Box>
  );
};

// ── インスペクタ共通要素 ─────────────────────────────────────────────────────
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 1 }}>
    {children}
  </Typography>
);

const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void; step?: number }> = ({ label, value, onChange, step = 0.1 }) => (
  <Box sx={{ flex: 1 }}>
    <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', mb: 0.25 }}>{label}</Typography>
    <InputBase
      type="number"
      value={value}
      inputProps={{ step, min: 0 }}
      onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v) && v >= 0) onChange(v); }}
      sx={{
        width: '100%', px: 1, py: 0.25, fontSize: 12, fontFamily: MONO, color: '#fff',
        bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)',
        '&:focus-within': { borderColor: ACCENT },
      }}
    />
  </Box>
);

// ═══════════════════════════════════════════════════════════════════════════════
export interface DsmDashboardProps {
  payload?: { projectId?: string; workspaceId?: string; workspaceName?: string };
}

const SEQ_MIN = 120;
const SEQ_MAX = 360;
const SEQ_DEFAULT = 188;

const DsmEditor: React.FC<DsmDashboardProps & { onBack: () => void }> = ({ payload, onBack }) => {
  const clips = useDsmStore(s => s.clips);
  const overlays = useDsmStore(s => s.overlays);
  const bgm = useDsmStore(s => s.bgm);
  const aspect = useDsmStore(s => s.aspect);
  const fps = useDsmStore(s => s.fps);
  const selectedClipId = useDsmStore(s => s.selectedClipId);
  const isExporting = useDsmStore(s => s.isExporting);
  const exportProgress = useDsmStore(s => s.exportProgress);
  const lastOutputPath = useDsmStore(s => s.lastOutputPath);
  const lastError = useDsmStore(s => s.lastError);
  const projectPath = useDsmStore(s => s.projectPath);
  const isDirty = useDsmStore(s => s.isDirty);
  const {
    addClip, removeClip, reorderClips, updateClip, setTransition,
    setBgm, addOverlay, removeOverlay, setAspect, setSelectedClipId, exportDraft,
    saveDraft, loadDraftFromFile,
  } = useDsmStore.getState();

  const [isSaving, setIsSaving] = useState(false);
  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveDraft();
    } catch (err) {
      useDsmStore.setState({ lastError: `保存に失敗しました: ${String(err)}` });
    } finally {
      setIsSaving(false);
    }
  }, [saveDraft]);
  const handleOpenProject = useCallback(async () => {
    await loadDraftFromFile(); // 失敗時は store.lastError に反映される
  }, [loadDraftFromFile]);

  // 素材は LocalAssets/Movies。サムネ表示のため src を引けるようにしておく
  const [assetSrcByPath, setAssetSrcByPath] = useState<Map<string, string>>(new Map());
  const refreshAssetSrcs = useCallback(async () => {
    try {
      const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
      const all: any[] = await invoke('list_local_image_assets');
      const map = new Map<string, string>();
      all.filter(a => a.mediaType === 'video').forEach(a => map.set(a.path, convertFileSrc(String(a.path))));
      setAssetSrcByPath(map);
    } catch (e) {
      console.error('[DsmDashboard] 素材プレビューの解決に失敗', e);
    }
  }, []);
  useEffect(() => { refreshAssetSrcs(); }, [refreshAssetSrcs]);

  // 追加済みクリップでまだ src 未解決のものを convertFileSrc で補完（ファイル直接追加分）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = clips.filter(c => !assetSrcByPath.has(c.path));
      if (missing.length === 0) return;
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      if (cancelled) return;
      setAssetSrcByPath(prev => {
        const next = new Map(prev);
        missing.forEach(c => { if (!next.has(c.path)) next.set(c.path, convertFileSrc(c.path)); });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [clips, assetSrcByPath]);

  const usedPaths = useMemo(() => new Set(clips.map(c => c.path)), [clips]);

  // ── 素材ピッカー ──────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const handleAddFromPicker = useCallback((asset: { path: string; name: string; durationSec: number }) => {
    addClip({ path: asset.path, label: asset.name, durationSec: asset.durationSec });
  }, [addClip]);

  // ── BGM 選択 ──────────────────────────────────────────────────
  const handlePickBgm = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({
        multiple: false,
        filters: [{ name: '音声', extensions: ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg'] }],
      });
      if (picked) setBgm({ path: String(picked), volume: bgm?.volume ?? 0.35 });
    } catch (e) {
      console.error('[DsmDashboard] BGM選択に失敗', e);
    }
  }, [setBgm, bgm?.volume]);

  // ── FFmpeg 初回セットアップ ───────────────────────────────────
  const [ffmpegMissing, setFfmpegMissing] = useState(false);
  const [ffmpegDlPct, setFfmpegDlPct] = useState<number | null>(null);
  useEffect(() => { needsFfmpegSetup().then(setFfmpegMissing).catch(() => {}); }, []);
  const handleDownloadFfmpeg = useCallback(async () => {
    setFfmpegDlPct(0);
    try {
      await downloadFfmpeg(p => setFfmpegDlPct(p.phase === 'extracting' ? 100 : p.pct));
      setFfmpegMissing(false);
    } catch (e) {
      console.error('[DsmDashboard] FFmpeg ダウンロード失敗', e);
    } finally {
      setFfmpegDlPct(null);
    }
  }, []);

  // ── 並び替え（dnd-kit）───────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = useDsmStore.getState().clips.map(c => c.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    reorderClips(next);
  }, [reorderClips]);

  // ── 書き出し ─────────────────────────────────────────────────
  const [showResult, setShowResult] = useState(false);
  const handleExport = useCallback(async () => {
    try {
      await exportDraft();
      setShowResult(true);
      refreshAssetSrcs();
    } catch { /* lastError に入る */ }
  }, [exportDraft, refreshAssetSrcs]);

  const handleRevealOutput = useCallback(async () => {
    if (!lastOutputPath) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(lastOutputPath);
    } catch (e) {
      console.error('[DsmDashboard] フォルダ表示に失敗', e);
    }
  }, [lastOutputPath]);

  // ── 派生値 ───────────────────────────────────────────────────
  const totalSec = useMemo(() => totalSequenceDuration(clips), [clips]);
  const selectedClip = clips.find(c => c.id === selectedClipId) ?? null;
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const target = showResult && lastOutputPath ? lastOutputPath : selectedClip?.path;
      if (!target) { setPreviewSrc(null); return; }
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      if (!cancelled) setPreviewSrc(convertFileSrc(target));
    })();
    return () => { cancelled = true; };
  }, [selectedClip?.path, showResult, lastOutputPath]);

  // ── 下部シーケンスドックのリサイズ ──────────────────────────
  const [seqHeight, setSeqHeight] = useState(SEQ_DEFAULT);
  const seqDragRef = useRef<{ y: number; h: number } | null>(null);
  const onSeqDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    seqDragRef.current = { y: e.clientY, h: seqHeight };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [seqHeight]);
  const onSeqDragMove = useCallback((e: React.PointerEvent) => {
    if (!seqDragRef.current) return;
    const dy = seqDragRef.current.y - e.clientY;
    setSeqHeight(Math.min(SEQ_MAX, Math.max(SEQ_MIN, seqDragRef.current.h + dy)));
  }, []);
  const onSeqDragEnd = useCallback(() => { seqDragRef.current = null; }, []);

  // 右プロパティドックの開閉
  const [rightOpen, setRightOpen] = useState(true);

  // テロップ追加フォーム
  const [titleText, setTitleText] = useState('');
  const addTitle = () => {
    if (!titleText.trim()) return;
    addOverlay({ type: 'title', text: titleText.trim(), atSec: 0, durationSec: 3 });
    setTitleText('');
  };

  const projectName = payload?.workspaceName || 'シーケンス';
  const lastTransitionType = clips.length >= 2 ? (clips[clips.length - 2].transitionAfter?.type ?? 'cut') : null;

  // 全カット間に同一トランジションを一括適用（リボンの素早い操作用）
  const applyTransitionAll = (type: MovieTransitionType) => {
    const list = useDsmStore.getState().clips;
    list.slice(0, -1).forEach(c => setTransition(c.id, { type, durationSec: c.transitionAfter?.durationSec ?? 1.0 }));
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden', bgcolor: BRAND.bg }}>

      {/* ══ 左カラム: ヘッダー + リボン + 中央（プレビュー＋シーケンス）══ */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ══ ヘッダー ════════════════════════════════════════════ */}
      <Box sx={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: 'rgba(10,10,14,0.6)', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}
            sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 'auto', textTransform: 'none', mr: 0.5, '&:hover': { color: '#fff' } }}>
            ダッシュボード
          </Button>
          <MovieFilterRoundedIcon sx={{ color: ACCENT, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: ACCENT, fontWeight: 600 }}>{projectName}</Typography>
          <Typography sx={{ fontSize: 11, fontFamily: MONO, color: BLUEPRINT }}>
            {clips.length} cuts ・ {fmtSec(totalSec)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* プロジェクト保存ステータス（.smovie.json） */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.4)' }}>
            {clips.length === 0 ? (
              <><FiberManualRecordRoundedIcon sx={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }} /><Typography variant="caption">シーケンスなし</Typography></>
            ) : isDirty ? (
              <><FiberManualRecordRoundedIcon sx={{ fontSize: 9, color: '#ff9800' }} /><Typography variant="caption">未保存の変更</Typography></>
            ) : projectPath ? (
              <><SaveRoundedIcon sx={{ fontSize: 14, color: '#81c784' }} /><Typography variant="caption" sx={{ color: '#81c784' }}>保存済</Typography></>
            ) : (
              <><FiberManualRecordRoundedIcon sx={{ fontSize: 9, color: '#ff9800' }} /><Typography variant="caption">未保存</Typography></>
            )}
          </Box>
          {/* プロジェクトを開く */}
          <Tooltip title="プロジェクトを開く（.smovie.json）">
            <IconButton size="small" onClick={handleOpenProject}
              sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: ACCENT } }}>
              <FolderOpenRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {/* プロジェクトを保存 */}
          <Tooltip title={projectPath ? '上書き保存（.smovie.json）' : '名前を付けて保存（.smovie.json）'}>
            <span>
              <IconButton size="small" onClick={handleSaveProject} disabled={clips.length === 0 || isSaving}
                sx={{ color: isDirty ? ACCENT : 'rgba(255,255,255,0.6)', '&:hover': { color: ACCENT },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' } }}>
                {isSaving ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <SaveRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={rightOpen ? 'プロパティを隠す' : 'プロパティを表示'}>
            <IconButton size="small" onClick={() => setRightOpen(o => !o)}
              sx={{ color: rightOpen ? ACCENT : 'rgba(255,255,255,0.5)', '&:hover': { color: ACCENT } }}>
              <ViewSidebarRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Box sx={{ width: 1, height: 20, bgcolor: 'rgba(255,255,255,0.1)' }} />
          <Button
            variant="contained"
            size="small"
            disabled={clips.length === 0 || isExporting || ffmpegMissing}
            onClick={handleExport}
            startIcon={isExporting ? <CircularProgress size={14} sx={{ color: '#191815' }} /> : <DownloadRoundedIcon />}
            sx={{
              bgcolor: ACCENT, color: '#191815', fontWeight: 700, fontSize: 12, px: 2, borderRadius: 2, textTransform: 'none',
              '&:hover': { bgcolor: '#daa05f' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {isExporting ? `書き出し中 ${exportProgress ? `${exportProgress.pct}%` : ''}` : '書き出し'}
          </Button>
        </Box>
      </Box>

      {/* ══ リボンツールバー ════════════════════════════════════ */}
      <Box sx={{ bgcolor: BRAND.bg, borderBottom: `1px solid ${BRAND.line}` }}>
        <Box sx={{ borderBottom: `1px solid ${BRAND.line}`, px: 2 }}>
          <Typography sx={{ fontSize: '0.7rem', color: BRAND.text, fontWeight: 700, py: 0.6 }}>ホーム</Typography>
        </Box>
        <Box sx={{ height: 72, display: 'flex', alignItems: 'center', overflowX: 'auto', bgcolor: 'rgba(0,0,0,0.1)',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { background: BRAND.line, borderRadius: 4 },
        }}>
          <RibbonGroup label="素材">
            <RibbonButton icon={<AddRoundedIcon />} label="クリップ追加" onClick={() => setPickerOpen(true)} color={ACCENT} />
          </RibbonGroup>

          <RibbonGroup label="トランジション（全体）">
            <RibbonButton icon={<ContentCutRoundedIcon />} label="カット" onClick={() => applyTransitionAll('cut')} disabled={clips.length < 2}
              color={lastTransitionType === 'cut' ? ACCENT : undefined} bgcolor={lastTransitionType === 'cut' ? `${ACCENT}1f` : undefined} />
            <RibbonButton icon={<GradientRoundedIcon />} label="Xフェード" onClick={() => applyTransitionAll('xfade')} disabled={clips.length < 2}
              color={lastTransitionType === 'xfade' ? ACCENT : undefined} bgcolor={lastTransitionType === 'xfade' ? `${ACCENT}1f` : undefined} />
            <RibbonButton icon={<TonalityRoundedIcon />} label="黒フェード" onClick={() => applyTransitionAll('fade')} disabled={clips.length < 2}
              color={lastTransitionType === 'fade' ? ACCENT : undefined} bgcolor={lastTransitionType === 'fade' ? `${ACCENT}1f` : undefined} />
          </RibbonGroup>

          <RibbonGroup label="テロップ">
            <RibbonButton icon={<TitleRoundedIcon />} label="タイトル" onClick={() => addOverlay({ type: 'title', text: '物件名', atSec: 0, durationSec: 3 })} />
          </RibbonGroup>

          <RibbonGroup label="音声">
            <RibbonButton icon={<MusicNoteRoundedIcon />} label={bgm ? 'BGM変更' : 'BGM追加'} onClick={handlePickBgm}
              color={bgm ? ACCENT : undefined} bgcolor={bgm ? `${ACCENT}1f` : undefined} />
          </RibbonGroup>

          <RibbonGroup label="表示">
            <RibbonButton icon={<AspectRatioRoundedIcon />} label="16:9" onClick={() => setAspect('16:9')}
              color={aspect === '16:9' ? BLUEPRINT : undefined} bgcolor={aspect === '16:9' ? 'rgba(127,166,201,0.15)' : undefined} />
            <RibbonButton icon={<StayCurrentPortraitRoundedIcon />} label="9:16" onClick={() => setAspect('9:16')}
              color={aspect === '9:16' ? BLUEPRINT : undefined} bgcolor={aspect === '9:16' ? 'rgba(127,166,201,0.15)' : undefined} />
          </RibbonGroup>

          <RibbonGroup label="書き出し">
            <RibbonButton icon={<DownloadRoundedIcon />} label="書き出し" onClick={handleExport} disabled={clips.length === 0 || isExporting || ffmpegMissing} color={ACCENT} />
          </RibbonGroup>
        </Box>
      </Box>

      {/* FFmpeg セットアップバナー */}
      {ffmpegMissing && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1, bgcolor: `${ACCENT}1a`, borderBottom: `1px solid ${ACCENT}55`, flexShrink: 0 }}>
          <DownloadRoundedIcon sx={{ color: ACCENT, fontSize: 18 }} />
          <Typography sx={{ fontSize: 12, color: '#fff', flex: 1 }}>
            動画の書き出しには FFmpeg が必要です（初回のみ・自動セットアップ）
          </Typography>
          {ffmpegDlPct != null ? (
            <Box sx={{ width: 160, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress variant="determinate" value={ffmpegDlPct} sx={{ flex: 1, '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
              <Typography sx={{ fontSize: 11, fontFamily: MONO, color: ACCENT }}>{ffmpegDlPct}%</Typography>
            </Box>
          ) : (
            <Button size="small" onClick={handleDownloadFfmpeg} sx={{ color: ACCENT, fontWeight: 700, fontSize: 12 }}>セットアップ</Button>
          )}
        </Box>
      )}

      {/* ══ 中央（プレビュー＋シーケンス）══ */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 書き出し結果 / エラー帯 */}
          {lastError && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 0.75, bgcolor: 'rgba(244,67,54,0.12)', borderBottom: '1px solid rgba(244,67,54,0.4)', flexShrink: 0 }}>
              <Typography noWrap sx={{ fontSize: 11, color: '#ff8a80', flex: 1 }}>書き出しエラー: {lastError.split('\n')[0]}</Typography>
            </Box>
          )}
          {showResult && lastOutputPath && !isExporting && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 0.75, bgcolor: 'rgba(129,199,132,0.1)', borderBottom: '1px solid rgba(129,199,132,0.35)', flexShrink: 0 }}>
              <Typography noWrap sx={{ fontSize: 11, color: '#a5d6a7', flex: 1, fontFamily: MONO }}>✓ {lastOutputPath}</Typography>
              <Button size="small" startIcon={<FolderOpenRoundedIcon />} onClick={handleRevealOutput} sx={{ color: '#a5d6a7', fontSize: 11, flexShrink: 0 }}>フォルダを開く</Button>
              <IconButton size="small" onClick={() => setShowResult(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
            </Box>
          )}

          {/* プレビュー */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#0d0c0b' }}>
            {previewSrc ? (
              <Box sx={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex' }}>
                <video key={previewSrc} src={previewSrc} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, outline: '1px solid rgba(255,255,255,0.1)' }} />
                {showResult && lastOutputPath && (
                  <Typography sx={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontFamily: MONO, fontWeight: 700, color: '#191815', bgcolor: ACCENT, px: 0.75, py: 0.25, borderRadius: 1 }}>EXPORT</Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <MovieRoundedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.12)', mb: 1 }} />
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  {clips.length === 0 ? 'リボンの「クリップ追加」から素材を選んでください' : 'カットを選択するとプレビューが表示されます'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* ── 下部ドック：カットシーケンス（ドラッグでリサイズ）── */}
          <Box sx={{ flexShrink: 0, height: seqHeight, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(10,10,14,0.92)', borderTop: `1px solid ${BRAND.line}`, overflow: 'hidden' }}>
            {/* ドラッグハンドル */}
            <Box
              onPointerDown={onSeqDragStart}
              onPointerMove={onSeqDragMove}
              onPointerUp={onSeqDragEnd}
              onPointerLeave={onSeqDragEnd}
              sx={{
                flexShrink: 0, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'ns-resize', bgcolor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                userSelect: 'none', gap: 1, '&:hover': { bgcolor: `${ACCENT}11` },
              }}
            >
              <DragHandleRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }} />
              <ViewCarouselRoundedIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                カットシーケンス
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', px: 2, pt: 1.5, pb: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', flex: 1, minHeight: 0 }}>
                {clips.length === 0 ? (
                  <Box sx={{ flex: 1, minHeight: 110, borderRadius: 2, border: '1.5px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Button startIcon={<AddRoundedIcon />} onClick={() => setPickerOpen(true)} sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'none' }}>
                      カットを追加して動画を組み立てる
                    </Button>
                  </Box>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      {clips.map((clip, i) => (
                        <React.Fragment key={clip.id}>
                          <CutCard clip={clip} index={i} assetSrc={assetSrcByPath.get(clip.path)} />
                          {i < clips.length - 1 && <TransitionNode clip={clip} />}
                        </React.Fragment>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </Box>
              {clips.length > 0 && <DimensionLine label={`TOTAL ${fmtSec(totalSec)}`} emphasized />}
            </Box>
          </Box>
        </Box>
      </Box>
      {/* ── 左カラム終わり ── */}

      {/* ══ 右プロパティパネル（3DSM プロパティ位置・赤枠全高）════════ */}
      {rightOpen && (
        <Box sx={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.line}` }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>プロパティ</Typography>
          </Box>

          <Box sx={{ p: 2, flex: 1 }}>
            {/* 選択カット or シーケンス設定 */}
            {selectedClip ? (
              <Box sx={{ mb: 2.5 }}>
                <SectionTitle>カット {clips.findIndex(c => c.id === selectedClip.id) + 1}</SectionTitle>
                <Typography noWrap sx={{ fontSize: 13, color: '#fff', fontWeight: 600, mb: 0.25 }}>
                  {selectedClip.label || selectedClip.path.split(/[\\/]/).pop()}
                </Typography>
                <Typography noWrap sx={{ fontSize: 10, fontFamily: MONO, color: 'rgba(255,255,255,0.35)', mb: 1.5 }}>
                  {selectedClip.path}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <NumField label="IN (s)" value={selectedClip.trim?.inSec ?? 0}
                    onChange={(v) => updateClip(selectedClip.id, { trim: { inSec: v, outSec: selectedClip.trim?.outSec ?? (selectedClip.durationSec || v + 1) } })} />
                  <NumField label="OUT (s)" value={selectedClip.trim?.outSec ?? (selectedClip.durationSec || 0)}
                    onChange={(v) => updateClip(selectedClip.id, { trim: { inSec: selectedClip.trim?.inSec ?? 0, outSec: v } })} />
                </Box>
                {selectedClip.trim && (
                  <Button size="small" onClick={() => updateClip(selectedClip.id, { trim: undefined })} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 1, p: 0, textTransform: 'none' }}>
                    トリムを解除
                  </Button>
                )}

                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', mb: 0.5, mt: 1 }}>次のカットへのトランジション</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                  {TRANSITION_CYCLE.map(t => {
                    const active = (selectedClip.transitionAfter?.type ?? 'cut') === t;
                    const isLast = clips[clips.length - 1]?.id === selectedClip.id;
                    return (
                      <Box key={t}
                        onClick={() => !isLast && setTransition(selectedClip.id, { type: t, durationSec: selectedClip.transitionAfter?.durationSec ?? 1.0 })}
                        sx={{
                          px: 1, py: 0.4, borderRadius: 1.5, cursor: isLast ? 'not-allowed' : 'pointer', fontSize: 11,
                          color: active ? '#191815' : 'rgba(255,255,255,0.65)',
                          bgcolor: active ? ACCENT : 'rgba(255,255,255,0.06)',
                          fontWeight: active ? 700 : 500, opacity: isLast ? 0.35 : 1,
                          '&:hover': !isLast ? { bgcolor: active ? ACCENT : 'rgba(255,255,255,0.12)' } : {},
                        }}
                      >
                        {TRANSITION_LABEL[t]}
                      </Box>
                    );
                  })}
                </Box>
                {selectedClip.transitionAfter && selectedClip.transitionAfter.type !== 'cut' && clips[clips.length - 1]?.id !== selectedClip.id && (
                  <Box sx={{ mb: 1.5 }}>
                    <NumField label="トランジション尺 (s)" value={selectedClip.transitionAfter.durationSec}
                      onChange={(v) => setTransition(selectedClip.id, { type: selectedClip.transitionAfter!.type, durationSec: v })} />
                  </Box>
                )}

                <Button size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => removeClip(selectedClip.id)}
                  sx={{ fontSize: 11, color: '#ff8a80', p: 0.5, textTransform: 'none', '&:hover': { bgcolor: 'rgba(244,67,54,0.1)' } }}>
                  カットを削除
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 2.5 }}>
                <SectionTitle>シーケンス設定</SectionTitle>
                <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
                  {(['16:9', '9:16'] as DsmAspect[]).map(a => (
                    <Box key={a} onClick={() => setAspect(a)}
                      sx={{
                        flex: 1, textAlign: 'center', py: 0.6, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontFamily: MONO,
                        color: aspect === a ? '#191815' : 'rgba(255,255,255,0.6)',
                        bgcolor: aspect === a ? BLUEPRINT : 'rgba(255,255,255,0.06)', fontWeight: aspect === a ? 700 : 500,
                      }}>
                      {a}
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, fontFamily: MONO }}>
                  {aspect === '16:9' ? '1920×1080' : '1080×1920'} / {fps}fps / H.264
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 1 }}>
                  シーケンスのカットを選択すると、トリムやトランジションをここで編集できます。
                </Typography>
              </Box>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', my: 2 }} />

            {/* BGM */}
            <Box sx={{ mb: 2.5 }}>
              <SectionTitle>BGM</SectionTitle>
              {bgm ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <MusicNoteRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
                    <Typography noWrap sx={{ fontSize: 12, color: '#fff', flex: 1 }}>{bgm.path.split(/[\\/]/).pop()}</Typography>
                    <IconButton size="small" onClick={() => setBgm(null)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>音量</Typography>
                  <Slider size="small" value={bgm.volume ?? 0.35} min={0} max={1} step={0.05}
                    onChange={(_, v) => setBgm({ ...bgm, volume: v as number })} sx={{ color: ACCENT, py: 0.5 }} />
                </Box>
              ) : (
                <Button size="small" startIcon={<MusicNoteRoundedIcon />} onClick={handlePickBgm}
                  sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 2, px: 1.5, textTransform: 'none', '&:hover': { borderColor: ACCENT, color: '#fff' } }}>
                  BGM を選択…
                </Button>
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', my: 2 }} />

            {/* テロップ */}
            <Box sx={{ mb: 2.5 }}>
              <SectionTitle>テロップ</SectionTitle>
              {overlays.map((o, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <TitleRoundedIcon sx={{ fontSize: 14, color: BLUEPRINT }} />
                  <Typography noWrap sx={{ fontSize: 12, color: '#fff', flex: 1 }}>{o.text}</Typography>
                  <Typography sx={{ fontSize: 10, fontFamily: MONO, color: BLUEPRINT }}>{o.atSec}–{o.atSec + o.durationSec}s</Typography>
                  <IconButton size="small" onClick={() => removeOverlay(i)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseRoundedIcon sx={{ fontSize: 13 }} /></IconButton>
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1 }}>
                <InputBase
                  placeholder="冒頭タイトル（3秒）"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTitle(); }}
                  sx={{ flex: 1, px: 1, py: 0.4, fontSize: 12, color: '#fff', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)', '&:focus-within': { borderColor: ACCENT } }}
                />
                <IconButton size="small" disabled={!titleText.trim()} onClick={addTitle}
                  sx={{ color: ACCENT, border: `1px solid ${ACCENT}66`, borderRadius: 1.5, '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.1)' } }}>
                  <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          </Box>

          {/* フッター: ローカル完結の明示（docs/14 §0.5） */}
          <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BRAND.line}` }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
              書き出し先: SEKKEIYA/LocalAssets/Movies/（ローカルのみ・クラウドへは自動アップロードしません）
            </Typography>
          </Box>
        </Box>
      )}

      {/* 素材ピッカー */}
      <MaterialPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} usedPaths={usedPaths} onAdd={handleAddFromPicker} />
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MovieGallery — ダッシュボード画面（完成動画の一覧）。
// 左サイドバー（DsmSidebar）のスコープに連動して表示ソースを切り替える:
//   local_movies → LocalAssets/Movies（Tauri）
//   project_movies / team_project_movies → プロジェクトの動画（Firestore workFiles）
//   global/public/private → 動画はローカル管理が原則のため空表示（docs/14 §0.5）
// ═══════════════════════════════════════════════════════════════════════════════
interface GalleryMovie {
  id: string;
  name: string;
  path: string;         // ローカルはfsパス、クラウドはURL
  src: string;          // 再生用 URL（asset:// or https）
  durationSec: number | null;
  origin?: string;      // 'S.Layout' 等の出所バッジ
  isLocal: boolean;
}

const MovieGallery: React.FC<{ onOpenEditor: () => void }> = ({ onOpenEditor }) => {
  const dsmScope = useAppStore((s) => s.dsmScope) as string;
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const clearDraft = useDsmStore(s => s.clearDraft);
  const addClip = useDsmStore(s => s.addClip);
  const [movies, setMovies] = useState<GalleryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (dsmScope === 'local_movies') {
        const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
        const all: any[] = await invoke('list_local_image_assets');
        setMovies(all.filter(a => a.mediaType === 'video').map(a => ({
          id: a.id, name: a.name, path: String(a.path), src: convertFileSrc(String(a.path)), durationSec: null, isLocal: true,
        })));
      } else if ((dsmScope === 'project_movies' || dsmScope === 'team_project_movies') && activeProjectId) {
        const { listProjectAssets } = await import('../sites/projectAssetsApi');
        const assets: any[] = await listProjectAssets(activeProjectId).catch(() => []);
        const vids = assets.filter(a => a.mediaType === 'video' || a.kind === 'video' || a.type === 'video');
        setMovies(vids.map((a, i) => {
          const url = a.downloadUrl || a.url || a.src || '';
          return {
            id: a.id || String(i),
            name: a.title || a.name || `動画 ${i + 1}`,
            path: url, src: url,
            durationSec: a.durationSec ?? null,
            origin: a.sourceType === 'layout-render' ? 'S.Layout' : undefined,
            isLocal: false,
          };
        }));
      } else {
        setMovies([]);
      }
    } catch (e) {
      console.error('[MovieGallery] 動画一覧の取得に失敗', e);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [dsmScope, activeProjectId]);
  useEffect(() => { load(); setSelectedId(null); }, [load]);

  const selected = movies.find(m => m.id === selectedId) ?? null;

  // ダブルクリック: その Movie をエディターで開く（新規シーケンスに 1 クリップとして読み込む）
  const openInEditor = useCallback((m: GalleryMovie) => {
    clearDraft();
    addClip({ path: m.path, label: m.name.replace(/\.[^.]+$/, ''), durationSec: m.durationSec ?? 0 });
    onOpenEditor();
  }, [clearDraft, addClip, onOpenEditor]);

  const handleReveal = useCallback(async (m: GalleryMovie) => {
    if (!m.isLocal) return;
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(m.path);
    } catch (e) {
      console.error('[MovieGallery] フォルダ表示に失敗', e);
    }
  }, []);

  const scopeLabel: Record<string, string> = {
    local_movies: 'ローカル素材 — LocalAssets/Movies',
    project_movies: 'プロジェクトの動画',
    team_project_movies: 'チームプロジェクトの動画',
    global_movies: 'Movie（公開フィード）',
    global_projects: 'Public Projects',
    my_public_movies: 'Public Movie',
    my_private_movies: 'Private Movie',
  };
  const isCloudScope = !['local_movies', 'project_movies', 'team_project_movies'].includes(dsmScope);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden', bgcolor: BRAND.bg }}>
      {/* ══ 左カラム: ヘッダー + グリッド ══ */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <Box sx={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MovieFilterRoundedIcon sx={{ color: ACCENT, fontSize: 20 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>S.Movie</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{scopeLabel[dsmScope] ?? '動画'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="再読み込み">
            <IconButton size="small" onClick={load} sx={{ color: 'rgba(255,255,255,0.5)' }}><RefreshRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<MovieFilterRoundedIcon />} onClick={() => { clearDraft(); onOpenEditor(); }}
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, fontSize: 12, px: 2, borderRadius: 2, textTransform: 'none', '&:hover': { bgcolor: '#daa05f' } }}>
            新規シーケンス
          </Button>
        </Box>
      </Box>

        {/* グリッド */}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: 3 }} onClick={() => setSelectedId(null)}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
          ) : isCloudScope ? (
            <Box sx={{ textAlign: 'center', py: 10, color: 'rgba(255,255,255,0.4)' }}>
              <MovieRoundedIcon sx={{ fontSize: 52, mb: 1.5, opacity: 0.35 }} />
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>このスコープには動画がありません</Typography>
              <Typography sx={{ fontSize: 12, lineHeight: 1.8 }}>
                S.Movie の動画はローカル管理が原則です（容量・コスト配慮）。<br />
                共有用の公開動画は将来対応予定です。
              </Typography>
            </Box>
          ) : movies.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10, color: 'rgba(255,255,255,0.4)' }}>
              <MovieRoundedIcon sx={{ fontSize: 52, mb: 1.5, opacity: 0.35 }} />
              <Typography sx={{ fontSize: 14, mb: 2 }}>まだ動画がありません</Typography>
              <Button variant="outlined" startIcon={<MovieFilterRoundedIcon />} onClick={(e) => { e.stopPropagation(); clearDraft(); onOpenEditor(); }}
                sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}11` } }}>
                新規シーケンスを作成
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
              {movies.map(m => {
                const isSel = m.id === selectedId;
                return (
                  <Box key={m.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(m.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); openInEditor(m); }}
                    sx={{
                      borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                      border: `1.5px solid ${isSel ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: isSel ? `0 0 12px ${ACCENT}55` : 'none',
                      bgcolor: 'rgba(255,255,255,0.03)', transition: 'all 0.15s',
                      '&:hover': { borderColor: ACCENT, '& .play': { opacity: 1 } },
                    }}>
                    <Box sx={{ height: 125, bgcolor: '#0d0c0b', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {m.src ? <video src={m.src} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MovieRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.2)' }} />}
                      <PlayCircleFilledRoundedIcon className="play" sx={{ position: 'absolute', fontSize: 40, color: '#fff', opacity: 0, transition: 'opacity 0.15s', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))', pointerEvents: 'none' }} />
                      {m.origin && (
                        <Typography sx={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontFamily: MONO, fontWeight: 700, color: '#191815', bgcolor: BLUEPRINT, px: 0.6, borderRadius: 1 }}>{m.origin}</Typography>
                      )}
                    </Box>
                    <Box sx={{ p: 1.25 }}>
                      <Typography noWrap sx={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{m.name}</Typography>
                      {m.durationSec != null && <Typography sx={{ fontSize: 10, fontFamily: MONO, color: BLUEPRINT }}>{fmtSec(m.durationSec)}</Typography>}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
      {/* ── 左カラム終わり ── */}

      {/* ══ 右情報パネル（3DSM プロパティ位置・赤枠全高）══ */}
      <Box sx={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.line}` }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>プロパティ</Typography>
          </Box>
          {selected ? (
            <Box sx={{ p: 2 }}>
              {/* プレビュー */}
              <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#0d0c0b', mb: 1.5, aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selected.src
                  ? <video key={selected.src} src={selected.src} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <MovieRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.2)' }} />}
              </Box>
              <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 600, mb: 0.5, wordBreak: 'break-all' }}>{selected.name}</Typography>
              {selected.origin && (
                <Typography sx={{ display: 'inline-block', fontSize: 9, fontFamily: MONO, fontWeight: 700, color: '#191815', bgcolor: BLUEPRINT, px: 0.6, borderRadius: 1, mb: 1 }}>{selected.origin} で生成</Typography>
              )}
              <Box sx={{ mt: 1, mb: 2 }}>
                {selected.durationSec != null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>長さ</Typography>
                    <Typography sx={{ fontSize: 11, fontFamily: MONO, color: BLUEPRINT }}>{fmtSec(selected.durationSec)}</Typography>
                  </Box>
                )}
                <Box sx={{ py: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 0.25 }}>{selected.isLocal ? 'パス' : 'URL'}</Typography>
                  <Typography sx={{ fontSize: 10, fontFamily: MONO, color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all' }}>{selected.path}</Typography>
                </Box>
              </Box>

              <Button fullWidth variant="contained" startIcon={<MovieFilterRoundedIcon />} onClick={() => openInEditor(selected)}
                sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, fontSize: 12, borderRadius: 2, textTransform: 'none', mb: 1, '&:hover': { bgcolor: '#daa05f' } }}>
                このMovieを編集
              </Button>
              {selected.isLocal && (
                <Button fullWidth size="small" startIcon={<FolderOpenRoundedIcon />} onClick={() => handleReveal(selected)}
                  sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, '&:hover': { borderColor: ACCENT, color: '#fff' } }}>
                  フォルダを開く
                </Button>
              )}
              <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', mt: 1.5, lineHeight: 1.6 }}>
                ダブルクリックでもエディターを開けます。
              </Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
              <MovieRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)', mb: 1 }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                Movie を選択すると<br />情報が表示されます
              </Typography>
            </Box>
          )}
        </Box>
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DsmDashboard — ダッシュボード/エディターのルーター（dsmShellMode で切替）。
// ═══════════════════════════════════════════════════════════════════════════════
export const DsmDashboard: React.FC<DsmDashboardProps> = ({ payload }) => {
  const shellMode = useAppStore((s) => s.dsmShellMode);
  const setDsmShellMode = useAppStore((s) => s.setDsmShellMode);

  if (shellMode === 'editor') {
    return <DsmEditor payload={payload} onBack={() => setDsmShellMode('dashboard')} />;
  }
  return <MovieGallery onOpenEditor={() => setDsmShellMode('editor')} />;
};

export default DsmDashboard;
