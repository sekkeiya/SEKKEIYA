import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, TextField,
  Select, MenuItem, ListSubheader, Slider, Button, ToggleButtonGroup, ToggleButton, CircularProgress, Link,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { dsmtUploadService, type DsmtTextureSlot } from '../api/dsmtUploadService';
import { DSMT_CATEGORY_META, MATERIAL_APPLICATION_JP, type DsmtCategory, type DsmtMaterial, type DsmtPbrParams, type MaterialApplication } from '../types';
import { FINISH_SUBTYPES, MAKER_REFERENCES, makerSearchUrl } from '../data/finishTaxonomy';

const ACCENT = '#ec407a';
const TEX_SLOTS: { slot: DsmtTextureSlot; label: string }[] = [
  { slot: 'albedo', label: 'ベースカラー (Albedo)' },
  { slot: 'normal', label: 'ノーマル (Normal)' },
  { slot: 'roughness', label: 'ラフネス (Roughness)' },
  { slot: 'ao', label: 'AO (Ambient Occlusion)' },
];

const DEFAULT_PARAMS: DsmtPbrParams = {
  baseColor: '#b0b0b0', roughness: 0.6, metalness: 0.0, opacity: 1, normalScale: 1, aoIntensity: 1,
};

/** params + テクスチャ URL を反映する three.js プレビュー球。 */
const PreviewSphere: React.FC<{ params: DsmtPbrParams; urls: Partial<Record<DsmtTextureSlot, string>> }> = ({ params, urls }) => {
  const [tex, setTex] = useState<Partial<Record<DsmtTextureSlot, THREE.Texture>>>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    let cancelled = false;
    const next: Partial<Record<DsmtTextureSlot, THREE.Texture>> = {};
    const entries = Object.entries(urls).filter(([, u]) => !!u) as [DsmtTextureSlot, string][];
    Promise.all(entries.map(([slot, url]) => new Promise<void>((resolve) => {
      loader.load(url, (t) => { t.colorSpace = slot === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace; next[slot] = t; resolve(); }, undefined, () => resolve());
    }))).then(() => { if (!cancelled) setTex(next); });
    return () => { cancelled = true; };
  }, [urls.albedo, urls.normal, urls.roughness, urls.ao]);

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        color={params.baseColor}
        roughness={params.roughness}
        metalness={params.metalness}
        opacity={params.opacity ?? 1}
        transparent={(params.opacity ?? 1) < 1}
        map={tex.albedo ?? null}
        normalMap={tex.normal ?? null}
        roughnessMap={tex.roughness ?? null}
        aoMap={tex.ao ?? null}
        aoMapIntensity={params.aoIntensity ?? 1}
        normalScale={new THREE.Vector2(params.normalScale ?? 1, params.normalScale ?? 1)}
      />
    </mesh>
  );
};

interface DsmtMaterialDialogProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  /** 編集対象（null = 新規作成） */
  material?: DsmtMaterial | null;
  onSaved?: () => void;
}

export const DsmtMaterialDialog: React.FC<DsmtMaterialDialogProps> = ({ open, onClose, projectId, material, onSaved }) => {
  const isEdit = !!material;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DsmtCategory>('fabric');
  const [params, setParams] = useState<DsmtPbrParams>(DEFAULT_PARAMS);
  const [tags, setTags] = useState('');
  const [applications, setApplications] = useState<MaterialApplication[]>([]);
  const [subtypeKey, setSubtypeKey] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [files, setFiles] = useState<Partial<Record<DsmtTextureSlot, File>>>({});
  const [localUrls, setLocalUrls] = useState<Partial<Record<DsmtTextureSlot, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // 初期化（開くたび / 対象変更時）
  useEffect(() => {
    if (!open) return;
    setTitle(material?.title ?? '');
    setCategory(material?.category ?? 'fabric');
    setParams({ ...DEFAULT_PARAMS, ...(material?.params ?? {}) });
    setTags((material?.tags ?? []).join(', '));
    setApplications(material?.applications ?? []);
    setSubtypeKey('');
    setVisibility(material?.visibility ?? 'private');
    setFiles({});
    setLocalUrls({});
    setError(null);
  }, [open, material]);

  // 選択ファイルのプレビュー用 ObjectURL を破棄
  useEffect(() => () => { Object.values(localUrls).forEach((u) => u && URL.revokeObjectURL(u)); }, [localUrls]);

  // プレビューに使う URL = 新規選択 > 既存 maps
  const previewUrls = useMemo(() => {
    const merged: Partial<Record<DsmtTextureSlot, string>> = { ...(material?.maps ?? {}) };
    (Object.keys(localUrls) as DsmtTextureSlot[]).forEach((s) => { if (localUrls[s]) merged[s] = localUrls[s]; });
    return merged;
  }, [material?.maps, localUrls]);

  const handlePickFile = (slot: DsmtTextureSlot, file: File | undefined) => {
    if (!file) return;
    setFiles((prev) => ({ ...prev, [slot]: file }));
    setLocalUrls((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: URL.createObjectURL(file) };
    });
  };

  const handleSave = async () => {
    if (!projectId) { setError('保存先のプロジェクトが選択されていません。左サイドバーからプロジェクトを選んでください。'); return; }
    if (!title.trim()) { setError('素材名を入力してください。'); return; }
    setSaving(true);
    setError(null);
    try {
      const input = {
        title: title.trim(),
        category,
        params,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        applications,
        visibility,
        maps: material?.maps ?? {},
      };
      if (isEdit && material) {
        await dsmtUploadService.updateMaterial(projectId, material.id, input, files);
      } else {
        await dsmtUploadService.createMaterial(projectId, input, files);
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      console.error('[DsmtMaterialDialog] save failed', e);
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const sliderRow = (label: string, key: keyof DsmtPbrParams, min: number, max: number, step = 0.01) => (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)' }}>{Number(params[key] ?? 0).toFixed(2)}</Typography>
      </Box>
      <Slider
        size="small" min={min} max={max} step={step}
        value={Number(params[key] ?? 0)}
        onChange={(_, v) => setParams((p) => ({ ...p, [key]: v as number }))}
        sx={{ color: ACCENT }}
      />
    </Box>
  );

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-bg)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? 'マテリアルを編集' : '新規マテリアル'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
          {/* 左: 3D プレビュー */}
          <Box sx={{ width: 280, flexShrink: 0 }}>
            <Box sx={{ width: 280, height: 280, borderRadius: 2, overflow: 'hidden', bgcolor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
              <Canvas camera={{ position: [0, 0, 3], fov: 40 }} dpr={[1, 2]}>
                <ambientLight intensity={0.4} />
                <directionalLight position={[3, 4, 2]} intensity={1.1} />
                <React.Suspense fallback={null}>
                  <PreviewSphere params={params} urls={previewUrls} />
                  <Environment preset="apartment" />
                </React.Suspense>
                <OrbitControls enablePan={false} minDistance={2} maxDistance={6} />
              </Canvas>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1, textAlign: 'center' }}>
              ドラッグで回転 · リアルタイムプレビュー
            </Typography>
          </Box>

          {/* 右: フォーム */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="素材名" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small"
              sx={{ mb: 2, '& .MuiInputBase-input': { color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
            />

            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 0.5 }}>カテゴリ</Typography>
            <Select value={category} onChange={(e) => setCategory(e.target.value as DsmtCategory)} size="small" fullWidth
              MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } } }}
              sx={{ mb: 2, color: 'var(--brand-fg)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}>
              {(Object.keys(DSMT_CATEGORY_META) as DsmtCategory[]).map((c) => (
                <MenuItem key={c} value={c} sx={{ color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(236,64,122,0.2)' } }}>
                  {DSMT_CATEGORY_META[c].label}
                </MenuItem>
              ))}
            </Select>

            {/* 仕上げ種別プリセット（選ぶと部位＋カテゴリ＋タグを自動設定） */}
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 0.5 }}>仕上げ種別（選ぶと部位・カテゴリ・タグを自動設定）</Typography>
            <Select
              value={subtypeKey}
              displayEmpty
              onChange={(e) => {
                const key = e.target.value as string;
                const st = FINISH_SUBTYPES.find((s) => s.key === key);
                setSubtypeKey(key);
                if (!st) return;
                setCategory(st.category);
                setApplications(st.applications);
                setTags((prev) => {
                  const arr = prev.split(',').map((t) => t.trim()).filter(Boolean);
                  if (!arr.includes(st.label)) arr.push(st.label);
                  return arr.join(', ');
                });
              }}
              size="small" fullWidth
              MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', maxHeight: 360 } } }}
              sx={{ mb: 2, color: 'var(--brand-fg)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
            >
              <MenuItem value="" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontStyle: 'italic' }}>（任意）種別から選ぶ…</MenuItem>
              <ListSubheader sx={{ bgcolor: 'var(--brand-surface2)', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, lineHeight: '28px', letterSpacing: 1 }}>── 床</ListSubheader>
              {FINISH_SUBTYPES.filter(s => s.applications.includes('floor') && !s.applications.includes('inner_wall')).map((s) => (
                <MenuItem key={s.key} value={s.key} sx={{ color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(236,64,122,0.2)' } }}>
                  {s.label}
                  <span style={{ marginLeft: 8, opacity: 0.45, fontSize: 11 }}>{DSMT_CATEGORY_META[s.category].label}</span>
                </MenuItem>
              ))}
              <ListSubheader sx={{ bgcolor: 'var(--brand-surface2)', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, lineHeight: '28px', letterSpacing: 1 }}>── 内壁 / 天井</ListSubheader>
              {FINISH_SUBTYPES.filter(s => s.applications.some(a => a === 'inner_wall' || a === 'ceiling')).map((s) => (
                <MenuItem key={s.key} value={s.key} sx={{ color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(236,64,122,0.2)' } }}>
                  {s.label}
                  <span style={{ marginLeft: 8, opacity: 0.45, fontSize: 11 }}>{s.applications.map(a => MATERIAL_APPLICATION_JP[a]).join('/')}</span>
                </MenuItem>
              ))}
              <ListSubheader sx={{ bgcolor: 'var(--brand-surface2)', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, lineHeight: '28px', letterSpacing: 1 }}>── 外壁</ListSubheader>
              {FINISH_SUBTYPES.filter(s => s.applications.includes('outer_wall')).map((s) => (
                <MenuItem key={s.key} value={s.key} sx={{ color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(236,64,122,0.2)' } }}>
                  {s.label}
                  <span style={{ marginLeft: 8, opacity: 0.45, fontSize: 11 }}>{DSMT_CATEGORY_META[s.category].label}</span>
                </MenuItem>
              ))}
            </Select>

            {/* 部位（自動マテリアル付与の床/内壁/外壁/天井マッチに使用。複数選択可） */}
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 0.5 }}>部位（適合する場所・複数可）</Typography>
            <ToggleButtonGroup
              size="small"
              value={applications}
              onChange={(_, next) => setApplications(next as MaterialApplication[])}
              sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}
            >
              {(Object.keys(MATERIAL_APPLICATION_JP) as MaterialApplication[]).map((app) => (
                <ToggleButton
                  key={app}
                  value={app}
                  sx={{
                    color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontSize: 12, px: 1.5,
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: '6px !important',
                    '&.Mui-selected': { color: 'var(--brand-fg)', background: 'rgba(52,211,153,0.28)', borderColor: 'rgba(52,211,153,0.6)' },
                    '&.Mui-selected:hover': { background: 'rgba(52,211,153,0.36)' },
                  }}
                >
                  {MATERIAL_APPLICATION_JP[app]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* 似た素材を探す（メーカー候補へ検索リンク。品番・直URLは保持しない） */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 0.5 }}>似た素材を探す（外部検索）</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {MAKER_REFERENCES.map((m) => (
                  <Link
                    key={m}
                    href={makerSearchUrl(m, title)}
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={{ fontSize: 11, color: 'light-dark(rgba(0,77,173,0.85), rgba(120,180,255,0.85))', '&:hover': { color: 'light-dark(#0046ad, #9cc4ff)' } }}
                  >
                    {m}
                  </Link>
                ))}
              </Box>
            </Box>

            {/* カラー + PBR */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>ベースカラー</Typography>
              <input type="color" value={params.baseColor}
                onChange={(e) => setParams((p) => ({ ...p, baseColor: e.target.value }))}
                style={{ width: 40, height: 28, background: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 4, cursor: 'pointer' }} />
              <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', fontFamily: 'monospace' }}>{params.baseColor}</Typography>
            </Box>
            {sliderRow('ラフネス (粗さ)', 'roughness', 0, 1)}
            {sliderRow('メタルネス (金属度)', 'metalness', 0, 1)}
            {sliderRow('不透明度', 'opacity', 0, 1)}

            {/* テクスチャスロット */}
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mt: 1.5, mb: 0.5 }}>テクスチャ</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
              {TEX_SLOTS.map(({ slot, label }) => {
                const hasFile = !!files[slot] || !!material?.maps?.[slot];
                return (
                  <Box key={slot} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <input ref={(el) => { fileInputs.current[slot] = el; }} type="file" accept="image/*" hidden
                      onChange={(e) => handlePickFile(slot, e.target.files?.[0])} />
                    <Button size="small" variant="outlined" startIcon={<UploadFileRoundedIcon sx={{ fontSize: 14 }} />}
                      onClick={() => fileInputs.current[slot]?.click()}
                      sx={{ flex: 1, fontSize: 10, textTransform: 'none', color: hasFile ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: hasFile ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.2)', justifyContent: 'flex-start' }}>
                      {hasFile ? `✓ ${label}` : label}
                    </Button>
                  </Box>
                );
              })}
            </Box>

            <TextField
              label="タグ（カンマ区切り）" value={tags} onChange={(e) => setTags(e.target.value)} fullWidth size="small"
              sx={{ mb: 2, '& .MuiInputBase-input': { color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
            />

            <ToggleButtonGroup exclusive size="small" value={visibility} onChange={(_, v) => v && setVisibility(v)}>
              <ToggleButton value="private" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontSize: 12 }}>
                <LockRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> 非公開
              </ToggleButton>
              <ToggleButton value="public" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontSize: 12 }}>
                <PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> 公開
              </ToggleButton>
            </ToggleButtonGroup>

            {error && <Typography sx={{ color: 'light-dark(#ad0000, #ff6b6b)', fontSize: 12, mt: 1.5 }}>{error}</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#f06292' } }}
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : undefined}>
          {saving ? '保存中...' : (isEdit ? '更新' : '作成')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
