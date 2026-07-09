import React, { useState, useEffect } from 'react';
import { Box, Typography, Snackbar, Alert, Paper, Button, Tabs, Tab } from '@mui/material';
import { LayoutTemplate } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkFileStore } from '../store/useWorkFileStore';
import { WorkFileRepository } from '../features/projects/workFileRepository';
import type { RhinoTemplate, ActivityItem } from '../features/projects/types';
import { invoke } from '@tauri-apps/api/core';
import RhinoTemplateDialog from '../components/Projects/RhinoTemplateDialog';
import { ProjectHomeHero } from '../components/Projects/ProjectHomeHero';
import { constructLocalDirPath, createNextLocalVersion } from '../features/projects/utils/workFileFsHelpers';
import { ProjectActivityFeed } from '../components/Projects/ProjectActivityFeed';
import { WorkFilesList } from '../components/Projects/WorkFilesList';
import { SchedulesTasksList } from '../components/Projects/SchedulesTasksList';

const ProjectHome: React.FC = () => {
  const { getActiveProject, setGlobalLaunchingTool, setAIChatOpen } = useAppStore();
  const activeProject = getActiveProject();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isRhinoDialogOpen, setIsRhinoDialogOpen] = useState(false);
  
  const { currentUser } = useAuthStore.getState();

  useEffect(() => {
    setAIChatOpen(true);
  }, [setAIChatOpen]);

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

      const dirPath = await constructLocalDirPath(activeProject.id, createdWorkFile.id, activeProject.name, createdWorkFile.name, createdWorkFile.toolType);
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
    { id: 'home', label: 'ホーム' },
    { id: 'workfiles', label: 'WorkFiles' },
    { id: 'schedule', label: 'Schedules & Tasks' },
  ];

  if (!activeProject) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, boxSizing: 'border-box' }}>
        <Box sx={{ width: '100%', maxWidth: 640, textAlign: 'center', p: 5, border: `1px dashed rgba(255,255,255,0.15)`, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.2)' }}>
          <LayoutTemplate size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
          <Typography variant="h6" color="#fff" sx={{ fontWeight: 600, mb: 1 }}>No Project Selected</Typography>
          <Typography color="rgba(255,255,255,0.5)" variant="body2">
            左側のサイドバーからプロジェクトを選択して、含まれるワークスペースやリソースを表示してください。
          </Typography>
        </Box>
      </Box>
    );
  }

  // Journals are now fetched directly by ProjectActivityFeed via useJournalStore

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minWidth: 0, bgcolor: "rgba(10, 15, 25, 0.4)", overflowY: "auto", boxSizing: "border-box", scrollBehavior: "smooth" }}>
      
      {/* Top Navigation Bar mimicking Web's WebsiteHeaderNav */}
      <Box sx={{ 
        px: { xs: 2, md: 3, lg: 4 }, 
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        bgcolor: "rgba(10, 15, 25, 0.8)",
        backdropFilter: "blur(10px)",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 1100
      }}>
        <Tabs 
          value={activeTab} 
          onChange={(_e, val) => setActiveTab(val)} 
          variant="scrollable"
          scrollButtons="auto"
          textColor="inherit" 
          indicatorColor="primary"
          sx={{ 
            minHeight: 40,
            "& .MuiTabs-indicator": {
              height: 3,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
              bgcolor: "#00BFFF"
            }
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
                fontWeight: activeTab === s.id ? 700 : 500,
                fontSize: 13,
                color: activeTab === s.id ? "#fff" : "rgba(255,255,255,0.6)",
                transition: "color 0.2s",
                "&:hover": { color: "#fff" }
              }} 
            />
          ))}
        </Tabs>
      </Box>

      {activeTab === 'home' ? (
        <React.Fragment>
          <ProjectHomeHero project={activeProject} />

          <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 4, flex: 1, width: "100%", boxSizing: "border-box", maxWidth: 1600, mx: "auto", display: "flex", gap: { xs: 3, lg: 4 } }}>
            {/* Main Scrolling Body: Single Column Timeline */}
            <Box sx={{ flex: 1, minWidth: 0, pb: 10 }}>
              
              <Box sx={{ display: "flex", flexDirection: "column", maxWidth: 800, mx: "auto" }}>
                {/* Main Content Column */}
                <Box sx={{ flex: 1, minWidth: 0 }}>

                  {/* Recent Activity Feed */}
                  <Box id="activity-preview" sx={{ mb: 8, scrollMarginTop: 100 }}>
                    <ProjectActivityFeed />
                  </Box>

                </Box>
              </Box>
            </Box>
          </Box>
        </React.Fragment>
      ) : activeTab === 'workfiles' ? (
        <WorkFilesList project={activeProject} />
      ) : activeTab === 'schedule' ? (
        <SchedulesTasksList project={activeProject} />
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
