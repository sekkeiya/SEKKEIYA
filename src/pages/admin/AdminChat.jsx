import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  IconButton, 
  Avatar, 
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button
} from '@mui/material';
import { 
  Send as SendIcon, 
  SmartToy as BotIcon, 
  Person as PersonIcon,
  ChatBubbleOutline as ChatIcon,
  Add as AddIcon
} from '@mui/icons-material';

export default function AdminChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'こんにちは！SEKKEIYAの仕様や記事の作成について、どのようなご相談でしょうか？'
    }
  ]);
  const [input, setInput] = useState('');

  // Mock chat history topics
  const chatHistory = [
    { title: 'Firebase Deploy エラー解決', isRecent: true },
    { title: '管理者UI/UX改善プラン', isRecent: true },
    { title: 'モデルのバージョン管理', isRecent: true },
    { title: 'S.Layout モード評価', isRecent: false },
    { title: 'SEKKEIYAの売るもの', isRecent: false },
    { title: 'GUIエージェントの概要', isRecent: false },
  ];

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Mock assistant reply
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: '（AI連携は準備中です。ここにChatGPT等のAPI結果が返ってくる予定です。）'
      }]);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ height: { xs: 'calc(100vh - 100px)', lg: 'calc(100vh - 140px)' }, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1, color: '#fff' }}>
          AI Chat (Beta)
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          SEKKEIYAの仕様相談や、記事作成の壁打ちにご利用ください。
        </Typography>
      </Box>

      {/* Main 2-Pane Chat Layout */}
      <Box sx={{ display: 'flex', gap: 3, flexGrow: 1, minHeight: 0 }}>
        
        {/* Inner Sidebar: Chat History */}
        <Paper 
          elevation={0}
          sx={{ 
            width: 260, 
            flexShrink: 0,
            bgcolor: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 3,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 2 }}>
            <Button 
              fullWidth 
              variant="outlined" 
              startIcon={<AddIcon />}
              sx={{ 
                color: '#fff', 
                borderColor: 'rgba(255,255,255,0.2)', 
                justifyContent: 'flex-start',
                pl: 2,
                borderRadius: 2,
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
              }}
            >
              新しいチャット
            </Button>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
          
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            <List sx={{ px: 1 }}>
              {/* Recent Group */}
              <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                最近
              </Typography>
              {chatHistory.filter(h => h.isRecent).map((item, index) => (
                <ListItem key={`recent-${index}`} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    selected={index === 0}
                    sx={{ 
                      borderRadius: 1.5,
                      '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.1)' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    <ListItemText 
                      primary={item.title} 
                      primaryTypographyProps={{ 
                        fontSize: '0.85rem', 
                        noWrap: true,
                        color: index === 0 ? '#fff' : 'rgba(255,255,255,0.7)'
                      }} 
                    />
                  </ListItemButton>
                </ListItem>
              ))}

              {/* Older Group */}
              <Typography variant="caption" sx={{ px: 2, pt: 2, pb: 1, display: 'block', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                過去7日間
              </Typography>
              {chatHistory.filter(h => !h.isRecent).map((item, index) => (
                <ListItem key={`older-${index}`} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    sx={{ 
                      borderRadius: 1.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    <ListItemText 
                      primary={item.title} 
                      primaryTypographyProps={{ 
                        fontSize: '0.85rem', 
                        noWrap: true,
                        color: 'rgba(255,255,255,0.7)'
                      }} 
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Paper>

        {/* Chat Area */}
        <Paper 
          elevation={0}
          sx={{ 
            flexGrow: 1, 
            bgcolor: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Messages List */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {messages.map((msg) => (
              <Box 
                key={msg.id} 
                sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  maxWidth: '80%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                {msg.role === 'assistant' && (
                  <Avatar sx={{ bgcolor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', width: 36, height: 36 }}>
                    <BotIcon fontSize="small" />
                  </Avatar>
                )}
                
                <Box 
                  sx={{ 
                    bgcolor: msg.role === 'user' ? '#38bdf8' : 'transparent',
                    color: msg.role === 'user' ? '#000' : '#fff',
                    p: msg.role === 'user' ? 2 : 0,
                    pt: msg.role === 'assistant' ? 1 : undefined,
                    borderRadius: 2,
                    borderTopRightRadius: msg.role === 'user' ? 4 : undefined,
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {msg.content}
                  </Typography>
                </Box>

                {msg.role === 'user' && (
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                )}
              </Box>
            ))}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Input Area */}
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', maxWidth: 800, mx: 'auto' }}>
              <TextField
                fullWidth
                multiline
                maxRows={8}
                placeholder="SEKKEIYAにメッセージを送信する..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(0,0,0,0.3)',
                    borderRadius: 4,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                    color: '#fff',
                    p: 2,
                  }
                }}
              />
              <IconButton 
                color="primary" 
                onClick={handleSend}
                disabled={!input.trim()}
                sx={{ 
                  bgcolor: '#38bdf8', 
                  color: '#000',
                  mb: 0.5,
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  '&:hover': { bgcolor: '#0284c7' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(0,0,0,0.3)' }
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(255,255,255,0.3)', mt: 1 }}>
              AI can make mistakes. Consider verifying important information.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
