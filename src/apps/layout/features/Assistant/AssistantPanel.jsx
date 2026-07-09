import React from 'react';
import { Box, Typography } from '@mui/material';
import { BRAND } from '@layout/shared/ui/theme';
import { useAssistantStore } from '@layout/shared/store/useAssistantStore';
import ChatView from './ChatView/ChatView';

const AssistantPanel = () => {
  const { activeView } = useAssistantStore();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {activeView === 'chat' ? (
        <ChatView />
      ) : (
        <Box sx={{ p: 3, color: BRAND.text }}>
          <Box sx={{ 
            p: 3, 
            border: `1px dashed ${BRAND.line}`, 
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.02)',
            textAlign: 'center'
          }}>
            <Typography variant="body2" color="text.secondary">
              [Placeholder] この領域にドライブビューが実装されます。
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AssistantPanel;
