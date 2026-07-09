import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Stack, Tabs, Tab, IconButton } from '@mui/material';
import { useDspStore } from '../store/useDspStore';
import { BRAND } from '../../../styles/theme';

// Icons
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import RectangleRoundedIcon from '@mui/icons-material/RectangleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import LinkIcon from '@mui/icons-material/Link';

import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';

import NoteAltIcon from '@mui/icons-material/NoteAlt';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CreateIcon from '@mui/icons-material/Create';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ControlCameraIcon from '@mui/icons-material/ControlCamera';
import GridOnIcon from '@mui/icons-material/GridOn';

// -- Small helper components for Ribbon UI --

const RibbonGroup = ({ label, children, noRightBorder = false }: { label: string, children: React.ReactNode, noRightBorder?: boolean }) => (
  <Stack spacing={0.5} alignItems="center" sx={{ px: 1.5, height: '100%', borderRight: noRightBorder ? 'none' : `1px solid ${BRAND.line}`, minWidth: '60px', flexShrink: 0 }}>
    <Stack direction="row" spacing={0} sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Stack>
    <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.6rem', mb: 0.5 }}>{label}</Typography>
  </Stack>
);

const RibbonActionButton = ({ icon, label, onClick, disabled, color, bgcolor }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean, color?: string, bgcolor?: string }) => (
  <Button 
    disabled={disabled}
    onClick={onClick}
    sx={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minWidth: '44px', height: '48px', p: 0.5, borderRadius: 1, flexShrink: 0,
      color: disabled ? BRAND.sub2 : (color || BRAND.text), 
      bgcolor: bgcolor || 'transparent',
      '&:hover': { bgcolor: bgcolor ? (bgcolor + 'dd') : 'rgba(255,255,255,0.05)' },
      '& .MuiSvgIcon-root': { fontSize: '1.2rem' }
    }}
  >
    {icon}
    <Typography variant="caption" sx={{ fontSize: '0.55rem', mt: 0.5, lineHeight: 1, textTransform: 'none' }}>{label}</Typography>
  </Button>
);

export function DspToolbar() {
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Store access
  const { undo, redo, past, future, addElement, addElements, selectedPageId, selectedElementIds, deleteElements, presentation, updateElements, isSnapEnabled, setIsSnapEnabled, isGridEnabled, setIsGridEnabled, gridSize, setGridSize, activeTool, setActiveTool, setModelPickerOpen, setInspectorActiveTopTab } = useDspStore();
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const hasSelection = selectedElementIds.length > 0;

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => checkScroll(), 50);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const handleScroll = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const handleAddText = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'text',
      x: 100, y: 100, w: 240, h: 60, zIndex: 1, rotation: 0, opacity: 100,
      data: { text: 'テキストを入力', fontSize: '24px', color: '#1d1d1f', textAlign: 'left', fontWeight: '500' }
    });
  };

  const handleAddShape = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'shape',
      x: 150, y: 150, w: 120, h: 120, zIndex: 1, rotation: 0, opacity: 100,
      data: { shapeType: 'rect', fill: 'rgba(255, 255, 255, 0.7)', border: '1px solid #d2d2d7', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
    });
  };

  const handleAddSticky = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'text',
      x: 200, y: 200, w: 160, h: 160, zIndex: 1, rotation: 0, opacity: 100,
      data: { text: 'アイデア', fontSize: '18px', color: '#1d1d1f', textAlign: 'center', bgcolor: '#fff9c4', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', borderRadius: '8px', padding: 2 }
    });
  };

  const handleAddLine = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'line',
      x: 250, y: 250, w: 200, h: 0, zIndex: 1, rotation: 0, opacity: 100,
      data: { fill: '#86868b', stroke: '#86868b', strokeWidth: '3' } // using common fill/stroke
    });
  };

  const handleAddArrow = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'line',
      x: 300, y: 300, w: 200, h: 0, zIndex: 1, rotation: 0, opacity: 100,
      data: { fill: '#86868b', stroke: '#86868b', strokeWidth: '3', showArrow: true }
    });
  };

  const handleAddImage = () => {
    if (!selectedPageId) return;
    addElement(selectedPageId, {
      type: 'image',
      x: 200, y: 200, w: 300, h: 200, zIndex: 1, rotation: 0, opacity: 100,
      data: { src: '', alt: 'Placeholder' }
    });
  };

  const handleAddLink = () => {
    if (!selectedPageId) return;
    const url = window.prompt("URLを入力してください:", "https://");
    if (!url) return;
    addElement(selectedPageId, {
      type: 'link',
      x: 200, y: 300, w: 300, h: 48, zIndex: 1, rotation: 0, opacity: 100,
      data: { url, text: url, color: '#007aff', fontSize: '14px', textAlign: 'left' }
    });
  };

  const handleDelete = () => {
    if (selectedElementIds.length > 0) {
      deleteElements(selectedElementIds);
    }
  };

  const handleDuplicate = () => {
    if (!selectedPageId || selectedElementIds.length === 0) return;
    const pageElements = getActivePageElements();
    const selected = pageElements.filter(e => selectedElementIds.includes(e.id));
    const newEls = selected.map(({ id, ...rest }) => ({ ...rest, x: rest.x + 20, y: rest.y + 20 }));
    addElements(selectedPageId, newEls);
  };

  const handleTogglePencil = () => {
    setActiveTool(activeTool === 'pencil' ? 'select' : 'pencil');
  };

  const handleOpen3DPicker = () => {
    setModelPickerOpen(true);
  };

  const getActivePageElements = () => {
    if (!selectedPageId || !presentation) return [];
    const page = presentation.pages.find(p => p.id === selectedPageId);
    return page ? page.elements : [];
  };

  const handleBringToFront = () => {
    if (!selectedPageId || selectedElementIds.length === 0) return;
    const pageElements = getActivePageElements();
    const maxZ = Math.max(0, ...pageElements.map(e => e.zIndex || 0));
    
    // Increment zIndex based on existing max
    const updates = selectedElementIds.map((id, index) => ({
       id, updates: { zIndex: maxZ + 1 + index }
    }));
    updateElements(updates, true);
  };

  const handleSendToBack = () => {
    if (!selectedPageId || selectedElementIds.length === 0) return;
    const pageElements = getActivePageElements();
    const minZ = Math.min(0, ...pageElements.map(e => e.zIndex || 0));
    
    const updates = selectedElementIds.map((id, index) => ({
       id, updates: { zIndex: minZ - 1 - index }
    }));
    updateElements(updates, true);
  };

  const handleAlign = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedPageId || selectedElementIds.length === 0) return;
    const pageElements = getActivePageElements();
    const selected = pageElements.filter(e => selectedElementIds.includes(e.id));
    if (selected.length === 0) return;

    if (selected.length === 1) {
      const el = selected[0];
      const PAGE_WIDTH = 1200; // Standard configured fixed width
      let newX = el.x;
      if (alignment === 'left') newX = 0;
      else if (alignment === 'center') newX = (PAGE_WIDTH - el.w) / 2;
      else if (alignment === 'right') newX = PAGE_WIDTH - el.w;
      updateElements([{ id: el.id, updates: { x: newX } }], true);
      return;
    }

    const minX = Math.min(...selected.map(e => e.x));
    const maxX = Math.max(...selected.map(e => e.x + e.w));
    const centerX = (minX + maxX) / 2;

    const updates = selected.map(el => {
       let newX = el.x;
       if (alignment === 'left') newX = minX;
       else if (alignment === 'center') newX = centerX - (el.w / 2);
       else if (alignment === 'right') newX = maxX - el.w;
       return { id: el.id, updates: { x: newX } };
    });
    updateElements(updates, true);
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        bgcolor: BRAND.bg, 
        color: BRAND.text,
        borderBottom: `1px solid ${BRAND.line}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* --- Tabs Row --- */}
      <Box sx={{ borderBottom: `1px solid ${BRAND.line}`, px: 1 }}>
        <Tabs 
          value={0} 
          sx={{ 
            minHeight: '32px',
            '& .MuiTab-root': { minHeight: '32px', py: 0, px: 2, fontSize: '0.7rem', color: BRAND.sub, textTransform: 'none' },
            '& .Mui-selected': { color: BRAND.text, fontWeight: 'bold' },
            '& .MuiTabs-indicator': { backgroundColor: BRAND.text }
          }}
        >
          <Tab label="ホーム" />
        </Tabs>
      </Box>

      {/* --- Ribbon Content Row --- */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {showLeftScroll && (
          <IconButton 
            onClick={() => handleScroll(-300)} 
            sx={{ position: 'absolute', left: 0, zIndex: 2, bgcolor: BRAND.bg, boxShadow: '3px 0 6px rgba(0,0,0,0.2)', borderRadius: 0, height: '72px', width: '28px', '&:hover': { bgcolor: BRAND.bg, opacity: 0.9 } }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
        
        <Box 
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={(e) => {
            const target = e.currentTarget;
            if (e.deltaY !== 0 && target.scrollWidth > target.clientWidth) {
              target.scrollLeft += e.deltaY;
            }
          }}
          sx={{ 
            height: '72px', 
            display: 'flex', 
            alignItems: 'center', 
            overflowX: 'auto', 
            bgcolor: 'rgba(0,0,0,0.1)',
            '&::-webkit-scrollbar': { height: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: BRAND.line, borderRadius: '4px' },
            '&::-webkit-scrollbar-thumb:hover': { background: BRAND.sub }
          }}
        >
        
        {/* TAB 0: ホーム (Home) All Tools */}
        <>
          <RibbonGroup label="履歴">
            <RibbonActionButton icon={<UndoRoundedIcon />} label="元に" onClick={undo} disabled={!canUndo} />
            <RibbonActionButton icon={<RedoRoundedIcon />} label="やり直す" onClick={redo} disabled={!canRedo} />
          </RibbonGroup>

          <RibbonGroup label="基本素材">
            <RibbonActionButton icon={<TitleRoundedIcon />} label="テキスト" onClick={handleAddText} disabled={!selectedPageId} />
            <RibbonActionButton icon={<RectangleRoundedIcon />} label="図形" onClick={handleAddShape} disabled={!selectedPageId} />
            <RibbonActionButton icon={<NoteAltIcon />} label="付箋" onClick={handleAddSticky} disabled={!selectedPageId} />
            <RibbonActionButton icon={<HorizontalRuleIcon />} label="線" onClick={handleAddLine} disabled={!selectedPageId} />
            <RibbonActionButton icon={<ArrowRightAltIcon />} label="矢印" onClick={handleAddArrow} disabled={!selectedPageId} />
            <RibbonActionButton icon={<CreateIcon />} label="手書き" onClick={handleTogglePencil} disabled={!selectedPageId} color={activeTool === 'pencil' ? '#29b6f6' : undefined} bgcolor={activeTool === 'pencil' ? 'rgba(41,182,246,0.12)' : undefined} />
            <RibbonActionButton icon={<ImageRoundedIcon />} label="画像" onClick={handleAddImage} disabled={!selectedPageId} />
            <RibbonActionButton icon={<LinkIcon />} label="リンク" onClick={handleAddLink} disabled={!selectedPageId} />
          </RibbonGroup>

          <RibbonGroup label="3D素材">
            <RibbonActionButton icon={<ViewInArIcon />} label="3Dモデル" onClick={handleOpen3DPicker} color="#9C27B0" disabled={!selectedPageId} />
          </RibbonGroup>

          <RibbonGroup label="配置・前後">
            <RibbonActionButton icon={<FlipToFrontIcon />} label="最前面" onClick={handleBringToFront} disabled={!hasSelection} />
            <RibbonActionButton icon={<FlipToBackIcon />} label="最背面" onClick={handleSendToBack} disabled={!hasSelection} />
            <RibbonActionButton icon={<FormatAlignLeftIcon />} label="左揃" onClick={() => handleAlign('left')} disabled={!hasSelection} />
            <RibbonActionButton icon={<FormatAlignCenterIcon />} label="中揃" onClick={() => handleAlign('center')} disabled={!hasSelection} />
            <RibbonActionButton icon={<FormatAlignRightIcon />} label="右揃" onClick={() => handleAlign('right')} disabled={!hasSelection} />
          </RibbonGroup>

          <RibbonGroup label="補助機能">
            <RibbonActionButton 
              icon={<ControlCameraIcon />} 
              label="スナップ" 
              onClick={() => setIsSnapEnabled(!isSnapEnabled)} 
              color={isSnapEnabled ? '#29b6f6' : BRAND.text}
              bgcolor={isSnapEnabled ? 'rgba(41, 182, 246, 0.1)' : 'transparent'}
            />
            <RibbonActionButton 
              icon={<GridOnIcon />} 
              label="グリッド" 
              onClick={() => setIsGridEnabled(!isGridEnabled)} 
              color={isGridEnabled ? '#29b6f6' : BRAND.text}
              bgcolor={isGridEnabled ? 'rgba(41, 182, 246, 0.1)' : 'transparent'}
            />
            {isGridEnabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '48px', ml: 1 }}>
                 <select 
                   value={gridSize}
                   onChange={(e) => setGridSize(Number(e.target.value))}
                   style={{ background: 'transparent', color: BRAND.text, border: `1px solid ${BRAND.line}`, borderRadius: '4px', fontSize: '0.6rem', padding: '2px', outline: 'none' }}
                 >
                   <option value={10} style={{ color: '#000' }}>10px</option>
                   <option value={20} style={{ color: '#000' }}>20px</option>
                   <option value={50} style={{ color: '#000' }}>50px</option>
                   <option value={100} style={{ color: '#000' }}>100px</option>
                 </select>
               </Box>
            )}
          </RibbonGroup>

          <RibbonGroup label="アクション">
            <RibbonActionButton icon={<ContentCopyOutlinedIcon />} label="複製" onClick={handleDuplicate} disabled={!hasSelection} />
            <RibbonActionButton icon={<DeleteOutlineIcon />} label="削除" onClick={handleDelete} disabled={!hasSelection} color="#ef5350" />
          </RibbonGroup>
        </>

        </Box>
        
        {showRightScroll && (
          <IconButton 
            onClick={() => handleScroll(300)} 
            sx={{ position: 'absolute', right: 0, zIndex: 2, bgcolor: BRAND.bg, boxShadow: '-3px 0 6px rgba(0,0,0,0.2)', borderRadius: 0, height: '72px', width: '28px', '&:hover': { bgcolor: BRAND.bg, opacity: 0.9 } }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
