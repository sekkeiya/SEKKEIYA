import React, { useState } from 'react';
import {
  Box, Typography, Chip, Divider,
  IconButton, Tooltip, TextField, Button,
} from '@mui/material';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import {
  useDsdStore,
  type DsdStyle, type SiteTool, type SiteElementType,
  type SiteAccessType, type SiteAccessDir,
  type AnnotationColor, type AnnotationTool,
} from '../store/useDsdStore';
import { SITE_ELEMENT_DEFS, siteElementDef } from '../canvas/sitePalette';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#4dd0e1';

const TAB_LABELS: Record<string, string> = {
  site:     '敷地設定',
  context:  'コンテキスト',
  access:   'アクセス',
  style:    'スタイル',
  annotate: 'アノテーション',
};

const STYLE_DEFS: { key: DsdStyle; label: string; desc: string; preview: string }[] = [
  { key: 'clean', label: 'Clean', desc: '白背景・細線・モノクロ',   preview: '#fafafa' },
  { key: 'bold',  label: 'Bold',  desc: 'カラフル・明快（BIG風）', preview: '#1565c0' },
  { key: 'dark',  label: 'Dark',  desc: '黒背景・光のような表現',   preview: '#0b0f16' },
];

const ACCESS_TYPE_DEFS: { key: SiteAccessType; label: string; color: string }[] = [
  { key: 'pedestrian', label: '歩行者',   color: '#4caf50' },
  { key: 'vehicle',    label: '車両',     color: '#f57c00' },
  { key: 'transit',    label: '公共交通', color: '#0288d1' },
  { key: 'bicycle',    label: '自転車',   color: '#9c27b0' },
];

const DIR_DEFS: { key: SiteAccessDir; label: string }[] = [
  { key: 'n', label: '北' },
  { key: 'e', label: '東' },
  { key: 's', label: '南' },
  { key: 'w', label: '西' },
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
    letterSpacing: '0.07em', fontSize: '0.62rem', display: 'block', mb: 0.75,
  }}>
    {children}
  </Typography>
);

// ─── Site panel ───────────────────────────────────────────────────────────────

const SitePanel: React.FC = () => {
  const { siteBoundaryW, setSiteBoundaryW, siteBoundaryH, setSiteBoundaryH, siteNorthAngle, setSiteNorthAngle } = useDsdStore();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>敷地幅（間口）</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="range" min={5} max={60} step={1} value={siteBoundaryW}
            onChange={e => setSiteBoundaryW(Number(e.target.value))}
            style={{ flex: 1, accentColor: ACCENT }}
          />
          <Typography variant="caption" sx={{ color: BRAND.sub, minWidth: 38, textAlign: 'right' }}>
            {siteBoundaryW}m
          </Typography>
        </Box>
      </Box>

      <Box>
        <SectionLabel>敷地奥行き</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="range" min={5} max={60} step={1} value={siteBoundaryH}
            onChange={e => setSiteBoundaryH(Number(e.target.value))}
            style={{ flex: 1, accentColor: ACCENT }}
          />
          <Typography variant="caption" sx={{ color: BRAND.sub, minWidth: 38, textAlign: 'right' }}>
            {siteBoundaryH}m
          </Typography>
        </Box>
      </Box>

      <Box>
        <SectionLabel>北方向（真北角度）</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="range" min={0} max={359} step={1} value={siteNorthAngle}
            onChange={e => setSiteNorthAngle(Number(e.target.value))}
            style={{ flex: 1, accentColor: ACCENT }}
          />
          <Typography variant="caption" sx={{ color: BRAND.sub, minWidth: 38, textAlign: 'right' }}>
            {siteNorthAngle}°
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem', mt: 0.5, display: 'block' }}>
          右上の北矢印に反映されます
        </Typography>
      </Box>
    </Box>
  );
};

// ─── Context panel ────────────────────────────────────────────────────────────

const ContextPanel: React.FC = () => {
  const {
    siteTool, setSiteTool,
    siteElementType, setSiteElementType,
    siteElements, addSiteElement, updateSiteElement, removeSiteElement, clearSiteElements,
    selectedSiteElementId, setSelectedSiteElementId,
  } = useDsdStore();

  const toolBtn = (key: SiteTool, icon: React.ReactNode, label: string) => (
    <Tooltip key={key} title={label} placement="bottom">
      <Box
        onClick={() => setSiteTool(siteTool === key ? 'none' : key)}
        sx={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 1.5, cursor: 'pointer',
          border: `1px solid ${siteTool === key ? ACCENT : BRAND.line}`,
          bgcolor: siteTool === key ? `${ACCENT}22` : BRAND.panel,
          color: siteTool === key ? ACCENT : BRAND.sub,
          transition: 'all 0.15s',
          '&:hover': { borderColor: ACCENT, color: ACCENT },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  const selectedElement = siteElements.find(e => e.id === selectedSiteElementId) ?? null;
  const activeDef = siteElementDef(siteElementType);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ツール */}
      <Box>
        <SectionLabel>ツール</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {toolBtn('none',       <NearMeRoundedIcon           sx={{ fontSize: 18 }} />, '選択／移動')}
          {toolBtn('addElement', <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />, '要素追加')}
        </Box>
        <Typography variant="caption" sx={{
          color: siteTool !== 'none' ? ACCENT : BRAND.sub2,
          fontSize: '0.68rem', display: 'block', mt: 0.75, lineHeight: 1.5,
        }}>
          {siteTool === 'addElement'
            ? `キャンバスをクリックして ${activeDef.label} を配置`
            : 'クリックで選択、ドラッグで移動、Delete で削除'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      {/* 要素タイプ */}
      <Box>
        <SectionLabel>要素タイプ（次に追加）</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {SITE_ELEMENT_DEFS.map(def => {
            const isActive = siteElementType === def.key;
            return (
              <Chip
                key={def.key}
                label={def.label}
                size="small"
                onClick={() => setSiteElementType(def.key as SiteElementType)}
                sx={{
                  fontSize: '0.68rem', cursor: 'pointer',
                  bgcolor: isActive ? `${def.clean.stroke}22` : BRAND.panel,
                  color: isActive ? def.clean.stroke : BRAND.sub,
                  borderColor: isActive ? def.clean.stroke : BRAND.line,
                  border: '1px solid',
                  '&:hover': { borderColor: def.clean.stroke, color: def.clean.stroke },
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      {/* 選択中の要素 */}
      {selectedElement && (() => {
        const def = siteElementDef(selectedElement.type);
        return (
          <>
            <Box>
              <SectionLabel>選択中の要素</SectionLabel>
              <TextField
                fullWidth size="small"
                value={selectedElement.label}
                onChange={e => updateSiteElement(selectedElement.id, { label: e.target.value })}
                variant="outlined"
                sx={{
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.78rem', color: BRAND.text,
                    '& fieldset': { borderColor: BRAND.line },
                    '&:hover fieldset': { borderColor: BRAND.line2 },
                    '&.Mui-focused fieldset': { borderColor: ACCENT },
                  },
                }}
              />
              <Box sx={{
                display: 'inline-flex', px: 1, py: 0.2, borderRadius: 0.75, mb: 1,
                bgcolor: `${def.clean.stroke}22`, color: def.clean.stroke,
                border: `1px solid ${def.clean.stroke}`, fontSize: '0.66rem',
              }}>
                {def.label}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem' }}>
                    幅 {selectedElement.w.toFixed(0)} m
                  </Typography>
                  <input
                    type="range" min={3} max={80} step={1}
                    value={selectedElement.w}
                    onChange={e => updateSiteElement(selectedElement.id, { w: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: ACCENT }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.66rem' }}>
                    奥行 {selectedElement.h.toFixed(0)} m
                  </Typography>
                  <input
                    type="range" min={3} max={80} step={1}
                    value={selectedElement.h}
                    onChange={e => updateSiteElement(selectedElement.id, { h: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: ACCENT }}
                  />
                </Box>
              </Box>
              <Chip
                label="✕ この要素を削除"
                size="small"
                onClick={() => removeSiteElement(selectedElement.id)}
                sx={{
                  mt: 1, fontSize: '0.68rem', cursor: 'pointer',
                  bgcolor: 'rgba(255,82,82,0.12)', borderColor: '#ff5252', color: '#ff5252',
                  border: '1px solid',
                }}
              />
            </Box>
            <Divider sx={{ borderColor: BRAND.line }} />
          </>
        );
      })()}

      {/* 一覧 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
          <SectionLabel>配置済み ({siteElements.length})</SectionLabel>
          {siteElements.length > 0 && (
            <Tooltip title="すべて削除" placement="right">
              <IconButton
                size="small" onClick={clearSiteElements}
                sx={{ ml: 'auto', color: BRAND.sub2, p: 0.25, mb: 0.75, '&:hover': { color: '#ff5252' } }}
              >
                <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {siteElements.length === 0 ? (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
            要素がありません
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {siteElements.map(el => {
              const def = siteElementDef(el.type);
              const isSel = el.id === selectedSiteElementId;
              return (
                <Box
                  key={el.id}
                  onClick={() => setSelectedSiteElementId(isSel ? null : el.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.6, borderRadius: 1,
                    border: `1px solid ${isSel ? ACCENT : BRAND.line}`,
                    bgcolor: isSel ? `${ACCENT}10` : BRAND.panel,
                    cursor: 'pointer',
                    '&:hover': { borderColor: ACCENT },
                  }}
                >
                  <Box sx={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    bgcolor: def.clean.fill, border: `1px solid ${def.clean.stroke}`,
                  }} />
                  <Typography variant="caption" sx={{
                    color: isSel ? ACCENT : BRAND.sub, fontSize: '0.7rem',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {el.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.65rem' }}>
                    {def.label}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); removeSiteElement(el.id); }}
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

// ─── Access panel ─────────────────────────────────────────────────────────────

const toolBtnSx = (active: boolean) => ({
  width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 1.5, cursor: 'pointer',
  border: `1px solid ${active ? ACCENT : BRAND.line}`,
  bgcolor: active ? `${ACCENT}22` : BRAND.panel,
  color: active ? ACCENT : BRAND.sub,
  transition: 'all 0.15s',
  '&:hover': { borderColor: ACCENT, color: ACCENT },
});

const AccessPanel: React.FC = () => {
  const {
    siteTool, setSiteTool,
    siteAccessType, setSiteAccessType,
    isSiteAnimating, setIsSiteAnimating,
    siteAccesses, addSiteAccess, removeSiteAccess, clearSiteAccesses,
    selectedSiteAccessId, setSelectedSiteAccessId,
    siteBoundaryW, siteBoundaryH,
  } = useDsdStore();

  const [accessDir,    setAccessDir]    = useState<SiteAccessDir>('n');
  const [accessOffset, setAccessOffset] = useState(0.5);
  const [accessLabel,  setAccessLabel]  = useState('');

  const handleAdd = () => {
    addSiteAccess({
      id: `acc_${Date.now()}`,
      type: siteAccessType,
      label: accessLabel.trim(),
      dir: accessDir,
      offset: accessOffset,
    });
    setAccessLabel('');
  };

  const edgeLen = accessDir === 'n' || accessDir === 's' ? siteBoundaryW : siteBoundaryH;
  const typeDef = ACCESS_TYPE_DEFS.find(d => d.key === siteAccessType)!;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ツール */}
      <Box>
        <SectionLabel>ツール</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="選択／移動" placement="bottom">
            <Box onClick={() => setSiteTool(siteTool === 'none' ? 'none' : 'none')}
              sx={toolBtnSx(siteTool === 'none' || siteTool === 'addElement')}>
              <NearMeRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
          <Tooltip title="クリックでアクセス追加" placement="bottom">
            <Box onClick={() => setSiteTool(siteTool === 'addAccess' ? 'none' : 'addAccess')}
              sx={toolBtnSx(siteTool === 'addAccess')}>
              <AddLocationAltRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
        </Box>
        <Typography variant="caption" sx={{
          color: siteTool === 'addAccess' ? ACCENT : BRAND.sub2,
          fontSize: '0.68rem', display: 'block', mt: 0.75, lineHeight: 1.5,
        }}>
          {siteTool === 'addAccess'
            ? `敷地境界をクリックして ${typeDef.label} アクセスを追加`
            : '「追加」ボタンまたはキャンバスクリックでアクセスを追加'}
        </Typography>
      </Box>

      {/* アニメーション */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: BRAND.sub, fontSize: '0.72rem', flex: 1 }}>
          アクセスアニメ
        </Typography>
        <Tooltip title={isSiteAnimating ? 'アニメ停止' : 'アニメ再生'} placement="left">
          <IconButton
            size="small"
            onClick={() => setIsSiteAnimating(!isSiteAnimating)}
            disabled={siteAccesses.length === 0}
            sx={{
              color: isSiteAnimating ? ACCENT : BRAND.sub2,
              border: `1px solid ${isSiteAnimating ? ACCENT : BRAND.line}`,
              bgcolor: isSiteAnimating ? `${ACCENT}18` : BRAND.panel,
              borderRadius: 1.5, p: 0.5,
              '&:hover': { borderColor: ACCENT, color: ACCENT },
              '&.Mui-disabled': { opacity: 0.35 },
            }}
          >
            {isSiteAnimating
              ? <PauseRoundedIcon sx={{ fontSize: 18 }} />
              : <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: BRAND.line }} />

      {/* 交通手段 */}
      <Box>
        <SectionLabel>交通手段{siteTool === 'addAccess' ? '（次に追加）' : ''}</SectionLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {ACCESS_TYPE_DEFS.map(def => (
            <Chip
              key={def.key}
              label={def.label}
              size="small"
              onClick={() => setSiteAccessType(def.key)}
              sx={{
                fontSize: '0.68rem', cursor: 'pointer',
                bgcolor: siteAccessType === def.key ? `${def.color}22` : BRAND.panel,
                color: siteAccessType === def.key ? def.color : BRAND.sub,
                borderColor: siteAccessType === def.key ? def.color : BRAND.line,
                border: '1px solid',
                '&:hover': { borderColor: def.color, color: def.color },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* 方向 */}
      <Box>
        <SectionLabel>方向（どの辺から）</SectionLabel>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {DIR_DEFS.map(d => (
            <Box
              key={d.key}
              onClick={() => setAccessDir(d.key)}
              sx={{
                flex: 1, py: 0.8, textAlign: 'center', borderRadius: 1.5,
                border: `1px solid ${accessDir === d.key ? ACCENT : BRAND.line}`,
                bgcolor: accessDir === d.key ? `${ACCENT}18` : BRAND.panel,
                color: accessDir === d.key ? ACCENT : BRAND.sub,
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                transition: 'all 0.15s',
                '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: `${ACCENT}0e` },
              }}
            >
              {d.label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* オフセット */}
      <Box>
        <SectionLabel>
          位置（辺上  {Math.round(edgeLen * accessOffset)}m 地点）
        </SectionLabel>
        <input
          type="range" min={0.05} max={0.95} step={0.05} value={accessOffset}
          onChange={e => setAccessOffset(Number(e.target.value))}
          style={{ width: '100%', accentColor: ACCENT }}
        />
      </Box>

      {/* ラベル */}
      <Box>
        <SectionLabel>ラベル（任意）</SectionLabel>
        <TextField
          size="small" fullWidth
          placeholder="例：駅前広場、来客駐車場"
          value={accessLabel}
          onChange={e => setAccessLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{
            '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.75, color: BRAND.text },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.line },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
          }}
        />
      </Box>

      <Button
        size="small" variant="outlined"
        startIcon={<AddRoundedIcon />}
        onClick={handleAdd}
        sx={{
          borderColor: ACCENT, color: ACCENT, fontSize: '0.75rem', textTransform: 'none',
          '&:hover': { bgcolor: `${ACCENT}12`, borderColor: ACCENT },
        }}
      >
        {typeDef.label}アクセスを追加
      </Button>

      <Divider sx={{ borderColor: BRAND.line }} />

      {/* 一覧 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
          <SectionLabel>追加済み ({siteAccesses.length})</SectionLabel>
          {siteAccesses.length > 0 && (
            <Tooltip title="すべて削除" placement="right">
              <IconButton
                size="small" onClick={clearSiteAccesses}
                sx={{ ml: 'auto', color: BRAND.sub2, p: 0.25, mb: 0.75, '&:hover': { color: '#ff5252' } }}
              >
                <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {siteAccesses.length === 0 ? (
          <Typography variant="caption" sx={{ color: BRAND.sub2, fontSize: '0.68rem' }}>
            アクセスがありません
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {siteAccesses.map(acc => {
              const def = ACCESS_TYPE_DEFS.find(d => d.key === acc.type)!;
              const isSel = acc.id === selectedSiteAccessId;
              return (
                <Box
                  key={acc.id}
                  onClick={() => setSelectedSiteAccessId(isSel ? null : acc.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.6, borderRadius: 1,
                    border: `1px solid ${isSel ? ACCENT : BRAND.line}`,
                    bgcolor: isSel ? `${ACCENT}10` : BRAND.panel,
                    cursor: 'pointer',
                    '&:hover': { borderColor: ACCENT },
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: def.color }} />
                  <Typography variant="caption" sx={{
                    color: isSel ? ACCENT : BRAND.sub, fontSize: '0.7rem',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {def.label}{acc.label ? `  ${acc.label}` : ''}
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: BRAND.sub2, fontSize: '0.65rem',
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {acc.dir.toUpperCase()}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); removeSiteAccess(acc.id); }}
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
            bgcolor: style === s.key ? `${ACCENT}10` : BRAND.panel,
            transition: 'all 0.15s',
            '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` },
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
    selectedAnnotationId, setSelectedAnnotationId,
  } = useDsdStore();

  const toolBtn = (key: AnnotationTool, icon: React.ReactNode, label: string) => (
    <Tooltip key={key} title={label} placement="bottom">
      <Box
        onClick={() => setAnnotationTool(annotationTool === key ? 'none' : key as AnnotationTool)}
        sx={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 1.5, cursor: 'pointer',
          border: `1px solid ${annotationTool === key ? ACCENT : BRAND.line}`,
          bgcolor: annotationTool === key ? `${ACCENT}22` : BRAND.panel,
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
      <Box>
        <SectionLabel>ツール（テキスト / 矢印）</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {toolBtn('none',  <NearMeRoundedIcon        sx={{ fontSize: 18 }} />, '選択')}
          {toolBtn('text',  <TextFieldsRoundedIcon    sx={{ fontSize: 18 }} />, 'テキスト')}
          {toolBtn('arrow', <ArrowRightAltRoundedIcon sx={{ fontSize: 20 }} />, '矢印')}
        </Box>
        {annotationTool === 'text' && (
          <Typography variant="caption" sx={{ color: ACCENT, fontSize: '0.68rem', display: 'block', mt: 0.75 }}>
            キャンバスをクリックしてテキストを配置
          </Typography>
        )}
        {annotationTool === 'arrow' && (
          <Typography variant="caption" sx={{ color: ACCENT, fontSize: '0.68rem', display: 'block', mt: 0.75 }}>
            始点 → 終点の順にクリック
          </Typography>
        )}
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
                size="small" onClick={clearAnnotations}
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
            {annotations.map(ann => {
              const isSel = ann.id === selectedAnnotationId;
              return (
                <Box
                  key={ann.id}
                  onClick={() => setSelectedAnnotationId(isSel ? null : ann.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.6, borderRadius: 1,
                    border: `1px solid ${isSel ? ACCENT : BRAND.line}`,
                    bgcolor: isSel ? `${ACCENT}10` : BRAND.panel,
                    cursor: 'pointer',
                    '&:hover': { borderColor: ACCENT },
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: ann.color }} />
                  <Typography variant="caption" sx={{
                    color: isSel ? ACCENT : BRAND.sub, fontSize: '0.68rem',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ann.type === 'text' ? `T  ${ann.text}` : '→  矢印'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); removeAnnotation(ann.id); }}
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

// ─── Shell ────────────────────────────────────────────────────────────────────

export const SiteEditorSidebar: React.FC = () => {
  const { siteEditorTab } = useDsdStore();

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
          {TAB_LABELS[siteEditorTab] ?? siteEditorTab}
        </Typography>
      </Box>

      <Box sx={{
        flex: 1, overflowY: 'auto', p: 1.75,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line2, borderRadius: 2 },
      }}>
        {siteEditorTab === 'site'     && <SitePanel />}
        {siteEditorTab === 'context'  && <ContextPanel />}
        {siteEditorTab === 'access'   && <AccessPanel />}
        {siteEditorTab === 'style'    && <StylePanel />}
        {siteEditorTab === 'annotate' && <AnnotatePanel />}
      </Box>
    </Box>
  );
};
