// src/features/layout/components/MainArea/SelectBaseModal.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  CircularProgress,
  Chip,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { collectionGroup, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

/**
 * ✅ 案A（Categories.jsx）に合わせた互換マップ
 * UI表示: 建物（本体）/ 建具・部材 / 外構・周辺
 * DB既存: 全体 / パーツ / 外構
 */
const ARCH_SUBTYPE_UI_TO_DB = {
  "建物（本体）": "全体",
  "建具・部材": "パーツ",
  "外構・周辺": "外構",
};

// ✅ デフォルト配列は「定数」にして参照を安定化（チカチカ対策）
const DEFAULT_FALLBACK_SUBTYPES = Object.freeze(["全体"]);

function normalizeText(v) {
  return String(v || "").toLowerCase().trim();
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return ts;
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

// ✅ このモデルが「GLBで表示可能か」をなるべく現状データに合わせて判定
function hasRenderableGlb(m) {
  const url =
    m?.files?.glb?.url ||
    m?.files?.glb?.downloadUrl ||
    m?.asset?.glbUrl ||
    m?.glbUrl ||
    m?.viewerGlbUrl;

  const path =
    m?.files?.glb?.path ||
    m?.files?.glb?.storagePath ||
    m?.files?.glb?.glbStoragePath ||
    m?.glbStoragePath;

  const processingDone = m?.processing?.glb === "done" || m?.["processing.glb"] === "done";

  // hasGlb が追従してないケースがあるので、url/path/processing を優先
  return !!(url || path || processingDone);
}

export default function SelectBaseModal({
  open,
  onClose,
  onConfirm, // (selectedModel) => void

  // ✅ 以前の props 名は残しつつ、中身の意味を変える（破壊しない）
  //   - ViewportPanel からは categoryValue="建築" が来てる想定
  //   - DB は type にそのまま入っている前提で使う
  categoryValue = "建築",

  // 以前: subTypeField/subTypeValue で category/subType を想定していた
  // ここでは Firestore の subType（全体/パーツ/外構）に合わせる
  subTypeField = "subType",

  // ✅ 案A: 既定は「建物（本体）」を選ぶ（= DBは "全体"）
  subTypeValue = "建物（本体）",

  pageSize = 48,

  // ✅ 追加（呼ばれなくてもデフォルトで動く）
  visibilityValue = "public",
  requireGlb = true,

  /**
   * ✅ fallbackSubTypes は「DB値（旧ラベル）」で持つのが安全
   * 例: ["全体"] / ["パーツ"] / ["外構"]
   */
  fallbackSubTypes = DEFAULT_FALLBACK_SUBTYPES,
}) {
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [selected, setSelected] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ✅ open=true の間に load 連打しないためのガード
  const openSessionRef = useRef(0);

  /**
   * ✅ UIで "建物（本体）" 等が来ても、DB は旧ラベルなので変換してクエリする
   */
  const effectiveSubTypes = useMemo(() => {
    const v = String(subTypeValue || "").trim();

    // 1) すでに DB 値（旧ラベル）が来ている場合
    if (v === "全体" || v === "パーツ" || v === "外構") return [v];

    // 2) UI 値（新ラベル）→ DB 値（旧ラベル）
    if (ARCH_SUBTYPE_UI_TO_DB[v]) return [ARCH_SUBTYPE_UI_TO_DB[v]];

    // 3) 互換（昔の "躯体" は "全体" 扱い）
    if (v === "躯体") {
      return Array.isArray(fallbackSubTypes) && fallbackSubTypes.length ? fallbackSubTypes : ["全体"];
    }

    // 4) その他は fallback
    return Array.isArray(fallbackSubTypes) && fallbackSubTypes.length ? fallbackSubTypes : ["全体"];
  }, [subTypeValue, fallbackSubTypes]);

  const filtered = useMemo(() => {
    const q = normalizeText(queryText);
    let list = Array.isArray(models) ? models : [];

    // ✅ 「GLBがあるものだけ」フィルタ（MVPの事故防止）
    if (requireGlb) {
      list = list.filter(hasRenderableGlb);
    }

    if (!q) return list;

    return list.filter((m) => {
      const title = normalizeText(m.name || m.title);
      const maker = normalizeText(m.maker || m.brand || m.ownerHandle || m.handle || "");
      const tags = Array.isArray(m.tags) ? m.tags.join(" ") : "";
      const mainCategory = normalizeText(m.mainCategory || "");
      const subType = normalizeText(m?.[subTypeField] || m?.subType || "");
      return (
        title.includes(q) ||
        maker.includes(q) ||
        normalizeText(tags).includes(q) ||
        mainCategory.includes(q) ||
        subType.includes(q)
      );
    });
  }, [models, queryText, requireGlb, subTypeField]);

  /**
   * ✅ load は「実際にクエリで必要な最小 deps」だけにする
   * - effectiveSubTypes を deps に入れると、参照変化 → load 変化 → useEffect 変化 でチカチカの原因になる
   * - 必要な値は呼び出し時に引数で渡す
   */
  const load = useCallback(
    async ({ typeValue, visValue, subTypes, sessionId }) => {
      setLoading(true);
      setSelected(null);
      setLoadError(null);

      try {
        const col = collectionGroup(db, "models");

        const q1 = query(
          col,
          where("isCanonical", "==", true),
          where("type", "==", typeValue),
          where("visibility", "==", visValue),
          where(subTypeField, "in", subTypes),
          limit(pageSize)
        );

        let snap;
        try {
          snap = await getDocs(q1);
        } catch (e) {
          // ✅ index不足などで落ちたら段階フォールバック
          console.warn("[SelectBaseModal] primary query failed. fallback:", e);

          // 2) subType を外して type + visibility のみ
          try {
            const q2 = query(
              col,
              where("isCanonical", "==", true),
              where("type", "==", typeValue),
              where("visibility", "==", visValue),
              limit(pageSize)
            );
            snap = await getDocs(q2);
          } catch (e2) {
            console.warn("[SelectBaseModal] fallback#2 failed. fallback to type only:", e2);

            // 3) 最後は type のみ
            const q3 = query(col, where("isCanonical", "==", true), where("type", "==", typeValue), limit(pageSize));
            snap = await getDocs(q3);
          }
        }

        // ✅ open の「古いセッション」の結果は反映しない（連打/再open時の事故防止）
        if (openSessionRef.current !== sessionId) return;

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // ✅ updatedAt/createdAt があれば新しい順
        rows.sort((a, b) => {
          const au = toMillis(a.updatedAt || a.createdAt);
          const bu = toMillis(b.updatedAt || b.createdAt);
          return bu - au;
        });

        setModels(rows);
      } catch (e) {
        console.error("[SelectBaseModal] load failed:", e);
        if (openSessionRef.current !== sessionId) return;
        setModels([]);
        setLoadError(e);
      } finally {
        if (openSessionRef.current !== sessionId) return;
        setLoading(false);
      }
    },
    [pageSize, subTypeField]
  );

  // ✅ open になった「瞬間だけ」1回ロード（チカチカ対策の本丸）
  useEffect(() => {
    if (!open) return;

    // open セッション更新
    openSessionRef.current += 1;
    const sessionId = openSessionRef.current;

    setQueryText("");
    setSelected(null);

    const typeValue = String(categoryValue || "建築").trim();
    const visValue = String(visibilityValue || "public").trim() || "public";
    const subTypes = Array.isArray(effectiveSubTypes) && effectiveSubTypes.length ? effectiveSubTypes : ["全体"];

    load({ typeValue, visValue, subTypes, sessionId });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = useCallback(() => {
    setSelected(null);
    onClose?.();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    onConfirm?.(selected);
  }, [selected, onConfirm]);

  const cardBorder = alpha(theme.palette.common.white, 0.12);

  // 表示用のサブタイプ（UIラベル側を優先して見せる）
  const uiSubTypeLabel = useMemo(() => {
    const v = String(subTypeValue || "").trim();
    if (!v) return "建物（本体）";
    if (v === "全体") return "建物（本体）";
    if (v === "パーツ") return "建具・部材";
    if (v === "外構") return "外構・周辺";
    if (v === "躯体") return "建物（本体）";
    return v;
  }, [subTypeValue]);

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason === "backdropClick") return;
        if (reason === "escapeKeyDown") return;
        handleClose();
      }}
      fullWidth
      maxWidth="lg"
      keepMounted
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(20,24,32,0.92), rgba(12,14,20,0.92))",
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        },
      }}
    >
      <DialogTitle sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {uiSubTypeLabel} を選択（3DSS）
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }} noWrap>
              models.type = {String(categoryValue || "建築")}（visibility={visibilityValue}） / {subTypeField} ∈{" "}
              {effectiveSubTypes.join(", ")}
            </Typography>
          </Box>

          <IconButton onClick={handleClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <TextField
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search base models..."
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={`items: ${filtered.length}`}
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
                }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  if (!open) return;
                  openSessionRef.current += 1;
                  const sessionId = openSessionRef.current;

                  const typeValue = String(categoryValue || "建築").trim();
                  const visValue = String(visibilityValue || "public").trim() || "public";
                  const subTypes =
                    Array.isArray(effectiveSubTypes) && effectiveSubTypes.length ? effectiveSubTypes : ["全体"];

                  load({ typeValue, visValue, subTypes, sessionId });
                }}
                sx={{
                  textTransform: "none",
                  borderColor: alpha(theme.palette.common.white, 0.18),
                }}
              >
                再読み込み
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.10) }} />

          {loading ? (
            <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
              <Stack spacing={1} alignItems="center">
                <CircularProgress size={26} />
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Loading...
                </Typography>
              </Stack>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 900, opacity: 0.9 }}>該当するモデルが見つかりません</Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                フィルタ条件（type / visibility / subType）や検索ワードを見直してください
              </Typography>

              {requireGlb && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.6 }}>
                  ※ GLBが検出できないモデルは非表示になります（files.glb.url 等）
                </Typography>
              )}

              {loadError && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.55 }}>
                  ※ 取得時にエラーが発生しました（コンソールをご確認ください）
                </Typography>
              )}
            </Box>
          ) : (
            <Grid container spacing={1.25}>
              {filtered.map((m) => {
                const isSelected = selected?.id === m.id;
                const thumb =
                  m.thumbUrl ||
                  m.thumbnailUrl ||
                  m.thumbnailFilePath?.url ||
                  m.coverUrl ||
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect width='100%25' height='100%25' fill='%2313161f'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%238a93a6' font-size='24'%3ENo Thumbnail%3C/text%3E%3C/svg%3E";

                const title = m.name || m.title || "Untitled";
                const maker = m.maker || m.brand || m.ownerHandle || m.handle || "—";

                const typeLabel = m.type || String(categoryValue || "建築");
                const dbSubTypeLabel = m?.[subTypeField] || m?.subType || "—";

                // DB値をUI表記に寄せて見やすく
                const subTypeLabel =
                  dbSubTypeLabel === "全体"
                    ? "建物（本体）"
                    : dbSubTypeLabel === "パーツ"
                    ? "建具・部材"
                    : dbSubTypeLabel === "外構"
                    ? "外構・周辺"
                    : dbSubTypeLabel;

                const glbOk = hasRenderableGlb(m);

                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={m.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: "100%",
                        borderRadius: 2.5,
                        borderColor: isSelected ? alpha(theme.palette.primary.main, 0.65) : cardBorder,
                        backgroundColor: alpha(theme.palette.common.white, 0.03),
                        boxShadow: isSelected ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.25)}` : "none",
                      }}
                    >
                      <CardActionArea onClick={() => setSelected(m)} sx={{ height: "100%" }}>
                        <CardMedia
                          component="img"
                          image={thumb}
                          alt={title}
                          sx={{
                            aspectRatio: "16 / 9",
                            objectFit: "cover",
                            opacity: 0.95,
                          }}
                        />

                        <CardContent sx={{ p: 1.2 }}>
                          <Stack spacing={0.75}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 900,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                }}
                                title={title}
                              >
                                {title}
                              </Typography>

                              {isSelected && (
                                <Chip
                                  size="small"
                                  icon={<CheckRoundedIcon />}
                                  label="Selected"
                                  sx={{
                                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                                  }}
                                />
                              )}
                            </Stack>

                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {maker}
                            </Typography>

                            <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap" }}>
                              <Chip
                                size="small"
                                label={typeLabel}
                                sx={{
                                  bgcolor: alpha(theme.palette.common.white, 0.06),
                                  border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
                                }}
                              />
                              <Chip
                                size="small"
                                label={subTypeLabel}
                                sx={{
                                  bgcolor: alpha(theme.palette.common.white, 0.06),
                                  border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
                                }}
                              />
                              <Chip
                                size="small"
                                label={glbOk ? "GLB: OK" : "GLB: ?"}
                                sx={{
                                  bgcolor: alpha(theme.palette.common.white, 0.06),
                                  border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
                                }}
                              />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: "none" }}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selected}
          sx={{ textTransform: "none", fontWeight: 900, borderRadius: 2 }}
        >
          このモデルを使う
        </Button>
      </DialogActions>
    </Dialog>
  );
}
