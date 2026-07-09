/**
 * TtsSettingsDialog — 読み上げ（TTS）の共通設定ダイアログ。
 * S.Blog リーダー / SEKKEIYA Chat など、読み上げ機能のあるどこからでも同じダイアログを開く。
 * フォーム本体は TtsSettingsForm（Global Settings > 音声 と共通）。
 * 設定は lib/tts の getTtsSettings/setTtsSettings で localStorage に永続化され、全機能で共有される。
 */
import React from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Typography, IconButton, Divider } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { TtsSettingsForm } from './TtsSettingsForm';

const ACCENT = '#8ab4f8';

interface TtsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** ダイアログのタイトル（既定: 読み上げの設定）。extraSection を足す機能側で差し替え可 */
  title?: string;
  /** 呼び出し元固有の設定セクション（例: S.Blogのインタビュアー選択）。フォームの上に表示 */
  extraSection?: React.ReactNode;
}

export const TtsSettingsDialog: React.FC<TtsSettingsDialogProps> = ({ open, onClose, title, extraSection }) => {
  // extraSection があるときは2カラム（左=呼び出し元固有の設定 / 右=読み上げ設定）で横に伸ばし、
  // 縦長になりすぎないようにする。無いときは従来どおり1カラムの狭いダイアログ。
  const twoCol = !!extraSection;
  return (
    <Dialog open={open} onClose={onClose} maxWidth={twoCol ? 'md' : 'xs'} fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <VolumeUpRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
        {title ?? '読み上げの設定'}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: twoCol ? 'row' : 'column' }, gap: twoCol ? 3 : 0, alignItems: 'stretch' }}>
          {extraSection && (
            <>
              {/* 左カラム: 呼び出し元固有の設定（例: インタビュアー選択） */}
              <Box sx={{ flex: '0 0 44%', minWidth: 0 }}>
                {extraSection}
              </Box>
              {/* 区切り: 広い画面は縦線、狭い画面は横線 */}
              <Divider flexItem
                orientation="vertical"
                sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
              <Divider sx={{ display: { xs: 'block', sm: 'none' }, my: 1, borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
            </>
          )}
          {/* 右カラム: 読み上げ設定（共通） */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 2 }}>
              設定は記事の読み上げ・SEKKEIYA OS の音声モードなど、すべての読み上げに共通で適用されます。
            </Typography>
            {/* フォームはアンマウント時に試聴を停止する（Dialog は閉じると中身をアンマウントする） */}
            {open && <TtsSettingsForm />}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
