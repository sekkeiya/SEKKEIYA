import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Box, Typography, TextField, Button, IconButton, CircularProgress, Select, MenuItem, FormControl, InputLabel, Dialog, Slider } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAI3DCreateStore } from '../../store/useAI3DCreateStore';
import { useDriveAssets, PICKER_LAYERS } from '../../features/drive/driveAccess';
import { BRAND } from '../../styles/theme';

import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import AIDriveFullScreen from './AIDriveFullScreen';
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions, storage } from "../../lib/firebase/client";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import UploadModalContent from '../../features/dss/upload/modal/UploadModalContent';
import { Modal } from '@mui/material';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { useAuth } from "../../features/dsl/layout/hooks/useAuthProxy";
import AI3DHistorySidebar, { type AIJob } from './AI3DHistorySidebar';
import { MODEL_3D_DISPLAY_NAMES, MODEL_3D_PLAN_REQUIRED, AI_3D_LIMITS, type UserPlan } from '../../features/ai-studio/constants/ai-model-plans';
import { useAiModelLimits } from '../../features/ai-studio/hooks/useAiModelLimits';


import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';

const AI_MODELS = [
  { id: 'tripo3d', label: MODEL_3D_DISPLAY_NAMES['tripo3d'] },
];

const AI3DCreateFullScreen: React.FC = () => {
  const { setAI3DCreateExpanded, setPendingScreenshot } = useAppStore();
  const { taskId, status, glbUrl, busy, selectedModel, contextProjectId, contextWorkspaceId, setTaskId, setStatus, setGlbUrl, setBusy, setSelectedModel, reset: reset3DStore, imageUrl, setImageUrl } = useAI3DCreateStore();
  const logSaveDataEvent = useAiProfileStore(s => s.logSaveDataEvent);
  const { user } = useAuth();
  
  const [urlInput, setUrlInput] = React.useState(imageUrl || '');
  const [isDrivePickerOpen, setIsDrivePickerOpen] = React.useState(false);

  useEffect(() => {
    if (imageUrl) {
      setUrlInput(imageUrl);
    }
  }, [imageUrl]);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [uploadFiles, setUploadFiles] = React.useState<File[]>([]);
  
  // SEKKEIYA Drive の画像資産（driveAccess = 単一の読み取り窓口・決定的プール）。
  const { assets: driveAssets } = useDriveAssets({ media: 'image', layers: PICKER_LAYERS });

  const [resultAssetId, setResultAssetId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0, depth: 0 });
  const [naturalDimensions, setNaturalDimensions] = React.useState({ width: 0, height: 0, depth: 0 });
  const [rotX, setRotX] = React.useState(0);
  const [rotY, setRotY] = React.useState(0);
  const [rotZ, setRotZ] = React.useState(0);
  const [isBaking, setIsBaking] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(false);

  const modelViewerRef = React.useRef<any>(null);
  const gizmoRef = React.useRef<HTMLDivElement>(null);

  const hasUnsavedEdits = Boolean(
    (dimensions.width && naturalDimensions.width && (
      dimensions.width !== Math.round(naturalDimensions.width) ||
      dimensions.depth !== Math.round(naturalDimensions.depth) ||
      dimensions.height !== Math.round(naturalDimensions.height) ||
      rotX !== 0 || rotY !== 0 || rotZ !== 0
    ))
  );

  const { getRemainingText, isModelLocked } = useAiModelLimits();

  const computedScale = useMemo(() => {
    if (!naturalDimensions.width) return { x: 1, y: 1, z: 1 };
    
    // Determine target dimensions in world space
    const targetW = Number(dimensions.width) || 1000;
    const targetD = Number(dimensions.depth) || 1000;
    const targetH = Number(dimensions.height) || 1000;
    
    // Natural dimensions are the raw bounding box size in local space
    const nw = naturalDimensions.width || 1;
    const nh = naturalDimensions.height || 1;
    const nd = naturalDimensions.depth || 1;
    
    // Create rotation matrix representing the object's orientation
    const rotMat = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(rotX),
        THREE.MathUtils.degToRad(rotY),
        THREE.MathUtils.degToRad(rotZ),
        'YXZ'
      )
    );
    
    // Determine how local axes (X, Y, Z) map to world axes after rotation
    const vX = new THREE.Vector3(1, 0, 0).applyMatrix4(rotMat);
    const vY = new THREE.Vector3(0, 1, 0).applyMatrix4(rotMat);
    const vZ = new THREE.Vector3(0, 0, 1).applyMatrix4(rotMat);
    
    // Project the target world dimensions onto the local axes
    // Use absolute values since scale should always be positive
    const targetLocalX = Math.abs(vX.x)*targetW + Math.abs(vX.y)*targetH + Math.abs(vX.z)*targetD;
    const targetLocalY = Math.abs(vY.x)*targetW + Math.abs(vY.y)*targetH + Math.abs(vY.z)*targetD;
    const targetLocalZ = Math.abs(vZ.x)*targetW + Math.abs(vZ.y)*targetH + Math.abs(vZ.z)*targetD;
    
    return {
      x: targetLocalX / nw,
      y: targetLocalY / nh,
      z: targetLocalZ / nd
    };
  }, [dimensions, naturalDimensions, rotX, rotY, rotZ]);

  // Simulate progress when status is running
  useEffect(() => {
    let interval: any;
    if (status === 'running' || busy) {
      interval = setInterval(() => {
        setProgress(p => (p < 99 ? p + 1 : 99));
      }, 300);
    } else if (status === 'done') {
      setProgress(100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [status, busy]);

  // Capture natural dimensions of the generated model
  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;
    
    const handleLoad = () => {
      if (viewer.getDimensions) {
        const size = viewer.getDimensions(); // {x, y, z} in meters
        const w = size.x * 1000;
        const h = size.y * 1000;
        const d = size.z * 1000;
        
        const safeW = w > 0 ? w : 1000;
        const safeH = h > 0 ? h : 1000;
        const safeD = d > 0 ? d : 1000;

        setNaturalDimensions({ width: safeW, height: safeH, depth: safeD });
        setDimensions({ width: Math.round(safeW), height: Math.round(safeH), depth: Math.round(safeD) });
      }
    };
    
    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [glbUrl, dimensions]);

  // Camera orbit listener for Gizmo
  useEffect(() => {
    const viewer = modelViewerRef.current;
    if (!viewer) return;
    const handleCameraChange = () => {
      if (viewer.getCameraOrbit && gizmoRef.current) {
        const orbit = viewer.getCameraOrbit();
        gizmoRef.current.style.transform = `rotateX(${orbit.phi - Math.PI/2}rad) rotateY(${-orbit.theta}rad)`;
      }
    };
    viewer.addEventListener('camera-change', handleCameraChange);
    return () => viewer.removeEventListener('camera-change', handleCameraChange);
  }, [glbUrl]);



  const handleLoadJob = async (job: AIJob) => {
    setUrlInput(job.inputImageUrl);
    setTaskId(job.id);
    setResultAssetId(job.resultAssetId || null);
    
    if (job.status === 'completed') {
      let finalUrl = job.glbUrl;
      if (!finalUrl && job.glbStoragePath) {
        try {
          finalUrl = await getDownloadURL(ref(storage, job.glbStoragePath));
        } catch (err) {
          console.error("Failed to fetch download URL:", err);
        }
      }
      setGlbUrl(finalUrl || null);
      setStatus('done');
    } else if (job.status === 'processing' || job.status === 'pending') {
      setStatus('running');
      setGlbUrl(null);
    } else {
      setStatus('error');
      setGlbUrl(null);
    }
  };

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
      // Reset state for new generation
      setTaskId(null);
      setResultAssetId(null);
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
    setResultAssetId(null);
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
        projectId: contextProjectId,
        workspaceId: contextWorkspaceId,
        autoPlace: false,
        imageHash: 'hash_' + Date.now()
      };
      
      const result = await requestAiGeneration(payload);
      const data = result.data as any;
      
      if (!data.success || !data.jobId) {
        throw new Error(data.message || "Failed to start generation job");
      }
      
      setTaskId(data.jobId);
      // onSnapshot listener will handle the 'completed' or 'failed' status
      
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
          setResultAssetId(jobData.resultAssetId || null);
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

  const handleBake = async () => {
    if (!glbUrl || !user || !taskId) return;
    setIsBaking(true);
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(glbUrl);

      // Wrapping in a group to preserve scene structure
      const wrapper = new THREE.Group();
      gltf.scene.scale.set(computedScale.x, computedScale.y, computedScale.z);
      
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotX),
        THREE.MathUtils.degToRad(rotY),
        THREE.MathUtils.degToRad(rotZ),
        'YXZ'
      );
      gltf.scene.setRotationFromEuler(euler);
      
      gltf.scene.updateMatrixWorld(true);
      wrapper.add(gltf.scene);

      const exporter = new GLTFExporter();
      const glbBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          wrapper,
          (result) => resolve(result as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        );
      });

      const { uploadBytes } = await import('firebase/storage');
      const { updateDoc, getDoc } = await import('firebase/firestore');
      
      const storageRef = ref(storage, `users/${user.uid}/generated_models/${taskId}_baked_${Date.now()}.glb`);
      await uploadBytes(storageRef, glbBuffer);
      const bakedUrl = await getDownloadURL(storageRef);

      const jobRef = doc(db, 'users', user.uid, 'aiJobs', taskId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        const data = jobSnap.data();
        const origUrl = data.originalModelUrl || data.glbUrl || null; 
        await updateDoc(jobRef, {
          originalModelUrl: origUrl,
          bakedModelUrl: bakedUrl,
          glbUrl: bakedUrl, 
          dimensionsMm: dimensions,
          orientation: { rotX, rotY, rotZ },
          bakedAt: new Date().toISOString(),
          canRevertToOriginal: true
        });
      }
      
      setGlbUrl(bakedUrl);
      setNaturalDimensions({ ...dimensions });
      setRotX(0);
      setRotY(0);
      setRotZ(0);
      setIsBaking(false);
      alert('変更をモデルに保存しました。');
    } catch(e) {
      console.error(e);
      alert('保存に失敗しました');
    } finally {
      setIsBaking(false);
    }
  };

  const handleDownload = (downloadUrl?: string) => {
    const url = downloadUrl || glbUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `model_${taskId}.glb`;
    a.click();
    
    // Log accepted
    logSaveDataEvent({
      userId: user?.uid || 'anonymous',
      actionType: 'PROPOSAL_ACCEPTED',
      context: {
        projectId: contextProjectId || undefined,
        workspaceId: contextWorkspaceId || undefined,
        targetType: '3d_model_generation',
        targetId: taskId || undefined,
        source: 'user',
        payload: { modelType: selectedModel, action: 'download', glbUrl: url }
      }
    });
  };

  const handleAddToWorkspace = async (job?: AIJob) => {
    const assetId = job?.resultAssetId || resultAssetId || taskId;
    if (!assetId || !contextProjectId || !contextWorkspaceId || !user) {
      alert('プロジェクトまたはワークスペースが選択されていません');
      return;
    }
    
    setBusy(true);
    try {
      const { collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');
      const itemRef = doc(collection(db, 'projects', contextProjectId, 'workspaces', contextWorkspaceId, 'items'));
      await setDoc(itemRef, {
        type: '3d_model',
        assetId: assetId,
        workspaceId: contextWorkspaceId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { 
            x: computedScale.x,
            y: computedScale.y,
            z: computedScale.z
          }
        },
        dimensions: {
          width: Number(dimensions.width) || 1000,
          depth: Number(dimensions.depth) || 1000,
          height: Number(dimensions.height) || 1000
        }
      });
      alert('ワークスペースに配置しました');
    } catch (e: any) {
      alert('配置に失敗しました: ' + e.message);
    } finally {
      setBusy(false);
    }

    logSaveDataEvent({
      userId: user?.uid || 'anonymous',
      actionType: 'PROPOSAL_ACCEPTED',
      context: {
        projectId: contextProjectId || undefined,
        workspaceId: contextWorkspaceId || undefined,
        targetType: '3d_model_generation',
        targetId: taskId || undefined,
        source: 'user',
        payload: { modelType: selectedModel, action: 'add_to_workspace', glbUrl }
      }
    });
  };

  const handleSaveToDrive = async (urlToSave?: string) => {
    const url = urlToSave || glbUrl;
    if (!url) return;
    
    try {
      setBusy(true);
      const res = await fetch(url, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `AI_Model_${taskId || Date.now()}.glb`, { type: 'model/gltf-binary' }) as any;
      
      // Pass AI generated flags and dimension info to UploadModal
      file.aiGenerated = true;
      file.aiPrompt = urlInput;
      file.dimensionsMm = {
        width: Math.round(dimensions.width),
        depth: Math.round(dimensions.depth),
        height: Math.round(dimensions.height)
      };
      // Keep the URL so the queue item can use it without regenerating
      file.url = url;

      setUploadFiles([file]);
      setUploadModalOpen(true);
    } catch (e: any) {
      alert("Failed to prepare model for upload: " + e.message);
    } finally {
      setBusy(false);
    }
    
    logSaveDataEvent({
      userId: user?.uid || 'anonymous',
      actionType: 'PROPOSAL_ACCEPTED',
      context: {
        projectId: contextProjectId || undefined,
        workspaceId: contextWorkspaceId || undefined,
        targetType: '3d_model_generation',
        targetId: taskId || undefined,
        source: 'user',
        payload: { modelType: selectedModel, action: 'save_to_drive', glbUrl: url }
      }
    });
  };

  const handleRejectProposal = () => {
    logSaveDataEvent({
      userId: user?.uid || 'anonymous',
      actionType: 'PROPOSAL_REJECTED',
      context: {
        projectId: contextProjectId || undefined,
        workspaceId: contextWorkspaceId || undefined,
        targetType: '3d_model_generation',
        targetId: taskId || undefined,
        source: 'user',
        payload: { modelType: selectedModel, reason: 'discard_by_user' }
      }
    });
    
    // UIのリセット
    reset3DStore();
    setUrlInput('');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', bgcolor: BRAND.bg }}>
      {/* Left Sidebar */}
      <Box sx={{ width: { xs: 240, md: 340 }, display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel, borderRight: `1px solid ${BRAND.line}`, flexShrink: 0, zIndex: 5, transition: 'width 0.2s' }}>
        {/* Sidebar Header */}
        <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 64 }}>
           <Typography variant="h6" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 'bold' }}>AI 3D Generate</Typography>
        </Box>
        
        {/* Sidebar Content */}
        <Box sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          
          {/* AI Model Selection Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

          {/* Input block */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              画像を選択して、AIモデルで3Dメッシュを自動生成します。
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                component="label"
                variant="outlined"
                size="large"
                fullWidth
                disabled={busy || status === 'running'}
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
                <input type="file" accept="image/*" hidden onChange={handleFromFile} />
              </Button>

              <Button
                variant="outlined"
                size="large"
                fullWidth
                disabled={busy || status === 'running'}
                onClick={() => setIsDrivePickerOpen(true)}
                startIcon={<CloudUploadRoundedIcon />}
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
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Action Buttons for generated model */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>アクション</Typography>
            <Button 
              size="large"
              variant="contained" 
              fullWidth 
              startIcon={<AddToPhotosRoundedIcon />}
              onClick={() => handleAddToWorkspace()}
              disabled={!glbUrl || hasUnsavedEdits}
              sx={{ textTransform: 'none', borderRadius: 2, bgcolor: BRAND.primary, color: 'var(--brand-fg)', '&:hover': { bgcolor: BRAND.primaryDark } }}
            >
              {hasUnsavedEdits ? '配置するには確定してください' : 'ワークスペースに配置'}
            </Button>
            <Button 
              size="large"
              variant="outlined" 
              fullWidth 
              startIcon={<CloudUploadRoundedIcon />}
              onClick={() => handleSaveToDrive()}
              disabled={!glbUrl || hasUnsavedEdits}
              sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}
            >
              {hasUnsavedEdits ? '保存するには確定してください' : 'S.Modelに保存'}
            </Button>
            <Button 
              size="large"
              variant="outlined" 
              fullWidth 
              startIcon={<DownloadRoundedIcon />}
              onClick={() => handleDownload()}
              disabled={!glbUrl || hasUnsavedEdits}
              sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'var(--brand-fg)' }}
            >
              {hasUnsavedEdits ? '保存するには確定してください' : 'ダウンロード'}
            </Button>

            {/* 一旦セパレータを入れて棄却ボタン */}
            <Box sx={{ my: 1, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
            <Button 
              size="large"
              variant="text" 
              fullWidth 
              startIcon={<DeleteForeverRoundedIcon />}
              onClick={handleRejectProposal}
              disabled={!glbUrl && status !== 'done' && status !== 'error'}
              sx={{ textTransform: 'none', borderRadius: 2, color: '#e74c3c', '&:hover': { bgcolor: 'rgba(231,76,60,0.1)' } }}
            >
              この案を使わない（やり直す）
            </Button>
          </Box>

        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
         {/* Top Right Controls */}
         <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 1 }}>
            {glbUrl && (
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => setAutoRotate(!autoRotate)}
                sx={{ bgcolor: 'rgba(20,22,27,0.7)', color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', '&:hover': { bgcolor: 'rgba(20,22,27,0.9)' } }}
              >
                {autoRotate ? '回転を止める' : '回転を再開'}
              </Button>
            )}
            <IconButton 
              onClick={() => setAI3DCreateExpanded(false)}
              sx={{ bgcolor: 'rgba(20,22,27,0.7)', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, '&:hover': { bgcolor: 'rgba(20,22,27,0.9)' } }}
            >
              <CloseFullscreenRoundedIcon />
            </IconButton>
         </Box>
         
         {/* Viewer Header Info (Status) */}
         <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
            {(taskId || busy) && (
              <Box sx={{ bgcolor: 'rgba(20,22,27,0.7)', color: status === 'done' ? '#66bb6a' : '#3498db', px: 2, py: 1, borderRadius: 2, border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {status !== 'error' && status !== 'done' && <CircularProgress size={16} sx={{ color: 'inherit' }} />}
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{status.toUpperCase()}</Typography>
              </Box>
            )}
         </Box>

         {/* Inner Viewer Layout */}
         <Box sx={{ flexGrow: 1, p: 4, display: 'flex', flexDirection: 'column' }}>
           <Box sx={{ flexGrow: 1, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 4, overflow: 'hidden', position: 'relative', border: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`, boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)' }}>
              {glbUrl ? (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flexGrow: 1, minHeight: 0, position: 'relative' }}>
                    {/* @ts-ignore */}
                    <model-viewer
                      ref={modelViewerRef}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        background: 'transparent',
                        cursor: 'grab'
                      }}
                      src={glbUrl}
                      camera-controls
                      {...(autoRotate ? { 'auto-rotate': true } : {})}
                      shadow-intensity="1"
                      exposure="1.05"
                      environment-image="neutral"
                      orientation={`${rotZ}deg ${rotX}deg ${rotY}deg`}
                      scale={`${computedScale.x} ${computedScale.y} ${computedScale.z}`}
                    >
                    </model-viewer>

                    {/* Axis Gizmo Overlay */}
                    <Box sx={{
                      position: 'absolute', bottom: 16, left: 16, width: 60, height: 60,
                      perspective: '1000px', pointerEvents: 'none', zIndex: 20
                    }}>
                      <div ref={gizmoRef} style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(0rad) rotateY(0rad)`
                      }}>
                        {/* X Axis (Red, Width, Right: CSS +X) */}
                        <div style={{ position: 'absolute', width: 25, height: 2, background: '#ff3333', transformOrigin: '0 50%', transform: 'translate(0, -1px)' }}>
                          <div style={{ position: 'absolute', right: -4, top: -3, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid #ff3333' }} />
                          <span style={{ position: 'absolute', right: -16, top: -8, color: '#ff3333', fontSize: 10, fontWeight: 'bold', whiteSpace: 'nowrap' }}>X</span>
                        </div>
                        {/* Y Axis (Green, Depth, Into screen: CSS -Z, rotateX(90deg)) */}
                        <div style={{ position: 'absolute', width: 2, height: 25, background: '#33ff33', transformOrigin: '50% 0%', transform: 'translate(-1px, 0) rotateX(90deg)' }}>
                          <div style={{ position: 'absolute', bottom: -4, left: -2.5, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #33ff33' }} />
                          <span style={{ position: 'absolute', bottom: -14, left: -14, color: '#33ff33', fontSize: 10, fontWeight: 'bold', transform: 'rotateX(-90deg)', whiteSpace: 'nowrap' }}>Y(正面)</span>
                        </div>
                        {/* Z Axis (Blue, Height, UP: CSS -Y) */}
                        <div style={{ position: 'absolute', width: 2, height: 25, background: '#3366ff', transformOrigin: '50% 100%', transform: 'translate(-1px, -25px)' }}>
                          <div style={{ position: 'absolute', top: -4, left: -2.5, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid #3366ff' }} />
                          <span style={{ position: 'absolute', top: -14, left: -3, color: '#3366ff', fontSize: 10, fontWeight: 'bold' }}>Z</span>
                        </div>
                      </div>
                    </Box>

                  </Box>

                  <Box sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 }, alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontWeight: 'bold', mr: { xs: 0, sm: 1 }, whiteSpace: 'nowrap' }}>モデルのサイズ (mm):</Typography>
                      <TextField 
                        size="small" 
                        label="W (幅 / X)" 
                        type="number" 
                        value={dimensions.width}
                        onChange={e => setDimensions(d => ({ ...d, width: Number(e.target.value) }))}
                        sx={{ width: { xs: 80, sm: 110 }, '& .MuiInputBase-root': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                      />
                      <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>×</Typography>
                      <TextField 
                        size="small" 
                        label="D (奥行 / Y)" 
                        type="number" 
                        value={dimensions.depth}
                        onChange={e => setDimensions(d => ({ ...d, depth: Number(e.target.value) }))}
                        sx={{ width: { xs: 80, sm: 110 }, '& .MuiInputBase-root': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                      />
                      <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>×</Typography>
                      <TextField 
                        size="small" 
                        label="H (高さ / Z)" 
                        type="number" 
                        value={dimensions.height}
                        onChange={e => setDimensions(d => ({ ...d, height: Number(e.target.value) }))}
                        sx={{ width: { xs: 80, sm: 110 }, '& .MuiInputBase-root': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Button variant="outlined" size="small" onClick={() => {
                        setRotX(r => (r + 90) % 360);
                        setDimensions(d => ({ ...d, depth: d.height, height: d.depth }));
                      }} sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', color: 'var(--brand-fg)', whiteSpace: 'nowrap' }}>
                        X軸回転(幅)
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => {
                        setRotZ(r => (r + 90) % 360);
                        setDimensions(d => ({ ...d, width: d.height, height: d.width }));
                      }} sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', color: 'var(--brand-fg)', whiteSpace: 'nowrap' }}>
                        Y軸回転(奥行)
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => {
                        setRotY(r => (r + 90) % 360);
                        setDimensions(d => ({ ...d, width: d.depth, depth: d.width }));
                      }} sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', color: 'var(--brand-fg)', whiteSpace: 'nowrap' }}>
                        Z軸回転(高さ)
                      </Button>
                      <Button 
                        variant="contained" 
                        size="small" 
                        onClick={handleBake} 
                        disabled={!hasUnsavedEdits || isBaking} 
                        sx={{ ml: { xs: 0, sm: 2 }, whiteSpace: 'nowrap', bgcolor: BRAND.primary, '&:hover': { bgcolor: BRAND.primaryDark } }}
                      >
                        {isBaking ? '処理中...' : '確定'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              ) : urlInput ? (
                <Box sx={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                  <img src={urlInput} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, opacity: (busy || status === 'running') ? 0.3 : 1, transition: 'opacity 0.3s' }} />
                  {!(busy || status === 'running') && (
                    <IconButton 
                      size="large"
                      onClick={() => {
                        setUrlInput('');
                        setImageUrl(null);
                        setPendingScreenshot(null);
                      }}
                      sx={{ 
                        position: 'absolute', 
                        top: 24, 
                        right: 24, 
                        bgcolor: 'rgba(0,0,0,0.6)', 
                        backdropFilter: 'blur(10px)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } 
                      }}
                    >
                      <CloseRoundedIcon fontSize="large" sx={{ color: 'var(--brand-fg)' }} />
                    </IconButton>
                  )}
                  
                  {(busy || status === 'running') && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 2, textAlign: 'center' }}>
                       <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                         <CircularProgress variant="determinate" value={progress} size={64} sx={{ color: '#00BFFF' }} />
                         <Box
                           sx={{
                             top: 0,
                             left: 0,
                             bottom: 0,
                             right: 0,
                             position: 'absolute',
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                           }}
                         >
                           <Typography variant="caption" component="div" sx={{ color: 'var(--brand-fg)', fontWeight: 'bold', fontSize: 14 }}>
                             {Math.round(progress)}%
                           </Typography>
                         </Box>
                       </Box>
                       <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, fontSize: { xs: 14, sm: 16 } }}>AIモデル生成中...</Typography>
                       <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: { xs: 11, sm: 13 } }}>完了まで数十秒〜数分かかる場合があります</Typography>
                    </Box>
                  )}
                  {!(busy || status === 'running') && (
                     <Box sx={{ position: 'absolute', bottom: { xs: 20, md: 40 }, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.8)', px: { xs: 2, sm: 4 }, py: { xs: 1.5, sm: 2 }, borderRadius: 8, backdropFilter: 'blur(10px)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: { xs: 1.5, sm: 4 }, width: 'max-content', maxWidth: '90%' }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontSize: { xs: 13, sm: 15 }, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>ベース画像が選択されました</Typography>
                        <Button 
                          variant="outlined" 
                          size="large"
                          onClick={() => {
                            setUrlInput('');
                            setImageUrl(null);
                            setPendingScreenshot(null);
                          }}
                          sx={{ 
                            borderRadius: 2, 
                            textTransform: 'none', 
                            px: { xs: 2, sm: 4 }, 
                            fontWeight: 'bold',
                            borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                            color: 'var(--brand-fg)',
                            whiteSpace: 'nowrap',
                            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderColor: '#fff' }
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button 
                          variant="contained" 
                          size="large" 
                          onClick={handleFromUrl} 
                          startIcon={<AutoFixHighRoundedIcon />}
                          sx={{ 
                            borderRadius: 2, 
                            textTransform: 'none', 
                            px: { xs: 2, sm: 4 }, 
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            background: 'linear-gradient(90deg, #3498db, #9b59b6)',
                            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
                            '&:hover': { background: 'linear-gradient(90deg, #2980b9, #8e44ad)' }
                          }}
                        >
                          ✨ 生成を開始する
                        </Button>
                     </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.3)', gap: 2 }}>
                  <ViewInArRoundedIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                  <Typography variant="body1">モデルはまだ生成されていません</Typography>
                  <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)' }}>左側のパネルから画像をアップロードしてAI生成を開始してください</Typography>
                </Box>
              )}
           </Box>
         </Box>

      </Box>
      
      {/* AI Drive Image Picker Dialog */}
      <Dialog 
        open={isDrivePickerOpen} 
        onClose={() => setIsDrivePickerOpen(false)}
        maxWidth="xl"
        fullWidth
        sx={{ zIndex: 99999 }}
        PaperProps={{
          sx: {
            height: '90vh',
            bgcolor: 'var(--brand-surface)',
            borderRadius: 3,
            overflow: 'hidden',
            backgroundImage: 'none',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)'
          }
        }}
      >
        <AIDriveFullScreen 
          isPickerMode={true} 
          onPickAsset={async (asset) => {
            if (asset.storageUrl || asset.thumbnailUrl) {
              const url = asset.storageUrl || asset.thumbnailUrl || '';
              setUrlInput(url);
              setIsDrivePickerOpen(false);
              setTaskId(null);
              setResultAssetId(null);
              setStatus('idle');
              setGlbUrl(null);
            }
          }}
          onClosePicker={() => setIsDrivePickerOpen(false)}
        />
      </Dialog>
      
      {/* Upload Modal (3DSS Integration) */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)}>
        {/* @ts-ignore */}
        <UploadModalContent open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} initialFiles={uploadFiles} />
      </Modal>

      {/* Right Sidebar for History */}
      <AI3DHistorySidebar 
        selectedJobId={taskId}
        onSelectJob={handleLoadJob}
        onRetryJob={(job) => startGeneration(job.inputImageUrl)}
        onSaveTo3DSS={(job) => {
          handleLoadJob(job);
          handleSaveToDrive(job.glbUrl || job.glbStoragePath);
        }}
        onDownload={(job) => {
          handleLoadJob(job);
          handleDownload(job.glbUrl || job.glbStoragePath);
        }}
      />
    </Box>
  );
};

export default AI3DCreateFullScreen;
