import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkFileStore } from '../../store/useWorkFileStore';
import { WorkFilesList } from './WorkFilesList';
import { TemplatesPanel } from './TemplatesPanel';
import { AllCadFilesView } from './AllCadFilesView';
import { WorkFileRepository } from '../../features/projects/workFileRepository';
import { TemplateRepository } from '../../features/projects/templateRepository';
import type { DesktopProject, WorkFile, RhinoTemplate } from '../../features/projects/types';

const TEMPLATES_ID = '__templates__';
const ALL_ID = '__all__';

const isCADFile = (file: WorkFile) => !file.appScope && !!file.toolType && file.toolType !== 'other';

interface AllProjectsFilesListProps {
  /** cad = CAD Files（Rhino/Blender 等）, other = それ以外の Work Files */
  filterMode: 'cad' | 'other';
  /** 表示するプロジェクト。省略時はストアの全プロジェクト（アカウントサイト用）。 */
  projects?: DesktopProject[];
}

/**
 * ファイル管理ビュー（エクスプローラー風）。アカウントサイト＝全プロジェクト、
 * プロジェクトサイト＝単一プロジェクトを projects で渡して共用する。
 *
 * 左サイドバーはネスト可能なツリー:
 *   - フォルダ行（テンプレート / ALL / 各プロジェクト）クリック → メインエリアに一覧表示
 *   - ▼ シェブロン → 展開して子（ファイル / テンプレート）を遅延ロードで表示
 *   - 子行クリック → 該当ビューでそのファイルを選択し、プレビュー・詳細を表示
 */
export const AllProjectsFilesList: React.FC<AllProjectsFilesListProps> = ({ filterMode, projects: projectsProp }) => {
  const storeProjects = useAppStore(s => s.projects);
  const projects = projectsProp ?? storeProjects;
  const { currentUser } = useAuthStore();
  const lastUpdated = useWorkFileStore(s => s.lastUpdated);

  const accent = filterMode === 'cad' ? '#fa709a' : '#00BFFF';
  const showTemplates = filterMode === 'cad';

  // My / Team でグループ化
  const { myProjects, teamProjects } = useMemo(() => ({
    myProjects: projects.filter(p => !p.isTeam),
    teamProjects: projects.filter(p => p.isTeam),
  }), [projects]);

  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const isTemplatesView = selectedId === TEMPLATES_ID;
  const isAllView = selectedId === ALL_ID;
  const selectedProject = projects.find(p => p.id === selectedId) ?? null;

  // ── ツリー展開状態と子データ（遅延ロード） ──
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filesByProject, setFilesByProject] = useState<Record<string, WorkFile[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Record<string, boolean>>({});
  const [sidebarTemplates, setSidebarTemplates] = useState<RhinoTemplate[] | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const fetchProjectFiles = useCallback((projectId: string) => {
    setLoadingProjects(prev => ({ ...prev, [projectId]: true }));
    WorkFileRepository.getWorkFiles(projectId)
      .then(files => {
        const filtered = files
          .filter(f => !f.isDeleted)
          .filter(f => (filterMode === 'cad' ? isCADFile(f) : !isCADFile(f)))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setFilesByProject(prev => ({ ...prev, [projectId]: filtered }));
      })
      .catch(() => setFilesByProject(prev => ({ ...prev, [projectId]: [] })))
      .finally(() => setLoadingProjects(prev => ({ ...prev, [projectId]: false })));
  }, [filterMode]);

  const fetchTemplates = useCallback(() => {
    setTemplatesLoading(true);
    TemplateRepository.getTemplates(currentUser?.uid)
      .then(setSidebarTemplates)
      .catch(() => setSidebarTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [currentUser?.uid]);

  const toggleExpand = (id: string) => {
    const willExpand = !expanded[id];
    setExpanded(prev => ({ ...prev, [id]: willExpand }));
    if (!willExpand) return;
    if (id === TEMPLATES_ID) {
      if (!sidebarTemplates) fetchTemplates();
    } else if (!filesByProject[id]) {
      fetchProjectFiles(id);
    }
  };

  // ファイル更新通知（アップロード等）が来たら、ロード済みプロジェクトを再取得
  useEffect(() => {
    if (!lastUpdated) return;
    Object.keys(filesByProject).forEach(fetchProjectFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  // 選択中の項目が現在のプロジェクト集合に存在しなくなったら先頭へフォールバック
  useEffect(() => {
    if (selectedId === TEMPLATES_ID || selectedId === ALL_ID) return;
    if (!projects.find(p => p.id === selectedId)) {
      setSelectedId(projects[0]?.id ?? null);
      setSelectedFileId(null);
    }
  }, [projects, selectedId]);

  // ── 選択ハンドラ ──
  const selectFolder = (id: string) => {
    setSelectedId(id);
    setSelectedFileId(null);
    setSelectedTemplateId(null);
  };

  const selectFile = (projectId: string, fileId: string) => {
    setSelectedId(projectId);
    setSelectedFileId(fileId);
    setSelectedTemplateId(null);
    setExpanded(prev => ({ ...prev, [projectId]: true }));
    if (!filesByProject[projectId]) fetchProjectFiles(projectId);
  };

  const selectTemplate = (templateId: string) => {
    setSelectedId(TEMPLATES_ID);
    setSelectedTemplateId(templateId);
    setSelectedFileId(null);
  };

  // ── ツリー行のレンダリング ──

  /** 展開シェブロン */
  const chevron = (id: string, hasChildren: boolean) => (
    <Box
      onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(id); }}
      sx={{
        width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, borderRadius: 0.75,
        cursor: hasChildren ? 'pointer' : 'default',
        visibility: hasChildren ? 'visible' : 'hidden',
        '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
      }}
    >
      <ExpandMoreRoundedIcon sx={{
        fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.45)',
        transform: expanded[id] ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.15s',
      }} />
    </Box>
  );

  /** 子（ファイル / テンプレート）行 */
  const childRow = (key: string, label: string, active: boolean, onClick: () => void, Icon: typeof InsertDriveFileRoundedIcon = InsertDriveFileRoundedIcon) => (
    <Box
      key={key}
      onClick={onClick}
      title={label}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        pl: 4.25, pr: 1, py: 0.55, mx: 0.5, borderRadius: 1.5, cursor: 'pointer',
        color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)',
        bgcolor: active ? `${accent}1c` : 'transparent',
        borderLeft: `2px solid ${active ? accent : 'transparent'}`,
        transition: 'background-color 0.15s, color 0.15s',
        '&:hover': { bgcolor: active ? `${accent}1c` : 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'var(--brand-fg)' },
      }}
    >
      <Icon sx={{ fontSize: 14, color: active ? accent : 'rgb(var(--brand-fg-rgb) / 0.3)', flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );

  const childLoadingRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4.5, py: 0.5 }}>
      <CircularProgress size={12} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
    </Box>
  );

  const childEmptyRow = (label: string) => (
    <Typography sx={{ pl: 4.5, py: 0.4, fontSize: '0.66rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)' }}>
      {label}
    </Typography>
  );

  /** プロジェクト行 + 展開時の子ファイル */
  const renderProjectItem = (p: { id: string; name: string }) => {
    const active = p.id === selectedId && !selectedFileId;
    const files = filesByProject[p.id];
    return (
      <Box key={p.id}>
        <Box
          onClick={() => selectFolder(p.id)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            pl: 0.5, pr: 1.25,
            py: 0.85,
            mx: 0.5,
            borderRadius: 1.5,
            cursor: 'pointer',
            color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.65)',
            bgcolor: active ? `${accent}22` : 'transparent',
            borderLeft: `2px solid ${active ? accent : 'transparent'}`,
            transition: 'background-color 0.15s, color 0.15s',
            '&:hover': { bgcolor: active ? `${accent}22` : 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'var(--brand-fg)' },
          }}
        >
          {chevron(p.id, true)}
          {active || (p.id === selectedId)
            ? <FolderOpenRoundedIcon sx={{ fontSize: 18, color: accent, flexShrink: 0 }} />
            : <FolderRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.35)', flexShrink: 0 }} />}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ml: 0.5 }}>
            {p.name}
          </Typography>
        </Box>
        {expanded[p.id] && (
          loadingProjects[p.id] ? childLoadingRow
            : !files || files.length === 0 ? childEmptyRow('ファイルなし')
            : files.map(f => childRow(
                f.id, f.name,
                selectedId === p.id && selectedFileId === f.id,
                () => selectFile(p.id, f.id),
              ))
        )}
      </Box>
    );
  };

  /** プロジェクトではない固定項目（テンプレート / ALL）の行 */
  const renderSpecialItem = (id: string, label: string, Icon: typeof StraightenRoundedIcon, nestable: boolean) => {
    const active = selectedId === id && !selectedTemplateId;
    return (
      <Box
        onClick={() => selectFolder(id)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.5, pr: 1.25, py: 0.85, mx: 0.5, mt: 0.5,
          borderRadius: 1.5, cursor: 'pointer',
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
          bgcolor: active ? `${accent}22` : 'transparent',
          borderLeft: `2px solid ${active ? accent : 'transparent'}`,
          transition: 'background-color 0.15s, color 0.15s',
          '&:hover': { bgcolor: active ? `${accent}22` : 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'var(--brand-fg)' },
        }}
      >
        {chevron(id, nestable)}
        <Icon sx={{ fontSize: 18, color: active ? accent : 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: active ? 700 : 600, ml: 0.5 }}>{label}</Typography>
      </Box>
    );
  };

  /** テンプレートの子行 */
  const renderTemplateChildren = () => {
    if (!expanded[TEMPLATES_ID]) return null;
    if (templatesLoading) return childLoadingRow;
    if (!sidebarTemplates || sidebarTemplates.length === 0) return childEmptyRow('テンプレートなし');
    return sidebarTemplates.map(t => childRow(
      t.id, t.name,
      isTemplatesView && selectedTemplateId === t.id,
      () => selectTemplate(t.id),
      StraightenRoundedIcon,
    ));
  };

  const sectionLabel = (label: string) => (
    <Typography sx={{ px: 1.75, pt: 1.5, pb: 0.5, fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.6, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
      {label}
    </Typography>
  );

  if (projects.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <FolderOpenRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.2)', mb: 1 }} />
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.85rem' }}>
            プロジェクトがありません。
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {/* ── 左サイドバー: ツリー ── */}
      <Box sx={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, pt: 1.75, pb: 0.5 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: accent }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--brand-fg)' }}>
            {filterMode === 'cad' ? 'CAD Files' : 'Work Files'}
          </Typography>
        </Box>

        {/* CAD: 一番上にテンプレート項目 */}
        {showTemplates && (
          <>
            {renderSpecialItem(TEMPLATES_ID, 'テンプレート', StraightenRoundedIcon, true)}
            {renderTemplateChildren()}
          </>
        )}

        {/* 全プロジェクト横断のファイル一覧（ネストなし・一覧はメインエリアで） */}
        {renderSpecialItem(ALL_ID, 'ALL', AppsRoundedIcon, false)}

        {myProjects.length > 0 && sectionLabel('My Projects')}
        {myProjects.map(renderProjectItem)}

        {teamProjects.length > 0 && sectionLabel('Team Projects')}
        {teamProjects.map(renderProjectItem)}
      </Box>

      {/* ── メインエリア: テンプレート or 選択中プロジェクトのファイル ── */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isTemplatesView ? (
          <TemplatesPanel
            projects={projects.map(p => ({ id: p.id, name: p.name }))}
            externalSelectedId={selectedTemplateId}
            onSelectedIdChange={setSelectedTemplateId}
          />
        ) : isAllView ? (
          <AllCadFilesView
            projects={projects}
            filterMode={filterMode}
            accent={accent}
            onOpenFile={selectFile}
          />
        ) : selectedProject ? (
          /* key でプロジェクト切替時に WorkFilesList を作り直す。見出しは WorkFilesList 内のヘッダーに統一。 */
          <WorkFilesList
            key={selectedProject.id}
            project={selectedProject}
            filterMode={filterMode}
            externalSelectedFileId={selectedFileId}
            onSelectedFileChange={setSelectedFileId}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.85rem' }}>
              左のプロジェクトを選択してください。
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
