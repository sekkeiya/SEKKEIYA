import React from 'react';
import {
  Box, Typography, Slider, Chip, Select, MenuItem,
  FormControl, Divider, Tooltip, IconButton,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import { useDsdStore, type DsdStyle, type PresetShape, type AnnotationColor, type AnnotationTool } from '../store/useDsdStore';
import { BRAND } from '../../../styles/theme';
import { LayoutEditorSidebar } from './LayoutEditorSidebar';
import { SiteEditorSidebar } from './SiteEditorSidebar';
import { EnvEditorSidebar } from './EnvEditorSidebar';

const ACCENT = '#aed581';

const MONTHS_JP = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const LOCATIONS = [
  { label: '東京 (35.7°N)', lat: 35.7 },
  { label: '大阪 (34.7°N)', lat: 34.7 },
  { label: '名古屋 (35.2°N)', lat: 35.2 },
  { label: '札幌 (43.1°N)', lat: 43.1 },
  { label: '福岡 (33.6°N)', lat: 33.6 },
  { label: '那覇 (26.2°N)', lat: 26.2 },
  { label: '仙台 (38.3°N)', lat: 38.3 },
];

const STYLE_DEFS: { key: DsdStyle; label: string; desc: string; preview: string }[] = [
  { key: 'clean', label: 'Clean',  desc: '白背景・細線・モノクロ',   preview: '#fafafa' },
  { key: 'bold',  label: 'Bold',   desc: 'カラフル・明快（BIG風）', preview: '#1565c0' },
  { key: 'dark',  label: 'Dark',   desc: '黒背景・光のような表現',   preview: '#0b0f16' },
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

const sliderSx = {
  color: ACCENT, height: 2, mt: 0.5,
  '& .MuiSlider-thumb': { width: 12, height: 12 },
  '& .MuiSlider-rail': { opacity: 0.2 },
};

// ─── Shape panel ─────────────────────────────────────────────────────────────

const ShapePanel: React.FC = () => {
  const {
    presetShape, setPresetShape,
    buildingWidth, setBuildingWidth,
    buildingDepth, setBuildingDepth,
    buildingHeight, setBuildingHeight,
    northAngle, setNorthAngle,
    isDrawingPolygon, setIsDrawingPolygon, setDraftPolygon,
  } = useDsdStore();

  const SHAPES: { key: PresetShape; label: string }[] = [
    { key: 'rectangle', label: '□ 矩形' },
    { key: 'lShape',    label: 'L字' },
    { key: 'uShape',    label: 'コ字' },
  ];

  const startPolygonDraw = () => {
    setDraftPolygon([]);
    setIsDrawingPolygon(true);
  };
  const cancelPolygonDraw = () => {
    setIsDrawingPolygon(false);
    setDraftPolygon([]);
    if (presetShape === 'custom') setPresetShape('rectangle');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>プリセット</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {SHAPES.map(s => (
            <Chip
              key={s.key}
              label={s.label}
              size="small"
              onClick={() => { setPresetShape(s.key); setIsDrawingPolygon(false); setDraftPolygon([]); }}
              sx={{
                fontSize: '0.7rem', cursor: 'pointer',
                bgcolor: presetShape === s.key && !isDrawingPolygon ? 'rgba(174,213,129,0.18)' : BRAND.panel,
                borderColor: presetShape === s.key && !isDrawingPolygon ? ACCENT : BRAND.line,
                color: presetShape === s.key && !isDrawingPolygon ? ACCENT : BRAND.sub,
                border: '1px solid',
                '&:hover': { borderColor: ACCENT, color: ACCENT },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <SectionLabel>自由描画</SectionLabel>
        {isDrawingPolygon ? (
          <>
            <Typography variant="caption" sx={{ color: ACCENT, display: 'block', mb: 1, lineHeight: 1.5, fontSize: '0.7rem' }}>
              キャンバスをクリックして頂点を追加。最初の点かダブルクリックで完了。
            </Typography>
            <Chip
              label="✕ キャンセル"
              size="small"
              onClick={cancelPolygonDraw}
              sx={{ fontSize: '0.7rem', cursor: 'pointer', bgcolor: 'rgba(255,82,82,0.12)', borderColor: '#ff5252', color: '#ff5252', border: '1px solid' }}
            />
          </>
        ) : (
          <Chip
            label="✏ ポリゴン描画"
            size="small"
            onClick={startPolygonDraw}
            sx={{
              fontSize: '0.7rem', cursor: 'pointer',
              bgcolor: presetShape === 'custom' ? 'rgba(174,213,129,0.18)' : BRAND.panel,
              borderColor: presetShape === 'custom' ? ACCENT : BRAND.line,
              color: presetShape === 'custom' ? ACCENT : BRAND.sub,
              border: '1px solid',
              '&:hover': { borderColor: ACCENT, color: ACCENT },
            }}
          />
        )}
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <SectionLabel>サイズ</SectionLabel>
        <Typography variant="caption" sx={{ color: BRAND.sub2 }}>幅  {buildingWidth} m</Typography>
        <Slider value={buildingWidth} min={4} max={30} step={1}
          onChange={(_, v) => setBuildingWidth(v as number)}
          size="small" sx={sliderSx} disabled={presetShape === 'custom'} />

        <Typography variant="caption" sx={{ color: BRAND.sub2 }}>奥行  {buildingDepth} m</Typography>
        <Slider value={buildingDepth} min={4} max={30} step={1}
          onChange={(_, v) => setBuildingDepth(v as number)}
          size="small" sx={sliderSx} disabled={presetShape === 'custom'} />

        <Typography variant="caption" sx={{ color: BRAND.sub2 }}>高さ  {buildingHeight} m</Typography>
        <Slider value={buildingHeight} min={2} max={40} step={0.5}
          onChange={(_, v) => setBuildingHeight(v as number)}
          size="small" sx={sliderSx} />
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <SectionLabel>方位角</SectionLabel>
        <Typography variant="caption" sx={{ color: BRAND.sub2 }}>北向き補正  {northAngle}°</Typography>
        <Slider value={northAngle} min={-180} max={180} step={5}
          onChange={(_, v) => setNorthAngle(v as number)}
          size="small" sx={sliderSx} />
      </Box>
    </Box>
  );
};

// ─── Sun panel ────────────────────────────────────────────────────────────────

const SunPanel: React.FC = () => {
  const {
    month, setMonth,
    timeHour, setTimeHour,
    latitude, setLatitude,
    isAnimating, setIsAnimating,
  } = useDsdStore();

  const selectedLat = LOCATIONS.find(l => Math.abs(l.lat - latitude) < 0.5)?.lat ?? latitude;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>敷地・緯度</SectionLabel>
        <FormControl fullWidth size="small">
          <Select
            value={selectedLat}
            onChange={e => setLatitude(e.target.value as number)}
            sx={{
              fontSize: '0.75rem', color: BRAND.text,
              '.MuiOutlinedInput-notchedOutline': { borderColor: BRAND.line },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.line2 },
            }}
          >
            {LOCATIONS.map(l => (
              <MenuItem key={l.lat} value={l.lat} sx={{ fontSize: '0.75rem' }}>{l.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <SectionLabel>月</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {MONTHS_JP.map((label, i) => {
            const m = i + 1;
            return (
              <Chip
                key={m} label={label} size="small"
                onClick={() => setMonth(m)}
                sx={{
                  fontSize: '0.66rem', cursor: 'pointer',
                  bgcolor: month === m ? 'rgba(174,213,129,0.18)' : BRAND.panel,
                  borderColor: month === m ? ACCENT : BRAND.line,
                  color: month === m ? ACCENT : BRAND.sub,
                  border: '1px solid',
                  '&:hover': { borderColor: ACCENT },
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <SectionLabel>時刻</SectionLabel>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <Typography variant="caption" sx={{ color: BRAND.sub, fontSize: '0.72rem' }}>
              {String(Math.floor(timeHour)).padStart(2, '0')}:{String(Math.floor((timeHour % 1) * 60)).padStart(2, '0')}
            </Typography>
            <IconButton size="small" onClick={() => setIsAnimating(!isAnimating)} sx={{ color: isAnimating ? ACCENT : BRAND.sub, p: 0.25 }}>
              {isAnimating ? <PauseRoundedIcon sx={{ fontSize: 16 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Box>
        </Box>
        <Slider
          value={timeHour} min={0} max={24} step={0.25}
          onChange={(_, v) => { setTimeHour(v as number); setIsAnimating(false); }}
          size="small" sx={sliderSx}
          disabled={isAnimating}
        />
        {isAnimating && (
          <Typography variant="caption" sx={{ color: ACCENT, fontSize: '0.68rem' }}>▶ 日の出 〜 日没 を再生中</Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Style panel ──────────────────────────────────────────────────────────────

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
            bgcolor: style === s.key ? 'rgba(174,213,129,0.1)' : BRAND.panel,
            transition: 'all 0.15s',
            '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(174,213,129,0.07)' },
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

// ─── Annotate panel ───────────────────────────────────────────────────────────

const AnnotatePanel: React.FC = () => {
  const {
    annotationTool, setAnnotationTool,
    annotationColor, setAnnotationColor,
    annotations, removeAnnotation, clearAnnotations,
  } = useDsdStore();

  const toolBtn = (key: AnnotationTool, icon: React.ReactNode, label: string) => (
    <Tooltip title={label} placement="bottom">
      <Box
        onClick={() => setAnnotationTool(key)}
        sx={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 1.5, cursor: 'pointer',
          border: `1px solid ${annotationTool === key ? ACCENT : BRAND.line}`,
          bgcolor: annotationTool === key ? 'rgba(174,213,129,0.15)' : BRAND.panel,
          color: annotationTool === key ? ACCENT : BRAND.sub,
          transition: 'all 0.15s',
          '&:hover': { borderColor: ACCENT, color: ACCENT },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  const hint =
    annotationTool === 'none'  ? 'クリックで選択、ドラッグで移動。Delete で削除' :
    annotationTool === 'text'  ? 'キャンバスをクリックしてテキストを配置' :
                                 'ドラッグして矢印を描画';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>ツール</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {toolBtn('none',  <NearMeRoundedIcon         sx={{ fontSize: 18 }} />, '選択')}
          {toolBtn('text',  <TextFieldsRoundedIcon     sx={{ fontSize: 18 }} />, 'テキスト')}
          {toolBtn('arrow', <ArrowRightAltRoundedIcon  sx={{ fontSize: 20 }} />, '矢印')}
        </Box>
        <Typography variant="caption" sx={{
          color: annotationTool === 'none' ? BRAND.sub2 : ACCENT,
          fontSize: '0.68rem', display: 'block', mt: 0.75, lineHeight: 1.5,
        }}>
          {hint}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

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
                  transition: 'all 0.15s',
                  '&:hover': { outline: `1px solid ${ACCENT}` },
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
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  bgcolor: ann.color,
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

// ─── Main sidebar (sun template) ──────────────────────────────────────────────

const SunEditorSidebar: React.FC = () => {
  const editorTab = useDsdStore(s => s.editorTab);

  const TAB_LABELS: Record<string, string> = {
    shape: '形状',
    sun: '日照・環境',
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
          {TAB_LABELS[editorTab] ?? editorTab}
        </Typography>
      </Box>

      <Box sx={{
        flex: 1, overflowY: 'auto', p: 1.75,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line2, borderRadius: 2 },
      }}>
        {editorTab === 'shape'    && <ShapePanel />}
        {editorTab === 'sun'      && <SunPanel />}
        {editorTab === 'style'    && <StylePanel />}
        {editorTab === 'annotate' && <AnnotatePanel />}
      </Box>
    </Box>
  );
};

// ─── Router: picks sidebar based on currentTemplate ──────────────────────────

export const DsdEditorSidebar: React.FC = () => {
  const currentTemplate = useDsdStore(s => s.currentTemplate);
  if (currentTemplate === 'layout') return <LayoutEditorSidebar />;
  if (currentTemplate === 'site')   return <SiteEditorSidebar />;
  if (currentTemplate === 'env')    return <EnvEditorSidebar />;
  return <SunEditorSidebar />;
};
