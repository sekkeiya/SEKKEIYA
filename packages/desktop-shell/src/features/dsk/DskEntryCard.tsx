import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import type { LibraryEntry, KnowledgeKind } from './types';
import { KIND_LABELS } from './types';

const KIND_META: Record<KnowledgeKind, { icon: React.ReactElement; color: string }> = {
  book: { icon: <MenuBookRoundedIcon />, color: '#26a69a' },
  pdf: { icon: <PictureAsPdfRoundedIcon />, color: '#ef5350' },
  url: { icon: <LanguageRoundedIcon />, color: '#42a5f5' },
  note: { icon: <StickyNote2RoundedIcon />, color: '#ffb300' },
};

interface DskEntryCardProps {
  entry: LibraryEntry;
  active: boolean;
  onClick: () => void;
  onOpen: () => void;
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
  const hasSummary = !!entry.summary;
  const accent = ragSelectMode && ragSelected ? '#a855f7' : meta.color;

  // Web エントリ（商品索引済み）は、索引した商品画像の1枚目をカバーサムネに使う。
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (entry.kind !== 'url') { setThumb(null); return; }
    let alive = true;
    import('./catalog/catalogVisionStore')
      .then(({ getFirstThumbForCatalog }) => getFirstThumbForCatalog(entry.localId))
      .then((t) => { if (alive) setThumb(t); })
      .catch(() => {});
    return () => { alive = false; };
  }, [entry.localId, entry.kind]);

  return (
    <Box
      onClick={onClick}
      onDoubleClick={onOpen}
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: (active || (ragSelectMode && ragSelected)) ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
        boxShadow: ragSelectMode && ragSelected ? `0 0 0 1px ${accent}` : 'none',
        transition: 'border-color 0.15s, transform 0.15s, opacity 0.15s',
        opacity: ragSelectMode && ragDisabled ? 0.5 : 1,
        '&:hover': { borderColor: accent, transform: 'translateY(-2px)', '& .dsk-del': { opacity: 1 } },
      }}
    >
      {/* Cover */}
      <Box sx={{ aspectRatio: '3 / 4', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: thumb ? '#0b1220' : `${meta.color}1f`, position: 'relative' }}>
        {thumb ? (
          <Box
            component="img"
            src={thumb}
            alt={entry.title}
            loading="lazy"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          React.cloneElement(meta.icon, { sx: { fontSize: 46, color: meta.color, opacity: 0.85 } })
        )}
        <Chip
          label={KIND_LABELS[entry.kind]}
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8, height: 20, fontSize: 10, fontWeight: 700, bgcolor: meta.color, color: '#fff' }}
        />
        {hasSummary && (
          <Tooltip title="AI要約済み">
            <AutoAwesomeRoundedIcon sx={{ position: 'absolute', top: 8, right: 8, fontSize: 16, color: '#ffd54f' }} />
          </Tooltip>
        )}
        {entry.isConfidential ? (
          <Tooltip title="S.Library の保存先ローカルフォルダのファイル（ローカル層・クラウド非送信）">
            <Chip
              icon={<FolderRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />}
              label="ローカル"
              size="small"
              sx={{ position: 'absolute', bottom: 8, left: 8, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(38,166,154,0.85)', color: '#fff', '& .MuiChip-icon': { ml: '4px' } }}
            />
          </Tooltip>
        ) : entry.isLocalFile && (
          <Tooltip title="LocalAssets のローカルファイル">
            <Chip
              icon={<FolderRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />}
              label="ローカル"
              size="small"
              sx={{ position: 'absolute', bottom: 8, left: 8, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', '& .MuiChip-icon': { ml: '4px' } }}
            />
          </Tooltip>
        )}

        {/* RAG選択モード: 知識はチェックボックス、商品ソースは「商品索引化へ」バッジ（選択不可） */}
        {ragSelectMode && (
          ragDisabled ? (
            <Tooltip title="商品ソースです。RAG（外付け脳）ではなく、右パネルの『サイトを商品索引化』で商品インデックスへ登録します。">
              <Chip
                icon={<Inventory2RoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />}
                label="商品"
                size="small"
                sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(125,211,252,0.85)', color: '#04293a', '& .MuiChip-icon': { ml: '4px' } }}
              />
            </Tooltip>
          ) : (
            <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1 }}>
              {ragSelected
                ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: '#a855f7' }} />
                : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgba(255,255,255,0.8)' }} />}
            </Box>
          )
        )}
        {onDelete && (
          <IconButton
            className="dsk-del"
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{ position: 'absolute', bottom: 6, right: 6, opacity: 0, transition: 'opacity 0.15s', bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(229,57,53,0.85)' } }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* Meta */}
      <Box sx={{ p: 1.25 }}>
        <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.title}
        </Typography>
        <Typography noWrap sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, mt: 0.5 }}>
          {entry.author || entry.category}
        </Typography>
      </Box>
    </Box>
  );
};
