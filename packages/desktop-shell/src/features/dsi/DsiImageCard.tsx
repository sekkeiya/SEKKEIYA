import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { TEXTURE_SLOTS, type TextureGroup } from './textureGrouping';

/**
 * カードの正方形サムネイル一辺（= カード本体の横幅）。
 * グリッド（DsiImageGrid）はこの値を固定カラム幅として使う。
 * S.Model と同じ「固定ピクセルで正方形を作る」方式。CSS の aspect-ratio /
 * padding-top は実機（WebView2）で行高さに寄与せずカードが潰れるため使わない。
 */
export const DSI_CARD_SIZE = 210;
/** サムネイル下のメタ情報（タイトル＋カテゴリ）の確保高さ。FixedSizeGrid の行高さ計算に使う。 */
export const DSI_META_HEIGHT = 56;

const ACCENT = '#ec407a';

const CATEGORY_COLOR: Record<string, string> = {
  '静止画': '#ec407a',
  '動画': '#7e57c2',
  'AIレンダー': '#26a69a',
  'テクスチャ': '#42a5f5',
};

const SOURCE_LABEL: Record<string, string> = {
  'layout-render': 'S.Layout',
  'ai-render': 'AI Render',
};

export interface DsiCardProps {
  item: any;
  variant: 'set' | 'image' | 'texture-group';
  active?: boolean;
  /** セットの子枚数（グリッド側で計算した実数。未指定なら item.childCount） */
  childCount?: number;
  /** テクスチャグループ（variant='texture-group' のとき） */
  textureGroup?: TextureGroup;
  onClick?: () => void;
  /** ダブルクリック（ライトボックス起動など）。 */
  onDoubleClick?: () => void;
  onDelete?: () => void;
  /** 複数選択モード（チェックボックス表示・選択リング） */
  pickMode?: boolean;
  /** 選択中か（pickMode 時） */
  picked?: boolean;
  /** S.Material 生成済みか（ピッカーモード時にバッジ表示） */
  isGenerated?: boolean;
  /** テクスチャ手動セット化モード（チェック表示・選択リング、メタは隠さない） */
  selectMode?: boolean;
  /** セット化モードで選択中か */
  selected?: boolean;
}

export const DsiImageCard: React.FC<DsiCardProps> = ({ item, variant, active, childCount, textureGroup, onClick, onDoubleClick, onDelete, pickMode, picked, isGenerated, selectMode, selected }) => {
  const isGroup = variant === 'texture-group';
  const setCount = childCount ?? item.childCount ?? 0;
  const title = isGroup
    ? (textureGroup?.title || item.title || item.name || 'マテリアル')
    : item.title || item.name || (variant === 'set' ? 'Untitled Set' : 'Untitled');
  const category = isGroup ? 'テクスチャ' : (item.category as string | undefined);
  const isVideo = item.mediaType === 'video';
  const isLinked = item.sourceType === 'layout-render' || item.sourceType === 'ai-render';
  const TEX_ACCENT = '#42a5f5';
  const selBlue = !!selectMode && !!selected;
  const highlighted = picked || active || selBlue;
  // グループに含まれるスロット（重ねカードの後ろ枚数表現にも使う）。
  const presentSlots = isGroup && textureGroup
    ? TEXTURE_SLOTS.filter((s) => textureGroup.slots[s.key])
    : [];
  // 背面の重ね紙の枚数（最大 3 枚、ベースカラー以外のマップ数を反映）。
  const stackCount = isGroup ? Math.min(3, Math.max(1, presentSlots.length - 1 || (textureGroup?.items.length || 1) - 1)) : 0;

  const mainCard = (
    <Box
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{
        width: '100%',
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
        border: `1px solid ${selBlue ? TEX_ACCENT : highlighted ? ACCENT : isGroup ? `${TEX_ACCENT}55` : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
        boxShadow: selBlue ? `0 0 0 2px ${TEX_ACCENT}` : highlighted ? `0 0 0 1px ${ACCENT}` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', '& .dsi-card-actions': { opacity: 1 } },
      }}
    >
      {/* Thumbnail: 固定ピクセルの正方形（一辺 = DSI_CARD_SIZE）。 */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: DSI_CARD_SIZE,
          bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {variant === 'set' ? (
          <FolderRoundedIcon sx={{ fontSize: 48, color: ACCENT, opacity: 0.85 }} />
        ) : isVideo ? (
          item.downloadUrl ? (
            <>
              <Box
                component="video"
                src={item.downloadUrl}
                muted
                preload="metadata"
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <PlayCircleOutlineRoundedIcon
                sx={{ position: 'absolute', fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.9)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}
              />
            </>
          ) : (
            <MovieRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
          )
        ) : (item.thumbnailUrl || item.downloadUrl) ? (
          <Box
            component="img"
            src={item.thumbnailUrl || item.downloadUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
        )}

        {/* 複数選択モード: チェックボックス（top-right） */}
        {pickMode && (variant === 'image' || variant === 'texture-group') && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1 }}>
            {picked
              ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: ACCENT }} />
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />}
          </Box>
        )}
        {/* テクスチャ手動セット化モード: チェック（top-right、青系） */}
        {selectMode && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 3, display: 'flex', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.1 }}>
            {selected
              ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: TEX_ACCENT }} />
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />}
          </Box>
        )}
        {/* 生成済みバッジ（ピッカーモード時、top-left に表示） */}
        {pickMode && isGenerated && (
          <Box sx={{
            position: 'absolute', top: 6, left: 6, zIndex: 3,
            px: 0.75, py: 0.25, borderRadius: 1, fontSize: 9.5, fontWeight: 700,
            bgcolor: 'rgba(76,175,80,0.85)', color: 'var(--brand-fg)', letterSpacing: 0.3,
            backdropFilter: 'blur(2px)',
          }}>
            生成済み
          </Box>
        )}

        {/* Badges (top-left) */}
        <Box sx={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 0.5, zIndex: 1 }}>
          {isGroup ? (
            <Chip
              size="small"
              icon={<LayersRoundedIcon sx={{ fontSize: 12, color: '#fff !important' }} />}
              label={`${textureGroup?.items.length ?? 0} マップ`}
              sx={{ height: 18, fontSize: 10, bgcolor: `${TEX_ACCENT}cc`, color: 'var(--brand-fg)', '& .MuiChip-label': { pl: 0.5 } }}
            />
          ) : variant === 'set' ? (
            <Chip size="small" label={`${setCount} 点`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)' }} />
          ) : isLinked ? (
            <Chip
              size="small"
              icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: '#fff !important' }} />}
              label={SOURCE_LABEL[item.sourceType] || 'リンク'}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)', '& .MuiChip-label': { pl: 0.5 } }}
            />
          ) : null}
        </Box>

        {/* Delete (hover) */}
        {onDelete && !pickMode && (
          <Box className="dsi-card-actions" sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.15s', zIndex: 2 }}>
            <Tooltip title="削除" placement="top">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'rgb(var(--brand-fg-rgb) / 0.8)', '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(0,0,0,0.7)' } }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* テクスチャグループ: 含まれるスロット表示（bottom） */}
        {isGroup && presentSlots.length > 0 && !pickMode && (
          <Box sx={{ position: 'absolute', left: 6, right: 6, bottom: 6, display: 'flex', flexWrap: 'wrap', gap: 0.5, zIndex: 1 }}>
            {presentSlots.map((s) => (
              <Box
                key={s.key}
                sx={{
                  px: 0.75, py: 0.125, borderRadius: 0.75, fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                  color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.6)', border: `1px solid ${TEX_ACCENT}77`,
                }}
              >
                {s.short}
              </Box>
            ))}
          </Box>
        )}

        {/* ピックモード時: タイトルを画像下部にオーバーレイ表示 */}
        {pickMode && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
            px: 1, py: 0.625,
            bgcolor: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
          }}>
            <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
              {title}
            </Typography>
            {isGroup && (textureGroup?.tags || []).length > 0 && (
              <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 9.5, lineHeight: 1.2, mt: 0.125 }}>
                {(textureGroup?.tags || []).slice(0, 4).join(' · ')}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Meta（ピッカー時は非表示にして正方形カードに） */}
      {!pickMode && (
        <Box sx={{ px: 1.25, py: 1, height: DSI_META_HEIGHT, boxSizing: 'border-box', overflow: 'hidden' }}>
          <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 12.5, fontWeight: 600 }}>{title}</Typography>
          {isGroup ? (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, overflow: 'hidden' }}>
              {/* 用途・部位（どこに使えるか）を優先表示 */}
              {(textureGroup?.applications || []).slice(0, 4).map((a) => (
                <Chip
                  key={a}
                  size="small"
                  label={a}
                  sx={{ height: 18, fontSize: 10, fontWeight: 600, color: 'var(--brand-fg)', bgcolor: 'rgba(102,187,106,0.28)', border: '1px solid rgba(102,187,106,0.6)' }}
                />
              ))}
            </Box>
          ) : category && (
            <Chip
              size="small"
              label={category}
              sx={{ mt: 0.5, height: 18, fontSize: 10, color: 'var(--brand-fg)', bgcolor: `${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.15)'}33`, border: `1px solid ${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.2)'}55` }}
            />
          )}
        </Box>
      )}

    </Box>
  );

  if (!isGroup) return mainCard;

  // 重ねカード: 背面にずらした「紙」を描いて 4 枚がひとまとまりであることを示す。
  // 一番上（mainCard）はベースカラー。背面はマップ枚数に応じて 1〜3 枚。
  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {Array.from({ length: stackCount }).map((_, i) => {
        const depth = stackCount - i; // 奥ほど大きいオフセット
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${depth * 4}px, ${-depth * 4}px)`,
              borderRadius: 2,
              bgcolor: 'rgba(28,32,40,0.95)',
              border: `1px solid ${TEX_ACCENT}33`,
              zIndex: 0,
            }}
          />
        );
      })}
      <Box sx={{ position: 'relative', zIndex: 1 }}>{mainCard}</Box>
    </Box>
  );
};
