import React from 'react';
import { Box, Typography, TextField, Button, IconButton, Select, MenuItem, FormControl, InputLabel, CircularProgress, LinearProgress } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAIRenderStore } from '../../store/useAIRenderStore';
import { useAIRenderGeneration } from '../../hooks/useAIRenderGeneration';
import AIDriveImagePicker from './AIDriveImagePicker';
import { BRAND } from '../../styles/theme';

import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const RENDER_MODELS = [
  { id: 'nanobanana', label: 'nanobanana (Gemini 2.5 Flash Image)' },
  { id: 'krea', label: 'Krea (Realtime) — 未実装' },
  { id: 'controlnet', label: 'ControlNet — 未実装' },
  { id: 'promeai', label: 'PromeAI — 未実装' },
  { id: 'midjourney', label: 'Midjourney — 未実装' },
];

const AIRenderFullScreen: React.FC = () => {
  const { setAIRenderExpanded } = useAppStore();
  const { status, busy, selectedModel, setSelectedModel, prompt, setPrompt, imageUrl, setImageUrl } = useAIRenderStore();
  const { resultUrl, progress, startGeneration, uploadBaseImage, saveResultToDrive } = useAIRenderGeneration();
  const [drivePickerOpen, setDrivePickerOpen] = React.useState(false);

  const handleGenerate = () => {
    if (selectedModel !== 'nanobanana') {
      alert('現在 nanobanana のみ実装されています。モデルを変更してください。');
      return;
    }
    startGeneration();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadBaseImage(file);
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `ai_render_${Date.now()}.png`;
    a.click();
  };

  const isRunning = busy || status === 'running' || status === 'processing' || status === 'pending';

  return (
    <Box sx={{ height: '100%', display: 'flex', bgcolor: BRAND.bg }}>
      {/* Left Sidebar */}
      <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel, borderRight: `1px solid ${BRAND.line}`, flexShrink: 0, zIndex: 5 }}>
        {/* Sidebar Header */}
        <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 64 }}>
           <Typography variant="h6" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 'bold' }}>AI Render</Typography>
        </Box>

        {/* Sidebar Content */}
        <Box sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>

          {/* AI Model Selection */}
          <FormControl fullWidth size="small" variant="outlined" sx={{
            '& .MuiOutlinedInput-root': {
              color: 'var(--brand-fg)',
              borderRadius: 2,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
              '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
              '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#90caf9' },
            },
            '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
            '& .MuiInputLabel-root.Mui-focused': { color: 'light-dark(#095fa5, #90caf9)' }
          }}>
            <InputLabel id="fullscreen-render-model-select">適用モデル</InputLabel>
            <Select
              labelId="fullscreen-render-model-select"
              value={selectedModel}
              label="適用モデル"
              onChange={(e) => setSelectedModel(e.target.value as string)}
              disabled={isRunning}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: BRAND.bg,
                    border: `1px solid ${BRAND.line}`,
                    backgroundImage: 'none'
                  }
                }
              }}
            >
              {RENDER_MODELS.map(m => (
                <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Input block */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              プロンプトやベース画像を指定して、AIでレンダリングを実施します。
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                placeholder="生成したいイメージを説明..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isRunning}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'var(--brand-fg)',
                    borderRadius: 2,
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                  }
                }}
              />
            </Box>
            <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={(!prompt && !imageUrl) || isRunning}
                onClick={handleGenerate}
                startIcon={isRunning ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
                sx={{ borderRadius: 2 }}
              >
                {isRunning ? `生成中... ${Math.floor(progress)}%` : '生成する'}
              </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
              <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'uppercase', letterSpacing: 2 }}>OR</Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                component="label"
                variant="outlined"
                size="large"
                fullWidth
                disabled={isRunning}
                startIcon={<UploadFileRoundedIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                  borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  py: 2,
                  '&:hover': { borderColor: '#fff', borderWidth: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                }}
              >
                ローカルから
                <input type="file" accept="image/*" hidden onChange={handleFile} />
              </Button>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                disabled={isRunning}
                onClick={() => setDrivePickerOpen(true)}
                startIcon={<AddToPhotosRoundedIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                  borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  py: 2,
                  '&:hover': { borderColor: '#fff', borderWidth: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                }}
              >
                SEKKEIYA Driveから
              </Button>
            </Box>

            {imageUrl && (
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.4)' }}>
                <img src={imageUrl} alt="Base" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <IconButton
                  size="small"
                  disabled={isRunning}
                  onClick={() => setImageUrl(null)}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>アクション</Typography>
            <Button
              size="large"
              fullWidth
              variant="contained"
              startIcon={<AddToPhotosRoundedIcon />}
              disabled
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              現在のWorkspaceに追加（未実装）
            </Button>
            <Button
              size="large"
              variant="outlined"
              fullWidth
              startIcon={<CloudUploadRoundedIcon />}
              disabled={!resultUrl || busy}
              onClick={saveResultToDrive}
              sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}
            >
              SEKKEIYA Driveに保存
            </Button>
            <Button
              size="large"
              variant="outlined"
              fullWidth
              startIcon={<DownloadRoundedIcon />}
              disabled={!resultUrl}
              onClick={handleDownload}
              sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}
            >
              ダウンロード
            </Button>
          </Box>

        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
         {/* Close Button overlay */}
         <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
           <IconButton
             onClick={() => setAIRenderExpanded(false)}
             sx={{ bgcolor: 'rgba(20,22,27,0.7)', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, '&:hover': { bgcolor: 'rgba(20,22,27,0.9)' } }}
           >
             <CloseFullscreenRoundedIcon />
           </IconButton>
         </Box>

         <Box sx={{ flexGrow: 1, position: 'relative', p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{
              width: '100%', height: '100%',
              bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))',
              borderRadius: 3,
              border: `1px solid ${BRAND.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden'
            }}>
              {resultUrl ? (
                <img src={resultUrl} alt="Rendered" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : isRunning ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: 'rgb(var(--brand-fg-rgb) / 0.7)', width: 360, maxWidth: '60%' }}>
                  <CircularProgress size={56} variant="determinate" value={progress} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
                  <Typography variant="h4" sx={{ color: 'light-dark(#095fa5, #90caf9)', fontWeight: 'bold' }}>
                    {Math.floor(progress)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ width: '100%', height: 8, borderRadius: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', '& .MuiLinearProgress-bar': { bgcolor: '#90caf9' } }}
                  />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body1" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)', mb: 0.5 }}>
                      レンダリング中...
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                      推定 約60秒（プロンプトや入力画像によって前後します）
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                  <WallpaperRoundedIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                  <Typography variant="body1">画像はまだ生成されていません</Typography>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)' }}>
                    左側のパネルからプロンプトを入力するか<br/>画像をアップロードしてAI生成を開始してください
                  </Typography>
                </Box>
              )}
            </Box>
         </Box>
      </Box>

      <AIDriveImagePicker
        open={drivePickerOpen}
        onClose={() => setDrivePickerOpen(false)}
        onPick={(url) => setImageUrl(url)}
      />
    </Box>
  );
};

export default AIRenderFullScreen;
