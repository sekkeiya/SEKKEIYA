import React, { Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, Chip, CircularProgress, Menu, MenuItem, Divider, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getModelLocalPathCached } from '../../../lib/modelLocalPathCache';
import { getDownloadUrlForModel, getCanonicalModelId } from '../utils/modelUtils';
import { enumerateMaterialSlots, type EnumeratedSlot } from '../../shared/material/applyMaterial';
import { materialToSnapshot } from '../../shared/material/useMaterialBinding';
import {
  type MaterialPresetSlot, type MaterialPresetOption, type MaterialVariant, type MaterialPresetMember,
  presetSlotKey, swatchColorOf, resolveSelectedOption, applySelectionToObject, readMaterialPresets,
  readMaterialVariants, resolveSelectedVariant, expandVariantSelection, variantSwatchColor,
  slotMembers,
} from '../../shared/material/materialPresets';
import { subscribeMaterialLibrary } from '../../dsmt/api/dsmtQueries';
import { useAuthStore } from '../../../store/useAuthStore';
import { DSMT_CATEGORY_META, type DsmtMaterial } from '../../dsmt/types';
import { useAppStore } from '../../../store/useAppStore';
import { persistAssetPatch } from '../utils/persistAssetPatch';
import { MaterialEditor } from './detail/sections/MaterialEditor';
import { VIEWER_ENVIRONMENT } from '../viewerEnvironment';
import type { MaterialPreviewState } from './RightPanelModelViewer';
import { uploadVariantThumb } from '../utils/variantThumb';

const ACCENT = '#ec407a';
const HILITE = '#22d3ee';
const extractCanonicalId = (url: string) => (url.match(/assets%2F([a-f0-9-]+)%2F/)?.[1] || '');

/** GLB を Tauri キャッシュ経由で解決（403 回避・RightPanelModelViewer と同方式）。 */
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

/**
 * プレビュー：selection に従って各部位へ選択中マテリアルを適用。
 * pickable=true ならメッシュクリックで部位選択。highlight のメッシュ群は枠線でハイライト。
 */
const PresetModel: React.FC<{
  url: string;
  presets: MaterialPresetSlot[];
  selection: Record<string, string>;
  /** ハイライトするメッシュ名の配列（選択中の行＝グループの全メンバー）。 */
  highlight?: string[];
  pickable?: boolean;
  onSlots: (s: EnumeratedSlot[]) => void;
  onPick?: (meshName: string) => void;
}> = ({ url, presets, selection, highlight, pickable, onSlots, onPick }) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // 元のGLB素材を保存（「デフォルト」で完全に復元できるように）
    c.traverse((o: any) => { if (o.isMesh && o.userData.__origMat === undefined) o.userData.__origMat = o.material; });
    return c;
  }, [scene]);
  const helpersRef = useRef<THREE.BoxHelper[]>([]);
  const rootScene = useThree((s) => s.scene);
  const highlightKey = (highlight || []).join('|');

  useEffect(() => { onSlots(enumerateMaterialSlots(cloned)); }, [cloned, onSlots]);

  // 選択中マテリアルを適用。未選択の部位は元のGLB素材へ復元してから適用（バリアント→デフォルトで元に戻る）。
  useEffect(() => {
    cloned.traverse((o: any) => { if (o.isMesh && o.userData.__origMat !== undefined) o.material = o.userData.__origMat; });
    applySelectionToObject(cloned, presets, selection);
  }, [cloned, presets, selection]);

  // 選択部位のハイライト枠（BoxHelper）。グループの全メンバーに枠を出す。
  // BoxHelper は対象メッシュのワールド座標で頂点を書き込み、自身は親変換なし（シーン直下）を前提とする。
  // Stage が子要素にスケール/センタリング変換を掛けるため、同じ group 内に置くと変換が二重適用されて
  // 枠がずれる。シーン直下に追加し、毎フレーム update して Stage のスケール後も追従させる。
  useEffect(() => {
    const names = highlightKey ? highlightKey.split('|') : [];
    if (!names.length) return;
    const helpers: THREE.BoxHelper[] = [];
    for (const name of names) {
      let target: any = null;
      cloned.traverse((m: any) => { if (!target && m.isMesh && (m.name || '') === name) target = m; });
      if (!target) continue;
      const h = new THREE.BoxHelper(target, new THREE.Color(HILITE));
      (h.material as any).depthTest = false;
      (h.material as any).transparent = true;
      h.renderOrder = 9999;
      rootScene.add(h);
      helpers.push(h);
    }
    helpersRef.current = helpers;
    return () => {
      for (const h of helpers) {
        rootScene.remove(h);
        h.geometry.dispose();
        (h.material as any).dispose?.();
      }
      helpersRef.current = [];
    };
  }, [cloned, highlightKey, rootScene]);
  useFrame(() => { for (const h of helpersRef.current) h.update(); });

  const handleClick = useCallback((e: any) => {
    if (!pickable) return;
    e.stopPropagation();
    const obj = e.object;
    if (obj?.isMesh) onPick?.(obj.name || '');
  }, [pickable, onPick]);

  return (
    <group>
      <primitive object={cloned} onClick={handleClick} />
    </group>
  );
};

const SwatchDot: React.FC<{ color?: string; size?: number; selected?: boolean }> = ({ color = '#888', size = 22, selected }) => (
  <Box sx={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: `radial-gradient(circle at 33% 28%, rgb(var(--brand-fg-rgb) / 0.6), ${color} 60%, rgba(0,0,0,0.4))`,
    border: selected ? `2px solid ${ACCENT}` : '1px solid rgb(var(--brand-fg-rgb) / 0.2)',
    boxShadow: selected ? `0 0 0 2px ${ACCENT}55` : 'none',
  }} />
);

interface Props {
  model: any;
  /** 作成者のみ true。編集UIと「編集/プレビュー」切替を表示。 */
  isAuthor: boolean;
  /** S.Material ライブラリ参照用（任意）。無くても埋め込み素材で登録可。 */
  projectId?: string;
  /** 親から編集/プレビューを制御する場合に渡す（詳細画面の統一トグル用）。 */
  mode?: 'edit' | 'preview';
  /** 内部の編集/プレビュー切替トグルを隠す（親で制御する場合）。 */
  hideToggle?: boolean;
  /** 表示セクション。'material'=部位ごとの素材のみ / 'variants'=家具パターンのみ / 'both'=両方。 */
  section?: 'material' | 'variants' | 'both';
  /** true なら自前のCanvasを持たず、3Dプレビューを外部（メイン）ビューアへ委譲する（詳細画面のCanvas集約用）。 */
  externalViewer?: boolean;
  /** externalViewer 時、プレビュー状態（presets/selection/highlight/pickable）の変化を親へ通知。 */
  onPreviewState?: (st: MaterialPreviewState | null) => void;
  /** externalViewer 時、外部ビューアのパーツクリックを受けるハンドラの受け渡し先。 */
  pickHandlerRef?: React.MutableRefObject<((meshName: string) => void) | null>;
  /** externalViewer 時、外部ビューアが列挙した部位スロットを受け取るセッターの受け渡し先。 */
  slotsHandlerRef?: React.MutableRefObject<((slots: EnumeratedSlot[]) => void) | null>;
  /** パターン保存時に、メインビューアの描画をJPEGデータURLで取得する（サムネイル生成用）。 */
  captureThumb?: () => string | null;
  /** externalViewer 時、選択中パーツ数の変化を親へ通知する（ビューア上のアクションバー表示用）。 */
  onSelectionCountChange?: (count: number) => void;
  /** externalViewer 時、外部の「部位にする」ボタンから groupSelected を呼び出すための受け渡し先。 */
  groupSelectedRef?: React.MutableRefObject<(() => void) | null>;
}

export const DssMaterialPresets: React.FC<Props> = ({ model, isAuthor, mode: controlledMode, hideToggle, section = 'both', externalViewer, onPreviewState, pickHandlerRef, slotsHandlerRef, captureThumb, onSelectionCountChange, groupSelectedRef }) => {
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb') as string, [model]);
  // externalViewer 時は自前でGLBを解決しない（メインビューア側が解決済みのため）
  const { url: resolvedUrl, loading: resolving } = useResolvedGlbUrl(externalViewer ? undefined : glbUrl);
  const canonicalId = useMemo(() => getCanonicalModelId(model) || model?.id, [model]);
  // プロジェクト複製アイテムの編集をプロジェクト側へ書くための分岐に使う（persistAssetPatch）。
  const activeProjectId = useAppStore((s: any) => s.activeProjectId);

  const [slots, setSlots] = useState<EnumeratedSlot[]>([]);
  const [presets, setPresets] = useState<MaterialPresetSlot[]>(() => readMaterialPresets(model));
  const [variants, setVariants] = useState<MaterialVariant[]>(() => readMaterialVariants(model));
  const [selection, setSelection] = useState<Record<string, string>>({});
  // 現在プレビュー中の家具パターン（バリアント）。手動で部位を変えると null（=カスタム）。
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<DsmtMaterial[]>([]);
  const [picker, setPicker] = useState<{ anchor: HTMLElement; rowKey: string; repSlot: EnumeratedSlot } | null>(null);
  const [saving, setSaving] = useState(false);
  // 作成者の表示モード（編集 / プレビュー）。親から制御される場合はそちらを優先。
  const [internalMode, setInternalMode] = useState<'edit' | 'preview'>('edit');
  const mode = controlledMode ?? internalMode;
  const setMode = setInternalMode;
  // クリックで選択中の行（グループ or 単独パーツ）。複数選択するとグループ化できる。
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const isEditing = isAuthor && mode === 'edit';

  useEffect(() => {
    const nextPresets = readMaterialPresets(model);
    const nextVariants = readMaterialVariants(model);
    setPresets(nextPresets);
    setVariants(nextVariants);
    setSelectedKeys([]);
    // 既定パターンがあれば初期表示に展開、無ければ部位ごとの既定。
    const def = resolveSelectedVariant(nextVariants);
    if (def) {
      setSelection(expandVariantSelection(nextPresets, def));
      setSelectedVariantId(def.id);
    } else {
      setSelection({});
      setSelectedVariantId(null);
    }
  }, [model?.id]);

  // S.Material ライブラリ（全公開 ＋ 自分の Private）を購読。プロジェクト選択は不要。
  const currentUserId = useAuthStore((s) => s.currentUser?.uid);
  useEffect(() => {
    const unsub = subscribeMaterialLibrary(currentUserId, setMaterials);
    return () => unsub();
  }, [currentUserId]);

  const presetByKey = useMemo(() => {
    const m: Record<string, MaterialPresetSlot> = {};
    for (const p of presets) m[p.slotKey] = p;
    return m;
  }, [presets]);

  const selectionHash = useMemo(
    () => JSON.stringify(presets.map((p) => [p.slotKey, resolveSelectedOption(p, selection[p.slotKey])?.id ?? ''])),
    [presets, selection]
  );

  const persist = useCallback(async (next: MaterialPresetSlot[]) => {
    if (!isAuthor || !canonicalId) return;
    setSaving(true);
    try {
      const clean = next.map((s) => ({
        slotKey: s.slotKey,
        meshName: s.meshName ?? null,
        materialIndex: s.materialIndex,
        members: (s.members && s.members.length)
          ? s.members.map((m) => ({ meshName: m.meshName ?? null, materialIndex: m.materialIndex }))
          : null,
        label: s.label ?? '',
        options: s.options.map((o) => ({
          id: o.id,
          title: o.title ?? '',
          swatchColor: o.swatchColor ?? null,
          isDefault: !!o.isDefault,
          snapshot: {
            title: o.snapshot.title ?? '',
            category: o.snapshot.category ?? 'other',
            params: o.snapshot.params ?? { baseColor: '#b0b0b0', roughness: 0.6, metalness: 0 },
            maps: o.snapshot.maps ?? null,
            tiling: o.snapshot.tiling ?? null,
          },
        })),
      }));
      // プロジェクト複製アイテムならプロジェクト側が主（デフォルト=グローバルを汚さない）。
      // グローバル資産なら従来どおりグローバルへ。プラン別モデル設定 仕様 §5。
      await persistAssetPatch(model, activeProjectId, { materialPresets: clean });
    } catch (e) {
      console.error('[DssMaterialPresets] persist failed', e);
    } finally {
      setSaving(false);
    }
  }, [isAuthor, canonicalId, model, activeProjectId]);

  const updatePresets = useCallback((next: MaterialPresetSlot[]) => {
    setPresets(next);
    persist(next);
  }, [persist]);

  const persistVariants = useCallback(async (next: MaterialVariant[]) => {
    if (!isAuthor || !canonicalId) return;
    setSaving(true);
    try {
      const clean = next.map((v) => ({
        id: v.id,
        title: v.title ?? '',
        swatchColor: v.swatchColor ?? null,
        isDefault: !!v.isDefault,
        selection: { ...v.selection },
        thumbUrl: v.thumbUrl ?? null,
      }));
      await persistAssetPatch(model, activeProjectId, { materialVariants: clean });
    } catch (e) {
      console.error('[DssMaterialPresets] persist variants failed', e);
    } finally {
      setSaving(false);
    }
  }, [isAuthor, canonicalId, model, activeProjectId]);

  const updateVariants = useCallback((next: MaterialVariant[]) => {
    setVariants(next);
    persistVariants(next);
  }, [persistVariants]);

  const addOptionToRow = useCallback((rowKey: string, repSlot: EnumeratedSlot, snapshot: any, title: string, swatchColor?: string) => {
    const option: MaterialPresetOption = { id: crypto.randomUUID(), title, swatchColor, snapshot };
    const existing = presetByKey[rowKey];
    let next: MaterialPresetSlot[];
    if (existing) {
      const willBeFirst = existing.options.length === 0;
      next = presets.map((p) => p.slotKey === rowKey
        ? { ...p, options: [...p.options, { ...option, isDefault: willBeFirst }] }
        : p);
    } else {
      // 単独パーツに初めてオプションを追加 → 単一メンバーの preset を遅延生成
      next = [...presets, {
        slotKey: rowKey, meshName: repSlot.meshName || undefined, materialIndex: repSlot.materialIndex,
        label: '', options: [{ ...option, isDefault: true }],
      }];
    }
    updatePresets(next);
    setSelection((s) => ({ ...s, [rowKey]: option.id }));
    setPicker(null);
  }, [presets, presetByKey, updatePresets]);

  const removeOption = useCallback((slotKey: string, optionId: string) => {
    const next = presets
      .map((p) => {
        if (p.slotKey !== slotKey) return p;
        const options = p.options.filter((o) => o.id !== optionId);
        if (options.length && !options.some((o) => o.isDefault)) options[0] = { ...options[0], isDefault: true };
        return { ...p, options };
      })
      .filter((p) => p.options.length > 0);
    updatePresets(next);
  }, [presets, updatePresets]);

  const setDefaultOption = useCallback((slotKey: string, optionId: string) => {
    updatePresets(presets.map((p) => p.slotKey !== slotKey ? p
      : { ...p, options: p.options.map((o) => ({ ...o, isDefault: o.id === optionId })) }));
  }, [presets, updatePresets]);

  const setLabel = useCallback((slotKey: string, label: string) => {
    setPresets((prev) => {
      // 未登録スロットでも役割名だけ先行入力できるように空 preset を作る
      if (!prev.some((p) => p.slotKey === slotKey)) {
        const slot = slots.find((s) => presetSlotKey(s) === slotKey);
        return [...prev, { slotKey, meshName: slot?.meshName || undefined, materialIndex: slot?.materialIndex ?? 0, label, options: [] }];
      }
      return prev.map((p) => p.slotKey === slotKey ? { ...p, label } : p);
    });
  }, [slots]);
  const commitLabel = useCallback(() => { persist(presets.filter((p) => p.options.length > 0 || (p.label || '').length > 0)); }, [persist, presets]);

  const addEmbedded = useCallback((rowKey: string, repSlot: EnumeratedSlot) => {
    const snapshot = materialToSnapshot({
      title: repSlot.materialName,
      params: { baseColor: repSlot.baseColor || '#b0b0b0', roughness: repSlot.roughness ?? 0.6, metalness: repSlot.metalness ?? 0, opacity: 1 },
    });
    addOptionToRow(rowKey, repSlot, snapshot, repSlot.materialName || '埋め込み素材', repSlot.baseColor);
  }, [addOptionToRow]);

  const addFromLibrary = useCallback((rowKey: string, repSlot: EnumeratedSlot, mat: DsmtMaterial) => {
    addOptionToRow(rowKey, repSlot, materialToSnapshot(mat), mat.title || '素材', mat.params?.baseColor);
  }, [addOptionToRow]);

  const selectOption = useCallback((slotKey: string, optionId: string) => {
    setSelection((s) => ({ ...s, [slotKey]: optionId }));
    // 部位を手動で変えたら、保存済みパターンと一致しなくなるので「カスタム」表示にする。
    setSelectedVariantId(null);
  }, []);

  /** 部位の選択を外して元の GLB 素材へ戻す（プレビュー状態のみ。永続化はしない）。 */
  const clearOption = useCallback((slotKey: string) => {
    setSelection((s) => {
      const next = { ...s };
      delete next[slotKey];
      return next;
    });
    setSelectedVariantId(null);
  }, []);

  // ===== 行（グループ / 単独パーツ）の構築とグループ操作 =====

  /** いずれかの preset のメンバーになっているメッシュキーの集合。 */
  const memberKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const p of presets) for (const m of slotMembers(p)) s.add(presetSlotKey(m));
    return s;
  }, [presets]);

  /** どのグループにも属していない単独パーツ。 */
  const ungroupedSlots = useMemo(
    () => slots.filter((s) => !memberKeySet.has(presetSlotKey(s))),
    [slots, memberKeySet]
  );

  /** 代表メッシュ（埋め込み素材の読み取り用 EnumeratedSlot）を解決。 */
  const repSlotFor = useCallback((member: MaterialPresetMember): EnumeratedSlot => {
    const found = slots.find((s) => s.meshName === member.meshName && s.materialIndex === member.materialIndex);
    return found || { meshName: member.meshName || '', meshUuid: '', materialIndex: member.materialIndex, materialName: member.meshName || 'material' };
  }, [slots]);

  /** 編集リストの行（グループ preset → 単独パーツ の順）。 */
  type Row = { key: string; label: string; members: MaterialPresetMember[]; preset?: MaterialPresetSlot; repSlot: EnumeratedSlot; isGroup: boolean };
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of presets) {
      const members = slotMembers(p);
      out.push({ key: p.slotKey, label: p.label || '', members, preset: p, repSlot: repSlotFor(members[0]), isGroup: members.length > 1 });
    }
    for (const s of ungroupedSlots) {
      const member = { meshName: s.meshName || undefined, materialIndex: s.materialIndex };
      out.push({ key: presetSlotKey(s), label: '', members: [member], repSlot: s, isGroup: false });
    }
    return out;
  }, [presets, ungroupedSlots, repSlotFor]);

  const rowByKey = useMemo(() => {
    const m: Record<string, Row> = {};
    for (const r of rows) m[r.key] = r;
    return m;
  }, [rows]);

  // 編集 UI 用の分割。rows は presets → ungroupedSlots の順に組まれているので、
  // preset の有無だけで「登録済みの部位」と「未設定のパーツ」に分かれる。
  const registeredRows = useMemo(() => rows.filter((r) => !!r.preset), [rows]);
  const unregisteredRows = useMemo(() => rows.filter((r) => !r.preset), [rows]);

  /** 選択中の行に属する全メッシュ名（3D ハイライト用）。 */
  const highlightMeshNames = useMemo(() => {
    const names: string[] = [];
    for (const key of selectedKeys) {
      const r = rowByKey[key];
      if (!r) continue;
      for (const m of r.members) if (m.meshName) names.push(m.meshName);
    }
    return names;
  }, [selectedKeys, rowByKey]);

  /** クリックされたメッシュ名 → 所属する行キー。 */
  const rowKeyForMeshName = useCallback((meshName: string): string | null => {
    const g = presets.find((p) => slotMembers(p).some((m) => m.meshName === meshName));
    if (g) return g.slotKey;
    const s = slots.find((sl) => sl.meshName === meshName);
    return s ? presetSlotKey(s) : null;
  }, [presets, slots]);

  const toggleSelected = useCallback((key: string) => {
    setSelectedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }, []);

  const handlePick = useCallback((meshName: string) => {
    const key = rowKeyForMeshName(meshName);
    if (key) toggleSelected(key);
  }, [rowKeyForMeshName, toggleSelected]);

  // ── 外部（メイン）ビューアへの3Dプレビュー委譲の配線 ─────────────────────
  // ハンドラを ref 経由で親→ビューアへ渡し、プレビュー状態の変化を親へ通知する。
  useEffect(() => {
    if (!externalViewer || !pickHandlerRef) return;
    pickHandlerRef.current = handlePick;
    return () => { pickHandlerRef.current = null; };
  }, [externalViewer, pickHandlerRef, handlePick]);
  useEffect(() => {
    if (!externalViewer || !slotsHandlerRef) return;
    slotsHandlerRef.current = setSlots;
    return () => { slotsHandlerRef.current = null; };
  }, [externalViewer, slotsHandlerRef]);
  useEffect(() => {
    if (!externalViewer || !onPreviewState) return;
    onPreviewState({
      presets,
      selection,
      highlight: isEditing ? highlightMeshNames : [],
      pickable: isEditing,
    });
  }, [externalViewer, onPreviewState, presets, selection, isEditing, highlightMeshNames]);
  // アンマウント（タブ離脱）時はプレビューを解除して元の見た目へ戻す
  useEffect(() => {
    if (!externalViewer || !onPreviewState) return;
    return () => { onPreviewState(null); };
  }, [externalViewer, onPreviewState]);

  /** バリアントの selection から、グループ化で消える旧キーを新キーへ寄せる。 */
  const migrateVariantsForRegroup = useCallback((removedKeys: string[], newKey: string | null, optionIds: Set<string>) => {
    setVariants((prev) => {
      const next = prev.map((v) => {
        const sel = { ...v.selection };
        let chosen: string | undefined;
        for (const k of removedKeys) {
          if (sel[k] && !chosen && (!newKey || optionIds.has(sel[k]))) chosen = sel[k];
          delete sel[k];
        }
        if (newKey && chosen) sel[newKey] = chosen;
        return { ...v, selection: sel };
      });
      persistVariants(next);
      return next;
    });
  }, [persistVariants]);

  /** 選択中の複数行を1つのグループにまとめる。 */
  const groupSelected = useCallback(() => {
    if (selectedKeys.length < 2) return;
    const members: MaterialPresetMember[] = [];
    const mergedOptions: MaterialPresetOption[] = [];
    let label = '';
    const removedPresetKeys: string[] = [];
    for (const key of selectedKeys) {
      const preset = presets.find((p) => p.slotKey === key);
      if (preset) {
        removedPresetKeys.push(key);
        for (const m of slotMembers(preset)) members.push(m);
        for (const o of preset.options) mergedOptions.push(o);
        if (!label && preset.label) label = preset.label;
      } else {
        const slot = slots.find((s) => presetSlotKey(s) === key);
        if (slot) members.push({ meshName: slot.meshName || undefined, materialIndex: slot.materialIndex });
      }
    }
    // メンバー重複排除
    const seenM = new Set<string>();
    const dedupMembers = members.filter((m) => { const k = presetSlotKey(m); if (seenM.has(k)) return false; seenM.add(k); return true; });
    // オプション重複排除＋既定を1つに正規化
    const seenO = new Set<string>();
    const dedupOptions = mergedOptions.filter((o) => { if (seenO.has(o.id)) return false; seenO.add(o.id); return true; });
    let defaultSeen = false;
    for (let i = 0; i < dedupOptions.length; i++) {
      if (dedupOptions[i].isDefault) { if (defaultSeen) dedupOptions[i] = { ...dedupOptions[i], isDefault: false }; else defaultSeen = true; }
    }
    if (dedupOptions.length && !defaultSeen) dedupOptions[0] = { ...dedupOptions[0], isDefault: true };

    const newKey = crypto.randomUUID();
    const newGroup: MaterialPresetSlot = {
      slotKey: newKey,
      meshName: dedupMembers[0]?.meshName,
      materialIndex: dedupMembers[0]?.materialIndex ?? 0,
      members: dedupMembers,
      label,
      options: dedupOptions,
    };
    updatePresets([...presets.filter((p) => !removedPresetKeys.includes(p.slotKey)), newGroup]);

    // selection を新キーへ寄せる
    setSelection((sel) => {
      const ns = { ...sel };
      let chosen: string | undefined;
      for (const k of removedPresetKeys) { if (ns[k] && !chosen) chosen = ns[k]; delete ns[k]; }
      if (chosen && dedupOptions.some((o) => o.id === chosen)) ns[newKey] = chosen;
      return ns;
    });
    migrateVariantsForRegroup(removedPresetKeys, newKey, new Set(dedupOptions.map((o) => o.id)));
    setSelectedVariantId(null);
    setSelectedKeys([newKey]);
  }, [selectedKeys, presets, slots, updatePresets, migrateVariantsForRegroup]);

  /** グループを解除（preset を削除し、メンバーは単独パーツに戻る。登録素材は失われる）。 */
  const ungroupRow = useCallback((rowKey: string) => {
    updatePresets(presets.filter((p) => p.slotKey !== rowKey));
    setSelection((sel) => { const ns = { ...sel }; delete ns[rowKey]; return ns; });
    migrateVariantsForRegroup([rowKey], null, new Set());
    setSelectedKeys([]);
  }, [presets, updatePresets, migrateVariantsForRegroup]);

  /** 同じ素材（素材名 or baseColor）の単独パーツを自動でグループ化。 */
  const autoGroupBySameMaterial = useCallback(() => {
    const isGeneric = (n?: string) => !n || /^material(\s|$)/i.test(n) || /tripo_part_\d+_material/i.test(n);
    const sigOf = (s: EnumeratedSlot) =>
      (!isGeneric(s.materialName) ? `n:${s.materialName}` : (s.baseColor ? `c:${s.baseColor.toLowerCase()}` : '')) || '';
    const clusters = new Map<string, EnumeratedSlot[]>();
    for (const s of ungroupedSlots) {
      const sig = sigOf(s);
      if (!sig) continue;
      const arr = clusters.get(sig) || [];
      arr.push(s);
      clusters.set(sig, arr);
    }
    const newGroups: MaterialPresetSlot[] = [];
    for (const arr of clusters.values()) {
      if (arr.length < 2) continue;
      newGroups.push({
        slotKey: crypto.randomUUID(),
        meshName: arr[0].meshName || undefined,
        materialIndex: arr[0].materialIndex,
        members: arr.map((s) => ({ meshName: s.meshName || undefined, materialIndex: s.materialIndex })),
        label: '',
        options: [],
      });
    }
    if (!newGroups.length) return;
    updatePresets([...presets, ...newGroups]);
    setSelectedKeys([]);
  }, [ungroupedSlots, presets, updatePresets]);

  // ===== 家具まるごとのパターン（バリアント） =====

  /** 現在のプレビューの見た目を1パターンとして保存。
   *  併せてメインビューアの描画をサムネイル化して保存し、素材バリエーション・ギャラリーで使う。 */
  const saveCurrentAsVariant = useCallback(() => {
    const sel: Record<string, string> = {};
    for (const ps of presets) {
      const opt = resolveSelectedOption(ps, selection[ps.slotKey]);
      if (opt) sel[ps.slotKey] = opt.id;
    }
    const isFirst = variants.length === 0;
    const variant: MaterialVariant = {
      id: crypto.randomUUID(),
      title: `パターン${variants.length + 1}`,
      selection: sel,
      isDefault: isFirst,
    };
    const nextVariants = [...variants, variant];
    updateVariants(nextVariants);
    setSelectedVariantId(variant.id);

    // サムネイルは取得できなくても致命的ではない（ギャラリーは色スウォッチにフォールバック）。
    const dataUrl = captureThumb?.() ?? null;
    if (dataUrl && canonicalId) {
      uploadVariantThumb(canonicalId, variant.id, dataUrl).then((url) => {
        if (!url) return;
        setVariants((prev) => {
          const patched = prev.map((v) => v.id === variant.id ? { ...v, thumbUrl: url } : v);
          persistVariants(patched);
          return patched;
        });
      });
    }
  }, [presets, selection, variants, updateVariants, captureThumb, canonicalId, persistVariants]);

  // externalViewer 時、選択中パーツ数をビューア側（MaterialSection のアクションバー）へ通知する。
  // 依存はプリミティブの件数のみ。オブジェクトを毎レンダー作って渡すと無限再レンダーになる。
  useEffect(() => {
    if (!externalViewer || !onSelectionCountChange) return;
    onSelectionCountChange(selectedKeys.length);
  }, [externalViewer, onSelectionCountChange, selectedKeys.length]);

  // 「部位にする」ボタンの実行口。再レンダーを起こす必要がないので ref で渡す。
  useEffect(() => {
    if (!externalViewer || !groupSelectedRef) return;
    groupSelectedRef.current = groupSelected;
    return () => { groupSelectedRef.current = null; };
  }, [externalViewer, groupSelectedRef, groupSelected]);

  /** パターンを適用（家具全体を切替）。 */
  const applyVariant = useCallback((variant: MaterialVariant) => {
    setSelection(expandVariantSelection(presets, variant));
    setSelectedVariantId(variant.id);
  }, [presets]);

  // デフォルト（各部位の既定オプション＝元の見た目）に戻す
  const applyDefault = useCallback(() => {
    setSelection({});
    setSelectedVariantId(null);
  }, []);
  // デフォルト・スウォッチの代表色（最初の部位の既定オプション色）
  const defaultSwatch = useMemo(() => {
    for (const ps of presets) {
      const opt = resolveSelectedOption(ps, undefined);
      if (opt) return swatchColorOf(opt);
    }
    return '#9aa0a6';
  }, [presets]);

  const renameVariant = useCallback((id: string, title: string) => {
    setVariants((prev) => prev.map((v) => v.id === id ? { ...v, title } : v));
  }, []);
  const commitVariants = useCallback(() => { persistVariants(variants); }, [persistVariants, variants]);

  const removeVariant = useCallback((id: string) => {
    const next = variants.filter((v) => v.id !== id);
    if (next.length && !next.some((v) => v.isDefault)) next[0] = { ...next[0], isDefault: true };
    updateVariants(next);
    if (selectedVariantId === id) setSelectedVariantId(null);
  }, [variants, updateVariants, selectedVariantId]);

  const setDefaultVariant = useCallback((id: string) => {
    updateVariants(variants.map((v) => ({ ...v, isDefault: v.id === id })));
  }, [variants, updateVariants]);

  if (!glbUrl) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13 }}>このモデルには GLB がないためマテリアルを表示できません。</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', p: 2 }}>
      {/* プレビュー（externalViewer 時はメインビューアへ委譲し、Canvas を持たない）。
          操作ヒントもビューア側（MaterialSection）が重ねるため、ここでは何も描かない。 */}
      {externalViewer ? null : (
      <Box sx={{ flex: '1 1 320px', minWidth: 280, height: 340, bgcolor: 'var(--brand-bg)', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', position: 'relative', overflow: 'hidden' }}>
        {resolving || !resolvedUrl ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <Canvas shadows camera={{ position: [4, 4, 4], fov: 45 }}>
            <Suspense fallback={null}>
              <Stage environment={VIEWER_ENVIRONMENT} intensity={0.5} adjustCamera={1.3}>
                <PresetModel
                  key={selectionHash}
                  url={resolvedUrl}
                  presets={presets}
                  selection={selection}
                  highlight={isEditing ? highlightMeshNames : []}
                  pickable={isEditing}
                  onSlots={setSlots}
                  onPick={handlePick}
                />
              </Stage>
              <OrbitControls enablePan={false} makeDefault />
            </Suspense>
          </Canvas>
        )}
        {isEditing && (
          <Box sx={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: 'rgb(var(--brand-fg-rgb) / 0.75)' }}>
            <TouchAppRoundedIcon sx={{ fontSize: 13 }} />
            <Typography sx={{ fontSize: 10.5 }}>パーツをクリックして選択（複数選択でグループ化）</Typography>
          </Box>
        )}
      </Box>
      )}

      {/* 右ペイン */}
      <Box sx={{ flex: '1 1 360px', minWidth: 300 }}>
        {isEditing ? (
          /* ===== 作成者：エディター（部位ごとのスウォッチ行＋保存済みの組み合わせ） ===== */
          <MaterialEditor
            registeredRows={registeredRows}
            unregisteredRows={unregisteredRows}
            presets={presets}
            variants={variants}
            selection={selection}
            selectedKeys={selectedKeys}
            selectedVariantId={selectedVariantId}
            saving={saving}
            modelThumbUrl={model?.thumbnailUrl || model?.thumbnail || undefined}
            analyzing={slots.length === 0}
            canAutoGroup={ungroupedSlots.length >= 2}
            canSaveVariant={!presets.every((p) => p.options.length === 0)}
            onToggleRow={toggleSelected}
            onUngroupRow={ungroupRow}
            onAutoGroup={autoGroupBySameMaterial}
            onSetLabel={setLabel}
            onCommitLabel={commitLabel}
            onSelectOption={selectOption}
            onClearOption={clearOption}
            onSetDefaultOption={setDefaultOption}
            onRemoveOption={removeOption}
            onOpenPicker={(anchor, rowKey, repSlot) => setPicker({ anchor, rowKey, repSlot })}
            onSaveCurrentAsVariant={saveCurrentAsVariant}
            onApplyVariant={applyVariant}
            onApplyDefault={applyDefault}
            onRenameVariant={renameVariant}
            onCommitVariants={commitVariants}
            onSetDefaultVariant={setDefaultVariant}
            onRemoveVariant={removeVariant}
          />
        ) : (
          /* ===== 閲覧：パターン一括切替（デフォルト常設・パーツ単位は出さない） ===== */
          <>
            {/* ヘッダー：作成者は 編集/プレビュー 切替。編集側は MaterialSection の
                SECTION ヘッダーがあるため、この見出しは閲覧側だけに出す。 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>
                {section === 'variants' ? 'パターンを選択' : 'マテリアルを選択'}
              </Typography>
              {saving && <CircularProgress size={14} sx={{ color: ACCENT }} />}
              {isAuthor && !hideToggle && (
                <ToggleButtonGroup
                  size="small" exclusive value={mode}
                  onChange={(_e, v) => { if (v) setMode(v); }}
                  sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, fontSize: 11, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', '&.Mui-selected': { bgcolor: `${ACCENT}28`, color: 'var(--brand-fg)', borderColor: `${ACCENT}88` } } }}
                >
                  <ToggleButton value="edit"><EditRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />編集</ToggleButton>
                  <ToggleButton value="preview"><VisibilityRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />プレビュー</ToggleButton>
                </ToggleButtonGroup>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* 家具まるごとのパターン切替（デフォルトを必ず先頭に・パーツ単位は出さない） */}
                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(236,64,122,0.06)', border: `1px solid ${ACCENT}33` }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.85)', mb: 1 }}>パターン</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, width: 64 }}>
                      <Tooltip title="元の見た目">
                        <Box onClick={applyDefault} sx={{ cursor: 'pointer' }}>
                          <SwatchDot color={defaultSwatch} size={40} selected={selectedVariantId === null} />
                        </Box>
                      </Tooltip>
                      <Typography sx={{ fontSize: 10, color: selectedVariantId === null ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.5)', textAlign: 'center' }} noWrap>デフォルト</Typography>
                    </Box>
                    {variants.map((v) => {
                      const selected = selectedVariantId === v.id;
                      return (
                        <Box key={v.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, width: 64 }}>
                          <Tooltip title={v.title || ''}>
                            <Box onClick={() => applyVariant(v)} sx={{ cursor: 'pointer' }}>
                              <SwatchDot color={variantSwatchColor(presets, v)} size={40} selected={selected} />
                            </Box>
                          </Tooltip>
                          <Typography sx={{ fontSize: 10, color: selected ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.5)', textAlign: 'center', lineHeight: 1.2, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} noWrap>
                            {v.title || '—'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  {variants.length === 0 && (
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1 }}>他のパターンは未登録です（「編集」で各部位の素材を選び「現在の見た目を保存」）。</Typography>
                  )}
                </Box>
            </Box>
            {isAuthor && mode === 'preview' && (
              <Typography sx={{ fontSize: 11, color: 'light-dark(rgba(12,141,161,0.7), rgba(34,211,238,0.7))', mt: 1.5 }}>
                これは他ユーザーから見える表示です。「編集」に戻すと設定できます。
              </Typography>
            )}
          </>
        )}
      </Box>

      {/* 素材ピッカー（作成者のみ） */}
      <Menu anchorEl={picker?.anchor} open={!!picker} onClose={() => setPicker(null)}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 240, maxHeight: 360 } } }}>
        {picker && (
          <MenuItem onClick={() => addEmbedded(picker.rowKey, picker.repSlot)} sx={{ fontSize: 12, gap: 1 }}>
            <SwatchDot color={picker.repSlot.baseColor} size={16} /> この部位の埋め込み素材を追加
          </MenuItem>
        )}
        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
        {materials.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 12 }}>S.Material に素材がありません（公開 / Private）</MenuItem>
        ) : materials.map((m) => {
          const meta = DSMT_CATEGORY_META[m.category] || DSMT_CATEGORY_META.other;
          return (
            <MenuItem key={m.id} onClick={() => picker && addFromLibrary(picker.rowKey, picker.repSlot, m)} sx={{ fontSize: 12, gap: 1 }}>
              <SwatchDot color={m.params?.baseColor} size={16} />
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: 12 }} noWrap>{m.title || '無題'}</Typography></Box>
              <Chip label={meta.label} size="small" sx={{ height: 16, fontSize: 9, bgcolor: `color-mix(in srgb, ${meta.color} 13%, transparent)`, color: meta.color }} />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
