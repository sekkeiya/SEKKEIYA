import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, TextField, Tabs, Tab } from '@mui/material';
import { BRAND } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';

// Icons
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

// Tool for editable properties
const EditablePropField = ({ item, propKey, propValue }: { item: any, propKey: string, propValue: any }) => {
  const [val, setVal] = useState(typeof propValue === 'object' ? JSON.stringify(propValue) : String(propValue));
  
  useEffect(() => { 
    setVal(typeof propValue === 'object' ? JSON.stringify(propValue) : String(propValue));
  }, [propValue, item.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
    const editor = (window as any).canvasEditor;
    if (editor) {
      if (typeof propValue === 'object') {
        try {
          const parsed = JSON.parse(e.target.value);
          editor.updateShape({ id: item.id, type: item.type, props: { ...item.props, [propKey]: parsed } });
        } catch { /* wait for valid JSON */ }
      } else if (typeof propValue === 'number') {
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
          editor.updateShape({ id: item.id, type: item.type, props: { ...item.props, [propKey]: num } });
        }
      } else if (typeof propValue === 'boolean') {
        const bool = e.target.value === 'true';
        editor.updateShape({ id: item.id, type: item.type, props: { ...item.props, [propKey]: bool } });
      } else {
        editor.updateShape({ id: item.id, type: item.type, props: { ...item.props, [propKey]: e.target.value } });
      }
    }
  };

  const isMultiline = typeof val === 'string' && val.length > 30;

  return (
    <TextField 
      label={propKey}
      size="small"
      fullWidth
      multiline={propKey === 'specs' || isMultiline}
      value={val}
      onChange={handleChange}
      InputProps={{ sx: { fontSize: 13, color: 'var(--brand-fg)' } }}
      InputLabelProps={{ sx: { color: 'text.secondary' } }}
    />
  );
};

type TopTabType = 'properties' | 'elements' | 'text' | 'ai';
type BottomTabType = 'assets' | 'layers' | 'history';

export const AiCanvasRightSidebar: React.FC = () => {
  const [activeTopTab, setActiveTopTab] = useState<TopTabType>('properties');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabType>('layers');
  const selectedItem = useAppStore(s => s.panelSelections['canvas']);

  // Resizable top pane
  const [topHeight, setTopHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const dragContext = useRef({ startY: 0, startHeight: 0 });

  // Auto-open properties if an item is selected
  useEffect(() => {
    if (selectedItem) {
      setActiveTopTab('properties');
    }
  }, [selectedItem]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startY: e.clientY, startHeight: topHeight };
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragContext.current.startY; 
      // Constrain height between 150px and window.innerHeight - 150px
      const newHeight = Math.max(150, Math.min(window.innerHeight - 150, dragContext.current.startHeight + deltaY));
      setTopHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [topHeight]);

  const renderPropertiesTab = () => {
    if (!selectedItem) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            キャンバス上の要素を選択すると、<br/>ここにプロパティが表示されます。
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="caption" sx={{ color: 'light-dark(#095fa5, #90caf9)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          {selectedItem.type || 'Unknown'} Properties
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField 
            label="ID (Read Only)" 
            size="small" 
            fullWidth 
            value={selectedItem.id.split(':')[1] || selectedItem.id} 
            disabled 
            InputProps={{ sx: { fontSize: 13 } }}
          />

          {selectedItem.props && Object.entries(selectedItem.props).map(([key, value]) => {
            if (key === 'w' || key === 'h') return null; // Skip w/h to avoid messing up dragging
            return (
              <EditablePropField 
                key={key} 
                item={selectedItem} 
                propKey={key} 
                propValue={value} 
              />
            );
          })}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Advanced Data
          </Typography>
          <Box component="pre" sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.5)', m: 0, overflowX: 'auto' }}>
            {JSON.stringify({ x: selectedItem.x, y: selectedItem.y, rotation: selectedItem.rotation }, null, 2)}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderElementsTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2, display: 'block' }}>基本図形 & ゾーニング</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {['Rectangle', 'Ellipse', 'Triangle', 'Line', 'Zoning LDK', 'Zoning Bath'].map(el => (
          <Box key={el} sx={{ height: 60, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{el}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderTextTab = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ p: 2, bgcolor: '#90caf9', color: '#000', borderRadius: 1, mb: 2, textAlign: 'center', cursor: 'pointer', fontWeight: 800 }}>
        テキストを追加
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>デフォルトスタイル</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mb: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>見出しを追加</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>小見出し</Typography>
      <Typography sx={{ fontSize: 14, mb: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>本文を追加</Typography>
    </Box>
  );

  const renderAITab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2, display: 'block' }}>AI デザインツール</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ p: 2, bgcolor: 'rgba(144, 202, 249, 0.1)', border: '1px solid #90caf9', borderRadius: 2, cursor: 'pointer' }}>
          <Typography sx={{ fontSize: 13, color: 'light-dark(#095fa5, #90caf9)', fontWeight: 700, mb: 0.5 }}>配置の最適化</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>選択したレイアウトを自動調整します。</Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2, cursor: 'pointer' }}>
          <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)', fontWeight: 700, mb: 0.5 }}>ゾーニング診断</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>部屋同士のつながりや矛盾をチェックします。</Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderBottomAssetsTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2, display: 'block' }}>アセット</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>SEKKEIYA Driveの画像やファイルをここにドラッグして配置できます。</Typography>
    </Box>
  );

  const renderBottomLayersTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2, display: 'block' }}>レイヤー</Typography>
      <Box sx={{ p: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1, textAlign: 'center', mb: 1 }}>
         <Typography variant="body2" sx={{ color: 'text.secondary' }}>レイヤー1</Typography>
      </Box>
      <Box sx={{ p: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1, textAlign: 'center' }}>
         <Typography variant="body2" sx={{ color: 'text.secondary' }}>背景</Typography>
      </Box>
    </Box>
  );

  const renderBottomHistoryTab = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2, display: 'block' }}>履歴</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>作業の履歴がここに表示されます。</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
      {/* --- TOP PANE --- */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: topHeight, flexShrink: 0, overflow: 'hidden' }}>
        <Tabs 
          value={activeTopTab} 
          onChange={(_e, v) => setActiveTopTab(v)} 
          variant="scrollable" 
          scrollButtons="auto" 
          sx={{ 
            minHeight: 48, 
            height: 48,
            borderBottom: `1px solid ${BRAND.line}`, 
            '& .MuiTab-root': { minWidth: 'auto', textTransform: 'none', px: 1.5, minHeight: 48, pt: 1 },
            '& .MuiTabs-indicator': { backgroundColor: '#90caf9' }
          }}
        >
          <Tab value="properties" label={<Typography sx={{fontSize: 11}}>プロパティ</Typography>} icon={<TuneRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
          <Tab value="elements" label={<Typography sx={{fontSize: 11}}>素材</Typography>} icon={<CategoryRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
          <Tab value="text" label={<Typography sx={{fontSize: 11}}>テキスト</Typography>} icon={<TextFieldsRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
          <Tab value="ai" label={<Typography sx={{fontSize: 11}}>AIツール</Typography>} icon={<AutoAwesomeRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
        </Tabs>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {activeTopTab === 'properties' && renderPropertiesTab()}
          {activeTopTab === 'elements' && renderElementsTab()}
          {activeTopTab === 'text' && renderTextTab()}
          {activeTopTab === 'ai' && renderAITab()}
        </Box>
      </Box>

      {/* --- RESIZER --- */}
      <Box 
        onMouseDown={startDrag}
        sx={{ 
          height: 6, 
          bgcolor: BRAND.bg, 
          cursor: 'ns-resize', 
          flexShrink: 0,
          borderTop: `1px solid ${BRAND.line}`,
          borderBottom: `1px solid ${BRAND.line}`,
          transition: 'background-color 0.1s',
          '&:hover': { bgcolor: '#90caf9' },
          ...(isResizing && { bgcolor: '#90caf9' })
        }} 
      >
        <Box sx={{ width: 30, height: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)', mx: 'auto', mt: '1px', borderRadius: 1 }} />
      </Box>

      {/* --- BOTTOM PANE --- */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Tabs 
          value={activeBottomTab} 
          onChange={(_e, v) => setActiveBottomTab(v)} 
          variant="scrollable" 
          scrollButtons="auto" 
          sx={{ 
            minHeight: 48, 
            height: 48,
            borderBottom: `1px solid ${BRAND.line}`, 
            '& .MuiTab-root': { minWidth: 'auto', textTransform: 'none', px: 1.5, minHeight: 48, pt: 1 },
            '& .MuiTabs-indicator': { backgroundColor: '#90caf9' }
          }}
        >
          <Tab value="layers" label={<Typography sx={{fontSize: 11}}>レイヤー</Typography>} icon={<LayersRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
          <Tab value="assets" label={<Typography sx={{fontSize: 11}}>アセット</Typography>} icon={<FolderRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
          <Tab value="history" label={<Typography sx={{fontSize: 11}}>履歴</Typography>} icon={<HistoryRoundedIcon sx={{fontSize: 18, mb: 0}}/>} iconPosition="start" />
        </Tabs>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {activeBottomTab === 'assets' && renderBottomAssetsTab()}
          {activeBottomTab === 'layers' && renderBottomLayersTab()}
          {activeBottomTab === 'history' && renderBottomHistoryTab()}
        </Box>
      </Box>
    </Box>
  );
};
