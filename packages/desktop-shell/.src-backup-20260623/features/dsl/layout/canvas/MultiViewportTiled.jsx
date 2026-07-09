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
import { alpha, useTheme } from "@mui/material/styles";
import { useCommandShortcuts } from "@desktop/features/dsl/layout/hooks/useCommandShortcuts.js";
import { useViewportKeymapStore } from "@desktop/features/dsl/layout/store/viewportKeymapStore";
import { matchKeymap } from "@desktop/features/dsl/layout/config/viewportKeymapConfig";

// utils
import { VIEW_TYPES, LAYOUT_MODES, clampNumber } from "@desktop/features/dsl/layout/utils/viewportUtils.js";

// viewports
import SingleViewportCanvas from "./viewports/SingleViewportCanvas.jsx";

// ✁Eselection store�E�EultiViewportTiled は “存在チェチE�� Eだけに使ぁE��E
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";

// ✁Eviewport ui store�E�Elign tick 統一�E�E
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

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

    // ✁E追加EGizmo の hover axis 変化を親へ返す
    onGizmoHoverAxisChange = null,
    // ✁E追加ECopy リクエスチE
    onRequestCopy = null,
    onDeleteItems,

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
  const editorMode = useEditorModeStore((s) => s.editorMode);
  // TRIPLE / QUAD は廃止済み → SPLIT か SINGLE のみ
  const normalizedLayoutMode = useMemo(() => {
    if (layoutMode === LAYOUT_MODES.SPLIT) return LAYOUT_MODES.SPLIT;
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
  const viewportsData = useMemo(() => {
    // ── SPLIT: 左=Top(furniture_top) / 右=Perspective(furniture_iso) ──
    if (normalizedLayoutMode === LAYOUT_MODES.SPLIT) {
      return [
        {
          id: "vp_top",
          type: VIEW_TYPES.PERSPECTIVE,
          overrideSubMode: "furniture_top",
          overrideRotOffset: 0,
          visible: true,
          gridArea: undefined,
        },
        {
          id: "vp_persp",
          type: VIEW_TYPES.PERSPECTIVE,
          overrideSubMode: "furniture_iso",
          overrideRotOffset: 0,
          visible: true,
          gridArea: undefined,
        },
      ];
    }

    // ── SINGLE ──
    const all = [
      { id: "vp_top",   type: VIEW_TYPES.TOP },
      { id: "vp_persp", type: VIEW_TYPES.PERSPECTIVE },
      { id: "vp_front", type: VIEW_TYPES.FRONT },
      { id: "vp_right", type: VIEW_TYPES.RIGHT },
    ];
    const id = singleViewId || activeViewportId || "vp_persp";
    return all.map(t => ({
      ...t,
      type: editorMode === "layout" ? VIEW_TYPES.PERSPECTIVE : t.type,
      visible: t.id === id,
      gridArea: undefined,
    }));
  }, [normalizedLayoutMode, singleViewId, activeViewportId, editorMode]);

  // ============================================================
  // ✁Eactive viewport
  // ============================================================
  const effectiveActiveViewportId = useMemo(() => {
    if (normalizedLayoutMode !== LAYOUT_MODES.SINGLE) return activeViewportId || "vp_persp";
    return viewportsData.find(v => v.visible)?.id || activeViewportId || "vp_persp";
  }, [normalizedLayoutMode, activeViewportId, viewportsData]);

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

    const unsubscribe = useViewportKeymapStore.subscribe(
      (state) => state.keymap,
      (currentKeymap) => {
        // Just for re-triggering logic... or we can simply read from the store synchronously in the event listener.
      }
    );

    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.repeat) return;

      const { keymap } = useViewportKeymapStore.getState();
      const { setSpeedMode } = useViewportUiStore.getState();

      let matchedViewId = null;
      if (matchKeymap(e, keymap.view.perspective)) matchedViewId = "vp_persp";
      else if (matchKeymap(e, keymap.view.top)) matchedViewId = "vp_top";
      else if (matchKeymap(e, keymap.view.front)) matchedViewId = "vp_front";
      else if (matchKeymap(e, keymap.view.right)) matchedViewId = "vp_right";

      if (matchedViewId) {
        if (normalizedLayoutMode !== LAYOUT_MODES.SINGLE) {
          if (viewportsData.some(t => t.id === matchedViewId && t.visible)) {
            e.preventDefault();
            e.stopPropagation();
            onChangeActiveViewportId?.(matchedViewId);
          }
        } else {
          e.preventDefault();
          e.stopPropagation();
          onChangeActiveViewportId?.(matchedViewId);
        }
        return;
      }

      // ============================================================
      // T/Y ワンキーショートカット（モディファイアなし）
      //   T → Single モードに切り替えて Top ビュー
      //       layout モード時: furniture_top（真上から見下ろす ortho）
      //       通常モード時: vp_top（OrthographicCamera TOP）
      //   Y → Single モードに切り替えて 3D Perspective ビュー
      //       layout モード時: furniture_iso（3D ISO 透視投影）
      //       通常モード時: vp_persp（PerspectiveCamera）
      // ============================================================
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.code === "KeyT") {
          e.preventDefault();
          e.stopPropagation();
          useViewportUiStore.getState().setLayoutMode(LAYOUT_MODES.SINGLE);
          const es = useEditorModeStore.getState();
          if (es.editorMode === "layout") {
            // layout モード: 真上から見下ろす Top ビューに切替
            es.setLayoutSubMode("furniture_top");
            onChangeActiveViewportId?.("vp_persp");
          } else {
            onChangeActiveViewportId?.("vp_top");
          }
          return;
        }
        if (e.code === "KeyY") {
          e.preventDefault();
          e.stopPropagation();
          useViewportUiStore.getState().setLayoutMode(LAYOUT_MODES.SINGLE);
          const es = useEditorModeStore.getState();
          if (es.editorMode === "layout") {
            // layout モード: 3D ISO 透視投影ビューに切替
            es.setLayoutSubMode("furniture_iso");
            es.setLayoutCameraTilt("default"); // tilt による furniture_top 上書きをリセット
          }
          onChangeActiveViewportId?.("vp_persp");
          return;
        }
      }

      // 速度切り替えの判定 (SPEED)
      let matchedSpeedMode = null;
      if (matchKeymap(e, keymap.speed.inspect)) matchedSpeedMode = "inspect";
      else if (matchKeymap(e, keymap.speed.walk)) matchedSpeedMode = "walk";
      else if (matchKeymap(e, keymap.speed.cycle)) matchedSpeedMode = "cycle";
      else if (matchKeymap(e, keymap.speed.drive)) matchedSpeedMode = "drive";
      else if (matchKeymap(e, keymap.speed.fly)) matchedSpeedMode = "fly";

      if (matchedSpeedMode) {
        e.preventDefault();
        e.stopPropagation();
        setSpeedMode(matchedSpeedMode);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      unsubscribe();
    };
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
  const theme = useTheme();

  const gridSx = useMemo(() => {
    if (normalizedLayoutMode === LAYOUT_MODES.SPLIT) {
      return {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr",
        gap: "4px", p: "4px", width: "100%", height: "100%", minWidth: 0, minHeight: 0,
      };
    }
    // SINGLE
    return {
      display: "grid",
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr",
      gap: "4px", p: "4px", width: "100%", height: "100%", minWidth: 0, minHeight: 0,
    };
  }, [normalizedLayoutMode]);

  const layoutLabel = normalizedLayoutMode.toUpperCase();

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
      {/* <Box
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
            Shortcuts: Ctrl+1=Persp / Ctrl+2=Top / Ctrl+3=Front / Ctrl+4=Right
          </Typography>
        </Stack>
      </Box> */}

      <Box sx={gridSx}>
        {viewportsData.map((t, idx) => {
          const id = t?.id || `vp_${idx}`;
          const type = t?.type || VIEW_TYPES.PERSPECTIVE;
          const visible = t?.visible;

          const active = id === effectiveActiveViewportId;

          // Gizmoは今まで通り Persp/Top でだけ表示
          const showGizmo = active && (type === VIEW_TYPES.PERSPECTIVE || type === VIEW_TYPES.TOP);
          const allowDrop = !materialPicking;

          return (
            <Box
              key={id}
              onClick={(e) => {
                // Avoid activating if clicking on the UI overlays inside SingleViewportCanvas
                // but generally we want to activate on click. SingleViewportCanvas handles its own pointer down as well.
                activate(id);
              }}
              sx={{
                display: visible ? "block" : "none",
                position: "relative",
                minHeight: 0,
                minWidth: 0,
                gridArea: t.gridArea,
                borderRadius: 1,
                border: active ? `2px solid ${theme.palette.primary.main}` : `2px solid transparent`,
                transition: "border-color 0.2s ease",
                "&:hover": {
                  borderColor: active ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.4),
                }
              }}
            >

              <SingleViewportCanvas
                viewportId={id}
                type={type}
                active={active}
                overrideSubMode={t.overrideSubMode}
                overrideRotOffset={t.overrideRotOffset}
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
                onDeleteItems={onDeleteItems} // <-- Pass down
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
