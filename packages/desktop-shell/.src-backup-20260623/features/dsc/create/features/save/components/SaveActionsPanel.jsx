import React, { useState } from 'react';
import { Paper, Button, Stack, Typography, CircularProgress, Box, Divider } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ReplayIcon from '@mui/icons-material/Replay';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DownloadIcon from '@mui/icons-material/Download';
import { tokens } from '../../../shared/theme/tokens';
import { useCreateStore } from '../../../store/useCreateStore';
import { saveGeneratedModelToShare } from '../../integration/share/api/shareIntegrationApi';
import { parsePromptToTaxonomy } from '../utils/taxonomyParser';

export default function SaveActionsPanel() {
  const { status, resultModelId, resultGlbPath, savedAssetId, savedAt, engine, domain } = useCreateStore((state) => state.generationJob);
  const prompt = useCreateStore((state) => state.generationInput.prompt);
  const updateGenerationJob = useCreateStore((state) => state.updateGenerationJob);
  const resetGenerationJob = useCreateStore((state) => state.resetGenerationJob);
  const updateRecentJob = useCreateStore((state) => {
    // We update the local recent array here if we want or let it be
  });
  
  const { from, boardId } = useCreateStore((state) => state.sourceContext);
  
  const [isSaving, setIsSaving] = useState(false);

  const isDone = status === 'done';
  const isIdle = status === 'idle';

  // "3DSC単体ユーザー" is true if from is undefined or null.
  const isStandalone = !from;

  const handleSaveToShare = async () => {
    if (!resultModelId) return;
    setIsSaving(true);
    try {
      // Create Title
      const autoTitle = prompt && prompt.length > 0 
        ? prompt.substring(0, 20) + (prompt.length > 20 ? '...' : '')
        : `${domain === 'furniture' ? '家具' : '空間'}モデル`;
        
      // Parse Taxonomy from prompt
      const taxonomyInfo = parsePromptToTaxonomy(domain, prompt);

      // Attempt thumbnail extraction via model-viewer
      let thumbnailBlob = null;
      try {
        const viewer = document.getElementById('result-model'); // Match viewer ID
        if (viewer && typeof viewer.toBlob === 'function') {
          // toBlob returns a Promise or blob depending on browser, usually Promise for MVs 
          thumbnailBlob = await viewer.toBlob(); 
        }
      } catch (err) {
        console.warn('Failed to extract thumbnail via model-viewer toBlob:', err);
      }
      
      const metadata = {
        title: autoTitle,
        type: taxonomyInfo.type,
        mainCategory: taxonomyInfo.mainCategory,
        subCategory: taxonomyInfo.subCategory,
        detailCategory: taxonomyInfo.detailCategory,
        tags: [domain, engine],
        source: '3dshapecreate',
        engine: engine,
        status: 'draft',
        hasThumbnail: !!thumbnailBlob
      };
      
      const res = await saveGeneratedModelToShare('current-job', resultModelId, metadata, thumbnailBlob);
      updateGenerationJob({ savedAssetId: res.shareId, savedAt: new Date().toISOString() });
      console.log('Successfully saved to 3DSS as Asset with full taxonomy');
    } catch (err) {
      console.error('Failed to save asset:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!resultGlbPath) return;
    // Basic download trigger handling
    const link = document.createElement('a');
    link.href = resultGlbPath;
    const filename = resultGlbPath.substring(resultGlbPath.lastIndexOf('/') + 1) || 'model.glb';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Paper sx={{ 
      p: 2, 
      bgcolor: tokens.background.panel, 
      backdropFilter: 'blur(12px)',
      border: `1px solid ${tokens.border.subtle}`
    }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
        次にできること
      </Typography>

      {isDone && (
        <Typography variant="body2" color="primary.light" sx={{ mt: 1, fontWeight: 500 }}>
          モデルの生成が完了しました。次の操作を選択してください。
        </Typography>
      )}
      
      <Stack spacing={2} sx={{ mt: isDone ? 2 : 0 }}>
        {!isIdle && !isStandalone && (
          <Box>
            {savedAssetId ? (
              <Box sx={{ textAlign: 'center' }}>
                <Button 
                  variant="outlined" 
                  color="inherit" 
                  fullWidth
                  startIcon={<OpenInNewIcon />}
                  component="a"
                  href={`/app/3dshape-studio/assets/${savedAssetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ borderColor: tokens.border.subtle, color: 'text.primary', display: 'flex' }}
                >
                  3DSSで開く
                </Button>
                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: 'success.main', mt: 1, fontWeight: 'bold' }}>
                  <CheckCircleOutlineIcon fontSize="inherit" />
                  3DSSに保存されました
                </Typography>
              </Box>
            ) : (
              <Box>
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth
                  startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveToShare}
                  disabled={!isDone || isSaving}
                  sx={{ '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' } }}
                >
                  3DSSへ保存（アセット化）
                </Button>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: isDone ? 'text.secondary' : 'text.disabled', mt: 0.5 }}>
                  3DSSに保存するとアセットとして管理されます。
                </Typography>
              </Box>
            )}
          </Box>
        )}
        
        {!isIdle && (
          <Button 
            variant="outlined" 
            color="inherit" 
            fullWidth
            startIcon={<DownloadIcon />}
            disabled={!isDone}
            onClick={handleDownload}
            sx={{ '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' } }}
          >
            GLBダウンロード
          </Button>
        )}

        {!isIdle && <Divider sx={{ my: 0.5 }} />}

        {!isIdle && (
          <>
            <Button 
              variant="contained" 
              color="inherit" 
              fullWidth
              startIcon={<AddIcon />}
              disabled={!isDone}
              onClick={resetGenerationJob}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.1)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)' } 
              }}
            >
              続けて生成する
            </Button>
            
            <Button 
              variant="outlined" 
              color="inherit" 
              fullWidth
              startIcon={<ReplayIcon />}
              disabled={!isDone}
              sx={{ '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.05)' }, border: 'none', '&:hover': { border: 'none', bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              バリエーション生成
            </Button>
          </>
        )}

        {isIdle && (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
            生成が完了するとアクションが表示されます
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
