import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Avatar, Paper, List, ListItem, ListItemText, Divider, useMediaQuery, CircularProgress } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { usePanelTheme } from '../../theme/ThemeContext.jsx';
import useChatStore from './store/useChatStore';

export default function ChatWorkspace({ uid, db, functions }) {
  const BRAND = usePanelTheme();

  
  const isMobile = useMediaQuery('(max-width:900px)');
  const isTablet = useMediaQuery('(max-width:1200px)');

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const {
    threads,
    activeThreadId,
    messages,
    isLoading,
    init,
    selectThread,
    sendMessage,
    resetStore
  } = useChatStore();

  // Initialize store when component mounts or uid changes
  useEffect(() => {
    if (uid && db && functions) {
      init(uid, db, functions);
    } else {
      resetStore();
    }
  }, [uid, db, functions, init, resetStore]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !uid) return;
    sendMessage(input, uid);
    setInput('');
  };

  const handleNewChat = () => {
    selectThread(null, uid);
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <Box sx={{ display: 'flex', height: '100%', bgcolor: 'transparent', color: BRAND.text }}>
      
      {/* 1. 左側ナビゲーション (Navigator) */}
      {!isMobile && (
        <Box sx={{ 
          width: 260, 
          flexShrink: 0,
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRight: `1px solid rgba(255,255,255,0.08)`, 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto'
        }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#3498db' }} />
          <Typography variant="subtitle1" fontWeight="bold">AI Workspace</Typography>
        </Box>
        
        {/* エージェント切替 (雛形) */}
        <Box sx={{ p: 2, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Agent Persona</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.1)', border: `1px solid #3498db` }}><DashboardRoundedIcon fontSize="small" color="primary" /></Avatar>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', opacity: 0.5 }}><PrecisionManufacturingRoundedIcon fontSize="small" /></Avatar>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', opacity: 0.5 }}><ExtensionRoundedIcon fontSize="small" /></Avatar>
          </Box>
        </Box>

        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          <ListItem 
            onClick={handleNewChat}
            sx={{ 
              borderRadius: 1, 
              mb: 0.5, 
              bgcolor: !activeThreadId ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255,255,255,0.05)', 
              cursor: 'pointer',
              border: !activeThreadId ? '1px solid rgba(52, 152, 219, 0.4)' : '1px solid transparent'
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 18, mr: 1, color: !activeThreadId ? '#3498db' : '#fff' }} />
            <ListItemText primary="新しいチャット" primaryTypographyProps={{ fontSize: 13, fontWeight: "bold", color: !activeThreadId ? "#3498db" : "#fff" }} />
          </ListItem>
          <Divider sx={{ my: 1, opacity: 0.2 }} />
          
          {threads.length === 0 && !isLoading && (
             <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', fontSize: 12 }}>
               履歴はありません
             </Typography>
          )}

          {threads.map(thread => {
            const isSelected = thread.id === activeThreadId;
            return (
              <ListItem 
                key={thread.id}
                onClick={() => selectThread(thread.id, uid)}
                sx={{ 
                  borderRadius: 1, 
                  mb: 0.5, 
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                }}
              >
                <ListItemText 
                  primary={thread.title || "新規チャット"} 
                  secondary={thread.lastMessageText || "メッセージなし"} 
                  primaryTypographyProps={{ 
                    fontSize: 13, 
                    color: isSelected ? "#fff" : "rgba(255,255,255,0.9)",
                    fontWeight: isSelected ? 'bold' : 'normal',
                    noWrap: true
                  }} 
                  secondaryTypographyProps={{ 
                    fontSize: 11, 
                    color: "rgba(255,255,255,0.5)",
                    noWrap: true
                  }} 
                />
              </ListItem>
            )
          })}
        </List>
      </Box>
      )}

      {/* 2. メインチャットエリア (Workspace) */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative',
        bgcolor: 'transparent',
        alignItems: 'center',
      }}>
        
        <Box sx={{ 
          width: '100%', 
          maxWidth: 980, 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          height: '100%',
          position: 'relative' 
        }}>
        
        {/* 3カラム中央のヘッダー */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2, 
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          width: '100%'
        }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {activeThread ? activeThread.title : "New Chat"}
          </Typography>
          <Paper sx={{ px: 2, py: 0.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.4)', border: `1px solid rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#2ecc71' }} />
            <Typography variant="caption" color="text.secondary">Context: Main Architecture</Typography>
          </Paper>
        </Box>

        {/* 3. メッセージ表示エリア */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {isLoading && messages.length === 0 && (
             <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
               <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.5)' }} />
             </Box>
          )}

          {!activeThreadId && messages.length === 0 && (
             <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 48, mb: 2, color: '#3498db' }} />
                <Typography variant="h6">何かお手伝いしましょうか？</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>下の入力欄から質問するか、左から過去の会話を選んでください。</Typography>
             </Box>
          )}

          {messages.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', gap: 2, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {m.role === 'assistant' && (
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#3498db' }}><AutoAwesomeRoundedIcon fontSize="small" /></Avatar>
              )}
              <Box sx={{ 
                p: 2, 
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                bgcolor: m.role === 'user' ? 'rgba(41, 128, 185, 0.2)' : 'rgba(255,255,255,0.03)',
                border: m.role === 'user' ? '1px solid rgba(41, 128, 185, 0.4)' : `1px solid rgba(255,255,255,0.08)`
              }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {m.text}
                  {m.status === 'streaming' && (
                    <Box component="span" sx={{ 
                      display: 'inline-block', 
                      width: 8, 
                      height: 16, 
                      bgcolor: 'rgba(255,255,255,0.7)', 
                      ml: 0.5, 
                      verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite',
                      '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } }
                    }} />
                  )}
                </Typography>
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* 4. 入力欄 */}
        <Box sx={{ p: 2, pb: 4, display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Paper sx={{ 
            width: '100%', 
            maxWidth: 800, 
            p: '4px 8px', 
            display: 'flex', 
            alignItems: 'flex-end',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 3,
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 24px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            '&:focus-within': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.2)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.08), 0 6px 32px rgba(0,0,0,0.3)',
              transform: 'translateY(-1px)'
            }
          }}>
            <TextField
              fullWidth
              multiline
              maxRows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="AI に質問する..."
              variant="standard"
              InputProps={{ disableUnderline: true, sx: { color: BRAND.text, py: 1, pl: 1, fontSize: 14 } }}
              disabled={!uid}
            />
            <IconButton onClick={handleSend} disabled={!input.trim() || !uid} sx={{ mb: 0.5, color: input.trim() && uid ? '#3498db' : 'rgba(255,255,255,0.2)' }}>
              <SendRoundedIcon />
            </IconButton>
          </Paper>
        </Box>
        
        </Box>
      </Box>

      {/* 3. コンテキストパネル (ContextPanel) */}
      {!isTablet && (
        <Box sx={{ 
          width: 320, 
          flexShrink: 0,
          borderLeft: `1px solid rgba(255,255,255,0.08)`,
          bgcolor: 'rgba(255,255,255,0.02)',
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
            <Typography variant="subtitle2" fontWeight="bold">Context</Typography>
          </Box>
          
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Current Board */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Current Board</Typography>
              <Paper sx={{ p: 1.5, border: `1px solid rgba(255,255,255,0.08)`, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3498db' }} />
                  <Typography variant="body2">Main Architecture</Typography>
                </Box>
              </Paper>
            </Box>

            {/* Selected Items */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Selected Items</Typography>
              <Box sx={{ border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <ExtensionRoundedIcon sx={{ fontSize: 24, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: 13 }}>No items selected</Typography>
              </Box>
            </Box>

            {/* Attached Assets */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Attached Assets</Typography>
              <Box sx={{ border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <FolderRoundedIcon sx={{ fontSize: 24, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: 13 }}>No attachments</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

    </Box>
  );
}
