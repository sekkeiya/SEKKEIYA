import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, ListItemButton, IconButton, Typography, Box } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAIChatStore } from '../../store/useAIChatStore';
import { useAppStore } from '../../store/useAppStore';

interface ChatHistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

const ChatHistoryDialog: React.FC<ChatHistoryDialogProps> = ({ open, onClose }) => {
  const activeProject = useAppStore(s => s.getActiveProject());
  const projectId = activeProject?.id;

  const allSessions = useAIChatStore(s => s.sessions);
  const sessions = React.useMemo(() => {
    if (!projectId) return [];
    return allSessions
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allSessions, projectId]);

  const activeSessionId = useAIChatStore(s => s.activeSessionId);
  const setActiveSession = useAIChatStore(s => s.setActiveSession);
  const deleteSession = useAIChatStore(s => s.deleteSession);

  if (!projectId) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1a1f2b', color: '#fff', borderRadius: 2 } }}>
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
        <Typography component="span" variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>Chat History</Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>No past chats found for this project.</Typography>
          </Box>
        ) : (
          <List sx={{ pt: 0 }}>
            {sessions.map((session) => (
              <ListItem 
                key={session.id} 
                disablePadding 
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => deleteSession(session.id)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#f44336' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: '1.2rem' }} />
                  </IconButton>
                }
                sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <ListItemButton 
                  selected={session.id === activeSessionId}
                  onClick={() => {
                    setActiveSession(session.id);
                    onClose();
                  }}
                  sx={{ 
                    py: 1.5,
                    '&.Mui-selected': { bgcolor: 'rgba(138, 180, 248, 0.1)' },
                    '&.Mui-selected:hover': { bgcolor: 'rgba(138, 180, 248, 0.15)' },
                  }}
                >
                  <ListItemText 
                    primary={session.title} 
                    secondary={new Date(session.updatedAt).toLocaleString()}
                    primaryTypographyProps={{ sx: { fontSize: '0.85rem', fontWeight: 500, color: session.id === activeSessionId ? '#8ab4f8' : 'rgba(255,255,255,0.9)' } }}
                    secondaryTypographyProps={{ sx: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 1.5 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: '0.8rem' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChatHistoryDialog;
