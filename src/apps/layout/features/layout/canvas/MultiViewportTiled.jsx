// src/features/layout/components/MainArea/components/MultiViewportTiled.jsx
import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";

// shortcuts
import { useCommandShortcuts } from "@layout/features/layout/hooks/useCommandShortcuts.js";

// utils
import { VIEW_TYPES, LAYOUT_MODES, clampNumber } from "@layout/features/layout/utils/viewportUtils.js";

// viewports
import SingleViewportCanvas from "./viewports/SingleViewportCanvas.jsx";

// ✁Eselection store�E�EultiViewportTiled は “存在チェチE�� Eだけに使ぁE��E
import { useUiSelectionStore } from "@layout/features/layout/store/uiSelectionStore";

// ✁Eviewport ui store�E�Elign tick 統一�E�E
import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";

// ✅ 2D/3D エディターモード（2D中はビュー切替ショートカット無効）
import { useEditorModeStore, EDITOR_MODES } from "@layout/features/layout/store/useEditorModeStore";

/**
 * MultiViewportTiled�E�簡易版�E�E
 * - SINGLE: 1画面�E�Eerspective/Top/Front/Right の刁E���E�E
 * - SPLIT : 2画面�E�Eop + Perspective�E�E
 *
 * ✁EQuad / 最大匁E/ viewConfig は廁E���E�不�E合と褁E��さ�E温床になるためE��E
 * ✁EAlign(AT/AB/...) は viewportUiStore の tick 方式に統一
 */
const MultiViewportTiled = forwardRef(function MultiViewportTiled(
  {
    layoutMode = LAYOUT_MODES.SINGLE,
    activeViewportId = "vp_persp",
    onChangeActiveViewportId,

    // SINGLE時：どのビューを表示するか（未持E��なめEactiveViewportId を使ぁE��E
    singleViewId,

    isBaseReady,
    baseGlbUrlResolved,
    items = [],

    onCanvasDrop,
    onCanvasDragOver,

    lockToGround = true,
    axisConstraint = "none",
    snapEnabled = false,
    snapStep = 0.5,
    groundY = 0,

    gizmoMode = "translate",
    gizmoSpace = "local",

    onCommitTransform,
    onCommitTransforms,

    onChangeTransform,
    onChangeTransforms,

    onRequestNumericOpen,
    onRequestNumericClose,
    numericCloseTick = 0,

    focusTick = 0,
    frameAllTick = 0,

    speedMode = "walk",
    onChangeSpeedMode,
    speedMul = 1,
    onSpeedMulChange,

    materialPicking = false,
    onPickMaterial,

    // ✁E追加�E�Gizmo の hover axis 変化を親へ返す
    onGizmoHoverAxisChange = null,
    // ✁E追加�E�Copy リクエスチE
    onRequestCopy = null,

    onBeginHistoryBatch,
    onEndHistoryBatch,
    onCancelHistoryBatch,
  },
  ref
) {
  const safeSnapStep = useMemo(() => clampNumber(snapStep, 0.01, 1000), [snapStep]);

  // ============================================================
  // ✁ESelection�E�Eustand�E�E
  // - MultiViewportTiled は “Alignが実行可能か Eの判定だけに使ぁE
  // ============================================================
  const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
  const hasSelection = (selectedItemIds?.length ?? 0) > 0;

  // ============================================================
  // ✁Ebase url swap�E�ちらつき防止�E�E
  // ============================================================
  const [displayBaseUrl, setDisplayBaseUrl] = useState(baseGlbUrlResolved || "");
  const [pendingBaseUrl, setPendingBaseUrl] = useState("");

  useEffect(() => {
    const next = baseGlbUrlResolved || "";

    if (!next) {
      setPendingBaseUrl("");
      setDisplayBaseUrl("");
      return;
    }

    if (!displayBaseUrl) {
      setDisplayBaseUrl(next);
      setPendingBaseUrl("");
      return;
    }

    if (next === displayBaseUrl) {
      setPendingBaseUrl("");
      return;
    }

    setPendingBaseUrl(next);
  }, [baseGlbUrlResolved, displayBaseUrl]);

  const onPendingLoaded = useCallback(() => {
    if (!pendingBaseUrl) return;
    setDisplayBaseUrl(pendingBaseUrl);
    setPendingBaseUrl("");
  }, [pendingBaseUrl]);

  // ============================================================
  // ✁Elayout normalize�E�EUADが来てめEsplit 扱ぁE��落とす！E
  // ============================================================
  const normalizedLayoutMode = useMemo(() => {
    if (layoutMode === LAYOUT_MODES.SPLIT) return LAYOUT_MODES.SPLIT;
    if (layoutMode === LAYOUT_MODES.QUAD) return LAYOUT_MODES.SPLIT; // 念のため吸叁E
    return LAYOUT_MODES.SINGLE;
  }, [layoutMode]);

  // ============================================================
  // ✁Eviewport id -> view type
  // ============================================================
  const getTypeByViewportId = useCallback((id) => {
    if (id === "vp_top") return VIEW_TYPES.TOP;
    if (id === "vp_front") return VIEW_TYPES.FRONT;
    if (id === "vp_right") return VIEW_TYPES.RIGHT;
    return VIEW_TYPES.PERSPECTIVE; // default
  }, []);

  // ============================================================
  // ✁Etiles�E�EINGLE / SPLIT 専用�E�E
  // ============================================================
  const tiles = useMemo(() => {
    if (normalizedLayoutMode === LAYOUT_MODES.SPLIT) {
      return [
        { id: "vp_top", type: VIEW_TYPES.TOP },
        { id: "vp_persp", type: VIEW_TYPES.PERSPECTIVE },
      ];
    }

    // SINGLE: 表示するviewは singleViewId 優先。なければ activeViewportId を使ぁE
    const id = singleViewId || activeViewportId || "vp_persp";
    return [{ id, type: getTypeByViewportId(id) }];
  }, [normalizedLayoutMode, singleViewId, activeViewportId, getTypeByViewportId]);

  // ============================================================
  // ✁Eactive viewport
  // ============================================================
  const effectiveActiveViewportId = useMemo(() => {
    if (normalizedLayoutMode === LAYOUT_MODES.SPLIT) return activeViewportId || "vp_persp";
    return tiles?.[0]?.id || activeViewportId || "vp_persp";
  }, [normalizedLayoutMode, activeViewportId, tiles]);

  const activate = useCallback(
    (id) => {
      onChangeActiveViewportId?.(id);
    },
    [onChangeActiveViewportId]
  );

  // ============================================================
  // ✁ERMB中フラグ
  // ============================================================
  const navMapRef = useRef(new Map());
  const [, bump] = useState(0);

  const setNavActiveFor = useCallback((viewportId, active) => {
    navMapRef.current.set(viewportId, !!active);
    bump((x) => x + 1);
  }, []);

  const navActive = !!navMapRef.current.get(effectiveActiveViewportId);

  // ============================================================
  // ✁EAlign shortcut ↁEviewportUiStore (tick方弁E
  // ============================================================
  const requestAlignFromShortcut = useCallback(
    (cmdRaw) => {
      if (!hasSelection) return;
      useViewportUiStore.getState().requestAlign(cmdRaw, effectiveActiveViewportId);
    },
    [hasSelection, effectiveActiveViewportId]
  );

  useCommandShortcuts({
    enabled: !materialPicking, // ✁E任意：スポイト中などは誤爁E��にくく
    navActive,
    onCommand: (cmd) => requestAlignFromShortcut(cmd),
  });

  // ============================================================
  // ✁Eビュー刁E���E�EINGLEは 1-4 / SPLITは 1-2�E�E
  // ============================================================
  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    };

    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.repeat) return;

      // ✅ 2D 配置モード中は TOP 固定なのでビュー切替キーを無効化
      if (useEditorModeStore.getState().editorMode === EDITOR_MODES.LAYOUT_2D) return;

      const map = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
        Numpad1: 1,
        Numpad2: 2,
        Numpad3: 3,
        Numpad4: 4,
      };

      const n = map[e.code];
      if (!n) return;

      if (normalizedLayoutMode === LAYOUT_MODES.SPLIT) {
        if (n === 1) {
          e.preventDefault();
          onChangeActiveViewportId?.("vp_persp");
        }
        if (n === 2) {
          e.preventDefault();
          onChangeActiveViewportId?.("vp_top");
        }
        return;
      }

      const idByN = { 1: "vp_persp", 2: "vp_top", 3: "vp_front", 4: "vp_right" };
      const nextId = idByN[n];
      if (!nextId) return;

      e.preventDefault();
      onChangeActiveViewportId?.(nextId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [normalizedLayoutMode, onChangeActiveViewportId]);

  // ============================================================
  // ✁E親ref API
  // ============================================================
  useImperativeHandle(
    ref,
    () => ({
      requestAlign: (key) => useViewportUiStore.getState().requestAlign(key, effectiveActiveViewportId),

      requestCopy: () => {
        console.log("[MultiViewportTiled] requestCopy called");
        onRequestCopy?.({ offset: [0.2, 0, 0.2] });
      },

      requestMirror: ({ axis = "x" } = {}) => {
        console.warn("[MultiViewportTiled] requestMirror is not implemented yet.", axis);
      },

      requestGroup: () => console.warn("[MultiViewportTiled] requestGroup is not implemented."),
      requestUngroup: () => console.warn("[MultiViewportTiled] requestUngroup is not implemented."),
    }),
    [effectiveActiveViewportId, onRequestCopy]
  );

  // ============================================================
  // ✁Egrid�E�EINGLE / SPLIT�E�E
  // ============================================================
  const gridSx = useMemo(() => {
    if (tiles.length === 2) {
      return {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
        gap: 1,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        p: 1,
      };
    }
    return {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(0, 1fr)",
      gap: 1,
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      p: 1,
    };
  }, [tiles.length]);

  // ✅ 2D/3D モード（オーバーレイ表示用）
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const is2DMode = editorMode === EDITOR_MODES.LAYOUT_2D;

  const layoutLabel = is2DMode
    ? "2D 平面"
    : normalizedLayoutMode === LAYOUT_MODES.SPLIT
      ? "SPLIT"
      : "SINGLE";

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        borderRadius: 0,
        border: `1px solid ${alpha("#fff", 0.08)}`,
        background: alpha("#000", 0.12),
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 10,
          right: 12,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={layoutLabel}
            sx={{
              height: 22,
              fontWeight: 900,
              bgcolor: alpha("#000", 0.42),
              color: alpha("#fff", 0.9),
              border: `1px solid ${alpha("#fff", 0.12)}`,
              backdropFilter: "blur(8px)",
            }}
          />

          <Typography sx={{ fontSize: 11, opacity: 0.65, fontWeight: 800 }}>
            {is2DMode
              ? "家具をドラッグして配置 / 右ドラッグでパン"
              : normalizedLayoutMode === LAYOUT_MODES.SPLIT
                ? "Shortcuts: 1=Persp / 2=Top"
                : "Shortcuts: 1=Persp / 2=Top / 3=Front / 4=Right"}
          </Typography>
        </Stack>
      </Box>

      <Box sx={gridSx}>
        {tiles.map((t, idx) => {
          const id = t?.id || `vp_${idx}`;
          const type = t?.type || VIEW_TYPES.PERSPECTIVE;

          const active = id === effectiveActiveViewportId;

          // Gizmoは今まで通り Persp/Top でだけ表示
          const showGizmo = active && (type === VIEW_TYPES.PERSPECTIVE || type === VIEW_TYPES.TOP);
          const allowDrop = active && !materialPicking;

          return (
            <Box
              key={id}
              sx={{
                position: "relative",
                minHeight: 0,
                minWidth: 0,
              }}
            >
              <SingleViewportCanvas
                viewportId={id}
                type={type}
                active={active}
                onActivate={activate}
                onToggleMaximize={() => {}}
                isBaseReady={isBaseReady}
                displayBaseUrl={displayBaseUrl}
                pendingBaseUrl={pendingBaseUrl}
                onPendingLoaded={onPendingLoaded}
                items={items}
                onCanvasDrop={onCanvasDrop}
                onCanvasDragOver={onCanvasDragOver}
                allowDrop={allowDrop}
                lockToGround={lockToGround}
                axisConstraint={axisConstraint}
                snapEnabled={snapEnabled}
                snapStep={safeSnapStep}
                groundY={groundY}
                showGizmo={showGizmo}
                gizmoMode={gizmoMode}
                gizmoSpace={gizmoSpace}
                onCommitTransform={onCommitTransform}
                onCommitTransforms={onCommitTransforms}
                onChangeTransform={onChangeTransform}
                onChangeTransforms={onChangeTransforms}
                focusTick={focusTick}
                frameAllTick={frameAllTick}
                speedMode={speedMode}
                onChangeSpeedMode={onChangeSpeedMode}
                speedMul={speedMul}
                onSpeedMulChange={onSpeedMulChange}
                onNavActiveChange={(isNav) => setNavActiveFor(id, isNav)}
                registerViewportApi={() => {}}
                onRequestNumericOpen={onRequestNumericOpen}
                onRequestNumericClose={onRequestNumericClose}
                numericCloseTick={numericCloseTick}
                materialPicking={materialPicking}
                onPickMaterial={onPickMaterial}
                // ✁Eここが効く：TransformGizmoの hover(axis=null) が最終的に ViewportPanel に届く
                onGizmoHoverAxisChange={onGizmoHoverAxisChange}
                onRequestCopy={onRequestCopy}
                                onBeginHistoryBatch={onBeginHistoryBatch}
                onEndHistoryBatch={onEndHistoryBatch}
                onCancelHistoryBatch={onCancelHistoryBatch}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});

export default MultiViewportTiled;
