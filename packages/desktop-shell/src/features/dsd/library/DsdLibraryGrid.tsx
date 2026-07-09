import React, { useState, useRef } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  CircularProgress, Menu, MenuItem, ListItemIcon,
} from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { BRAND } from '../../../styles/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DsdExportItem {
  id: string;
  title: string;
  appScope: '3dsd';
  template: 'sun' | 'site' | 'layout' | 'env';
  exportType: 'image' | 'video' | 'pdf';
  fileUrl: string;
  thumbnailUrl?: string;
  createdAt?: any;
  createdBy?: string;
  mimeType?: string;
  fileSize?: number;
  visibility?: 'public' | 'private';
}

type TemplateFilter = 'all' | 'sun' | 'site' | 'layout' | 'env';
type FormatFilter = 'all' | 'image' | 'video' | 'pdf';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEMPLATE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sun:    { label: '日照・日影',   icon: <WbSunnyRoundedIcon sx={{ fontSize: 14 }} />, color: 'light-dark(#5a822b, #aed581)' },
  site:   { label: '敷地・周辺',   icon: <PlaceRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#198694, #4dd0e1)' },
  layout: { label: 'ゾーニング',   icon: <RouteRoundedIcon   sx={{ fontSize: 14 }} />, color: 'light-dark(#ad6700, #ffb74d)' },
  env:    { label: '環境・風・音', icon: <AirRoundedIcon     sx={{ fontSize: 14 }} />, color: 'light-dark(#327b74, #80cbc4)' },
};

const FORMAT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  image: { label: 'PNG',   icon: <ImageRoundedIcon      sx={{ fontSize: 13 }} /> },
  video: { label: '動画',   icon: <VideocamRoundedIcon   sx={{ fontSize: 13 }} /> },
  pdf:   { label: 'PDF',   icon: <PictureAsPdfRoundedIcon sx={{ fontSize: 13 }} /> },
};

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// ─── Diagram State Card ───────────────────────────────────────────────────────

interface DsdDiagramStateCardProps {
  item: any;
  onOpen?: (item: any) => void;
  onSelect?: (item: any) => void;
  onDelete?: (item: any) => void;
}

const DsdDiagramStateCard: React.FC<DsdDiagramStateCardProps> = ({ item, onOpen, onSelect, onDelete }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [imgError, setImgError] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = item.currentTemplate ?? 'sun';
  const meta = TEMPLATE_META[template] ?? TEMPLATE_META.sun;
  const title = item.diagramTitle || 'Untitled Diagram';
  const updatedAt = item.updatedAt ?? item.createdAt;

  // Single click → select (right panel); double-click → open editor
  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onOpen?.(item);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        onSelect?.(item);
      }, 240);
    }
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        borderRadius: 2,
        border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)`,
        bgcolor: `color-mix(in srgb, ${meta.color} 3%, transparent)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        '&:hover': {
          border: `1px solid color-mix(in srgb, ${meta.color} 53%, transparent)`,
          boxShadow: `0 4px 16px color-mix(in srgb, ${meta.color} 13%, transparent)`,
          bgcolor: `color-mix(in srgb, ${meta.color} 7%, transparent)`,
          '& .card-actions': { opacity: 1 },
        },
      }}
    >
      {/* Thumbnail area */}
      <Box sx={{
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: `color-mix(in srgb, ${meta.color} 8%, transparent)`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 0.5,
      }}>
        {item.thumbnailUrl && !imgError ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            onError={() => setImgError(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
        ) : (
          <>
            <Box sx={{ color: meta.color, opacity: 0.7 }}>
              {React.cloneElement(meta.icon as React.ReactElement, { sx: { fontSize: 36 } })}
            </Box>
            <Typography variant="caption" sx={{ color: meta.color, fontSize: '0.6rem', opacity: 0.7, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              DIAGRAM
            </Typography>
          </>
        )}

        {/* Hover actions */}
        <Box className="card-actions" sx={{
          position: 'absolute', top: 6, right: 6,
          display: 'flex', gap: 0.5,
          opacity: 0, transition: 'opacity 0.15s ease',
        }}>
          <Tooltip title="ダブルクリックで開く" placement="top">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; } onOpen?.(item); }}
              sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
            >
              <EditRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
          >
            <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{
          fontWeight: 600, color: BRAND.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          mb: 0.75,
        }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            icon={meta.icon as React.ReactElement}
            label={meta.label}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 600,
              bgcolor: `color-mix(in srgb, ${meta.color} 9%, transparent)`, color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)`,
              '& .MuiChip-icon': { color: meta.color, ml: 0.5 },
            }}
          />
          <Chip
            label="ダイアグラム"
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem',
              bgcolor: BRAND.bg, color: BRAND.sub,
              border: `1px solid ${BRAND.line}`,
            }}
          />
          {updatedAt && (
            <Typography variant="caption" sx={{ color: BRAND.sub2, ml: 'auto', fontSize: '0.65rem' }}>
              {formatDate(updatedAt)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={(e: any) => { e?.stopPropagation?.(); setMenuAnchor(null); }}
        PaperProps={{ sx: { bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, minWidth: 160 } }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); onOpen?.(item); setMenuAnchor(null); }}>
          <ListItemIcon><EditRoundedIcon fontSize="small" sx={{ color: BRAND.sub }} /></ListItemIcon>
          <Typography variant="body2">編集</Typography>
        </MenuItem>
        {onDelete && (
          <MenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(item); setMenuAnchor(null); }}
            sx={{ color: '#ef5350' }}
          >
            <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" sx={{ color: '#ef5350' }} /></ListItemIcon>
            <Typography variant="body2" sx={{ color: '#ef5350' }}>削除</Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

// ─── Export Card ──────────────────────────────────────────────────────────────

interface DsdExportCardProps {
  item: DsdExportItem;
  onDelete?: (item: DsdExportItem) => void;
}

const DsdExportCard: React.FC<DsdExportCardProps> = ({ item, onDelete }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [imgError, setImgError] = useState(false);

  const meta = TEMPLATE_META[item.template] ?? TEMPLATE_META.sun;
  const fmtMeta = FORMAT_META[item.exportType] ?? FORMAT_META.image;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = item.fileUrl;
    a.download = item.title || 'diagram';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <Box sx={{
      borderRadius: 2,
      border: `1px solid ${BRAND.line}`,
      bgcolor: BRAND.panel,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.18s ease',
      '&:hover': {
        border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
        boxShadow: `0 4px 16px color-mix(in srgb, ${meta.color} 9%, transparent)`,
        '& .card-actions': { opacity: 1 },
      },
    }}>
      {/* Thumbnail */}
      <Box sx={{
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: `color-mix(in srgb, ${meta.color} 6%, transparent)`,
        overflow: 'hidden',
      }}>
        {item.exportType === 'video' ? (
          <Box sx={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 0.5,
          }}>
            {item.thumbnailUrl && !imgError ? (
              <Box component="img"
                src={item.thumbnailUrl}
                onError={() => setImgError(true)}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
              />
            ) : null}
            <Box sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))',
            }}>
              <VideocamRoundedIcon sx={{ color: 'var(--brand-fg)', fontSize: 32 }} />
            </Box>
          </Box>
        ) : item.thumbnailUrl && !imgError ? (
          <Box component="img"
            src={item.thumbnailUrl}
            onError={() => setImgError(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: meta.color,
          }}>
            {React.cloneElement(meta.icon as React.ReactElement, { sx: { fontSize: 36 } })}
          </Box>
        )}

        {/* Hover actions */}
        <Box className="card-actions" sx={{
          position: 'absolute', top: 6, right: 6,
          display: 'flex', gap: 0.5,
          opacity: 0, transition: 'opacity 0.15s ease',
        }}>
          <Tooltip title="ダウンロード" placement="top">
            <IconButton size="small" onClick={handleDownload} sx={{
              bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
            }}>
              <DownloadRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={e => setMenuAnchor(e.currentTarget)} sx={{
            bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
          }}>
            <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ p: 1.5 }}>
        <Typography variant="body2" sx={{
          fontWeight: 600, color: BRAND.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          mb: 0.75,
        }}>
          {item.title || 'Untitled'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            icon={meta.icon as React.ReactElement}
            label={meta.label}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 600,
              bgcolor: `color-mix(in srgb, ${meta.color} 9%, transparent)`, color: meta.color,
              border: `1px solid color-mix(in srgb, ${meta.color} 27%, transparent)`,
              '& .MuiChip-icon': { color: meta.color, ml: 0.5 },
            }}
          />
          <Chip
            icon={fmtMeta.icon as React.ReactElement}
            label={fmtMeta.label}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem',
              bgcolor: BRAND.bg, color: BRAND.sub,
              border: `1px solid ${BRAND.line}`,
              '& .MuiChip-icon': { color: BRAND.sub, ml: 0.5 },
            }}
          />
          {item.createdAt && (
            <Typography variant="caption" sx={{ color: BRAND.sub2, ml: 'auto', fontSize: '0.65rem' }}>
              {formatDate(item.createdAt)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        PaperProps={{ sx: { bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, minWidth: 160 } }}
      >
        <MenuItem onClick={() => { handleDownload(); setMenuAnchor(null); }}>
          <ListItemIcon><DownloadRoundedIcon fontSize="small" sx={{ color: BRAND.sub }} /></ListItemIcon>
          <Typography variant="body2">ダウンロード</Typography>
        </MenuItem>
        {onDelete && (
          <MenuItem onClick={() => { onDelete(item); setMenuAnchor(null); }} sx={{ color: '#ef5350' }}>
            <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" sx={{ color: '#ef5350' }} /></ListItemIcon>
            <Typography variant="body2" sx={{ color: '#ef5350' }}>削除</Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

// ─── Grid ─────────────────────────────────────────────────────────────────────

interface DsdLibraryGridProps {
  items: DsdExportItem[];
  diagramItems?: any[];
  isInitializing?: boolean;
  onDelete?: (item: DsdExportItem) => void;
  onDeleteDiagram?: (item: any) => void;
  onOpenDiagram?: (item: any) => void;
  onSelectDiagram?: (item: any) => void;
  onNew?: () => void;
}

export const DsdLibraryGrid: React.FC<DsdLibraryGridProps> = ({
  items,
  diagramItems = [],
  isInitializing,
  onDelete,
  onDeleteDiagram,
  onOpenDiagram,
  onSelectDiagram,
  onNew,
}) => {
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>('all');
  const [formatFilter, setFormatFilter]     = useState<FormatFilter>('all');

  const filteredExports = items.filter(item => {
    if (templateFilter !== 'all' && item.template !== templateFilter) return false;
    if (formatFilter   !== 'all' && item.exportType !== formatFilter)  return false;
    return true;
  });

  if (isInitializing) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: 'light-dark(#5a822b, #aed581)' }} />
      </Box>
    );
  }

  const hasDiagrams = diagramItems.length > 0;
  const hasExports = items.length > 0;
  const hasAnything = hasDiagrams || hasExports;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Saved Diagrams Section ─────────────────────────────────────────── */}
      {hasDiagrams && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="caption" sx={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              color: BRAND.sub2, textTransform: 'uppercase',
            }}>
              保存済みダイアグラム
            </Typography>
            <Typography variant="caption" sx={{
              fontSize: '0.65rem', color: BRAND.sub2,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', px: 0.75, py: 0.25, borderRadius: 1,
            }}>
              {diagramItems.length}
            </Typography>
          </Box>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 2,
          }}>
            {diagramItems.map(item => (
              <DsdDiagramStateCard
                key={item.id}
                item={item}
                onOpen={onOpenDiagram}
                onSelect={onSelectDiagram}
                onDelete={onDeleteDiagram}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Export Library Section ─────────────────────────────────────────── */}
      {(hasExports || hasDiagrams) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: hasDiagrams ? 1.5 : 2.5 }}>
          <Typography variant="caption" sx={{
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            color: BRAND.sub2, textTransform: 'uppercase',
          }}>
            書き出し済みファイル
          </Typography>
          {hasExports && (
            <Typography variant="caption" sx={{
              fontSize: '0.65rem', color: BRAND.sub2,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', px: 0.75, py: 0.25, borderRadius: 1,
            }}>
              {items.length}
            </Typography>
          )}
        </Box>
      )}

      {/* Filters (only show when there are exports) */}
      {hasExports && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            {(['all', 'sun', 'site', 'layout', 'env'] as TemplateFilter[]).map(f => {
              const m = f === 'all' ? null : TEMPLATE_META[f];
              return (
                <Chip
                  key={f}
                  label={f === 'all' ? 'すべて' : m!.label}
                  size="small"
                  onClick={() => setTemplateFilter(f)}
                  sx={{
                    height: 24, fontSize: '0.7rem', cursor: 'pointer',
                    bgcolor: templateFilter === f ? (m ? `color-mix(in srgb, ${m.color} 13%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.08)') : 'transparent',
                    color: templateFilter === f ? (m ? m.color : BRAND.text) : BRAND.sub2,
                    border: `1px solid ${templateFilter === f ? (m ? `color-mix(in srgb, ${m.color} 40%, transparent)` : BRAND.text + '44') : BRAND.line}`,
                    '&:hover': { bgcolor: m ? `color-mix(in srgb, ${m.color} 8%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.05)' },
                  }}
                />
              );
            })}
          </Box>

          <Box sx={{ width: '1px', bgcolor: BRAND.line, mx: 0.5, alignSelf: 'stretch' }} />

          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            {(['all', 'image', 'video', 'pdf'] as FormatFilter[]).map(f => {
              const m = f === 'all' ? null : FORMAT_META[f];
              return (
                <Chip
                  key={f}
                  icon={m ? m.icon as React.ReactElement : undefined}
                  label={f === 'all' ? '形式: すべて' : m!.label}
                  size="small"
                  onClick={() => setFormatFilter(f)}
                  sx={{
                    height: 24, fontSize: '0.7rem', cursor: 'pointer',
                    bgcolor: formatFilter === f ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
                    color: formatFilter === f ? BRAND.text : BRAND.sub2,
                    border: `1px solid ${formatFilter === f ? BRAND.text + '44' : BRAND.line}`,
                    '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Export Grid */}
      {hasExports ? (
        filteredExports.length === 0 ? (
          <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: BRAND.sub2 }}>
              フィルターに一致するアイテムがありません。
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            flex: hasAnything ? 'unset' : 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 2,
            alignContent: 'start',
            pb: 2,
          }}>
            {filteredExports.map(item => (
              <DsdExportCard key={item.id} item={item} onDelete={onDelete} />
            ))}
          </Box>
        )
      ) : !hasDiagrams ? (
        /* Empty state — nothing at all */
        <Box sx={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <WbSunnyRoundedIcon sx={{ fontSize: 48, color: BRAND.line }} />
          <Typography variant="body2" sx={{ color: BRAND.sub2, textAlign: 'center', whiteSpace: 'pre-line' }}>
            {'まだダイアグラムが保存されていません。\n新規ダイアグラムを作成してみましょう。'}
          </Typography>
          {onNew && (
            <Box
              onClick={onNew}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 1, borderRadius: 2,
                border: '1px solid rgba(174,213,129,0.35)',
                bgcolor: 'rgba(174,213,129,0.08)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(174,213,129,0.15)', borderColor: '#aed581' },
                transition: 'all 0.15s',
              }}
            >
              <Typography variant="body2" sx={{ color: 'light-dark(#5a822b, #aed581)', fontWeight: 600, fontSize: '0.8rem' }}>
                + 新規ダイアグラムを作成
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        /* Has diagrams but no exports — show subtle note */
        <Box sx={{ py: 2 }}>
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.72rem' }}>
            まだ書き出しファイルはありません。エディタで「書き出す」を実行するとここに表示されます。
          </Typography>
        </Box>
      )}
    </Box>
  );
};
