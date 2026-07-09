import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, InputBase, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import WeekendRoundedIcon from '@mui/icons-material/WeekendRounded';
import { useDskStore } from './store/useDskStore';
import { SourceRegistryList } from './add/SourceRegistryList';
import { SourceRegistryFilterPanel } from './add/SourceRegistryFilterPanel';
import { DEFAULT_REGISTRY_FILTER, type RegistryFilter } from './data/sourceRegistry';
import { IndexedProductsView } from './catalog/IndexedProductsView';
import { BrainView } from './brain/BrainView';
import { canIngestRag } from './lib/shelfClassify';
import { DskEntryCard } from './DskEntryCard';
import { DskWebArticleCard } from './DskWebArticleCard';
import { DskRightPanel } from './components/DskRightPanel';
import { DskBookViewer } from './components/DskBookViewer';
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
  const [regFilter, setRegFilter] = useState<RegistryFilter>({ ...DEFAULT_REGISTRY_FILTER });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragProgress, setRagProgress] = useState('');
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

  const handleCardClick = (entry: typeof filtered[number]) => {
    if (ragSelectMode) {
      if (canRag(entry)) toggleRagSelection(entry.localId);
      return;
    }
    setSelectedId(entry.localId);
  };

  const handleSelectAllRag = () => {
    setRagSelection(filtered.filter(canRag).map((e) => e.localId));
  };

  const handleBulkIngest = async () => {
    if (!uid) { setToast({ msg: 'RAG取り込みにはログインが必要です', sev: 'error' }); return; }
    const targets = filtered.filter((e) => ragSelection.has(e.localId) && canRag(e));
    if (targets.length === 0) return;
    setRagBusy(true);
    let ok = 0; let fail = 0;
    for (const [i, entry] of targets.entries()) {
      try {
        setRagProgress(`(${i + 1}/${targets.length}) ${entry.title}`);
        // 1件あたり最大120秒。ハングしても次へ進めるよう全体にタイムアウトを設ける。
        await Promise.race([
          ingestEntryToRag(entry, uid),
          new Promise((_, rej) => setTimeout(() => rej(new Error('取り込みがタイムアウトしました')), 120000)),
        ]);
        ok++;
      } catch (e) {
        console.error('[DskDashboard] bulk ingest failed', entry.title, e);
        fail++;
      }
    }
    setRagBusy(false);
    setRagProgress('');
    clearRagSelection();
    setRagSelectMode(false);
    setToast({ msg: `RAG取り込み完了: 成功 ${ok} 件${fail ? ` / 失敗 ${fail} 件` : ''}`, sev: fail ? 'info' : 'success' });
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
      {/* Main column */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {view === 'brain' ? (
          <BrainView />
        ) : view === 'products' ? (
          <IndexedProductsView />
        ) : view === 'registry' ? (
          <Box sx={{ p: 3, overflowY: 'auto', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <WeekendRoundedIcon sx={{ fontSize: 22, color: '#7dd3fc' }} />
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>おすすめソースを追加</Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', mb: 2 }}>
              家具・テクスチャ・イメージ事例・建材の厳選ソースを、自分のライブラリに追加。家具は追加でそのまま端末内に商品索引が作られ、SEKKEIYA Search や S.Models 照合で使えます。
            </Typography>
            <SourceRegistryList filter={regFilter} />
          </Box>
        ) : (
         <>
        {/* Toolbar */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                Knowledge Library · ローカル専用
              </Typography>
              <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700, mt: 0.25 }}>
                S.Library
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={ragSelectMode ? 'contained' : 'outlined'} size="small" startIcon={<AutoStoriesRoundedIcon />}
                onClick={() => setRagSelectMode(!ragSelectMode)}
                sx={ragSelectMode
                  ? { bgcolor: RAG_PURPLE, color: '#fff', '&:hover': { bgcolor: '#9333ea' } }
                  : { color: '#c4a3f7', borderColor: 'rgba(168,85,247,0.5)', '&:hover': { borderColor: RAG_PURPLE, bgcolor: 'rgba(168,85,247,0.08)' } }}
              >
                {ragSelectMode ? '選択を終了' : 'RAGソースを選択'}
              </Button>
              <Button
                variant={view === 'registry' ? 'contained' : 'outlined'} size="small" startIcon={<WeekendRoundedIcon />}
                onClick={() => setView('registry')}
                sx={view === 'registry'
                  ? { bgcolor: '#38bdf8', color: '#04293a', '&:hover': { bgcolor: '#7dd3fc' } }
                  : { color: '#7dd3fc', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}
              >
                おすすめソースを追加
              </Button>
              <Button
                variant="outlined" size="small" startIcon={<FolderOpenRoundedIcon />}
                onClick={handleOpenSLibrary}
                sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: ACCENT } }}
              >
                保存先ローカルフォルダを開く
              </Button>
              <Button
                variant="contained" size="small" startIcon={<AddRoundedIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: '#4db6ac' } }}
              >
                知識を追加
              </Button>
            </Box>
          </Box>

          {/* RAG選択モードのバー */}
          {ragSelectMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'rgba(168,85,247,0.12)', border: `1px solid ${RAG_PURPLE}55` }}>
              <AutoStoriesRoundedIcon sx={{ color: RAG_PURPLE, fontSize: 18 }} />
              <Typography sx={{ fontSize: 12.5, color: '#fff', fontWeight: 600 }}>
                RAGソースに選択中: {ragSelection.size} 件
              </Typography>
              <Button size="small" startIcon={<CheckBoxRoundedIcon />} onClick={handleSelectAllRag} sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                知識をすべて選択
              </Button>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                ※「商品」ソースは対象外（商品索引化へ）
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained" size="small" disabled={ragBusy || ragSelection.size === 0}
                startIcon={ragBusy ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoStoriesRoundedIcon />}
                onClick={handleBulkIngest}
                sx={{ bgcolor: RAG_PURPLE, color: '#fff', '&:hover': { bgcolor: '#9333ea' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' } }}
              >
                {ragBusy ? (ragProgress || '取り込み中…') : `選択をRAGに取り込み（${ragSelection.size}）`}
              </Button>
            </Box>
          )}

          {/* Search */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', maxWidth: 360 }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="タイトル・著者・タグ・要約を検索"
              sx={{ color: '#fff', fontSize: 13, flex: 1 }}
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
                <WeekendRoundedIcon sx={{ fontSize: 22, color: '#7dd3fc' }} />
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>まずはおすすめソースを追加</Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', mb: 2 }}>
                家具・インテリアECを追加すると、そのまま端末内に商品索引が作られ、SEKKEIYA Search の家具検索や S.Models の商品照合で使えます。
                本・PDF・メモは右上の「知識を追加」から登録できます。
              </Typography>
              <SourceRegistryList />
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'rgba(255,255,255,0.4)' }}>
              <LocalLibraryRoundedIcon sx={{ fontSize: 56, opacity: 0.4 }} />
              <Typography sx={{ fontSize: 14 }}>条件に一致する知識がありません。</Typography>
            </Box>
          ) : kindFilter === 'url' ? (
            // Web 一覧は S.Blog ホームと同じニュースカード表示（サムネ / 媒体バッジ / 記事を読む）
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5, p: 3, alignContent: 'start' }}>
              {filtered.map((entry) => (
                <DskWebArticleCard
                  key={entry.localId}
                  entry={entry}
                  active={selectedId === entry.localId}
                  ragSelectMode={ragSelectMode}
                  ragSelected={ragSelection.has(entry.localId)}
                  ragDisabled={!canRag(entry)}
                  onClick={() => handleCardClick(entry)}
                  onDelete={entry.isLocalFile ? undefined : () => setDeleteTarget(entry.localId)}
                />
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2, p: 3, alignContent: 'start' }}>
              {filtered.map((entry) => (
                <DskEntryCard
                  key={entry.localId}
                  entry={entry}
                  active={selectedId === entry.localId}
                  ragSelectMode={ragSelectMode}
                  ragSelected={ragSelection.has(entry.localId)}
                  ragDisabled={!canRag(entry)}
                  onClick={() => handleCardClick(entry)}
                  onOpen={() => {
                    if (entry.kind === 'book' || entry.kind === 'pdf') setViewerId(entry.localId);
                    else if (entry.isLocalFile && entry.filePath) {
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
        <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.07)', bgcolor: 'rgba(0,0,0,0.15)' }}>
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

      {/* Book viewer */}
      {viewerEntry && (
        <DskBookViewer entry={viewerEntry} onClose={() => setViewerId(null)} />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: '#161a1a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>削除の確認</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
            この知識を削除しますか？ローカルのフォルダごと削除され、元に戻せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={handleConfirmDelete} disabled={deleting} variant="contained" color="error">
            {deleting ? '削除中...' : '削除'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
