import React from 'react';
import { Card, CardActionArea, CardContent, Typography, Box } from '@mui/material';

export const SectionCard = ({ title, icon, selected, onClick, children }) => {
  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2, 
        borderColor: selected ? 'primary.main' : 'rgba(255,255,255,0.08)',
        boxShadow: selected ? '0 0 0 1px #00A0E9' : 'none',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: children ? 1 : 0 }}>
            {icon && <Box sx={{ color: selected ? 'primary.main' : 'text.secondary', display: 'flex' }}>{icon}</Box>}
            <Typography variant="subtitle2" fontWeight={selected ? 'bold' : 'normal'}>
              {title}
            </Typography>
          </Box>
          {children}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
