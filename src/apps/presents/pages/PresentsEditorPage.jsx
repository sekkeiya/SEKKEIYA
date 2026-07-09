import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Divider, Tabs, Tab, TextField, CircularProgress, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { usePresentationUiStore } from '../features/presentation/store/usePresentationUiStore';
import { fetchAssetsBySource } from '../features/presentation/api/assetsApi';
import { createElementFromAsset } from '../features/presentation/utils/elementTransform';
import { fetchPresentation, updatePresentation } from '../shared/api/presentsApi';
import { tokens } from '../shared/theme/tokens';

export const PresentsEditorPage = () => {
  const { projectId, itemId: routeItemId, presentId } = useParams();
  const itemId = routeItemId || presentId;
  const navigate = useNavigate();
  const { 
    activePresentation: presentation,
    isHydrated,
    setActivePresentation,
    setIsHydrated,
    saveStatus,
    setSaveStatus,
    selectedPageId, 
    setSelectedPageId, 
    selectedElementId, 
    setSelectedElementId,
    rightPanelTab,
    setRightPanelTab,
    addPage,
    duplicatePage,
    deletePage,
    addElement,
    updateElement,
    updateElementData
  } = usePresentationUiStore();

  const [assetSource, setAssetSource] = useState('drive'); // 'aiDrive' | '3dss' | '3dsc' | 'upload'
  const [assetsList, setAssetsList] = useState([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetFetchError, setAssetFetchError] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');
  
  const addCountRef = useRef(0);

  // 1. Initialization
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!projectId || !itemId) return;
      setIsHydrated(false);
      try {
        const data = await fetchPresentation(projectId, itemId);
        if (isMounted) {
          if (data) setActivePresentation(data);
        }
      } catch(e) {
         console.error('Failed to init presentation:', e);
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [projectId, itemId, setActivePresentation, setIsHydrated]);

  // 2. AutoSave
  useEffect(() => {
    if (!isHydrated || !presentation) return;

    const handler = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updatePresentation(projectId, itemId, presentation);
        setSaveStatus('saved');
      } catch (e) {
        console.error("AutoSave failed:", e);
        setSaveStatus('error');
      }
    }, 1200);

    return () => clearTimeout(handler);
  }, [presentation, isHydrated, projectId, itemId, setSaveStatus]);

  // Auto-select first page on load
  useEffect(() => {
    if (presentation && presentation.pages && presentation.pages.length > 0 && !selectedPageId) {
      setSelectedPageId(presentation.pages[0].id);
    }
  }, [presentation, selectedPageId, setSelectedPageId]);

  // Fetch mocked/real assets based on active source switch
  useEffect(() => {
    let isMounted = true;
    setIsLoadingAssets(true);
    setAssetFetchError(false);
    setAssetsList([]);
    const fetchAssets = async () => {
      try {
        const data = await fetchAssetsBySource(assetSource);
        if (isMounted) {
          setAssetsList(data);
        }
      } catch (err) {
        if (isMounted) setAssetFetchError(true);
      } finally {
        if (isMounted) setIsLoadingAssets(false);
      }
    };
    fetchAssets();
    return () => { isMounted = false; };
  }, [assetSource]);

  if (!presentation) {
    return (
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Typography variant="h4" fontWeight="bold">Presentation Not Found</Typography>
        <Typography variant="body1" color="text.secondary">Loading or The presentation ID `{itemId}` does not exist.</Typography>
        <Button variant="contained" onClick={() => navigate(`/projects/${projectId}/workspaces/presents`)} sx={{ mt: 2 }}>
          Return to Dashboard
        </Button>
      </Box>
    );
  }

  const activePage = presentation.pages?.find(p => p.id === selectedPageId) || presentation.pages?.[0];
  const activeElement = activePage?.elements?.find(e => e.id === selectedElementId);

  const handleAddAssetToPage = (asset) => {
    try {
      const newElement = createElementFromAsset(asset, addCountRef.current);
      addElement(presentId, activePage?.id, newElement);
      
      // Auto-select newly added element
      setSelectedElementId(newElement.id);
      
      addCountRef.current += 1;
      setToastMessage(`Added "${asset.title}" to Canvas`);
    } catch (error) {
       console.error("Failed to add asset", error);
    }
  };
  const getNumeric = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleNumChange = (field) => (e) => {
    if (e.target.value === '') return;
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && activeElement?.id) {
       updateElement(activeElement.id, { [field]: v });
    }
  };

  const handleNumBlur = (field, min) => (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v < min && activeElement?.id) {
       updateElement(activeElement.id, { [field]: min });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Top Toolbar */}
      <Box sx={{ 
        height: 60, borderBottom: tokens.border.subtle, bgcolor: tokens.background.panel, backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, zIndex: 10
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(`/projects/${projectId}/workspaces/presents`)} size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'white' } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="bold">{presentation.title || 'Untitled'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mr: 2 }}>
            {saveStatus === 'saving' && <><CircularProgress size={12} color="inherit" /><Typography variant="caption">Saving...</Typography></>}
            {saveStatus === 'saved' && <><CloudDoneIcon sx={{ fontSize: 16 }} /><Typography variant="caption">Saved</Typography></>}
            {saveStatus === 'error' && <><ErrorOutlineIcon color="error" sx={{ fontSize: 16 }} /><Typography variant="caption" color="error">Save Error</Typography></>}
          </Box>
          <Button startIcon={<PlayArrowIcon />} variant="contained" color="secondary" size="small" sx={{ borderRadius: 4, px: 3 }}>
            Present
          </Button>
        </Box>
      </Box>

      {/* Editor Main Grid: Canva-like 3-Column */}
      <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr) minmax(320px, 360px)', overflow: 'hidden' }}>
        
        {/* Left Column: Pages List */}
        <Box sx={{ borderRight: tokens.border.subtle, bgcolor: tokens.background.panel, backdropFilter: 'blur(12px)', p: 2, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="overline" color="text.secondary" fontWeight="bold">Pages</Typography>
             <Button size="small" onClick={() => addPage(itemId)} sx={{ color: 'primary.main', fontSize: '0.75rem', p: 0 }}>+ Add Page</Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
             {presentation.pages?.map((page, idx) => (
                <Box key={page.id} onClick={() => setSelectedPageId(page.id)} sx={{ cursor: 'pointer' }}>
                   {/* Page Thumbnail Wrapper */}
                   <Box sx={{ 
                     aspectRatio: '16/9', 
                     borderRadius: 1.5, 
                     border: selectedPageId === page.id ? tokens.border.glow : tokens.border.subtle,
                     boxShadow: selectedPageId === page.id ? tokens.glow.primary : 'none',
                     bgcolor: 'rgba(255,255,255,0.05)',
                     position: 'relative',
                     overflow: 'hidden',
                     mb: 0.5,
                     transition: 'all 0.2s',
                     '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(255,255,255,0.1)' }
                   }}>
                      <Typography variant="h3" sx={{ color: 'rgba(255,255,255,0.05)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold' }}>{idx + 1}</Typography>
                   </Box>
                   
                   {/* Page Controls */}
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
                     <Typography variant="caption" color={selectedPageId === page.id ? 'white' : 'text.secondary'} noWrap sx={{ maxWidth: '60%' }}>
                       {idx + 1}. {page.name}
                     </Typography>
                     {selectedPageId === page.id && (
                       <Box sx={{ display: 'flex', gap: 0.5 }}>
                         <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicatePage(presentId, page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'white' } }}><ContentCopyIcon sx={{ fontSize: '1rem' }}/></IconButton>
                         <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePage(presentId, page.id); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: '1rem' }}/></IconButton>
                       </Box>
                     )}
                   </Box>
                </Box>
             ))}
          </Box>
        </Box>

        {/* Center Column: Interactive Canvas */}
        <Box 
          sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            // Deselect element if clicking directly on canvas wrapper
            if (e.target === e.currentTarget) setSelectedElementId(null)
          }}
        >
          {/* Canvas bounds (16:9 ratio) */}
          <Box 
            id="editor-canvas"
            sx={{ 
              width: '100%', 
              maxWidth: '1280px', 
              aspectRatio: '16/9', 
              bgcolor: '#ffffff', // Standard bright white canvas
              borderRadius: 1,
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => setSelectedElementId(null)} // Deselect clicking empty space on canvas
          >
            {activePage?.elements?.map(el => {
              if (!el || !el.data) {
                console.warn("Invalid element", el);
              }
              const isSelected = selectedElementId === el?.id;

              const handleMouseDown = (e) => {
                if (!el?.id) return;
                e.stopPropagation();
                setSelectedElementId(el.id);
                
                const startX = e.clientX;
                const startY = e.clientY;
                const startLeft = parseFloat(el.x) || 0;
                const startTop = parseFloat(el.y) || 0;
                
                const onMouseMove = (moveEvent) => {
                  const dx = moveEvent.clientX - startX;
                  const dy = moveEvent.clientY - startY;
                  updateElement(el.id, { x: startLeft + dx, y: startTop + dy });
                };
                
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              };

              const handleResizeMouseDown = (e) => {
                if (!el?.id) return;
                e.stopPropagation();
                setSelectedElementId(el.id);
                
                const startX = e.clientX;
                const startY = e.clientY;
                let startW = parseFloat(el.w);
                if (isNaN(startW) || startW <= 0) startW = 200;
                let startH = parseFloat(el.h);
                if (isNaN(startH) || startH <= 0) startH = 200;
                
                const onMouseMove = (moveEvent) => {
                  moveEvent.stopPropagation();
                  const dx = moveEvent.clientX - startX;
                  const dy = moveEvent.clientY - startY;
                  
                  updateElement(el.id, { 
                    w: Math.max(20, startW + dx), 
                    h: Math.max(20, startH + dy)
                  });
                };
                
                const onMouseUp = (upEvent) => {
                  upEvent.stopPropagation();
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              };
              
              const safeW = Math.max(20, parseFloat(el?.w) || 200);
              const safeH = Math.max(20, parseFloat(el?.h) || 200);
              return (
                <Box
                  key={el?.id || Math.random()}
                  onMouseDown={handleMouseDown}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(el.id);
                  }}
                  sx={{
                    position: 'absolute',
                    top: `${parseFloat(el?.y) || 0}px`,
                    left: `${parseFloat(el?.x) || 0}px`,
                    width: `${safeW}px`,
                    height: `${safeH}px`,
                    zIndex: el?.zIndex || 1,
                    transform: `rotate(${el?.rotation || 0}deg)`,
                    border: isSelected ? '2px solid #00a0e9' : '2px solid transparent',
                    cursor: isSelected ? 'move' : 'pointer',
                    '&:hover': { border: isSelected ? '2px solid #00a0e9' : '2px solid rgba(0, 160, 233, 0.4)' },
                    userSelect: 'none',
                    ...el?.data?.style, // legacy fallback or manual strict overrides
                  }}
                >
                  {el?.type === 'image' ? (
                     <Box component="img" src={el?.data?.src} alt={el?.data?.alt || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
                  ) : el?.type === 'modelCard' ? (
                     <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 1, overflow: 'hidden' }}>
                        <Box component="img" src={el?.data?.thumbnailUrl} sx={{ flexGrow: 1, objectFit: 'cover', minHeight: 0 }} draggable={false} />
                        <Box sx={{ p: 1.5, bgcolor: '#fff', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                           <Typography variant="subtitle2" fontWeight="bold" noWrap color="text.primary">{el?.data?.title}</Typography>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                              <Box sx={{ display: 'inline-block', px: 1, py: 0.25, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold">{el?.data?.sourceLabel || el?.data?.source}</Typography>
                              </Box>
                           </Box>
                           {el?.data?.subtitle && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5 }}>{el?.data?.subtitle}</Typography>}
                        </Box>
                     </Box>
                  ) : el?.type === 'title' || el?.type === 'text' ? (
                     <Box sx={{ color: el?.data?.color, fontSize: el?.data?.fontSize, fontWeight: el?.data?.fontWeight, textAlign: el?.data?.textAlign }}>{el?.data?.text}</Box>
                  ) : el?.type === 'shape' ? (
                     <Box sx={{ width: '100%', height: '100%', bgcolor: el?.data?.fill || '#e0e0e0', border: el?.data?.stroke ? `1px solid ${el?.data?.stroke}` : 'none' }} />
                  ) : (
                     <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.1)' }}>{el?.type || 'Unknown Element'}</Box>
                  )}
                  
                  {/* Selection handles mock (visual only) */}
                  {isSelected && (
                     <>
                       <Box sx={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, bgcolor: '#fff', border: '1px solid #00a0e9', borderRadius: '50%' }} />
                       <Box sx={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, bgcolor: '#fff', border: '1px solid #00a0e9', borderRadius: '50%' }} />
                       <Box sx={{ position: 'absolute', bottom: -4, left: -4, width: 8, height: 8, bgcolor: '#fff', border: '1px solid #00a0e9', borderRadius: '50%' }} />
                       <Box 
                         onMouseDown={handleResizeMouseDown}
                         sx={{ 
                           position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, 
                           bgcolor: '#fff', border: '2px solid #00a0e9', borderRadius: '50%', 
                           cursor: 'nwse-resize', zIndex: 10 
                         }} 
                       />
                     </>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Right Column: Tools / Properties Panel */}
        <Box sx={{ borderLeft: tokens.border.subtle, bgcolor: tokens.background.panel, backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
           <Tabs 
             value={rightPanelTab} 
             onChange={(e, v) => setRightPanelTab(v)}
             variant="fullWidth"
             sx={{ borderBottom: tokens.border.subtle, minHeight: 48, '& .MuiTab-root': { minHeight: 48, color: 'text.secondary', fontWeight: 'bold' }, '& .Mui-selected': { color: 'primary.main' } }}
           >
             <Tab label="Elements" value="elements" />
             <Tab label="Assets" value="assets" />
             <Tab label="Properties" value="properties" />
           </Tabs>
           
           <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
             {rightPanelTab === 'elements' && (
                <Box>
                   <Typography variant="overline" color="text.secondary">Add Components</Typography>
                     <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      <Button 
                        variant="outlined" 
                        onClick={() => addElement(itemId, activePage?.id, { type: 'title', x: 100, y: 100, w: 600, h: 60, data: { text: '見出し', fontSize: '48px', color: '#111111', fontWeight: 'bold' } })}
                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                      >Title</Button>
                      <Button 
                        variant="outlined" 
                        onClick={() => addElement(itemId, activePage?.id, { type: 'text', x: 100, y: 200, w: 500, h: 40, data: { text: '本文テキスト', fontSize: '18px', color: '#333333' } })}
                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                      >Body Text</Button>
                      <Button 
                        variant="outlined" 
                        onClick={() => addElement(itemId, activePage?.id, { type: 'image', x: 100, y: 100, w: 400, h: 300, data: { src: 'https://via.placeholder.com/400x300' } })}
                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                      >Image</Button>
                      <Button 
                        variant="outlined" 
                        onClick={() => addElement(itemId, activePage?.id, { type: 'shape', x: 100, y: 100, w: 200, h: 200, data: { shapeType: 'rect', fill: '#e0e0e0' } })}
                        sx={{ borderColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                      >Shape</Button>
                    </Box>
                </Box>
             )}

             {rightPanelTab === 'assets' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                   <Typography variant="overline" color="text.secondary" sx={{ mb: 2 }}>Project Assets</Typography>
                   
                   {/* Source Switcher */}
                   <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                     <Button size="small" variant={assetSource === 'aiDrive' ? 'contained' : 'outlined'} onClick={() => setAssetSource('aiDrive')} sx={{ borderRadius: 2 }}>AI Drive</Button>
                     <Button size="small" variant={assetSource === '3dss' ? 'contained' : 'outlined'} onClick={() => setAssetSource('3dss')} sx={{ borderRadius: 2 }}>S.Models</Button>
                     <Button size="small" variant={assetSource === '3dsc' ? 'contained' : 'outlined'} onClick={() => setAssetSource('3dsc')} sx={{ borderRadius: 2 }}>S.Create</Button>
                     <Button size="small" variant={assetSource === 'upload' ? 'contained' : 'outlined'} onClick={() => setAssetSource('upload')} sx={{ borderRadius: 2 }}>Upload</Button>
                   </Box>
                   
                   <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                   
                   {/* Assets List */}
                   <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                     {isLoadingAssets ? (
                       <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                         <CircularProgress size={24} color="primary" />
                         <Typography variant="body2" color="text.secondary">Fetching {assetSource}...</Typography>
                       </Box>
                     ) : assetFetchError ? (
                       <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
                         <Typography variant="body2" color="error">Failed to load assets</Typography>
                         <Button variant="outlined" size="small" onClick={() => setAssetSource(assetSource)}>Retry</Button>
                       </Box>
                     ) : assetsList.length === 0 ? (
                       <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>No assets found in {assetSource.toUpperCase()}.</Typography>
                     ) : (
                       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                         {assetsList.map(asset => (
                           <Box key={asset.id} sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: tokens.border.subtle, borderRadius: 2, overflow: 'hidden' }}>
                             <Box component="img" src={asset.assetType === 'image' ? (asset.previewUrl || asset.thumbnailUrl) : asset.thumbnailUrl} draggable={false} sx={{ width: '100%', height: 120, objectFit: 'cover' }} />
                             <Box sx={{ p: 1.5 }}>
                               <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{asset.source}</Typography>
                               <Typography variant="body2" fontWeight="bold" noWrap sx={{ color: 'white' }}>{asset.title}</Typography>
                               <Button variant="outlined" size="small" fullWidth sx={{ mt: 1.5, borderColor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'primary.main', borderColor: 'primary.main', color: 'white' } }} onClick={() => handleAddAssetToPage(asset)}>
                                  Add to Page
                               </Button>
                             </Box>
                           </Box>
                         ))}
                       </Box>
                     )}
                   </Box>
                </Box>
             )}

             {rightPanelTab === 'properties' && (
                <Box>
                   {!activeElement ? (
                     <>
                       <Typography variant="caption" color="text.secondary">PAGE ID: {activePage?.id}</Typography>
                       <Typography variant="subtitle2" sx={{ mt: 1, mb: 2 }}>Page Properties</Typography>
                       <TextField size="small" fullWidth label="Page Name" value={activePage?.name || ''} variant="filled" sx={{ mb: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
                       <Typography variant="body2" color="text.secondary">Select an element on the canvas to edit its properties.</Typography>
                     </>
                   ) : (
                     <Box sx={{ pb: 6 }}>
                       <Typography variant="caption" color="text.secondary">ELEMENT TYPE: {activeElement.type.toUpperCase()}</Typography>
                       <Typography variant="subtitle2" sx={{ mt: 1, mb: 3 }}>Element Properties</Typography>
                        {(activeElement.type === 'text' || activeElement.type === 'title') && (
                           <>
                             <TextField size="small" fullWidth label="Text" multiline rows={4} value={activeElement.data?.text || ''} onChange={(e) => updateElementData(activeElement.id, { text: e.target.value })} variant="filled" sx={{ mb: 2, bgcolor: 'rgba(0,0,0,0.3)' }} />
                             
                             <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                               <TextField size="small" label="Font Size" value={activeElement.data?.fontSize || '16px'} onChange={(e) => updateElementData(activeElement.id, { fontSize: e.target.value })} variant="filled" />
                               <TextField size="small" label="Text Align" value={activeElement.data?.textAlign || 'left'} onChange={(e) => updateElementData(activeElement.id, { textAlign: e.target.value })} variant="filled" />
                             </Box>
                           </>
                        )}

                        {activeElement.type === 'shape' && (
                           <TextField size="small" fullWidth label="Background Color" value={activeElement.data?.fill || '#e0e0e0'} onChange={(e) => updateElementData(activeElement.id, { fill: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                        )}

                        {activeElement.type === 'image' && (
                           <TextField size="small" fullWidth label="Image URL" value={activeElement.data?.src || ''} onChange={(e) => updateElementData(activeElement.id, { src: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                        )}

                        {activeElement.type === 'modelCard' && (
                           <>
                             <TextField size="small" fullWidth label="Title" value={activeElement.data?.title || ''} onChange={(e) => updateElementData(activeElement.id, { title: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                             <TextField size="small" fullWidth label="Subtitle" value={activeElement.data?.subtitle || ''} onChange={(e) => updateElementData(activeElement.id, { subtitle: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                             <TextField size="small" fullWidth label="Thumbnail URL" value={activeElement.data?.thumbnailUrl || ''} onChange={(e) => updateElementData(activeElement.id, { thumbnailUrl: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                             <TextField size="small" fullWidth label="Source Label" value={activeElement.data?.sourceLabel || ''} onChange={(e) => updateElementData(activeElement.id, { sourceLabel: e.target.value })} variant="filled" sx={{ mb: 2 }} />
                           </>
                        )}
                        
                        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>Layout & Dimensions</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                           <TextField size="small" type="number" label="X Pos" value={getNumeric(activeElement.x)} onChange={handleNumChange('x')} variant="filled" />
                           <TextField size="small" type="number" label="Y Pos" value={getNumeric(activeElement.y)} onChange={handleNumChange('y')} variant="filled" />
                           <TextField size="small" type="number" label="Width" value={getNumeric(activeElement.w)} onChange={handleNumChange('w')} onBlur={handleNumBlur('w', 20)} variant="filled" />
                           <TextField size="small" type="number" label="Height" value={getNumeric(activeElement.h)} onChange={handleNumChange('h')} onBlur={handleNumBlur('h', 20)} variant="filled" />
                           <TextField size="small" type="number" label="Z-Index" value={getNumeric(activeElement.zIndex)} onChange={handleNumChange('zIndex')} variant="filled" />
                           <TextField size="small" type="number" label="Rotation" value={getNumeric(activeElement.rotation)} onChange={handleNumChange('rotation')} variant="filled" />
                        </Box>
                     </Box>
                   )}
                </Box>
             )}
           </Box>
        </Box>

      </Box>
      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToastMessage('')} severity="success" sx={{ width: '100%', borderRadius: 2 }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
