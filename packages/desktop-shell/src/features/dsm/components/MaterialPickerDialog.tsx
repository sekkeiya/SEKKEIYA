/**
 * MaterialPickerDialog — クリップ素材の選択（S.Presents の 3Dモデルピッカー相当）
 *
 * LocalAssets/Movies のローカル動画をグリッド表示し、クリックでシーケンスに追加する。
 * 「ファイルから追加」で任意パスの動画も取り込める。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  InputBase, CircularProgress, IconButton,
} from '@mui/material';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

const ACCENT = '#C98A4B';
const BLUEPRINT = '#7FA6C9';
const MONO = '"JetBrains Mono", "Roboto Mono", Consolas, monospace';

export interface PickerAsset { id: string; name: string; path: string; src: string; durationSec: number | null }

const fmtSec = (s: number) => `${s.toFixed(1)}s`;

interface Props {
  open: boolean;
  onClose: () => void;
  usedPaths: Set<string>;
  /** 動画パスを 1 件追加する（尺は probe 済みなら渡す） */
  onAdd: (asset: { path: string; name: string; durationSec: number }) => void;
}

export const MaterialPickerDialog: React.FC<Props> = ({ open, onClose, usedPaths, onAdd }) => {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
      const all: any[] = await invoke('list_local_image_assets');
      setAssets(
        all.filter(a => a.mediaType === 'video').map(a => ({
          id: a.id, name: a.name, path: a.path,
          src: convertFileSrc(String(a.path)), durationSec: null,
        })),
      );
    } catch (e) {
      console.error('[MaterialPicker] 素材一覧の取得に失敗', e);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) loadAssets(); }, [open, loadAssets]);

  const handleDuration = useCallback((id: string, sec: number) => {
    setAssets(prev => prev.map(a => (a.id === id ? { ...a, durationSec: sec } : a)));
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const picked = await openDialog({
        multiple: true,
        filters: [{ name: '動画', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv'] }],
      });
      const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
      paths.forEach(p => {
        const name = String(p).split(/[\\/]/).pop() ?? String(p);
        onAdd({ path: String(p), name: name.replace(/\.[^.]+$/, ''), durationSec: 0 });
      });
      if (paths.length > 0) onClose();
    } catch (e) {
      console.error('[MaterialPicker] ファイル選択に失敗', e);
    }
  }, [onAdd, onClose]);

  const filtered = assets.filter(a => !query || a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <MovieRoundedIcon sx={{ color: ACCENT }} />
        クリップを追加
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={loadAssets} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <RefreshRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{
          display: 'flex', alignItems: 'center', mb: 2,
          bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          '&:focus-within': { borderColor: ACCENT },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mr: 1 }} />
          <InputBase
            placeholder="LocalAssets/Movies を検索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: 13, flex: 1 }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: ACCENT }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            <MovieRoundedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
            <Typography variant="body2">
              SEKKEIYA/LocalAssets/Movies に動画がありません。<br />
              下の「ファイルから追加」で任意の mp4 を取り込めます。
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2 }}>
            {filtered.map(a => {
              const used = usedPaths.has(a.path);
              return (
                <Box
                  key={a.id}
                  onClick={() => onAdd({ path: a.path, name: a.name.replace(/\.[^.]+$/, ''), durationSec: a.durationSec ?? 0 })}
                  sx={{
                    borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: ACCENT, transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${ACCENT}33` },
                  }}
                >
                  <Box sx={{ height: 96, bgcolor: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video
                      src={a.src}
                      muted
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onLoadedMetadata={(e) => {
                        const d = (e.target as HTMLVideoElement).duration;
                        if (isFinite(d) && d > 0) handleDuration(a.id, d);
                      }}
                    />
                  </Box>
                  {used && (
                    <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', gap: 0.25, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, px: 0.5 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 13, color: ACCENT }} />
                      <Typography sx={{ fontSize: 9, color: ACCENT }}>使用中</Typography>
                    </Box>
                  )}
                  <Box sx={{ p: 1 }}>
                    <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 12, fontWeight: 500 }}>{a.name}</Typography>
                    <Typography sx={{ color: BLUEPRINT, fontSize: 10, fontFamily: MONO }}>
                      {a.durationSec != null ? fmtSec(a.durationSec) : '…'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button
          startIcon={<VideoFileRoundedIcon />}
          onClick={handlePickFile}
          sx={{ color: ACCENT, textTransform: 'none', fontSize: 13, fontWeight: 600 }}
        >
          ファイルから追加…
        </Button>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
