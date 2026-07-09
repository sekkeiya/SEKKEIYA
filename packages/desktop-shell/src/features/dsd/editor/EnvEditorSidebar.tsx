import React from 'react';
import {
  Box, Typography, Slider, Chip, Divider, Switch, FormControlLabel,
  ToggleButtonGroup, ToggleButton, IconButton, Tooltip,
} from '@mui/material';
import PlayArrowRoundedIcon   from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon       from '@mui/icons-material/PauseRounded';
import AirRoundedIcon         from '@mui/icons-material/AirRounded';
import VolumeUpRoundedIcon    from '@mui/icons-material/VolumeUpRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import TextFieldsRoundedIcon  from '@mui/icons-material/TextFieldsRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ClearAllRoundedIcon    from '@mui/icons-material/ClearAllRounded';
import NearMeRoundedIcon      from '@mui/icons-material/NearMeRounded';
import CropFreeRoundedIcon    from '@mui/icons-material/CropFreeRounded';
import RestartAltRoundedIcon  from '@mui/icons-material/RestartAltRounded';
import {
  useDsdStore,
  type DsdStyle, type PresetShape, type EnvLayer, type AnnotationColor, type AnnotationTool,
} from '../store/useDsdStore';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#80cbc4';

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

// ─── Building panel (reuse from SunEditorSidebar pattern) ────────────────────

const BuildingPanel: React.FC = () => {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>形状</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {SHAPES.map(s => (
            <Chip
              key={s.key}
              label={s.label}
              size="small"
              onClick={() => setPresetShape(s.key)}
              sx={{
                fontSize: '0.7rem',
                bgcolor: presetShape === s.key ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${presetShape === s.key ? ACCENT : BRAND.line2}`,
                color: presetShape === s.key ? ACCENT : BRAND.sub,
                cursor: 'pointer',
              }}
            />
          ))}
          <Chip
            label={isDrawingPolygon ? '✓ 完了' : '✏ カスタム'}
            size="small"
            onClick={() => {
              if (isDrawingPolygon) {
                setIsDrawingPolygon(false);
              } else {
                setDraftPolygon([]);
                setIsDrawingPolygon(true);
                setPresetShape('custom');
              }
            }}
            sx={{
              fontSize: '0.7rem',
              bgcolor: presetShape === 'custom' ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${presetShape === 'custom' ? ACCENT : BRAND.line2}`,
              color: presetShape === 'custom' ? ACCENT : BRAND.sub,
              cursor: 'pointer',
            }}
          />
        </Box>
      </Box>

      <Box>
        <SectionLabel>間口 (m)</SectionLabel>
        <Slider
          value={buildingWidth}
          onChange={(_, v) => setBuildingWidth(v as number)}
          min={4} max={40} step={0.5}
          valueLabelDisplay="auto"
          sx={sliderSx}
        />
      </Box>

      <Box>
        <SectionLabel>奥行 (m)</SectionLabel>
        <Slider
          value={buildingDepth}
          onChange={(_, v) => setBuildingDepth(v as number)}
          min={4} max={30} step={0.5}
          valueLabelDisplay="auto"
          sx={sliderSx}
        />
      </Box>

      <Box>
        <SectionLabel>高さ (m)</SectionLabel>
        <Slider
          value={buildingHeight}
          onChange={(_, v) => setBuildingHeight(v as number)}
          min={2} max={30} step={0.5}
          valueLabelDisplay="auto"
          sx={sliderSx}
        />
      </Box>

      <Box>
        <SectionLabel>北偏角 (°)</SectionLabel>
        <Slider
          value={northAngle}
          onChange={(_, v) => setNorthAngle(v as number)}
          min={-180} max={180} step={1}
          valueLabelDisplay="auto"
          valueLabelFormat={v => `${v}°`}
          sx={sliderSx}
        />
      </Box>
    </Box>
  );
};

// ─── Env control panel ────────────────────────────────────────────────────────

const WIND_DIR_LABELS: { deg: number; label: string }[] = [
  { deg: 0,   label: 'N' },
  { deg: 45,  label: 'NE' },
  { deg: 90,  label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' },
];

const EnvPanel: React.FC = () => {
  const {
    envLayer, setEnvLayer,
    windDirection, setWindDirection,
    windSpeed, setWindSpeed,
    isEnvAnimating, setIsEnvAnimating,
    noiseSources, setNoiseSourceEnabled, setNoiseSourceLevel,
    selectedNoiseSourceId, setSelectedNoiseSourceId,
    thermalSeason, setThermalSeason,
    month, setMonth, latitude, setLatitude,
    windViewCx, windViewCy, windViewW, windViewH, setWindView,
    isWindViewSelected, setIsWindViewSelected,
  } = useDsdStore();

  const selectedSource = noiseSources.find(n => n.id === selectedNoiseSourceId) ?? null;

  const LAYER_DEFS: { key: EnvLayer; label: string; icon: React.ReactNode }[] = [
    { key: 'wind',    label: '風',   icon: <AirRoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'noise',   label: '音',   icon: <VolumeUpRoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'thermal', label: '温熱', icon: <DeviceThermostatRoundedIcon sx={{ fontSize: 14 }} /> },
  ];

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Layer selector */}
      <Box>
        <SectionLabel>表示レイヤー</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {LAYER_DEFS.map(l => (
            <Chip
              key={l.key}
              icon={l.icon as React.ReactElement}
              label={l.label}
              size="small"
              onClick={() => setEnvLayer(l.key)}
              sx={{
                fontSize: '0.72rem', gap: 0.25,
                bgcolor: envLayer === l.key ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${envLayer === l.key ? ACCENT : BRAND.line2}`,
                color: envLayer === l.key ? ACCENT : BRAND.sub,
                cursor: 'pointer',
                '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Animation toggle — shared across all layers */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: BRAND.sub }}>アニメーション</Typography>
        <IconButton
          size="small"
          onClick={() => setIsEnvAnimating(!isEnvAnimating)}
          sx={{
            bgcolor: isEnvAnimating ? `${ACCENT}22` : 'transparent',
            border: `1px solid ${isEnvAnimating ? ACCENT : BRAND.line2}`,
            color: isEnvAnimating ? ACCENT : BRAND.sub,
            borderRadius: 1, p: 0.5,
          }}
        >
          {isEnvAnimating
            ? <PauseRoundedIcon sx={{ fontSize: 16 }} />
            : <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* Wind section */}
      {envLayer === 'wind' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Divider sx={{ borderColor: BRAND.line }} />

          <Box>
            <SectionLabel>風向 (どちらから) — コンパスをドラッグしても変更可</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
              {WIND_DIR_LABELS.map(d => (
                <Chip
                  key={d.deg}
                  label={d.label}
                  size="small"
                  onClick={() => setWindDirection(d.deg)}
                  sx={{
                    fontSize: '0.68rem', minWidth: 36,
                    bgcolor: Math.abs(windDirection - d.deg) < 23 ? `${ACCENT}22` : 'transparent',
                    border: `1px solid ${Math.abs(windDirection - d.deg) < 23 ? ACCENT : BRAND.line2}`,
                    color: Math.abs(windDirection - d.deg) < 23 ? ACCENT : BRAND.sub,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
            <Slider
              value={windDirection}
              onChange={(_, v) => setWindDirection(v as number)}
              min={0} max={359} step={1}
              valueLabelDisplay="auto"
              valueLabelFormat={v => `${v}°`}
              sx={sliderSx}
            />
          </Box>

          <Box>
            <SectionLabel>風速レベル</SectionLabel>
            <Slider
              value={windSpeed}
              onChange={(_, v) => setWindSpeed(v as number)}
              min={1} max={5} step={1}
              marks={[
                { value: 1, label: '微風' },
                { value: 3, label: '和風' },
                { value: 5, label: '強風' },
              ]}
              valueLabelDisplay="off"
              sx={{ ...sliderSx, '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: BRAND.sub2 } }}
            />
          </Box>

          {/* Wind view range */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CropFreeRoundedIcon sx={{ fontSize: 13, color: BRAND.sub2 }} />
                <SectionLabel>風域の表示範囲</SectionLabel>
              </Box>
              <Tooltip title="デフォルトに戻す" placement="left">
                <IconButton
                  size="small"
                  onClick={() => { setWindView(0, 0, 80, 64); setIsWindViewSelected(false); }}
                  sx={{ p: 0.3, color: BRAND.sub2, '&:hover': { color: ACCENT } }}
                >
                  <RestartAltRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Current size / position display */}
            <Box sx={{
              bgcolor: isWindViewSelected ? `${ACCENT}11` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isWindViewSelected ? ACCENT + '55' : BRAND.line}`,
              borderRadius: 1, px: 1.25, py: 0.75, mb: 0.75,
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: BRAND.sub }}>
                  サイズ
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: isWindViewSelected ? ACCENT : BRAND.text, fontWeight: 600 }}>
                  {windViewW.toFixed(0)} × {windViewH.toFixed(0)} m
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: BRAND.sub }}>
                  中心
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: BRAND.sub }}>
                  ({windViewCx.toFixed(1)}, {windViewCy.toFixed(1)}) m
                </Typography>
              </Box>
            </Box>

            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: BRAND.sub2, lineHeight: 1.5, display: 'block' }}>
              キャンバスの風域枠をクリックして選択
              <br />ドラッグで移動、角ハンドルでリサイズ
            </Typography>
          </Box>
        </Box>
      )}

      {/* Noise section */}
      {envLayer === 'noise' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Divider sx={{ borderColor: BRAND.line }} />

          {/* ── ツール ── */}
          <Box>
            <SectionLabel>ツール</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="選択／移動" placement="bottom">
                <Box sx={{
                  width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 1.5,
                  border: `1px solid ${ACCENT}`,
                  bgcolor: `${ACCENT}22`,
                  color: ACCENT,
                }}>
                  <NearMeRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
              </Tooltip>
            </Box>
            <Typography variant="caption" sx={{
              color: BRAND.sub2, fontSize: '0.68rem',
              display: 'block', mt: 0.75, lineHeight: 1.5,
            }}>
              クリックで選択、ドラッグで移動
            </Typography>
          </Box>

          <Divider sx={{ borderColor: BRAND.line }} />

          {/* ── 選択中の騒音源 ── */}
          {selectedSource && (
            <>
              <Box>
                <SectionLabel>選択中の騒音源</SectionLabel>
                <Typography variant="caption" sx={{
                  color: ACCENT, fontWeight: 700, fontSize: '0.8rem',
                  display: 'block', mb: 1.5,
                }}>
                  {selectedSource.label}
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <SectionLabel>騒音レベル　〜{40 + selectedSource.level * 10}dB</SectionLabel>
                  <Slider
                    value={selectedSource.level}
                    onChange={(_, v) => setNoiseSourceLevel(selectedSource.id, v as number)}
                    min={1} max={5} step={1}
                    marks={[{ value: 1, label: '弱' }, { value: 5, label: '強' }]}
                    valueLabelDisplay="off"
                    sx={{ ...sliderSx, '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: BRAND.sub2 } }}
                  />
                </Box>

                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.65rem', display: 'block', mb: 0.75 }}>
                  位置: ({selectedSource.lx.toFixed(1)}, {selectedSource.ly.toFixed(1)}) m
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={selectedSource.enabled}
                      onChange={e => setNoiseSourceEnabled(selectedSource.id, e.target.checked)}
                      sx={{ '& .MuiSwitch-thumb': { width: 10, height: 10 }, '& .MuiSwitch-switchBase': { padding: '5px' }, '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
                    />
                  }
                  label={<Typography variant="caption" sx={{ color: BRAND.sub, fontSize: '0.74rem' }}>表示</Typography>}
                  sx={{ m: 0, gap: 0.5 }}
                />
              </Box>
              <Divider sx={{ borderColor: BRAND.line }} />
            </>
          )}

          {/* ── 騒音源リスト ── */}
          <Box>
            <SectionLabel>騒音源 ({noiseSources.length})</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {noiseSources.map(src => {
                const isSel = src.id === selectedNoiseSourceId;
                return (
                  <Box
                    key={src.id}
                    onClick={() => setSelectedNoiseSourceId(isSel ? null : src.id)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1, py: 0.6, borderRadius: 1,
                      border: `1px solid ${isSel ? ACCENT : BRAND.line}`,
                      bgcolor: isSel ? `${ACCENT}12` : BRAND.panel,
                      cursor: 'pointer',
                      '&:hover': { borderColor: ACCENT },
                    }}
                  >
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      bgcolor: src.enabled ? '#ef5350' : BRAND.sub,
                    }} />
                    <Typography variant="caption" sx={{
                      flex: 1, color: isSel ? ACCENT : BRAND.sub,
                      fontSize: '0.7rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {src.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.65rem', mr: 0.25 }}>
                      {40 + src.level * 10}dB
                    </Typography>
                    <Switch
                      size="small"
                      checked={src.enabled}
                      onChange={e => { e.stopPropagation(); setNoiseSourceEnabled(src.id, e.target.checked); }}
                      onClick={e => e.stopPropagation()}
                      sx={{ '& .MuiSwitch-thumb': { width: 10, height: 10 }, '& .MuiSwitch-switchBase': { padding: '5px' }, '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Thermal section */}
      {envLayer === 'thermal' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Divider sx={{ borderColor: BRAND.line }} />

          <Box>
            <SectionLabel>季節</SectionLabel>
            <ToggleButtonGroup
              value={thermalSeason}
              exclusive
              onChange={(_, v) => v && setThermalSeason(v)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { px: 2, py: 0.4, fontSize: '0.72rem', color: BRAND.sub, borderColor: BRAND.line } }}
            >
              <ToggleButton value="summer">夏至</ToggleButton>
              <ToggleButton value="winter">冬至</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <SectionLabel>月</SectionLabel>
            <Slider
              value={month}
              onChange={(_, v) => setMonth(v as number)}
              min={1} max={12} step={1}
              marks={[1, 3, 6, 9, 12].map(m => ({ value: m, label: `${m}月` }))}
              valueLabelDisplay="off"
              sx={{ ...sliderSx, '& .MuiSlider-markLabel': { fontSize: '0.6rem', color: BRAND.sub2 } }}
            />
          </Box>

          <Box>
            <SectionLabel>敷地緯度</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {LOCATIONS.map(loc => (
                <Chip
                  key={loc.lat}
                  label={loc.label}
                  size="small"
                  onClick={() => setLatitude(loc.lat)}
                  sx={{
                    fontSize: '0.65rem',
                    bgcolor: latitude === loc.lat ? `${ACCENT}22` : 'transparent',
                    border: `1px solid ${latitude === loc.lat ? ACCENT : BRAND.line2}`,
                    color: latitude === loc.lat ? ACCENT : BRAND.sub,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ─── Style panel ──────────────────────────────────────────────────────────────

const StylePanel: React.FC = () => {
  const { style, setStyle } = useDsdStore();
  const STYLES: { key: DsdStyle; label: string; desc: string; preview: string }[] = [
    { key: 'clean', label: 'Clean', desc: '白背景・細線',        preview: '#f2f3f5' },
    { key: 'bold',  label: 'Bold',  desc: '濃紺背景・鮮やか',    preview: '#0d1b3e' },
    { key: 'dark',  label: 'Dark',  desc: '黒背景・発光表現',    preview: '#0b0f16' },
  ];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {STYLES.map(s => (
        <Box
          key={s.key}
          onClick={() => setStyle(s.key)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            p: 1.25, borderRadius: 1.5, cursor: 'pointer',
            border: `1px solid ${style === s.key ? ACCENT : BRAND.line2}`,
            bgcolor: style === s.key ? `${ACCENT}12` : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <Box sx={{
            width: 28, height: 28, borderRadius: 1, flexShrink: 0,
            bgcolor: s.preview, border: `1px solid ${BRAND.line2}`,
          }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: style === s.key ? ACCENT : BRAND.text, fontSize: '0.78rem' }}>{s.label}</Typography>
            <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.65rem' }}>{s.desc}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ─── Annotate panel ───────────────────────────────────────────────────────────

const ANNOTATION_COLORS: { value: AnnotationColor; label: string }[] = [
  { value: '#ffffff', label: '白' },
  { value: '#ffd740', label: '黄' },
  { value: '#aed581', label: '緑' },
  { value: '#ff9800', label: '橙' },
];

const AnnotatePanel: React.FC = () => {
  const {
    annotationTool, setAnnotationTool,
    annotationColor, setAnnotationColor,
    annotations, removeAnnotation, clearAnnotations,
  } = useDsdStore();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>ツール</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {([
            { key: 'none' as AnnotationTool,  icon: <NearMeRoundedIcon sx={{ fontSize: 14 }} />,       label: '選択' },
            { key: 'text' as AnnotationTool,  icon: <TextFieldsRoundedIcon sx={{ fontSize: 14 }} />,   label: 'テキスト' },
            { key: 'arrow' as AnnotationTool, icon: <ArrowRightAltRoundedIcon sx={{ fontSize: 14 }} />, label: '矢印' },
          ] as const).map(t => (
            <Chip
              key={t.key}
              icon={t.icon as React.ReactElement}
              label={t.label}
              size="small"
              onClick={() => setAnnotationTool(t.key)}
              sx={{
                fontSize: '0.7rem',
                bgcolor: annotationTool === t.key ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${annotationTool === t.key ? ACCENT : BRAND.line2}`,
                color: annotationTool === t.key ? ACCENT : BRAND.sub,
                cursor: 'pointer',
                '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <SectionLabel>カラー</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {ANNOTATION_COLORS.map(c => (
            <Tooltip key={c.value} title={c.label}>
              <Box
                onClick={() => setAnnotationColor(c.value)}
                sx={{
                  width: 22, height: 22, borderRadius: '50%',
                  bgcolor: c.value,
                  border: `2px solid ${annotationColor === c.value ? ACCENT : 'transparent'}`,
                  cursor: 'pointer',
                  boxShadow: annotationColor === c.value ? `0 0 6px ${ACCENT}` : 'none',
                  transition: 'all 0.15s',
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {annotations.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <SectionLabel>アノテーション一覧</SectionLabel>
            <Tooltip title="全削除">
              <IconButton size="small" onClick={() => clearAnnotations()} sx={{ color: BRAND.sub2, p: 0.25 }}>
                <ClearAllRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {annotations.map(a => (
            <Box key={a.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              py: 0.5, px: 1, borderRadius: 1, mb: 0.25,
              bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`,
            }}>
              <Typography variant="caption" sx={{ flex: 1, color: BRAND.sub, fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.type === 'text' ? (a as any).text ?? 'テキスト' : '矢印'}
              </Typography>
              <Tooltip title="削除">
                <IconButton size="small" onClick={() => removeAnnotation(a.id)} sx={{ color: BRAND.sub2, p: 0.25 }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Main sidebar ─────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  building: '建物形状',
  env:      '環境設定',
  style:    'スタイル',
  annotate: 'アノテーション',
};

export const EnvEditorSidebar: React.FC = () => {
  const envEditorTab = useDsdStore(s => s.envEditorTab);

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
          {TAB_LABELS[envEditorTab] ?? envEditorTab}
        </Typography>
      </Box>

      <Box sx={{
        flex: 1, overflowY: 'auto', p: 1.75,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line2, borderRadius: 2 },
      }}>
        {envEditorTab === 'building' && <BuildingPanel />}
        {envEditorTab === 'env'      && <EnvPanel />}
        {envEditorTab === 'style'    && <StylePanel />}
        {envEditorTab === 'annotate' && <AnnotatePanel />}
      </Box>
    </Box>
  );
};
