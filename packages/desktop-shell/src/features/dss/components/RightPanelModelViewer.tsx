import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getModelLocalPathCached } from '../../../lib/modelLocalPathCache';
import { applyBindingToObject } from '../../shared/material/applyMaterial';

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
                  background: 'rgba(15,23,42,0.85)',
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

const Model = ({
  url,
  targetDimensions,
  showDimensions,
  materialBindings,
}: {
  url: string;
  targetDimensions?: ViewerDimensions | null;
  showDimensions?: boolean;
  materialBindings?: Array<{ meshName?: string; materialIndex?: number; material?: any }> | null;
}) => {
  const { scene } = useGLTF(url);

  // useGLTF はURLごとにsceneをキャッシュ共有するため、複数Canvas表示やスケール適用で
  // キャッシュを汚さないようクローンして使う
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // マテリアル上書き（バインディング）を適用
  useEffect(() => {
    const slots = Array.isArray(materialBindings) ? materialBindings.filter((b) => b && b.material) : [];
    if (!slots.length) return;
    applyBindingToObject(cloned, { id: '', targetType: 'model', modelId: '', slots } as any).catch(() => {});
  }, [cloned, materialBindings]);

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
      <primitive object={cloned} scale={scale} />
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
}

export const RightPanelModelViewer: React.FC<RightPanelModelViewerProps> = ({ modelUrl, versionId, targetDimensions, showDimensions, materialBindings }) => {
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
        await invoke('ensure_model_cached', {
          modelId: cacheKey,
          model_id: canonicalId,
          ext: 'glb',
          downloadUrl: modelUrl
        });
        const filePath = await getModelLocalPathCached(cacheKey, 'glb');

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

    cacheAndResolve();

    return () => { isMounted = false; };
  }, [modelUrl, versionId]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1.5, overflow: 'hidden' }}>
      {isCaching || !resolvedUrl ? (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Canvas shadows camera={{ position: [5, 5, 5], fov: 45 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.5} adjustCamera={1.3}>
              <Model url={resolvedUrl} targetDimensions={targetDimensions} showDimensions={showDimensions} materialBindings={materialBindings} />
            </Stage>
            <OrbitControls
               autoRotate={!showDimensions}
               autoRotateSpeed={1.5}
               enablePan={false}
               enableZoom={true}
               makeDefault
            />
          </Suspense>
        </Canvas>
      )}
    </Box>
  );
};
