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
import { publishBoardContext, serveBoardContextRequests, onShowBoard } from '../../features/projects/chat/boardContextBus';
import {
  ResearchCanvasRepository,
  makeBoardKey,
  parseBoardKey,
  DEFAULT_BOARD_DOC_ID,
  type ResearchBoardMeta,
  type MindMapNode,
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

  // ポップアウトしたチャット窓は別コンテキストで、このタブを開いていることも
  // どのビューかも知りようがない。表示状態を配信して、あちらのオーケストレーターが
  // ボード系ツールとプレイブックを正しく選べるようにする（マウント中＝タブ表示中）。
  useEffect(() => {
    if (loadingBoards) return;
    publishBoardContext({ open: true, view: boardView, boardKey: makeBoardKey(scope, activeDocId) });
    return () => publishBoardContext({ open: false, view: null, boardKey: null });
  }, [boardView, scope, activeDocId, loadingBoards]);
  // 後から開いたチャット窓からの問い合わせに、現在値で応答する。
  useEffect(() => serveBoardContextRequests(), []);

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

  // AI が書き込みを始めたボードを画面に出す（チャットが正）。
  // プロジェクト・タブの切替は App 側のハンドラが担い、ここでは
  // 「同じスコープのワークスペースが既に出ている」ときのボード・ビュー切替を受け持つ。
  useEffect(() => onShowBoard(req => {
    const target = parseBoardKey(req.boardKey);
    if (target.scope !== scope) return;
    switchTo(target.docId);
    switchBoardView(req.view);
    refreshBoards().catch(() => { /* 一覧の取りこぼしは次の操作で追いつく */ });
  }), [scope, switchTo, switchBoardView, refreshBoards]);

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

  // ─── 子ボード（ドリルダウン）────────────────────────────────────────────────
  // トピックを配下ごと別マップに切り出す。呼び出し側（MindMapCanvas）から
  // 「中心トピック＋配下」の木（childMindmap）を受け取り、それを子ボードの初期マップにする。
  // 親ボードからの配下除去は呼び出し側が担う。随伴する孫ボードは親付け替え。
  const handleDrillDownTopic = useCallback(async (
    topicId: string, topicText: string, childMindmap: MindMapNode[],
  ): Promise<string | null> => {
    try {
      const childId = await ResearchCanvasRepository.createBoard(scope, topicText, {
        nest: { parentBoardId: activeDocId, parentTopicId: topicId },
        seedMindmap: childMindmap,
      });
      // 配下に既にドリルダウン済みのトピック（孫ボードを持つ）があれば、その孫ボードの
      // 親を新しい子ボードへ付け替える（サイドバーのネストが正しく追随する）。
      const movedIds = new Set(childMindmap.map(n => n.id));
      await Promise.all(boards
        .filter(b => b.parentBoardId === activeDocId && b.parentTopicId && movedIds.has(b.parentTopicId) && b.id !== childId)
        .map(b => ResearchCanvasRepository.reparentBoard(scope, b.id, childId)));
      await refreshBoards();
      return childId;
    } catch (err) {
      console.error('[research] 子ボードの作成に失敗:', err);
      return null;
    }
  }, [scope, activeDocId, boards, refreshBoards]);

  const handleOpenChildBoard = useCallback((childBoardId: string) => {
    switchBoardView('mindmap'); // 子ボードはマインドマップで開く
    switchTo(childBoardId);
    refreshBoards().catch(() => { /* 一覧の取りこぼしは次の操作で追いつく */ });
  }, [switchBoardView, switchTo, refreshBoards]);

  // トピック（部分木）を別ボードへ移す。移動先 doc への追記と随伴子ボードの付け替えを
  // リポジトリに委譲。移動元からの除去は呼び出し側（MindMapCanvas のライブ state）が担う。
  const handleMoveTopicToBoard = useCallback(async (
    targetDocId: string, subtree: MindMapNode[], rootId: string, newOrigin: string | null,
  ): Promise<boolean> => {
    try {
      await ResearchCanvasRepository.moveTopicToBoard(scope, activeDocId, targetDocId, subtree, rootId, newOrigin);
      await refreshBoards();
      return true;
    } catch (err) {
      console.error('[research] トピックの別ボード移動に失敗:', err);
      return false;
    }
  }, [scope, activeDocId, refreshBoards]);

  // 子ボードを解消: 子ボードの全トピックを返し、その子ボードを削除する
  // （deleteBoard が孫ボードの親を繰り上げる）。畳み戻しは呼び出し側が担う。
  const handleDissolveChildBoard = useCallback(async (childDocId: string): Promise<MindMapNode[] | null> => {
    try {
      const doc = await ResearchCanvasRepository.load(makeBoardKey(scope, childDocId));
      await ResearchCanvasRepository.deleteBoard(scope, childDocId);
      await refreshBoards();
      return doc.mindmap;
    } catch (err) {
      console.error('[research] 子ボードの解消に失敗:', err);
      return null;
    }
  }, [scope, refreshBoards]);

  // 連動①: 子ボードを持つトピックの名前変更 → 子ボードの名前と中心トピックへ反映
  const handleRenameChildBoard = useCallback(async (childDocId: string, text: string): Promise<void> => {
    const now = new Date().toISOString();
    try {
      await ResearchCanvasRepository.renameBoard(scope, childDocId, text);
      const doc = await ResearchCanvasRepository.load(makeBoardKey(scope, childDocId));
      const root = doc.mindmap.find(n => n.parentId == null);
      if (root && root.text !== text) {
        const mind = doc.mindmap.map(n => n.id === root.id ? { ...n, text, updatedAt: now } : n);
        await ResearchCanvasRepository.save(makeBoardKey(scope, childDocId), { mindmap: mind });
      }
      await refreshBoards();
    } catch (err) {
      console.error('[research] 子ボード名の連動に失敗:', err);
    }
  }, [scope, refreshBoards]);

  // 連動②: 子ボードの中心トピックの名前変更 → 親ボードのアンカートピックと自ボード名へ反映
  const handleRenameSelfBoard = useCallback(async (text: string): Promise<void> => {
    const cur = boards.find(b => b.id === activeDocId);
    if (!cur?.parentBoardId || !cur.parentTopicId) return;
    const now = new Date().toISOString();
    try {
      await ResearchCanvasRepository.renameBoard(scope, activeDocId, text);
      const parent = await ResearchCanvasRepository.load(makeBoardKey(scope, cur.parentBoardId));
      const mind = parent.mindmap.map(n => n.id === cur.parentTopicId ? { ...n, text, updatedAt: now } : n);
      await ResearchCanvasRepository.save(makeBoardKey(scope, cur.parentBoardId), { mindmap: mind });
      await refreshBoards();
    } catch (err) {
      console.error('[research] 親トピック名の連動に失敗:', err);
    }
  }, [scope, activeDocId, boards, refreshBoards]);

  // 子ボード側から「元のボードに戻す」: このボード(activeDocId)の中身を、親ボードの
  // アンカートピック(parentTopicId)配下へ戻し、この子ボードを削除して親へ遷移する。
  const handleDissolveIntoParent = useCallback(async (childTopics: MindMapNode[]): Promise<void> => {
    const cur = boards.find(b => b.id === activeDocId);
    if (!cur?.parentBoardId || !cur.parentTopicId) return;
    const parentDocId = cur.parentBoardId;
    const anchorId = cur.parentTopicId;
    const now = new Date().toISOString();
    try {
      const parent = await ResearchCanvasRepository.load(makeBoardKey(scope, parentDocId));
      const childRoot = childTopics.find(n => n.parentId == null);
      // 子ボードの中心トピックの子たちを親のアンカー配下へ。中心トピック自身は捨てる。
      const grafted = childTopics
        .filter(n => n.id !== childRoot?.id)
        .map(n => (n.parentId === childRoot?.id ? { ...n, parentId: anchorId, updatedAt: now } : { ...n, updatedAt: now }));
      const parentMind = parent.mindmap
        .map(n => n.id === anchorId ? { ...n, childBoardId: undefined, updatedAt: now } : n)
        .concat(grafted);
      await ResearchCanvasRepository.save(makeBoardKey(scope, parentDocId), { mindmap: parentMind });
      // 先に親へ遷移してからこの子ボードを削除（マウント中の削除で復活させないよう順序に注意）
      switchBoardView('mindmap');
      switchTo(parentDocId);
      await ResearchCanvasRepository.deleteBoard(scope, activeDocId);
      await refreshBoards();
    } catch (err) {
      console.error('[research] 親への畳み戻しに失敗:', err);
    }
  }, [scope, activeDocId, boards, switchBoardView, switchTo, refreshBoards]);

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
    display: 'flex', alignItems: 'center', gap: 0.25, minHeight: 30, pr: 0.75, py: 0.5, borderRadius: 2,
    cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0,
    bgcolor: active ? 'rgba(0,191,255,0.14)' : 'transparent',
    color: active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.6)',
    border: `1px solid ${active ? 'rgba(0,191,255,0.4)' : 'transparent'}`,
    '&:hover': { bgcolor: active ? 'rgba(0,191,255,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
  } as const);

  // ボードのツリー構造（parentBoardId）。子ボードは親の下にネストして描く。
  // 親が一覧に無い（削除直後の繰り上げ前など）子は、はぐれないようトップレベル扱いにする。
  // 現在ボードの親（子ボードのとき。親ボードへ戻る導線・中心トピック左ボタンに使う）
  const activeParentBoardId = React.useMemo(() => {
    const cur = boards.find(b => b.id === activeDocId);
    const pid = cur?.parentBoardId;
    return pid && boards.some(b => b.id === pid) ? pid : null;
  }, [boards, activeDocId]);

  const boardChildren = React.useMemo(() => {
    const byId = new Set(boards.map(b => b.id));
    const map = new Map<string, ResearchBoardMeta[]>();
    for (const b of boards) {
      const key = b.parentBoardId && byId.has(b.parentBoardId) ? b.parentBoardId : '__root__';
      (map.get(key) ?? map.set(key, []).get(key)!).push(b);
    }
    return map;
  }, [boards]);

  // 折りたたみ状態（既定は展開）。localStorage には持たせず、セッション内だけ。
  const [collapsedBoards, setCollapsedBoards] = useState<Set<string>>(new Set());
  const toggleBoardCollapsed = useCallback((id: string) => {
    setCollapsedBoards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ボードツリーの再帰描画。parentKey の子を depth 段インデントして並べる。
  const renderBoardTree = (parentKey: string, depth: number): React.ReactNode => {
    const list = boardChildren.get(parentKey) ?? [];
    return list.map(b => {
      const active = b.id === activeDocId;
      const kids = boardChildren.get(b.id) ?? [];
      const hasKids = kids.length > 0;
      const collapsed = collapsedBoards.has(b.id);
      return (
        <React.Fragment key={b.id}>
          <Box sx={{ ...itemSx(active), pl: `${6 + depth * 14}px` }} onClick={() => switchTo(b.id)}>
            {/* 折りたたみ矢印（子ボードがあるときだけ。無いときは同じ幅の余白で字下げを揃える） */}
            {hasKids ? (
              <IconButton size="small" onClick={e => { e.stopPropagation(); toggleBoardCollapsed(b.id); }}
                sx={{ p: 0, width: 16, height: 16, color: 'inherit', flexShrink: 0 }}>
                <ChevronRightRoundedIcon sx={{ fontSize: 16, transition: 'transform .12s', transform: collapsed ? 'none' : 'rotate(90deg)' }} />
              </IconButton>
            ) : (
              <Box sx={{ width: 16, flexShrink: 0 }} />
            )}
            {/* 子ボードは親トピック由来なので、由来が分かるアイコンを添える */}
            {b.parentBoardId && <AccountTreeRoundedIcon sx={{ fontSize: 12, flexShrink: 0, opacity: 0.6 }} />}
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.title}
            </Box>
            {active && (
              <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuTarget(b); }}
                sx={{ p: 0.1, color: 'inherit', flexShrink: 0 }}>
                <MoreHorizRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </Box>
          {hasKids && !collapsed && renderBoardTree(b.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

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
            ) : renderBoardTree('__root__', 0)}
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

            {/* 子ボードのとき、親ボードへ戻るパンくず（ドリルダウンの戻り導線） */}
            {(() => {
              const parent = activeParentBoardId ? boards.find(b => b.id === activeParentBoardId) : null;
              if (!parent) return null;
              return (
                <Box onClick={() => switchTo(parent.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5, ml: 1.5, px: 1, py: 0.4,
                    cursor: 'pointer', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
                    color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderRadius: 2,
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
                    '&:hover': { color: '#00BFFF', borderColor: '#00BFFF' },
                  }}>
                  <ChevronLeftRoundedIcon sx={{ fontSize: 15 }} />
                  {parent.title}
                </Box>
              );
            })()}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!loadingBoards && (boardView === 'mindmap'
              ? <MindMapCanvas boardKey={makeBoardKey(scope, activeDocId)}
                  onDrillDownTopic={handleDrillDownTopic}
                  onOpenChildBoard={handleOpenChildBoard}
                  onOpenParentBoard={activeParentBoardId ? () => switchTo(activeParentBoardId) : undefined}
                  onDissolveIntoParent={activeParentBoardId ? handleDissolveIntoParent : undefined}
                  onRenameChildBoard={handleRenameChildBoard}
                  onRenameSelfBoard={activeParentBoardId ? handleRenameSelfBoard : undefined}
                  moveTargets={boards.map(b => ({ id: b.id, title: b.title }))}
                  onMoveTopicToBoard={handleMoveTopicToBoard}
                  onDissolveChildBoard={handleDissolveChildBoard} />
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
