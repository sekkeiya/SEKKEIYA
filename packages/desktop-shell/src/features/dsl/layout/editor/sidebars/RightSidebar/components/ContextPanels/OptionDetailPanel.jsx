import React, { useState, useEffect } from "react";
import { Box, Typography, Button, TextField, List, ListItem, Divider, IconButton, Collapse, Select, MenuItem } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import CheckIcon from "@mui/icons-material/Check";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useLayoutTaskStore } from "../../../../../store/useLayoutTaskStore";
import { useZoningStore } from "../../../../../store/useZoningStore";
import { useRoomCreateToolStore } from "../../../../../store/useRoomCreateToolStore";
import { useEditorModeStore } from "../../../../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../../../../store/useBuildingSpecStore";
import { useAutoLayoutStore } from "../../../../../store/useAutoLayoutStore";
import { getRoomCategories } from "../../../../../constants/roomCategories";
import { computeBuildingCenterXZ } from "../../../../../store/useElevationMarkerStore";

// 用途（建物タイプ）。spaceProgram.buildingType に永続化され、部屋カテゴリ語彙・
// 自動ゾーニング・自動レイアウトが同じ値を参照する。
const BUILDING_TYPES = [
  { key: "residential", label: "住宅" },
  { key: "office", label: "オフィス" },
  { key: "cafe", label: "カフェ" },
  { key: "hotel", label: "ホテル" },
];

/** 名前の入力エディタ（自由入力＋カテゴリ候補チップ）。部屋名・ゾーン名の両方で使う。
 *  候補チップをクリックすると即コミット（category メタ付き）。Enter で自由入力をコミット。 */
const NameEditor = ({ initial = "", placeholder, candidates, onCommit, onCancel }) => {
  const [value, setValue] = useState(initial);

  const commitFree = () => {
    const name = value.trim();
    if (!name) { onCancel?.(); return; }
    // 自由入力でも候補と同名ならカテゴリメタを付ける
    const hit = candidates.find((c) => c.label === name);
    onCommit(name, hit || null);
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      <TextField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitFree();
          if (e.key === "Escape") onCancel?.();
        }}
        autoFocus size="small" variant="standard" placeholder={placeholder}
        sx={{ input: { fontSize: 12.5, fontWeight: 700, color: "var(--brand-fg)", py: 0.25 }, width: "100%" }}
      />
      {/* 候補（用途の部屋カテゴリ語彙）。クリックで即決定 */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mt: 0.6, mb: 0.4 }}>
        {candidates.map((c) => (
          <Box
            key={c.key}
            onClick={() => onCommit(c.label, c)}
            sx={{
              px: 0.7, py: 0.2, borderRadius: 999, cursor: "pointer", userSelect: "none",
              fontSize: 10, fontWeight: 700,
              color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)",
              background: alpha("#fff", 0.06), border: `1px solid ${alpha("#fff", 0.12)}`,
              "&:hover": { background: alpha("#38bdf8", 0.2), borderColor: alpha("#38bdf8", 0.5), color: "var(--brand-fg)" },
            }}
          >
            {c.icon} {c.label}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Button size="small" onClick={commitFree} sx={{ fontSize: 10.5, py: 0, px: 1, textTransform: "none" }}>決定</Button>
        <Button size="small" onClick={() => onCancel?.()} sx={{ fontSize: 10.5, py: 0, px: 1, textTransform: "none", color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }}>キャンセル</Button>
      </Box>
    </Box>
  );
};

const ZoneColorPicker = React.memo(({ zoneId, initialColor }) => {
  const inputRef = React.useRef(null);
  const [color, setColor] = useState(initialColor || "#cccccc");

  React.useEffect(() => {
    setColor(initialColor || "#cccccc");
  }, [initialColor]);

  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleInput = (e) => {
      setColor(e.target.value); // Real-time local state update
    };

    const handleChange = (e) => {
      // Fires only when the user *commits* the color (closes picker / releases mouse)
      window.dispatchEvent(
        new CustomEvent("LayoutShell:UpdateZone", {
          detail: { id: zoneId, color: e.target.value, __merge: true, __noPersist: false },
        })
      );
    };

    el.addEventListener("input", handleInput);
    el.addEventListener("change", handleChange);
    
    return () => {
      el.removeEventListener("input", handleInput);
      el.removeEventListener("change", handleChange);
    };
  }, [zoneId]);

  return (
    <input
      ref={inputRef}
      type="color"
      value={color}
      onChange={() => {}} // Dummy so React doesn't complain
      onClick={(e) => e.stopPropagation()}
      title="Change Color"
      style={{
        width: 20,
        height: 20,
        padding: 0,
        border: "none",
        cursor: "pointer",
        backgroundColor: "transparent",
        flexShrink: 0
      }}
    />
  );
});

const ZoneListItem = ({ z, activeZoneId }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: z.id });
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(z.name || "");
  const [expanded, setExpanded] = useState(false);
  
  const hiddenZoneIds = useZoningStore((s) => s.hiddenZoneIds);
  const toggleZoneVisibility = useZoningStore((s) => s.toggleZoneVisibility);
  const isHidden = !!hiddenZoneIds[z.id];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const versions = z.versions || [];
  const sortedVersions = [...versions].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const effectiveActiveVersionId = z.activeVersionId || sortedVersions[0]?.id;

  const handleUpdate = (updates, options = {}) => {
    window.dispatchEvent(
      new CustomEvent("LayoutShell:UpdateZone", {
        detail: { id: z.id, ...updates, __merge: true, __noPersist: options.noPersist },
      })
    );
  };

  const handleNameCommit = () => {
    setIsEditing(false);
    if (name.trim() && name.trim() !== z.name) {
      handleUpdate({ name: name.trim() });
    } else {
      setName(z.name || "");
    }
  };

  const isActive = activeZoneId === z.id;

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        px: 1,
        py: 0.5,
        mb: 0.5,
        borderRadius: 1,
        bgcolor: isActive ? alpha("#38bdf8", 0.15) : "transparent",
        "&:hover": { bgcolor: isActive ? alpha("#38bdf8", 0.25) : alpha("#fff", 0.05) },
        "&:hover .zone-delete-btn": { opacity: 1 },
        cursor: "pointer",
        transition: "background-color 0.2s"
      }}
      onClick={() => {
        useLayoutTaskStore.getState().setActiveZoneId(z.id);
        if (versions.length > 0) setExpanded(true);
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <Box sx={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, overflow: "hidden" }}>
            <IconButton size="small" {...attributes} {...listeners} sx={{ p: 0.5, ml: -0.5, cursor: "grab" }} onClick={(e) => e.stopPropagation()}>
              <DragIndicatorIcon sx={{ fontSize: 16, opacity: 0.5 }} />
            </IconButton>
            
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              sx={{ p: 0, opacity: versions.length ? 0.8 : 0.2 }}
              disabled={versions.length === 0}
            >
              {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </IconButton>

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleZoneVisibility(z.id);
              }}
              sx={{
                p: 0,
                opacity: isHidden ? 0.6 : 0.3,
                "&:hover": { opacity: 1 },
                color: isHidden ? "text.secondary" : "inherit"
              }}
            >
              {isHidden ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
            </IconButton>

            <ZoneColorPicker zoneId={z.id} initialColor={z.color} />

          {isEditing ? (
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameCommit();
                if (e.key === "Escape") {
                  setName(z.name || "");
                  setIsEditing(false);
                }
              }}
              autoFocus
              size="small"
              variant="standard"
              sx={{ input: { fontSize: 13, color: "var(--brand-fg)", py: 0 }, flex: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "light-dark(#0676a8, #38bdf8)" : "inherit",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setName(z.name || "");
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              {z.name}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 1 }}>

          <IconButton
            size="small"
            title="Save Layout Version"
            onClick={(e) => {
              e.stopPropagation();
              if (z.id) {
                window.dispatchEvent(
                  new CustomEvent("LayoutShell:SaveZoneVersion", {
                    detail: { zoneId: z.id },
                  })
                );
                setExpanded(true);
              }
            }}
            sx={{
              p: 0.25,
              opacity: 0.6,
              transition: "opacity 0.2s",
              "&:hover": { opacity: 1, color: "light-dark(#0676a8, #38bdf8)", bgcolor: alpha("#38bdf8", 0.1) },
            }}
          >
            <SaveOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            className="zone-delete-btn"
            size="small"
            title="Delete Zone"
            onClick={(e) => {
              e.stopPropagation();
              if (z.id) {
                window.dispatchEvent(
                  new CustomEvent("LayoutShell:DeleteZone", {
                    detail: { id: z.id },
                  })
                );
              }
            }}
            sx={{
              p: 0.25,
              opacity: 0.3,
              transition: "opacity 0.2s",
              color: "error.light",
              "&:hover": { color: "error.main", bgcolor: alpha("#f44336", 0.1) },
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit sx={{ width: "100%" }}>
        <List component="div" disablePadding sx={{ mt: 1, mb: 0.5 }}>
          {sortedVersions.map((v, index) => (
            <ListItem
              key={v.id}
              component="div"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("LayoutShell:LoadZoneVersion", {
                    detail: { zoneId: z.id, versionId: v.id },
                  })
                );
              }}
              sx={{
                py: 0.5,
                px: 1,
                pl: 4,
                borderRadius: 1,
                mb: 0.5,
                bgcolor: alpha("#fff", 0.03),
                cursor: "pointer",
                transition: "background-color 0.2s",
                "&:hover": { bgcolor: alpha("#fff", 0.08) },
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="caption" sx={{ flex: 1, color: "rgb(var(--brand-fg-rgb) / 0.65)", display: "flex", alignItems: "center", gap: 0.5 }}>
                {effectiveActiveVersionId === v.id && <CheckIcon sx={{ fontSize: 14, color: "#4caf50" }} />}
                v{sortedVersions.length - index}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <IconButton
                  size="small"
                  title="Overwrite version"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("LayoutShell:OverwriteZoneVersion", {
                        detail: { zoneId: z.id, versionId: v.id },
                      })
                    );
                  }}
                  sx={{ p: 0.25, "&:hover": { color: "warning.main" } }}
                >
                  <SaveOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  title="Load version"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("LayoutShell:LoadZoneVersion", {
                        detail: { zoneId: z.id, versionId: v.id },
                      })
                    );
                  }}
                  sx={{ p: 0.25, "&:hover": { color: "#4caf50" } }}
                >
                  <SettingsBackupRestoreIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  title="Delete version"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("LayoutShell:DeleteZoneVersion", {
                        detail: { zoneId: z.id, versionId: v.id },
                      })
                    );
                  }}
                  sx={{ p: 0.25, "&:hover": { color: "error.main" } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </ListItem>
          ))}
        </List>
      </Collapse>
      </Box>
    </ListItem>
  );
};

const PatternListItem = ({ p, activeCirculationPatternId, circulationPatterns, onPatternClick, onDeletePattern }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(p.name || "");

  const hiddenPatternIds = useZoningStore((s) => s.hiddenPatternIds);
  const togglePatternVisibility = useZoningStore((s) => s.togglePatternVisibility);
  const isHidden = !!hiddenPatternIds[p.id];

  const isActive = activeCirculationPatternId === p.id;

  const handleNameCommit = () => {
    setIsEditing(false);
    if (name.trim() && name.trim() !== p.name) {
      const newPatterns = circulationPatterns.map(pattern => 
        pattern.id === p.id ? { ...pattern, name: name.trim() } : pattern
      );
      window.dispatchEvent(new CustomEvent("LayoutShell:UpdateActivePattern", { detail: { patternId: activeCirculationPatternId, newPatterns } }));
    } else {
      setName(p.name || "");
    }
  };

  return (
    <ListItem
      sx={{
        px: 1,
        py: 0.5,
        mb: 0.5,
        borderRadius: 1,
        bgcolor: isActive ? alpha("#a855f7", 0.15) : "transparent",
        "&:hover": { bgcolor: isActive ? alpha("#a855f7", 0.25) : alpha("#fff", 0.05) },
        "&:hover .pattern-delete-btn": { opacity: 1 },
        cursor: "pointer",
        transition: "background-color 0.2s"
      }}
      onClick={() => onPatternClick(p.id)}
    >
      <Box sx={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, overflow: "hidden" }}>
          <IconButton
            size="small"
            title="Toggle Visibility"
            onClick={(e) => {
              e.stopPropagation();
              togglePatternVisibility(p.id);
            }}
            sx={{
              p: 0,
              opacity: isHidden ? 0.6 : 0.3,
              "&:hover": { opacity: 1 },
              color: isHidden ? "text.secondary" : "inherit",
              mr: 0.5
            }}
          >
            {isHidden ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          
          {isEditing ? (
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameCommit();
                if (e.key === "Escape") {
                  setName(p.name || "");
                  setIsEditing(false);
                }
              }}
              autoFocus
              size="small"
              variant="standard"
              sx={{ input: { fontSize: 13, color: "var(--brand-fg)", py: 0 }, flex: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "light-dark(#5908a6, #a855f7)" : "inherit",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setName(p.name || "");
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              {p.name}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 0.5 }}>
          <IconButton
            className="pattern-delete-btn"
            size="small"
            title="Delete Pattern"
            onClick={(e) => onDeletePattern(e, p.id)}
            disabled={circulationPatterns.length <= 1}
            sx={{
              p: 0.25,
              opacity: 0.3,
              transition: "opacity 0.2s",
              color: "error.light",
              "&:hover": { color: "error.main", bgcolor: alpha("#f44336", 0.1) },
              "&.Mui-disabled": { opacity: 0, pointerEvents: "none" }
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </ListItem>
  );
};

/** 部屋（Room）1つぶんのグループ: 部屋名ヘッダ ＋ 所属ゾーンのネスト ＋ ＋ゾーン。
 *  ゾーンの並べ替え（DnD）はグループ内のみ。
 *  部屋名はダブルクリックで改名（自由入力＋カテゴリ候補。Room マスタに永続化。
 *  マスタに無い部屋＝ゾーンの roomId だけの擬似グループは、改名時にマスタへ昇格させる）。 */
const RoomGroup = ({ group, activeZoneId, sensors, onGroupDragEnd, rooms, candidates, allowAddZone = true }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingZone, setIsAddingZone] = useState(false);

  const commitRoomName = (name) => {
    setIsEditing(false);
    if (!name || name === group.name) return;
    const exists = rooms.some((r) => r.id === group.id);
    const newRooms = exists
      ? rooms.map((r) => (r.id === group.id ? { ...r, name } : r))
      // 擬似グループをマスタへ昇格。階はグループが持つ floorIndex（＝所属ゾーンの階）を継承。
      : [...rooms, { id: group.id, name, floorIndex: group.floorIndex ?? 0, createdAtMs: Date.now() }];
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateRooms", { detail: { rooms: newRooms } }));
  };

  // ゾーン作成（選択式 or 自由入力）。矩形は既存ゾーンの右隣（無ければ建物中心）に既定サイズで置き、
  // あとはギズモ/ドラッグで調整してもらう。
  const commitNewZone = (name, category) => {
    setIsAddingZone(false);
    if (!name) return;
    const isMm = (useEditorModeStore.getState().sceneMaxY || 0) > 100;
    const size = isMm ? 2700 : 2.7;
    const gap = isMm ? 300 : 0.3;
    let cx, cz;
    const last = group.zones[group.zones.length - 1];
    if (last?.rect) {
      cx = last.rect.x + (last.rect.width || 0) / 2 + size / 2 + gap;
      cz = last.rect.z;
    } else {
      const c = computeBuildingCenterXZ();
      cx = c.x; cz = c.z;
    }
    window.dispatchEvent(new CustomEvent("LayoutShell:AddZone", {
      detail: {
        id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        roomId: group.id === "__unassigned__" ? null : group.id,
        name,
        targetSeats: 0,
        category: category?.key ?? null,
        color: category?.color || "rgb(var(--brand-fg-rgb) / 0.65)",
        rect: { x: cx, z: cz, width: size, depth: size },
        // ゾーンは所属部屋と同じ階に置く（部屋の floorIndex を継承）。
        floorIndex: group.floorIndex ?? 0,
        createdBy: "user",
        createdAtMs: Date.now(),
      },
    }));
  };

  return (
    <Box sx={{ mb: 1 }}>
      {/* 部屋名ヘッダ */}
      <Box sx={{ px: 0.5, py: 0.25 }}>
        {isEditing ? (
          <NameEditor
            initial={group.name || ""}
            placeholder="部屋名"
            candidates={candidates}
            onCommit={(name) => commitRoomName(name)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              sx={{ fontSize: 12.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)", flex: 1 }}
              onDoubleClick={() => { if (group.id !== "__unassigned__") setIsEditing(true); }}
              title={group.id !== "__unassigned__" ? "ダブルクリックで部屋名を変更" : undefined}
            >
              {group.name || "（名称未設定）"}
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
              {group.zones.length ? `${group.zones.length}ゾーン` : "ゾーン未割当"}
            </Typography>
            {/* 部屋の削除: 部屋マスタ＋所属ゾーンをまとめて消す（展開図は部屋が消えると自動掃除）。
                「未割当」の擬似グループは部屋マスタが無いので出さない。 */}
            {group.id !== "__unassigned__" && (
              <IconButton
                size="small"
                onClick={async () => {
                  const zoneCount = group.zones.length;
                  if (zoneCount > 0) {
                    // Tauri の confirm は Promise を返す実装があり得るので両対応にする
                    let res = window.confirm(`部屋「${group.name}」と所属する${zoneCount}ゾーンを削除しますか？`);
                    if (res && typeof res.then === "function") res = await res;
                    if (!res) return;
                  }
                  const st = useLayoutTaskStore.getState();
                  // ゾーン → 部屋マスタの順で消す（部屋だけ消すとゾーンが「未割当」に残ってしまう）
                  const zoneIds = new Set(group.zones.map((z) => z.id));
                  window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", {
                    detail: { zones: (st.zones || []).filter((z) => !zoneIds.has(z.id)) },
                  }));
                  window.dispatchEvent(new CustomEvent("LayoutShell:UpdateRooms", {
                    detail: { rooms: (st.rooms || []).filter((r) => r.id !== group.id) },
                  }));
                }}
                title={`部屋「${group.name}」を削除`}
                sx={{ p: 0.25, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", "&:hover": { color: "#f87171" } }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>

      {/* 所属ゾーン（ネスト・グループ内 DnD）＋ ＋ゾーン */}
      <Box sx={{ pl: 1, borderLeft: `2px solid ${alpha("#fff", 0.1)}`, ml: 0.75 }}>
        {group.zones.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onGroupDragEnd(group.zones, e)}>
            <SortableContext items={group.zones.map((z) => z.id)} strategy={verticalListSortingStrategy}>
              <List sx={{ p: 0 }}>
                {group.zones.map((z) => (
                  <ZoneListItem key={z.id} z={z} activeZoneId={activeZoneId} />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        )}

        {allowAddZone && (
          isAddingZone ? (
            <Box sx={{ px: 0.5, py: 0.5 }}>
              <NameEditor
                placeholder="ゾーン名"
                candidates={candidates}
                onCommit={commitNewZone}
                onCancel={() => setIsAddingZone(false)}
              />
            </Box>
          ) : (
            <Box
              component="button" type="button"
              onClick={() => setIsAddingZone(true)}
              sx={{
                display: "flex", alignItems: "center", gap: 0.4,
                px: 0.7, height: 20, mt: 0.25, borderRadius: 1, cursor: "pointer",
                fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                border: `1px dashed ${alpha("#fff", 0.18)}`, background: "transparent",
                color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)",
                "&:hover": { background: alpha("#fff", 0.07), color: "var(--brand-fg)" },
              }}
            >
              <AddIcon sx={{ fontSize: 12 }} />
              ゾーン
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

export default function OptionDetailPanel({ optionDoc, optionDocLoading, onAddZone }) {
  const [newZoneName, setNewZoneName] = useState("");
  const [newPatternName, setNewPatternName] = useState("");
  const activeZoneId = useLayoutTaskStore((s) => s.activeZoneId);
  const zones = useLayoutTaskStore((s) => s.zones) || [];
  const rooms = useLayoutTaskStore((s) => s.rooms) || [];
  const circulationPatterns = useLayoutTaskStore((s) => s.circulationPatterns) || [];
  const buildingType = useAutoLayoutStore((s) => s.buildingType);

  // 部屋（Room）→ ゾーンのグルーピング。
  //   - Room マスタの部屋（ゾーン0件＝部屋のみ、も表示する）
  //   - マスタに無い roomId を持つゾーン群も部屋として出す（データ欠落への保険）
  //   - roomId 無しのゾーンは「未分類」へ
  const { roomGroups, unassignedZones } = React.useMemo(() => {
    const byRoom = new Map();
    const unassigned = [];
    zones.forEach((z) => {
      if (z.roomId) {
        if (!byRoom.has(z.roomId)) byRoom.set(z.roomId, []);
        byRoom.get(z.roomId).push(z);
      } else {
        unassigned.push(z);
      }
    });
    // 部屋の階は Room マスタの floorIndex を正とし、無ければ所属ゾーンから拾う（既存データの保険）。
    const groups = rooms.map((r) => ({
      id: r.id, name: r.name, inMaster: true,
      floorIndex: r.floorIndex ?? (byRoom.get(r.id)?.[0]?.floorIndex ?? 0),
      zones: byRoom.get(r.id) || [],
    }));
    byRoom.forEach((zs, roomId) => {
      if (!rooms.some((r) => r.id === roomId)) {
        groups.push({ id: roomId, name: zs[0]?.name || "（部屋）", floorIndex: zs[0]?.floorIndex ?? 0, zones: zs, inMaster: false });
      }
    });
    return { roomGroups: groups, unassignedZones: unassigned };
  }, [zones, rooms]);

  // 階ごとに部屋をまとめる（階見出し → 部屋 → ゾーン の3階層表示用）。
  //   建物に定義済みの階（floors）はすべて見出しを出し、部屋が無ければ「部屋なし」と示す。
  //   部屋側にしか無い階（データ不整合の保険）も拾う。
  const specFloors = useBuildingSpecStore((s) => s.floors);
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex) || 0;
  const floorGroups = React.useMemo(() => {
    const byFloor = new Map();
    roomGroups.forEach((g) => {
      const fi = g.floorIndex ?? 0;
      if (!byFloor.has(fi)) byFloor.set(fi, []);
      byFloor.get(fi).push(g);
    });
    const floorCount = Math.max(1, specFloors?.length || 1);
    const indices = new Set();
    for (let i = 0; i < floorCount; i++) indices.add(i);
    byFloor.forEach((_v, k) => indices.add(k));
    return [...indices].sort((a, b) => a - b).map((fi) => ({
      floorIndex: fi,
      label: specFloors?.[fi]?.name || `${fi + 1}F`,
      groups: byFloor.get(fi) || [],
    }));
  }, [roomGroups, specFloors]);
  
  // Store actions for creating zones and circulations
  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const setZoningSubMode = useZoningStore((s) => s.setZoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);
  const setIsZoningActionSelect = useZoningStore((s) => s.setIsZoningActionSelect);

  // 「自動部屋作成」ツール: 構えている間、平面図で床をクリックするとその輪郭から
  // 部屋（Room＋Zone）が作られ、展開A〜Dの記号が自動で生える。連続クリック可。
  const roomToolActive = useRoomCreateToolStore((s) => s.active);
  const setRoomToolActive = useRoomCreateToolStore((s) => s.setActive);
  useEffect(() => {
    if (!roomToolActive) return;
    const onKey = (e) => { if (e.key === "Escape") setRoomToolActive(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // パネルごと閉じたときも構えっぱなしにしない
      useRoomCreateToolStore.getState().setActive(false);
    };
  }, [roomToolActive, setRoomToolActive]);

  const activeCirculationPatternId = useLayoutTaskStore((s) => s.activeCirculationPatternId);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const selectedCirculationId = useZoningStore((s) => s.selectedCirculationId);
  const circulations = useLayoutTaskStore((s) => s.circulations) || [];
  const selectedCirc = circulations.find((c) => c.id === selectedCirculationId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 部屋・ゾーン名の候補 = 用途に応じた部屋カテゴリ語彙（住宅なら LDK/寝室…）
  // ⚠️ フックは必ず下の early return（Loading / No Option）より前に置くこと。
  //   後ろに置くと「ロード中（少ないフック数）→ ロード完了（多いフック数）」の再レンダーで
  //   "Rendered more hooks than during the previous render" でクラッシュする。
  const nameCandidates = React.useMemo(() => getRoomCategories(buildingType), [buildingType]);
  // ＋部屋: Room マスタへ追加（ゾーンはあとから ＋ゾーン or 平面で描画して割り当て）
  const [isAddingRoom, setIsAddingRoom] = useState(false);

  if (optionDocLoading) return <Box p={2}><Typography fontSize={12}>Loading Option...</Typography></Box>;
  if (!optionDoc) return <Box p={2}><Typography fontSize={12}>No Option Selected</Typography></Box>;

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    onAddZone?.({
      id: `zone_${Date.now()}`,
      name: newZoneName.trim(),
      targetSeats: 0,
      color: "rgb(var(--brand-fg-rgb) / 0.65)", // Default color
    });
    setNewZoneName("");
  };

  const handleAddPattern = () => {
    if (!newPatternName.trim()) return;
    const newId = `pattern-${Date.now()}`;
    const newPattern = {
      id: newId,
      name: newPatternName.trim(),
      circulations: [],
      createdAtMs: Date.now()
    };
    const newPatterns = [...circulationPatterns, newPattern];
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateActivePattern", { detail: { patternId: newId, newPatterns } }));
    setNewPatternName("");
  };

  const handleDeletePattern = (e, patternId) => {
    e.stopPropagation();
    if (circulationPatterns.length <= 1) return; // Cannot delete the last pattern
    const newPatterns = circulationPatterns.filter(p => p.id !== patternId);
    const nextActiveId = activeCirculationPatternId === patternId ? newPatterns[0].id : activeCirculationPatternId;
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateActivePattern", { detail: { patternId: nextActiveId, newPatterns } }));
  };

  const handlePatternClick = (patternId) => {
    if (activeCirculationPatternId === patternId) return;
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateActivePattern", { detail: { patternId } }));
  };

  const updateSelectedCirc = (updates) => {
    if (!selectedCirculationId) return;
    const nextCircs = circulations.map((c) => (c.id === selectedCirculationId ? { ...c, ...updates } : c));
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
  };

  const deleteSelectedCirc = () => {
    if (!selectedCirculationId) return;
    const nextCircs = circulations.filter((c) => c.id !== selectedCirculationId);
    useZoningStore.getState().setSelectedCirculationId(null);
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
  };

  // グループ（部屋 or 未分類）内での並べ替え。グループ外のゾーンの位置は保ったまま、
  // グループ所属分だけを新しい順序で元の位置に埋め戻す。
  const handleGroupDragEnd = (groupZones, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupZones.findIndex((z) => z.id === active.id);
    const newIndex = groupZones.findIndex((z) => z.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(groupZones, oldIndex, newIndex);
    const groupIds = new Set(groupZones.map((z) => z.id));
    let i = 0;
    const newZones = zones.map((z) => (groupIds.has(z.id) ? reordered[i++] : z));
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", { detail: { zones: newZones } }));
  };

  const handleBuildingTypeChange = (key) => {
    if (key === buildingType) return;
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateBuildingType", { detail: { buildingType: key } }));
  };

  const commitNewRoom = (name) => {
    setIsAddingRoom(false);
    if (!name) return;
    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name,
      // ＋部屋はそのときのアクティブ階に作る。
      floorIndex: useBuildingSpecStore.getState().activeFloorIndex || 0,
      createdAtMs: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateRooms", { detail: { rooms: [...rooms, newRoom] } }));
  };

  return (
    // スクロールは親（PropertiesPanel のコンテンツ領域）に任せる。
    // 躯体編集中はこの下に BaseRoomPanel が縦に続くため、ここで高さを取らない。
    <Box sx={{ p: 0, color: "rgb(var(--brand-fg-rgb) / 0.9)" }}>
      {/* ── 用途（建物タイプ）。部屋カテゴリ語彙・自動ゾーニング/レイアウトの基準 ── */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontWeight: 600, mb: 0.5 }}>
          用途
        </Typography>
        <Select
          size="small"
          value={buildingType || "residential"}
          onChange={(e) => handleBuildingTypeChange(e.target.value)}
          sx={{
            width: "100%",
            height: 32,
            color: "var(--brand-fg)",
            fontSize: 13,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.2) },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.4) },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.6) },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: "var(--brand-surface2)",
                border: `1px solid ${alpha("#fff", 0.1)}`,
                "& .MuiMenuItem-root": { fontSize: 13, color: "var(--brand-fg)" },
              },
            },
          }}
        >
          {BUILDING_TYPES.map((t) => (
            <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
          ))}
        </Select>
      </Box>

      <Divider sx={{ my: 1.5, borderColor: alpha("#fff", 0.1) }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontWeight: 600 }}>
          部屋・ゾーン
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setIsAddingRoom((v) => !v)}
            startIcon={<AddIcon />}
            sx={{ fontSize: 11, py: 0, px: 1, textTransform: 'none', borderColor: alpha("#fff", 0.2) }}
          >
            部屋
          </Button>
          {/* 自動部屋作成: 構えて平面図の床をクリック → 床の輪郭から部屋を作成（展開記号も自動生成）。
              連続クリックで各部屋を作れる。もう一度押すか Esc で解除。 */}
          <Button
            size="small"
            variant={roomToolActive ? "contained" : "outlined"}
            color={roomToolActive ? "primary" : "inherit"}
            onClick={() => {
              const next = !roomToolActive;
              setRoomToolActive(next);
              if (next) setIsZoningActionSelect(true); // ゾーン描画と同時に構えない
            }}
            startIcon={<AddIcon />}
            title="平面図で床をクリックすると、その輪郭から部屋が作られ展開記号が表示されます（連続クリック可 / Escで解除）"
            sx={{ fontSize: 11, py: 0, px: 1, textTransform: 'none', borderColor: alpha("#fff", 0.2) }}
          >
            {roomToolActive ? "床をクリック..." : "自動部屋作成"}
          </Button>
          <Button
            size="small"
            variant={(!isZoningActionSelect && zoningSubMode === "zone") ? "contained" : "outlined"}
            color={(!isZoningActionSelect && zoningSubMode === "zone") ? "primary" : "inherit"}
            onClick={() => {
              if (!isZoningActionSelect && zoningSubMode === "zone") {
                setIsZoningActionSelect(true); // Toggle off (back to select mode)
              } else {
                setZoningSubMode("zone");
                setIsZoningActionSelect(false);
                setRoomToolActive(false); // 自動部屋作成と同時に構えない
              }
            }}
            startIcon={<AddIcon />}
            sx={{ fontSize: 11, py: 0, px: 1, textTransform: 'none', borderColor: alpha("#fff", 0.2) }}
          >
            {(!isZoningActionSelect && zoningSubMode === "zone") ? "描画中..." : "ゾーン描画"}
          </Button>
        </Box>
      </Box>

      {/* ＋部屋: 名前（自由入力＋カテゴリ候補）だけで Room を作成 */}
      {isAddingRoom && (
        <Box sx={{ px: 0.5, py: 0.5, mb: 0.5, borderRadius: 1, border: `1px dashed ${alpha("#fff", 0.15)}` }}>
          <NameEditor
            placeholder="部屋名（例: LDK）"
            candidates={nameCandidates}
            onCommit={(name) => commitNewRoom(name)}
            onCancel={() => setIsAddingRoom(false)}
          />
        </Box>
      )}
      
      {zones.length === 0 && roomGroups.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.5, mb: 2 }}>
          まだ部屋・ゾーンがありません。
        </Typography>
      ) : (
        <Box sx={{ mb: 2 }}>
          {/* 階ごとに 階見出し → 部屋 → ゾーン の3階層で表示。今いる階を強調する。 */}
          {floorGroups.map(({ floorIndex, label, groups }) => (
            <Box key={floorIndex} sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  display: "flex", alignItems: "center", gap: 0.75,
                  px: 0.75, py: 0.4, mb: 0.5, borderRadius: 1,
                  background: floorIndex === activeFloorIndex ? alpha("#34d399", 0.16) : alpha("#fff", 0.05),
                  border: `1px solid ${floorIndex === activeFloorIndex ? alpha("#34d399", 0.5) : alpha("#fff", 0.08)}`,
                }}
              >
                <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: floorIndex === activeFloorIndex ? "#34d399" : "color-mix(in srgb, var(--brand-fg) 75%, transparent)" }}>
                  {label}
                </Typography>
                {floorIndex === activeFloorIndex && (
                  <Typography sx={{ fontSize: 9, fontWeight: 700, color: "#34d399" }}>表示中</Typography>
                )}
              </Box>
              <Box sx={{ pl: 0.5 }}>
                {groups.length === 0 ? (
                  <Typography sx={{ fontSize: 10.5, opacity: 0.4, pl: 0.5, mb: 0.5 }}>部屋なし</Typography>
                ) : groups.map((g) => (
                  <RoomGroup
                    key={g.id}
                    group={g}
                    activeZoneId={activeZoneId}
                    sensors={sensors}
                    onGroupDragEnd={handleGroupDragEnd}
                    rooms={rooms}
                    candidates={nameCandidates}
                  />
                ))}
              </Box>
            </Box>
          ))}

          {/* 部屋に属さないゾーン（階に紐づかない扱い） */}
          {unassignedZones.length > 0 && (
            <RoomGroup
              group={{ id: "__unassigned__", name: "未分類ゾーン", zones: unassignedZones, inMaster: false }}
              activeZoneId={activeZoneId}
              sensors={sensors}
              onGroupDragEnd={handleGroupDragEnd}
              rooms={rooms}
              candidates={nameCandidates}
              allowAddZone={false}
            />
          )}
        </Box>
      )}

      <Divider sx={{ my: 3, borderColor: alpha("#fff", 0.1) }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontWeight: 600 }}>
          導線
        </Typography>
        <Button 
          size="small" 
          variant={(!isZoningActionSelect && zoningSubMode === "circulation") ? "contained" : "outlined"}
          color={(!isZoningActionSelect && zoningSubMode === "circulation") ? "primary" : "inherit"}
          onClick={() => {
            if (!isZoningActionSelect && zoningSubMode === "circulation") {
              setIsZoningActionSelect(true); // Toggle off
            } else {
              setZoningSubMode("circulation");
              setIsZoningActionSelect(false);
            }
          }}
          startIcon={<AddIcon />}
          sx={{ fontSize: 11, py: 0, px: 1, textTransform: 'none', borderColor: alpha("#fff", 0.2) }}
        >
          {(!isZoningActionSelect && zoningSubMode === "circulation") ? "作成中..." : "作成"}
        </Button>
      </Box>
      
      <Typography sx={{ fontSize: 9.5, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", mb: 0.75, lineHeight: 1.5 }}>
        パターンの定義は Base 共通。どのパターンを使うかはプランごとに保存されます。
      </Typography>

      {circulationPatterns.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.5, mb: 2 }}>
          No circulation patterns.
        </Typography>
      ) : (
        <List sx={{ mb: 2, p: 0 }}>
          {circulationPatterns.map((p) => (
            <PatternListItem 
              key={p.id} 
              p={p} 
              activeCirculationPatternId={activeCirculationPatternId} 
              circulationPatterns={circulationPatterns}
              onPatternClick={handlePatternClick}
              onDeletePattern={handleDeletePattern}
            />
          ))}
        </List>
      )}

      {editorMode === "zoning" && selectedCirc && (
        <Box sx={{ mt: 3, p: 1.5, bgcolor: alpha("#a855f7", 0.1), borderRadius: 1, border: `1px solid ${alpha("#a855f7", 0.3)}` }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "light-dark(#5908a6, #a855f7)" }}>
              Selected Circulation
            </Typography>
            <IconButton
              size="small"
              onClick={deleteSelectedCirc}
              sx={{ p: 0.5, color: "error.light", "&:hover": { color: "error.main", bgcolor: alpha("#f44336", 0.1) } }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 0.5 }}>Type</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => updateSelectedCirc({ type: "main" })}
                  sx={{
                    flex: 1, textTransform: "none",
                    bgcolor: selectedCirc.type === "main" ? alpha("#a855f7", 0.8) : alpha("#fff", 0.05),
                    color: selectedCirc.type === "main" ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
                    "&:hover": { bgcolor: selectedCirc.type === "main" ? "#a855f7" : alpha("#fff", 0.1) }
                  }}
                >
                  Main
                </Button>
                <Button
                  size="small"
                  onClick={() => updateSelectedCirc({ type: "sub" })}
                  sx={{
                    flex: 1, textTransform: "none",
                    bgcolor: selectedCirc.type === "sub" ? alpha("#a855f7", 0.8) : alpha("#fff", 0.05),
                    color: selectedCirc.type === "sub" ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
                    "&:hover": { bgcolor: selectedCirc.type === "sub" ? "#a855f7" : alpha("#fff", 0.1) }
                  }}
                >
                  Sub
                </Button>
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 0.5 }}>Width (mm)</Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {[600, 900, 1200, 1500].map(w => (
                  <Button
                    key={w}
                    size="small"
                    onClick={() => updateSelectedCirc({ width: w })}
                    sx={{
                      minWidth: 40, p: 0.25, fontSize: 12,
                      bgcolor: selectedCirc.width === w ? alpha("#a855f7", 0.8) : alpha("#fff", 0.05),
                      color: selectedCirc.width === w ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
                      "&:hover": { bgcolor: selectedCirc.width === w ? "#a855f7" : alpha("#fff", 0.1) }
                    }}
                  >
                    {w}
                  </Button>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

    </Box>
  );
}
