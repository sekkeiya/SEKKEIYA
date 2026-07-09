// src/features/layout/components/RightSidebar/components/PropertiesPanel/PropertiesMaterialPanel.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Typography,
  Divider,
  Tabs,
  Tab,
  Stack,
  IconButton,
  Tooltip,
  Slider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

// ✅ preview用（R3F）
import { Canvas, invalidate } from "@react-three/fiber";
import * as THREE from "three";

// icons（Twinmotionっぽいタブ）
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import TextureRoundedIcon from "@mui/icons-material/TextureRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";

// property icons（縦リスト）
import InvertColorsRoundedIcon from "@mui/icons-material/InvertColorsRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import BlurOnRoundedIcon from "@mui/icons-material/BlurOnRounded";
import GrainRoundedIcon from "@mui/icons-material/GrainRounded";
import WavesRoundedIcon from "@mui/icons-material/WavesRounded";
import ViewComfyRoundedIcon from "@mui/icons-material/ViewComfyRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import OpacityRoundedIcon from "@mui/icons-material/OpacityRounded";

import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";

// ✅ BottomBar Picker store
import { useMaterialPickerStore } from "../../../../../store/materialPickerStore";

function smallText(v) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function TabLabel({ icon, label }) {
  return (
    <Stack direction="row" spacing={0.7} alignItems="center">
      {icon}
      <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.1 }}>
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * Twinmotion風：縦の“項目ボタン”
 */
function PropertyRow({ icon, label, onClick, right, disabled = false }) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={0}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 1.05,
        borderRadius: 1.6,
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.45 : 1,
        "&:hover": disabled ? undefined : { background: alpha("#fff", 0.06) },
        "&:active": disabled ? undefined : { background: alpha("#fff", 0.08) },
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          display: "grid",
          placeItems: "center",
          borderRadius: 1.2,
          background: "color-mix(in srgb, var(--brand-bg) 18%, transparent)",
          border: `1px solid ${alpha("#fff", 0.10)}`,
          color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
        }}
      >
        {icon}
      </Box>

      <Typography sx={{ fontSize: 12.2, fontWeight: 800, opacity: 0.92 }}>
        {label}
      </Typography>

      <Box sx={{ flex: 1 }} />

      {right ? right : <Typography sx={{ fontSize: 11.5, opacity: 0.55 }}>›</Typography>}
    </Box>
  );
}

/**
 * ✅ Preview球（R3F）
 * - material は THREE.Material を想定（clone 済みを渡す）
 */
function MaterialPreviewSphere({ material }) {
  const fallbackMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#777", roughness: 0.5, metalness: 0.1 }),
    []
  );
  const mat = material || fallbackMat;

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 64, 64);
    // ✅ AO用 uv2 を追加（uv をコピー）
    if (g.attributes?.uv && !g.attributes?.uv2) {
      g.setAttribute("uv2", new THREE.BufferAttribute(g.attributes.uv.array, 2));
    }
    return g;
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <Canvas
      // 単一球の静止プレビュー。常時描画は無駄なので demand。
      // マテリアルを直接ミューテートする箇所では invalidate() を呼んで1フレーム描く。
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 0, 2.8], fov: 45, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 4, 2]} intensity={1.0} />
      <directionalLight position={[-3, -2, 1]} intensity={0.35} />
      <mesh rotation={[0.35, 0.55, 0]} geometry={geo}>
        <primitive object={mat} attach="material" />
      </mesh>
    </Canvas>
  );
}

function getTextureThumbUrl(tex) {
  const img = tex?.image;
  if (!img) return null;

  // HTMLImageElement
  if (typeof img.src === "string" && img.src) return img.src;

  // Canvas
  if (typeof img.toDataURL === "function") return img.toDataURL();

  return null;
}

function clamp01(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return THREE.MathUtils.clamp(n, 0, 1);
}

export default function PropertiesMaterialPanel({ selection, textureLibrary = [] }) {
  const theme = useTheme();
  const [tab, setTab] = useState("main");
  const handleChangeTab = useCallback((_, v) => setTab(v), []);

  // ✅ BottomBar picker openers
  const openTexturePicker = useMaterialPickerStore((s) => s.openTexturePicker);
  const openMaterialPicker = useMaterialPickerStore((s) => s.openMaterialPicker);

  // ============================================================
  // ✅ selection.material を clone して Preview 用 material にする
  // ============================================================
  const previewMaterial = useMemo(() => {
    const m = selection?.material;
    if (!m) return null;
    try {
      const c = m.clone?.() ? m.clone() : null;
      if (!c) return null;
      return c;
    } catch {
      return null;
    }
  }, [selection?.materialUuid, selection?.material]);

  // ============================================================
  // ✅ Slider states
  // ============================================================
  const [roughness, setRoughness] = useState(0.35);
  const [metallic, setMetallic] = useState(0.1);
  const [opacity, setOpacity] = useState(1);

  // ✅ NEW: Normal / AO / Emissive
  const [normalStrength, setNormalStrength] = useState(1.0); // 0..2
  const [aoStrength, setAoStrength] = useState(1.0); // 0..2
  const [emissiveStrength, setEmissiveStrength] = useState(0.0); // 0..3

  // selection切替時：materialからスライダー初期化
  useEffect(() => {
    const m = selection?.material;
    if (!m) return;

    const r = Number.isFinite(m.roughness) ? m.roughness : 0.35;
    const me = Number.isFinite(m.metalness) ? m.metalness : 0.1;
    const op = Number.isFinite(m.opacity) ? m.opacity : 1;

    setRoughness(clamp01(r, 0.35));
    setMetallic(clamp01(me, 0.1));
    setOpacity(clamp01(op, 1));

    // normalScale は Vector2
    const ns = m.normalScale;
    const nsVal =
      ns && typeof ns.x === "number" && typeof ns.y === "number"
        ? (Math.abs(ns.x) + Math.abs(ns.y)) * 0.5
        : 1.0;
    setNormalStrength(THREE.MathUtils.clamp(nsVal, 0, 2));

    // aoMapIntensity
    const ao = Number.isFinite(m.aoMapIntensity) ? m.aoMapIntensity : 1.0;
    setAoStrength(THREE.MathUtils.clamp(ao, 0, 2));

    // emissiveIntensity
    const ei = Number.isFinite(m.emissiveIntensity) ? m.emissiveIntensity : 0.0;
    setEmissiveStrength(THREE.MathUtils.clamp(ei, 0, 3));
  }, [selection?.materialUuid, selection?.material]);

  // ============================================================
  // ✅ Slider変更 → previewMaterialへ反映
  // ============================================================
  useEffect(() => {
    const m = previewMaterial;
    if (!m) return;

    if (Number.isFinite(m.roughness)) m.roughness = roughness;
    if (Number.isFinite(m.metalness)) m.metalness = metallic;

    if ("opacity" in m) {
      m.opacity = opacity;
      m.transparent = opacity < 0.999;
      m.depthWrite = opacity >= 0.999;
    }

    // normalScale
    if (m.normalScale && typeof m.normalScale.set === "function") {
      m.normalScale.set(normalStrength, normalStrength);
    }

    // aoMapIntensity
    if (Number.isFinite(m.aoMapIntensity)) {
      m.aoMapIntensity = aoStrength;
    }

    // emissiveIntensity（emissive color が無い場合はうっすら白を入れる）
    if (Number.isFinite(m.emissiveIntensity)) {
      if (!m.emissive && "emissive" in m) {
        m.emissive = new THREE.Color(1, 1, 1);
      }
      m.emissiveIntensity = emissiveStrength;
    }

    m.needsUpdate = true;
    invalidate(); // demand canvas を1フレーム再描画
  }, [previewMaterial, roughness, metallic, opacity, normalStrength, aoStrength, emissiveStrength]);

  // ============================================================
  // ✅ テクスチャセットを previewMaterial に適用（map/normal/ao）
  // payload想定: { mapUrl?, normalUrl?, aoUrl?, name?, id? }
  // ============================================================
  const applyTextureSetToPreview = useCallback(
    (payload) => {
      const m = previewMaterial;
      if (!m) return;

      const loader = new THREE.TextureLoader();
      const loadTex = (url, onDone) => {
        if (!url) return onDone?.(null);
        loader.load(
          url,
          (tex) => onDone?.(tex),
          undefined,
          () => onDone?.(null)
        );
      };

      loadTex(payload?.mapUrl, (tex) => {
        if (tex && "map" in m) {
          m.map = tex;
          m.map.needsUpdate = true;
          m.needsUpdate = true;
          invalidate();
        }
      });

      loadTex(payload?.normalUrl, (tex) => {
        if (tex && "normalMap" in m) {
          m.normalMap = tex;
          m.normalMap.needsUpdate = true;
          // normalScale は今の slider 値で
          if (m.normalScale?.set) m.normalScale.set(normalStrength, normalStrength);
          m.needsUpdate = true;
          invalidate();
        }
      });

      loadTex(payload?.aoUrl, (tex) => {
        if (tex && "aoMap" in m) {
          m.aoMap = tex;
          m.aoMap.needsUpdate = true;
          if (Number.isFinite(m.aoMapIntensity)) m.aoMapIntensity = aoStrength;
          m.needsUpdate = true;
          invalidate();
        }
      });
    },
    [previewMaterial, normalStrength, aoStrength]
  );

  const panelSx = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }),
    []
  );

  const materialName = useMemo(() => {
    return selection?.materialName || selection?.name || selection?.slot || selection?.meshName || "Material";
  }, [selection]);

  const uuid = useMemo(() => {
    return selection?.materialUuid || selection?.uuid || selection?.id || "";
  }, [selection]);

  const objectLabel = useMemo(() => {
    return selection?.ownerItemId || selection?.itemId || selection?.objectId || "unknown";
  }, [selection]);

  const texThumb = useMemo(() => {
    const m = previewMaterial || selection?.material;
    const url = getTextureThumbUrl(m?.map);
    return url;
  }, [selection?.materialUuid, selection?.material, previewMaterial]);

  const hasNormal = useMemo(() => {
    const m = previewMaterial || selection?.material;
    return !!m?.normalMap;
  }, [previewMaterial, selection?.material]);

  const hasAO = useMemo(() => {
    const m = previewMaterial || selection?.material;
    return !!m?.aoMap;
  }, [previewMaterial, selection?.material]);

  const hasEmissive = useMemo(() => {
    const m = previewMaterial || selection?.material;
    return "emissiveIntensity" in (m || {});
  }, [previewMaterial, selection?.material]);

  return (
    <Box sx={panelSx}>
      {/* ===== Header ===== */}
      <Box sx={{ px: 1.25, pt: 1.0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 13.2 }} noWrap>
              {materialName}
            </Typography>

            <Stack spacing={0.25} sx={{ mt: 0.35 }}>
              <Typography sx={{ fontSize: 11.2, opacity: 0.72 }} noWrap>
                name: {smallText(selection?.materialName || selection?.name || "(none)")}
              </Typography>
              <Typography sx={{ fontSize: 11.2, opacity: 0.72 }} noWrap>
                uuid: {smallText(uuid)}
              </Typography>
              <Typography sx={{ fontSize: 11.2, opacity: 0.72 }} noWrap>
                object: {smallText(objectLabel)}
              </Typography>
            </Stack>
          </Box>

          <Tooltip title="More" arrow>
            <IconButton
              size="small"
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)",
                border: `1px solid ${alpha("#fff", 0.10)}`,
                background: "color-mix(in srgb, var(--brand-bg) 18%, transparent)",
                "&:hover": { background: "color-mix(in srgb, var(--brand-bg) 25%, transparent)" },
              }}
              onClick={() => console.log("[MaterialPanel] more")}
            >
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.08) }} />

      {/* ===== Tabs ===== */}
      <Box sx={{ px: 0.75 }}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          sx={{
            minHeight: 40,
            "& .MuiTabs-indicator": {
              height: 3,
              borderRadius: 999,
              background: theme.palette.primary.main,
            },
            "& .MuiTab-root": {
              minHeight: 40,
              textTransform: "none",
              color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)",
              px: 1,
            },
            "& .Mui-selected": { color: "var(--brand-fg)" },
          }}
        >
          <Tab value="main" label={<TabLabel icon={<GridViewRoundedIcon sx={{ fontSize: 16 }} />} label="Main" />} />
          <Tab value="uv" label={<TabLabel icon={<TextureRoundedIcon sx={{ fontSize: 16 }} />} label="UV" />} />
          <Tab value="misc" label={<TabLabel icon={<TuneRoundedIcon sx={{ fontSize: 16 }} />} label="Misc." />} />
          <Tab
            value="assign"
            label={<TabLabel icon={<PlaylistAddCheckRoundedIcon sx={{ fontSize: 16 }} />} label="Assign" />}
          />
        </Tabs>
      </Box>

      {/* ===== Scroll Area ===== */}
      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "auto",
          px: 1.25,
          pb: 1.25,
          "&::-webkit-scrollbar": { width: 10 },
          "&::-webkit-scrollbar-thumb": {
            background: alpha("#fff", 0.14),
            borderRadius: 20,
          },
        }}
      >
        {/* ===== Preview Sphere ===== */}
        <Box
          sx={{
            mt: 1.1,
            borderRadius: 2,
            border: `1px solid ${alpha("#fff", 0.10)}`,
            background: "color-mix(in srgb, var(--brand-bg) 22%, transparent)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: 170,
              position: "relative",
              background:
                "radial-gradient(circle at 30% 25%, rgb(var(--brand-fg-rgb) / 0.18), rgba(0,0,0,0.55))",
            }}
          >
            <Box sx={{ position: "absolute", inset: 0 }}>
              <MaterialPreviewSphere material={previewMaterial} />
            </Box>

            <Typography
              sx={{
                position: "absolute",
                bottom: 10,
                left: 12,
                fontSize: 11,
                opacity: 0.65,
                pointerEvents: "none",
              }}
            >
              Preview
            </Typography>

            {/* ✅ 3点ドット：MaterialLibraryPanel を開いてプレビュー材を置換 */}
            <Tooltip title="Replace preview material" arrow>
              <IconButton
                size="small"
                onClick={() => {
                  openMaterialPicker?.((picked) => {
                    // picked.material は THREE.Material 想定（MaterialLibraryPanel側で用意）
                    const next = picked?.material;
                    if (!next) return;
                    // プレビュー材を「差し替え」= previewMaterial を作り直す必要があるため、
                    // ここでは “selection.material を偽装する” のではなく、MVPとして
                    // picked.material を clone して previewMaterial に適用…が理想。
                    // ただし previewMaterial は useMemoなので直接差し替え不可。
                    // → MVP: picked.material を selection.material として親から渡す設計にするのが正攻法。
                    // 今回は簡易に「picked.material の各マップ/値を previewMaterial にコピー」する。
                    const m = previewMaterial;
                    if (!m) return;

                    // map類
                    if ("map" in m) m.map = next.map || null;
                    if ("normalMap" in m) m.normalMap = next.normalMap || null;
                    if ("aoMap" in m) m.aoMap = next.aoMap || null;
                    if ("roughnessMap" in m) m.roughnessMap = next.roughnessMap || null;
                    if ("metalnessMap" in m) m.metalnessMap = next.metalnessMap || null;

                    // 色/値
                    if ("color" in m && next.color) m.color.copy(next.color);
                    if (Number.isFinite(m.roughness) && Number.isFinite(next.roughness)) setRoughness(clamp01(next.roughness, roughness));
                    if (Number.isFinite(m.metalness) && Number.isFinite(next.metalness)) setMetallic(clamp01(next.metalness, metallic));
                    if ("opacity" in m && Number.isFinite(next.opacity)) setOpacity(clamp01(next.opacity, opacity));

                    // emissive
                    if ("emissive" in m && next.emissive) {
                      if (!m.emissive) m.emissive = new THREE.Color(1, 1, 1);
                      m.emissive.copy(next.emissive);
                    }
                    if (Number.isFinite(m.emissiveIntensity) && Number.isFinite(next.emissiveIntensity)) {
                      setEmissiveStrength(THREE.MathUtils.clamp(next.emissiveIntensity, 0, 3));
                    }

                    m.needsUpdate = true;
                  });
                }}
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  color: "color-mix(in srgb, var(--brand-fg) 86%, transparent)",
                  border: `1px solid ${alpha("#fff", 0.12)}`,
                  background: "color-mix(in srgb, var(--brand-bg) 22%, transparent)",
                  "&:hover": { background: "color-mix(in srgb, var(--brand-bg) 30%, transparent)" },
                }}
              >
                <MoreHorizRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ===== Content by tab ===== */}
        {tab === "main" && (
          <Box sx={{ mt: 1.2 }}>
            <Stack spacing={0.6}>
              <PropertyRow
                icon={<InvertColorsRoundedIcon sx={{ fontSize: 16 }} />}
                label="Color"
                onClick={() => console.log("[MaterialPanel] Color")}
              />

              {/* ✅ Texture：右側にサムネ + クリックで TextureLibraryPanel */}
              <PropertyRow
                icon={<ImageRoundedIcon sx={{ fontSize: 16 }} />}
                label="Texture"
                onClick={() => {
                  openTexturePicker?.((tex) => {
                    // tex: { mapUrl?, normalUrl?, aoUrl? ... }
                    applyTextureSetToPreview(tex);
                  });
                }}
                right={
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      openTexturePicker?.((tex) => applyTextureSetToPreview(tex));
                    }}
                    sx={{
                      width: 44,
                      height: 26,
                      borderRadius: 1.2,
                      overflow: "hidden",
                      border: `1px solid ${alpha("#fff", 0.14)}`,
                      background: "color-mix(in srgb, var(--brand-bg) 25%, transparent)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    {texThumb ? (
                      <img
                        src={texThumb}
                        alt="tex"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 10, opacity: 0.55 }}>—</Typography>
                    )}
                  </Box>
                }
              />

              <PropertyRow
                icon={<BlurOnRoundedIcon sx={{ fontSize: 16 }} />}
                label="Roughness"
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={roughness}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(_, v) => setRoughness(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />

              <PropertyRow
                icon={<GrainRoundedIcon sx={{ fontSize: 16 }} />}
                label="Metallic"
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={metallic}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(_, v) => setMetallic(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />

              {/* ✅ Normal slider */}
              <PropertyRow
                icon={<WavesRoundedIcon sx={{ fontSize: 16 }} />}
                label="Normal"
                disabled={!hasNormal}
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={normalStrength}
                      min={0}
                      max={2}
                      step={0.01}
                      disabled={!hasNormal}
                      onChange={(_, v) => setNormalStrength(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />

              {/* ✅ AO slider */}
              <PropertyRow
                icon={<ViewComfyRoundedIcon sx={{ fontSize: 16 }} />}
                label="Ambient occlusion"
                disabled={!hasAO}
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={aoStrength}
                      min={0}
                      max={2}
                      step={0.01}
                      disabled={!hasAO}
                      onChange={(_, v) => setAoStrength(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />

              {/* ✅ Emissive slider */}
              <PropertyRow
                icon={<LightModeRoundedIcon sx={{ fontSize: 16 }} />}
                label="Emissive"
                disabled={!hasEmissive}
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={emissiveStrength}
                      min={0}
                      max={3}
                      step={0.01}
                      disabled={!hasEmissive}
                      onChange={(_, v) => setEmissiveStrength(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />

              <PropertyRow
                icon={<OpacityRoundedIcon sx={{ fontSize: 16 }} />}
                label="Opacity"
                onClick={() => {}}
                right={
                  <Box sx={{ width: 120, pr: 0.25 }}>
                    <Slider
                      size="small"
                      value={opacity}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(_, v) => setOpacity(Number(v))}
                      sx={{
                        color: theme.palette.primary.main,
                        "& .MuiSlider-rail": { opacity: 0.35 },
                      }}
                    />
                  </Box>
                }
              />
            </Stack>

            <Divider sx={{ my: 1.25, borderColor: alpha("#fff", 0.08) }} />

            <Typography sx={{ fontSize: 11.5, opacity: 0.65, lineHeight: 1.55 }}>
              ※ Preview は「クリックした material を clone して表示」しています（安全）。<br />
              右上の「…」から Material Library を開いて preview の材を差し替えできます。
            </Typography>
          </Box>
        )}

        {tab === "uv" && (
          <Box sx={{ mt: 1.2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>UV</Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.7, mt: 0.5, lineHeight: 1.6 }}>
              ここに Tiling / Offset / Rotation などのUV調整を入れます（後で実装）。
            </Typography>
          </Box>
        )}

        {tab === "misc" && (
          <Box sx={{ mt: 1.2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Misc.</Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.7, mt: 0.5, lineHeight: 1.6 }}>
              ここに透明度モード、両面表示、アルファカットなどを入れます（後で実装）。
            </Typography>
          </Box>
        )}

        {tab === "assign" && (
          <Box sx={{ mt: 1.2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Assign</Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.7, mt: 0.5, lineHeight: 1.6 }}>
              ここに「このマテリアルをどこに割り当てるか」(mesh / slot / selection) を入れます（後で実装）。
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
