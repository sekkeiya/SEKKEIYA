import React from 'react';
import {
  Box, Typography, Chip, Divider, IconButton, Tooltip,
  ToggleButtonGroup, ToggleButton, TextField,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import {
  useDsdStore, type LayoutTool, type LayoutMode, type ZoneCategory,
  type DsdStyle, type AnnotationColor, type AnnotationTool,
} from '../store/useDsdStore';
import { CATEGORY_DEFS, categoryDef } from '../canvas/layoutPalette';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ffb74d';

const STYLE_DEFS: { key: DsdStyle; label: string; desc: string; preview: string }[] = [
  { key: 'clean', label: 'Clean', desc: '白背景・細線・モノクロ',   preview: '#fafafa' },
  { key: 'bold',  label: 'Bold',  desc: 'カラフル・明快（BIG風）', preview: '#1565c0' },
  { key: 'dark',  label: 'Dark',  desc: '黒背景・光のような表現',   preview: '#0b0f16' },
];

const ANNOTATION_COLORS: { value: AnnotationColor; label: string }[] = [
  { value: '#ffffff', label: '白' },
  { value: '#ffd740', label: '黄' },
  { value: '#aed581', label: '緑' },
  { value: '#ff9800', label: '橙' },
];

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="caption" sx={{
    color: BRAND.sub2, textTransform: 'uppercase',
    letterSpacing: '0.07em', fontSize: '0.62rem',
    display: 'block', mb: 0.75,
  }}>
    {children}
  </Typography>
);

// ─── Zones panel ────────────────────────────────────────────────────────────

const ZonesPanel: React.FC = () => {
  const {
    layoutMode, setLayoutMode,
    layoutTool, setLayoutTool,
    layoutCategory, setLayoutCategory,
    zones, removeZone, updateZone, clearZones,
    selectedZoneId, setSelectedZoneId,
  } = useDsdStore();

  const toolBtn = (key: LayoutTool, icon: React.ReactNode, label: string) => (
    <Tooltip key={key} title={label} placement="bottom">
      <Box
        onClick={() => setLayoutTool(layoutTool === key ? 'none' : key)}
        sx={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 1.5, cursor: 'pointer',
          border: `1px solid ${layoutTool === key ? ACCENT : BRAND.line}`,
          bgcolor: layoutTool === key ? 'rgba(255,183,77,0.15)' : BRAND.panel,
          color: layoutTool === key ? ACCENT : BRAND.sub,
          transition: 'all 0.15s',
          '&:hover': { borderColor: ACCENT, color: ACCENT },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>ダイアグラム種別</SectionLabel>
        <ToggleButtonGroup
          value={layoutMode} exclusive
          onChange={(_, v: LayoutMode | null) => v && setLayoutMode(v)}
          size="small" fullWidth
          sx={{
            '& .MuiToggleButton-root': {
              flex: 1, px: 1, py: 0.6, fontSize: '0.7rem',
              color: BRAND.sub, borderColor: BRAND.line,
              '&.Mui-selected': {
                bgcolor: 'rgba(255,183,77,0.15)', color: ACCENT,
                borderColor: ACCENT,
                '&:hover': { bgcolor: 'rgba(255,183,77,0.22)' },
              },
            },
          }}
        >
          <ToggleButton value="zoning">ゾーニング</ToggleButton>
          <ToggleButton value="bubble">バブル</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <SectionLabel>ツール</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {toolBtn('none',    <NearMeRoundedIcon           sx={{ fontSize: 18 }} />, '選択／移動')}
          {toolBtn('addZone', <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />, 'ゾーン追加')}
          {toolBtn('flow',    <TimelineRoundedIcon         sx={{ fontSize: 18 }} />, layoutMode === 'zoning' ? '動線を引く' : '隣接を引く')}
        </Box>
        <Typography variant="caption" sx={{
          color: layoutTool === 'none' ? BRAND.sub2 : ACCENT,
          fontSize: '0.68rem', display: 'block', mt: 0.75, lineHeight: 1.5,
        }}>
          {layoutTool === 'addZone'
            ? 'キャンバスをクリックしてゾーンを配置'
            : layoutTool === 'flow'
              ? `ゾーンをドラッグ → 別のゾーンで放すと${layoutMode === 'zoning' ? '動線' : '隣接線'}を作成`
              : 'クリックで選択、ドラッグで移動、Delete で削除'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <SectionLabel>カテゴリ（次に追加）</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {CATEGORY_DEFS.map(c => {
            const isActive = layoutCategory === c.key;
            return (
              <Chip
                key={c.key}
                label={c.label}
                size="small"
                onClick={() => setLayoutCategory(c.key as ZoneCategory)}
                sx={{
                  fontSize: '0.68rem', cursor: 'pointer',
                  bgcolor: isActive ? `${c.bold.fill}33` : BRAND.panel,
                  color: isActive ? c.bold.stroke : BRAND.sub,
                  borderColor: isActive ? c.bold.stroke : BRAND.line,
                  border: '1px solid',
                  '&:hover': { borderColor: c.bold.stroke, color: c.bold.stroke },
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      {selectedZone && (
        <>
          <Box>
            <SectionLabel>選択中のゾーン</SectionLabel>
            <TextField
              fullWidth size="small"
              value={selectedZone.label}
              onChange={e => updateZone(selectedZone.id, { label: e.target.value })}
              variant="outlined"
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.78rem', color: BRAND.text,
                  '& fieldset': { borderColor: BRAND.line },
                  '&:hover fieldset': { borderColor: BRAND.line2 },
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
                カテゴリ
              </Typography>
              <Box sx={{
                px: 1, py: 0.2, borderRadius: 0.75,
                bgcolor: `${categoryDef(selectedZone.category).bold.fill}33`,
                color: categoryDef(selectedZone.category).bold.stroke,
                border: `1px solid ${categoryDef(selectedZone.category).bold.stroke}`,
                fontSize: '0.66rem',
              }}>
                {categoryDef(selectedZone.category).label}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem' }}>
                  幅 {selectedZone.w.toFixed(1)} m
                </Typography>
                <input
                  type="range" min={3} max={20} step={0.5}
                  value={selectedZone.w}
                  onChange={e => updateZone(selectedZone.id, { w: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: ACCENT }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem' }}>
                  奥行 {selectedZone.h.toFixed(1)} m
                </Typography>
                <input
                  type="range" min={3} max={20} step={0.5}
                  value={selectedZone.h}
                  onChange={e => updateZone(selectedZone.id, { h: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: ACCENT }}
                />
              </Box>
            </Box>
            <Chip
              label="✕ このゾーンを削除"
              size="small"
              onClick={() => removeZone(selectedZone.id)}
              sx={{
                mt: 1, fontSize: '0.68rem', cursor: 'pointer',
                bgcolor: 'rgba(255,82,82,0.12)', borderColor: '#ff5252', color: '#ff5252',
                border: '1px solid',
              }}
            />
          </Box>
          <Divider sx={{ borderColor: BRAND.line }} />
        </>
      )}

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
          <SectionLabel>配置済み ({zones.length})</SectionLabel>
          {zones.length > 0 && (
            <Tooltip title="すべて削除" placement="right">
              <IconButton
                size="small"
                onClick={clearZones}
                sx={{ ml: 'auto', color: BRAND.sub2, p: 0.25, mb: 0.75, '&:hover': { color: '#ff5252' } }}
              >
                <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {zones.length === 0 ? (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
            ゾーンがありません
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {zones.map(z => {
              const def = categoryDef(z.category);
              const isSel = z.id === selectedZoneId;
              return (
                <Box
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.6, borderRadius: 1,
                    border: `1px solid ${isSel ? ACCENT : BRAND.line}`,
                    bgcolor: isSel ? 'rgba(255,183,77,0.08)' : BRAND.panel,
                    cursor: 'pointer',
                    '&:hover': { borderColor: ACCENT },
                  }}
                >
                  <Box sx={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    bgcolor: def.bold.fill,
                    border: `1px solid ${def.bold.stroke}`,
                  }} />
                  <Typography variant="caption" sx={{
                    color: isSel ? ACCENT : BRAND.sub, fontSize: '0.7rem',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {z.label}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); removeZone(z.id); }}
                    sx={{ color: BRAND.sub2, p: 0.1, '&:hover': { color: '#ff5252' } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Flow panel ─────────────────────────────────────────────────────────────

const FlowPanel: React.FC = () => {
  const {
    layoutMode, flows, zones, removeFlow, clearFlows,
    isLayoutAnimating, setIsLayoutAnimating,
  } = useDsdStore();

  const isZoning = layoutMode === 'zoning';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>{isZoning ? '動線アニメーション' : '隣接線'}</SectionLabel>
        {isZoning ? (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            p: 1.25, borderRadius: 1.5,
            border: `1px solid ${flows.length === 0 ? BRAND.line : ACCENT}`,
            bgcolor: flows.length === 0 ? BRAND.panel : 'rgba(255,183,77,0.08)',
          }}>
            <IconButton
              size="small"
              onClick={() => setIsLayoutAnimating(!isLayoutAnimating)}
              disabled={flows.length === 0}
              sx={{ color: isLayoutAnimating ? ACCENT : BRAND.sub, p: 0.5 }}
            >
              {isLayoutAnimating ? <PauseRoundedIcon sx={{ fontSize: 20 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />}
            </IconButton>
            <Typography variant="caption" sx={{
              color: flows.length === 0 ? BRAND.sub2 : ACCENT, fontSize: '0.72rem',
            }}>
              {flows.length === 0
                ? '動線を引くと人の動きを再生できます'
                : isLayoutAnimating
                  ? '▶ 動線を再生中…'
                  : '▶ 再生'}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.7rem' }}>
            バブルダイアグラムでは隣接関係を破線で表示します
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
          <SectionLabel>
            {isZoning ? '動線' : '隣接'} ({flows.length})
          </SectionLabel>
          {flows.length > 0 && (
            <Tooltip title="すべて削除" placement="right">
              <IconButton
                size="small"
                onClick={clearFlows}
                sx={{ ml: 'auto', color: BRAND.sub2, p: 0.25, mb: 0.75, '&:hover': { color: '#ff5252' } }}
              >
                <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {flows.length === 0 ? (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
            「動線を引く」ツールでゾーン同士を繋いでください
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {flows.map((f, i) => {
              const from = zones.find(z => z.id === f.fromZoneId);
              const to = zones.find(z => z.id === f.toZoneId);
              return (
                <Box
                  key={f.id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.6, borderRadius: 1,
                    border: `1px solid ${BRAND.line}`,
                    bgcolor: BRAND.panel,
                  }}
                >
                  <Typography variant="caption" sx={{
                    color: BRAND.sub2, fontSize: '0.66rem', minWidth: 18,
                  }}>
                    {i + 1}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: BRAND.sub, fontSize: '0.7rem', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {from?.label ?? '?'} {isZoning ? '→' : '↔'} {to?.label ?? '?'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => removeFlow(f.id)}
                    sx={{ color: BRAND.sub2, p: 0.1, '&:hover': { color: '#ff5252' } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Style panel (shared look with sun editor) ──────────────────────────────

const StylePanel: React.FC = () => {
  const { style, setStyle } = useDsdStore();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SectionLabel>スタイル</SectionLabel>
      {STYLE_DEFS.map(s => (
        <Box
          key={s.key}
          onClick={() => setStyle(s.key)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.25, py: 1, borderRadius: 1.5, cursor: 'pointer',
            border: `1px solid ${style === s.key ? ACCENT : BRAND.line}`,
            bgcolor: style === s.key ? 'rgba(255,183,77,0.1)' : BRAND.panel,
            transition: 'all 0.15s',
            '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(255,183,77,0.07)' },
          }}
        >
          <Box sx={{
            width: 28, height: 28, borderRadius: 1, flexShrink: 0,
            bgcolor: s.preview,
            border: s.key === 'clean' ? '1px solid #ccc' : `1px solid ${s.preview}`,
            boxShadow: style === s.key ? `0 0 6px ${ACCENT}44` : 'none',
          }} />
          <Box>
            <Typography variant="caption" sx={{ color: style === s.key ? ACCENT : BRAND.text, fontWeight: 600, display: 'block', fontSize: '0.75rem' }}>
              {s.label}
            </Typography>
            <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>{s.desc}</Typography>
          </Box>
          {style === s.key && (
            <Box sx={{ ml: 'auto', width: 6, height: 6, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

// ─── Annotation panel (text / arrow — same primitives as sun editor) ───────

const AnnotatePanel: React.FC = () => {
  const {
    annotationTool, setAnnotationTool,
    annotationColor, setAnnotationColor,
    annotations, removeAnnotation, clearAnnotations,
  } = useDsdStore();

  const toolBtn = (key: AnnotationTool, icon: React.ReactNode, label: string) => (
    <Tooltip key={key} title={label} placement="bottom">
      <Box
        onClick={() => setAnnotationTool(key)}
        sx={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 1.5, cursor: 'pointer',
          border: `1px solid ${annotationTool === key ? ACCENT : BRAND.line}`,
          bgcolor: annotationTool === key ? 'rgba(255,183,77,0.15)' : BRAND.panel,
          color: annotationTool === key ? ACCENT : BRAND.sub,
          transition: 'all 0.15s',
          '&:hover': { borderColor: ACCENT, color: ACCENT },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem', lineHeight: 1.5 }}>
        ※ アノテーションはレイアウト編集ではなくキャンバスへの注記用です（現状は配置済みリストの閲覧・削除）。
      </Typography>

      <Box>
        <SectionLabel>ツール（テキスト / 矢印）</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {toolBtn('none',  <NearMeRoundedIcon         sx={{ fontSize: 18 }} />, '選択')}
          {toolBtn('text',  <TextFieldsRoundedIcon     sx={{ fontSize: 18 }} />, 'テキスト')}
          {toolBtn('arrow', <ArrowRightAltRoundedIcon  sx={{ fontSize: 20 }} />, '矢印')}
        </Box>
      </Box>

      <Box>
        <SectionLabel>カラー</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {ANNOTATION_COLORS.map(c => (
            <Tooltip key={c.value} title={c.label} placement="bottom">
              <Box
                onClick={() => setAnnotationColor(c.value)}
                sx={{
                  width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                  bgcolor: c.value,
                  border: annotationColor === c.value ? `2px solid ${ACCENT}` : '2px solid transparent',
                  outline: annotationColor === c.value ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)',
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
          <SectionLabel>配置済み ({annotations.length})</SectionLabel>
          {annotations.length > 0 && (
            <Tooltip title="すべて削除" placement="right">
              <IconButton
                size="small"
                onClick={clearAnnotations}
                sx={{ ml: 'auto', color: BRAND.sub2, p: 0.25, mb: 0.75, '&:hover': { color: '#ff5252' } }}
              >
                <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {annotations.length === 0 ? (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
            アノテーションがありません
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {annotations.map(ann => (
              <Box
                key={ann.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.6, borderRadius: 1,
                  border: `1px solid ${BRAND.line}`,
                  bgcolor: BRAND.panel,
                }}
              >
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: ann.color,
                }} />
                <Typography variant="caption" sx={{
                  color: BRAND.sub, fontSize: '0.68rem',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ann.type === 'text' ? `T  ${ann.text}` : '→  矢印'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => removeAnnotation(ann.id)}
                  sx={{ color: BRAND.sub2, p: 0.1, '&:hover': { color: '#ff5252' } }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Main sidebar ───────────────────────────────────────────────────────────

export const LayoutEditorSidebar: React.FC = () => {
  const layoutEditorTab = useDsdStore(s => s.layoutEditorTab);

  const TAB_LABELS: Record<string, string> = {
    zones: 'ゾーン',
    flow: '動線・隣接',
    style: 'スタイル',
    annotate: 'アノテーション',
  };

  return (
    <Box sx={{
      width: '100%', height: '100%',
      bgcolor: BRAND.bg,
      borderRight: `1px solid ${BRAND.line}`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1, borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
        <Typography variant="caption" sx={{
          color: ACCENT, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem',
        }}>
          {TAB_LABELS[layoutEditorTab] ?? layoutEditorTab}
        </Typography>
      </Box>
      <Box sx={{
        flex: 1, overflowY: 'auto', p: 1.75,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line2, borderRadius: 2 },
      }}>
        {layoutEditorTab === 'zones'    && <ZonesPanel />}
        {layoutEditorTab === 'flow'     && <FlowPanel />}
        {layoutEditorTab === 'style'    && <StylePanel />}
        {layoutEditorTab === 'annotate' && <AnnotatePanel />}
      </Box>
    </Box>
  );
};
