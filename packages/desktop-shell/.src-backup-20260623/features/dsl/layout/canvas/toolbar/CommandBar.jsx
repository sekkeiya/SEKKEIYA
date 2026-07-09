// src/features/layout/components/MainArea/components/toolbar/CommandBar.jsx
import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { TextField, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

export default function CommandBar() {
  const inputRef = useRef(null);

  const commandOpen = useViewportUiStore((s) => s.commandOpen);
  const commandLabel = useViewportUiStore((s) => s.commandLabel);
  const commandValue = useViewportUiStore((s) => s.commandValue);

  const setCommandValue = useViewportUiStore((s) => s.setCommandValue);
  const commitCommand = useViewportUiStore((s) => s.commitCommand);
  const cancelCommand = useViewportUiStore((s) => s.cancelCommand);

  // ✅ 重要：registerToolbarApi は “getState()” で読む（依存で揺れない）
  const registerToolbarApi = useViewportUiStore.getState().registerToolbarApi;

  // ✅ focusを1フレーム内で連打しない（無限ループ回避）
  const focusLockRef = useRef(false);

  const focusCommand = useCallback(({ select = true } = {}) => {
    const el = inputRef.current;
    if (!el) return;

    // ✅ 同期連打防止（このガードが効く）
    if (focusLockRef.current) return;
    focusLockRef.current = true;

    try {
      el.focus?.({ preventScroll: true });
      if (select) el.select?.();
    } finally {
      // ✅ 次のtickで解除（1回だけ許可）
      queueMicrotask(() => {
        focusLockRef.current = false;
      });
    }
  }, []);

  const blurCommand = useCallback(() => {
    const el = inputRef.current;
    el?.blur?.();
  }, []);

  // ✅ toolbarApi は安定オブジェクトとして登録（毎回新規にしない）
  const toolbarApi = useMemo(
    () => ({
      focusCommand,
      blurCommand,
    }),
    [focusCommand, blurCommand]
  );

  // ✅ toolbarApi を登録（Canvas側から即フォーカスできるように）
  useEffect(() => {
    console.log("[CommandBar] register toolbarApi");
    registerToolbarApi?.(toolbarApi);
    return () => {
      console.log("[CommandBar] unregister toolbarApi");
      registerToolbarApi?.(null);
    };
  }, []);

  // ✅ commandOpen が「false→true」になった瞬間だけ focus（多段はしない）
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    prevOpenRef.current = !!commandOpen;

    if (!commandOpen) return;
    if (prev) return; // 既にopenなら何もしない

    // ✅ 1回だけ（落ちる環境向けの保険は microtask 1回で十分）
    focusCommand({ select: true });
    queueMicrotask(() => focusCommand({ select: true }));
  }, [commandOpen, focusCommand]);

  const placeholder = useMemo(() => {
    if (commandOpen) {
      return commandLabel ? `${commandLabel}（例: 300）` : "数値入力（例: 300）";
    }
    return "コマンド入力（例: AT / AB / AL / AR / AH / AV）";
  }, [commandOpen, commandLabel]);

  const tooltip = useMemo(() => {
    if (commandOpen) return "Enter/Space: 確定 / Esc: キャンセル";
    return "AT/AB/AL/AR/AH/AV などを入力 → Enter/Space で実行";
  }, [commandOpen]);

  if (!commandOpen) return null;

  return (
    <Tooltip title={tooltip} arrow>
      <TextField
        inputRef={inputRef}
        value={commandValue}
        onChange={(e) => setCommandValue?.(e.target.value)}
        placeholder={placeholder}
        size="small"
        inputProps={{
          readOnly: false,
          tabIndex: 0,
        }}
        sx={{
          position: "fixed",
          top: 120,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          width: 320,
          opacity: 1,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          borderRadius: 2,
          background: alpha("#0b1022", 0.85),
          backdropFilter: "blur(12px)",
          "& .MuiOutlinedInput-root": {
            height: 48,
            fontSize: 16,
            fontWeight: 700,
            color: alpha("#fff", 0.95),
            "& fieldset": { borderColor: alpha("#fff", 0.15), borderRadius: 2 },
            "&:hover fieldset": { borderColor: alpha("#fff", 0.3) },
            "&.Mui-focused fieldset": { borderColor: alpha("#6ea8ff", 0.8) },
          },
          "& input::placeholder": {
            color: alpha("#fff", 0.5),
            opacity: 1,
            fontWeight: 400,
          },
        }}
        onKeyDown={(e) => {
          if (e.isComposing) return;

          const isSpace = e.code === "Space" || e.key === " " || e.key === "Spacebar";

          if (e.key === "Enter" || isSpace) {
            e.preventDefault();
            e.stopPropagation();
            commitCommand?.();
            return;
          }

          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelCommand?.();
          }
        }}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onPointerMoveCapture={(e) => e.stopPropagation()}
        onPointerUpCapture={(e) => e.stopPropagation()}
      />
    </Tooltip>
  );
}
