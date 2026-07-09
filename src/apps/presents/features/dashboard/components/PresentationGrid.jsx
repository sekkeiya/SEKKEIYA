import React from 'react';
import { Box, Card, CardActionArea, CardContent, CardMedia, Typography, IconButton, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { usePresentationUiStore } from '../../../features/presentation/store/usePresentationUiStore';
import { useNavigate, useParams } from 'react-router-dom';
import { tokens } from '../../../shared/theme/tokens';

export const PresentationGrid = ({ items = [] }) => {
  const navigate = useNavigate();
  const { projectId } = useParams();

  return (
    <Box sx={{ p: 4, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 4, overflowY: 'auto', flexGrow: 1, alignContent: 'start' }}>
      {items.length === 0 && (
         <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1', mt: 4, textAlign: 'center' }}>
           No presentations found in this scope/type combination.
         </Typography>
      )}
      {items.map((p, i) => (
        <Card key={p.id} sx={{ 
          bgcolor: tokens.background.card, 
          borderRadius: 3, 
          overflow: 'hidden', 
          border: tokens.border.subtle,
          backdropFilter: 'blur(16px)',
          '&:hover': {
             borderColor: 'primary.main',
             boxShadow: tokens.glow.primary,
             bgcolor: tokens.background.cardHover,
             transform: 'translateY(-2px)'
          } 
        }}>
          <CardActionArea 
            onClick={() => navigate(`/projects/${projectId}/workspaces/presents/editor/${p.id}`)}
            sx={{ height: 180, bgcolor: tokens.background.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            {p.thumbnail ? (
              <CardMedia component="img" image={p.thumbnail} alt={p.title} sx={{ height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography variant="body2" color="rgba(255,255,255,0.15)" fontWeight="bold">Presentation Profile</Typography>
            )}
            
            {/* Overlay badges matching 3DSS visual logic */}
            <Box sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'rgba(10,14,22,0.8)', px: 1, py: 0.5, borderRadius: 1.5, border: tokens.border.subtle, backdropFilter: 'blur(4px)' }}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>● PRES</Typography>
            </Box>
            <Box sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(10,14,22,0.8)', p: 0.5, borderRadius: 1.5, textAlign: 'right', border: tokens.border.subtle, px: 1, backdropFilter: 'blur(4px)' }}>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Updated:</Typography>
              <Typography variant="caption" display="block" fontWeight="bold" sx={{ color: tokens.text.primary }}>{new Date(p.updatedAt).toLocaleDateString()}</Typography>
            </Box>
          </CardActionArea>

          <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'transparent' }}>
            <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ color: tokens.text.primary }}>{p.title}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>3dshapepresents · {p.author}</Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 1, gap: 0.5 }}>
              <Tooltip title="Like">
                <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'rgba(0,160,233,0.1)' } }}><FavoriteBorderIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Private">
                <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}><LockIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Export/Download">
                <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}><FileDownloadIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
