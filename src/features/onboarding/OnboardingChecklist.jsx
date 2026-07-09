import React, { useState, useEffect } from "react";
import {
  Box, Typography, IconButton, Stack, Checkbox, LinearProgress, Button, Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChecklistRtlIcon from "@mui/icons-material/ChecklistRtl";
import ReplayIcon from "@mui/icons-material/Replay";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { useAuth } from "@/features/auth/context/AuthContext";
import { CHAPTER_LIST, SCENARIO_LIST } from "./tours";

const GRAD = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

const BASE_ITEMS = [
  { key: "layout",  label: "S.Layout で AI レイアウトを試す", desc: "タブから S.Layout を開いて生成してみよう" },
  { key: "models",  label: "3D モデルを空間に置く",          desc: "S.Model から家具を選んで配置" },
  { key: "project", label: "プロジェクトを作成する",          desc: "左サイドバーの「MY PROJECTS ＋」から" },
];

const ACCOUNT_ITEM = { key: "account", label: "アカウントを登録してデータを保存", desc: "下のバナーから無料登録できます" };

export default function OnboardingChecklist({
  checklist, onToggle, onReplayHero, onStartChapter, onStartScenario, tourActive,
}) {
  const [open, setOpen] = useState(false);
  const { isAnonymous } = useAuth();

  // ツアー実行中はパネルを閉じる（ポップオーバーとの重なり防止）
  useEffect(() => {
    if (tourActive) setOpen(false);
  }, [tourActive]);

  // ツアー/シナリオ起動: パネルを閉じてから起動
  const launch = (fn) => { setOpen(false); fn?.(); };

  const accountDone = !isAnonymous;
  const countDone = BASE_ITEMS.filter((i) => checklist[i.key]).length + (accountDone ? 1 : 0);
  const countTotal = BASE_ITEMS.length + 1;
  const pct = (countDone / countTotal) * 100;

  return (
    <>
      <Tooltip title={open ? "閉じる" : "はじめてガイド"} placement="right">
        <Box
          id="onboarding-checklist-btn"
          onClick={() => setOpen((v) => !v)}
          sx={{
            position: "fixed", bottom: 20, left: 72, zIndex: 99980,
            display: "flex", alignItems: "center", gap: 1,
            px: open ? 1.5 : 2, py: 1, borderRadius: "100px",
            background: open ? "rgba(30,20,60,0.95)" : GRAD,
            border: open ? "1px solid rgba(124,58,237,0.4)" : "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)", cursor: "pointer",
            transition: "all 0.2s", "&:hover": { transform: "scale(1.05)" },
          }}
        >
          <ChecklistRtlIcon sx={{ fontSize: 18, color: "#fff" }} />
          {!open && (
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", userSelect: "none" }}>
              ガイド {countDone}/{countTotal}
            </Typography>
          )}
        </Box>
      </Tooltip>

      <Box
        sx={{
          position: "fixed", bottom: 68, left: 72, zIndex: 99979, width: 308,
          maxHeight: "78vh", overflowY: "auto",
          background: "rgba(10,8,25,0.96)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(124,58,237,0.3)", borderRadius: 3,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          pointerEvents: open ? "auto" : "none",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.2s, transform 0.2s",
        }}
      >
        <Box sx={{ position: "sticky", top: 0, background: GRAD, px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>はじめてガイド</Typography>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.7)", p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>進捗</Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>{countDone} / {countTotal}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={pct}
            sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.08)", "& .MuiLinearProgress-bar": { background: GRAD, borderRadius: 3 } }} />
        </Box>

        <Stack sx={{ px: 1, py: 1 }}>
          {BASE_ITEMS.map((item) => (
            <Box key={item.key} onClick={() => onToggle(item.key)}
              sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, px: 1, py: 0.8, borderRadius: 2, cursor: "pointer",
                "&:hover": { background: "rgba(255,255,255,0.04)" } }}>
              <Checkbox checked={!!checklist[item.key]} size="small"
                sx={{ p: 0, mt: "2px", color: "rgba(255,255,255,0.25)", "&.Mui-checked": { color: "#7C3AED" } }} />
              <Box>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600,
                  color: checklist[item.key] ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
                  textDecoration: checklist[item.key] ? "line-through" : "none", lineHeight: 1.3 }}>
                  {item.label}
                </Typography>
                {!checklist[item.key] && (
                  <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", mt: 0.2 }}>{item.desc}</Typography>
                )}
              </Box>
            </Box>
          ))}

          {isAnonymous && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, px: 1, py: 0.8, borderRadius: 2, opacity: 0.9 }}>
              <Checkbox checked={false} size="small" disabled sx={{ p: 0, mt: "2px", color: "rgba(255,255,255,0.25)" }} />
              <Box>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.3 }}>
                  {ACCOUNT_ITEM.label}
                </Typography>
                <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", mt: 0.2 }}>{ACCOUNT_ITEM.desc}</Typography>
              </Box>
            </Box>
          )}
        </Stack>

        {/* やってみる（シナリオ） */}
        <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: 0.6, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", mb: 1 }}>
            やってみる
          </Typography>
          <Stack spacing={0.6}>
            {SCENARIO_LIST.map((sc) => (
              <Box key={sc.id} onClick={() => launch(() => onStartScenario?.(sc.id))}
                sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.2, py: 1, borderRadius: 2,
                  background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.25)", cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                  "&:hover": { background: "rgba(124,58,237,0.2)", borderColor: "rgba(124,58,237,0.55)" } }}>
                <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: GRAD,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <RocketLaunchRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.9)", lineHeight: 1.25 }}>
                    {sc.label}
                  </Typography>
                  {sc.sub && (
                    <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", mt: 0.1 }}>
                      {sc.sub}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* 機能別の深掘りツアー */}
        <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: 0.6, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", mb: 1 }}>
            機能別ツアー
          </Typography>
          <Stack spacing={0.6}>
            {CHAPTER_LIST.map((ch) => (
              <Box key={ch.id} onClick={() => launch(() => onStartChapter(ch.id))}
                sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.2, py: 0.9, borderRadius: 2,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                  "&:hover": { background: "rgba(124,58,237,0.12)", borderColor: "rgba(124,58,237,0.4)" } }}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(124,58,237,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 15, color: "#a78bfa" }} />
                </Box>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.82)" }}>
                  {ch.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box sx={{ px: 2, pb: 2 }}>
          <Button fullWidth size="small" variant="outlined" startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
            onClick={() => { setOpen(false); onReplayHero?.(); }}
            sx={{ borderColor: "rgba(124,58,237,0.4)", color: "rgba(255,255,255,0.5)", textTransform: "none",
              fontSize: "0.78rem", borderRadius: "100px",
              "&:hover": { borderColor: "rgba(124,58,237,0.8)", color: "rgba(255,255,255,0.8)", background: "rgba(124,58,237,0.08)" } }}>
            ヒーローツアーをもう一度
          </Button>
        </Box>
      </Box>
    </>
  );
}
