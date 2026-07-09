import React, { useEffect, useRef } from 'react';
import { Box, Button, Typography, Tooltip } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useAssistantStore } from '../../store/useAssistantStore';
import { BRAND } from '../../../../theme/constants';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ThinkingIndicator from './ThinkingIndicator';

const ChatView = () => {
  const { threads, activeThreadId, isThinking, thinkingStatus } = useAssistantStore();
  const activeThread = threads.find(t => t.id === activeThreadId);
  const messages = activeThread?.messages || [];
  const scrollContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Scroll to bottom whenever messages or thinking state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, thinkingStatus]);

  const handleOpenInSekkeiya = () => {
    window.open('https://sekkeiya.com/app/chat', '_blank', 'noreferrer');
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      flex: 1,
      minHeight: 0,
      bgcolor: 'transparent'
    }}>
      {/* Top action bar */}
      <Box sx={{ 
        p: 1.5, 
        borderBottom: `1px solid ${BRAND.line}`,
        display: 'flex',
        justifyContent: 'flex-end',
        bgcolor: 'rgba(0,0,0,0.1)'
      }}>
        <Tooltip title="フルサイズ機能のAIチャットを開く">
          <Button
            size="small"
            variant="outlined"
            onClick={handleOpenInSekkeiya}
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{
              color: BRAND.text,
              borderColor: BRAND.line,
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.5,
              '&:hover': {
                borderColor: BRAND.primary,
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            SEKKEIYAで開く
          </Button>
        </Tooltip>
      </Box>

      {/* Messages Scroll Area */}
      <Box ref={scrollContainerRef} sx={{ 
        flex: 1, 
        overflowY: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {isThinking && (
          <ThinkingIndicator status={thinkingStatus} />
        )}
      </Box>

      {/* Input Area */}
      <ChatInput />
    </Box>
  );
};

export default ChatView;
