import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControl, InputLabel, Select, MenuItem,
  Box, Typography, CircularProgress, Alert
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { invoke } from '@tauri-apps/api/core';
import { useDccStore } from '../../../store/useDccStore';
import type { RhinoUploadSelectionJob } from '../../../store/useDccStore';

const LOCAL_CATEGORIES = [
  'uncategorized',
  'furniture',
  'architecture',
  'interior',
  'product',
  'vehicle',
  'nature',
  'abstract',
];

interface Props {
  job: RhinoUploadSelectionJob;
}

/**
 * Dialog shown when Rhino sends a job with target === "local".
 * Saves the selected geometry to SEKKEIYA locally.
 */
export const LocalSaveDialog: React.FC<Props> = ({ job }) => {
  const clearPendingRhinoJob = useDccStore(s => s.clearPendingRhinoJob);

  const [title, setTitle] = useState(job.defaultTitle ?? '');
  const [category, setCategory] = useState(job.categoryGuess ?? 'uncategorized');
  const [aiDrivePath, setAiDrivePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch AI Drive root path for display
  useEffect(() => {
    invoke<string>('get_ai_drive_path')
      .then(setAiDrivePath)
      .catch(() => setAiDrivePath(null));
  }, []);

  const savePath = aiDrivePath
    ? `${aiDrivePath}\\3DSS\\models\\${category || 'uncategorized'}\\...`
    : `SEKKEIYA\\3DSS\\models\\${category || 'uncategorized'}\\...`;

  const handleSave = async () => {
    if (!title.trim()) return;
    if (!job.jobId) {
      setError('Job ID が無効です。Rhinoから再度コマンドを実行してください。');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await invoke('save_selection_locally', {
        localId: job.jobId,
        title: title.trim(),
        category: category || 'uncategorized',
        source3dmPath: job.filePath,
        thumbnailPath: job.thumbnailPath ?? null,
        width: job.width ?? null,
        depth: job.depth ?? null,
        height: job.height ?? null,
        unitSystem: job.unitSystem ?? null,
      });
      setSuccess(true);
      // Close after short success animation
      setTimeout(() => {
        clearPendingRhinoJob();
      }, 1400);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || String(err));
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving) clearPendingRhinoJob();
  };

  return (
    <Dialog
      open
      onClose={saving ? undefined : handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface)',
          backgroundImage: 'none',
          border: '1px solid rgba(96,165,250,0.3)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'light-dark(#054ea8, #60a5fa)' }}>
        <CloudOffRoundedIcon />
        SEKKEIYA Drive に保存（ローカル）
      </DialogTitle>

      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ my: 2 }}>
            ローカルに保存しました！<br />
            S.Modelライブラリの「ローカル」タブから確認・クラウド同期できます。
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rhinoの選択オブジェクトを <strong style={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>SEKKEIYA</strong> にローカル保存します。<br />
              クラウドには送信されません。後からS.Modelライブラリで同期できます。
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            <TextField
              label="タイトル"
              value={title}
              onChange={e => setTitle(e.target.value)}
              fullWidth
              margin="dense"
              disabled={saving}
              autoFocus
              required
              placeholder="例：ソファ_A_プロトタイプ"
            />

            <FormControl fullWidth margin="normal" disabled={saving}>
              <InputLabel>カテゴリ</InputLabel>
              <Select
                value={category}
                onChange={e => setCategory(e.target.value)}
                label="カテゴリ"
              >
                {LOCAL_CATEGORIES.map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Save path preview */}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                bgcolor: 'rgba(96,165,250,0.05)',
                borderRadius: 1,
                border: '1px dashed rgba(96,165,250,0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <FolderRoundedIcon sx={{ color: 'light-dark(#054ea8, #60a5fa)', fontSize: 18, mt: 0.3, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--slate-ink-rgb) / 0.7)', display: 'block', mb: 0.3 }}>
                  保存先プレビュー
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 11 }}
                >
                  {savePath}
                </Typography>
              </Box>
            </Box>

            {/* Dimensions display if available */}
            {(job.width != null || job.depth != null || job.height != null) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                寸法：W{job.width ?? '?'} × D{job.depth ?? '?'} × H{job.height ?? '?'}
                {job.unitSystem ? ` (${job.unitSystem})` : ''}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={saving || success}
          color="inherit"
        >
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!title.trim() || saving || success || !job.jobId}
          sx={{
            bgcolor: '#2563eb',
            '&:hover': { bgcolor: '#1d4ed8' },
            fontWeight: 600,
            gap: 0.5,
          }}
        >
          {saving ? (
            <>
              <CircularProgress size={14} color="inherit" sx={{ mr: 0.5 }} />
              保存中...
            </>
          ) : (
            <>
              <SaveRoundedIcon sx={{ fontSize: 16 }} />
              保存する
            </>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
