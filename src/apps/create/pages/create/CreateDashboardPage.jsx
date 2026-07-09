import React, { useState, useEffect } from 'react';
import { Box, Typography, Breadcrumbs, Link, Paper } from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { useQueryParams } from '../../shared/hooks/useQueryParams';
import { useCreateStore } from '../../store/useCreateStore';
import { tokens } from '../../shared/theme/tokens';

import GenerationInputPanel from '../../features/generation/components/GenerationInputPanel';
import GenerateActionBar from '../../features/generation/components/GenerateActionBar';
import GenerationStatusPanel from '../../features/generation/components/GenerationStatusPanel';
import GenerationPreviewPanel from '../../features/preview/components/GenerationPreviewPanel';
import SaveActionsPanel from '../../features/save/components/SaveActionsPanel';
import RecentGenerationsPanel from '../../features/history/components/RecentGenerationsPanel';

export default function CreateDashboardPage() {
  const queryParams = useQueryParams();
  const setSourceContext = useCreateStore((state) => state.setSourceContext);

  const navigate = useNavigate();
  const location = useLocation();
  const [resolvingBoard, setResolvingBoard] = useState(false);

  // Initialize context from query params
  useEffect(() => {
    setSourceContext({
      from: queryParams.from,
      projectId: queryParams.projectId,
      boardId: queryParams.boardId,
      autoInsertToBoard: queryParams.autoInsertToBoard,
    });
  }, [queryParams, setSourceContext]);

  // Project-Centric Architecture: If only projectId is present, fallback to default board
  useEffect(() => {
    if (queryParams.projectId && !queryParams.boardId) {
      let cancelled = false;
      const resolve = async () => {
        setResolvingBoard(true);
        try {
          const { resolveDefaultBoard } = await import('@sekkeiya/global-panel');
          // 3DSC usually populates "models" type board
          const board = await resolveDefaultBoard(queryParams.projectId, "models");
          if (!cancelled && board) {
            const nextParams = new URLSearchParams(location.search);
            nextParams.set('boardId', board.id);
            navigate({ search: nextParams.toString() }, { replace: true });
          }
        } catch(e) {
          console.error("Failed to resolve default board:", e);
        } finally {
          if (!cancelled) setResolvingBoard(false);
        }
      };
      resolve();
      return () => { cancelled = true; };
    }
  }, [queryParams.projectId, queryParams.boardId, navigate, location.search]);

  // Validate required state
  const isMissingProject = !queryParams.projectId;

  if (isMissingProject) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Typography variant="h6" color="text.secondary">
          No Project Selected
        </Typography>
        <Typography variant="body2" color="text.disabled">
          プロジェクトが選択されていません。SEKKEIYAのダッシュボードから起動してください。
        </Typography>
      </Box>
    );
  }

  if (resolvingBoard || (!queryParams.boardId && queryParams.projectId)) {
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          Loading create workspace...
        </Typography>
      </Box>
    );
  }

  // Debug Logging for valid rendering state
  console.log("[CreateDashboardPage] Rendering main dashboard view with state:", { projectId: queryParams.projectId, boardId: queryParams.boardId });

  return (
    <>
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${tokens.border.subtle}` }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} underline="hover" color="inherit" to="/">
              Home
            </Link>
            <Typography color="text.primary">Workspace</Typography>
          </Breadcrumbs>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            S.Create
          </Typography>
        </Box>

        {/* 3-Column Workspace */}
        <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', p: 2, gap: 2 }}>
          
          {/* Left Column: Generate Panel */}
          <Paper sx={{ 
            width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', 
            bgcolor: tokens.background.panel, 
            backdropFilter: 'blur(12px)',
            border: `1px solid ${tokens.border.subtle}`,
            overflow: 'hidden'
          }}>
            {/* Scrollable Form Area */}
            <Box sx={{ 
              flexGrow: 1, overflowY: 'auto', p: 2, pb: 4,
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: '10px' },
              '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.3)' }
            }}>
              <Box sx={{ p: 0, borderBottom: `1px solid ${tokens.border.subtle}`, mb: 2 }}> {/* Adjusted padding and removed gutterBottom/mb from Typography */}
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.secondary' }}>
                  プロンプト設定
                </Typography>
              </Box>
              <GenerationInputPanel />
            </Box>

            {/* Sticky CTA Area */}
            <Box sx={{ p: 2, borderTop: `1px solid ${tokens.border.subtle}`, bgcolor: 'rgba(0,0,0,0.2)' }}>
              <GenerateActionBar />
            </Box>
          </Paper>

          {/* Center Column: Stage / Preview */}
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <GenerationPreviewPanel />
          </Box>

          {/* Right Column: Status & Actions */}
          <Box sx={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <GenerationStatusPanel />
            <SaveActionsPanel />
            <RecentGenerationsPanel />
          </Box>
        </Box>
      </Box>
    </>
  );
}
