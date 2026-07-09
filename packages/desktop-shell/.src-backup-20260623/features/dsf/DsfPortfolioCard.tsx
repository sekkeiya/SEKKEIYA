import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { useCoverThumbnail } from './lib/useCoverThumbnail';

const ACCENT = '#7e57c2';

const CATEGORY_COLOR: Record<string, string> = {
  '会社案内': '#7e57c2',
  '作品集': '#5c6bc0',
  '提案書': '#26a69a',
  'その他': '#78909c',
};

export interface DsfCardProps {
  item: any;
  active?: boolean;
  /** 編集可能なプロジェクトのアイテムなら、生成した表紙を一度だけ永続化する */
  canPersist?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export const DsfPortfolioCard: React.FC<DsfCardProps> = ({ item, active, canPersist, onClick, onDelete }) => {
  const title = item.title || item.name || 'Untitled Portfolio';
  const category = item.category as string | undefined;
  // 保存済みサムネが無い既存 PDF は 1 ページ目をその場でレンダリングして表示
  const thumb = useCoverThumbnail(item, canPersist);
  const isPublic = item.visibility === 'public';

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.08)'}`,
        boxShadow: active ? `0 0 0 1px ${ACCENT}` : 'none',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: 'rgba(255,255,255,0.25)', transform: 'translateY(-2px)', '& .dsf-card-actions': { opacity: 1 } },
      }}
    >
      {/* Cover — book spine accent on the left edge */}
      <Box sx={{
        aspectRatio: '3 / 4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.3)',
        position: 'relative',
        borderLeft: `3px solid ${CATEGORY_COLOR[category || ''] || ACCENT}`,
      }}>
        {thumb ? (
          <Box component="img" src={thumb} alt={title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <MenuBookRoundedIcon sx={{ fontSize: 48, color: ACCENT, opacity: 0.85 }} />
        )}

        {/* Public badge */}
        {isPublic && (
          <Box sx={{ position: 'absolute', top: 6, left: 6 }}>
            <Chip size="small" icon={<PublicRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />} label="公開"
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', '& .MuiChip-icon': { ml: 0.5 } }} />
          </Box>
        )}

        {/* Delete */}
        {onDelete && (
          <Box className="dsf-card-actions" sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.15s' }}>
            <Tooltip title="削除" placement="top">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(0,0,0,0.7)' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Meta */}
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography noWrap sx={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>{title}</Typography>
        {category && (
          <Chip size="small" label={category}
            sx={{ mt: 0.5, height: 18, fontSize: 10, color: '#fff', bgcolor: `${CATEGORY_COLOR[category] || 'rgba(255,255,255,0.15)'}33`, border: `1px solid ${CATEGORY_COLOR[category] || 'rgba(255,255,255,0.2)'}55` }} />
        )}
      </Box>
    </Box>
  );
};
