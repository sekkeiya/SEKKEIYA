import React, { useMemo, useState } from 'react';
import { Box, Typography, IconButton, InputBase, CircularProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useDriveAssets, PICKER_LAYERS } from '../../features/drive/driveAccess';
import type { AIDriveAsset } from '../../store/useAIDriveStore';

/** ボードへのドラッグで運ぶ Drive 画像の URL を載せる dataTransfer の型（同一ドキュメント内 DnD）。 */
export const DRIVE_IMAGE_DND_TYPE = 'application/x-sekkeiya-drive-image';

const urlOf = (a: AIDriveAsset): string => a.storageUrl || a.thumbnailUrl || (a as { url?: string }).url || '';

interface Props {
  open: boolean;
  onClose: () => void;
  /** サムネのクリック時（ビューポート中央に置く。DnD しない場合のフォールベック）。 */
  onPick: (url: string) => void;
}

/**
 * リサーチボード右の SEKKEIYA Drive パネル。Drive の画像アセットを一覧し、
 * サムネをボードへドラッグ&ドロップ（or クリック）で画像カードとして置ける（URL 参照・再アップロード不要）。
 */
export const DriveAssetSidebar: React.FC<Props> = ({ open, onClose, onPick }) => {
  const { assets, loading } = useDriveAssets({ media: 'image', layers: PICKER_LAYERS });
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () => assets.filter(a => !q || (a.name || '').toLowerCase().includes(q)),
    [assets, q],
  );

  if (!open) return null;

  return (
    <Box className="nodrag nopan" sx={{
      position: 'absolute', top: 12, right: 12, bottom: 12, width: 264, zIndex: 6,
      display: 'flex', flexDirection: 'column',
      p: 1.5, borderRadius: 3,
      bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', flex: 1 }}>
          SEKKEIYA Drive
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.25 }}>
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.4, mb: 1, borderRadius: 1.5,
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
      }}>
        <SearchRoundedIcon sx={{ fontSize: 15, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
        <InputBase fullWidth value={search} onChange={e => setSearch(e.target.value)}
          placeholder="画像名で検索..." sx={{ fontSize: 12, color: 'var(--brand-fg)' }} />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={20} sx={{ color: '#00BFFF' }} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ textAlign: 'center', pt: 4, fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            {assets.length === 0 ? 'Drive に画像アセットがありません' : '該当する画像がありません'}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {rows.map(a => {
              const url = urlOf(a);
              return (
                <Box key={a.id}
                  draggable={!!url}
                  onDragStart={e => {
                    if (!url) return;
                    e.dataTransfer.setData(DRIVE_IMAGE_DND_TYPE, url);
                    e.dataTransfer.setData('text/plain', url);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => { if (url) onPick(url); }}
                  title={`${a.name || 'image'}（ドラッグでボードに置く / クリックで中央に追加）`}
                  sx={{
                    aspectRatio: '1', borderRadius: 1.5, overflow: 'hidden', cursor: 'grab',
                    bgcolor: 'light-dark(rgba(15,23,42,0.06), rgba(0,0,0,0.3))',
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
                    transition: 'border-color .12s, transform .12s',
                    '&:hover': { borderColor: '#00BFFF', transform: 'translateY(-1px)' },
                    '&:active': { cursor: 'grabbing' },
                  }}>
                  {url
                    ? <img src={url} alt={a.name || 'image'} draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>no preview</Box>}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Typography sx={{ mt: 1, fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.5 }}>
        ドラッグでボードに配置 / クリックで中央に追加（URL 参照）
      </Typography>
    </Box>
  );
};

export default DriveAssetSidebar;
