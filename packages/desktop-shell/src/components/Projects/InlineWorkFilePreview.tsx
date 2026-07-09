import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { invoke } from '@tauri-apps/api/core';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../../lib/firebase/client';
import { readFile, readDir, stat } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
// @ts-ignore
import { convert3dmToGlb } from '../../features/dss/upload/utils/convert3dmToGlb';
import { RightPanelModelViewer } from '../../features/dss/components/RightPanelModelViewer';

interface Props {
  fileId: string;
  storagePath: string | null | undefined;
  fileName: string;
  toolType: string;
  localPath?: string;
  onClose?: () => void;
  /** Called once the GLB object URL is ready (e.g. to capture a thumbnail). */
  onGlbReady?: (glbUrl: string) => void;
}

export const InlineWorkFilePreview: React.FC<Props> = ({ fileId, storagePath, fileName, toolType, localPath, onClose, onGlbReady }) => {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrlToRevoke: string | null = null;
    let isMounted = true;

    const loadPreview = async () => {
      // プレビュー対象（ローカル/クラウドのいずれか）が無い場合はエラーではなく
      // 「データなし」として静かに扱う（console をエラーで汚さない）。
      if (!localPath && !storagePath) {
        if (isMounted) {
          setIsLoading(false);
          setError('プレビューできる3Dデータがまだありません。');
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      setGlbUrl(null);

      try {
        const isRhino = fileName.toLowerCase().endsWith('.3dm') || toolType?.toLowerCase().includes('rhino');
        if (!isRhino) {
          throw new Error(`Preview is not supported for this file type (${toolType || 'Unknown'}). Only Rhino (.3dm) previews are available.`);
        }

        let blob: Blob;

        // 1. Try local path first (fastest)
        if (localPath) {
           let filePath = localPath;
           // If localPath is a directory (no .3dm extension), find the latest .3dm inside it
           if (!localPath.toLowerCase().endsWith('.3dm')) {
             const entries = await readDir(localPath);
             const threeDmFiles: { name: string; path: string; mtime: number }[] = [];
             for (const entry of entries) {
               if (entry.isFile && entry.name.toLowerCase().endsWith('.3dm')) {
                 const fullPath = await join(localPath, entry.name);
                 const metadata = await stat(fullPath);
                 threeDmFiles.push({ name: entry.name, path: fullPath, mtime: (metadata.mtime as Date | null)?.getTime() ?? 0 });
               }
             }
             if (threeDmFiles.length === 0) {
               throw new Error('ローカルディレクトリに .3dm ファイルが見つかりません。Rhinoで一度ファイルを開いて保存してください。');
             }
             threeDmFiles.sort((a, b) => b.mtime - a.mtime);
             filePath = threeDmFiles[0].path;
           }
           const normalizedPath = filePath.replace(/\\/g, '/');
           const fileData = await readFile(normalizedPath);
           blob = new Blob([fileData]);
        } else if (storagePath) {
           // 2. Fallback to Firebase Storage URL
           const downloadUrl = await getDownloadURL(ref(storage, storagePath));
           const safeId = fileId || 'preview-temp';
           
           // Cache it locally so we don't hold up huge memory blobs
           const cachedLocalPath = await invoke<string>('ensure_model_cached', {
             modelId: safeId,
             model_id: safeId,
             ext: '3dm',
             downloadUrl: downloadUrl
           });
           const normalizedPath = cachedLocalPath.replace(/\\/g, '/');
           const fileData = await readFile(normalizedPath);
           blob = new Blob([fileData]);
        } else {
           throw new Error('No local file or cloud storage path available to preview.');
        }

        const safeName = fileName.toLowerCase().endsWith('.3dm') ? fileName : `${fileName}.3dm`;
        const file = new File([blob], safeName);
        
        const glbFile = await convert3dmToGlb(file);
        const url = URL.createObjectURL(glbFile as File);
        objectUrlToRevoke = url;
        if (isMounted) {
          setGlbUrl(url);
          onGlbReady?.(url);
        }
      } catch (err: any) {
        console.error('[InlineWorkFilePreview] Error rendering preview:', err);
        if (isMounted) setError(err.message || String(err));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [fileId, storagePath, fileName, toolType, localPath]);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      bgcolor: 'rgba(0,0,0,0.4)', 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress sx={{ color: '#00BFFF' }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>
            3Dプレビューを生成中... (少し時間がかかります)
          </Typography>
        </Box>
      )}

      {error && !isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 3, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ color: '#f44336', fontSize: 48, mb: 1 }} />
          <Typography sx={{ color: '#f44336', fontWeight: 600 }}>プレビュー表示エラー</Typography>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', maxWidth: 400 }}>{error}</Typography>
        </Box>
      )}

      {!isLoading && !error && glbUrl && (
        <Box sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
          <RightPanelModelViewer modelUrl={glbUrl} />
        </Box>
      )}

      {onClose && (
        <IconButton 
          onClick={onClose} 
          sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
        >
          <CloseRoundedIcon />
        </IconButton>
      )}
    </Box>
  );
};

