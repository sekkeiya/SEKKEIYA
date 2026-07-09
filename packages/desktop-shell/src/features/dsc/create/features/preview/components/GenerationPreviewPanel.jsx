import React, { useState, useEffect } from 'react';
import { Paper, Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress } from '@mui/material';
import { useCreateStore } from '../../../store/useCreateStore';
import { tokens } from '../../../shared/theme/tokens';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';

export default function GenerationPreviewPanel() {
  const job = useCreateStore((state) => state.generationJob);
  const updateGenerationJob = useCreateStore((state) => state.updateGenerationJob);
  const updateRecentJob = useCreateStore((state) => state.updateRecentJob);
  
  const [previewMode, setPreviewMode] = useState('image'); // "image" | "model"
  const [glbError, setGlbError] = useState(false);

  const isEmpty = job.status === 'idle';
  const isGenerating = ['queued', 'running', 'postprocessing'].includes(job.status);
  const isCompleted = job.status === 'done';
  const isError = job.status === 'error';

  useEffect(() => {
    // When a job becomes completed (or a completed job is restored), switch to 3D view automatically.
    if (isCompleted && !glbError) {
      setPreviewMode('model');
    }
  }, [job.id, isCompleted, glbError]);

  const handleModelLoad = (e) => {
    const viewer = e.target;
    if (!viewer || typeof viewer.toBlob !== 'function') return;
    
    // Slight delay to ensure scene is effectively rendered
    setTimeout(async () => {
      try {
        const blob = await viewer.toBlob({ idealAspect: true });
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            if (job.id) {
              updateGenerationJob({ resultPreviewImagePath: dataUrl });
              updateRecentJob(job.id, { resultPreviewImagePath: dataUrl });
            }
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.warn('Auto-thumbnail capture failed:', err);
      }
    }, 300);
  };


  return (
    <Paper sx={{ 
      flexGrow: 1, 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: tokens.background.card, 
      backdropFilter: 'blur(12px)',
      border: `1px solid ${tokens.border.subtle}`,
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Top Bar */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${tokens.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.secondary' }}>
          プレビュー
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={previewMode}
          exclusive
          onChange={(e, val) => {
            if (val) {
              setPreviewMode(val);
              setGlbError(false); // Reset error state when switching modes
            }
          }}
          disabled={!isCompleted}
          sx={{ 
            height: 32,
            '& .MuiToggleButton-root': {
              px: 2,
              border: `1px solid ${tokens.border.subtle}`,
              color: 'text.secondary',
              opacity: 0.5,
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)',
                transform: 'translateY(-1px)'
              },
              '&.Mui-selected': {
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)',
                color: 'text.primary',
                opacity: 1,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
              }
            }
          }}
        >
          <ToggleButton value="image">2Dレンダー</ToggleButton>
          <ToggleButton value="model">3Dモデル</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Main Stage */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'hidden',
        bgcolor: 'rgba(0,0,0,0.4)', // Darker stage background
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.7)', // Vignette effect
        m: 1,
        borderRadius: 2,
        border: `1px solid rgb(var(--brand-fg-rgb) / 0.03)`
      }}>
        
        {/* Empty State */}
        {isEmpty && (
          <Box sx={{ textAlign: 'center', color: 'text.secondary', opacity: 0.8, maxWidth: 400, px: 3, animation: 'fadeIn 0.5s ease-in' }}>
            <Box sx={{ 
              width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3,
              boxShadow: '0 0 20px rgb(var(--brand-fg-rgb) / 0.05)'
            }}>
              <ImageSearchIcon sx={{ fontSize: 40, color: tokens.text.accent }} />
            </Box>
            <Typography variant="h6" gutterBottom>生成の準備ができました</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
              プロンプトを入力して、最初の3Dモデルを生成してください
            </Typography>
          </Box>
        )}

        {/* Generating State */}
        {isGenerating && (
          <Box sx={{ textAlign: 'center', color: 'text.primary', animation: 'pulse 2s infinite ease-in-out' }}>
            <CircularProgress size={48} thickness={3} sx={{ mb: 3, color: tokens.text.accent }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              3Dモデルを生成しています...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({job.status}: {job.progress}%)
            </Typography>
          </Box>
        )}

        {/* Error State */}
        {isError && (
          <Box sx={{ textAlign: 'center', color: 'error.main' }}>
            <Typography variant="h6">Generation Failed</Typography>
            <Typography variant="body2">{job.errorMessage}</Typography>
          </Box>
        )}

        {/* Completed State */}
        {isCompleted && (
          <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Tripo Badge Indicator */}
            {job.engine === 'tripo-api' && (
              <Box sx={{ 
                position: 'absolute', top: 16, right: 16, zIndex: 10,
                bgcolor: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.5)',
                color: 'light-dark(#ad9200, #FFD700)', px: 1.5, py: 0.5, borderRadius: 1,
                display: 'flex', alignItems: 'center', gap: 1, backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 12px rgba(255,215,0,0.1)'
              }}>
                <AutoFixHighIcon fontSize="small" />
                <Typography variant="caption" fontWeight="bold">Tripo High Quality</Typography>
              </Box>
            )}

            {/* Image Preview */}
            <Box sx={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              display: previewMode === 'image' ? 'flex' : 'none', 
              alignItems: 'center', justifyContent: 'center', p: 4, zIndex: 1
            }}>
              <Box 
                component="img" 
                src={job.resultPreviewImagePath || ''} 
                alt="Generated 2D Render"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
                onLoad={(e) => {
                  e.target.style.display = 'block';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'none';
                }}
                sx={{ 
                  maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', 
                  borderRadius: 2, boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  border: `1px solid ${tokens.border.subtle}`
                }}
              />
              <Box 
                sx={{ 
                  display: !job.resultPreviewImagePath ? 'flex' : 'none', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: '100%', 
                  height: '100%',
                  color: 'text.disabled',
                  bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
                  borderRadius: 2
                }}
              >
                <ImageSearchIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">サムネイル生成中...</Typography>
              </Box>
            </Box>

            {/* Model Viewer (Always Mounted) */}
            <Box sx={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: previewMode === 'model' ? 1 : 0, 
              pointerEvents: previewMode === 'model' ? 'auto' : 'none',
              zIndex: 0
            }}>
              {glbError ? (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'error.main' }}>
                  <Typography variant="body1" gutterBottom>モデルの読み込みに失敗しました。</Typography>
                  <Typography variant="caption" color="text.secondary">ファイルが存在しないか、不正な形式です。</Typography>
                </Box>
              ) : (
                <model-viewer
                  id="result-model"
                  src={job.resultGlbPath}
                  auto-rotate
                  camera-controls
                  shadow-intensity="1"
                  onLoad={handleModelLoad}
                  onError={() => { setGlbError(true); }}
                  style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Scaffolding: Candidate Thumbnails / Compare */}
      <Box sx={{ height: 80, borderTop: `1px solid ${tokens.border.subtle}`, display: 'flex', alignItems: 'center', px: 2, gap: 1, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
          候補モデル:
        </Typography>
        {/* Placeholder Thumbnail slots */}
        {isEmpty ? (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            生成後、ここに候補モデルが表示されます...
          </Typography>
        ) : (
          <>
            <Box sx={{ width: 60, height: 60, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${tokens.border.active}` }} />
            <Box sx={{ width: 60, height: 60, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${tokens.border.subtle}` }} />
            <Box sx={{ width: 60, height: 60, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${tokens.border.subtle}` }} />
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
      </Box>
    </Paper>
  );
}
