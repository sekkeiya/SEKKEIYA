import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Chip, Tooltip, CircularProgress, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
  InputAdornment, Menu, MenuItem, ListItemIcon, Divider, Select, FormControl,
} from '@mui/material';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import FirstPageRoundedIcon from '@mui/icons-material/FirstPageRounded';
import LastPageRoundedIcon from '@mui/icons-material/LastPageRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAccountProfileStore } from '../store/useAccountProfileStore';
import { doc as fsDoc, setDoc as fsSetDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/client';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { createProject } from '../features/projects/api/createProject';
import { deleteProject } from '../features/projects/api/deleteProject';
import { renameProject } from '../features/projects/api/updateProject';
import { duplicateAsMyProject } from '../features/projects/api/duplicateAsMyProject';
import { resolveProjectPermission } from '../features/projects/useProjectPermission';
import { PromoteToTeamDialog } from '../features/projects/PromoteToTeamDialog';
import { MemberManagementDialog } from '../features/projects/MemberManagementDialog';
import { SiteRepository } from '../features/sites/siteRepository';
import type { SiteSource } from '../features/sites/siteRepository';
import { getUsername, publicUrl, unpublishSite } from '../features/sites/publishService';
import { PublishDialog } from '../features/sites/PublishDialog';
import type { ProjectSite, DesktopProject } from '../features/projects/types';
import { BRAND } from '../styles/theme';

type Status = 'published' | 'draft' | 'none';
const statusOf = (site: ProjectSite | null): Status =>
  !site ? 'none' : site.publish?.status === 'published' ? 'published' : 'draft';

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  published: { label: '公開中', color: '#43e97b', bg: 'rgba(67,233,123,0.14)' },
  draft: { label: '未公開', color: 'rgb(var(--brand-fg-rgb) / 0.6)', bg: 'rgb(var(--brand-fg-rgb) / 0.08)' },
  none: { label: '未作成', color: 'rgb(var(--brand-fg-rgb) / 0.4)', bg: 'rgb(var(--brand-fg-rgb) / 0.05)' },
};

const StatusBadge: React.FC<{ status: Status }> = ({ status }) => {
  const m = STATUS_META[status];
  return <Chip label={m.label} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, color: m.color, bgcolor: m.bg, border: `1px solid color-mix(in srgb, ${m.color} 20%, transparent)` }} />;
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

// 公開範囲（公開中のサイトのみ意味を持つ）。
const visibilityOf = (site: ProjectSite | null): { label: string; icon: 'public' | 'private' } | null => {
  if (statusOf(site) !== 'published') return null;
  return site?.publish?.visibility === 'private'
    ? { label: '非公開', icon: 'private' }
    : { label: '一般公開', icon: 'public' };
};

type FilterKey = 'all' | Status;
type SortKey = 'name' | 'updated';
type SortDir = 'asc' | 'desc';
const STATUS_ORDER: Record<Status, number> = { published: 0, draft: 1, none: 2 };
const PAGE_SIZE = 20;
// テーブルの列グリッド（チェック / 名前 / 状況 / 公開範囲 / URL / 更新日時 / 操作）
const COLS = '34px minmax(150px, 1.8fr) 80px 92px minmax(110px, 1.4fr) 130px 128px';

interface PublishTarget { source: SiteSource; site: ProjectSite; displayName: string; }
interface Confirm { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void>; }

const SiteManagementPage: React.FC = () => {
  const uid = useAuthStore(s => s.currentUser?.uid) || '';
  const email = useAuthStore(s => s.currentUser?.email) || 'User';
  const logoUrl = useAccountProfileStore(s => s.logoUrl);
  const accountName = useAccountProfileStore(s => s.displayName) || email.split('@')[0];
  const { projects, setProjects, setActiveProjectId, setCurrentMainView, setActiveWorkspaceId } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [accountSite, setAccountSite] = useState<ProjectSite | null>(null);
  const [siteByProject, setSiteByProject] = useState<Record<string, ProjectSite | null>>({});
  const [target, setTarget] = useState<PublishTarget | null>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{ kind: 'project' | 'account'; id: string; current: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [promoteTarget, setPromoteTarget] = useState<DesktopProject | null>(null);
  const [memberTarget, setMemberTarget] = useState<DesktopProject | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const fetched = await fetchUserProjects(uid);
      setProjects(fetched);
      const [u, acc, projSites] = await Promise.all([
        getUsername(uid),
        SiteRepository.get({ kind: 'account', id: uid }).catch(() => null),
        Promise.all(fetched.map(p => SiteRepository.get({ kind: 'project', id: p.id }).then(s => [p.id, s] as const).catch(() => [p.id, null] as const))),
      ]);
      setUsername(u);
      setAccountSite(acc);
      setSiteByProject(Object.fromEntries(projSites));
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, filter, sortBy, sortDir]);

  const openProject = (id: string) => { setActiveProjectId(id); setActiveWorkspaceId(null); setCurrentMainView('workspace'); };
  const copy = (text: string) => navigator.clipboard?.writeText(text);

  const openRename = (kind: 'project' | 'account', id: string, current: string) => { setRenameTarget({ kind, id, current }); setRenameValue(current); };
  const saveRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      if (renameTarget.kind === 'project') await renameProject(renameTarget.id, renameValue.trim());
      else await fsSetDoc(fsDoc(db, 'users', uid), { displayName: renameValue.trim() }, { merge: true });
      setRenameTarget(null);
      await load();
    } catch (e) { console.error('rename failed', e); }
    finally { setRenaming(false); }
  };

  const handleCreate = async () => {
    if (!uid || !newName.trim()) return;
    setCreating(true);
    try {
      const np = await createProject({ userId: uid, ownerName: email, projectName: newName.trim() });
      setProjects([np as any, ...projects]);
      setNewName(''); setCreateOpen(false);
      setActiveProjectId(np.id); setActiveWorkspaceId(null); setCurrentMainView('workspace');
    } catch (e) { console.error('create project failed', e); }
    finally { setCreating(false); }
  };

  // --- 操作 ---
  const unpublish = async (p: DesktopProject) => {
    if (!username) return;
    await unpublishSite({ kind: 'project', id: p.id }, username, { ownerUid: uid, projects });
    const site = siteByProject[p.id];
    if (site) await SiteRepository.save({ kind: 'project', id: p.id }, { ...site, publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null } });
  };
  const deleteSite = async (p: DesktopProject) => {
    const site = siteByProject[p.id];
    if (site?.publish?.status === 'published' && username) await unpublishSite({ kind: 'project', id: p.id }, username, { ownerUid: uid, projects });
    await SiteRepository.remove({ kind: 'project', id: p.id });
  };
  const removeProject = async (p: DesktopProject) => { await deleteSite(p).catch(() => {}); await deleteProject(p.id); };
  const duplicateToMy = async (p: DesktopProject) => { await duplicateAsMyProject({ sourceProjectId: p.id, userId: uid, ownerName: email }); };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try { await confirm.onConfirm(); setConfirm(null); await load(); }
    catch (e) { console.error('action failed', e); }
    finally { setBusy(false); }
  };

  // --- 集計 / フィルタ / 並べ替え / ページング ---
  const counts = useMemo(() => {
    const c = { all: projects.length, published: 0, draft: 0, none: 0 } as Record<FilterKey, number>;
    projects.forEach(p => { c[statusOf(siteByProject[p.id] ?? null)]++; });
    return c;
  }, [projects, siteByProject]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter(p => {
      const st = statusOf(siteByProject[p.id] ?? null);
      if (filter !== 'all' && st !== filter) return false;
      if (q && !(p.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ja') * dir;
      const da = siteByProject[a.id]?.updatedAt || a.lastModifiedAt || '';
      const db_ = siteByProject[b.id]?.updatedAt || b.lastModifiedAt || '';
      return da.localeCompare(db_) * dir;
    });
  }, [projects, siteByProject, query, filter, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageIds = pageItems.map(p => p.id);
  const allChecked = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const someChecked = pageIds.some(id => selected.has(id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageIds.forEach(id => next.delete(id));
    else pageIds.forEach(id => next.add(id));
    setSelected(next);
  };
  const toggleOne = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };

  const applyBulk = () => {
    const ids = [...selected];
    if (!bulkAction || ids.length === 0) return;
    const targets = ids.map(id => projects.find(p => p.id === id)).filter(Boolean) as DesktopProject[];
    if (bulkAction === 'unpublish') {
      setConfirm({ title: '一括 公開停止', message: `${targets.length} 件のサイトの公開を停止します。データは残ります。`, confirmLabel: '公開を停止', onConfirm: async () => { for (const p of targets) await unpublish(p).catch(() => {}); } });
    } else if (bulkAction === 'deleteSite') {
      setConfirm({ title: '一括 サイト削除', message: `${targets.length} 件のサイトを削除します（プロジェクトは残ります）。この操作は取り消せません。`, confirmLabel: '削除する', danger: true, onConfirm: async () => { for (const p of targets) await deleteSite(p).catch(() => {}); } });
    }
  };

  const menuProject = projects.find(p => p.id === menuProjectId) || null;
  const menuSite = menuProjectId ? siteByProject[menuProjectId] ?? null : null;
  const menuPerm = resolveProjectPermission(menuProject, uid);

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'すべて' }, { key: 'published', label: '公開中' }, { key: 'draft', label: '未公開' }, { key: 'none', label: '未作成' },
  ];
  const SortHead: React.FC<{ k: SortKey; label: string }> = ({ k, label }) => (
    <Box onClick={() => { if (sortBy === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('asc'); } }}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', color: sortBy === k ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)', '&:hover': { color: 'var(--brand-fg)' } }}>
      {label}{sortBy === k && (sortDir === 'asc' ? <ArrowUpwardRoundedIcon sx={{ fontSize: '0.85rem' }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: '0.85rem' }} />)}
    </Box>
  );

  const cell = { display: 'flex', alignItems: 'center', minWidth: 0 } as const;

  return (
    <Box sx={{ flex: 1, p: { xs: 2.5, md: 5 }, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%' }}>
        {/* ヘッダ */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {logoUrl
              ? <Box component="img" src={logoUrl} alt="logo" sx={{ width: 38, height: 38, borderRadius: 1.5, objectFit: 'cover', border: `1px solid ${BRAND.line}` }} />
              : <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PublicRoundedIcon sx={{ color: '#00BFFF' }} /></Box>}
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-fg)' }}>サイト管理</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}
            sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}>
            新規プロジェクト
          </Button>
        </Box>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.82rem', mb: 2.5 }}>
          {username ? `公開URL: ${publicUrl('@' + username)}` : 'ユーザー名は最初の公開時に設定します。'}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#00BFFF' }} /></Box>
        ) : (
          <>
            {/* アカウントサイト（ピン留め） */}
            <Paper sx={{ p: 1.25, px: 2, mb: 2.5, bgcolor: 'rgba(187,143,206,0.08)', border: '1px solid rgba(187,143,206,0.25)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.5, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', flexShrink: 0 }}>
                {logoUrl ? <Box component="img" src={logoUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PersonRoundedIcon sx={{ color: 'light-dark(#643579, #bb8fce)', fontSize: '1.2rem' }} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography noWrap sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.9rem' }}>{accountName}</Typography>
                  <Tooltip title="名前を変更"><IconButton size="small" onClick={() => openRename('account', uid, accountName)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, '&:hover': { color: 'var(--brand-fg)' } }}><EditRoundedIcon sx={{ fontSize: '0.85rem' }} /></IconButton></Tooltip>
                  <Chip label="アカウント" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, color: 'light-dark(#643579, #bb8fce)', bgcolor: 'rgba(187,143,206,0.16)' }} />
                  <StatusBadge status={statusOf(accountSite)} />
                  {(() => { const v = visibilityOf(accountSite); return v ? <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: v.icon === 'private' ? 'light-dark(#a57509, #f6c453)' : 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.7rem' }}>{v.icon === 'private' ? <LockRoundedIcon sx={{ fontSize: '0.8rem' }} /> : <PublicRoundedIcon sx={{ fontSize: '0.8rem' }} />}{v.label}</Box> : null; })()}
                </Box>
                {statusOf(accountSite) === 'published' && accountSite?.publish?.slug && (
                  <Typography noWrap sx={{ color: 'light-dark(#006fad, #7fd1ff)', fontSize: '0.72rem' }}>{publicUrl(accountSite.publish.slug)}</Typography>
                )}
              </Box>
              <Button size="small" onClick={() => setCurrentMainView('my-site')} startIcon={<LaunchRoundedIcon sx={{ fontSize: '0.95rem' }} />}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', border: `1px solid ${BRAND.line}`, borderRadius: 1.5, '&:hover': { color: 'var(--brand-fg)' } }}>編集</Button>
              <Button size="small" disabled={!accountSite} onClick={() => accountSite && setTarget({ source: { kind: 'account', id: uid }, site: accountSite, displayName: username || accountName })}
                variant="contained" startIcon={<PublicRoundedIcon sx={{ fontSize: '0.95rem' }} />}
                sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none', borderRadius: 1.5, '&:hover': { bgcolor: '#4facfe' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>公開設定</Button>
            </Paper>

            {/* 状況タブ＋検索（WP 風） */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                {TABS.map((t, i) => (
                  <React.Fragment key={t.key}>
                    {i > 0 && <Box sx={{ width: '1px', height: 12, bgcolor: BRAND.line, mx: 1 }} />}
                    <Box onClick={() => setFilter(t.key)} sx={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: filter === t.key ? 800 : 500, color: filter === t.key ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)' } }}>
                      {t.label} <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>({counts[t.key]})</Box>
                    </Box>
                  </React.Fragment>
                ))}
              </Box>
              <TextField value={query} onChange={e => setQuery(e.target.value)} placeholder="サイトを検索" size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: '1.05rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} /></InputAdornment>, sx: { color: 'var(--brand-fg)', fontSize: '0.82rem' } }}
                sx={{ width: 230, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' } } }} />
            </Box>

            {/* 一括操作バー＋件数・ページ */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select value={bulkAction} displayEmpty onChange={e => setBulkAction(e.target.value)}
                    sx={{ color: 'var(--brand-fg)', fontSize: '0.8rem', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderRadius: 2, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                    MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}>
                    <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>一括操作</MenuItem>
                    <MenuItem value="unpublish" sx={{ fontSize: '0.8rem' }}>公開を停止</MenuItem>
                    <MenuItem value="deleteSite" sx={{ fontSize: '0.8rem' }}>サイトを削除</MenuItem>
                  </Select>
                </FormControl>
                <Button size="small" onClick={applyBulk} disabled={!bulkAction || selected.size === 0}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', textTransform: 'none', border: `1px solid ${BRAND.line}`, borderRadius: 1.5, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>
                  適用{selected.size > 0 ? ` (${selected.size})` : ''}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.78rem', mr: 1 }}>{filtered.length} 件</Typography>
                <IconButton size="small" disabled={page <= 1} onClick={() => setPage(1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><FirstPageRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={page <= 1} onClick={() => setPage(p => p - 1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><ChevronLeftRoundedIcon fontSize="small" /></IconButton>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{page} / {pageCount}</Typography>
                <IconButton size="small" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><ChevronRightRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={page >= pageCount} onClick={() => setPage(pageCount)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><LastPageRoundedIcon fontSize="small" /></IconButton>
              </Box>
            </Box>

            {/* テーブル */}
            <Paper sx={{ bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 2, overflow: 'hidden' }}>
              {/* ヘッダ行 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', fontSize: '0.76rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                <Checkbox size="small" checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} sx={{ p: 0, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&.Mui-checked': { color: '#00BFFF' }, '&.MuiCheckbox-indeterminate': { color: '#00BFFF' } }} />
                <Box sx={cell}><SortHead k="name" label="サイト名" /></Box>
                <Box sx={cell}>状況</Box>
                <Box sx={cell}>公開範囲</Box>
                <Box sx={cell}>公開URL</Box>
                <Box sx={cell}><SortHead k="updated" label="更新日時" /></Box>
                <Box sx={{ ...cell, justifyContent: 'flex-end' }}>操作</Box>
              </Box>

              {/* データ行 */}
              {pageItems.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.85rem' }}>条件に一致するサイトはありません。</Box>
              ) : pageItems.map(p => {
                const site = siteByProject[p.id] ?? null;
                const status = statusOf(site);
                const url = status === 'published' && site?.publish?.slug ? publicUrl(site.publish.slug) : null;
                const hue = [...(p.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                const checked = selected.has(p.id);
                return (
                  <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}`, transition: 'background 0.12s', bgcolor: checked ? 'rgba(0,191,255,0.06)' : 'transparent', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' }, '&:last-of-type': { borderBottom: 'none' } }}>
                    <Checkbox size="small" checked={checked} onChange={() => toggleOne(p.id)} sx={{ p: 0, color: 'rgb(var(--brand-fg-rgb) / 0.35)', '&.Mui-checked': { color: '#00BFFF' } }} />
                    {/* 名前 */}
                    <Box sx={{ ...cell, gap: 1.25 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${BRAND.line}` }}>
                        {p.iconUrl ? <Box component="img" src={p.iconUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : p.iconEmoji ? <Box component="span" sx={{ fontSize: '1rem' }}>{p.iconEmoji}</Box>
                            : <FolderRoundedIcon sx={{ fontSize: '1rem', color: `hsl(${hue},70%,65%)` }} />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography onClick={() => openProject(p.id)} noWrap sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.86rem', cursor: 'pointer', '&:hover': { color: '#00BFFF' } }}>{p.name}</Typography>
                        {p.isTeam && <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', letterSpacing: '0.06em' }}>TEAM</Typography>}
                      </Box>
                    </Box>
                    {/* 状況 */}
                    <Box sx={cell}><StatusBadge status={status} /></Box>
                    {/* 公開範囲 */}
                    <Box sx={cell}>
                      {(() => { const v = visibilityOf(site); return v
                        ? <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color: v.icon === 'private' ? 'light-dark(#a57509, #f6c453)' : 'rgb(var(--brand-fg-rgb) / 0.65)', fontSize: '0.74rem' }}>
                            {v.icon === 'private' ? <LockRoundedIcon sx={{ fontSize: '0.85rem' }} /> : <PublicRoundedIcon sx={{ fontSize: '0.85rem' }} />}{v.label}
                          </Box>
                        : <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: '0.78rem' }}>—</Typography>; })()}
                    </Box>
                    {/* URL */}
                    <Box sx={{ ...cell, gap: 0.25 }}>
                      {url ? (
                        <>
                          <Typography noWrap sx={{ color: 'light-dark(#006fad, #7fd1ff)', fontSize: '0.74rem', minWidth: 0 }}>{url.replace('https://', '')}</Typography>
                          <Tooltip title="コピー"><IconButton size="small" onClick={() => copy(url)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25 }}><ContentCopyRoundedIcon sx={{ fontSize: '0.8rem' }} /></IconButton></Tooltip>
                          <Tooltip title="開く"><IconButton size="small" onClick={() => window.open(url, '_blank')} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25 }}><OpenInNewRoundedIcon sx={{ fontSize: '0.8rem' }} /></IconButton></Tooltip>
                        </>
                      ) : <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: '0.78rem' }}>—</Typography>}
                    </Box>
                    {/* 更新日時 */}
                    <Box sx={{ ...cell, color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.74rem' }}>{fmtDateTime(site?.updatedAt || p.lastModifiedAt)}</Box>
                    {/* 操作 */}
                    <Box sx={{ ...cell, justifyContent: 'flex-end', gap: 0.25 }}>
                      <Tooltip title={site ? 'サイトを開く' : 'サイトを作成'}>
                        <IconButton size="small" onClick={() => openProject(p.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)' } }}><LaunchRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton>
                      </Tooltip>
                      <Tooltip title={site ? '公開設定' : 'まずサイトを作成してください'}>
                        <span>
                          <IconButton size="small" disabled={!site} onClick={() => site && setTarget({ source: { kind: 'project', id: p.id }, site, displayName: p.name })}
                            sx={{ color: status === 'published' ? '#43e97b' : '#00BFFF', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><PublicRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton>
                        </span>
                      </Tooltip>
                      <IconButton size="small" onClick={e => { setMenuAnchor(e.currentTarget); setMenuProjectId(p.id); }} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}><MoreVertRoundedIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          </>
        )}
      </Box>

      {/* 行のケバブメニュー */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 200 } } }}>
        {menuProject && <MenuItem onClick={() => { openProject(menuProject.id); setMenuAnchor(null); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><LaunchRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>{menuSite ? '開く' : 'サイトを作成'}</MenuItem>}
        {menuProject && menuPerm.canEdit && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); openRename('project', p.id, p.name); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><EditRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>名前を変更</MenuItem>}

        {/* チーム / メンバー管理（docs/15） */}
        {menuProject && !menuProject.isTeam && menuPerm.canManage && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setPromoteTarget(p); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: '#00BFFF', minWidth: 32 }}><GroupsRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>チームに昇格</MenuItem>}
        {menuProject && menuProject.isTeam && menuPerm.canManage && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setMemberTarget(p); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><GroupAddRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>メンバー管理</MenuItem>}
        {menuProject && menuProject.isTeam && menuPerm.isMember && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setConfirm({ title: 'MYプロジェクトとして複製', message: `「${p.name}」を自分の個人プロジェクトとして複製します（サイト構成を引き継ぎ、未公開の下書きになります）。`, confirmLabel: '複製する', onConfirm: () => duplicateToMy(p) }); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><ContentCopyRoundedIcon sx={{ fontSize: '1.05rem' }} /></ListItemIcon>MYプロジェクトとして複製</MenuItem>}

        {menuSite?.publish?.status === 'published' && <MenuItem onClick={() => { window.open(publicUrl(menuSite.publish!.slug), '_blank'); setMenuAnchor(null); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><OpenInNewRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>ブラウザで開く</MenuItem>}
        {menuSite?.publish?.status === 'published' && menuProject && menuPerm.canManage && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setConfirm({ title: '公開を停止', message: `「${p.name}」の公開を停止します。データは残ります。`, confirmLabel: '公開を停止', onConfirm: () => unpublish(p) }); }} sx={{ fontSize: '0.85rem' }}><ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><VisibilityOffRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>公開を停止</MenuItem>}
        {menuSite && menuProject && menuPerm.canManage && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setConfirm({ title: 'サイトを削除', message: `「${p.name}」のサイトを削除します（プロジェクトは残ります）。この操作は取り消せません。`, confirmLabel: '削除する', danger: true, onConfirm: () => deleteSite(p) }); }} sx={{ fontSize: '0.85rem', color: 'light-dark(#a50832, #fa9bb4)' }}><ListItemIcon sx={{ color: 'light-dark(#a50832, #fa9bb4)', minWidth: 32 }}><DeleteOutlineRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>サイトを削除</MenuItem>}
        {menuProject && menuPerm.canManage && <Divider sx={{ borderColor: BRAND.line }} />}
        {menuProject && menuPerm.canManage && <MenuItem onClick={() => { const p = menuProject; setMenuAnchor(null); setConfirm({ title: 'プロジェクトを削除', message: `「${p.name}」をプロジェクトごと削除します。この操作は取り消せません。`, confirmLabel: 'プロジェクトを削除', danger: true, onConfirm: () => removeProject(p) }); }} sx={{ fontSize: '0.85rem', color: '#ef4444' }}><ListItemIcon sx={{ color: '#ef4444', minWidth: 32 }}><DeleteForeverRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>プロジェクトを削除</MenuItem>}
      </Menu>

      {/* 公開ダイアログ */}
      {target && <PublishDialog open manage source={target.source} site={target.site} displayName={target.displayName} onChanged={load} onClose={() => { setTarget(null); load(); }} />}

      {/* チームに昇格 */}
      {promoteTarget && <PromoteToTeamDialog open project={promoteTarget} uid={uid} ownerName={accountName} onClose={() => setPromoteTarget(null)} onDone={load} />}

      {/* メンバー管理 */}
      {memberTarget && <MemberManagementDialog open project={memberTarget} uid={uid} onClose={() => setMemberTarget(null)} onChanged={load} />}

      {/* 確認ダイアログ */}
      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 420, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{confirm?.title}</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>{confirm?.message}</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={runConfirm} disabled={busy} variant="contained" sx={{ bgcolor: confirm?.danger ? '#ef4444' : '#00BFFF', color: confirm?.danger ? 'var(--brand-fg)' : '#000', fontWeight: 800, '&:hover': { bgcolor: confirm?.danger ? '#dc2626' : '#4facfe' } }}>
            {busy ? '処理中...' : (confirm?.confirmLabel || 'OK')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 名前を変更 */}
      <Dialog open={!!renameTarget} onClose={() => !renaming && setRenameTarget(null)}
        PaperProps={{ sx: { bgcolor: BRAND.panel, color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 400 } }}>
        <DialogTitle>{renameTarget?.kind === 'account' ? 'アカウント名を変更' : 'サイト名を変更'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="名前" fullWidth variant="outlined" value={renameValue}
            onChange={e => setRenameValue(e.target.value)} disabled={renaming}
            onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) saveRename(); }}
            InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setRenameTarget(null)} disabled={renaming} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={saveRename} disabled={renaming || !renameValue.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>{renaming ? '保存中...' : '保存'}</Button>
        </DialogActions>
      </Dialog>

      {/* 新規プロジェクト */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)}
        PaperProps={{ sx: { bgcolor: BRAND.panel, color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 400 } }}>
        <DialogTitle>新規プロジェクト作成</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="プロジェクト名" fullWidth variant="outlined" value={newName} onChange={e => setNewName(e.target.value)} disabled={creating}
            InputProps={{ style: { color: 'var(--brand-fg)' } }} InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' } } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleCreate} disabled={creating || !newName.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>{creating ? '作成中...' : '作成'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SiteManagementPage;
