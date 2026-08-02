import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, FC, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF, View, OrbitControls, Stage, Line, Html, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { enumerateMaterialSlots } from '../../../shared/material/applyMaterial';
import type { EnumeratedSlot } from '../../../shared/material/applyMaterial';
import { applySelectionToObject, type MaterialPreviewState } from '../../../shared/material/materialPresets';
import { VIEWER_ENVIRONMENT } from '../../viewerEnvironment';
import { GimmickPlayback } from './GimmickPlayback';
import type { GimmickPlaybackController } from './GimmickPlayback';
import type { LoopAnimSpec } from '../../../shared/walkthrough/loopAnim';

/** mm 単位の目標寸法。RightPanelModelViewer の ViewerDimensions と同義（詳細画面 View 版）。 */
export interface DetailViewportDimensions {
  width: number;
  depth: number;
  height: number;
  /**
   * GLB の向きの補正（Y 軸回りの度数、0/90/180/270）。
   * 寸法は軸ごとに厳密スケールされるため、GLB が 90° 倒れてモデリングされていると
   * W と D の登録値を正しく直した瞬間にモデルが引き伸ばされてしまう。この角度で
   * 先にモデルを回してから測る/スケールすることで、形を崩さずに W/D を正せる。
   */
  yawDeg?: number;
}

/**
 * アニメセクション（セクション4）向け: ギミック（ヒンジ/スライド/クリップ）＋常時アニメを
 * この View 内で駆動する。渡すと、クリックでモデル全体の onPick が呼ばれ、
 * モデル以外をクリック（ミス）すると onMissed が呼ばれる。詳しい駆動ロジックは GimmickPlayback 側。
 */
export interface DetailViewportAnimProps {
  gimmicks: any[];
  anim?: LoopAnimSpec | null;
  /** false の間はギミック/常時アニメの毎フレーム更新を止める（セクションが画面外のときなど）。 */
  enabled?: boolean;
  onReady: (ctls: GimmickPlaybackController[]) => void;
  onToggle: (id: string, open: boolean) => void;
  onPick: () => void;
  onMissed?: () => void;
}

export interface DetailViewportProps {
  /** 表示する GLB の URL。null の間は View を作らず placeholderUrl にフォールバックする。 */
  glbUrl: string | null;
  /** glbUrl が null、または読み込み中（Suspense）に表示する画像。 */
  placeholderUrl?: string;
  /** このセクションの高さ（幅は常に 100%）。 */
  height: number | string;
  /** 指定するとモデルをこの mm 寸法に合わせてスケール表示する。 */
  targetDimensions?: DetailViewportDimensions | null;
  /** true で W/D/H の寸法線をモデル周囲に表示する。 */
  showDimensions?: boolean;
  /** マテリアルタブのプレビュー状態。presets/selection を適用し、highlight を枠線表示、pickable でクリック選択を有効化する。 */
  materialPreview?: MaterialPreviewState | null;
  /** materialPreview.pickable が true のときのみ、クリックされたメッシュ名を通知する。 */
  onMeshClick?: (meshName: string) => void;
  /** モデルロード時に部位スロット一覧を通知する（マテリアル編集UI用）。 */
  onSlots?: (slots: EnumeratedSlot[]) => void;
  /** アニメセクション用: ギミック/常時アニメを駆動する（セクション4のみ使用）。 */
  animProps?: DetailViewportAnimProps | null;
  /** 渡すと、現在の描画を JPEG データURLで取り出す関数がここに入る。 */
  captureRef?: MutableRefObject<(() => string | null) | null>;
  /** このビューが描画するフレーム数の上限（静的表示向け）。省略時は毎フレーム描画。 */
  frames?: number;
  /**
   * OrbitControls のホイールズームを有効にするか。省略時は true（常時有効）。
   * ページのスクロールコンテナ内にビューポートが並ぶ構成（詳細画面など）では、
   * 呼び出し側が「クリックするまで false」というゲートを掛けることを想定している
   * （RightPanelModelViewer と同じ考え方）。ドラッグ回転はページ操作と競合しないため常時有効のまま。
   */
  enableZoom?: boolean;
  className?: string;
  style?: CSSProperties;
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

// RightPanelModelViewer の DimensionOverlay と同じ考え方（写経）:
// バウンディングボックスに沿って W/D/H の寸法線 + ラベルを描画する。
const DimensionOverlay: FC<{ box: THREE.Box3; dims: DetailViewportDimensions }> = ({ box, dims }) => {
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

function isMeshObject(obj: THREE.Object3D): obj is THREE.Mesh {
  return (obj as THREE.Mesh).isMesh === true;
}

/**
 * 現在の描画内容を JPEG データURL として取り出す関数を親へ渡すブリッジ（CaptureBridge 方式）。
 * RightPanelModelViewer と同じ理由で `preserveDrawingBuffer` は使わず、
 * 「その場で1回描画してから同フレーム内で即座に読み出す」方式にしている。
 *
 * 複数の View が同じ共有 Canvas 上に同居するため、この View の矩形だけを正しく
 * 切り出す必要がある（過去の TODO を解消）。drei の View 内部実装
 * （`@react-three/drei/web/View.js` の `prepareSkissor`/`computeContainerPosition`）と
 * 同じ考え方で: (1) この View 専用にレンダラーの viewport/scissor をこの View の矩形
 * だけへ限定してから描画し、(2) 描画後の Canvas から、その矩形部分だけを 2D キャンバスへ
 * `drawImage` で切り出す。viewport/scissor は CSS px 単位で渡す（three.js 側が内部で
 * pixelRatio を掛けて実際の drawingBuffer 座標へ変換する）のに対し、`drawImage` で
 * 読み出す側は drawingBuffer の実ピクセル単位が必要なので、そちらだけ pixelRatio を
 * 掛けて変換する。
 */
const CaptureBridge: FC<{ captureRef: MutableRefObject<(() => string | null) | null> }> = ({ captureRef }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // ポータル内（＝この View 専用）のローカル size。drei View が
  // `track.current.getBoundingClientRect()` をそのまま渡しているため、
  // ページ座標系（ビューポート基準）の {width,height,top,left} になる。
  const size = useThree((s) => s.size);
  useEffect(() => {
    captureRef.current = () => {
      try {
        const canvasEl = gl.domElement;
        if (!size?.width || !size?.height) return null;
        const canvasRect = canvasEl.getBoundingClientRect();
        // この View のページ座標系矩形 → 共有 Canvas 基準の CSS px 座標へ変換。
        const leftCss = (size.left ?? canvasRect.left) - canvasRect.left;
        const topCss = (size.top ?? canvasRect.top) - canvasRect.top;
        const widthCss = size.width;
        const heightCss = size.height;
        // WebGL のビューポート/シザーは左下原点。
        const bottomCss = canvasRect.height - (topCss + heightCss);

        const prevAutoClear = gl.autoClear;
        gl.autoClear = false;
        gl.setScissorTest(true);
        gl.setScissor(leftCss, bottomCss, widthCss, heightCss);
        gl.setViewport(leftCss, bottomCss, widthCss, heightCss);
        gl.render(scene, camera);
        gl.setScissorTest(false);
        gl.autoClear = prevAutoClear;

        // 上で描画した領域だけを、実ピクセル単位（pixelRatio 込み）に変換して切り出す。
        const dpr = gl.getPixelRatio ? gl.getPixelRatio() : (window.devicePixelRatio || 1);
        const sx = Math.max(0, Math.round(leftCss * dpr));
        const sy = Math.max(0, Math.round(topCss * dpr));
        const sw = Math.max(1, Math.round(widthCss * dpr));
        const sh = Math.max(1, Math.round(heightCss * dpr));

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(canvasEl, sx, sy, sw, sh, 0, 0, sw, sh);
        return cropCanvas.toDataURL('image/jpeg', 0.85);
      } catch {
        return null;
      }
    };
    return () => { captureRef.current = null; };
  }, [gl, scene, camera, size, captureRef]);
  return null;
};

interface ViewportModelProps {
  url: string;
  targetDimensions?: DetailViewportDimensions | null;
  showDimensions?: boolean;
  materialPreview?: MaterialPreviewState | null;
  onMeshClick?: (meshName: string) => void;
  onSlots?: (slots: EnumeratedSlot[]) => void;
  animProps?: DetailViewportAnimProps | null;
}

const ViewportModel: FC<ViewportModelProps> = ({
  url,
  targetDimensions,
  showDimensions,
  materialPreview,
  onMeshClick,
  onSlots,
  animProps,
}) => {
  // animations: ギミック(GimmickPlayback)がクリップ再生に使う。materialPreview 等と違い
  // クローン不要（アニメは階層のtransform/AnimationMixerを動かすだけで、マテリアルには触れない）。
  const { scene, animations } = useGLTF(url) as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

  // このビュー専用のクローン。useGLTF は URL 単位でシーンをキャッシュ共有するため、
  // クローンせずに使うと、同じ glbUrl を表示する複数の DetailViewport 間でスケールや
  // マテリアル差し替えが漏れ合ってしまう。マウント時（scene が変わったとき）に1回だけ実行し、
  // 毎フレームの複製は絶対に行わない。
  //
  // Object3D.clone(true) は階層のみ複製し、material/geometry は参照共有のままになる
  // （three.js の仕様）。マテリアル編集（materialPreview）やクリック選択（onMeshClick）を
  // 使うビューでは、素材の差し替え・復元が共有GLTFキャッシュや他ビューへ影響しないよう
  // マテリアルも複製する。
  // 常時アニメ（LoopAnimator）専用の親 group。animProps があるとき（＝アニメセクション）だけ
  // clonedScene をこの group で包み、LoopAnimator にはこちら（親）を渡す。ギミック
  // （ヒンジ/スライド）は clonedScene 側（子）を書き換えるため、常時アニメと同一 Object3D を
  // 取り合わない ——DssWalkthroughViewer の animRef group と同じ「親子分離」の構造
  // （GimmickPlayback.tsx の GimmickPlaybackProps.animGroupRef コメント参照）。
  const animGroupRef = useRef<THREE.Group>(null);

  const needsMaterialClone = !!materialPreview || !!onMeshClick;
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);
    if (needsMaterialClone) {
      cloned.traverse((obj) => {
        if (!isMeshObject(obj)) return;
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((m) => m.clone());
        } else if (obj.material) {
          obj.material = obj.material.clone();
        }
      });
    }
    return cloned;
  }, [scene, needsMaterialClone]);

  // このビュー専用に複製したマテリアル（＝上の useMemo で material.clone() したもの）だけを
  // 破棄する。scene.clone(true) 自体はジオメトリを共有参照のまま複製するため、ジオメトリや
  // useGLTF の共有キャッシュ由来のマテリアルには絶対に触れない（触ると他ビュー/再訪時に破損する）。
  // clonedScene が差し替わる（＝新しいクローンに置き換わる）ときと、このビューがアンマウントされる
  // ときの両方で、直前のクローン一式を確実に dispose する（BoxHelper の dispose と同じパターン）。
  useEffect(() => {
    if (!needsMaterialClone) return;
    const clonedMaterials: THREE.Material[] = [];
    clonedScene.traverse((obj) => {
      if (!isMeshObject(obj)) return;
      if (Array.isArray(obj.material)) clonedMaterials.push(...obj.material);
      else if (obj.material) clonedMaterials.push(obj.material);
    });
    return () => {
      for (const m of clonedMaterials) m.dispose();
    };
  }, [clonedScene, needsMaterialClone]);

  // 元のGLB素材（このビュー専用クローン後の素材）を保存し、
  // materialPreview 解除時に元の見た目へ完全に復元できるようにする。
  useEffect(() => {
    clonedScene.traverse((obj) => {
      if (!isMeshObject(obj)) return;
      if (obj.userData.__origMat === undefined) obj.userData.__origMat = obj.material;
    });
  }, [clonedScene]);

  // マテリアル編集UI向け: 部位スロット一覧を通知する。
  // タブ再訪時は clonedScene が変わらないため、プレビュー有効化のタイミングでも再通知する。
  const previewActive = !!materialPreview;
  useEffect(() => {
    if (!onSlots) return;
    onSlots(enumerateMaterialSlots(clonedScene));
  }, [clonedScene, onSlots, previewActive]);

  // マテリアルプレビュー（選択中の素材）を適用。未選択部位は元のGLB素材へ復元してから適用する。
  useEffect(() => {
    clonedScene.traverse((obj) => {
      if (!isMeshObject(obj)) return;
      if (obj.userData.__origMat !== undefined) obj.material = obj.userData.__origMat;
    });
    if (materialPreview) {
      applySelectionToObject(clonedScene, materialPreview.presets, materialPreview.selection).catch(() => {});
    }
  }, [clonedScene, materialPreview]);

  // 選択部位のハイライト枠（BoxHelper）。
  // useThree().scene はこの View 専用の（portal で分離された）シーンを指すため、
  // ここへ追加するだけで他ビューへ漏れることなく毎フレーム追従できる。
  const viewScene = useThree((s) => s.scene);
  const helpersRef = useRef<THREE.BoxHelper[]>([]);
  const highlightKey = (materialPreview?.highlight || []).join('|');
  useEffect(() => {
    const names = highlightKey ? highlightKey.split('|') : [];
    if (!names.length) return;
    const helpers: THREE.BoxHelper[] = [];
    for (const name of names) {
      let target: THREE.Mesh | null = null;
      clonedScene.traverse((m) => { if (!target && isMeshObject(m) && (m.name || '') === name) target = m; });
      if (!target) continue;
      const h = new THREE.BoxHelper(target, new THREE.Color(HILITE_COLOR));
      h.material.depthTest = false;
      h.material.transparent = true;
      h.renderOrder = 9999;
      viewScene.add(h);
      helpers.push(h);
    }
    helpersRef.current = helpers;
    return () => {
      for (const h of helpers) {
        viewScene.remove(h);
        h.geometry.dispose();
        h.material.dispose();
      }
      helpersRef.current = [];
    };
  }, [clonedScene, highlightKey, viewScene]);
  useFrame(() => { for (const h of helpersRef.current) h.update(); });

  // materialPreview.pickable が true のときのみメッシュクリックで部位選択できる
  // （RightPanelModelViewer と同じ意味づけ）。
  const pickable = !!materialPreview?.pickable;
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (pickable && onMeshClick) {
      e.stopPropagation();
      if (isMeshObject(e.object)) onMeshClick(e.object.name || '');
      return;
    }
    // マテリアル選択が無効なビューでは、モデルクリックはギミック操作アイコンの表示トリガー
    // （DssWalkthroughViewer と同じ「クリックで開示」体験。セクション4のみ animProps を渡す）。
    if (animProps) {
      e.stopPropagation();
      animProps.onPick();
    }
  }, [pickable, onMeshClick, animProps]);

  // 素（スケール適用前）のバウンディングボックス。
  // <primitive object={clonedScene} scale={scale}> は clonedScene.scale を直接書き換えるため、
  // 計測前に必ず scale=1 へ戻してから測る。
  const baseBox = useMemo(() => {
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(clonedScene);
  }, [clonedScene]);

  const { scale, scaledBox, displayDims, yawRad } = useMemo(() => {
    const size = baseBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // extractDimensionsFromGlb と同じ単位判定: 20未満なら m 単位、それ以外は mm とみなす
    const mmPerUnit = maxDim > 0 && maxDim < 20 ? 1000 : 1;

    const tw = Number(targetDimensions?.width) || 0;
    const td = Number(targetDimensions?.depth) || 0;
    const th = Number(targetDimensions?.height) || 0;

    // 向き補正。90/270 のときはワールド X/Z に来る辺が入れ替わるので、
    // スケールは「回した後の辺」に対して計算する。
    const yaw = (((Number(targetDimensions?.yawDeg) || 0) % 360) + 360) % 360;
    const swapped = yaw === 90 || yaw === 270;
    const extX = swapped ? size.z : size.x;
    const extZ = swapped ? size.x : size.z;

    const sx = tw > 0 && extX > 0 ? tw / mmPerUnit / extX : 1;
    const sz = td > 0 && extZ > 0 ? td / mmPerUnit / extZ : 1;
    const sy = th > 0 && size.y > 0 ? th / mmPerUnit / size.y : 1;

    // 寸法線用の箱。回転時は回した後のワールド範囲を中心対称で作る（Stage が
    // どのみち中央寄せするため、元の非対称オフセットは寸法線の見た目に影響しない）。
    const scaledBox = swapped
      ? new THREE.Box3(
        new THREE.Vector3(-extX * sx / 2, baseBox.min.y * sy, -extZ * sz / 2),
        new THREE.Vector3(extX * sx / 2, baseBox.max.y * sy, extZ * sz / 2)
      )
      : new THREE.Box3(
        new THREE.Vector3(baseBox.min.x * sx, baseBox.min.y * sy, baseBox.min.z * sz),
        new THREE.Vector3(baseBox.max.x * sx, baseBox.max.y * sy, baseBox.max.z * sz)
      );
    const displayDims: DetailViewportDimensions = {
      width: tw > 0 ? tw : extX * mmPerUnit,
      depth: td > 0 ? td : extZ * mmPerUnit,
      height: th > 0 ? th : size.y * mmPerUnit,
    };
    return {
      scale: [sx, sy, sz] as [number, number, number],
      scaledBox,
      displayDims,
      yawRad: (yaw * Math.PI) / 180,
    };
  }, [baseBox, targetDimensions?.width, targetDimensions?.depth, targetDimensions?.height, targetDimensions?.yawDeg]);

  return (
    <group onPointerMissed={animProps ? () => animProps.onMissed?.() : undefined}>
      {/* スケールは向き補正の回転より「外側」の group に置く。three.js は自分の行列を
          T*R*S の順で組むため、同じオブジェクトに rotation と scale を持たせると
          スケールがモデル固有の軸に効いてしまい、回した後のワールド X/Z に合わない。
          外側 group に S、内側 group に R を分けることで S(R(model)) の順になる。 */}
      {animProps ? (
        // animGroupRef は identity transform のまま始まり、LoopAnimator が有効なときだけ
        // position/rotation を書き込む。
        <group ref={animGroupRef}>
          <group scale={scale}>
            <group rotation={[0, yawRad, 0]}>
              <primitive object={clonedScene} onClick={handleClick} />
            </group>
          </group>
        </group>
      ) : (
        <group scale={scale}>
          <group rotation={[0, yawRad, 0]}>
            <primitive object={clonedScene} onClick={handleClick} />
          </group>
        </group>
      )}
      {showDimensions && <DimensionOverlay box={scaledBox} dims={displayDims} />}
      {animProps && (
        <GimmickPlayback
          target={clonedScene}
          animGroupRef={animGroupRef}
          animations={animations || []}
          gimmicks={animProps.gimmicks}
          anim={animProps.anim}
          enabled={animProps.enabled}
          onReady={animProps.onReady}
          onToggle={animProps.onToggle}
        />
      )}
    </group>
  );
};

interface ViewportContentProps {
  glbUrl: string;
  targetDimensions?: DetailViewportDimensions | null;
  showDimensions?: boolean;
  materialPreview?: MaterialPreviewState | null;
  onMeshClick?: (meshName: string) => void;
  onSlots?: (slots: EnumeratedSlot[]) => void;
  captureRef?: MutableRefObject<(() => string | null) | null>;
  frames?: number;
  enableZoom?: boolean;
  animProps?: DetailViewportAnimProps | null;
}

// <View> の中身（このビュー専用の3Dコンテンツ）。
// ViewportLoadGate 経由でのみマウントされ、マウント時点で glbUrl の GLB は
// 既に suspend-react の共有キャッシュに載っている（＝ここで useGLTF しても suspend しない）。
const ViewportContent: FC<ViewportContentProps> = ({
  glbUrl,
  targetDimensions,
  showDimensions,
  materialPreview,
  onMeshClick,
  onSlots,
  captureRef,
  frames,
  enableZoom,
  animProps,
}) => {
  return (
    <View style={{ width: '100%', height: '100%' }} frames={frames}>
      {/* 複数の View が同じ共有 Canvas 上で描画されるため、カメラも各 View 専用に持つ必要がある。
          持たないと、各 View の Stage(adjustCamera) が Canvas 既定の1台のカメラを取り合ってしまう。 */}
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={45} />
      <Environment files={VIEWER_ENVIRONMENT.files} />
      {captureRef && <CaptureBridge captureRef={captureRef} />}
      <Stage environment={null} intensity={0.5} adjustCamera={1.3}>
        <ViewportModel
          url={glbUrl}
          targetDimensions={targetDimensions}
          showDimensions={showDimensions}
          materialPreview={materialPreview}
          onMeshClick={onMeshClick}
          onSlots={onSlots}
          animProps={animProps}
        />
      </Stage>
      {/* View ローカルの OrbitControls。makeDefault は付けない
          （複数 View が同居する共有 Canvas で、既定コントロールの奪い合いを避けるため）。
          ホイールズームは enableZoom（省略時 true）で外から制御できる。ページのスクロール
          コンテナ内に並ぶビューでは、呼び出し側が RightPanelModelViewer と同様に
          クリックで初めて有効化するゲートを掛けること（S.Model 詳細画面の OverviewSection 参照）。 */}
      <OrbitControls enablePan={false} enableZoom={enableZoom ?? true} />
    </View>
  );
};

/**
 * GLB を「ページ側 DOM ツリー」で先読みしてから <ViewportContent>（＝ <View>）をマウントする
 * ゲート。
 *
 * なぜ必要か: drei の <View>（Canvas の外で使う版）は3D子要素を tunnel-rat で
 * DetailCanvasHost 側の共有 <Canvas>（＝別の React Reconciler ルート）へポータルする。
 * DOM ツリーに置いた <Suspense> は、その先でスローされる Promise を捕まえられない
 * ——つまり ViewportContent 内で useGLTF が直接 suspend しても、この下の Suspense
 * fallback は一切発火しない（デッドコード化する）。
 *
 * さらに悪いことに、@react-three/fiber の Canvas 実装は <View.Port/> を含む children
 * 全体を「1つの」内部 Suspense で包んでいる。そのため、どれか1つの View が新しい GLB の
 * 読み込みで suspend すると、そのフォールバック（Block）が発火して共有 Canvas 全体が
 * ブロックされ、ページ上の他の全ビューポートまで同時に真っ黒になる
 * （このアーキテクチャが本来防ぎたい「ビュー間の巻き込み」がまさに起きる）。
 *
 * そこで GLB 本体は、この Suspense 境界が実際に効くページ DOM 側で読み切ってから
 * <View> をマウントする。useGLTF は @react-three/fiber の useLoader（suspend-react の
 * 共有キャッシュ）そのものなので、ここで一度 resolve すればキャッシュキー（loader, url）
 * が温まり、ViewportModel 内で再度呼ばれる useGLTF(url) は同じキャッシュを同期的に
 * 引くだけになり、Canvas ルート（＝View.Port の中）では絶対に suspend しない。
 *
 * 将来「シンプルにできる」と思って Suspense を <ViewportContent> 直下に戻さないこと
 * ——上記の理由で per-view 分離が壊れ、他ビューの巻き込みが復活する。
 */
const ViewportLoadGate: FC<ViewportContentProps> = (props) => {
  useGLTF(props.glbUrl);
  return <ViewportContent {...props} />;
};

const ViewportPlaceholder: FC<{ placeholderUrl?: string }> = ({ placeholderUrl }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      borderRadius: 8,
      overflow: 'hidden',
    }}
  >
    {placeholderUrl ? (
      <img
        src={placeholderUrl}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.55 }}
      />
    ) : (
      <span style={{ position: 'relative', fontSize: 12, opacity: 0.6, fontFamily: 'sans-serif' }}>
        プレビューがありません
      </span>
    )}
  </div>
);

/**
 * S.Model 詳細画面のページ側セクションに置く、共有 Canvas への1つの「窓」。
 *
 * glbUrl が null のとき、および GLB 読み込み中（Suspense）は `<View>` を一切マウントせず
 * placeholderUrl の画像（またはメッセージ）を表示する。真っ黒な `<View>` を一瞬でも
 * 表示しないための措置（DetailCanvasHost 側の Canvas は既に描画ループを回しているため）。
 */
export const DetailViewport: FC<DetailViewportProps> = ({
  glbUrl,
  placeholderUrl,
  height,
  targetDimensions,
  showDimensions,
  materialPreview,
  onMeshClick,
  onSlots,
  animProps,
  captureRef,
  frames,
  enableZoom,
  className,
  style,
}) => {
  const containerStyle: CSSProperties = { width: '100%', height, position: 'relative', ...style };

  if (!glbUrl) {
    return (
      <div className={className} style={containerStyle}>
        <ViewportPlaceholder placeholderUrl={placeholderUrl} />
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <Suspense fallback={<ViewportPlaceholder placeholderUrl={placeholderUrl} />}>
        <ViewportLoadGate
          glbUrl={glbUrl}
          targetDimensions={targetDimensions}
          showDimensions={showDimensions}
          materialPreview={materialPreview}
          onMeshClick={onMeshClick}
          onSlots={onSlots}
          animProps={animProps}
          captureRef={captureRef}
          frames={frames}
          enableZoom={enableZoom}
        />
      </Suspense>
    </div>
  );
};
