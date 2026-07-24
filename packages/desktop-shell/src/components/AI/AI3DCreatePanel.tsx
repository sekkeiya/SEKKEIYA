import React, { useEffect } from 'react';
import { Box, Typography, Paper, Button, IconButton, CircularProgress, Dialog } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAI3DCreateStore } from '../../store/useAI3DCreateStore';
import { BRAND } from '../../styles/theme';

import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions, storage } from "../../lib/firebase/client";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import UploadModalContent from '../../features/dss/upload/modal/UploadModalContent';
import { Modal } from '@mui/material';
import { useAuth } from "../../features/dsl/layout/hooks/useAuthProxy";
import { MODEL_3D_DISPLAY_NAMES } from '../../features/ai-studio/constants/ai-model-plans';
import { useAiModelLimits } from '../../features/ai-studio/hooks/useAiModelLimits';
import { useDriveAssets, PICKER_LAYERS } from '../../features/drive/driveAccess';

import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';

const AI_MODELS = [
  { id: 'tripo3d', label: MODEL_3D_DISPLAY_NAMES['tripo3d'] },
];

const AI3DCreatePanel: React.FC = () => {
  const { setAI3DCreateExpanded, setAI3DCreateOpen, setPendingScreenshot } = useAppStore();
  const { taskId, status, glbUrl, busy, selectedModel, contextWorkspaceId, setTaskId, setStatus, setGlbUrl, setBusy, setSelectedModel, imageUrl, setImageUrl } = useAI3DCreateStore();
  const { user } = useAuth();
  const { getRemainingText, isModelLocked } = useAiModelLimits();
  const [urlInput, setUrlInput] = React.useState(imageUrl || '');
  const [isDrivePickerOpen, setIsDrivePickerOpen] = React.useState(false);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [uploadFiles, setUploadFiles] = React.useState<File[]>([]);

  useEffect(() => {
    if (imageUrl) {
      setUrlInput(imageUrl);
    }
  }, [imageUrl]);

  // SEKKEIYA Drive の画像資産（driveAccess = 単一の読み取り窓口・決定的プール）。
  const { assets: driveAssets } = useDriveAssets({ media: 'image', layers: PICKER_LAYERS });

  const handleFromUrl = async () => {
    if (!urlInput.trim()) return;
    await startGeneration(urlInput.trim());
  };

  const handleFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setUrlInput(URL.createObjectURL(file));
      const url = await uploadImageAndGetUrl(file);
      setUrlInput(url);
      setTaskId(null);
      setStatus('idle');
      setGlbUrl(null);
    } catch (err: any) {
      alert("Error uploading file: " + err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const startGeneration = async (imageUrl: string) => {
    if (!user) {
      alert("ログインが必要です");
      return;
    }
    if (isModelLocked(selectedModel)) {
      alert("利用上限に達しました。プランのアップグレードをご検討ください。");
      return;
    }
    setTaskId(null);
    setStatus('running');
    setGlbUrl(null);
    setBusy(true);
    try {
      const requestAiGeneration = httpsCallable(functions, 'requestAiGeneration');
      
      const payload = {
        provider: selectedModel,
        type: 'image_to_3d',
        inputImageUrl: imageUrl,
        inputImageStoragePath: null,
        targetBoardId: contextWorkspaceId !== 'models' ? contextWorkspaceId : null,
        autoPlace: true,
        imageHash: 'hash_' + Date.now()
      };
      
      const result = await requestAiGeneration(payload);
      const data = result.data as any;
      
      if (!data.success || !data.jobId) {
        throw new Error(data.message || "Failed to start generation job");
      }
      
      setTaskId(data.jobId);
    } catch (err: any) {
      console.error(err);
      alert("生成の開始に失敗しました: " + (err.message || ''));
      setStatus('error');
      setBusy(false);
    }
  };

  // Listen for job updates
  useEffect(() => {
    if (!taskId || status !== 'running' || !user) return;
    
    console.log("Starting listener for aiJob:", taskId);
    const jobRef = doc(db, 'users', user.uid, 'aiJobs', taskId);
    
    const unsubscribe = onSnapshot(jobRef, async (docSnap) => {
      if (docSnap.exists()) {
        const jobData = docSnap.data();
        console.log("Job status update:", jobData.status);
        
        if (jobData.status === 'completed') {
          let finalUrl = jobData.glbUrl;
          if (!finalUrl && jobData.glbStoragePath) {
            try {
              finalUrl = await getDownloadURL(ref(storage, jobData.glbStoragePath));
            } catch (err) {
              console.error("Failed to fetch download URL:", err);
            }
          }
          setGlbUrl(finalUrl);
          setStatus('done');
          setBusy(false);
        } else if (jobData.status === 'failed') {
          alert("3D生成に失敗しました: " + (jobData.errorMessage || 'エラーが発生しました'));
          setStatus('error');
          setBusy(false);
        }
      }
    }, (error) => {
      console.error("Job listener error:", error);
      setStatus('error');
      setBusy(false);
    });
    
    return () => unsubscribe();
  }, [taskId, status, user]);

  const handleDownload = () => {
    if (!glbUrl) return;
    const a = document.createElement('a');
    a.href = glbUrl;
    a.download = `triposr_${taskId}.glb`;
    a.click();
  };

  const handleSaveToDrive = async () => {
    if (!glbUrl) return;
    try {
      setBusy(true);
      const res = await fetch(glbUrl, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `AI_Model_${taskId || Date.now()}.glb`, { type: 'model/gltf-binary' });
      setUploadFiles([file]);
      setUploadModalOpen(true);
    } catch (e: any) {
      alert("Failed to prepare model for upload: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,24,32,0.85)', backdropFilter: 'blur(24px)' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 48, flexShrink: 0 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontWeight: 'bold' }}>AI 3D Generate</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => setAI3DCreateExpanded(true)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
          >
            <OpenInFullRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setAI3DCreateOpen(false)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', p: 2, gap: 3 }}>
        
        {/* AI Model Selection Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            AI Model
          </Typography>
          {AI_MODELS.map(m => {
            const locked = isModelLocked(m.id);
            const active = selectedModel === m.id;
            
            // Extract base name and description for a cleaner look
            const match = m.label.match(/(.*?)\s*\((.*?)\)/);
            const title = match ? match[1] : m.label;
            const desc = match ? match[2] : '';
            
            return (
              <Box
                key={m.id}
                onClick={() => {
                  if (!locked && !busy && status !== 'running') {
                    setSelectedModel(m.id);
                  }
                }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${active ? '#90caf9' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                  bgcolor: active ? 'rgba(144, 202, 249, 0.08)' : 'rgb(var(--brand-fg-rgb) / 0.02)',
                  cursor: (locked || busy || status === 'running') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: locked ? 0.6 : 1,
                  '&:hover': {
                    bgcolor: (!locked && !busy && status !== 'running') ? (active ? 'rgba(144, 202, 249, 0.12)' : 'rgb(var(--brand-fg-rgb) / 0.05)') : undefined,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: active ? 'light-dark(#095fa5, #90caf9)' : 'rgb(var(--brand-fg-rgb) / 0.9)' }}>
                    {title}
                  </Typography>
                  {locked && <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>🔒 Locked</Typography>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                    {desc}
                  </Typography>
                  <Typography variant="caption" sx={{ color: active ? 'light-dark(#095fa5, #90caf9)' : 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 'bold' }}>
                    {getRemainingText(m.id).replace(/[()]/g, '')}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Input Section */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid ${BRAND.line}`, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 1.5, fontWeight: 'bold' }}>
            画像を選択して生成
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              component="label"
              variant="outlined"
              size="small"
              fullWidth
              disabled={busy || status === 'running'}
              startIcon={<UploadFileRoundedIcon />}
              sx={{ 
                borderRadius: 1.5, 
                textTransform: 'none', 
                color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                borderStyle: 'dashed',
                borderWidth: 1,
                py: 1,
                '&:hover': { borderColor: '#fff', borderWidth: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
              }}
            >
              ローカルから
              <input type="file" accept="image/*" hidden onChange={handleFromFile} />
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              disabled={busy || status === 'running'}
              onClick={() => setIsDrivePickerOpen(true)}
              startIcon={<AddToPhotosRoundedIcon />}
              sx={{ 
                borderRadius: 1.5, 
                textTransform: 'none', 
                color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                borderStyle: 'dashed',
                borderWidth: 1,
                py: 1,
                '&:hover': { borderColor: '#fff', borderWidth: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
              }}
            >
              SEKKEIYA Driveから
            </Button>
          </Box>

          {/* Show Generate Button and Preview if image is selected */}
          {urlInput && status !== 'running' && status !== 'done' && (
             <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
               <Box sx={{ aspectRatio: '16/9', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 1.5, overflow: 'hidden', position: 'relative' }}>
                 <img src={urlInput} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                 <IconButton 
                   size="small"
                   onClick={() => {
                     setUrlInput('');
                     setImageUrl(null);
                     setPendingScreenshot(null);
                   }}
                   sx={{ 
                     position: 'absolute', 
                     top: 4, 
                     right: 4, 
                     bgcolor: 'rgba(0,0,0,0.6)', 
                     '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } 
                   }}
                 >
                   <CloseRoundedIcon fontSize="small" sx={{ color: 'var(--brand-fg)' }} />
                 </IconButton>
               </Box>
               <Box sx={{ display: 'flex', gap: 1 }}>
                 <Button 
                   variant="outlined" 
                   fullWidth 
                   disabled={busy}
                   onClick={() => {
                     setUrlInput('');
                     setImageUrl(null);
                     setPendingScreenshot(null);
                   }}
                   sx={{ 
                     borderRadius: 1.5, 
                     textTransform: 'none', 
                     fontWeight: 'bold',
                     borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                     color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                     py: 1,
                     '&:hover': { borderColor: '#fff', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                   }}
                 >
                   キャンセル
                 </Button>
                 <Button 
                   variant="contained" 
                   fullWidth 
                   disabled={busy}
                   onClick={handleFromUrl}
                   startIcon={<AutoFixHighRoundedIcon />}
                   sx={{ 
                     borderRadius: 1.5, 
                     textTransform: 'none', 
                     fontWeight: 'bold',
                     background: 'linear-gradient(90deg, #3498db, #9b59b6)',
                     boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
                     py: 1,
                     '&:hover': { background: 'linear-gradient(90deg, #2980b9, #8e44ad)' }
                   }}
                 >
                   ✨ 生成を開始する
                 </Button>
               </Box>
             </Box>
          )}
        </Paper>

        {/* Status / Viewer Section */}
        {(taskId || busy) && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid ${BRAND.line}`, borderRadius: 2, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontWeight: 'bold' }}>
                プレビュー
              </Typography>
              <Typography variant="caption" sx={{ color: status === 'done' ? '#66bb6a' : '#3498db', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                {status !== 'error' && status !== 'done' && <CircularProgress size={12} sx={{ color: 'inherit' }} />}
                {status.toUpperCase()}
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, minHeight: 200, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              {glbUrl ? (
                // @ts-ignore
                <model-viewer
                  style={{ width: '100%', height: '100%', background: 'transparent' }}
                  src={glbUrl}
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  exposure="1.05"
                  environment-image="neutral"
                  // --- P0 AR 素検証: iOS の AR Quick Look が WKWebView 内で起動するか確認 ---
                  // ios-src 未指定のため model-viewer が GLB から即席 USDZ を生成して quick-look を試みる。
                  // ar-scale="fixed" で実寸固定（設計用途の確認用）。
                  ar
                  ar-modes="quick-look"
                  ar-scale="fixed"
                  ar-placement="floor"
                >
                  {/* @ts-ignore : AR 起動ボタン（AR 利用可能時のみ model-viewer が表示） */}
                  <button
                    slot="ar-button"
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: 'none',
                      background: '#1976d2',
                      color: 'var(--brand-fg)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  >
                    ARで原寸配置
                  </button>
                  {/* @ts-ignore */}
                </model-viewer>
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary">モデルを待機中...</Typography>
                </Box>
              )}
            </Box>

            {glbUrl && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    startIcon={<CloudUploadRoundedIcon />}
                    onClick={handleSaveToDrive}
                    sx={{ textTransform: 'none', borderRadius: 1.5, color: 'var(--brand-fg)', whiteSpace: 'nowrap' }}
                  >
                    S.Modelに保存
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={handleDownload}
                    sx={{ textTransform: 'none', borderRadius: 1.5, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)', minWidth: 60 }}
                  >
                    DL
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* Upload Modal (3DSS Integration) */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)}>
        {/* @ts-ignore */}
        <UploadModalContent open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} initialFiles={uploadFiles} />
      </Modal>

      {/* AI Drive Image Picker Dialog */}
      <Dialog open={isDrivePickerOpen} onClose={() => setIsDrivePickerOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: BRAND.bg, backgroundImage: 'none', height: '60vh' } }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 'bold' }}>SEKKEIYA Drive から画像を選択</Typography>
          <IconButton onClick={() => setIsDrivePickerOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon /></IconButton>
        </Box>
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 2 }}>
            {driveAssets.length === 0 ? (
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>画像アセットが見つかりません</Typography>
            ) : (
              driveAssets.map(asset => (
                <Box 
                  key={asset.id} 
                  onClick={() => {
                    setUrlInput(asset.storageUrl || asset.url || '');
                    setTaskId(null);
                    setStatus('idle');
                    setGlbUrl(null);
                    setIsDrivePickerOpen(false);
                  }}
                  sx={{ aspectRatio: '1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2, overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', '&:hover': { borderColor: '#90caf9' } }}
                >
                  <img src={asset.storageUrl || asset.url || ''} alt={asset.title || 'image'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Dialog>

    </Box>
  );
};

export default AI3DCreatePanel;
