import React from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const PRODUCTION_APPS = [
  { id: "landing", label: "ホーム" },
  { id: "files", label: "WorkFiles" },
  { id: "schedule", label: "Schedules & Tasks" },
  { id: "models", label: "Models" },
  { id: "drawings", label: "Drawings" },
  { id: "renders", label: "Renders" },
  { id: "movies", label: "Movies" },
  { id: "articles", label: "Articles" },
  { id: "slides", label: "Slides" },
  { id: "create", label: "Create" },
];

export default function ProductionTabs({ projectId }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Highlight active if URL matches the app id
  const isActive = (id) => location.pathname.includes(`/${id}`);

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 1.5, 
      overflowX: 'auto', 
      px: { xs: 3, md: 5, lg: 8 }, 
      py: 2, 
      bgcolor: 'rgba(255,255,255,0.02)', 
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' }
    }}>
      <Box sx={{ display: "flex", gap: 1, p: 0.5, bgcolor: "rgba(0,0,0,0.3)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
        {PRODUCTION_APPS.map(app => {
          const active = isActive(app.id);
          return (
            <Button
              key={app.id}
              onClick={() => navigate(`/projects/${projectId}/${app.id}`)}
              sx={{
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                bgcolor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderRadius: 3,
                px: 3,
                py: 1,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                fontWeight: active ? 800 : 600,
                letterSpacing: 0.5,
                transition: "all 0.2s ease-in-out",
                boxShadow: active ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
                '&:hover': {
                  bgcolor: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: '#fff'
                }
              }}
            >
              {app.label}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
