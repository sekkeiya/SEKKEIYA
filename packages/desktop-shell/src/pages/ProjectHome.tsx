import React, { useState, useEffect } from 'react';
import { Box, Typography, Snackbar, Alert, Paper, Tabs, Tab, useMediaQuery } from '@mui/material';
import { LayoutTemplate } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkFileStore } from '../store/useWorkFileStore';
import { WorkFileRepository } from '../features/projects/workFileRepository';
import type { RhinoTemplate, ActivityItem } from '../features/projects/types';
import { invoke } from '@tauri-apps/api/core';
import RhinoTemplateDialog from '../components/Projects/RhinoTemplateDialog';
import { constructLocalDirPath, createNextLocalVersion } from '../features/projects/utils/workFileFsHelpers';
import { WorkFilesList } from '../components/Projects/WorkFilesList';
import { AllProjectsFilesList } from '../components/Projects/AllProjectsFilesList';
import { QuickStartWorkFiles } from '../components/Projects/QuickStartWorkFiles';
import { SchedulesTasksList } from '../components/Projects/SchedulesTasksList';
import { ResearchMemoTab } from '../components/Projects/ResearchMemoTab';
import { ProjectSiteCanvas } from '../features/sites/ProjectSiteCanvas';
import { useProjectSiteStore } from '../store/useProjectSiteStore';

const ProjectHome: React.FC = () => {
  const { getActiveProject, setGlobalLaunchingTool, setAIChatOpen, pendingProjectTab, setPendingProjectTab, activeProjectTab, setActiveProjectTab } = useAppStore();
  const activeProject = getActiveProject();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRhinoDialogOpen, setIsRhinoDialogOpen] = useState(false);
  // ホームタブでサイトが読み込まれているときは、タブをサイトツールバーへ統合し 1 行にまとめる。
  const siteLoaded = useProjectSiteStore(s => !!s.site);

  const { currentUser } = useAuthStore.getState();
  const isMobile = useMediaQuery('(max-width:768px)');

  // デスクトップではプロジェクトを開くと同時にチャットを並べて開く。
  // モバイルはチャットが全画面を覆い「プロジェクトが開かない」ように見えるため自動オープンしない
  // （中央のボトムバーから明示的に開く）。
  useEffect(() => {
    if (!isMobile) setAIChatOpen(true);
  }, [setAIChatOpen, isMobile]);

  // チャット等からタブ切り替えリクエストを受け取る
  useEffect(() => {
    if (!pendingProjectTab) return;
    setActiveProjectTab(pendingProjectTab);
    setPendingProjectTab(null);
  }, [pendingProjectTab, setPendingProjectTab, setActiveProjectTab]);

  const handleLaunchRhino = async (template: RhinoTemplate) => {
    setIsRhinoDialogOpen(false);
    const targetTool = template.toolType || 'rhino';
    
    if (!currentUser || !activeProject) {
      alert("ログイン状態またはプロジェクト情報が取得できません。");
      return;
    }

    try {
      const ext = targetTool === 'blender' ? '.blend' : '.3dm';
      const baseName = `${activeProject?.name || 'Untitled'}_Draft${ext}`;

      const createdWorkFile = await WorkFileRepository.createWorkFile({
        projectId: activeProject.id,
        name: baseName,
        toolType: targetTool,
        updatedBy: currentUser.uid,
        createdBy: currentUser.uid,
        status: 'active'
      });

      const dirPath = await constructLocalDirPath(activeProject.id, createdWorkFile.id, activeProject.name, createdWorkFile.name, createdWorkFile.toolType, createdWorkFile.appScope);
      let targetPath = '';

      if (targetTool === 'blender') {
        const { join } = await import('@tauri-apps/api/path');
        targetPath = await join(dirPath, baseName);
      } else {
        targetPath = await createNextLocalVersion(dirPath, baseName);
      }
      
      let localTemplatePathStr = "";
      
      if (template.isMock || !template.templatePath.startsWith('http')) {
        localTemplatePathStr = template.templatePath;
      } else {
        setToastMessage('テンプレートのローカルキャッシュを確認中...');
        try {
          localTemplatePathStr = await invoke("resolve_template_local_path", { templateId: template.id, uid: template.ownerId || "common" });
        } catch (err) {
          setToastMessage('テンプレートの実体をダウンロード中...');
          try {
            localTemplatePathStr = await invoke("cache_template_locally", { url: template.templatePath, templateId: template.id, uid: template.ownerId || "common" });
          } catch (downloadErr: any) {
            throw new Error(`実体の取得に失敗しました: ${downloadErr}`);
          }
        }
      }
      
      setGlobalLaunchingTool(targetTool);
      setToastMessage(`${targetTool === 'blender' ? 'Blender' : 'Rhino'} を起動中...`);

      await invoke("launch_rhino", { templatePath: localTemplatePathStr, targetFilePath: targetPath });
      
      await new Promise(resolve => setTimeout(resolve, 4500));

      useWorkFileStore.getState().saveBinding(createdWorkFile.id, {
        localPath: dirPath,
        existsLocally: true,
        lastOpenedAt: new Date().toISOString()
      });

      await WorkFileRepository.logActivity({
        projectId: activeProject.id,
        type: 'work_file_created',
        targetType: 'workFile',
        targetId: createdWorkFile.id,
        userId: currentUser.uid,
        meta: { toolType: targetTool, fileName: createdWorkFile.name, templateRef: template.id }
      });
        
      const activity: ActivityItem = {
        id: Date.now().toString(),
        type: 'editor',
        title: `${targetTool === 'blender' ? 'Blender' : 'Rhino'} Started (WorkFile created)`,
        description: `Template: ${template.name}`,
        timestamp: 'Just now',
        workFileId: createdWorkFile.id
      };
      useAppStore.getState().addRecentActivity(activeProject.id, activity);

      setToastMessage(`${targetTool === 'blender' ? 'Blender' : 'Rhino'}起動成功とWorkFile登録完了`);

    } catch (err: any) {
      setToastMessage(`起動エラー: ${err.message || err}`);
    } finally {
      setGlobalLaunchingTool(null);
    }
  };

  const handleOpenActivity = async (activity: any) => {
    if (activity.workFileId) {
      const binding = useWorkFileStore.getState().getBinding(activity.workFileId);
      if (!binding || !binding.existsLocally) {
        setToastMessage('ローカルファイルが見つかりません。ダウンロード機能は未実装です。');
        return;
      }
      setToastMessage('Work File を開いています...');
      setGlobalLaunchingTool('アプリ');

      try {
        await invoke('launch_rhino', { templatePath: '', targetFilePath: binding.localPath });
        await new Promise(resolve => setTimeout(resolve, 4500));

        useWorkFileStore.getState().saveBinding(activity.workFileId, {
          localPath: binding.localPath,
          existsLocally: true,
          lastOpenedAt: new Date().toISOString()
        });

        if (activeProject && currentUser) {
          await WorkFileRepository.logActivity({
            projectId: activeProject.id,
            type: 'work_file_opened',
            targetType: 'workFile',
            targetId: activity.workFileId,
            userId: currentUser.uid,
          });
          await WorkFileRepository.updateWorkFileTime(activeProject.id, activity.workFileId, currentUser.uid);
        }
        setToastMessage('Work File を開きました');
      } catch (err: any) {
        setToastMessage(`起動エラー: ${err}`);
      } finally {
        setGlobalLaunchingTool(null);
      }
    } else {
      setToastMessage(`${activity.title} は現在プレビューのみです`);
    }
  };

  const topNavItems = [
    { id: 'home', label: 'Home' },
    { id: 'schedule', label: 'Schedules & Tasks' },
    { id: 'cadfiles', label: 'CAD Files' },
    { id: 'workfiles', label: 'Work Files' },
    { id: 'memo', label: 'Research & Memo' },
  ];

  // schedule/memo タブは allMode で動作するためプロジェクト未選択でも表示する
  if (!activeProject && activeProjectTab !== 'schedule' && activeProjectTab !== 'memo') {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, boxSizing: 'border-box' }}>
        <Box sx={{ width: '100%', maxWidth: 640, textAlign: 'center', p: 5, border: `1px dashed rgb(var(--brand-fg-rgb) / 0.15)`, borderRadius: 4, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))' }}>
          <LayoutTemplate size={48} style={{ marginBottom: 16, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
          <Typography variant="h6" color="var(--brand-fg)" sx={{ fontWeight: 600, mb: 1 }}>No Project Selected</Typography>
          <Typography color="rgb(var(--brand-fg-rgb) / 0.5)" variant="body2">
            左側のサイドバーからプロジェクトを選択して、含まれるワークスペースやリソースを表示してください。
          </Typography>
        </Box>
      </Box>
    );
  }

  // Journals are now fetched directly by ProjectActivityFeed via useJournalStore

  // ホーム＋サイト読込済みのときは、ページタブをサイトツールバーに統合して 1 行にまとめる。
  const mergeTabsIntoToolbar = activeProjectTab === 'home' && siteLoaded;

  const pageTabs = (
    <Tabs
      value={activeProjectTab}
      onChange={(_e, val) => setActiveProjectTab(val)}
      variant="scrollable"
      scrollButtons="auto"
      textColor="inherit"
      indicatorColor="primary"
      sx={{
        minHeight: 40,
        "& .MuiTabs-indicator": { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, bgcolor: "#00BFFF" },
      }}
    >
      {topNavItems.map(s => (
        <Tab
          key={s.id}
          label={s.label}
          value={s.id}
          disableRipple
          sx={{
            minHeight: 40,
            textTransform: "none",
            fontWeight: activeProjectTab === s.id ? 700 : 500,
            fontSize: 13,
            color: activeProjectTab === s.id ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.6)",
            transition: "color 0.2s",
            "&:hover": { color: "var(--brand-fg)" },
          }}
        />
      ))}
    </Tabs>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minWidth: 0, bgcolor: "light-dark(rgba(255, 255, 255, 0.5), rgba(10, 15, 25, 0.4))", overflow: (activeProjectTab === 'schedule' || activeProjectTab === 'memo') ? 'hidden' : 'auto', boxSizing: "border-box", scrollBehavior: "smooth" }}>

      {/* タブ行（サイトツールバーに統合していないときのみ独立表示） */}
      {!mergeTabsIntoToolbar && (
        <Box sx={{
          px: { xs: 2, md: 3, lg: 4 },
          borderBottom: "1px solid rgb(var(--brand-fg-rgb) / 0.08)",
          bgcolor: "light-dark(rgba(255, 255, 255, 0.85), rgba(10, 15, 25, 0.8))",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          gap: 1,
          position: "sticky",
          top: 0,
          zIndex: 1100,
        }}>
          {pageTabs}
        </Box>
      )}

      {activeProjectTab === 'home' && activeProject ? (
        <ProjectSiteCanvas
          source={{ kind: 'project', id: activeProject.id }}
          displayName={activeProject.name}
          project={activeProject}
          tabsSlot={mergeTabsIntoToolbar ? pageTabs : undefined}
        />
      ) : activeProjectTab === 'cadfiles' && activeProject ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <AllProjectsFilesList filterMode="cad" projects={[activeProject]} />
        </Box>
      ) : activeProjectTab === 'workfiles' && activeProject ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <WorkFilesList project={activeProject} filterMode="other" />
        </Box>
      ) : activeProjectTab === 'schedule' ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <SchedulesTasksList project={activeProject ?? null} />
        </Box>
      ) : activeProjectTab === 'memo' ? (
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ResearchMemoTab />
        </Box>
      ) : null}

      <RhinoTemplateDialog 
        open={isRhinoDialogOpen}
        onClose={() => setIsRhinoDialogOpen(false)}
        onSelect={handleLaunchRhino}
      />

      <Snackbar
        open={!!toastMessage}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setToastMessage(null)} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default ProjectHome;
