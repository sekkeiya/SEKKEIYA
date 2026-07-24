import React, { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage, Line, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { applyBindingToObject, enumerateMaterialSlots, type EnumeratedSlot } from '../../shared/material/applyMaterial';
import { applySelectionToObject, type MaterialPresetSlot } from '../../shared/material/materialPresets';
import { VIEWER_ENVIRONMENT } from '../viewerEnvironment';

/**
 * マテリアルタブ（DssMaterialPresets）の3Dプレビューをメインビューアへ委譲するための状態。
 * 詳細画面で Canvas を1つに集約し、GPU負荷を抑える。
 */
export interface MaterialPreviewState {
  presets: MaterialPresetSlot[];
  selection: Record<string, string>;
  /** ハイライトするメッシュ名（編集モードで選択中の行のメンバー）。 */
  highlight: string[];
  /** true ならメッシュクリックで部位選択できる（編集モード）。 */
  pickable: boolean;
}

function extractCanonicalId(url: string) {
  const match = url.match(/assets%2F([a-f0-9-]+)%2F/);
  if (match && match[1]) {
    return match[1];
  }
  return '';
}

export interface ViewerDimensions {
  width: number;
  depth: number;
  height: number;
}

const DIM_COLORS = {
  width: '#4fc3f7',
  depth: '#a5d6a7',
  height: '#facc15',
};

interface DimLineDef {
  key: 'W' | 'D' | 'H';
  value: number;
  color: string;
  start: [number, number, number];
  end: [number, number, number];
  ext: Array<{ from: [number, number, number]; to: [number, number, number] }>;
}

// バウンディングボックスに沿って W/D/H の寸法線+ラベルを描画する
const DimensionOverlay = ({ box, dims }: { box: THREE.Box3; dims: ViewerDimensions }) => {
  const lines = useMemo<DimLineDef[]>(() => {
    const size = box.getSize(new THREE.Vector3());
    const off = (Math.max(size.x, size.y, size.z) || 1) * 0.1;
    const { min, max } = box;
    return [
      {
        key: 'W',
        value: dims.width,
        color: DIM_COLORS.width,
        start: [min.x, min.y, max.z + off],
        end: [max.x, min.y, max.z + off],
        ext: [
          { from: [min.x, min.y, max.z], to: [min.x, min.y, max.z + off] },
          { from: [max.x, min.y, max.z], to: [max.x, min.y, max.z + off] },
        ],
      },
      {
        key: 'D',
        value: dims.depth,
        color: DIM_COLORS.depth,
        start: [max.x + off, min.y, min.z],
        end: [max.x + off, min.y, max.z],
        ext: [
          { from: [max.x, min.y, min.z], to: [max.x + off, min.y, min.z] },
          { from: [max.x, min.y, max.z], to: [max.x + off, min.y, max.z] },
        ],
      },
      {
        key: 'H',
        value: dims.height,
        color: DIM_COLORS.height,
        start: [max.x + off, min.y, max.z + off],
        end: [max.x + off, max.y, max.z + off],
        ext: [
          { from: [max.x, min.y, max.z], to: [max.x + off, min.y, max.z + off] },
          { from: [max.x, max.y, max.z], to: [max.x + off, max.y, max.z + off] },
        ],
      },
    ];
  }, [box, dims.width, dims.depth, dims.height]);

  return (
    <group>
      {lines.map((l) => {
        const mid: [number, number, number] = [
          (l.start[0] + l.end[0]) / 2,
          (l.start[1] + l.end[1]) / 2,
          (l.start[2] + l.end[2]) / 2,
        ];
        return (
          <group key={l.key}>
            <Line points={[l.start, l.end]} color={l.color} lineWidth={2} />
            {l.ext.map((e, i) => (
              <Line key={i} points={[e.from, e.to]} color={l.color} lineWidth={1} transparent opacity={0.35} />
            ))}
            <Html position={mid} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: 'rgb(var(--slate-panel-rgb) / 0.85)',
                  border: `1px solid ${l.color}`,
                  color: l.color,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontFamily: 'sans-serif',
                }}
              >
                {l.key} {Math.round(l.value).toLocaleString()}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

const HILITE_COLOR = '#22d3ee';

/**
 * 現在の描画内容を JPEG データURL として取り出す関数を親へ渡すブリッジ。
 * `preserveDrawingBuffer` を有効にすると常時わずかな描画コストが乗るため、
 * 代わりに「その場で1回描画してから即座に読み出す」方式にしている。
 * 描画直後は同フレーム内でバッファが残っているため、この順序なら取得できる。
 */
const CaptureBridge: React.FC<{
  captureRef: React.MutableRefObject<(() => string | null) | null>;
}> = ({ captureRef }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    captureRef.current = () => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/jpeg', 0.82);
      } catch {
        return null;
      }
    };
    return () => { captureRef.current = null; };
  }, [gl, scene, camera, captureRef]);
  return null;
};

const Model = ({
  url,
  targetDimensions,
  showDimensions,
  materialBindings,
  materialPreview,
  onMaterialPick,
  onMaterialSlots,
}: {
  url: string;
  targetDimensions?: ViewerDimensions | null;
  showDimensions?: boolean;
  materialBindings?: Array<{ meshName?: string; materialIndex?: number; material?: any }> | null;
  materialPreview?: MaterialPreviewState | null;
  onMaterialPick?: (meshName: string) => void;
  onMaterialSlots?: (slots: EnumeratedSlot[]) => void;
}) => {
  const { scene } = useGLTF(url);

  // useGLTF はURLごとにsceneをキャッシュ共有するため、複数Canvas表示やスケール適用で
  // キャッシュを汚さないようクローンして使う。
  // 元のGLB素材も保存し、マテリアルプレビュー解除で完全に復元できるようにする。
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o: any) => { if (o.isMesh && o.userData.__origMat === undefined) o.userData.__origMat = o.material; });
    return c;
  }, [scene]);

  // マテリアルタブ用: 部位スロットを列挙して親（DssMaterialPresets）へ通知。
  // タブ再訪時は cloned が変わらないため、プレビュー有効化のタイミングでも再通知する。
  const previewActive = !!materialPreview;
  useEffect(() => {
    if (!onMaterialSlots) return;
    onMaterialSlots(enumerateMaterialSlots(cloned));
  }, [cloned, onMaterialSlots, previewActive]);

  // マテリアルプレビュー（選択中の素材）を適用。未選択部位は元のGLB素材へ復元してから適用。
  // プレビュー解除（タブ離脱）時は元の見た目へ戻す。
  useEffect(() => {
    cloned.traverse((o: any) => { if (o.isMesh && o.userData.__origMat !== undefined) o.material = o.userData.__origMat; });
    if (materialPreview) {
      applySelectionToObject(cloned, materialPreview.presets, materialPreview.selection).catch(() => {});
    }
  }, [cloned, materialPreview]);

  // マテリアル上書き（バインディング）を適用
  useEffect(() => {
    const slots = Array.isArray(materialBindings) ? materialBindings.filter((b) => b && b.material) : [];
    if (!slots.length) return;
    applyBindingToObject(cloned, { id: '', targetType: 'model', modelId: '', slots } as any).catch(() => {});
  }, [cloned, materialBindings]);

  // 選択部位のハイライト枠（BoxHelper）。
  // Stage が子要素にスケール/センタリング変換を掛けるため、group 内に置くと変換が二重適用されて
  // ずれる。シーン直下に追加し、毎フレーム update して Stage のスケール後も追従させる。
  const rootScene = useThree((s) => s.scene);
  const helpersRef = useRef<THREE.BoxHelper[]>([]);
  const highlightKey = (materialPreview?.highlight || []).join('|');
  useEffect(() => {
    const names = highlightKey ? highlightKey.split('|') : [];
    if (!names.length) return;
    const helpers: THREE.BoxHelper[] = [];
    for (const name of names) {
      let target: any = null;
      cloned.traverse((m: any) => { if (!target && m.isMesh && (m.name || '') === name) target = m; });
      if (!target) continue;
      const h = new THREE.BoxHelper(target, new THREE.Color(HILITE_COLOR));
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

  // 編集モード時のみメッシュクリックで部位選択
  const pickable = !!materialPreview?.pickable;
  const handleClick = useCallback((e: any) => {
    if (!pickable || !onMaterialPick) return;
    e.stopPropagation();
    if (e.object?.isMesh) onMaterialPick(e.object.name || '');
  }, [pickable, onMaterialPick]);

  // 素（スケール適用前）のバウンディングボックス。
  // <primitive object={cloned} scale={scale}> は cloned.scale を直接書き換えるため、
  // 計測前に必ず scale=1 へ戻してから測る。これをしないと、寸法変更で再計測したときに
  // 「前回スケール済みのサイズ」を基準にしてしまい、寸法とモデルサイズがずれる
  // （Back→再表示で直るのは cloned が作り直されて scale=1 から測れるため）。
  const baseBox = useMemo(() => {
    cloned.scale.set(1, 1, 1);
    cloned.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(cloned);
  }, [cloned]);

  const { scale, scaledBox, displayDims } = useMemo(() => {
    const size = baseBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // extractDimensionsFromGlb と同じ単位判定: 20未満なら m 単位、それ以外は mm とみなす
    const mmPerUnit = maxDim > 0 && maxDim < 20 ? 1000 : 1;

    const tw = Number(targetDimensions?.width) || 0;
    const td = Number(targetDimensions?.depth) || 0;
    const th = Number(targetDimensions?.height) || 0;

    const sx = tw > 0 && size.x > 0 ? tw / mmPerUnit / size.x : 1;
    const sz = td > 0 && size.z > 0 ? td / mmPerUnit / size.z : 1;
    const sy = th > 0 && size.y > 0 ? th / mmPerUnit / size.y : 1;

    const scaledBox = new THREE.Box3(
      new THREE.Vector3(baseBox.min.x * sx, baseBox.min.y * sy, baseBox.min.z * sz),
      new THREE.Vector3(baseBox.max.x * sx, baseBox.max.y * sy, baseBox.max.z * sz)
    );
    const displayDims: ViewerDimensions = {
      width: tw > 0 ? tw : size.x * mmPerUnit,
      depth: td > 0 ? td : size.z * mmPerUnit,
      height: th > 0 ? th : size.y * mmPerUnit,
    };
    return { scale: [sx, sy, sz] as [number, number, number], scaledBox, displayDims };
  }, [baseBox, targetDimensions?.width, targetDimensions?.depth, targetDimensions?.height]);

  return (
    <group>
      <primitive object={cloned} scale={scale} onClick={handleClick} />
      {showDimensions && <DimensionOverlay box={scaledBox} dims={displayDims} />}
    </group>
  );
};

interface RightPanelModelViewerProps {
  modelUrl: string;
  versionId?: number | string;
  /** mm 単位の目標寸法。指定するとモデルをこの寸法に合わせてスケール表示する */
  targetDimensions?: ViewerDimensions | null;
  /** true で W/D/H の寸法線をモデル周囲に表示する */
  showDimensions?: boolean;
  /** マテリアル上書き（[{meshName, materialIndex, material(snapshot)}]）。プレビューに反映。 */
  materialBindings?: Array<{ meshName?: string; materialIndex?: number; material?: any }> | null;
  /** マテリアルタブのプレビューを本ビューアへ委譲する場合の状態（詳細画面のCanvas集約用）。 */
  materialPreview?: MaterialPreviewState | null;
  /** materialPreview.pickable 時、クリックされたメッシュ名を通知。 */
  onMaterialPick?: (meshName: string) => void;
  /** モデルロード時に部位スロット一覧を通知（マテリアルタブの編集UI用）。 */
  onMaterialSlots?: (slots: EnumeratedSlot[]) => void;
  /** 渡すと、現在の描画をJPEGデータURLで取り出す関数がここに入る（素材パターンのサムネ生成用）。 */
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
  /** GLBの読み込み中に表示する画像（通常はサムネイル）。ビューアが空白になるのを防ぐ。 */
  placeholderImageUrl?: string;
  /**
   * GLB の取得を開始するまでの待ち時間(ms)。
   * 一覧をクリックで見て回るときに、選択が変わるたび即ダウンロードを始めると
   * 大量の取得が積み上がって重くなる。少し待てば「通り過ぎただけ」の選択を捨てられる。
   */
  loadDelayMs?: number;
}

export const RightPanelModelViewer: React.FC<RightPanelModelViewerProps> = ({ modelUrl, versionId, targetDimensions, showDimensions, materialBindings, materialPreview, onMaterialPick, onMaterialSlots, captureRef, placeholderImageUrl, loadDelayMs = 0 }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isCaching, setIsCaching] = useState(false);

  useEffect(() => {
    if (!modelUrl) {
      setResolvedUrl('');
      return;
    }

    const canonicalId = extractCanonicalId(modelUrl);
    if (!canonicalId || !modelUrl.includes('firebasestorage')) {
      // If it's not a standard Firebase Storage URL we can parse, just use it directly
      setResolvedUrl(modelUrl);
      return;
    }

    let isMounted = true;
    setIsCaching(true);

    const cacheAndResolve = async () => {
      try {
        const cacheKey = versionId ? `${canonicalId}_v${versionId}` : canonicalId;
        // ensure_model_cached はローカルパスを返すのでそのまま使う（IPC 1往復）
        const filePath = await invoke<string>('ensure_model_cached', {
          modelId: cacheKey,
          model_id: canonicalId,
          ext: 'glb',
          downloadUrl: modelUrl
        });

        if (!isMounted) return;

        if (filePath) {
          // Normalizing Windows backslashes to forward slashes is critical for asset.localhost bypassing 403
          const normalizedPath = filePath.replace(/\\/g, '/');
          setResolvedUrl(convertFileSrc(normalizedPath));
        } else {
          setResolvedUrl(modelUrl);
        }
      } catch (err) {
        console.error('[RightPanelModelViewer] Failed to securely cache GLB:', err);
        if (isMounted) setResolvedUrl(modelUrl); // fallback
      } finally {
        if (isMounted) setIsCaching(false);
      }
    };

    // loadDelayMs が指定されていれば少し待ってから取得を始める。待っている間に
    // 選択が変わればこの effect は破棄されるので、通り過ぎただけのモデルは取得しない。
    const timer = setTimeout(cacheAndResolve, loadDelayMs);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [modelUrl, versionId, loadDelayMs]);

  // ホイールでのズームは「一度ビューアをクリックしてから」有効にする。
  // そうしないと、画面を開いた直後にスクロールしたときページではなく3Dが拡大縮小してしまい、
  // ユーザーの操作イメージと食い違う。ドラッグ回転はページ操作と競合しないので常時有効。
  const [zoomEnabled, setZoomEnabled] = useState(false);
  // モデルが切り替わったら未操作状態に戻す
  useEffect(() => { setZoomEnabled(false); }, [modelUrl]);

  return (
    <Box
      onPointerDown={() => setZoomEnabled(true)}
      sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1.5, overflow: 'hidden' }}
    >
      {/* GLB のキャッシュ解決を待たずに Canvas を先にマウントし、
          WebGL 初期化と環境マップ(ローカルHDR)のロードをダウンロードと並行して進める。
          Stage は子が空だとカメラフィットが壊れるためモデル準備後にマウントし、
          environment={null} で Environment の二重ロードを避ける。 */}
      <Canvas shadows camera={{ position: [5, 5, 5], fov: 45 }}>
        <Suspense fallback={null}>
          <Environment files={VIEWER_ENVIRONMENT.files} />
          {captureRef && <CaptureBridge captureRef={captureRef} />}
          {resolvedUrl && !isCaching && (
            <Stage environment={null} intensity={0.5} adjustCamera={1.3}>
              <Model
                url={resolvedUrl}
                targetDimensions={targetDimensions}
                showDimensions={showDimensions}
                materialBindings={materialBindings}
                materialPreview={materialPreview}
                onMaterialPick={onMaterialPick}
                onMaterialSlots={onMaterialSlots}
              />
            </Stage>
          )}
          <OrbitControls
             autoRotate={!showDimensions && !materialPreview?.pickable}
             autoRotateSpeed={1.5}
             enablePan={false}
             enableZoom={zoomEnabled}
             makeDefault
          />
        </Suspense>
      </Canvas>
      {(isCaching || !resolvedUrl) && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {/* 読み込み中はサムネイルをつなぎに出す（真っ暗な待ち時間を作らない）。 */}
          {placeholderImageUrl && (
            <Box
              component="img"
              src={placeholderImageUrl}
              alt=""
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.55 }}
            />
          )}
          <CircularProgress sx={{ position: 'relative' }} />
        </Box>
      )}
      {/* 未操作のうちはホイールがページスクロールに流れる。その理由が分かるよう控えめに示す。 */}
      {!zoomEnabled && !isCaching && resolvedUrl && (
        <Box sx={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          px: 1.25, py: 0.4, borderRadius: 999, pointerEvents: 'none',
          bgcolor: 'rgba(0,0,0,0.5)', color: 'rgb(var(--brand-fg-rgb) / 0.75)',
          fontSize: 10.5, whiteSpace: 'nowrap',
        }}>
          クリックすると拡大縮小できます
        </Box>
      )}
    </Box>
  );
};
