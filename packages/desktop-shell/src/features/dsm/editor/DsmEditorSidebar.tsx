/**
 * DsmEditorSidebar — S.Movie エディター画面用の左サイドバー（3DSP/3DSD パターン）
 *
 * ダッシュボードの DsmSidebar（プロジェクトナビ）と切り替わり、編集中は
 * 「素材（LocalAssets/Movies）」のリストを表示する。クリックでシーケンスに追加。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Button, CircularProgress, InputBase } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useDsmStore } from '../store/useDsmStore';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#C98A4B';
const BLUEPRINT = '#7FA6C9';
const MONO = '"JetBrains Mono", "Roboto Mono", Consolas, monospace';

interface LocalVideoAsset { id: string; name: string; path: string; src: string; durationSec: number | null }

const fmtSec = (s: number) => `${s.toFixed(1)}s`;

export const DsmEditorSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const setDsmShellMode = useAppStore(s => s.setDsmShellMode);
  const clips = useDsmStore(s => s.clips);
  const addClip = useDsmStore(s => s.addClip);

  const [assets, setAssets] = useState<LocalVideoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
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
      console.error('[DsmEditorSidebar] 素材一覧の取得に失敗', e);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleDuration = useCallback((id: string, sec: number) => {
    setAssets(prev => prev.map(a => (a.id === id ? { ...a, durationSec: sec } : a)));
  }, []);

  const handleAddFromFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({
        multiple: true,
        filters: [{ name: '動画', extensions: ['mp4', 'mov', 'webm', 'm4v', 'mkv'] }],
      });
      const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
      paths.forEach(p => {
        const name = String(p).split(/[\\/]/).pop() ?? String(p);
        addClip({ path: String(p), label: name.replace(/\.[^.]+$/, ''), durationSec: 0 });
      });
    } catch (e) {
      console.error('[DsmEditorSidebar] ファイル選択に失敗', e);
    }
  }, [addClip]);

  const usedPaths = new Set(clips.map(c => c.path));
  const filtered = assets.filter(a => !query || a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ヘッダー: ダッシュボードへ戻る */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: `1px solid ${BRAND.line}` }}>
        <Button
          size="small"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setDsmShellMode('dashboard')}
          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'none', mb: 1, '&:hover': { color: '#fff' } }}
        >
          ダッシュボードへ戻る
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            素材 — Movies
          </Typography>
          <Tooltip title="再読み込み">
            <IconButton size="small" onClick={load} sx={{ color: 'rgba(255,255,255,0.5)' }}>
              <RefreshRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{
          display: 'flex', alignItems: 'center', mt: 1,
          bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, px: 1.25, py: 0.4,
          border: '1px solid rgba(255,255,255,0.05)',
          '&:focus-within': { borderColor: 'rgba(255,255,255,0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', mr: 0.75 }} />
          <InputBase
            placeholder="検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ color: '#fff', fontSize: 11, flex: 1 }}
          />
        </Box>
      </Box>

      {/* 素材リスト */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={18} sx={{ color: ACCENT }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', px: 1, py: 2, lineHeight: 1.7 }}>
            LocalAssets/Movies に動画がありません。下のボタンからファイルを追加できます。
          </Typography>
        ) : (
          filtered.map(a => {
            const used = usedPaths.has(a.path);
            return (
              <Box key={a.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 2,
                opacity: used ? 0.45 : 1, transition: 'opacity 0.2s, background-color 0.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', '& .add-btn': { opacity: 1 } },
              }}>
                <Box sx={{ width: 56, height: 36, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, bgcolor: '#0d0c0b' }}>
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
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 11, color: '#fff' }}>{a.name}</Typography>
                  <Typography sx={{ fontSize: 9, fontFamily: MONO, color: BLUEPRINT }}>
                    {a.durationSec != null ? fmtSec(a.durationSec) : '…'}{used ? ' ・使用中' : ''}
                  </Typography>
                </Box>
                <IconButton
                  className="add-btn"
                  size="small"
                  onClick={() => addClip({ path: a.path, label: a.name.replace(/\.[^.]+$/, ''), durationSec: a.durationSec ?? 0 })}
                  sx={{
                    opacity: 0, transition: 'opacity 0.15s', flexShrink: 0,
                    color: ACCENT, border: `1px solid ${ACCENT}66`, width: 24, height: 24,
                    '&:hover': { bgcolor: `${ACCENT}22` },
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })
        )}
      </Box>

      {/* フッター: ファイルから追加 */}
      <Box sx={{ p: 1.25, borderTop: `1px solid ${BRAND.line}` }}>
        <Button
          fullWidth size="small" startIcon={<VideoFileRoundedIcon />}
          onClick={handleAddFromFile}
          sx={{
            color: 'rgba(255,255,255,0.75)', fontSize: 11, justifyContent: 'flex-start', textTransform: 'none',
            border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 2, px: 1.5,
            '&:hover': { borderColor: ACCENT, color: '#fff', bgcolor: `${ACCENT}11` },
          }}
        >
          ファイルから追加…
        </Button>
      </Box>
    </Box>
  );
};
