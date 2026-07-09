import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Chip,
  Divider,
} from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { WorkFileRepository } from '../../../../projects/workFileRepository';
import { PreviewDialog } from '../../../../../components/Projects/PreviewDialog';
import type { WorkFile, WorkFileVersion } from '../../../../projects/types';
import { getLocalVersions, getAllLocalVersions } from '../../../../projects/utils/workFileFsHelpers';
import { useWorkFileSyncStore } from '../../../../../store/useWorkFileSyncStore';
// @ts-ignore
import { generateThumbnailFromGlb } from '../../../../dss/upload/utils/generateThumbnailFromGlb';

export type UnifiedVersion = {
  id: string;
  name: string;
  isLocal: boolean;
  versionNumber?: number;
  createdAt: string;
  storagePath?: string;
  localPath?: string;
  comment?: string;
  size?: number;
  thumbnailUrl?: string;
};

interface Props {
  projectId: string;
  projectName?: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (workFile: WorkFile) => void;
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : n >= 100 ? 0 : 1)} ${units[i]}`;
}

const fileThumbKey    = (fileId: string) => `file::${fileId}`;
const versionThumbKey = (fileId: string, versionId: string) => `${fileId}::${versionId}`;

export default function SelectWorkFileAsBaseModal({ projectId, projectName, open, onClose, onConfirm }: Props) {
  const [workFiles, setWorkFiles]     = useState<WorkFile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Left-panel selection
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Right-panel: which version is "active" (highlighted + shown in big thumb)
  const [activeVersions, setActiveVersions] = useState<Record<string, UnifiedVersion | null>>({});

  const [versionsMap, setVersionsMap]       = useState<Record<string, UnifiedVersion[]>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});
  const [resolvedSizes, setResolvedSizes]   = useState<Record<string, number>>({});

  // Preview dialog
  const [previewFile, setPreviewFile]       = useState<WorkFile | null>(null);
  const [previewVersion, setPreviewVersion] = useState<UnifiedVersion | null>(null);

  // Generated thumbnails
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const thumbsRef = useRef<Record<string, string>>({});
  useEffect(() => { thumbsRef.current = thumbs; }, [thumbs]);
  useEffect(() => () => {
    Object.values(thumbsRef.current).forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
  }, []);

  // ── Load work files ──────────────────────────────────────────
  useEffect(() => {
    if (!open || !projectId) return;
    let mounted = true;

    const fetchFiles = async () => {
      setLoading(true); setError(null);
      try {
        const files = await WorkFileRepository.getWorkFiles(projectId);
        const valid = files.filter(f => {
          const ext = (f.name || '').toLowerCase().split('.').pop();
          return (ext && ['glb', 'gltf', '3dm'].includes(ext)) || f.toolType === 'rhino';
        });
        if (!mounted) return;
        setWorkFiles(valid);
        if (valid.length > 0) loadVersionsForFile(valid[0], mounted);
        resolveLocalSizes(valid, mounted);
      } catch (e) {
        console.error(e);
        if (mounted) setError('Work Files の取得に失敗しました。');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const resolveLocalSizes = async (files: WorkFile[], m: boolean) => {
      for (const fw of files) {
        if (!m) return;
        if (typeof (fw as any).size === 'number') continue;
        try {
          const active = useWorkFileSyncStore.getState().activeFiles[fw.id];
          const local = active?.localPath
            ? await getLocalVersions(active.localPath)
            : await getAllLocalVersions(projectId, fw.id, projectName, fw.name);
          const hit = local.find(v => typeof v.size === 'number');
          if (m && hit) setResolvedSizes(p => ({ ...p, [fw.id]: hit.size }));
        } catch {}
      }
    };

    fetchFiles();
    return () => {
      mounted = false;
      setSelectedFileId(null);
      setActiveVersions({});
      setPreviewFile(null);
      setPreviewVersion(null);
    };
  }, [open, projectId, projectName]);

  // ── Load versions for a file ─────────────────────────────────
  const loadVersionsForFile = useCallback(async (fw: WorkFile, isMounted = true) => {
    setSelectedFileId(fw.id);
    if (versionsMap[fw.id]) return; // already loaded

    setLoadingVersions(p => ({ ...p, [fw.id]: true }));
    try {
      let cloud: WorkFileVersion[] = [];
      try { cloud = await WorkFileRepository.getVersions(projectId, fw.id); } catch {}

      let local: any[] = [];
      try {
        const active = useWorkFileSyncStore.getState().activeFiles[fw.id];
        local = active?.localPath
          ? await getLocalVersions(active.localPath)
          : await getAllLocalVersions(projectId, fw.id, projectName, fw.name);
      } catch {}

      const mappedCloud: UnifiedVersion[] = cloud.map((v: any) => ({
        id: v.id, name: `v${v.versionNumber}`, isLocal: false,
        versionNumber: v.versionNumber, createdAt: v.createdAt,
        storagePath: v.storagePath, comment: v.comment,
        size: v.size ?? v.fileSize ?? v.sizeBytes ?? undefined,
        thumbnailUrl: v.thumbnailUrl ?? undefined,
      }));
      const mappedLocal: UnifiedVersion[] = local.map(v => ({
        id: `local:${v.path}`, name: v.name, isLocal: true,
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
        localPath: v.path, comment: 'Local File',
        size: typeof v.size === 'number' ? v.size : undefined,
      }));

      const combined = [...mappedLocal, ...mappedCloud].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      if (isMounted) {
        setVersionsMap(p => ({ ...p, [fw.id]: combined }));
        // Auto-select the latest (first) version
        setActiveVersions(p => ({ ...p, [fw.id]: combined[0] ?? null }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted) setLoadingVersions(p => ({ ...p, [fw.id]: false }));
    }
  }, [projectId, projectName, versionsMap]);

  // ── Confirm ──────────────────────────────────────────────────
  const handleConfirm = (fw: WorkFile, v?: UnifiedVersion | null) => {
    if (v) {
      onConfirm({ ...fw, currentVersionId: v.isLocal ? undefined : v.id, latestVersionNumber: v.versionNumber, storagePath: v.storagePath, localPath: v.localPath });
    } else {
      onConfirm(fw);
    }
  };

  // ── Thumbnail generation ─────────────────────────────────────
  const handleGlbReady = useCallback(async (glbUrl: string) => {
    const fw = previewFile;
    if (!fw) return;
    const key = previewVersion ? versionThumbKey(fw.id, previewVersion.id) : fileThumbKey(fw.id);
    if (thumbsRef.current[key]) return;
    try {
      const resp = await fetch(glbUrl);
      const blob = await resp.blob();
      const base = (fw.name || 'model').replace(/\.[^.]+$/, '');
      const glbFile = new File([blob], `${base}.glb`, { type: 'model/gltf-binary' });
      const { blob: tb } = await generateThumbnailFromGlb(glbFile, { width: 640, height: 480 });
      const url = URL.createObjectURL(tb);
      setThumbs(p => {
        if (p[key]) { try { URL.revokeObjectURL(p[key]); } catch {} }
        return { ...p, [key]: url };
      });
    } catch (e) { console.warn('[SelectWorkFileAsBaseModal] thumb failed', e); }
  }, [previewFile, previewVersion]);

  // ── Derived ──────────────────────────────────────────────────
  const selectedFile     = workFiles.find(f => f.id === selectedFileId) ?? null;
  const versions         = selectedFile ? (versionsMap[selectedFile.id] ?? []) : [];
  const activeVer        = selectedFile ? (activeVersions[selectedFile.id] ?? null) : null;
  const isLoadingVers    = selectedFile ? !!loadingVersions[selectedFile.id] : false;

  // Thumb to show in big area: prefer version-specific generated > version stored > file-level generated > file stored
  const bigThumbSrc = (() => {
    if (!selectedFile) return undefined;
    if (activeVer) {
      return thumbs[versionThumbKey(selectedFile.id, activeVer.id)]
          || activeVer.thumbnailUrl
          || thumbs[fileThumbKey(selectedFile.id)]
          || selectedFile.thumbnailUrl
          || undefined;
    }
    return thumbs[fileThumbKey(selectedFile.id)] || selectedFile.thumbnailUrl || undefined;
  })();

  const activeSize = activeVer?.size
    ?? (activeVer?.isLocal ? undefined : (selectedFile as any)?.size ?? (selectedFile as any)?.fileSize ?? resolvedSizes[selectedFile?.id ?? ''])
    ?? resolvedSizes[selectedFile?.id ?? ''];

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1e27', color: '#fff', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)', height: '88vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>プロジェクト Work Files から ベースを選択</DialogTitle>

        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)', p: 0, display: 'flex', overflow: 'hidden' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
              <CircularProgress sx={{ color: '#00BFFF' }} />
            </Box>
          ) : error ? (
            <Box p={3}><Typography color="error">{error}</Typography></Box>
          ) : workFiles.length === 0 ? (
            <Box p={3}><Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>プロジェクト内にベースとして利用可能な 3D データが見つかりません。</Typography></Box>
          ) : (
            <>
              {/* ══ LEFT: file list ══════════════════════════════════ */}
              <Box sx={{ width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', bgcolor: 'rgba(0,0,0,0.18)', py: 1 }}>
                {workFiles.map(fw => {
                  const isSel = selectedFileId === fw.id;
                  const miniThumb = thumbs[fileThumbKey(fw.id)] || fw.thumbnailUrl || undefined;
                  const sz = formatBytes((fw as any).size ?? (fw as any).fileSize ?? resolvedSizes[fw.id]);
                  return (
                    <Box
                      key={fw.id}
                      onClick={() => loadVersionsForFile(fw)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25,
                        px: 1.25, py: 0.75, mx: 0.75, mb: 0.5, borderRadius: 1.5,
                        cursor: 'pointer',
                        bgcolor: isSel ? 'rgba(0,191,255,0.12)' : 'transparent',
                        border: '1px solid', borderColor: isSel ? 'rgba(0,191,255,0.4)' : 'transparent',
                        '&:hover': { bgcolor: isSel ? 'rgba(0,191,255,0.15)' : 'rgba(255,255,255,0.05)' },
                        transition: 'background-color 0.12s',
                      }}
                    >
                      {/* Mini thumb */}
                      <Box sx={{ width: 44, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {miniThumb
                          ? <Box component="img" src={miniThumb} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <ViewInArRoundedIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }} />}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: isSel ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fw.name}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>v{fw.latestVersionNumber || 1}{sz ? ` ・ ${sz}` : ''}</Typography>
                      </Box>
                      <ChevronRightRoundedIcon sx={{ color: isSel ? '#00BFFF' : 'rgba(255,255,255,0.2)', fontSize: 16, flexShrink: 0 }} />
                    </Box>
                  );
                })}
              </Box>

              {/* ══ RIGHT: selected file detail ══════════════════════ */}
              <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {!selectedFile ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)' }}>← ファイルを選択してください</Typography>
                  </Box>
                ) : (
                  <>
                    {/* ── Big thumbnail ── */}
                    <Box sx={{ position: 'relative', width: '100%', bgcolor: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                      <Box sx={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.02)' }}>
                        {bigThumbSrc
                          ? <Box component="img" src={bigThumbSrc} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          : <ViewInArRoundedIcon sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 80 }} />}
                      </Box>
                      {/* Preview button overlay */}
                      <Tooltip title={activeVer ? 'この版をプレビュー（サムネイル生成）' : '最新版をプレビュー（サムネイル生成）'}>
                        <IconButton
                          size="small"
                          onClick={() => { setPreviewFile(selectedFile); setPreviewVersion(activeVer); }}
                          sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,191,255,0.85)' } }}
                        >
                          <VisibilityRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* ── File / version info + confirm ── */}
                    <Box sx={{ px: 3, pt: 2, pb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedFile.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {activeVer && (
                              <Chip label={activeVer.name} size="small" sx={{ bgcolor: 'rgba(0,191,255,0.15)', color: '#00BFFF', fontWeight: 700, height: 20, fontSize: 12 }} />
                            )}
                            {activeVer?.isLocal && (
                              <Chip label="Local" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(67,233,123,0.1)', color: '#43e97b' }} />
                            )}
                            {formatBytes(activeSize) && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                                {formatBytes(activeSize)}
                              </Typography>
                            )}
                            {activeVer && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                                {new Date(activeVer.createdAt).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                          {activeVer?.comment && activeVer.comment !== 'Local File' && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, mt: 0.5 }}>
                              {activeVer.comment}
                            </Typography>
                          )}
                        </Box>
                        <Button
                          variant="contained"
                          startIcon={<CheckCircleRoundedIcon />}
                          onClick={() => handleConfirm(selectedFile, activeVer ?? undefined)}
                          sx={{ bgcolor: '#00BFFF', color: '#06121b', fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { bgcolor: '#33ccff' } }}
                        >
                          この版を選択
                        </Button>
                      </Box>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 3 }} />

                    {/* ── Version switcher ── */}
                    <Box sx={{ px: 3, pt: 1.5, pb: 2 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        バージョン履歴
                      </Typography>

                      {isLoadingVers ? (
                        <Box display="flex" justifyContent="center" p={3}>
                          <CircularProgress size={22} sx={{ color: '#00BFFF' }} />
                        </Box>
                      ) : versions.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                          {versions.map(v => {
                            const vThumb = thumbs[versionThumbKey(selectedFile.id, v.id)] || v.thumbnailUrl || undefined;
                            const isActive = activeVer?.id === v.id;
                            const vSz = formatBytes(v.size);
                            return (
                              <Box
                                key={v.id}
                                onClick={() => setActiveVersions(p => ({ ...p, [selectedFile.id]: v }))}
                                sx={{
                                  width: 130, cursor: 'pointer', borderRadius: 1.5,
                                  border: '2px solid', borderColor: isActive ? '#00BFFF' : 'rgba(255,255,255,0.08)',
                                  bgcolor: isActive ? 'rgba(0,191,255,0.07)' : 'rgba(255,255,255,0.03)',
                                  overflow: 'hidden', transition: 'border-color 0.12s',
                                  '&:hover': { borderColor: isActive ? '#00BFFF' : 'rgba(255,255,255,0.25)' },
                                }}
                              >
                                {/* Thumb */}
                                <Box sx={{ width: '100%', aspectRatio: '4/3', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                                  {vThumb
                                    ? <Box component="img" src={vThumb} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <ViewInArRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 28 }} />}
                                  <Tooltip title="プレビュー（サムネイル生成）">
                                    <IconButton
                                      size="small"
                                      onClick={e => { e.stopPropagation(); setPreviewFile(selectedFile); setPreviewVersion(v); }}
                                      sx={{ position: 'absolute', top: 3, right: 3, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', p: '3px', '&:hover': { bgcolor: 'rgba(0,191,255,0.85)' } }}
                                    >
                                      <VisibilityRoundedIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                {/* Meta */}
                                <Box sx={{ px: 1, py: 0.75 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography sx={{ color: isActive ? '#00BFFF' : 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}>{v.name}</Typography>
                                    {v.isLocal && <Chip label="L" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: 'rgba(67,233,123,0.15)', color: '#43e97b', px: 0 }} />}
                                  </Box>
                                  {vSz && <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{vSz}</Typography>}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>履歴がありません</Typography>
                      )}
                    </Box>
                  </>
                )}
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        </DialogActions>
      </Dialog>

      <PreviewDialog
        open={Boolean(previewFile)}
        onClose={() => { setPreviewFile(null); setPreviewVersion(null); }}
        fileName={previewFile?.name || ''}
        workFileId={previewFile?.id}
        toolType={previewFile?.toolType}
        versionName={previewVersion ? previewVersion.name : `v${previewFile?.latestVersionNumber || 1}`}
        storagePath={previewVersion?.storagePath || previewFile?.storagePath || undefined}
        localPath={previewVersion?.localPath || undefined}
        onGlbReady={handleGlbReady}
      />
    </>
  );
}
