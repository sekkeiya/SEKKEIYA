import React, { useState } from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { BRAND } from '@layout/shared/ui/theme';
import { useAssistantStore } from '@layout/shared/store/useAssistantStore';

const ChatInput = () => {
  const [text, setText] = useState("");
  const { sendMessage, isThinking } = useAssistantStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isThinking) return;
    sendMessage(text.trim());
    setText(""); // Clear input on submit
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit}
      sx={{ 
        p: 2, 
        bgcolor: BRAND.panel,
        borderTop: `1px solid ${BRAND.line}`,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="アシスタントにメッセージを送信..."
        disabled={isThinking}
        variant="outlined"
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(0,0,0,0.3)',
            color: BRAND.text,
            borderRadius: 2,
            '& fieldset': { borderColor: BRAND.line },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
            '&.Mui-focused fieldset': { borderColor: BRAND.primary },
          }
        }}
      />
      <IconButton 
        type="submit" 
        disabled={!text.trim() || isThinking}
        sx={{ 
          bgcolor: text.trim() && !isThinking ? BRAND.primary : 'rgba(255,255,255,0.05)',
          color: text.trim() && !isThinking ? '#fff' : 'rgba(255,255,255,0.3)',
          borderRadius: 2,
          p: 1.25,
          '&:hover': {
            bgcolor: text.trim() && !isThinking ? BRAND.primaryHover : 'rgba(255,255,255,0.05)',
          }
        }}
      >
        <SendRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default ChatInput;
