// ElevationMarkerPlanOverlay — 平面図(Top)に置く「展開記号」。1展開＝1記号の独立マーカー。
//   中心＝視点（目）、矢印＝その展開の視線方向（A=上 / B=右 / C=下 / D=左）。
//   部屋（ゾーン）には既定で 展開A〜D の4記号が置かれ、Properties の「追加」で 展開A' などが増える。
//   - 中心クリック  … その部屋を選択 → 右サイドバー Properties で展開を管理
//   - 中心ドラッグ  … その記号だけを移動（50mm 刻み）
//   - 矢印/バッジクリック … その展開図を開く
//   デザインは断面線と同じモノクロ・スレート基調（細線・白バッジ・装飾なし）。
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useRoomElevationsStore } from "../../store/useRoomElevationsStore";
import {
  openRoomElevation,
  defaultElevationPos,
  computeElevationRooms,
} from "../../utils/openElevationView";

const INK = "#475569";        // 非選択（ミディアムスレート）
const INK_ACTIVE = "#0f172a"; // 選択/ホバー（ほぼ黒）
const BADGE_BG = "rgba(255,255,255,0.92)";
const BADGE_BORDER = "rgba(30,41,59,0.4)";

const DIR_DEG = { A: 0, B: 90, C: 180, D: 270 }; // 画面方位（上/右/下/左）

export default function ElevationMarkerPlanOverlay() {
  const zones = useLayoutTaskStore((s) => s.zones);
  const roomsList = useLayoutTaskStore((s) => s.rooms);
  const elevations = useRoomElevationsStore((s) => s.elevations);
  const markerPos = useRoomElevationsStore((s) => s.markerPos);
  const selectedRoomId = useRoomElevationsStore((s) => s.selectedRoomId);
  const activeElevationId = useRoomElevationsStore((s) => s.activeElevationId);
  const ensureRoomDefaults = useRoomElevationsStore((s) => s.ensureRoomDefaults);
  const pruneRooms = useRoomElevationsStore((s) => s.pruneRooms);

  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const rotIndex = useEditorModeStore((s) => s.layoutCameraRotationIndex) || 0;
  const viewDeg = rotIndex * -90;
  // 展開記号はアクティブ階の部屋のぶんだけ出す（矢印＋目＋バッジで大きく、他階に薄く
  // 重ねると読めないので、ゾーンのトレースとは違い他階は非表示にする）。
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);

  const isMm = (sceneMaxY || 0) > 100;
  // 平面図の水平カット面の少し下（クリップで消えないように）
  const y = (sectionClipHeight || (isMm ? 1500 : 1.5)) * 0.98;

  // 部屋 = Room（roomId でゾーンを束ねる。roomId 無しゾーンは単体で1部屋）
  const rooms = useMemo(() => computeElevationRooms(zones, roomsList), [zones, roomsList]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  // 部屋の階（Room マスタ優先、無ければ所属ゾーンから）。展開記号の階フィルタに使う。
  const roomFloorById = useMemo(() => {
    const m = new Map();
    rooms.forEach((r) => {
      const master = (roomsList || []).find((x) => x.id === r.id);
      m.set(r.id, master?.floorIndex ?? r.zones?.[0]?.floorIndex ?? 0);
    });
    return m;
  }, [rooms, roomsList]);

  // 部屋の増減に追従: 新しい部屋に既定4本を用意し、消えた部屋の展開を掃除する
  const roomIdsKey = rooms.map((r) => r.id).join(",");
  useEffect(() => {
    rooms.forEach((r) => ensureRoomDefaults(r.id));
    pruneRooms(rooms.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdsKey, ensureRoomDefaults, pruneRooms]);

  if (!rooms.length) return null;

  return (
    <>
      {elevations.map((elev) => {
        const room = roomById.get(elev.roomId);
        if (!room) return null;
        // アクティブ階の部屋のぶんだけ出す（他階の展開記号は非表示）。
        if ((roomFloorById.get(room.id) || 0) !== (activeFloorIndex || 0)) return null;
        const pos = markerPos[elev.id] || defaultElevationPos(elev);
        if (!pos) return null;
        return (
          <ElevationMarker
            key={elev.id}
            elev={elev}
            room={room}
            pos={pos}
            y={y}
            isMm={isMm}
            viewDeg={viewDeg}
            roomSelected={selectedRoomId === room.id}
            isActive={activeElevationId === elev.id}
          />
        );
      })}
    </>
  );
}

function ElevationMarker({ elev, room, pos, y, isMm, viewDeg, roomSelected, isActive }) {
  const { camera, gl } = useThree();
  const setMarkerPos = useRoomElevationsStore((s) => s.setMarkerPos);
  const selectRoom = useRoomElevationsStore((s) => s.selectRoom);

  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  // ドラッグ扱いした後の click で部屋選択を発火させないためのフラグ
  const movedRef = useRef(false);

  // 中心ドラッグ（平面 y に投影 → 50mm 刻み）。この記号だけ動く。
  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const snap = (v) => (isMm ? Math.round(v / 50) * 50 : Math.round(v / 0.05) * 0.05);
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      movedRef.current = true;
      setMarkerPos(elev.id, { x: snap(hit.x), z: snap(hit.z) });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, isMm, y, elev.id, setMarkerPos]);

  const on = isActive || hover;
  const c = on ? INK_ACTIVE : INK;
  const deg = DIR_DEG[elev.dir] + viewDeg;

  // バッジは矢印の先（中心(60,60)から上向き R_BADGE の点を deg 回転）。文字は正立のまま。
  const R_BADGE = 52;
  const rad = (deg * Math.PI) / 180;
  const badgeX = 60 + R_BADGE * Math.sin(rad);
  const badgeY = 60 - R_BADGE * Math.cos(rad);

  // "展開A'" → "A'"。名前を変えていれば先頭2文字。
  const label = (elev.name.replace(/^展開/, "") || elev.name).slice(0, 3);
  const badgeR = 9 + Math.max(0, label.length - 1) * 2;

  const openProps = () => {
    selectRoom(room.id);
    useUiRightSidebarStore.getState().setRightPanel?.("properties", true);
  };

  return (
    <Html position={[pos.x, y, pos.z]} center zIndexRange={[16, 0]} style={{ pointerEvents: "none" }}>
      <svg
        width="120" height="120" viewBox="0 0 120 120"
        style={{ display: "block", overflow: "visible", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}
      >
        {/* ── 矢印（この展開の向き）── */}
        <g transform={`rotate(${deg} 60 60)`} style={{ transition: "opacity 120ms" }} opacity={on ? 1 : 0.8}>
          <line x1="60" y1="46" x2="60" y2="26" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M55 31.5 L60 24 L65 31.5" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          {/* ヒット領域（透明・太め） */}
          <line
            x1="60" y1="49" x2="60" y2="18" stroke="transparent" strokeWidth="18"
            style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            onClick={(ev) => { ev.stopPropagation(); openRoomElevation(elev.id); }}
          />
        </g>

        {/* ── 展開名バッジ（正立・白地に細枠、アクティブ/ホバーで反転）── */}
        <g
          style={{ pointerEvents: "auto", cursor: "pointer", transition: "opacity 120ms" }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onClick={(ev) => { ev.stopPropagation(); openRoomElevation(elev.id); }}
        >
          <title>{`${elev.name} ・ ${room.name || "部屋"}`}</title>
          <circle cx={badgeX} cy={badgeY} r={badgeR} fill={on ? "#1e293b" : BADGE_BG} stroke={on ? "#1e293b" : BADGE_BORDER} strokeWidth="1" />
          <text
            x={badgeX} y={badgeY + 3.4} textAnchor="middle"
            fontSize="10" fontWeight="700" letterSpacing="0.3"
            fill={on ? "#f8fafc" : "#1e293b"}
          >
            {label}
          </text>
        </g>

        {/* ── 中心＝視点（目）。クリックで部屋を選択 / ドラッグで移動 ── */}
        <g
          style={{ pointerEvents: "auto", cursor: "move" }} // 手（grab）は使わない
          onPointerDown={(ev) => { ev.stopPropagation(); movedRef.current = false; setDragging(true); }}
          onClick={(ev) => {
            ev.stopPropagation();
            if (movedRef.current) return; // 移動しただけならクリック扱いしない
            openProps();
          }}
        >
          <title>{`${elev.name} ・ ${room.name || "部屋"}（クリックで管理 / ドラッグで移動）`}</title>
          <circle
            cx="60" cy="60" r="11"
            fill={roomSelected ? "#1e293b" : BADGE_BG}
            stroke={roomSelected ? "#1e293b" : BADGE_BORDER}
            strokeWidth={roomSelected ? 1.6 : 1}
          />
          {/* 目（アーモンド輪郭＋瞳） */}
          <path
            d="M54 60 Q60 55.4 66 60 Q60 64.6 54 60 Z"
            fill="none" stroke={roomSelected ? "#f8fafc" : INK_ACTIVE} strokeWidth="1.2" strokeLinejoin="round"
          />
          <circle cx="60" cy="60" r="1.7" fill={roomSelected ? "#f8fafc" : INK_ACTIVE} />
        </g>
      </svg>
    </Html>
  );
}
