import React, { useState } from 'react';
import { Box, Typography, TextField, IconButton, Avatar, Paper, List, ListItem, ListItemText, Divider, useMediaQuery } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { usePanelTheme } from '../../theme/ThemeContext.jsx';

export default function ChatWorkspace() {
  const BRAND = usePanelTheme();
  
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: 'こんにちは！AI Workspaceです。どのようなお手伝いができますか？', agent: 'Agent' }
  ]);
  const isMobile = useMediaQuery('(max-width:900px)');
  const isTablet = useMediaQuery('(max-width:1200px)');

  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: 'モックからの返答です。コンテキストに応じた適切な処理を行います。', agent: 'Agent' }]);
    }, 1000);
  };

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
          <ListItem sx={{ borderRadius: 1, mb: 0.5, bgcolor: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>
            <ListItemText primary="新しいチャット" primaryTypographyProps={{ fontSize: 13, fontWeight: "bold", color: "#fff" }} />
          </ListItem>
          <Divider sx={{ my: 1, opacity: 0.2 }} />
          <ListItem sx={{ borderRadius: 1, mb: 0.5, cursor: 'pointer' }}>
            <ListItemText primary="過去のボード解析" secondary="昨日" primaryTypographyProps={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }} secondaryTypographyProps={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
          </ListItem>
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
        alignItems: 'center', // Center content
      }}>
        
        {/* スレッド領域ラッパー: 指定幅で中央配置 */}
        <Box sx={{ 
          width: '100%', 
          maxWidth: 980, 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          height: '100%',
          position: 'relative' 
        }}>
        
        {/* 3カラム中央のヘッダー (水平整列とタイトル) */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2, 
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          width: '100%'
        }}>
          <Typography variant="subtitle1" fontWeight="bold">Active Chat: Onboarding Assistant</Typography>
          <Paper sx={{ px: 2, py: 0.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.4)', border: `1px solid rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#2ecc71' }} />
            <Typography variant="caption" color="text.secondary">Context: Main Architecture</Typography>
          </Paper>
        </Box>

        {/* 3. メッセージ表示エリア */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{m.text}</Typography>
              </Box>
            </Box>
          ))}
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
            />
            <IconButton onClick={handleSend} disabled={!input.trim()} sx={{ mb: 0.5, color: input.trim() ? '#3498db' : 'rgba(255,255,255,0.2)' }}>
              <SendRoundedIcon />
            </IconButton>
          </Paper>
        </Box>
        
        </Box> {/* End スレッド領域ラッパー */}
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
