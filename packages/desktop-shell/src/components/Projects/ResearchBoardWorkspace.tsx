import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, IconButton, Tooltip, Menu, MenuItem, CircularProgress, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
} from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import { ResearchCanvas } from './ResearchCanvas';
import { MindMapCanvas } from './MindMapCanvas';
import {
  ResearchCanvasRepository,
  makeBoardKey,
  DEFAULT_BOARD_DOC_ID,
  type ResearchBoardMeta,
} from '../../features/projects/repositories/ResearchCanvasRepository';
import { registerResearchBoardManager } from '../../features/projects/chat/researchBoardBridge';

interface Props {
  /** ボードのスコープ（projectId または 'account'）。 */
  scope: string;
  /** 右サイドバーに出す内容（プロジェクト=活動フィード / 個人=横断メモ）。null で非表示。 */
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  /** 左のボード一覧サイドバーの幅。 */
  boardListWidth?: number;
}

/**
 * Research & Memo ワークスペース（複数ボード対応）。
 * 左にボード一覧サイドバー（一覧・新規作成・リネーム・削除）、メインに ResearchCanvas、
 * 右にサイドバー。ボードは scope（プロジェクト/個人）ごとに複数持てる。
 * アクティブボードと左サイドバーの開閉は localStorage に scope 単位で記憶する。
 */
export const ResearchBoardWorkspace: React.FC<Props> = ({ scope, sidebar, sidebarWidth = 400, boardListWidth = 220 }) => {
  const [boards, setBoards] = useState<ResearchBoardMeta[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>(DEFAULT_BOARD_DOC_ID);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [boardListOpen, setBoardListOpen] = useState(() => {
    try { return localStorage.getItem('research-board-list-open') !== '0'; } catch { return true; }
  });
  // ボード表示: mindmap=マインドマップ（既定。直感的に書き始められる）/ canvas=ノード画面（論証グラフ）。
  // 一度でも切り替えたらその選択をボード単位で覚え、次に開いたときも同じ画面で始める。
  const [boardView, setBoardView] = useState<'canvas' | 'mindmap'>('mindmap');
  useEffect(() => {
    try {
      const v = localStorage.getItem(`research-board-view:${scope}|${activeDocId}`);
      setBoardView(v === 'canvas' ? 'canvas' : 'mindmap');
    } catch { setBoardView('mindmap'); }
  }, [scope, activeDocId]);
  const switchBoardView = useCallback((v: 'canvas' | 'mindmap') => {
    setBoardView(v);
    try { localStorage.setItem(`research-board-view:${scope}|${activeDocId}`, v); } catch { /* ignore */ }
  }, [scope, activeDocId]);

  const toggleBoardList = useCallback(() => {
    setBoardListOpen(open => {
      const next = !open;
      try { localStorage.setItem('research-board-list-open', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ボード操作メニュー / ダイアログ
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<ResearchBoardMeta | null>(null);
  const [dialog, setDialog] = useState<null | { mode: 'create' | 'rename'; docId?: string; value: string }>(null);
  const [busy, setBusy] = useState(false);

  const activeStorageKey = `research-active-board:${scope}`;

  const refreshBoards = useCallback(async (): Promise<ResearchBoardMeta[]> => {
    const list = await ResearchCanvasRepository.listBoards(scope);
    setBoards(list);
    return list;
  }, [scope]);

  // 初回: ボード一覧＋前回アクティブを復元
  useEffect(() => {
    let cancelled = false;
    setLoadingBoards(true);
    setSidebarOpen(false);
    const saved = (() => { try { return localStorage.getItem(activeStorageKey) || ''; } catch { return ''; } })();
    refreshBoards()
      .then(list => {
        if (cancelled) return;
        const exists = saved && list.some(b => b.id === saved);
        setActiveDocId(exists ? saved : DEFAULT_BOARD_DOC_ID);
      })
      .catch(err => console.error('[research] ボード一覧の取得に失敗:', err))
      .finally(() => { if (!cancelled) setLoadingBoards(false); });
    return () => { cancelled = true; };
  }, [scope, refreshBoards, activeStorageKey]);

  const switchTo = useCallback((docId: string) => {
    setActiveDocId(docId);
    try { localStorage.setItem(activeStorageKey, docId); } catch { /* ignore */ }
  }, [activeStorageKey]);

  // AI（research_board_create verb）からの新規作成＋切替を受ける
  useEffect(() => {
    return registerResearchBoardManager({
      scope,
      createBoard: async (title: string) => {
        const id = await ResearchCanvasRepository.createBoard(scope, title);
        await refreshBoards();
        switchTo(id);
        return makeBoardKey(scope, id);
      },
    });
  }, [scope, refreshBoards, switchTo]);

  const handleCreate = () => setDialog({ mode: 'create', value: '' });
  const handleRename = (b: ResearchBoardMeta) => setDialog({ mode: 'rename', docId: b.id, value: b.title });

  const handleDelete = useCallback(async (b: ResearchBoardMeta) => {
    const isDefault = b.id === DEFAULT_BOARD_DOC_ID;
    const msg = isDefault
      ? 'メインボードの内容をすべて消去しますか？（ボード自体は残ります）'
      : `ボード「${b.title}」を削除しますか？`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await ResearchCanvasRepository.deleteBoard(scope, b.id);
      const list = await refreshBoards();
      if (activeDocId === b.id && !isDefault) {
        switchTo(list[0]?.id ?? DEFAULT_BOARD_DOC_ID);
      }
    } catch (err) {
      console.error('[research] ボード削除に失敗:', err);
    } finally {
      setBusy(false);
    }
  }, [scope, activeDocId, refreshBoards, switchTo]);

  const commitDialog = useCallback(async () => {
    if (!dialog) return;
    const title = dialog.value.trim();
    if (!title && dialog.mode === 'rename') return;
    setBusy(true);
    try {
      if (dialog.mode === 'create') {
        const id = await ResearchCanvasRepository.createBoard(scope, title || '無題のボード');
        await refreshBoards();
        switchTo(id);
      } else if (dialog.docId) {
        await ResearchCanvasRepository.renameBoard(scope, dialog.docId, title);
        await refreshBoards();
      }
      setDialog(null);
    } catch (err) {
      console.error('[research] ボード操作に失敗:', err);
    } finally {
      setBusy(false);
    }
  }, [dialog, scope, refreshBoards, switchTo]);

  const itemSx = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 30, px: 1.25, py: 0.5, borderRadius: 2,
    cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0,
    bgcolor: active ? 'rgba(0,191,255,0.14)' : 'transparent',
    color: active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.6)',
    border: `1px solid ${active ? 'rgba(0,191,255,0.4)' : 'transparent'}`,
    '&:hover': { bgcolor: active ? 'rgba(0,191,255,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
  } as const);

  return (
    <Box sx={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>

      {/* ── 左: ボード一覧サイドバー ── */}
      <Box sx={{
        width: boardListOpen ? boardListWidth : 40, flexShrink: 0,
        display: 'flex', flexDirection: 'column', minHeight: 0,
        borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        bgcolor: 'light-dark(rgba(255,255,255,0.5), rgba(10, 15, 25, 0.35))',
        transition: 'width 0.2s', overflow: 'hidden',
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: boardListOpen ? 'space-between' : 'center',
          gap: 0.5, px: boardListOpen ? 1.25 : 0, py: 0.75, flexShrink: 0,
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        }}>
          {boardListOpen && (
            <Typography sx={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', whiteSpace: 'nowrap',
              color: 'rgb(var(--brand-fg-rgb) / 0.45)',
            }}>
              ボード
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {boardListOpen && (
              <Tooltip title="新しいボード">
                <IconButton size="small" onClick={handleCreate}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', '&:hover': { color: '#00BFFF' } }}>
                  <AddRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={boardListOpen ? 'ボード一覧を閉じる' : 'ボード一覧を開く'} placement="right">
              <IconButton size="small" onClick={toggleBoardList}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#00BFFF' } }}>
                {boardListOpen
                  ? <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
                  : <DashboardRoundedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {boardListOpen && (
          <Box sx={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 0.25, p: 0.75,
          }}>
            {loadingBoards ? (
              <CircularProgress size={14} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', m: 1.5, alignSelf: 'center' }} />
            ) : boards.map(b => {
              const active = b.id === activeDocId;
              return (
                <Box key={b.id} sx={itemSx(active)} onClick={() => switchTo(b.id)}>
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.title}
                  </Box>
                  {active && (
                    <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuTarget(b); }}
                      sx={{ p: 0.1, ml: 0.25, color: 'inherit', flexShrink: 0 }}>
                      <MoreHorizRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── ボード本体（キャンバス＋サイドバー）── */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0, position: 'relative' }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/*
            ノード ⇄ マインドマップ 切替。キャンバスに浮かせるとツールバーが増えるたびに
            ぶつかるので、ワークスペース自身の行として持つ（＝キャンバスの外）。
          */}
          <Box sx={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            px: 1.5, py: 0.75,
            borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          }}>
            <Box sx={{
              display: 'flex', borderRadius: 2.5, overflow: 'hidden',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
            }}>
              {([
                { v: 'mindmap' as const, label: 'マインドマップ', icon: <AccountTreeRoundedIcon sx={{ fontSize: 15 }} /> },
                { v: 'canvas' as const, label: 'ノード', icon: <BubbleChartRoundedIcon sx={{ fontSize: 15 }} /> },
              ]).map(({ v, label, icon }) => {
                const active = boardView === v;
                return (
                  <Box key={v} onClick={() => switchBoardView(v)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.6,
                      cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                      bgcolor: active ? '#00BFFF' : 'transparent',
                      color: active ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
                      '&:hover': active ? {} : { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)' },
                    }}>
                    {icon}{label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!loadingBoards && (boardView === 'mindmap'
              ? <MindMapCanvas boardKey={makeBoardKey(scope, activeDocId)} />
              : <ResearchCanvas boardKey={makeBoardKey(scope, activeDocId)} />)}
          </Box>
        </Box>

        {sidebar && (
          <>
            <Tooltip title={sidebarOpen ? 'メモを閉じる' : 'メモを開く'} placement="left">
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(o => !o)}
                sx={{
                  position: 'absolute', top: 10, right: sidebarOpen ? sidebarWidth + 10 : 10, zIndex: 20,
                  bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'right 0.2s',
                  color: 'rgb(var(--brand-fg-rgb) / 0.6)',
                  '&:hover': { color: '#00BFFF', bgcolor: 'var(--brand-surface)' },
                }}
              >
                {sidebarOpen
                  ? <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                  : <MenuBookIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>

            <Box sx={{
              width: sidebarOpen ? sidebarWidth : 0,
              flexShrink: 0,
              borderLeft: sidebarOpen ? '1px solid rgb(var(--brand-fg-rgb) / 0.08)' : 'none',
              bgcolor: 'light-dark(rgba(255,255,255,0.65), rgba(10, 15, 25, 0.5))',
              overflow: 'hidden', transition: 'width 0.2s',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              {sidebarOpen && (
                <Box sx={{ width: sidebarWidth, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
                  {sidebar}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* ── ボード操作メニュー ── */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        MenuListProps={{ dense: true }}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' } }}>
        <MenuItem onClick={() => { if (menuTarget) handleRename(menuTarget); setMenuAnchor(null); }} sx={{ fontSize: 13 }}>
          名前を変更
        </MenuItem>
        <MenuItem onClick={() => { if (menuTarget) handleDelete(menuTarget); setMenuAnchor(null); }} sx={{ fontSize: 13, color: 'light-dark(#a80637, #fa709a)' }}>
          {menuTarget?.id === DEFAULT_BOARD_DOC_ID ? '内容を消去' : '削除'}
        </MenuItem>
      </Menu>

      {/* ── 作成 / リネーム ダイアログ ── */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>
          {dialog?.mode === 'create' ? '新しいボード' : 'ボード名を変更'}
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField autoFocus fullWidth size="small" label="ボード名"
            value={dialog?.value ?? ''}
            onChange={e => setDialog(d => (d ? { ...d, value: e.target.value } : d))}
            onKeyDown={e => { if (e.key === 'Enter') commitDialog(); }}
            placeholder="例: キャリアの方向性 / 事業アイデア"
            InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
            InputProps={{ sx: { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
            sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialog(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={commitDialog} disabled={busy || (dialog?.mode === 'rename' && !dialog.value.trim())} variant="contained"
            sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2,
              '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
            {dialog?.mode === 'create' ? '作成' : '変更'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResearchBoardWorkspace;
