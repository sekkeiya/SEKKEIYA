import React from "react";
import { Box, Typography, Stack, Divider } from "@mui/material";
import { History, FileText, Layers, ExternalLink } from "lucide-react";

import type { ActivityItem } from "../../features/projects/types";

const mockActivities: ActivityItem[] = [
  { id: '1', type: '3d-viewer', title: 'Main Structure Model', description: 'Updated meshes and materials', timestamp: '2 hours ago' },
  { id: '2', type: 'document', title: 'Draft Phase Requirements', description: 'Added 5 new checklist items', timestamp: '5 hours ago' },
  { id: '3', type: 'editor', title: 'Floor Plan Layout', description: 'Exported PDF draft', timestamp: 'Yesterday' }
];

export interface RecentActivityListProps {
  activities?: ActivityItem[];
  loading?: boolean;
  onActivityClick?: (activity: ActivityItem) => void;
}

export const RecentActivityMock: React.FC<RecentActivityListProps> = ({ 
  activities = mockActivities, 
  loading = false, 
  onActivityClick
}) => {
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>Loading activities...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" color="var(--brand-fg)" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
        <History size={20} style={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
        Recent Activity
      </Typography>
      <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.05)", mt: 1, mb: 3 }} />
      
      {activities.length === 0 ? (
        <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 14 }}>No recent activity.</Typography>
      ) : (
        <Stack spacing={2}>
          {activities.map(activity => (
            <Box 
              key={activity.id} 
              onClick={() => onActivityClick?.(activity)}
              sx={{ 
                display: "flex", gap: 3, p: 2, 
                bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)", 
                borderRadius: 3, 
                border: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
                cursor: "pointer",
                transition: "0.2s",
                "&:hover": {
                  bgcolor: "rgb(var(--brand-fg-rgb) / 0.04)",
                  borderColor: "rgb(var(--brand-fg-rgb) / 0.15)"
                }
              }}
            >
              <Box sx={{ 
                width: 40, height: 40, borderRadius: 2, 
                bgcolor: "light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))", 
                display: "flex", alignItems: "center", justifyContent: "center" 
              }}>
                {activity.type === '3d-viewer' && <Layers size={20} color="#aa3bff" />}
                {activity.type === 'document' && <FileText size={20} color="#3b82f6" />}
                {activity.type === 'editor' && <ExternalLink size={20} color="#10b981" />}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: "var(--brand-fg)", fontWeight: 600, fontSize: 14 }}>{activity.title}</Typography>
                <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontSize: 13, mt: 0.5 }}>{activity.description}</Typography>
              </Box>
              <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 12 }}>
                {activity.timestamp}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};
