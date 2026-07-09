import React, { type ReactNode, useState, useCallback, useRef } from 'react';
import { Box, CssBaseline, ThemeProvider, Slide, useMediaQuery, Typography, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { Menu as MenuIcon, Layers, Home as HomeIcon, HardDrive, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MiniSidebar from '../components/Sidebar/MiniSidebar';
import { ProjectSidebar } from '../shared/layout/project-sidebar/ProjectSidebar';
import AIChatPanel from '../components/AI/AIChatPanel';
import AIDrivePanel from '../components/AI/AIDrivePanel';
import AIDriveFullScreen from '../components/AI/AIDriveFullScreen';
import { ModelsSidebar } from '../shared/layout/models-sidebar/ModelsSidebar';
import { AiCanvasSidebar } from '../features/ai-canvas/Sidebar/AiCanvasSidebar';
import { DspSidebar } from '../shared/layout/dsp-sidebar/DspSidebar';
import { DspEditorSidebar } from '../features/dsp/editor/sidebars/DspEditorSidebar';
import { DscEditorSidebar } from '../features/dsc/create/sidebars/DscEditorSidebar';
// @ts-ignore
import LeftSidebar from '../features/dsl/layout/editor/sidebars/LeftSidebar/LeftSidebar';
import { DslSidebar } from '../shared/layout/dsl-sidebar/DslSidebar';
import { DscSidebar } from '../shared/layout/dsc-sidebar/DscSidebar';
import { DsdSidebar } from '../shared/layout/dsd-sidebar/DsdSidebar';
import { DsdEditorSidebar } from '../features/dsd/editor/DsdEditorSidebar';
import { DsrSidebar } from '../shared/layout/dsr-sidebar/DsrSidebar';
import { DsiSidebar } from '../shared/layout/dsi-sidebar/DsiSidebar';
import { DsqSidebar } from '../shared/layout/dsq-sidebar/DsqSidebar';
import { DsfSidebar } from '../shared/layout/dsf-sidebar/DsfSidebar';
import { GallerySidebar } from '../shared/layout/gallery-sidebar/GallerySidebar';
import FloatingLibraryPanel from '../features/dsl/layout/editor/sidebars/LeftSidebar/components/Library/FloatingLibraryPanel';
import AI3DCreatePanel from '../components/AI/AI3DCreatePanel';
import AI3DCreateFullScreen from '../components/AI/AI3DCreateFullScreen';
import AIRenderPanel from '../components/AI/AIRenderPanel';
import AIRenderFullScreen from '../components/AI/AIRenderFullScreen';
import { darkDesktopTheme, BRAND } from '../styles/theme';

interface MainLayoutProps {
  children: ReactNode;
}


import { useAppStore } from '../store/useAppStore';
import { useUiLeftSidebarStore } from '../features/dsl/layout/store/uiLeftSidebarStore';
import { useEditorModeStore } from '../features/dsl/layout/store/useEditorModeStore';
import { useDspStore } from '../features/dsp/store/useDspStore';
import { useDscStore } from '../features/dsc/store/useDscStore';

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // On phones the desktop column layout (mini-rail + 240px sidebar + content + 300-360px panels)
  // would crush the center to ~0px. On mobile we overlay the sidebar/panels instead.
  const isMobile = useMediaQuery('(max-width:768px)');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isAIChatOpen, isAIDriveOpen, isAIDriveExpanded, isAI3DCreateOpen, isAI3DCreateExpanded, isAIRenderOpen, isAIRenderExpanded, activeWorkspaceId, activeProjectId, currentMainView, dslLeftPanel, isProjectSidebarOpen, panelSelections, dscShellMode, dsdShellMode, setProjectSidebarOpen, setCurrentMainView, toggleAIDrive, toggleAIChat, setAIDriveOpen, setAIRenderOpen, setAI3DCreateOpen } = useAppStore();
  const dslLeftVisibleSections = useUiLeftSidebarStore((s) => s.visibleSections);
  const isLibraryDetached = useUiLeftSidebarStore((s) => s.isLibraryDetached);
  const toggleLibraryDetached = useUiLeftSidebarStore((s) => s.toggleLibraryDetached);
  const planId = activeWorkspaceId ? panelSelections?.[activeWorkspaceId]?.planId : undefined;
  
  // Resizable Sidebars Logic
  const [driveWidth, setDriveWidth] = useState(360);
  const [chatWidth, setChatWidth] = useState(300);
  const [createWidth, setCreateWidth] = useState(360);
  const [renderWidth, setRenderWidth] = useState(360);
  const [isResizingDrive, setIsResizingDrive] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [isResizingCreate, setIsResizingCreate] = useState(false);
  const [isResizingRender, setIsResizingRender] = useState(false);

  // We use refs to capture the latest starting values cleanly in the mousemove handler without causing closure traps
  const dragContext = useRef({ startX: 0, startWidth: 0 });

  const startDragDrive = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: driveWidth };
    setIsResizingDrive(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setDriveWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingDrive(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [driveWidth]);

  const startDragChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: chatWidth };
    setIsResizingChat(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setChatWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingChat(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [chatWidth]);

  const startDragCreate = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: createWidth };
    setIsResizingCreate(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setCreateWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingCreate(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [createWidth]);

  const startDragRender = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragContext.current = { startX: e.clientX, startWidth: renderWidth };
    setIsResizingRender(true);
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = dragContext.current.startX - moveEvent.clientX; 
      const newWidth = Math.max(250, Math.min(800, dragContext.current.startWidth + deltaX));
      setRenderWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingRender(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [renderWidth]);

  // Show ModelsSidebar if we are in workspace view and the active workspace is models
  const showModelsSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'models';
  
  const dslLeftPanels = useUiLeftSidebarStore((s) => s.leftPanels);

  // Show CanvasSidebar if we are in workspace view and the active workspace is canvas
  const showCanvasSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'canvas';

  // Show DspSidebar if we are in workspace view and the active workspace is presents
  const showDspSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'presents';

  // Show DscSidebar if we are in workspace view and the active workspace is create
  const showDscSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'create';

  // Show DsdSidebar if we are in workspace view and the active workspace is diagram
  const showDsdSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'diagram';

  // Show DsrSidebar if we are in workspace view and the active workspace is drawing
  const showDsrSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'drawing';

  // Show DsiSidebar if we are in workspace view and the active workspace is image
  const showDsiSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'image';

  // Show DsqSidebar if we are in workspace view and the active workspace is quest (S.Quest)
  const showDsqSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'quest';

  // Show DsfSidebar if we are in workspace view and the active workspace is portfolio (S.Portfolio)
  const showDsfSidebar = currentMainView === 'workspace' && activeWorkspaceId === 'portfolio';

  // 3DSC エディターサイドバー表示制御（3DSP パターンと同様）
  const dscShowProjectBrowser = useDscStore((s) => s.showDscProjectBrowser);

  // 3DSP エディターサイドバー表示制御（3DSL の LeftSidebar 相当）
  // isHydrated を使う: clearWorkspace で false になるため EXIT 後に自動で DspSidebar に戻る
  const dspIsHydrated = useDspStore((s) => s.isHydrated);
  const dspShowProjectBrowser = useDspStore((s) => s.showProjectBrowser);

  const isLayoutWorkspace = currentMainView === 'workspace' && activeWorkspaceId === 'layout';

  const editorMode = useEditorModeStore((s: any) => s.editorMode);
  
  const actualDslLeftVisibleSections = isLibraryDetached
    ? dslLeftVisibleSections?.filter((k: string) => k !== "library")
    : dslLeftVisibleSections;

  const hasDslLeftSections = actualDslLeftVisibleSections?.length > 0;

  const showDslDashboard = !!dslLeftPanels?.dashboard;

  const renderLeftSidebar = () => {
    if (currentMainView === 'global-settings' || currentMainView === 'ai-studio' || currentMainView === 'marketplace') return null;
    if (currentMainView === 'gallery') return <GallerySidebar />;
    if (showModelsSidebar) return <ModelsSidebar />;
    if (showCanvasSidebar) return <AiCanvasSidebar />;
    if (showDspSidebar) {
      // ファイルが開かれている かつ プロジェクトブラウザトグル OFF → エディターサイドバー（3DSL パターン）
      if (dspIsHydrated && !dspShowProjectBrowser) return <DspEditorSidebar />;
      return <DspSidebar />;
    }

    if (showDscSidebar) {
      // スタジオが開かれている かつ プロジェクトブラウザトグル OFF → エディターサイドバー（3DSP パターン）
      if (dscShellMode === 'studio' && !dscShowProjectBrowser) return <DscEditorSidebar />;
      return <DscSidebar />;
    }

    if (showDsdSidebar) {
      if (dsdShellMode === 'editor') return <DsdEditorSidebar />;
      return <DsdSidebar />;
    }

    if (showDsrSidebar) return <DsrSidebar />;

    if (showDsiSidebar) return <DsiSidebar />;

    if (showDsqSidebar) return <DsqSidebar />;

    if (showDsfSidebar) return <DsfSidebar />;

    if (isLayoutWorkspace) {
      // hasActiveLayout: true when any level of the Base→Plan→Option hierarchy is selected.
      // planId must be included so that selecting a Plan (before its Option is auto-resolved)
      // does NOT fall back to DslSidebar.
      const hasActiveLayout = !!(
        panelSelections?.layout?.selectedLayoutId ||
        panelSelections?.layout?.optionId ||
        panelSelections?.layout?.planId ||
        panelSelections?.layout?.baseId
      );
      if (!hasActiveLayout) {
        return <DslSidebar />;
      }

      // If we are in 3DSS layout editing but dashboard is toggled ON:
      if (showDslDashboard) {
        return <DslSidebar />;
      }

      // Otherwise, show LeftSidebar if project or library are visible
      if (hasDslLeftSections) {
        return <LeftSidebar />;
      }

      return null;
    }

    return <ProjectSidebar />;
  };

  const getSidebarWidth = () => {
    if (!isProjectSidebarOpen) return 0;
    if (showDscSidebar) return 240;
    if (showDsdSidebar) return 240;
    if (showDsrSidebar) return 240;
    if (showDsiSidebar) return 240;
    if (showDsqSidebar) return 240;
    if (showDsfSidebar) return 240;
    if (isLayoutWorkspace) {
      const hasActiveLayout = !!(
        panelSelections?.layout?.selectedLayoutId ||
        panelSelections?.layout?.optionId ||
        panelSelections?.layout?.planId ||
        panelSelections?.layout?.baseId
      );
      if (!hasActiveLayout) return 240;
      
      if (showDslDashboard) return 240;
      
      if (hasDslLeftSections) {
        return 240;
      }
      return 0;
    }
    return 240;
  };

  const currentSidebarWidth = getSidebarWidth();
  const hasSidebarContent = !!renderLeftSidebar();

  return (
    <ThemeProvider theme={darkDesktopTheme}>
      <CssBaseline />
      {/* ネイティブのタイトルバー(Win/macOS とも)の下に webview が配置されるため、
          上部に追加の内側余白は不要。高さは実ウィンドウ(#root=100%)に揃える。 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
        {/* Mobile top app bar with hamburger to open the navigation drawer */}
        {isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              height: 48,
              px: 1,
              bgcolor: BRAND.bg,
              borderBottom: `1px solid ${BRAND.line}`,
              zIndex: 1450,
              pl: 1.5,
            }}
          >
            <Layers size={20} color="#90caf9" />
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: BRAND.text }}>SEKKEIYA</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
          {/* Mobile nav drawer scrim */}
          {isMobile && mobileNavOpen && (
            <Box
              onClick={() => setMobileNavOpen(false)}
              sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1490 }}
            />
          )}
          <MiniSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        {/* Rest of the layout container (relative so fullscreen overlay can cover it all) */}
        <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          
          {/* Main Area Container (so inner overlays don't cover Right Panels) */}
          <Box sx={{ display: 'flex', flexGrow: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
            {/* Mobile scrim: tap to dismiss the overlaid sidebar */}
            {isMobile && hasSidebarContent && currentSidebarWidth > 0 && (
              <Box
                onClick={() => setProjectSidebarOpen(false)}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  zIndex: 1340,
                }}
              />
            )}

            {/* Sub-Sidebars */}
            <Box
              sx={{
                display: 'flex',
                height: '100%',
                flexShrink: 0,
                width: hasSidebarContent ? currentSidebarWidth : 0,
                overflow: 'hidden',
                transition: isMobile ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(isMobile && {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: currentSidebarWidth || 240,
                  maxWidth: '85vw',
                  zIndex: 1350,
                  boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
                  bgcolor: BRAND.bg,
                  transform: hasSidebarContent && currentSidebarWidth > 0 ? 'translateX(0)' : 'translateX(-100%)',
                }),
              }}
            >
              {/* To prevent layout shifts inside during transition, force the inner wrapper to target width */}
              <Box sx={{ width: currentSidebarWidth, flexShrink: 0, height: '100%', position: 'relative' }}>
                <AnimatePresence mode="wait">
                  {hasSidebarContent && (
                    <motion.div
                      key={currentMainView + activeWorkspaceId + dslLeftPanel + dsdShellMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    >
                      {renderLeftSidebar()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </Box>

            {/* Center Content */}
            <Box sx={{ flexGrow: 1, flexBasis: 0, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative' }}>
              {children}
            </Box>

            {/* AI Drive FullScreen Overlay - Now isolated to Main Area */}
            <Slide direction="left" in={isAIDriveOpen && isAIDriveExpanded} mountOnEnter unmountOnExit>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
                <AIDriveFullScreen />
              </Box>
            </Slide>
          </Box>

          {/* Right Auxiliary Panels */}

        {/* AI Drive Panel */}
        <Box 
          sx={{
            width: isAIDriveOpen && !isAIDriveExpanded ? driveWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAIDriveOpen && !isAIDriveExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingDrive ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAIDriveOpen && !isAIDriveExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAIDriveOpen && (
            <Box
              onMouseDown={startDragDrive}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingDrive && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAIDriveOpen && !isAIDriveExpanded ? 250 : 0, overflow: 'hidden' }}>
            <AIDrivePanel />
          </Box>
        </Box>

        {/* AI 3DCreate Panel */}
        <Box 
          sx={{
            width: isAI3DCreateOpen && !isAI3DCreateExpanded ? createWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAI3DCreateOpen && !isAI3DCreateExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingCreate ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAI3DCreateOpen && !isAI3DCreateExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAI3DCreateOpen && !isAI3DCreateExpanded && (
            <Box
              onMouseDown={startDragCreate}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingCreate && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAI3DCreateOpen && !isAI3DCreateExpanded ? 300 : 0, overflow: 'hidden' }}>
            <AI3DCreatePanel />
          </Box>
        </Box>

        {/* AI Render Panel */}
        <Box 
          sx={{
            width: isAIRenderOpen && !isAIRenderExpanded ? renderWidth : 0, 
            flexShrink: 0, 
            borderLeft: isAIRenderOpen && !isAIRenderExpanded ? `1px solid ${BRAND.line}` : 'none', 
            bgcolor: BRAND.panel,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1300,
            transition: isResizingRender ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...(isMobile && {
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: isAIRenderOpen && !isAIRenderExpanded ? '100%' : 0,
              zIndex: 1320,
            }),
          }}
        >
          {isAIRenderOpen && !isAIRenderExpanded && (
            <Box
              onMouseDown={startDragRender}
              sx={{
                position: 'absolute',
                left: -3,
                top: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                zIndex: 50,
                '&:hover': { bgcolor: '#3498db' },
                ...(isResizingRender && { bgcolor: '#3498db' })
              }}
            />
          )}
          <Box sx={{ width: '100%', height: '100%', minWidth: isAIRenderOpen && !isAIRenderExpanded ? 300 : 0, overflow: 'hidden' }}>
            <AIRenderPanel />
          </Box>
        </Box>

          {/* AI Chat Panel */}
          <Box 
            sx={{
              width: isAIChatOpen ? chatWidth : 0, 
              flexShrink: 0, 
              borderLeft: isAIChatOpen ? `1px solid ${BRAND.line}` : 'none', 
              bgcolor: BRAND.panel,
              overflow: 'visible',
              position: 'relative',
              zIndex: 1300,
              transition: isResizingChat ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isMobile && {
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: isAIChatOpen ? '100%' : 0,
                zIndex: 1320,
              }),
            }}
          >
            {isAIChatOpen && (
              <Box
                onMouseDown={startDragChat}
                sx={{
                  position: 'absolute',
                  left: -3,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'ew-resize',
                  zIndex: 50,
                  '&:hover': { bgcolor: '#3498db' },
                  ...(isResizingChat && { bgcolor: '#3498db' })
                }}
              />
            )}
            <Box sx={{ width: '100%', height: '100%', minWidth: isAIChatOpen ? 250 : 0, overflow: 'hidden' }}>
              <AIChatPanel />
            </Box>
          </Box>

          <Slide direction="left" in={isAI3DCreateOpen && isAI3DCreateExpanded} mountOnEnter unmountOnExit>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
              <AI3DCreateFullScreen />
            </Box>
          </Slide>

          <Slide direction="left" in={isAIRenderOpen && isAIRenderExpanded} mountOnEnter unmountOnExit>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200, bgcolor: BRAND.bg }}>
              <AIRenderFullScreen />
            </Box>
          </Slide>

          {/* Floating Library Panel */}
          {isLayoutWorkspace && !!(panelSelections?.layout?.selectedLayoutId || panelSelections?.layout?.optionId) && !dslLeftPanels?.dashboard && isLibraryDetached && (
            <FloatingLibraryPanel
              toggleLibraryDetached={toggleLibraryDetached}
              projectId={activeProjectId}
              workspaceId={activeWorkspaceId}
              planId={planId}
            />
          )}

        </Box>
        </Box>

        {/* Mobile bottom navigation (Instagram-style). #root already insets safe-area-inset-bottom. */}
        {isMobile && (
          <BottomNavigation
            showLabels
            value={
              currentMainView === 'app-hub' ? 'home'
              : isAIDriveOpen ? 'drive'
              : isAIChatOpen ? 'chat'
              : false
            }
            sx={{
              flexShrink: 0,
              height: 56,
              bgcolor: BRAND.bg,
              borderTop: `1px solid ${BRAND.line}`,
              '& .MuiBottomNavigationAction-root': { color: 'rgba(255,255,255,0.6)', minWidth: 0, py: 1 },
              '& .Mui-selected': { color: '#3498db' },
              '& .MuiBottomNavigationAction-label': { fontSize: 11, '&.Mui-selected': { fontSize: 11 } },
            }}
          >
            <BottomNavigationAction
              value="home" label="ホーム" icon={<HomeIcon size={22} />}
              onClick={() => { setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false); setCurrentMainView('app-hub'); }}
            />
            <BottomNavigationAction
              value="drive" label="ドライブ" icon={<HardDrive size={22} />}
              onClick={() => { setAIRenderOpen(false); setAI3DCreateOpen(false); toggleAIDrive(); }}
            />
            <BottomNavigationAction
              value="chat" label="チャット" icon={<MessageSquare size={22} />}
              onClick={() => toggleAIChat()}
            />
            <BottomNavigationAction
              value="menu" label="メニュー" icon={<MenuIcon size={22} />}
              onClick={() => setMobileNavOpen(true)}
            />
          </BottomNavigation>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default MainLayout;
