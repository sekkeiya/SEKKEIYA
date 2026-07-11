import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, InputBase, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import WeekendRoundedIcon from '@mui/icons-material/WeekendRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import { useDskStore } from './store/useDskStore';
import { SourceRegistryList } from './add/SourceRegistryList';
import { SourceRegistryFilterPanel } from './add/SourceRegistryFilterPanel';
import { DEFAULT_REGISTRY_FILTER, type RegistryFilter } from './data/sourceRegistry';
import { IndexedProductsView } from './catalog/IndexedProductsView';
import { BrainView } from './brain/BrainView';
import { canIngestRag } from './lib/shelfClassify';
import { DskEntryCard } from './DskEntryCard';
import { DskRightPanel } from './components/DskRightPanel';
import { DskBookViewer } from './components/DskBookViewer';
import { DskLawViewer } from './law/DskLawViewer';
import { AddLawDialog } from './law/AddLawDialog';
import { AddEntryDialog } from './add/AddEntryDialog';
import { openLocalFileExternally } from './lib/localFiles';
import { getSLibraryPath } from './api/knowledgeApi';
import { ingestEntryToRag } from './lib/ragIngest';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';

const ACCENT = '#26a69a';
const RAG_PURPLE = '#a855f7';

interface DskDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
}

export const DskDashboard: React.FC<DskDashboardProps> = ({ payload }) => {
  const {
    entries, loading, refresh,
    view, setView,
    registryFocus, setRegistryFocus,
    kindFilter,
    categoryFilter,
    projectFilter,
    search, setSearch,
    selectedId, setSelectedId,
    viewerId, setViewerId,
    remove,
    ragSelectMode, setRagSelectMode,
    ragSelection, toggleRagSelection, setRagSelection, clearRagSelection,
  } = useDskStore();

  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);

  const [addOpen, setAddOpen] = useState(false);
  const [lawOpen, setLawOpen] = useState(false);
  const [regFilter, setRegFilter] = useState<RegistryFilter>({ ...DEFAULT_REGISTRY_FILTER });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 複数選択（Shift=範囲 / Ctrl(⌘)=トグル）＋ 一括削除。
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const multiAnchorRef = useRef<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<string[] | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragProgress, setRagProgress] = useState('');
  /** 一括RAG取り込みの結果ダイアログ（トーストだと見逃すため明示表示） */
  const [ragReport, setRagReport] = useState<{ ok: number; failures: { title: string; msg: string }[] } | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => { refresh(); }, [refresh]);

  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(300);
    return () => setAiTaskInnerRight(0);
  }, [setAiTaskInnerRight]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (projectFilter && !e.linkedProjectIds.includes(projectFilter)) return false;
      if (q) {
        const hay = `${e.title} ${e.author ?? ''} ${e.tags.join(' ')} ${e.summary ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, kindFilter, categoryFilter, projectFilter, search]);

  const selected = useMemo(() => entries.find(e => e.localId === selectedId) || null, [entries, selectedId]);
  const viewerEntry = useMemo(() => entries.find(e => e.localId === viewerId) || null, [entries, viewerId]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await remove(deleteTarget);
      setDeleteTarget(null);
    } catch (e) {
      console.error('[DskDashboard] delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  // S.Library の保存先ローカルフォルダ（S.Library\Local）を Explorer で開く。
  const handleOpenSLibrary = async () => {
    try {
      const dir = await getSLibraryPath();
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(dir);
    } catch (e) {
      console.error('[DskDashboard] open local folder failed', e);
      setToast({ msg: '保存先ローカルフォルダを開けませんでした（ログインが必要です）', sev: 'error' });
    }
  };

  // RAG に取り込めるエントリ＝「知識」の棚かつ本文/URLを持つもの。
  // 「商品」の棚（家具・素材のEC/カタログ）は自動的に対象外にし、商品索引化へ誘導する。
  const canRag = (e: typeof filtered[number]) => canIngestRag(e);

  const handleCardClick = (entry: typeof filtered[number], e?: React.MouseEvent) => {
    if (ragSelectMode) {
      if (canRag(entry)) toggleRagSelection(entry.localId);
      return;
    }
    const id = entry.localId;
    if (e?.shiftKey) {
      e.preventDefault();
      const ordered = filtered.map((x) => x.localId);
      const anchor = multiAnchorRef.current ?? id;
      const a = ordered.indexOf(anchor);
      const b = ordered.indexOf(id);
      if (a < 0 || b < 0) { multiAnchorRef.current = id; setMultiSelectedIds(new Set([id])); return; }
      setMultiSelectedIds(new Set(ordered.slice(Math.min(a, b), Math.max(a, b) + 1)));
      return;
    }
    if (e?.ctrlKey || e?.metaKey) {
      e.preventDefault();
      multiAnchorRef.current = id;
      setMultiSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
      return;
    }
    multiAnchorRef.current = id;
    if (multiSelectedIds.size > 0) setMultiSelectedIds(new Set());
    setSelectedId(id);
  };

  // 選択中をまとめて削除（isLocalFile はスキャン専用で削除不可のため除外）。
  const openBulkDelete = () => {
    const ids = filtered.filter((e) => multiSelectedIds.has(e.localId) && !e.isLocalFile).map((e) => e.localId);
    if (ids.length) setBulkDeleteConfirm(ids);
  };
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteConfirm || deletingBulk) return;
    const ids = bulkDeleteConfirm;
    setDeletingBulk(true);
    setBulkDeleteConfirm(null);
    try {
      for (const id of ids) {
        try { await remove(id); } catch (err) { console.warn('[DskDashboard] bulk delete skipped', id, err); }
      }
      setMultiSelectedIds(new Set());
    } finally { setDeletingBulk(false); }
  };

  // ESC で選択解除 / Delete で選択中をまとめて削除（確認ダイアログ経由）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ragSelectMode) return;
      if (deleteTarget || bulkDeleteConfirm || addOpen || lawOpen || viewerId || ragReport) return;
      if (e.key === 'Escape') {
        if (multiSelectedIds.size > 0) { e.preventDefault(); setMultiSelectedIds(new Set()); }
        else if (selectedId) { e.preventDefault(); setSelectedId(null); }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const src = multiSelectedIds.size > 0
          ? filtered.filter((x) => multiSelectedIds.has(x.localId))
          : (selectedId ? filtered.filter((x) => x.localId === selectedId) : []);
        const ids = src.filter((x) => !x.isLocalFile).map((x) => x.localId);
        if (ids.length) { e.preventDefault(); setBulkDeleteConfirm(ids); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ragSelectMode, deleteTarget, bulkDeleteConfirm, addOpen, lawOpen, viewerId, ragReport, multiSelectedIds, selectedId, filtered]);

  const handleSelectAllRag = () => {
    setRagSelection(filtered.filter(canRag).map((e) => e.localId));
  };

  const handleBulkIngest = async () => {
    if (!uid) { setToast({ msg: 'RAG取り込みにはログインが必要です', sev: 'error' }); return; }
    const targets = filtered.filter((e) => ragSelection.has(e.localId) && canRag(e));
    if (targets.length === 0) return;
    setRagBusy(true);
    let ok = 0;
    const failures: { title: string; msg: string }[] = [];
    for (const [i, entry] of targets.entries()) {
      try {
        setRagProgress(`(${i + 1}/${targets.length}) ${entry.title}`);
        // 1件あたり最大120秒。ハングしても次へ進めるよう全体にタイムアウトを設ける。
        await Promise.race([
          ingestEntryToRag(entry, uid),
          new Promise((_, rej) => setTimeout(() => rej(new Error('取り込みがタイムアウトしました')), 120000)),
        ]);
        ok++;
      } catch (e: any) {
        console.error('[DskDashboard] bulk ingest failed', entry.title, e);
        failures.push({ title: entry.title, msg: `${e?.message ?? e}` });
      }
    }
    setRagBusy(false);
    setRagProgress('');
    clearRagSelection();
    setRagSelectMode(false);
    setRagReport({ ok, failures });
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default', position: 'relative' }}>
      {/* Main column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {view === 'brain' ? (
          <BrainView />
        ) : view === 'products' ? (
          <IndexedProductsView />
        ) : view === 'registry' ? (
          <Box sx={{ p: 3, overflowY: 'auto', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {registryFocus === 'catalog'
                ? <CollectionsBookmarkRoundedIcon sx={{ fontSize: 22, color: 'light-dark(#0f9d58, #86efac)' }} />
                : <WeekendRoundedIcon sx={{ fontSize: 22, color: 'light-dark(#0474a9, #7dd3fc)' }} />}
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-fg)' }}>
                {registryFocus === 'catalog' ? 'メーカー電子カタログ' : 'おすすめソースを追加'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 2 }}>
              {registryFocus === 'catalog'
                ? '壁紙・床材・タイル等メーカーの電子カタログ。「サイトを開く」で確認し、使うメーカーをライブラリに追加（購読）できます。画像の入手・利用は各メーカーの利用条件に従ってください。'
                : '家具・テクスチャ・イメージ事例・建材の厳選ソースを、自分のライブラリに追加。家具は追加でそのまま端末内に商品索引が作られ、SEKKEIYA Search や S.Model 照合で使えます。'}
            </Typography>
            <SourceRegistryList filter={regFilter} focus={registryFocus} />
          </Box>
        ) : (
         <>
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                Knowledge Library · ローカル専用
              </Typography>
              <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25 }}>
                S.Library
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={ragSelectMode ? 'contained' : 'outlined'} size="small" startIcon={<AutoStoriesRoundedIcon />}
                onClick={() => setRagSelectMode(!ragSelectMode)}
                sx={ragSelectMode
                  ? { bgcolor: RAG_PURPLE, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#9333ea' } }
                  : { color: 'light-dark(#470ea0, #c4a3f7)', borderColor: 'rgba(168,85,247,0.5)', '&:hover': { borderColor: RAG_PURPLE, bgcolor: 'rgba(168,85,247,0.08)' } }}
              >
                {ragSelectMode ? '選択を終了' : 'RAGソースを選択'}
              </Button>
              <Button
                variant={view === 'registry' ? 'contained' : 'outlined'} size="small" startIcon={<WeekendRoundedIcon />}
                onClick={() => { setView('registry'); setRegistryFocus('all'); }}
                sx={view === 'registry'
                  ? { bgcolor: '#38bdf8', color: '#04293a', '&:hover': { bgcolor: '#7dd3fc' } }
                  : { color: 'light-dark(#0474a9, #7dd3fc)', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}
              >
                おすすめソースを追加
              </Button>
              <Button
                variant="outlined" size="small" startIcon={<FolderOpenRoundedIcon />}
                onClick={handleOpenSLibrary}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT } }}
              >
                保存先ローカルフォルダを開く
              </Button>
              <Button
                variant="outlined" size="small" startIcon={<GavelRoundedIcon />}
                onClick={() => setLawOpen(true)}
                sx={{ color: 'light-dark(#6d4c41, #bcaaa4)', borderColor: 'rgba(141,110,99,0.5)', '&:hover': { borderColor: '#8d6e63', bgcolor: 'rgba(141,110,99,0.08)' } }}
              >
                法令を取り込む
              </Button>
              <Button
                variant="contained" size="small" startIcon={<AddRoundedIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#4db6ac' } }}
              >
                知識を追加
              </Button>
            </Box>
          </Box>

          {/* RAG選択モードのバー */}
          {ragSelectMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'rgba(168,85,247,0.12)', border: `1px solid ${RAG_PURPLE}55` }}>
              <AutoStoriesRoundedIcon sx={{ color: RAG_PURPLE, fontSize: 18 }} />
              <Typography sx={{ fontSize: 12.5, color: 'var(--brand-fg)', fontWeight: 600 }}>
                RAGソースに選択中: {ragSelection.size} 件
              </Typography>
              <Button size="small" startIcon={<CheckBoxRoundedIcon />} onClick={handleSelectAllRag} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 11 }}>
                知識をすべて選択
              </Button>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                ※「商品」ソースは対象外（商品索引化へ）
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained" size="small" disabled={ragBusy || ragSelection.size === 0}
                startIcon={ragBusy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <AutoStoriesRoundedIcon />}
                onClick={handleBulkIngest}
                sx={{ bgcolor: RAG_PURPLE, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#9333ea' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
              >
                {ragBusy ? (ragProgress || '取り込み中…') : `選択をRAGに取り込み（${ragSelection.size}）`}
              </Button>
            </Box>
          )}

          {/* Search */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', maxWidth: 360 }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
            <InputBase
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="タイトル・著者・タグ・要約を検索"
              sx={{ color: 'var(--brand-fg)', fontSize: 13, flex: 1 }}
            />
          </Box>
        </Box>

        {/* Grid */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading && entries.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress sx={{ color: ACCENT }} />
            </Box>
          ) : entries.length === 0 ? (
            // 何も登録されていない＝オンボーディング。おすすめソースを主役に一覧表示。
            <Box sx={{ p: 3, overflowY: 'auto', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <WeekendRoundedIcon sx={{ fontSize: 22, color: 'light-dark(#0474a9, #7dd3fc)' }} />
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-fg)' }}>まずはおすすめソースを追加</Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 2 }}>
                家具・インテリアECを追加すると、そのまま端末内に商品索引が作られ、SEKKEIYA Search の家具検索や S.Model の商品照合で使えます。
                本・PDF・メモは右上の「知識を追加」から登録できます。
              </Typography>
              <SourceRegistryList />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <LocalLibraryRoundedIcon sx={{ fontSize: 56, opacity: 0.4 }} />
              <Typography sx={{ fontSize: 14 }}>条件に一致する知識がありません。</Typography>
            </Box>
          ) : (
            // 全種別とも S.Blog ホームと同じニュースカード表示に統一（サムネ / バッジ / タイトル / アクション）
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5, p: 3, alignContent: 'start' }}>
              {filtered.map((entry) => (
                <DskEntryCard
                  key={entry.localId}
                  entry={entry}
                  active={selectedId === entry.localId || multiSelectedIds.has(entry.localId)}
                  ragSelectMode={ragSelectMode}
                  ragSelected={ragSelection.has(entry.localId)}
                  ragDisabled={!canRag(entry)}
                  onClick={(e) => handleCardClick(entry, e)}
                  onOpen={() => {
                    // 内蔵ビューアで開けるのは実体が PDF のものと法令だけ。書類(kind 'pdf')でも
                    // docx/xlsx 等は OS 既定アプリで開く。
                    const isPdfFile = (entry.filePath || '').toLowerCase().endsWith('.pdf');
                    if (entry.kind === 'law') setViewerId(entry.localId);
                    else if (isPdfFile) setViewerId(entry.localId);
                    else if (entry.filePath) {
                      openLocalFileExternally(entry.filePath).catch((e) =>
                        console.error('[DskDashboard] open local file failed', e),
                      );
                    } else setSelectedId(entry.localId);
                  }}
                  onDelete={entry.isLocalFile ? undefined : () => setDeleteTarget(entry.localId)}
                />
              ))}
            </Box>
          )}
        </Box>
         </>
        )}
      </Box>

      {/* Right info panel（レジストリ=絞り込み / 索引商品=メインエリア詳細のため右パネル無し） */}
      {view !== 'products' && (
        <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', bgcolor: 'light-dark(rgba(15,23,42,0.05), rgba(0,0,0,0.15))' }}>
          {view === 'registry' ? (
            <SourceRegistryFilterPanel filter={regFilter} onChange={setRegFilter} />
          ) : (
            <DskRightPanel
              entry={selected}
              activeProjectId={payload?.projectId || null}
              onOpenViewer={(e) => setViewerId(e.localId)}
            />
          )}
        </Box>
      )}

      {/* Add dialog */}
      <AddEntryDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {/* 法令取り込み dialog */}
      <AddLawDialog open={lawOpen} onClose={() => setLawOpen(false)} />

      {/* Book / Law viewer */}
      {viewerEntry && (
        viewerEntry.kind === 'law'
          ? <DskLawViewer entry={viewerEntry} onClose={() => setViewerId(null)} />
          : <DskBookViewer entry={viewerEntry} onClose={() => setViewerId(null)} />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
            この知識を削除しますか？ローカルのフォルダごと削除され、元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleConfirmDelete} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 複数選択フローティングバー */}
      {multiSelectedIds.size > 0 && view !== 'brain' && view !== 'products' && view !== 'registry' && (
        <Box sx={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)',
          borderRadius: 3, px: 2.5, py: 1.25, boxShadow: '0 6px 32px rgba(0,0,0,0.6)',
        }}>
          <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)', fontWeight: 700 }}>{multiSelectedIds.size} 件選択中</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            Shift+クリックで範囲選択 / Ctrl+クリックで追加・解除 / ESCで解除
          </Typography>
          <Button size="small" onClick={() => setMultiSelectedIds(new Set())}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', minWidth: 0, ml: 0.5 }}>解除</Button>
          <Button size="small" variant="contained" color="error"
            startIcon={deletingBulk ? <CircularProgress size={13} color="inherit" /> : <DeleteOutlineRoundedIcon />}
            onClick={openBulkDelete} disabled={deletingBulk}
            sx={{ textTransform: 'none' }}>
            {deletingBulk ? '削除中...' : '削除'}
          </Button>
        </Box>
      )}

      {/* 一括削除の確認ダイアログ */}
      <Dialog open={!!bulkDeleteConfirm} onClose={() => !deletingBulk && setBulkDeleteConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>{bulkDeleteConfirm?.length ?? 0} 件の知識を削除</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }}>
            選択した知識を削除します。ローカルのフォルダごと削除され、元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setBulkDeleteConfirm(null)} disabled={deletingBulk} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleBulkDeleteConfirm} disabled={deletingBulk} variant="contained" color="error">
            {deletingBulk ? '削除中...' : `${bulkDeleteConfirm?.length ?? 0} 件を削除`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 一括RAG取り込みの結果ダイアログ（成功数＋失敗の内訳を明示的に残す） */}
      <Dialog open={!!ragReport} onClose={() => setRagReport(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420, maxWidth: 560 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          {ragReport && ragReport.failures.length === 0 ? 'RAG取り込みが完了しました' : 'RAG取り込み結果'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 13.5 }}>
            成功 {ragReport?.ok ?? 0} 件
            {ragReport && ragReport.failures.length > 0 ? ` / 失敗 ${ragReport.failures.length} 件` : ''}
          </Typography>
          {ragReport && ragReport.failures.length > 0 && (
            <Box sx={{ mt: 1.5, maxHeight: 220, overflowY: 'auto', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1.5, p: 1.25 }}>
              {ragReport.failures.map((f, i) => (
                <Box key={i} sx={{ mb: 1, '&:last-of-type': { mb: 0 } }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'light-dark(#b3261e, #f87171)' }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', wordBreak: 'break-word' }}>{f.msg}</Typography>
                </Box>
              ))}
            </Box>
          )}
          {ragReport && ragReport.failures.length > 0 && (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 11.5, mt: 1.5, lineHeight: 1.6 }}>
              失敗した資料は、通信状況を確認のうえ再度選択して取り込んでください。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="contained" onClick={() => setRagReport(null)}
            sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#4db6ac' } }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
