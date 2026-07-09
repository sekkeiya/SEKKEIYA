import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper, Divider, Button, TextField, IconButton } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND } from '../../styles/theme';
import { launchWorkspace } from '../../features/launcher/launchWorkspace';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

const AIPanel: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [chatText, setChatText] = useState("");
  const { getActiveProject, getActiveWorkspace, lastLaunchPayload } = useAppStore();
  const { currentUser } = useAuthStore();
  
  const activeProject = getActiveProject();
  const activeWorkspace = getActiveWorkspace();

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    console.log("Send Message:", chatText);
    setChatText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,24,32,0.85)', backdropFilter: 'blur(24px)' }}>
      <Tabs 
        variant="fullWidth" 
        value={tabIndex} 
        onChange={(_, val) => setTabIndex(val)}
        sx={{ 
          minHeight: 48, 
          pt: 1,
          '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          '& .MuiTab-root': {
            color: 'rgba(255,255,255,0.5)',
            minHeight: 40,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: 14,
            '&.Mui-selected': { color: '#fff' }
          }
        }}
      >
        <Tab label="AI Chat" />
        <Tab label="AI Drive" />
      </Tabs>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      
      {/* Scrollable Main Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* Context Headway */}
        <Box sx={{ p: 2, flexShrink: 0 }}>
          <Paper elevation={0} sx={{ 
            p: 2, 
            bgcolor: 'rgba(255,255,255,0.03)', 
            border: `1px solid ${BRAND.line}`, 
            borderRadius: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <Typography variant="caption" sx={{ mb: 1, color: BRAND.sub, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block' }}>
              Current Context
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              User: {currentUser ? currentUser.email : 'Not Logged In'}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Project: {activeProject ? activeProject.name : 'None'}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Workspace: {activeWorkspace ? activeWorkspace.name : 'None (Home view)'}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Status: {activeWorkspace ? <span style={{color:'#66bb6a', fontWeight:'bold'}}>🟢 App Runtime</span> : <span style={{color:'#9e9e9e'}}>⚪ Hub Mode</span>}
            </Typography>
            {lastLaunchPayload && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', border: `1px dashed rgba(255,255,255,0.1)`, borderRadius: 2 }}>
                <Typography variant="caption" display="block" color="primary.light" fontWeight="bold">
                  Scope: {lastLaunchPayload.appScope}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                  wsId: {lastLaunchPayload.workspaceId}
                </Typography>
                {!activeWorkspace && (
                  <Button 
                    variant="contained"
                    size="small" 
                    onClick={() => launchWorkspace(lastLaunchPayload)}
                    sx={{ mt: 1.5, width: '100%', textTransform: 'none', fontSize: '0.75rem', bgcolor: 'primary.main', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                    Resume Workspace
                  </Button>
                )}
              </Box>
            )}
          </Paper>
        </Box>

        {/* Content Area */}
        <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {tabIndex === 0 && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
              <Typography variant="body2">
                AIアシスタントの準備が完了しました。
              </Typography>
              <Typography variant="caption" sx={{ mt: 1 }}>
                (Chat Message Stream Placeholder)
              </Typography>
            </Box>
          )}
          
          {tabIndex === 1 && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, px: 2, py: 1, border: `1px solid ${BRAND.line}`, '&:hover': { borderColor: 'rgba(255,255,255,0.3)' } }}>
                <SearchRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)', mr: 1, fontSize: 20 }} />
                <TextField 
                  placeholder="Search Drive Assets..."
                  variant="standard"
                  fullWidth
                  InputProps={{ disableUnderline: true, sx: { color: '#fff', fontSize: '0.9rem' } }}
                />
              </Box>
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
                <Typography variant="caption">
                  (Drive Asset Grid Placeholder)
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

      </Box>

      {/* Input Area (Only for Chat) */}
      {tabIndex === 0 && (
        <Box 
          component="form" 
          onSubmit={handleChatSubmit}
          sx={{ 
            p: 2, 
            bgcolor: BRAND.panel,
            borderTop: `1px solid ${BRAND.line}`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            flexShrink: 0
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="アシスタントにメッセージを送信..."
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0,0,0,0.3)',
                color: BRAND.text,
                borderRadius: 2,
                '& fieldset': { borderColor: BRAND.line },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              }
            }}
          />
          <IconButton 
            type="submit" 
            disabled={!chatText.trim()}
            sx={{ 
              bgcolor: chatText.trim() ? 'primary.main' : 'rgba(255,255,255,0.05)',
              color: chatText.trim() ? '#000' : 'rgba(255,255,255,0.3)',
              borderRadius: 2,
              p: 1.25,
              '&:hover': {
                bgcolor: chatText.trim() ? 'primary.dark' : 'rgba(255,255,255,0.05)',
              }
            }}
          >
            <SendRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default AIPanel;
