import React, { useEffect } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider } from '@mui/material';
import { Folder as FolderIcon } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { fetchUserProjects } from '../../features/projects/api/fetchProjects';

const ProjectsSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { projects, activeProjectId, setActiveProjectId, setProjects } = useAppStore();

  useEffect(() => {
    if (currentUser) {
      fetchUserProjects(currentUser.uid).then(fetchedProjects => {
        setProjects(fetchedProjects);
      });
    } else {
      setProjects([]);
    }
  }, [currentUser, setProjects]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, pb: 1.5, display: 'flex', alignItems: 'baseline' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>SEKKEIYA</Typography>
        <Typography variant="subtitle2" color="primary.main" sx={{ ml: 0.8, letterSpacing: 1, opacity: 0.9 }}>DESKTOP</Typography>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, overflowY: 'auto', px: 0.5, pt: 1.5 }}>
        {projects.map((project) => (
          <ListItem key={project.id} disablePadding>
            <ListItemButton 
              selected={activeProjectId === project.id}
              onClick={() => setActiveProjectId(project.id)}
            >
              <FolderIcon size={18} style={{ marginRight: 12 }} />
              <ListItemText primary={project.name} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ProjectsSidebar;
