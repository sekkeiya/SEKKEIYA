import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button, Chip, Collapse, CircularProgress } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { WorkFile } from '../../features/projects/types';
import { WorkFileRepository } from '../../features/projects/workFileRepository';
import { useWorkFileStore } from '../../store/useWorkFileStore';
import { useAppStore } from '../../store/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { PreviewDialog } from './PreviewDialog';
import { createNextLocalVersion, constructLocalDirPath, getLocalVersions, getAllLocalVersions } from '../../features/projects/utils/workFileFsHelpers';
import type { LocalVersionInfo } from '../../features/projects/utils/workFileFsHelpers';

interface Props {
  project: any;
  onOpenWorkFilesTab: () => void;
  onOpenTemplateDialog?: () => void;
}

export const OverviewRightWorkFiles: React.FC<Props> = ({ project, onOpenWorkFilesTab, onOpenTemplateDialog }) => {
  const [workFiles, setWorkFiles] = useState<WorkFile[]>([]);
  const [loading, setLoading] = useState(true);
  const bindings = useWorkFileStore(state => state.bindings);
  const lastUpdated = useWorkFileStore(state => state.lastUpdated);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Launch State
  const [launchingFileId, setLaunchingFileId] = useState<string | null>(null);

  // Preview Dialog State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string, version?: string, tool?: string, fileId?: string, localPath?: string } | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    const loadFiles = async () => {
      try {
        setLoading(true);
        const files = await WorkFileRepository.getWorkFiles(project.id);
        const sorted = files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setWorkFiles(sorted.slice(0, 6));
      } catch (err) {
        console.error("Failed to load work files", err);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [project?.id, lastUpdated]);

  const handleOpenLocal = async (e: React.MouseEvent, file: WorkFile) => {
    e.stopPropagation();
    const binding = bindings[file.id];
    if (binding && binding.existsLocally) {
      try {
        setLaunchingFileId(file.id);
        useAppStore.getState().setGlobalLaunchingTool(file.toolType || 'アプリ');

        // ==== V3: ALWAYS duplicate history on "Open Latest" ====
        const dirPath = await constructLocalDirPath(project.id, file.id, project?.name, file.name, file.toolType, file.appScope);
        const timestampPath = await createNextLocalVersion(dirPath, file.name);

        await invoke('launch_rhino', { templatePath: '', targetFilePath: timestampPath });
        
        // 外部重負荷アプリの起動待ち時間
        await new Promise(resolve => setTimeout(resolve, 4500));

        useWorkFileStore.getState().saveBinding(file.id, {
          ...binding,
          localPath: timestampPath,
          openedVersionId: undefined,
          lastOpenedAt: new Date().toISOString()
        });

        await WorkFileRepository.updateWorkFileTime(project.id, file.id, 'desktop-user');
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

  const getStatus = (fileId: string) => {
    const binding = bindings[fileId];
    if (!binding) return { label: "クラウドのみ", color: "var(--brand-fg)", bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)" };
    if (binding.existsLocally) return { label: "ローカル接続済", color: "#43e97b", bgcolor: "rgba(67, 233, 123, 0.1)" };
    return { label: "未リンク", color: "light-dark(#a80637, #fa709a)", bgcolor: "rgba(250, 112, 154, 0.1)" };
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: "var(--brand-fg)", fontWeight: 800 }}>
          作業ライン構造 (Work Files)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button 
            size="small" 
            onClick={onOpenTemplateDialog}
            sx={{ textTransform: 'none', color: '#00BFFF', minWidth: 0, p: 0, fontSize: '0.75rem', fontWeight: 700 }}
          >
            新規作成
          </Button>
          <Button 
            size="small" 
            onClick={onOpenWorkFilesTab}
            sx={{ textTransform: 'none', color: '#00BFFF', minWidth: 0, p: 0, fontSize: '0.75rem', fontWeight: 700 }}
          >
            すべて管理する
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: 13 }}>読み込み中...</Typography>
      ) : workFiles.length === 0 ? (
        <Paper sx={{ p: 3, bgcolor: "rgba(0,191,255,0.05)", border: "1px dashed rgba(0,191,255,0.3)", borderRadius: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 32, color: "#00BFFF", mb: 1.5, opacity: 0.8 }} />
          <Typography sx={{ color: "var(--brand-fg)", fontWeight: 700, mb: 1, fontSize: 15 }}>
            3Dソフトウェアでの作業を開始
          </Typography>
          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, mb: 3, lineHeight: 1.6 }}>
            プロジェクトが作成されました。まずはWork Fileを作成して、Rhinoなどのソフトウェアを起動しましょう。
          </Typography>
          <Button 
            variant="contained" 
            onClick={onOpenTemplateDialog}
            sx={{ 
              bgcolor: "#00BFFF", color: "#000", fontWeight: 800, 
              textTransform: "none", borderRadius: 2, px: 3, py: 1,
              "&:hover": { bgcolor: "#4facfe" } 
            }}
          >
            テンプレートから作業を開始
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {workFiles.map(file => {
            const status = getStatus(file.id);
            const hasLocal = !!bindings[file.id]?.existsLocally;
            const isExpanded = expandedId === file.id;
            const isLaunching = launchingFileId === file.id;
            
            return (
              <Paper 
                key={file.id}
                onClick={() => setExpandedId(isExpanded ? null : file.id)}
                sx={{ 
                  p: 1.5, 
                  bgcolor: isExpanded ? "rgba(0,191,255,0.05)" : "rgb(var(--brand-fg-rgb) / 0.02)", 
                  border: `1px solid ${isExpanded ? "rgba(0,191,255,0.3)" : "rgb(var(--brand-fg-rgb) / 0.08)"}`, 
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    bgcolor: isExpanded ? "rgba(0,191,255,0.05)" : "rgb(var(--brand-fg-rgb) / 0.05)",
                    borderColor: "rgba(0,191,255,0.3)"
                  }
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: "var(--brand-fg)", fontWeight: 700, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, mr: 1, display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountTreeRoundedIcon sx={{ fontSize: 16, color: "rgb(var(--brand-fg-rgb) / 0.5)" }} />
                    {file.name}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip 
                      size="small" 
                      label={status.label} 
                      sx={{ 
                        height: 20, 
                        fontSize: "0.65rem", 
                        bgcolor: status.bgcolor, 
                        color: status.color,
                        fontWeight: 700
                      }} 
                    />
                    <ExpandMoreRoundedIcon sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", fontSize: 20, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </Box>
                </Box>
                
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>
                    最終更新: {new Date(file.updatedAt).toLocaleDateString()}
                  </Typography>
                  
                  {/* Explicit Actions: Preview & Open Latest */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={(e) => openPreview(e, file)}
                      sx={{
                        minWidth: 0,
                        py: 0.4,
                        px: 1.5,
                        borderRadius: 2,
                        borderColor: "rgb(var(--brand-fg-rgb) / 0.2)",
                        color: "rgb(var(--brand-fg-rgb) / 0.7)",
                        fontWeight: 700,
                        fontSize: "0.7rem",
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
                      size="small"
                      variant="contained"
                      disabled={!hasLocal || isLaunching}
                      onClick={(e) => handleOpenLocal(e, file)}
                      startIcon={isLaunching ? <CircularProgress size={14} color="inherit" /> : undefined}
                      sx={{ 
                        minWidth: 0,
                        py: 0.4,
                        px: 1.5,
                        borderRadius: 2,
                        bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)",
                        color: "var(--brand-fg)",
                        fontWeight: 800,
                        fontSize: "0.7rem",
                        textTransform: "none",
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "rgb(var(--brand-fg-rgb) / 0.2)",
                          boxShadow: "none"
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
                </Box>

                <Collapse in={isExpanded} unmountOnExit>
                  <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed rgb(var(--brand-fg-rgb) / 0.1)" }}>
                    <OverviewTimeline 
                      projectId={project.id} 
                      projectName={project?.name}
                      file={file} 
                      onPreview={(e, path) => openPreview(e, file, path)}
                    />
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

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
  );
};

// Inline Timeline Component for OverviewRightWorkFiles
const OverviewTimeline: React.FC<{ projectId: string, projectName?: string, file: WorkFile, onPreview: (e: React.MouseEvent, path: string) => void }> = ({ projectId, projectName, file, onPreview }) => {
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

  if (loading) return <CircularProgress size={16} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.3)", m: 1 }} />;

  return (
    <Box>
      {versions.length === 0 ? (
        <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", mt: 1 }}>履歴はありません</Typography>
      ) : (
        <Box sx={{ mt: 1, position: "relative", pl: 1.5, "&::before": { content: '""', position: "absolute", left: 7, top: 4, bottom: 8, width: 2, bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", borderRadius: 1 } }}>
          {versions.map((ver, idx) => {
            const isCurrent = idx === 0;
            const displayName = ver.name;
            const isLaunching = launchingVersionId === ver.path;

            return (
              <Box 
                key={ver.path} 
                sx={{ 
                  position: "relative", 
                  mb: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgb(var(--brand-fg-rgb) / 0.02)",
                  border: "1px solid rgb(var(--brand-fg-rgb) / 0.05)",
                  transition: "all 0.2s"
                }}
              >
                <Box sx={{ 
                  position: "absolute", left: -21, top: 12, width: 8, height: 8, borderRadius: "50%", 
                  bgcolor: isCurrent ? "#00BFFF" : "rgb(var(--brand-fg-rgb) / 0.2)",
                  boxShadow: isCurrent ? "0 0 10px rgba(0,191,255,0.6)" : "none",
                  border: "2px solid #080c14"
                }} />

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: isCurrent ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", fontWeight: isCurrent ? 800 : 500, fontSize: "0.75rem" }}>
                        {displayName}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.4)", fontSize: "0.6rem" }}>
                      {ver.createdAt.toLocaleString('ja-JP')}
                    </Typography>
                  </Box>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1, color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: "0.7rem" }}>
                  {isCurrent ? "最新のローカルフォルダー" : "過去のコピー"}
                </Typography>

                {/* Explicit Actions per version */}
                <Box sx={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={(e) => onPreview(e, ver.path)}
                    startIcon={<VisibilityRoundedIcon sx={{ fontSize: '0.8rem' }}/>}
                    sx={{ flex: 1, minWidth: 0, py: 0.3, fontSize: "0.65rem", fontWeight: 700, color: "rgb(var(--brand-fg-rgb) / 0.7)", borderColor: "rgb(var(--brand-fg-rgb) / 0.2)", textTransform: "none", "&:hover": { borderColor: "rgb(var(--brand-fg-rgb) / 0.5)", color: "var(--brand-fg)" } }}
                  >
                    プレビュー
                  </Button>
                  <Button 
                    size="small" 
                    variant="contained"
                    disabled={!hasLocal || isLaunching}
                    onClick={(e) => handleLaunchVersion(e, ver.path)}
                    startIcon={isLaunching ? <CircularProgress size={12} color="inherit" /> : undefined}
                    sx={{ flex: 1, minWidth: 0, py: 0.3, fontSize: "0.65rem", fontWeight: 700, bgcolor: "rgba(0,191,255,0.15)", color: "#00BFFF", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "rgba(0,191,255,0.3)", boxShadow: "none" }, "&.Mui-disabled": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.05)" } }}
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
