import React, { useState } from 'react';
import { Drawer, Box, IconButton, Tooltip, Typography, useMediaQuery, useTheme, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { BRAND } from '../../../theme/constants';
import { useAssistantStore } from '../store/useAssistantStore';
import { executeAIAction } from '../../../ai/executeAIAction';
import ChatView from './ChatView/ChatView';
import { useStrategyContextSummary } from '../../../api/strategyApi';

export const assistantDrawerWidth = 360;

const AssistantDrawer = ({ isOpen, onClose, projectId, boardId }) => {
  const { startNewThread, threads, activeThreadId, switchThread, deleteThread, setAiContext, currentBoardId, currentProjectId, markActionExecuted, dashboardActions } = useAssistantStore();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Phase 31: Fetch Read-Only Strategy Context Summary
  const { strategySummary } = useStrategyContextSummary(projectId);

  // Sync global context into AI context
  React.useEffect(() => {
    if (isOpen) {
      console.log("[AssistantDrawer] Entrance props:", { boardId, projectId, hasStrategy: !!strategySummary });
      setAiContext({ boardId, projectId, strategySummary });
    }
  }, [isOpen, boardId, projectId, strategySummary, setAiContext]);

  React.useEffect(() => {
    if (isOpen) {
      console.log("[AssistantDrawer] Store synced context:", { aiBoardId: currentBoardId, aiProjectId: currentProjectId });
    }
  }, [isOpen, currentBoardId, currentProjectId]);

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];

  // ==========================================
  // Phase 9/10: AI Action Execution
  // ==========================================
  React.useEffect(() => {
    if (!activeThread) return;
    
    activeThread.messages.forEach(msg => {
      // Phase 10: Array of actions
      if (msg.actions) {
        const unexecuted = msg.actions.filter(a => !a.isExecuted);
        if (unexecuted.length > 0) {
          executeAIAction(unexecuted, msg.context || {}, dashboardActions);
          unexecuted.forEach(a => markActionExecuted(msg.id, a.id));
        }
      } 
      // Legacy fallback (Phase 9 single action)
      else if (msg.action && !msg.action.isExecuted) {
        executeAIAction(msg.action, msg.context || {}, dashboardActions);
        markActionExecuted(msg.id, msg.action.id);
      }
    });

  }, [activeThread?.messages, dashboardActions, markActionExecuted]);

  const content = (
    <>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5, 
        borderBottom: `1px solid rgba(255,255,255,0.08)`,
        bgcolor: 'rgba(0,0,0,0.2)',
        flexShrink: 0
      }}>
        {/* Thread Selector / Dropdown */}
        <Box 
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            cursor: 'pointer',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
          }}
        >
          <ChatRoundedIcon fontSize="small" sx={{ color: BRAND.primary }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: BRAND.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeThread?.title || "AI Chat"}
          </Typography>
          <ExpandMoreRoundedIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.5)' }} />
        </Box>

        {/* Header Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="新規チャット">
            <IconButton onClick={startNewThread} sx={{ color: BRAND.text, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }} size="small">
              <AddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="閉じる">
            <IconButton onClick={onClose} sx={{ color: BRAND.text, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }} size="small">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Thread List Menu */}
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1A1D24',
            border: `1px solid ${BRAND.line}`,
            minWidth: 240,
            mt: 1,
            backgroundImage: 'none'
          }
        }}
        MenuListProps={{
          sx: { py: 0.5 }
        }}
      >
        {threads.map(thread => (
          <MenuItem 
            key={thread.id} 
            selected={thread.id === activeThreadId}
            onClick={() => {
              switchThread(thread.id);
              setAnchorEl(null);
            }}
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              gap: 2,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.1)' },
              '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.15)' }
            }}
          >
            <ListItemText 
              primary={thread.title} 
              primaryTypographyProps={{ variant: 'body2', noWrap: true, color: BRAND.text }} 
            />
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`「${thread.title}」を削除しますか？`)) {
                  deleteThread(thread.id);
                  if (threads.length <= 1) setAnchorEl(null);
                }
              }}
              sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: BRAND.error, bgcolor: 'rgba(255,0,0,0.1)' } }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </MenuItem>
        ))}
      </Menu>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <ChatView />
      </Box>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={onClose}
        variant="temporary"
        hideBackdrop={true} // Allow interaction
        PaperProps={{
          sx: {
            width: '100vw',
            bgcolor: 'rgba(20,24,32,0.85)',
            backdropFilter: 'blur(24px)',
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {content}
        </Box>
      </Drawer>
    );
  }

  // Desktop Flow: Animated Flex Box
  return (
    <Box 
      sx={{ 
        width: isOpen ? assistantDrawerWidth : 0, 
        flexShrink: 0, 
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        borderLeft: isOpen ? `1px solid rgba(255,255,255,0.12)` : 'none', 
        bgcolor: 'rgba(20,24,32,0.85)', 
        backdropFilter: 'blur(24px)',
        zIndex: 1100, // Make sure it sits above standard content if needed
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ width: assistantDrawerWidth, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {content}
      </Box>
    </Box>
  );
};

export default AssistantDrawer;
