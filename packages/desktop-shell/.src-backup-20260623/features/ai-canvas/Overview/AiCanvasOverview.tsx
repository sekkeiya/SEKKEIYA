import React from 'react';
import { Box } from '@mui/material';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { ZoningShapeUtil } from '../shapes/ZoningShapeUtil';
import { MoodBoardShapeUtil } from '../shapes/MoodBoardShapeUtil';
import { MaterialCardShapeUtil } from '../shapes/MaterialCardShapeUtil';
import { ColorPaletteShapeUtil } from '../shapes/ColorPaletteShapeUtil';
import { DimensionLineShapeUtil } from '../shapes/DimensionLineShapeUtil';
import { MermaidShapeUtil } from '../shapes/MermaidShapeUtil';
import { ThreeJsShapeUtil } from '../shapes/ThreeJsShapeUtil';
import { ArchToolbar } from '../shapes/ArchToolbar';
import { useEditor } from 'tldraw';
import { useAppStore } from '../../../store/useAppStore';
import { executeCanvasAiPrompt } from '../utils/canvasAiService';
import { spawnMoodBoardTemplate, spawnMaterialBoardTemplate, spawnZoningConceptTemplate, spawnSpatialLayoutTemplate } from '../utils/templateGenerators';

const archShapeUtils = [ZoningShapeUtil, MoodBoardShapeUtil, MaterialCardShapeUtil, ColorPaletteShapeUtil, DimensionLineShapeUtil, MermaidShapeUtil, ThreeJsShapeUtil];

const RightClickPanAdapter = () => {
  const editor = useEditor()
  
  React.useEffect(() => {
    let rightDragging = false
    let lastX = 0
    let lastY = 0
    let isDragThresholdMet = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        rightDragging = true
        isDragThresholdMet = false
        lastX = e.clientX
        lastY = e.clientY
        document.body.classList.add('is-right-panning')
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (rightDragging) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        
        if (!isDragThresholdMet && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          isDragThresholdMet = true
        }

        if (isDragThresholdMet) {
          lastX = e.clientX
          lastY = e.clientY
          const camera = editor.getCamera()
          
          editor.setCamera({
            x: camera.x + dx / camera.z,
            y: camera.y + dy / camera.z,
            z: camera.z
          })
        }
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2 && rightDragging) {
        rightDragging = false
        document.body.classList.remove('is-right-panning')
      }
    }

    const onContextMenu = (e: MouseEvent) => {
      if (isDragThresholdMet) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    
    const container = editor.getContainer()
    container.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    container.addEventListener('contextmenu', onContextMenu, { capture: true })

    return () => {
      document.body.classList.remove('is-right-panning')
      container.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('contextmenu', onContextMenu, { capture: true })
    }
  }, [editor])

  return null
}

const DragDropAdapter = () => {
  const editor = useEditor()
  
  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/sekkeiya-asset')) {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      const assetData = e.dataTransfer?.getData('application/sekkeiya-asset')
      if (assetData) {
        e.preventDefault()
        e.stopPropagation()
        try {
          const asset = JSON.parse(assetData)
          const { x, y } = editor.screenToPage({ x: e.clientX, y: e.clientY })
          
          if (asset.type === 'image') {
            editor.createShapes([{
              type: 'moodboard',
              x,
              y,
              props: {
                keyword: asset.name,
                w: 240,
                h: 240
              }
            }] as any)
          } else {
            editor.createShapes([{
              type: 'note',
              x,
              y,
              props: {
                text: `📄 [${asset.type.toUpperCase()}] ${asset.name}`
              }
            }] as any)
          }
        } catch (err) {
          console.error("Failed to parse dragged asset", err)
        }
      }
    }

    // Attach to window with capture phase to run before Tldraw intercepts it
    window.addEventListener('dragover', handleDragOver, { capture: true })
    window.addEventListener('drop', handleDrop, { capture: true })
    
    return () => {
      window.removeEventListener('dragover', handleDragOver, { capture: true })
      window.removeEventListener('drop', handleDrop, { capture: true })
    }
  }, [editor])

  return null
}

const KeyboardShortcutAdapter = () => {
  const editor = useEditor()
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フォーム操作中は無効化
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as any).isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();
        editor.selectAll();
      }

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        // 選択された図形があればズーム、なければ全図形を画面に収める
        const selectedShapes = editor.getSelectedShapes();
        if (selectedShapes.length > 0) {
          editor.zoomToSelection();
        } else {
          editor.zoomToFit();
        }
      }
    }

    // capture phaseでイベントを受け取り、Tldrawのネイティブショートカット（FでFrameなど）を強制的につぶす
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [editor])

  return null
}


const EditorEventDispatcher = () => {
  const editor = useEditor();
  const lastCanvasAiPrompt = useAppStore(state => state.lastCanvasAiPrompt);
  const prevAiPromptRef = React.useRef<{ text: string; timestamp: number } | null>(null);
  
  React.useEffect(() => {
    // Expose editor for Right Sidebar modifications
    (window as any).canvasEditor = editor;

    let rafId: number | null = null;
    let lastSelectedId: string | null = null;
    let lastPagesStr: string = "";
    let lastPageId: string | null = null;

    const handleChange = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        rafId = null;
        
        try {
          const selectedShapeIds = editor.getSelectedShapeIds();
          const currentSelectedId = selectedShapeIds.length === 1 ? selectedShapeIds[0] : null;
          
          if (currentSelectedId !== lastSelectedId) {
            lastSelectedId = currentSelectedId;
            if (currentSelectedId) {
              const shape = editor.getShape(currentSelectedId);
              useAppStore.getState().setPanelSelection('canvas', shape || null);
            } else {
              useAppStore.getState().setPanelSelection('canvas', null);
            }
          }

          // Fast sync pages
          const rawPages = editor.getPages();
          const pagesStr = rawPages.map(p => p.id + '|' + p.name).join(',');
          const currentPageId = editor.getCurrentPageId();

          const state = useAppStore.getState();
          if (lastPagesStr !== pagesStr) {
            lastPagesStr = pagesStr;
            state.setCanvasPages(rawPages.map(p => ({ id: p.id, name: p.name })));
          }
          if (lastPageId !== currentPageId) {
            lastPageId = currentPageId;
            state.setCanvasCurrentPageId(currentPageId);
          }
        } catch (e) {
          // silently catch to prevent spam
        }
      });
    };
    
    // Listen for changes
    const unsubscribe = editor.store.listen(handleChange, { source: 'user', scope: 'document' });
    // Also listen for selection/page changes which might be in instance state
    const unsubscribeUi = editor.store.listen(handleChange, { source: 'user', scope: 'session' });
    
    // trigger once initially to sync state
    handleChange();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      unsubscribe();
      unsubscribeUi();
      if ((window as any).canvasEditor === editor) {
        delete (window as any).canvasEditor;
      }
    };
  }, [editor]);

  React.useEffect(() => {
    if (lastCanvasAiPrompt && lastCanvasAiPrompt.timestamp !== prevAiPromptRef.current?.timestamp) {
      prevAiPromptRef.current = lastCanvasAiPrompt;
      
      const processPrompt = async () => {
         try {
            const result = await executeCanvasAiPrompt(lastCanvasAiPrompt.text);
            const viewportPageBounds = editor.getViewportPageBounds();
            // Start dropping it roughly in the center of the viewport
            const center = { 
              x: viewportPageBounds.x + viewportPageBounds.w / 2 - 400, 
              y: viewportPageBounds.y + viewportPageBounds.h / 2 - 300 
            }; 
            
            if (result.type === 'moodboard') {
               spawnMoodBoardTemplate(editor, center, 'modern', result.params as any);
            } else if (result.type === 'materialboard') {
               spawnMaterialBoardTemplate(editor, center, result.params as any);
            } else if (result.type === 'zoning') {
               spawnZoningConceptTemplate(editor, center, result.params as any);
            } else if (result.type === 'spatial_layout') {
               spawnSpatialLayoutTemplate(editor, center, result.params as any);
            }
         } catch (err) {
            console.error("AI Generation error", err);
         }
      };
      processPrompt();
    }
  }, [editor, lastCanvasAiPrompt]);

  return null;
}

const customComponents = {
  Toolbar: null,
  MainMenu: null,
  PageMenu: null,
  NavigationPanel: null,
  ZoomMenu: null,
  QuickActions: null,
  HelperButtons: null,
  StylePanel: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  InFrontOfTheCanvas: () => {   
    return (
      <>
        <ArchToolbar />
        <RightClickPanAdapter />
        <DragDropAdapter />
        <KeyboardShortcutAdapter />
        <EditorEventDispatcher />
        <style>{`
          .is-right-panning, .is-right-panning * {
            cursor: grabbing !important;
          }
        `}</style>
      </>
    );
  }
};



interface AiCanvasOverviewProps {
  payload?: any;
}

export const AiCanvasOverview: React.FC<AiCanvasOverviewProps> = ({ payload }) => {
  const canvasTheme = useAppStore((state) => state.canvasTheme);
  const selectedItem = useAppStore(s => payload?.workspaceId ? s.panelSelections[payload.workspaceId] : null);
  
  // Isolate persistence to the specific work file if available, fallback to project ID, or local.
  const persistenceId = selectedItem?.id || payload?.projectId || 'local';

  return (
    <Box sx={{ flex: 1, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Box 
        sx={{ 
          flex: 1, 
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
        className={canvasTheme === 'default' ? '' : `theme-${canvasTheme}`}
      >
        <Tldraw 
          key={persistenceId} 
          persistenceKey={`sekkeiya-canvas-${persistenceId}`}
          shapeUtils={archShapeUtils}
          components={customComponents}
        />
      </Box>
    </Box>
  );
};
