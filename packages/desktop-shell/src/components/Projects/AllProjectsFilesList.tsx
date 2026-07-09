import React, { useState, useMemo, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';

import { useAppStore } from '../../store/useAppStore';
import { WorkFilesList } from './WorkFilesList';
import { TemplatesPanel } from './TemplatesPanel';
import type { DesktopProject } from '../../features/projects/types';

const TEMPLATES_ID = '__templates__';

interface AllProjectsFilesListProps {
  /** cad = CAD Files（Rhino/Blender 等）, other = それ以外の Work Files */
  filterMode: 'cad' | 'other';
  /** 表示するプロジェクト。省略時はストアの全プロジェクト（アカウントサイト用）。 */
  projects?: DesktopProject[];
}

/**
 * ファイル管理ビュー（エクスプローラー風）。アカウントサイト＝全プロジェクト、
 * プロジェクトサイト＝単一プロジェクトを projects で渡して共用する。
 * 左サイドバーでプロジェクト（CAD では先頭に「テンプレート」）を選択し、
 * メインエリアに既存の WorkFilesList / TemplatesPanel を表示する。
 * リスト／グリッド表示の切り替えは WorkFilesList 内のトグルをそのまま利用する。
 */
export const AllProjectsFilesList: React.FC<AllProjectsFilesListProps> = ({ filterMode, projects: projectsProp }) => {
  const storeProjects = useAppStore(s => s.projects);
  const projects = projectsProp ?? storeProjects;

  const accent = filterMode === 'cad' ? '#fa709a' : '#00BFFF';
  const showTemplates = filterMode === 'cad';

  // My / Team でグループ化
  const { myProjects, teamProjects } = useMemo(() => ({
    myProjects: projects.filter(p => !p.isTeam),
    teamProjects: projects.filter(p => p.isTeam),
  }), [projects]);

  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const isTemplatesView = selectedId === TEMPLATES_ID;
  const selectedProject = projects.find(p => p.id === selectedId) ?? null;

  // 選択中の項目が現在のプロジェクト集合に存在しなくなったら先頭へフォールバック
  useEffect(() => {
    if (selectedId === TEMPLATES_ID) return;
    if (!projects.find(p => p.id === selectedId)) {
      setSelectedId(projects[0]?.id ?? null);
    }
  }, [projects, selectedId]);

  const renderProjectItem = (p: { id: string; name: string }) => {
    const active = p.id === selectedId;
    return (
      <Box
        key={p.id}
        onClick={() => setSelectedId(p.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.85,
          mx: 0.5,
          borderRadius: 1.5,
          cursor: 'pointer',
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          bgcolor: active ? `${accent}22` : 'transparent',
          borderLeft: `2px solid ${active ? accent : 'transparent'}`,
          transition: 'background-color 0.15s, color 0.15s',
          '&:hover': { bgcolor: active ? `${accent}22` : 'rgba(255,255,255,0.05)', color: '#fff' },
        }}
      >
        {active
          ? <FolderOpenRoundedIcon sx={{ fontSize: 18, color: accent }} />
          : <FolderRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.35)' }} />}
        <Typography sx={{ fontSize: '0.8rem', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name}
        </Typography>
      </Box>
    );
  };

  const sectionLabel = (label: string) => (
    <Typography sx={{ px: 1.75, pt: 1.5, pb: 0.5, fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0.6, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
      {label}
    </Typography>
  );

  if (projects.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <FolderOpenRoundedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            プロジェクトがありません。
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      {/* ── 左サイドバー: プロジェクト一覧 ── */}
      <Box sx={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(0,0,0,0.2)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, pt: 1.75, pb: 0.5 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: accent }} />
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
            {filterMode === 'cad' ? 'CAD Files' : 'Work Files'}
          </Typography>
        </Box>

        {/* CAD: 一番上にテンプレート項目 */}
        {showTemplates && (
          <Box
            onClick={() => setSelectedId(TEMPLATES_ID)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.85, mx: 0.5, mt: 0.5, mb: 0.5,
              borderRadius: 1.5, cursor: 'pointer',
              color: isTemplatesView ? '#fff' : 'rgba(255,255,255,0.7)',
              bgcolor: isTemplatesView ? `${accent}22` : 'transparent',
              borderLeft: `2px solid ${isTemplatesView ? accent : 'transparent'}`,
              transition: 'background-color 0.15s, color 0.15s',
              '&:hover': { bgcolor: isTemplatesView ? `${accent}22` : 'rgba(255,255,255,0.05)', color: '#fff' },
            }}
          >
            <StraightenRoundedIcon sx={{ fontSize: 18, color: isTemplatesView ? accent : 'rgba(255,255,255,0.5)' }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: isTemplatesView ? 700 : 600 }}>テンプレート</Typography>
          </Box>
        )}

        {myProjects.length > 0 && sectionLabel('My Projects')}
        {myProjects.map(renderProjectItem)}

        {teamProjects.length > 0 && sectionLabel('Team Projects')}
        {teamProjects.map(renderProjectItem)}
      </Box>

      {/* ── メインエリア: テンプレート or 選択中プロジェクトのファイル ── */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isTemplatesView ? (
          <TemplatesPanel projects={projects.map(p => ({ id: p.id, name: p.name }))} />
        ) : selectedProject ? (
          /* key でプロジェクト切替時に WorkFilesList を作り直す。見出しは WorkFilesList 内のヘッダーに統一。 */
          <WorkFilesList key={selectedProject.id} project={selectedProject} filterMode={filterMode} />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
              左のプロジェクトを選択してください。
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
