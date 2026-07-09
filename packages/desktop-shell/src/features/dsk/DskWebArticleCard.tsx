/**
 * DskWebArticleCard — S.Library の「Web」一覧用ニュースカード。
 * S.Blog ホーム（BlogNewsFeed）と同じ見た目（サムネイル / 媒体バッジ / タイトル / アクション）で、
 * Web 知識をフィード感覚で眺められるようにする。「記事を読む」で SEKKEIYA Reader を開く。
 * サムネイルは 保存済み本文Markdownの先頭画像 → 商品索引の1枚目 → 地球アイコン の順で解決。
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, IconButton, Tooltip } from '@mui/material';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { openReader } from '../dsb/lib/openReader';
import { BRAND } from '../../styles/theme';
import type { LibraryEntry } from './types';

const ACCENT = '#42a5f5'; // url kind の色（DskEntryCard と統一）

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

interface DskWebArticleCardProps {
  entry: LibraryEntry;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
  ragSelectMode?: boolean;
  ragSelected?: boolean;
  ragDisabled?: boolean;
}

export const DskWebArticleCard: React.FC<DskWebArticleCardProps> = ({ entry, active, onClick, onDelete, ragSelectMode, ragSelected, ragDisabled }) => {
  const mdImage = firstImageFromMarkdown(entry.bodyMarkdown);

  // 本文に画像がなければ商品索引の1枚目（DskEntryCard と同じフォールバック）
  const [catalogThumb, setCatalogThumb] = useState<string | null>(null);
  useEffect(() => {
    if (mdImage) { setCatalogThumb(null); return; }
    let alive = true;
    import('./catalog/catalogVisionStore')
      .then(({ getFirstThumbForCatalog }) => getFirstThumbForCatalog(entry.localId))
      .then((t) => { if (alive) setCatalogThumb(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [entry.localId, mdImage]);

  const image = mdImage || catalogThumb;
  const sourceName = entry.author || 'Web';
  const selBorder = ragSelectMode && ragSelected ? '#a855f7' : active ? ACCENT : BRAND.line;

  return (
    <Box
      onClick={onClick}
      sx={{ borderRadius: 2.5, bgcolor: BRAND.panel, border: `1px solid ${selBorder}`, overflow: 'hidden',
        position: 'relative', display: 'flex', flexDirection: 'column', cursor: 'pointer',
        boxShadow: ragSelectMode && ragSelected ? '0 0 0 1px #a855f7' : 'none',
        opacity: ragSelectMode && ragDisabled ? 0.5 : 1,
        transition: 'border-color .15s, transform .15s, opacity .15s',
        '&:hover': { borderColor: ragSelectMode && ragSelected ? '#a855f7' : `${ACCENT}aa`, transform: 'translateY(-2px)' },
        '&:hover .dskweb-actions': { opacity: 1 }, '&:hover .dskweb-del': { opacity: 1 } }}
    >
      {/* サムネイル */}
      <Box sx={{ position: 'relative', height: 150, flexShrink: 0, borderBottom: `1px solid ${BRAND.line}`,
        bgcolor: image ? '#0b1220' : `${ACCENT}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {image ? (
          <Box component="img" src={image} alt="" loading="lazy"
            onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <LanguageRoundedIcon sx={{ fontSize: 42, color: ACCENT, opacity: 0.8 }} />
        )}
        {entry.summary && (
          <Tooltip title="AI要約済み">
            <AutoAwesomeRoundedIcon sx={{ position: 'absolute', top: 8, right: 8, fontSize: 16, color: '#ffd54f' }} />
          </Tooltip>
        )}
        {/* RAG選択モード（DskEntryCard と同じ振る舞い） */}
        {ragSelectMode && (
          ragDisabled ? (
            <Tooltip title="商品ソースです。RAG（外付け脳）ではなく、右パネルの『サイトを商品索引化』で商品インデックスへ登録します。">
              <Chip icon={<Inventory2RoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />} label="商品" size="small"
                sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(125,211,252,0.85)', color: '#04293a', '& .MuiChip-icon': { ml: '4px' } }} />
            </Tooltip>
          ) : (
            <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1 }}>
              {ragSelected
                ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: '#a855f7' }} />
                : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgba(255,255,255,0.8)' }} />}
            </Box>
          )
        )}
        {onDelete && (
          <IconButton className="dskweb-del" size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{ position: 'absolute', bottom: 6, right: 6, opacity: 0, transition: 'opacity .15s', bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(229,57,53,0.85)' } }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* 本体（BlogNewsFeed のカードと同じ構成: 媒体バッジ+日付 → タイトル → アクション） */}
      <Box sx={{ p: 1.75, pt: 1.25, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={sourceName} size="small"
            sx={{ height: 18, fontSize: 10, fontWeight: 800,
              bgcolor: `hsl(${hueOf(sourceName)},60%,55%,0.16)`,
              color: `hsl(${hueOf(sourceName)},60%,72%)`,
              border: `1px solid hsl(${hueOf(sourceName)},60%,55%,0.4)` }} />
          <Typography noWrap sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{entry.category}</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{fmtDate(entry.createdAt)}</Typography>
        </Box>
        <Typography
          sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 13, lineHeight: 1.55, flex: 1,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.title}
        </Typography>
        {!ragSelectMode && entry.sourceUrl && (
          <Box className="dskweb-actions" sx={{ display: 'flex', gap: 0.75, opacity: { xs: 1, md: 0.55 }, transition: 'opacity .15s' }}>
            <Button size="small" startIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
              onClick={(e) => { e.stopPropagation(); void openReader(entry.sourceUrl!, entry.title, entry.author || undefined); }}
              sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 11, px: 1, minWidth: 0,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              記事を読む
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};
