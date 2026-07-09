import React, { useState, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, TextField, Button, Tabs, Tab,
  ToggleButton, ToggleButtonGroup, CircularProgress, InputAdornment, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { saveItemAsNewModel } from "../../../../../services/saveItemAsNewModel";
import { RightPanelModelViewer } from "../../../../../../../dss/components/RightPanelModelViewer";
import WalkthroughMetadataEditor from "../../../../../../../dss/components/WalkthroughMetadataEditor";
import {
  readMaterialPresets, readMaterialVariants, resolveSelectedOption, swatchColorOf,
  variantSwatchColor, expandVariantSelection, resolveSelectedVariant, buildBindingsFromSelection,
} from "../../../../../../../shared/material/materialPresets";

const numOr = (v, fallback = "") => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const Swatch = ({ color = "#888", size = 26, selected }) => (
  <Box sx={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: `radial-gradient(circle at 33% 28%, rgb(var(--brand-fg-rgb) / 0.6), ${color} 60%, rgba(0,0,0,0.4))`,
    border: selected ? "2px solid #4fc3f7" : "1px solid rgb(var(--brand-fg-rgb) / 0.2)",
    boxShadow: selected ? "0 0 0 2px rgba(79,195,247,0.4)" : "none", cursor: "pointer",
  }} />
);

/**
 * 配置アイテムの「この配置だけ」の編集（per-instance オーバーライド）。
 *  - 寸法: 即時変更 ＋「新規Modelとして保存」
 *  - マテリアル: S.Model のプリセット/パターンから選ぶ（＋色指定で新規）→ item.materialBindings
 *  - 動き: ヒンジ/スライド/アニメ/常時アニメ → item.gimmicks / item.anim
 * S.Model（全体のデフォルト）は変更せず、ユーザーのプロジェクトの該当アイテムにのみ反映。
 */
export default function EditItemDialog({
  open,
  onClose,
  sourceAsset,
  glbUrl,
  initialDimensions,
  initialTitle,
  initialMaterialBindings,
  initialGimmicks,
  initialAnim,
  initialInfo,
  onApplyDimensions,
  onApplyMaterials,
  onApplyActions,
  onApplyInfo,
}) {
  const [tab, setTab] = useState(0);
  const [w, setW] = useState(() => numOr(initialDimensions?.width));
  const [d, setD] = useState(() => numOr(initialDimensions?.depth));
  const [h, setH] = useState(() => numOr(initialDimensions?.height));
  const [title, setTitle] = useState(() => `${initialTitle || "Model"} (編集)`);
  const [visibility, setVisibility] = useState("private");
  const [showDims, setShowDims] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const presets = useMemo(() => readMaterialPresets(sourceAsset), [sourceAsset]);
  const variants = useMemo(() => readMaterialVariants(sourceAsset), [sourceAsset]);

  // マテリアル選択 / 動き の作業状態
  const [matSelection, setMatSelection] = useState({});
  const [matVariantId, setMatVariantId] = useState(null);
  const [gimmicks, setGimmicks] = useState(() => (Array.isArray(initialGimmicks) ? initialGimmicks : []));
  const [anim, setAnim] = useState(() => initialAnim || null);

  React.useEffect(() => {
    if (!open) return;
    setTab(0);
    setW(numOr(initialDimensions?.width));
    setD(numOr(initialDimensions?.depth));
    setH(numOr(initialDimensions?.height));
    setTitle(`${initialTitle || "Model"} (編集)`);
    setVisibility("private");
    setError(""); setSaving(false);
    setGimmicks(Array.isArray(initialGimmicks) ? initialGimmicks : []);
    setAnim(initialAnim || null);
    // 初期マテリアル選択：既定パターンがあれば展開、無ければ部位ごとの既定
    const def = resolveSelectedVariant(variants);
    if (def) { setMatSelection(expandVariantSelection(presets, def)); setMatVariantId(def.id); }
    else { setMatSelection({}); setMatVariantId(null); }
  }, [open, initialDimensions, initialTitle, initialGimmicks, initialAnim, presets, variants]);

  const dims = useMemo(() => ({ width: Number(w) || 0, depth: Number(d) || 0, height: Number(h) || 0 }), [w, d, h]);
  const matBindings = useMemo(() => buildBindingsFromSelection(presets, matSelection), [presets, matSelection]);
  // プレビュー用バインディング：選択があればそれ、無ければ既存の上書きを使う
  const previewBindings = matBindings.length ? matBindings : (Array.isArray(initialMaterialBindings) ? initialMaterialBindings : null);

  const fieldSx = {
    "& .MuiInputBase-root": { height: 38, borderRadius: 1.4, background: "color-mix(in srgb, var(--brand-bg) 25%, transparent)", color: "var(--brand-fg)", fontSize: 13 },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.15) },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.3) },
  };

  const pickVariant = (v) => { setMatVariantId(v.id); setMatSelection(expandVariantSelection(presets, v)); };
  const pickOption = (slotKey, optId) => { setMatVariantId(null); setMatSelection((s) => ({ ...s, [slotKey]: optId })); };

  const applyMaterials = () => { onApplyMaterials?.(matBindings); onClose?.(); };
  const applyActions = () => { onApplyActions?.({ gimmicks, anim }); onClose?.(); };
  const applyDimensions = () => { onApplyDimensions?.(dims); onClose?.(); };

  const handleSaveNew = async () => {
    setSaving(true); setError("");
    try {
      await saveItemAsNewModel({ sourceAsset, glbUrl, title: title.trim() || "Untitled", dimensions: dims, visibility });
      onApplyDimensions?.(dims);
      onClose?.();
    } catch (e) {
      console.error("[EditItemDialog] save failed:", e);
      setError(e?.message || String(e));
    } finally { setSaving(false); }
  };

  const labelSx = { fontSize: 10, fontWeight: 700, opacity: 0.6, mb: 0.5 };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: "var(--brand-surface)", backgroundImage: "none", border: `1px solid ${alpha("#fff", 0.1)}`, color: "var(--brand-fg)" } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", gap: 1 }}>
        <StraightenRoundedIcon sx={{ fontSize: 18, color: "light-dark(#0875a6, #4fc3f7)" }} />
        アイテムを編集（この配置だけ）
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
          {/* 左：3Dプレビュー（寸法＋マテリアルに連動） */}
          <Box sx={{ flex: "1 1 320px", minWidth: 280 }}>
            <Box sx={{ position: "relative", width: "100%", aspectRatio: "1/1", bgcolor: "var(--brand-bg)", borderRadius: 2, overflow: "hidden", border: `1px solid ${alpha("#fff", 0.1)}` }}>
              {glbUrl ? (
                <RightPanelModelViewer modelUrl={glbUrl} targetDimensions={dims} showDimensions={showDims} materialBindings={previewBindings} />
              ) : (
                <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "color-mix(in srgb, var(--brand-fg) 40%, transparent)", gap: 1 }}>
                  <ImageRoundedIcon sx={{ fontSize: 20 }} /><Typography sx={{ fontSize: 12 }}>3Dプレビューを表示できません</Typography>
                </Box>
              )}
              {glbUrl && (
                <Button size="small" onClick={() => setShowDims((v) => !v)} startIcon={<StraightenRoundedIcon sx={{ fontSize: 14 }} />}
                  sx={{ position: "absolute", top: 8, right: 8, minWidth: 0, px: 1, height: 26, textTransform: "none", fontSize: 11, fontWeight: 700,
                    color: showDims ? "#06121c" : "var(--brand-fg)", bgcolor: showDims ? "rgb(var(--brand-fg-rgb) / 0.9)" : "rgba(0,0,0,0.55)",
                    "&:hover": { bgcolor: showDims ? "#fff" : "rgba(0,0,0,0.7)" } }}>寸法</Button>
              )}
            </Box>
          </Box>

          {/* 右：タブ */}
          <Box sx={{ flex: "1 1 320px", minWidth: 300 }}>
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="fullWidth"
              sx={{ minHeight: 36, mb: 1.5, "& .MuiTab-root": { minHeight: 36, fontSize: 12, fontWeight: 700, textTransform: "none", color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }, "& .Mui-selected": { color: "light-dark(#0875a6, #4fc3f7) !important" }, "& .MuiTabs-indicator": { bgcolor: "#4fc3f7" } }}>
              <Tab label="寸法" />
              <Tab label="マテリアル" />
              <Tab label="動き" />
            </Tabs>

            {/* === 寸法タブ === */}
            {tab === 0 && (
              <Stack spacing={2}>
                <Box>
                  <Typography sx={labelSx}>DIMENSIONS (mm)</Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" type="number" value={w} onChange={(e) => setW(e.target.value)} sx={fieldSx} fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 11, color: "light-dark(#0875a6, #4fc3f7)", fontWeight: 700 }}>W</Typography></InputAdornment> }} />
                    <TextField size="small" type="number" value={d} onChange={(e) => setD(e.target.value)} sx={fieldSx} fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.65)", fontWeight: 700 }}>D</Typography></InputAdornment> }} />
                    <TextField size="small" type="number" value={h} onChange={(e) => setH(e.target.value)} sx={fieldSx} fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 11, color: "light-dark(#aa8804, #facc15)", fontWeight: 700 }}>H</Typography></InputAdornment> }} />
                  </Stack>
                </Box>
                <Button variant="contained" startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />} onClick={applyDimensions}
                  sx={{ textTransform: "none", bgcolor: "#4fc3f7", color: "#06121c", fontWeight: 800, alignSelf: "flex-start", "&:hover": { bgcolor: "#6fd0fb" } }}>
                  この配置に寸法を適用
                </Button>
                <Box sx={{ borderTop: `1px solid ${alpha("#fff", 0.08)}`, pt: 1.5 }}>
                  <Typography sx={labelSx}>新規モデルとして S.Model に保存</Typography>
                  <TextField fullWidth size="small" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ ...fieldSx, mb: 1 }} />
                  <ToggleButtonGroup value={visibility} exclusive size="small" onChange={(_e, v) => { if (v) setVisibility(v); }}
                    sx={{ width: "100%", mb: 1, "& .MuiToggleButton-root": { flex: 1, py: 0.5, fontSize: 11, color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", borderColor: alpha("#fff", 0.15), textTransform: "none", "&.Mui-selected": { bgcolor: alpha("#4fc3f7", 0.18), color: "light-dark(#0875a6, #4fc3f7)", borderColor: alpha("#4fc3f7", 0.4) } } }}>
                    <ToggleButton value="private">非公開（自分のみ）</ToggleButton>
                    <ToggleButton value="public">全体公開</ToggleButton>
                  </ToggleButtonGroup>
                  <Button variant="outlined" size="small" disabled={saving} onClick={handleSaveNew}
                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: "none", color: "light-dark(#0875a6, #4fc3f7)", borderColor: alpha("#4fc3f7", 0.5), fontWeight: 800 }}>
                    {saving ? "保存中..." : "新規Modelとして保存"}
                  </Button>
                </Box>
              </Stack>
            )}

            {/* === マテリアルタブ === */}
            {tab === 1 && (
              <Stack spacing={1.5}>
                {presets.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}>
                    このモデルにはマテリアル候補が未設定です。S.Model の「マテリアル」でオプション/パターンを登録すると、ここで選べます。
                  </Typography>
                ) : (
                  <>
                    {variants.length > 0 && (
                      <Box>
                        <Typography sx={labelSx}>パターン（家具まるごと）</Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
                          {variants.map((v) => (
                            <Box key={v.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4, width: 56 }}>
                              <Tooltip title={v.title || ""}>
                                <Box onClick={() => pickVariant(v)}><Swatch color={variantSwatchColor(presets, v)} size={34} selected={matVariantId === v.id} /></Box>
                              </Tooltip>
                              <Typography sx={{ fontSize: 9.5, color: matVariantId === v.id ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 50%, transparent)", textAlign: "center" }} noWrap>{v.title || "—"}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {presets.map((ps) => {
                      const selId = resolveSelectedOption(ps, matSelection[ps.slotKey])?.id;
                      return (
                        <Box key={ps.slotKey}>
                          <Typography sx={labelSx}>{ps.label || "パーツ"}</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {ps.options.map((opt) => (
                              <Tooltip key={opt.id} title={opt.title || ""}>
                                <Box onClick={() => pickOption(ps.slotKey, opt.id)}><Swatch color={swatchColorOf(opt)} selected={selId === opt.id} /></Box>
                              </Tooltip>
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                    <Button variant="contained" startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />} onClick={applyMaterials}
                      sx={{ textTransform: "none", bgcolor: "#4fc3f7", color: "#06121c", fontWeight: 800, alignSelf: "flex-start", "&:hover": { bgcolor: "#6fd0fb" } }}>
                      この配置にマテリアルを適用
                    </Button>
                  </>
                )}
              </Stack>
            )}

            {/* === 動きタブ === */}
            {tab === 2 && (
              <Stack spacing={1.5}>
                <WalkthroughMetadataEditor
                  glbUrl={glbUrl || null}
                  macroCategory={sourceAsset?.macroCategory || sourceAsset?.category}
                  gimmicks={gimmicks}
                  anim={anim}
                  showInfo={false}
                  onChange={({ gimmicks: g, anim: a }) => { setGimmicks(g); setAnim(a); }}
                />
                <Button variant="contained" startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />} onClick={applyActions}
                  sx={{ textTransform: "none", bgcolor: "#4fc3f7", color: "#06121c", fontWeight: 800, alignSelf: "flex-start", "&:hover": { bgcolor: "#6fd0fb" } }}>
                  この配置に動きを適用
                </Button>
              </Stack>
            )}

            {error && <Typography sx={{ fontSize: 11, color: "#ef5350", mt: 1 }}>{error}</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)" }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
