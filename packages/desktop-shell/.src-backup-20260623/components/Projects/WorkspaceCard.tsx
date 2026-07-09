import React, { useState } from 'react';
import { Card, CardActionArea, Box, Typography, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Layers, FileText, LayoutTemplate, MonitorPlay, BarChart2 } from 'lucide-react';
import { BRAND } from '../../styles/theme';

const iconMap: Record<string, React.ReactNode> = {
  document: <FileText size={24} color="#fff" />,
  '3d-viewer': <Layers size={24} color="#fff" />,
  editor: <LayoutTemplate size={24} color="#fff" />,
  presentation: <MonitorPlay size={24} color="#fff" />,
  dashboard: <BarChart2 size={24} color="#fff" />
};

interface WorkspaceCardProps {
  workspace: any;
  onClick: () => void;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({ workspace, onClick }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  
  const handleMenuClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchorEl(null);
  };

  const name = workspace.name || 'Untitled';
  // Deterministic hue based on name
  const hue = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <Card 
      sx={{ 
        bgcolor: "rgba(255,255,255,0.03)", 
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        height: 200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          borderColor: `hsl(${hue}, 70%, 50%, 0.5)`,
          transform: "translateY(-4px)",
          boxShadow: `0 12px 24px -10px hsl(${hue}, 70%, 50%, 0.3)`
        }
      }}
    >
      <CardActionArea 
        onClick={onClick}
        sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", p: 0 }}
      >
        <Box sx={{ 
          height: 80, 
          background: `linear-gradient(135deg, hsl(${hue}, 40%, 30%), hsl(${(hue + 40) % 360}, 40%, 20%))`,
          position: "relative"
        }}>
          <Box sx={{ 
            position: "absolute", top: "50%", left: 20, transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: 2, bgcolor: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)"
          }}>
            {iconMap[workspace.type] || <LayoutTemplate size={24} color="#fff" />}
          </Box>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column" }}>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 16, mb: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pr: 3 }}>
            {name}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {workspace.description}
          </Typography>
          <Box sx={{ mt: 'auto', pt: 1 }}>
             <Typography variant="caption" sx={{ display: 'inline-block', bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`, px: 1, py: 0.5, borderRadius: 1, color: BRAND.sub }}>
               {workspace.appScope}
             </Typography>
          </Box>
        </Box>
      </CardActionArea>
      <IconButton 
        onClick={handleMenuClick}
        sx={{ 
          position: "absolute", bottom: 12, right: 12, 
          color: "rgba(255,255,255,0.5)",
          "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" }
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }
        }}
      >
        <MenuItem onClick={handleMenuClose} sx={{ fontSize: 14 }}>
          Launch Options
        </MenuItem>
      </Menu>
    </Card>
  );
};
