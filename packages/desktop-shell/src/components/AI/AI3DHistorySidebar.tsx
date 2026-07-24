import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardMedia, Chip, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { collection, query, orderBy, limit, onSnapshot, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuth } from '../../features/dsl/layout/hooks/useAuthProxy';
import { BRAND } from '../../styles/theme';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

export interface AIJob {
  id: string;
  isAsset?: boolean;
  type: string;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  inputImageUrl: string;
  glbStoragePath?: string;
  glbUrl?: string;
  resultAssetId?: string;
  errorMessage?: string;
  createdAt: any;
}

interface AI3DHistorySidebarProps {
  onSelectJob: (job: AIJob) => void;
  onRetryJob: (job: AIJob) => void;
  onSaveTo3DSS: (job: AIJob) => void;
  onDownload: (job: AIJob) => void;
  selectedJobId: string | null;
}

const AI3DHistorySidebar: React.FC<AI3DHistorySidebarProps> = ({ 
  onSelectJob, onRetryJob, onSaveTo3DSS, onDownload, selectedJobId 
}) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<AIJob[]>([]);
  const [completedAssets, setCompletedAssets] = useState<AIJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    setLoadingJobs(true);
    setLoadingAssets(true);
    
    // 1. aiJobs listener (processing, failed)
    const jobsRef = collection(db, 'users', user.uid, 'aiJobs');
    const jobsQ = query(
      jobsRef,
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubJobs = onSnapshot(jobsQ, (snapshot) => {
      const fetched: AIJob[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'image_to_3d' && ['pending', 'processing', 'failed'].includes(data.status)) {
          fetched.push({ id: doc.id, ...data } as AIJob);
        }
      });
      setActiveJobs(fetched);
      setLoadingJobs(false);
    }, (error) => {
      console.error("aiJobs query error:", error);
      setLoadingJobs(false);
    });

    // 2. assets listener (completed)
    const assetsRef = collection(db, 'assets');
    const assetsQ = query(
      assetsRef,
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubAssets = onSnapshot(assetsQ, (snapshot) => {
      const fetched: AIJob[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === '3d_model' && data.metadata?.source === 'ai_generated') {
          fetched.push({
            id: doc.id,
            isAsset: true,
            type: 'image_to_3d',
            provider: data.generation?.provider || data.metadata?.provider || 'unknown',
            status: 'completed',
            inputImageUrl: data.generation?.inputImageUrl || data.metadata?.originalImageUrl || '',
            glbStoragePath: data.storageUrl,
            glbUrl: data.storageUrl,
            resultAssetId: doc.id,
            createdAt: data.createdAt
          } as any);
        }
      });
      setCompletedAssets(fetched);
      setLoadingAssets(false);
    }, (error) => {
      console.error("assets query error:", error);
      setLoadingAssets(false);
    });

    return () => {
      unsubJobs();
      unsubAssets();
    };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'processing': return 'Processing';
      default: return 'Pending';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const handleDeleteJob = async (job: AIJob) => {
    if (!user) return;
    
    try {
      if (job.isAsset) {
        if (!window.confirm('このAssetを完全に削除しますか？')) return;
        const assetRef = doc(db, 'assets', job.id);
        await deleteDoc(assetRef);
      } else {
        const jobRef = doc(db, 'users', user.uid, 'aiJobs', job.id);
        await updateDoc(jobRef, {
          archived: true,
          archivedAt: serverTimestamp(),
          status: job.status === 'failed' ? 'archived' : 'cancelled'
        });
      }
    } catch (err) {
      console.error("Failed to delete/cancel job:", err);
      alert("処理に失敗しました");
    }
  };

  const renderCard = (job: AIJob) => {
    return (
      <Card 
        key={job.id} 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: selectedJobId === job.id ? 'rgba(144, 202, 249, 0.1)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
          border: `1px solid ${selectedJobId === job.id ? BRAND.primary : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': { borderColor: selectedJobId === job.id ? BRAND.primary : 'rgb(var(--brand-fg-rgb) / 0.3)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
        }}
        onClick={() => onSelectJob(job)}
      >
        <Box sx={{ display: 'flex', height: 80 }}>
          <CardMedia
            component="img"
            sx={{ width: 80, height: 80, objectFit: 'cover', bgcolor: 'rgba(0,0,0,0.5)' }}
            image={job.inputImageUrl}
            alt="Input image"
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', p: 1, flexGrow: 1, justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{formatDate(job.createdAt)}</Typography>
              <Chip 
                label={getStatusLabel(job.status)} 
                color={getStatusColor(job.status) as any} 
                size="small" 
                sx={{ height: 20, fontSize: '0.65rem' }} 
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', mt: 0.5, fontWeight: 500 }}>
              {job.provider}
            </Typography>
          </Box>
        </Box>
        
        {/* Actions Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))' }} onClick={(e) => e.stopPropagation()}>
          {job.status === 'completed' && (
            <>
              <Tooltip title="表示">
                <IconButton size="small" onClick={() => onSelectJob(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', '&:hover': { color: 'var(--brand-fg)' } }}>
                  <VisibilityRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="S.Modelに保存">
                <IconButton size="small" onClick={() => onSaveTo3DSS(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', '&:hover': { color: 'var(--brand-fg)' } }}>
                  <CloudUploadRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="ダウンロード">
                <IconButton size="small" onClick={() => onDownload(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', '&:hover': { color: 'var(--brand-fg)' } }}>
                  <DownloadRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="削除">
                <IconButton size="small" onClick={() => handleDeleteJob(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#e74c3c', bgcolor: 'rgba(231,76,60,0.1)' } }}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {job.status === 'failed' && (
            <>
              <Tooltip title="再試行">
                <IconButton size="small" onClick={() => onRetryJob(job)} sx={{ color: '#e74c3c', '&:hover': { bgcolor: 'rgba(231,76,60,0.1)' } }}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="削除">
                <IconButton size="small" onClick={() => handleDeleteJob(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#e74c3c', bgcolor: 'rgba(231,76,60,0.1)' } }}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {(job.status === 'processing' || job.status === 'pending') && (
            <Tooltip title="キャンセル">
              <IconButton size="small" onClick={() => handleDeleteJob(job)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#e74c3c', bgcolor: 'rgba(231,76,60,0.1)' } }}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Card>
    );
  };

  return (
    <Box sx={{ width: { xs: 240, md: 340 }, display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel, borderLeft: `1px solid ${BRAND.line}`, flexShrink: 0, zIndex: 5, transition: 'width 0.2s' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, minHeight: 64 }}>
        <Typography variant="h6" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 'bold' }}>生成済み Assets</Typography>
      </Box>

      {/* List */}
      <Box sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        
        {/* Processing / Failed Section */}
        {activeJobs.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block', fontWeight: 'bold' }}>生成中</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activeJobs.map(renderCard)}
            </Box>
          </Box>
        )}

        {/* Completed Assets Section */}
        <Box>
          <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block', fontWeight: 'bold' }}>生成済み</Typography>
          {(loadingJobs || loadingAssets) && completedAssets.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
          )}
          {!(loadingJobs || loadingAssets) && completedAssets.length === 0 && (
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', textAlign: 'center', mt: 4 }}>
              履歴がありません
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {completedAssets.map(renderCard)}
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

export default AI3DHistorySidebar;
