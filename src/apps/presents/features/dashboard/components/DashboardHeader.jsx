import React from 'react';
import { Box, Typography, Button, TextField, InputAdornment, IconButton, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import SortIcon from '@mui/icons-material/Sort';
import { tokens } from '../../../shared/theme/tokens';
import { CreatePresentationModal } from './CreatePresentationModal';

export const DashboardHeader = ({ title, count }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      px: 3, 
      py: 1.5, 
      borderBottom: tokens.border.subtle,
      bgcolor: tokens.background.panel,
      backdropFilter: 'blur(12px)',
      zIndex: 10
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
        {count !== undefined && (
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 1.5, py: 0.25, borderRadius: 4, border: tokens.border.subtle }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary">{count} 件</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField 
          variant="outlined" 
          size="small"
          placeholder="プレゼンを検索..."
          sx={{ width: 260, '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'rgba(0,0,0,0.4)', height: 36, border: tokens.border.subtle } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="secondary" /></InputAdornment>,
          }}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1.5, border: tokens.border.subtle, p: 0.25 }}>
           <Tooltip title="Grid View">
             <IconButton size="small" sx={{ p: 0.5, bgcolor: 'rgba(0,160,233,0.15)', color: 'primary.main', borderRadius: 1 }}>
               <GridViewIcon fontSize="small" />
             </IconButton>
           </Tooltip>
           <Tooltip title="List View">
             <IconButton size="small" sx={{ p: 0.5, borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'white' } }}>
               <ViewListIcon fontSize="small" />
             </IconButton>
           </Tooltip>
        </Box>

        <Button color="inherit" startIcon={<SortIcon />} size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}>
          Sort
        </Button>
        <Button color="inherit" startIcon={<FilterListIcon />} size="small" sx={{ color: 'text.secondary', border: tokens.border.subtle, borderRadius: 4, px: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'white' } }}>
          Filters
        </Button>

        <Button variant="contained" color="primary" startIcon={<AddIcon />} size="small" onClick={() => setIsModalOpen(true)} sx={{ borderRadius: 4, px: 3, ml: 1, boxShadow: tokens.glow.primary }}>
          新規作成
        </Button>
      </Box>
      <CreatePresentationModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Box>
  );
};
