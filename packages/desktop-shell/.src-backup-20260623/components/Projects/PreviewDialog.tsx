import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, IconButton, CircularProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { convertFileSrc } from '@tauri-apps/api/core';
// @ts-ignore
import { convert3dmToGlb } from '../../features/dss/upload/utils/convert3dmToGlb';
import { RightPanelModelViewer } from '../../features/dss/components/RightPanelModelViewer';
import { invoke } from '@tauri-apps/api/core';

import { InlineWorkFilePreview } from './InlineWorkFilePreview';

interface Props {
  open: boolean;
  onClose: () => void;
  fileName: string;
  versionName?: string;
  toolType?: string;
  templatePath?: string;
  templateId?: string;
  workFileId?: string;
  localPath?: string;
  storagePath?: string;
  /** Called once the GLB object URL is ready (e.g. to capture a thumbnail). */
  onGlbReady?: (glbUrl: string) => void;
}

export const PreviewDialog: React.FC<Props> = ({
  open, onClose, fileName, versionName, toolType, templatePath, templateId, workFileId, localPath, storagePath, onGlbReady
}) => {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrlToRevoke: string | null = null;
    let isMounted = true;

    // Delegate entirely to InlineWorkFilePreview if we have WorkFile data
    if (workFileId || localPath || storagePath) {
      return;
    }

    if (!open || !templatePath) {
      setGlbUrl(null);
      setError(null);
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);
      setGlbUrl(null);

      try {
        let fetchUrl = templatePath;
        // Check if Windows path (e.g., C:\...)
        if (fetchUrl.match(/^[a-zA-Z]:\\/) || fetchUrl.startsWith('/')) {
          const normalizedPath = fetchUrl.replace(/\\/g, '/');
          fetchUrl = convertFileSrc(normalizedPath);
        } else if (fetchUrl.startsWith('http')) {
          // If it's a remote URL, bypass CORS by using the Rust backend to download it first
          const safeId = templateId || 'preview-temp';
          const resolvedPath = await invoke<string>('ensure_model_cached', {
            modelId: safeId,
            model_id: safeId,
            ext: '3dm',
            downloadUrl: fetchUrl
          });
          const normalizedPath = resolvedPath.replace(/\\/g, '/');
          fetchUrl = convertFileSrc(normalizedPath);
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to fetch the template file.');

        const blob = await response.blob();
        
        const isRhino = templatePath.toLowerCase().endsWith('.3dm') || toolType?.toLowerCase().includes('rhino');
        
        if (isRhino) {
          const safeName = fileName.toLowerCase().endsWith('.3dm') ? fileName : `${fileName}.3dm`;
          const file = new File([blob], safeName);
          
          const glbFile = await convert3dmToGlb(file);
          const url = URL.createObjectURL(glbFile as File);
          objectUrlToRevoke = url;
          if (isMounted) {
            setGlbUrl(url);
            onGlbReady?.(url);
          }
        } else {
          if (isMounted) setError(`Preview is not supported for this file type (${toolType || 'Unknown'}). Only Rhino (.3dm) previews are currently available.`);
        }
      } catch (err: any) {
        console.error('[PreviewDialog] Error rendering preview:', err);
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
  }, [open, templatePath, fileName, toolType]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(15, 20, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 4,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(0,191,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VisibilityRoundedIcon sx={{ color: '#00BFFF', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.2 }}>
              {fileName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {versionName ? `Version: ${versionName}` : 'Latest Version'} {toolType ? `| Tool: ${toolType}` : ''}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, pt: 0 }}>
        <Box sx={{ 
          width: '100%', 
          height: 500, 
          bgcolor: 'rgba(0,0,0,0.4)', 
          borderRadius: 3, 
          border: '1px dashed rgba(255,255,255,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {(workFileId || localPath || storagePath) ? (
            <InlineWorkFilePreview
              fileId={workFileId || ''}
              localPath={localPath}
              storagePath={storagePath}
              fileName={fileName}
              toolType={toolType || ''}
              onClose={onClose}
              onGlbReady={onGlbReady}
            />
          ) : (
            <>
              {isLoading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <CircularProgress sx={{ color: '#00BFFF' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    3Dプレビューを生成中... (少し時間がかかります)
                  </Typography>
                </Box>
              )}

              {error && !isLoading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, p: 3, textAlign: 'center' }}>
                  <ErrorOutlineIcon sx={{ color: '#f44336', fontSize: 48, mb: 1 }} />
                  <Typography sx={{ color: '#f44336', fontWeight: 600 }}>プレビュー表示エラー</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{error}</Typography>
                </Box>
              )}

              {!isLoading && !error && glbUrl && (
                <Box sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                  <RightPanelModelViewer modelUrl={glbUrl} />
                </Box>
              )}

              {!isLoading && !error && !glbUrl && !templatePath && (
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', textAlign: 'center', maxWidth: 300 }}>
                  プレビューデータが見つかりません。
                </Typography>
              )}
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
