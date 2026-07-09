import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box, Typography, Chip, Stack, Dialog, DialogContent,
  Button, Avatar, Skeleton, IconButton,
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LockIcon from "@mui/icons-material/Lock";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import ImageIcon from "@mui/icons-material/Image";
import DescriptionIcon from "@mui/icons-material/Description";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChairIcon from "@mui/icons-material/Chair";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PhotoIcon from "@mui/icons-material/Photo";
import { motion } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { useAuth } from "@/features/auth/context/AuthContext";
import { fetchPublicGalleryItems, getTypeMeta } from "@/shared/api/models/publicAssets";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "rgba(124,58,237,0.12)";
const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

// ── <model-viewer> ローダー（CDN を一度だけ注入） ─────────────────────────────
const MODEL_VIEWER_SRC =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
let _mvPromise = null;
function ensureModelViewer() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.customElements?.get("model-viewer")) return Promise.resolve(true);
  if (_mvPromise) return _mvPromise;
  _mvPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = MODEL_VIEWER_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return _mvPromise;
}
function useModelViewerReady() {
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.customElements?.get("model-viewer")
  );
  useEffect(() => {
    let on = true;
    ensureModelViewer().then((ok) => {
      if (!on || !ok) return;
      window.customElements?.whenDefined?.("model-viewer")
        .then(() => on && setReady(true))
        .catch(() => on && setReady(true));
      setReady(true);
    });
    return () => { on = false; };
  }, []);
  return ready;
}

const is3DModel = (item) => item?.type === "3d-model" && !!item?.glbUrl;

// アイコンをタイプ別に返す
const TypeIcon = ({ type, size = 20 }) => {
  const sx = { fontSize: size, color: "rgba(255,255,255,0.2)" };
  if (["image", "render"].includes(type)) return <AutoAwesomeIcon sx={sx} />;
  if (["diagram", "drawing", "diagram-state"].includes(type)) return <AccountTreeIcon sx={sx} />;
  if (["presentation"].includes(type)) return <SlideshowIcon sx={sx} />;
  if (type === "furniture-template") return <ChairIcon sx={sx} />;
  if (type === "layout-plan") return <SpaceDashboardIcon sx={sx} />;
  if (type === "layout-render") return <PhotoIcon sx={sx} />;
  if (type === "document") return <ImageIcon sx={sx} />;
  return <ViewInArIcon sx={sx} />;
};

// ── ライブ 3D プレビュー ───────────────────────────────────────────────────────
// 課題対応:
//  ① モデルが表示・回転するまでの「ラグ」→ シマー Skeleton を出し、load 完了で
//     フェードインさせて空白のままにしない。lazy で同時ダウンロードの輻輳も回避。
//  ② 横長・薄型の家具が正方フレームで小さく見える問題 → モデル実寸からカードの
//     アスペクト比を算出し、そのモデルのシルエットに合わせて枠ごと最適化する。
function Live3DPreview({ glbUrl, poster, color = "#7C3AED", onResult }) {
  const ref = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;
  const [ready, setReady] = useState(false);
  const [aspect, setAspect] = useState(1); // width / height（枠の縦横比）

  useEffect(() => {
    const mv = ref.current;
    if (!mv) return;
    setReady(false);
    setAspect(1);

    // model-viewer の load / error イベントはタイミングが不安定で取りこぼすことが
    // あるため、イベントには依存せず「実際の状態を一定間隔でポーリング」して
    // ① 表示（ready）と ② 枠比（aspect）を別々に確定させる方式にする。
    // setTimeout は rAF がスロットルされる環境でも確実に発火する。
    let cancelled = false;
    let revealed = false;
    let measured = false;
    let errored = false;
    let timer = 0;

    const poll = (tries = 0) => {
      if (cancelled) return;
      const mvNow = ref.current;
      if (!mvNow) return;

      // 破損 / 404 → 除外対象として通知（一度だけ）
      if (!errored && mvNow.error) {
        errored = true;
        cbRef.current?.("failed");
        return; // これ以上ポーリングしない
      }

      // ① ロード完了 → 即座にモデルを表示（シマー解除）。寸法計測は待たない。
      if (!revealed && mvNow.loaded) {
        revealed = true;
        setReady(true);
        cbRef.current?.("ok");
      }

      // ② バウンディングボックスが確定したら枠比を反映。
      if (!measured) {
        let d = null;
        try { d = mvNow.getDimensions?.(); } catch (_) { /* noop */ }
        if (d && d.y > 0.0001) {
          measured = true;
          const w = Math.hypot(d.x, d.z) || d.x || 1; // 回転中の最大水平幅 = xz 対角線
          const h = Math.max(d.y, 1e-4);              // 高さ
          const a = Math.min(1.6, Math.max(0.7, w / h)); // シルエットに合わせた枠比（クランプ）
          setAspect(a);
        }
      }

      // 両方そろうか、上限（~16s）に達するまで継続。
      if ((!revealed || !measured) && tries < 160) {
        timer = setTimeout(() => poll(tries + 1), 100);
      } else if (!revealed && !errored) {
        // ロードできずタイムアウト → 表示はするが正方のまま（除外しない）。
        setReady(true);
        cbRef.current?.("ok");
      }
    };
    poll(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [glbUrl]);

  return (
    <Box sx={{
      // 枠の高さは「padding-bottom %（= 幅基準）」で決める。
      // MUI/masonry のレイアウト文脈では aspect-ratio が効かないケースがあるため、
      // 幅に対する割合で高さを作るこの方式が確実。height = 幅 × (1 / aspect)。
      position: "relative", width: "100%", height: 0,
      paddingBottom: `${(100 / aspect).toFixed(3)}%`,
      transition: "padding-bottom 0.45s cubic-bezier(0.16,1,0.3,1)",
      overflow: "hidden",
      background: "radial-gradient(120% 100% at 50% 0%, #15131f 0%, #060509 78%)",
    }}>
      {/* ロード中の Skeleton（シマー） */}
      {!ready && (
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          background:
            "linear-gradient(110deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.02) 75%)",
          backgroundSize: "220% 100%",
          animation: "mvShimmer 1.5s ease-in-out infinite",
          "@keyframes mvShimmer": {
            "0%": { backgroundPosition: "220% 0" },
            "100%": { backgroundPosition: "-220% 0" },
          },
        }}>
          <ViewInArIcon sx={{ fontSize: 34, color: `${color}55` }} />
        </Box>
      )}
      <model-viewer
        ref={ref}
        src={glbUrl}
        poster={poster || undefined}
        auto-rotate=""
        auto-rotate-delay="0"
        rotation-per-second="26deg"
        interaction-prompt="none"
        disable-zoom=""
        disable-pan=""
        disable-tap=""
        camera-orbit="0deg 78deg auto"
        min-camera-orbit="auto auto auto"
        max-camera-orbit="auto auto auto"
        camera-target="auto auto auto"
        field-of-view="30deg"
        shadow-intensity="0.5"
        exposure="1.05"
        environment-image="neutral"
        loading="eager"
        reveal="auto"
        style={{
          position: "absolute", inset: 0,        // ← フローから外し、枠の高さは aspect-ratio で決める
          width: "100%", height: "100%", backgroundColor: "transparent",
          "--poster-color": "transparent", pointerEvents: "none",
          opacity: ready ? 1 : 0, transition: "opacity 0.55s ease",
        }}
      />
    </Box>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function GalleryCard({ item, onOpen, mvReady, onResult }) {
  const meta = getTypeMeta(item.type);
  const live3D = is3DModel(item) && mvReady;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      style={{ breakInside: "avoid", marginBottom: 12 }}
    >
      <Box
        onClick={() => onOpen(item)}
        sx={{
          position: "relative", borderRadius: 2.5, overflow: "hidden", cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.07)", bgcolor: "#080808",
          transition: "all 0.3s ease",
          "&:hover": { borderColor: `${meta.color}88`, boxShadow: `0 0 32px ${meta.color}22` },
          "&:hover .overlay": { opacity: 1 },
        }}
      >
        {/* 3Dモデル → ライブで回転表示（拡大） / 画像 → サムネイル / それ以外 → プレースホルダー */}
        {live3D ? (
          <Live3DPreview glbUrl={item.glbUrl} poster={item.thumbnailUrl} color={meta.color} onResult={onResult} />
        ) : item.thumbnailUrl ? (
          <Box component="img" src={item.thumbnailUrl} alt={item.title} loading="lazy"
            sx={{ width: "100%", display: "block",
              ...(is3DModel(item) ? { aspectRatio: "1 / 1", objectFit: "contain" } : {}) }} />
        ) : (
          <Box sx={{ width: "100%", aspectRatio: "1 / 1",
            background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TypeIcon type={item.type} size={48} />
          </Box>
        )}

        {/* Type chip — 常時表示 */}
        <Box sx={{
          position: "absolute", top: 8, left: 8,
          px: 1, py: 0.3, borderRadius: "100px",
          bgcolor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          border: `1px solid ${meta.color}55`,
        }}>
          <Typography sx={{ color: meta.color, fontSize: "0.62rem", fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {meta.label}
          </Typography>
        </Box>

        {/* Hover overlay */}
        <Box className="overlay" sx={{
          position: "absolute", inset: 0, opacity: 0, transition: "opacity 0.3s ease",
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", p: 1.6,
        }}>
          <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "0.88rem", lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.6 }}>
            <Stack direction="row" alignItems="center" spacing={0.7}>
              <Avatar src={item.ownerPhotoUrl} sx={{ width: 16, height: 16, fontSize: "0.58rem" }}>
                {item.author?.[0]?.toUpperCase()}
              </Avatar>
              <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.7rem" }}>
                {item.author}
              </Typography>
            </Stack>
            {item.favoriteCount > 0 && (
              <Stack direction="row" alignItems="center" spacing={0.4}>
                <FavoriteIcon sx={{ fontSize: 11, color: "#F472B6" }} />
                <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.68rem" }}>
                  {item.favoriteCount}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Detail / auth-gate modal ──────────────────────────────────────────────────
function DetailDialog({ item, open, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mvReady = useModelViewerReady();
  if (!item) return null;

  const meta = getTypeMeta(item.type);

  const promptAuth = () => {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    navigate(`/signup?return_to=${returnTo}`);
  };

  const handleDownload = () => {
    if (!user) return promptAuth();
    const url = item.downloadUrl || item.glbUrl;
    if (url) window.open(url, "_blank");
  };

  const downloadLabel = {
    image:              "画像をダウンロード",
    render:             "レンダリングを保存",
    diagram:            "図面をダウンロード",
    "diagram-state":    "図面データをダウンロード",
    presentation:       "プレゼンを開く",
    "furniture-template": "テンプレートを使う",
    "layout-plan":      "レイアウトを開く",
    "layout-render":    "パース画像を保存",
  }[item.type] ?? "ダウンロード";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: {
        bgcolor: "#0d0d0d", borderRadius: 3, overflow: "hidden",
        border: `1px solid ${meta.color}33`,
      }}}>
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: { xs: "column", md: "row" } }}>
        {/* Preview */}
        <Box sx={{ flex: 1.3, bgcolor: "#000", position: "relative", minHeight: 360,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          {is3DModel(item) && mvReady ? (
            <model-viewer
              src={item.glbUrl}
              poster={item.thumbnailUrl || undefined}
              auto-rotate=""
              auto-rotate-delay="0"
              rotation-per-second="22deg"
              camera-controls=""
              interaction-prompt="none"
              shadow-intensity="0.7"
              exposure="1.05"
              environment-image="neutral"
              camera-orbit="0deg 80deg auto"
              camera-target="auto auto auto"
              style={{ width: "100%", height: "100%", minHeight: 360, backgroundColor: "#000",
                "--poster-color": "transparent" }}
            />
          ) : item.thumbnailUrl ? (
            <Box component="img" src={item.thumbnailUrl} alt={item.title}
              sx={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block" }} />
          ) : (
            <TypeIcon type={item.type} size={80} />
          )}
          <IconButton onClick={onClose} sx={{ position: "absolute", top: 10, right: 10,
            bgcolor: "rgba(0,0,0,0.5)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.75)" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, p: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Type chip */}
          <Chip label={meta.label} size="small" sx={{
            alignSelf: "flex-start",
            bgcolor: `${meta.color}18`,
            color: meta.color,
            border: `1px solid ${meta.color}44`,
            fontWeight: 700, fontSize: "0.7rem",
          }} />

          <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: "1.4rem",
            lineHeight: 1.3, letterSpacing: "-0.02em" }}>
            {item.title}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Avatar src={item.ownerPhotoUrl} sx={{ width: 26, height: 26, fontSize: "0.78rem" }}>
              {item.author?.[0]?.toUpperCase()}
            </Avatar>
            <Typography sx={{ color: BRAND.sub, fontSize: "0.88rem" }}>{item.author}</Typography>
          </Stack>

          {item.tags.length > 0 && (
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {item.tags.slice(0, 6).map((t, i) => (
                <Chip key={i} label={String(t?.label || t?.name || t)} size="small"
                  sx={{ bgcolor: PURPLE_SOFT, color: "#A78BFA",
                    border: "1px solid rgba(124,58,237,0.3)", fontSize: "0.68rem" }} />
              ))}
            </Stack>
          )}

          <Box sx={{ flex: 1 }} />

          {!user && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: PURPLE_SOFT,
              border: "1px solid rgba(124,58,237,0.3)",
              display: "flex", alignItems: "flex-start", gap: 1.2 }}>
              <LockIcon sx={{ color: "#A78BFA", fontSize: 20, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ color: "#A78BFA", fontSize: "0.82rem", lineHeight: 1.6 }}>
                ダウンロード・詳細情報の閲覧には<br />無料アカウント登録が必要です。
              </Typography>
            </Box>
          )}

          <Button onClick={handleDownload} fullWidth size="large"
            startIcon={user ? <DownloadIcon /> : <LockIcon />}
            sx={{ background: GRAD_PRIMARY, color: "#fff", fontWeight: 800,
              borderRadius: "100px", textTransform: "none", py: 1.4, mt: 1,
              "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)" } }}>
            {user ? downloadLabel : "登録してダウンロード"}
          </Button>
          {!user && (
            <Button onClick={() => navigate("/login")} fullWidth
              sx={{ color: BRAND.sub, textTransform: "none", fontSize: "0.82rem" }}>
              既にアカウントをお持ちの方はログイン
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Type filter chips ─────────────────────────────────────────────────────────
function TypeFilterBar({ types, activeType, onChange }) {
  if (types.length <= 1) return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
      <Chip
        label="すべて"
        onClick={() => onChange(null)}
        sx={{
          bgcolor: !activeType ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
          color: !activeType ? "#A78BFA" : BRAND.sub,
          border: !activeType ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
          fontWeight: 700, cursor: "pointer",
          "&:hover": { bgcolor: "rgba(124,58,237,0.15)" },
        }}
      />
      {types.map((type) => {
        const meta = getTypeMeta(type);
        const active = activeType === type;
        return (
          <Chip key={type}
            label={meta.label}
            onClick={() => onChange(active ? null : type)}
            sx={{
              bgcolor: active ? `${meta.color}22` : "rgba(255,255,255,0.06)",
              color: active ? meta.color : BRAND.sub,
              border: active ? `1px solid ${meta.color}66` : "1px solid rgba(255,255,255,0.1)",
              fontWeight: 700, cursor: "pointer",
              "&:hover": { bgcolor: `${meta.color}15` },
            }}
          />
        );
      })}
    </Stack>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────
export default function PublicModelGallery({ limit = 60, keyword = "", columns, hideFilter = false, maxLive3D = 8 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeType, setActiveType] = useState(null);
  // 描画に失敗した 3D モデル（WebGL 喪失・ロード失敗等）を除外するための集合
  const [failed3d, setFailed3d] = useState(() => new Set());
  const mvReady = useModelViewerReady();
  // Firebase Auth の復元を待つため user を取得
  const { user } = useAuth();

  const markFailed = useCallback((id) => {
    setFailed3d((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublicGalleryItems(limit).then((data) => {
      if (active) { setItems(data); setLoading(false); }
    });
    return () => { active = false; };
    // user を依存に含めることで Firebase Auth 復元後に再取得し、
    // 認証必須の子アプリデータ（3DSL/3DSD/3DSP）を確実に取得する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, user]);

  // 実際に存在するタイプの一覧（フィルター用）
  const availableTypes = [...new Set(items.map((i) => i.type))].filter(Boolean);

  const filtered = items.filter((item) => {
    if (activeType && item.type !== activeType) return false;
    if (!keyword) return true;
    const k = keyword.toLowerCase();
    const meta = getTypeMeta(item.type);
    return (
      item.title.toLowerCase().includes(k) ||
      item.author.toLowerCase().includes(k) ||
      meta.label.toLowerCase().includes(k) ||
      item.tags.some((t) => String(t?.label || t?.name || t).toLowerCase().includes(k))
    );
  });

  const handleOpen = useCallback((item) => setSelected(item), []);

  // ライブ 3D は WebGL コンテキスト上限を避けるため同時表示数を制限し、
  // 失敗したものは除外して次の候補を繰り上げる（= うまくいく家具だけ表示）。
  const live3DIds = (() => {
    const ids = new Set();
    let n = 0;
    for (const it of filtered) {
      if (!is3DModel(it)) continue;
      if (failed3d.has(it.id)) continue;
      if (n >= maxLive3D) break;
      ids.add(it.id);
      n += 1;
    }
    return ids;
  })();

  // 表示対象: 3Dモデルは「ライブ表示できるもの」だけ、それ以外（画像等）は通常表示
  const visibleItems = filtered.filter((it) =>
    is3DModel(it) ? live3DIds.has(it.id) : true
  );

  const columnSx = {
    columnGap: "12px",
    columnCount: columns ?? { xs: 2, sm: 3, md: 4, lg: 5 },
  };

  if (loading) {
    return (
      <>
        {!hideFilter && <Box sx={{ height: 40 }} />}
        <Box sx={columnSx}>
          {Array.from({ length: columns ? columns * 3 : 10 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" animation="wave"
              sx={{ bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2.5, mb: 1.5,
                height: 140 + (i % 3) * 60, breakInside: "avoid" }} />
          ))}
        </Box>
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <ViewInArIcon sx={{ fontSize: 56, color: "rgba(255,255,255,0.12)", mb: 2 }} />
        <Typography sx={{ color: BRAND.sub }}>
          {keyword || activeType
            ? "該当する成果物が見つかりませんでした。"
            : "公開されている成果物はまだありません。"}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {!hideFilter && (
        <TypeFilterBar
          types={availableTypes}
          activeType={activeType}
          onChange={setActiveType}
        />
      )}
      <Box sx={columnSx}>
        {visibleItems.map((item) => (
          <GalleryCard
            key={item.id}
            item={item}
            onOpen={handleOpen}
            mvReady={mvReady}
            onResult={is3DModel(item) ? (status) => { if (status === "failed") markFailed(item.id); } : undefined}
          />
        ))}
      </Box>
      <DetailDialog item={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}
