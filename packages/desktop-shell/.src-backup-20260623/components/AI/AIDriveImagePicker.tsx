import React from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAIDriveStore } from '../../store/useAIDriveStore';
import { BRAND } from '../../styles/theme';

interface AIDriveImagePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}

/**
 * Reusable picker that lets the user choose an image asset from AI Drive.
 * Filters the AI Drive store to image-typed assets (or assets whose URL looks like an image).
 */
const AIDriveImagePicker: React.FC<AIDriveImagePickerProps> = ({ open, onClose, onPick }) => {
  const assets = useAIDriveStore((s) => s.assets);

  const driveImages = React.useMemo(() => {
    return assets.filter((a) => {
      if (a.type === 'image') return true;
      const url = a.storageUrl || a.thumbnailUrl || (a as any).url || '';
      return !a.type && /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(url);
    });
  }, [assets]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: BRAND.bg, backgroundImage: 'none', height: '60vh' } }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
          AI Drive から画像を選択
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 2 }}>
          {driveImages.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
              画像アセットが見つかりません
            </Typography>
          ) : (
            driveImages.map((asset) => {
              const url = asset.storageUrl || asset.thumbnailUrl || (asset as any).url || '';
              return (
                <Box
                  key={asset.id}
                  onClick={() => {
                    if (!url) return;
                    onPick(url);
                    onClose();
                  }}
                  sx={{
                    aspectRatio: '1',
                    bgcolor: 'rgba(0,0,0,0.3)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    '&:hover': { borderColor: '#90caf9' },
                  }}
                >
                  <img
                    src={url}
                    alt={asset.name || 'image'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default AIDriveImagePicker;
