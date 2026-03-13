import React, { useState } from 'react';
import { Box, Typography, TextField, IconButton, Avatar, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import { usePanelTheme } from '../../theme/ThemeContext.jsx';

export default function ChatWorkspace() {
  const BRAND = usePanelTheme();
  
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: 'こんにちは！AI Workspaceです。どのようなお手伝いができますか？', agent: 'Agent' }
  ]);
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
    <Box sx={{ display: 'flex', height: '100%', bgcolor: BRAND.bg, color: BRAND.text }}>
      
      {/* 1. 左側ナビゲーション (会話一覧 / エージェント切替) */}
      <Box sx={{ width: 260, borderRight: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${BRAND.line}` }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#3498db' }} />
          <Typography variant="subtitle1" fontWeight="bold">AI Workspace</Typography>
        </Box>
        
        {/* エージェント切替 (雛形) */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}` }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Agent Persona</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.1)', border: `1px solid #3498db` }}><DashboardRoundedIcon fontSize="small" color="primary" /></Avatar>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', opacity: 0.5 }}><PrecisionManufacturingRoundedIcon fontSize="small" /></Avatar>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', opacity: 0.5 }}><ExtensionRoundedIcon fontSize="small" /></Avatar>
          </Box>
        </Box>

        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          <ListItem button sx={{ borderRadius: 1, mb: 0.5, bgcolor: 'rgba(255,255,255,0.05)' }}>
            <ListItemText primary="新しいチャット" primaryTypographyProps={{ fontSize: 13, fontWeight: "bold" }} />
          </ListItem>
          <Divider sx={{ my: 1, opacity: 0.2 }} />
          <ListItem button sx={{ borderRadius: 1, mb: 0.5 }}>
            <ListItemText primary="過去のボード解析" secondary="昨日" primaryTypographyProps={{ fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
          </ListItem>
        </List>
      </Box>

      {/* 2. メインチャットエリア */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* コンテキスト表示スニペット (上部) */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, p: 1, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <Paper sx={{ px: 2, py: 0.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#2ecc71' }} />
            <Typography variant="caption" color="text.secondary">Current Context: None selected</Typography>
          </Paper>
        </Box>

        {/* 3. メッセージ表示エリア */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3, pt: 6 }}>
          {messages.map((m) => (
            <Box key={m.id} sx={{ display: 'flex', gap: 2, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {m.role === 'assistant' && (
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#3498db' }}><AutoAwesomeRoundedIcon fontSize="small" /></Avatar>
              )}
              <Box sx={{ 
                p: 2, 
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                bgcolor: m.role === 'user' ? BRAND.panel2 : 'rgba(255,255,255,0.03)',
                border: `1px solid ${BRAND.line}`
              }}>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{m.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* 4. 入力欄 */}
        <Box sx={{ p: 2, pb: 4, display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ 
            width: '100%', 
            maxWidth: 800, 
            p: '4px 8px', 
            display: 'flex', 
            alignItems: 'flex-end',
            bgcolor: BRAND.panel,
            border: `1px solid ${BRAND.line}`,
            borderRadius: 3
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
      </Box>

    </Box>
  );
}
