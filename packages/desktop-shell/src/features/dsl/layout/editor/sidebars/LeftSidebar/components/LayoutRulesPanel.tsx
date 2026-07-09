/**
 * LayoutRulesPanel.tsx
 * S.Layout — 配置ルール & カテゴリ関係 & セット家具エディター
 *
 * タブ0「配置ルール」: カテゴリ単体の配置方法 (against_wall / center / corner …)
 * タブ1「カテゴリ関係」: アンカー → コンパニオン の関係ルール
 * タブ2「セット家具」: ユーザーのセット家具一覧・作成
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Tabs, Tab, Typography, IconButton, Tooltip,
  Select, MenuItem, FormControl,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Switch, Button, Chip, Avatar,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

import { layoutRulesApi } from '../../../../services/layoutRulesApi';
import { DEFAULT_LAYOUT_RULES, DEFAULT_RESIDENTIAL_RELATIONS, DEFAULT_CAFE_RELATIONS, DEFAULT_OFFICE_RELATIONS } from '../../../../constants/defaultLayoutRules';
import type {
  BuildingType, FurniturePlacementRule, FurnitureCategoryRelation,
  LayoutRuleSet, PlacementRelation, CategoryRelationType,
} from '../../../../types/layoutRules';
import { useAutoLayoutStore } from '../../../../store/useAutoLayoutStore';
import {
  getUniqueLayoutCategories,
  LAYOUT_CATEGORIES, type LayoutCategoryMeta,
} from '../../../../constants/furnitureCategoryDefaults';
import { DssSetFurnitureGrid } from '../../../../../../dss/components/DssSetFurnitureGrid';
import { useAuthStore } from '../../../../../../../store/useAuthStore';

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const BUILDING_TYPES: { value: BuildingType; label: string }[] = [
  { value: 'residential', label: '住宅' },
  { value: 'office',      label: 'オフィス' },
  { value: 'cafe',        label: 'カフェ' },
  { value: 'hotel',       label: 'ホテル' },
];

const PLACEMENT_RELATIONS: { value: PlacementRelation; label: string; desc: string }[] = [
  { value: 'against_wall', label: '壁際',   desc: '最寄りの壁に沿って配置' },
  { value: 'center',       label: '中央',   desc: 'ゾーン中心付近に配置' },
  { value: 'corner',       label: '角',     desc: 'ゾーンの角に配置' },
  { value: 'face_to',      label: '正面',   desc: '別家具の正面に向けて配置' },
  { value: 'around',       label: '周囲',   desc: '別家具を囲むように配置' },
  { value: 'beside',       label: '横',     desc: '別家具の側面に配置' },
  { value: 'face_window',  label: '窓向き', desc: '窓に正対して配置' },
];

const CATEGORY_RELATIONS: { value: CategoryRelationType; label: string }[] = [
  { value: 'in_front', label: '正面' },
  { value: 'beside',   label: '横' },
  { value: 'around',   label: '周囲' },
  { value: 'below',    label: '下' },
];

/**
 * ルールエンジンが使う粗粒度カテゴリ選択肢。
 * furnitureCategoryDefaults の LAYOUT_CATEGORIES から動的に生成し、
 * 常に FURNITURE_CATEGORIES と整合が取れた状態を保つ。
 */
const LAYOUT_CATEGORY_OPTIONS: LayoutCategoryMeta[] = LAYOUT_CATEGORIES;

const sx = {
  cell: { py: 0.5, px: 0.75, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.85)', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' },
  head: { py: 0.75, px: 0.75, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontWeight: 700, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' },
};

const line = 'rgb(var(--brand-fg-rgb) / 0.1)';
const accent = '#a78bfa';

// ─── helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultRelationsFor(bt: BuildingType): FurnitureCategoryRelation[] {
  if (bt === 'residential') return [...DEFAULT_RESIDENTIAL_RELATIONS];
  if (bt === 'cafe')        return [...DEFAULT_CAFE_RELATIONS];
  if (bt === 'office')      return [...DEFAULT_OFFICE_RELATIONS];
  return [];
}

// ─── CategorySelect ──────────────────────────────────────────────────────────
/**
 * layoutCategory 選択用の改良セレクト。
 * グループヘッダー付きで絵文字アイコン＋日本語ラベルを表示する。
 */
interface CategorySelectProps {
  value: string;
  onChange: (v: string) => void;
  sx?: object;
}

function CategorySelect({ value, onChange, sx: extraSx }: CategorySelectProps) {
  const selectSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: 11, color: 'var(--brand-fg)',
      '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
      '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
    '& .MuiSelect-select': { py: '3px', fontSize: 11 },
    ...extraSx,
  };

  const current = LAYOUT_CATEGORY_OPTIONS.find(c => c.key === value);

  // グループ別にまとめる
  const grouped = React.useMemo(() => {
    const map = new Map<string, LayoutCategoryMeta[]>();
    for (const lc of LAYOUT_CATEGORY_OPTIONS) {
      const g = lc.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(lc);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <FormControl size="small" fullWidth sx={selectSx}>
      <Select
        value={value}
        onChange={e => onChange(e.target.value)}
        renderValue={() => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span style={{ fontSize: 13 }}>{current?.icon ?? '📦'}</span>
            <span style={{ fontSize: 11, color: 'var(--brand-fg)' }}>{current?.label ?? value}</span>
          </Box>
        )}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: 'var(--brand-surface2)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
              maxHeight: 420,
            },
          },
        }}
      >
        {grouped.flatMap(([group, items]) => [
          // グループヘッダー（選択不可）
          <MenuItem
            key={`group-${group}`}
            disabled
            sx={{
              fontSize: 9.5, color: alpha(accent, 0.7),
              fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              py: 0.4, minHeight: 0,
              borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
              mt: 0.25,
            }}
          >
            {group}
          </MenuItem>,
          ...items.map(lc => (
            <MenuItem
              key={lc.key}
              value={lc.key}
              sx={{
                fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.85)',
                py: 0.6, minHeight: 0,
                gap: 0.75,
                '&:hover': { bgcolor: alpha(accent, 0.1) },
                '&.Mui-selected': { bgcolor: alpha(accent, 0.18) },
                '&.Mui-selected:hover': { bgcolor: alpha(accent, 0.22) },
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{lc.icon}</span>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 11.5, color: 'inherit', lineHeight: 1.3 }}>
                  {lc.label}
                </Typography>
                <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.2 }}>
                  {lc.description}
                </Typography>
              </Box>
            </MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────

export interface LayoutRulesPanelProps {
  projectId?: string | null;
  /** タブが切り替わったときに呼ばれる。 */
  onTabChange?: (tab: number) => void;
}

export default function LayoutRulesPanel({ projectId, onTabChange }: LayoutRulesPanelProps) {
  const storeBuildingType = useAutoLayoutStore((s) => s.buildingType);
  const setStoreBuildingType = useAutoLayoutStore((s) => s.setBuildingType);
  const uid = useAuthStore((s) => s.currentUser?.uid);

  const [tab, setTab] = useState(0);
  const [buildingType, setBuildingType] = useState<BuildingType>(storeBuildingType ?? 'residential');
  const [rules, setRules] = useState<FurniturePlacementRule[]>([]);
  const [relations, setRelations] = useState<FurnitureCategoryRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 建物タイプ切替時にルールセットをロード
  const loadRules = useCallback(async (bt: BuildingType) => {
    setLoading(true);
    setDirty(false);
    try {
      const ruleSet = await layoutRulesApi.getLayoutRuleSet(bt, 'general', projectId ?? undefined);
      const defaultFallback = DEFAULT_LAYOUT_RULES[bt];
      const loadedRules = ruleSet?.rules ?? defaultFallback?.rules ?? [];
      const loadedRelations = ruleSet?.categoryRelations ?? defaultFallback?.categoryRelations ?? defaultRelationsFor(bt);
      setRules(loadedRules as FurniturePlacementRule[]);
      setRelations(loadedRelations as FurnitureCategoryRelation[]);
    } catch (e) {
      console.error('[LayoutRulesPanel] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadRules(buildingType); }, [buildingType, loadRules]);

  const handleBuildingTypeChange = (bt: BuildingType) => {
    setBuildingType(bt);
    setStoreBuildingType(bt);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ruleSet: LayoutRuleSet = { buildingType, rules, categoryRelations: relations };
      await layoutRulesApi.saveLayoutRuleSet(buildingType, ruleSet);
      if (projectId) await layoutRulesApi.saveLayoutRuleSet(`${buildingType}_project_${projectId}`, ruleSet);
      setDirty(false);
    } catch (e) {
      console.error('[LayoutRulesPanel] save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const def = DEFAULT_LAYOUT_RULES[buildingType];
    setRules(def?.rules ?? []);
    setRelations(def?.categoryRelations ?? defaultRelationsFor(buildingType));
    setDirty(true);
  };

  // ─── 配置ルール CRUD ──────────────────────────────────────────────────────

  const updateRule = (idx: number, patch: Partial<FurniturePlacementRule>) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } as FurniturePlacementRule : r));
    setDirty(true);
  };
  const updateRulePlacement = (idx: number, patch: Partial<FurniturePlacementRule['placement']>) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, placement: { ...r.placement, ...patch } } : r));
    setDirty(true);
  };
  const addRule = () => {
    setRules(prev => [...prev, { id: genId(), buildingType, furnitureCategory: 'other', placement: { relation: 'center', priority: 50 } }]);
    setDirty(true);
  };
  const removeRule = (idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // ─── カテゴリ関係 CRUD ────────────────────────────────────────────────────

  const updateRel = (idx: number, patch: Partial<FurnitureCategoryRelation>) => {
    setRelations(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } as FurnitureCategoryRelation : r));
    setDirty(true);
  };
  const addRelation = () => {
    setRelations(prev => [...prev, { id: genId(), anchorCategory: 'sofa', companionCategory: 'coffee_table', relation: 'in_front', distanceMm: 450, count: 1, isActive: true }]);
    setDirty(true);
  };
  const removeRelation = (idx: number) => {
    setRelations(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // ─── レンダー ─────────────────────────────────────────────────────────────

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: 11, color: 'var(--brand-fg)',
      '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
      '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
    '& .MuiSelect-select': { py: '3px', fontSize: 11 },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ヘッダー: 建物タイプ選択 + 保存/リセット */}
      <Box sx={{ px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${line}`, flexShrink: 0 }}>
        <FormControl size="small" sx={{ minWidth: 90, ...inputSx }}>
          <Select value={buildingType} onChange={(e) => handleBuildingTypeChange(e.target.value as BuildingType)}>
            {BUILDING_TYPES.map(bt => (
              <MenuItem key={bt.value} value={bt.value} sx={{ fontSize: 12 }}>{bt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        {dirty && (
          <Chip label="未保存" size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha('#f59e0b', 0.2), color: 'light-dark(#aa7c03, #fbbf24)', border: `1px solid ${alpha('#f59e0b', 0.4)}` }} />
        )}
        <Tooltip title="デフォルトに戻す">
          <IconButton size="small" onClick={handleReset} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}>
            <RestartAltRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="保存">
          <span>
            <IconButton size="small" onClick={handleSave} disabled={!dirty || saving} sx={{ color: dirty ? accent : 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: accent } }}>
              {saving ? <CircularProgress size={13} sx={{ color: 'inherit' }} /> : <SaveRoundedIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* タブ */}
      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); onTabChange?.(v); }}
        sx={{
          minHeight: 32, flexShrink: 0,
          borderBottom: `1px solid ${line}`,
          '& .MuiTab-root': { minHeight: 32, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', px: 1.5, py: 0 },
          '& .Mui-selected': { color: accent },
          '& .MuiTabs-indicator': { backgroundColor: accent, height: 2 },
        }}
      >
        <Tab label="配置ルール" />
        <Tab label="カテゴリ関係" />
        <Tab label="セット家具" />
      </Tabs>

      {/* コンテンツ */}
      {/* タブ2（セット家具）は各パネルが個別にスクロール管理するので overflow: hidden */}
      <Box sx={{ flex: 1, overflow: tab === 2 ? 'hidden' : 'auto', minHeight: 0, display: tab === 2 ? 'flex' : 'block', flexDirection: 'column' }}>

        {/* タブ0・1はルールロード中はスピナーを表示 */}
        {(tab === 0 || tab === 1) && loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <CircularProgress size={20} sx={{ color: accent }} />
          </Box>
        ) : (
          <>
          {/* ── タブ0: 配置ルール ── */}
          {tab === 0 && (
            <Box>
              {/* 説明バナー */}
              <Box sx={{ px: 1.5, py: 0.85, bgcolor: alpha('#7c3aed', 0.07), borderBottom: `1px solid ${line}` }}>
                <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", lineHeight: 1.5 }}>
                  各カテゴリが Auto Layout 時にゾーン内のどこへ配置されるかを定義します。優先度が高いほど先に配置されます。
                </Typography>
              </Box>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...sx.head, minWidth: 140 }}>カテゴリ</TableCell>
                    <TableCell sx={{ ...sx.head, minWidth: 100 }}>配置方法</TableCell>
                    <TableCell sx={{ ...sx.head, textAlign: 'center', width: 56 }}>優先度</TableCell>
                    <TableCell sx={{ ...sx.head, width: 24 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map((rule, idx) => (
                    <TableRow key={rule.id} hover sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
                      <TableCell sx={sx.cell}>
                        <CategorySelect
                          value={rule.furnitureCategory}
                          onChange={v => updateRule(idx, { furnitureCategory: v })}
                        />
                      </TableCell>
                      <TableCell sx={sx.cell}>
                        <FormControl size="small" fullWidth sx={inputSx}>
                          <Select
                            value={rule.placement.relation}
                            onChange={e => updateRulePlacement(idx, { relation: e.target.value as PlacementRelation })}
                            MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' } } }}
                          >
                            {PLACEMENT_RELATIONS.map(r => (
                              <MenuItem key={r.value} value={r.value}
                                sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.85)', py: 0.6, minHeight: 0, flexDirection: 'column', alignItems: 'flex-start',
                                  '&:hover': { bgcolor: alpha(accent, 0.1) }, '&.Mui-selected': { bgcolor: alpha(accent, 0.18) } }}>
                                <span>{r.label}</span>
                                <span style={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>{r.desc}</span>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, textAlign: 'center' }}>
                        <TextField
                          size="small" type="number"
                          value={rule.placement.priority}
                          onChange={e => updateRulePlacement(idx, { priority: Number(e.target.value) })}
                          inputProps={{ min: 0, max: 200, step: 10 }}
                          sx={{ width: 52, ...inputSx, '& input': { textAlign: 'center', py: '3px', fontSize: 11 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, p: 0 }}>
                        <IconButton size="small" onClick={() => removeRule(idx)}
                          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { color: 'light-dark(#a50808, #f87171)' } }}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ px: 1.25, py: 1 }}>
                <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 13 }} />} onClick={addRule}
                  sx={{ fontSize: 11, color: alpha(accent, 0.8), textTransform: 'none', '&:hover': { bgcolor: alpha(accent, 0.08) } }}>
                  ルールを追加
                </Button>
              </Box>
            </Box>
          )}

          {/* ── タブ1: カテゴリ関係 ── */}
          {tab === 1 && (
            <Box>
              <Box sx={{ px: 1.25, py: 0.85, bgcolor: alpha('#7c3aed', 0.08), borderBottom: `1px solid ${line}` }}>
                <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", lineHeight: 1.5 }}>
                  <strong style={{ color: 'light-dark(rgba(47,7,166,0.9), rgba(167,139,250,0.9))' }}>アンカー</strong>家具を配置した後、
                  <strong style={{ color: 'light-dark(rgba(47,7,166,0.9), rgba(167,139,250,0.9))' }}>コンパニオン</strong>家具が指定の関係・距離で自動追加されます
                </Typography>
              </Box>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...sx.head, minWidth: 120 }}>アンカー</TableCell>
                    <TableCell sx={{ ...sx.head, minWidth: 120 }}>コンパニオン</TableCell>
                    <TableCell sx={{ ...sx.head, minWidth: 80 }}>関係</TableCell>
                    <TableCell sx={{ ...sx.head, textAlign: 'center', width: 68 }}>距離mm</TableCell>
                    <TableCell sx={{ ...sx.head, textAlign: 'center', width: 40 }}>数</TableCell>
                    <TableCell sx={{ ...sx.head, textAlign: 'center', width: 48 }}>有効</TableCell>
                    <TableCell sx={{ ...sx.head, width: 24 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {relations.map((rel, idx) => (
                    <TableRow key={rel.id} hover sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' }, opacity: rel.isActive ? 1 : 0.4 }}>
                      <TableCell sx={sx.cell}>
                        <CategorySelect
                          value={rel.anchorCategory}
                          onChange={v => updateRel(idx, { anchorCategory: v })}
                        />
                      </TableCell>
                      <TableCell sx={sx.cell}>
                        <CategorySelect
                          value={rel.companionCategory}
                          onChange={v => updateRel(idx, { companionCategory: v })}
                        />
                      </TableCell>
                      <TableCell sx={sx.cell}>
                        <FormControl size="small" fullWidth sx={inputSx}>
                          <Select value={rel.relation} onChange={e => updateRel(idx, { relation: e.target.value as CategoryRelationType })}
                            MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' } } }}>
                            {CATEGORY_RELATIONS.map(r => (
                              <MenuItem key={r.value} value={r.value}
                                sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.85)', py: 0.5, minHeight: 0,
                                  '&:hover': { bgcolor: alpha(accent, 0.1) }, '&.Mui-selected': { bgcolor: alpha(accent, 0.18) } }}>
                                {r.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, textAlign: 'center' }}>
                        <TextField
                          size="small" type="number" value={rel.distanceMm}
                          onChange={(e) => updateRel(idx, { distanceMm: Number(e.target.value) })}
                          inputProps={{ min: 0, max: 2000, step: 50 }}
                          sx={{ width: 60, ...inputSx, '& input': { textAlign: 'center', py: '3px', fontSize: 11 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, textAlign: 'center' }}>
                        <TextField
                          size="small" type="number" value={rel.count ?? 1}
                          onChange={(e) => updateRel(idx, { count: Math.max(1, Number(e.target.value)) })}
                          inputProps={{ min: 1, max: 12, step: 1 }}
                          sx={{ width: 44, ...inputSx, '& input': { textAlign: 'center', py: '3px', fontSize: 11 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, textAlign: 'center' }}>
                        <Switch
                          size="small" checked={rel.isActive}
                          onChange={(e) => updateRel(idx, { isActive: e.target.checked })}
                          sx={{ '& .MuiSwitch-thumb': { width: 10, height: 10 }, '& .MuiSwitch-track': { borderRadius: 6 }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: accent } }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...sx.cell, p: 0 }}>
                        <IconButton size="small" onClick={() => removeRelation(idx)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { color: 'light-dark(#a50808, #f87171)' } }}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ px: 1.25, py: 1 }}>
                <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 13 }} />} onClick={addRelation}
                  sx={{ fontSize: 11, color: alpha(accent, 0.8), textTransform: 'none', '&:hover': { bgcolor: alpha(accent, 0.08) } }}>
                  関係を追加
                </Button>
              </Box>
            </Box>
          )}

          {/* ── タブ2: セット家具 ── */}
          {tab === 2 && (
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <DssSetFurnitureGrid
                items={[]}
                canCreate={true}
              />
            </Box>
          )}
          </>
        )}
      </Box>

    </Box>
  );
}
