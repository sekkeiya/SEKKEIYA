// FaceMaterialPanel — Material モードで躯体面（床/壁/天井）を選択したときの右サイドバー専用パネル。
// 面種別・実寸・適用中の仕上げ・「パターンとして保存」・保存済みパターン一覧を表示する。

import React, { useState } from "react";
import { Box, Typography, Divider, Chip, IconButton, Button, CircularProgress } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { useMaterialFaceStore, surfaceKeyOf, SURFACE_LABEL } from "../../../../../store/useMaterialFaceStore";
import { useSurfaceFinishStore, finishRects } from "../../../../../store/useSurfaceFinishStore";
import { useSurfacePatternStore } from "../../../../../store/useSurfacePatternStore";
import { useEditorModeStore } from "../../../../../store/useEditorModeStore";
import { useAppStore } from "../../../../../../../../store/useAppStore";
import { saveSurfaceData } from "../../../../../api/surfaceFinishApi";

const SURFACE_COLOR = { floor: "#4fc3f7", ceiling: "#facc15", wall: "#ec407a" };

function FinishRow({ finish, onRemove }) {
  const c = finish.material?.params?.baseColor || "#888";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, borderRadius: 1, bgcolor: "rgb(var(--brand-fg-rgb) / 0.04)", mb: 0.5 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: finish.material?.maps?.albedo ? `center/cover url(${finish.material.maps.albedo})` : `radial-gradient(circle at 33% 30%, #fff, ${c} 65%, #111)`, border: "1px solid rgb(var(--brand-fg-rgb) / 0.15)" }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11.5, color: "var(--brand-fg)" }} noWrap>{finish.material?.title || "素材"}</Typography>
        <Typography sx={{ fontSize: 9.5, color: "rgb(var(--brand-fg-rgb) / 0.45)" }}>{finishRects(finish).length ? (finishRects(finish).length > 1 ? `部分領域 ×${finishRects(finish).length}` : "部分領域") : "面全体"}</Typography>
      </Box>
      <IconButton size="small" onClick={onRemove} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", "&:hover": { color: "light-dark(#ad0000, #ff6b6b)" } }}>
        <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );
}

export default function FaceMaterialPanel() {
  const face = useMaterialFaceStore((s) => s.selectedFace);
  const finishes = useSurfaceFinishStore((s) => s.finishes);
  const setFinish = useSurfaceFinishStore((s) => s.setFinish);
  const removeFinish = useSurfaceFinishStore((s) => s.removeFinish);
  const patternsMap = useSurfacePatternStore((s) => s.patterns);
  const activeMap = useSurfacePatternStore((s) => s.activePatterns);
  const addPattern = useSurfacePatternStore((s) => s.addPattern);
  const removePattern = useSurfacePatternStore((s) => s.removePattern);
  const setActivePattern = useSurfacePatternStore((s) => s.setActivePattern);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const unitsPerMeter = sceneMaxY > 100 ? 1000 : 1;

  const projectId = useAppStore((st) => st.activeProjectId);
  const workspaceId = useEditorModeStore((st) => st.dslPlanContext?.workspaceId) || null;
  const layoutSel = useAppStore((st) => st.panelSelections?.layout);
  const layoutKey = layoutSel?.optionId || layoutSel?.planId || layoutSel?.baseId || "default";
  const [busy, setBusy] = useState(false);

  const persist = async () => {
    if (!projectId || !workspaceId) return;
    try {
      await saveSurfaceData(projectId, workspaceId, layoutKey, {
        finishes: Object.values(useSurfaceFinishStore.getState().finishes),
        patterns: useSurfacePatternStore.getState().patterns,
        activePatterns: useSurfacePatternStore.getState().activePatterns,
      });
    } catch (e) {
      console.error("[FaceMaterialPanel] persist failed", e);
    }
  };

  if (!face) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 12.5, color: "var(--brand-fg)" }}>マテリアルモード</Typography>
        <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.5, color: "var(--brand-fg)" }}>
          床・壁・天井をクリックして面を選択してください。下部の Materials から素材を選ぶと面全体に貼れます。
        </Typography>
      </Box>
    );
  }

  const label = SURFACE_LABEL[face.surfaceType] || "面";
  const color = SURFACE_COLOR[face.surfaceType] || "#ec407a";
  const s = face.surface;
  const wM = s ? s.width / unitsPerMeter : 0;
  const hM = s ? s.height / unitsPerMeter : 0;
  const key = s ? surfaceKeyOf(s.normal, s.center) : null;
  const myFinishes = key ? Object.values(finishes).filter((f) => f.key.startsWith(key)) : [];
  const myPatterns = key ? (patternsMap[key] || []) : [];
  const activeId = key ? (activeMap?.[key] || null) : null;

  // この面の仕上げを全部消す
  const clearSurface = () => myFinishes.forEach((f) => removeFinish(f.key));

  // 現在の仕上げを「パターンN」として保存 → その後この面をリセット
  const saveAsPattern = async () => {
    if (!key || myFinishes.length === 0) return;
    setBusy(true);
    try {
      const existing = useSurfacePatternStore.getState().patterns[key] || [];
      const thumbColors = myFinishes.map((f) => f.material?.params?.baseColor || "#888").slice(0, 3);
      const pattern = {
        id: crypto.randomUUID(),
        name: `パターン${existing.length + 1}`,
        finishes: myFinishes.map((f) => ({ ...f })),
        thumbColors,
      };
      addPattern(key, pattern);
      setActivePattern(key, pattern.id); // 保存したパターンをそのまま適用状態にする
      await persist();
    } finally {
      setBusy(false);
    }
  };

  // 保存済みパターンをトグル（チェックON=適用 / チェックOFF=解除してこの面を空に）
  const togglePattern = async (pattern) => {
    if (!key) return;
    setBusy(true);
    try {
      clearSurface();
      if (activeId === pattern.id) {
        setActivePattern(key, null); // 解除
      } else {
        pattern.finishes.forEach((f) => setFinish(f));
        setActivePattern(key, pattern.id);
      }
      await persist();
    } finally {
      setBusy(false);
    }
  };

  const deletePattern = async (id) => {
    if (!key) return;
    removePattern(key, id);
    await persist();
  };

  return (
    <Box sx={{ p: 1, color: "var(--brand-fg)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Chip label={label} size="small" sx={{ bgcolor: `color-mix(in srgb, ${color} 20%, transparent)`, color, fontWeight: 700, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }} />
        <Typography sx={{ fontSize: 12, color: "rgb(var(--brand-fg-rgb) / 0.55)" }}>マテリアル設定</Typography>
        {busy && <CircularProgress size={13} sx={{ color }} />}
      </Box>

      {s ? (
        <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 10, color: "rgb(var(--brand-fg-rgb) / 0.45)" }}>幅</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{wM.toFixed(2)} m</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, color: "rgb(var(--brand-fg-rgb) / 0.45)" }}>高さ</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{hM.toFixed(2)} m</Typography>
          </Box>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 11, color: "light-dark(#ad6700, #ffb74d)", mb: 1 }}>この面は矩形抽出に失敗しました（複雑形状）。面全体適用のみ可能です。</Typography>
      )}

      <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)", mb: 1 }} />

      {/* 現在の仕上げ */}
      <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.55)", mb: 0.5 }}>現在の仕上げ（{myFinishes.length}）</Typography>
      {myFinishes.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.4)" }}>下部 Materials で面全体に、右の展開図で部分的に貼れます。</Typography>
      ) : (
        myFinishes.map((f) => <FinishRow key={f.key} finish={f} onRemove={() => removeFinish(f.key)} />)
      )}

      {/* パターンとして保存（保存後この面はリセット） */}
      <Button
        fullWidth size="small" variant="contained"
        disabled={!projectId || busy || myFinishes.length === 0}
        onClick={saveAsPattern}
        startIcon={<SaveRoundedIcon />}
        sx={{ mt: 1, textTransform: "none", bgcolor: color, "&:hover": { filter: "brightness(1.1)" } }}
      >
        この壁をパターンとして保存
      </Button>
      <Typography sx={{ fontSize: 10, color: "rgb(var(--brand-fg-rgb) / 0.4)", mt: 0.5 }}>
        現在の貼り付けを「パターン{myPatterns.length + 1}」として保存し、そのまま適用します。
      </Typography>

      {/* 保存済みパターン */}
      {myPatterns.length > 0 && (
        <>
          <Divider sx={{ borderColor: "rgb(var(--brand-fg-rgb) / 0.08)", my: 1.25 }} />
          <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.55)", mb: 0.5 }}>保存済みパターン（{myPatterns.length}）</Typography>
          {myPatterns.map((p) => {
            const isActive = activeId === p.id;
            return (
              <Box
                key={p.id}
                onClick={() => !busy && togglePattern(p)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, p: 0.75, borderRadius: 1.5, mb: 0.5, cursor: "pointer",
                  bgcolor: isActive ? `color-mix(in srgb, ${color} 13%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.04)",
                  border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 67%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.06)"}`,
                  transition: "all 0.12s", "&:hover": { bgcolor: isActive ? `color-mix(in srgb, ${color} 20%, transparent)` : "rgb(var(--brand-fg-rgb) / 0.08)" },
                }}
              >
                {isActive
                  ? <CheckCircleRoundedIcon sx={{ fontSize: 18, color }} />
                  : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18, color: "rgb(var(--brand-fg-rgb) / 0.35)" }} />}
                <Box sx={{ display: "flex" }}>
                  {(p.thumbColors || []).map((c, i) => (
                    <Box key={i} sx={{ width: 18, height: 18, borderRadius: "50%", ml: i ? -0.75 : 0, background: `radial-gradient(circle at 33% 30%, #fff, ${c} 65%, #111)`, border: "1px solid rgba(0,0,0,0.4)" }} />
                  ))}
                </Box>
                <Typography sx={{ fontSize: 12, fontWeight: isActive ? 700 : 600, flex: 1, color: isActive ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.85)" }} noWrap>
                  {p.name}{isActive ? "（適用中）" : ""}
                </Typography>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); deletePattern(p.id); }} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.5)", "&:hover": { color: "light-dark(#ad0000, #ff6b6b)" } }}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
}
