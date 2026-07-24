import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
// @ts-ignore
import { convert3dmToGlb } from '../../features/dss/upload/utils/convert3dmToGlb';
import { RightPanelModelViewer } from '../../features/dss/components/RightPanelModelViewer';

interface Props {
  /** ローカル絶対パス or クラウドの https URL */
  templatePath?: string;
  templateId?: string;
  fileName: string;
  toolType?: string;
}

/**
 * テンプレートの 3D プレビューをパネル内にインライン表示する。
 * PreviewDialog と同じ読み込み手順（ローカルは convertFileSrc、リモートは Rust でキャッシュ）を
 * ダイアログの外枠なしで使う。CAD Files の InlineWorkFilePreview に対応するテンプレート版。
 */
export const InlineTemplatePreview: React.FC<Props> = ({ templatePath, templateId, fileName, toolType }) => {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrlToRevoke: string | null = null;
    let isMounted = true;

    if (!templatePath) {
      setGlbUrl(null);
      setIsLoading(false);
      setError('プレビューできる3Dデータがまだありません。');
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);
      setGlbUrl(null);
      try {
        const isRhino = templatePath.toLowerCase().endsWith('.3dm') || toolType?.toLowerCase().includes('rhino');
        if (!isRhino) {
          throw new Error(`このファイル形式（${toolType || '不明'}）の3Dプレビューには未対応です。Rhino (.3dm) のみ表示できます。`);
        }

        let fetchUrl = templatePath;
        if (fetchUrl.match(/^[a-zA-Z]:\\/) || fetchUrl.startsWith('/')) {
          fetchUrl = convertFileSrc(fetchUrl.replace(/\\/g, '/'));
        } else if (fetchUrl.startsWith('http')) {
          // CORS 回避のため Rust 側でダウンロードしてローカル参照に変換する
          const resolvedPath = await invoke<string>('ensure_model_cached', {
            modelId: templateId || 'preview-temp',
            model_id: templateId || 'preview-temp',
            ext: '3dm',
            downloadUrl: fetchUrl,
          });
          fetchUrl = convertFileSrc(resolvedPath.replace(/\\/g, '/'));
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('テンプレートファイルを読み込めませんでした。');
        const blob = await response.blob();

        const safeName = fileName.toLowerCase().endsWith('.3dm') ? fileName : `${fileName}.3dm`;
        const glbFile = await convert3dmToGlb(new File([blob], safeName));
        const url = URL.createObjectURL(glbFile as File);
        objectUrlToRevoke = url;
        if (isMounted) setGlbUrl(url);
      } catch (err: any) {
        console.error('[InlineTemplatePreview] Error rendering preview:', err);
        if (isMounted) setError(err.message || String(err));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [templatePath, templateId, fileName, toolType]);

  return (
    <Box sx={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      bgcolor: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress sx={{ color: '#00BFFF' }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.85rem' }}>
            3Dプレビューを生成中... (少し時間がかかります)
          </Typography>
        </Box>
      )}

      {error && !isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 3, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', fontSize: 44, mb: 0.5 }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.85rem', maxWidth: 420 }}>{error}</Typography>
        </Box>
      )}

      {!isLoading && !error && glbUrl && (
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <RightPanelModelViewer modelUrl={glbUrl} />
        </Box>
      )}
    </Box>
  );
};
