import React, { useState } from 'react';
import { Box, Typography, TextField, InputAdornment, IconButton, Paper, Stack, CircularProgress } from '@mui/material';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { WorkspaceTabBar } from '../shared/layout/workspace/WorkspaceTabBar';
import { BRAND } from '../styles/theme';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { useCoreOrchestrator } from '../store/useCoreOrchestrator';
import { useActionRegistry } from '../store/useActionRegistry';
import { GalleryStrip } from '../features/gallery/GalleryStrip';

const GlobalAppHub: React.FC = () => {
  const [q, setQ] = useState('');
  
  const { setCurrentMainView, setActiveProjectId, setActiveWorkspaceId, projects, setProjects, isInitialized } = useAppStore();
  const { currentUser } = useAuthStore();
  const { sendMessageToOrchestrator, isProcessing } = useCoreOrchestrator();

  React.useEffect(() => {
    if (currentUser && !isInitialized) {
      fetchUserProjects(currentUser.uid).then(fetchedProjects => {
        setProjects(fetchedProjects);
      });
    }
  }, [currentUser, isInitialized, setProjects]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || isProcessing || !currentUser) return;

    const input = q.trim();
    setQ(''); // Clear immediately for better UX
    
    try {
      const result = await sendMessageToOrchestrator(input, { source: 'dashboard_chat' });
      
      // Dispatch whatever action was returned from the Orchestrator
      if (result.actionType && result.actionType !== 'NONE') {
        await useActionRegistry.getState().dispatch(result.actionType, result.payload);
      }
    } catch (error) {
      console.error("Failed to process Dashboard Input via Orchestrator:", error);
    }
  };

  const hasNoProjects = isInitialized && projects.length === 0;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg, color: BRAND.text }}>
      <WorkspaceTabBar />
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: { xs: 4, md: 8 },
        py: 10
      }}>
      <Box sx={{ width: '100%', maxWidth: 900, textAlign: 'center', mb: 8 }}>
        <Typography sx={{ color: BRAND.sub2, letterSpacing: 4, fontWeight: 700, fontSize: '0.85rem', mb: 2 }}>
          すべてのプロジェクト基盤として
        </Typography>
        
        <Typography variant="h2" sx={{ fontWeight: 900, mb: 3, letterSpacing: 2, color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
          SEKKEIYA
        </Typography>

        <Typography sx={{ color: BRAND.sub, fontSize: '1.1rem', mb: 6, lineHeight: 1.8 }}>
          3Dモデル管理、レイアウト、プレゼンテーション資料作成まで。<br />
          SEKKEIYAは統合ツールをサポートします。
        </Typography>

        {hasNoProjects && (
          <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(0, 191, 255, 0.05)', border: '1px solid rgba(0, 191, 255, 0.2)', borderRadius: 4 }}>
            <Typography sx={{ color: '#00BFFF', fontWeight: 800, mb: 1, fontSize: '1.1rem' }}>
              はじめに、あなたの最初のプロジェクトを作成しましょう！
            </Typography>
            <Typography sx={{ color: BRAND.sub2 }}>
              下のバーに「〇〇というプロジェクトを作成して」と入力してみてください。
            </Typography>
          </Box>
        )}

        {/* Global Action Search Input */}
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ width: '100%', maxWidth: 640, mx: 'auto', mb: 4 }}>
          <TextField
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={isProcessing}
            placeholder={hasNoProjects ? "例: 「初めての家」というプロジェクトを作成して" : "例：延べ床面積100㎡の住宅プランを提案して"}
            inputProps={{
              style: { color: BRAND.text, caretColor: "rgba(255,255,255,0.92)" },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Stack direction="row" spacing={1} sx={{ pl: 0.25, alignItems: "center" }}>
                    <IconButton size="small" disabled={isProcessing} sx={{ width: 34, height: 34, bgcolor: "rgba(255,255,255,0.07)", border: `1px solid ${BRAND.line}`, "&:hover": { bgcolor: "rgba(255,255,255,0.12)" }}}>
                      <AddRoundedIcon fontSize="small" sx={{ color: BRAND.text }} />
                    </IconButton>
                    <IconButton size="small" disabled={isProcessing} sx={{ width: 34, height: 34, bgcolor: "rgba(255,255,255,0.07)", border: `1px solid ${BRAND.line}`, "&:hover": { bgcolor: "rgba(255,255,255,0.12)" }}}>
                      <AttachFileRoundedIcon fontSize="small" sx={{ color: BRAND.text }} />
                    </IconButton>
                  </Stack>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: 0.25 }}>
                    <IconButton type="submit" disabled={isProcessing || !q.trim()} size="small" sx={{ width: 34, height: 34, bgcolor: "rgba(255,255,255,0.12)", border: `1px solid ${BRAND.line}`, "&:hover": { bgcolor: "rgba(255,255,255,0.16)" }}}>
                      {isProcessing ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardRoundedIcon fontSize="small" sx={{ color: BRAND.text }} />}
                    </IconButton>
                  </Stack>
                </InputAdornment>
              ),
              sx: {
                minHeight: 64,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BRAND.line}`,
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                backdropFilter: "blur(20px)",
                px: 1,
                "& .MuiInputBase-input": { color: BRAND.text, fontSize: '1.1rem' },
                "& .MuiInputBase-input::placeholder": { color: BRAND.sub2, opacity: 1 },
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                transition: "box-shadow 140ms ease, border-color 140ms ease, background 140ms ease",
              },
              "& .MuiOutlinedInput-root.Mui-focused": {
                borderColor: BRAND.line2,
                boxShadow: `0 0 0 3px ${BRAND.glow}`,
                background: "rgba(255,255,255,0.08)",
              }
            }}
          />
        </Box>
      </Box>

      {/* User Projects List + 発見の帯 */}
      <Box sx={{ width: '100%', maxWidth: 1000 }}>
        {projects.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
            {projects.map(project => {
              const hue = [...(project.name || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
              return (
                <Paper
                  key={project.id}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setActiveWorkspaceId(null);
                    setCurrentMainView('workspace');
                  }}
                  sx={{
                    p: 3,
                    bgcolor: BRAND.panel,
                    borderRadius: 3,
                    border: `1px solid ${BRAND.line}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                    }
                  }}
                >
                  <IconButton 
                    size="small" 
                    sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>

                  <Box sx={{ 
                    width: 44, height: 44, borderRadius: 2, 
                    bgcolor: `hsl(${hue}, 50%, 20%)`,
                    border: `1px solid hsl(${hue}, 50%, 30%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                  }}>
                    <FolderRoundedIcon sx={{ fontSize: 20, color: `hsl(${hue}, 80%, 70%)` }} />
                  </Box>

                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                    {project.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontWeight: 500 }}>
                    Last updated recently
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* 公開成果物の発見ストリップ（landing は対話が主役、ここで Gallery への導線だけ滲ませる） */}
        <GalleryStrip />
      </Box>
    </Box>
    </Box>
  );
};

export default GlobalAppHub;
