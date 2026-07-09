import React, { useMemo, useState } from 'react';
import { Box, Dialog, IconButton, Typography, Button, TextField, InputAdornment } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useDriveAssets, PICKER_LAYERS } from '../../features/drive/driveAccess';
import { resolveAssetPreviewUrl, type AIDriveAsset } from '../../store/useAIDriveStore';
import { BRAND } from '../../styles/theme';

interface AIDriveFilePickerProps {
  open: boolean;
  onClose: () => void;
  /** 選択された Drive 資産（複数可）を返す。 */
  onPick: (assets: AIDriveAsset[]) => void;
}

/**
 * SEKKEIYA Drive の資産（画像に限らず全種別）から添付するものを選ぶピッカー。
 * 画像専用の AIDriveImagePicker と違い、モデル・ダイアグラム・ファイル等も選べる。
 * 複数選択して「追加」で一括添付できる。
 */
const AIDriveFilePicker: React.FC<AIDriveFilePickerProps> = ({ open, onClose, onPick }) => {
  // Drive の再利用可能アセット（driveAccess = 単一の読み取り窓口・スコープ非依存の決定的プール）。
  const { assets } = useDriveAssets({ layers: PICKER_LAYERS });
  const [selected, setSelected] = useState<Record<string, AIDriveAsset>>({});
  const [query, setQuery] = useState('');

  // ダイアログを開き直すたびに選択をリセット。
  React.useEffect(() => {
    if (open) { setSelected({}); setQuery(''); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(a => (a.name || '').toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q));
  }, [assets, query]);

  const selectedList = Object.values(selected);
  const toggle = (asset: AIDriveAsset) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[asset.id]) delete next[asset.id];
      else next[asset.id] = asset;
      return next;
    });
  };

  const confirm = () => {
    if (selectedList.length === 0) return;
    onPick(selectedList);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: BRAND.bg, backgroundImage: 'none', height: '68vh' } }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          SEKKEIYA Drive から添付
        </Typography>
        <TextField
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・種別で絞り込み"
          sx={{ flex: 1, maxWidth: 260, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: '0.8rem', '& fieldset': { borderColor: BRAND.line } } }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: '1rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} /></InputAdornment>) }}
        />
        <IconButton onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 2 }}>
          {filtered.length === 0 ? (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
              アセットが見つかりません
            </Typography>
          ) : (
            filtered.map((asset) => {
              const preview = resolveAssetPreviewUrl(asset);
              const isSelected = !!selected[asset.id];
              return (
                <Box
                  key={asset.id}
                  onClick={() => toggle(asset)}
                  title={asset.name}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: `2px solid ${isSelected ? '#90caf9' : 'transparent'}`,
                    bgcolor: 'light-dark(rgba(15,23,42,0.06), rgba(0,0,0,0.3))',
                    '&:hover': { borderColor: isSelected ? '#90caf9' : 'rgba(144,202,249,0.5)' },
                  }}
                >
                  <Box sx={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {preview ? (
                      <img src={preview} alt={asset.name || 'file'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }} />
                    )}
                  </Box>
                  <Typography noWrap sx={{ px: 0.75, py: 0.5, fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
                    {asset.name || '(名称未設定)'}
                  </Typography>
                  {isSelected && (
                    <Box sx={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', bgcolor: '#90caf9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                      <CheckRoundedIcon sx={{ fontSize: 14, color: '#0b1220' }} />
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Box sx={{ p: 1.5, borderTop: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>キャンセル</Button>
        <Button
          onClick={confirm}
          disabled={selectedList.length === 0}
          variant="contained"
          disableElevation
          sx={{ textTransform: 'none', bgcolor: '#90caf9', color: '#0b1220', fontWeight: 600, '&:hover': { bgcolor: '#a6d4fa' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}
        >
          追加{selectedList.length > 0 ? ` (${selectedList.length})` : ''}
        </Button>
      </Box>
    </Dialog>
  );
};

export default AIDriveFilePicker;
