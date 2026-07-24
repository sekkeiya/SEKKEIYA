// ElevationPlanMiniMap — 展開図 Properties の上部に固定する平面ミニマップ。
//   「いまどこを見ているか」の把握と、展開の切替（ナビゲーター）を兼ねる。
//   - ゾーン外形＋部屋名ラベル（平面図の TOP ビューと同じ向き: 画面上 = −Z / 右 = +X）
//   - 各展開の記号（A/B/C/D…）を平面図と同じ位置に描き、クリックでその展開図を開く
//   - 表示中の展開は、映る範囲（記号位置〜見ている壁）の塗り＋見ている壁の太線
//   - ホイールでカーソル基点ズーム / 右ドラッグでパン（部屋が多いときの拡大用）
//   記号位置は平面図オーバーレイと同じ getElevationMarkerPos を使うので両者がずれない。
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
  useElevationMarkerStore,
  ELEV_DIR_LABEL,
} from "../../../../store/useElevationMarkerStore";
import { useRoomElevationsStore } from "../../../../store/useRoomElevationsStore";
import { useLayoutTaskStore } from "../../../../store/useLayoutTaskStore";
import {
  computeElevationRooms,
  getElevationMarkerPos,
  openRoomElevation,
} from "../../../../utils/openElevationView";
import { measureBaseInterior } from "../../../../utils/baseFootprint";

const ACCENT = "#38bdf8";
const W = 220;
const H = 156;
const PAD = 12;
const ZOOM_MIN = 1;
const ZOOM_MAX = 12;

/** 記号の表示ラベル: 「展開A'」→「A'」 */
const shortLabel = (name, dir) => (name || "").replace(/^展開/, "") || dir;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** ズーム/パンを正規化: 倍率を範囲内に収め、内容が枠外へ流れ切らないよう平行移動をクランプ。 */
const clampView = (k, tx, ty) => {
  const nk = clamp(k, ZOOM_MIN, ZOOM_MAX);
  return { k: nk, tx: clamp(tx, W - nk * W, 0), ty: clamp(ty, H - nk * H, 0) };
};

export default function ElevationPlanMiniMap() {
  const viewActive = useElevationMarkerStore((s) => s.viewActive);
  const dir = useElevationMarkerStore((s) => s.activeDir);
  const pos = useElevationMarkerStore((s) => s.pos);
  const roomBox = useElevationMarkerStore((s) => s.roomBox);
  const roomName = useElevationMarkerStore((s) => s.roomName);

  const elevations = useRoomElevationsStore((s) => s.elevations);
  const markerPosMap = useRoomElevationsStore((s) => s.markerPos);
  const selectedRoomId = useRoomElevationsStore((s) => s.selectedRoomId);
  const activeElevationId = useRoomElevationsStore((s) => s.activeElevationId);
  const selectRoom = useRoomElevationsStore((s) => s.selectRoom);

  const zones = useLayoutTaskStore((s) => s.zones);
  const roomsList = useLayoutTaskStore((s) => s.rooms);

  const svgRef = useRef(null);
  const clipId = `elevMiniClip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // view = 表示変換（screen = k * base + t）。記号やラベルは base 側に掛けて位置だけ動かし、
  // 円の半径・文字サイズ・線幅は画面固定にする（拡大しても記号が巨大化しない）。
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const panRef = useRef(null);

  const data = useMemo(() => {
    const rectPts = (r) => ({
      x0: r.x - (r.width || 0) / 2, x1: r.x + (r.width || 0) / 2,
      z0: r.z - (r.depth || 0) / 2, z1: r.z + (r.depth || 0) / 2,
    });
    // ゾーン（機能バブル）
    const zoneRects = (zones || [])
      .filter((z) => z?.rect && Number.isFinite(z.rect.x) && Number.isFinite(z.rect.z))
      .map((z) => ({ roomKey: z.roomId || z.id, ...rectPts(z.rect) }));
    // 部屋（室の範囲）＝平面図の主役。全部屋を出す。
    const roomRects = (roomsList || [])
      .filter((r) => r?.rect && Number.isFinite(r.rect.x) && Number.isFinite(r.rect.z))
      .map((r) => ({ roomKey: r.id, ...rectPts(r.rect) }));
    // 建物の内法（全体の外形）。取れれば平面全体の枠として使う。
    const interior = measureBaseInterior();
    const buildingRect = interior
      ? { x0: interior.minX, x1: interior.maxX, z0: interior.minZ, z1: interior.maxZ }
      : null;

    // 部屋名ラベルは部屋の範囲（rect）の中心、無ければ所属ゾーンの代表中心。
    const rooms = computeElevationRooms(zones || [], roomsList || []);
    const roomLabels = rooms
      .map((room) => {
        const rm = (roomsList || []).find((r) => r.id === room.id);
        if (rm?.rect) return { id: room.id, name: room.name || "", x: rm.rect.x, z: rm.rect.z };
        let best = null;
        let bestArea = -1;
        room.zones.forEach((z) => {
          const area = (z.rect?.width || 0) * (z.rect?.depth || 0);
          if (area > bestArea) { bestArea = area; best = z; }
        });
        if (!best?.rect) return null;
        return { id: room.id, name: room.name || "", x: best.rect.x, z: best.rect.z };
      })
      .filter(Boolean);

    // 記号（1展開=1記号）。平面図オーバーレイと同じ既定位置ロジックを使う。
    const markers = (elevations || [])
      .map((e) => {
        const p = getElevationMarkerPos(e);
        return p ? { id: e.id, roomId: e.roomId, dir: e.dir, label: shortLabel(e.name, e.dir), x: p.x, z: p.z } : null;
      })
      .filter(Boolean);

    // 全体バウンズ = 建物内法 ∪ 全部屋 ∪ 全ゾーン ∪ 記号 ∪ roomBox（＝平面全体が入る）
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const eat = (x0, x1, z0, z1) => {
      minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
      minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
    };
    if (buildingRect) eat(buildingRect.x0, buildingRect.x1, buildingRect.z0, buildingRect.z1);
    roomRects.forEach((r) => eat(r.x0, r.x1, r.z0, r.z1));
    zoneRects.forEach((r) => eat(r.x0, r.x1, r.z0, r.z1));
    markers.forEach((m) => eat(m.x, m.x, m.z, m.z));
    if (roomBox) eat(roomBox.minX, roomBox.maxX, roomBox.minZ, roomBox.maxZ);
    if (!Number.isFinite(minX)) return null;
    if (maxX - minX < 1e-6) { minX -= 1; maxX += 1; }
    if (maxZ - minZ < 1e-6) { minZ -= 1; maxZ += 1; }

    // 表示中の展開: 映る範囲（記号位置〜見ている壁）と見ている壁の線分
    // A=−Z（上）を見る / B=+X（右） / C=+Z（下） / D=−X（左）
    let region = null;
    let wall = null;
    if (viewActive && dir && pos) {
      // 内法（実際に展開図へ映る範囲）を使う。roomBox の min/max は
      // 見ている壁だけ壁厚ぶん外へ出ているので、そのまま描くと部屋より広く見える。
      const rb = roomBox
        ? {
            minX: roomBox.innerMinX ?? roomBox.minX,
            maxX: roomBox.innerMaxX ?? roomBox.maxX,
            minZ: roomBox.innerMinZ ?? roomBox.minZ,
            maxZ: roomBox.innerMaxZ ?? roomBox.maxZ,
          }
        : { minX, maxX, minZ, maxZ };
      const cutZ = clamp(pos.z, rb.minZ, rb.maxZ);
      const cutX = clamp(pos.x, rb.minX, rb.maxX);
      if (dir === "A") {
        region = { x0: rb.minX, x1: rb.maxX, z0: rb.minZ, z1: cutZ };
        wall = { x0: rb.minX, x1: rb.maxX, z0: rb.minZ, z1: rb.minZ };
      } else if (dir === "C") {
        region = { x0: rb.minX, x1: rb.maxX, z0: cutZ, z1: rb.maxZ };
        wall = { x0: rb.minX, x1: rb.maxX, z0: rb.maxZ, z1: rb.maxZ };
      } else if (dir === "B") {
        region = { x0: cutX, x1: rb.maxX, z0: rb.minZ, z1: rb.maxZ };
        wall = { x0: rb.maxX, x1: rb.maxX, z0: rb.minZ, z1: rb.maxZ };
      } else {
        region = { x0: rb.minX, x1: cutX, z0: rb.minZ, z1: rb.maxZ };
        wall = { x0: rb.minX, x1: rb.minX, z0: rb.minZ, z1: rb.maxZ };
      }
    }

    return { zoneRects, roomRects, buildingRect, roomLabels, markers, minX, maxX, minZ, maxZ, region, wall };
    // markerPosMap は getElevationMarkerPos が参照する（記号ドラッグに追従するため deps に必要）
  }, [zones, roomsList, elevations, markerPosMap, viewActive, dir, pos, roomBox]);

  // クライアント座標 → viewBox 座標（width:100%/height:auto なので縦横とも線形）
  const toSvg = useCallback((clientX, clientY) => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }, []);

  // ホイールズーム: カーソル位置を固定点にする（CAD 系と同じ寄り方）。
  // React の onWheel では preventDefault が効かない環境があるため native listener で張る。
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      setView((v) => {
        const k = clamp(v.k * Math.pow(1.0016, -e.deltaY), ZOOM_MIN, ZOOM_MAX);
        const ratio = k / v.k;
        return clampView(k, p.x - ratio * (p.x - v.tx), p.y - ratio * (p.y - v.ty));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // data を deps に含める: 初回に data が無い（＝SVG 未マウント）と ref が null で
    // 張り損ねるため、SVG が出たタイミングで張り直す。
  }, [toSvg, data]);

  // 右ドラッグでパン
  useEffect(() => {
    if (!panning) return;
    const onMove = (e) => {
      const st = panRef.current;
      if (!st) return;
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      setView((v) => clampView(v.k, st.tx + (p.x - st.px), st.ty + (p.y - st.py)));
    };
    const onUp = () => { panRef.current = null; setPanning(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panning, toSvg]);

  const onPointerDown = (e) => {
    if (e.button !== 2 && e.button !== 1) return; // 右 or 中ボタンのみパン
    const p = toSvg(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    panRef.current = { px: p.x, py: p.y, tx: view.tx, ty: view.ty };
    setPanning(true);
  };

  const resetView = () => setView({ k: 1, tx: 0, ty: 0 });

  if (!data || (!data.zoneRects.length && !data.roomRects.length && !data.markers.length && !data.buildingRect)) return null;

  // world → SVG（縦横比を保ってフィット。TOP ビューと同じ向き: 上=−Z）にズーム/パンを合成
  const spanX = data.maxX - data.minX;
  const spanZ = data.maxZ - data.minZ;
  const fit = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanZ);
  const offX = (W - spanX * fit) / 2;
  const offY = (H - spanZ * fit) / 2;
  const scale = fit * view.k; // world → screen の実効スケール（矩形サイズ用）
  const sx = (wx) => view.tx + view.k * (offX + (wx - data.minX) * fit);
  const sy = (wz) => view.ty + view.k * (offY + (wz - data.minZ) * fit);

  const zoomed = view.k !== 1 || view.tx !== 0 || view.ty !== 0;

  const openElev = (m) => {
    selectRoom(m.roomId);
    openRoomElevation(m.id);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
          {viewActive ? "表示中" : "展開マップ"}
        </Typography>
        {viewActive && (
          <>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: ACCENT }}>
              {ELEV_DIR_LABEL[dir] || ""}
            </Typography>
            {roomName ? (
              <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ・{roomName}
              </Typography>
            ) : null}
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {zoomed && (
          <>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>
              ×{view.k.toFixed(1)}
            </Typography>
            <Tooltip title="表示位置をリセット" arrow>
              <Box
                component="button" type="button" onClick={resetView}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 20, height: 20, borderRadius: 1, cursor: "pointer", flexShrink: 0,
                  border: "none", background: "transparent",
                  color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
                  "&:hover": { background: alpha("#fff", 0.12), color: "var(--brand-fg)" },
                }}
              >
                <RestartAltRoundedIcon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
          </>
        )}
      </Stack>

      <Box
        component="svg"
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        sx={{
          width: "100%", height: "auto", display: "block", borderRadius: 1,
          background: alpha("#fff", 0.03),
          border: `1px solid ${alpha("#fff", 0.1)}`,
          userSelect: "none", touchAction: "none",
          cursor: panning ? "grabbing" : "default",
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* 建物の外形（平面全体の枠） */}
          {data.buildingRect && (
            <rect
              x={sx(data.buildingRect.x0)} y={sy(data.buildingRect.z0)}
              width={Math.max(0, (data.buildingRect.x1 - data.buildingRect.x0) * scale)}
              height={Math.max(0, (data.buildingRect.z1 - data.buildingRect.z0) * scale)}
              fill={alpha("#fff", 0.03)} stroke={alpha("#fff", 0.35)} strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {/* 部屋の範囲（対象部屋はハイライト） */}
          {data.roomRects.map((r, i) => {
            const on = selectedRoomId && r.roomKey === selectedRoomId;
            return (
              <rect
                key={`rm${i}`}
                x={sx(r.x0)} y={sy(r.z0)}
                width={(r.x1 - r.x0) * scale} height={(r.z1 - r.z0) * scale}
                fill={on ? alpha(ACCENT, 0.1) : "transparent"}
                stroke={on ? alpha(ACCENT, 0.85) : alpha("#fff", 0.28)}
                strokeWidth={on ? 1.4 : 1}
                pointerEvents="none"
              />
            );
          })}

          {/* 展開図に映る範囲（記号位置〜見ている壁） */}
          {data.region && (
            <rect
              x={sx(data.region.x0)} y={sy(data.region.z0)}
              width={Math.max(0, (data.region.x1 - data.region.x0) * scale)}
              height={Math.max(0, (data.region.z1 - data.region.z0) * scale)}
              fill={alpha(ACCENT, 0.18)}
              stroke={alpha(ACCENT, 0.5)}
              strokeWidth={1}
              strokeDasharray="3 2"
              pointerEvents="none"
            />
          )}

          {/* ゾーン外形（対象部屋はハイライト） */}
          {data.zoneRects.map((r, i) => {
            const on = selectedRoomId && r.roomKey === selectedRoomId;
            return (
              <rect
                key={`z${i}`}
                x={sx(r.x0)} y={sy(r.z0)}
                width={(r.x1 - r.x0) * scale} height={(r.z1 - r.z0) * scale}
                fill={on ? alpha(ACCENT, 0.1) : "transparent"}
                stroke={on ? alpha(ACCENT, 0.8) : alpha("#fff", 0.3)}
                strokeWidth={on ? 1.4 : 1}
                pointerEvents="none"
              />
            );
          })}

          {/* 部屋名ラベル（記号は中心から四方へ散るので中心は空いている） */}
          {data.roomLabels.map((r) => (
            <text
              key={`r${r.id}`}
              x={sx(r.x)} y={sy(r.z) + 3}
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="700"
              fill={selectedRoomId === r.id ? alpha("#ffffff", 0.92) : alpha("#ffffff", 0.45)}
              pointerEvents="none"
            >
              {r.name.length > 9 ? `${r.name.slice(0, 8)}…` : r.name}
            </text>
          ))}

          {/* 見ている壁 */}
          {data.wall && (
            <line
              x1={sx(data.wall.x0)} y1={sy(data.wall.z0)}
              x2={sx(data.wall.x1)} y2={sy(data.wall.z1)}
              stroke={ACCENT} strokeWidth={3} strokeLinecap="round"
              pointerEvents="none"
            />
          )}

          {/* 展開の記号（クリックでその展開図を開く。サイズは画面固定） */}
          {data.markers.map((m) => {
            const on = m.id === activeElevationId;
            const inRoom = selectedRoomId && m.roomId === selectedRoomId;
            const cx = sx(m.x);
            const cy = sy(m.z);
            // 視線方向（画面座標）: A=上 / B=右 / C=下 / D=左
            const av = { A: [0, -1], B: [1, 0], C: [0, 1], D: [-1, 0] }[m.dir] || [0, -1];
            const r = on ? 7.5 : 6;
            const tip = r + 5.5;
            return (
              <g key={m.id} onClick={() => openElev(m)} style={{ cursor: "pointer" }}>
                <title>{`${m.label} を開く`}</title>
                {/* 視線方向の三角（どの壁を見る記号かが一目で分かる） */}
                <path
                  d={`M ${cx + av[0] * tip} ${cy + av[1] * tip}
                      L ${cx + av[0] * r + av[1] * 3.4} ${cy + av[1] * r + av[0] * 3.4}
                      L ${cx + av[0] * r - av[1] * 3.4} ${cy + av[1] * r - av[0] * 3.4} Z`}
                  fill={on ? ACCENT : alpha("#ffffff", inRoom ? 0.55 : 0.32)}
                />
                {/* クリック領域を広げる透明円 */}
                <circle cx={cx} cy={cy} r={11} fill="transparent" />
                <circle
                  cx={cx} cy={cy} r={r}
                  fill={on ? ACCENT : alpha("#0b1020", 0.85)}
                  stroke={on ? "#ffffff" : alpha("#ffffff", inRoom ? 0.6 : 0.35)}
                  strokeWidth={on ? 1.6 : 1.1}
                />
                <text
                  x={cx} y={cy + 2.6}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="800"
                  fill={on ? "#06263a" : alpha("#ffffff", inRoom ? 0.85 : 0.55)}
                  pointerEvents="none"
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </g>
      </Box>

      <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mt: 0.5, lineHeight: 1.5 }}>
        記号（A/B/C/D）クリックでその展開図へ。ホイールで拡大縮小・右ドラッグで移動。
      </Typography>
    </Box>
  );
}
