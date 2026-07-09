import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
} from '@mui/material';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';

export type BaseSetupOption = 'select_project' | 'select_workfile' | 'default_room' | null;

interface CreateLayoutDialogProps {
  open: boolean;
  projectId: string;
  currentUser: any;
  onClose: () => void;
  /** Called after Base + Plan 1 are created. Navigation is handled by the caller. */
  onCreated: (baseId: string, planId: string, name: string, baseSetup: BaseSetupOption) => void;
}

const BASE_OPTIONS: { id: BaseSetupOption; icon: React.ReactElement; label: string; desc: string }[] = [
  {
    id: 'select_project',
    icon: <FolderOpenRoundedIcon />,
    label: 'プロジェクトから選択',
    desc: 'S.Model のアセットを躯体として使用',
  },
  {
    id: 'select_workfile',
    icon: <InsertDriveFileRoundedIcon />,
    label: 'Work Fileから選択',
    desc: 'S.Drawing の図面ファイルを使用',
  },
  {
    id: 'default_room',
    icon: <ViewInArRoundedIcon />,
    label: 'デフォルトルーム',
    desc: '床 + 四方の壁（10m × 10m × 3m）',
  },
];

export const CreateLayoutDialog: React.FC<CreateLayoutDialogProps> = ({
  open,
  projectId,
  currentUser,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [baseSetup, setBaseSetup] = useState<BaseSetupOption>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = useCallback(() => {
    if (isCreating) return;
    setName('');
    setBaseSetup(null);
    onClose();
  }, [isCreating, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !currentUser || isCreating) return;
    setIsCreating(true);
    try {
      const { createStructureNode } = await import('../utils/workspaceStubs');
      const baseNode = await createStructureNode({
        projectId,
        workspaceId: 'layout',
        userId: currentUser.uid,
        name: trimmedName,
        planType: 'base',
      });
      const planNode = await createStructureNode({
        projectId,
        workspaceId: 'layout',
        userId: currentUser.uid,
        name: 'Plan 1',
        planType: 'plan',
        rootBaseId: baseNode.id,
      });
      const selectedSetup = baseSetup;
      setName('');
      setBaseSetup(null);
      onCreated(baseNode.id, planNode.id, trimmedName, selectedSetup);
    } catch (err) {
      console.error('[CreateLayoutDialog]', err);
    } finally {
      setIsCreating(false);
    }
  }, [name, currentUser, isCreating, projectId, baseSetup, onCreated]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface2)',
          backgroundImage: 'none',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
          borderRadius: 3,
          minWidth: 420,
        },
      }}
    >
      <DialogTitle sx={{ color: 'var(--brand-fg)', fontWeight: 700, pb: 1 }}>
        新規レイアウト
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="レイアウト名"
          placeholder="例: エントランスホール"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
            if (e.key === 'Escape') handleClose();
          }}
          disabled={isCreating}
          sx={{
            mt: 1,
            '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' },
            '& .MuiOutlinedInput-root': {
              color: 'var(--brand-fg)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
              '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
            },
          }}
        />

        <Typography
          sx={{
            mt: 2.5, mb: 1.5, fontSize: 11,
            color: 'rgb(var(--brand-fg-rgb) / 0.45)',
            fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase',
          }}
        >
          躯体（Base）モデル
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {BASE_OPTIONS.map((opt) => {
            const selected = baseSetup === opt.id;
            return (
              <Box
                key={opt.id as string}
                onClick={() => !isCreating && setBaseSetup(selected ? null : opt.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.75, py: 1.25, borderRadius: 2, cursor: isCreating ? 'default' : 'pointer',
                  border: `1px solid ${selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                  bgcolor: selected ? 'rgba(0,191,255,0.08)' : 'transparent',
                  transition: 'border-color 0.15s, background 0.15s',
                  '&:hover': !isCreating ? {
                    borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.25)',
                    bgcolor: selected ? 'rgba(0,191,255,0.12)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
                  } : {},
                }}
              >
                <Box sx={{ color: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.35)', display: 'flex', flexShrink: 0 }}>
                  {React.cloneElement(opt.icon, { sx: { fontSize: 20 } })}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: selected ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
                    {opt.label}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.4 }}>
                    {opt.desc}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {!baseSetup && (
          <Typography sx={{ mt: 1.5, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.25)', textAlign: 'center' }}>
            未選択の場合はエディター内で後から設定できます
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={isCreating}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isCreating || !name.trim()}
          variant="contained"
          sx={{ bgcolor: '#00BFFF', '&:hover': { bgcolor: '#009acc' }, textTransform: 'none', minWidth: 110 }}
        >
          {isCreating ? <CircularProgress size={16} color="inherit" /> : 'Planを作成'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
