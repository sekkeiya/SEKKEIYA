import React, { useState, useMemo, useRef } from 'react';
import { Box, Typography, Button, IconButton, Paper, Divider, TextField, Chip, List, ListItem, ListItemText } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { RightPanelModelViewer } from './RightPanelModelViewer';
import { getDownloadUrlForModel } from '../utils/modelUtils';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { DssModelCard } from '../DssModelCard';

interface UsageLocation {
  optionId: string;
  pathName: string;
  count: number;
}

interface UsageInfo {
  totalCount: number;
  locations: UsageLocation[];
}

interface Props {
  model: any;
  allItems?: any[];
  onBack: () => void;
  onSelectRelated?: (model: any) => void;
  usageMap?: Record<string, UsageInfo | number>;
}

export const DssModelDetailView: React.FC<Props> = ({ model, allItems, onBack, onSelectRelated, usageMap }) => {
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Default to 3D if GLB is available, otherwise 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>(glbUrl ? '3D' : '2D');

  const relatedModels = useMemo(() => {
    if (!allItems) return [];
    return allItems
      .filter(item => item.id !== model.id && (item.category === model.category || item.ownerId === model.ownerId))
      .slice(0, 10);
  }, [allItems, model]);

  const title = model.title || model.name || 'Untitled';
  const thumbnailUrl = model.thumbnailUrl || model.thumbnail || '';

  return (
    <Box ref={scrollContainerRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Top Bar */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />} 
          onClick={onBack}
          sx={{ 
            bgcolor: 'rgba(15,23,42,0.6)', 
            color: '#fff', 
            borderRadius: 999, 
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' }
          }}
        >
          Back
        </Button>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', flexShrink: 0, p: 2, pt: 0, gap: 2 }}>
        
        {/* Left Side: Media Viewer */}
        <Box sx={{ flex: '1 1 400px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <Box sx={{ 
            width: '100%',
            aspectRatio: '16/9',
            maxHeight: '70vh', 
            bgcolor: '#000', 
            borderRadius: '12px', 
            position: 'relative', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* 2D/3D Toggle Floating Button */}
            <Paper 
              sx={{ 
                position: 'absolute', 
                top: 16, 
                left: 16, 
                display: 'flex', 
                background: 'rgba(255,255,255,0.9)', 
                borderRadius: '8px',
                overflow: 'hidden',
                zIndex: 10
              }}
            >
              <Button
                variant={viewMode === '2D' ? 'contained' : 'text'}
                size="small"
                startIcon={<ImageIcon fontSize="small" />}
                onClick={() => setViewMode('2D')}
                sx={{ 
                  textTransform: 'none', 
                  color: viewMode === '2D' ? '#fff' : '#000',
                  bgcolor: viewMode === '2D' ? '#000' : 'transparent',
                  borderRadius: 0,
                  px: 2,
                  '&:hover': { bgcolor: viewMode === '2D' ? '#333' : 'rgba(0,0,0,0.05)' }
                }}
              >
                2D
              </Button>
              <Button
                variant={viewMode === '3D' ? 'contained' : 'text'}
                size="small"
                startIcon={<ViewInArIcon fontSize="small" />}
                onClick={() => setViewMode('3D')}
                sx={{ 
                  textTransform: 'none', 
                  color: viewMode === '3D' ? '#fff' : '#000',
                  bgcolor: viewMode === '3D' ? '#000' : 'transparent',
                  borderRadius: 0,
                  px: 2,
                  '&:hover': { bgcolor: viewMode === '3D' ? '#333' : 'rgba(0,0,0,0.05)' }
                }}
              >
                3D
              </Button>
            </Paper>

            {viewMode === '2D' ? (
              thumbnailUrl ? (
                 <Box 
                   component="img" 
                   src={thumbnailUrl} 
                   alt={title}
                   sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
              ) : (
                <Typography color="text.secondary">No Image Available</Typography>
              )
            ) : (
              glbUrl ? (
                <ErrorBoundary>
                   <RightPanelModelViewer modelUrl={glbUrl as string} />
                </ErrorBoundary>
              ) : (
                <Typography color="text.secondary">No GLB format available for 3D preview.</Typography>
              )
            )}
            
            {/* View trigger placeholder (like in the screenshot "3D VIEWERを読み込む") */}
            {viewMode === '3D' && !glbUrl && (
               <Button 
                 variant="contained" 
                 startIcon={<ViewInArIcon />}
                 sx={{ 
                   position: 'absolute', 
                   bottom: 16, 
                   right: 16, 
                   bgcolor: 'rgba(255,255,255,0.9)', 
                   color: '#000', 
                   borderRadius: 999 
                 }}
               >
                 3D VIEWERを読み込む
               </Button>
            )}
          </Box>
          
          {/* Bottom Thumbnails */}
          <Box sx={{ height: 60, display: 'flex', gap: 1 }}>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                bgcolor: '#000', 
                border: '2px solid #3b82f6',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {thumbnailUrl ? (
                <Box 
                   component="img" 
                   src={thumbnailUrl} 
                   sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ImageIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 24 }} />
              )}
            </Box>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '8px', 
                border: '1px dashed rgba(255,255,255,0.2)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: 10,
                flexDirection: 'column'
              }}
            >
               <ImageIcon fontSize="small" sx={{ mb: 0.5 }} />
               ADD
            </Box>
          </Box>
        </Box>

        {/* Right Side: Details Pane */}
        <Paper sx={{ 
          flex: '1 1 300px',
          maxWidth: { xs: '100%', md: 320 },
          alignSelf: 'flex-start',
          bgcolor: 'rgba(15,23,42,0.4)', 
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
           <Box>
             <Typography variant="h6" fontWeight="bold" color="#fff" mb={0.5}>
               {title}
             </Typography>
             {(() => {
               const raw = usageMap?.[model.id];
               if (!raw) return null;
               const totalCount = typeof raw === 'object' ? raw.totalCount : raw;
               const locations: UsageLocation[] = typeof raw === 'object' ? raw.locations : [];
               const layoutCount = locations.length || (totalCount > 0 ? 1 : 0);
               if (!totalCount || totalCount <= 0) return null;
               return (
                 <Box sx={{ mt: 1.5 }}>
                   <Divider sx={{ borderColor: 'rgba(234,179,8,0.3)', mb: 1 }} />
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                     <PlaceRoundedIcon sx={{ fontSize: 13, color: '#facc15' }} />
                     <Typography variant="caption" sx={{ color: '#facc15', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                       Used in Layouts
                     </Typography>
                     <Chip
                       size="small"
                       label={`${layoutCount} layout${layoutCount !== 1 ? 's' : ''} / ${totalCount} item${totalCount !== 1 ? 's' : ''}`}
                       sx={{
                         height: 18,
                         fontSize: 10,
                         fontWeight: 700,
                         bgcolor: 'rgba(234,179,8,0.15)',
                         color: '#facc15',
                         border: '1px solid rgba(234,179,8,0.3)',
                       }}
                     />
                   </Box>
                   {locations.length > 0 && (
                     <List dense disablePadding>
                       {locations.map((loc) => (
                         <ListItem key={loc.optionId} disableGutters sx={{ py: 0.3, alignItems: 'flex-start' }}>
                           <ListItemText
                             primary={
                               <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.8)', fontSize: 10.5, lineHeight: 1.4 }}>
                                 {loc.pathName}
                               </Typography>
                             }
                             secondary={
                               <Typography variant="caption" sx={{ color: 'rgba(253,224,71,0.7)', fontSize: 10, fontWeight: 600 }}>
                                 {loc.count}個
                               </Typography>
                             }
                           />
                         </ListItem>
                       ))}
                     </List>
                   )}
                   <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 1 }} />
                 </Box>
               );
             })()}
           </Box>

           <Box sx={{ display: 'flex', gap: 1 }}>
             <Button 
               variant="contained" 
               fullWidth 
               startIcon={<ExpandMoreIcon />} // Note: In the screenshot it's a download icon, but using ExpandMore for dropdown look
               sx={{ 
                 bgcolor: '#3b82f6', 
                 color: '#fff', 
                 textTransform: 'none', 
                 justifyContent: 'space-between',
                 px: 2
               }}
             >
               Download
             </Button>
             <IconButton sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
               <BookmarkBorderIcon />
             </IconButton>
             <IconButton sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
               <FavoriteBorderIcon />
             </IconButton>
           </Box>

        </Paper>
      </Box>

      {/* Related Models section */}
      {relatedModels.length > 0 && (
        <Box sx={{ p: 2, mt: 2, mb: 4, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2, fontWeight: 700 }}>関連モデル / Other related items</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', overflowX: 'auto', pb: 2 }}>
            {relatedModels.map(rm => (
              <Box 
                key={rm.id} 
                sx={{ 
                  width: 180, 
                  flexShrink: 0, 
                }}
              >
                <DssModelCard 
                   model={rm}
                   onClick={() => {
                     scrollContainerRef.current?.scrollTo(0, 0);
                     onSelectRelated?.(rm);
                   }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

    </Box>
  );
};
