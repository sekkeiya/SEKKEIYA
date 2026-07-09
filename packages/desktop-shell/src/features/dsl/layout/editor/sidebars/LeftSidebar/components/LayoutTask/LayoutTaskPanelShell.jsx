import React from 'react';
import { Box, Typography, ButtonBase, LinearProgress, Chip } from '@mui/material';
import { useLayoutTaskStore } from '../../../../../store/useLayoutTaskStore';
import { BRAND } from '../../../../../../../../styles/theme';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function LayoutTaskPanelShell() {
  const { zones, activeZoneId, setActiveZoneId } = useLayoutTaskStore();

  const zoneActuals = useLayoutTaskStore(s => s.zoneActuals) || {};

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', overflowY: 'auto' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase', ml: 0.5, mb: 0.5 }}>
        Layout Tasks
      </Typography>

      {zones.map((zone) => {
        const isActive = zone.id === activeZoneId;
        const actualSeats = zoneActuals[zone.id]?.actualSeats || 0;
        const targetSeats = zone.targetSeats;
        
        let status = 'TODO';
        let statusColor = "#94a3b8"; // Slate 400 for TODO
        let statusText = "未着手";
        let statusBg = "rgb(var(--slate-ink-rgb) / 0.1)";
        let statusBorder = "transparent";
        
        if (actualSeats >= targetSeats) {
          status = 'DONE';
          statusColor = BRAND.success || "#10b981";
          statusText = "完了";
          statusBg = "rgba(16, 185, 129, 0.15)";
          statusBorder = "rgba(16, 185, 129, 0.4)";
        } else if (actualSeats > 0) {
          status = 'IN_PROGRESS';
          statusColor = BRAND.primary || "#3b82f6";
          statusText = "配置中";
          statusBg = "rgba(59, 130, 246, 0.15)";
          statusBorder = "rgba(59, 130, 246, 0.4)";
        }
        
        const progress = Math.min(100, targetSeats > 0 ? (actualSeats / targetSeats) * 100 : 0);
        const seatDelta = targetSeats - actualSeats;

        // NOTE: Phase 1 Limitation
        // Currently, zoneId binding is logical only. Geometry (physical bounded box) overlaps are NOT calculated.
        
        return (
          <ButtonBase
            key={zone.id}
            onClick={() => setActiveZoneId(isActive ? null : zone.id)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              textAlign: 'left',
              p: 1.25, // Densify (was 1.5)
              borderRadius: 1, // Slightly sharper corners
              bgcolor: isActive ? 'rgba(56,189,248,0.06)' : 'rgb(var(--brand-fg-rgb) / 0.02)', // More subtle
              border: `1px solid ${isActive ? 'rgba(56,189,248,0.4)' : 'rgb(var(--brand-fg-rgb) / 0.06)'}`,
              borderLeft: isActive ? '3px solid #38bdf8' : '1px solid rgb(var(--brand-fg-rgb) / 0.06)', // Less thick
              boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2)' : 'none', // Remove neon glow, use shadow focus
              transition: 'all 0.15s ease-in-out',
              opacity: (status === 'DONE' && !isActive) ? 0.6 : 1, // Dim done tasks slightly to focus on remaining
              '&:hover': {
                bgcolor: isActive ? 'rgba(56,189,248,0.08)' : 'rgb(var(--brand-fg-rgb) / 0.06)',
                opacity: 1,
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, width: '100%' }}>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: isActive ? 'light-dark(#0676a8, #38bdf8)' : 'var(--brand-fg)', mb: 0.25 }}>
                  {zone.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: isActive ? 'light-dark(rgba(6,118,168,0.8), rgba(56,189,248,0.8))' : 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: isActive ? 600 : 400 }}>
                  {status === 'DONE' ? '目標座席数クリア🎉' : `あと ${Math.max(0, seatDelta)} 席必要`}
                </Typography>
              </Box>
              
              <Chip 
                label={statusText}
                size="small"
                icon={status === 'DONE' ? <CheckCircleIcon style={{ color: statusColor, fontSize: 14 }} /> : undefined}
                sx={{ 
                  height: 20, 
                  bgcolor: statusBg, 
                  color: statusColor,
                  fontWeight: 700,
                  fontSize: 10,
                  border: `1px solid ${statusBorder}`,
                  '& .MuiChip-label': { px: 1 },
                  '& .MuiChip-icon': { ml: 0.5 }
                }} 
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{
                  flex: 1,
                  height: 4, // Thinner progress bar (was 6)
                  borderRadius: 2,
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
                  overflow: 'hidden',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: statusColor,
                    borderRadius: 2,
                  }
                }}
              />
              <Typography sx={{ fontSize: 11, fontWeight: status === 'DONE' ? 700 : 500, color: status === 'DONE' ? statusColor : 'rgb(var(--brand-fg-rgb) / 0.7)', fontFamily: 'monospace', minWidth: 42, textAlign: 'right' }}>
                {actualSeats} / {targetSeats} 席
              </Typography>
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
