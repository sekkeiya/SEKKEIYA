import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchPresentation } from '../shared/api/presentsApi';
import { tokens } from '../shared/theme/tokens';

export const PresentsViewerPage = () => {
  const { projectId, itemId } = useParams();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePageIndex, setActivePageIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await fetchPresentation(projectId, itemId);
        if (isMounted) {
          setPresentation(data);
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [projectId, itemId]);

  if (loading) return <Box sx={{ p: 4, color: 'white' }}>Loading Presentation...</Box>;
  if (error || !presentation) return <Box sx={{ p: 4, color: 'red' }}>Failed to load presentation.</Box>;

  const pages = presentation.pages || [];
  const activePage = pages[activePageIndex];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', bgcolor: '#000', color: 'white' }}>
      {/* Minimal Top Bar - Only visible on hover or always for navigation */}
      <Box sx={{ 
        height: 60, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: 'white' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="bold">{presentation.title || 'Untitled Presentation'}</Typography>
        </Box>
        <Typography variant="body2" color="rgba(255,255,255,0.7)">
          Page {activePageIndex + 1} of {pages.length}
        </Typography>
      </Box>

      {/* Main Slide Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pt: '60px' }}>
        <Box sx={{ 
          width: '100%', maxWidth: '1200px', aspectRatio: '16/9', bgcolor: '#fff', 
          position: 'relative', overflow: 'hidden', borderRadius: 2, boxShadow: tokens.glow.primary 
        }}>
          {activePage?.elements?.map(el => (
            <Box 
              key={el.id}
              sx={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.w, height: el.h,
                pointerEvents: 'none' // Prevent interactions
              }}
            >
              {el?.type === 'image' ? (
                 <Box component="img" src={el.data?.src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : el?.type === 'title' || el?.type === 'text' ? (
                 <Box sx={{ color: el.data?.color, fontSize: el.data?.fontSize, fontWeight: el.data?.fontWeight, textAlign: el.data?.textAlign }}>{el.data?.text}</Box>
              ) : (
                 <Box sx={{ width: '100%', height: '100%', bgcolor: el.data?.fill || '#e0e0e0' }} />
              )}
            </Box>
          ))}
        </Box>
      </Box>
      
      {/* simple navigation controls */}
      <Box sx={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2, zIndex: 100 }}>
        <IconButton 
          disabled={activePageIndex === 0} 
          onClick={() => setActivePageIndex(v => Math.max(0, v - 1))}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
        >
          {'<'}
        </IconButton>
        <IconButton 
          disabled={activePageIndex >= pages.length - 1} 
          onClick={() => setActivePageIndex(v => Math.min(pages.length - 1, v + 1))}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
        >
          {'>'}
        </IconButton>
      </Box>
    </Box>
  );
};
