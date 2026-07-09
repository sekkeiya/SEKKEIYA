import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, Button, Chip, CircularProgress, Menu, MenuItem, Divider, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage } from '@react-three/drei';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getModelLocalPathCached } from '../../../lib/modelLocalPathCache';
import { getDownloadUrlForModel } from '../utils/modelUtils';
import { enumerateMaterialSlots, applyBindingToObject, type EnumeratedSlot } from '../../shared/material/applyMaterial';
import { saveMaterialBinding, deleteMaterialBinding, bindingIdForModel } from '../../shared/material/materialBindingApi';
import { useModelBinding, upsertBindingSlot, removeBindingSlot } from '../../shared/material/useMaterialBinding';
import { subscribeProjectMaterials } from '../../dsmt/api/dsmtQueries';
import { dsmtUploadService } from '../../dsmt/api/dsmtUploadService';
import { DSMT_CATEGORY_META, type DsmtMaterial, type MaterialBinding } from '../../dsmt/types';

const ACCENT = '#ec407a';
const extractCanonicalId = (url: string) => (url.match(/assets%2F([a-f0-9-]+)%2F/)?.[1] || '');
const normMesh = (n?: string) => (n && n.length ? n : undefined);
const slotKeyOf = (s: { meshName?: string; materialIndex?: number }) => `${normMesh(s.meshName) ?? ''}#${s.materialIndex ?? 0}`;

/** GLB を Tauri キャッシュ経由で解決（RightPanelModelViewer と同方式・403 回避）。 */
function useResolvedGlbUrl(modelUrl?: string): { url: string; loading: boolean } {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!modelUrl) { setUrl(''); return; }
    const canonicalId = extractCanonicalId(modelUrl);
    if (!canonicalId || !modelUrl.includes('firebasestorage')) { setUrl(modelUrl); return; }
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        await invoke('ensure_model_cached', { modelId: canonicalId, model_id: canonicalId, ext: 'glb', downloadUrl: modelUrl });
        const filePath = await getModelLocalPathCached(canonicalId, 'glb');
        if (!mounted) return;
        setUrl(filePath ? convertFileSrc(filePath.replace(/\\/g, '/')) : modelUrl);
      } catch { if (mounted) setUrl(modelUrl); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [modelUrl]);
  return { url, loading };
}

/** バインディング適用済みのプレビュー。binding 変更時は key で再マウントしてクリーンに再適用。 */
const BindingModel: React.FC<{ url: string; binding: MaterialBinding | null; onSlots: (s: EnumeratedSlot[]) => void }> = ({ url, binding, onSlots }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => { onSlots(enumerateMaterialSlots(cloned)); }, [cloned, onSlots]);
  useEffect(() => { if (binding) applyBindingToObject(cloned, binding); }, [cloned, binding]);
  return <primitive object={cloned} />;
};

const SwatchDot: React.FC<{ color?: string; size?: number }> = ({ color = '#888', size = 18 }) => (
  <Box sx={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 33% 28%, rgba(255,255,255,0.6), ${color} 60%, rgba(0,0,0,0.4))`, border: '1px solid rgba(255,255,255,0.15)' }} />
);

interface Props { model: any; projectId?: string }

export const DssMaterialTab: React.FC<Props> = ({ model, projectId }) => {
  const modelId = String(model?.assetRef || model?.entityId || model?.id || '');
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb') as string, [model]);
  const { url: resolvedUrl, loading: resolving } = useResolvedGlbUrl(glbUrl);

  const { binding } = useModelBinding(projectId, modelId);
  const [slots, setSlots] = useState<EnumeratedSlot[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<DsmtMaterial[]>([]);
  const [picker, setPicker] = useState<{ anchor: HTMLElement; slot: EnumeratedSlot } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribeProjectMaterials(projectId, setMaterials);
    return () => unsub();
  }, [projectId]);

  // バインディング由来のラベルをローカル編集 state に同期
  useEffect(() => {
    if (!binding) return;
    setLabels((prev) => {
      const next = { ...prev };
      for (const s of binding.slots) next[slotKeyOf(s)] = s.semanticLabel ?? next[slotKeyOf(s)] ?? '';
      return next;
    });
  }, [binding]);

  const bindingHash = useMemo(() => JSON.stringify(binding?.slots?.map((s) => [slotKeyOf(s), s.materialId]) ?? []), [binding]);
  const assignedFor = (slot: EnumeratedSlot) => binding?.slots.find((s) => slotKeyOf(s) === slotKeyOf(slot));

  const persist = async (next: MaterialBinding) => {
    if (!projectId) return;
    setBusy(true);
    try {
      if (next.slots.length === 0) await deleteMaterialBinding(projectId, bindingIdForModel(modelId));
      else await saveMaterialBinding(projectId, next);
    } catch (e) { console.error('[DssMaterialTab] persist failed', e); }
    finally { setBusy(false); }
  };

  const assignMaterial = async (slot: EnumeratedSlot, material: DsmtMaterial | any) => {
    const next = upsertBindingSlot(
      binding,
      { targetType: 'model', modelId },
      { meshName: normMesh(slot.meshName), materialIndex: slot.materialIndex, semanticLabel: labels[slotKeyOf(slot)] || undefined },
      material,
    );
    setPicker(null);
    await persist(next);
  };

  const registerEmbedded = async (slot: EnumeratedSlot) => {
    if (!projectId) return;
    setBusy(true);
    try {
      const input = {
        title: `${model.title || model.name || 'model'} / ${labels[slotKeyOf(slot)] || slot.materialName}`,
        category: 'other' as const,
        params: { baseColor: slot.baseColor || '#b0b0b0', roughness: slot.roughness ?? 0.6, metalness: slot.metalness ?? 0, opacity: 1 },
        visibility: 'private' as const,
      };
      const id = await dsmtUploadService.createMaterial(projectId, input);
      await assignMaterial(slot, { id, ...input });
    } catch (e) { console.error('[DssMaterialTab] register embedded failed', e); }
    finally { setBusy(false); }
  };

  const clearSlot = async (slot: EnumeratedSlot) => {
    if (!binding) return;
    await persist(removeBindingSlot(binding, { meshName: normMesh(slot.meshName), materialIndex: slot.materialIndex }));
  };

  const commitLabel = async (slot: EnumeratedSlot) => {
    const assign = assignedFor(slot);
    if (!assign || !binding) return; // 未割当ラベルは割当時に保存
    const label = labels[slotKeyOf(slot)] || undefined;
    if ((assign.semanticLabel ?? undefined) === label) return;
    const next: MaterialBinding = { ...binding, slots: binding.slots.map((s) => (slotKeyOf(s) === slotKeyOf(slot) ? { ...s, semanticLabel: label } : s)) };
    await persist(next);
  };

  if (!projectId) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>マテリアルの割り当てにはプロジェクトを選択してください。</Typography></Box>;
  }
  if (!glbUrl) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>このモデルには GLB がないためマテリアル編集できません。</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      {/* プレビュー */}
      <Box sx={{ flex: '1 1 320px', minWidth: 280, height: 320, bgcolor: '#05060a', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        {resolving || !resolvedUrl ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <Canvas shadows camera={{ position: [4, 4, 4], fov: 45 }}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.5} adjustCamera={1.3}>
                <BindingModel key={bindingHash} url={resolvedUrl} binding={binding} onSlots={setSlots} />
              </Stage>
              <OrbitControls enablePan={false} makeDefault />
            </Suspense>
          </Canvas>
        )}
      </Box>

      {/* スロット一覧 */}
      <Box sx={{ flex: '1 1 360px', minWidth: 300 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>マテリアルスロット</Typography>
          {busy && <CircularProgress size={14} sx={{ color: ACCENT }} />}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{slots.length} スロット</Typography>
        </Box>

        {slots.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>モデルを解析中…（スロットが出ない場合は単一マテリアルの可能性があります）</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {slots.map((slot) => {
              const key = slotKeyOf(slot);
              const assign = assignedFor(slot);
              const assignedMat = materials.find((m) => m.id === assign?.materialId);
              const assignColor = assignedMat?.params?.baseColor || assign?.material?.params?.baseColor || slot.baseColor;
              return (
                <Box key={key} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <SwatchDot color={assignColor} />
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1 }} noWrap>
                      {slot.materialName}{slot.meshName ? ` · ${slot.meshName}` : ''}
                    </Typography>
                    {assign && (
                      <Tooltip title="割り当て解除"><span>
                        <Button size="small" onClick={() => clearSlot(slot)} sx={{ minWidth: 0, p: 0.5, color: 'rgba(255,255,255,0.5)' }}><ClearRoundedIcon sx={{ fontSize: 16 }} /></Button>
                      </span></Tooltip>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      size="small" placeholder="役割名（張地 / 脚 など）"
                      value={labels[key] ?? ''}
                      onChange={(e) => setLabels((p) => ({ ...p, [key]: e.target.value }))}
                      onBlur={() => commitLabel(slot)}
                      sx={{ flex: 1, '& .MuiInputBase-input': { color: '#fff', fontSize: 12, py: 0.75 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}
                    />
                    <Button size="small" variant={assign ? 'outlined' : 'contained'} startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
                      onClick={(e) => setPicker({ anchor: e.currentTarget, slot })}
                      sx={{ textTransform: 'none', fontSize: 11, ...(assign ? { color: ACCENT, borderColor: ACCENT } : { bgcolor: ACCENT, '&:hover': { bgcolor: '#f06292' } }) }}>
                      {assignedMat?.title || assign?.material?.title || '素材を割当'}
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 1.5 }}>
          ※ 単一メッシュのモデル（Tripo 生成など）は「役割名」を空のままにするとオブジェクト全体に適用されます。
        </Typography>
      </Box>

      {/* 素材ピッカー */}
      <Menu anchorEl={picker?.anchor} open={!!picker} onClose={() => setPicker(null)}
        slotProps={{ paper: { sx: { bgcolor: '#14161b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 240, maxHeight: 360 } } }}>
        {picker && (
          <MenuItem onClick={() => registerEmbedded(picker.slot)} sx={{ fontSize: 12, gap: 1 }}>
            <SwatchDot color={picker.slot.baseColor} size={16} /> 埋め込み素材をライブラリに登録して割当
          </MenuItem>
        )}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
        {materials.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 12 }}>このプロジェクトに素材がありません</MenuItem>
        ) : materials.map((m) => {
          const meta = DSMT_CATEGORY_META[m.category] || DSMT_CATEGORY_META.other;
          return (
            <MenuItem key={m.id} onClick={() => picker && assignMaterial(picker.slot, m)} sx={{ fontSize: 12, gap: 1 }}>
              <SwatchDot color={m.params?.baseColor} size={16} />
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: 12 }} noWrap>{m.title || '無題'}</Typography></Box>
              <Chip label={meta.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: `${meta.color}22`, color: meta.color }} />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
