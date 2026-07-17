import React, { useMemo } from 'react';
import { Box, Typography, Chip, CircularProgress, CardActionArea, useMediaQuery } from '@mui/material';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { useDsqStore, DSQ_CATEGORIES, type DsqCategoryFilter } from './store/useDsqStore';
import { DsqSidebar } from '../../shared/layout/dsq-sidebar/DsqSidebar';

const ACCENT = '#5c6bc0';

interface DsqDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
  /** コース一覧（type==='course' の workFiles） */
  courses: any[];
  /** global_projects スコープ時の公開プロジェクト一覧（それ以外は null） */
  projects?: any[] | null;
  isInitializing?: boolean;
  isGlobal?: boolean;
  onSelectItem?: (item: any) => void;
  onOpenProject?: (project: any) => void;
}

const FILTER_TABS: { key: DsqCategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  ...DSQ_CATEGORIES.map(c => ({ key: c as DsqCategoryFilter, label: c })),
];

const LEVEL_LABELS: Record<string, string> = { beginner: '入門', intermediate: '中級', advanced: '上級' };

/** レッスン形式に応じたアイコン（動画 / 記事 / S.アプリ連携の実習） */
const formatIcon = (course: any) => {
  if (course?.questAppScope) return <ExtensionRoundedIcon sx={{ fontSize: 15 }} />;
  if (course?.primaryFormat === 'article') return <ArticleRoundedIcon sx={{ fontSize: 15 }} />;
  return <PlayCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />;
};

const CourseCard: React.FC<{ course: any; onClick?: () => void }> = ({ course, onClick }) => {
  const lessonCount = course?.lessonCount ?? (Array.isArray(course?.lessons) ? course.lessons.length : 0);
  return (
    <CardActionArea
      onClick={onClick}
      sx={{
        borderRadius: 2, overflow: 'hidden', textAlign: 'left',
        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: ACCENT, transform: 'translateY(-2px)' },
      }}
    >
      {/* Cover */}
      <Box sx={{
        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(92,107,192,0.12)', position: 'relative',
        backgroundImage: course?.coverUrl ? `url(${course.coverUrl})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        {!course?.coverUrl && <SchoolRoundedIcon sx={{ fontSize: 40, color: ACCENT, opacity: 0.6 }} />}
      </Box>
      {/* Body */}
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
          {formatIcon(course)}
          <Typography sx={{ fontSize: 11 }}>{lessonCount} レッスン</Typography>
          {course?.level && (
            <Chip label={LEVEL_LABELS[course.level] || course.level} size="small"
              sx={{ height: 18, fontSize: 10, ml: 'auto', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
          )}
        </Box>
        <Typography sx={{ color: 'var(--brand-fg)', fontSize: 14, fontWeight: 700, lineHeight: 1.3, mb: 0.5 }} noWrap>
          {course?.title || course?.name || '無題のコース'}
        </Typography>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 12,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {course?.description || ''}
        </Typography>
        {course?.category && (
          <Typography sx={{ color: ACCENT, fontSize: 11, mt: 0.75, fontWeight: 600 }}>{course.category}</Typography>
        )}
      </Box>
    </CardActionArea>
  );
};

export const DsqDashboard: React.FC<DsqDashboardProps> = ({ courses, projects = null, isInitializing, onSelectItem, onOpenProject }) => {
  const categoryFilter = useDsqStore(s => s.categoryFilter);
  const setCategoryFilter = useDsqStore(s => s.setCategoryFilter);

  const isProjectsMode = projects !== null;

  const visibleCourses = useMemo(() => {
    if (categoryFilter === 'all') return courses;
    return courses.filter(c => c.category === categoryFilter);
  }, [courses, categoryFilter]);

  // ── 全幅ヘッダー化レイアウト（デスクトップのみ） ──────────────────────────────
  // デスクトップでは MainLayout 側の左サイドバー複製を抑止し、代わりにここ
  // （ヘッダー下の 2 ゾーン行）へ埋め込む。これによりツールバーが全幅ヘッダーになる。
  const isMobile = useMediaQuery('(max-width:768px)');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', bgcolor: 'background.default' }}>
      {/* 全幅ヘッダー（Toolbar） */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
            S.Quest — Learning
          </Typography>
          <Typography sx={{ color: 'var(--brand-fg)', fontSize: 22, fontWeight: 700, mt: 0.25, mb: 1.5 }}>
            {isProjectsMode ? '公開プロジェクト' : '学習コース'}
          </Typography>

          {!isProjectsMode && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {FILTER_TABS.map(tab => {
                const active = categoryFilter === tab.key;
                return (
                  <Box
                    key={tab.key}
                    onClick={() => setCategoryFilter(tab.key)}
                    sx={{
                      px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 500,
                      color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                      bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.1)' },
                    }}
                  >
                    {tab.label}
                  </Box>
                );
              })}
            </Box>
          )}
      </Box>

      {/* 全幅ヘッダー下の行: 左プロジェクトサイドバー | コンテンツ（S.Quest は右パネルなし） */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左サイドバー（ストア駆動で自己サイズ調整。デスクトップのみ埋め込み） */}
        {!isMobile && <DsqSidebar />}

        {/* Content */}
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto' }}>
          {isInitializing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress sx={{ color: ACCENT }} />
            </Box>
          ) : isProjectsMode ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, p: 3, alignContent: 'start' }}>
              {(projects || []).map((p: any) => (
                <Box key={p.id} onClick={() => onOpenProject?.(p)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: 2, cursor: 'pointer',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', transform: 'translateY(-2px)' } }}>
                  <FolderSpecialRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 13, fontWeight: 600 }}>{p.name || 'プロジェクト'}</Typography>
                    <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11 }}>{p.ownerName || ''}</Typography>
                  </Box>
                </Box>
              ))}
              {(projects || []).length === 0 && (
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center', mt: 4 }}>
                  公開プロジェクトがありません
                </Typography>
              )}
            </Box>
          ) : visibleCourses.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <SchoolRoundedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography sx={{ fontSize: 14 }}>まだコースがありません</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.7 }}>建築・インテリアの学習コースがここに表示されます</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, p: 3, alignContent: 'start' }}>
              {visibleCourses.map(course => (
                <CourseCard key={course.id} course={course} onClick={() => onSelectItem?.(course)} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
