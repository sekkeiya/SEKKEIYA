/**
 * DskEntryCard — S.Library 一覧の統一カード（Web / 書籍 / 書類 / メモ すべて共通）。
 * S.Blog ホーム（BlogNewsFeed）と同じニュースカード形式（サムネイル / バッジ / タイトル / アクション）。
 * - Web: サムネは 保存済み本文Markdownの先頭画像 → 商品索引の1枚目 → 地球アイコン。「記事を読む」で SEKKEIYA Reader。
 * - 書籍/書類/メモ: 種別アイコンのサムネ＋種別バッジ。「開く」（またはダブルクリック）でビューア等を開く。
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, IconButton, Tooltip } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { openReader } from '../dsb/lib/openReader';
import { BRAND } from '../../styles/theme';
import type { LibraryEntry, KnowledgeKind } from './types';
import { KIND_LABELS } from './types';

const KIND_META: Record<KnowledgeKind, { icon: React.ReactElement; color: string }> = {
  book: { icon: <MenuBookRoundedIcon />, color: '#26a69a' },
  pdf: { icon: <DescriptionRoundedIcon />, color: '#ef5350' },
  url: { icon: <LanguageRoundedIcon />, color: 'light-dark(#095fa5, #42a5f5)' },
  note: { icon: <StickyNote2RoundedIcon />, color: '#ffb300' },
  law: { icon: <GavelRoundedIcon />, color: '#8d6e63' },
};

/** 媒体名から安定した色相（BlogNewsFeed と同じ流儀） */
const hueOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const fmtDate = (v?: string) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'たった今';
    if (h < 24) return `${h}時間前`;
    const days = Math.floor(h / 24);
    if (days < 8) return `${days}日前`;
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch { return ''; }
};

/** 保存済み本文 Markdown から先頭の画像URLを取り出す（リーダー由来の記事はここに翻訳本文＋画像がある） */
function firstImageFromMarkdown(md?: string | null): string | null {
  if (!md) return null;
  const m = md.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  return m ? m[1] : null;
}

interface DskEntryCardProps {
  entry: LibraryEntry;
  active: boolean;
  onClick: (e?: React.MouseEvent) => void;
  /** 開く（書籍/PDF=ビューア、ローカルファイル=外部アプリ等。ダブルクリックでも発火） */
  onOpen?: () => void;
  onDelete?: () => void;
  /** RAG選択モード（チェックボックス表示） */
  ragSelectMode?: boolean;
  /** RAG選択中か */
  ragSelected?: boolean;
  /** RAG選択モードで取り込み対象外（＝商品ソース。商品索引化へ誘導） */
  ragDisabled?: boolean;
}

export const DskEntryCard: React.FC<DskEntryCardProps> = ({ entry, active, onClick, onOpen, onDelete, ragSelectMode, ragSelected, ragDisabled }) => {
  const meta = KIND_META[entry.kind];
  const isUrl = entry.kind === 'url';
  const mdImage = isUrl ? firstImageFromMarkdown(entry.bodyMarkdown) : null;

  // Web: 本文に画像がなければ商品索引の1枚目をカバーサムネに使う。
  const [catalogThumb, setCatalogThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!isUrl || mdImage) { setCatalogThumb(null); return; }
    let alive = true;
    import('./catalog/catalogVisionStore')
      .then(({ getFirstThumbForCatalog }) => getFirstThumbForCatalog(entry.localId))
      .then((t) => { if (alive) setCatalogThumb(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [entry.localId, isUrl, mdImage]);

  const image = mdImage || catalogThumb;
  const sourceName = isUrl ? (entry.author || 'Web') : KIND_LABELS[entry.kind];
  const selBorder = ragSelectMode && ragSelected ? '#a855f7' : active ? meta.color : BRAND.line;

  // 「開く」アクションを出すのは開き先が明確な種別のみ（書籍/PDF/法令=ビューア、ローカルファイル=外部アプリ）
  const canOpen = !!onOpen && (entry.kind === 'book' || entry.kind === 'pdf' || entry.kind === 'law' || entry.isLocalFile);

  return (
    <Box
      onClick={onClick}
      onDoubleClick={onOpen}
      sx={{ borderRadius: 2.5, bgcolor: BRAND.panel, border: `1px solid ${selBorder}`, overflow: 'hidden',
        position: 'relative', display: 'flex', flexDirection: 'column', cursor: 'pointer', userSelect: 'none',
        boxShadow: ragSelectMode && ragSelected ? '0 0 0 1px #a855f7' : (active ? `0 0 0 2px ${meta.color}` : 'none'),
        opacity: ragSelectMode && ragDisabled ? 0.5 : 1,
        transition: 'border-color .15s, box-shadow .15s, transform .15s, opacity .15s',
        '&:hover': { borderColor: ragSelectMode && ragSelected ? '#a855f7' : (active ? meta.color : `color-mix(in srgb, ${meta.color} 67%, transparent)`), transform: 'translateY(-2px)' },
        '&:hover .dsk-actions': { opacity: 1 }, '&:hover .dsk-del': { opacity: 1 } }}
    >
      {/* サムネイル（Web=画像/地球、他種別=種別アイコン） */}
      <Box sx={{ position: 'relative', height: 150, flexShrink: 0, borderBottom: `1px solid ${BRAND.line}`,
        bgcolor: image ? 'var(--brand-surface)' : `color-mix(in srgb, ${meta.color} 8%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {image ? (
          <Box component="img" src={image} alt="" loading="lazy"
            onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          React.cloneElement(meta.icon, { sx: { fontSize: 42, color: meta.color, opacity: 0.8 } })
        )}
        {/* 選択中バッジ（通常選択・複数選択とも。RAG選択モード時は別UI） */}
        {active && !ragSelectMode && (
          <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 3, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1, backdropFilter: 'blur(4px)' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 22, color: meta.color }} />
          </Box>
        )}
        {entry.summary && (
          <Tooltip title="AI要約済み">
            <AutoAwesomeRoundedIcon sx={{ position: 'absolute', top: 8, right: 8, fontSize: 16, color: 'light-dark(#ad8400, #ffd54f)' }} />
          </Tooltip>
        )}
        {entry.isConfidential ? (
          <Tooltip title="S.Library の保存先ローカルフォルダのファイル（ローカル層・クラウド非送信）">
            <Chip icon={<FolderRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />} label="ローカル" size="small"
              sx={{ position: 'absolute', bottom: 8, left: 8, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(38,166,154,0.85)', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: '4px' } }} />
          </Tooltip>
        ) : entry.isLocalFile && (
          <Tooltip title="LocalAssets のローカルファイル">
            <Chip icon={<FolderRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />} label="ローカル" size="small"
              sx={{ position: 'absolute', bottom: 8, left: 8, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: '4px' } }} />
          </Tooltip>
        )}
        {/* RAG選択モード: 知識はチェックボックス、商品ソースは「商品索引化へ」バッジ（選択不可） */}
        {ragSelectMode && (
          ragDisabled ? (
            <Tooltip title="商品ソースです。RAG（外付け脳）ではなく、右パネルの『サイトを商品索引化』で商品インデックスへ登録します。">
              <Chip icon={<Inventory2RoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />} label="商品" size="small"
                sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(125,211,252,0.85)', color: '#04293a', '& .MuiChip-icon': { ml: '4px' } }} />
            </Tooltip>
          ) : (
            <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1 }}>
              {ragSelected
                ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: 'light-dark(#5908a6, #a855f7)' }} />
                : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />}
            </Box>
          )
        )}
        {onDelete && (
          <IconButton className="dsk-del" size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{ position: 'absolute', bottom: 6, right: 6, opacity: 0, transition: 'opacity .15s', bgcolor: 'rgba(0,0,0,0.45)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgba(229,57,53,0.85)' } }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* 本体（BlogNewsFeed のカードと同じ構成: バッジ+カテゴリ+日付 → タイトル → アクション） */}
      <Box sx={{ p: 1.75, pt: 1.25, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isUrl ? (
            <Chip label={sourceName} size="small"
              sx={{ height: 18, fontSize: 10, fontWeight: 800,
                bgcolor: `hsl(${hueOf(sourceName)},60%,55%,0.16)`,
                color: `hsl(${hueOf(sourceName)},60%,72%)`,
                border: `1px solid hsl(${hueOf(sourceName)},60%,55%,0.4)` }} />
          ) : (
            <Chip label={sourceName} size="small"
              sx={{ height: 18, fontSize: 10, fontWeight: 800,
                bgcolor: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color, border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)` }} />
          )}
          <Typography noWrap sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            {!isUrl && entry.author ? `${entry.author}・${entry.category}` : entry.category}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', flexShrink: 0 }}>{fmtDate(entry.createdAt)}</Typography>
        </Box>
        <Typography
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.88)', fontWeight: 700, fontSize: 13, lineHeight: 1.55, flex: 1,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.title}
        </Typography>
        {!ragSelectMode && (isUrl ? entry.sourceUrl : canOpen) && (
          <Box className="dsk-actions" sx={{ display: 'flex', gap: 0.75, opacity: { xs: 1, md: 0.55 }, transition: 'opacity .15s' }}>
            {isUrl && entry.sourceUrl ? (
              <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
                onClick={(e) => { e.stopPropagation(); void openReader(entry.sourceUrl!, entry.title, entry.author || undefined); }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', fontSize: 11, px: 1, minWidth: 0,
                  '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                記事を読む
              </Button>
            ) : (
              <Button size="small"
                startIcon={entry.isLocalFile
                  ? <OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />
                  : <AutoStoriesRoundedIcon sx={{ fontSize: '13px !important' }} />}
                onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none', fontSize: 11, px: 1, minWidth: 0,
                  '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                開く
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
