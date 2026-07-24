import React, { useMemo } from "react";
import * as THREE from "three";
import { Html, Edges } from "@react-three/drei";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { layoutSceneRef } from "../../services/layoutSceneRef";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import ZoneActiveGizmo from "./ZoneActiveGizmo.jsx";
import CirculationVisualizer from "./CirculationVisualizer.jsx";
import { useZoningStore } from "../../store/useZoningStore";
import { useSelectionScopeStore, canSelectZone } from "../../store/useSelectionScopeStore";
import { useViewportDisplayStore } from "../../store/useViewportDisplayStore";
import { roomAutoColor } from "../../constants/roomCategories";

const BOX_H = 10; // Make thick enough for mm scale
const LABEL_Y = 200; // Hover nicely above the box
const PADDING = 100.0; // padding in mm
// ラベルの自前ダブルクリック判定用（zone.id → 前回クリック時刻）。map 内なので module スコープに置く。
const labelClickAt = {};

/**
 * zone.rect が存在するゾーン → rect から直接描画（正確な空間境界）
 * zone.rect がないゾーン → 旧来の items ベースバウンディングボックス（後方互換）
 */
export default function ZoneVisualizer({ items, orbitRef, editable = false, roomBounds = null, isTopView = false }) {
  const zones = useLayoutTaskStore((s) => s.zones);
  const activeZoneId = useLayoutTaskStore((s) => s.activeZoneId);
  const setActiveZoneId = useLayoutTaskStore((s) => s.setActiveZoneId);
  // ツリーで選択中の部屋。その部屋に属する全ゾーンを（アクティブと同じく）ハイライトする。
  const selectedRoomId = useLayoutTaskStore((s) => s.selectedRoomId);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  // 平面図では「アクティブ階」のゾーンだけ実体表示し、他階は「他階トレース」トグルで薄く出す
  // （壁・床と同じ規約）。真上ビュー以外（パース等）では従来どおり全ゾーンを出す。
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex);
  const showOtherFloorsGhost = useEditorModeStore((s) => s.showOtherFloorsGhost);
  const ghostFloors = useEditorModeStore((s) => s.ghostFloors);

  const isVisibleMode = editorMode === "layout" || editorMode === "zoning";

  // Zone は ALL / Zone スコープのみ表示する
  const scope = useSelectionScopeStore((s) => s.scope);
  const showZones = scope === "all" || scope === "zone";

  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);
  const selectedCirculationId = useZoningStore((s) => s.selectedCirculationId);

  // 部屋色トグル（部屋の範囲を部屋ごとに異なる色で塗る）。
  const showRoomColors = useViewportDisplayStore((s) => s.showRoomColors);

  const hiddenZoneIds = useZoningStore((s) => s.hiddenZoneIds);
  const hiddenPatternIds = useZoningStore((s) => s.hiddenPatternIds);
  const circulationPatterns = useLayoutTaskStore((s) => s.circulationPatterns) || [];
  const activeCirculationPatternId = useLayoutTaskStore((s) => s.activeCirculationPatternId);

  const zoneMeshes = useMemo(() => {
    if (!isVisibleMode) return [];
    if (!showZones) return [];

    return zones.map((zone, idx) => {
      if (hiddenZoneIds[zone.id]) return null;
      // 平面図での階フィルタ。ghost = 他階（薄いトレース）。トグルOFFなら他階は非表示。
      const ghost = isTopView && (zone.floorIndex || 0) !== (activeFloorIndex || 0);
      // 他階は既定で非表示。マスターON かつ その階の目アイコンONのときだけ透過表示する。
      if (ghost && (!showOtherFloorsGhost || !ghostFloors.includes(zone.floorIndex || 0))) return null;

      let cx, cz, width, depth;

      if (zone.rect) {
        // rect ベース（ゾーニング機能で作成）
        cx = zone.rect.x;
        cz = zone.rect.z;
        width = Math.max(0.5, zone.rect.width);
        depth = Math.max(0.5, zone.rect.depth);
      } else {
        // 旧来: items から境界を計算
        const zoneItems = items.filter((it) => it?.zoneId === zone.id);
        if (zoneItems.length === 0) return null;

        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        zoneItems.forEach((it) => {
          const px = it?.transform?.position?.[0] ?? 0;
          const pz = it?.transform?.position?.[2] ?? 0;
          minX = Math.min(minX, px);
          minZ = Math.min(minZ, pz);
          maxX = Math.max(maxX, px);
          maxZ = Math.max(maxZ, pz);
        });
        minX -= PADDING; minZ -= PADDING; maxX += PADDING; maxZ += PADDING;
        cx = (minX + maxX) / 2;
        cz = (minZ + maxZ) / 2;
        width = Math.max(1, maxX - minX);
        depth = Math.max(1, maxZ - minZ);
      }

      const isActive = activeZoneId === zone.id || (!!selectedRoomId && zone.roomId === selectedRoomId);
      const color = zone.color || "#cccccc";

      const sortedVersions = [...(zone.versions || [])].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      const effectiveActiveVersionId = zone.activeVersionId || sortedVersions[0]?.id;
      const activeVersionIndex = sortedVersions.findIndex(v => v.id === effectiveActiveVersionId);
      const versionLabel = activeVersionIndex !== -1 ? ` / v${sortedVersions.length - activeVersionIndex}` : "";

      // 部屋ごとの自動配色（部屋色トグル ON のとき塗りに使う）。zones 配列上の位置で安定。
      const autoColor = roomAutoColor(idx);

      return { zone, cx, cz, width, depth, isActive, color, autoColor, versionLabel, renderOrder: idx, ghost };
    }).filter(Boolean);
  }, [items, zones, activeZoneId, selectedRoomId, isVisibleMode, showZones, hiddenZoneIds, isTopView, activeFloorIndex, showOtherFloorsGhost, ghostFloors]);

  if (!isVisibleMode) return null;

  return (
    <group userData={{ isEditorOverlay: true }}>
      {zoneMeshes.map(({ zone, cx, cz, width, depth, isActive, color, autoColor, versionLabel, renderOrder, ghost }) => {
        // 部屋色トグル ON かつ実体（他階トレースではない）のときだけ自動配色を適用する。
        const roomColorOn = showRoomColors && !ghost;
        // rect があるゾーンは選択状態によらず常に ZoneActiveGizmo を使う。
        // これにより非選択時でも辺ホバーでリサイズカーソルが出る。
        // 他階（ghost）は薄いトレース＝編集・選択させない（editable を落とす）。
        if (zone.rect) {
          return (
            <ZoneActiveGizmo
              key={zone.id}
              zone={zone}
              orbitRef={orbitRef}
              renderOrder={renderOrder}
              versionLabel={versionLabel}
              isActive={isActive}
              editable={editable && !ghost}
              ghost={ghost}
              roomBounds={roomBounds}
              roomColorOn={roomColorOn}
              autoColor={autoColor}
            />
          );
        }

        // rect なし（旧来の items ベース）は従来通り
        return (
          <group key={zone.id}>
            <mesh
              position={[cx, BOX_H / 2 + gridHeightMm, cz]}
              // 部屋色 ON では床塗り(9980)より上・壁ポシェ(9990)より下に乗せて確実に見せる。
              renderOrder={roomColorOn ? 9986 : renderOrder}
              onClick={(e) => {
                e.stopPropagation();
                if (editorMode === "zoning") {
                  if (zoningSubMode !== "zone" || !isZoningActionSelect) return;
                }
                if (!canSelectZone(useSelectionScopeStore.getState().scope)) return;
                setActiveZoneId(zone.id);
              }}
            >
              <boxGeometry args={[width, BOX_H, depth]} />
              <meshBasicMaterial
                color={roomColorOn ? autoColor : color}
                transparent
                opacity={ghost ? 0.08 : roomColorOn ? (isActive ? 0.45 : 0.32) : isActive ? 0.35 : 0.20}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>

            <Html
              position={[cx, LABEL_Y + gridHeightMm, cz]}
              center
              style={{ pointerEvents: "none", opacity: isActive ? 1 : 0.72, transition: "opacity 0.2s ease-in-out" }}
            >
              {/* 白基調チップ＋ゾーン色ドット（ZoneActiveGizmo と統一。淡いゾーン色でも読める）。
                  シングルクリック＝Properties、ダブルクリック＝フォーカス。 */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  useLayoutTaskStore.getState().setActiveZoneId(zone.id);
                  useUiRightSidebarStore.getState().setRightPanel?.("properties", true);
                  // 自前ダブルクリック判定（drei Html+R3F はネイティブ dblclick を取りこぼす）
                  const now = e.timeStamp || Date.now();
                  if (now - (labelClickAt[zone.id] || 0) < 350) {
                    layoutSceneRef.focusRect?.(cx, cz, width, depth);
                    labelClickAt[zone.id] = 0;
                  } else {
                    labelClickAt[zone.id] = now;
                  }
                }}
                title={`${zone.name || "ゾーン"}（クリックで設定 / ダブルクリックでフォーカス）`}
                style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.96)",
                color: "#1e293b",
                padding: "3px 9px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
                border: `1.5px solid ${color}`,
                boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.28)" : "0 1px 3px rgba(0,0,0,0.2)",
                fontFamily: "Inter, sans-serif",
                pointerEvents: "auto",
                cursor: "pointer",
                userSelect: "none",
              }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flex: "0 0 auto" }} />
                <span>{zone.name || "Unnamed Zone"}{versionLabel}</span>
              </div>
            </Html>
          </group>
        );
      })}

      {circulationPatterns.map(pattern => {
        const isHidden = hiddenPatternIds[pattern.id];
        if (isHidden) return null;
        
        const isActivePattern = pattern.id === activeCirculationPatternId;
        const circulations = isActivePattern 
          ? useLayoutTaskStore.getState().circulations // Ensure we use the latest working draft for the active pattern
          : pattern.circulations || [];

        return (
          <CirculationVisualizer 
            key={pattern.id}
            circulations={circulations}
            isActive={isActivePattern && editorMode === "zoning" && zoningSubMode === "circulation" && isZoningActionSelect} 
            selectedCirculationId={isActivePattern ? selectedCirculationId : null}
            onSelect={(circId) => {
              if (editorMode === "zoning") {
                const state = useZoningStore.getState();
                if (state.zoningSubMode !== "circulation" || !state.isZoningActionSelect) return;
              }
              const state = useZoningStore.getState();
              state.setSelectedCirculationId(circId);
            }} 
          />
        );
      })}
    </group>
  );
}
