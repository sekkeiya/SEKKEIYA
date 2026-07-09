import { useState, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";
import { useSceneObjectRegistryStore } from "@desktop/features/dsl/layout/store/sceneObjectRegistryStore";
import { useFurnitureDimensionPrefsStore } from "@desktop/features/dsl/layout/store/useFurnitureDimensionPrefsStore";

// 平面で見た 4 方向。axis="h"=水平(左右/X), "v"=垂直(上下/Z)。
const DIRS = [
  { key: "+x", axis: "h", vec: new THREE.Vector3(1, 0, 0) },
  { key: "-x", axis: "h", vec: new THREE.Vector3(-1, 0, 0) },
  { key: "+z", axis: "v", vec: new THREE.Vector3(0, 0, 1) },
  { key: "-z", axis: "v", vec: new THREE.Vector3(0, 0, -1) },
];

// 壁面（垂直）かつ進行方向の内壁のみ採用（床/天井=法線が上向きは除外）。
// SmoothAlignFollower の壁判定と同じ考え方。
function pickInsideWallHit(hits, dir) {
  for (const h of hits) {
    if (!h?.face) continue;
    const n = h.face.normal.clone();
    const obj = h.object;
    if (obj) {
      const nm = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
      n.applyMatrix3(nm).normalize();
    }
    if (Math.abs(n.y) > 0.25) continue; // 床/天井は除外
    if (n.dot(dir) > -0.1) continue; // 内側に向いた壁のみ
    return h;
  }
  return null;
}

const raycaster = new THREE.Raycaster();
const _box = new THREE.Box3();

// 1 つの家具 AABB の各端から壁へレイを飛ばし、当たった方向の寸法セグメントを返す。
function measureObject(obj, colliders) {
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  if (_box.isEmpty()) return [];
  const { min, max } = _box;
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const y = (min.y + max.y) / 2;

  const originFor = {
    "+x": new THREE.Vector3(max.x, y, cz),
    "-x": new THREE.Vector3(min.x, y, cz),
    "+z": new THREE.Vector3(cx, y, max.z),
    "-z": new THREE.Vector3(cx, y, min.z),
  };

  const out = [];
  for (const d of DIRS) {
    const origin = originFor[d.key];
    raycaster.set(origin, d.vec);
    raycaster.near = 0;
    raycaster.far = 100000; // mm
    const hits = raycaster.intersectObjects(colliders, true);
    const hit = pickInsideWallHit(hits, d.vec);
    if (!hit) continue;
    out.push({
      key: d.key,
      axis: d.axis,
      start: origin.clone(),
      end: hit.point.clone(),
      mm: Math.round(hit.distance),
    });
  }
  return out;
}

// 既定表示＝近い側の水平1本＋垂直1本。
function defaultAdoptedKeys(segs) {
  let h = null;
  let v = null;
  for (const s of segs) {
    if (s.axis === "h") {
      if (!h || s.mm < h.mm) h = s;
    } else if (!v || s.mm < v.mm) v = s;
  }
  const set = new Set();
  if (h) set.add(h.key);
  if (v) set.add(v.key);
  return set;
}

/**
 * FurnitureDimensionOverlay（家具位置プロット寸法）
 *
 * - toolsStore.showFurnitureDimensions が ON のときのみ表示。
 * - 既定：全家具に「近い側（水平1＋垂直1）」の壁距離を表示。
 * - 選択中の家具：4方向すべてを候補表示。ラベルをクリックで採用/解除を切替。
 *   採用した寸法は実線＋濃色、未採用候補は破線＋淡色。
 * - 家具ごとに「非表示」トグルあり（選択中に中央のボタンで切替）。
 */
export default function FurnitureDimensionOverlay() {
  const show = useToolsStore((s) => s.showFurnitureDimensions);
  const selectedIds = useUiSelectionStore((s) => s.selectedItemIds);
  const prefs = useFurnitureDimensionPrefsStore((s) => s.prefs);
  const setAdopted = useFurnitureDimensionPrefsStore((s) => s.setAdopted);
  const toggleHidden = useFurnitureDimensionPrefsStore((s) => s.toggleHidden);

  // 家具の移動・追加に追従するため定期的に再計算し、invalidate() で再描画を要求する
  // （frameloop が demand でも always でも確実に更新されるようにする）。
  const invalidate = useThree((s) => s.invalidate);
  const [items, setItems] = useState([]); // [{ id, segs:[...] }]

  useEffect(() => {
    if (!show) {
      setItems([]);
      return;
    }

    const recompute = () => {
      const reg = useSceneObjectRegistryStore.getState();
      const colliders = reg.baseColliders || [];
      const objectsById = reg.map;

      if (!colliders.length || !objectsById || objectsById.size === 0) {
        setItems((prev) => (prev.length ? [] : prev));
        invalidate();
        return;
      }

      const next = [];
      for (const [id, obj] of objectsById.entries()) {
        if (!obj || obj.visible === false) continue;
        const segs = measureObject(obj, colliders);
        if (segs.length) next.push({ id, segs });
      }
      setItems(next);
      invalidate();
    };

    recompute();
    // 家具のドラッグ移動・追加にも追従するため定期的に再計算
    const timer = setInterval(recompute, 150);
    return () => clearInterval(timer);
  }, [show, selectedIds, invalidate]);

  const onToggleDir = useCallback(
    (id, key, effectiveKeys) => {
      const next = new Set(effectiveKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setAdopted(id, Array.from(next));
    },
    [setAdopted]
  );

  if (!show || items.length === 0) return null;

  const selSet = new Set(selectedIds || []);

  return (
    <group>
      {items.map(({ id, segs }) => {
        const pref = prefs[id];
        const isSelected = selSet.has(id);
        const hidden = !!pref?.hidden;

        // 非選択かつ非表示 → 何も描かない
        if (hidden && !isSelected) return null;

        // 採用キー集合（未設定なら既定の近い側2本）
        const effective =
          pref?.adopted !== undefined ? new Set(pref.adopted) : defaultAdoptedKeys(segs);

        // 描画対象：選択中は全候補、非選択は採用分のみ
        const visibleSegs = isSelected ? segs : segs.filter((s) => effective.has(s.key));

        // 選択中の中央ボタン（非表示トグル）の位置
        let centerPos = null;
        if (isSelected && segs.length) {
          const c = new THREE.Vector3();
          for (const s of segs) c.add(s.start);
          c.multiplyScalar(1 / segs.length);
          centerPos = c;
        }

        return (
          <group key={id}>
            {visibleSegs.map((s) => {
              const adopted = effective.has(s.key);
              const mid = s.start.clone().add(s.end).multiplyScalar(0.5);
              const color = adopted ? "#ffa726" : "#7fb0ff";
              const labelBg = adopted ? "rgba(20,24,31,0.88)" : "rgba(20,24,31,0.6)";
              const labelFg = adopted ? "#ffd9a0" : "#bcd3ff";
              const labelBorder = adopted
                ? "1px solid rgba(255,167,38,0.6)"
                : "1px dashed rgba(127,176,255,0.55)";

              return (
                <group key={`${id}-${s.key}`}>
                  <Line
                    points={[s.start, s.end]}
                    color={color}
                    lineWidth={adopted ? 1.6 : 1}
                    dashed={!adopted}
                    dashSize={adopted ? 0 : 40}
                    gapSize={adopted ? 0 : 24}
                    transparent
                    opacity={adopted ? 1 : 0.7}
                    depthTest={false}
                    renderOrder={9999}
                  />
                  <Html
                    position={[mid.x, mid.y, mid.z]}
                    center
                    zIndexRange={[100, 0]}
                    style={{ pointerEvents: isSelected ? "auto" : "none", userSelect: "none" }}
                  >
                    <div
                      onPointerDown={(e) => {
                        if (!isSelected) return;
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        if (!isSelected) return;
                        e.stopPropagation();
                        onToggleDir(id, s.key, effective);
                      }}
                      title={isSelected ? "クリックで採用/解除" : undefined}
                      style={{
                        background: labelBg,
                        color: labelFg,
                        font: "600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
                        padding: "2px 5px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                        border: labelBorder,
                        cursor: isSelected ? "pointer" : "default",
                        opacity: adopted ? 1 : 0.8,
                      }}
                    >
                      {s.mm} mm
                    </div>
                  </Html>
                </group>
              );
            })}

            {isSelected && centerPos && (
              <Html
                position={[centerPos.x, centerPos.y, centerPos.z]}
                center
                zIndexRange={[101, 0]}
                style={{ pointerEvents: "auto", userSelect: "none" }}
              >
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHidden(id);
                  }}
                  title={hidden ? "寸法を表示" : "この家具の寸法を非表示"}
                  style={{
                    background: hidden ? "rgba(120,60,60,0.85)" : "rgba(20,24,31,0.85)",
                    color: hidden ? "#ffbcbc" : "#cfd8e3",
                    font: "600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
                    padding: "2px 6px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                    border: "1px solid rgba(255,255,255,0.18)",
                    cursor: "pointer",
                  }}
                >
                  {hidden ? "寸法ON" : "寸法OFF"}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
