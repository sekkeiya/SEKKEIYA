import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Slider, TextField, Select, MenuItem, Chip, Switch,
  CircularProgress, Tooltip, Divider, InputBase,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { dsmtUploadService, type DsmtTextureSlot } from '../api/dsmtUploadService';
import { useLocalTextures, fetchAssetAsFile, type LocalTexture } from '../lib/localTextures';
import { DSMT_CATEGORY_META, type DsmtCategory, type DsmtMaterial, type DsmtPbrParams, type DsmtProduct } from '../types';
import { ProductCompareSection } from './ProductCompareSection';

const ACCENT = '#ec407a';

// 編集 UI に出すテクスチャスロット（metalness はスカラーなので除外）
const SLOTS: { slot: DsmtTextureSlot; label: string; hint: string }[] = [
  { slot: 'albedo', label: 'ベースカラー (Albedo)', hint: '色・模様の画像' },
  { slot: 'normal', label: 'ノーマル (Normal)', hint: '凹凸（紫っぽい画像）' },
  { slot: 'roughness', label: 'ラフネス (Roughness)', hint: '粗さ（白黒画像）' },
  { slot: 'ao', label: 'AO (遮蔽)', hint: '陰り（白基調の白黒）' },
];
const SLOT_LABEL: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.slot, s.label]));

/**
 * テクスチャ＋球陰影の CSS プレビュー（WebGL 非依存）。
 * 多数タブの WebGL コンテキスト枯渇や CORS の影響を受けずに確実に表示する。
 * 画像 URL は背景画像として描画（cross-origin 画像でも表示は可能）。
 */
const CssSpherePreview: React.FC<{ baseColor: string; albedoUrl?: string; size?: number }> = ({ baseColor, albedoUrl, size = 300 }) => {
  const hasTex = !!albedoUrl;
  const shade = `radial-gradient(circle at 32% 28%, rgba(255,255,255,${hasTex ? 0.45 : 0.6}) 0%, rgba(255,255,255,0) 44%), radial-gradient(circle at 72% 82%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 62%)`;
  return (
    <Box sx={{
      width: size, height: size, borderRadius: '50%', m: 'auto',
      backgroundImage: hasTex ? `${shade}, url("${albedoUrl}")` : `${shade}, radial-gradient(circle, ${baseColor} 0%, ${baseColor} 100%)`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      boxShadow: 'inset 0 -12px 28px rgba(0,0,0,0.55), inset 0 8px 18px rgba(255,255,255,0.1)',
    }} />
  );
};

interface Props { material: DsmtMaterial; onBack: () => void; }

export const DsmtMaterialDetail: React.FC<Props> = ({ material, onBack }) => {
  const projectId = material.projectId;
  const [mat, setMat] = useState<DsmtMaterial>(material);
  const [savingParams, setSavingParams] = useState(false);
  const [assigning, setAssigning] = useState<DsmtTextureSlot | null>(null);
  const [targetSlot, setTargetSlot] = useState<DsmtTextureSlot | null>(null);
  const [search, setSearch] = useState('');
  const { textures, loading: texLoading } = useLocalTextures();

  useEffect(() => { setMat(material); }, [material.id]);

  const slug = (material.id || '').replace(/^dsmt_seed_/, '');
  const meta = DSMT_CATEGORY_META[mat.category] || DSMT_CATEGORY_META.other;

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const byFolder = new Map<string, LocalTexture[]>();
    for (const t of textures) {
      if (q && !(t.name.toLowerCase().includes(q) || t.subfolder.toLowerCase().includes(q))) continue;
      const key = t.subfolder || '(直下)';
      if (!byFolder.has(key)) byFolder.set(key, []);
      byFolder.get(key)!.push(t);
    }
    // この素材の slug に一致するフォルダを先頭へ
    return Array.from(byFolder.entries()).sort(([a], [b]) => {
      const am = a.endsWith(slug) ? 0 : 1; const bm = b.endsWith(slug) ? 0 : 1;
      return am - bm || a.localeCompare(b);
    });
  }, [textures, search, slug]);

  const setParam = (k: keyof DsmtPbrParams, v: any) => setMat((m) => ({ ...m, params: { ...m.params, [k]: v } }));

  const saveParams = async () => {
    if (!projectId) return;
    setSavingParams(true);
    try {
      await dsmtUploadService.updateMaterial(projectId, mat.id, {
        title: mat.title, category: mat.category, params: mat.params,
        tags: mat.tags ?? [], visibility: mat.visibility, maps: mat.maps ?? {},
      });
    } catch (e) { console.error('[DsmtMaterialDetail] saveParams failed', e); }
    finally { setSavingParams(false); }
  };

  // リンク商品の更新（即時永続化）。プロジェクト由来素材のみ。
  const handleProductsChange = async (products: DsmtProduct[]) => {
    setMat((m) => ({ ...m, products }));
    if (!projectId) return;
    try {
      await dsmtUploadService.updateMaterialProducts(projectId, mat.id, products);
    } catch (e) { console.error('[DsmtMaterialDetail] update products failed', e); }
  };

  const assignTexture = async (tex: LocalTexture, slot: DsmtTextureSlot) => {
    if (!projectId) return;
    setAssigning(slot);
    try {
      const file = await fetchAssetAsFile(tex.url, tex.name);
      const url = await dsmtUploadService.setMaterialMapFromFile(projectId, mat.id, slot, file);
      setMat((m) => {
        const next: DsmtMaterial = { ...m, maps: { ...(m.maps ?? {}), [slot]: url } };
        if (slot === 'albedo') { next.thumbnailUrl = url; next.params = { ...next.params, baseColor: '#ffffff' }; }
        if (slot === 'roughness') next.params = { ...next.params, roughness: 1 };
        return next;
      });
      setTargetSlot(null);
    } catch (e) { console.error('[DsmtMaterialDetail] assign failed', e); }
    finally { setAssigning(null); }
  };

  // テクスチャをクリック: 推定スロット → なければ選択中スロット
  const handleTextureClick = (tex: LocalTexture) => {
    const slot = (tex.slot && tex.slot !== 'metalness') ? tex.slot : targetSlot;
    if (!slot) { setTargetSlot(null); return; }
    assignTexture(tex, slot as DsmtTextureSlot);
  };

  // フォルダのセットを一括割当（ファイル名から推定）
  const assignFolderSet = async (items: LocalTexture[]) => {
    for (const t of items) {
      if (t.slot && t.slot !== 'metalness') await assignTexture(t, t.slot);
    }
  };

  const clearSlot = async (slot: DsmtTextureSlot) => {
    if (!projectId) return;
    try {
      await dsmtUploadService.clearMaterialMap(projectId, mat.id, slot);
      setMat((m) => ({ ...m, maps: { ...(m.maps ?? {}), [slot]: undefined } as any }));
    } catch (e) { console.error('[DsmtMaterialDetail] clear failed', e); }
  };

  // プレビューは fetch→objectURL 経由で読むため、確実に取得できるローカル asset:// を優先し、
  // 無ければ Storage URL にフォールバックする。
  const localUrlFor = (slot: DsmtTextureSlot): string | undefined =>
    textures.find((t) => t.slug === slug && t.slot === slot)?.url;
  const previewMaps = {
    albedo: localUrlFor('albedo') ?? mat.maps?.albedo,
    normal: localUrlFor('normal') ?? mat.maps?.normal,
    roughness: localUrlFor('roughness') ?? mat.maps?.roughness,
    ao: localUrlFor('ao') ?? mat.maps?.ao,
  };

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* 左+中央: 詳細編集 */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {/* ヘッダー */}
        <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <IconButton onClick={onBack} sx={{ color: '#fff' }}><ArrowBackRoundedIcon /></IconButton>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>マテリアル詳細</Typography>
          <Box sx={{ flex: 1 }} />
          {!projectId && <Typography sx={{ fontSize: 12, color: '#ff9800' }}>プロジェクト由来の素材のみ編集できます</Typography>}
          <Button variant="contained" size="small" disabled={!projectId || savingParams} onClick={saveParams}
            startIcon={savingParams ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : undefined}
            sx={{ bgcolor: ACCENT, textTransform: 'none', '&:hover': { bgcolor: '#f06292' } }}>保存</Button>
        </Box>

        <Box sx={{ p: 3, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* プレビュー */}
          <Box sx={{ width: 300, flexShrink: 0 }}>
            <Box sx={{ width: 300, height: 300, borderRadius: 2, overflow: 'hidden', bgcolor: '#05060a', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5 }}>
              <CssSpherePreview baseColor={mat.params.baseColor} albedoUrl={previewMaps.albedo} size={270} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
              <Chip label={meta.label} size="small" sx={{ bgcolor: `${meta.color}22`, color: meta.color }} />
              <Chip label={mat.visibility === 'public' ? '公開中' : '非公開'} size="small"
                sx={{ bgcolor: mat.visibility === 'public' ? 'rgba(236,64,122,0.18)' : 'rgba(255,255,255,0.08)', color: mat.visibility === 'public' ? ACCENT : 'rgba(255,255,255,0.6)' }} />
            </Box>
          </Box>

          {/* パラメータ + スロット */}
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <TextField label="素材名" value={mat.title || ''} onChange={(e) => setMat((m) => ({ ...m, title: e.target.value }))} fullWidth size="small"
              sx={{ mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Select value={mat.category} onChange={(e) => setMat((m) => ({ ...m, category: e.target.value as DsmtCategory }))} size="small"
                sx={{ minWidth: 160, color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {(Object.keys(DSMT_CATEGORY_META) as DsmtCategory[]).map((c) => <MenuItem key={c} value={c}>{DSMT_CATEGORY_META[c].label}</MenuItem>)}
              </Select>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>ベースカラー</Typography>
                <input type="color" value={mat.params.baseColor} onChange={(e) => setParam('baseColor', e.target.value)}
                  style={{ width: 36, height: 26, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>公開</Typography>
                <Switch size="small" checked={mat.visibility === 'public'} onChange={(e) => setMat((m) => ({ ...m, visibility: e.target.checked ? 'public' : 'private' }))}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(236,64,122,0.5)' } }} />
              </Box>
            </Box>

            {(['roughness', 'metalness', 'opacity'] as (keyof DsmtPbrParams)[]).map((k) => (
              <Box key={k} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{k === 'roughness' ? 'ラフネス' : k === 'metalness' ? 'メタルネス' : '不透明度'}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#fff' }}>{Number(mat.params[k] ?? (k === 'opacity' ? 1 : 0)).toFixed(2)}</Typography>
                </Box>
                <Slider size="small" min={0} max={1} step={0.01} value={Number(mat.params[k] ?? (k === 'opacity' ? 1 : 0))} onChange={(_, v) => setParam(k, v as number)} sx={{ color: ACCENT }} />
              </Box>
            ))}

            <TextField label="タグ（カンマ区切り）" value={(mat.tags ?? []).join(', ')} onChange={(e) => setMat((m) => ({ ...m, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))} fullWidth size="small"
              sx={{ mt: 1, mb: 2, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }} />

            {/* テクスチャスロット */}
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 1 }}>テクスチャスロット</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 1.5 }}>
              右の一覧から画像をクリックすると、ファイル名に応じて自動でスロットに入ります。スロットを選んでから画像をクリックすると、そのスロットに入れられます。
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {SLOTS.map(({ slot, label, hint }) => {
                const url = (mat.maps as any)?.[slot] as string | undefined;
                const isTarget = targetSlot === slot;
                return (
                  <Box key={slot} onClick={() => setTargetSlot(isTarget ? null : slot)}
                    sx={{ p: 1, borderRadius: 1.5, cursor: 'pointer', position: 'relative',
                      bgcolor: isTarget ? 'rgba(236,64,122,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isTarget ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      transition: 'border-color 0.15s' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 1, flexShrink: 0, bgcolor: 'rgba(0,0,0,0.4)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {assigning === slot ? <CircularProgress size={16} sx={{ color: ACCENT }} />
                          : url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Typography sx={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>＋</Typography>}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: url ? '#fff' : 'rgba(255,255,255,0.6)' }} noWrap>{label}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} noWrap>{url ? '設定済み' : hint}</Typography>
                      </Box>
                      {url && <IconButton size="small" onClick={(e) => { e.stopPropagation(); clearSlot(slot); }} sx={{ color: 'rgba(255,255,255,0.5)' }}><ClearRoundedIcon sx={{ fontSize: 15 }} /></IconButton>}
                    </Box>
                    {isTarget && <Typography sx={{ position: 'absolute', top: 2, right: 6, fontSize: 9, color: ACCENT }}>選択中</Typography>}
                  </Box>
                );
              })}
            </Box>
            {((mat.maps as any)?.albedo) && (
              <Typography sx={{ fontSize: 10.5, color: 'rgba(129,199,132,0.9)', mt: 1 }}>
                ✓ Albedo を設定したのでベースカラーは白に正規化されています（色の二重適用を防止）。
              </Typography>
            )}
          </Box>
        </Box>

        {/* リンク商品・メーカー比較 */}
        <Box sx={{ px: 3, pb: 4 }}>
          <ProductCompareSection
            products={mat.products ?? []}
            onChange={handleProductsChange}
            readOnly={!projectId}
          />
        </Box>
      </Box>

      {/* 右サイドバー: テクスチャ一覧（S.Image / ローカル素材） */}
      <Box sx={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(10,15,25,0.4)' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>テクスチャ一覧</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 2, px: 1.25, py: 0.4, border: '1px solid rgba(255,255,255,0.06)' }}>
            <SearchRoundedIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', mr: 0.75 }} />
            <InputBase placeholder="フォルダ / ファイル名で絞り込み" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ color: '#fff', fontSize: 12, flex: 1 }} />
          </Box>
          {targetSlot && <Typography sx={{ fontSize: 11, color: ACCENT, mt: 1 }}>「{SLOT_LABEL[targetSlot]}」に入れる画像を選んでください</Typography>}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
          {texLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
          ) : grouped.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', p: 1 }}>
              ローカル素材にテクスチャがありません。S.Image の「ローカル素材」（%USERPROFILE%\SEKKEIYA\LocalAssets\Images）に画像を置いてください。
            </Typography>
          ) : grouped.map(([folder, items]) => {
            const isMatch = folder.endsWith(slug) && !!slug;
            const hasSet = items.some((t) => t.slot && t.slot !== 'metalness');
            return (
              <Box key={folder} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                  {isMatch && <CheckCircleRoundedIcon sx={{ fontSize: 14, color: '#81c784' }} />}
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: isMatch ? '#81c784' : 'rgba(255,255,255,0.55)', flex: 1 }} noWrap>{folder}</Typography>
                  {hasSet && (
                    <Tooltip title="ファイル名から4スロットを一括割当">
                      <IconButton size="small" onClick={() => assignFolderSet(items)} sx={{ color: ACCENT, p: 0.25 }}><AutoFixHighRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {items.map((t) => (
                    <Box key={t.id} onClick={() => handleTextureClick(t)}
                      title={`${t.name}${t.slot ? `（推定: ${SLOT_LABEL[t.slot] ?? t.slot}）` : ''}`}
                      sx={{ cursor: 'pointer', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { borderColor: ACCENT } }}>
                      <Box sx={{ width: '100%', aspectRatio: '1 / 1', bgcolor: '#000' }}>
                        <img src={t.url} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Box>
                      <Box sx={{ px: 0.5, py: 0.4 }}>
                        <Typography sx={{ fontSize: 9.5, color: '#fff' }} noWrap>{t.name}</Typography>
                        {t.slot && t.slot !== 'metalness' && (
                          <Typography sx={{ fontSize: 8.5, color: ACCENT }} noWrap>→ {SLOT_LABEL[t.slot]}</Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mt: 1.5 }} />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
