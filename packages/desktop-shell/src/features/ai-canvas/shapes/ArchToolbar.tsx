import React, { useState, useRef, useEffect } from 'react'
import { useEditor, useValue } from 'tldraw'
import { GeoShapeGeoStyle } from '@tldraw/editor'
import { Box, Button, Typography, Stack, Paper, ToggleButton, ToggleButtonGroup, Tabs, Tab, IconButton } from '@mui/material'
import { useAppStore } from '../../../store/useAppStore'

// Icons
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import RedoRoundedIcon from '@mui/icons-material/RedoRounded'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined' // as Eraser
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined'
import AddBoxRoundedIcon from '@mui/icons-material/AddBoxRounded'
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded'
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded'
import GridOffRoundedIcon from '@mui/icons-material/GridOffRounded'
import ArchitectureIcon from '@mui/icons-material/Architecture'
import SensorDoorOutlinedIcon from '@mui/icons-material/SensorDoorOutlined'
import SquareFootOutlinedIcon from '@mui/icons-material/SquareFootOutlined'
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined'
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import AirOutlinedIcon from '@mui/icons-material/AirOutlined'
import ParkOutlinedIcon from '@mui/icons-material/ParkOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import StyleRoundedIcon from '@mui/icons-material/StyleRounded'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import WebAssetRoundedIcon from '@mui/icons-material/WebAssetRounded'
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded'

import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined'
import Crop54Icon from '@mui/icons-material/Crop54'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import RemoveIcon from '@mui/icons-material/Remove'
import HighlightOutlinedIcon from '@mui/icons-material/HighlightOutlined'
import ChangeHistoryOutlinedIcon from '@mui/icons-material/ChangeHistoryOutlined'
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import FlareOutlinedIcon from '@mui/icons-material/FlareOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import LayersClearOutlinedIcon from '@mui/icons-material/LayersClearOutlined'

import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined'
import CropFreeIcon from '@mui/icons-material/CropFree'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import SchemaIcon from '@mui/icons-material/Schema'
import ViewInArIcon from '@mui/icons-material/ViewInAr'

import { BRAND } from '../../../styles/theme'
import {
  spawnMoodBoardTemplate,
  spawnMaterialBoardTemplate,
  spawnZoningConceptTemplate
} from '../utils/templateGenerators'

// -- Small helper components for Ribbon UI --

const RibbonGroup = ({ label, children, noRightBorder = false }: { label: string, children: React.ReactNode, noRightBorder?: boolean }) => (
  <Stack spacing={0.5} alignItems="center" sx={{ px: 1.5, height: '100%', borderRight: noRightBorder ? 'none' : `1px solid ${BRAND.line}`, minWidth: '60px', flexShrink: 0 }}>
    <Stack direction="row" spacing={0} sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Stack>
    <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.6rem', mb: 0.5 }}>{label}</Typography>
  </Stack>
)

const RibbonToolButton = ({ icon, label, value, activeTool, onChange }: { icon: React.ReactNode, label: string, value: string, activeTool: string, onChange: (v: string) => void }) => (
  <Button 
    onClick={() => onChange(value)}
    sx={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minWidth: '44px', height: '48px', p: 0.5, borderRadius: 1, flexShrink: 0,
      color: activeTool === value ? 'var(--brand-fg)' : BRAND.sub,
      bgcolor: activeTool === value ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
      '&:hover': { bgcolor: activeTool === value ? 'rgb(var(--brand-fg-rgb) / 0.15)' : 'rgb(var(--brand-fg-rgb) / 0.05)' },
      '& .MuiSvgIcon-root': { fontSize: '1.2rem' }
    }}
  >
    {icon}
    <Typography variant="caption" sx={{ fontSize: '0.55rem', mt: 0.5, lineHeight: 1, textTransform: 'none' }}>{label}</Typography>
  </Button>
)

const RibbonActionButton = ({ icon, label, onClick, disabled, color, bgcolor }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean, color?: string, bgcolor?: string }) => (
  <Button 
    disabled={disabled}
    onClick={onClick}
    sx={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minWidth: '44px', height: '48px', p: 0.5, borderRadius: 1, flexShrink: 0,
      color: disabled ? BRAND.sub2 : (color || BRAND.text), 
      bgcolor: bgcolor || 'transparent',
      '&:hover': { bgcolor: bgcolor ? (bgcolor + 'dd') : 'rgb(var(--brand-fg-rgb) / 0.05)' },
      '& .MuiSvgIcon-root': { fontSize: '1.2rem' }
    }}
  >
    {icon}
    <Typography variant="caption" sx={{ fontSize: '0.55rem', mt: 0.5, lineHeight: 1, textTransform: 'none' }}>{label}</Typography>
  </Button>
)

export function ArchToolbar() {
  const editor = useEditor()
  const [tabIndex, setTabIndex] = useState(0)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setShowLeftScroll(scrollLeft > 0)
      setShowRightScroll(Math.ceil(scrollLeft + clientWidth) < scrollWidth)
    }
  }

  useEffect(() => {
    // Slight delay to allow layout to settle before checking scroll correctly
    const timer = setTimeout(() => checkScroll(), 50)
    window.addEventListener('resize', checkScroll)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkScroll)
    }
  }, [tabIndex])

  const handleScroll = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
    }
  }

  const isGridMode = useValue('isGridMode', () => editor.getInstanceState().isGridMode, [editor])
  const gridSize = useValue('gridSize', () => editor.getDocumentSettings().gridSize, [editor])
  const activeToolId = useValue('activeToolId', () => editor.getCurrentToolId(), [editor])
  const canUndo = useValue('canUndo', () => editor.getCanUndo(), [editor])
  const canRedo = useValue('canRedo', () => editor.getCanRedo(), [editor])
  const selectedShapeIds = useValue('selectedShapeIds', () => editor.getSelectedShapeIds(), [editor])
  const hasSelection = selectedShapeIds.length > 0

  const canvasTheme = useAppStore(state => state.canvasTheme)
  const setCanvasTheme = useAppStore(state => state.setCanvasTheme)
  const canvasMode = useAppStore(state => state.canvasMode)

  useEffect(() => {
    if (canvasMode === 'diagram' || canvasMode === 'mood' || canvasMode === 'material') {
      setTabIndex(2)
    }
  }, [canvasMode])

  const currentGridSetting = isGridMode ? gridSize : 0

  const handleGridChange = (
    _event: React.MouseEvent<HTMLElement>,
    newSize: number | null
  ) => {
    if (newSize === null) return // prevent unselecting
    if (newSize === 0) {
      editor.updateInstanceState({ isGridMode: false })
    } else {
      editor.updateDocumentSettings({ gridSize: newSize })
      editor.updateInstanceState({ isGridMode: true })
    }
  }
  
  const addZoning = (text: string, color: string) => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'zoning' as any,
      x: pt.x - 75,
      y: pt.y - 75,
      props: { w: 150, h: 150, text, color }
    } as any)
  }

  const addMoodBoard = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'moodboard' as any,
      x: pt.x + 85, 
      y: pt.y - 120,
      props: { w: 240, h: 240, keyword: 'コンセプト画像' }
    } as any)
  }

  const addMaterialCard = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'material_card' as any,
      x: pt.x,
      y: pt.y,
      props: { w: 240, h: 320 }
    } as any)
  }

  const addColorPalette = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'color_palette' as any,
      x: pt.x,
      y: pt.y,
      props: { w: 300, h: 80 }
    } as any)
  }

  const addDimensionLine = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'dimension_line' as any,
      x: pt.x - 100,
      y: pt.y - 20,
      props: { w: 200, h: 40, text: '2000' }
    } as any)
  }

  const addCirculation = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'arrow',
      x: pt.x - 50,
      y: pt.y,
      props: {
        dash: 'dashed',
        color: 'red',
        size: 'm',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 }
      }
    } as any)
  }

  const addSightline = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'arrow',
      x: pt.x - 50,
      y: pt.y,
      props: {
        dash: 'dotted',
        color: 'blue',
        size: 'm',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 }
      }
    } as any)
  }

  const addMermaidShape = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'mermaid' as any,
      x: pt.x - 200,
      y: pt.y - 150,
      props: { w: 400, h: 300 }
    } as any)
  }

  const addThreeJsShape = () => {
    const pt = editor.screenToPage(editor.getViewportScreenCenter())
    editor.createShape({
      type: 'threejs' as any,
      x: pt.x + 50,
      y: pt.y - 150,
      props: { w: 300, h: 300, modelType: 'box' }
    } as any)
  }

  const handleToolChange = (newTool: string) => {
    if (!newTool) return;
    const geoShapes = ['rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'rhombus', 'cloud'];
    if (geoShapes.includes(newTool)) {
      editor.run(() => {
        editor.setStyleForNextShapes(GeoShapeGeoStyle, newTool as any)
        editor.setCurrentTool('geo')
      })
    } else {
      editor.setCurrentTool(newTool)
    }
  }

  const getCenter = () => editor.screenToPage(editor.getViewportScreenCenter())

  return (
    <Paper 
      elevation={4}
      square
      sx={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%',
        zIndex: 999, 
        bgcolor: BRAND.bg, 
        color: BRAND.text,
        borderBottom: `1px solid ${BRAND.line}`,
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}
    >
      {/* --- Tabs Row --- */}
      <Box sx={{ borderBottom: `1px solid ${BRAND.line}`, px: 1 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, v) => setTabIndex(v)} 
          sx={{ 
            minHeight: '32px',
            '& .MuiTab-root': { minHeight: '32px', py: 0, px: 2, fontSize: '0.7rem', color: BRAND.sub, textTransform: 'none' },
            '& .Mui-selected': { color: BRAND.text, fontWeight: 'bold' },
            '& .MuiTabs-indicator': { backgroundColor: BRAND.text }
          }}
        >
          <Tab label="ホーム" />
          <Tab label="建築・空間" />
          <Tab label="ダイアグラム" />
          <Tab label="表示・出力" />
        </Tabs>
      </Box>

      {/* --- Ribbon Content Row --- */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {showLeftScroll && (
          <IconButton 
            onClick={() => handleScroll(-300)} 
            sx={{ position: 'absolute', left: 0, zIndex: 2, bgcolor: BRAND.bg, boxShadow: '3px 0 6px light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 0, height: '88px', width: '32px', '&:hover': { bgcolor: BRAND.bg, opacity: 0.9 } }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
        
        <Box 
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={(e) => {
            // Native horizontal scrolling via mouse wheel
            const target = e.currentTarget
            if (e.deltaY !== 0 && target.scrollWidth > target.clientWidth) {
              target.scrollLeft += e.deltaY;
            }
          }}
        sx={{ 
          height: '88px', 
          display: 'flex', 
          alignItems: 'center', 
          overflowX: 'auto', 
          bgcolor: 'light-dark(rgba(15,23,42,0.03), rgba(0,0,0,0.1))',
          // Sleek horizontal scrollbar
          '&::-webkit-scrollbar': { height: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: BRAND.line, borderRadius: '4px' },
          '&::-webkit-scrollbar-thumb:hover': { background: BRAND.sub }
        }}
      >
        
        {/* TAB 0: ホーム (Home) */}
        {tabIndex === 0 && (
          <>
            <RibbonGroup label="ヒストリー">
              <RibbonActionButton icon={<UndoRoundedIcon />} label="元に" onClick={() => editor.undo()} disabled={!canUndo} />
              <RibbonActionButton icon={<RedoRoundedIcon />} label="やり直" onClick={() => editor.redo()} disabled={!canRedo} />
            </RibbonGroup>

            <RibbonGroup label="ツール">
              <RibbonToolButton icon={<NearMeOutlinedIcon />} label="選択" value="select" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<PanToolOutlinedIcon />} label="移動" value="hand" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<EditOutlinedIcon />} label="ペン" value="draw" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<HighlightOutlinedIcon />} label="マーカー" value="highlight" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<AutoFixHighOutlinedIcon />} label="消去" value="eraser" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<TextFieldsOutlinedIcon />} label="文字" value="text" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<StickyNote2OutlinedIcon />} label="付箋" value="note" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<CropFreeIcon />} label="フレーム" value="frame" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<Crop54Icon />} label="四角" value="rectangle" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<RadioButtonUncheckedIcon />} label="円" value="ellipse" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<RemoveIcon />} label="直線" value="line" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<ArrowOutwardIcon />} label="矢印" value="arrow" activeTool={activeToolId} onChange={handleToolChange} />
            </RibbonGroup>

            <RibbonGroup label="アクション">
              <RibbonToolButton icon={<FlareOutlinedIcon />} label="レーザー" value="laser" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonActionButton icon={<ContentCopyOutlinedIcon />} label="複製" onClick={() => editor.duplicateShapes(selectedShapeIds)} disabled={!hasSelection} />
              <RibbonActionButton icon={<LayersOutlinedIcon />} label="G化" onClick={() => editor.groupShapes(selectedShapeIds)} disabled={!hasSelection} />
              <RibbonActionButton icon={<LayersClearOutlinedIcon />} label="解除" onClick={() => editor.ungroupShapes(selectedShapeIds)} disabled={!hasSelection} />
              <RibbonActionButton icon={<DeleteOutlineIcon />} label="削除" onClick={() => editor.deleteShapes(selectedShapeIds)} disabled={!hasSelection} />
            </RibbonGroup>
          </>
        )}

        {/* TAB 1: 建築・空間 (Architecture) */}
        {tabIndex === 1 && (
          <>
            <RibbonGroup label="ゾーニング">
              <RibbonActionButton icon={<AddBoxRoundedIcon sx={{ color: 'light-dark(#aa7a03, #FBC02D)' }} />} label="LDK" onClick={() => addZoning('LDK', '#FFF9C4')} />
              <RibbonActionButton icon={<AddBoxRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />} label="ｴﾝﾄﾗﾝｽ" onClick={() => addZoning('エントランス', '#F5F5F5')} />
              <RibbonActionButton icon={<AddBoxRoundedIcon sx={{ color: 'light-dark(#0774a7, #81D4FA)' }} />} label="水回り" onClick={() => addZoning('水回り', '#E1F5FE')} />
              <RibbonActionButton icon={<AddBoxRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />} label="寝室" onClick={() => addZoning('寝室', '#E8F5E9')} />
              <RibbonActionButton icon={<AddBoxRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />} label="和室" onClick={() => addZoning('和室', '#D7CCC8')} />
            </RibbonGroup>

            <RibbonGroup label="図面記号・計測">
              <RibbonActionButton icon={<ArchitectureIcon />} label="壁・柱" onClick={() => {}} color={BRAND.sub} />
              <RibbonActionButton icon={<SensorDoorOutlinedIcon />} label="建具" onClick={() => {}} color={BRAND.sub} />
              <RibbonActionButton icon={<StraightenOutlinedIcon />} label="寸法線" onClick={addDimensionLine} color={BRAND.text} />
              <RibbonActionButton icon={<SquareFootOutlinedIcon />} label="面積" onClick={() => {}} color={BRAND.sub} />
            </RibbonGroup>
          </>
        )}

        {/* TAB 2: ダイアグラム (Diagrams) */}
        {tabIndex === 2 && (
          <>
            <RibbonGroup label="追加図形">
              <RibbonToolButton icon={<ChangeHistoryOutlinedIcon />} label="三角" value="triangle" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<DiamondOutlinedIcon />} label="ひし形" value="rhombus" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<StarOutlineIcon />} label="星" value="star" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<HexagonOutlinedIcon />} label="六角" value="hexagon" activeTool={activeToolId} onChange={handleToolChange} />
              <RibbonToolButton icon={<CloudOutlinedIcon />} label="雲" value="cloud" activeTool={activeToolId} onChange={handleToolChange} />
            </RibbonGroup>

            <RibbonGroup label="ジェネレーティブ">
              <RibbonActionButton icon={<SchemaIcon />} label="Mermaid" onClick={addMermaidShape} color="#E91E63" />
              <RibbonActionButton icon={<ViewInArIcon />} label="3Dモデル" onClick={addThreeJsShape} color="#9C27B0" />
            </RibbonGroup>

            <RibbonGroup label="配置・前後">
              <RibbonActionButton icon={<FlipToFrontIcon />} label="最前面" onClick={() => editor.bringToFront(selectedShapeIds)} disabled={!hasSelection} />
              <RibbonActionButton icon={<FlipToBackIcon />} label="最背面" onClick={() => editor.sendToBack(selectedShapeIds)} disabled={!hasSelection} />
              <RibbonActionButton icon={<FormatAlignLeftIcon />} label="左揃" onClick={() => editor.alignShapes(selectedShapeIds, 'left')} disabled={selectedShapeIds.length < 2} />
              <RibbonActionButton icon={<FormatAlignCenterIcon />} label="中揃" onClick={() => editor.alignShapes(selectedShapeIds, 'center-horizontal')} disabled={selectedShapeIds.length < 2} />
              <RibbonActionButton icon={<FormatAlignRightIcon />} label="右揃" onClick={() => editor.alignShapes(selectedShapeIds, 'right')} disabled={selectedShapeIds.length < 2} />
              <RibbonActionButton icon={<VerticalAlignTopIcon />} label="上揃" onClick={() => editor.alignShapes(selectedShapeIds, 'top')} disabled={selectedShapeIds.length < 2} />
              <RibbonActionButton icon={<VerticalAlignCenterIcon />} label="垂直中" onClick={() => editor.alignShapes(selectedShapeIds, 'center-vertical')} disabled={selectedShapeIds.length < 2} />
              <RibbonActionButton icon={<VerticalAlignBottomIcon />} label="下揃" onClick={() => editor.alignShapes(selectedShapeIds, 'bottom')} disabled={selectedShapeIds.length < 2} />
            </RibbonGroup>

            <RibbonGroup label="矢印・パス">
              <RibbonActionButton icon={<MergeTypeOutlinedIcon sx={{ transform: 'rotate(90deg)' }} />} label="動線(人流)" onClick={addCirculation} color={BRAND.text} />
              <RibbonActionButton icon={<VisibilityOutlinedIcon />} label="視線" onClick={addSightline} color={BRAND.text} />
            </RibbonGroup>

            <RibbonGroup label="環境インサイト">
              <RibbonActionButton icon={<WbSunnyOutlinedIcon sx={{ color: '#FFB300' }} />} label="日照・採光" onClick={() => {}} />
              <RibbonActionButton icon={<AirOutlinedIcon sx={{ color: 'light-dark(#0875a6, #4FC3F7)' }} />} label="通風" onClick={() => {}} />
              <RibbonActionButton icon={<ParkOutlinedIcon sx={{ color: '#66BB6A' }} />} label="植栽" onClick={() => {}} />
            </RibbonGroup>

            <RibbonGroup label="リソース・構成">
              <RibbonActionButton icon={<WallpaperRoundedIcon />} label="ムード画像" onClick={addMoodBoard} />
              <RibbonActionButton icon={<StyleRoundedIcon />} label="マテリアル" onClick={addMaterialCard} />
              <RibbonActionButton icon={<PaletteOutlinedIcon />} label="カラーパレット" onClick={addColorPalette} />
            </RibbonGroup>

            <RibbonGroup label="自動テンプレート">
              <RibbonActionButton icon={<DashboardRoundedIcon />} label="ムードボード" onClick={() => spawnMoodBoardTemplate(editor, getCenter())} color="#FF9800" />
              <RibbonActionButton icon={<WebAssetRoundedIcon />} label="マテリアル" onClick={() => spawnMaterialBoardTemplate(editor, getCenter())} color="#9C27B0" />
              <RibbonActionButton icon={<BubbleChartRoundedIcon />} label="ゾーニング" onClick={() => spawnZoningConceptTemplate(editor, getCenter())} color="#E91E63" />
            </RibbonGroup>
          </>
        )}

        {/* TAB 3: 表示・出力 (View) */}
        {tabIndex === 3 && (
          <>
            <RibbonGroup label="キャンバス設定">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isGridMode ? 'primary.main' : BRAND.sub, mr: 1 }}>
                  {isGridMode ? <GridOnRoundedIcon /> : <GridOffRoundedIcon />}
                  <Typography variant="body2" fontWeight="bold">方眼紙</Typography>
                </Box>
                <ToggleButtonGroup
                  value={currentGridSetting}
                  exclusive
                  onChange={handleGridChange}
                  size="small"
                  sx={{ 
                    height: 36,
                    '& .MuiToggleButton-root': { color: BRAND.sub, borderColor: BRAND.line, px: 2 },
                    '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15) !important' } 
                  }}
                >
                  <ToggleButton value={0}>無地</ToggleButton>
                  <ToggleButton value={1}>1mm</ToggleButton>
                  <ToggleButton value={10}>10mm</ToggleButton>
                  <ToggleButton value={100}>100mm</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </RibbonGroup>

            <RibbonGroup label="テーマ切替">
              <ToggleButtonGroup
                value={canvasTheme}
                exclusive
                onChange={(_, v) => { if (v) setCanvasTheme(v) }}
                size="small"
                sx={{ 
                  height: 36,
                  '& .MuiToggleButton-root': { color: BRAND.sub, borderColor: BRAND.line, px: 2, textTransform: 'none', fontSize: '13px' },
                  '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15) !important' } 
                }}
              >
                <ToggleButton value="default">標準</ToggleButton>
                <ToggleButton value="blueprint">青焼き</ToggleButton>
                <ToggleButton value="editorial">雑誌風</ToggleButton>
                <ToggleButton value="monochrome">モノクロ</ToggleButton>
              </ToggleButtonGroup>
            </RibbonGroup>

            <RibbonGroup label="エクスポート">
              <RibbonActionButton icon={<FileDownloadOutlinedIcon />} label="画像化" onClick={() => {}} color={BRAND.sub} />
            </RibbonGroup>
          </>
        )}

        </Box>
        
        {showRightScroll && (
          <IconButton 
            onClick={() => handleScroll(300)} 
            sx={{ position: 'absolute', right: 0, zIndex: 2, bgcolor: BRAND.bg, boxShadow: '-3px 0 6px light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 0, height: '88px', width: '32px', '&:hover': { bgcolor: BRAND.bg, opacity: 0.9 } }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
      </Box>
    </Paper>
  )
}

