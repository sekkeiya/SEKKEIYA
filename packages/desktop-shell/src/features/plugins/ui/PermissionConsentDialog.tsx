// インストール前の権限同意ダイアログ（要件70）。
// manifest.permissions を日本語で列挙し、ユーザーが「許可してインストール」を
// 押したときだけ installPluginPackage へ進む。設定画面とマーケットプレイスで共用。
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip,
} from '@mui/material';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import type { PluginManifest } from '../manifest/manifestTypes';
import { describePermissions, hasSensitivePermissions } from '../registry/permissionSummary';

export interface PermissionConsentDialogProps {
  open: boolean;
  manifest: PluginManifest | null;
  /** 出所の表示名（例: 「zip ファイル」「マーケットプレイス」）。 */
  sourceLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onAllow: () => void;
}

export const PermissionConsentDialog: React.FC<PermissionConsentDialogProps> = ({
  open, manifest, sourceLabel, busy = false, onCancel, onAllow,
}) => {
  const lines = describePermissions(manifest?.permissions);
  const sensitive = hasSensitivePermissions(manifest?.permissions);

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityRoundedIcon fontSize="small" />
        プラグインのインストール
      </DialogTitle>
      <DialogContent>
        {manifest && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{manifest.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                {manifest.id} v{manifest.version}
              </Typography>
              <Chip label={sourceLabel} size="small" sx={{ ml: 1, height: 20 }} />
            </Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              このプラグインが要求する権限
            </Typography>
            {lines.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                権限の要求はありません（画面表示と自分のローカル保存のみ）。
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {lines.map(line => (
                  <Typography key={line} component="li" variant="body2" sx={{ mb: 0.5 }}>
                    {line}
                  </Typography>
                ))}
              </Box>
            )}
            {sensitive && (
              <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
                外部への通信やチャット送信を含みます。作者を信頼できる場合のみ許可してください。
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={onAllow} disabled={busy || !manifest} variant="contained" sx={{ textTransform: 'none' }}>
          許可してインストール
        </Button>
      </DialogActions>
    </Dialog>
  );
};
