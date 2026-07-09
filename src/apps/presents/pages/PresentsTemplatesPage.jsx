import React from 'react';
import { Box, Typography, Card, CardActionArea, CardContent, Button, Stack, Chip } from '@mui/material';
import { tokens } from '../shared/theme/tokens';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { createPresentation } from '../shared/api/presentsApi';

const archTemplates = [
  { id: 'tpl-comp', title: 'Competition Board', type: 'Architecture', desc: 'A3 Landscape board layout suitable for architectural competitions.', pages: 1, scene: 'Concept Pitch' },
  { id: 'tpl-house', title: 'Housing Proposal', type: 'Interior', desc: 'Standard 10-page deck for residential client presentations.', pages: 10, scene: 'Client Meeting' },
  { id: 'tpl-store', title: 'Retail Design Pitch', type: 'Commercial', desc: 'Focus on flow and 3D product placement for retail stores.', pages: 12, scene: 'Brand Proposal' },
  { id: 'tpl-office', title: 'Office Layout Plan', type: 'Commercial', desc: 'Zone planning and furniture specification boards.', pages: 8, scene: 'Corporate Pitch' },
  { id: 'tpl-mat', title: 'Material Board', type: 'Interior', desc: 'Grid layout for presenting textures, finishes, and furniture references.', pages: 2, scene: 'Design Development' },
  { id: 'tpl-report', title: 'Planning Report', type: 'Documentation', desc: 'Text-heavy format for architectural research and urban planning.', pages: 15, scene: 'Feasibility Study' },
];

export const PresentsTemplatesPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const handleUseTemplate = async (template) => {
    if (!projectId) return;
    try {
      const newId = await createPresentation(projectId, { title: `Draft: ${template.title}`, templateId: template.id, type: 'presentation' });
      navigate(`/projects/${projectId}/workspaces/presents/editor/${newId}`);
    } catch (err) {
      console.error('Failed to create presentation from template', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 1, color: tokens.text.primary }}>Architecture & Interior Templates</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>Start your proposal from specialized frameworks designed for design professionals.</Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 4 }}>
          {archTemplates.map((t) => (
            <Card key={t.id} sx={{ 
              bgcolor: tokens.background.card, 
              borderRadius: 3, 
              border: tokens.border.subtle,
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              '&:hover': {
                 borderColor: 'primary.main',
                 boxShadow: tokens.glow.primary,
                 bgcolor: tokens.background.cardHover,
                 transform: 'translateY(-2px)'
              } 
            }}>
              <CardActionArea sx={{ height: 180, bgcolor: tokens.background.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleUseTemplate(t)}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Template Profile</Typography>
              </CardActionArea>
              <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: 'transparent', flexGrow: 1 }}>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ color: tokens.text.primary }}>{t.title}</Typography>
                  <Chip size="small" label={t.type} sx={{ bgcolor: 'rgba(0,160,233,0.15)', color: 'primary.main', fontSize: '0.65rem' }} />
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>{t.desc}</Typography>
                
                <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
                  <Chip size="small" label={`${t.pages} Pages`} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', fontSize: '0.65rem' }} />
                  <Chip size="small" label={`Scene: ${t.scene}`} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', fontSize: '0.65rem' }} />
                </Stack>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                   <Button size="small" variant="contained" color="primary" fullWidth onClick={() => handleUseTemplate(t)} sx={{ borderRadius: 4, boxShadow: tokens.glow.primary }}>
                     Use Template
                   </Button>
                   <Button size="small" variant="outlined" color="inherit" fullWidth sx={{ borderRadius: 4, color: 'text.secondary', borderColor: tokens.border.subtle }}>
                     Preview
                   </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
};
