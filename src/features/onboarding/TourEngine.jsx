import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Box, Typography, Button, Stack, IconButton, LinearProgress } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  sleep, resolveTarget, waitFor, clickTarget, switchTab, typeInto, clearInput, isVisible,
} from "./tourUtils";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";
const PW = 320;
const GAP = 14;

// onEnter / step が使えるアクション集
const tourActions = {
  sleep,
  switchTab,
  typeInto,
  clearInput,
  clickText: (text, tag) => clickTarget({ text, tag }),
  click: (target) => clickTarget(target),
  waitFor,
  // チャットパネルが閉じているときだけ開く（トグルの誤クローズ防止）
  ensureChatOpen: async () => {
    const input = document.querySelector('[placeholder*="何でも"]');
    const open = input && input.getBoundingClientRect().width > 0;
    if (!open) {
      await clickTarget('[data-tour="chat-toggle"]', 1500);
      await sleep(650);
    }
  },
};

function computePopoverStyle(rect) {
  const pH = 250;
  if (!rect) {
    return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: PW };
  }
  const vw = window.innerWidth, vh = window.innerHeight;
  let top = rect.bottom + GAP;
  let left = rect.left + rect.width / 2 - PW / 2;
  if (top + pH > vh - GAP) top = Math.max(GAP, rect.top - pH - GAP);
  left = Math.max(GAP, Math.min(vw - PW - GAP, left));
  return { position: "fixed", top, left, width: PW };
}

export default function TourEngine({ tour, onFinish }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState(null);
  const elRef = useRef(null);
  const targetRef = useRef(null);
  const lastRectRef = useRef(null);
  const tickRef = useRef(null);
  const runIdRef = useRef(0);

  const steps = tour?.steps ?? [];
  const step = steps[stepIdx];

  // ステップ遷移時: onEnter 実行 → target 解決 → 表示
  useEffect(() => {
    if (!step) return;
    const myRun = ++runIdRef.current;
    setReady(false);
    setRect(null);
    elRef.current = null;
    targetRef.current = step.target || null;
    lastRectRef.current = null;

    (async () => {
      try {
        if (step.onEnter) await step.onEnter(tourActions);
      } catch (e) {
        console.warn("[Tour] onEnter error", e);
      }
      if (myRun !== runIdRef.current) return; // 古いステップは破棄

      let el = null;
      if (step.target) {
        el = step.waitTarget
          ? await waitFor(step.target, 3000)
          : resolveTarget(step.target);
      }
      if (myRun !== runIdRef.current) return;

      elRef.current = el || null;
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
        await sleep(180);
      }
      if (myRun !== runIdRef.current) return;
      setReady(true);
    })();

    return () => { runIdRef.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, tour]);

  // 矩形を定期追跡。タブ有効化や入力で対象ノードが再生成されるため、
  // キャッシュが切れていれば毎回セレクタから再解決してライブノードを掴み直す。
  // requestAnimationFrame は非表示タブで停止するため setInterval を使う。
  useEffect(() => {
    if (!ready) return;
    const loop = () => {
      let el = elRef.current;
      if (!el || !el.isConnected || !isVisible(el)) {
        el = targetRef.current ? resolveTarget(targetRef.current) : null;
        elRef.current = el;
      }
      let next = null;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) next = r.toJSON();
      }
      const prev = lastRectRef.current;
      const changed =
        (!prev && next) || (prev && !next) ||
        (prev && next && (Math.abs(prev.top - next.top) > 0.5 ||
          Math.abs(prev.left - next.left) > 0.5 ||
          Math.abs(prev.width - next.width) > 0.5 ||
          Math.abs(prev.height - next.height) > 0.5));
      if (changed) { lastRectRef.current = next; setRect(next); }
    };
    loop();
    tickRef.current = setInterval(loop, 33);
    return () => clearInterval(tickRef.current);
  }, [ready, stepIdx]);

  // アクション完了の自動検知 → 自動で次へ（例: 送信して入力欄が空になったら）。
  // 「一度 未完了 を観測してから 完了」になった時だけ進める（初期状態での誤進行防止）。
  useEffect(() => {
    if (!ready || typeof step?.advanceWhen !== "function") return;
    let armed = false;
    let done = false;
    const iv = setInterval(() => {
      let ok = false;
      try { ok = !!step.advanceWhen(); } catch { ok = false; }
      if (!ok) { armed = true; return; }
      if (ok && armed && !done) {
        done = true;
        clearInterval(iv);
        if (!isLast) setStepIdx((i) => i + 1);
        else onFinish?.();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [ready, stepIdx, step, isLast, onFinish]);

  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;
  const pct = ((stepIdx + 1) / steps.length) * 100;

  const goNext = useCallback(() => {
    if (!isLast) setStepIdx((i) => i + 1);
    else onFinish?.();
  }, [isLast, onFinish]);

  const goPrev = useCallback(() => {
    if (!isFirst) setStepIdx((i) => i - 1);
  }, [isFirst]);

  if (!step || !ready) return null;

  const popoverStyle = computePopoverStyle(rect);
  const isAction = !!step.action;
  const emphasize = isAction || !!step.pulse;
  const pad = step.spotlightPad ?? (isAction ? 10 : 6);
  const padded = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  return ReactDOM.createPortal(
    <>
      {padded ? (
        <Box
          sx={{
            position: "fixed",
            top: padded.top, left: padded.left, width: padded.width, height: padded.height,
            borderRadius: "8px",
            boxShadow: emphasize
              ? "0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 4px rgba(167,139,250,0.95), 0 0 22px 6px rgba(124,58,237,0.7)"
              : "0 0 0 9999px rgba(0,0,0,0.66)",
            outline: emphasize ? "3px solid rgba(167,139,250,1)" : "2px solid rgba(124,58,237,0.85)",
            outlineOffset: "2px",
            zIndex: 99990,
            pointerEvents: "none",
            transition: "top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease",
            animation: emphasize ? "tourPulse 1.25s ease-in-out infinite" : "none",
            "@keyframes tourPulse": {
              "0%, 100%": { boxShadow: "0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 3px rgba(167,139,250,0.9), 0 0 14px 3px rgba(124,58,237,0.45)" },
              "50%": { boxShadow: "0 0 0 9999px rgba(0,0,0,0.66), 0 0 0 7px rgba(167,139,250,1), 0 0 30px 12px rgba(124,58,237,0.9)" },
            },
          }}
        />
      ) : (
        <Box sx={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99990, pointerEvents: "none" }} />
      )}

      <Box
        sx={{
          ...popoverStyle,
          zIndex: 99991,
          background: "rgba(10,8,25,0.97)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(124,58,237,0.4)",
          borderRadius: 3,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 3, bgcolor: "rgba(255,255,255,0.06)", "& .MuiLinearProgress-bar": { background: GRAD } }}
        />

        <Stack spacing={1.5} sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#fff", lineHeight: 1.35, flex: 1, mr: 1 }}>
              {step.title}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>
                {stepIdx + 1}/{steps.length}
              </Typography>
              <IconButton size="small" onClick={onFinish}
                sx={{ color: "rgba(255,255,255,0.28)", p: 0.3, "&:hover": { color: "rgba(255,255,255,0.7)" } }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Box>

          <Typography sx={{ fontSize: "0.84rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
            {step.body}
          </Typography>

          {step.hint && (
            <Box sx={{ px: 1.5, py: 0.8, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: "0.78rem", color: "rgba(170,135,255,0.95)", fontWeight: 600 }}>
                💡 {step.hint}
              </Typography>
            </Box>
          )}

          <Stack direction="row" alignItems="center" sx={{ pt: 0.5 }}>
            {!isFirst ? (
              <Button variant="text" size="small" onClick={goPrev} startIcon={<ArrowBackIcon sx={{ fontSize: 13 }} />}
                sx={{ color: "rgba(255,255,255,0.38)", textTransform: "none", fontSize: "0.78rem", px: 1, minWidth: 0 }}>
                戻る
              </Button>
            ) : <Box />}
            <Box sx={{ flex: 1 }} />
            {isAction ? (
              // アクション手順: 主役は「ハイライトされた操作」。操作すると自動で次へ進む。
              // 「次へ」は誤操作を誘うので控えめなスキップに。
              <Button variant="text" size="small" onClick={goNext}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 12 }} />}
                sx={{ color: "rgba(255,255,255,0.4)", textTransform: "none", fontSize: "0.76rem", px: 1.2,
                  "&:hover": { color: "rgba(255,255,255,0.75)" } }}>
                スキップ
              </Button>
            ) : (
              <Button variant="contained" size="small" onClick={goNext}
                endIcon={!isLast && <ArrowForwardIcon sx={{ fontSize: 13 }} />}
                sx={{ background: GRAD, textTransform: "none", fontWeight: 700, fontSize: "0.82rem", borderRadius: "100px", px: 2.2,
                  "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)" } }}>
                {isLast ? "完了！" : "次へ"}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </>,
    document.body
  );
}
