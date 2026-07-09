// src/features/layout/components/LayoutViewer/LayoutViewerShell.jsx
import React, { useMemo, useCallback, useState, useRef } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Divider,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import ViewAgendaRoundedIcon from "@mui/icons-material/ViewAgendaRounded";
import InsertLinkRoundedIcon from "@mui/icons-material/InsertLinkRounded";

import ViewerPlaylistPanel from "./LeftSidebar/ViewerPlaylistPanel.jsx";
import ViewerBasePlanOptionTree from "./LeftSidebar/ViewerBasePlanOptionTree.jsx";
import ViewerInspectorPanel from "./RightSidebar/ViewerInspectorPanel.jsx";
import ViewerCanvas from "./viewport/ViewerCanvas.jsx";

// ✅ share upsert + ✅ Planへ layoutLink 保存 + ✅ サムネ upload + ✅ 既存 shareId 読み
import {
  upsertLayoutShare,
  saveLayoutLinkToPlan,
  uploadLayoutThumb,
  fetchPlanLayoutShareId,
} from "@layout/features/layout/utils/layoutShareUtils";

/**
 * bases: [{ id, name, glbUrl, plans:[{id,name, options:[{id,name,layout}]}]}]
 */
export default function LayoutViewerShell({
  shareId = "",

  boardId,
  boardType,
  ownerUid,
  board,

  bases = [],
  plansByBase, // unused (kept for compatibility)

  viewerConfig,
  scene,

  baseGlbUrlResolved,
  optionDoc,
  optionDocLoading,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ✅ 別タブ window.open では state が渡せないため、query の from も見る
  const from = location.state?.from || searchParams.get("from") || "";

  // ✅ (Shared) が増殖しないように正規化
  const normalizeSharedTitle = (s) =>
    String(s || "").replace(/\s*\(Shared\)\s*/g, "").trim();

  const title = useMemo(() => {
    const raw = board?.name || board?.boardName || "";
    const base = normalizeSharedTitle(raw || `Board: ${boardId}`);
    return shareId ? `${base} (Shared)` : base;
  }, [board, boardId, shareId]);

  const border = alpha(theme.palette.common.white, 0.08);
  const headerBg = alpha(theme.palette.background.paper, 0.7);

  const handleHome = useCallback(() => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    navigate("/projects", { replace: true });
  }, [from, navigate]);

  // ✅ ViewerCanvas の ref（サムネ撮る用）
  const viewerCanvasRef = useRef(null);

  // =========================================================
  // 1) 「今見てる1案URL」の生成＆コピー
  // =========================================================
  const buildVariantUrl = useCallback(
    (sid, { baseId, planId, optionId } = {}) => {
      const b = baseId ?? scene?.selected?.baseId ?? "";
      const p = planId ?? scene?.selected?.planId ?? "";
      const o = optionId ?? scene?.selected?.optionId ?? "";

      if (!sid) return window.location.href;

      const url = new URL(window.location.origin);
      url.pathname = `/layout/share/${sid}`;
      if (b) url.searchParams.set("base", b);
      if (p) url.searchParams.set("plan", p);
      if (o) url.searchParams.set("option", o);
      return url.toString();
    },
    [scene?.selected?.baseId, scene?.selected?.planId, scene?.selected?.optionId]
  );

  const copyText = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("このリンクをコピーしてください", text);
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    const url = buildVariantUrl(shareId);
    await copyText(url);
  }, [buildVariantUrl, copyText, shareId]);

  // =========================================================
  // 2) 共有（Menu + Base/Plan 複数選択Dialog）
  // =========================================================
  const [shareAnchorEl, setShareAnchorEl] = useState(null);
  const shareMenuOpen = Boolean(shareAnchorEl);

  const [pickDialogOpen, setPickDialogOpen] = useState(false);
  const [pickMode, setPickMode] = useState(""); // "base" | "plan"
  const [pickedBaseIds, setPickedBaseIds] = useState([]);
  const [pickedPlanKeys, setPickedPlanKeys] = useState([]); // `${baseId}__${planId}`

  const selectedBaseId = scene?.selected?.baseId || "";
  const selectedPlanId = scene?.selected?.planId || "";
  const selectedOptionId = scene?.selected?.optionId || "";

  const canCreateShare = useMemo(() => {
    return !!ownerUid && !!boardId && Array.isArray(bases);
  }, [ownerUid, boardId, bases]);

  const openShareMenu = useCallback((e) => setShareAnchorEl(e.currentTarget), []);
  const closeShareMenu = useCallback(() => setShareAnchorEl(null), []);

  const closePickDialog = useCallback(() => {
    setPickDialogOpen(false);
    setPickMode("");
  }, []);

  // ---- bases から name / glbUrl / plan/option を lookup
  const findBase = useCallback(
    (baseId) => (bases || []).find((b) => String(b.id) === String(baseId)) || null,
    [bases]
  );

  const findPlan = useCallback(
    (baseId, planId) => {
      const b = findBase(baseId);
      if (!b) return null;
      return (b.plans || []).find((p) => String(p.id) === String(planId)) || null;
    },
    [findBase]
  );

  const findOption = useCallback(
    (baseId, planId, optionId) => {
      const p = findPlan(baseId, planId);
      if (!p) return null;
      return (p.options || []).find((o) => String(o.id) === String(optionId)) || null;
    },
    [findPlan]
  );

  // ✅ basesツリーに layoutLink が入ってる時だけ拾う（入ってないことが多い）
  const findExistingShareIdForPlanFromTree = useCallback(
    (baseId, planId) => {
      const p = findPlan(baseId, planId);
      const sid = p?.layoutLink?.shareId || p?.data?.layoutLink?.shareId || null;
      return sid || null;
    },
    [findPlan]
  );

  // ✅ 最終的に「既存shareId」を確実に取る（Tree → Firestore）
  const resolveExistingShareIdForPlan = useCallback(
    async (baseId, planId) => {
      // 1) Tree
      const fromTree = findExistingShareIdForPlanFromTree(baseId, planId);
      if (fromTree) return fromTree;

      // 2) Firestore（これが本命）
      const fromDb = await fetchPlanLayoutShareId({
        ownerUid,
        boardType: boardType || "my",
        boardId,
        baseId,
        planId,
      });
      return fromDb || null;
    },
    [
      findExistingShareIdForPlanFromTree,
      ownerUid,
      boardType,
      boardId,
    ]
  );

  // ---- catalog を scope / selection に応じて作る（bases をフィルタするだけ）
  const buildCatalogProject = useCallback(() => {
    return { bases: bases || [] };
  }, [bases]);

  const buildCatalogBaseMulti = useCallback(
    (baseIds) => {
      const set = new Set((baseIds || []).map(String));
      return { bases: (bases || []).filter((b) => set.has(String(b.id))) };
    },
    [bases]
  );

  const buildCatalogPlanMulti = useCallback(
    (planKeys) => {
      const keep = new Set((planKeys || []).map(String));
      const filteredBases = [];
      for (const b of bases || []) {
        const plans = (b.plans || []).filter((p) => keep.has(`${b.id}__${p.id}`));
        if (plans.length) {
          filteredBases.push({ ...b, plans });
        }
      }
      return { bases: filteredBases };
    },
    [bases]
  );

  const buildCatalogOptionOnly = useCallback(() => {
    const b = findBase(selectedBaseId);
    const p = findPlan(selectedBaseId, selectedPlanId);
    const o = findOption(selectedBaseId, selectedPlanId, selectedOptionId);
    if (!b || !p || !o) return { bases: [] };

    return {
      bases: [
        {
          id: b.id,
          name: b.name,
          glbUrl: b.glbUrl,
          plans: [
            {
              id: p.id,
              name: p.name,
              options: [
                {
                  id: o.id,
                  name: o.name,
                  layout: o.layout || { items: [] },
                },
              ],
            },
          ],
        },
      ],
    };
  }, [findBase, findPlan, findOption, selectedBaseId, selectedPlanId, selectedOptionId]);

  /**
   * ✅ 共有作成（Upsert）→ thumb upload（上書き）→ Planへ保存（上書き）
   * ✅ 重要：保存先 planId を外から上書きできるようにする
   */
  const createShareAndOpen = useCallback(
    async ({ catalogScope, catalog, linkTarget }) => {
      if (!canCreateShare) {
        alert("共有を作成できません（ownerUid / boardId が不足しています）");
        return;
      }

      const baseIdForLink = linkTarget?.baseId || selectedBaseId;
      const planIdForLink = linkTarget?.planId || selectedPlanId;
      const optionIdForUrl = linkTarget?.optionId || selectedOptionId;

      if (!baseIdForLink || !planIdForLink) {
        alert("共有を作成するには Base / Plan を選択してください");
        return;
      }

      const base = findBase(baseIdForLink);
      const plan = findPlan(baseIdForLink, planIdForLink);
      const option = findOption(baseIdForLink, planIdForLink, optionIdForUrl);

      const snapshot = {
        boardName: board?.name || board?.boardName || "",
        baseName: base?.name || baseIdForLink,
        planName: plan?.name || planIdForLink,
        optionName: option?.name || optionIdForUrl,
        baseGlbUrl: base?.glbUrl || baseGlbUrlResolved || "",
      };

      // ✅ 同じPlanなら shareId を “固定” する（DBから確実に拾う）
      const existingShareId = await resolveExistingShareIdForPlan(baseIdForLink, planIdForLink);

      // ✅ Upsert（shareId固定 → viewerSharesも増殖しない）
      const shareIdUpserted = await upsertLayoutShare({
        shareId: existingShareId, // ✅ あるなら更新、無ければ新規
        ownerUid,
        source: {
          boardType: boardType || "my",
          boardId,
          baseId: baseIdForLink || null,
          planId: planIdForLink || null,
          optionId: optionIdForUrl || null,
        },
        snapshot,
        viewerConfig: viewerConfig || {},
        visibility: "public",

        // catalog を渡すので catalogScope は util 側に合わせて固定でOK
        catalogScope: "selectedBase",
        catalog,
        createdByUid: ownerUid || null,
      });

      const url = buildVariantUrl(shareIdUpserted, {
        baseId: baseIdForLink,
        planId: planIdForLink,
        optionId: optionIdForUrl,
      });

      const optionKey = option?.optionKey || option?.name || optionIdForUrl || "";

      // ✅ thumb（shareId固定なら Storageパスも固定 → 上書きされる）
      let thumbUrl = "";

      try {
        // ✅ 1-2フレ待って「描画後」を撮る（真っ白対策）
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dataUrl = await viewerCanvasRef.current?.captureThumbnail?.({
          width: 2400,
          height: 800,
          quality: 0.92,
          mimeType: "image/jpeg",
        });

        console.log("[thumb] dataUrl?", {
          hasRef: !!viewerCanvasRef.current,
          dataUrlType: typeof dataUrl,
          dataUrlLen: dataUrl?.length || 0,
          head: dataUrl ? String(dataUrl).slice(0, 40) : "",
        });

        if (!dataUrl) {
          console.warn("[thumb] dataUrl is empty. (captureThumbnail failed)");
        } else {
          thumbUrl = await uploadLayoutThumb({
            ownerUid,
            boardType: boardType || "my",
            boardId,
            baseId: baseIdForLink,
            planId: planIdForLink,
            shareId: shareIdUpserted, // ✅ fixed
            dataUrl,
          });

          console.log("[thumb] uploaded thumbUrl:", thumbUrl);
        }
      } catch (e) {
        console.warn("[thumbnail] failed:", e?.name, e?.message, e);
      }

      // ✅ Plan に保存（shareId固定で上書き更新）
      try {
        await saveLayoutLinkToPlan({
          ownerUid,
          boardType: boardType || "my",
          boardId,
          baseId: baseIdForLink,
          planId: planIdForLink,
          layoutLink: {
            shareId: shareIdUpserted,
            url,
            optionKey,
            thumbUrl,
          },
          updatedByUid: ownerUid,
        });
      } catch (e) {
        console.warn("[saveLayoutLinkToPlan] failed:", e?.message || e);
      }

      window.open(url, "_blank", "noopener,noreferrer");
      await copyText(url);
    },
    [
      canCreateShare,
      ownerUid,
      boardType,
      boardId,
      selectedBaseId,
      selectedPlanId,
      selectedOptionId,
      board,
      baseGlbUrlResolved,
      viewerConfig,
      findBase,
      findPlan,
      findOption,
      resolveExistingShareIdForPlan,
      buildVariantUrl,
      copyText,
    ]
  );

  // ---- menu actions
  const handleShareProject = useCallback(async () => {
    closeShareMenu();
    await createShareAndOpen({
      catalogScope: "project",
      catalog: buildCatalogProject(),
      linkTarget: null,
    });
  }, [closeShareMenu, createShareAndOpen, buildCatalogProject]);

  const handleShareOption = useCallback(async () => {
    closeShareMenu();
    if (!selectedBaseId || !selectedPlanId || !selectedOptionId) {
      alert("Option を共有するには、Base / Plan / Option を選択してください");
      return;
    }
    await createShareAndOpen({
      catalogScope: "option",
      catalog: buildCatalogOptionOnly(),
      linkTarget: null,
    });
  }, [
    closeShareMenu,
    createShareAndOpen,
    buildCatalogOptionOnly,
    selectedBaseId,
    selectedPlanId,
    selectedOptionId,
  ]);

  const handleShareBaseMulti = useCallback(() => {
    closeShareMenu();
    const initial = selectedBaseId ? [String(selectedBaseId)] : [];
    setPickedBaseIds(initial);
    setPickMode("base");
    setPickDialogOpen(true);
  }, [closeShareMenu, selectedBaseId]);

  const handleSharePlanMulti = useCallback(() => {
    closeShareMenu();
    const initial =
      selectedBaseId && selectedPlanId ? [`${selectedBaseId}__${selectedPlanId}`] : [];
    setPickedPlanKeys(initial);
    setPickMode("plan");
    setPickDialogOpen(true);
  }, [closeShareMenu, selectedBaseId, selectedPlanId]);

  const toggleBaseId = useCallback((baseId) => {
    setPickedBaseIds((prev) => {
      const s = new Set(prev);
      const key = String(baseId);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return Array.from(s);
    });
  }, []);

  const togglePlanKey = useCallback((planKey) => {
    setPickedPlanKeys((prev) => {
      const s = new Set(prev);
      const key = String(planKey);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return Array.from(s);
    });
  }, []);

  const confirmPick = useCallback(async () => {
    if (pickMode === "base") {
      const baseIds = pickedBaseIds || [];
      if (!baseIds.length) {
        alert("共有する Base を1つ以上選択してください");
        return;
      }
      closePickDialog();
      await createShareAndOpen({
        catalogScope: "base",
        catalog: buildCatalogBaseMulti(baseIds),
        linkTarget: null,
      });
      return;
    }

    if (pickMode === "plan") {
      const keys = pickedPlanKeys || [];
      if (!keys.length) {
        alert("共有する Plan を1つ以上選択してください");
        return;
      }

      // ✅ 選んだ Plan の先頭を “保存先” にする
      const first = String(keys[0]);
      const [baseIdForLink, planIdForLink] = first.split("__");

      // ✅ URLの option はそのplanに無い可能性があるのでフォールバック
      let optionIdForUrl = selectedOptionId;
      const p = findPlan(baseIdForLink, planIdForLink);
      const has = (p?.options || []).some((o) => String(o.id) === String(optionIdForUrl));
      if (!has) optionIdForUrl = (p?.options || [])[0]?.id || "";

      closePickDialog();
      await createShareAndOpen({
        catalogScope: "plan",
        catalog: buildCatalogPlanMulti(keys),
        linkTarget: {
          baseId: baseIdForLink,
          planId: planIdForLink,
          optionId: optionIdForUrl,
        },
      });
      return;
    }

    closePickDialog();
  }, [
    pickMode,
    pickedBaseIds,
    pickedPlanKeys,
    closePickDialog,
    createShareAndOpen,
    buildCatalogBaseMulti,
    buildCatalogPlanMulti,
    selectedOptionId,
    findPlan,
  ]);

  // Dialog 表示用データ
  const allBases = useMemo(() => bases || [], [bases]);
  const allPlans = useMemo(() => {
    const out = [];
    for (const b of bases || []) {
      for (const p of b.plans || []) {
        out.push({
          key: `${b.id}__${p.id}`,
          baseId: b.id,
          baseName: b.name || b.id,
          planId: p.id,
          planName: p.name || p.id,
        });
      }
    }
    return out;
  }, [bases]);

  return (
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: theme.palette.background.default,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          px: 2,
          py: 1.25,
          bgcolor: headerBg,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              S.Layout Viewer
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
              {title}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<ShareRoundedIcon />}
              onClick={openShareMenu}
              disabled={!canCreateShare}
              title={!canCreateShare ? "共有を作成できません（ownerUid / boardId が不足）" : "共有範囲を選択"}
            >
              共有
            </Button>

            <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={handleCopyLink}>
              リンクコピー
            </Button>

            <Button variant="outlined" onClick={handleHome}>
              ホーム
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mt: 1, opacity: 0.2 }} />

        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            boardType: {boardType}
          </Typography>
          {ownerUid ? (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              ownerUid: {ownerUid}
            </Typography>
          ) : null}
        </Stack>
      </Box>

      {/* Share Menu */}
      <Menu anchorEl={shareAnchorEl} open={shareMenuOpen} onClose={closeShareMenu}>
        <MenuItem onClick={handleShareProject}>
          <ListItemIcon>
            <AccountTreeRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Project（全部）" secondary="全 Base / 全 Plan / 全 Option を切り替え可能" />
        </MenuItem>

        <MenuItem onClick={handleShareBaseMulti}>
          <ListItemIcon>
            <LayersRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Base（複数選択）" secondary="選んだ Base 配下の Plan/Option を切替" />
        </MenuItem>

        <MenuItem onClick={handleSharePlanMulti}>
          <ListItemIcon>
            <ViewAgendaRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Plan（複数選択）" secondary="選んだ Plan 配下の Option を切替" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleShareOption}>
          <ListItemIcon>
            <InsertLinkRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Option（今の1つ）" secondary="表示中 Option を固定共有" />
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={async () => {
            closeShareMenu();
            await handleCopyLink();
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="（参考）今見ている案のリンクをコピー" />
        </MenuItem>
      </Menu>

      {/* Base/Plan Pick Dialog */}
      <Dialog open={pickDialogOpen} onClose={closePickDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {pickMode === "base" ? "共有する Base を選択（複数可）" : "共有する Plan を選択（複数可）"}
        </DialogTitle>
        <DialogContent dividers>
          {pickMode === "base" ? (
            <FormGroup>
              {allBases.map((b) => {
                const checked = pickedBaseIds.includes(String(b.id));
                return (
                  <FormControlLabel
                    key={b.id}
                    control={<Checkbox checked={checked} onChange={() => toggleBaseId(b.id)} />}
                    label={`${b.name || b.id}`}
                  />
                );
              })}
            </FormGroup>
          ) : null}

          {pickMode === "plan" ? (
            <FormGroup>
              {allPlans.map((p) => {
                const checked = pickedPlanKeys.includes(p.key);
                return (
                  <FormControlLabel
                    key={p.key}
                    control={<Checkbox checked={checked} onChange={() => togglePlanKey(p.key)} />}
                    label={`${p.baseName} / ${p.planName}`}
                  />
                );
              })}
            </FormGroup>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePickDialog} variant="outlined">
            キャンセル
          </Button>
          <Button onClick={confirmPick} variant="contained">
            この範囲で共有する
          </Button>
        </DialogActions>
      </Dialog>

      {/* Body */}
      <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr 360px" }}>
        {/* Left */}
        <Box sx={{ minHeight: 0, borderRight: `1px solid ${border}`, overflow: "auto" }}>
          <ViewerPlaylistPanel scene={scene} viewerConfig={viewerConfig} />
          <Divider sx={{ opacity: 0.2 }} />
          <ViewerBasePlanOptionTree bases={bases} selected={scene.selected} onSelect={scene.setSelection} />
        </Box>

        {/* Center */}
        <Box sx={{ minHeight: 0 }}>
          <ViewerCanvas
            ref={viewerCanvasRef}
            boardId={boardId}
            selected={scene.selected}
            onSelectObject={scene.setSelectedObject}
            baseGlbUrlResolved={baseGlbUrlResolved}
            layout={optionDoc?.layout || null}
            loading={optionDocLoading}
          />
        </Box>

        {/* Right */}
        <Box sx={{ minHeight: 0, borderLeft: `1px solid ${border}`, overflow: "auto" }}>
          <ViewerInspectorPanel selected={scene.selected} />
        </Box>
      </Box>
    </Box>
  );
}
