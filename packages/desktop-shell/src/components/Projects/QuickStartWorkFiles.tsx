import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button, Fade, CircularProgress, Chip, Popover } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { WorkFile } from '../../features/projects/types';
import { WorkFileRepository } from '../../features/projects/workFileRepository';
import { useWorkFileStore } from '../../store/useWorkFileStore';
import { useAppStore } from '../../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { PreviewDialog } from './PreviewDialog';
import { createNextLocalVersion, constructLocalDirPath, getLocalVersions, getAllLocalVersions } from '../../features/projects/utils/workFileFsHelpers';
import type { LocalVersionInfo } from '../../features/projects/utils/workFileFsHelpers';

interface Props {
  projectId: string;
  projectName?: string;
}

export const QuickStartWorkFiles: React.FC<Props> = ({ projectId, projectName }) => {
  const [workFiles, setWorkFiles] = useState<WorkFile[]>([]);
  const [loading, setLoading] = useState(true);
  const bindings = useWorkFileStore(state => state.bindings);

  // Click Popover State
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activePopoverFile, setActivePopoverFile] = useState<WorkFile | null>(null);

  // Launch State
  const [launchingFileId, setLaunchingFileId] = useState<string | null>(null);

  // Preview Dialog State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string, version?: string, tool?: string, fileId?: string, localPath?: string } | null>(null);

  const lastUpdated = useWorkFileStore(state => state.lastUpdated);

  useEffect(() => {
    if (!projectId) return;
    const loadFiles = async () => {
      try {
        setLoading(true);
        const files = await WorkFileRepository.getWorkFiles(projectId);
        const sorted = files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setWorkFiles(sorted); 
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [projectId, lastUpdated]);

  const handleCardClick = (e: React.MouseEvent<HTMLElement>, file: WorkFile) => {
    setAnchorEl(e.currentTarget);
    setActivePopoverFile(file);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setActivePopoverFile(null);
  };

  const handleLaunchLatest = async (e: React.MouseEvent, file: WorkFile) => {
    e.stopPropagation();
    const binding = bindings[file.id];
    if (binding && binding.existsLocally) {
      try {
        setLaunchingFileId(file.id);
        useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'アプリ');

        // ==== V3: ALWAYS duplicate history on "Open Latest" ====
        const dirPath = await constructLocalDirPath(projectId, file.id, projectName, file.name, file.toolType, file.appScope);
        const timestampPath = await createNextLocalVersion(dirPath, file.name);

        await invoke('launch_rhino', { templatePath: '', targetFilePath: timestampPath });
        
        // 外部重負荷アプリの起動待ち時間（UX向上のための意図的ディレイ）
        await new Promise(resolve => setTimeout(resolve, 4500));

        useWorkFileStore.getState().saveBinding(file.id, {
          ...binding,
          localPath: timestampPath,
          openedVersionId: undefined, 
          lastOpenedAt: new Date().toISOString()
        });

        await WorkFileRepository.updateWorkFileTime(projectId, file.id, 'desktop-user');
      } catch(err) {
        console.error("Failed to launch application:", err);
      } finally {
        setLaunchingFileId(null);
        useAppStore.getState().setGlobalLaunchingTool(null);
      }
    } else {
      console.warn("ローカルファイルが見つかりません。");
    }
  };

  const openPreview = (e: React.MouseEvent, file: WorkFile, versionPath?: string) => {
    e.stopPropagation();
    const binding = bindings[file.id];
    setPreviewFile({ 
      name: file.name, 
      version: versionPath ? versionPath.split(/[\\/]/).pop()! : 'Latest', 
      tool: file.toolType, 
      fileId: file.id, 
      localPath: versionPath || binding?.localPath 
    });
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, display: "flex", gap: 2, alignItems: "center" }}>
        <CircularProgress size={20} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.3)" }} />
        <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)" }}>作業ハブを準備中...</Typography>
      </Box>
    );
  }

  if (workFiles.length === 0) return null;

  const activeFileId = workFiles.length > 0 ? workFiles[0].id : null;

  return (
    <Fade in>
      <Box sx={{ mt: 5, width: "100%", position: "relative", zIndex: 10, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontWeight: 700, mb: 1.5, letterSpacing: 1 }}>
          作業を開始する (クリックで履歴を表示)
        </Typography>
        
        {/* Horizontal Scroll List */}
        <Box sx={{ 
          display: "flex", gap: 1.5, overflowX: "auto", pb: 2, width: "100%", minWidth: 0,
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 4 },
          '&::-webkit-scrollbar-track': { backgroundColor: 'light-dark(rgba(15,23,42,0.03), rgba(0,0,0,0.1))', borderRadius: 4 },
        }}>
          {workFiles.map(file => {
            const hasLocal = !!bindings[file.id]?.existsLocally;
            const isActive = file.id === activeFileId;
            const isPopoverOpen = activePopoverFile?.id === file.id;
            const isLaunching = launchingFileId === file.id;

            return (
              <Paper
                key={file.id}
                onClick={(e) => handleCardClick(e, file)}
                sx={{
                  minWidth: 320,
                  flex: "0 0 auto",
                  p: 2,
                  bgcolor: isPopoverOpen || isActive ? "rgba(0,191,255,0.15)" : "rgba(0,0,0,0.4)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: `1px solid ${isPopoverOpen || isActive ? "rgba(0,191,255,0.6)" : "rgb(var(--brand-fg-rgb) / 0.1)"}`,
                  boxShadow: isPopoverOpen || isActive ? "0 4px 20px rgba(0,191,255,0.2)" : "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    bgcolor: isPopoverOpen || isActive ? "rgba(0,191,255,0.2)" : "rgb(var(--brand-fg-rgb) / 0.05)",
                    transform: "translateY(-2px)",
                    borderColor: isPopoverOpen || isActive ? "rgba(0,191,255,0.8)" : "rgb(var(--brand-fg-rgb) / 0.3)"
                  }
                }}
              >
                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
                      <Typography variant="subtitle2" sx={{ color: "var(--brand-fg)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </Typography>
                      {isActive && (
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#00BFFF", boxShadow: "0 0 8px #00BFFF", flexShrink: 0 }} />
                      )}
                    </Box>
                    <Chip 
                      size="small"
                      icon={<ExpandMoreRoundedIcon sx={{ fontSize: '1rem', color: "inherit" }} />}
                      label="履歴"
                      sx={{
                        height: 20,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)",
                        color: "rgb(var(--brand-fg-rgb) / 0.7)",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.2)", color: "var(--brand-fg)" }
                      }}
                    />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
                      更新: {new Date(file.updatedAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: hasLocal ? "#43e97b" : "rgb(var(--brand-fg-rgb) / 0.2)", fontSize: "0.6rem", fontWeight: 700 }}>
                      {hasLocal ? "Local Ready" : "Cloud"}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Explicit Actions: Preview & Open Latest */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={(e) => openPreview(e, file)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      py: 0.8,
                      borderRadius: 2,
                      borderColor: "rgb(var(--brand-fg-rgb) / 0.2)",
                      color: "rgb(var(--brand-fg-rgb) / 0.7)",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "rgb(var(--brand-fg-rgb) / 0.5)",
                        color: "var(--brand-fg)",
                        bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)"
                      }
                    }}
                  >
                    プレビュー
                  </Button>
                  
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!hasLocal || isLaunching}
                    onClick={(e) => handleLaunchLatest(e, file)}
                    startIcon={isLaunching ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      py: 0.8,
                      borderRadius: 2,
                      bgcolor: isActive || isPopoverOpen ? "#00BFFF" : "rgb(var(--brand-fg-rgb) / 0.1)",
                      color: isActive || isPopoverOpen ? "#000" : "var(--brand-fg)",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      textTransform: "none",
                      boxShadow: isActive || isPopoverOpen ? "0 4px 12px rgba(0,191,255,0.3)" : "none",
                      "&:hover": {
                        bgcolor: isActive || isPopoverOpen ? "#4facfe" : "rgb(var(--brand-fg-rgb) / 0.2)"
                      },
                      "&.Mui-disabled": {
                        bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)",
                        color: "rgb(var(--brand-fg-rgb) / 0.2)"
                      }
                    }}
                  >
                    {isLaunching ? "起動中..." : "最新版を開く"}
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Box>

        {/* Click Popover Timeline */}
        <Popover
          open={Boolean(anchorEl) && Boolean(activePopoverFile)}
          anchorEl={anchorEl}
          onClose={handleClosePopover}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          disableRestoreFocus
          sx={{ mt: 1 }}
          PaperProps={{
            sx: {
              bgcolor: "light-dark(rgba(255,255,255,0.92), rgba(10,15,25,0.9))",
              backdropFilter: "blur(25px)",
              border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)",
              borderRadius: 3,
              p: 2,
              minWidth: 320,
              maxWidth: 380,
              maxHeight: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
            }
          }}
        >
          {activePopoverFile && (
            <HoverTimeline 
              projectId={projectId} 
              projectName={projectName}
              file={activePopoverFile} 
              onPreview={(e, path) => openPreview(e, activePopoverFile, path)}
            />
          )}
        </Popover>

        {/* Generic Preview Dialog */}
        {previewFile && (
          <PreviewDialog
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            fileName={previewFile.name}
            versionName={previewFile.version}
            toolType={previewFile.tool}
            workFileId={previewFile.fileId}
            localPath={previewFile.localPath}
          />
        )}
      </Box>
    </Fade>
  );
};

// Subcomponent to fetch and render the mini timeline inside the Popover
const HoverTimeline: React.FC<{ projectId: string, projectName?: string, file: WorkFile, onPreview: (e: React.MouseEvent, path: string) => void }> = ({ projectId, projectName, file, onPreview }) => {
  const [versions, setVersions] = useState<LocalVersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const bindings = useWorkFileStore(state => state.bindings);
  const hasLocal = !!bindings[file.id]?.existsLocally;
  const [launchingVersionId, setLaunchingVersionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchLocal = async () => {
      try {
        setLoading(true);
        const vers = await getAllLocalVersions(projectId, file.id, projectName, file.name, file.toolType, file.appScope);
        if (active) {
          setVersions(vers);
        }
      } catch (err) {
         console.error(err);
      } finally {
         if (active) setLoading(false);
      }
    };
    fetchLocal();

    return () => { active = false; };
  }, [projectId, file.id]);

  const handleLaunchVersion = async (e: React.MouseEvent, versionPath: string) => {
    e.stopPropagation();
    const binding = bindings[file.id];
    if (binding && binding.existsLocally) {
      try {
        setLaunchingVersionId(versionPath);
        useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'アプリ');
        await invoke('launch_rhino', { templatePath: '', targetFilePath: versionPath });
        
        // 外部重負荷アプリの起動待ち時間
        await new Promise(resolve => setTimeout(resolve, 4500));

        useWorkFileStore.getState().saveBinding(file.id, {
          ...binding,
          openedVersionId: undefined, 
          lastOpenedAt: new Date().toISOString()
        });

        await WorkFileRepository.updateWorkFileTime(projectId, file.id, 'desktop-user');
      } catch(err) {
        console.error("Failed to launch application:", err);
      } finally {
        setLaunchingVersionId(null);
        useAppStore.getState().setGlobalLaunchingTool(null);
      }
    } else {
      console.warn("ローカルファイルが見つかりません。");
    }
  };

  if (loading) return <CircularProgress size={16} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.3)", m: 2 }} />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="overline" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 800, letterSpacing: 1 }}>
          すべての履歴 (Versions)
        </Typography>
      </Box>

      {versions.length === 0 ? (
        <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>履歴はありません</Typography>
      ) : (
        <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", left: 7, top: 4, bottom: 12, width: 2, bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 1 } }}>
          {versions.map((ver, idx) => {
            const isCurrent = idx === 0;
            const displayName = ver.name;
            const isLaunching = launchingVersionId === ver.path;
            
            return (
              <Box 
                key={ver.path} 
                sx={{ 
                  position: "relative", 
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)",
                  border: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
                  transition: "all 0.2s",
                  "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)", borderColor: "rgba(0,191,255,0.3)" }
                }}
              >
                {/* Timeline Node */}
                <Box sx={{ 
                  position: "absolute", left: -25, top: 16, width: 10, height: 10, borderRadius: "50%", 
                  bgcolor: isCurrent ? "#00BFFF" : "rgb(var(--brand-fg-rgb) / 0.2)",
                  boxShadow: isCurrent ? "0 0 10px rgba(0,191,255,0.6)" : "none",
                  border: "2px solid #080c14",
                  transition: "all 0.2s",
                  ".MuiBox-root:hover &": {
                    transform: "scale(1.2)",
                    bgcolor: "#4facfe"
                  }
                }} />

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: isCurrent ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", fontWeight: isCurrent ? 800 : 500, fontSize: "0.85rem" }}>
                        {displayName}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: "0.65rem" }}>
                      {ver.createdAt.toLocaleString('ja-JP')}
                    </Typography>
                  </Box>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1.5, color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: "0.75rem" }}>
                  {isCurrent ? "最新のローカルフォルダー" : "過去のコピー"}
                </Typography>

                {/* Explicit Actions per version */}
                <Box sx={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={(e) => onPreview(e, ver.path)}
                    sx={{ flex: 1, minWidth: 0, py: 0.5, fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--brand-fg-rgb) / 0.7)", borderColor: "rgb(var(--brand-fg-rgb) / 0.2)", textTransform: "none", "&:hover": { borderColor: "rgb(var(--brand-fg-rgb) / 0.5)", color: "var(--brand-fg)" } }}
                  >
                    プレビュー
                  </Button>
                  <Button 
                    size="small" 
                    variant="contained"
                    disabled={!hasLocal || isLaunching}
                    onClick={(e) => handleLaunchVersion(e, ver.path)}
                    startIcon={isLaunching ? <CircularProgress size={12} color="inherit" /> : undefined}
                    sx={{ flex: 1, minWidth: 0, py: 0.5, fontSize: "0.7rem", fontWeight: 700, bgcolor: "rgba(0,191,255,0.15)", color: "#00BFFF", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "rgba(0,191,255,0.3)", boxShadow: "none" }, "&.Mui-disabled": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)" } }}
                  >
                    {isLaunching ? "起動中..." : "この版で開く"}
                  </Button>
                </Box>

              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
