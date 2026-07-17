import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CardActionArea, Divider } from '@mui/material';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import { countItems } from '../../../features/dsk/catalog/catalogVisionStore';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import LabelRoundedIcon from '@mui/icons-material/LabelRounded';
import { BRAND } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { useDskStore, type KindFilter } from '../../../features/dsk/store/useDskStore';
import { listKnownCategories } from '../../../features/dsk/types';
import { isEntryIngested } from '../../../features/dsk/lib/ragIngest';

const ACCENT = '#26a69a';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  count?: number;
}

function NavItem({ icon, label, active, onClick, color, count }: NavItemProps) {
  return (
    <Box sx={{ mx: 1.5, my: 0.4 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5, mr: 1, flexShrink: 0,
          bgcolor: color || 'rgb(var(--brand-fg-rgb) / 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' } })}
        </Box>
        <Typography sx={{
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {label}
        </Typography>
        {count != null && count > 0 && (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, fontWeight: 600, ml: 1 }}>{count}</Typography>
        )}
      </CardActionArea>
    </Box>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase', px: 2.5, py: 0.5, mt: 1 }}>
      {label}
    </Typography>
  );
}

export const DskSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const projects = useAppStore(s => s.projects);

  const {
    entries,
    view, setView,
    registryFocus, setRegistryFocus,
    kindFilter, setKindFilter,
    categoryFilter, setCategoryFilter,
    projectFilter, setProjectFilter,
  } = useDskStore();

  // 索引済み商品の件数（IndexedDB）。ビュー切替時に取り直して最新化。
  const [productCount, setProductCount] = useState(0);
  useEffect(() => { countItems().then(setProductCount).catch(() => {}); }, [view]);

  // 外付け脳（RAG）= 取り込み済みエントリの件数。
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const knowledgeSources = useAiProfileStore((s) => s.knowledgeSources);
  const loadKnowledgeSources = useAiProfileStore((s) => s.loadKnowledgeSources);
  useEffect(() => { if (uid) loadKnowledgeSources(uid); }, [uid, loadKnowledgeSources]);
  const brainCount = useMemo(
    () => entries.filter((e) => isEntryIngested(e, knowledgeSources)).length,
    [entries, knowledgeSources],
  );

  // kind 別の件数
  const kindCounts = useMemo(() => {
    const c = { all: entries.length, book: 0, pdf: 0, url: 0, note: 0, law: 0 } as Record<KindFilter, number>;
    for (const e of entries) c[e.kind] = (c[e.kind] || 0) + 1;
    return c;
  }, [entries]);

  // カテゴリ別の件数
  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.category] = (c[e.category] || 0) + 1;
    return c;
  }, [entries]);

  // 表示するカテゴリ（シード＋データに出現した新カテゴリを自動合流）。
  const categories = useMemo(() => listKnownCategories(entries), [entries]);

  // サイドバーは常に1項目だけ選択表示にする。
  // 優先順位: ビュー > プロジェクト > カテゴリ > 種類（既定は「すべて」）。
  const activeKey = useMemo(() => {
    if (view === 'registry') return `view:registry:${registryFocus}`;
    if (view !== 'library') return `view:${view}`;
    if (projectFilter !== null) return `project:${projectFilter}`;
    if (categoryFilter !== 'all') return `category:${categoryFilter}`;
    return `kind:${kindFilter}`;
  }, [view, registryFocus, projectFilter, categoryFilter, kindFilter]);

  // 紐付きエントリを持つプロジェクトのみ表示
  const linkedProjects = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach(e => e.linkedProjectIds.forEach(id => ids.add(id)));
    return projects.filter((p: any) => ids.has(p.id));
  }, [entries, projects]);

  const KINDS: { key: KindFilter; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: 'すべて', icon: <LibraryBooksRoundedIcon />, color: ACCENT },
    { key: 'book', label: '書籍', icon: <MenuBookRoundedIcon />, color: '#26a69a' },
    { key: 'pdf', label: '書類', icon: <DescriptionRoundedIcon />, color: '#ef5350' },
    { key: 'url', label: 'Web', icon: <LanguageRoundedIcon />, color: 'light-dark(#095fa5, #42a5f5)' },
    { key: 'note', label: 'メモ', icon: <StickyNote2RoundedIcon />, color: '#ffb300' },
    { key: 'law', label: '法令', icon: <GavelRoundedIcon />, color: '#8d6e63' },
  ];

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.bg,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
      }}
    >
      {/* Kind navigation */}
      <Box>
        {KINDS.map(k => (
          <NavItem
            key={k.key}
            icon={k.icon}
            label={k.label}
            color={k.color}
            count={kindCounts[k.key]}
            active={activeKey === `kind:${k.key}`}
            onClick={() => setKindFilter(k.key)}
          />
        ))}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

      {/* AIが使う2つの棚：外付け脳(RAG, 文章の根拠) と 索引商品(家具・素材を探す) */}
      <SectionHeader label="AIが使う棚" />

      {/* 外付け脳（RAG）= 回答の根拠に使う知識 */}
      <NavItem
        icon={<PsychologyRoundedIcon />}
        label="外付け脳（RAG）"
        color="#a855f7"
        count={brainCount}
        active={activeKey === 'view:brain'}
        onClick={() => setView('brain')}
      />

      {/* 索引商品（カタログ/サイトから取り込んだ商品の一覧）= 実在の家具・素材を探す */}
      <NavItem
        icon={<Inventory2RoundedIcon />}
        label="索引商品"
        color="#7dd3fc"
        count={productCount}
        active={activeKey === 'view:products'}
        onClick={() => setView('products')}
      />

      {/* おすすめソース（家具/テクスチャ/パース/建材の厳選ソースを追加） */}
      <NavItem
        icon={<ExploreRoundedIcon />}
        label="おすすめソース"
        color="#38bdf8"
        active={activeKey === 'view:registry:all'}
        onClick={() => { setView('registry'); setRegistryFocus('all'); }}
      />

      {/* カタログ（サンゲツ等メーカー電子カタログだけを絞って表示） */}
      <NavItem
        icon={<CollectionsBookmarkRoundedIcon />}
        label="カタログ"
        color="#86efac"
        active={activeKey === 'view:registry:catalog'}
        onClick={() => { setView('registry'); setRegistryFocus('catalog'); }}
      />

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

      {/* Category navigation */}
      <SectionHeader label="カテゴリ" />
      <NavItem
        icon={<LabelRoundedIcon />}
        label="全カテゴリ"
        active={false}
        onClick={() => setCategoryFilter('all')}
      />
      {categories.map(c => (
        <NavItem
          key={c}
          icon={<LabelRoundedIcon />}
          label={c}
          count={categoryCounts[c]}
          active={activeKey === `category:${c}`}
          onClick={() => setCategoryFilter(c)}
        />
      ))}
      {categoryCounts['ローカルファイル'] > 0 && (
        <NavItem
          icon={<FolderRoundedIcon />}
          label="ローカルファイル"
          color={ACCENT}
          count={categoryCounts['ローカルファイル']}
          active={activeKey === 'category:ローカルファイル'}
          onClick={() => setCategoryFilter('ローカルファイル')}
        />
      )}

      {/* Project filter */}
      {linkedProjects.length > 0 && (
        <>
          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />
          <SectionHeader label="プロジェクトで絞り込み" />
          <NavItem
            icon={<FolderRoundedIcon />}
            label="すべてのプロジェクト"
            active={false}
            onClick={() => setProjectFilter(null)}
          />
          {linkedProjects.map((p: any) => (
            <NavItem
              key={p.id}
              icon={<FolderRoundedIcon />}
              label={p.name || 'プロジェクト'}
              color="#3498db"
              active={activeKey === `project:${p.id}`}
              onClick={() => setProjectFilter(p.id)}
            />
          ))}
        </>
      )}
    </Box>
  );
};
