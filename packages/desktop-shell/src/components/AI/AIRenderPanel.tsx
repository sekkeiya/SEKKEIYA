import React from 'react';
import { Box, Typography, Paper, TextField, Button, IconButton, FormControl, InputLabel, Select, MenuItem, CircularProgress, LinearProgress } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAIRenderStore } from '../../store/useAIRenderStore';
import { useAIRenderGeneration } from '../../hooks/useAIRenderGeneration';
import AIDriveImagePicker from './AIDriveImagePicker';
import { BRAND } from '../../styles/theme';

import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';

const RENDER_MODELS = [
  { id: 'nanobanana', label: 'nanobanana (Gemini 2.5 Flash Image)' },
  { id: 'krea', label: 'Krea (Realtime) — 未実装' },
  { id: 'controlnet', label: 'ControlNet — 未実装' },
  { id: 'promeai', label: 'PromeAI — 未実装' },
  { id: 'midjourney', label: 'Midjourney — 未実装' },
];

const AIRenderPanel: React.FC = () => {
  const { setAIRenderExpanded, setAIRenderOpen } = useAppStore();
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,24,32,0.85)', backdropFilter: 'blur(24px)' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 48, flexShrink: 0 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontWeight: 'bold' }}>AI Render</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setAIRenderExpanded(true)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
          >
            <OpenInFullRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setAIRenderOpen(false)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', p: 2, gap: 3 }}>

        {/* Model Selection */}
        <FormControl fullWidth size="small" variant="outlined" sx={{
          '& .MuiOutlinedInput-root': {
            color: 'var(--brand-fg)',
            borderRadius: 1.5,
            bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
            '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
            '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#90caf9' },
          },
          '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.85rem' },
          '& .MuiInputLabel-root.Mui-focused': { color: 'light-dark(#095fa5, #90caf9)' }
        }}>
          <InputLabel id="panel-render-model-select">適用モデル</InputLabel>
          <Select
            labelId="panel-render-model-select"
            value={selectedModel}
            label="適用モデル"
            onChange={(e) => setSelectedModel(e.target.value as string)}
            disabled={isRunning}
            sx={{ fontSize: '0.85rem' }}
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

        {/* Input Section */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid ${BRAND.line}`, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 1.5, fontWeight: 'bold' }}>
            プロンプトからの生成
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="生成したいイメージを説明..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isRunning}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'var(--brand-fg)',
                  borderRadius: 1.5,
                  '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                  '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                }
              }}
            />
            <Button
              variant="contained"
              disabled={(!prompt && !imageUrl) || isRunning}
              onClick={handleGenerate}
              sx={{ minWidth: 40, px: 0, borderRadius: 1.5 }}
            >
              {isRunning ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <AutoFixHighRoundedIcon fontSize="small" />}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>または</Typography>
            <Button
              component="label"
              variant="outlined"
              fullWidth
              size="small"
              disabled={isRunning}
              startIcon={<UploadFileRoundedIcon />}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                '&:hover': { borderColor: '#fff' }
              }}
            >
              ローカルから
              <input type="file" accept="image/*" hidden onChange={handleFile} />
            </Button>
            <Button
              variant="outlined"
              fullWidth
              size="small"
              disabled={isRunning}
              onClick={() => setDrivePickerOpen(true)}
              startIcon={<AddToPhotosRoundedIcon />}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                '&:hover': { borderColor: '#fff' }
              }}
            >
              SEKKEIYA Driveから
            </Button>
          </Box>

          {imageUrl && (
            <Box sx={{ mt: 1.5, position: 'relative', borderRadius: 1.5, overflow: 'hidden', aspectRatio: '16/9', bgcolor: 'rgba(0,0,0,0.4)' }}>
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
        </Paper>

        {/* Status / Viewer Section */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid ${BRAND.line}`, borderRadius: 2, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontWeight: 'bold' }}>
              プレビュー
            </Typography>
            <Typography variant="caption" sx={{ color: status === 'done' ? '#66bb6a' : status === 'error' ? 'light-dark(#921b1b, #e57373)' : '#3498db', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              {isRunning && <CircularProgress size={12} sx={{ color: 'inherit' }} />}
              {String(status).toUpperCase()}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minHeight: 200, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {resultUrl ? (
              <img src={resultUrl} alt="Result" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', gap: 1.5, width: '80%' }}>
                {isRunning ? (
                  <>
                    <CircularProgress size={32} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
                    <Typography variant="body2" sx={{ color: 'light-dark(#095fa5, #90caf9)', fontWeight: 'bold' }}>
                      {Math.floor(progress)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{ width: '100%', height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', '& .MuiLinearProgress-bar': { bgcolor: '#90caf9' } }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                      生成中...（推定 約60秒）
                    </Typography>
                  </>
                ) : (
                  <>
                    <WallpaperRoundedIcon fontSize="large" />
                    <Typography variant="caption">生成された画像はここに表示されます</Typography>
                  </>
                )}
              </Box>
            )}
          </Box>

          {resultUrl && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button fullWidth variant="contained" startIcon={<AddToPhotosRoundedIcon />} disabled sx={{ textTransform: 'none', borderRadius: 1.5 }}>
                現在のWorkspaceに追加（未実装）
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" fullWidth startIcon={<CloudUploadRoundedIcon />} onClick={saveResultToDrive} disabled={busy} sx={{ textTransform: 'none', borderRadius: 1.5, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}>
                  SEKKEIYA Drive保存
                </Button>
                <Button variant="outlined" fullWidth startIcon={<DownloadRoundedIcon />} onClick={handleDownload} sx={{ textTransform: 'none', borderRadius: 1.5, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}>
                  DL
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      <AIDriveImagePicker
        open={drivePickerOpen}
        onClose={() => setDrivePickerOpen(false)}
        onPick={(url) => setImageUrl(url)}
      />
    </Box>
  );
};

export default AIRenderPanel;
