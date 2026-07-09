import React, { useState, useEffect, useMemo, Suspense } from "react";
import {
  Box, Typography, Button, Chip, IconButton, CircularProgress,
  Select, MenuItem, TextField,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center, Bounds } from "@react-three/drei";
import { db, storage } from "@/shared/config/firebase";
import { BRAND } from "@/shared/ui/theme";

function InfoRow({ label, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{
        fontSize: 10, fontWeight: 600, color: "rgba(148,163,184,0.6)",
        textTransform: "uppercase", letterSpacing: 0.8, mb: 0.5,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function FieldRow({ label, children }) {
  return (
    <Box sx={{ px: 2, mb: 1.75 }}>
      <Typography sx={{
        fontSize: 11, fontWeight: 700, color: BRAND.sub,
        textTransform: "uppercase", letterSpacing: 0.6, mb: 0.6,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function ReadOnlyInput({ value, muted }) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center",
      px: 1.25, py: 0.85,
      fontSize: 12,
      color: muted ? BRAND.sub2 : BRAND.text,
      bgcolor: "rgba(0,0,0,0.25)",
      border: `1px solid ${BRAND.line}`,
      borderRadius: 1.5,
      minHeight: 32,
      lineHeight: 1.3,
      wordBreak: "break-word",
    }}>
      {value ?? ""}
    </Box>
  );
}

function SelectDisplay({ value, placeholder }) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      px: 1.25, py: 0.85,
      fontSize: 12,
      color: value ? BRAND.text : BRAND.sub2,
      bgcolor: "rgba(0,0,0,0.25)",
      border: `1px solid ${BRAND.line}`,
      borderRadius: 1.5,
      minHeight: 32,
      cursor: "pointer",
      "&:hover": { borderColor: BRAND.line2 },
    }}>
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || placeholder}
      </Box>
      <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: BRAND.sub, flexShrink: 0, ml: 0.5 }} />
    </Box>
  );
}

function DimInput({ axis, value }) {
  return (
    <Box sx={{
      flex: 1, display: "flex", alignItems: "center",
      bgcolor: "rgba(0,0,0,0.25)",
      border: `1px solid ${BRAND.line}`,
      borderRadius: 1.5,
      height: 32, px: 1,
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: BRAND.sub2, mr: 0.75 }}>
        {axis}
      </Typography>
      <Typography sx={{
        flex: 1, fontSize: 12, color: value ? BRAND.text : BRAND.sub2,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}

function pickGlbSource(model) {
  if (!model) return "";
  return (
    model.glbUrl ||
    model.viewerGlbUrl ||
    model.modelGlbUrl ||
    model.files?.glb?.url ||
    model.files?.glb?.downloadUrl ||
    model.files?.glb?.downloadURL ||
    model.files?.glb?.path ||
    model.files?.glb?.storagePath ||
    model.files?.glb?.fullPath ||
    model.glbStoragePath ||
    model.asset?.glbUrl ||
    (typeof model.downloadUrl === "string" && /\.glb($|\?)/i.test(model.downloadUrl) ? model.downloadUrl : "") ||
    ""
  );
}

function useResolvedGlbUrl(raw) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    const s = String(raw || "").trim();
    if (!s) { setUrl(""); return () => { alive = false; }; }

    const isHttp = /^https?:\/\//i.test(s);
    if (isHttp) {
      setUrl(s);
      return () => { alive = false; };
    }

    getDownloadURL(storageRef(storage, s))
      .then((u) => { if (alive) setUrl(u); })
      .catch((e) => {
        console.warn("[ModelDetail] failed to resolve GLB url", e);
        if (alive) { setUrl(""); setError(e); }
      });

    return () => { alive = false; };
  }, [raw]);

  return { url, error };
}

function GlbModel({ url }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => (gltf?.scene ? gltf.scene.clone(true) : null), [gltf?.scene]);

  useEffect(() => {
    scene?.traverse?.((c) => {
      if (c?.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
  }, [scene]);

  if (!scene) return null;
  return <primitive object={scene} />;
}

class ViewerErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e) { console.warn("[ModelDetail] 3D viewer error:", e); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function ViewerLoading() {
  return (
    <Box sx={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 1.5, color: "rgba(255,255,255,0.55)", fontSize: 12,
      pointerEvents: "none",
    }}>
      <CircularProgress size={20} sx={{ color: "rgba(255,255,255,0.6)" }} />
      3Dモデルを読み込み中...
    </Box>
  );
}

function ViewerEmptyState({ message }) {
  return (
    <Box sx={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 1, width: "100%", height: "100%",
    }}>
      <ViewInArRoundedIcon sx={{ fontSize: 56, color: "rgba(255,255,255,0.15)" }} />
      <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
        {message}
      </Typography>
    </Box>
  );
}

function Model3DViewer({ rawUrl }) {
  const { url, error } = useResolvedGlbUrl(rawUrl);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(false); }, [url]);

  if (!rawUrl) {
    return <ViewerEmptyState message="このモデルには3Dファイルがありません" />;
  }
  if (error) {
    return <ViewerEmptyState message="3Dモデルの読み込みに失敗しました" />;
  }

  return (
    <Box sx={{ position: "absolute", inset: 0 }}>
      {url ? (
        <ViewerErrorBoundary fallback={<ViewerEmptyState message="3Dモデルを表示できませんでした" />}>
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [3, 2.4, 3.6], fov: 40, near: 0.01, far: 2000 }}
            onCreated={() => setReady(true)}
            gl={{ antialias: true, preserveDrawingBuffer: false }}
          >
            <color attach="background" args={["#000000"]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={[0xffffff, 0x222233, 0.45]} />
            <directionalLight
              position={[6, 8, 4]}
              intensity={1.0}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.2}>
                <Center>
                  <GlbModel url={url} />
                </Center>
              </Bounds>
              <Environment preset="city" />
            </Suspense>
            <gridHelper args={[20, 20, 0x444455, 0x222233]} />
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.12}
              minDistance={0.3}
              maxDistance={50}
            />
          </Canvas>
          {!ready && <ViewerLoading />}
        </ViewerErrorBoundary>
      ) : (
        <ViewerLoading />
      )}
    </Box>
  );
}

function RelatedCard({ model, onClick }) {
  const thumbUrl = model.thumbnailUrl || model.thumbnail?.url || model.imageUrl || "";
  const title = model.name || model.title || "Untitled";
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative", aspectRatio: "1/1", borderRadius: 2, overflow: "hidden",
        cursor: "pointer", bgcolor: "#020617",
        border: "1px solid rgba(148,163,184,0.15)",
        transition: "border-color 0.2s",
        "&:hover": { borderColor: "rgba(148,163,184,0.4)" },
        "&:hover .rel-overlay": { opacity: 1 },
      }}
    >
      {thumbUrl && (
        <Box
          component="img"
          src={thumbUrl}
          alt={title}
          loading="lazy"
          sx={{
            position: "absolute",
            top: "-75%", left: "-75%",
            width: "250%", height: "250%",
            objectFit: "contain",
          }}
        />
      )}
      <Box
        className="rel-overlay"
        sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(2,6,23,0.9) 0%, transparent 100%)",
          p: 0.75, opacity: 0, transition: "opacity 0.2s",
        }}
      >
        <Typography noWrap sx={{ fontSize: 10, color: "#e2e8f0" }}>{title}</Typography>
      </Box>
    </Box>
  );
}

export default function ModelDetailPage() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedModels, setRelatedModels] = useState([]);
  const [viewMode, setViewMode] = useState("3d");
  const [infoTab, setInfoTab] = useState("info");

  useEffect(() => {
    if (!modelId) return;
    setLoading(true);
    setModel(null);
    setRelatedModels([]);

    getDoc(doc(db, "assets", modelId)).then(async (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setModel(data);
        try {
          const q = query(
            collection(db, "assets"),
            where("type", "==", "3d-model"),
            where("visibility", "==", "public"),
            limit(7),
          );
          const relSnap = await getDocs(q);
          setRelatedModels(
            relSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((m) => m.id !== modelId)
              .slice(0, 6),
          );
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [modelId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", bgcolor: BRAND.bg }}>
        <CircularProgress size={28} sx={{ color: "#ff5252" }} />
      </Box>
    );
  }

  if (!model) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", bgcolor: BRAND.bg }}>
        <ViewInArRoundedIcon sx={{ fontSize: 56, color: BRAND.sub2, mb: 2 }} />
        <Typography sx={{ color: BRAND.text, fontWeight: 600 }}>モデルが見つかりません</Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2, color: "#60a5fa", textTransform: "none" }}>← 戻る</Button>
      </Box>
    );
  }

  const thumbnailUrl = model.thumbnailUrl || model.thumbnail?.url || model.imageUrl || model.previewUrl || "";
  const title = model.name || model.title || "Untitled";
  const glbRawUrl = pickGlbSource(model);
  const effectiveViewMode = !glbRawUrl && viewMode === "3d" ? "2d" : viewMode;

  const dims = model.dimensions || {};
  const w = dims.w || dims.width || model.width || null;
  const d = dims.d || dims.depth || model.depth || null;
  const h = dims.h || dims.height || model.height || null;
  const hasDims = w || d || h;

  const visibilityLabel =
    model.visibility === "public" ? "全体公開" :
    model.visibility === "private" ? "非公開" :
    model.visibility || "—";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: BRAND.bg, color: BRAND.text, overflow: "hidden" }}>

      {/* Back bar */}
      <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate(-1)}
          sx={{
            textTransform: "none", color: BRAND.sub, fontSize: 13, px: 1, borderRadius: 1.5,
            "&:hover": { color: BRAND.text, bgcolor: BRAND.glow },
          }}
        >
          Back
        </Button>
      </Box>

      {/* Main area */}
      <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* Left: viewer + related */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>

          {/* Viewer */}
          <Box sx={{
            position: "relative", bgcolor: "#000", flexShrink: 0,
            height: "min(520px, 55vh)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            {/* 2D / 3D toggle */}
            <Box sx={{
              position: "absolute", top: 12, left: 12, zIndex: 10,
              display: "flex",
              bgcolor: "rgba(0,0,0,0.55)", borderRadius: 1.5,
              border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden",
            }}>
              {[
                { key: "2d", label: "2D", icon: <ImageRoundedIcon sx={{ fontSize: 13 }} /> },
                { key: "3d", label: "3D", icon: <ViewInArRoundedIcon sx={{ fontSize: 13 }} /> },
              ].map(({ key, label, icon }) => (
                <Button
                  key={key}
                  size="small"
                  startIcon={icon}
                  onClick={() => setViewMode(key)}
                  sx={{
                    textTransform: "none", fontSize: 12, px: 1.5, py: 0.5,
                    borderRadius: 0, minWidth: 0,
                    color: effectiveViewMode === key ? "#fff" : "rgba(255,255,255,0.45)",
                    bgcolor: effectiveViewMode === key ? "rgba(255,255,255,0.14)" : "transparent",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.09)" },
                    gap: 0.5,
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>

            {effectiveViewMode === "2d" ? (
              thumbnailUrl ? (
                <Box
                  component="img"
                  src={thumbnailUrl}
                  alt={title}
                  sx={{
                    position: "absolute",
                    top: "-75%", left: "-75%",
                    width: "250%", height: "250%",
                    objectFit: "contain",
                    filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.7))",
                    transition: "transform 0.3s ease",
                    "&:hover": { transform: "scale(1.04)" },
                  }}
                />
              ) : (
                <ViewInArRoundedIcon sx={{ fontSize: 80, color: "rgba(255,255,255,0.1)" }} />
              )
            ) : (
              <Model3DViewer rawUrl={glbRawUrl} />
            )}
          </Box>

          {/* Thumbnail strip + ADD */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1.5,
            px: 2.5, py: 1.5,
            borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0,
          }}>
            {thumbnailUrl && (
              <Box
                component="img"
                src={thumbnailUrl}
                onClick={() => setViewMode("2d")}
                sx={{
                  width: 52, height: 52, borderRadius: 1.5, objectFit: "contain",
                  bgcolor: "#020617",
                  border: `2px solid ${effectiveViewMode === "2d" ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.1)"}`,
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
              />
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<AddRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                textTransform: "none", fontSize: 12, px: 2, py: 0.75,
                borderRadius: 1.5, fontWeight: 700,
                bgcolor: "#29b6f6", color: "#000",
                "&:hover": { bgcolor: "#039be5" },
              }}
            >
              ADD
            </Button>
          </Box>

          {/* Related models */}
          <Box sx={{ p: 2.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: BRAND.text, mb: 2 }}>
              関連モデル / Other related items
            </Typography>
            {relatedModels.length > 0 ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 1.5 }}>
                {relatedModels.map((m) => (
                  <RelatedCard
                    key={m.id}
                    model={m}
                    onClick={() => navigate(`/app/share/model/${m.id}`)}
                  />
                ))}
              </Box>
            ) : (
              <Typography sx={{ color: BRAND.sub2, fontSize: 13 }}>関連モデルがありません</Typography>
            )}
          </Box>
        </Box>

        {/* Right: info panel — single column 360px, Desktop-style form */}
        <Box sx={{
          width: 360, flexShrink: 0,
          borderLeft: `1px solid ${BRAND.line}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Tab header: ⓘ Model Info | 🔧 セットアップ */}
          <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 2, py: 1,
            borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0,
          }}>
            <Button
              size="small"
              startIcon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => setInfoTab("info")}
              sx={{
                textTransform: "none", fontSize: 13, fontWeight: 600, px: 1,
                color: infoTab === "info" ? "#fff" : BRAND.sub2,
                bgcolor: "transparent",
                borderBottom: infoTab === "info" ? "2px solid #60a5fa" : "2px solid transparent",
                borderRadius: 0,
                "&:hover": { bgcolor: BRAND.glow },
              }}
            >
              Model Info
            </Button>
            <Button
              size="small"
              startIcon={<BuildRoundedIcon sx={{ fontSize: 13 }} />}
              onClick={() => setInfoTab("setup")}
              sx={{
                textTransform: "none", fontSize: 12, fontWeight: 700,
                px: 1.5, py: 0.4, borderRadius: 999,
                bgcolor: infoTab === "setup" ? "#d97706" : "rgba(217,119,6,0.18)",
                color: infoTab === "setup" ? "#000" : "#f59e0b",
                "&:hover": { bgcolor: "#d97706", color: "#000" },
              }}
            >
              セットアップ
            </Button>
          </Box>

          {infoTab === "info" && (
            <Box sx={{ flex: 1, overflow: "auto" }}>

              {/* Title (Desktop-style: full-width above preview) */}
              <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
                <Typography sx={{
                  fontSize: 18, fontWeight: 700, color: BRAND.text,
                  lineHeight: 1.25, wordBreak: "break-word",
                }}>
                  {title}
                </Typography>
              </Box>

              {/* Big preview (Desktop-style: 4/3 aspect, full panel width) */}
              <Box sx={{ px: 2, mb: 1.5 }}>
                <Box sx={{
                  width: "100%", aspectRatio: "4 / 3",
                  borderRadius: 2, overflow: "hidden",
                  bgcolor: "rgba(0,0,0,0.25)",
                  border: `1px solid ${BRAND.line}`,
                  position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {thumbnailUrl ? (
                    <Box
                      component="img"
                      src={thumbnailUrl}
                      alt={title}
                      sx={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%",
                        objectFit: "cover",
                        transform: "scale(1.6)",
                      }}
                    />
                  ) : (
                    <ViewInArRoundedIcon sx={{ fontSize: 56, color: "rgba(255,255,255,0.12)" }} />
                  )}
                </Box>
              </Box>

              {/* Download + bookmark + favorite row */}
              <Box sx={{ px: 2, mb: 2, display: "flex", gap: 0.75, alignItems: "center" }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadRoundedIcon sx={{ fontSize: 15 }} />}
                  endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 14 }} />}
                  href={model.downloadUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={!model.downloadUrl}
                  sx={{
                    flex: 1, minWidth: 0,
                    textTransform: "none", fontSize: 12, py: 0.85,
                    borderRadius: 1.5,
                    justifyContent: "space-between",
                    bgcolor: "#1e88e5",
                    "&:hover": { bgcolor: "#1565c0" },
                  }}
                >
                  Download
                </Button>
                <IconButton size="small" sx={{
                  color: BRAND.sub, border: `1px solid ${BRAND.line}`,
                  borderRadius: 1.5, width: 32, height: 32, flexShrink: 0,
                  "&:hover": { color: BRAND.text, bgcolor: BRAND.glow },
                }}>
                  <BookmarkBorderRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" sx={{
                  color: BRAND.sub, border: `1px solid ${BRAND.line}`,
                  borderRadius: 1.5, width: 32, height: 32, flexShrink: 0,
                  "&:hover": { color: "#f87171", bgcolor: "rgba(248,113,113,0.1)" },
                }}>
                  <FavoriteBorderRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {/* Version selector */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: BRAND.sub, whiteSpace: "nowrap" }}>
                  バージョンを選択:
                </Typography>
                <Select
                  value="v2"
                  size="small"
                  IconComponent={KeyboardArrowDownRoundedIcon}
                  sx={{
                    flex: 1, height: 30, fontSize: 12, color: BRAND.text,
                    bgcolor: "rgba(0,0,0,0.25)",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.line },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.line2 },
                    "& .MuiSelect-icon": { color: BRAND.sub },
                  }}
                  MenuProps={{ PaperProps: { sx: { bgcolor: "#1a1f2b", color: "#fff", border: `1px solid ${BRAND.line}` } } }}
                >
                  <MenuItem value="v2" sx={{ fontSize: 12 }}>v2 (最新版)</MenuItem>
                  <MenuItem value="v1" sx={{ fontSize: 12 }}>v1</MenuItem>
                </Select>
                <IconButton size="small" sx={{ color: BRAND.sub, "&:hover": { color: BRAND.text, bgcolor: BRAND.glow } }}>
                  <SettingsRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Box>

              {/* AI auto-fill button */}
              <Box sx={{ px: 2, mb: 2.5 }}>
                <Button
                  fullWidth
                  startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    textTransform: "none",
                    background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                    color: "#fff", fontWeight: 600, fontSize: 12,
                    py: 1, borderRadius: 1.5,
                    "&:hover": { background: "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)" },
                  }}
                >
                  AIによる寸法・カテゴリ自動入力
                </Button>
              </Box>

              {/* TITLE */}
              <FieldRow label="TITLE">
                <ReadOnlyInput value={title} />
              </FieldRow>

              {/* VISIBILITY toggle */}
              <FieldRow label="VISIBILITY">
                <Box sx={{
                  display: "flex",
                  border: `1px solid ${BRAND.line}`,
                  borderRadius: 1.5, overflow: "hidden",
                }}>
                  <Box sx={{
                    flex: 1, py: 0.85, textAlign: "center",
                    fontSize: 12, cursor: "pointer",
                    bgcolor: model.visibility === "public" ? "rgba(96,165,250,0.18)" : "transparent",
                    color: model.visibility === "public" ? "#60a5fa" : BRAND.sub2,
                    fontWeight: model.visibility === "public" ? 600 : 400,
                    borderRight: `1px solid ${BRAND.line}`,
                  }}>
                    全体公開
                  </Box>
                  <Box sx={{
                    flex: 1, py: 0.85, textAlign: "center",
                    fontSize: 12, cursor: "pointer",
                    bgcolor: model.visibility === "private" ? "rgba(96,165,250,0.18)" : "transparent",
                    color: model.visibility === "private" ? "#60a5fa" : BRAND.sub2,
                    fontWeight: model.visibility === "private" ? 600 : 400,
                  }}>
                    非公開（自分のみ）
                  </Box>
                </Box>
              </FieldRow>

              {/* CATEGORIZATION dropdowns */}
              <FieldRow label="CATEGORIZATION">
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                  <SelectDisplay value={model.macroCategory || ""} placeholder="Select Macro Category" />
                  <SelectDisplay value={model.category || ""} placeholder="Select Category" />
                  <SelectDisplay value={model.subCategory || ""} placeholder="Select Detailed Category" />
                </Box>
              </FieldRow>

              {/* DIMENSIONS */}
              <FieldRow label="DIMENSIONS (mm)">
                <Box sx={{ display: "flex", gap: 0.75 }}>
                  <DimInput axis="W" value={w} />
                  <DimInput axis="D" value={d} />
                  <DimInput axis="H" value={h} />
                </Box>
              </FieldRow>

              {/* PRICE */}
              <FieldRow label="PRICE (JPY)">
                <ReadOnlyInput value={model.price ?? 0} />
              </FieldRow>

              {/* SPATIAL CONTEXT */}
              <Box sx={{ px: 2, mb: 2 }}>
                <Typography sx={{
                  fontSize: 11, fontWeight: 700, color: BRAND.sub,
                  textTransform: "uppercase", letterSpacing: 0.6, mb: 1.25,
                }}>
                  SPATIAL CONTEXT
                </Typography>
                {[
                  { label: "BUILDING TYPES", subLabel: "建物タイプ", value: model.buildingTypes },
                  { label: "ROOMS",          subLabel: "部屋",       value: model.rooms },
                  { label: "ZONES",          subLabel: "ゾーン",     value: model.zones },
                  { label: "COMPANION",      subLabel: "コンパニオン", value: model.companionClasses },
                ].map(({ label, subLabel, value }) => {
                  const display = Array.isArray(value) ? value.join(", ") : value;
                  return (
                    <Box key={label} sx={{ mb: 1.25 }}>
                      <Typography sx={{
                        fontSize: 10, fontWeight: 600, color: BRAND.sub2,
                        textTransform: "uppercase", letterSpacing: 0.4, mb: 0.4,
                      }}>
                        {label} <Box component="span" sx={{ textTransform: "none", color: "rgba(148,163,184,0.5)" }}>({subLabel})</Box>
                      </Typography>
                      <ReadOnlyInput value={display || "未分類"} muted={!display} />
                    </Box>
                  );
                })}
              </Box>

              {/* TAGS */}
              {model.tags && (Array.isArray(model.tags) ? model.tags.length > 0 : model.tags) && (
                <Box sx={{ px: 2, mb: 2, pt: 1.5, borderTop: `1px solid ${BRAND.line}` }}>
                  <Typography sx={{
                    fontSize: 11, fontWeight: 700, color: BRAND.sub,
                    textTransform: "uppercase", letterSpacing: 0.6, mb: 1,
                  }}>
                    TAGS
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(Array.isArray(model.tags) ? model.tags : [model.tags]).map((tag) => (
                      <Chip
                        key={tag} size="small" label={tag}
                        sx={{
                          bgcolor: "rgba(148,163,184,0.08)",
                          color: BRAND.sub,
                          border: `1px solid ${BRAND.line}`,
                          fontSize: 11, height: 22,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {infoTab === "setup" && (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
              <BuildRoundedIcon sx={{ fontSize: 40, color: "rgba(245,158,11,0.3)" }} />
              <Typography sx={{ color: BRAND.sub2, fontSize: 13 }}>セットアップ機能は準備中です</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
