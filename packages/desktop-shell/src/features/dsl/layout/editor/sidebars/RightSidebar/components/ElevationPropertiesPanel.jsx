// ElevationPropertiesPanel — 展開図の Properties。
//   部屋（ゾーン）ごとに展開をネストで一覧し、追加・改名・削除・開くを行う。
//     部屋名
//       - 展開A
//       - 展開B
//       - 展開C
//       - 展開D
//       ＋ 追加
//   1展開＝1記号（平面図の独立マーカー）。向きは名前の基底文字で決まるため選択 UI は無い。
//   展開図を表示中は天井高（CL）の調整も出す。
import React, { useMemo, useState } from "react";
import { Box, Typography, Stack, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { useBuildingSpecStore } from "../../../../store/useBuildingSpecStore";
import { useElevationMarkerStore } from "../../../../store/useElevationMarkerStore";
import { useRoomElevationsStore } from "../../../../store/useRoomElevationsStore";
import { useLayoutTaskStore } from "../../../../store/useLayoutTaskStore";
import { openRoomElevation, computeElevationRooms } from "../../../../utils/openElevationView";
import ElevationPlanMiniMap from "./ElevationPlanMiniMap.jsx";

const DIR_JP = { A: "上", B: "右", C: "下", D: "左" };

const inputSx = {
  fontSize: 12,
  padding: "3px 6px",
  borderRadius: 4,
  border: `1px solid ${alpha("#fff", 0.15)}`,
  background: alpha("#000", 0.25),
  color: "var(--brand-fg)",
  outline: "none",
};

/** 展開1本ぶんの行（ネスト内）: 名前・開く・削除 */
function ElevationRow({ elev, isActive }) {
  const renameElevation = useRoomElevationsStore((s) => s.renameElevation);
  const removeElevation = useRoomElevationsStore((s) => s.removeElevation);
  const [draft, setDraft] = useState(elev.name);

  React.useEffect(() => { setDraft(elev.name); }, [elev.name]);

  const commitName = () => {
    const next = draft.trim();
    if (!next) { setDraft(elev.name); return; }
    if (next !== elev.name) renameElevation(elev.id, next);
  };

  return (
    <Stack
      direction="row" alignItems="center" spacing={0.5}
      sx={{
        pl: 1.25, pr: 0.5, py: 0.4, borderRadius: 1,
        borderLeft: `2px solid ${isActive ? "#38bdf8" : alpha("#fff", 0.12)}`,
        background: isActive ? alpha("#38bdf8", 0.1) : "transparent",
        "&:hover": { background: isActive ? alpha("#38bdf8", 0.14) : alpha("#fff", 0.05) },
      }}
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ ...inputSx, flex: 1, minWidth: 0, fontWeight: 700, background: "transparent", border: "1px solid transparent" }}
        onFocus={(e) => { e.currentTarget.style.border = `1px solid ${alpha("#fff", 0.2)}`; e.currentTarget.style.background = alpha("#000", 0.25); }}
        onBlurCapture={(e) => { e.currentTarget.style.border = "1px solid transparent"; e.currentTarget.style.background = "transparent"; }}
      />
      <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", flexShrink: 0 }}>
        {DIR_JP[elev.dir]}
      </Typography>
      <Tooltip title="この展開図を開く" arrow>
        <Box
          component="button" type="button"
          onClick={() => openRoomElevation(elev.id)}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 1, cursor: "pointer", flexShrink: 0,
            border: "none", background: "transparent",
            color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)",
            "&:hover": { background: alpha("#fff", 0.12), color: "var(--brand-fg)" },
          }}
        >
          <OpenInFullRoundedIcon sx={{ fontSize: 13 }} />
        </Box>
      </Tooltip>
      <Tooltip title="この展開を削除" arrow>
        <Box
          component="button" type="button"
          onClick={() => removeElevation(elev.id)}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 1, cursor: "pointer", flexShrink: 0,
            border: "none", background: "transparent",
            color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
            "&:hover": { background: alpha("#f87171", 0.2), color: "#fecaca" },
          }}
        >
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
        </Box>
      </Tooltip>
    </Stack>
  );
}

/** 部屋1つぶんのブロック: 部屋名 → 展開のネスト → 追加 */
function RoomBlock({ room, elevations, selected, activeElevationId }) {
  const selectRoom = useRoomElevationsStore((s) => s.selectRoom);
  const addElevation = useRoomElevationsStore((s) => s.addElevation);

  return (
    <Box
      sx={{
        p: 0.9, borderRadius: 1.25,
        border: `1px solid ${selected ? alpha("#38bdf8", 0.45) : alpha("#fff", 0.08)}`,
        background: selected ? alpha("#38bdf8", 0.06) : alpha("#fff", 0.02),
      }}
    >
      {/* 部屋名（クリックで選択。平面図の記号ハイライトと連動） */}
      <Stack
        direction="row" alignItems="center" spacing={0.6}
        onClick={() => selectRoom(room.id)}
        sx={{ cursor: "pointer", mb: 0.5, "&:hover .room-name": { color: "var(--brand-fg)" } }}
      >
        <VisibilityRoundedIcon sx={{ fontSize: 13, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }} />
        <Typography
          className="room-name"
          sx={{ fontSize: 12.5, fontWeight: 800, color: selected ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}
        >
          {room.name || "（名称未設定）"}
        </Typography>
        {room.zones?.length > 1 && (
          <Typography sx={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
            {room.zones.length}ゾーン
          </Typography>
        )}
      </Stack>

      {/* 展開のネスト */}
      <Stack spacing={0.25} sx={{ mb: 0.5 }}>
        {elevations.length === 0 ? (
          <Typography sx={{ pl: 1.25, fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
            展開がありません
          </Typography>
        ) : (
          elevations.map((e) => (
            <ElevationRow key={e.id} elev={e} isActive={activeElevationId === e.id} />
          ))
        )}
      </Stack>

      {/* 追加（同じ向きの2本目は 展開A' のように増える） */}
      <Box
        component="button" type="button"
        onClick={() => { selectRoom(room.id); addElevation(room.id); }}
        sx={{
          display: "flex", alignItems: "center", gap: 0.4,
          ml: 1.25, px: 0.7, height: 22, borderRadius: 1, cursor: "pointer",
          fontSize: 10.5, fontWeight: 800, fontFamily: "inherit",
          border: `1px dashed ${alpha("#fff", 0.2)}`, background: "transparent",
          color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)",
          "&:hover": { background: alpha("#fff", 0.08), color: "var(--brand-fg)" },
        }}
      >
        <AddRoundedIcon sx={{ fontSize: 13 }} />
        追加
      </Box>
    </Box>
  );
}

export default function ElevationPropertiesPanel() {
  const viewActive = useElevationMarkerStore((s) => s.viewActive);
  const ceilingHeightMm = useBuildingSpecStore((s) => s.ceilingHeightMm);
  const setCeilingHeightMm = useBuildingSpecStore((s) => s.setCeilingHeightMm);

  const zones = useLayoutTaskStore((s) => s.zones);
  const roomsList = useLayoutTaskStore((s) => s.rooms);
  const elevations = useRoomElevationsStore((s) => s.elevations);
  const selectedRoomId = useRoomElevationsStore((s) => s.selectedRoomId);
  const activeElevationId = useRoomElevationsStore((s) => s.activeElevationId);

  // 部屋 = Room（roomId でゾーンを束ねる。roomId 無しゾーンは単体で1部屋）
  const rooms = useMemo(() => computeElevationRooms(zones, roomsList), [zones, roomsList]);
  // 選択中の部屋を先頭に（記号クリックで来たとき目当ての部屋がすぐ見えるように）
  const orderedRooms = useMemo(() => {
    if (!selectedRoomId) return rooms;
    const sel = rooms.find((r) => r.id === selectedRoomId);
    return sel ? [sel, ...rooms.filter((r) => r.id !== selectedRoomId)] : rooms;
  }, [rooms, selectedRoomId]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* 平面ミニマップ（記号クリックで展開切替。スクロールしても上部に固定） */}
      {rooms.length > 0 && (
        <Box sx={{ p: 1.5, pb: 1.25, flexShrink: 0, borderBottom: `1px solid ${alpha("#fff", 0.08)}` }}>
          <ElevationPlanMiniMap />
        </Box>
      )}

      <Box sx={{ p: 1.5, flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Stack spacing={1.25}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
          展開図
        </Typography>

        {rooms.length === 0 ? (
          <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", lineHeight: 1.6 }}>
            まだゾーンがありません。ゾーンを作ると部屋ごとに展開記号（既定で A〜D）が置かれます。
          </Typography>
        ) : (
          orderedRooms.map((room) => (
            <RoomBlock
              key={room.id}
              room={room}
              elevations={elevations.filter((e) => e.roomId === room.id)}
              selected={selectedRoomId === room.id}
              activeElevationId={activeElevationId}
            />
          ))
        )}

        {/* 天井高（CL）: 展開図を表示中のみ */}
        {viewActive && (
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, mb: 0.75, color: "color-mix(in srgb, var(--brand-fg) 80%, transparent)" }}>
              天井高（CL）
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>CL</Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <input
                  type="number" value={ceilingHeightMm} min={1800} max={6000} step={50}
                  onChange={(e) => setCeilingHeightMm(Number(e.target.value))}
                  style={{ ...inputSx, width: 72, textAlign: "right" }}
                />
                <Typography sx={{ fontSize: 10.5, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>mm</Typography>
              </Stack>
            </Stack>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", lineHeight: 1.5, mt: 0.75 }}>
              展開図では天井高（CL）のみを扱います。GL・階高・FL は断面図で調整してください。
              ビュー上では左の全高ラベル（例:「2400」）をダブルクリックしても調整できます。
              他の寸法もダブルクリックで手入力に上書きできます（mm 単位）。
            </Typography>
          </Box>
        )}
      </Stack>
      </Box>
    </Box>
  );
}
