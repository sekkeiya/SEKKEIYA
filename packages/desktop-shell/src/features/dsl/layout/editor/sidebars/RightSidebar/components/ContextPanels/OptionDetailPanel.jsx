import React, { useState } from "react";
import { Box, Typography, Button, TextField, List, ListItem, Divider, IconButton, Collapse } from "@mui/material";
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
import { useEditorModeStore } from "../../../../../store/useEditorModeStore";

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
              sx={{ input: { fontSize: 13, color: "#fff", py: 0 }, flex: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#38bdf8" : "inherit",
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
              "&:hover": { opacity: 1, color: "#38bdf8", bgcolor: alpha("#38bdf8", 0.1) },
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
              <Typography variant="caption" sx={{ flex: 1, color: "#ccc", display: "flex", alignItems: "center", gap: 0.5 }}>
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
              sx={{ input: { fontSize: 13, color: "#fff", py: 0 }, flex: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#a855f7" : "inherit",
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

export default function OptionDetailPanel({ optionDoc, optionDocLoading, onAddZone }) {
  const [newZoneName, setNewZoneName] = useState("");
  const [newPatternName, setNewPatternName] = useState("");
  const activeZoneId = useLayoutTaskStore((s) => s.activeZoneId);
  const zones = useLayoutTaskStore((s) => s.zones) || [];
  const circulationPatterns = useLayoutTaskStore((s) => s.circulationPatterns) || [];
  
  // Store actions for creating zones and circulations
  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const setZoningSubMode = useZoningStore((s) => s.setZoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);
  const setIsZoningActionSelect = useZoningStore((s) => s.setIsZoningActionSelect);

  const activeCirculationPatternId = useLayoutTaskStore((s) => s.activeCirculationPatternId);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const selectedCirculationId = useZoningStore((s) => s.selectedCirculationId);
  const circulations = useLayoutTaskStore((s) => s.circulations) || [];
  const selectedCirc = circulations.find((c) => c.id === selectedCirculationId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (optionDocLoading) return <Box p={2}><Typography fontSize={12}>Loading Option...</Typography></Box>;
  if (!optionDoc) return <Box p={2}><Typography fontSize={12}>No Option Selected</Typography></Box>;

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    onAddZone?.({
      id: `zone_${Date.now()}`,
      name: newZoneName.trim(),
      targetSeats: 0,
      color: "#888888", // Default color
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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = zones.findIndex((z) => z.id === active.id);
      const newIndex = zones.findIndex((z) => z.id === over.id);
      const newZones = arrayMove(zones, oldIndex, newIndex);
      window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", { detail: { zones: newZones } }));
    }
  };

  return (
    <Box sx={{ p: 0, height: "100%", overflowY: "auto", color: "rgba(255,255,255,0.9)" }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.7), fontWeight: 600 }}>
          ゾーン
        </Typography>
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
            }
          }}
          startIcon={<AddIcon />}
          sx={{ fontSize: 11, py: 0, px: 1, textTransform: 'none', borderColor: alpha("#fff", 0.2) }}
        >
          {(!isZoningActionSelect && zoningSubMode === "zone") ? "作成中..." : "作成"}
        </Button>
      </Box>
      
      {zones.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.5, mb: 2 }}>
          No zones defined.
        </Typography>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={zones.map(z => z.id)} strategy={verticalListSortingStrategy}>
            <List sx={{ mb: 2, p: 0 }}>
              {zones.map((z, idx) => (
                <ZoneListItem key={z.id || idx} z={z} activeZoneId={activeZoneId} />
              ))}
            </List>
          </SortableContext>
        </DndContext>
      )}

      <Divider sx={{ my: 3, borderColor: alpha("#fff", 0.1) }} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 12, color: alpha("#fff", 0.7), fontWeight: 600 }}>
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
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#a855f7" }}>
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
                    color: selectedCirc.type === "main" ? "#fff" : alpha("#fff", 0.6),
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
                    color: selectedCirc.type === "sub" ? "#fff" : alpha("#fff", 0.6),
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
                      color: selectedCirc.width === w ? "#fff" : alpha("#fff", 0.6),
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
