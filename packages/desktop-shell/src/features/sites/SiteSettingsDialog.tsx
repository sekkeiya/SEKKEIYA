import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, Select, FormControl, InputLabel,
  CircularProgress, Divider, IconButton, Avatar, Tooltip,
} from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import type { SiteSource } from './siteRepository';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { useAppStore } from '../../store/useAppStore';
import { useAccountProfileStore } from '../../store/useAccountProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getUsername, publishSite, setSitePrivate, ACCOUNT_NOT_PUBLISHED } from './publishService';
import { resolvePublishSnapshot } from './resolvePublishSnapshot';
import { renameProject } from '../projects/api/updateProject';
import { deleteProject } from '../projects/api/deleteProject';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';

// ─── Banner Templates ────────────────────────────────────────────────────────

function makeSvgBanner(defs: string, elements: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">${defs}${elements}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const BANNER_TEMPLATES: { id: string; label: string; url: string }[] = [
  {
    id: 'arch-midnight',
    label: 'Midnight',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#050d1a"/><stop offset="55%" stop-color="#0f2040"/><stop offset="100%" stop-color="#07111e"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/><rect x="0" y="0" width="1200" height="1" fill="rgba(255,255,255,0.06)"/><rect x="0" y="629" width="1200" height="1" fill="rgba(255,255,255,0.04)"/>`
    ),
  },
  {
    id: 'concrete',
    label: 'Concrete',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2a2a2a"/><stop offset="50%" stop-color="#3c3c3c"/><stop offset="100%" stop-color="#1e1e1e"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'nordic',
    label: 'Nordic',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0ede8"/><stop offset="50%" stop-color="#e4dfd9"/><stop offset="100%" stop-color="#ece8e3"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a1628"/><stop offset="100%" stop-color="#0d2040"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>
       <line x1="0" y1="210" x2="1200" y2="210" stroke="rgba(100,160,255,0.12)" stroke-width="1"/>
       <line x1="0" y1="420" x2="1200" y2="420" stroke="rgba(100,160,255,0.12)" stroke-width="1"/>
       <line x1="400" y1="0" x2="400" y2="630" stroke="rgba(100,160,255,0.12)" stroke-width="1"/>
       <line x1="800" y1="0" x2="800" y2="630" stroke="rgba(100,160,255,0.12)" stroke-width="1"/>
       <circle cx="600" cy="315" r="180" stroke="rgba(100,160,255,0.08)" stroke-width="1" fill="none"/>
       <circle cx="600" cy="315" r="100" stroke="rgba(100,160,255,0.1)" stroke-width="1" fill="none"/>`
    ),
  },
  {
    id: 'forest',
    label: 'Forest',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a1a0f"/><stop offset="50%" stop-color="#162a1b"/><stop offset="100%" stop-color="#0c1e12"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'copper',
    label: 'Copper',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1c1008"/><stop offset="50%" stop-color="#2e1c0e"/><stop offset="100%" stop-color="#180e06"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'dusk',
    label: 'Dusk',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#1a0a2e"/><stop offset="50%" stop-color="#2d1b4e"/><stop offset="100%" stop-color="#0d0018"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'fog',
    label: 'Fog',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c8cdd4"/><stop offset="50%" stop-color="#b8bec7"/><stop offset="100%" stop-color="#d0d4db"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>`
    ),
  },
  {
    id: 'void',
    label: 'Void',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#040406"/><stop offset="100%" stop-color="#0a0a10"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>
       <ellipse cx="600" cy="315" rx="500" ry="200" fill="rgba(255,255,255,0.012)"/>`
    ),
  },
  {
    id: 'horizon',
    label: 'Horizon',
    url: makeSvgBanner(
      `<defs>
         <linearGradient id="sky" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#0a1628"/><stop offset="100%" stop-color="#1a3050"/></linearGradient>
         <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0d0d0d"/><stop offset="100%" stop-color="#050505"/></linearGradient>
       </defs>`,
      `<rect width="1200" height="630" fill="url(#sky)"/>
       <rect y="380" width="1200" height="250" fill="url(#gnd)"/>
       <line x1="0" y1="380" x2="1200" y2="380" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`
    ),
  },
  {
    id: 'grid-light',
    label: 'Grid Light',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8f6f2"/><stop offset="100%" stop-color="#eeeae4"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>
       ${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`).join('')}
       ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 105}" x2="1200" y2="${i * 105}" stroke="rgba(0,0,0,0.07)" stroke-width="1"/>`).join('')}`
    ),
  },
  {
    id: 'grid-dark',
    label: 'Grid Dark',
    url: makeSvgBanner(
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0c0f14"/><stop offset="100%" stop-color="#10141c"/></linearGradient></defs>`,
      `<rect width="1200" height="630" fill="url(#g)"/>
       ${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`).join('')}
       ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 105}" x2="1200" y2="${i * 105}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`).join('')}`
    ),
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const MENU_PAPER_SX = {
  bgcolor: '#1a2030',
  backgroundImage: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  '& .MuiMenuItem-root': { color: '#fff' },
  '& .MuiMenuItem-root:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
  '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'rgba(0,191,255,0.15)' },
  '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: 'rgba(0,191,255,0.2)' },
};

const SELECT_SX = {
  color: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00BFFF' },
};

const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
  },
};

const SOURCE_BTN_SX = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'none' as const,
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 1.5,
  px: 1.5,
  py: 0.6,
  gap: 0.6,
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.25)' },
};

const SOURCE_BTN_ACTIVE_SX = {
  ...SOURCE_BTN_SX,
  color: '#00BFFF',
  borderColor: 'rgba(0,191,255,0.4)',
  bgcolor: 'rgba(0,191,255,0.08)',
  '&:hover': { bgcolor: 'rgba(0,191,255,0.14)' },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  source: SiteSource;
  displayName: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SiteSettingsDialog: React.FC<Props> = ({ open, onClose, source, displayName }) => {
  const isProject = source.kind === 'project';
  const projectId = source.id;

  const site = useProjectSiteStore(s => s.site);
  const applyPublishState = useProjectSiteStore(s => s.applyPublishState);
  const setSiteMeta = useProjectSiteStore(s => s.setSiteMeta);
  const save = useProjectSiteStore(s => s.save);

  const projects = useAppStore(s => s.projects);
  const setProjects = useAppStore(s => s.setProjects);
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const setAccountLogoUrl = useAccountProfileStore(s => s.setLogoUrl);

  const uid = useAuthStore(s => s.currentUser?.uid) || '';
  const visibility = site?.publish.visibility ?? 'private';

  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  // 公開範囲の切り替え。公開中なら publishedSites（公開コピー）まで即時反映する。
  const handleVisibilityChange = async (next: 'public' | 'private') => {
    if (!site || next === visibility) return;
    setVisibilityError(null);
    // 未公開なら公開コピーが無いのでローカル設定の保存のみ。
    if (site.publish.status !== 'published') {
      await applyPublishState({ ...site.publish, visibility: next });
      return;
    }
    setVisibilityBusy(true);
    try {
      const username = await getUsername(uid);
      if (!username) throw new Error('ユーザー名が未設定です。「公開」ボタンから設定してください。');
      const projects = useAppStore.getState().projects as any;
      if (next === 'private') {
        const publish = await setSitePrivate(source, username, { ownerUid: uid, current: site.publish, projects });
        await applyPublishState(publish);
      } else {
        const resolved = await resolvePublishSnapshot(site, uid, projects);
        const { publish } = await publishSite({ source, ownerUid: uid, username, site: resolved, projectName: displayName, projects });
        await applyPublishState(publish);
      }
    } catch (e: any) {
      setVisibilityError(e?.message === ACCOUNT_NOT_PUBLISHED
        ? '先にアカウントサイト（マイページ）を公開してください。'
        : `切り替えに失敗しました: ${e?.message ?? e}`);
    } finally { setVisibilityBusy(false); }
  };

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Banner source picker state
  type BannerPanel = 'template' | 'simage' | null;
  const [bannerPanel, setBannerPanel] = useState<BannerPanel>(null);
  const [dsiImages, setDsiImages] = useState<{ id: string; url: string; thumb: string }[]>([]);
  const [dsiLoading, setDsiLoading] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(displayName); setConfirmDelete(false); setBannerPanel(null); }
  }, [open, displayName]);

  // Load S.Image items when that panel is opened
  useEffect(() => {
    if (bannerPanel !== 'simage' || !isProject) return;
    setDsiLoading(true);
    const q = query(
      collection(db, `projects/${projectId}/workFiles`),
      where('appScope', '==', '3dsi'),
      where('mediaType', '==', 'image'),
      limit(60)
    );
    getDocs(q).then(snap => {
      const imgs = snap.docs
        .map(d => { const data = d.data(); return { id: d.id, url: data.downloadUrl || '', thumb: data.thumbnailUrl || data.downloadUrl || '' }; })
        .filter(i => i.url);
      setDsiImages(imgs);
    }).catch(err => {
      console.error('[SiteSettings] Failed to load S.Image items', err);
      setDsiImages([]);
    }).finally(() => setDsiLoading(false));
  }, [bannerPanel, projectId, isProject]);

  const handleSaveName = async () => {
    const next = name.trim();
    if (!isProject || !next || next === displayName) return;
    setSavingName(true);
    try {
      await renameProject(projectId, next);
      setProjects(projects.map(p => p.id === projectId ? { ...p, name: next } : p));
    } catch (e) {
      console.error('[site-settings] rename failed', e);
    } finally {
      setSavingName(false);
    }
  };

  const handleDelete = async () => {
    if (!isProject) return;
    setDeleting(true);
    try {
      await deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      setActiveProjectId(null);
      setCurrentMainView('my-site');
      onClose();
    } catch (e) {
      console.error('[site-settings] delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  const syncAccountLogo = async (url: string | null) => {
    if (source.kind !== 'account') return;
    await setDoc(doc(db, 'users', source.id), { accountLogoUrl: url ?? null }, { merge: true });
    setAccountLogoUrl(url);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadImageAndGetUrl(file);
      setSiteMeta({ logoUrl: url });
      await Promise.all([save(), syncAccountLogo(url)]);
    } catch (err) {
      console.error('[site-settings] logo upload failed', err);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // バナー設定後にプロジェクトdocの coverThumbnailUrl も同期（カードサムネに即反映）
  const syncBannerToProjectDoc = useCallback(async (url: string | null) => {
    if (!isProject) return;
    await setDoc(doc(db, 'projects', projectId), { coverThumbnailUrl: url ?? null }, { merge: true });
    setProjects(projects.map(p => p.id === projectId ? { ...p, coverThumbnailUrl: url ?? undefined } : p));
  }, [isProject, projectId, projects, setProjects]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const url = await uploadImageAndGetUrl(file);
      setSiteMeta({ bannerUrl: url });
      await save();
      await syncBannerToProjectDoc(url);
      setBannerPanel(null);
    } catch (err) {
      console.error('[site-settings] banner upload failed', err);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleSelectBannerUrl = useCallback(async (url: string) => {
    setSiteMeta({ bannerUrl: url });
    await save();
    await syncBannerToProjectDoc(url);
    setBannerPanel(null);
  }, [setSiteMeta, save, syncBannerToProjectDoc]);

  const sectionLabel = (t: string) => (
    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 1.25 }}>
      {t}
    </Typography>
  );

  return (
    <Dialog
      open={open}
      onClose={() => !deleting && !savingName && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#11151d', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', backgroundImage: 'none' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, fontSize: 16, fontWeight: 800 }}>
        <SettingsRoundedIcon sx={{ color: '#00BFFF' }} />
        サイト設定
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '8px !important' }}>

        {/* 基本情報（プロジェクト名）*/}
        {isProject && (
          <Box>
            {sectionLabel('基本情報')}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="プロジェクト名" value={name} onChange={e => setName(e.target.value)}
                size="small" fullWidth disabled={savingName} sx={INPUT_SX}
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); }}
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || !name.trim() || name.trim() === displayName}
                variant="contained"
                sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap', height: 40 }}
              >
                {savingName ? <CircularProgress size={16} color="inherit" /> : '保存'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ロゴ・バナー画像 */}
        <Box>
          {sectionLabel('画像')}

          {/* ロゴ */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              src={site?.logoUrl}
              variant="rounded"
              sx={{ width: 64, height: 64, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
            >
              {!site?.logoUrl && <ImageRoundedIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }} />}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 600, mb: 0.5 }}>ロゴ</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 1 }}>
                サイト上部に表示されるシンボルマーク・ロゴタイプ
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <Button
                  size="small"
                  startIcon={uploadingLogo ? <CircularProgress size={14} color="inherit" /> : <AddPhotoAlternateRoundedIcon />}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  sx={{ fontSize: 12, textTransform: 'none', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.35)', borderRadius: 1.5, px: 1.5, '&:hover': { bgcolor: 'rgba(0,191,255,0.08)' } }}
                >
                  {site?.logoUrl ? '変更' : 'アップロード'}
                </Button>
                {site?.logoUrl && (
                  <Button
                    size="small"
                    onClick={() => { setSiteMeta({ logoUrl: null }); save(); syncAccountLogo(null); }}
                    sx={{ fontSize: 12, textTransform: 'none', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ff6b6b', bgcolor: 'transparent' } }}
                  >
                    削除
                  </Button>
                )}
              </Box>
            </Box>
          </Box>

          {/* バナー */}
          <Box>
            {/* プレビュー */}
            <Box
              sx={{
                position: 'relative', borderRadius: 2, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: 'rgba(255,255,255,0.04)',
                height: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundImage: site?.bannerUrl ? `url("${site.bannerUrl}")` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center',
                mb: 1,
              }}
            >
              {!site?.bannerUrl && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <ImageRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 32 }} />
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>バナー画像未設定</Typography>
                </Box>
              )}
              <Typography sx={{ position: 'absolute', top: 8, left: 12, fontSize: 11, fontWeight: 700, color: site?.bannerUrl ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
                バナー / OGP 画像
              </Typography>
              {site?.bannerUrl && (
                <Button
                  size="small"
                  onClick={() => { setSiteMeta({ bannerUrl: null }); save(); syncBannerToProjectDoc(null); }}
                  sx={{ position: 'absolute', top: 6, right: 8, fontSize: 11, textTransform: 'none', color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 1.5, px: 1.5, backdropFilter: 'blur(6px)', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)', color: '#ff6b6b' } }}
                >
                  削除
                </Button>
              )}
            </Box>

            {/* ソースボタン行 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Button
                size="small"
                startIcon={<GridViewRoundedIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() => setBannerPanel(p => p === 'template' ? null : 'template')}
                sx={bannerPanel === 'template' ? SOURCE_BTN_ACTIVE_SX : SOURCE_BTN_SX}
              >
                テンプレート
              </Button>

              <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerUpload} />
              <Button
                size="small"
                startIcon={uploadingBanner
                  ? <CircularProgress size={12} color="inherit" />
                  : <FolderOpenRoundedIcon sx={{ fontSize: '14px !important' }} />
                }
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                sx={SOURCE_BTN_SX}
              >
                フォルダから選ぶ
              </Button>

              {isProject && (
                <Button
                  size="small"
                  startIcon={<PhotoLibraryRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => setBannerPanel(p => p === 'simage' ? null : 'simage')}
                  sx={bannerPanel === 'simage' ? SOURCE_BTN_ACTIVE_SX : SOURCE_BTN_SX}
                >
                  S.Image から選ぶ
                </Button>
              )}
            </Box>

            {/* テンプレートパネル */}
            {bannerPanel === 'template' && (
              <Box sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)', p: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mb: 1.25 }}>
                  テンプレートを選択
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
                  {BANNER_TEMPLATES.map(tpl => {
                    const isSelected = site?.bannerUrl === tpl.url;
                    return (
                      <Tooltip key={tpl.id} title={tpl.label} placement="top" arrow>
                        <Box
                          onClick={() => handleSelectBannerUrl(tpl.url)}
                          sx={{
                            position: 'relative',
                            aspectRatio: '1200 / 630',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            backgroundImage: `url("${tpl.url}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: isSelected ? '2px solid #00BFFF' : '2px solid transparent',
                            transition: 'border-color 0.15s, transform 0.15s',
                            '&:hover': { transform: 'scale(1.04)', borderColor: isSelected ? '#00BFFF' : 'rgba(255,255,255,0.3)' },
                          }}
                        >
                          {isSelected && (
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,191,255,0.25)' }}>
                              <CheckRoundedIcon sx={{ color: '#00BFFF', fontSize: 20 }} />
                            </Box>
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* S.Image パネル */}
            {bannerPanel === 'simage' && (
              <Box sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)', p: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mb: 1.25 }}>
                  S.Image から選択
                </Typography>
                {dsiLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.3)' }} />
                  </Box>
                ) : dsiImages.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 2 }}>
                    S.Image に画像がありません
                  </Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, maxHeight: 200, overflowY: 'auto' }}>
                    {dsiImages.map(img => {
                      const isSelected = site?.bannerUrl === img.url;
                      return (
                        <Box
                          key={img.id}
                          onClick={() => handleSelectBannerUrl(img.url)}
                          sx={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            backgroundImage: `url("${img.thumb}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: isSelected ? '2px solid #00BFFF' : '2px solid transparent',
                            bgcolor: 'rgba(255,255,255,0.05)',
                            transition: 'border-color 0.15s, transform 0.15s',
                            '&:hover': { transform: 'scale(1.04)', borderColor: isSelected ? '#00BFFF' : 'rgba(255,255,255,0.3)' },
                          }}
                        >
                          {isSelected && (
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,191,255,0.25)' }}>
                              <CheckRoundedIcon sx={{ color: '#00BFFF', fontSize: 18 }} />
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}

            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', mt: 0.75 }}>
              SNS シェア時のサムネイルにも使用されます（推奨: 1200 × 630 px）
            </Typography>
          </Box>
        </Box>

        {/* 公開範囲 */}
        {site && (
          <Box>
            {sectionLabel('公開範囲')}
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>公開設定</InputLabel>
              <Select
                value={visibility}
                label="公開設定"
                disabled={visibilityBusy}
                onChange={e => handleVisibilityChange(e.target.value as 'public' | 'private')}
                sx={SELECT_SX}
                MenuProps={{ PaperProps: { sx: MENU_PAPER_SX } }}
              >
                <MenuItem value="public">公開（リンクを知っている人が閲覧可）</MenuItem>
                <MenuItem value="private">非公開</MenuItem>
              </Select>
            </FormControl>
            {visibilityError && (
              <Typography sx={{ fontSize: 11, color: '#fa709a', mt: 0.75 }}>{visibilityError}</Typography>
            )}
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 0.75 }}>
              {site.publish.status === 'published'
                ? `公開中のサイトに即時反映されます。非公開にしても URL は保持され、公開に戻すと同じ URL で復帰します。${!isProject ? 'アカウントサイトを非公開にすると、配下のプロジェクトサイトもすべて閲覧できなくなります。' : ''}`
                : '初回の公開・URL の発行は「公開」ボタンから行います。'}
            </Typography>
          </Box>
        )}

        {/* 危険な操作（削除）*/}
        {isProject && (
          <Box>
            <Divider sx={{ borderColor: 'rgba(255,77,79,0.2)', mb: 2 }} />
            {sectionLabel('危険な操作')}
            {!confirmDelete ? (
              <Button
                onClick={() => setConfirmDelete(true)}
                startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ff6b6b', textTransform: 'none', fontWeight: 700, border: '1px solid rgba(255,77,79,0.4)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,77,79,0.08)', borderColor: '#ff4d4f' } }}
              >
                このプロジェクトを削除
              </Button>
            ) : (
              <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(255,77,79,0.4)', bgcolor: 'rgba(255,77,79,0.06)' }}>
                <Typography sx={{ fontSize: 13, color: '#fff', mb: 1.5 }}>
                  「{displayName}」を削除しますか？プロジェクトとサイトは元に戻せません。
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={() => setConfirmDelete(false)} disabled={deleting} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleDelete} disabled={deleting} variant="contained"
                    sx={{ bgcolor: '#ff4d4f', color: '#fff', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#e0383a' } }}
                  >
                    {deleting ? <CircularProgress size={16} color="inherit" /> : '削除する'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={deleting || savingName} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontWeight: 600 }}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};
