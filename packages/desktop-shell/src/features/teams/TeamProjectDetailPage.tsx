import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Divider, Chip, CircularProgress, CardActionArea,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ArchitectureRoundedIcon from '@mui/icons-material/ArchitectureRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { BRAND } from '../../styles/theme';
import { ProjectIcon } from '../projects/components/ProjectIcon';
import { MemberRow } from './components/MemberRow';
import { applyOpenView, type ProjectViewTab } from '../../shared/navigation/openMainView';
import { fetchTeamProjectDetail, type TeamProjectDetail } from './api/teamsApi';

const projectHue = (name: string) =>
  [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ja-JP');
};

// プロジェクト詳細から開ける各ページ。ProjectHome の topNavItems と対応させる。
const ENTRIES: {
  tab: ProjectViewTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { tab: 'home', label: 'プロジェクトサイト', description: '公開ページの表示・編集', icon: <PublicRoundedIcon /> },
  { tab: 'schedule', label: 'Schedules & Tasks', description: '予定とタスクの管理', icon: <EventNoteRoundedIcon /> },
  { tab: 'cadfiles', label: 'CAD Files', description: 'Rhino / Blender などの CAD データ', icon: <ArchitectureRoundedIcon /> },
  { tab: 'workfiles', label: 'Work Files', description: '成果物・作業ファイル', icon: <InsertDriveFileRoundedIcon /> },
  { tab: 'memo', label: 'Research & Memo', description: 'リサーチとメモのボード', icon: <LightbulbRoundedIcon /> },
];

// チーム画面の3階層目。チーム → プロジェクトを選ぶとここに来る。
// プロジェクトサイトは以前クリック直後に開いていたが、ここの「プロジェクトサイト」カードから開く。
export const TeamProjectDetailPage: React.FC = () => {
  const { teams, activeTeamId, activeTeamProjectId, setActiveTeamProjectId } = useTeamsStore();
  const team = teams.find(t => t.id === activeTeamId);

  // 取得結果は対象 id とセットで持つ。読み込み中かどうかはそこから導出するので、
  // effect 内で同期的に setState する（＝カスケードレンダー）必要がない。
  const [loaded, setLoaded] = useState<{ id: string; project: TeamProjectDetail | null } | null>(null);

  useEffect(() => {
    if (!activeTeamProjectId) return;
    const targetId = activeTeamProjectId;
    let alive = true;
    fetchTeamProjectDetail(targetId)
      .then(p => { if (alive) setLoaded({ id: targetId, project: p }); })
      .catch(err => {
        console.warn('fetchTeamProjectDetail:', err);
        if (alive) setLoaded({ id: targetId, project: null });
      });
    return () => { alive = false; };
  }, [activeTeamProjectId]);

  const loading = !loaded || loaded.id !== activeTeamProjectId;
  const project = loaded?.project ?? null;

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: '#3498db' }} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: 'background.default' }}>
        <Typography sx={{ fontSize: 14, color: BRAND.sub }}>プロジェクトを読み込めませんでした。</Typography>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => setActiveTeamProjectId(null)}
          sx={{ color: '#3498db', textTransform: 'none' }}
        >
          {team?.name ?? 'チーム'} に戻る
        </Button>
      </Box>
    );
  }

  const hue = projectHue(project.name);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      {/* ── 戻るリンク ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 2 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => setActiveTeamProjectId(null)}
          size="small"
          sx={{ color: BRAND.sub2, textTransform: 'none', fontSize: 12, fontWeight: 500, px: 0.5, '&:hover': { color: BRAND.sub, bgcolor: 'transparent' } }}
        >
          {team?.name ?? 'チーム'}
        </Button>
      </Box>

      {/* ── ヘッダー（概要） ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 1.5, pb: 3, display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
        <ProjectIcon
          iconUrl={project.iconUrl}
          iconEmoji={project.iconEmoji}
          size={56}
          radius={2.5}
          fallbackBg={`hsl(${hue}, 50%, 40%)`}
          fallbackContent={<FolderRoundedIcon sx={{ fontSize: 26, color: 'var(--brand-fg)' }} />}
          emojiFontSize={28}
          sx={{ flexShrink: 0 }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: BRAND.text, lineHeight: 1.2 }}>
              {project.name}
            </Typography>
            <Chip
              icon={<GroupsRoundedIcon sx={{ fontSize: '13px !important' }} />}
              label="チームプロジェクト"
              size="small"
              sx={{ fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: BRAND.sub, '& .MuiChip-icon': { color: BRAND.sub } }}
            />
          </Box>
          <Typography sx={{ fontSize: 13, color: BRAND.sub2, mt: 0.75 }}>
            {project.description || '説明なし'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.75, color: BRAND.sub2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupsRoundedIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: 13 }}>{project.memberIds.length}名</Typography>
            </Box>
            <Typography sx={{ fontSize: 13 }}>作成 {formatDate(project.createdAt)}</Typography>
            <Typography sx={{ fontSize: 13 }}>更新 {formatDate(project.updatedAt)}</Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: BRAND.line, mx: { xs: 3, md: 5 } }} />

      {/* ── 各機能への入口 ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 3 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, mb: 2 }}>開く</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
          {ENTRIES.map(entry => (
            <CardActionArea
              key={entry.tab}
              onClick={() => applyOpenView({ target: 'project', projectId: project.id, tab: entry.tab })}
              sx={{
                borderRadius: 2.5, border: `1px solid ${BRAND.line}`,
                bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', p: 2,
                display: 'flex', alignItems: 'center', gap: 1.5,
                '&:hover': { bgcolor: 'rgba(52,152,219,0.06)', borderColor: 'rgba(52,152,219,0.3)' },
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: 2, flexShrink: 0,
                bgcolor: 'rgba(52,152,219,0.15)', color: '#3498db',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {entry.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: BRAND.text }}>{entry.label}</Typography>
                <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>{entry.description}</Typography>
              </Box>
            </CardActionArea>
          ))}
        </Box>
      </Box>

      {/* ── メンバー ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 4, pb: 4, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, mb: 2 }}>
          メンバー ({project.memberIds.length}名)
        </Typography>
        <Box sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 2, border: `1px solid ${BRAND.line}`, px: 2 }}>
          {project.memberIds.map(uid => (
            <MemberRow
              key={uid}
              uid={uid}
              isOwner={uid === project.ownerId}
              canRemove={false}
              onRemove={() => { /* 詳細画面は閲覧のみ。増減はチーム設定から */ }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};
