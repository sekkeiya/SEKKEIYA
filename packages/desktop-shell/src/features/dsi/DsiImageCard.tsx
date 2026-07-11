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
 * カードは SEKKEIYA Drive の画像カードと同じ体裁に揃える。
 *  - サムネイルは 16:10 の横長（Drive の aspectRatio '16/10' 相当）。
 *  - カード背景は surface2、サムネ背景は surface、選択時はリング＋チェック。
 *  - メタ（タイトル＋タグ）は中央寄せ。タグが無ければカテゴリ、それも無ければ「未整理」。
 * 仮想グリッド（DsiImageGrid の FixedSizeGrid）は固定ピクセルで行高を計算するため、
 * CSS の aspect-ratio ではなく固定の高さ定数を使う（WebView2 で行高が潰れるのを避ける）。
 */
/** カード本体の横幅（＝グリッドのカラム幅の基準）。Drive の既定カード幅に合わせる。 */
export const DSI_CARD_WIDTH = 240;
/** サムネイルの高さ（16:10 → 240 × 10/16 = 150）。 */
export const DSI_THUMB_HEIGHT = 150;
/** サムネイル下のメタ情報（中央寄せのタイトル＋タグ行）の確保高さ。 */
export const DSI_META_HEIGHT = 68;

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

type ChipColor = { color: string; bg: string; bd: string };
const NEUTRAL_CHIP: ChipColor = { color: 'var(--brand-fg)', bg: 'rgb(var(--brand-fg-rgb) / 0.08)', bd: 'rgb(var(--brand-fg-rgb) / 0.14)' };
const AI_CHIP: ChipColor = { color: '#00BFFF', bg: 'rgba(0,191,255,0.1)', bd: 'rgba(0,191,255,0.3)' };
const APP_CHIP: ChipColor = { color: 'var(--brand-fg)', bg: 'rgba(102,187,106,0.28)', bd: 'rgba(102,187,106,0.6)' };

/** Drive と同じ体裁の極小タグチップ（MUI Chip より軽量で overflow に強い Box 版）。 */
const DriveTagChip: React.FC<{ label: string; color?: ChipColor }> = ({ label, color = NEUTRAL_CHIP }) => (
  <Box
    sx={{
      px: 0.85, py: 0.15, borderRadius: 1, fontSize: 10, fontWeight: 600, lineHeight: 1.5,
      color: color.color, bgcolor: color.bg, border: `1px solid ${color.bd}`,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}
  >
    {label}
  </Box>
);

/** タグの表示名（AI:/Rule:/User: のプレフィックスを外す）。 */
const cleanTag = (t: string) => String(t).replace(/^(AI|Rule|User):\s*/, '');

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
  const tags: string[] = !isGroup && Array.isArray(item.tags) ? item.tags : [];
  const isVideo = item.mediaType === 'video';
  const isLinked = item.sourceType === 'layout-render' || item.sourceType === 'ai-render';
  const TEX_ACCENT = '#42a5f5';
  const selBlue = !!selectMode && !!selected;
  const highlighted = picked || active || selBlue;
  const ringColor = selBlue ? TEX_ACCENT : ACCENT;
  // グループに含まれるスロット（重ねカードの後ろ枚数表現にも使う）。
  const presentSlots = isGroup && textureGroup
    ? TEXTURE_SLOTS.filter((s) => textureGroup.slots[s.key])
    : [];
  // 背面の重ね紙の枚数（最大 3 枚、ベースカラー以外のマップ数を反映）。
  const stackCount = isGroup ? Math.min(3, Math.max(1, presentSlots.length - 1 || (textureGroup?.items.length || 1) - 1)) : 0;

  // メタ下部のチップ行（Drive: タグ→カテゴリ→未整理 の優先で中央寄せ表示）。
  const metaChips = isGroup ? (
    (textureGroup?.applications || []).slice(0, 4).map((a) => <DriveTagChip key={a} label={a} color={APP_CHIP} />)
  ) : variant === 'set' ? (
    <DriveTagChip label={`${setCount} 点`} />
  ) : tags.length > 0 ? (
    tags.slice(0, 3).map((t, i) => <DriveTagChip key={i} label={cleanTag(t)} color={/^AI:/.test(t) ? AI_CHIP : NEUTRAL_CHIP} />)
  ) : category ? (
    <DriveTagChip label={category} color={{ color: 'var(--brand-fg)', bg: `${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.15)'}33`, bd: `${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.2)'}55` }} />
  ) : (
    <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#FF9800' }}>未整理</Typography>
  );

  const mainCard = (
    <Box
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 1.5,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        bgcolor: 'var(--brand-surface2)',
        border: '1px solid',
        borderColor: highlighted ? ringColor : isGroup ? `${TEX_ACCENT}55` : 'transparent',
        outline: highlighted ? `1px solid ${ringColor}` : 'none',
        transition: 'border-color 0.15s, outline-color 0.15s',
        '&:hover': { borderColor: highlighted ? ringColor : 'rgb(var(--brand-fg-rgb) / 0.25)', '& .dsi-card-actions': { opacity: 1 } },
      }}
    >
      {/* Thumbnail: 16:10 の横長（Drive と同じ体裁）。 */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: DSI_THUMB_HEIGHT,
          bgcolor: 'var(--brand-surface)',
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
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', bgcolor: 'rgba(20,21,24,0.6)', borderRadius: '50%', p: 0.1, backdropFilter: 'blur(4px)' }}>
            {picked
              ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: ACCENT }} />
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />}
          </Box>
        )}
        {/* テクスチャ手動セット化モード: チェック（top-right、青系） */}
        {selectMode && (
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 3, display: 'flex', bgcolor: 'rgba(20,21,24,0.6)', borderRadius: '50%', p: 0.1, backdropFilter: 'blur(4px)' }}>
            {selected
              ? <CheckCircleRoundedIcon sx={{ fontSize: 22, color: TEX_ACCENT }} />
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }} />}
          </Box>
        )}
        {/* 選択中（右パネル対象）: Drive と同じチェック丸を top-right に表示。 */}
        {active && !pickMode && !selectMode && (
          <CheckCircleRoundedIcon
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, fontSize: 20, color: ACCENT, bgcolor: 'rgba(20,21,24,0.6)', borderRadius: '50%', backdropFilter: 'blur(4px)' }}
          />
        )}
        {/* 生成済みバッジ（ピッカーモード時、top-left に表示） */}
        {pickMode && isGenerated && (
          <Box sx={{
            position: 'absolute', top: 8, left: 8, zIndex: 3,
            px: 0.75, py: 0.25, borderRadius: 1, fontSize: 9.5, fontWeight: 700,
            bgcolor: 'rgba(76,175,80,0.85)', color: 'var(--brand-fg)', letterSpacing: 0.3,
            backdropFilter: 'blur(2px)',
          }}>
            生成済み
          </Box>
        )}

        {/* Badges (top-left) */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5, zIndex: 1 }}>
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
          <Box className="dsi-card-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity 0.15s', zIndex: 4 }}>
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
            <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 11, fontWeight: 600, lineHeight: 1.3, textAlign: 'center' }}>
              {title}
            </Typography>
            {isGroup && (textureGroup?.tags || []).length > 0 && (
              <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 9.5, lineHeight: 1.2, mt: 0.125, textAlign: 'center' }}>
                {(textureGroup?.tags || []).slice(0, 4).join(' · ')}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Meta（Drive と同じく中央寄せ。ピッカー時は非表示にして正方形カードに） */}
      {!pickMode && (
        <Box sx={{ p: 1.5, textAlign: 'center', minHeight: DSI_META_HEIGHT, boxSizing: 'border-box', overflow: 'hidden' }}>
          <Typography noWrap sx={{ color: highlighted ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.85)', fontSize: 12, fontWeight: highlighted ? 600 : 500 }}>
            {title}
          </Typography>
          <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', maxWidth: '100%' }}>
            {metaChips}
          </Box>
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
              borderRadius: 1.5,
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
