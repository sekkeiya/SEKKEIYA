/**
 * AiStudioMemory — AI Studio「メモリー」ビュー（docs/21）。
 *
 * AIの長期記憶を2スコープで閲覧・管理する:
 *  - ユーザー: 人物像（考え方・好み・プロフィール・AIへの指示）。本人のみ
 *  - プロジェクト: 案件の決定・制約・経緯・方針。プロジェクトメンバー共有
 * 表示は「リスト」と「グラフ（セマンティック）」を切替。追加・編集・アーカイブ・削除と、
 * AIに実際へ注入されるダイジェストの確認ができる。
 * 保存の主役はAIの自動抽出（S.Blog議論/Chatの節目）で、手動追加は訂正・補助用。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Chip, IconButton, Button, TextField, MenuItem, Select,
  CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
} from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { MemoryGraph } from './MemoryGraph';
import {
  listAiMemories, addAiMemory, updateAiMemory, deleteAiMemory, getAiMemoryDigest,
  USER_MEMORY_TYPES, PROJECT_MEMORY_TYPES, memoryTypeLabel,
  MEMORY_TEXT_MAX, ACTIVE_LIMIT,
  type AiMemory, type AiMemoryType, type MemoryScope,
} from './aiMemoryApi';

const ACCENT = '#a855f7';
type ViewMode = 'list' | 'graph';

const sourceLabel = (kind: string): string =>
  kind === 'blogDiscussion' ? 'S.Blog議論から' : kind === 'chat' ? 'Chatから' : '手動';
const typeOptionsFor = (s: MemoryScope) => (s === 'user' ? USER_MEMORY_TYPES : PROJECT_MEMORY_TYPES);

export const AiStudioMemory: React.FC = () => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const projects = useAppStore((s: any) => s.projects as { id: string; name: string }[]);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [scope, setScope] = useState<MemoryScope>('user');
  const [projectId, setProjectId] = useState<string>('');
  const ownerOf = useCallback((s: MemoryScope): string | null =>
    (s === 'user' ? (uid || null) : (projectId || null)), [uid, projectId]);
  const ownerId = ownerOf(scope);

  // リスト用（現在スコープ）
  const [items, setItems] = useState<AiMemory[]>([]);
  const [digest, setDigest] = useState<string[]>([]);
  // グラフ用（ユーザー＋選択プロジェクトを重ねる）
  const [graphUser, setGraphUser] = useState<AiMemory[]>([]);
  const [graphProject, setGraphProject] = useState<AiMemory[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDigest, setShowDigest] = useState(false);
  const [showAdd, setShowAdd] = useState(false); // 手動追加は既定で畳む（自動抽出が主役）

  // 追加フォーム
  const typeOptions = typeOptionsFor(scope);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<AiMemoryType>('opinion');
  const effectiveNewType = typeOptions.some((t) => t.value === newType) ? newType : typeOptions[0].value;

  // 編集ダイアログ（メモリー自身のスコープを保持＝グラフからの編集で user/project 両対応）
  const [editing, setEditing] = useState<{ m: AiMemory; scope: MemoryScope } | null>(null);
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState<AiMemoryType>('opinion');

  const reloadList = useCallback(async () => {
    if (!ownerId) { setItems([]); setDigest([]); return; }
    setLoading(true); setError('');
    try {
      const [list, dg] = await Promise.all([listAiMemories(scope, ownerId), getAiMemoryDigest(scope, ownerId)]);
      setItems(list); setDigest(dg);
    } catch (e: any) {
      setError(`読み込みに失敗しました: ${e?.message || e}`); // ルール未デプロイ時は permission-denied
    } finally { setLoading(false); }
  }, [scope, ownerId]);

  const reloadGraph = useCallback(async () => {
    if (!uid) return;
    setLoading(true); setError('');
    try {
      const [gu, gp] = await Promise.all([
        listAiMemories('user', uid),
        projectId ? listAiMemories('project', projectId) : Promise.resolve([]),
      ]);
      setGraphUser(gu); setGraphProject(gp);
    } catch (e: any) {
      setError(`読み込みに失敗しました: ${e?.message || e}`);
    } finally { setLoading(false); }
  }, [uid, projectId]);

  const refreshActive = useCallback(() => (viewMode === 'graph' ? reloadGraph() : reloadList()),
    [viewMode, reloadGraph, reloadList]);
  useEffect(() => { void refreshActive(); }, [refreshActive]);

  /** スコープを明示して変更を実行（グラフはノードごとにスコープが異なるため owner を都度解決）。 */
  const mutate = async (s: MemoryScope, fn: (owner: string) => Promise<void>) => {
    const owner = ownerOf(s);
    if (!owner || busy) return;
    setBusy(true); setError('');
    try { await fn(owner); await refreshActive(); }
    catch (e: any) { setError(`保存に失敗しました: ${e?.message || e}`); }
    finally { setBusy(false); }
  };

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    void mutate(scope, (owner) => addAiMemory(scope, owner, { text, type: effectiveNewType }, uid).then(() => setNewText('')));
  };

  const openEdit = (m: AiMemory, s: MemoryScope) => { setEditing({ m, scope: s }); setEditText(m.text); setEditType(m.type); };
  const handleEditSave = () => {
    if (!editing) return;
    const { m, scope: s } = editing;
    setEditing(null);
    void mutate(s, (owner) => updateAiMemory(s, owner, m.id, { text: editText, type: editType }));
  };
  const handleArchiveToggle = (m: AiMemory, s: MemoryScope) =>
    mutate(s, (owner) => updateAiMemory(s, owner, m.id, { status: m.status === 'archived' ? 'active' : 'archived' }));
  const handleDelete = (m: AiMemory, s: MemoryScope) => {
    if (!window.confirm('このメモリーを削除しますか？')) return;
    void mutate(s, (owner) => deleteAiMemory(s, owner, m.id));
  };

  const activeCount = useMemo(() => items.filter((m) => m.status === 'active').length, [items]);

  const renderMemoryCard = (m: AiMemory) => (
    <Box key={m.id}
      sx={{ p: 1.75, borderRadius: 2.5, mb: 1,
        bgcolor: m.status === 'archived' ? 'rgb(var(--brand-fg-rgb) / 0.02)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', opacity: m.status === 'archived' ? 0.55 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Chip label={memoryTypeLabel(m.type)} size="small"
          sx={{ height: 20, fontSize: 10.5, fontWeight: 700, flexShrink: 0, mt: '1px',
            bgcolor: 'rgba(168,85,247,0.12)', color: 'light-dark(#470ea0, #c4a3f7)', border: '1px solid rgba(168,85,247,0.35)' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.85)', lineHeight: 1.7 }}>{m.text}</Typography>
          {m.topics?.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {m.topics.map((t) => (
                <Typography key={t} sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>#{t}</Typography>
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
          <Tooltip title="編集"><IconButton size="small" disabled={busy} onClick={() => openEdit(m, scope)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
            <EditRoundedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
          <Tooltip title={m.status === 'archived' ? '復元（AIへの注入を再開）' : 'アーカイブ（AIに注入しない）'}>
            <IconButton size="small" disabled={busy} onClick={() => void handleArchiveToggle(m, scope)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
              {m.status === 'archived' ? <UnarchiveOutlinedIcon sx={{ fontSize: 15 }} /> : <ArchiveOutlinedIcon sx={{ fontSize: 15 }} />}
            </IconButton></Tooltip>
          <Tooltip title="削除"><IconButton size="small" disabled={busy} onClick={() => handleDelete(m, scope)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'light-dark(#961818, #ef9a9a)' } }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 0.75, ml: 0.25 }}>
        {sourceLabel(m.source?.kind || 'manual')}
        {m.updatedAt ? ` ・ ${new Date(m.updatedAt).toLocaleDateString('ja-JP')}` : ''}
        {m.status === 'archived' ? ' ・ アーカイブ済み（注入されません）' : ''}
      </Typography>
    </Box>
  );

  const toggleBtnSx = (active: boolean) => ({
    minWidth: 0, px: 1.5, py: 0.6, textTransform: 'none', fontSize: 12, fontWeight: 700, borderRadius: 1.5,
    color: active ? 'light-dark(#470ea0, #c4a3f7)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
    bgcolor: active ? 'rgba(168,85,247,0.14)' : 'transparent',
    '&:hover': { bgcolor: active ? 'rgba(168,85,247,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
  });

  const editTypeOptions = typeOptionsFor(editing?.scope || 'user');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── ヘッダ（固定） ── */}
      <Box sx={{ px: 4, pt: 4, pb: 2, flexShrink: 0, maxWidth: viewMode === 'graph' ? 'none' : 900, width: '100%', mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
          <PsychologyRoundedIcon sx={{ fontSize: 26, color: ACCENT }} />
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-fg)' }}>メモリー</Typography>
          <Box sx={{ flex: 1 }} />
          {/* リスト / グラフ 切替 */}
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' }}>
            <Button startIcon={<ViewListRoundedIcon sx={{ fontSize: '15px !important' }} />} onClick={() => setViewMode('list')} sx={toggleBtnSx(viewMode === 'list')}>リスト</Button>
            <Button startIcon={<HubRoundedIcon sx={{ fontSize: '15px !important' }} />} onClick={() => setViewMode('graph')} sx={toggleBtnSx(viewMode === 'graph')}>グラフ</Button>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 2, lineHeight: 1.8 }}>
          AIの長期記憶です。SEKKEIYA OS や S.Blog のAI応答に毎回注入され、あなた（と案件）に最適化されます。
          <b>内容は主にAIとの議論から自動保存</b>され、ここでいつでも確認・編集・削除できます。
        </Typography>

        {viewMode === 'list' ? (
          <>
            {/* スコープ切替 */}
            <Tabs value={scope} onChange={(_, v) => setScope(v)} sx={{ minHeight: 38,
              '& .MuiTab-root': { minHeight: 38, textTransform: 'none', fontSize: 13, fontWeight: 700 },
              '& .Mui-selected': { color: `light-dark(#470ea0, #c4a3f7) !important` },
              '& .MuiTabs-indicator': { bgcolor: ACCENT } }}>
              <Tab value="user" icon={<PersonRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="ユーザー（人物像・本人のみ）" />
              <Tab value="project" icon={<FolderRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="プロジェクト（決定・制約・メンバー共有）" />
            </Tabs>
            {scope === 'project' && (
              <Select size="small" value={projectId} displayEmpty onChange={(e) => setProjectId(e.target.value)}
                sx={{ mt: 2, minWidth: 320, fontSize: 13 }}>
                <MenuItem value="" disabled>プロジェクトを選択…</MenuItem>
                {(projects || []).map((p) => <MenuItem key={p.id} value={p.id} sx={{ fontSize: 13 }}>{p.name}</MenuItem>)}
              </Select>
            )}
          </>
        ) : (
          // グラフツールバー: プロジェクトを重ねるセレクタ
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>プロジェクトの記憶を重ねる:</Typography>
            <Select size="small" value={projectId} displayEmpty onChange={(e) => setProjectId(e.target.value)} sx={{ minWidth: 260, fontSize: 12.5 }}>
              <MenuItem value="" sx={{ fontSize: 12.5 }}>（ユーザーのみ表示）</MenuItem>
              {(projects || []).map((p) => <MenuItem key={p.id} value={p.id} sx={{ fontSize: 12.5 }}>{p.name}</MenuItem>)}
            </Select>
            {loading && <CircularProgress size={14} sx={{ color: ACCENT }} />}
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>ノードをクリックで編集・削除</Typography>
          </Box>
        )}
      </Box>

      {error && (
        <Typography sx={{ px: 4, fontSize: 12, color: 'light-dark(#961818, #ef9a9a)', mb: 1, flexShrink: 0 }}>⚠ {error}</Typography>
      )}

      {/* ── 本体 ── */}
      {viewMode === 'graph' ? (
        <Box sx={{ flex: 1, minHeight: 0, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          {uid ? (
            <MemoryGraph userMemories={graphUser} projectMemories={graphProject} onOpenMemory={openEdit} />
          ) : (
            <Typography sx={{ p: 6, textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>ログインが必要です</Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 4, pb: 4 }}>
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            {!ownerId ? (
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.45)', py: 4, textAlign: 'center' }}>
                {scope === 'project' ? '上のセレクタからプロジェクトを選択してください' : 'ログインが必要です'}
              </Typography>
            ) : (
              <>
                {/* 手動追加（既定は畳む。自動抽出が主役なので補助扱い） */}
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Button size="small" startIcon={<AddCircleOutlineRoundedIcon sx={{ fontSize: '16px !important' }} />}
                    onClick={() => setShowAdd((v) => !v)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', textTransform: 'none', fontSize: 12 }}>
                    手動で追加（AIが拾いきれなかったことを補う）
                  </Button>
                  <Collapse in={showAdd}>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
                      <Select size="small" value={effectiveNewType} onChange={(e) => setNewType(e.target.value as AiMemoryType)}
                        sx={{ fontSize: 12.5, minWidth: 130, flexShrink: 0 }}>
                        {typeOptions.map((t) => <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12.5 }}>{t.label}</MenuItem>)}
                      </Select>
                      <TextField size="small" fullWidth value={newText} onChange={(e) => setNewText(e.target.value)}
                        placeholder={scope === 'user' ? '例: 商業空間では体験の演出より日常の使いやすさを重視する' : '例: 外壁は焼杉で確定。吹き抜け案は施主が却下済み'}
                        inputProps={{ maxLength: MEMORY_TEXT_MAX }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd(); }}
                        helperText={`${newText.length}/${MEMORY_TEXT_MAX}字 ・ 1件=1つの事実で簡潔に`}
                        sx={{ '& .MuiFormHelperText-root': { fontSize: 10.5, ml: 0.5 } }} />
                      <Button variant="contained" disabled={busy || !newText.trim()} onClick={handleAdd}
                        startIcon={busy ? <CircularProgress size={13} sx={{ color: '#fff' }} /> : <AddRoundedIcon sx={{ fontSize: '16px !important' }} />}
                        sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 700, flexShrink: 0, borderRadius: 2, '&:hover': { bgcolor: '#9333ea' } }}>追加</Button>
                    </Box>
                  </Collapse>
                </Box>

                {/* 件数 + ダイジェスト表示切替 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    有効 {activeCount} / {ACTIVE_LIMIT[scope]} 件{items.length - activeCount > 0 ? `（アーカイブ ${items.length - activeCount} 件）` : ''}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" startIcon={<VisibilityRoundedIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={() => setShowDigest((v) => !v)}
                    sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: 11.5 }}>
                    {showDigest ? 'ダイジェストを隠す' : 'AIに注入される内容を見る'}
                  </Button>
                </Box>

                {showDigest && (
                  <Box sx={{ p: 1.75, mb: 2, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)' }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 0.75, letterSpacing: 0.5 }}>
                      AIに注入されるダイジェスト（{digest.length}行）
                    </Typography>
                    {digest.length === 0 ? (
                      <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>（空 — 注入されません）</Typography>
                    ) : digest.map((l, i) => (
                      <Typography key={i} sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.7)', lineHeight: 1.8 }}>・{l}</Typography>
                    ))}
                  </Box>
                )}

                {loading ? (
                  <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
                ) : items.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.4)', py: 4, textAlign: 'center', lineHeight: 1.9 }}>
                    まだメモリーがありません。<br />
                    AIと議論（S.Blog / Chat）を重ねると、あなたの考え方が自動で貯まっていきます。
                  </Typography>
                ) : (
                  items.map(renderMemoryCard)
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      {/* 編集ダイアログ（リスト・グラフ共通） */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          メモリーを編集
          {editing && (
            <Chip size="small" icon={editing.scope === 'user' ? <PersonRoundedIcon sx={{ fontSize: '13px !important' }} /> : <FolderRoundedIcon sx={{ fontSize: '13px !important' }} />}
              label={editing.scope === 'user' ? 'ユーザー' : 'プロジェクト'}
              sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }} />
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Select size="small" value={editType} onChange={(e) => setEditType(e.target.value as AiMemoryType)} sx={{ fontSize: 12.5, alignSelf: 'flex-start', minWidth: 130 }}>
            {editTypeOptions.map((t) => <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12.5 }}>{t.label}</MenuItem>)}
          </Select>
          <TextField fullWidth multiline minRows={2} value={editText} onChange={(e) => setEditText(e.target.value)}
            inputProps={{ maxLength: MEMORY_TEXT_MAX }} helperText={`${editText.length}/${MEMORY_TEXT_MAX}字`} />
          {editing?.m.topics?.length ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {editing.m.topics.map((t) => <Chip key={t} label={`#${t}`} size="small" sx={{ height: 20, fontSize: 10.5 }} />)}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Box>
            {editing && (
              <>
                <Button size="small" onClick={() => { const e = editing; setEditing(null); void handleArchiveToggle(e.m, e.scope); }}
                  sx={{ textTransform: 'none', fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                  {editing.m.status === 'archived' ? '復元' : 'アーカイブ'}
                </Button>
                <Button size="small" onClick={() => { const e = editing; setEditing(null); handleDelete(e.m, e.scope); }}
                  sx={{ textTransform: 'none', fontSize: 12, color: 'light-dark(#961818, #ef9a9a)' }}>削除</Button>
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setEditing(null)} sx={{ textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>キャンセル</Button>
            <Button variant="contained" disabled={!editText.trim()} onClick={handleEditSave}
              sx={{ bgcolor: ACCENT, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9333ea' } }}>保存</Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
