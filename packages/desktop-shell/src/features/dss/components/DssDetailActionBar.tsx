import React, { useMemo, useState } from 'react';
import { Box, Button, IconButton, Tooltip, Menu, MenuItem, ListItemText, CircularProgress, Snackbar, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded';
import ThreeDRotationRoundedIcon from '@mui/icons-material/ThreeDRotationRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { listDownloadFormats, downloadModelFile } from '../utils/modelDownload';
import { useModelLike } from '../hooks/useModelLike';
import { useAuthStore } from '../../../store/useAuthStore';

export type DetailActions = {
  canRegister: boolean;
  canRhino: boolean;
  canBlender: boolean;
  canDelete: boolean;
  dccBusy: 'rhino' | 'blender' | null;
  onRegisterLinks: () => void;
  onCatalog: () => void;
  onAutoFill: () => void;
  onRhino: () => void;
  onBlender: () => void;
  onSave: () => void;
  onShare: () => void;
  onDelete: () => void;
};

interface Props {
  model: any;
  actions?: DetailActions;
  isAuthor: boolean;
  /** 「閲覧者の見え方を確認」中かどうか。 */
  previewMode: boolean;
  onTogglePreview: () => void;
}

const iconBtnSx = {
  border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
  color: 'var(--brand-fg)',
  borderRadius: '8px',
  flexShrink: 0,
};

/** 詳細画面の常用アクション（タブに依らず常時表示）。 */
export const DssDetailActionBar: React.FC<Props> = ({ model, actions, isAuthor, previewMode, onTogglePreview }) => {
  const currentUser = useAuthStore((state: any) => state.currentUser);
  const formats = useMemo(() => listDownloadFormats(model), [model]);
  const [dlAnchor, setDlAnchor] = useState<HTMLElement | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { liked, favoriteCount, loading: likeLoading, toggling: likeBusy, toggleLike } = useModelLike({
    model,
    uid: currentUser?.uid ?? null,
  });

  const handleToggleLike = () => {
    if (likeBusy || likeLoading || !currentUser?.uid) return;
    void toggleLike();
  };

  const runDownload = async (ext: string) => {
    setDlAnchor(null);
    setDlBusy(true);
    try {
      await downloadModelFile(model, ext);
      setMsg(`${ext.toUpperCase()} をダウンロードしました`);
    } catch (e: any) {
      console.error('[DssDetailActionBar] download failed', e);
      setMsg(e?.message || 'ダウンロードに失敗しました');
    } finally {
      setDlBusy(false);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent<HTMLElement>) => {
    if (formats.length === 0) return;
    if (formats.length === 1) { void runDownload(formats[0].ext); return; }
    setDlAnchor(e.currentTarget);
  };

  return (
    // 作成者・Rhino/Blender 対応モデルでは最大 8 個の操作が並ぶ。380px の右パネルには
    // 収まらないので折り返す（折り返さないと Download だけが潰れて最後は行が欠ける）。
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, flexShrink: 0, alignItems: 'center' }}>
      {/* Download は伸縮するが、文字が読めなくなるところまでは縮ませない。 */}
      <Tooltip title={formats.length === 0 ? 'ダウンロードできるファイルがありません' : 'モデルファイルをダウンロード'} arrow>
        <span style={{ flex: '1 1 140px', minWidth: 140 }}>
          <Button
            fullWidth
            variant="contained"
            disabled={formats.length === 0 || dlBusy}
            startIcon={dlBusy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : (formats.length > 1 ? <ExpandMoreIcon /> : undefined)}
            onClick={handleDownloadClick}
            sx={{
              minWidth: 0, bgcolor: '#3b82f6', color: 'var(--brand-fg)', textTransform: 'none',
              fontSize: 12.5, fontWeight: 700, justifyContent: 'space-between', px: 1.5,
              '&:hover': { bgcolor: '#2563eb' },
              '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' },
            }}
          >
            Download
          </Button>
        </span>
      </Tooltip>
      <Menu anchorEl={dlAnchor} open={!!dlAnchor} onClose={() => setDlAnchor(null)}>
        {formats.map((f) => (
          <MenuItem key={f.ext} onClick={() => void runDownload(f.ext)}>
            <ListItemText primary={f.label} secondary={f.sizeLabel || undefined} />
          </MenuItem>
        ))}
      </Menu>

      <Tooltip title={currentUser ? (liked ? 'いいねを外す' : 'いいね') : 'ログインすると押せます'} arrow>
        <span>
          <IconButton size="small" onClick={handleToggleLike} disabled={!currentUser || likeBusy || likeLoading}
            sx={{ ...iconBtnSx, color: liked ? '#f97316' : 'var(--brand-fg)' }}>
            {liked ? <FavoriteRoundedIcon sx={{ fontSize: 18 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 18 }} />}
            {favoriteCount > 0 && (
              <Typography component="span" sx={{ ml: 0.3, fontSize: 10, color: 'var(--brand-fg)' }}>{favoriteCount}</Typography>
            )}
          </IconButton>
        </span>
      </Tooltip>

      {actions && (
        <>
          <Tooltip title="Rhino へ配置（開いて取り込み）" arrow>
            <span>
              <Button size="small" variant="contained" disabled={!actions.canRhino || actions.dccBusy !== null}
                startIcon={actions.dccBusy === 'rhino' ? <CircularProgress size={13} sx={{ color: 'var(--brand-fg)' }} /> : <AutoAwesomeMotionRoundedIcon sx={{ fontSize: 15 }} />}
                onClick={actions.onRhino}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 0, px: 1.1, bgcolor: '#0d9488', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#0f766e' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                Rhino
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Blender へ配置（開いて取り込み）" arrow>
            <span>
              <Button size="small" variant="contained" disabled={!actions.canBlender || actions.dccBusy !== null}
                startIcon={actions.dccBusy === 'blender' ? <CircularProgress size={13} sx={{ color: 'var(--brand-fg)' }} /> : <ThreeDRotationRoundedIcon sx={{ fontSize: 15 }} />}
                onClick={actions.onBlender}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 0, px: 1.1, bgcolor: '#ea7317', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#c2620f' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                Blender
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="プロジェクトに保存" arrow>
            <IconButton size="small" onClick={actions.onSave} sx={iconBtnSx}>
              <BookmarkAddRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="共有" arrow>
            <IconButton size="small" onClick={actions.onShare} sx={iconBtnSx}>
              <ShareRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {actions.canDelete && (
            <Tooltip title="削除" arrow>
              <IconButton size="small" onClick={actions.onDelete} sx={{ ...iconBtnSx, color: '#f97316' }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}

      {isAuthor && (
        <Tooltip title={previewMode ? '編集に戻る' : '閲覧者の見え方を確認'} arrow>
          <IconButton
            size="small"
            onClick={onTogglePreview}
            sx={{
              ...iconBtnSx,
              color: previewMode ? 'light-dark(#003fad, #9ec1ff)' : 'var(--brand-fg)',
              bgcolor: previewMode ? 'rgba(79,140,255,0.22)' : 'transparent',
              borderColor: previewMode ? 'rgba(79,140,255,0.55)' : undefined,
            }}
          >
            <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg(null)} message={msg || ''} />
    </Box>
  );
};
