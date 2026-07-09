import { useState, useCallback } from "react";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

// Unicode escapes — no Japanese bytes in source file
const J = {
  zoning:   "Zoning",
  dosen:    "\u5c0e\u7dda",                                      // 導線
  eria:     "\u30a8\u30ea\u30a2",                                // エリア
  main:     "\u30e1\u30a4\u30f3",                                // メイン
  sub:      "\u30b5\u30d6",                                      // サブ
  haba:     "\u5e45",                                            // 幅
  zoneHint: "Zone\u3092\u30af\u30ea\u30c3\u30af\u3057\u3066\u9078\u629e", // Zoneをクリックして選択
  escHint:  "ESC\u3067\u5225Zone\u9078\u629e",                  // ESCで別Zone選択
};

const DEFAULTS = { main: 900, sub: 600 };

// ─── Shared style helpers ─────────────────────────────────────────────────

const base = {
  cursor: "pointer",
  border: "none",
  outline: "none",
  lineHeight: 1,
  fontFamily: "inherit",
};

function pillGroupStyle() {
  return {
    display: "flex",
    background: "rgba(0,0,0,0.30)",
    borderRadius: 999,
    padding: 2,
    gap: 0,
  };
}

function pillBtnStyle(active) {
  return {
    ...base,
    padding: "3px 14px",
    height: 26,
    borderRadius: 999,
    background: active ? "#7F77DD" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.50)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    transition: "background 0.12s",
  };
}

function standaloneStyle(active) {
  return {
    ...base,
    padding: "4px 14px",
    height: 26,
    borderRadius: 999,
    border: active ? "none" : "0.5px solid rgba(255,255,255,0.22)",
    background: active ? "#7F77DD" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.60)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    display: "flex",
    alignItems: "center",
    gap: 4,
    transition: "background 0.12s",
  };
}

function segBtnStyle(active, borderLeft) {
  return {
    ...base,
    padding: "3px 10px",
    background: active ? "#7F77DD" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.60)",
    borderLeft: borderLeft ? "0.5px solid rgba(255,255,255,0.20)" : "none",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  };
}

function Sep() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "rgba(255,255,255,0.18)",
        margin: "2px 3px",
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function ZoningToolbarOverlay() {
  const editorMode     = useEditorModeStore((s) => s.editorMode);
  const setEditorMode  = useEditorModeStore((s) => s.setEditorMode);
  const setLayoutSubMode    = useEditorModeStore((s) => s.setLayoutSubMode);
  const setLayoutCameraTilt = useEditorModeStore((s) => s.setLayoutCameraTilt);

  const isZoningMode       = useZoningStore((s) => s.isZoningMode);
  const toggleZoningMode   = useZoningStore((s) => s.toggleZoningMode);
  const zoningSubMode      = useZoningStore((s) => s.zoningSubMode);
  const setZoningSubMode   = useZoningStore((s) => s.setZoningSubMode);
  const setZoningMode      = useZoningStore((s) => s.setZoningMode);

  const activeCirculationZoneId    = useZoningStore((s) => s.activeCirculationZoneId);
  const circulationType            = useZoningStore((s) => s.circulationType);
  const setCirculationType         = useZoningStore((s) => s.setCirculationType);
  const circulationWidths          = useZoningStore((s) => s.circulationWidths);
  const setCirculationWidth        = useZoningStore((s) => s.setCirculationWidth);
  const selectedCirculationId      = useZoningStore((s) => s.selectedCirculationId);
  const setSelectedCirculationId   = useZoningStore((s) => s.setSelectedCirculationId);

  const zones = useLayoutTaskStore((s) => s.zones);

  const [newZoneName,  setNewZoneName]  = useState("");
  const [newZoneWidth, setNewZoneWidth] = useState("");
  const [newZoneDepth, setNewZoneDepth] = useState("");

  const activeZoneName = activeCirculationZoneId
    ? zones.find((z) => z.id === activeCirculationZoneId)?.name ?? "Zone"
    : "";

  // ── Toggle Zoning mode (mirrors TopBar.handleToggleZoning) ───────────────
  const handleToggleZoning = useCallback(() => {
    const next = !isZoningMode;
    toggleZoningMode();
    if (next) {
      setLayoutSubMode("zone_2d");
    } else {
      setLayoutSubMode("furniture_iso");
      setLayoutCameraTilt("default");
    }
  }, [isZoningMode, toggleZoningMode, setLayoutSubMode, setLayoutCameraTilt]);

  // ── Go back to Normal editor mode ────────────────────────────────────────
  const handleGoNormal = useCallback(() => {
    if (isZoningMode) {
      setZoningMode(false);
      setLayoutSubMode("furniture_iso");
      setLayoutCameraTilt("default");
    }
    setEditorMode("normal");
  }, [isZoningMode, setZoningMode, setEditorMode, setLayoutSubMode, setLayoutCameraTilt]);

  // ── Circulation type switch (resets width to default) ───────────────────
  const handleTypeChange = useCallback(
    (type) => {
      setCirculationType(type);
      setCirculationWidth(type, DEFAULTS[type]);
    },
    [setCirculationType, setCirculationWidth]
  );

  // ── Add zone ─────────────────────────────────────────────────────────────
  const handleAddZone = useCallback(() => {
    const w = parseFloat(newZoneWidth);
    const d = parseFloat(newZoneDepth);
    const hasDimensions = !isNaN(w) && !isNaN(d) && w > 0 && d > 0;
    if (!newZoneName.trim() && !hasDimensions) return;
    const zone = {
      id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      name: newZoneName.trim() || "New Zone",
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      targetSeats: 0,
      targetArea: hasDimensions ? (w / 1000) * (d / 1000) : 0,
      remarks: "",
      ...(hasDimensions ? { rect: { x: 0, z: 0, width: w, depth: d } } : {}),
    };
    window.dispatchEvent(new CustomEvent("LayoutShell:AddZone", { detail: zone }));
    setNewZoneName("");
    setNewZoneWidth("");
    setNewZoneDepth("");
  }, [newZoneName, newZoneWidth, newZoneDepth]);

  // ── Delete selected circulation ──────────────────────────────────────────
  const handleDeleteCirculation = useCallback(() => {
    if (!selectedCirculationId || !activeCirculationZoneId) return;
    const target = zones.find((z) => z.id === activeCirculationZoneId);
    if (!target) return;
    const next = (target.circulations ?? []).filter((c) => c.id !== selectedCirculationId);
    window.dispatchEvent(
      new CustomEvent("LayoutShell:UpdateZone", {
        detail: { id: activeCirculationZoneId, circulations: next, __merge: true },
      })
    );
    setSelectedCirculationId(null);
  }, [selectedCirculationId, activeCirculationZoneId, zones, setSelectedCirculationId]);

  // ── Only render in Layout mode ───────────────────────────────────────────
  if (editorMode !== "layout") return null;

  const inCirculation = zoningSubMode === "circulation";
  const inArea        = zoningSubMode === "area";
  const circWidth     = circulationWidths[circulationType];

  // Whether to show Zoning-specific sub-controls
  const showSubModes = isZoningMode;
  const showCircControls = isZoningMode && inCirculation && !!activeCirculationZoneId;
  const showZoneHint     = isZoningMode && (inCirculation || inArea) && !activeCirculationZoneId;
  const showZoneForm     = isZoningMode && !inCirculation && !inArea;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(15,23,42,0.82)",
        backdropFilter: "blur(8px)",
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        pointerEvents: "auto",
        boxShadow: "0 4px 12px rgba(0,0,0,0.50)",
        userSelect: "none",
        height: 38,
      }}
    >
      {/* ── State 1: Normal / Layout pills + Zoning standalone ── */}
      <div style={pillGroupStyle()}>
        <button style={pillBtnStyle(editorMode === "normal")} onClick={handleGoNormal}>
          Normal
        </button>
        <button style={pillBtnStyle(editorMode === "layout")} onClick={() => setEditorMode("layout")}>
          Layout
        </button>
      </div>

      <Sep />

      <button style={standaloneStyle(isZoningMode)} onClick={handleToggleZoning}>
        {J.zoning}
      </button>

      {/* ── State 2: Zoning active → sub-mode buttons ── */}
      {showSubModes && (
        <>
          <Sep />

          {/* 導線 button (with zone badge when active + zone selected) */}
          <button
            style={standaloneStyle(inCirculation)}
            onClick={() => setZoningSubMode("circulation")}
          >
            {J.dosen}
            {inCirculation && activeCirculationZoneId && (
              <span
                style={{
                  fontSize: 10,
                  background: "#EEEDFE",
                  color: "#534AB7",
                  borderRadius: 10,
                  padding: "1px 6px",
                  marginLeft: 4,
                  fontWeight: 500,
                }}
              >
                {activeZoneName}
              </span>
            )}
          </button>

          {/* エリア button */}
          <button style={standaloneStyle(inArea)} onClick={() => setZoningSubMode("area")}>
            {J.eria}
          </button>
        </>
      )}

      {/* ── State 2 hint: Zone未選択 ── */}
      {showZoneHint && (
        <>
          <Sep />
          <span style={{ fontSize: 12, color: "rgba(255,200,0,0.85)", whiteSpace: "nowrap", padding: "0 4px" }}>
            {J.zoneHint}
          </span>
        </>
      )}

      {/* ── State 3: Zone選択済み → メイン/サブ・幅・ESCヒント ── */}
      {showCircControls && (
        <>
          <Sep />

          {/* メイン / サブ segment */}
          <div
            style={{
              display: "flex",
              border: "0.5px solid rgba(255,255,255,0.20)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <button style={segBtnStyle(circulationType === "main", false)} onClick={() => handleTypeChange("main")}>
              {J.main}
            </button>
            <button style={segBtnStyle(circulationType === "sub", true)} onClick={() => handleTypeChange("sub")}>
              {J.sub}
            </button>
          </div>

          {/* Width input */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)" }}>{J.haba}</span>
            <input
              type="number"
              value={circWidth}
              onChange={(e) => setCirculationWidth(circulationType, Number(e.target.value) || 0)}
              style={{
                width: 56,
                fontSize: 12,
                padding: "3px 6px",
                borderRadius: 4,
                border: "0.5px solid rgba(255,255,255,0.20)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>mm</span>
          </div>

          {/* Delete button (when a circulation line is selected) */}
          {selectedCirculationId && selectedCirculationId !== "selection_mode" && (
            <button
              onClick={handleDeleteCirculation}
              title="Delete selected"
              style={{
                ...base,
                width: 26,
                height: 26,
                borderRadius: 4,
                border: "0.5px solid rgba(239,68,68,0.50)",
                background: "transparent",
                color: "#ef4444",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          )}

          <Sep />

          <span style={{ fontSize: 12, opacity: 0.4, padding: "0 4px", whiteSpace: "nowrap" }}>
            {J.escHint}
          </span>
        </>
      )}

      {/* ── Zone-drawing sub-mode (default): add zone form ── */}
      {showZoneForm && (
        <>
          <Sep />
          <input
            placeholder="Zone Name (opt)"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            style={{
              width: 118,
              fontSize: 12,
              padding: "3px 6px",
              borderRadius: 4,
              border: "0.5px solid rgba(255,255,255,0.20)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <input
            type="number"
            placeholder="W (mm)"
            value={newZoneWidth}
            onChange={(e) => setNewZoneWidth(e.target.value)}
            style={{
              width: 70,
              fontSize: 12,
              padding: "3px 6px",
              borderRadius: 4,
              border: "0.5px solid rgba(255,255,255,0.20)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <input
            type="number"
            placeholder="D (mm)"
            value={newZoneDepth}
            onChange={(e) => setNewZoneDepth(e.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") handleAddZone(); }}
            style={{
              width: 70,
              fontSize: 12,
              padding: "3px 6px",
              borderRadius: 4,
              border: "0.5px solid rgba(255,255,255,0.20)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleAddZone}
            disabled={!newZoneName.trim() && (!newZoneWidth || !newZoneDepth)}
            style={{
              ...base,
              width: 28,
              height: 26,
              borderRadius: 4,
              background: "#38bdf8",
              color: "#000",
              fontSize: 18,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
        </>
      )}
    </div>
  );
}
