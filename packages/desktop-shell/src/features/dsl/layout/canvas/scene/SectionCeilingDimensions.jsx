// SectionCeilingDimensions — 断面図の各天井に「FL → 天井」の縦寸法を立てる。
//   天井高の正は天井の面（FloorSlab role="ceiling" の ceilingHeightMm）。
//   断面線が横切る天井ごとに 1 本、その切り口の中央に置く。
//   天井を削除すれば寸法も消える（＝吹き抜け）。
//   ダブルクリックでその天井の高さを編集する（保存は useSlabStore）。
//
//   なぜ寸法列（左の列）ではなく図面の中なのか:
//     1 本の断面線は複数の天井を横切るので、天井高は 1 つに決まらない。
//     左の列に押し込むと部屋ごとの値が縦に並んで読めなくなるため、
//     その天井の位置に立てる（製図の作法）。
//   図面注記なのでクリップ対象外（ignoreClipping）・深度無視で最前面に描く。
import { useMemo, useState, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useSlabStore } from "../../store/useSlabStore";
import { useSectionLinesStore } from "../../store/useSectionLinesStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore, ceilingHeightOf } from "../../store/useBuildingSpecStore";
import { useViewportDisplayStore } from "../../store/useViewportDisplayStore";
import { useBaseEditMode } from "../../utils/baseEditMode";
import { useDrawToolActive } from "../../utils/drawToolActive";
import { slabCeilingHeightMm } from "../../utils/ceilingHeight";
import { crossSpan } from "../../utils/sectionCrossSpan";

const INK = "#475569";      // 寸法線（ElevationDimensionsOverlay と同じスレート）
const INK_DARK = "#0f172a"; // 数値
const ACCENT = "#0369a1";   // 編集できることを示すアクセント

/** その天井の高さを保存する。
 *  表示している値は「FL から天井までの実高さ」＝ ceilingHeightMm ＋ offsetYMm なので、
 *  書き戻すときは offsetYMm を引く（旧データは offsetYMm で下げ天井を作っている）。 */
function commitCeilingHeight(slabId, mm, offsetMm) {
  const v = Math.round(Number(mm));
  if (!slabId || !Number.isFinite(v) || v < 1000 || v > 8000) return;
  useSlabStore.getState().updateSlab(slabId, { ceilingHeightMm: v - (offsetMm || 0) });
}

/** 寸法値のバッジ。ダブルクリックでその天井の高さを数値入力する。 */
function CeilingTag({ position, valueMm, slabId, offsetMm, editable }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  // 入力中の文字はローカルに持つ（state にすると1文字ごとに親が組み直されてちらつく）。
  const textRef = useRef("");
  const commit = () => {
    setEditing(false);
    commitCeilingHeight(slabId, textRef.current, offsetMm);
  };
  return (
    <Html position={position} center zIndexRange={[19, 0]} style={{ pointerEvents: "none" }}>
      {/* 縦の寸法なので数値も寝かせ、下から上へ読ませる（製図の作法。寸法列と同じ） */}
      <div style={{ transform: "rotate(-90deg)", display: "inline-block" }}>
        {editing ? (
          <input
            autoFocus type="number" defaultValue={Math.round(valueMm)}
            onChange={(e) => { textRef.current = e.target.value; }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{
              width: 58, fontSize: 11, fontWeight: 700, textAlign: "center",
              borderRadius: 3, border: `1px solid ${ACCENT}`,
              background: "rgba(255,255,255,0.99)", color: INK_DARK,
              outline: "none", pointerEvents: "auto",
            }}
          />
        ) : (
          <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={editable ? (e) => {
              e.stopPropagation();
              textRef.current = String(Math.round(valueMm));
              setEditing(true);
            } : undefined}
            title={editable ? "天井高（ダブルクリックで数値入力）" : "天井高"}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
              color: hover && editable ? ACCENT : INK_DARK,
              background: "rgba(255,255,255,0.92)",
              border: `1px solid ${hover && editable ? "rgba(3,105,161,0.75)" : "rgba(30,41,59,0.35)"}`,
              borderRadius: 3, padding: "0px 4px", whiteSpace: "nowrap",
              fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
              pointerEvents: editable ? "auto" : "none",
              cursor: editable ? "text" : "default", userSelect: "none",
            }}
          >
            {Math.round(valueMm)}
          </div>
        )}
      </div>
    </Html>
  );
}

// viewKey: SingleViewportCanvas の dimViewKey（"sect:{lineId}" のときだけ描く）
// view: "front" | "right"（画面横が world X か Z か）
export default function SectionCeilingDimensions({ viewKey = null, view = "front" }) {
  // ⚠️ フックは必ず無条件・早期 return より前に呼ぶ（Rules of Hooks）。
  //    この領域では「Rendered more hooks than during the previous render」で
  //    画面全体を落とした前例がある。
  const slabs = useSlabStore((s) => s.slabs);
  const lines = useSectionLinesStore((s) => s.lines);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sectionClipX = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZ = useEditorModeStore((s) => s.sectionClipZ);
  const fl0Mm = useBuildingSpecStore((s) => s.fl0Mm);
  const floors = useBuildingSpecStore((s) => s.floors);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const locked = useViewportDisplayStore((s) => s.symbolLocks.dimension);
  const baseEdit = useBaseEditMode();
  const drawTool = useDrawToolActive();

  const isMm = (sceneMaxY || 0) > 100;
  const w = (mm) => (isMm ? mm : mm / 1000);

  // 断面の切り位置。断面線があればそれ、無ければグローバルのクリップ位置。
  const cut = useMemo(() => {
    if (!viewKey || !String(viewKey).startsWith("sect:")) return null;
    const toMm = (v) => (isMm ? v : v * 1000);
    const id = String(viewKey).slice(5);
    const line = (lines || []).find((l) => l.id === id);
    if (line) return { axis: line.axis, posMm: toMm(line.pos) };
    // 断面線を作らずクリップだけ使っている単体ビュー（viewKey が "sect:z" / "sect:x"）
    const axis = view === "front" ? "z" : "x";
    return { axis, posMm: toMm(axis === "x" ? sectionClipX : sectionClipZ) };
  }, [viewKey, lines, view, sectionClipX, sectionClipZ, isMm]);

  const items = useMemo(() => {
    if (!cut) return [];
    const spec = useBuildingSpecStore.getState();
    const n = Math.max(1, floors?.length || 1);
    const flAt = (i) => (fl0Mm || 0) + (floors?.[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);
    // 切る軸（視線方向）と、画面横に当たる軸。
    const depthAxis = cut.axis;
    const horizAxis = cut.axis === "z" ? "x" : "z";

    const out = [];
    for (const s of slabs || []) {
      if (s?.role !== "ceiling" || !(s.points?.length >= 3)) continue;
      const span = crossSpan(s.points, depthAxis, horizAxis, cut.posMm);
      if (!span) continue; // 断面線がこの天井を横切っていない
      const fi = s.floorIndex || 0;
      const offsetMm = s.offsetYMm || 0;
      // 面が持つ高さ ＋ 上下オフセット（旧データの下げ天井）＝ FL からの実高さ。
      // 寸法はこの実高さを出す（図面が嘘をつかないように）。
      const topMm = slabCeilingHeightMm(s, ceilingHeightOf(spec, fi)) + offsetMm;
      const fl = flAt(fi);
      out.push({
        id: s.id,
        hMm: (span[0] + span[1]) / 2, // 切り口の中央
        y0Mm: fl,
        y1Mm: fl + topMm,
        valueMm: topMm,
        offsetMm,
      });
    }
    return out;
    // ceilingHeightMm は既定値の購読（getState だけだと既定を変えても再レンダーされない）
  }, [cut, slabs, fl0Mm, floors, ceilingHeightMm]);

  if (!items.length) return null;

  // (画面横 mm, world Y mm) → world 座標。DimensionChainsOverlay の P と同じ規約。
  const P = (hMm, yMm) => (view === "front" ? [w(hMm), w(yMm), 0] : [0, w(yMm), w(hMm)]);
  const tickMm = 70; // 端部の短い横棒（寸法列の tick と同じ長さ）
  const editable = baseEdit && !drawTool && !locked;
  const lineCommon = {
    color: INK, lineWidth: 1.4, transparent: true, opacity: 0.95,
    depthTest: false, userData: { ignoreClipping: true },
  };

  return (
    <group renderOrder={9000} userData={{ ignoreClipping: true }}>
      {items.map((it) => (
        <group key={it.id}>
          <Line points={[P(it.hMm, it.y0Mm), P(it.hMm, it.y1Mm)]} {...lineCommon} />
          <Line points={[P(it.hMm - tickMm, it.y0Mm), P(it.hMm + tickMm, it.y0Mm)]} {...lineCommon} />
          <Line points={[P(it.hMm - tickMm, it.y1Mm), P(it.hMm + tickMm, it.y1Mm)]} {...lineCommon} />
          <CeilingTag
            position={P(it.hMm, (it.y0Mm + it.y1Mm) / 2)}
            valueMm={it.valueMm}
            slabId={it.id}
            offsetMm={it.offsetMm}
            editable={editable}
          />
        </group>
      ))}
    </group>
  );
}
