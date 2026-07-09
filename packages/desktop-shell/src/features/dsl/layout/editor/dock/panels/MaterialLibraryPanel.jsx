// src/features/layout/components/BottomBar/panels/MaterialLibraryPanel.jsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Box, Stack, Typography, IconButton, ToggleButtonGroup, ToggleButton } from "@mui/material";
import { alpha } from "@mui/material/styles";

import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useMaterialPickerStore } from "../../../store/materialPickerStore";
import { useSceneAssetsStore } from "../../../store/sceneAssetsStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useAppStore } from "../../../../../../store/useAppStore";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useMaterialFaceStore, surfaceKeyOf } from "../../../store/useMaterialFaceStore";
import { useSurfaceFinishStore } from "../../../store/useSurfaceFinishStore";
import { subscribeProjectMaterials } from "../../../../../dsmt/api/dsmtQueries";
import { buildThreeMaterial, applyWholeObjectMaterial } from "../../../../../shared/material/applyMaterial";
import { materialToSnapshot } from "../../../../../shared/material/useMaterialBinding";
import { saveMaterialBinding, bindingIdForLayoutObject } from "../../../../../shared/material/materialBindingApi";

function getMatHintColor(m) {
  try {
    if (m?.material?.color && typeof m.material.color.getHexString === "function") {
      return `#${m.material.color.getHexString()}`;
    }
    // Object containing r,g,b
    if (m?.material?.color && m.material.color.r !== undefined) {
      const { r, g, b } = m.material.color;
      const toHex = (c) => Math.floor(c * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  } catch (e) {}
  return "#777";
}

export default function MaterialLibraryPanel({ onClose }) {
  const commitPick = useMaterialPickerStore((s) => s.commitPick);

  const map = useSceneObjectRegistryStore((s) => s.map);
  const getUniqueMaterialsFromObjects = useSceneAssetsStore((s) => s.getUniqueMaterialsFromObjects);

  const materials = useMemo(() => {
    return getUniqueMaterialsFromObjects(Array.from(map.values()));
  }, [getUniqueMaterialsFromObjects, map]);

  // ── S.Material ライブラリ（プロジェクトの登録素材）─────────────
  const projectId = useAppStore((s) => s.activeProjectId);
  const [source, setSource] = useState("dsmt"); // 'dsmt' | 'scene'
  const [dsmtMaterials, setDsmtMaterials] = useState([]);
  const [building, setBuilding] = useState(null);

  useEffect(() => {
    if (!projectId) { setDsmtMaterials([]); return; }
    const unsub = subscribeProjectMaterials(projectId, setDsmtMaterials);
    return () => unsub();
  }, [projectId]);

  const handlePick = useCallback((m) => {
    if (commitPick) commitPick(m);
  }, [commitPick]);

  // S.Material 素材を選択時の適用：
  //  (A) ピッカーが「武装」している（Properties の置換ボタン経由）→ 既存の preview 置換へ
  //  (B) それ以外で家具アイテムが選択中 → そのアイテム全体へ直接適用＋バインディング永続化
  const handlePickDsmt = useCallback(async (dsmtMat) => {
    setBuilding(dsmtMat.id);
    try {
      const built = await buildThreeMaterial(materialToSnapshot(dsmtMat));
      built.name = dsmtMat.title || "Material";

      const armed = typeof useMaterialPickerStore.getState().onPick === "function";
      if (armed) {
        commitPick?.({ id: dsmtMat.id, name: dsmtMat.title || "Material", material: built, dsmtMaterial: dsmtMat });
        return;
      }

      // Material モード：選択中の躯体面（壁/床/天井）全体に貼る（オーバーレイ板）
      const isMaterialMode = useEditorModeStore.getState().editorMode === "material";
      if (isMaterialMode) {
        const face = useMaterialFaceStore.getState().selectedFace;
        if (face?.surface) {
          const key = surfaceKeyOf(face.surface.normal, face.surface.center);
          useSurfaceFinishStore.getState().setFinish({
            key,
            surface: face.surface,
            materialId: dsmtMat.id,
            material: materialToSnapshot(dsmtMat),
          });
        } else {
          console.warn("[MaterialLibraryPanel] 面を選択してから素材をクリックしてください");
        }
        built.dispose?.();
        return;
      }

      const selectedItemId = useUiSelectionStore.getState().selectedItemIds?.[0];
      if (!selectedItemId || !projectId) {
        console.warn("[MaterialLibraryPanel] 家具を選択してから素材をクリックしてください");
        return;
      }
      const obj = useSceneObjectRegistryStore.getState().getObject?.(selectedItemId);
      if (!obj) return;

      // ライブ適用（オブジェクト全体・選択ハイライトと両立）
      applyWholeObjectMaterial(obj, built);

      // バインディング永続化（layoutObject 単位）
      const modelId = obj.userData?.modelId || obj.userData?.ownerModelId || selectedItemId;
      await saveMaterialBinding(projectId, {
        id: bindingIdForLayoutObject(selectedItemId),
        targetType: "layoutObject",
        layoutObjectId: selectedItemId,
        modelId: String(modelId),
        slots: [{ materialId: dsmtMat.id, material: materialToSnapshot(dsmtMat) }],
      });
    } catch (e) {
      console.error("[MaterialLibraryPanel] apply dsmt material failed", e);
    } finally {
      setBuilding(null);
    }
  }, [commitPick, projectId]);

  const dsmtColor = (mt) => mt?.params?.baseColor || "#999";

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        sx={{ 
          px: 2.5, 
          py: 1.5, 
          borderBottom: `1px solid ${alpha("#fff", 0.08)}`,
        }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 13.5, letterSpacing: 0.2 }}>
          Materials
        </Typography>

        <ToggleButtonGroup
          exclusive size="small" value={source}
          onChange={(_, v) => v && setSource(v)}
          sx={{ ml: 1, "& .MuiToggleButton-root": { color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)", border: `1px solid ${alpha("#fff", 0.12)}`, px: 1, py: 0.25, fontSize: 11, textTransform: "none" }, "& .Mui-selected": { color: "#fff !important", background: `${alpha("#ec407a", 0.25)} !important` } }}
        >
          <ToggleButton value="dsmt">S.Material</ToggleButton>
          <ToggleButton value="scene">Scene</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <FilterListRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", cursor: "pointer", transition: "color 0.2s", "&:hover": { color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)" } }} />
        <CleaningServicesRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", cursor: "pointer", transition: "color 0.2s", "&:hover": { color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)" }, mr: 1 }} />
        
        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ borderRadius: 1.5 }}>
            <ExpandMoreRoundedIcon />
          </IconButton>
        )}
      </Stack>

      {/* Main Content Grid */}
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: "auto", 
          p: 2,
          "&::-webkit-scrollbar": { width: 8, height: 8 },
          "&::-webkit-scrollbar-thumb": { background: alpha("#fff", 0.08), borderRadius: 4 },
        }}
      >
        {source === "dsmt" ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {!projectId ? (
              <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>プロジェクトを選択すると S.Material の素材が表示されます。</Typography>
            ) : dsmtMaterials.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>このプロジェクトに S.Material 素材がありません。</Typography>
            ) : dsmtMaterials.map((mt) => (
              <Box key={mt.id} onClick={() => handlePickDsmt(mt)}
                sx={{ width: 72, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5, cursor: "pointer", opacity: building === mt.id ? 0.5 : 1, "&:hover .thumb-box": { borderColor: alpha("#fff", 0.2), background: alpha("#fff", 0.06) } }}>
                <Box className="thumb-box" sx={{ width: 72, height: 72, borderRadius: 1.5, background: alpha("#fff", 0.02), border: `1px solid transparent`, position: "relative", overflow: "hidden", display: "grid", placeItems: "center", transition: "all 0.15s ease" }}>
                  {mt.thumbnailUrl ? (
                    <Box component="img" src={mt.thumbnailUrl} alt="" sx={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", boxShadow: "0 4px 6px rgba(0,0,0,0.4)" }} />
                  ) : (
                    <Box sx={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, #fff 0%, ${dsmtColor(mt)} 45%, #111 85%)`, boxShadow: "0 4px 6px rgba(0,0,0,0.4)" }} />
                  )}
                </Box>
                <Typography noWrap sx={{ width: "100%", fontSize: 10.5, fontWeight: 500, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)", px: 0.5 }}>
                  {mt.title || "Material"}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>

          {/* + Standard Button */}
          <Box 
            sx={{ 
              width: 80, 
              height: 72, 
              background: alpha("#fff", 0.04), 
              borderRadius: 1.5, 
              display: "flex", 
              border: `1px solid transparent`,
              cursor: "pointer",
              transition: "all 0.2sease",
              "&:hover": { borderColor: alpha("#fff", 0.15), background: alpha("#fff", 0.06) }
            }}
          >
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AddRoundedIcon sx={{ fontSize: 22, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", mt: 0.2 }}>
                Standard
              </Typography>
            </Box>
            <Box sx={{ width: 1, background: "color-mix(in srgb, var(--brand-bg) 30%, transparent)" }} />
            <Box sx={{ 
              width: 24, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              "&:hover": { background: alpha("#fff", 0.05) }
            }}>
              <MoreVertRoundedIcon sx={{ fontSize: 16, color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }} />
            </Box>
          </Box>

          {/* Material Items */}
          {materials.map((m, idx) => {
             const matColor = getMatHintColor(m);
             return (
              <Box 
                key={m.id || idx} 
                onClick={() => handlePick(m)}
                sx={{ 
                  width: 72, 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "flex-start",
                  gap: 0.5,
                  cursor: "pointer",
                  "&:hover .thumb-box": { borderColor: alpha("#fff", 0.2), background: alpha("#fff", 0.06) }
                }}
              >
                {/* Thumbnail Box */}
                <Box 
                  className="thumb-box"
                  sx={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: 1.5,
                    background: alpha("#fff", 0.02),
                    border: `1px solid transparent`,
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    transition: "all 0.15s ease"
                  }}
                >
                  {/* Top-Left Triangle Badge */}
                  <Box 
                    sx={{ 
                      position: "absolute", 
                      top: 0, left: 0,
                      width: 0, height: 0,
                      borderTop: `24px solid ${alpha("#000", 0.3)}`,
                      borderRight: "24px solid transparent",
                      zIndex: 2,
                      borderTopLeftRadius: "6px"
                    }}
                  >
                    <CheckRoundedIcon sx={{ position: "absolute", top: -23, left: 2, fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)" }} />
                  </Box>

                  {/* Simulated CSS Sphere */}
                  <Box 
                    sx={{
                      width: 52, 
                      height: 52,
                      borderRadius: "50%",
                      background: `radial-gradient(circle at 35% 35%, #fff 0%, ${matColor} 45%, #111 85%)`,
                      boxShadow: "0 4px 6px rgba(0,0,0,0.4)"
                    }} 
                  />
                </Box>

                {/* Label */}
                <Typography 
                  noWrap 
                  sx={{ 
                    width: "100%", 
                    fontSize: 10.5, 
                    fontWeight: 500, 
                    color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", 
                    px: 0.5 
                  }}
                >
                  {m.name || "Material"}
                </Typography>
              </Box>
            );
          })}

        </Box>
        )}
      </Box>
    </Box>
  );
}
