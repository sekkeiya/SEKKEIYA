import React from 'react';
import { Box } from '@mui/material';

interface ProjectIconProps {
  iconUrl?: string;
  iconEmoji?: string;
  size: number;
  /** borderRadius（角丸 number / '50%' で円） */
  radius?: number | string;
  /** カスタムアイコン未設定時の背景色（頭文字フォールバック用） */
  fallbackBg: string;
  /** カスタムアイコン未設定時の中身（頭文字 or フォルダアイコン） */
  fallbackContent: React.ReactNode;
  /** 絵文字のフォントサイズ（デフォルト size*0.6） */
  emojiFontSize?: number | string;
  sx?: object;
}

/**
 * プロジェクトの視覚アイデンティティを一元描画。
 * 優先順位: アップロード画像 > 絵文字 > フォールバック（頭文字＋ハッシュ色 など各呼び出し元の従来表示）。
 */
export const ProjectIcon: React.FC<ProjectIconProps> = ({
  iconUrl, iconEmoji, size, radius = 1, fallbackBg, fallbackContent, emojiFontSize, sx,
}) => {
  const base = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...sx,
  } as const;

  if (iconUrl) {
    return <Box component="img" src={iconUrl} alt="" sx={{ ...base, objectFit: 'cover' }} />;
  }
  if (iconEmoji) {
    return (
      <Box sx={{ ...base, bgcolor: 'rgba(130,130,150,0.16)', lineHeight: 1 }}>
        <span style={{ fontSize: emojiFontSize ?? size * 0.6, lineHeight: 1 }}>{iconEmoji}</span>
      </Box>
    );
  }
  return <Box sx={{ ...base, bgcolor: fallbackBg }}>{fallbackContent}</Box>;
};
