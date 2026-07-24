import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Button,
  ToggleButtonGroup, ToggleButton, Divider, CircularProgress,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useAppStore } from '../../store/useAppStore';
import { useDsdStore, type LayoutEditorTab } from './store/useDsdStore';
import { LayoutDiagramCanvas, type LayoutDiagramCanvasHandle } from './canvas/LayoutDiagramCanvas';
import { BRAND } from '../../styles/theme';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const ACCENT = '#ffb74d';

const EXPORT_FORMATS_PNG = [
  { label: '16:9 スライド',  w: 1920, h: 1080 },
  { label: '1:1 Instagram', w: 1080, h: 1080 },
  { label: '9:16 Stories',  w: 1080, h: 1920 },
];

const EXPORT_FORMATS_GIF = [
  { label: '16:9 アニメ', w: 960, h: 540 },
  { label: '1:1 アニメ',  w: 600, h: 600 },
  { label: '9:16 アニメ', w: 540, h: 960 },
];

export const LayoutDiagramEditor: React.FC = () => {
  const setDsdShellMode = useAppStore(s => s.setDsdShellMode);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const activeDiagramId = useAppStore(s => s.activeDiagramId);
  const setActiveDiagramId = useAppStore(s => s.setActiveDiagramId);
  const canvasRef = useRef<LayoutDiagramCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [gifDurationSec, setGifDurationSec] = useState(5);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const GIF_DURATIONS = [3, 5, 10, 15, 30] as const;
  const GIF_DELAY_MS  = 65;

  const {
    style, setStyle,
    layoutEditorTab, setLayoutEditorTab,
    zones,
    flowDraftFromId,
  } = useDsdStore();

  const diagramTitle = '配置・動線ダイアグラム';

  const DOCK_TABS: { key: LayoutEditorTab; icon: React.ReactNode; label: string }[] = [
    { key: 'zones',    icon: <DashboardRoundedIcon sx={{ fontSize: 18 }} />, label: 'ゾーン' },
    { key: 'flow',     icon: <TimelineRoundedIcon  sx={{ fontSize: 18 }} />, label: '動線・隣接' },
    { key: 'style',    icon: <PaletteRoundedIcon   sx={{ fontSize: 18 }} />, label: 'スタイル' },
    { key: 'annotate', icon: <EditRoundedIcon       sx={{ fontSize: 18 }} />, label: 'アノテーション' },
  ];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activeProjectId || isSaving) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const s = useDsdStore.getState();
      const { saveDsdDiagramState, updateDsdThumbnail } = await import('./library/dsdDiagramService');
      const newId = await saveDsdDiagramState(
        activeProjectId,
        {
          currentTemplate: s.currentTemplate,
          diagramTitle: s.diagramTitle,
          style: s.style,
          presetShape: s.presetShape,
          customPolygon: s.customPolygon,
          buildingWidth: s.buildingWidth,
          buildingDepth: s.buildingDepth,
          buildingHeight: s.buildingHeight,
          northAngle: s.northAngle,
          month: s.month,
          timeHour: s.timeHour,
          latitude: s.latitude,
          layoutMode: s.layoutMode,
          zones: s.zones,
          flows: s.flows,
          siteBoundaryW: s.siteBoundaryW,
          siteBoundaryH: s.siteBoundaryH,
          siteNorthAngle: s.siteNorthAngle,
          siteElements: s.siteElements,
          siteAccesses: s.siteAccesses,
          windDirection: s.windDirection,
          windSpeed: s.windSpeed,
          envLayer: s.envLayer,
          noiseSources: s.noiseSources,
          thermalSeason: s.thermalSeason,
          windViewCx: s.windViewCx,
          windViewCy: s.windViewCy,
          windViewW: s.windViewW,
          windViewH: s.windViewH,
          annotations: s.annotations,
        },
        activeDiagramId,
      );
      setActiveDiagramId(newId);
      // Thumbnail upload — best-effort, non-fatal
      try {
        const dataUrl = canvasRef.current?.exportPng(480, 270);
        if (dataUrl) await updateDsdThumbnail(dataUrl, activeProjectId, newId);
      } catch (thumbErr) {
        console.warn('[LayoutDiagramEditor] Thumbnail upload failed (non-fatal)', thumbErr);
      }
      useDsdStore.getState().bumpSavedTick(); // 未保存ドット解除トリガ
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('[LayoutDiagramEditor] Save failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [activeProjectId, activeDiagramId, setActiveDiagramId, isSaving]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleExportPng = useCallback(async (w: number, h: number) => {
    const handle = canvasRef.current;
    if (!handle) return;
    const dataUrl = handle.exportPng(w, h);
    const base64 = dataUrl.split(',')[1];
    try {
      const path = await save({
        defaultPath: `${diagramTitle}_${w}x${h}.png`,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });
      if (path) {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(path, bytes);
      }
    } catch {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${diagramTitle}_${w}x${h}.png`;
      a.click();
    }
    setExportMenuOpen(false);
  }, [diagramTitle]);

  const handleExportGif = useCallback(async (w: number, h: number) => {
    const handle = canvasRef.current;
    if (!handle) return;
    setIsGeneratingGif(true);
    setGifProgress(0);
    setExportMenuOpen(false);
    setExportError(null);
    try {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const FRAMES = Math.round(gifDurationSec * 1000 / GIF_DELAY_MS);
      const gif = GIFEncoder();

      for (let i = 0; i < FRAMES; i++) {
        const t = (i * GIF_DELAY_MS / 1000) % 1.0;
        const imageData = handle.renderFrame(w, h, t);
        const rgba = new Uint8Array(
          imageData.data.buffer,
          imageData.data.byteOffset,
          imageData.data.byteLength,
        );
        const palette = quantize(rgba, 256, { format: 'rgb444' });
        const indexed = applyPalette(rgba, palette, 'rgb444');
        gif.writeFrame(indexed, w, h, { palette, delay: GIF_DELAY_MS });

        if (i % 10 === 9) {
          setGifProgress(Math.round(((i + 1) / FRAMES) * 100));
          await new Promise(r => setTimeout(r, 0));
        }
      }
      gif.finish();
      setGifProgress(100);
      const bytes = gif.bytes();

      try {
        const path = await save({
          defaultPath: `${diagramTitle}_${gifDurationSec}s_${w}x${h}.gif`,
          filters: [{ name: 'GIF', extensions: ['gif'] }],
        });
        if (path) {
          await writeFile(path, bytes);
        }
      } catch {
        const blob = new Blob([bytes], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagramTitle}_${gifDurationSec}s_${w}x${h}.gif`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('GIF export failed:', err);
      setExportError('GIF 生成に失敗しました');
    } finally {
      setIsGeneratingGif(false);
      setGifProgress(0);
    }
  }, [diagramTitle, gifDurationSec, GIF_DELAY_MS]);

  const gifAnimated = zones.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default', overflow: 'hidden' }}>

      {/* ── Top toolbar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1, borderBottom: `1px solid ${BRAND.line}`,
        bgcolor: BRAND.bg, flexShrink: 0,
      }}>
        <Tooltip title="ダッシュボードに戻る" placement="bottom">
          <IconButton size="small" onClick={() => { setActiveDiagramId(null); setDsdShellMode('dashboard'); }} sx={{ color: BRAND.sub }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.text, mr: 'auto' }}>
          {diagramTitle}
        </Typography>

        {/* Save button */}
        {activeProjectId && (
          <Tooltip title={saveStatus === 'saved' ? '保存しました' : saveStatus === 'error' ? '保存に失敗しました' : 'Ctrl+S で保存'} placement="bottom">
            <IconButton
              size="small"
              onClick={handleSave}
              disabled={isSaving}
              sx={{
                color: saveStatus === 'saved' ? ACCENT : saveStatus === 'error' ? '#ef5350' : BRAND.sub,
                '&:hover': { color: ACCENT },
                transition: 'color 0.2s',
              }}
            >
              {isSaving ? (
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
              ) : saveStatus === 'saved' ? (
                <CheckRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <SaveRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        )}

        <ToggleButtonGroup
          value={style} exclusive
          onChange={(_, v) => v && setStyle(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.4, fontSize: '0.7rem', color: BRAND.sub, borderColor: BRAND.line } }}
        >
          <ToggleButton value="clean">Clean</ToggleButton>
          <ToggleButton value="bold">Bold</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ position: 'relative' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={isGeneratingGif ? <CircularProgress size={12} sx={{ color: '#3d1d00' }} /> : <DownloadRoundedIcon fontSize="small" />}
            onClick={() => !isGeneratingGif && setExportMenuOpen(!exportMenuOpen)}
            disabled={isGeneratingGif}
            sx={{ bgcolor: ACCENT, color: '#3d1d00', '&:hover': { bgcolor: '#ffcc80' }, fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', '&.Mui-disabled': { bgcolor: 'rgba(255,183,77,0.4)', color: '#3d1d00' } }}
          >
            {isGeneratingGif ? `GIF生成中 ${gifProgress}%` : '書き出す'}
          </Button>
          {exportMenuOpen && (
            <Box sx={{
              position: 'absolute', top: '110%', right: 0, zIndex: 100,
              bgcolor: 'var(--brand-surface2)', border: `1px solid ${BRAND.line}`,
              borderRadius: 1.5, overflow: 'hidden', minWidth: 220,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <Box sx={{ px: 2, pt: 1.25, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  PNG 静止画
                </Typography>
              </Box>
              {EXPORT_FORMATS_PNG.map(fmt => (
                <Box
                  key={fmt.label}
                  onClick={() => handleExportPng(fmt.w, fmt.h)}
                  sx={{
                    px: 2, py: 1, cursor: 'pointer', fontSize: '0.8rem', color: BRAND.text,
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.78rem' }}>{fmt.label}  ({fmt.w}×{fmt.h})</Typography>
                </Box>
              ))}

              <Divider sx={{ borderColor: BRAND.line, my: 0.5 }} />

              <Box sx={{ px: 2, pt: 0.75, pb: 0.25 }}>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  GIF 動線アニメ
                </Typography>
              </Box>
              {!gifAnimated && (
                <Box sx={{ px: 2, py: 0.5 }}>
                  <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem', lineHeight: 1.4 }}>
                    ゾーンを追加すると登場アニメ付き GIF になります
                  </Typography>
                </Box>
              )}
              {exportError && (
                <Box sx={{ px: 2, py: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#ef5350', fontSize: '0.66rem' }}>
                    {exportError}
                  </Typography>
                </Box>
              )}

              {/* Duration selector */}
              <Box sx={{ px: 2, pb: 0.75 }}>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.6rem', display: 'block', mb: 0.5 }}>
                  長さ（最長 30 秒）
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                  {GIF_DURATIONS.map(d => (
                    <Box
                      key={d}
                      onClick={() => setGifDurationSec(d)}
                      sx={{
                        px: 1.25, py: 0.3, borderRadius: 1, cursor: 'pointer',
                        fontSize: '0.72rem', fontWeight: gifDurationSec === d ? 700 : 400,
                        bgcolor: gifDurationSec === d ? `${ACCENT}22` : 'transparent',
                        border: `1px solid ${gifDurationSec === d ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
                        color: gifDurationSec === d ? ACCENT : BRAND.sub,
                        transition: 'all 0.12s',
                        '&:hover': { borderColor: ACCENT, color: ACCENT },
                      }}
                    >
                      {d}秒
                    </Box>
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.6rem' }}>
                  {Math.round(gifDurationSec * 1000 / GIF_DELAY_MS)} フレーム
                  {gifDurationSec >= 15 ? '　⚠ 大容量 (数十〜百MB超)' : gifDurationSec >= 10 ? '　大容量注意' : ''}
                </Typography>
              </Box>

              {EXPORT_FORMATS_GIF.map(fmt => (
                <Box
                  key={fmt.label}
                  onClick={() => handleExportGif(fmt.w, fmt.h)}
                  sx={{
                    px: 2, py: 0.9,
                    cursor: 'pointer',
                    color: BRAND.text,
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.78rem' }}>{fmt.label}  ({fmt.w}×{fmt.h})</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Canvas + floating dock ── */}
      <Box
        ref={containerRef}
        sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: style === 'dark' ? 'var(--brand-bg)' : '#e8e8e8', position: 'relative' }}
        onClick={() => { if (exportMenuOpen) setExportMenuOpen(false); }}
      >
        <LayoutDiagramCanvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
        />

        {/* Floating dock */}
        <Box sx={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0.5, py: 1, px: 0.5,
          bgcolor: 'rgba(18,20,26,0.82)',
          backdropFilter: 'blur(12px)',
          borderRadius: 2.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}>
          <Tooltip title="ダッシュボードへ戻る" placement="right">
            <Box
              onClick={() => { setActiveDiagramId(null); setDsdShellMode('dashboard'); }}
              sx={{
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 1.5, cursor: 'pointer', color: 'rgb(var(--brand-fg-rgb) / 0.4)',
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)' },
                transition: 'all 0.15s',
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            </Box>
          </Tooltip>

          <Divider sx={{ width: '70%', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', my: 0.25 }} />

          {DOCK_TABS.map(t => (
            <Tooltip key={t.key} title={t.label} placement="right">
              <Box
                onClick={() => setLayoutEditorTab(t.key)}
                sx={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 1.5, cursor: 'pointer',
                  bgcolor: layoutEditorTab === t.key ? 'rgba(255,183,77,0.2)' : 'transparent',
                  color: layoutEditorTab === t.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  border: layoutEditorTab === t.key ? `1px solid rgba(255,183,77,0.4)` : '1px solid transparent',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(255,183,77,0.12)', color: ACCENT },
                }}
              >
                {t.icon}
              </Box>
            </Tooltip>
          ))}
        </Box>

        {flowDraftFromId && (
          <Box sx={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            bgcolor: 'rgba(0,0,0,0.75)', color: ACCENT, px: 2, py: 0.75,
            borderRadius: 2, fontSize: '0.8rem', backdropFilter: 'blur(8px)',
            border: `1px solid ${ACCENT}55`, pointerEvents: 'none',
          }}>
            接続先のゾーンでマウスを放す （Esc で取消）
          </Box>
        )}
      </Box>

    </Box>
  );
};
