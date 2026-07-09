import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { invoke } from '@tauri-apps/api/core';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../../lib/firebase/client';
import { readFile } from '@tauri-apps/plugin-fs';
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
           const normalizedPath = localPath.replace(/\\/g, '/');
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
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            3Dプレビューを生成中... (少し時間がかかります)
          </Typography>
        </Box>
      )}

      {error && !isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 3, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ color: '#f44336', fontSize: 48, mb: 1 }} />
          <Typography sx={{ color: '#f44336', fontWeight: 600 }}>プレビュー表示エラー</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400 }}>{error}</Typography>
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
          sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
        >
          <CloseRoundedIcon />
        </IconButton>
      )}
    </Box>
  );
};

