import React, { useEffect, useState } from 'react';
import { Box, Typography, CardActionArea, IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { useEditor, createShapeId } from 'tldraw';
import type { TLShape, TLShapeId } from 'tldraw';
import { BRAND } from '../../../styles/theme';

export const SlideThumbnailPane: React.FC = () => {
  const editor = useEditor();
  const [frames, setFrames] = useState<TLShape[]>([]);
  const [activeFrameId, setActiveFrameId] = useState<TLShapeId | null>(null);

  useEffect(() => {
    const updateFrames = () => {
      const allShapes = editor.getCurrentPageShapes();
      const frameShapes = allShapes.filter(s => s.type === 'frame');
      // Sort by x position or creation order
      frameShapes.sort((a, b) => a.x - b.x);
      setFrames(frameShapes);
    };

    updateFrames();

    const unsubscribe = editor.store.listen(() => {
      updateFrames();
    }, { source: 'user', scope: 'all' });

    return () => unsubscribe();
  }, [editor]);

  const handleAddSlide = () => {
    // Determine position for new slide
    let nextX = 0;
    let nextY = 0;
    
    if (frames.length > 0) {
      const lastFrame = frames[frames.length - 1];
      nextX = lastFrame.x + (lastFrame.props as any).w + 100;
      nextY = lastFrame.y;
    } else {
      const pt = editor.screenToPage(editor.getViewportScreenCenter());
      nextX = pt.x - (1920 / 2);
      nextY = pt.y - (1080 / 2);
    }

    const newId = createShapeId();
    editor.createShape({
      id: newId,
      type: 'frame',
      x: nextX,
      y: nextY,
      props: {
        w: 1920,
        h: 1080,
        name: `Slide ${frames.length + 1}`
      }
    } as any);

    focusSlide(newId);
  };

  const focusSlide = (id: TLShapeId) => {
    setActiveFrameId(id);
    const shape = editor.getShape(id);
    if (shape) {
      editor.select(id);
      editor.zoomToSelection({ animation: { duration: 300 } });
      // Clear selection so user doesn't accidentally move the frame, maybe? 
      // editor.selectNone();
    }
  };

  const deleteSlide = (id: TLShapeId) => {
    editor.deleteShapes([id]);
  };

  return (
    <Box sx={{
      width: 200,
      height: '100%',
      bgcolor: 'rgba(26, 30, 39, 0.95)',
      borderRight: `1px solid ${BRAND.line}`,
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(10px)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10
    }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}` }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
          スライド一覧
        </Typography>
        <Tooltip title="スライドを追加 (16:9)">
          <IconButton size="small" onClick={handleAddSlide} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}>
            <AddRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {frames.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 4, px: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 2 }}>
              まだスライドがありません。<br/>「+」ボタンから作成してください。
            </Typography>
          </Box>
        ) : (
          frames.map((frame, index) => {
            const isActive = activeFrameId === frame.id;
            return (
              <Box key={frame.id} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5, ml: 0.5 }}>
                  {(frame.props as any).name || `Slide ${index + 1}`}
                </Typography>
                <CardActionArea 
                  onClick={() => focusSlide(frame.id)}
                  sx={{ 
                    borderRadius: 1.5, 
                    border: isActive ? '2px solid #90caf9' : '2px solid transparent',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)',
                    aspectRatio: '16/9',
                    position: 'relative',
                    transition: 'all 0.2s',
                    '&:hover': { border: isActive ? '2px solid #90caf9' : '2px solid rgb(var(--brand-fg-rgb) / 0.2)' }
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
                    <IconButton 
                      size="small"
                      onClick={(e) => { e.stopPropagation(); deleteSlide(frame.id); }}
                      sx={{ 
                        p: 0.5, bgcolor: 'rgba(0,0,0,0.5)', color: 'rgb(var(--brand-fg-rgb) / 0.6)',
                        '&:hover': { color: '#f44336', bgcolor: 'rgba(244, 67, 54, 0.2)' }
                      }}
                    >
                      <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </CardActionArea>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  );
};
