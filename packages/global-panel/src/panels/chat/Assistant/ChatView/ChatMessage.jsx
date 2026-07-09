import React from 'react';
import { Box, Typography, Avatar, Button, Stack } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { BRAND } from '../../../../theme/constants';
import { useAssistantStore } from '../../store/useAssistantStore';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const executeAction = useAssistantStore(s => s.executeAction);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'row', 
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      mb: 3,
      gap: 1.5,
      px: 1
    }}>
      {/* AI Avatar */}
      {!isUser && (
        <Avatar sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.1)', 
          border: `1px solid ${BRAND.line}`,
          width: 32, 
          height: 32,
          color: BRAND.primary
        }}>
          <AutoAwesomeRoundedIcon fontSize="small" />
        </Avatar>
      )}

      {/* Message Bubble */}
      <Box sx={{ 
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start'
      }}>
        <Box sx={{ 
          bgcolor: isUser ? BRAND.primary : 'rgba(255,255,255,0.03)',
          color: isUser ? '#fff' : BRAND.text,
          p: 1.5,
          px: 2,
          borderRadius: 2,
          border: isUser ? 'none' : `1px solid ${BRAND.line}`,
          borderTopRightRadius: isUser ? 0 : 2 * 8,
          borderTopLeftRadius: !isUser ? 0 : 2 * 8,
        }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message.content}
          </Typography>
        </Box>

        {/* Action Chips */}
        {message.actions && message.actions.length > 0 && !isUser && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1, gap: 1 }}>
            {message.actions.map(action => (
              <Button 
                key={action.id}
                variant="outlined" 
                size="small"
                disabled={action.disabled}
                onClick={() => executeAction(message.id, action.id, action.type)}
                sx={{ 
                  borderRadius: 4, 
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  borderColor: BRAND.line,
                  color: BRAND.text,
                  '&:hover': {
                    borderColor: BRAND.primary,
                    bgcolor: 'rgba(255,255,255,0.05)'
                  },
                  '&.Mui-disabled': {
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.3)',
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        )}
      </Box>

      {/* User Avatar */}
      {isUser && (
        <Avatar sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.1)', 
          width: 32, 
          height: 32,
        }}>
          <PersonRoundedIcon fontSize="small" />
        </Avatar>
      )}
    </Box>
  );
};

export default ChatMessage;
